"""
RAG Retrieval Metrics

Precision, Recall, F1 Score, and MRR calculations for RAG evaluation.
Based on Claude Cookbooks patterns.
"""

from typing import Any


def calculate_precision(retrieved_items: list[str], correct_items: list[str]) -> float:
    """
    Calculate Precision: proportion of retrieved items that are actually relevant.
    
    Precision = True Positives / Total Retrieved
    
    Args:
        retrieved_items: List of retrieved item identifiers
        correct_items: List of correct/relevant item identifiers
        
    Returns:
        Precision score between 0.0 and 1.0
    """
    if not retrieved_items:
        return 0.0
    
    true_positives = len(set(retrieved_items) & set(correct_items))
    return true_positives / len(retrieved_items)


def calculate_recall(retrieved_items: list[str], correct_items: list[str]) -> float:
    """
    Calculate Recall: completeness of retrieval system.
    
    Recall = True Positives / Total Correct
    
    Args:
        retrieved_items: List of retrieved item identifiers
        correct_items: List of correct/relevant item identifiers
        
    Returns:
        Recall score between 0.0 and 1.0
    """
    if not correct_items:
        return 0.0
    
    true_positives = len(set(retrieved_items) & set(correct_items))
    return true_positives / len(correct_items)


def calculate_f1_score(precision: float, recall: float) -> float:
    """
    Calculate F1 Score: harmonic mean of precision and recall.
    
    F1 = 2 * (Precision * Recall) / (Precision + Recall)
    
    Args:
        precision: Precision score
        recall: Recall score
        
    Returns:
        F1 score between 0.0 and 1.0
    """
    if precision + recall == 0:
        return 0.0
    return 2 * (precision * recall) / (precision + recall)


def calculate_mrr(retrieved_items: list[str], correct_items: list[str]) -> float:
    """
    Calculate Mean Reciprocal Rank (MRR): measures ranking quality.
    
    MRR = 1 / rank of first correct item
    
    Args:
        retrieved_items: List of retrieved item identifiers in rank order
        correct_items: List of correct/relevant item identifiers
        
    Returns:
        MRR score between 0.0 and 1.0 (1.0 = perfect, correct item always first)
    """
    correct_set = set(correct_items)
    for i, item in enumerate(retrieved_items, 1):
        if item in correct_set:
            return 1.0 / i
    return 0.0


def evaluate_retrieval(
    retrieved_items: list[str], 
    correct_items: list[str]
) -> dict[str, float]:
    """
    Evaluate retrieval performance with all metrics.
    
    Args:
        retrieved_items: List of retrieved item identifiers
        correct_items: List of correct/relevant item identifiers
        
    Returns:
        Dictionary with precision, recall, f1, and mrr scores
    """
    precision = calculate_precision(retrieved_items, correct_items)
    recall = calculate_recall(retrieved_items, correct_items)
    f1 = calculate_f1_score(precision, recall)
    mrr = calculate_mrr(retrieved_items, correct_items)
    
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "mrr": mrr,
    }

