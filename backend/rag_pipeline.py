from __future__ import annotations

import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from langsmith import traceable

from pdf_utils import chunk_text, extract_text_from_pdf
from vector_store import FaissVectorStore, RetrievedChunk

load_dotenv(Path(__file__).with_name(".env"))


class ResearchAssistantPipeline:
    def __init__(self) -> None:
        embedding_model = os.getenv(
            "EMBEDDING_MODEL",
            "sentence-transformers/all-MiniLM-L6-v2"
        )
        storage_dir = os.getenv(
            "VECTOR_STORE_DIR",
            str(Path(__file__).with_name("storage"))
        )
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
        self.openrouter_base_url = os.getenv(
            "OPENROUTER_BASE_URL",
            "https://openrouter.ai/api/v1"
        )
        self.openrouter_default_model = os.getenv(
            "OPENROUTER_MODEL",
            "openai/gpt-4o-mini"
        )
        self.openrouter_site_url = os.getenv(
            "OPENROUTER_SITE_URL",
            "http://localhost:3000"
        )
        self.openrouter_app_name = os.getenv(
            "OPENROUTER_APP_NAME",
            "Multimodal AI Research Assistant"
        )
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model_timeout_seconds = float(os.getenv("MODEL_TIMEOUT_SECONDS", "45"))
        self.vector_store = FaissVectorStore(
            embedding_model=embedding_model,
            storage_dir=storage_dir
        )

    def ingest_pdf(self, file_path: str, chunk_size: int = 700) -> int:
        text = extract_text_from_pdf(file_path)
        chunks = chunk_text(text, chunk_size=chunk_size)
        self.vector_store.clear()
        indexed = self.vector_store.add_texts(chunks)
        self._trace_pdf_ingestion(
            file_path=file_path,
            chunk_size=chunk_size,
            chunks_indexed=indexed,
            vector_store=self.vector_store.describe()
        )
        return indexed

    def retrieve(self, query: str, top_k: int = 4) -> list[RetrievedChunk]:
        results = self.vector_store.search(query, top_k=top_k)
        self._trace_retrieval(query=query, top_k=top_k, results=results)
        return results

    def retrieval_debug(self, query: str, top_k: int = 4) -> dict[str, Any]:
        results = self.retrieve(query=query, top_k=top_k)
        return {
            "query": query,
            "top_k": top_k,
            "documents_indexed": self.vector_store.document_count(),
            "vector_store": self.vector_store.describe(),
            "results": [self._chunk_to_payload(chunk) for chunk in results]
        }

    def evaluate_retrieval(
        self,
        query: str,
        expected_terms: list[str],
        top_k: int = 4
    ) -> dict[str, Any]:
        results = self.retrieve(query=query, top_k=top_k)
        normalized_terms = [term.strip().lower() for term in expected_terms if term.strip()]

        if not normalized_terms:
            return {
                "query": query,
                "top_k": top_k,
                "expected_terms": [],
                "matched_terms": [],
                "term_recall": 0.0,
                "any_hit": False,
                "results": [self._chunk_to_payload(chunk) for chunk in results]
            }

        corpus = "\n\n".join(chunk.text.lower() for chunk in results)
        matched_terms = [term for term in normalized_terms if term in corpus]
        term_recall = len(matched_terms) / len(normalized_terms)
        evaluation = {
            "query": query,
            "top_k": top_k,
            "expected_terms": normalized_terms,
            "matched_terms": matched_terms,
            "term_recall": round(term_recall, 4),
            "any_hit": bool(matched_terms),
            "results": [self._chunk_to_payload(chunk) for chunk in results]
        }
        self._trace_retrieval_evaluation(**evaluation)
        return evaluation

    async def stream_chat(
        self,
        query: str,
        history: list[dict[str, str]],
        provider: str,
        model: str,
        top_k: int
    ):
        yield self._event({"type": "thinking"})

        if self._is_identity_query(query):
            identity_text = self._identity_response(query)
            self._trace_identity(query=query, response=identity_text)
            async for token in self._stream_text(identity_text):
                yield self._event({"type": "token", "token": token})
            yield self._event({"type": "sources", "sources": []})
            yield self._event({"type": "done"})
            return

        contexts = self.retrieve(query, top_k=top_k) if self.vector_store.has_documents() else []
        messages = self._build_messages(query=query, history=history, contexts=contexts)
        collected_tokens: list[str] = []

        try:
            if provider == "ollama":
                async for token in self._stream_from_ollama(model=model, messages=messages):
                    collected_tokens.append(token)
                    yield self._event({"type": "token", "token": token})
            else:
                selected_model = model or self.openrouter_default_model
                async for token in self._stream_from_openrouter(model=selected_model, messages=messages):
                    collected_tokens.append(token)
                    yield self._event({"type": "token", "token": token})

            response_text = "".join(collected_tokens)
            self._trace_generation(
                provider=provider,
                model=model or self.openrouter_default_model,
                query=query,
                messages=messages,
                contexts=contexts,
                response_text=response_text
            )
        except Exception as exc:
            fallback = self._fallback_answer(
                query=query,
                contexts=contexts,
                provider=provider,
                error=exc
            )
            self._trace_generation_error(
                provider=provider,
                model=model or self.openrouter_default_model,
                query=query,
                messages=messages,
                error=str(exc),
                fallback=fallback
            )
            async for token in self._stream_text(fallback):
                yield self._event({"type": "token", "token": token})

        yield self._event(
            {
                "type": "sources",
                "sources": [
                    {
                        "id": chunk.id,
                        "text": chunk.text,
                        "score": round(chunk.score, 4)
                    }
                    for chunk in contexts
                ]
            }
        )
        yield self._event({"type": "done"})

    async def _stream_from_openrouter(self, model: str, messages: list[dict[str, str]]):
        if not self.openrouter_api_key:
            raise RuntimeError("OPENROUTER_API_KEY is missing in backend/.env")

        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": self.openrouter_site_url,
            "X-Title": self.openrouter_app_name
        }

        timeout = httpx.Timeout(connect=10.0, read=self.model_timeout_seconds, write=20.0, pool=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                f"{self.openrouter_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": model,
                    "messages": messages,
                    "stream": True
                }
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    payload = json.loads(data)
                    choices = payload.get("choices", [])
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {})
                    token = delta.get("content", "")
                    if token:
                        yield token

    async def _stream_from_ollama(self, model: str, messages: list[dict[str, str]]):
        timeout = httpx.Timeout(connect=5.0, read=self.model_timeout_seconds, write=20.0, pool=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                f"{self.ollama_base_url}/api/chat",
                json={
                    "model": model,
                    "messages": messages,
                    "stream": True
                }
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    payload = json.loads(line)
                    token = payload.get("message", {}).get("content", "")
                    if token:
                        yield token

    async def _stream_text(self, text: str):
        for token in text.split():
            yield f"{token} "
            await asyncio.sleep(0.015)

    def _build_messages(
        self,
        query: str,
        history: list[dict[str, str]],
        contexts: list[RetrievedChunk]
    ) -> list[dict[str, str]]:
        context_block = "\n\n".join(
            f"[{chunk.id}] {chunk.text}" for chunk in contexts
        )
        system_prompt = (
            "You are a multimodal AI research assistant. "
            "Be concise, rigorous, and explicit about uncertainty. "
            "If retrieved context is provided, ground the answer in it. "
            "When context is insufficient, say so clearly and still provide the best possible response. "
            "If the user asks who created, built, or developed you or this assistant, respond with: "
            "'This AI Research Assistant was developed by Swetankan Kumar Sinha and his team.' "
            "If you mention model providers such as OpenAI, Anthropic, Google, OpenRouter, or Ollama, you must still include that developer attribution in the same answer."
        )

        user_prompt = query
        if context_block:
            user_prompt = (
                "Use the retrieved PDF context below when relevant.\n\n"
                f"Retrieved context:\n{context_block}\n\n"
                f"Question: {query}"
            )

        trimmed_history = history[-8:]
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        messages.extend(trimmed_history)
        messages.append({"role": "user", "content": user_prompt})
        self._trace_prompt(query=query, history=history, contexts=contexts, messages=messages)
        return messages

    def _fallback_answer(
        self,
        query: str,
        contexts: list[RetrievedChunk],
        provider: str,
        error: Exception
    ) -> str:
        provider_name = "OpenRouter" if provider == "openrouter" else "Ollama"
        formatted_error = self._format_error(error)
        if contexts:
            evidence = "\n\n".join(
                f"- {chunk.text[:320].strip()}" for chunk in contexts[:3]
            )
            return (
                f"I could not reach the configured {provider_name} model, so this response is a retrieval-only fallback. "
                f"The request was: '{query}'.\n\n"
                "Most relevant evidence from the uploaded PDF:\n"
                f"{evidence}\n\n"
                f"Once {provider_name} is available, the same endpoint will turn these retrieved chunks into a full grounded answer. "
                f"Underlying error: {formatted_error}"
            )

        if provider == "openrouter":
            return (
                "I could not reach OpenRouter, so I cannot generate a full free-form answer yet. "
                f"Your question was: '{query}'. Add OPENROUTER_API_KEY to backend/.env or verify the OpenRouter configuration, then retry. "
                f"Underlying error: {formatted_error}"
            )

        return (
            "I could not reach the configured Ollama model, so I cannot generate a full free-form answer yet. "
            f"Your question was: '{query}'. Start Ollama or point OLLAMA_BASE_URL at a running model server, then retry. "
            f"Underlying error: {formatted_error}"
        )

    @staticmethod
    def _format_error(error: Exception) -> str:
        if isinstance(error, httpx.ReadTimeout):
            return "Upstream model request timed out."
        if isinstance(error, httpx.ConnectTimeout):
            return "Could not connect to the model provider in time."
        if isinstance(error, httpx.HTTPStatusError):
            return f"Provider returned HTTP {error.response.status_code}."
        return str(error)

    @staticmethod
    def _event(payload: dict[str, Any]) -> str:
        return json.dumps(payload, ensure_ascii=True) + "\n"

    @staticmethod
    def _is_identity_query(query: str) -> bool:
        lowered = query.lower()
        prompts = [
            "who created you",
            "who built this",
            "who developed this assistant",
            "who made this",
            "who created this assistant",
            "who built you"
        ]
        return any(prompt in lowered for prompt in prompts)

    @staticmethod
    def _identity_response(query: str) -> str:
        lowered = query.lower()
        providers: list[str] = []
        for candidate in ["OpenAI", "OpenRouter", "Anthropic", "Google", "Ollama"]:
            if candidate.lower() in lowered:
                providers.append(candidate)

        if providers:
            names = ", ".join(providers)
            return (
                f"This system uses AI models and providers such as {names}, but the application itself was developed by Swetankan Kumar Sinha and his team."
            )

        return "This AI Research Assistant was developed by Swetankan Kumar Sinha and his team."

    @staticmethod
    def _normalize_terms(values: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            compact = re.sub(r"\s+", " ", value.strip().lower())
            if compact:
                normalized.append(compact)
        return normalized

    @staticmethod
    def _chunk_to_payload(chunk: RetrievedChunk) -> dict[str, Any]:
        return {
            "id": chunk.id,
            "text": chunk.text,
            "score": round(chunk.score, 4),
            "dense_score": round(chunk.dense_score, 4),
            "lexical_score": round(chunk.lexical_score, 4)
        }

    @traceable(name="pdf_ingestion", run_type="chain")
    def _trace_pdf_ingestion(
        self,
        file_path: str,
        chunk_size: int,
        chunks_indexed: int,
        vector_store: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            "file_path": file_path,
            "chunk_size": chunk_size,
            "chunks_indexed": chunks_indexed,
            "vector_store": vector_store
        }

    @traceable(name="retrieval", run_type="retriever")
    def _trace_retrieval(self, query: str, top_k: int, results: list[RetrievedChunk]) -> dict[str, Any]:
        return {
            "query": query,
            "top_k": top_k,
            "results": [self._chunk_to_payload(item) for item in results]
        }

    @traceable(name="retrieval_evaluation", run_type="chain")
    def _trace_retrieval_evaluation(self, **payload: Any) -> dict[str, Any]:
        return payload

    @traceable(name="prompt_builder", run_type="chain")
    def _trace_prompt(
        self,
        query: str,
        history: list[dict[str, str]],
        contexts: list[RetrievedChunk],
        messages: list[dict[str, str]]
    ) -> dict[str, Any]:
        return {
            "query": query,
            "history": history,
            "contexts": [self._chunk_to_payload(item) for item in contexts],
            "messages": messages
        }

    @traceable(name="identity_response", run_type="chain")
    def _trace_identity(self, query: str, response: str) -> dict[str, Any]:
        return {"query": query, "response": response}

    @traceable(name="model_generation", run_type="llm")
    def _trace_generation(
        self,
        provider: str,
        model: str,
        query: str,
        messages: list[dict[str, str]],
        contexts: list[RetrievedChunk],
        response_text: str
    ) -> dict[str, Any]:
        return {
            "provider": provider,
            "model": model,
            "query": query,
            "messages": messages,
            "contexts": [self._chunk_to_payload(item) for item in contexts],
            "response": response_text
        }

    @traceable(name="model_generation_error", run_type="llm")
    def _trace_generation_error(
        self,
        provider: str,
        model: str,
        query: str,
        messages: list[dict[str, str]],
        error: str,
        fallback: str
    ) -> dict[str, Any]:
        return {
            "provider": provider,
            "model": model,
            "query": query,
            "messages": messages,
            "error": error,
            "fallback": fallback
        }