from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


@dataclass
class RetrievedChunk:
    id: str
    text: str
    score: float
    dense_score: float = 0.0
    lexical_score: float = 0.0


class FaissVectorStore:
    def __init__(
        self,
        embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2",
        storage_dir: str | Path = "storage"
    ) -> None:
        self.embedding_model_name = embedding_model
        self.encoder = SentenceTransformer(embedding_model)
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.index_path = self.storage_dir / "faiss.index"
        self.metadata_path = self.storage_dir / "chunks.json"
        self.index: faiss.IndexFlatIP | None = None
        self.chunks: list[RetrievedChunk] = []
        self.load()

    def clear(self) -> None:
        self.index = None
        self.chunks = []
        self._delete_persisted_files()

    def _delete_persisted_files(self) -> None:
        self.index_path.unlink(missing_ok=True)
        self.metadata_path.unlink(missing_ok=True)

    def _embed(self, texts: Iterable[str]) -> np.ndarray:
        embeddings = self.encoder.encode(
            list(texts),
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False
        )
        return np.asarray(embeddings, dtype="float32")

    def add_texts(self, texts: list[str]) -> int:
        if not texts:
            return 0

        embeddings = self._embed(texts)
        self.index = faiss.IndexFlatIP(embeddings.shape[1])
        self.index.add(embeddings)
        self.chunks = [
            RetrievedChunk(id=f"chunk-{offset}", text=text, score=0.0)
            for offset, text in enumerate(texts, start=1)
        ]
        self.save()
        return len(texts)

    def save(self) -> None:
        if self.index is None:
            return

        faiss.write_index(self.index, str(self.index_path))
        payload = {
            "embedding_model": self.embedding_model_name,
            "chunks": [asdict(chunk) for chunk in self.chunks]
        }
        self.metadata_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")

    def load(self) -> bool:
        if not self.index_path.exists() or not self.metadata_path.exists():
            return False

        self.index = faiss.read_index(str(self.index_path))
        payload = json.loads(self.metadata_path.read_text(encoding="utf-8"))
        self.chunks = [RetrievedChunk(**item) for item in payload.get("chunks", [])]
        return bool(self.chunks)

    def search(self, query: str, top_k: int = 4, oversample_factor: int = 3) -> list[RetrievedChunk]:
        if self.index is None or not self.chunks:
            return []

        query_embedding = self._embed([query])
        search_k = min(max(top_k * oversample_factor, top_k), len(self.chunks))
        scores, indices = self.index.search(query_embedding, search_k)

        query_terms = self._tokenize(query)
        dense_candidates: list[RetrievedChunk] = []
        for dense_score, index in zip(scores[0], indices[0]):
            if index < 0:
                continue
            chunk = self.chunks[index]
            lexical_score = self._lexical_score(query_terms, chunk.text)
            final_score = (0.72 * self._normalize_dense_score(float(dense_score))) + (0.28 * lexical_score)
            dense_candidates.append(
                RetrievedChunk(
                    id=chunk.id,
                    text=chunk.text,
                    score=final_score,
                    dense_score=float(dense_score),
                    lexical_score=lexical_score
                )
            )

        ranked = sorted(
            dense_candidates,
            key=lambda item: (item.score, item.lexical_score, item.dense_score),
            reverse=True
        )
        return ranked[:top_k]

    def has_documents(self) -> bool:
        return bool(self.chunks)

    def document_count(self) -> int:
        return len(self.chunks)

    def describe(self) -> dict[str, str | int | bool]:
        return {
            "storage_dir": str(self.storage_dir),
            "index_path": str(self.index_path),
            "metadata_path": str(self.metadata_path),
            "chunks_indexed": len(self.chunks),
            "persisted": self.index_path.exists() and self.metadata_path.exists()
        }

    @staticmethod
    def _tokenize(text: str) -> set[str]:
        return {
            token
            for token in re.findall(r"[a-zA-Z0-9]+", text.lower())
            if len(token) > 2
        }

    def _lexical_score(self, query_terms: set[str], chunk_text: str) -> float:
        if not query_terms:
            return 0.0

        chunk_terms = self._tokenize(chunk_text)
        if not chunk_terms:
            return 0.0

        overlap = query_terms & chunk_terms
        return len(overlap) / len(query_terms)

    @staticmethod
    def _normalize_dense_score(score: float) -> float:
        return max(0.0, min((score + 1.0) / 2.0, 1.0))