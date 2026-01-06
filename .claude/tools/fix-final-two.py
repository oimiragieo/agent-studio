#!/usr/bin/env python3
"""Fix CUJ-025 and CUJ-026 with special handling"""

import os
import re
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CUJ_DIR = "C:/dev/projects/LLM-RULES/.claude/docs/cujs"

RATING_GATE_TEXT = """
### Step 0.1: Plan Rating Gate
- Agent: orchestrator
- Type: validation
- Skill: response-rater
- Validates plan quality (minimum score: 7/10)
- Rubric: completeness, feasibility, risk mitigation, agent coverage, integration
- If score < 7: Return to Planner with feedback
- If score >= 7: Proceed to execution
- Records rating in `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`
"""

def fix_cuj_025(filepath):
    """Fix CUJ-025 - has 'Subsequent Steps' instead of 'Step 1'"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Insert before "### Subsequent Steps"
    pattern = r'(### Step 0: Planning Phase.*?)(### Subsequent Steps)'
    
    def replacer(match):
        step_0 = match.group(1)
        subsequent = match.group(2)
        return step_0 + RATING_GATE_TEXT + "\n" + subsequent
    
    updated = re.sub(pattern, replacer, content, flags=re.DOTALL)
    
    if updated != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(updated)
        return True
    return False

def fix_cuj_026(filepath):
    """Fix CUJ-026 - has 'Step 1-N: Phase Execution' instead of 'Step 1'"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Insert before "### Step 1-N: Phase Execution"
    pattern = r'(### Step 0: Planning Phase \(Hierarchical\).*?)(### Step 1-N: Phase Execution)'
    
    def replacer(match):
        step_0 = match.group(1)
        step_1n = match.group(2)
        return step_0 + RATING_GATE_TEXT + "\n" + step_1n
    
    updated = re.sub(pattern, replacer, content, flags=re.DOTALL)
    
    if updated != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(updated)
        return True
    return False

def main():
    """Fix CUJ-025 and CUJ-026"""
    cuj_025_path = os.path.join(CUJ_DIR, 'CUJ-025.md')
    cuj_026_path = os.path.join(CUJ_DIR, 'CUJ-026.md')
    
    if fix_cuj_025(cuj_025_path):
        print("[OK] CUJ-025.md: Added rating gate before 'Subsequent Steps'")
    else:
        print("[SKIP] CUJ-025.md: Failed to add rating gate")
    
    if fix_cuj_026(cuj_026_path):
        print("[OK] CUJ-026.md: Added rating gate before 'Step 1-N'")
    else:
        print("[SKIP] CUJ-026.md: Failed to add rating gate")

if __name__ == '__main__':
    main()
