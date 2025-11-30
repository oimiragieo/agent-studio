### Workflow Guide

Use these flows to route the right agents and artifacts.

- **Quick Flow**: Bugfix/hotfix/small change. Agents: developer → qa. Outputs: dev change + basic validation.
- **Full Stack Flow**: New features/greenfield. Agents: analyst → pm → ux → architect → developer → qa. Outputs: brief/PRD/UX/arch/test plan.
- **Code Quality Flow**: Code health/review/refactor. Agents: code-reviewer → refactoring-specialist → compliance-auditor → qa. Templates: `templates/code-review-report.md`, `templates/refactor-plan.md`.
- **Performance Flow**: Perf tuning/SLI/SLO. Agents: performance-engineer → architect → developer → qa. Templates: `templates/performance-plan.md`.
- **AI System Flow**: LLM/AI features. Agents: model-orchestrator → llm-architect → api-designer → developer → qa. Templates: `templates/llm-architecture.md`.
- **Mobile Flow**: Mobile feature work. Agents: mobile-developer → ux-expert → developer → qa. Templates: reuse UI + platform-specific checklists.
- **Incident Flow**: Reliability/incident response. Agents: incident-responder → devops → security-architect → qa. Templates: `templates/incident-report.md`.

Validation:
- Use `workflow_runner.js` to validate a step against its schema/gate:  
  `node .claude/tools/workflow_runner.js --workflow .claude/workflows/<flow>.yaml --step <n>`
- Optional: `pnpm validate` for config, `pnpm validate:sync` for agent/skill parity.
