# Stateless Recovery Documentation

## Overview

This document defines stateless behavior validation and recovery patterns for all agents in the LLM Rules Production Pack. Stateless behavior ensures agents can recover from context loss, session interruptions, and conversation history gaps without degrading performance.

---

## Stateless Behavior Requirements

All agents MUST validate stateless behavior by adhering to these principles:

### 1. File System as Source of Truth

**CRITICAL: Never rely on conversation history - always read from file system**

- **All state must be persisted** - Session state, artifacts, plans, reasoning files
- **File reads are mandatory** - Load state from disk, not from memory
- **Log all file reads** - Document file read operations with timestamps
- **Verify file modification times** - Ensure you're reading current state

### 2. No Conversation History Dependency

**Agents must NOT reference or rely on conversation history**

- ❌ Avoid phrases: "As we discussed", "Earlier you said", "In the previous message"
- ❌ Never assume context from prior messages
- ✅ Read context from files: "According to the plan document", "The artifact shows"

### 3. Context Recovery After Loss

**Agents must gracefully recover from context loss**

- Load current state from `.claude/context/`
- Resume from last known good state
- Use recovery skill if available
- Document recovery actions in reasoning files

---

## Validation Rules

### Core Validation Requirements

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **File Read Logging** | All file reads must be logged with timestamps | MANDATORY |
| **No History Dependency** | Agents must not depend on conversation history | HARD BLOCK |
| **Context Recovery** | Agents must gracefully recover from context loss | MANDATORY |
| **State Persistence** | All state must be saved to file system | MANDATORY |
| **Modification Time Checks** | Verify file modification times before use | RECOMMENDED |

### Stateless Validation Checklist

Before completing any task, verify:

- [ ] All artifacts read from file system (not from memory)
- [ ] File read operations logged with timestamps
- [ ] File modification times verified
- [ ] No references to conversation history
- [ ] All state derived from file system
- [ ] Recovery path documented

---

## File Read Logging Pattern

**MANDATORY: Log all file read operations**

### JavaScript/Node.js Example

```javascript
const fs = require('fs').promises;
const path = require('path');

/**
 * Stateless file read with logging
 * @param {string} filePath - Path to file
 * @param {string} reasoningFilePath - Path to reasoning file for logging
 */
async function statelessFileRead(filePath, reasoningFilePath) {
  const readTimestamp = new Date().toISOString();

  // Read file
  const content = await fs.readFile(filePath, 'utf-8');

  // Get file stats
  const stats = await fs.stat(filePath);

  // Log read operation
  const logEntry = {
    stateless_validation: {
      timestamp: readTimestamp,
      file_read: {
        path: filePath,
        modification_time: stats.mtime.toISOString(),
        source: "file_system",
        size: stats.size
      },
      validation_passed: true,
      conversation_history_referenced: false
    }
  };

  // Append to reasoning file
  const reasoning = JSON.parse(await fs.readFile(reasoningFilePath, 'utf-8'));
  reasoning.stateless_validations = reasoning.stateless_validations || [];
  reasoning.stateless_validations.push(logEntry);
  await fs.writeFile(reasoningFilePath, JSON.stringify(reasoning, null, 2));

  return content;
}
```

### Python Example

```python
import json
from datetime import datetime
from pathlib import Path

def stateless_file_read(file_path: str, reasoning_file_path: str) -> str:
    """Stateless file read with logging."""
    read_timestamp = datetime.utcnow().isoformat() + 'Z'

    # Read file
    content = Path(file_path).read_text()

    # Get file stats
    stats = Path(file_path).stat()

    # Log read operation
    log_entry = {
        'stateless_validation': {
            'timestamp': read_timestamp,
            'file_read': {
                'path': file_path,
                'modification_time': datetime.fromtimestamp(stats.st_mtime).isoformat() + 'Z',
                'source': 'file_system',
                'size': stats.st_size
            },
            'validation_passed': True,
            'conversation_history_referenced': False
        }
    }

    # Append to reasoning file
    reasoning = json.loads(Path(reasoning_file_path).read_text())
    reasoning.setdefault('stateless_validations', []).append(log_entry)
    Path(reasoning_file_path).write_text(json.dumps(reasoning, indent=2))

    return content
```

---

## Recovery Protocol

### When Context is Lost

Follow this recovery protocol when recovering from context loss or session interruption:

#### Step 1: Assess Current State

```bash
# Check working directory
pwd

# Check git status
git status

# List recent files
ls -lt .claude/context/ | head -20
```

#### Step 2: Load Session State

**Priority order for state recovery**:

1. **Run State** (if using run-manager):
   - `.claude/context/runs/<run_id>/state.json`
   - `.claude/context/runs/<run_id>/artifact-registry.json`

2. **Session State** (legacy):
   - `.claude/context/session.json`

3. **Artifact Registry**:
   - `.claude/context/artifact-registry.json`

4. **Git History**:
   ```bash
   git log -10 --oneline
   git diff HEAD~1
   ```

#### Step 3: Check for Artifacts

```bash
# List recent artifacts
ls -lt .claude/context/artifacts/

# Check for plans
ls -lt .claude/context/artifacts/plan-*.json

# Check for manifests
ls -lt .claude/context/artifacts/*-manifest.json
```

#### Step 4: Use Recovery Skill (If Available)

```javascript
// Invoke recovery skill
const recoveryResult = await invokeSkill('recovery', {
  workflowId: '<workflow_id>',
  step: '<current_step>',
  agent: '<agent_name>'
});
```

#### Step 5: Resume from Last Known Good State

- Load last completed step from artifact registry
- Read reasoning files to understand previous decisions
- Continue from checkpoint or re-execute current step

---

## Conversation History Detection

### Prohibited Phrases

**NEVER use these phrases** (they indicate conversation history dependency):

| Category | Prohibited Phrases |
|----------|-------------------|
| **Discussion References** | "As we discussed", "We talked about", "Based on our conversation" |
| **Message References** | "Earlier you said", "In the previous message", "You mentioned" |
| **Prior Context** | "As mentioned before", "Like I said earlier", "Remember when" |
| **Temporal References** | "A few messages ago", "Earlier in this chat", "Previously" |

### Correct Alternatives

| Instead of | Use |
|------------|-----|
| "As we discussed" | "According to the plan document" |
| "Earlier you said" | "The artifact shows" |
| "Based on our conversation" | "Based on the file" |
| "You mentioned" | "The specification indicates" |

---

## Stateless Agent Patterns

### Pattern 1: Load State on Every Invocation

```javascript
async function agentTask(taskId) {
  // ALWAYS load state from file system
  const state = await loadStateFromFile(`.claude/context/runs/${runId}/state.json`);
  const artifacts = await loadArtifacts(`.claude/context/artifacts/`);

  // Execute task using loaded state
  const result = await executeTask(state, artifacts);

  // Save updated state
  await saveStateToFile(`.claude/context/runs/${runId}/state.json`, state);

  return result;
}
```

### Pattern 2: Checkpoint Progress Incrementally

```javascript
async function longRunningTask(taskId) {
  const checkpointPath = `.claude/context/checkpoints/${taskId}-checkpoint.json`;

  for (const step of steps) {
    // Execute step
    const result = await executeStep(step);

    // Checkpoint after each step
    await saveCheckpoint(checkpointPath, {
      taskId,
      completedSteps: [...completedSteps, step],
      remainingSteps: steps.filter(s => !completedSteps.includes(s)),
      timestamp: new Date().toISOString()
    });
  }
}
```

### Pattern 3: Idempotent Operations

```javascript
async function idempotentWrite(filePath, content) {
  // Check if file exists and has same content
  if (await fileExists(filePath)) {
    const existingContent = await readFile(filePath);
    if (existingContent === content) {
      console.log(`File ${filePath} already up to date`);
      return;
    }
  }

  // Write file (idempotent)
  await writeFile(filePath, content);
}
```

---

## Integration with Workflows

### Workflow Step Recovery

When recovering mid-workflow:

1. **Read workflow state** - `.claude/context/runs/<run_id>/state.json`
2. **Check completed steps** - Artifact registry or gate files
3. **Resume from current step** - Use checkpoint or re-execute

### Artifact Continuity

Ensure artifacts persist across sessions:

- Save all artifacts to `.claude/context/artifacts/`
- Register artifacts in `.claude/context/artifact-registry.json`
- Include artifact metadata (workflow_id, step, agent, timestamp)

---

## Related Resources

### Skills

- **Recovery Skill**: `.claude/skills/recovery/SKILL.md` - Automated recovery from context loss
- **Memory Skill**: `.claude/skills/memory/SKILL.md` - Long-term memory persistence

### Agent Documentation

- **Developer Agent**: `.claude/agents/developer.md` - Stateless behavior section
- **Orchestrator Agent**: `.claude/agents/orchestrator.md` - State management patterns

### CUJs (Customer User Journeys)

- **CUJ-027**: Workflow recovery after interruption
- **CUJ-040**: Context loss handling
- **CUJ-043**: Session resumption
- **CUJ-050**: Artifact persistence
- **CUJ-056**: Stateless behavior validation

### System Documentation

- **Context Optimization**: `.claude/docs/CONTEXT_OPTIMIZATION.md`
- **Everlasting Agents**: `.claude/docs/EVERLASTING_AGENTS.md`
- **Memory Patterns**: `.claude/docs/MEMORY_PATTERNS.md`

---

## Validation Commands

### Validate Stateless Behavior

```bash
# Check for conversation history references in reasoning files
grep -r "as we discussed\|earlier you said\|in the previous message" .claude/context/history/reasoning/

# Validate file read logging
node .claude/tools/validate-stateless.mjs --reasoning .claude/context/history/reasoning/<workflow>/<agent>.json

# Check for missing state files
node .claude/tools/validate-state.mjs --run-id <run_id>
```

### Automated Validation

Add to CI/CD pipeline:

```yaml
# .github/workflows/validate-stateless.yml
name: Validate Stateless Behavior

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Check for conversation history references
        run: |
          if grep -r "as we discussed\|earlier you said\|in the previous message" .claude/context/history/reasoning/; then
            echo "ERROR: Conversation history references found"
            exit 1
          fi
      - name: Validate file read logging
        run: node .claude/tools/validate-stateless.mjs --all
```

---

## Best Practices

### For Agent Developers

1. **Always read from file system** - Never assume context from conversation
2. **Log all file reads** - Document every file read with timestamp
3. **Use recovery skill** - Leverage built-in recovery mechanisms
4. **Test context loss scenarios** - Simulate session interruptions
5. **Document recovery paths** - Explain how to resume from failures

### For Orchestrators

1. **Persist workflow state** - Save state after every step
2. **Use checkpoints** - Create checkpoints for long-running tasks
3. **Validate stateless compliance** - Check agents follow stateless patterns
4. **Provide recovery instructions** - Document how to resume workflows

### For Skill Authors

1. **Design for statelessness** - Skills should be idempotent
2. **Avoid session state** - Use file system for persistence
3. **Support recovery** - Skills should handle partial completion
4. **Document state requirements** - Clearly specify what state is needed

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "File not found" error | Agent expecting file from conversation | Read file from disk instead |
| Inconsistent state | Agent relying on memory | Load state from file system |
| Lost progress | No checkpointing | Use checkpoint pattern |
| Duplicate work | Not checking existing state | Check file system before execution |

### Debugging Steps

1. **Check file read logs** - Verify all reads are logged
2. **Search for history references** - Grep for prohibited phrases
3. **Validate state files** - Ensure state files exist and are current
4. **Test recovery** - Simulate context loss and verify recovery

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-06 | Initial release - stateless recovery documentation |

---

## References

- **CUJ-056**: Stateless Behavior Validation
- **Developer Agent**: `.claude/agents/developer.md`
- **Recovery Skill**: `.claude/skills/recovery/SKILL.md`
- **Context Optimization**: `.claude/docs/CONTEXT_OPTIMIZATION.md`
