# Architecture Decision Records (ADR)

## Format
```
## [ADR-XXX] Title
- **Date**: YYYY-MM-DD
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Context**: Why this decision was needed
- **Decision**: What was decided
- **Consequences**: Trade-offs and implications
```

---

## [ADR-001] Router-First Protocol
- **Date**: 2026-01-23
- **Status**: Accepted
- **Context**: Need consistent request handling across all agent interactions
- **Decision**: All requests must first go through the Router Agent for classification
- **Consequences**: Adds routing overhead but ensures proper agent selection

## [ADR-002] Memory Persistence Strategy
- **Date**: 2026-01-23
- **Status**: Accepted
- **Context**: Agent context can be reset at any time; need persistent memory
- **Decision**: Use file-based memory in `.claude/context/memory/`
- **Consequences**: Agents must read/write memory files; adds I/O but ensures continuity

## [ADR-003] Serena Integration Scope
- **Date**: 2026-01-24
- **Status**: Accepted
- **Context**: Serena codebase available for integration; need to decide what to port
- **Decision**: Port workflow patterns as skills (onboarding, thinking-tools, modes, summarize-changes, session-handoff). Do NOT port Python runtime dependencies (LSP, dashboard, token counting).
- **Consequences**: Framework gains valuable workflow patterns without adding runtime dependencies. CLI-first approach maintained. Some features (dynamic tool exclusion) rely on agent self-regulation rather than enforcement.

## [ADR-004] Lazy-Load Skill Discovery
- **Date**: 2026-01-24
- **Status**: Accepted
- **Context**: CLAUDE.md Section 7 listed static skill names (python-pro, rust-pro, etc.) that became stale when actual skill names differed (e.g., python-backend-expert). 7-agent audit identified this as a Priority 1 issue.
- **Decision**: Replace static skill name lists in CLAUDE.md Section 7 with a reference to the dynamically-maintained skill catalog at `.claude/context/artifacts/skill-catalog.md`. Router and agents discover skills by reading the catalog rather than relying on hardcoded names.
- **Consequences**:
  - Skill catalog becomes single source of truth for available skills
  - Slight overhead for catalog lookup (negligible - catalog is ~500 lines)
  - skill-creator must maintain catalog (already has this requirement per Iron Law #6)
  - Router cannot assume skill names; must verify against catalog
  - Prevents stale references when skills are renamed or consolidated
