from __future__ import annotations

import re
from pathlib import Path

from pypdf import PdfReader


def extract_text_from_pdf(file_path: str | Path) -> str:
    reader = PdfReader(str(file_path))
    pages: list[str] = []

    for page in reader.pages:
        pages.append(page.extract_text() or "")

    text = "\n\n".join(pages).strip()
    if not text:
        raise ValueError("The PDF did not contain extractable text.")
    return text


def _split_long_paragraph(paragraph: str, chunk_size: int, overlap: int) -> list[str]:
    slices: list[str] = []
    start = 0
    while start < len(paragraph):
        end = min(start + chunk_size, len(paragraph))
        slices.append(paragraph[start:end].strip())
        if end >= len(paragraph):
            break
        start = max(end - overlap, 0)
    return [item for item in slices if item]


def chunk_text(text: str, chunk_size: int = 700, overlap: int = 120) -> list[str]:
    normalized = re.sub(r"\r", "", text)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized).strip()
    paragraphs = [
        re.sub(r"\s+", " ", paragraph).strip()
        for paragraph in normalized.split("\n\n")
        if paragraph.strip()
    ]

    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        if len(paragraph) > chunk_size:
            if current:
                chunks.append(current.strip())
                current = ""
            chunks.extend(_split_long_paragraph(paragraph, chunk_size, overlap))
            continue

        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= chunk_size:
            current = candidate
        else:
            chunks.append(current.strip())
            current = paragraph

    if current:
        chunks.append(current.strip())

    merged: list[str] = []
    for index, chunk in enumerate(chunks):
        if index == 0:
            merged.append(chunk)
            continue
        prefix = chunks[index - 1][-overlap:].strip()
        merged.append(f"{prefix} {chunk}".strip())

    return [item for item in merged if item]
