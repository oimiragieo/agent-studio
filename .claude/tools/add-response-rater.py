#!/usr/bin/env python3
"""Add response-rater skill integration to all CUJs with Step 0"""

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

SUCCESS_CRITERIA_ADDITIONS = """- [ ] Plan rating >= 7/10 (recorded in `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`)
- [ ] Rating recorded in run state (validation: rating file exists)
"""

def has_step_0_planning(content):
    """Check if file has Step 0: Planning Phase"""
    return bool(re.search(r'### Step 0: Planning Phase', content, re.IGNORECASE))

def has_rating_gate(content):
    """Check if file already has rating gate"""
    return bool(re.search(r'Step 0\.1.*Plan Rating Gate', content, re.IGNORECASE))

def add_rating_gate_after_step_0(content):
    """Add Step 0.1 after Step 0"""
    # Find Step 0 and the next step
    pattern = r'(### Step 0: Planning Phase.*?)(### Step \d+:)'
    
    def replacer(match):
        step_0 = match.group(1)
        next_step = match.group(2)
        return step_0 + RATING_GATE_TEXT + "\n" + next_step
    
    return re.sub(pattern, replacer, content, flags=re.DOTALL)

def add_response_rater_skill(content):
    """Add response-rater to Skills Used section"""
    # Check if response-rater already listed
    if 'response-rater' in content:
        return content
    
    # Find Skills Used section and add response-rater
    pattern = r'(## Skills Used\n(?:- .*\n)*)'
    
    def replacer(match):
        skills = match.group(1)
        return skills + "- `response-rater` - Plan quality validation\n"
    
    return re.sub(pattern, replacer, content)

def add_success_criteria(content):
    """Add plan rating success criteria"""
    # Check if already added
    if 'Plan rating >= 7/10' in content:
        return content
    
    # Find Success Criteria section and add after first item
    pattern = r'(## Success Criteria\n- \[.*?\].*?\n)'
    
    def replacer(match):
        first_item = match.group(1)
        return first_item + SUCCESS_CRITERIA_ADDITIONS
    
    return re.sub(pattern, replacer, content)

def process_file(filepath):
    """Process a single CUJ file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if needs processing
    if not has_step_0_planning(content):
        return False, "No Step 0"
    
    if has_rating_gate(content):
        return False, "Already has rating gate"
    
    # Add rating gate
    content = add_rating_gate_after_step_0(content)
    
    # Add response-rater to skills
    content = add_response_rater_skill(content)
    
    # Add success criteria
    content = add_success_criteria(content)
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True, "Updated"

def main():
    """Process all CUJ files"""
    updated = []
    skipped = []
    
    for filename in sorted(os.listdir(CUJ_DIR)):
        if not filename.startswith('CUJ-') or not filename.endswith('.md'):
            continue
        
        filepath = os.path.join(CUJ_DIR, filename)
        success, message = process_file(filepath)
        
        if success:
            updated.append(filename)
            print(f"[OK] {filename}: {message}")
        else:
            skipped.append((filename, message))
            print(f"[SKIP] {filename}: {message}")
    
    print(f"\n\nSummary:")
    print(f"Updated: {len(updated)} files")
    print(f"Skipped: {len(skipped)} files")
    
    if updated:
        print(f"\nUpdated files:")
        for f in updated:
            print(f"  - {f}")

if __name__ == '__main__':
    main()
