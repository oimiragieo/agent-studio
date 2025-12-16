<command_description>
Command: /quick-ship - Trigger quick-flow workflow for rapid bug fixes and small features.
</command_description>

<instructions>
<execution_steps>

```
/quick-ship
```

Or provide details inline:

```
/quick-ship Fix the login button alignment issue
```

## What It Does

1. Analyzes the request for quick-flow suitability
2. **Planner** (Step 0): Creates focused plan for quick implementation
3. **Developer** (Step 1): Implements the fix/feature
4. **QA** (Step 2): Runs quality validation
5. Provides implementation summary

**Workflow**: This command invokes `.claude/workflows/quick-flow.yaml` which follows a plan-first approach with minimal overhead for small changes.

</execution_steps>
</instructions>

<examples>
<usage_example>
**Best For**:
- Bug fixes
- Hotfixes
- Small UI tweaks
- Documentation updates
- Minor refactors
- Code cleanup

**Not Suitable For**:
- New features requiring architecture
- Security-critical changes
- Database migrations
- API changes
- Major refactors

For complex work, use standard workflows instead.

**Example**:

```
User: /quick-ship Fix the typo in the header component
Claude: [Invokes quick-flow workflow from .claude/workflows/quick-flow.yaml]
  → Planner (Step 0): Creates focused plan
  → Developer (Step 1): Fixes typo in Header.tsx
  → QA (Step 2): Validates change, runs tests
  → Result: Fix complete, tests passing
```

**Workflow File**: `.claude/workflows/quick-flow.yaml`
</usage_example>
</examples>
