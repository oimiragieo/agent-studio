# Hook Verification and Agent Prompt Enhancement Task

## Task 4.1: Verify Hook Agent/Skill Invocations

**Problem**: Hooks in `.claude/hooks/` need to correctly invoke agents and skills.

**Fix Required**:

1. Read all hooks in `.claude/hooks/`:
   - security-pre-tool.sh
   - audit-post-tool.sh
   - skill-injection-hook.sh
   - user-prompt-submit.sh
   - notification.sh
   - stop.sh

2. Verify each hook:
   - References valid agent names from `.claude/agents/`
   - References valid skill names from `.claude/skills/`
   - Uses correct invocation syntax

3. Fix any invalid references

## Task 4.2: Update Agent Prompts with Rules-Library References

**Problem**: Agent prompts in `.claude/agents/` should reference relevant rules from `.claude/rules-library/`.

**Fix Required**:

1. For each of the 34 agents in `.claude/agents/`:
   - Identify relevant technology rules from `.claude/rules-library/`
   - Add "@.claude/rules-library/<rule>.md" references to agent prompts

2. Key mappings:
   - developer.md → Add JavaScript, TypeScript, React rules
   - architect.md → Add architecture, API design rules
   - security-architect.md → Add security, OWASP rules
   - database-architect.md → Add SQL, database rules
   - mobile-developer.md → Add React Native, Flutter rules
   - devops.md → Add Docker, Kubernetes, Terraform rules
   - performance-engineer.md → Add performance optimization rules
   - accessibility-expert.md → Add WCAG, a11y rules

3. Use lazy-loading syntax: `@.claude/rules-library/category/rule.md`

## Task 4.3: Verify Workflow-Agent-Skill Mappings

**Problem**: Workflows need to correctly map to agents and skills.

**Fix Required**:

1. For each workflow in `.claude/workflows/`:
   - Verify each step references a valid agent from `.claude/agents/`
   - Verify skill references are valid in `.claude/skills/`

2. Create mapping validation:
   - Each workflow step `agent:` field must match an agent file
   - Each workflow step `skill:` field must match a skill directory

3. Fix any broken mappings

## Task 4.4: Create Hooks-Agent-Skill Integrity Report

**Fix Required**:

1. Generate a report showing:
   - All hooks and their agent/skill invocations
   - All workflows and their agent/skill references
   - Any broken references or missing files
   - Recommendations for fixes

Save to `.claude/context/reports/integrity-report.md`

## Deliverables

1. Updated hook files with correct agent/skill references
2. Updated agent prompt files with rules-library references
3. Updated workflow files with corrected mappings
4. Integrity report documenting all findings and fixes

## Constraints

- Follow subagent file rules (no files in project root)
- Use proper Windows path handling
- Validate all paths before writing
- Clean up temporary files after completion
