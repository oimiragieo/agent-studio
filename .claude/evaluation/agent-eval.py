#!/usr/bin/env python3
"""
Agent Performance Evaluation Script

Evaluates agent performance on a dataset of tasks using code-based and model-based grading.
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

def code_based_grading(output: Dict[str, Any], expected: Dict[str, Any]) -> Dict[str, Any]:
    """Code-based grading for structured outputs."""
    score = 0.0
    max_score = 0.0
    details = []
    
    # Check required files
    if "files_created" in expected:
        max_score += 1.0
        expected_files = set(expected["files_created"])
        actual_files = set(output.get("files_created", []))
        if expected_files.issubset(actual_files):
            score += 1.0
            details.append("All required files created")
        else:
            missing = expected_files - actual_files
            details.append(f"Missing files: {missing}")
    
    # Check validation
    if "validation" in expected:
        max_score += 1.0
        if output.get("validation") == expected["validation"]:
            score += 1.0
            details.append("Validation passed")
        else:
            details.append(f"Validation failed: expected {expected['validation']}, got {output.get('validation')}")
    
    return {
        "score": score,
        "max_score": max_score,
        "percentage": (score / max_score * 100) if max_score > 0 else 0,
        "details": details
    }

def model_based_grading(output: str, criteria: str) -> Dict[str, Any]:
    """Model-based grading using Claude."""
    prompt = f"""Evaluate the following output against these criteria:

Criteria:
{criteria}

Output to evaluate:
{output}

Provide:
1. Score (0-1)
2. Strengths
3. Weaknesses
4. Recommendations

Format as JSON:
{{
  "score": 0.0-1.0,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "recommendations": ["..."]
}}
"""
    
    try:
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Parse JSON from response
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
            "score": 0.0,
            "error": str(e),
            "strengths": [],
            "weaknesses": ["Evaluation failed"],
            "recommendations": []
        }

def evaluate_agent(agent_name: str, task: Dict[str, Any], agent_config: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate an agent on a single task."""
    # Load agent prompt
    agent_file = Path(f".claude/agents/{agent_name}.md")
    if not agent_file.exists():
        return {"error": f"Agent file not found: {agent_file}"}
    
    agent_prompt = agent_file.read_text()
    
    # Create evaluation prompt
    evaluation_prompt = f"""
{agent_prompt}

Task:
{task['input']}

Expected Output:
{json.dumps(task.get('expected_output', {}), indent=2)}
"""
    
    try:
        # Call agent (simplified - in practice would use Claude Code API)
        response = client.messages.create(
            model=agent_config.get("model", "claude-sonnet-4-5-20250929"),
            max_tokens=4000,
            messages=[{"role": "user", "content": evaluation_prompt}]
        )
        
        output_text = response.content[0].text
        
        # Parse output (assuming JSON format)
        try:
            output = json.loads(output_text)
        except:
            output = {"raw_output": output_text}
        
        # Grade output
        code_grade = code_based_grading(output, task.get("expected_output", {}))
        
        # Model-based grading for quality
        model_grade = model_based_grading(
            output_text,
            "Code quality, completeness, and adherence to requirements"
        )
        
        return {
            "task": task["input"],
            "output": output,
            "code_based_grade": code_grade,
            "model_based_grade": model_grade,
            "overall_score": (code_grade["percentage"] * 0.6 + model_grade["score"] * 100 * 0.4) / 100
        }
    except Exception as e:
        return {
            "task": task["input"],
            "error": str(e),
            "overall_score": 0.0
        }

def main():
    parser = argparse.ArgumentParser(description="Evaluate agent performance")
    parser.add_argument("--agent", required=True, help="Agent name to evaluate")
    parser.add_argument("--dataset", required=True, help="Path to evaluation dataset (JSONL)")
    parser.add_argument("--output", required=True, help="Output file for results (JSON)")
    parser.add_argument("--config", help="Path to agent config (default: .claude/config.yaml)")
    
    args = parser.parse_args()
    
    # Load dataset
    tasks = load_dataset(args.dataset)
    
    # Load agent config
    config_path = args.config or ".claude/config.yaml"
    # In practice, would parse YAML config
    agent_config = {"model": "claude-sonnet-4-5-20250929"}
    
    # Evaluate each task
    results = []
    for task in tasks:
        result = evaluate_agent(args.agent, task, agent_config)
        results.append(result)
    
    # Calculate aggregate metrics
    scores = [r.get("overall_score", 0.0) for r in results if "error" not in r]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    
    summary = {
        "agent": args.agent,
        "total_tasks": len(tasks),
        "completed_tasks": len([r for r in results if "error" not in r]),
        "average_score": avg_score,
        "results": results
    }
    
    # Save results
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, indent=2))
    
    print(f"Evaluation complete: {args.agent}")
    print(f"Average score: {avg_score:.2%}")
    print(f"Results saved to: {args.output}")

if __name__ == "__main__":
    import os
    main()

