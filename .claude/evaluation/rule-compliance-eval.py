#!/usr/bin/env python3
"""
Rule Compliance Evaluation Script

Evaluates code files against loaded rules to test rule compliance.
"""

import json
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Any
import glob

def load_rule_file(rule_path: str) -> str:
    """Load rule file content."""
    rule_file = Path(rule_path)
    if not rule_file.exists():
        return ""
    return rule_file.read_text()

def check_rule_compliance(file_path: str, rule_content: str) -> Dict[str, Any]:
    """Check if a file complies with a rule (simplified)."""
    file_content = Path(file_path).read_text()
    
    violations = []
    warnings = []
    
    # Simple pattern matching (in practice, would use AST parsing)
    # Example: Check for TypeScript strict mode
    if "strict: true" not in file_content and file_path.endswith(".ts"):
        if "tsconfig.json" in file_path:
            violations.append({
                "line": 1,
                "rule": "TypeScript strict mode required",
                "message": "tsconfig.json must have strict: true"
            })
    
    # Example: Check for error handling
    if "try {" in file_content and "catch" not in file_content:
        warnings.append({
            "line": file_content.find("try {"),
            "rule": "Error handling",
            "message": "Try blocks should have catch handlers"
        })
    
    return {
        "file": file_path,
        "violations": violations,
        "warnings": warnings,
        "compliant": len(violations) == 0
    }

def evaluate_rule_compliance(files: List[str], rule_path: str) -> Dict[str, Any]:
    """Evaluate rule compliance for multiple files."""
    rule_content = load_rule_file(rule_path)
    
    if not rule_content:
        return {"error": f"Rule file not found: {rule_path}"}
    
    results = []
    total_violations = 0
    total_warnings = 0
    
    for file_pattern in files:
        # Expand glob patterns
        matched_files = glob.glob(file_pattern, recursive=True)
        
        for file_path in matched_files:
            result = check_rule_compliance(file_path, rule_content)
            results.append(result)
            total_violations += len(result["violations"])
            total_warnings += len(result["warnings"])
    
    compliant_files = len([r for r in results if r["compliant"]])
    total_files = len(results)
    
    return {
        "rule_file": rule_path,
        "total_files": total_files,
        "compliant_files": compliant_files,
        "compliance_rate": (compliant_files / total_files * 100) if total_files > 0 else 0,
        "total_violations": total_violations,
        "total_warnings": total_warnings,
        "results": results
    }

def main():
    parser = argparse.ArgumentParser(description="Evaluate rule compliance")
    parser.add_argument("--files", nargs="+", required=True, help="File patterns to evaluate")
    parser.add_argument("--rules", required=True, help="Path to rule file")
    parser.add_argument("--output", required=True, help="Output file for results (JSON)")
    
    args = parser.parse_args()
    
    # Evaluate compliance
    results = evaluate_rule_compliance(args.files, args.rules)
    
    # Save results
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, indent=2))
    
    print(f"Rule compliance evaluation complete")
    print(f"Compliance rate: {results.get('compliance_rate', 0):.2f}%")
    print(f"Violations: {results.get('total_violations', 0)}")
    print(f"Warnings: {results.get('total_warnings', 0)}")
    print(f"Results saved to: {args.output}")

if __name__ == "__main__":
    main()

