# Project Analyzer Skill

Automated brownfield codebase analysis for rapid project onboarding and understanding.

## Quick Start

### Programmatic Usage

```bash
# Analyze current directory
node .claude/skills/project-analyzer/analyzer.mjs

# Analyze specific project
node .claude/skills/project-analyzer/analyzer.mjs /path/to/project

# Save output to file
node .claude/skills/project-analyzer/analyzer.mjs /path/to/project --output analysis.json
```

### Agent Invocation

```
Analyze this project
```

## What It Detects

### Project Types

- **Frontend**: React, Vue, Angular apps
- **Backend**: Express, FastAPI, Django APIs
- **Fullstack**: Next.js, Remix, SvelteKit
- **Library**: Reusable packages
- **CLI**: Command-line tools
- **Mobile**: React Native, Flutter
- **Monorepo**: Multi-package repositories
- **Microservices**: Service-based architecture
- **Serverless**: Lambda/Cloud Functions

### Frameworks (20+)

- **Frontend**: React, Next.js, Vue, Angular, Svelte
- **Backend**: Express, Fastify, FastAPI, Django, Flask
- **Testing**: Jest, Vitest, Cypress, Playwright
- **Build**: Vite, Webpack, esbuild, Rollup
- **Database**: Prisma, TypeORM, Mongoose

### Package Managers

- **Node.js**: npm, yarn, pnpm
- **Python**: pip, Poetry
- **Go**: go modules
- **Rust**: Cargo
- **Java**: Maven, Gradle

## Output

The analyzer generates a comprehensive project profile:

```json
{
  "analysis_id": "analysis-123",
  "project_type": "fullstack",
  "analyzed_at": "2025-01-15T10:00:00Z",
  "stats": {
    "total_files": 523,
    "total_lines": 45230,
    "languages": { "TypeScript": 32100, "JavaScript": 8500 }
  },
  "frameworks": [
    { "name": "nextjs", "version": "14.0.0", "category": "framework" }
  ],
  "structure": {
    "architecture_pattern": "modular",
    "module_system": "esm"
  },
  "code_quality": {
    "linting": { "configured": true, "tool": "eslint" },
    "testing": { "framework": "vitest", "test_files": 89 }
  },
  "tech_debt": {
    "score": 25,
    "indicators": [...]
  },
  "recommendations": [...]
}
```

## Performance

- **Target**: < 30 seconds for typical projects (< 10k files)
- **Optimization**: Excludes node_modules, .git, dist, build directories
- **Memory**: Streams file processing for efficiency

## Testing

```bash
# Run test suite
node .claude/skills/project-analyzer/tests/analyzer.test.mjs
```

## Integration

### With Conductor

Provides automated project discovery for brownfield onboarding.

### With Rule-Selector

Auto-selects rules based on detected frameworks.

### With Repo-RAG

Enhances semantic search with architectural context.

### With Dependency-Analyzer

Feeds initial dependency data for deep analysis.

## Schema

Output conforms to `.claude/schemas/project-analysis.schema.json`

## Version

**1.0.0** - Initial release

## License

Part of LLM Rules Production Pack
