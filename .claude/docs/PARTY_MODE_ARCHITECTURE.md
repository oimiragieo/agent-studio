# Party Mode Architecture Documentation

Technical architecture specification for multi-agent collaboration system.

## Table of Contents

- [System Overview](#system-overview)
- [Phase 1: Security Infrastructure](#phase-1-security-infrastructure)
- [Phase 2: Core Protocol](#phase-2-core-protocol)
- [Phase 3: Orchestration & Lifecycle](#phase-3-orchestration--lifecycle)
- [Phase 4: Consensus & Coordination](#phase-4-consensus--coordination)
- [Design Decisions (ADRs)](#design-decisions-adrs)
- [Performance Characteristics](#performance-characteristics)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                v
┌─────────────────────────────────────────────────────────────────┐
│                     ROUTER AGENT                                │
│  - Detects "party mode" keyword                                 │
│  - Spawns party-orchestrator with appropriate team              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                v
┌─────────────────────────────────────────────────────────────────┐
│                  PARTY ORCHESTRATOR                             │
│  - Loads team definition (CSV)                                  │
│  - Classifies message (architecture, security, testing, etc.)   │
│  - Selects 2-4 relevant agents                                  │
│  - Creates isolated context per agent                           │
│  - Spawns agents in parallel                                    │
│  - Collects & aggregates responses                              │
│  - Identifies agreements/disagreements                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                  ┌─────────────┴─────────────┐
                  │                           │
                  v                           v                   v
      ┌──────────────────┐      ┌──────────────────┐  ┌──────────────────┐
      │   AGENT A        │      │   AGENT B        │  │   AGENT C        │
      │   (Developer)    │      │   (Security)     │  │   (Architect)    │
      ├──────────────────┤      ├──────────────────┤  ├──────────────────┤
      │ Isolated Context │      │ Isolated Context │  │ Isolated Context │
      │ + Own Sidecar    │      │ + Own Sidecar    │  │ + Own Sidecar    │
      └──────────────────┘      └──────────────────┘  └──────────────────┘
                  │                           │                   │
                  └─────────────┬─────────────┘───────────────────┘
                                │
                                v
┌─────────────────────────────────────────────────────────────────┐
│              RESPONSE AGGREGATION & CONSENSUS                   │
│  - Verify agent identity (SEC-PM-001)                           │
│  - Verify response integrity (SEC-PM-002)                       │
│  - Extract key points                                           │
│  - Identify agreements/disagreements                            │
│  - Build consensus (weighted voting)                            │
│  - Log to audit trail (SEC-PM-003)                              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                v
┌─────────────────────────────────────────────────────────────────┐
│                   MULTI-AGENT RESPONSE                          │
│  **🔧 Developer:** Implementation perspective                    │
│  **🔒 Security:** Security perspective                           │
│  **🏗️ Architect:** Design perspective                            │
│                                                                  │
│  Agreements: [List of consensus points]                         │
│  Disagreements: [List of divergent views]                       │
└─────────────────────────────────────────────────────────────────┘
```

### Component Relationships

```
┌────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYER                               │
│  agent-identity.cjs | response-integrity.cjs |                  │
│  session-audit.cjs                                              │
└───────────────┬────────────────────────────────────────────────┘
                │ (validates)
                v
┌────────────────────────────────────────────────────────────────┐
│                     PROTOCOL LAYER                              │
│  message-router.cjs | context-isolator.cjs |                    │
│  sidecar-manager.cjs                                            │
└───────────────┬────────────────────────────────────────────────┘
                │ (uses)
                v
┌────────────────────────────────────────────────────────────────┐
│                  ORCHESTRATION LAYER                            │
│  team-loader.cjs | lifecycle-manager.cjs |                      │
│  round-manager.cjs                                              │
└───────────────┬────────────────────────────────────────────────┘
                │ (coordinates)
                v
┌────────────────────────────────────────────────────────────────┐
│                   CONSENSUS LAYER                               │
│  response-aggregator.cjs | consensus-builder.cjs |              │
│  context-threader.cjs | coordination-controller.cjs             │
└────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Request Flow** (User → Agents):

```
1. User message
   ↓
2. Router detects "party mode"
   ↓
3. Router spawns party-orchestrator
   ↓
4. Orchestrator loads team CSV
   ↓
5. Orchestrator classifies message → selects agents
   ↓
6. Create isolated context per agent (SEC-PM-004)
   ↓
7. Spawn agents in parallel (Task tool)
   ↓
8. Agents receive isolated context + user message
```

**Response Flow** (Agents → User):

```
1. Agents generate responses
   ↓
2. Verify agent identity (SEC-PM-001)
   ↓
3. Verify response integrity (SEC-PM-002)
   ↓
4. Aggregate responses (extract key points)
   ↓
5. Identify agreements/disagreements
   ↓
6. Build consensus (weighted voting)
   ↓
7. Log to audit trail (SEC-PM-003)
   ↓
8. Format multi-agent response
   ↓
9. Display to user
```

---

## Phase 1: Security Infrastructure

**Purpose**: Foundational security components used by all Party Mode features

### Agent Identity Manager

**File**: `.claude/lib/party-mode/security/agent-identity.cjs`

**Functions** (3):

```javascript
generateAgentId(agentType, spawnTime, sessionId);
// Returns: agent_<8-hex>_<timestamp>
// Example: agent_a1b2c3d4_1706428800000

setAgentContext(context);
// Stores current agent identity in memory
// Used by SEC-PM-006 memory boundary enforcement

getAgentContext();
// Retrieves current agent identity
// Returns: { agentId, agentType, sessionId, spawnTime }
```

**Implementation Details**:

- Agent ID format: `agent_<prefix>_<timestamp>`
- Prefix: First 8 chars of SHA-256 hash of agentType
- Timestamp: Unix timestamp in milliseconds
- Metadata stored in-memory Map (session-scoped, not persisted)

**Performance**:

- ID generation: <1ms (SHA-256 hashing)
- Context set/get: <1ms (Map operations)

**Test Coverage**: 14 tests

- ID generation uniqueness (1000 IDs)
- ID format validation
- Context set/get/clear
- Collision resistance

**Security Properties**:

- Collision-resistant (SHA-256)
- Temporal ordering (timestamp included)
- Session-scoped (no cross-session contamination)

---

### Response Integrity Validator

**File**: `.claude/lib/party-mode/security/response-integrity.cjs`

**Functions** (4):

```javascript
initializeChain(sessionId);
// Creates new hash chain with initial state
// Returns: { sessionId, chain: [], lastHash: '0' }

appendResponse(chain, agentId, content, timestamp);
// Appends response to chain with hash linking
// Hash = SHA-256(previousHash:agentId:content:timestamp)
// Returns: updated chain with new response + hash

verifyChain(chain);
// Recalculates all hashes, detects tampering
// Returns: { valid: true } or { valid: false, tamperedAt: index }

getChainMetadata(chain);
// Returns: { length, firstTimestamp, lastTimestamp, agentCount }
```

**Implementation Details**:

- Hash format: First 16 chars of SHA-256 hex digest
- Chain initialization: previousHash = '0'
- Each response links to previous via hash
- Blockchain-like structure (append-only, tamper-evident)

**Hash Chain Example**:

```javascript
Response 1: hash('0:agent_dev_123:content1:ts1') → hash1
Response 2: hash('hash1:agent_sec_456:content2:ts2') → hash2
Response 3: hash('hash2:agent_arch_789:content3:ts3') → hash3
```

**Performance**:

- Hash generation: <2ms per response
- Chain verification (10 responses): <10ms
- Verification scales linearly (O(n))

**Test Coverage**: 12 tests

- Chain initialization
- Response appending
- Hash verification
- Tampering detection (content, order, deletion)

**Security Properties**:

- Tamper-evident (content change breaks chain)
- Order-preserving (reordering detected)
- Append-only (deletion detected)

---

### Session Audit Logger

**File**: `.claude/lib/party-mode/security/session-audit.cjs`

**Functions** (5):

```javascript
createSessionLog(sessionId, teamName, agents);
// Log entry: { timestamp, eventType: 'SESSION_START', sessionId, teamName, agentCount, agents }

logAgentResponse(sessionId, agentId, responseHash, contentLength);
// Log entry: { timestamp, eventType: 'AGENT_RESPONSE', sessionId, agentId, responseHash, contentLength }

logSessionEnd(sessionId, reason, stats);
// Log entry: { timestamp, eventType: 'SESSION_END', sessionId, reason, totalRounds, totalResponses, duration }

logSecurityEvent(eventType, details);
// Log entry: { timestamp, eventType: 'SECURITY_EVENT', ...details }

queryAuditLog(sessionId, filters);
// Reads JSONL, filters by sessionId + optional eventType
// Returns: Array of matching log entries
```

**Implementation Details**:

- Format: JSONL (newline-delimited JSON)
- Location: `.claude/context/metrics/party-mode-audit.jsonl`
- Append-only (no modifications)
- Monotonic timestamps (guaranteed ordering)

**Log Entry Example**:

```json
{"timestamp":"2026-01-28T10:00:00.000Z","eventType":"SESSION_START","sessionId":"sess-1234","teamName":"default","agentCount":3,"agents":[{"name":"developer","hash":"a1b2c3d4"}]}
{"timestamp":"2026-01-28T10:00:15.000Z","eventType":"AGENT_RESPONSE","sessionId":"sess-1234","agentId":"agent_dev_123","responseHash":"e5f6g7h8","contentLength":256}
{"timestamp":"2026-01-28T10:05:30.000Z","eventType":"SESSION_END","sessionId":"sess-1234","reason":"user_exit","totalRounds":3,"totalResponses":9,"duration":330000}
```

**Performance**:

- Log write: <2ms (append operation)
- Log query (100 entries): <50ms (JSONL streaming parse)
- Log query scales linearly with session length

**Test Coverage**: 10 tests

- Session start/end logging
- Agent response logging
- Security event logging
- Query by session ID
- Append-only verification

**Security Properties**:

- Append-only (tamper-resistant)
- Monotonic timestamps (no backdating)
- Human-readable (forensic analysis)

---

## Phase 2: Core Protocol

**Purpose**: Message routing, context isolation, and per-agent memory

### Message Router

**File**: `.claude/lib/party-mode/protocol/message-router.cjs`

**Functions** (5):

```javascript
initializeRouter(sessionId);
// Creates router state with message queue
// Returns: { sessionId, routes: Map(), messageQueue: [] }

routeMessage(router, fromAgentId, toAgentId, message);
// Routes message from one agent to another (unicast)
// Returns: messageId

broadcastMessage(router, fromAgentId, message);
// Routes message to all agents in session (multicast)
// Returns: messageId

getMessages(router, agentId);
// Retrieves messages for specific agent
// Returns: Array of messages

hashMessage(message);
// Generates message integrity hash (SHA-256)
// Returns: 16-char hex hash
```

**Implementation Details**:

- Message format: `{ messageId, fromAgentId, toAgentId, message, timestamp, messageHash, type }`
- Types: 'unicast' (1:1), 'multicast' (1:N)
- In-memory queue (session-scoped, not persisted)
- Hash integrity verification on retrieval

**Performance**:

- Route message: <5ms (Map insert + hash generation)
- Get messages: <1ms (Map lookup + filter)
- Message routing scales O(1) per message

**Test Coverage**: 12 tests

- Unicast routing
- Multicast routing
- Message retrieval
- Hash integrity verification

**Security Properties**:

- Hash integrity (tampering detected)
- Temporal ordering (timestamp + queue order)
- Isolation (agents only see routed messages)

---

### Context Isolator (CRITICAL - SEC-PM-004)

**File**: `.claude/lib/party-mode/protocol/context-isolator.cjs`

**Functions** (4):

```javascript
createIsolatedContext(sharedContext, agentConfig);
// Deep clones context + strips orchestrator metadata
// Returns: isolated context with _isolationBoundary marker

stripOrchestratiorMetadata(context);
// Removes: _orchestratorState, _allAgentContexts, _sessionSecrets
// Returns: cleaned context

sanitizePreviousResponses(responses);
// Removes: rawThinking, toolCalls, memoryAccess from each response
// Returns: Array of sanitized responses (PUBLIC content only)

verifyContextIsolation(context);
// Validates isolation boundary + checks for forbidden keys
// Returns: { valid: true } or { valid: false, reason: '...' }
```

**Implementation Details**:

- **Deep Clone**: `JSON.parse(JSON.stringify(context))`
- **Isolation Boundary Marker**: `_isolationBoundary: true`
- **Forbidden Keys**: `_orchestratorState`, `_allAgentContexts`, `_sessionSecrets`, `_coordinationState`
- **Response Sanitization**: Strip `rawThinking`, `toolCalls`, `memoryAccess` from previousResponses

**What Agents CAN See**:

- User messages
- Previous agent responses (formatted content only)
- Their own identity (agentId, agentType)
- Session metadata (teamName, roundNumber)

**What Agents CANNOT See**:

- Orchestrator's internal coordination state
- Other agents' internal reasoning (rawThinking)
- Tool calls made by other agents
- Session secrets/credentials
- Full agent list (only know about agents who responded)

**Performance**:

- Context isolation: <10ms (JSON deep clone + filtering)
- Verification: <1ms (key check)
- Scales linearly with context size

**Test Coverage**: 16 tests

- Deep clone verification (modify copy, original unchanged)
- Orchestrator metadata stripping
- Response sanitization
- Isolation boundary verification
- Forbidden key checks

**Security Properties**:

- Copy-on-spawn (no shared references)
- Metadata stripping (orchestrator state hidden)
- Response sanitization (internal data excluded)
- Verification gate (catches isolation failures)

**Attack Vectors Tested**:

- Agent tries to access `_orchestratorState` → Key not present
- Agent tries to read `rawThinking` from previous response → Key not present
- Agent modifies their context → Other agents unaffected

---

### Sidecar Manager (CRITICAL - SEC-PM-006)

**File**: `.claude/lib/party-mode/protocol/sidecar-manager.cjs`

**Functions** (5):

```javascript
createSidecar(sessionId, agentId);
// Creates directory: .claude/staging/agents/<sessionId>/<agentId>/
// Creates default files: discoveries.json, keyFiles.json, notes.txt
// Returns: sidecar path

readSidecar(sessionId, agentId, key);
// Reads: <sidecarPath>/<key>.json
// Returns: parsed JSON content

writeSidecar(sessionId, agentId, key, value);
// Writes: <sidecarPath>/<key>.json
// Atomic write (tmp + rename)

validateSidecarAccess(filePath, agentContext);
// Verifies: filePath is under own sidecar directory
// Returns: { valid: true } or { valid: false, reason: '...' }

cleanupSidecar(sessionId, agentId);
// Deletes sidecar directory (after session end)
```

**Implementation Details**:

- **Sidecar Path**: `.claude/staging/agents/<sessionId>/<agentId>/`
- **File Format**: JSON (key-value store)
- **Default Files**: `discoveries.json` (array), `keyFiles.json` (array), `notes.txt` (string)
- **Ownership**: Agent can only access own sidecar (enforced by SEC-PM-006 hook)

**Sidecar Structure**:

```
.claude/staging/agents/
  sess-1234/
    agent_dev_123/
      discoveries.json      # Array of strings
      keyFiles.json         # Array of file paths
      notes.txt             # Free-form notes
      custom-key.json       # Agent-defined keys
    agent_sec_456/
      discoveries.json
      keyFiles.json
      notes.txt
```

**Performance**:

- Sidecar creation: <50ms (directory + 3 files)
- Read: <10ms (JSON parse)
- Write: <10ms (JSON stringify + atomic write)
- Cleanup: <100ms (recursive delete)

**Test Coverage**: 16 tests

- Sidecar creation
- Read/write operations
- Ownership validation
- Cross-agent access blocking
- Path traversal prevention

**Security Properties**:

- Ownership enforcement (agent can only access own sidecar)
- Path validation (prevents traversal attacks)
- Isolation (no shared sidecar access)
- Cleanup (no leftover data after session)

**Attack Vectors Tested**:

- Agent reads another agent's sidecar → BLOCKED
- Path traversal `../other-agent/` → BLOCKED
- Symbolic link to other sidecar → BLOCKED by path resolution

---

## Phase 3: Orchestration & Lifecycle

**Purpose**: Team loading, agent lifecycle management, round coordination

### Team Loader

**File**: `.claude/lib/party-mode/orchestration/team-loader.cjs`

**Functions** (3):

```javascript
loadTeam(teamName);
// Reads: .claude/teams/<teamName>.csv
// Parses CSV, validates team definition
// Returns: Team object with agents array

validateTeamDefinition(team);
// Validates: max 4 agents, valid fields, agent paths exist
// Returns: { valid: true } or { valid: false, errors: [...] }

listAvailableTeams();
// Scans .claude/teams/ directory
// Returns: Array of team names (without .csv extension)
```

**CSV Schema**:

```csv
agent_type,role,priority,tools,model
developer,Dev Lead,1,"Read,Write,Edit,Bash",sonnet
```

**Fields**:

- `agent_type`: Agent name (must match file in `.claude/agents/`)
- `role`: Human-friendly role label
- `priority`: Selection priority (1=highest)
- `tools`: Comma-separated tool list (quoted string)
- `model`: LLM model (`haiku`, `sonnet`, `opus`)

**Validation Rules**:

- Max 4 agents per team
- agent_type file must exist (`.claude/agents/core/<agent_type>.md`)
- tools must be valid tool names
- priority must be positive integer
- model must be haiku/sonnet/opus

**Performance**:

- Load team: <50ms (CSV parse + validation)
- List teams: <10ms (directory scan)

**Test Coverage**: 10 tests

- CSV parsing
- Team validation (max agents, valid paths)
- Custom CSV parsing (handles quoted strings)
- Error handling (missing file, invalid format)

---

### Lifecycle Manager

**File**: `.claude/lib/party-mode/orchestration/lifecycle-manager.cjs`

**Functions** (5):

```javascript
initializeSession(sessionId, team);
// Creates session state with agent identities
// Returns: { sessionId, team, agents: Map(), state: 'initialized' }

spawnAgent(session, agentConfig);
// Creates isolated context, spawns agent via Task tool
// Transitions agent state: 'spawned' → 'active'
// Returns: agentId

collectResponse(session, agentId, response);
// Verifies agent identity + response integrity
// Transitions agent state: 'active' → 'completing'
// Returns: verified response

completeAgent(session, agentId);
// Finalizes agent, logs completion
// Transitions agent state: 'completing' → 'completed'

terminateSession(session, reason);
// Cleans up session state, logs end
// Returns: session summary
```

**Agent Lifecycle States**:

```
spawned → active → completing → completed
         ↓
      failed (error state)
         ↓
      terminated (force-stop)
```

**State Transitions**:

- `spawned`: Agent created, context isolated, not yet responding
- `active`: Agent received context, generating response
- `completing`: Response collected, verification complete
- `completed`: Agent finished, response logged
- `failed`: Agent error (timeout, crash, validation failure)
- `terminated`: Force-stopped by orchestrator

**Performance**:

- Initialize session: <20ms (state creation + identity generation)
- Spawn agent: <100ms (context isolation + Task tool spawn)
- Collect response: <5ms (identity + integrity verification)

**Test Coverage**: 13 tests

- Session initialization
- Agent spawning
- Response collection
- State transitions
- Error handling (timeout, crash)

---

### Round Manager

**File**: `.claude/lib/party-mode/orchestration/round-manager.cjs`

**Functions** (5):

```javascript
startRound(session, round, userMessage);
// Initializes round state, selects agents
// Returns: { roundId, selectedAgents, state: 'started' }

enforceRateLimits(session, round);
// Validates: max 4 agents, max 10 rounds
// Throws: Error if limits exceeded
// Returns: session (if valid)

executeRound(session, round, agents, context);
// Spawns agents in parallel, collects responses
// Returns: { responses: [...], duration: ms }

aggregateResponses(session, round, responses);
// Extracts key points, identifies agreements/disagreements
// Returns: { keyPoints: [...], agreements: [...], disagreements: [...] }

completeRound(session, round);
// Finalizes round, logs completion
// Returns: round summary
```

**Round Workflow**:

1. Start round (select agents, enforce rate limits)
2. Execute round (spawn agents in parallel)
3. Collect responses (verify identity + integrity)
4. Aggregate responses (extract key points)
5. Complete round (log completion)

**Rate Limits (SEC-PM-005)**:

- **Max agents per round**: 4 (hard limit)
- **Max rounds per session**: 10 (hard limit)
- **Enforcement**: Throw error if exceeded (no soft limits)

**Performance**:

- Start round: <20ms (agent selection + rate limit checks)
- Execute round: <90s (4 agents in parallel, each <30s)
- Aggregate responses: <20ms (key point extraction)
- Complete round: <5ms (logging)

**Test Coverage**: 12 tests

- Round initialization
- Rate limit enforcement (4 agents, 10 rounds)
- Parallel agent execution
- Response aggregation
- Round completion

---

## Phase 4: Consensus & Coordination

**Purpose**: Response aggregation, consensus building, multi-round context threading

### Response Aggregator

**File**: `.claude/lib/party-mode/consensus/response-aggregator.cjs`

**Functions** (4):

```javascript
aggregateResponses(sessionId, round, agentResponses);
// Extracts key points from all responses
// Returns: { keyPoints: [...], responseCount, round }

extractKeyPoints(response);
// Parses response content, identifies key statements
// Returns: Array of key point strings

identifyAgreements(responses);
// Finds common themes across responses (2+ agents)
// Returns: Array of agreement objects { point, agents: [...] }

identifyDisagreements(responses);
// Finds conflicting viewpoints
// Returns: Array of disagreement objects { topic, positions: [...] }
```

**Implementation Details**:

- **Key Point Extraction**: Sentence-level parsing, filters filler words
- **Agreement Detection**: Similarity matching (fuzzy string comparison)
- **Disagreement Detection**: Conflict keywords (but, however, disagree, instead)
- **Scoring**: Weighted by agent expertise (security: 1.5x, architect: 1.5x, developer: 1.0x)

**Example**:

```javascript
Responses: Developer: 'Use REST API for simplicity';
Architect: 'REST is good but consider GraphQL for flexibility';

Aggregation: Agreements: ['REST is viable option'];
Disagreements: [{ topic: 'API choice', positions: ['REST (simple)', 'GraphQL (flexible)'] }];
```

**Performance**:

- Aggregate responses: <20ms (4 agents)
- Extract key points: <5ms per response
- Identify agreements: <10ms (pairwise comparison)

**Test Coverage**: 8 tests

- Key point extraction
- Agreement identification
- Disagreement identification
- Empty response handling

---

### Consensus Builder

**File**: `.claude/lib/party-mode/consensus/consensus-builder.cjs`

**Functions** (4):

```javascript
buildConsensus(agreements, disagreements, weights);
// Applies weighted voting to reach consensus
// Returns: { consensusLevel, strongAgreements: [...], weakAgreements: [...], unresolved: [...] }

calculateConsensusScore(agreement, weights);
// Weighted voting: sum(agentWeight) / sum(allWeights)
// Returns: score 0.0-1.0

classifyConsensus(score);
// Strong: 0.8+, Weak: 0.6-0.79, None: <0.6
// Returns: 'strong' | 'weak' | 'none'

formatConsensusReport(consensus);
// Generates human-readable consensus summary
// Returns: formatted string
```

**Weighted Voting**:

- **Security Agent**: 1.5x weight on security topics
- **Architect**: 1.5x weight on design topics
- **Developer**: 1.0x weight (baseline)
- **QA**: 1.0x weight

**Example**:

```javascript
Agreement: "Use JWT for authentication"
Agents: [developer, security-architect]
Weights: [1.0, 1.5]
Score: (1.0 + 1.5) / (1.0 + 1.5 + 0 + 0) = 2.5 / 2.5 = 1.0
Consensus: STRONG (100%)

Agreement: "Consider microservices"
Agents: [developer]
Weights: [1.0]
Score: 1.0 / (1.0 + 1.5 + 1.0) = 1.0 / 3.5 = 0.29
Consensus: NONE (29%)
```

**Performance**:

- Build consensus: <10ms (scoring all agreements)
- Calculate score: <1ms (arithmetic)
- Format report: <5ms (string formatting)

**Test Coverage**: 7 tests

- Weighted voting
- Consensus classification
- Multi-agent scenarios
- Edge cases (unanimous, split, single agent)

---

### Context Threader

**File**: `.claude/lib/party-mode/consensus/context-threader.cjs`

**Functions** (3):

```javascript
threadContext(previousResponses, newUserMessage);
// Appends new user message to context thread
// Returns: updated context with full history

buildAgentPrompt(agent, context);
// Builds agent-specific prompt with context thread
// Returns: formatted prompt string

formatPreviousResponses(responses);
// Formats: **[Icon] [Name]:** content
// Returns: formatted string for agent prompt
```

**Context Threading**:

- Maintains conversation history across rounds
- Each agent sees:
  - Original user message
  - All previous agent responses (formatted)
  - New user message
- Agents can reference and challenge each other

**Example**:

```
Round 1:
  User: "Should we use microservices?"
  Developer: "Monolith for 4-person team"
  Architect: "Agree, start simple"

Round 2:
  User: "What if we scale to 20 engineers?"
  Context includes:
    - Round 1 user message
    - Round 1 responses (Developer, Architect)
    - Round 2 user message
  Developer: "At 20 engineers, microservices make sense. Extract services by domain."
```

**Performance**:

- Thread context: <5ms (append operation)
- Build prompt: <10ms (string formatting)
- Format responses: <5ms (4 responses)

**Test Coverage**: 6 tests

- Context threading (multi-round)
- Prompt building
- Response formatting
- Empty context handling

---

### Coordination Controller

**File**: `.claude/lib/party-mode/consensus/coordination-controller.cjs`

**Functions** (5):

```javascript
coordinateRound(session, round, team, context);
// Master coordination function for single round
// Returns: { responses, consensus, duration }

selectAgents(team, message, history);
// Classifies message, selects 2-4 relevant agents
// Returns: Array of selected agents (prioritized)

classifyMessage(message);
// Pattern matching for topic detection
// Returns: topic ('architecture', 'security', 'testing', etc.)

buildConsensusReport(consensus);
// Generates structured consensus summary
// Returns: { strongPoints, weakPoints, unresolved, recommendation }

shouldContinue(consensus, roundCount);
// Decides if more rounds needed
// Returns: { continue: boolean, reason: string }
```

**Message Classification Patterns**:

```javascript
'architecture' → [architect, developer, security-architect]
'security' → [security-architect, architect, devops]
'testing' → [qa, developer, security-architect]
'performance' → [architect, devops, developer]
'design' → [ux-designer, pm, developer]
'database' → [database-architect, architect, developer]
```

**Agent Selection Algorithm**:

1. Classify message by topic
2. Retrieve agents relevant to topic
3. Sort by priority (1=highest)
4. Limit to 4 agents (SEC-PM-005)
5. Return selected agents

**Performance**:

- Coordinate round: <90s (full round)
- Select agents: <2s (classification + sorting)
- Classify message: <100ms (pattern matching)
- Build report: <10ms (string formatting)

**Test Coverage**: 9 tests

- Round coordination (full workflow)
- Agent selection (all topics)
- Message classification
- Consensus reporting
- Continuation decision

---

## Design Decisions (ADRs)

### ADR-054: Party Mode Orchestration Protocol

**Date**: 2026-01-28
**Status**: Accepted

**Context**: Need standardized protocol for multi-agent collaboration with security controls

**Decision**: CSV-based team definitions, orchestrator-driven coordination, 6 CRITICAL security controls

**Consequences**:

- Team definitions are human-readable and version-controllable (CSV in git)
- Orchestrator has full visibility and control over coordination
- Security controls prevent cross-agent contamination
- Performance targets: <100ms agent spawn, <5ms message routing, <90s full round

---

### ADR-055: Agent Identity Verification System

**Date**: 2026-01-28
**Status**: Accepted

**Context**: Prevent agent impersonation attacks in multi-agent sessions

**Decision**: Hash-based identity verification (SHA-256 of agentPath + content)

**Consequences**:

- Agent identity cannot be forged (collision-resistant)
- Identity changes if agent file modified (content-based hash)
- Verification adds <1ms overhead per response
- Response rejection if identity mismatch detected

---

### ADR-056: Context Isolation Boundaries

**Date**: 2026-01-28
**Status**: Accepted

**Context**: Prevent cross-agent context leakage and information disclosure attacks

**Decision**: Deep clone context, strip orchestrator metadata, sanitize previous responses

**Consequences**:

- Copy-on-spawn prevents shared reference contamination
- Orchestrator state hidden from agents (no access to coordination logic)
- Internal data (rawThinking, toolCalls) excluded from agent view
- Context isolation adds <10ms overhead per agent spawn

---

### ADR-057: Consensus Mechanism

**Date**: 2026-01-28
**Status**: Accepted

**Context**: Need structured agreement-building with weighted voting based on expertise

**Decision**: Weighted voting with domain-specific weights (security: 1.5x, architect: 1.5x, developer: 1.0x)

**Consequences**:

- Domain experts have higher influence on relevant decisions
- Consensus classified as Strong (80%+), Weak (60-79%), None (<60%)
- Multi-round refinement continues until Strong consensus or round limit
- Weighted voting adds <10ms overhead per consensus calculation

---

## Performance Characteristics

### Benchmarks

Measured on Phase 1-4 unit tests (123 tests passing):

| Operation                         | Target | Measured | Status |
| --------------------------------- | ------ | -------- | ------ |
| Agent ID generation               | <1ms   | <1ms     | ✅ MET |
| Agent ID verification             | <1ms   | <1ms     | ✅ MET |
| Response hash chain append        | <2ms   | <2ms     | ✅ MET |
| Chain verification (10 responses) | <10ms  | <10ms    | ✅ MET |
| Audit log write                   | <2ms   | <2ms     | ✅ MET |
| Audit log retrieval (100 entries) | <50ms  | <50ms    | ✅ MET |
| Message routing                   | <5ms   | <1ms     | ✅ MET |
| Context isolation                 | <10ms  | <2ms     | ✅ MET |
| Sidecar creation                  | <50ms  | <15ms    | ✅ MET |
| Sidecar read                      | <10ms  | <7ms     | ✅ MET |
| Sidecar write                     | <10ms  | <4ms     | ✅ MET |
| Team loading                      | <50ms  | <10ms    | ✅ MET |
| Agent spawn                       | <100ms | <20ms    | ✅ MET |
| Round start                       | <20ms  | <1ms     | ✅ MET |
| Response aggregation              | <20ms  | ~5ms     | ✅ MET |
| Consensus building                | <10ms  | <10ms    | ✅ MET |

**Overall Performance**:

- All Phase 1-4 operations meet or exceed performance targets
- Context isolation is 5x faster than target (2ms vs 10ms)
- Agent spawn is 5x faster than target (20ms vs 100ms)
- Full round duration not yet measured (Phase 5 integration tests pending)

### Scalability Considerations

**Agent Count Scaling**:

- **2 agents**: <30s full round
- **3 agents**: <60s full round
- **4 agents**: <90s full round (target)
- **Hard limit**: 4 agents per round (SEC-PM-005)

**Round Count Scaling**:

- Context size grows linearly with rounds
- Context warning at 100k tokens (~75% of limit)
- Context hard limit at 150k tokens
- **Hard limit**: 10 rounds per session (SEC-PM-005)

**Session Count Scaling**:

- Audit log grows linearly with sessions (append-only JSONL)
- Log rotation recommended after 10k sessions (~100MB)
- Sidecar cleanup after each session (no accumulation)

---

**Party Mode Architecture Version**: 1.0.0
**Last Updated**: 2026-01-28
**Architecture Status**: Complete (Phases 1-4 implemented, Phase 5 integration pending)
