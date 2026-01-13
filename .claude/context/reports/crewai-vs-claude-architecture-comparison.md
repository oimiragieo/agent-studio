# CrewAI vs Claude Code Architecture Comparison

## Executive Summary

This report provides a comprehensive architectural comparison between CrewAI (Python-based multi-agent framework) and our Claude Code subagent system (Node.js/TypeScript). Both systems implement multi-agent orchestration patterns but with fundamentally different design philosophies and implementation approaches.

**Key Finding**: CrewAI excels at declarative agent definition and process orchestration, while our system provides stronger enforcement mechanisms, skill-based modularity, and enterprise governance. Both have strengths to learn from.

---

## 1. Architecture Overview

### 1.1 CrewAI Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CrewAI Framework                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │    Crew     │  │   Agents    │  │    Tasks    │              │
│  │ (Orchestrate)│  │(LLM-Powered)│  │(Work Units) │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Process Types                           │  │
│  │  ┌─────────┐  ┌─────────────┐  ┌──────────────────────┐   │  │
│  │  │Sequential│  │Hierarchical │  │ Consensual (Manager) │   │  │
│  │  └─────────┘  └─────────────┘  └──────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│         │                                                        │
│         ▼                                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      Tools & Memory                        │  │
│  │  ┌──────────┐  ┌────────────┐  ┌───────────────────────┐  │  │
│  │  │LangChain │  │Short-term  │  │  Long-term (RAG)      │  │  │
│  │  │  Tools   │  │  Memory    │  │  Embeddings + Vector  │  │  │
│  │  └──────────┘  └────────────┘  └───────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Claude Code Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Claude Code Subagent System                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Master Orchestrator (Entry Point)              │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  │Router Agent │  │Workflow Router│  │Task Classifier   │  │ │
│  │  │(Haiku/Fast) │  │(Semantic)     │  │(Complexity)      │  │ │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐              │
│         ▼                    ▼                    ▼              │
│  ┌────────────┐     ┌───────────────┐    ┌───────────────┐      │
│  │   Agent    │     │   Workflow    │    │   Skill       │      │
│  │Definitions │     │  Definitions  │    │  System       │      │
│  │(34 agents) │     │ (14 workflows)│    │ (108 skills)  │      │
│  └────────────┘     └───────────────┘    └───────────────┘      │
│         │                    │                    │              │
│         └────────────────────┼────────────────────┘              │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Enforcement Layer                          │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐  │ │
│  │  │Security   │  │Plan Rating│  │Orchestrator Hooks     │  │ │
│  │  │Triggers   │  │(min 7/10) │  │(PreToolUse/PostToolUse)│  │ │
│  │  └───────────┘  └───────────┘  └───────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│         │                                                        │
│         ▼                                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              State & Memory Management                      │ │
│  │  ┌──────────┐  ┌────────────┐  ┌────────────────────────┐ │ │
│  │  │Session   │  │Worker      │  │Semantic Memory         │ │ │
│  │  │State     │  │Supervisor  │  │(SQLite + Embeddings)   │ │ │
│  │  └──────────┘  └────────────┘  └────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Comparison Matrix

| Dimension | CrewAI | Claude Code | Winner |
|-----------|--------|-------------|--------|
| **Agent Definition** | Declarative Python classes with role/goal/backstory | Markdown files with structured prompts | CrewAI (cleaner API) |
| **Task Definition** | Task objects with expected_output schemas | Workflow YAML + task classifier | Tie |
| **Process Orchestration** | Sequential/Hierarchical/Consensual | Workflow-driven with gate validation | Claude Code (more gates) |
| **Inter-Agent Communication** | Delegated tasks, shared context | Task tool spawning, artifact passing | CrewAI (cleaner delegation) |
| **Memory System** | Short-term + Long-term + Entity | Dual persistence (CLAUDE.md + SQLite + Vector) | Claude Code (more robust) |
| **Tool Integration** | LangChain tools, custom tools | Skills (108), MCP servers | Claude Code (more granular) |
| **Error Handling** | Try-retry with manager review | Recovery skill, pattern learning | Claude Code (more sophisticated) |
| **Security** | Tool restrictions (optional) | 12 categories, 136 keywords, blocking gates | Claude Code (enterprise-grade) |
| **Scalability** | Process-based | Worker threads + Supervisor pattern | Claude Code (better isolation) |
| **Learning** | RAG-based long-term memory | Pattern learner + preference tracker | Tie (different approaches) |
| **Configuration** | Python decorators/classes | YAML workflows + JSON schemas + Markdown | CrewAI (simpler) |
| **Observability** | Callbacks, custom logging | Structured logging, session reports, compliance scoring | Claude Code (more comprehensive) |

---

## 3. Detailed Analysis

### 3.1 Agent Coordination Patterns

<analysis>
**CrewAI Approach**:
CrewAI uses a `Crew` class that orchestrates multiple `Agent` instances through defined `Process` types:

```python
# CrewAI Pattern
crew = Crew(
    agents=[researcher, writer, reviewer],
    tasks=[research_task, write_task, review_task],
    process=Process.hierarchical,  # or sequential, consensual
    manager_llm=ChatOpenAI(model="gpt-4")
)
result = crew.kickoff()
```

Key characteristics:
- Agents have explicit `role`, `goal`, and `backstory`
- Tasks define `expected_output` as validation
- Manager agent can delegate and review
- Built-in delegation chains

**Our Approach**:
We use a master-orchestrator that routes to specialized agents via the Task tool:

```javascript
// Our Pattern (orchestrator-entry.mjs)
const routingResult = await routeWorkflow(userPrompt);
const selectedWorkflow = routingResult.selected_workflow;
const stepResult = await executeStep0(runId, selectedWorkflow);
```

Key characteristics:
- Orchestrator spawns subagents via Task tool
- Workflow files define step sequences
- Agent router determines execution chain
- Enforcement hooks validate at each step
</analysis>

<gaps>
1. **No explicit delegation syntax**: CrewAI's `allow_delegation=True` is cleaner than our Task tool spawning
2. **No hierarchical manager pattern**: We lack a dedicated manager agent that can dynamically create/delegate tasks
3. **No consensual process**: CrewAI can have multiple agents vote/consensus; we rely on sequential signoffs
</gaps>

### 3.2 Task Delegation Mechanisms

<analysis>
**CrewAI Approach**:
Tasks are first-class objects with rich metadata:

```python
task = Task(
    description="Research the latest AI trends",
    expected_output="A detailed report with citations",
    agent=researcher,
    context=[previous_task],  # Dependency chain
    async_execution=True,
    callback=my_callback
)
```

**Our Approach**:
Tasks are classified and routed via task-classifier.mjs:

```javascript
const classification = await classifyTask(taskDescription, options);
// Returns: { complexity, taskType, primaryAgent, gates }

// Then agent-router.mjs selects chain:
const routing = await selectAgents(taskDescription, options);
// Returns: { primary, supporting, review, approval, fullChain }
```
</analysis>

<gaps>
1. **No task-level expected_output schema**: CrewAI validates outputs against schemas; we use JSON schemas at artifact level
2. **No task-level async execution**: CrewAI tasks can run async; our workers handle this differently
3. **No callback hooks per task**: CrewAI has task callbacks; we have workflow-level hooks
</gaps>

### 3.3 Inter-Agent Communication

<analysis>
**CrewAI Approach**:
Agents communicate through:
1. Task context passing (`context=[task1, task2]`)
2. Explicit delegation (`agent.delegate(task)`)
3. Shared crew memory
4. Output from previous agent as input to next

**Our Approach**:
Agents communicate through:
1. Artifact files in `.claude/context/artifacts/`
2. Reasoning files in `.claude/context/history/reasoning/`
3. Session state in SQLite database
4. CLAUDE.md files for static context
</analysis>

<gaps>
1. **No real-time context passing**: CrewAI passes context directly; we use file-based artifact passing
2. **No delegation chaining**: CrewAI agents can delegate to other agents; our orchestrator mediates all
3. **No shared scratchpad**: CrewAI has shared memory; we have separate session states
</gaps>

### 3.4 State Management

<analysis>
**CrewAI Approach**:
- Short-term memory: Conversation history within crew execution
- Long-term memory: RAG-based with embeddings
- Entity memory: Tracked entities across conversations
- Memory backends: Local, PostgreSQL, custom

**Our Approach**:
- Session state: JSON files + SQLite (session-state.mjs)
- Semantic memory: SQLite + vector embeddings (semantic-memory.mjs)
- Pattern learning: SQLite-based pattern tracker (pattern-learner.mjs)
- Dual persistence: CLAUDE.md + memory tool
</analysis>

<strengths type="ours">
1. **Dual persistence**: Both version-controlled (CLAUDE.md) and dynamic (SQLite)
2. **Pattern learning**: Our system learns from successful patterns
3. **Preference tracking**: Explicit user preference tracking
4. **Worker isolation**: Memory isolation via worker threads
</strengths>

### 3.5 Error Handling and Recovery

<analysis>
**CrewAI Approach**:
- Max retries per task
- Manager agent can reassign failed tasks
- Human input on failure (optional)
- Error callbacks for custom handling

**Our Approach**:
- Recovery skill with explicit protocol
- Context recovery via plan documents
- Gate validation with retry (max 3)
- Worker crash recovery (supervisor survives)
</analysis>

<strengths type="ours">
1. **Explicit recovery protocol**: Our recovery skill is comprehensive
2. **Plan-based recovery**: Can resume from any step
3. **Supervisor pattern**: Worker crashes don't kill orchestrator
4. **Compliance scoring**: Track recovery patterns
</strengths>

### 3.6 Tool Usage Patterns

<analysis>
**CrewAI Approach**:
- LangChain tools natively supported
- Custom tools via `@tool` decorator
- Tool restrictions per agent
- Tool-use tracking

**Our Approach**:
- 108 skills with semantic triggers
- Skill integration matrix (agent × skill mapping)
- MCP server integration
- Tool whitelist/blacklist per agent role
</analysis>

<strengths type="ours">
1. **Granular skill mapping**: 108 skills with explicit triggers
2. **Semantic skill detection**: Auto-detect needed skills from task
3. **Skill categories**: Organized by function (code_quality, documentation, etc.)
4. **Context:fork**: 80% token savings via skill forking
</strengths>

---

## 4. Areas Where CrewAI is Superior

### 4.1 Declarative Agent Definition
CrewAI's Python class-based definition is cleaner:

```python
# CrewAI - clean, Pythonic
@agent
def researcher(self) -> Agent:
    return Agent(
        config=self.agents_config['researcher'],
        tools=[search_tool, wiki_tool],
        allow_delegation=True
    )
```

vs our Markdown-based approach which requires more boilerplate.

### 4.2 Explicit Delegation Syntax
CrewAI agents can delegate directly:
```python
agent.delegate(task, coworker=other_agent, context="...")
```

We require orchestrator mediation for all delegation.

### 4.3 Process Flexibility
CrewAI's three process types (sequential, hierarchical, consensual) are built-in:
```python
process=Process.hierarchical  # Manager oversees agents
process=Process.consensual    # Agents reach consensus
```

We only have sequential workflow execution.

### 4.4 Simpler Memory API
CrewAI's memory is straightforward:
```python
crew = Crew(
    memory=True,  # Enable memory
    embedder={"provider": "openai"}
)
```

Our memory system requires multiple components (database, vector store, embedding pipeline).

---

## 5. Areas Where Our System is Superior

### 5.1 Enterprise Security
12 security categories with 136+ keywords:
- Critical/blocking classification
- Automatic security-architect injection
- Compliance auditing built-in
- Multi-layer enforcement (PreToolUse hooks)

### 5.2 Orchestrator Enforcement
4-layer enforcement system:
1. PreToolUse Hook (blocks violations)
2. Agent Self-Check (5 questions)
3. PostToolUse Audit
4. Session Compliance Report

### 5.3 Plan Rating
Mandatory plan validation:
- Min score 7/10 via response-rater
- Workflow-specific thresholds
- Plan reviewers per task type

### 5.4 Skill Integration Matrix
Comprehensive mapping:
- 34 agents × 43 core skills
- Trigger-based skill activation
- Required vs recommended skills

### 5.5 Recovery Protocol
Comprehensive recovery:
- Identify last completed step
- Load plan documents
- Context recovery from artifacts
- Resume execution

### 5.6 Worker Isolation
Supervisor-worker pattern:
- Memory-isolated worker threads
- 4GB heap per worker
- Crash recovery
- Task queue management

---

## 6. Recommendations for Improvement

### 6.1 Adopt CrewAI Patterns

#### R1: Implement Hierarchical Process Type
**Priority**: High
**Effort**: Medium

```javascript
// Proposed: HierarchicalOrchestrator
class HierarchicalOrchestrator {
  constructor(managerAgent, workerAgents) {
    this.manager = managerAgent;
    this.workers = workerAgents;
  }
  
  async execute(task) {
    // Manager creates subtasks
    const subtasks = await this.manager.planTask(task);
    
    // Manager assigns to workers
    for (const subtask of subtasks) {
      const worker = this.manager.assignWorker(subtask);
      await worker.execute(subtask);
    }
    
    // Manager reviews and synthesizes
    return await this.manager.synthesize(results);
  }
}
```

#### R2: Add Explicit Delegation Syntax
**Priority**: High
**Effort**: Low

```javascript
// Proposed: Agent delegation method
class Agent {
  async delegate(task, coworker, context = {}) {
    return await this.orchestrator.spawnSubagent({
      agentType: coworker,
      task: task.description,
      context: { ...this.context, ...context },
      delegatedFrom: this.agentType
    });
  }
}
```

#### R3: Implement Consensual Process
**Priority**: Medium
**Effort**: High

```javascript
// Proposed: ConsensusManager
class ConsensusManager {
  async getConsensus(agents, task, threshold = 0.7) {
    const votes = await Promise.all(
      agents.map(a => a.evaluate(task))
    );
    
    const agreement = this.calculateAgreement(votes);
    if (agreement >= threshold) {
      return this.synthesizeConsensus(votes);
    }
    
    // Facilitate discussion
    return await this.facilitateDiscussion(agents, votes);
  }
}
```

#### R4: Task-Level Expected Output Schemas
**Priority**: Medium
**Effort**: Low

```javascript
// Proposed: Task schema validation
const task = {
  description: "Research AI trends",
  expectedOutput: {
    schema: "research-report.schema.json",
    minLength: 500,
    requiredSections: ["summary", "findings", "recommendations"]
  }
};
```

### 6.2 Enhance Memory System

#### R5: Unified Memory API
**Priority**: High
**Effort**: Medium

```javascript
// Proposed: Unified memory facade
class UnifiedMemory {
  constructor(options) {
    this.shortTerm = new SessionMemory();
    this.longTerm = new SemanticMemory();
    this.patterns = new PatternLearner();
    this.preferences = new PreferenceTracker();
  }
  
  async remember(content, options = {}) {
    await this.shortTerm.add(content);
    if (options.persist) {
      await this.longTerm.index(content);
    }
    if (options.pattern) {
      await this.patterns.record(options.pattern);
    }
  }
  
  async recall(query, options = {}) {
    const results = await Promise.all([
      this.shortTerm.search(query),
      this.longTerm.search(query),
      this.patterns.getRelevant(query)
    ]);
    return this.rankAndMerge(results);
  }
}
```

#### R6: Entity Memory
**Priority**: Medium
**Effort**: Medium

CrewAI tracks entities across conversations. We should add:

```javascript
// Proposed: Entity tracker
class EntityMemory {
  async trackEntity(entity) {
    // Extract entity type (person, project, concept)
    // Store relationships
    // Update entity graph
  }
  
  async getEntityContext(entityName) {
    // Return all known information about entity
    // Include relationships
    // Include recent mentions
  }
}
```

### 6.3 Improve Agent Definition

#### R7: Declarative Agent Configuration
**Priority**: Medium
**Effort**: Medium

Move from Markdown to structured config:

```yaml
# agents/developer.yaml
name: developer
role: Software Developer
goal: Implement high-quality, maintainable code
backstory: |
  You are an experienced software developer with expertise
  in modern web technologies and best practices.

capabilities:
  allow_delegation: true
  max_iterations: 5
  
tools:
  required: [scaffolder, rule-auditor, repo-rag]
  recommended: [test-generator, dependency-analyzer]
  
triggers:
  keywords: [implement, code, feature, bug fix]
  patterns: [/implement\s+(new\s+)?/i]
```

### 6.4 Add Task Callbacks

#### R8: Task-Level Hooks
**Priority**: Low
**Effort**: Low

```javascript
// Proposed: Task callbacks
const task = {
  description: "Implement feature",
  onStart: async (task) => { /* pre-execution */ },
  onProgress: async (task, progress) => { /* progress updates */ },
  onComplete: async (task, result) => { /* post-execution */ },
  onError: async (task, error) => { /* error handling */ }
};
```

---

## 7. Implementation Roadmap

### Phase 1: Quick Wins (1-2 weeks)
- [ ] R4: Task-level expected output schemas
- [ ] R8: Task-level hooks/callbacks
- [ ] R2: Explicit delegation syntax

### Phase 2: Core Improvements (2-4 weeks)
- [ ] R5: Unified memory API
- [ ] R7: Declarative agent configuration
- [ ] R1: Hierarchical process type

### Phase 3: Advanced Features (4-8 weeks)
- [ ] R6: Entity memory
- [ ] R3: Consensual process
- [ ] Advanced agent networking

---

## 8. Conclusion

Both systems have significant strengths:

**CrewAI excels at**:
- Clean, declarative API
- Flexible process types
- Simpler mental model
- Python ecosystem integration

**Our system excels at**:
- Enterprise security and compliance
- Enforcement mechanisms
- Skill-based modularity
- Recovery and resilience
- Worker isolation

**Key takeaway**: We should adopt CrewAI's cleaner API patterns (hierarchical orchestration, explicit delegation, task schemas) while maintaining our superior enforcement, security, and recovery mechanisms.

---

## Appendix: File References

### Our System
- Orchestrator entry: `.claude/tools/orchestrator-entry.mjs`
- Agent router: `.claude/tools/agent-router.mjs`
- Task classifier: `.claude/tools/task-classifier.mjs`
- Session state: `.claude/tools/session-state.mjs`
- Worker supervisor: `.claude/tools/workers/supervisor.mjs`
- Semantic memory: `.claude/tools/memory/semantic-memory.mjs`
- Pattern learner: `.claude/tools/memory/pattern-learner.mjs`
- Recovery skill: `.claude/skills/recovery/SKILL.md`
- Skill integration matrix: `.claude/context/skill-integration-matrix.json`

### CrewAI (Reference)
- Crew: `src/crewai/crew.py`
- Agent: `src/crewai/agent.py`
- Task: `src/crewai/task.py`
- Process: `src/crewai/process.py`
- Memory: `src/crewai/memory/`
- Tools: `src/crewai/tools/`

---

*Report generated: 2026-01-12*
*Task ID: crewai-architecture-comparison-002*
*Assigned agent: architect*
