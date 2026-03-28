from __future__ import annotations

import json

from fastapi.testclient import TestClient

from main import create_app


class FakeVectorStore:
    def __init__(self) -> None:
        self.cleared = False
        self.documents_indexed = True
        self.count = 3

    def has_documents(self) -> bool:
        return self.documents_indexed

    def document_count(self) -> int:
        return self.count

    def describe(self) -> dict[str, object]:
        return {
            "storage_dir": "memory",
            "chunks_indexed": self.count,
            "persisted": False,
        }

    def clear(self) -> None:
        self.cleared = True
        self.documents_indexed = False
        self.count = 0


class FakePipeline:
    def __init__(self) -> None:
        self.vector_store = FakeVectorStore()
        self.ingested: list[tuple[str, int]] = []

    def ingest_pdf(self, file_path: str, chunk_size: int = 700) -> int:
        self.ingested.append((file_path, chunk_size))
        self.vector_store.documents_indexed = True
        self.vector_store.count = 5
        return 5

    async def stream_chat(self, query: str, history: list[dict[str, str]], provider: str, model: str, top_k: int):
        del history, provider, model, top_k
        for payload in (
            {"type": "thinking"},
            {"type": "token", "token": f"Echo: {query}"},
            {"type": "sources", "sources": [{"id": "chunk-1", "text": "alpha", "score": 0.9}]},
            {"type": "done"},
        ):
            yield json.dumps(payload) + "\n"

    def retrieval_debug(self, query: str, top_k: int) -> dict[str, object]:
        return {
            "query": query,
            "top_k": top_k,
            "results": [{"id": "chunk-1", "text": "alpha", "score": 0.9}],
        }

    def evaluate_retrieval(self, query: str, expected_terms: list[str], top_k: int) -> dict[str, object]:
        return {
            "query": query,
            "top_k": top_k,
            "expected_terms": expected_terms,
            "matched_terms": expected_terms[:1],
            "term_recall": 1.0 if expected_terms else 0.0,
            "any_hit": bool(expected_terms),
            "results": [{"id": "chunk-1", "text": "alpha", "score": 0.9}],
        }


def create_test_client() -> tuple[TestClient, FakePipeline]:
    pipeline = FakePipeline()
    app = create_app(pipeline)
    return TestClient(app), pipeline


def test_healthcheck_returns_vector_store_metadata() -> None:
    client, _ = create_test_client()

    response = client.get("/")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["documents_indexed"] is True
    assert body["vector_store"]["chunks_indexed"] == 3


def test_upload_rejects_non_pdf_files() -> None:
    client, _ = create_test_client()

    response = client.post(
        "/upload",
        files={"file": ("notes.txt", b"plain text", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only PDF uploads are supported"


def test_upload_accepts_pdf_and_calls_pipeline() -> None:
    client, pipeline = create_test_client()

    response = client.post(
        "/upload",
        data={"chunk_size": "512"},
        files={"file": ("paper.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["chunks_indexed"] == 5
    assert body["filename"] == "paper.pdf"
    assert pipeline.ingested
    assert pipeline.ingested[0][1] == 512


def test_reset_clears_vector_store() -> None:
    client, pipeline = create_test_client()

    response = client.post("/reset")

    assert response.status_code == 200
    assert pipeline.vector_store.cleared is True
    assert response.json()["vector_store"]["chunks_indexed"] == 0


def test_chat_streams_expected_events() -> None:
    client, _ = create_test_client()

    response = client.post(
        "/chat",
        json={
            "query": "summarize this",
            "provider": "openrouter",
            "model": "openai/gpt-4o-mini",
            "top_k": 4,
            "history": [],
        },
    )

    assert response.status_code == 200
    lines = [json.loads(line) for line in response.text.strip().splitlines()]
    assert lines[0]["type"] == "thinking"
    assert lines[1]["type"] == "token"
    assert lines[-1]["type"] == "done"


def test_retrieval_evaluate_returns_metrics() -> None:
    client, _ = create_test_client()

    response = client.post(
        "/retrieval/evaluate",
        json={
            "query": "key contributions",
            "expected_terms": ["benchmark", "ablation"],
            "top_k": 5,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "key contributions"
    assert body["term_recall"] == 1.0
    assert body["any_hit"] is True