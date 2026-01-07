# Task: Standardize Success Criteria Format Across All CUJs

## Objective
Ensure all 61 CUJ files use a consistent success criteria format (table-based).

## Standard Format to Enforce
```markdown
## Success Criteria

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| [Criterion 1] | [How measured] | [Target value] |
| [Criterion 2] | [How measured] | [Target value] |
```

## Instructions
1. Scan all CUJ files (.claude/docs/cujs/CUJ-*.md) for Success Criteria sections
2. Identify CUJs using non-standard formats:
   - Bullet lists (e.g., `- ✅ Criterion`)
   - Numbered lists
   - Checklist format (e.g., `- [ ] Criterion`)
   - Paragraphs
3. Convert non-standard formats to the table format above
4. Ensure all criteria are measurable and have clear targets
5. Common criteria patterns to normalize:
   - "Tests pass" → Criterion: "Test Suite", Measurement: "Jest/Vitest", Target: "100% pass"
   - "Build succeeds" → Criterion: "Build", Measurement: "pnpm build exit code", Target: "0"
   - "No lint errors" → Criterion: "Linting", Measurement: "ESLint errors", Target: "0"
   - "Code review approved" → Criterion: "Code Review", Measurement: "Reviewer signoff", Target: "Approved"
   - "Plan rating >= 7/10" → Criterion: "Plan Quality", Measurement: "response-rater score", Target: "≥ 7/10"

## DO NOT Modify
- CUJs that already use the table format correctly
- Any other sections besides "Success Criteria"

## Report Format
Provide a summary with:
- Total CUJs scanned
- CUJs converted to table format (list filenames)
- CUJs already compliant
- Any CUJs with unclear/unmeasurable criteria

## Files to Process
All files matching: C:/dev/projects/LLM-RULES/.claude/docs/cujs/CUJ-*.md (61 files total)

## Validation
After conversion, verify:
- All tables have proper markdown formatting
- All criteria are measurable (not vague)
- All targets are specific (not "yes/no" or "true/false")
