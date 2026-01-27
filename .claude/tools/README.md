# .claude/tools/ Directory Structure

This directory contains various utilities and tools organized by category.

## Directory Structure

```
.claude/tools/
├── cli/              # Command-line utilities
├── context/          # Context management tools
├── integrations/     # External service integrations
├── analysis/         # Code analysis tools
├── visualization/    # Diagram and graph tools
├── optimization/     # Performance optimization tools
├── runtime/          # Runtime utilities
└── README.md         # This file
```

## Categories

### cli/ - Command-line Utilities

Stand-alone CLI tools for validation and diagnostics.

| Tool | Description |
|------|-------------|
| `doctor.mjs` | System health diagnostics |
| `detect-orphans.mjs` | Find orphaned files/references |
| `validate-agents.mjs` | Validate agent definitions |
| `validate-commit.mjs` | Validate commit messages |
| `tool_search.mjs` | Search for tools by capability |

### context/ - Context Management

Tools for managing project context and paths.

| Tool | Description |
|------|-------------|
| `context-path-resolver.mjs` | Resolve context file paths |

### integrations/ - External Service Integrations

Connectors and adapters for external services.

| Directory | Description |
|-----------|-------------|
| `aws-cloud-ops/` | AWS cloud operations integration |
| `github/` | GitHub API integration |
| `kubernetes-flux/` | Kubernetes Flux integration |
| `mcp-converter/` | MCP server to skill converter |

### analysis/ - Code Analysis Tools

Tools for analyzing codebases and dependencies.

| Directory | Description |
|-----------|-------------|
| `project-analyzer/` | Analyze project structure and tech stack |
| `ecosystem-assessor/` | Assess ecosystem health (hooks, MCPs) |
| `find-polluter/` | Find test pollution sources |
| `repo-rag/` | Repository RAG (retrieval-augmented generation) |

### visualization/ - Diagram and Graph Tools

Tools for generating visual representations.

| Directory | Description |
|-----------|-------------|
| `diagram-generator/` | Generate architecture diagrams |
| `render-graphs/` | Render dependency graphs |

### optimization/ - Performance Tools

Tools for optimizing performance and resource usage.

| Directory | Description |
|-----------|-------------|
| `token-optimizer/` | Monitor and optimize token usage |
| `sequential-thinking/` | Step-by-step reasoning helper |

### runtime/ - Runtime Utilities

Core runtime components and coordination tools.

| Directory | Description |
|-----------|-------------|
| `skills-core/` | Core skill loading and execution |
| `swarm-coordination/` | Multi-agent swarm coordination |
| `observability/` | Runtime status and monitoring |

## Usage

Most tools can be executed directly with Node.js:

```bash
node .claude/tools/cli/doctor.mjs
node .claude/tools/cli/validate-agents.mjs
```

For integration tools, refer to individual README files within each directory.

## Adding New Tools

When adding new tools:

1. Place them in the appropriate category directory
2. Update this README with the tool description
3. Include tool-specific documentation if complex
4. Add tests alongside the tool when applicable
