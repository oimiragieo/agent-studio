# Master Rules Directory

This directory contains **consolidated master rule files** that replace 100+ duplicate rule files. These files are stored outside `.claude/rules/` to prevent Claude Code from auto-loading them.

## Organization

```
rules-master/
├── README.md                      # This file
├── PROTOCOL_ENGINEERING.md        # Universal engineering standards (loads globally)
├── TECH_STACK_NEXTJS.md           # Next.js/React/TypeScript/Tailwind
├── TOOL_CYPRESS_MASTER.md         # Cypress testing rules
├── TOOL_PLAYWRIGHT_MASTER.md      # Playwright testing rules
├── LANG_PYTHON_GENERAL.md         # General Python rules
├── FRAMEWORK_FASTAPI.md           # FastAPI-specific rules
└── LANG_SOLIDITY.md               # Solidity smart contract rules
```

## Usage

**Lazy Loading**: Master rules are loaded on-demand via:
1. **Agent activation** - Configured in `.claude/config.yaml` with `context_files`
2. **@filename references** - Reference in CLAUDE.md with `@.claude/rules-master/FILENAME.md`

**Example in CLAUDE.md**:
```markdown
## Master Rules

Reference master rules with @filename for lazy loading:
- @.claude/rules-master/PROTOCOL_ENGINEERING.md
- @.claude/rules-master/TECH_STACK_NEXTJS.md
```

**Example in config.yaml**:
```yaml
developer:
  context_files:
    - .claude/rules-master/TECH_STACK_NEXTJS.md
    - .claude/rules-master/PROTOCOL_ENGINEERING.md
  context_strategy: "lazy_load"
```

## Benefits

- **No Auto-Loading**: Files outside `.claude/rules/` won't auto-load
- **Lazy Loading**: Only load when agents activate or explicitly referenced
- **Reduced Context**: Saves ~90-95k tokens by preventing auto-loading
- **On-Demand Access**: Available via @filename or agent activation
