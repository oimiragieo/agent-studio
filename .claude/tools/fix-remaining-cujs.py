#!/usr/bin/env python3
"""Fix remaining 18 CUJs that need manual attention"""

import os
import re
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CUJ_DIR = "C:/dev/projects/LLM-RULES/.claude/docs/cujs"

# Files that need fixing
INCOMPLETE_FILES = [
    'CUJ-017.md', 'CUJ-018.md', 'CUJ-020.md', 'CUJ-021.md', 'CUJ-022.md',
    'CUJ-024.md', 'CUJ-025.md', 'CUJ-026.md', 'CUJ-034.md', 'CUJ-035.md',
    'CUJ-036.md', 'CUJ-037.md', 'CUJ-039.md', 'CUJ-051.md', 'CUJ-052.md',
    'CUJ-053.md', 'CUJ-054.md', 'CUJ-055.md'
]

RATING_GATE_TEXT = """
### Step 0.1: Plan Rating Gate
- Agent: orchestrator
- Type: validation
- Skill: response-rater
- Validates plan quality (minimum score: 7/10)
- Rubric: completeness, feasibility, risk mitigation, agent coverage, integration
- If score < 7: Return to Planner with feedback
- If score >= 7: Proceed to execution
- Records rating in `.claude/context/runtime/runs/<run_id>/plans/<plan_id>-rating.json`
"""

SUCCESS_CRITERIA_ADDITIONS = """- [ ] Plan rating >= 7/10 (recorded in `.claude/context/runtime/runs/<run_id>/plans/<plan_id>-rating.json`)
- [ ] Rating recorded in run state (validation: rating file exists)
"""

def has_rating_gate(content):
    """Check if file has rating gate"""
    return bool(re.search(r'### Step 0\.1: Plan Rating Gate', content))

def has_rating_criteria(content):
    """Check if file has rating criteria"""
    return bool(re.search(r'Plan rating >= 7/10', content))

def add_rating_gate_after_step_0(content):
    """Add Step 0.1 after Step 0"""
    # Find Step 0 and the next step
    pattern = r'(### Step 0: Planning Phase.*?)(### Step \d+:)'
    
    def replacer(match):
        step_0 = match.group(1)
        next_step = match.group(2)
        return step_0 + RATING_GATE_TEXT + "\n" + next_step
    
    return re.sub(pattern, replacer, content, flags=re.DOTALL)

def add_success_criteria_flexible(content):
    """Add plan rating success criteria (flexible approach)"""
    # Try multiple patterns to find Success Criteria section
    
    # Pattern 1: After first checkbox item
    pattern1 = r'(## Success Criteria\n- \[ \].*?\n)'
    match1 = re.search(pattern1, content)
    
    if match1:
        # Insert after first item
        pos = match1.end()
        return content[:pos] + SUCCESS_CRITERIA_ADDITIONS + content[pos:]
    
    # Pattern 2: After "Success Criteria" header with emoji checkboxes
    pattern2 = r'(## Success Criteria\n- ✅.*?\n)'
    match2 = re.search(pattern2, content)
    
    if match2:
        # Insert after first item
        pos = match2.end()
        return content[:pos] + SUCCESS_CRITERIA_ADDITIONS + content[pos:]
    
    # Pattern 3: Right after Success Criteria header (no items yet)
    pattern3 = r'(## Success Criteria\n)'
    match3 = re.search(pattern3, content)
    
    if match3:
        # Insert right after header
        pos = match3.end()
        return content[:pos] + SUCCESS_CRITERIA_ADDITIONS + content[pos:]
    
    return content

def process_file(filepath, filename):
    """Process a single CUJ file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    changed = False
    
    # Add rating gate if missing
    if not has_rating_gate(content):
        content = add_rating_gate_after_step_0(content)
        changed = True
        print(f"  - Added rating gate")
    
    # Add success criteria if missing
    if not has_rating_criteria(content):
        updated = add_success_criteria_flexible(content)
        if updated != content:
            content = updated
            changed = True
            print(f"  - Added success criteria")
        else:
            print(f"  - WARNING: Could not add success criteria (Success Criteria section not found)")
    
    if changed:
        # Write back
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def main():
    """Fix incomplete CUJ files"""
    updated_count = 0
    
    for filename in sorted(INCOMPLETE_FILES):
        filepath = os.path.join(CUJ_DIR, filename)
        
        if not os.path.exists(filepath):
            print(f"[SKIP] {filename}: File not found")
            continue
        
        print(f"\n[Processing] {filename}")
        if process_file(filepath, filename):
            updated_count += 1
            print(f"  ✓ Updated")
        else:
            print(f"  - No changes needed")
    
    print(f"\n\nSummary: Updated {updated_count}/{len(INCOMPLETE_FILES)} files")

if __name__ == '__main__':
    main()
