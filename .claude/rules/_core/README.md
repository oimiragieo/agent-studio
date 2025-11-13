# Core Universal Rules

This directory contains **universal coding standards** that apply across all technology stacks.

## Organization

```
_core/
├── README.md                 # This file
├── code-quality.md          # Universal code quality standards
├── security.md              # Security best practices
├── testing.md               # Testing standards
└── documentation.md         # Documentation guidelines
```

## Usage in CLAUDE.md

Import core rules selectively:

```markdown
# Project CLAUDE.md

## Core Standards
@import .claude/rules/_core/code-quality.md
@import .claude/rules/_core/security.md
@import .claude/rules/_core/testing.md
```

## Technology-Specific Rules

For framework-specific guidelines, see:
- `.claude/rules/nextjs-*/` - Next.js specific
- `.claude/rules/python-*/` - Python specific
- `.claude/rules/react-*/` - React specific

## Rule Precedence

1. **Core Rules** (this directory) - Universal standards
2. **Tech Rules** (parent directory) - Framework-specific
3. **Project CLAUDE.md** - Project overrides

Specific rules override general rules.
