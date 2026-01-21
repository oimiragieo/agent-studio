---
name: suggestion-generator
description: Enables agents to proactively suggest alternatives, clarifications, and optimizations during workflow execution. Manages asynchronous suggestion queue with priority scoring, tracks user responses, and executes accepted suggestions safely.
model: sonnet
context:fork: true
allowed-tools: read, write, Bash
version: 1.0.0
best_practices:
  - Generate suggestions asynchronously without blocking primary task
  - Calculate priority using confidence × impact × urgency formula
  - Validate all suggestions against suggestion.schema.json
  - Store suggestions in categorized directories by status
  - Support 15 suggestion categories mapping to 4 action types
  - Auto-expire stale suggestions after 72 hours
error_handling: graceful
streaming: not-supported
templates: []
---

<identity>
Suggestion Generator Skill - Enables agents to proactively propose alternatives, clarifications, and optimizations through an asynchronous queue system with priority scoring and safe execution.
</identity>

<capabilities>
- Generate suggestions from agent outputs during task execution
- Calculate priority scores based on confidence, impact, complexity, and risk
- Queue suggestions asynchronously without blocking workflows
- Support 15 suggestion categories (next-step, quick-win, critical-fix, etc.)
- Map categories to 4 action types (file_edit, command, clarification, agent_switch)
- Track suggestion lifecycle (pending → accepted → executing → completed/rejected)
- Execute accepted suggestions safely with rollback capability
- Provide CLI commands for suggestion management
- Generate analytics on acceptance rates and patterns
- Store suggestions in organized directory structure
</capabilities>

<instructions>
<execution_process>

## Core Functions

### 1. Generate Suggestion

**Function**: `generateSuggestion(params)`

**Purpose**: Create a new suggestion from agent output and queue it for user review.

**Parameters**:

```typescript
{
  type: SuggestionType,           // One of 15 categories
  title: string,                  // 5-100 chars, actionable
  description: string,            // 10-1000 chars, detailed
  action: {
    type: ActionType,             // run-command, edit-file, etc.
    [type-specific-fields]        // Command, file_path, agent, etc.
  },
  context?: {
    trigger: string,              // What triggered this suggestion
    related_files?: string[],
    prerequisites?: string[]
  },
  impact?: {
    areas_affected: string[],
    confidence: number,           // 0.0 - 1.0
    risk_level: RiskLevel
  },
  effort?: {
    complexity: Complexity,       // trivial to very-complex
    time_estimate: string,
    agents_recommended: string[]
  }
}
```

**Process**:

1. Validate params against `suggestion.schema.json`
2. Generate unique `suggestion_id` (format: `sug-{nanoid}`)
3. Calculate priority score using formula
4. Add timestamps (created_at, expires_at)
5. Save to `.claude/conductor/context/suggestions/pending/`
6. Update index at `.claude/conductor/context/suggestions/index.json`
7. Return suggestion object

**Priority Formula**:

```
priority_score = (confidence × impact_weight × urgency_factor × risk_multiplier) / effort_penalty

Where:
- confidence: 0.0-1.0 from impact.confidence
- impact_weight: category-specific (0.4-1.5)
- urgency_factor: time-based decay (1.0-1.5, decays over 25 hours)
- risk_multiplier: risk_level multiplier (1.0-1.5)
- effort_penalty: complexity divisor (1.0-3.0)

Priority Levels:
- P0 (critical): score >= 1.2
- P1 (high): score 0.8-1.2
- P2 (medium): score 0.5-0.8
- P3 (low): score < 0.5
```

**Example**:

```javascript
const suggestion = await generateSuggestion({
  type: 'optimization',
  title: 'Replace nested loops with Map for O(n) lookup',
  description:
    'Current implementation uses O(n^2) nested loops. Using a Map would reduce complexity to O(n).',
  action: {
    type: 'edit-file',
    file_path: 'src/utils/search.ts',
    auto_executable: false,
    reversible: true,
    estimated_duration_minutes: 15,
  },
  impact: {
    areas_affected: ['performance'],
    confidence: 0.85,
    risk_level: 'low',
  },
  effort: {
    complexity: 'simple',
    time_estimate: 'minutes',
    agents_recommended: ['developer'],
  },
});
```

### 2. List Suggestions

**Function**: `listSuggestions(filters)`

**Purpose**: Retrieve suggestions with optional filtering and prioritization.

**Parameters**:

```typescript
{
  status?: SuggestionStatus[],     // pending, accepted, rejected, etc.
  priority?: Priority[],           // P0, P1, P2, P3
  type?: SuggestionType[],
  agent?: string,
  limit?: number,
  offset?: number
}
```

**Process**:

1. Load index from `.claude/conductor/context/suggestions/index.json`
2. Apply filters
3. Sort by priority (P0 first), then by created_at
4. Apply pagination (limit/offset)
5. Return suggestion summaries

**Example**:

```javascript
const suggestions = await listSuggestions({
  status: ['pending', 'deferred'],
  priority: ['P0', 'P1'],
  limit: 10,
});
```

### 3. Respond to Suggestion

**Function**: `respondToSuggestion(suggestionId, response)`

**Purpose**: Accept, reject, defer, or modify a suggestion.

**Parameters**:

```typescript
{
  action: 'accepted' | 'rejected' | 'deferred' | 'modified',
  notes?: string,
  defer_until?: string,          // ISO date if deferred
  modified_action?: ActionDefinition  // If modified
}
```

**Process**:

1. Load suggestion from queue
2. Update status and user_response fields
3. Move file to appropriate directory:
   - accepted → `.claude/conductor/context/suggestions/accepted/`
   - rejected → `.claude/conductor/context/suggestions/rejected/`
   - deferred → `.claude/conductor/context/suggestions/deferred/`
4. Update index
5. If accepted and auto_executable: trigger execution
6. Return updated suggestion

**Example**:

```javascript
await respondToSuggestion('sug-abc123', {
  action: 'accepted',
  notes: 'Good optimization, proceed with implementation',
});
```

### 4. Execute Suggestion

**Function**: `executeSuggestion(suggestionId)`

**Purpose**: Safely execute an accepted suggestion.

**Process**:

1. Validate suggestion is in accepted status
2. Check action is executable (not manual review required)
3. Backup current state if reversible
4. Execute action based on type:
   - `run-command`: Execute via Bash tool
   - `edit-file`: Apply file changes
   - `spawn-agent`: Delegate to specified agent
   - `run-workflow`: Trigger workflow
5. Track execution (started_at, duration_ms)
6. Update status to completed/failed
7. Move to `.claude/conductor/context/suggestions/completed/`
8. Return execution result

**Example**:

```javascript
const result = await executeSuggestion('sug-abc123');
// Returns: { success: true, output: "...", duration_ms: 1250 }
```

### 5. Get Suggestion Details

**Function**: `getSuggestion(suggestionId)`

**Purpose**: Retrieve full suggestion details.

**Process**:

1. Load index to find suggestion status
2. Load full suggestion JSON from appropriate directory
3. Return complete suggestion object

### 6. Expire Stale Suggestions

**Function**: `expireStale(maxAgeHours)`

**Purpose**: Auto-expire old pending/deferred suggestions.

**Process**:

1. Scan pending and deferred directories
2. Check created_at timestamps
3. For suggestions older than maxAgeHours:
   - Update status to expired
   - Move to `.claude/conductor/context/suggestions/expired/`
   - Update index
4. Return count of expired suggestions

**Default**: Auto-run every 24 hours, maxAgeHours=72

</execution_process>

<suggestion_categories>

## 15 Suggestion Categories

| Category            | Maps to Action              | Priority Weight | Typical Use Case                   |
| ------------------- | --------------------------- | --------------- | ---------------------------------- |
| `next-step`         | command, agent_switch       | 1.0             | Suggest next logical workflow step |
| `quick-win`         | file_edit, command          | 1.2             | Small improvements with high value |
| `critical-fix`      | file_edit                   | 1.5             | Security or critical bugs          |
| `optimization`      | file_edit                   | 0.8             | Performance improvements           |
| `refactor`          | file_edit                   | 0.7             | Code quality improvements          |
| `documentation`     | file_edit                   | 0.6             | Missing or outdated docs           |
| `testing`           | file_edit, command          | 0.9             | Test coverage gaps                 |
| `security`          | file_edit                   | 1.4             | Security vulnerabilities           |
| `performance`       | file_edit                   | 0.9             | Performance bottlenecks            |
| `accessibility`     | file_edit                   | 0.8             | A11y improvements                  |
| `dependency-update` | command                     | 0.7             | Package updates                    |
| `architecture`      | clarification, agent_switch | 1.1             | Design decisions                   |
| `cleanup`           | file_edit, command          | 0.5             | Technical debt cleanup             |
| `feature`           | file_edit                   | 1.0             | New feature suggestions            |
| `learning`          | clarification               | 0.4             | Knowledge gaps                     |

</suggestion_categories>

<action_types>

## 4 Primary Action Types

### 1. file_edit

**Maps from**: optimization, refactor, critical-fix, security, feature, cleanup, testing, performance, accessibility, documentation

**Fields**:

- `file_path`: Target file
- `auto_executable`: Boolean (default: false)
- `reversible`: Boolean (default: true)
- `estimated_duration_minutes`: Integer

### 2. command

**Maps from**: next-step, quick-win, dependency-update, cleanup, testing

**Fields**:

- `command`: Shell command string
- `auto_executable`: Boolean (default: false for unsafe commands)
- `estimated_duration_minutes`: Integer

**Safe Commands** (auto_executable: true):

- `npm run lint`
- `npm run format`
- `npm run test`
- `pnpm install`

### 3. clarification

**Maps from**: architecture, learning

**Fields**:

- Question or information request
- Not executable, awaits user response

### 4. agent_switch

**Maps from**: next-step, architecture

**Fields**:

- `agent`: Recommended agent name
- `task_template`: Pre-filled task JSON
- Requires user confirmation before spawning

</action_types>

<storage_architecture>

## Directory Structure

```
.claude/conductor/context/suggestions/
├── pending/                    # Awaiting review (status: pending)
│   └── sug-{id}.json
├── accepted/                   # Accepted, pre-execution (status: accepted)
│   └── sug-{id}.json
├── completed/                  # Successfully executed (status: completed)
│   └── sug-{id}.json
├── rejected/                   # Rejected by user (status: rejected)
│   └── sug-{id}.json
├── deferred/                   # Scheduled for later (status: deferred)
│   └── sug-{id}.json
├── expired/                    # Auto-expired (status: expired)
│   └── sug-{id}.json
├── index.json                  # Quick lookup index
└── analytics.json              # Aggregated metrics
```

## Index Structure

```json
{
  "version": "1.0.0",
  "updated_at": "2026-01-15T10:30:00Z",
  "suggestions": {
    "sug-abc123": {
      "status": "pending",
      "priority": "P0",
      "type": "security",
      "agent": "security-architect",
      "created_at": "2026-01-15T10:00:00Z"
    }
  },
  "counts": {
    "pending": 3,
    "accepted": 1,
    "completed": 12,
    "rejected": 5,
    "deferred": 2,
    "expired": 8
  },
  "by_priority": {
    "P0": ["sug-abc123"],
    "P1": ["sug-def456"],
    "P2": [],
    "P3": []
  }
}
```

</storage_architecture>

<agent_integration>

## Integration for All 34 Agents

**Orchestrator Agents** (master-orchestrator, orchestrator, planner):

- Route suggestions to appropriate agents
- Surface P0/P1 suggestions immediately
- Types: `agent_switch`, `clarification`

**Developer Agents**:

- Code improvements, refactoring opportunities
- Types: `file_edit`, `optimization`, `refactor`

**Architect Agents**:

- Design improvements, pattern suggestions
- Types: `architecture`, `file_edit`

**Code Reviewer**:

- Quality improvements, best practices
- Types: `file_edit`, `security`, `testing`

**QA Agents**:

- Test coverage, quality gates
- Types: `testing`, `command`

**Security Architect**:

- Vulnerability fixes, compliance
- Types: `security`, `critical-fix`

**DevOps**:

- Infrastructure, deployment suggestions
- Types: `command`, `dependency-update`

**Integration Pattern**:

```javascript
// In any worker agent during task execution
const suggestion = await generateSuggestion({
  type: 'optimization',
  title: 'Optimize database query',
  description: 'Add index to users.email for faster lookups',
  action: {
    type: 'edit-file',
    file_path: 'migrations/add-email-index.sql',
  },
  impact: {
    areas_affected: ['performance'],
    confidence: 0.9,
    risk_level: 'low',
  },
});
```

</agent_integration>

<cli_commands>

## CLI Interface

```bash
# List pending suggestions (prioritized)
node .claude/skills/suggestion-generator/cli.mjs list

# List by status
node .claude/skills/suggestion-generator/cli.mjs list --status=pending,deferred

# List by priority
node .claude/skills/suggestion-generator/cli.mjs list --priority=P0,P1

# View specific suggestion
node .claude/skills/suggestion-generator/cli.mjs show sug-abc123

# Accept a suggestion
node .claude/skills/suggestion-generator/cli.mjs accept sug-abc123 --notes="Approved"

# Reject with reason
node .claude/skills/suggestion-generator/cli.mjs reject sug-abc123 --reason="Not applicable"

# Defer until later
node .claude/skills/suggestion-generator/cli.mjs defer sug-abc123 --until="2026-01-20"

# Execute accepted suggestion
node .claude/skills/suggestion-generator/cli.mjs execute sug-abc123

# View analytics
node .claude/skills/suggestion-generator/cli.mjs analytics --days=30

# Expire stale suggestions
node .claude/skills/suggestion-generator/cli.mjs cleanup --max-age-hours=72
```

</cli_commands>

<performance_targets>

## Performance Metrics

| Operation            | Target  | Measurement                           |
| -------------------- | ------- | ------------------------------------- |
| Suggestion creation  | < 50ms  | Time from agent call to queue storage |
| Priority calculation | < 10ms  | Time to compute priority score        |
| Queue retrieval      | < 100ms | Time to fetch prioritized list        |
| Execution initiation | < 200ms | Time from accept to execution start   |
| Index update         | < 20ms  | Time to update index.json             |

</performance_targets>

<best_practices>

1. **Non-Blocking Generation**: Generate suggestions asynchronously, never block primary task
2. **Clear Titles**: Use action-oriented titles (5-100 chars)
3. **Detailed Descriptions**: Explain why and what (10-1000 chars)
4. **Accurate Confidence**: Set confidence based on certainty (0.0-1.0)
5. **Risk Assessment**: Evaluate risk_level honestly (low/medium/high/critical)
6. **Reversibility**: Mark actions as reversible only if truly rollback-safe
7. **Auto-Execution**: Only enable for safe, low-risk commands
8. **Expiration**: Set expires_at for time-sensitive suggestions
9. **Prerequisites**: List dependencies to ensure correct ordering
10. **Category Selection**: Choose most specific category for accurate priority

</best_practices>

<fallback_behavior>

## Degraded Mode

When suggestion system is unavailable:

1. **Log to Fallback File**: `.claude/context/tmp/suggestions-fallback.json`
2. **Continue Task**: Never block primary workflow
3. **Recovery**: Attempt to replay fallback suggestions when system available
4. **Notification**: Log warning in agent output
5. **Expiry**: Fallback suggestions expire after 24 hours

</fallback_behavior>

</instructions>

<examples>
<formatting_example>

## Example 1: Critical Security Fix

```javascript
await generateSuggestion({
  type: 'critical-fix',
  title: 'Fix SQL injection vulnerability in user API',
  description:
    'The /api/users endpoint concatenates user input directly into SQL query. This allows SQL injection attacks. Use parameterized queries instead.',
  action: {
    type: 'edit-file',
    file_path: 'src/api/users.ts',
    auto_executable: false,
    reversible: true,
    estimated_duration_minutes: 20,
  },
  context: {
    trigger: 'pattern-match',
    related_files: ['src/api/users.ts', 'src/db/queries.ts'],
  },
  impact: {
    areas_affected: ['security'],
    files_affected: 2,
    risk_level: 'critical',
    confidence: 0.95,
  },
  effort: {
    complexity: 'simple',
    time_estimate: 'minutes',
    agents_recommended: ['developer', 'security-architect'],
  },
  rationale: {
    why: 'Critical security vulnerability allowing SQL injection',
    benefits: ['Prevent data breaches', 'Meet security compliance'],
    risks_of_inaction: ['Data breach', 'Unauthorized access', 'Legal liability'],
  },
});

// Result: Priority P0 (score: 1.42)
```

## Example 2: Performance Optimization

```javascript
await generateSuggestion({
  type: 'optimization',
  title: 'Add database index on users.email',
  description:
    'Login queries scan entire users table. Adding index on email field will reduce query time from 500ms to <10ms.',
  action: {
    type: 'run-command',
    command: 'npm run migrate:create add-email-index',
    auto_executable: false,
    estimated_duration_minutes: 10,
  },
  context: {
    trigger: 'analysis',
    related_files: ['src/models/User.ts'],
  },
  impact: {
    areas_affected: ['performance'],
    files_affected: 1,
    risk_level: 'low',
    confidence: 0.85,
  },
  effort: {
    complexity: 'simple',
    time_estimate: 'minutes',
    agents_recommended: ['database-architect', 'developer'],
  },
});

// Result: Priority P1 (score: 0.94)
```

## Example 3: Architecture Clarification

```javascript
await generateSuggestion({
  type: 'architecture',
  title: 'Clarify authentication strategy for microservices',
  description:
    'Multiple microservices need authentication. Should we use shared JWT secret, OAuth2, or service mesh? This impacts security and scalability.',
  action: {
    type: 'ask-question',
    auto_executable: false,
  },
  context: {
    trigger: 'workflow-step',
    related_suggestions: [],
  },
  impact: {
    areas_affected: ['architecture', 'security'],
    confidence: 0.7,
    risk_level: 'medium',
  },
  effort: {
    complexity: 'complex',
    time_estimate: 'hours',
    agents_recommended: ['architect', 'security-architect'],
  },
  rationale: {
    why: 'Need to decide auth strategy before implementing microservices',
    alternatives: [
      {
        description: 'Shared JWT secret',
        pros: ['Simple', 'Fast'],
        cons: ['Single point of failure', 'Harder to rotate'],
      },
      {
        description: 'OAuth2 with authorization server',
        pros: ['Centralized control', 'Standard protocol'],
        cons: ['Additional service', 'More complex'],
      },
    ],
  },
});

// Result: Priority P1 (score: 1.05)
```

</formatting_example>
</examples>
