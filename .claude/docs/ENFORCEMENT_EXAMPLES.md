# Enforcement Delegation Examples

Correct vs wrong patterns for orchestrator delegation.

## Example 1: File Cleanup Request

**WRONG** (Orchestrator does work directly):
```
User: "Remove the archived files"

Orchestrator Response:
[Uses Bash to run: rm -rf .claude/archive/]
[Uses git add, git commit, git push]
← VIOLATION: Direct implementation
```

**CORRECT** (Orchestrator delegates):
```
User: "Remove the archived files"

Orchestrator Response:
"I'll delegate this to a developer agent to handle the file cleanup safely."

[Uses Task tool with subagent_type="developer"]
Task Prompt: "Remove the .claude/archive/ directory and commit the changes.
Follow these steps:
1. Use Bash to remove .claude/archive/
2. Use git add to stage changes
3. Use git commit with appropriate message
4. Use git push to remote"
```

## Example 2: Documentation Update

**WRONG** (Orchestrator edits directly):
```
User: "Update the README to remove archive references"

Orchestrator Response:
[Uses Read to load README.md]
[Uses Edit to modify README.md]
[Uses Bash to git commit]
← VIOLATION: Direct file editing
```

**CORRECT** (Orchestrator delegates):
```
User: "Update the README to remove archive references"

Orchestrator Response:
"I'll spawn a developer to update the README file."

[Uses Task tool with subagent_type="developer"]
Task Prompt: "Update README.md to remove all references to the archive directory.
Search for 'archive' mentions and remove or update them.
Commit the changes with an appropriate message."
```

## Example 3: Code Review Request

**WRONG** (Orchestrator reviews directly):
```
User: "Review all the skills for issues"

Orchestrator Response:
[Uses Glob to find all SKILL.md files]
[Uses Read to load each SKILL.md]
[Analyzes content and provides feedback]
← VIOLATION: Direct analysis and extensive file reading
```

**CORRECT** (Orchestrator delegates):
```
User: "Review all the skills for issues"

Orchestrator Response:
"I'll spawn specialized agents to handle this comprehensive review."

[Uses Task tool with subagent_type="code-reviewer"]
Task Prompt: "Review all SKILL.md files in .claude/skills/ for:
- Documentation completeness
- Code quality
- Best practices compliance
Report any issues found."
```

## Example 4: Multiple File Analysis

**WRONG** (Orchestrator reads many files):
```
User: "Analyze the agent system structure"

Orchestrator Response:
[Uses Read on orchestrator.md]
[Uses Read on master-orchestrator.md]
[Uses Read on developer.md]
[Reads 10+ more agent files]
← VIOLATION: Exceeds 2-file rule
```

**CORRECT** (Orchestrator delegates):
```
User: "Analyze the agent system structure"

Orchestrator Response:
"I'll spawn an analyst to perform this comprehensive analysis."

[Uses Task tool with subagent_type="analyst"]
Task Prompt: "Analyze the agent system structure in .claude/agents/.
Review all agent definition files and provide:
- Overall structure and organization
- Agent roles and responsibilities
- Gaps or overlaps
- Recommendations for improvement"
```

## Example 5: Validation Script Execution

**WRONG** (Orchestrator runs validation):
```
User: "Validate the enforcement gates"

Orchestrator Response:
[Uses Bash to run: node .claude/tools/enforcement-gate.mjs]
[Analyzes validation output]
← VIOLATION: Direct validation execution
```

**CORRECT** (Orchestrator delegates):
```
User: "Validate the enforcement gates"

Orchestrator Response:
"I'll spawn a QA agent to run the validation checks."

[Uses Task tool with subagent_type="qa"]
Task Prompt: "Run enforcement gate validation:
1. Execute: node .claude/tools/enforcement-gate.mjs validate-all
2. Review validation results
3. Report any failures or warnings
4. Recommend fixes if needed"
```
