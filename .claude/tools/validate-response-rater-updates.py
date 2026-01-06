#!/usr/bin/env python3
"""Validate that all CUJs with Step 0 have response-rater integration"""

import os
import re
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CUJ_DIR = "C:/dev/projects/LLM-RULES/.claude/docs/cujs"

def check_cuj(filepath, filename):
    """Check a single CUJ for response-rater integration"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    has_step_0 = bool(re.search(r'### Step 0: Planning Phase', content))
    has_rating_gate = bool(re.search(r'### Step 0\.1: Plan Rating Gate', content))
    has_response_rater = bool(re.search(r'response-rater', content))
    has_rating_criteria = bool(re.search(r'Plan rating >= 7/10', content))
    has_recorded_criteria = bool(re.search(r'Rating recorded in run state', content))
    
    return {
        'filename': filename,
        'has_step_0': has_step_0,
        'has_rating_gate': has_rating_gate,
        'has_response_rater': has_response_rater,
        'has_rating_criteria': has_rating_criteria,
        'has_recorded_criteria': has_recorded_criteria,
        'complete': has_step_0 and has_rating_gate and has_response_rater and has_rating_criteria and has_recorded_criteria if has_step_0 else True
    }

def main():
    """Validate all CUJ files"""
    results = []
    complete_count = 0
    incomplete_count = 0
    no_step_0_count = 0
    
    for filename in sorted(os.listdir(CUJ_DIR)):
        if not filename.startswith('CUJ-') or not filename.endswith('.md'):
            continue
        
        # Skip index and summary files
        if 'INDEX' in filename or 'SUMMARY' in filename or 'AUDIT' in filename or 'EXECUTION' in filename or 'VALIDATION' in filename:
            continue
        
        filepath = os.path.join(CUJ_DIR, filename)
        result = check_cuj(filepath, filename)
        results.append(result)
        
        if not result['has_step_0']:
            no_step_0_count += 1
        elif result['complete']:
            complete_count += 1
        else:
            incomplete_count += 1
    
    # Print results
    print("=" * 80)
    print("RESPONSE-RATER INTEGRATION VALIDATION REPORT")
    print("=" * 80)
    print()
    
    print(f"Total CUJs scanned: {len(results)}")
    print(f"CUJs with Step 0: {complete_count + incomplete_count}")
    print(f"CUJs without Step 0 (skipped): {no_step_0_count}")
    print()
    print(f"✓ Complete (Step 0 + Rating Gate + Success Criteria): {complete_count}")
    print(f"✗ Incomplete (missing some components): {incomplete_count}")
    print()
    
    if incomplete_count > 0:
        print("=" * 80)
        print("INCOMPLETE CUJs (need manual attention)")
        print("=" * 80)
        for result in results:
            if result['has_step_0'] and not result['complete']:
                print(f"\n{result['filename']}:")
                if not result['has_rating_gate']:
                    print("  ✗ Missing Step 0.1: Plan Rating Gate")
                if not result['has_response_rater']:
                    print("  ✗ Missing response-rater mention")
                if not result['has_rating_criteria']:
                    print("  ✗ Missing 'Plan rating >= 7/10' in Success Criteria")
                if not result['has_recorded_criteria']:
                    print("  ✗ Missing 'Rating recorded in run state' in Success Criteria")
    
    print()
    print("=" * 80)
    print("COMPLETE CUJs WITH RESPONSE-RATER INTEGRATION")
    print("=" * 80)
    for result in results:
        if result['has_step_0'] and result['complete']:
            print(f"  ✓ {result['filename']}")
    
    print()
    print("=" * 80)
    print("VALIDATION SUMMARY")
    print("=" * 80)
    if incomplete_count == 0:
        print("✓ ALL CUJs with Step 0 have complete response-rater integration!")
    else:
        print(f"✗ {incomplete_count} CUJs need manual attention")
    print("=" * 80)

if __name__ == '__main__':
    main()
