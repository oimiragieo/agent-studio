# Plan: Unified Creator Enforcement System

## Executive Summary

Design a single, unified guard hook that protects ALL creator artifact outputs, replacing the current skill-specific `skill-creation-guard.cjs` with a maintainable system that works for agents, hooks, workflows, templates, and schemas with minimal code duplication.

## Overview

The current `skill-creation-guard.cjs` demonstrates a working pattern for skill creation enforcement. This design extends that pattern to ALL creators using a unified approach with:

1. **Single unified guard** - One hook for all artifact types
2. **Consistent state tracking** - Shared state file format
3. **Declarative configuration** - Easy to add new creators
4. **Minimal code changes** - Adding a new creator requires only config updates

## Phases

### Phase 1: Design Foundation

**Purpose**: Establish core architecture and data structures

**Tasks**:

1. Task 1.1: Define file pattern to creator mapping (~5 min)
2. Task 1.2: Design unified state file schema (~5 min)
3. Task 1.3: Design guard hook architecture (~10 min)

**Success Criteria**: All mappings and schemas documented

---

## Architecture Overview

### Current State (skill-creation-guard.cjs)

```
[Skill() tool invoked with skill-creator]
         |
         v
[pre-execute.cjs creates state file]
         |
         v
[skill-creation-guard.cjs checks state file]
         |
         v
[SKILL.md write allowed/blocked]
```

### Proposed Unified Architecture

```
[Skill() tool invoked with ANY creator]
         |
         v
[skill-invocation-tracker.cjs detects creator skill]
         |
         v
[Updates unified state file with creator name]
         |
         v
[unified-creator-guard.cjs checks state for matching creator]
         |
         v
[Artifact write allowed/blocked based on active creator]
```

---

## State File Specification

### Location

`.claude/context/runtime/active-creators.json`

### Schema

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "skill-creator": {
      "type": "object",
      "properties": {
        "active": { "type": "boolean" },
        "invokedAt": { "type": "string", "format": "date-time" },
        "artifactName": { "type": ["string", "null"] },
        "ttl": { "type": "integer", "default": 600000 }
      }
    }
  },
  "additionalProperties": {
    "$ref": "#/properties/skill-creator"
  }
}
```

### Example State File

```json
{
  "skill-creator": {
    "active": true,
    "invokedAt": "2026-01-27T12:00:00.000Z",
    "artifactName": "new-skill",
    "ttl": 600000
  },
  "agent-creator": {
    "active": false,
    "invokedAt": "2026-01-27T11:00:00.000Z",
    "artifactName": null,
    "ttl": 600000
  },
  "hook-creator": {
    "active": false,
    "invokedAt": null,
    "artifactName": null,
    "ttl": 600000
  },
  "workflow-creator": {
    "active": false,
    "invokedAt": null,
    "artifactName": null,
    "ttl": 600000
  },
  "template-creator": {
    "active": false,
    "invokedAt": null,
    "artifactName": null,
    "ttl": 600000
  },
  "schema-creator": {
    "active": false,
    "invokedAt": null,
    "artifactName": null,
    "ttl": 600000
  }
}
```

### TTL (Time-To-Live) Logic

- Default TTL: 10 minutes (600000ms)
- If `Date.now() - invokedAt > ttl`, creator is considered inactive
- TTL allows for research + creation workflow without manual deactivation

---

## File Pattern to Creator Mapping

### Mapping Table (Source of Truth)

| File Pattern                       | Required Creator   | Notes                          |
| ---------------------------------- | ------------------ | ------------------------------ |
| `.claude/skills/**/SKILL.md`       | `skill-creator`    | Primary skill definition       |
| `.claude/agents/**/*.md`           | `agent-creator`    | Agent definitions              |
| `.claude/hooks/**/*.cjs`           | `hook-creator`     | Hook implementations           |
| `.claude/workflows/**/*.md`        | `workflow-creator` | Workflow definitions           |
| `.claude/templates/**/*`           | `template-creator` | Template files (any extension) |
| `.claude/schemas/**/*.json`        | `schema-creator`   | JSON Schema files              |
| `.claude/schemas/**/*.schema.json` | `schema-creator`   | JSON Schema files (explicit)   |

### Implementation as JavaScript Config

```javascript
/**
 * Creator configuration - maps file patterns to required creators
 *
 * MAINTAINABILITY: To add a new creator:
 * 1. Add entry to this array
 * 2. Update active-creators.json schema
 * 3. Add pre-execute hook to creator skill
 */
const CREATOR_CONFIGS = [
  {
    creator: 'skill-creator',
    patterns: [/\.claude[\/\\]skills[\/\\][^\/\\]+[\/\\]SKILL\.md$/i],
    artifactType: 'skill',
    primaryFile: 'SKILL.md',
  },
  {
    creator: 'agent-creator',
    patterns: [
      /\.claude[\/\\]agents[\/\\](?:core|domain|specialized|orchestrators)[\/\\][^\/\\]+\.md$/i,
    ],
    artifactType: 'agent',
    primaryFile: '*.md',
    excludePatterns: [
      /README\.md$/i, // Don't block README files
    ],
  },
  {
    creator: 'hook-creator',
    patterns: [
      /\.claude[\/\\]hooks[\/\\](?:routing|safety|memory|evolution|reflection|validation|session|self-healing)[\/\\][^\/\\]+\.cjs$/i,
    ],
    artifactType: 'hook',
    primaryFile: '*.cjs',
    excludePatterns: [
      /\.test\.cjs$/i, // Don't block test files
    ],
  },
  {
    creator: 'workflow-creator',
    patterns: [
      /\.claude[\/\\]workflows[\/\\](?:core|enterprise|operations|rapid)[\/\\][^\/\\]+\.md$/i,
    ],
    artifactType: 'workflow',
    primaryFile: '*.md',
    excludePatterns: [/README\.md$/i],
  },
  {
    creator: 'template-creator',
    patterns: [
      /\.claude[\/\\]templates[\/\\](?:agents|skills|workflows|hooks|code|schemas)[\/\\]/i,
    ],
    artifactType: 'template',
    primaryFile: '*',
    excludePatterns: [/README\.md$/i],
  },
  {
    creator: 'schema-creator',
    patterns: [/\.claude[\/\\]schemas[\/\\][^\/\\]+\.(?:schema\.)?json$/i],
    artifactType: 'schema',
    primaryFile: '*.schema.json',
  },
];
```

### Pattern Priority

When a file matches multiple patterns, priority is:

1. Most specific pattern wins (e.g., `SKILL.md` over `*.md`)
2. Exclude patterns are checked before include patterns
3. Test files (`*.test.cjs`) are never blocked

---

## Unified Creator Guard Design

### Phase 2: Implementation Design

**Purpose**: Define the unified guard hook implementation

**Tasks**:

1. Task 2.1: Design unified-creator-guard.cjs structure (~15 min)
2. Task 2.2: Design state management utilities (~10 min)
3. Task 2.3: Design error message templates (~10 min)

**Success Criteria**: Complete pseudocode for unified guard

---

### Hook Structure: `unified-creator-guard.cjs`

```javascript
#!/usr/bin/env node
/**
 * Unified Creator Guard Hook
 * ==========================
 *
 * Prevents direct writes to creator artifact paths without invoking
 * the corresponding creator workflow. This is a unified replacement
 * for individual guards (skill-creation-guard, agent-creation-guard, etc.)
 *
 * Root Cause (from reflection): Router bypass patterns discovered
 * during skill creation sessions where artifacts were created without
 * proper workflow, resulting in "invisible" artifacts missing from
 * CLAUDE.md, catalogs, and agent assignments.
 *
 * Trigger: PreToolUse (matches: Edit|Write)
 *
 * ENFORCEMENT MODES:
 * - CREATOR_GUARD=block (default): Block unauthorized writes
 * - CREATOR_GUARD=warn: Warn but allow
 * - CREATOR_GUARD=off: Disable enforcement
 *
 * Exit codes:
 * - 0: Allow operation
 * - 2: Block operation (SEC-008: fail-closed on error)
 *
 * @module unified-creator-guard
 */

'use strict';

const path = require('path');
const fs = require('fs');
const {
  parseHookInputAsync,
  getToolName,
  getToolInput,
  extractFilePath,
  getEnforcementMode,
  formatResult,
  auditLog,
} = require('../../lib/utils/hook-input.cjs');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CREATOR_CONFIGS = [
  // ... (as defined above)
];

const STATE_FILE = '.claude/context/runtime/active-creators.json';
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const WATCHED_TOOLS = ['Edit', 'Write'];

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Find which creator is required for a given file path
 * @param {string} filePath - File path to check
 * @returns {{ creator: string, artifactType: string } | null}
 */
function findRequiredCreator(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const config of CREATOR_CONFIGS) {
    // Check exclude patterns first
    if (config.excludePatterns) {
      const excluded = config.excludePatterns.some(pattern => pattern.test(normalizedPath));
      if (excluded) continue;
    }

    // Check include patterns
    const matched = config.patterns.some(pattern => pattern.test(normalizedPath));

    if (matched) {
      return {
        creator: config.creator,
        artifactType: config.artifactType,
      };
    }
  }

  return null;
}

/**
 * Check if a specific creator is currently active
 * @param {string} creatorName - Name of creator to check
 * @returns {{ active: boolean, invokedAt?: string, elapsedMs?: number }}
 */
function isCreatorActive(creatorName) {
  try {
    const statePath = path.join(PROJECT_ROOT, STATE_FILE);
    if (!fs.existsSync(statePath)) {
      return { active: false };
    }

    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const creatorState = state[creatorName];

    if (!creatorState || !creatorState.active || !creatorState.invokedAt) {
      return { active: false };
    }

    const invokedAt = new Date(creatorState.invokedAt).getTime();
    const ttl = creatorState.ttl || DEFAULT_TTL_MS;
    const elapsedMs = Date.now() - invokedAt;

    if (elapsedMs <= ttl) {
      return {
        active: true,
        invokedAt: creatorState.invokedAt,
        elapsedMs,
        artifactName: creatorState.artifactName,
      };
    }

    return { active: false, elapsedMs };
  } catch (err) {
    return { active: false };
  }
}

/**
 * Mark a creator as active
 * @param {string} creatorName - Name of creator
 * @param {string} [artifactName] - Optional artifact being created
 */
function markCreatorActive(creatorName, artifactName = null) {
  try {
    const statePath = path.join(PROJECT_ROOT, STATE_FILE);
    const stateDir = path.dirname(statePath);

    // Ensure directory exists
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    // Load existing state or create new
    let state = {};
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }

    // Update specific creator
    state[creatorName] = {
      active: true,
      invokedAt: new Date().toISOString(),
      artifactName: artifactName,
      ttl: DEFAULT_TTL_MS,
    };

    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Clear a creator's active state
 * @param {string} creatorName - Name of creator
 */
function clearCreatorActive(creatorName) {
  try {
    const statePath = path.join(PROJECT_ROOT, STATE_FILE);
    if (!fs.existsSync(statePath)) return true;

    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (state[creatorName]) {
      state[creatorName].active = false;
    }

    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Generate violation message
 */
function generateViolationMessage(filePath, requiredCreator, artifactType) {
  const displayPath = filePath.slice(-55).padEnd(55);

  return `
+======================================================================+
|  CREATOR GUARD VIOLATION                                             |
+======================================================================+
|  You are attempting to write directly to a ${artifactType.padEnd(8)} artifact:     |
|    ${displayPath}|
|                                                                      |
|  This bypasses the ${requiredCreator.padEnd(16)} workflow, which ensures:        |
|    - CLAUDE.md is updated with routing/documentation               |
|    - Relevant catalogs are updated for discoverability              |
|    - Related agents are assigned the artifact                       |
|    - Proper validation and testing occurs                           |
|                                                                      |
|  CORRECT APPROACH: Invoke the creator skill first                   |
|                                                                      |
|  Skill({ skill: "${requiredCreator}" })                              |
|                                                                      |
|  Without the creator workflow, the ${artifactType.padEnd(8)} will be INVISIBLE:   |
|    - Router won't know about it                                     |
|    - Agents won't be assigned it                                    |
|    - Users can't discover it                                        |
|                                                                      |
|  Override: CREATOR_GUARD=warn or CREATOR_GUARD=off                  |
+======================================================================+
`;
}

// =============================================================================
// MAIN VALIDATION
// =============================================================================

function validateCreatorWorkflow(toolName, toolInput) {
  if (!WATCHED_TOOLS.includes(toolName)) {
    return { pass: true };
  }

  const enforcement = getEnforcementMode('CREATOR_GUARD', 'block');
  if (enforcement === 'off') {
    auditLog('unified-creator-guard', 'security_override_used', {
      override: 'CREATOR_GUARD=off',
    });
    return { pass: true };
  }

  const filePath = extractFilePath(toolInput);
  if (!filePath) {
    return { pass: true };
  }

  // Check if this file requires a creator
  const required = findRequiredCreator(filePath);
  if (!required) {
    return { pass: true }; // Not a protected artifact
  }

  // Check if the required creator is active
  const creatorState = isCreatorActive(required.creator);

  if (creatorState.active) {
    return { pass: true }; // Creator workflow is active - allow
  }

  // VIOLATION: Direct write without creator workflow
  const message = generateViolationMessage(filePath, required.creator, required.artifactType);

  if (enforcement === 'block') {
    return { pass: false, result: 'block', message };
  } else {
    return { pass: true, result: 'warn', message };
  }
}

// Main execution and exports...
```

---

## Pre-Execute Hook Template

### Phase 3: Pre-Execute Hook Pattern

**Purpose**: Define reusable pattern for creator pre-execute hooks

**Tasks**:

1. Task 3.1: Design generic pre-execute hook template (~10 min)
2. Task 3.2: List which creators need pre-execute hooks (~5 min)

**Success Criteria**: Template and list documented

---

### Template: `pre-execute.cjs`

Each creator skill should have a pre-execute hook at:
`.claude/skills/<creator-name>/hooks/pre-execute.cjs`

```javascript
#!/usr/bin/env node
/**
 * {{CREATOR_NAME}} - Pre-Execute Hook
 *
 * Marks {{CREATOR_NAME}} as active before skill execution.
 * This allows unified-creator-guard.cjs to permit artifact writes.
 *
 * State file: .claude/context/runtime/active-creators.json
 */

const fs = require('fs');
const path = require('path');

const CREATOR_NAME = '{{CREATOR_NAME}}';

function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude', 'CLAUDE.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const STATE_FILE = path.join(PROJECT_ROOT, '.claude/context/runtime/active-creators.json');

function markCreatorActive() {
  try {
    const stateDir = path.dirname(STATE_FILE);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    let state = {};
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }

    state[CREATOR_NAME] = {
      active: true,
      invokedAt: new Date().toISOString(),
      artifactName: null,
      ttl: 600000, // 10 minutes
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`[${CREATOR_NAME.toUpperCase()}] Creator marked as active`);
    return true;
  } catch (err) {
    console.error(`[${CREATOR_NAME.toUpperCase()}] Failed to mark active:`, err.message);
    return false;
  }
}

// Mark active on execution
markCreatorActive();
process.exit(0);
```

### Creators Requiring Pre-Execute Hooks

| Creator            | Current Status      | Action Needed                |
| ------------------ | ------------------- | ---------------------------- |
| `skill-creator`    | Has pre-execute.cjs | Migrate to use unified state |
| `agent-creator`    | No pre-execute hook | Create hook                  |
| `hook-creator`     | No pre-execute hook | Create hook                  |
| `workflow-creator` | No pre-execute hook | Create hook                  |
| `template-creator` | No pre-execute hook | Create hook                  |
| `schema-creator`   | No pre-execute hook | Create hook                  |

---

## CLAUDE.md Gate Design

### Phase 4: Documentation Updates

**Purpose**: Design the consolidated CLAUDE.md gate

**Tasks**:

1. Task 4.1: Design unified Creator Workflow Gate (~10 min)
2. Task 4.2: Design violation example (~5 min)

**Success Criteria**: Gate text and example documented

---

### Proposed Gate 4 Replacement

Replace the current skill-specific Gate 4 with a unified gate:

```markdown
### Gate 4: Creator Workflow Check

1. Is this an artifact creation or modification request?
2. Am I tempted to write directly to a protected path?

**Protected Paths (require corresponding creator):**
| Path Pattern | Required Creator |
|--------------|------------------|
| `.claude/skills/**/SKILL.md` | `skill-creator` |
| `.claude/agents/**/*.md` | `agent-creator` |
| `.claude/hooks/**/*.cjs` | `hook-creator` |
| `.claude/workflows/**/*.md` | `workflow-creator` |
| `.claude/templates/**/*` | `template-creator` |
| `.claude/schemas/**/*.json` | `schema-creator` |

**If ANY YES -> STOP. Invoke the required creator skill FIRST.**

**Why Gate 4 Exists (Reflection ADRs)**: Direct artifact creation bypasses
critical post-creation steps (CLAUDE.md updates, catalog entries, agent
assignments), resulting in "invisible" artifacts that are never discovered
or invoked.

**Enforcement**: `unified-creator-guard.cjs` blocks direct artifact writes.
Override: `CREATOR_GUARD=warn|off`.
```

### Violation Example (Unified)

```markdown
**Example 4: Creator Workflow Violation (ANY Creator)**
```

WRONG:
User: "Create a new security-audit workflow"
Router: Write({ file_path: ".claude/workflows/enterprise/security-audit.md", content: "..." })
[Router writing workflow directly - INVISIBLE WORKFLOW]

ALSO WRONG:
User: "Create a custom hook for API rate limiting"
Router: Write({ file_path: ".claude/hooks/safety/api-rate-limiter.cjs", content: "..." })
[Direct write bypasses hook-creator workflow]

CORRECT:
User: "Create a new security-audit workflow"
Router: [ROUTER] Workflow creation detected - invoking workflow-creator first
Skill({ skill: "workflow-creator" })
[workflow-creator handles CLAUDE.md, validation, agent coordination]

```

```

---

## Migration Plan

### Phase 5: Migration Strategy

**Purpose**: Define how to consolidate existing implementation

**Tasks**:

1. Task 5.1: Map migration steps (~10 min)
2. Task 5.2: Define rollback strategy (~5 min)
3. Task 5.3: Define testing strategy (~5 min)

**Success Criteria**: Complete migration checklist

---

### Migration Steps

#### Step 1: Create Unified Infrastructure

1. Create `unified-creator-guard.cjs` at `.claude/hooks/routing/`
2. Create `active-creators.json` state file schema
3. Create shared utility functions in `.claude/lib/utils/creator-state.cjs`

#### Step 2: Update Skill-Creator

1. Migrate `skill-creator/hooks/pre-execute.cjs` to use unified state
2. Remove `skill-creator-active.json` usage (deprecated)
3. Test that skill-creation still works

#### Step 3: Add Pre-Execute Hooks to Other Creators

1. Create `agent-creator/hooks/pre-execute.cjs`
2. Create `hook-creator/hooks/pre-execute.cjs`
3. Create `workflow-creator/hooks/pre-execute.cjs`
4. Create `template-creator/hooks/pre-execute.cjs`
5. Create `schema-creator/hooks/pre-execute.cjs`

#### Step 4: Update Hook Registration

1. Add `unified-creator-guard.cjs` to `.claude/settings.json`
2. Remove (or mark deprecated) `skill-creation-guard.cjs`
3. Update `skill-invocation-tracker.cjs` to track ALL creators

#### Step 5: Update Documentation

1. Update CLAUDE.md Gate 4 with unified gate
2. Add unified violation example
3. Update Section 1.3 enforcement hooks table
4. Update Section 7 Iron Law to be generic

#### Step 6: Cleanup

1. Deprecate `skill-creation-guard.cjs` (keep for backward compatibility)
2. Remove `skill-creator-active.json` state file usage
3. Update learnings.md with migration summary

### Rollback Strategy

If issues are discovered:

1. Set `CREATOR_GUARD=off` to disable unified guard
2. Re-enable `skill-creation-guard.cjs` by setting `SKILL_CREATION_GUARD=block`
3. Investigate and fix unified guard
4. Re-enable after fix

### Testing Strategy

```bash
# Test 1: Skill creation still blocked without skill-creator
CREATOR_GUARD=block
Write to .claude/skills/test-skill/SKILL.md
Expected: BLOCKED

# Test 2: Skill creation allowed after skill-creator invoked
Skill({ skill: "skill-creator" })
Write to .claude/skills/test-skill/SKILL.md
Expected: ALLOWED

# Test 3: Agent creation blocked without agent-creator
Write to .claude/agents/domain/test-agent.md
Expected: BLOCKED

# Test 4: Agent creation allowed after agent-creator invoked
Skill({ skill: "agent-creator" })
Write to .claude/agents/domain/test-agent.md
Expected: ALLOWED

# Test 5: Exclude patterns work (test files not blocked)
Write to .claude/hooks/routing/test-hook.test.cjs
Expected: ALLOWED (test files excluded)

# Test 6: TTL expiration works
Skill({ skill: "skill-creator" })
Wait 11 minutes
Write to .claude/skills/test-skill/SKILL.md
Expected: BLOCKED (TTL expired)
```

---

## Success Metrics

| Metric              | Target  | Measurement                           |
| ------------------- | ------- | ------------------------------------- |
| Code reduction      | 50%+    | Lines in unified vs 6 separate guards |
| Test coverage       | 90%+    | Jest test file coverage               |
| New creator effort  | < 5 min | Time to add new creator support       |
| False positive rate | 0%      | Legitimate writes blocked incorrectly |
| False negative rate | 0%      | Bypass attempts not caught            |

---

## Phase FINAL: Evolution & Reflection Check

**Purpose**: Quality assessment and learning extraction

**Tasks**:

1. Spawn reflection-agent to analyze completed work
2. Extract learnings and update memory files
3. Check for evolution opportunities (new agents/skills needed)

**Spawn Command**:

```javascript
Task({
  subagent_type: 'reflection-agent',
  description: 'Session reflection and learning extraction',
  prompt:
    'You are REFLECTION-AGENT. Read .claude/agents/core/reflection-agent.md. Analyze the completed work from this plan, extract learnings to memory files, and check for evolution opportunities (patterns that suggest new agents or skills should be created).',
});
```

**Success Criteria**:

- Reflection-agent spawned and completed
- Learnings extracted to `.claude/context/memory/learnings.md`
- Evolution opportunities logged if any detected

---

## Summary

This design provides:

1. **Unified Guard**: Single `unified-creator-guard.cjs` replaces 6 potential guards
2. **Consistent State**: `active-creators.json` tracks all creators in one place
3. **Easy Maintenance**: Adding a creator requires only config updates
4. **Backward Compatible**: Can run alongside existing `skill-creation-guard.cjs` during migration
5. **Well-Documented**: Clear patterns for pre-execute hooks and CLAUDE.md updates

## Files to Create

| File                                                    | Purpose                |
| ------------------------------------------------------- | ---------------------- |
| `.claude/hooks/routing/unified-creator-guard.cjs`       | Main unified guard     |
| `.claude/hooks/routing/unified-creator-guard.test.cjs`  | Test file              |
| `.claude/lib/utils/creator-state.cjs`                   | Shared state utilities |
| `.claude/skills/agent-creator/hooks/pre-execute.cjs`    | Agent creator hook     |
| `.claude/skills/hook-creator/hooks/pre-execute.cjs`     | Hook creator hook      |
| `.claude/skills/workflow-creator/hooks/pre-execute.cjs` | Workflow creator hook  |
| `.claude/skills/template-creator/hooks/pre-execute.cjs` | Template creator hook  |
| `.claude/skills/schema-creator/hooks/pre-execute.cjs`   | Schema creator hook    |
| `.claude/schemas/active-creators.schema.json`           | State file schema      |

## Files to Modify

| File                                                 | Changes                            |
| ---------------------------------------------------- | ---------------------------------- |
| `.claude/settings.json`                              | Add unified-creator-guard.cjs      |
| `.claude/CLAUDE.md`                                  | Update Gate 4, add unified example |
| `.claude/hooks/routing/skill-invocation-tracker.cjs` | Track all creators                 |
| `.claude/skills/skill-creator/hooks/pre-execute.cjs` | Migrate to unified state           |

---

## Appendix: Configuration Reference

### Environment Variables

| Variable               | Values                 | Default | Description                        |
| ---------------------- | ---------------------- | ------- | ---------------------------------- |
| `CREATOR_GUARD`        | `block`, `warn`, `off` | `block` | Enforcement mode for unified guard |
| `SKILL_CREATION_GUARD` | (deprecated)           | -       | Use `CREATOR_GUARD` instead        |

### State File Location

```
.claude/context/runtime/active-creators.json
```

### Backward Compatibility

During migration:

- `SKILL_CREATION_GUARD` still works for skill-creation-guard.cjs
- Both guards can run simultaneously
- After migration complete, deprecate skill-creation-guard.cjs
