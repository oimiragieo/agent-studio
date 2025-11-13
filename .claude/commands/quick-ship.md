# Quick Ship Command

Trigger quick-flow workflow for rapid bug fixes and small features.

## Usage

```
/quick-ship
```

Or provide details inline:

```
/quick-ship Fix the login button alignment issue
```

## What It Does

1. Analyzes the request for quick-flow suitability
2. Routes directly to Developer agent (skips planning agents)
3. Implements the fix/feature
4. Runs QA validation
5. Provides implementation summary

## Best For

- Bug fixes
- Hotfixes
- Small UI tweaks
- Documentation updates
- Minor refactors
- Code cleanup

## Not Suitable For

- New features requiring architecture
- Security-critical changes
- Database migrations
- API changes
- Major refactors

For complex work, use standard workflows instead.

## Example

```
User: /quick-ship Fix the typo in the header component
Claude: [Invokes quick-flow workflow]
  → Developer: Fixes typo in Header.tsx
  → QA: Validates change, runs tests
  → Result: Fix complete, tests passing
```
