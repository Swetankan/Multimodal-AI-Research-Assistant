from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from rag_pipeline import ResearchAssistantPipeline

load_dotenv(Path(__file__).with_name(".env"))

frontend_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
extra_origins = [
    item.strip()
    for item in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if item.strip()
]
frontend_origins.extend(extra_origins)

allowed_origin_regex = (
    r"^https?://("
    r"(localhost|127\.0\.0\.1)"
    r"|(192\.168\.\d+\.\d+)"
    r"|(10\.\d+\.\d+\.\d+)"
    r"|(172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)"
    r"|([a-zA-Z0-9-]+\.)*vercel\.app"
    r")(:\d+)?$"
)


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    provider: Literal["openrouter", "ollama"] = "openrouter"
    model: str = "openai/gpt-4o-mini"
    top_k: int = Field(default=4, ge=1, le=12)
    history: list[HistoryMessage] = Field(default_factory=list)


class RetrievalDebugRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=4, ge=1, le=20)


class RetrievalEvaluationRequest(BaseModel):
    query: str = Field(..., min_length=1)
    expected_terms: list[str] = Field(default_factory=list)
    top_k: int = Field(default=4, ge=1, le=20)


def create_app(pipeline_override: ResearchAssistantPipeline | None = None) -> FastAPI:
    app = FastAPI(title="Multimodal AI Research Assistant API")
    app.state.pipeline = pipeline_override

    app.add_middleware(
        CORSMiddleware,
        allow_origins=frontend_origins,
        allow_origin_regex=allowed_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def get_pipeline(request: Request) -> ResearchAssistantPipeline:
        pipeline = request.app.state.pipeline
        if pipeline is None:
            pipeline = ResearchAssistantPipeline()
            request.app.state.pipeline = pipeline
        return pipeline

    @app.get("/")
    async def healthcheck(request: Request) -> JSONResponse:
        pipeline = get_pipeline(request)
        return JSONResponse(
            {
                "status": "ok",
                "documents_indexed": pipeline.vector_store.has_documents(),
                "chunks_indexed": pipeline.vector_store.document_count(),
                "vector_store": pipeline.vector_store.describe(),
                "allowed_origins": frontend_origins,
                "allowed_origin_regex": allowed_origin_regex,
            }
        )

    @app.post("/upload")
    async def upload_pdf(
        request: Request,
        file: UploadFile = File(...),
        chunk_size: int = Form(default=700)
    ) -> JSONResponse:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Missing file name")

        if Path(file.filename).suffix.lower() != ".pdf":
            raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

        pipeline = get_pipeline(request)
        temp_path: str | None = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                temp_path = temp_file.name
                shutil.copyfileobj(file.file, temp_file)

            chunks_indexed = pipeline.ingest_pdf(temp_path, chunk_size=chunk_size)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        finally:
            await file.close()
            if temp_path:
                Path(temp_path).unlink(missing_ok=True)

        return JSONResponse(
            {
                "filename": file.filename,
                "chunks_indexed": chunks_indexed,
                "message": f"PDF uploaded: {file.filename}",
                "vector_store": pipeline.vector_store.describe()
            }
        )

    @app.post("/reset")
    async def reset_memory(request: Request) -> JSONResponse:
        pipeline = get_pipeline(request)
        pipeline.vector_store.clear()
        return JSONResponse(
            {
                "message": "Chat memory and indexed PDF context cleared.",
                "vector_store": pipeline.vector_store.describe()
            }
        )

    @app.post("/chat")
    async def chat(request: Request, payload: ChatRequest) -> StreamingResponse:
        pipeline = get_pipeline(request)
        history = [
            message.model_dump() if hasattr(message, "model_dump") else message.dict()
            for message in payload.history
        ]
        stream = pipeline.stream_chat(
            query=payload.query,
            history=history,
            provider=payload.provider,
            model=payload.model,
            top_k=payload.top_k
        )
        return StreamingResponse(stream, media_type="application/x-ndjson")

    @app.post("/retrieval/debug")
    async def retrieval_debug(request: Request, payload: RetrievalDebugRequest) -> JSONResponse:
        pipeline = get_pipeline(request)
        return JSONResponse(pipeline.retrieval_debug(query=payload.query, top_k=payload.top_k))

    @app.post("/retrieval/evaluate")
    async def retrieval_evaluate(
        request: Request,
        payload: RetrievalEvaluationRequest
    ) -> JSONResponse:
        pipeline = get_pipeline(request)
        return JSONResponse(
            pipeline.evaluate_retrieval(
                query=payload.query,
                expected_terms=payload.expected_terms,
                top_k=payload.top_k
            )
        )

    return app


app = create_app()