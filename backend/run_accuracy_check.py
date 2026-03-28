from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from rag_pipeline import ResearchAssistantPipeline


def load_cases(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("Evaluation cases file must be a JSON array.")
    return payload


def evaluate_cases(
    pipeline: Any,
    cases: list[dict[str, Any]],
    default_top_k: int = 4,
) -> dict[str, Any]:
    evaluations: list[dict[str, Any]] = []

    for index, case in enumerate(cases, start=1):
        query = str(case.get("query", "")).strip()
        if not query:
            raise ValueError(f"Case {index} is missing a query.")

        expected_terms = [
            str(term).strip()
            for term in case.get("expected_terms", [])
            if str(term).strip()
        ]
        top_k = int(case.get("top_k", default_top_k))
        result = pipeline.evaluate_retrieval(
            query=query,
            expected_terms=expected_terms,
            top_k=top_k,
        )
        evaluations.append(
            {
                "name": case.get("name") or f"case-{index}",
                "query": query,
                "top_k": top_k,
                **result,
            }
        )

    case_count = len(evaluations)
    avg_term_recall = round(
        sum(float(item["term_recall"]) for item in evaluations) / case_count,
        4,
    ) if evaluations else 0.0
    hit_rate = round(
        sum(1 for item in evaluations if item["any_hit"]) / case_count,
        4,
    ) if evaluations else 0.0

    return {
        "summary": {
            "case_count": case_count,
            "avg_term_recall": avg_term_recall,
            "hit_rate": hit_rate,
        },
        "cases": evaluations,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run retrieval accuracy checks against the current persisted vector store."
    )
    parser.add_argument(
        "--cases",
        default="eval_cases.sample.json",
        help="Path to a JSON file containing retrieval evaluation cases.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=4,
        help="Default top-k value for cases that do not specify one.",
    )
    parser.add_argument(
        "--output",
        default="",
        help="Optional path to write the JSON report.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    cases_path = Path(args.cases)
    if not cases_path.is_absolute():
        cases_path = Path(__file__).with_name(args.cases)

    if not cases_path.exists():
        raise SystemExit(f"Cases file not found: {cases_path}")

    pipeline = ResearchAssistantPipeline()
    if not pipeline.vector_store.has_documents():
        raise SystemExit(
            "No indexed PDF context found. Upload a PDF first, then run the accuracy check."
        )

    report = evaluate_cases(
        pipeline=pipeline,
        cases=load_cases(cases_path),
        default_top_k=args.top_k,
    )

    output = json.dumps(report, indent=2, ensure_ascii=True)
    print(output)

    if args.output:
        output_path = Path(args.output)
        if not output_path.is_absolute():
            output_path = Path.cwd() / output_path
        output_path.write_text(output, encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())