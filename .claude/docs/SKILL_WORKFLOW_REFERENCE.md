# Skill Workflow Reference

How skills invoke workflows and the patterns for skill-workflow interaction in the Claude Code Enterprise Framework.

## Overview

Skills are capabilities invoked via the `Skill()` tool. Workflows are multi-agent orchestration patterns. Skills can trigger workflows, and workflows often spawn agents that invoke skills.

```
User Request
     |
     v
  Router
     |
     v
  Task (spawn agent)
     |
     v
  Agent
     |
     v
  Skill({ skill: "tdd" })  <-- Skill invocation
     |
     v
  Skill Instructions
     |
     v
  Workflow Execution (if needed)
```

## Skill Invocation Protocol

Agents must use the `Skill()` tool to invoke skills:

```javascript
// CORRECT: Use Skill tool to invoke
Skill({ skill: 'tdd' });
Skill({ skill: 'debugging' });

// WRONG: Just reading the file doesn't apply the skill
Read('.claude/skills/tdd/SKILL.md'); // Reading is NOT invoking
```

The `Skill()` tool:

1. Locates the skill definition in `.claude/skills/<skill-name>/SKILL.md`
2. Loads the skill instructions into the agent's context
3. Makes skill-specific workflows available to the agent

## How Skills Invoke Workflows

### Direct Workflow Reference

Skills can reference workflows directly in their instructions:

```markdown
# TDD Skill

## Workflow

Follow the TDD workflow: `.claude/workflows/core/tdd-workflow.md`

### Steps

1. Read the workflow file
2. Execute each phase in sequence
3. Record results to memory
```

### Embedded Workflow Instructions

Skills can embed workflow steps directly:

```markdown
# Debugging Skill

## Workflow

### Phase 1: Reproduce

1. Identify the bug
2. Create minimal reproduction

### Phase 2: Diagnose

1. Add logging
2. Trace execution

### Phase 3: Fix

1. Implement fix
2. Verify fix
3. Add tests
```

### Workflow Composition

Skills can compose multiple workflows:

```markdown
# Feature Development Skill

## Workflows Used

1. **Spec Gathering**: `.claude/workflows/core/spec-gathering.md`
2. **Architecture Review**: `.claude/workflows/architecture-review-skill-workflow.md`
3. **TDD Implementation**: `.claude/workflows/core/tdd-workflow.md`
4. **Security Review**: `.claude/workflows/security-architect-skill-workflow.md`
```

## Skill-Workflow Interaction Patterns

### Pattern 1: Sequential Workflow Execution

Skill triggers a linear sequence of workflow phases:

```
Skill: TDD
   |
   v
[Phase 1: Write Test] --> [Phase 2: Run Test] --> [Phase 3: Implement] --> [Phase 4: Refactor]
```

Example from TDD skill:

```markdown
## Workflow

### Step 1: Write Test First (RED)

Create a failing test that defines expected behavior.

### Step 2: Run Test

Verify the test fails for the right reason.

### Step 3: Write Implementation (GREEN)

Write minimal code to pass the test.

### Step 4: Refactor

Improve code quality while keeping tests green.
```

### Pattern 2: Conditional Workflow Branching

Skill selects workflow based on context:

```
Skill: Code Quality
   |
   v
[Analyze Code]
   |
   +-- Has Tests? --> [Run Tests] --> [Coverage Check]
   |
   +-- No Tests? --> [Generate Tests] --> [Run Tests]
```

Example:

```markdown
## Workflow

### Step 1: Analyze

Check if code has test coverage.

### Step 2: Branch

If coverage >= 80%:

- Run existing tests
- Check for regressions

If coverage < 80%:

- Generate missing tests
- Run all tests
- Report coverage delta
```

### Pattern 3: Parallel Workflow Execution

Skill triggers multiple workflows in parallel:

```
Skill: Security Review
   |
   v
+------------------+
| Parallel Spawn   |
+------------------+
   |         |
   v         v
[SAST]     [DAST]
   |         |
   v         v
[Merge Results]
```

Example:

```markdown
## Workflow

### Parallel Analysis

Spawn concurrent security checks:

1. **Static Analysis (SAST)**
   - Code pattern scanning
   - Dependency vulnerability check

2. **Dynamic Analysis (DAST)**
   - Runtime security tests
   - Penetration testing

### Consolidation

Merge findings into unified security report.
```

### Pattern 4: Workflow with Feedback Loop

Skill iterates through workflow until condition met:

```
Skill: QA Workflow
   |
   v
[Run Tests] --> [Tests Pass?]
   |                  |
   |              No  |  Yes
   |                  |
   v                  v
[Fix Issues]      [Complete]
   |
   +-------------+
```

Example from QA workflow skill:

```markdown
## Workflow

### Loop: Test-Fix Cycle

Repeat until all tests pass:

1. **Run Tests**
   Execute full test suite.

2. **Check Results**
   If all pass: proceed to completion.
   If failures: continue to fix phase.

3. **Fix Issues**
   Address failing tests.
   Return to step 1.

### Maximum Iterations

Stop after 5 iterations to prevent infinite loops.
```

### Pattern 5: Hierarchical Workflow Delegation

Skill delegates to sub-workflows through agent spawns:

```
Skill: Feature Development
   |
   v
[Main Workflow]
   |
   +-- Task(PLANNER) --> [Planning Workflow]
   |
   +-- Task(DEVELOPER) --> [Implementation Workflow]
   |
   +-- Task(QA) --> [Testing Workflow]
```

Example:

````markdown
## Workflow

### Phase 1: Planning

Spawn PLANNER agent with planning workflow:

```javascript
Task({
  prompt: `You are PLANNER. Follow planning workflow...`,
});
```
````

### Phase 2: Implementation

After planning completes, spawn DEVELOPER:

```javascript
Task({
  prompt: `You are DEVELOPER. Follow implementation workflow...`,
});
```

### Phase 3: Testing

After implementation, spawn QA:

```javascript
Task({
  prompt: `You are QA. Follow testing workflow...`,
});
```

```

## Common Workflow Patterns

### Phased Execution Pattern

Most enterprise workflows follow this structure:

```

[Explore] --> [Plan] --> [Review] --> [Implement] --> [Validate]

```

| Phase | Purpose | Typical Agent |
|-------|---------|---------------|
| Explore | Understand requirements, analyze codebase | ARCHITECT |
| Plan | Create detailed implementation plan | PLANNER |
| Review | Security/architecture review | SECURITY-ARCHITECT |
| Implement | Execute the plan | DEVELOPER |
| Validate | Test and verify | QA |

### Gate-Based Workflow Pattern

Workflows with blocking checkpoints:

```

[Phase 1] --> [Gate 1] --> [Phase 2] --> [Gate 2] --> [Phase 3]
(Review) (Test)

```

Gates require explicit approval or passing conditions before proceeding.

### Artifact Handoff Pattern

Workflows that produce and consume artifacts:

```

[Producer Agent] --> [Artifact] --> [Consumer Agent]
PLANNER --> Plan.md --> DEVELOPER

```

Common artifacts:
- Plans (`.claude/context/plans/`)
- Research reports (`.claude/context/artifacts/research-reports/`)
- Test reports (`.claude/context/reports/`)

## Workflow-Skill Integration Matrix

| Skill | Primary Workflow | Secondary Workflows |
|-------|-----------------|---------------------|
| `tdd` | TDD workflow | Debugging |
| `plan-generator` | Planning workflow | Complexity assessment |
| `security-architect` | Security review workflow | Threat modeling |
| `architecture-review` | Architecture workflow | C4 diagrams |
| `qa-workflow` | QA workflow | TDD |
| `feature-development` | Feature workflow | Planning, TDD, QA |
| `debugging` | Debug workflow | TDD |
| `spec-gathering` | Requirements workflow | Interactive gathering |
| `session-handoff` | Handoff workflow | Context compression |

## Creating Skills with Workflows

### Skill Structure

```

.claude/skills/<skill-name>/
├── SKILL.md # Skill definition with workflow
├── examples/ # Usage examples
│ └── example-1.md
└── schemas/ # (optional) JSON schemas
└── input.schema.json

````

### SKILL.md Template

```markdown
# Skill Name

## Description
Brief description of what this skill does.

## Workflow

### Phase 1: Initialization
1. Read relevant context files
2. Analyze the task

### Phase 2: Execution
1. Step A
2. Step B
3. Step C

### Phase 3: Completion
1. Verify results
2. Update memory
3. Report completion

## External Workflows
If this skill uses external workflows:

- **Main Workflow**: `.claude/workflows/core/skill-workflow.md`
- **Secondary Workflow**: `.claude/workflows/operations/helper-workflow.md`

## Agent Integration
This skill is used by:
- DEVELOPER agent
- QA agent

## Memory Protocol
1. Read `.claude/context/memory/learnings.md` before starting
2. Record findings to appropriate memory file after completion
````

## Workflow Invocation Best Practices

### Do

1. **Check workflow prerequisites** before execution
2. **Use TaskUpdate** to track workflow progress
3. **Record workflow results** to memory files
4. **Handle workflow failures** gracefully
5. **Follow phase gates** without skipping

### Do Not

1. **Skip planning phases** for complex workflows
2. **Ignore blocking gates** in gated workflows
3. **Forget memory updates** after workflow completion
4. **Mix workflow responsibilities** (keep phases focused)
5. **Execute workflows without context** (always read memory first)

## References

- **Skill Catalog**: `.claude/context/artifacts/skill-catalog.md`
- **Artifact Lifecycle Workflow**: `.claude/workflows/core/skill-lifecycle.md`
- **Router Decision Workflow**: `.claude/workflows/core/router-decision.md`
- **Feature Development Workflow**: `.claude/workflows/enterprise/feature-development-workflow.md`
- **Skills Documentation**: `.claude/docs/SKILLS.md`
