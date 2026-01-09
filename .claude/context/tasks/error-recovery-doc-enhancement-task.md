# Task: Error Recovery Documentation Enhancement

## Objective
Enhance error recovery documentation across workflow CUJs with standardized, comprehensive recovery sections.

## Problem
Many workflow CUJs mention error recovery but lack concrete steps. Recovery sections are inconsistent or missing. CUJ-005 and CUJ-010 provide good examples, but CUJ-006, 007, 008, 009 are missing Error Recovery sections entirely.

## Requirements

### 1. Update CUJ Template
**File**: `.claude/templates/cuj-template.md`

Add standardized Error Recovery section after Success Criteria:

```markdown
## Error Recovery

### Retry Strategy
- **Max Retries**: 3 attempts per step
- **Backoff**: Exponential (1s, 2s, 4s)
- **Retry Triggers**: Transient failures, timeouts, rate limits

### Rollback Procedures
1. **Partial Completion**: Save checkpoint to `.claude/context/runs/{{run_id}}/checkpoint.json`
2. **Failed Validation**: Return to previous passing gate
3. **Critical Failure**: Escalate to human with full context

### Fallback Options
- **Alternative Agent**: If primary agent fails 3x, route to backup agent
  - <Primary Agent> → <Fallback Agent> (describe scenario)
- **Manual Override**: User can force-proceed with documented risks
- **Graceful Degradation**: <describe reduced functionality option>

### Recovery Artifacts
- Error log: `.claude/context/runs/{{run_id}}/errors.log`
- Recovery state: `.claude/context/runs/{{run_id}}/recovery-state.json`
- Checkpoint: `.claude/context/runs/{{run_id}}/checkpoint.json`
```

### 2. Enhance CUJ-027 (Recovery CUJ)
**File**: `.claude/docs/cujs/CUJ-027.md`

Add comprehensive examples:
- **Detailed Recovery Scenarios**: Show concrete examples of context loss at different steps
- **Sample Recovery State JSON**: Include example checkpoint.json and recovery-state.json structures
- **Recovery Skill Usage**: Add step-by-step invocation examples
- **Checkpoint Format Documentation**: Document the structure of checkpoint files

**Example Recovery State JSON** (add to CUJ-027):
```json
{
  "workflow_id": "wf-greenfield-001",
  "run_id": "run-2025-01-08-001",
  "last_completed_step": 7,
  "last_completed_agent": "developer",
  "next_step": 8,
  "recovery_timestamp": "2025-01-08T10:30:00Z",
  "artifacts_created": [
    "plan-wf-greenfield-001.json",
    "project-brief-wf-greenfield-001.json",
    "dev-manifest-wf-greenfield-001.json"
  ],
  "gate_files_passed": [
    "gates/00-planner.json",
    "gates/01-analyst.json",
    "gates/07-developer.json"
  ],
  "context_recovered_from": "artifact_registry"
}
```

### 3. Add Error Recovery to Missing CUJs
Add the standardized Error Recovery section to:

#### CUJ-006 (Architecture Review)
**Fallback Options**:
- Architect → Developer (if architectural analysis fails, fall back to code-level analysis)
- Architect → Code-Reviewer (if review report generation fails)

#### CUJ-007 (Technical Debt Planning)
**Fallback Options**:
- Refactoring-Specialist → Developer (if specialized refactoring analysis fails)
- Refactoring-Specialist → Code-Reviewer (if technical debt inventory fails)

#### CUJ-008 (Database Schema Planning)
**Fallback Options**:
- Database-Architect → Architect (if database-specific design fails)
- Database-Architect → Developer (if schema generation fails)

#### CUJ-009 (Component Scaffolding)
**Fallback Options**:
- Developer → Code-Reviewer (if scaffolding fails)
- Scaffolder skill → Manual implementation (if rule-based generation fails)

### 4. Document Fallback Agent Mappings
Create a section in each CUJ's Error Recovery documenting the fallback chain:

**Fallback Agent Mapping Pattern**:
```markdown
### Fallback Options
- **Alternative Agent**: If primary agent fails 3x, route to backup agent
  - <Primary> → <Fallback 1> (<scenario description>)
  - <Fallback 1> → <Fallback 2> (<scenario description>)
- **Manual Override**: User can force-proceed with documented risks
- **Graceful Degradation**: <describe reduced functionality>
```

### 5. Update Recovery Skill Documentation
**File**: `.claude/skills/recovery/SKILL.md`

Add sections:
- **Invocation Examples**: Show how to invoke recovery skill from orchestrator
- **Checkpoint Format**: Document the structure of checkpoint.json files
- **Recovery State Format**: Document the structure of recovery-state.json files
- **Step-by-Step Recovery Process**: Add detailed walkthrough with file paths

**Example Invocation** (add to SKILL.md):
```markdown
## Invocation Examples

### From Orchestrator (Context Loss Detected)
```
User: "Context was lost at Step 7. Resume workflow."
Orchestrator: "I'll use the recovery skill to resume from Step 7."
Skill: recovery
Workflow ID: wf-greenfield-001
Run ID: run-2025-01-08-001
```

### From Developer (Mid-Implementation Failure)
```
Developer: "Implementation failed at Step 7. Saving checkpoint."
Checkpoint: .claude/context/runs/run-2025-01-08-001/checkpoint.json
Recovery: Use recovery skill to resume from checkpoint
```
```

### 6. Reference Existing Examples
Use CUJ-005 and CUJ-010 as templates - they already have comprehensive Error Recovery sections.

## Success Criteria
- [ ] CUJ template updated with standardized Error Recovery section
- [ ] CUJ-027 enhanced with recovery scenarios, sample JSON, and skill usage
- [ ] CUJ-006, 007, 008, 009 have complete Error Recovery sections
- [ ] Fallback agent mappings documented for each CUJ
- [ ] Recovery skill documentation updated with invocation examples
- [ ] Checkpoint and recovery state JSON formats documented
- [ ] All changes follow CUJ template structure

## Files to Update
1. `.claude/templates/cuj-template.md`
2. `.claude/docs/cujs/CUJ-027.md`
3. `.claude/docs/cujs/CUJ-006.md`
4. `.claude/docs/cujs/CUJ-007.md`
5. `.claude/docs/cujs/CUJ-008.md`
6. `.claude/docs/cujs/CUJ-009.md`
7. `.claude/skills/recovery/SKILL.md`

## References
- Good examples: CUJ-005, CUJ-010 (already have comprehensive Error Recovery)
- Checkpoint schemas: `.claude/schemas/checkpoint.schema.json`, `.claude/schemas/recovery-*.json`
- Recovery skill: `.claude/skills/recovery/SKILL.md`
