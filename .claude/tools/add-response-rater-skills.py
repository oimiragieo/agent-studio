#!/usr/bin/env python3
"""Add response-rater to Skills Used section for all updated CUJs"""

import os
import re
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CUJ_DIR = "C:/dev/projects/LLM-RULES/.claude/docs/cujs"

def has_rating_gate(content):
    """Check if file has rating gate"""
    return bool(re.search(r'Step 0\.1.*Plan Rating Gate', content, re.IGNORECASE))

def has_response_rater_skill(content):
    """Check if response-rater already in Skills Used"""
    return bool(re.search(r'`response-rater`', content))

def add_response_rater_skill(content):
    """Add response-rater to Skills Used section"""
    # Find Skills Used section - match the section and all bullet points
    pattern = r'(## Skills Used\n(?:- .*\n)+)'
    
    if not re.search(pattern, content):
        # No Skills Used section, skip
        return content
    
    def replacer(match):
        skills_section = match.group(1)
        # Add response-rater as the last skill
        return skills_section + "- `response-rater` - Plan quality validation\n"
    
    return re.sub(pattern, replacer, content, count=1)

def process_file(filepath):
    """Process a single CUJ file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if has rating gate
    if not has_rating_gate(content):
        return False, "No rating gate"
    
    # Check if already has response-rater skill
    if has_response_rater_skill(content):
        return False, "Already has response-rater skill"
    
    # Add response-rater skill
    updated_content = add_response_rater_skill(content)
    
    if updated_content == content:
        return False, "Failed to add skill (no Skills Used section)"
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    return True, "Added response-rater skill"

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
            # Only print skipped if it has rating gate but failed
            if "rating gate" not in message.lower():
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
