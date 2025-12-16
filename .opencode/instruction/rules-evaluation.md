# Rules Folder Evaluation

## Decision: Not Replicated

The `.claude/rules/` folder (199+ files) was evaluated and **not replicated** to `.opencode/` for the following reasons:

### 1. Cursor IDE Specific
The rules are `.cursorrules` files designed specifically for Cursor IDE integration. These include framework-specific coding standards and conventions that are tightly coupled to Cursor's rule system.

### 2. Framework Variety
The rules cover 20+ different tech stacks:
- Next.js 14/15 with Tailwind
- Laravel PHP
- Chrome Extension Development
- Astro TypeScript
- Convex
- Phoenix/Elixir
- WordPress/Gutenberg
- And many more...

### 3. Alternative Approach
Instead of replicating these rules, we recommend:

1. **Use OpenCode's native instruction system** via `.opencode/instruction/` for project-specific guidelines
2. **Create tech-stack specific instructions** when needed for a project
3. **Reference the `.claude/rules/` folder** if legacy rules are needed

### 4. Available Rule Categories

If rules are needed, they can be adapted from:

| Category | Examples |
|----------|----------|
| Code Style | `clean-code.mdc`, `codequality.mdc` |
| Git/Commits | `git-conventional-commit-messages/` |
| Documentation | `how-to-documentation-cursorrules-prompt-file/` |
| Testing | `cypress-accessibility-testing-cursorrules-prompt-file/` |
| Frontend | Next.js, Astro, Tailwind rules |
| Backend | Laravel, Phoenix, WordPress rules |
| Systems | Chrome extensions, C++ guidelines |

### 5. Future Consideration

If OpenCode adopts a rules system similar to Cursor, these can be migrated. For now, the instruction-based approach in `.opencode/instruction/` provides equivalent functionality with better OpenCode integration.

---

*Evaluated: Session continuation*
*Status: Not replicated - use instruction system instead*
