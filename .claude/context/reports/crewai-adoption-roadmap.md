# CrewAI Best Practices Adoption Roadmap

**Plan ID**: `plan-crewai-adoption-2026-01-12`
**Status**: Validated
**Total Duration**: 5 weeks
**Created**: 2026-01-12

---

## Executive Summary

This roadmap outlines the adoption of CrewAI best practices into our Claude Code subagent system. Based on analysis of the CrewAI framework, we have identified key patterns in memory architecture, entity extraction, and cross-agent coordination that can enhance our existing Phase 2 memory system.

**Key Improvements Targeted**:
1. **Entity Memory**: Structured knowledge graph for entities and relationships
2. **Hierarchical Memory Tiers**: Short-term and long-term memory with promotion logic
3. **Enhanced Context Injection**: Relevance scoring and task-aware memory selection
4. **Cross-Agent Memory Sharing**: Workflow-scoped memory with access control

---

## Current State Analysis

### Existing System Strengths

Our Phase 2 memory system provides a solid foundation:

| Component | Description | Status |
|-----------|-------------|--------|
| `database.mjs` | SQLite with FTS5 full-text search | Production |
| `vector-store.mjs` | HNSW-based similarity search | Production |
| `semantic-memory.mjs` | Semantic search coordination | Production |
| `pattern-learner.mjs` | Pattern tracking with confidence | Production |
| `preference-tracker.mjs` | User preference learning | Production |
| `overflow-handler.mjs` | Context compaction | Production |

**Test Coverage**: 157 tests passed
**Performance**: 17/17 targets met

### Gaps Identified from CrewAI Analysis

| Gap | CrewAI Pattern | Impact |
|-----|----------------|--------|
| No entity memory | Dedicated entity extraction and storage | Medium |
| Flat memory structure | Hierarchical tiers (short/long-term) | Medium |
| Basic relevance scoring | Multi-factor relevance with decay | High |
| No cross-agent sharing | Workflow-scoped shared memory | Medium |
| No memory kickoff | Session initialization service | Low |

---

## Implementation Phases

### Phase 1: Entity Memory and Knowledge Graph (1.5 weeks)

**Objective**: Implement entity extraction and relationship mapping for structured memory.

```
Week 1-2 (Days 1-10)
├── Day 1-2: Entity Extraction Service
│   └── Create entity-extractor.mjs
│       - Named entity recognition (people, orgs, tools)
│       - Entity type classification
│       - Confidence scoring
├── Day 3: Entity Storage Schema
│   └── Add entities and entity_relations tables
│       - migrations/002-entity-schema.sql
│       - Update database.mjs
├── Day 4-6: Entity Memory Manager
│   └── Create entity-memory.mjs
│       - CRUD operations for entities
│       - Relationship tracking
│       - Entity-based retrieval
└── Day 7-8: Testing
    └── entity-memory.test.mjs
        - Extraction accuracy tests
        - Storage/retrieval tests
        - Relationship mapping tests
```

**Success Criteria**:
- Entity extraction identifies 90%+ of named entities
- Entity relationships correctly mapped
- Entity retrieval latency <50ms
- 15+ tests passing

**Files Created**:
- `.claude/tools/memory/entity-extractor.mjs`
- `.claude/tools/memory/entity-memory.mjs`
- `.claude/tools/memory/entity-memory.test.mjs`
- `.claude/tools/memory/migrations/002-entity-schema.sql`

**Files Modified**:
- `.claude/tools/memory/database.mjs`

---

### Phase 2: Hierarchical Memory Tiers (1 week)

**Objective**: Implement short-term and long-term memory with promotion logic.

```
Week 2 (Days 8-14) - Can run parallel with Phase 1
├── Day 8-9: Short-Term Memory
│   └── Create short-term-memory.mjs
│       - Per-conversation context
│       - Importance scoring
│       - Automatic expiration
├── Day 10-11: Long-Term Memory Enhancement
│   └── Enhance semantic-memory.mjs
│       - Decay scoring
│       - Access pattern tracking
│       - Importance updates
├── Day 12-13: Memory Tier Manager
│   └── Create memory-tier-manager.mjs
│       - Promotion logic (short → long)
│       - Demotion logic (importance decay)
│       - Threshold configuration
└── Day 14: Integration
    └── Update overflow-handler.mjs
        - Tier-aware compaction
        - Priority preservation
```

**Success Criteria**:
- Short-term memory captures conversation context
- Long-term memory persists important insights
- Promotion logic correctly identifies high-value memories
- Integration with overflow handler prevents context bloat

**Files Created**:
- `.claude/tools/memory/short-term-memory.mjs`
- `.claude/tools/memory/memory-tier-manager.mjs`

**Files Modified**:
- `.claude/tools/memory/semantic-memory.mjs`
- `.claude/tools/memory/overflow-handler.mjs`

---

### Phase 3: Enhanced Context Injection (1 week)

**Objective**: Improve memory injection with relevance scoring and task awareness.

```
Week 3 (Days 15-21)
├── Day 15-17: Relevance Scoring Engine
│   └── Create relevance-scorer.mjs
│       - Semantic similarity (vector match)
│       - Recency scoring (time decay)
│       - Importance weighting
│       - Entity match bonus
│       - Combined score calculation
├── Day 18-19: Task-Aware Selection
│   └── Create task-aware-selector.mjs
│       - Agent role consideration
│       - Task type classification
│       - Context budget management
├── Day 20: Memory Kickoff Service
│   └── Create kickoff-service.mjs
│       - Session initialization
│       - User preference loading
│       - Recent context retrieval
└── Day 21: Hook Enhancement
    └── Update memory-injection-pre-tool.mjs
        - Use new relevance scoring
        - Apply task-aware selection
        - Integrate kickoff service
```

**Success Criteria**:
- Relevance scoring improves retrieval precision by 20%+
- Task-aware selection reduces irrelevant memory injection
- Kickoff service initializes context in <500ms
- Injection latency remains <200ms

**Files Created**:
- `.claude/tools/memory/relevance-scorer.mjs`
- `.claude/tools/memory/task-aware-selector.mjs`
- `.claude/tools/memory/kickoff-service.mjs`

**Files Modified**:
- `.claude/hooks/memory-injection-pre-tool.mjs`

---

### Phase 4: Cross-Agent Memory Sharing (1 week)

**Objective**: Enable memory sharing between agents within workflows.

```
Week 4 (Days 22-28)
├── Day 22-24: Workflow Memory Context
│   └── Create workflow-memory.mjs
│       - Workflow-scoped memory
│       - Agent contribution tracking
│       - Shared context accumulation
├── Day 25-26: Agent Memory Views
│   └── Create agent-memory-view.mjs
│       - Role-based filtering
│       - Relevance to agent role
│       - Permission-based access
├── Day 27: Access Control
│   └── Create memory-access-control.mjs
│       - Read-only mode
│       - Read-write mode
│       - Isolated mode (default)
└── Day 28: Orchestrator Integration
    └── Update orchestrator-entry.mjs
        - Initialize workflow memory
        - Propagate to subagents
        - Collect agent contributions
```

**Success Criteria**:
- Agents can share context within workflow runs
- Agent-specific views filter irrelevant memories
- Access control prevents unauthorized memory access
- No performance regression in orchestrator

**Files Created**:
- `.claude/tools/memory/workflow-memory.mjs`
- `.claude/tools/memory/agent-memory-view.mjs`
- `.claude/tools/memory/memory-access-control.mjs`

**Files Modified**:
- `.claude/tools/orchestrator-entry.mjs`

---

### Phase 5: Integration and Validation (0.5 weeks)

**Objective**: Validate all components work together with no regressions.

```
Week 5 (Days 29-32)
├── Day 29-30: Integration Testing
│   └── Create crewai-integration.test.mjs
│       - End-to-end workflow tests
│       - Cross-component integration
│       - Memory flow validation
├── Day 31: Performance Benchmarks
│   └── Create crewai-adoption-performance.md
│       - Latency measurements
│       - Memory usage
│       - Throughput testing
├── Day 31: Documentation
│   └── Update documentation
│       - README.md updates
│       - MEMORY_PATTERNS.md updates
│       - New component docs
└── Day 32: Backward Compatibility
    └── Create backward-compat.test.mjs
        - Existing API contract verification
        - Run all 157 existing tests
        - Regression detection
```

**Success Criteria**:
- All integration tests pass (30+ new tests)
- Performance targets met (injection <200ms, search <500ms)
- Documentation updated and reviewed
- Backward compatibility verified (157 existing tests pass)

---

## Dependencies Graph

```
Phase 1: Entity Memory ─────────────────────────────────────┐
        (Week 1-2)                                          │
                                                            ├──→ Phase 5: Integration
Phase 2: Hierarchical Memory ───────────────────────────────┤    (Week 5)
        (Week 2) [parallel with Phase 1]                    │
                                                            │
                            ┌───────────────────────────────┘
                            │
Phase 3: Context Injection ─┘
        (Week 3)
        Depends on: Phase 1

Phase 4: Cross-Agent Sharing
        (Week 4)
        Depends on: Phase 2
                            │
                            └───────────────────────────────→ Phase 5
```

**Parallel Execution**:
- Phases 1 and 2 can run in parallel (different components)
- Phase 3 depends on Phase 1 (entity-based relevance scoring)
- Phase 4 depends on Phase 2 (tier-aware sharing)
- Phase 5 depends on all previous phases

---

## Risk Assessment

### High Priority Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Cross-agent memory leaks sensitive context | High | Low | Default to isolated mode, require explicit sharing |
| Performance regression | High | Low | Pre-compute scores, use caching, lazy loading |

### Medium Priority Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Entity extraction accuracy | Medium | Medium | Hybrid approach: regex + LLM-based extraction |
| Memory promotion too aggressive/conservative | Medium | Medium | Configurable thresholds with sensible defaults |
| Integration issues require rework | Medium | Medium | Run integration tests continuously |

### Low Priority Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Database schema migration issues | Medium | High | Use existing migration system |

---

## Success Metrics

### Quantitative Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Entity extraction accuracy | 90%+ | Manual review of sample set |
| Memory retrieval precision | +20% improvement | A/B comparison |
| Context injection latency | <200ms | Performance benchmarks |
| Test coverage | 200+ tests | Test runner output |
| Backward compatibility | 100% | All 157 existing tests pass |

### Qualitative Targets

- Documentation coverage complete
- No breaking API changes
- Clean code review feedback
- Security review passed

---

## Resource Requirements

### Agent Allocation

| Agent | Allocation | Tasks |
|-------|------------|-------|
| developer | 60% | Primary implementation of all components |
| qa | 20% | Testing, integration, backward compatibility |
| database-architect | 5% | Schema design (Phase 1) |
| security-architect | 5% | Access control (Phase 4) |
| technical-writer | 5% | Documentation (Phase 5) |
| performance-engineer | 5% | Benchmarking (Phase 5) |

### Skills Required

- `repo-rag` - Codebase analysis for existing patterns
- `plan-generator` - Detailed phase planning
- `code-style-validator` - Code quality assurance

### External Dependencies

- SQLite (existing)
- hnswlib-node (existing)
- Node.js test runner (existing)

---

## Backward Compatibility Strategy

### Preserved APIs (No Changes)

```javascript
// All existing APIs will continue to work unchanged
createMemoryDatabase()
SemanticMemoryService
PatternLearner
VectorStore
// Memory hooks interface
```

### New APIs (Additive Only)

```javascript
// New APIs are additive, optional to adopt
EntityMemory
ShortTermMemory
MemoryTierManager
RelevanceScorer
WorkflowMemory
```

### Validation Strategy

1. Run all 157 existing tests after each phase
2. Create explicit backward compatibility test suite
3. Document any deprecations (none expected)

---

## Rollback Procedure

If issues are discovered after deployment:

1. **Phase-Level Rollback**: Each phase can be disabled independently
2. **Feature Flags**: New components use feature flags for gradual rollout
3. **Database Rollback**: Migration system supports rollback
4. **Code Rollback**: Git-based rollback of specific files

---

## Next Steps

1. **Review and Approve Plan**: Get stakeholder approval
2. **Create Feature Branch**: `feature/crewai-adoption`
3. **Begin Phase 1**: Entity Memory implementation
4. **Begin Phase 2 (parallel)**: Hierarchical Memory implementation
5. **Daily Progress Updates**: Track in TODO list

---

## Related Documentation

- **Plan JSON**: `.claude/context/artifacts/crewai-adoption-plan.json`
- **Memory System**: `.claude/tools/memory/README.md`
- **Phase 2 Report**: `.claude/context/reports/phase-2-memory-system-completion-report.md`
- **Memory Patterns**: `.claude/docs/MEMORY_PATTERNS.md`
- **Everlasting Agents**: `.claude/docs/EVERLASTING_AGENTS.md`

---

**Report Generated**: 2026-01-12
**Plan Duration**: 5 weeks
**Total Tasks**: 20 tasks across 5 phases
**Estimated New Tests**: 43+
**Status**: Ready for implementation
