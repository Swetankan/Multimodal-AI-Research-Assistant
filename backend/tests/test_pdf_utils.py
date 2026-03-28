from __future__ import annotations

from pdf_utils import chunk_text


def test_chunk_text_preserves_overlap_and_bounds() -> None:
    text = (
        "Paragraph one contains introductory material and context.\n\n"
        "Paragraph two contains methodology details and important benchmark discussion.\n\n"
        "Paragraph three closes the loop with results and conclusions."
    )

    chunks = chunk_text(text, chunk_size=80, overlap=12)

    assert len(chunks) >= 2
    assert all(chunk.strip() for chunk in chunks)
    assert "methodology" in " ".join(chunks).lower()


def test_chunk_text_rejects_empty_output_by_returning_empty_list() -> None:
    assert chunk_text("   ") == []