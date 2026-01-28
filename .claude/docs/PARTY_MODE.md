# Party Mode User Guide

Multi-agent collaboration for complex decision-making, architectural design, and consensus building.

## Table of Contents

- [Introduction](#introduction)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Team Definitions](#team-definitions)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)
- [Security Considerations](#security-considerations)

---

## Introduction

### What is Party Mode?

Party Mode enables multiple specialized AI agents to collaborate in a single conversation session. Instead of consulting agents sequentially, you bring 2-4 agents together to debate, challenge assumptions, and build consensus in real-time.

**Traditional approach**:
1. Ask developer agent for implementation plan
2. Switch context, ask security agent for review
3. Switch again, ask architect for design feedback
4. Manually synthesize 3 separate conversations

**Party Mode approach**:
1. Activate Party Mode with 3 agents (developer, security, architect)
2. Ask your question once
3. Watch agents collaborate, challenge each other, reach consensus
4. Get multi-perspective analysis in one session

### When to Use Party Mode

**Use Party Mode for**:
- Architecture decisions requiring multiple perspectives
- Security-critical features needing developer + security review
- Complex feature design with cross-functional concerns
- Post-mortem analysis of incidents
- Brainstorming sessions with diverse viewpoints

**Do NOT use Party Mode for**:
- Simple bug fixes (single developer agent sufficient)
- Routine code review (use code-reviewer agent)
- Documentation updates (use technical-writer agent)
- Urgent decisions (coordination overhead slows response)

### Key Benefits

**Multi-Perspective Analysis**: Catch blind spots through diverse viewpoints
- Developer focuses on implementation feasibility
- Security architect identifies vulnerabilities
- QA considers edge cases and testability
- Architect ensures system-level coherence

**Consensus Building**: Resolve disagreements through structured debate
- Weighted voting based on agent expertise
- Explicit agreement/disagreement tracking
- Round-based refinement until consensus emerges

**Real-Time Collaboration**: Natural team discussion vs agent-hopping
- Agents reference and challenge each other's responses
- Build collaboratively on ideas
- Faster than sequential consultation (3 sessions → 1 session)

---

## Quick Start

### Prerequisites

1. **Feature Flag Enabled**: Party Mode must be enabled in config
   ```yaml
   features:
     partyMode:
       enabled: true
       maxAgents: 4
       maxRounds: 10
   ```

2. **Team Definition**: At least one team CSV must exist in `.claude/teams/`
   - Default teams provided: `default.csv`, `creative.csv`, `technical.csv`

### 5-Minute Getting Started

**Step 1: Activate Party Mode** (router detects keyword "party mode")

```
User: I want to discuss microservices architecture in Party Mode
```

**Step 2: Router spawns Party Orchestrator**

Router analyzes request → detects Party Mode keyword → spawns party-orchestrator agent with appropriate team

**Step 3: Orchestrator initializes session**

- Loads team definition (auto-selects based on message classification)
- Spawns 2-4 relevant agents
- Creates isolated context for each agent
- Initializes session audit log

**Step 4: Agents collaborate**

- Agents receive user message + isolated context
- Each agent responds with their perspective
- Orchestrator aggregates responses, identifies agreements/disagreements
- Displays formatted multi-agent response to user

**Step 5: Multi-round refinement** (optional)

User asks follow-up → agents receive previous responses → refine analysis → reach consensus

**Step 6: Exit Party Mode**

```
User: Exit Party Mode
```

Orchestrator generates session summary with key decisions, participants, next steps.

---

## Core Concepts

### Agents

Agents are specialized AI instances with distinct roles, expertise, and communication styles.

**Agent Identity**:
- **name**: Unique identifier (e.g., `developer`)
- **displayName**: Human-friendly label (e.g., "Dev Lead")
- **icon**: Emoji for visual distinction (🔧)
- **role**: Expertise area (implementation, security, testing)
- **agentPath**: Path to agent definition file

**Agent Selection**:
- Orchestrator classifies user message by topic (architecture, security, testing, etc.)
- Selects 2-4 most relevant agents from active team
- User can direct questions to specific agent using `@agent-name`

**Example**:
```
User: @security What are the authentication risks?
```
Routes message ONLY to security-architect agent.

### Rounds

Rounds are collaboration cycles where agents respond to a shared prompt.

**Round Lifecycle**:
1. **Prompt Building**: Orchestrator builds agent-specific prompts with user message + previous responses
2. **Agent Execution**: Agents work in parallel (isolated contexts)
3. **Response Collection**: Orchestrator verifies agent identity + response integrity
4. **Aggregation**: Extract key points, identify agreements/disagreements
5. **Display**: Format and show multi-agent response to user

**Round Limits**:
- **Max agents per round**: 4 (SEC-PM-005 rate limiting)
- **Max rounds per session**: 10 (prevents session exhaustion)
- **Context size monitoring**: Warning at 100k tokens, hard limit at 150k tokens

### Consensus

Consensus is structured agreement-building through multi-round collaboration.

**Consensus Mechanism**:
- **Agreements**: Points where 2+ agents align
- **Disagreements**: Points where agents conflict
- **Weighted Voting**: Agent expertise influences decision weight
  - Security agent: 1.5x weight on security decisions
  - Architect: 1.5x weight on design decisions
  - Developer: 1.0x weight (baseline)

**Consensus States**:
- **Strong Consensus**: 80%+ agents agree (weighted)
- **Weak Consensus**: 60-79% agents agree
- **No Consensus**: <60% agreement (requires more rounds)

**Example**:
```
Round 1:
  Developer: "Use REST API"
  Architect: "Consider GraphQL for flexibility"
  Disagreement detected → Round 2

Round 2:
  Developer: "GraphQL adds complexity but worth it for mobile clients"
  Architect: "Agreed, recommend GraphQL with REST fallback"
  Strong consensus reached (100% weighted agreement)
```

### Context

Context is the shared conversation state that agents receive.

**Context Isolation (SEC-PM-004)**:
- **Deep Clone**: Each agent gets a copy, not a reference
- **Metadata Stripping**: Orchestrator state removed before agent spawn
- **Response Sanitization**: Internal data (rawThinking, toolCalls) excluded from public responses

**Context Contents**:
- User message
- Previous agent responses (PUBLIC content only)
- Agent-specific metadata (agentId, timestamp, isolation boundary marker)
- Session configuration (team name, round number)

**What agents CAN see**:
- User messages from all rounds
- Other agents' responses (formatted content only)
- Their own identity and role

**What agents CANNOT see**:
- Orchestrator's internal coordination state
- Other agents' internal reasoning (rawThinking)
- Tool calls made by other agents
- Session secrets or credentials

### Security

Security controls protect agent boundaries and prevent cross-contamination.

**6 CRITICAL Security Controls**:

| Control ID | Name | Purpose | Severity |
|------------|------|---------|----------|
| SEC-PM-001 | Agent Identity Verification | Prevent agent impersonation | HIGH |
| SEC-PM-002 | Response Integrity | Detect response tampering | HIGH |
| SEC-PM-003 | Session Audit Logging | Track all agent actions | MEDIUM |
| SEC-PM-004 | Context Isolation | Prevent context leakage | CRITICAL |
| SEC-PM-005 | Rate Limiting | Prevent resource exhaustion | MEDIUM |
| SEC-PM-006 | Memory Boundaries | Enforce sidecar ownership | CRITICAL |

See [Security Considerations](#security-considerations) for details.

---

## Team Definitions

### CSV Format Specification

Teams are defined in CSV files with 5 required fields:

```csv
agent_type,role,priority,tools,model
developer,Dev Lead,1,"Read,Write,Edit,Bash",sonnet
architect,System Architect,2,"Read,Write,Edit",sonnet
security-architect,Security Lead,1,"Read,Write,Edit",opus
qa,QA Lead,3,"Read,Write,Edit,Bash",sonnet
```

**Field Descriptions**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| agent_type | string | Agent name (must match file in `.claude/agents/`) | `developer` |
| role | string | Human-friendly role label | `Dev Lead` |
| priority | integer | Selection priority (1=highest, used when >4 agents relevant) | `1` |
| tools | string | Comma-separated tool list (quoted string) | `"Read,Write,Edit"` |
| model | string | LLM model to use (`haiku`, `sonnet`, `opus`) | `sonnet` |

**Validation Rules**:
- Maximum 4 agents per team (enforced at load time)
- agent_type must reference existing agent file
- tools must be valid tool names
- priority must be positive integer
- model must be haiku/sonnet/opus

### Example Teams

#### default.csv (General Purpose)

Balanced team for most scenarios:
- Developer (implementation)
- Architect (design)
- Security Architect (security)
- QA (testing)
- PM (requirements) [5th member, selected by priority when needed]

**Use for**: Feature design, architecture decisions, security reviews

#### creative.csv (Innovation)

Design and user experience focus:
- UX Designer (user needs)
- Technical Writer (clarity)
- PM (product vision)
- Innovation Strategist (creative solutions)

**Use for**: Product brainstorming, UX design, feature ideation

#### technical.csv (Implementation)

Deep technical collaboration:
- Architect (system design)
- DevOps (infrastructure)
- Database Architect (data modeling)
- Developer (implementation)

**Use for**: System architecture, database design, infrastructure planning

### Creating Custom Teams

**Step 1: Create CSV file** in `.claude/teams/custom/`

```csv
agent_type,role,priority,tools,model
python-pro,Python Expert,1,"Read,Write,Edit,Bash",sonnet
data-engineer,Data Engineer,1,"Read,Write,Edit,Bash",sonnet
database-architect,DB Architect,2,"Read,Write,Edit",sonnet
```

**Step 2: Name the file** (e.g., `data-engineering.csv`)

**Step 3: Validate team**:

```bash
node .claude/tools/cli/validate-team.js data-engineering
```

**Step 4: Use in Party Mode**:

```
User: Load data-engineering team and discuss ETL pipeline
```

---

## Usage Examples

### 2-Agent: Developer + Reviewer (Code Review)

**Scenario**: Review authentication implementation

```
User: I want a code review on the new JWT authentication module

[Party Mode activates with developer + code-reviewer]

Developer 🔧: The implementation follows RFC 8725 with refresh tokens. Token
expiry is configurable. Redis stores refresh tokens with TTL matching expiry.

Code Reviewer 🔍: Structure is solid. Three concerns:
1. No rate limiting on token refresh endpoint (abuse risk)
2. Redis connection error handling incomplete (no fallback)
3. Test coverage at 65% (target: 80%+)

User: How critical are these issues?

Developer 🔧: Issue #1 is HIGH - we should add rate limiting immediately.
Issue #2 is MEDIUM - graceful degradation needed. Issue #3 is LOW - can
address in next sprint.

Code Reviewer 🔍: Agreed on severity. Issue #1 blocks merge. Issues #2-3
can be follow-up tasks.

[Strong consensus reached: Block merge until rate limiting added]
```

### 3-Agent: Developer + Security + QA (Secure Feature)

**Scenario**: Implement file upload with security and testing considerations

```
User: Design secure file upload with virus scanning

[Party Mode activates with developer + security-architect + qa]

Developer 🔧: Propose async upload to S3 with Lambda virus scanner.
Client uploads to presigned S3 URL, Lambda scans on ObjectCreated event,
moves to approved/quarantine bucket based on scan result.

Security Architect 🔒: Architecture is sound. Add these controls:
1. File type validation (allowlist, not blocklist)
2. Size limit enforcement (prevent DOS via large files)
3. Presigned URL expiry (<5 minutes)
4. Scan result webhook with HMAC signature verification

QA ✅: Testing strategy:
1. Upload clean file → verify in approved bucket
2. Upload EICAR test file → verify quarantined
3. Upload oversized file → verify rejected
4. Expired presigned URL → verify 403
5. Malicious filename (path traversal) → verify sanitized

User: What's the estimated implementation time?

Developer 🔧: 2-3 days with Lambda setup, S3 bucket policies, webhook endpoint.

Security Architect 🔒: Add 1 day for penetration testing these attack vectors.

QA ✅: Add 1 day for E2E test suite (5 scenarios above + edge cases).

[Consensus: 4-5 days total, security testing is blocking]
```

### 4-Agent: Developer + Architect + Security + QA (Complex Decision)

**Scenario**: Microservices vs monolith decision for new project

```
User: Should we use microservices or monolith for the new billing system?

[Party Mode activates with developer + architect + security-architect + qa]

Developer 🔧: Team size is 4 engineers. Microservices add operational
complexity (service mesh, distributed tracing, deployment orchestration).
Recommend starting with modular monolith, extract services later if needed.

Architect 🏗️: Agree on starting simple. Design for modularity:
- Clear bounded contexts (billing, payments, invoicing, reporting)
- Interface-based communication within monolith
- Async event bus for cross-module communication
- This allows future service extraction without major refactoring.

Security Architect 🔒: Security perspective:
- Monolith: Single attack surface, easier to secure
- Microservices: Network security between services, more complexity
- Recommendation: Modular monolith with strong internal boundaries

QA ✅: Testing considerations:
- Monolith: Integration tests easier (single deployment)
- Microservices: Contract testing required (service mocks complex)
- Recommendation: Start with monolith, comprehensive integration tests

[Strong consensus: Modular monolith with future service extraction path]

User: What are the key architectural constraints for future extraction?

Architect 🏗️: Three constraints:
1. No direct database coupling between modules (use events)
2. Synchronous calls via defined interfaces only (no bypassing)
3. Separate deployment units in CI/CD (even if deployed together)

Developer 🔧: Constraint #3 means we build as if microservices but deploy
as monolith. Adds <10% overhead now, saves 50% refactoring later.

[Consensus: Accept constraints, implement modular monolith with extraction path]
```

### Multi-Round Refinement

**Scenario**: Iterative refinement through multiple rounds

```
Round 1:
User: Design caching strategy for product catalog API

Developer 🔧: Redis cache with 5-minute TTL. Cache at API layer.

Architect 🏗️: Consider cache invalidation strategy. Time-based TTL can
serve stale data for up to 5 minutes after product update.

Round 2:
User: What's the best invalidation approach?

Developer 🔧: Event-driven invalidation. Product service publishes
ProductUpdated event, API service subscribes and invalidates specific cache keys.

Architect 🏗️: Solid approach. Add cache-aside pattern: Read-through on miss,
write-through on update. Ensures consistency.

Security Architect 🔒: Consider cache poisoning: Validate event signatures
before invalidating cache (HMAC verification).

Round 3:
User: How do we handle cache failures?

Developer 🔧: Graceful degradation: Redis down → bypass cache, query database
directly. Add circuit breaker to prevent cascade failures.

QA ✅: Test scenarios:
1. Redis down → verify direct DB queries work
2. Malformed event → verify cache not poisoned
3. High load → verify circuit breaker triggers
4. Cache miss storm → verify DB can handle load

[Strong consensus after 3 rounds: Event-driven invalidation + cache-aside +
graceful degradation + security validation]
```

---

## Configuration

### Feature Flag

Control Party Mode availability via config file or environment variable.

**Config File** (`.claude/config.yaml`):

```yaml
features:
  partyMode:
    enabled: true          # Enable/disable Party Mode
    maxAgents: 4           # Max agents per round (hard limit)
    maxRounds: 10          # Max rounds per session (hard limit)
    contextWarning: 100000 # Token count warning threshold
    contextLimit: 150000   # Token count hard limit
```

**Environment Variable** (overrides config):

```bash
# Enable Party Mode
export PARTY_MODE_ENABLED=true

# Disable Party Mode (emergency)
export PARTY_MODE_ENABLED=false
```

**Environment-Specific Settings**:

| Environment | enabled | maxAgents | maxRounds | contextLimit |
|-------------|---------|-----------|-----------|--------------|
| Development | true | 4 | 10 | 150000 |
| Staging | true | 4 | 10 | 150000 |
| Production | false | 4 | 10 | 150000 |

Default: OFF in production (gradual rollout required)

### Performance Tuning

**Rate Limits** (SEC-PM-005):

```yaml
features:
  partyMode:
    maxAgents: 4    # Reduce to 3 if spawning >100ms per agent
    maxRounds: 10   # Reduce to 5 for cost control
```

**Context Management**:

```yaml
features:
  partyMode:
    contextWarning: 100000  # Warn at 100k tokens (~75% of limit)
    contextLimit: 150000    # Hard stop at 150k tokens
```

When context approaches warning threshold, orchestrator suggests summarization.

**Timeout Settings**:

```yaml
features:
  partyMode:
    agentTimeout: 60000     # 60 seconds per agent response
    roundTimeout: 300000    # 5 minutes total per round
```

---

## Troubleshooting

### Common Issues

#### Issue: Party Mode not activating

**Symptoms**: User mentions "party mode" but router spawns single agent instead

**Diagnosis**:
1. Check feature flag: `grep partyMode .claude/config.yaml`
2. Check environment override: `echo $PARTY_MODE_ENABLED`
3. Check team file exists: `ls .claude/teams/default.csv`

**Solution**:
```bash
# Enable in config
sed -i 's/enabled: false/enabled: true/' .claude/config.yaml

# Or set environment variable
export PARTY_MODE_ENABLED=true
```

#### Issue: Agent spawn failures

**Symptoms**: "Agent spawn failed" error, round terminates early

**Diagnosis**:
1. Check agent file exists: `ls .claude/agents/core/developer.md`
2. Check team CSV format: `cat .claude/teams/default.csv`
3. Check audit log: `tail -20 .claude/context/metrics/party-mode-audit.jsonl`

**Solution**:
```bash
# Validate team definition
node .claude/tools/cli/validate-team.js default

# Check agent paths in team CSV match actual files
```

#### Issue: Round timeout/exhaustion

**Symptoms**: Session ends abruptly with "max rounds exceeded"

**Diagnosis**:
1. Check round count in audit log
2. Check if agents reaching consensus
3. Check context size growth

**Solution**:
- **No consensus**: Rephrase question to be more specific
- **Context overflow**: Summarize conversation manually, restart session
- **Legitimate need**: Increase maxRounds in config (temporarily)

#### Issue: Context leakage (SEC-PM-004)

**Symptoms**: Agent references another agent's internal reasoning

**Diagnosis**:
1. Check audit log for isolation boundary violations
2. Verify context-isolator.cjs is working
3. Check if agent responses contain rawThinking or toolCalls

**Solution**:
```bash
# Verify isolation tests passing
node --test .claude/lib/party-mode/protocol/__tests__/context-isolator.test.cjs

# Check for security event logs
grep "SEC-PM-004" .claude/context/metrics/party-mode-audit.jsonl
```

#### Issue: Memory boundary violations (SEC-PM-006)

**Symptoms**: Agent reads another agent's sidecar memory

**Diagnosis**:
1. Check audit log for sidecar access denials
2. Verify sidecar-access-guard.cjs hook is registered
3. Check settings.json for hook registration

**Solution**:
```bash
# Verify hook is registered
grep "sidecar-access-guard" .claude/settings.json

# Check for security event logs
grep "SEC-PM-006" .claude/context/metrics/party-mode-audit.jsonl
```

### Debug Mode

Enable verbose logging for troubleshooting:

```yaml
features:
  partyMode:
    debug: true        # Enables verbose orchestrator logs
    auditLevel: DEBUG  # Logs all agent interactions
```

**Debug Output Includes**:
- Agent selection reasoning
- Context isolation verification
- Response hash chain validation
- Rate limit checks
- Session state transitions

**Log Locations**:
- Session audit: `.claude/context/metrics/party-mode-audit.jsonl`
- Security events: `.claude/context/metrics/party-mode-security-events.jsonl`
- Orchestrator logs: stdout (when debug: true)

### Performance Optimization

**Symptom**: Party Mode sessions slow (>5 minutes per round)

**Optimizations**:
1. **Reduce agents**: Use 2-3 agents instead of 4
2. **Shorter prompts**: Be concise in questions
3. **Faster models**: Use sonnet instead of opus (where appropriate)
4. **Parallel spawning**: Verify agents spawn in parallel (not sequential)

**Measure performance**:
```bash
# Check round duration in audit log
jq 'select(.eventType=="ROUND_COMPLETE") | .duration' .claude/context/metrics/party-mode-audit.jsonl
```

---

## API Reference

### loadTeam(teamName)

Load team definition from CSV file.

**Parameters**:
- `teamName` (string): Name of team file (without .csv extension)

**Returns**:
- `Team` object with agents array

**Throws**:
- Error if team file not found
- Error if team has >4 agents
- Error if agent file referenced in CSV does not exist

**Example**:
```javascript
const team = loadTeam('default');
// Returns: { name: 'default', agents: [ ... ] }
```

### initializeSession(sessionId, teamName)

Initialize new Party Mode session.

**Parameters**:
- `sessionId` (string): Unique session identifier (UUID)
- `teamName` (string): Team to load

**Returns**:
- `Session` object with initialized state

**Side Effects**:
- Creates session audit log entry
- Initializes agent identity hashes
- Creates isolated context for each agent

**Example**:
```javascript
const session = initializeSession('sess-uuid-1234', 'default');
// Session state initialized, audit log entry created
```

### coordinateRound(sessionId, round, team, context)

Coordinate single collaboration round.

**Parameters**:
- `sessionId` (string): Session ID
- `round` (integer): Round number (1-indexed)
- `team` (Team): Loaded team object
- `context` (Context): Shared conversation context

**Returns**:
- `RoundResult` object with agent responses and consensus

**Workflow**:
1. Enforce rate limits (max 4 agents, max 10 rounds)
2. Select relevant agents based on message classification
3. Build isolated context for each agent
4. Spawn agents in parallel
5. Collect and verify responses
6. Aggregate responses and identify consensus
7. Log round completion

**Example**:
```javascript
const result = coordinateRound('sess-1234', 1, team, context);
// Returns: { responses: [...], agreements: [...], disagreements: [...] }
```

### Full API

Complete function reference:

#### Team Management

```javascript
// Load team from CSV
loadTeam(teamName: string): Team

// Validate team definition
validateTeamDefinition(team: Team): { valid: boolean, errors: string[] }

// List available teams
listAvailableTeams(): string[]
```

#### Session Lifecycle

```javascript
// Initialize session
initializeSession(sessionId: string, teamName: string): Session

// Coordinate round
coordinateRound(sessionId: string, round: number, team: Team, context: Context): RoundResult

// End session
endSession(sessionId: string, reason: string): SessionSummary
```

#### Context Management

```javascript
// Create isolated context
createIsolatedContext(sharedContext: Context, agentConfig: AgentConfig): Context

// Verify context isolation
verifyContextIsolation(context: Context): { valid: boolean, reason?: string }

// Merge agent response
mergeAgentResponse(sharedContext: Context, agentResponse: Response): Context
```

#### Security Controls

```javascript
// Generate agent identity hash
generateAgentId(agentType: string, spawnTime: number, sessionId: string): string

// Verify response integrity
verifyResponseChain(responses: Response[]): { valid: boolean, tamperedAt?: number }

// Enforce rate limits
enforceRateLimits(session: Session): Session

// Validate sidecar ownership
validateSidecarOwnership(filePath: string, agentName: string): { valid: boolean, reason?: string }
```

---

## Security Considerations

### All 6 Security Controls Explained

#### SEC-PM-001: Agent Identity Verification (HIGH)

**Purpose**: Prevent agent impersonation

**How it works**:
- Agent identity = SHA-256 hash of (agentPath + file content)
- Hash generated at team load, verified at response collection
- Mismatch triggers response rejection + security event log

**What it protects against**:
- Malicious agent claiming to be security-architect
- Forged responses with fake attribution
- Team definition poisoning (CSV includes fake agents)

**What to monitor**:
```bash
# Check for identity mismatches
grep "SEC-PM-001" .claude/context/metrics/party-mode-audit.jsonl
```

#### SEC-PM-002: Response Integrity (HIGH)

**Purpose**: Detect response tampering

**How it works**:
- Each response includes hash of (previousHash + content + timestamp)
- Creates blockchain-like hash chain
- Content modification breaks chain verification

**What it protects against**:
- Agent modifying previous responses before next agent sees them
- Malicious reordering of responses
- Response deletion attacks

**What to monitor**:
```bash
# Check for hash chain breaks
grep "SEC-PM-002" .claude/context/metrics/party-mode-audit.jsonl
```

#### SEC-PM-003: Session Audit Logging (MEDIUM)

**Purpose**: Track all agent actions for forensics

**How it works**:
- Append-only JSONL log
- Logs: session start/end, agent spawns, responses, errors
- Includes agent hashes, response hashes, timestamps

**What it protects against**:
- Unattributed actions (who did what)
- Repudiation attacks (agent claims they didn't respond)

**What to monitor**:
```bash
# View session history
jq 'select(.sessionId=="sess-1234")' .claude/context/metrics/party-mode-audit.jsonl
```

#### SEC-PM-004: Context Isolation (CRITICAL)

**Purpose**: Prevent cross-agent context leakage

**How it works**:
- Deep clone context (JSON.parse(JSON.stringify))
- Strip orchestrator metadata (_orchestratorState, _sessionSecrets)
- Sanitize previous responses (remove rawThinking, toolCalls)

**What it protects against**:
- Agent A reading Agent B's internal reasoning
- Agents accessing orchestrator's full coordination state
- Session secrets leaking to agents

**What to monitor**:
```bash
# Verify isolation tests passing
node --test .claude/lib/party-mode/protocol/__tests__/context-isolator.test.cjs
```

#### SEC-PM-005: Rate Limiting (MEDIUM)

**Purpose**: Prevent resource exhaustion

**How it works**:
- Hard limit: Max 4 agents per round
- Hard limit: Max 10 rounds per session
- Context size monitoring with warning threshold

**What it protects against**:
- Agent spawn bombs (unlimited agent spawns)
- Round exhaustion (infinite loop of rounds)
- Context window overflow (accumulated responses exceed limit)

**What to monitor**:
```bash
# Check if rate limits triggered
grep "SEC-PM-005" .claude/context/metrics/party-mode-audit.jsonl
```

#### SEC-PM-006: Memory Boundaries (CRITICAL)

**Purpose**: Enforce sidecar ownership

**How it works**:
- Hook on Read/Write/Edit tools for sidecar paths
- Ownership verification: Agent can only access own sidecar
- No agent context = all sidecar access blocked

**What it protects against**:
- Developer agent reading security-architect's patterns
- Agent writing to another agent's sidecar
- Path traversal attacks (../other-agent/)

**What to monitor**:
```bash
# Check for sidecar access denials
grep "SEC-PM-006" .claude/context/metrics/party-mode-audit.jsonl
```

### Penetration Test Scenarios

12 penetration tests validate security controls:

| Test ID | Attack Vector | Expected Behavior | Control |
|---------|---------------|-------------------|---------|
| PEN-001 | Agent impersonation | Response REJECTED | SEC-PM-001 |
| PEN-002 | Response tampering | Hash chain BROKEN | SEC-PM-002 |
| PEN-003 | Context eavesdropping | Key NOT PRESENT | SEC-PM-004 |
| PEN-004 | Internal data leak | Key NOT PRESENT | SEC-PM-004 |
| PEN-005 | Sidecar reconnaissance | Access BLOCKED | SEC-PM-006 |
| PEN-006 | Sidecar poisoning | Write BLOCKED | SEC-PM-006 |
| PEN-007 | Agent spawn bomb | Truncated to 4 | SEC-PM-005 |
| PEN-008 | Round exhaustion | Terminated at 10 | SEC-PM-005 |
| PEN-009 | Path traversal | Path REJECTED | SEC-PM-006 |
| PEN-010 | Team definition injection | CSV validation REJECTS | SEC-PM-001 |
| PEN-011 | Context modification | Other agents NOT affected | SEC-PM-004 |
| PEN-012 | Response reordering | Hash chain BROKEN | SEC-PM-002 |

**Run penetration tests**:
```bash
node --test .claude/lib/party-mode/__tests__/security/penetration-tests.test.cjs
```

### Audit Log Analysis

**What to look for in logs**:

**Suspicious Patterns**:
- Multiple SEC-PM-001 events (repeated impersonation attempts)
- SEC-PM-006 events from same agent (sidecar reconnaissance)
- High round count approaching limit (possible exhaustion attempt)

**Normal Patterns**:
- Session start/end pairs
- Round count increases sequentially
- Response hashes form valid chain

**Forensic Investigation**:
```bash
# Extract single session
jq 'select(.sessionId=="sess-1234")' .claude/context/metrics/party-mode-audit.jsonl

# Count security events by type
jq -r '.event' party-mode-audit.jsonl | sort | uniq -c

# Find all SEC-PM-006 violations
jq 'select(.event | startswith("SEC-PM-006"))' party-mode-audit.jsonl
```

### Incident Response

**If security control triggers**:

1. **Assess Severity**:
   - SEC-PM-004 or SEC-PM-006 violation = CRITICAL (immediate action)
   - SEC-PM-001 or SEC-PM-002 violation = HIGH (investigate within 24h)
   - SEC-PM-003 or SEC-PM-005 violation = MEDIUM (investigate within 1 week)

2. **Immediate Actions**:
   - Terminate affected session
   - Preserve audit logs
   - Disable Party Mode if multiple violations detected

3. **Investigation**:
   - Review full audit trail for affected session
   - Check if pattern of violations (attack) or isolated incident (bug)
   - Identify root cause

4. **Remediation**:
   - Fix identified vulnerability
   - Run penetration tests to verify fix
   - Document in security review and learnings.md

5. **Prevention**:
   - Update security controls if new attack vector found
   - Add penetration test for discovered attack
   - Review similar code for same vulnerability

---

**Party Mode Version**: 1.0.0
**Last Updated**: 2026-01-28
**Documentation Status**: Complete (Phase 6)
