#!/usr/bin/env python3
"""
RAG Evaluation Script

Evaluates RAG (Retrieval Augmented Generation) quality using retrieval and end-to-end metrics.
Based on patterns from Claude Cookbooks RAG evaluation.
"""

import json
import sys
import os
import argparse
from pathlib import Path
from typing import List, Dict, Any
import anthropic

# Initialize Anthropic client
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def load_dataset(dataset_path: str) -> List[Dict[str, Any]]:
    """Load evaluation dataset from JSONL file."""
    tasks = []
    with open(dataset_path, 'r') as f:
        for line in f:
            if line.strip():
                tasks.append(json.loads(line))
    return tasks

def evaluate_retrieval(query: str, expected_files: List[str], actual_files: List[str]) -> Dict[str, Any]:
    """Evaluate retrieval quality (precision, recall, F1)."""
    expected_set = set(expected_files)
    actual_set = set(actual_files)
    
    # Calculate metrics
    if len(actual_set) == 0:
        precision = 0.0
    else:
        precision = len(expected_set & actual_set) / len(actual_set)
    
    if len(expected_set) == 0:
        recall = 1.0 if len(actual_set) == 0 else 0.0
    else:
        recall = len(expected_set & actual_set) / len(expected_set)
    
    if precision + recall == 0:
        f1 = 0.0
    else:
        f1 = 2 * (precision * recall) / (precision + recall)
    
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "expected_count": len(expected_set),
        "actual_count": len(actual_set),
        "correct_count": len(expected_set & actual_set),
        "missing_files": list(expected_set - actual_set),
        "extra_files": list(actual_set - expected_set)
    }

def evaluate_end_to_end(query: str, ground_truth: str, actual_answer: str, model: str) -> Dict[str, Any]:
    """Evaluate end-to-end answer quality using model-based grading."""
    prompt = f"""Evaluate the following answer against the ground truth:

Query: {query}

Ground Truth Answer:
{ground_truth}

Actual Answer:
{actual_answer}

Evaluate on:
1. Relevance (0-1): How relevant is the answer to the query?
2. Completeness (0-1): How complete is the answer?
3. Accuracy (0-1): How accurate is the information?
4. Overall Quality (0-1): Overall assessment

Format as JSON:
{{
  "relevance": 0.0-1.0,
  "completeness": 0.0-1.0,
  "accuracy": 0.0-1.0,
  "overall_quality": 0.0-1.0,
  "strengths": ["..."],
  "weaknesses": ["..."]
}}
"""
    
    try:
        response = client.messages.create(
            model=model,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        content = response.content[0].text
        # Extract JSON from markdown code blocks if present
        if "```json" in content:
            json_start = content.find("```json") + 7
            json_end = content.find("```", json_start)
            content = content[json_start:json_end].strip()
        elif "```" in content:
            json_start = content.find("```") + 3
            json_end = content.find("```", json_start)
            content = content[json_start:json_end].strip()
        
        return json.loads(content)
    except Exception as e:
        return {
            "relevance": 0.0,
            "completeness": 0.0,
            "accuracy": 0.0,
            "overall_quality": 0.0,
            "error": str(e),
            "strengths": [],
            "weaknesses": ["Evaluation failed"]
        }

def run_retrieval_evaluation(dataset: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Run retrieval evaluation on dataset."""
    results = []
    total_precision = 0.0
    total_recall = 0.0
    total_f1 = 0.0
    
    for task in dataset:
        query = task["query"]
        expected_files = task.get("expected_retrieval", [])
        
        # In practice, would call actual RAG system
        # For now, simulate retrieval (would use actual search)
        actual_files = []  # Would be populated by actual RAG search
        
        evaluation = evaluate_retrieval(query, expected_files, actual_files)
        results.append({
            "query": query,
            "evaluation": evaluation
        })
        
        total_precision += evaluation["precision"]
        total_recall += evaluation["recall"]
        total_f1 += evaluation["f1"]
    
    count = len(results)
    return {
        "mode": "retrieval",
        "total_queries": count,
        "average_precision": total_precision / count if count > 0 else 0.0,
        "average_recall": total_recall / count if count > 0 else 0.0,
        "average_f1": total_f1 / count if count > 0 else 0.0,
        "results": results
    }

def run_end_to_end_evaluation(dataset: List[Dict[str, Any]], model: str) -> Dict[str, Any]:
    """Run end-to-end evaluation on dataset."""
    results = []
    total_relevance = 0.0
    total_completeness = 0.0
    total_accuracy = 0.0
    total_quality = 0.0
    
    for task in dataset:
        query = task["query"]
        ground_truth = task.get("ground_truth_answer", "")
        
        # In practice, would call actual RAG system
        # For now, simulate answer (would use actual RAG)
        actual_answer = ""  # Would be populated by actual RAG
        
        evaluation = evaluate_end_to_end(query, ground_truth, actual_answer, model)
        results.append({
            "query": query,
            "evaluation": evaluation
        })
        
        total_relevance += evaluation.get("relevance", 0.0)
        total_completeness += evaluation.get("completeness", 0.0)
        total_accuracy += evaluation.get("accuracy", 0.0)
        total_quality += evaluation.get("overall_quality", 0.0)
    
    count = len(results)
    return {
        "mode": "end_to_end",
        "total_queries": count,
        "average_relevance": total_relevance / count if count > 0 else 0.0,
        "average_completeness": total_completeness / count if count > 0 else 0.0,
        "average_accuracy": total_accuracy / count if count > 0 else 0.0,
        "average_quality": total_quality / count if count > 0 else 0.0,
        "results": results
    }

def main():
    parser = argparse.ArgumentParser(description="Evaluate RAG quality")
    parser.add_argument("--mode", choices=["retrieval", "end_to_end", "both"], required=True, help="Evaluation mode")
    parser.add_argument("--dataset", required=True, help="Path to evaluation dataset (JSONL)")
    parser.add_argument("--output", required=True, help="Output file for results (JSON)")
    parser.add_argument("--model", default=os.environ.get("RAG_EVAL_MODEL", "claude-sonnet-4-5"), help="Anthropic model id for grading (or set RAG_EVAL_MODEL)")
    
    args = parser.parse_args()
    
    # Load dataset
    dataset = load_dataset(args.dataset)
    
    # Run evaluation
    if args.mode == "retrieval":
        results = run_retrieval_evaluation(dataset)
    elif args.mode == "end_to_end":
        results = run_end_to_end_evaluation(dataset, args.model)
    else:  # both
        retrieval_results = run_retrieval_evaluation(dataset)
        end_to_end_results = run_end_to_end_evaluation(dataset, args.model)
        results = {
            "retrieval": retrieval_results,
            "end_to_end": end_to_end_results
        }
    
    # Save results
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, indent=2))
    
    print(f"RAG evaluation complete: {args.mode}")
    if "average_f1" in results:
        print(f"Average F1: {results['average_f1']:.2%}")
    if "average_quality" in results:
        print(f"Average Quality: {results['average_quality']:.2%}")
    print(f"Results saved to: {args.output}")

if __name__ == "__main__":
    main()

