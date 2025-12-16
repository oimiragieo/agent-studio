"""
Retrieval metrics for RAG evaluation.

Based on Claude Cookbooks patterns, this module provides functions to calculate
Precision, Recall, F1 Score, and Mean Reciprocal Rank (MRR) for retrieval systems.
"""

from typing import Any


def calculate_mrr(retrieved_links: list[str], correct_links: list[str]) -> float:
    """
    Calculate Mean Reciprocal Rank (MRR) for retrieval results.
    
    MRR measures how well the system ranks relevant information. It only considers
    the rank of the first correct result for each query.
    
    Args:
        retrieved_links: List of retrieved item identifiers
        correct_links: List of correct/relevant item identifiers
        
    Returns:
        MRR score (0.0 to 1.0), where 1.0 means correct item always ranked first
    """
    for i, link in enumerate(retrieved_links, 1):
        if link in correct_links:
            return 1.0 / i
    return 0.0


def evaluate_retrieval(
    retrieved_links: list[str], 
    correct_links: list[str] | str
) -> dict[str, float]:
    """
    Evaluate retrieval performance using multiple metrics.
    
    Calculates Precision, Recall, F1 Score, and MRR for a retrieval system.
    
    Args:
        retrieved_links: List of retrieved item identifiers
        correct_links: List of correct/relevant item identifiers (or string representation)
        
    Returns:
        Dictionary with metrics:
        - precision: Proportion of retrieved items that are relevant
        - recall: Proportion of relevant items that were retrieved
        - f1: Harmonic mean of precision and recall
        - mrr: Mean Reciprocal Rank
    """
    # Handle string input (from CSV/JSON)
    if isinstance(correct_links, str):
        import ast
        correct_links = ast.literal_eval(correct_links)
    
    # Calculate true positives (items in both lists)
    true_positives = len(set(retrieved_links) & set(correct_links))
    
    # Precision: Of retrieved items, how many are correct?
    precision = true_positives / len(retrieved_links) if retrieved_links else 0.0
    
    # Recall: Of correct items, how many were retrieved?
    recall = true_positives / len(correct_links) if correct_links else 0.0
    
    # F1 Score: Harmonic mean of precision and recall
    f1 = (
        2 * (precision * recall) / (precision + recall)
        if (precision + recall) > 0
        else 0.0
    )
    
    # MRR: Rank quality metric
    mrr = calculate_mrr(retrieved_links, correct_links)
    
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "mrr": mrr,
        "true_positives": true_positives,
        "retrieved_count": len(retrieved_links),
        "correct_count": len(correct_links),
    }


def get_assert(output: str, context: dict[str, Any]) -> dict[str, Any]:
    """
    Promptfoo assertion function for retrieval evaluation.
    
    This function is called by Promptfoo to evaluate retrieval results.
    It returns a structured result with pass/fail status and detailed metrics.
    
    Args:
        output: Retrieved links (comma-separated or list)
        context: Promptfoo context containing test variables
        
    Returns:
        Dictionary with evaluation results:
        - pass: Boolean indicating if F1 score meets threshold (>= 0.3)
        - score: F1 score (0.0 to 1.0)
        - reason: Human-readable explanation
        - componentResults: Individual metric results
    """
    correct_chunks = context.get("vars", {}).get("correct_chunks", [])
    
    # Parse output if it's a string
    if isinstance(output, str):
        # Try to parse as list first
        if output.startswith("[") or output.startswith("("):
            import ast
            retrieved_links = ast.literal_eval(output)
        else:
            # Assume comma-separated
            retrieved_links = [link.strip() for link in output.split(",") if link.strip()]
    else:
        retrieved_links = output if isinstance(output, list) else []
    
    try:
        metrics = evaluate_retrieval(retrieved_links, correct_chunks)
        
        # Overall pass if F1 >= 0.3 (configurable threshold)
        f1_threshold = 0.3
        overall_pass = metrics["f1"] >= f1_threshold
        
        return {
            "pass": overall_pass,
            "score": metrics["f1"],
            "reason": (
                f"Precision: {metrics['precision']:.3f}\n"
                f"Recall: {metrics['recall']:.3f}\n"
                f"F1 Score: {metrics['f1']:.3f}\n"
                f"MRR: {metrics['mrr']:.3f}"
            ),
            "componentResults": [
                {
                    "pass": True,
                    "score": metrics["mrr"],
                    "reason": f"MRR is {metrics['mrr']:.3f}",
                    "named_scores": {"MRR": metrics["mrr"]},
                },
                {
                    "pass": True,
                    "score": metrics["precision"],
                    "reason": f"Precision is {metrics['precision']:.3f}",
                    "named_scores": {"Precision": metrics["precision"]},
                },
                {
                    "pass": True,
                    "score": metrics["recall"],
                    "reason": f"Recall is {metrics['recall']:.3f}",
                    "named_scores": {"Recall": metrics["recall"]},
                },
                {
                    "pass": True,
                    "score": metrics["f1"],
                    "reason": f"F1 is {metrics['f1']:.3f}",
                    "named_scores": {"F1": metrics["f1"]},
                },
            ],
        }
    except Exception as e:
        return {
            "pass": False,
            "score": 0.0,
            "reason": f"Unexpected error: {str(e)}",
            "componentResults": [
                {
                    "pass": False,
                    "score": 0.0,
                    "reason": f"Unexpected error: {str(e)}",
                    "named_scores": {"MRR": 0.0, "Precision": 0.0, "Recall": 0.0, "F1": 0.0},
                }
            ],
        }
