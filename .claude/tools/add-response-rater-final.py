#!/usr/bin/env python3
"""Add response-rater to Skills/Capabilities sections for remaining CUJs"""

import os
import re
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CUJ_DIR = "C:/dev/projects/LLM-RULES/.claude/docs/cujs"

# Files that need manual updates
MANUAL_FILES = {
    'CUJ-021.md': 'capabilities',
    'CUJ-022.md': 'capabilities',
    'CUJ-034.md': 'skills_special',
    'CUJ-036.md': 'capabilities',
    'CUJ-041.md': 'capabilities',
    'CUJ-042.md': 'capabilities',
    'CUJ-044.md': 'capabilities',
    'CUJ-046.md': 'capabilities',
    'CUJ-048.md': 'capabilities',
}

def has_rating_gate(content):
    """Check if file has rating gate"""
    return bool(re.search(r'Step 0\.1.*Plan Rating Gate', content, re.IGNORECASE))

def has_response_rater_mention(content):
    """Check if response-rater already mentioned"""
    return bool(re.search(r'response-rater', content))

def add_to_capabilities(content):
    """Add response-rater to Capabilities/Tools Used section"""
    pattern = r'(## Capabilities/Tools Used\n(?:- .*\n)+)'
    
    if not re.search(pattern, content):
        return content
    
    def replacer(match):
        section = match.group(1)
        return section + "- `response-rater` skill: Plan quality validation\n"
    
    return re.sub(pattern, replacer, content, count=1)

def add_to_skills_special(content):
    """Add response-rater to special Skills Used format (CUJ-034)"""
    # Find "## Skills Used" and add response-rater before the next section
    pattern = r'(## Skills Used\n.*?)(\n## )'
    
    if not re.search(pattern, content, re.DOTALL):
        return content
    
    def replacer(match):
        skills_section = match.group(1)
        next_section = match.group(2)
        return skills_section + "\n- `response-rater`: Plan quality validation\n" + next_section
    
    return re.sub(pattern, replacer, content, count=1, flags=re.DOTALL)

def process_file(filepath, filename):
    """Process a single CUJ file"""
    if filename not in MANUAL_FILES:
        return False, "Not in manual files list"
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if has rating gate
    if not has_rating_gate(content):
        return False, "No rating gate"
    
    # Check if already has response-rater
    if has_response_rater_mention(content):
        return False, "Already has response-rater"
    
    # Apply appropriate update based on file type
    file_type = MANUAL_FILES[filename]
    
    if file_type == 'capabilities':
        updated_content = add_to_capabilities(content)
    elif file_type == 'skills_special':
        updated_content = add_to_skills_special(content)
    else:
        return False, f"Unknown file type: {file_type}"
    
    if updated_content == content:
        return False, "Failed to add (section not found or unchanged)"
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    return True, f"Added to {file_type} section"

def main():
    """Process manual CUJ files"""
    updated = []
    skipped = []
    
    for filename in sorted(MANUAL_FILES.keys()):
        filepath = os.path.join(CUJ_DIR, filename)
        
        if not os.path.exists(filepath):
            print(f"[SKIP] {filename}: File not found")
            continue
        
        success, message = process_file(filepath, filename)
        
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
