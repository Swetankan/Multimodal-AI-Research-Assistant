from __future__ import annotations

from run_accuracy_check import evaluate_cases


class StubPipeline:
    def evaluate_retrieval(self, query: str, expected_terms: list[str], top_k: int) -> dict[str, object]:
        del top_k
        matched_terms = [term for term in expected_terms if term in query.lower()]
        recall = len(matched_terms) / len(expected_terms) if expected_terms else 0.0
        return {
            "query": query,
            "expected_terms": expected_terms,
            "matched_terms": matched_terms,
            "term_recall": round(recall, 4),
            "any_hit": bool(matched_terms),
            "results": [],
        }


def test_evaluate_cases_aggregates_summary() -> None:
    pipeline = StubPipeline()
    cases = [
        {"name": "one", "query": "benchmark ablation", "expected_terms": ["benchmark", "ablation"]},
        {"name": "two", "query": "only benchmark", "expected_terms": ["benchmark", "theorem"]},
    ]

    report = evaluate_cases(pipeline, cases, default_top_k=4)

    assert report["summary"]["case_count"] == 2
    assert report["summary"]["avg_term_recall"] == 0.75
    assert report["summary"]["hit_rate"] == 1.0
    assert report["cases"][0]["name"] == "one"