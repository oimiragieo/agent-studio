---
description: Quick bug fix or small feature implementation
agent: developer
---

# Quick Ship: $ARGUMENTS

This command is for rapid bug fixes and small features that don't require full planning.

## Suitability Check

**Good for:**
- Bug fixes
- Hotfixes
- Small UI tweaks
- Documentation updates
- Minor refactors
- Code cleanup

**Not suitable for:**
- New features requiring architecture
- Security-critical changes
- Database migrations
- API changes
- Major refactors

## Process

1. **Understand the request**
   Analyze: $ARGUMENTS

2. **Implement the fix**
   - Make minimal, focused changes
   - Follow project coding standards
   - Use port 11435 for Ollama, 8001 for Chroma

3. **Test the change**
   !`npm test`

4. **Verify quality**
   !`cd frontend && npm run lint`

5. **Create commit**
   Stage and commit with descriptive message referencing the fix.

## Quick Reference

```bash
# Run specific test
npm test -- path/to/file.test.js

# Run linter
cd frontend && npm run lint

# Check services
npm run docker:status
```
