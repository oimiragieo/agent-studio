### Workflow Guide

Use these flows to route the right agents and artifacts.

- **Quick Flow**: Bugfix/hotfix/small change. Agents: developer → qa. Outputs: dev change + basic validation.
- **Full Stack Flow**: New features/greenfield. Agents: analyst → pm → ux → architect → developer → qa. Outputs: brief/PRD/UX/arch/test plan.
- **Code Quality Flow**: Code health/review/refactor. Agents: code-reviewer → refactoring-specialist → compliance-auditor → qa.
- **Performance Flow**: Perf tuning/SLI/SLO. Agents: performance-engineer → architect → developer → qa.
- **AI System Flow**: LLM/AI features. Agents: model-orchestrator → llm-architect → api-designer → developer → qa.
- **Mobile Flow**: Mobile feature work. Agents: mobile-developer → ux-expert → developer → qa.
- **Incident Flow**: Reliability/incident response. Agents: incident-responder → devops → security-architect → qa.

Templates:
- `templates/code-review-report.md`
- `templates/refactor-plan.md`
- `templates/performance-plan.md`
- `templates/llm-architecture.md`
- `templates/incident-report.md`
