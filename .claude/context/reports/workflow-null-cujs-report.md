# CUJs with Missing Workflow Paths

## Summary

This report identifies CUJs that are marked as `execution_mode: workflow` but have `workflow: null` in the registry.

**Issue**: `run-cuj` fails for these CUJs because they don't have workflow paths.

**Root Cause**: CUJ markdown files specify `**Execution Mode**: workflow` but don't include a specific workflow file reference.

**Total CUJs with null workflow**: 42
- **Manual-setup**: 2 (✅ expected - no workflow needed)
- **Skill-only**: 4 (✅ expected - no workflow needed)
- **Workflow-based**: 36 (❌ need workflow assignment)

## Recommended Actions

### Short-term Fix (P0)
1. Update CUJ markdown files to specify which workflow they use
2. Add workflow references in one of these formats:
   - `**Execution Mode**: brownfield-fullstack.yaml`
   - `[brownfield-fullstack Workflow](../../workflows/brownfield-fullstack.yaml)` in Related Documentation

### Long-term Fix (P1)
1. Create dedicated workflow files for CUJs that don't have one yet
2. Update CUJ-INDEX.md to reflect workflow assignments
3. Ensure CUJ markdown files are kept in sync with workflow files

## Source of Truth Hierarchy

✅ **CORRECT**: CUJ markdown files → sync → cuj-registry.json
❌ **INCORRECT**: cuj-registry.json → manual edits → out of sync

**Always edit CUJ markdown files first, then run `pnpm sync-cuj-registry` to update the registry.**

## Workflow-Based CUJs Needing Assignment

The following 36 CUJs need workflow paths assigned in their markdown files:

| CUJ ID | Name | Category | Suggested Workflow |
|--------|------|----------|-------------------|
| CUJ-004 | New Feature Planning | Planning & Architecture | greenfield-fullstack.yaml or brownfield-fullstack.yaml |
| CUJ-006 | Architecture Review | Planning & Architecture | code-quality-flow.yaml |
| CUJ-007 | Technical Debt Planning | Planning & Architecture | code-quality-flow.yaml |
| CUJ-008 | Database Schema Planning | Planning & Architecture | greenfield-fullstack.yaml |
| CUJ-009 | Component Scaffolding | Development | brownfield-fullstack.yaml |
| CUJ-013 | Code Review | Quality Assurance | code-quality-flow.yaml |
| CUJ-014 | Rule Compliance Audit | Quality Assurance | code-quality-flow.yaml |
| CUJ-015 | Test Generation | Quality Assurance | code-quality-flow.yaml |
| CUJ-016 | API Documentation | Documentation | brownfield-fullstack.yaml |
| CUJ-018 | Architecture Documentation | Documentation | code-quality-flow.yaml |
| CUJ-020 | Security Audit | Specialized Workflows | code-quality-flow.yaml |
| CUJ-023 | Dependency Updates | Maintenance & Operations | code-quality-flow.yaml |
| CUJ-036 | Validation Failure Recovery | Testing & Validation | greenfield-fullstack.yaml |
| CUJ-038 | Optional Artifact Handling | Testing & Validation | greenfield-fullstack.yaml |
| CUJ-039 | Cross-Agent Validation | Testing & Validation | code-quality-flow.yaml |
| CUJ-040 | Stateless Recovery Test | Testing & Validation | recovery-test-flow.yaml |
| CUJ-041 | Complex Artifact Dependency Chain | Testing & Validation | greenfield-fullstack.yaml |
| CUJ-043 | Workflow Interruption Recovery | Testing & Validation | recovery-test-flow.yaml |
| CUJ-044 | Agent Fallback Chain | Testing & Validation | fallback-routing-flow.yaml |
| CUJ-045 | Missing Required Artifact Recovery | Testing & Validation | recovery-test-flow.yaml |
| CUJ-046 | Feature Distillation Edge Cases | Testing & Validation | greenfield-fullstack.yaml |
| CUJ-047 | Multi-Agent Conflict Resolution | Testing & Validation | code-quality-flow.yaml |
| CUJ-049 | Cursor Plan Mode Deep Integration | Testing & Validation | cursor-plan-mode-integration-flow.yaml |
| CUJ-050 | End-to-End Workflow Robustness | Testing & Validation | enterprise-track.yaml |
| CUJ-051 | Artifact Publishing Validation | Testing & Validation | brownfield-fullstack.yaml |
| CUJ-052 | Artifact Registry Migration Test | Testing & Validation | legacy-modernization-flow.yaml |
| CUJ-053 | Publishing Metadata Persistence Test | Testing & Validation | automated-enterprise-flow.yaml |
| CUJ-054 | Cross-Platform Publishing Sync Test | Testing & Validation | automated-enterprise-flow.yaml |
| CUJ-055 | Publishing Retry Logic Test | Testing & Validation | automated-enterprise-flow.yaml |
| CUJ-056 | Workflow Recovery Protocol Test | Testing & Validation | recovery-test-flow.yaml |
| CUJ-058 | Error Recovery and Workflow Resilience | Testing & Validation | enterprise-track.yaml |
| CUJ-060 | Cross-Platform CUJ Testing | Testing & Validation | automated-enterprise-flow.yaml |
| CUJ-061 | Artifact Publishing Workflow | Testing & Validation | brownfield-fullstack.yaml |
| CUJ-062 | Skill Integration Validation | Testing & Validation | automated-enterprise-flow.yaml |

**Note**: Some suggested workflows may not exist yet. Create them as needed or use the closest matching workflow.

## Example Fix

### Before (CUJ-006.md):
```markdown
## Workflow

**Execution Mode**: `workflow`
```

### After (CUJ-006.md):
```markdown
## Workflow

**Execution Mode**: `code-quality-flow.yaml`
```

OR:

```markdown
## Workflow

**Execution Mode**: `workflow`

### Related Documentation
- [code-quality-flow Workflow](../../workflows/code-quality-flow.yaml)
```

## Validation

After updating CUJ markdown files:

1. Run sync: `node .claude/tools/sync-cuj-registry.mjs`
2. Verify registry: Check that `workflow` field is populated
3. Test run-cuj: `node .claude/tools/run-cuj.mjs CUJ-006`

## Next Steps

1. **P0**: Update the 36 CUJ markdown files with workflow references
2. **P0**: Re-run sync to populate registry
3. **P1**: Create missing workflow files for CUJs that need them
4. **P2**: Document the source of truth hierarchy in developer guides
