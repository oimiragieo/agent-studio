# Skill Integration Test Suite - Phase 2 Validation

Comprehensive integration test script that validates the entire Phase 2 skill automation system.

## Overview

This test suite validates **5 major components** of the Phase 2 skill automation pipeline:

1. **Skill Injector** (`.claude/tools/skill-injector.mjs`)
2. **Skill Context Optimizer** (`.claude/tools/skill-context-optimizer.mjs`)
3. **Executable Skills** (scaffolder, rule-auditor, repo-rag, test-generator, diagram-generator)
4. **Schema Validation** (JSON Schema validation for skill outputs)
5. **Hook Integration** (skill-injection-hook.js)

## Test Coverage

### 📦 Skill Injector Tests (4 tests)

| Test | Purpose |
|------|---------|
| `skill-injector-load-matrix` | Load skill-integration-matrix.json successfully |
| `skill-injector-get-skills` | Get required skills for each agent type |
| `skill-injector-detect-triggers` | Detect triggered skills from task descriptions |
| `skill-injector-generate-prompt` | Generate proper injection prompt |

### 🎯 Skill Context Optimizer Tests (5 tests)

| Test | Purpose |
|------|---------|
| `optimizer-load-summaries` | Load skill-summaries.json |
| `optimizer-minimal-level` | Optimize context at MINIMAL level (20-50 tokens/skill) |
| `optimizer-essential-level` | Optimize context at ESSENTIAL level (100-200 tokens/skill) |
| `optimizer-standard-level` | Optimize context at STANDARD level (300-500 tokens/skill) |
| `optimizer-full-level` | Optimize context at FULL level (800-1500 tokens/skill) |

### ⚙️ Executable Skill Tests (5 tests)

| Test | Purpose |
|------|---------|
| `skill-scaffolder-exists` | Verify scaffolder executable exists and is importable |
| `skill-rule-auditor-exists` | Verify rule-auditor executable exists |
| `skill-repo-rag-exists` | Verify repo-rag executable exists |
| `skill-test-generator-exists` | Verify test-generator executable exists |
| `skill-diagram-generator-exists` | Verify diagram-generator executable exists |

### 📋 Schema Validation Tests (2 tests)

| Test | Purpose |
|------|---------|
| `schema-validation-scaffolder` | Validate scaffolder output against schema |
| `schema-validation-rule-auditor` | Validate rule-auditor output against schema |

### 🪝 Hook Integration Tests (2 tests)

| Test | Purpose |
|------|---------|
| `hook-file-exists` | Verify hook file exists and is valid JavaScript |
| `hook-integration-flow` | Verify hook has correct structure (shebang, imports) |

### 🔄 End-to-End Integration Tests (2 tests)

| Test | Purpose |
|------|---------|
| `e2e-injection-with-optimizer` | Test full pipeline: injection → optimization |
| `e2e-missing-skill-handling` | Test graceful handling of missing skills |

**Total: 20 tests**

## Usage

### Run All Tests

```bash
node .claude/tools/test-skill-integration.mjs
```

### Run with Verbose Output

```bash
node .claude/tools/test-skill-integration.mjs --verbose
```

### Run Only Specific Tests

```bash
# Run only optimizer tests
node .claude/tools/test-skill-integration.mjs --filter optimizer

# Run only skill injector tests
node .claude/tools/test-skill-integration.mjs --filter injector
```

### Output JSON Results

```bash
node .claude/tools/test-skill-integration.mjs --json > test-results.json
```

## Example Output

```
🧪 Skill Integration Test Suite - Phase 2 Validation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Skill Injector Tests
✓ skill-injector-load-matrix
✓ skill-injector-get-skills
✓ skill-injector-detect-triggers
✓ skill-injector-generate-prompt

🎯 Skill Context Optimizer Tests
✓ optimizer-load-summaries
✓ optimizer-minimal-level
✓ optimizer-essential-level
✓ optimizer-standard-level
✓ optimizer-full-level

⚙️ Executable Skill Tests
✓ skill-scaffolder-exists
✓ skill-rule-auditor-exists
✓ skill-repo-rag-exists
✓ skill-test-generator-exists
✓ skill-diagram-generator-exists

📋 Schema Validation Tests
✓ schema-validation-scaffolder
✓ schema-validation-rule-auditor

🪝 Hook Integration Tests
✓ hook-file-exists
✓ hook-integration-flow

🔄 End-to-End Integration Tests
✓ e2e-injection-with-optimizer
✓ e2e-missing-skill-handling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Test Summary

Total Tests:  20
✓ Passed:     20 (100%)
✗ Failed:     0
○ Skipped:    0
⏱  Duration:   138ms
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All tests passed |
| `1` | One or more tests failed |

## JSON Output Format

```json
{
  "timestamp": "2026-01-05T04:34:58.365Z",
  "total_tests": 20,
  "passed": 20,
  "failed": 0,
  "skipped": 0,
  "results": [
    {
      "test": "skill-injector-load-matrix",
      "status": "pass",
      "duration_ms": 1
    },
    {
      "test": "optimizer-essential-level",
      "status": "pass",
      "duration_ms": 15
    }
  ],
  "duration_ms": 138
}
```

## Prerequisites

Before running tests:

1. **Generate Skill Summaries** (required for optimizer tests):
   ```bash
   node .claude/tools/skill-context-optimizer.mjs --generate-summaries
   ```

2. **Ensure Dependencies Installed**:
   ```bash
   pnpm install
   ```

## Test Dependencies

- **skill-integration-matrix.json**: Maps agents to required/recommended skills
- **skill-summaries.json**: Progressive disclosure summaries for all skills
- **Schemas**: JSON schemas for skill output validation
- **Executable Skills**: `.mjs` files in `.claude/skills/*/scripts/`
- **Hook File**: `.claude/hooks/skill-injection-hook.js`

## Troubleshooting

### Error: "skill-summaries.json not found"

**Solution**: Generate summaries first:
```bash
node .claude/tools/skill-context-optimizer.mjs --generate-summaries
```

### Error: "Failed to import scaffolder"

**Solution**: Verify skill executable exists and has correct syntax:
```bash
node .claude/skills/scaffolder/scripts/scaffold.mjs --help
```

### Warning: "Token budget exceeded"

**Explanation**: Skill summaries may not be perfectly optimized yet. This is a warning, not a failure. The optimizer will automatically downgrade to a more compressed level if the budget is exceeded.

### Error: "Hook missing preToolUse function"

**Explanation**: The hook is a CLI script, not a module. It reads from stdin and writes to stdout, so it doesn't export functions.

## Integration with CI/CD

Add to your CI/CD pipeline:

```yaml
# .github/workflows/test.yml
name: Skill Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: node .claude/tools/skill-context-optimizer.mjs --generate-summaries
      - run: node .claude/tools/test-skill-integration.mjs --json > test-results.json
      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results.json
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Suite Entry Point                    │
│               test-skill-integration.mjs                     │
└───────────┬─────────────────────────────────────────────────┘
            │
            ├─► Skill Injector Tests ──────────────────────────┐
            │   ✓ Load Matrix                                  │
            │   ✓ Get Skills for Agent                         │
            │   ✓ Detect Triggers                              │
            │   ✓ Generate Prompt                              │
            │                                                   │
            ├─► Skill Context Optimizer Tests ─────────────────┤
            │   ✓ Load Summaries                               │
            │   ✓ MINIMAL Level (20-50 tokens)                 │
            │   ✓ ESSENTIAL Level (100-200 tokens)             │
            │   ✓ STANDARD Level (300-500 tokens)              │
            │   ✓ FULL Level (800-1500 tokens)                 │
            │                                                   │
            ├─► Executable Skill Tests ─────────────────────────┤
            │   ✓ scaffolder                                   │
            │   ✓ rule-auditor                                 │
            │   ✓ repo-rag                                     │
            │   ✓ test-generator                               │
            │   ✓ diagram-generator                            │
            │                                                   │
            ├─► Schema Validation Tests ────────────────────────┤
            │   ✓ scaffolder-output schema                     │
            │   ✓ rule-auditor-output schema                   │
            │                                                   │
            ├─► Hook Integration Tests ─────────────────────────┤
            │   ✓ Hook File Exists                             │
            │   ✓ Hook Structure Valid                         │
            │                                                   │
            └─► End-to-End Integration Tests ──────────────────┘
                ✓ Injection + Optimizer Pipeline
                ✓ Missing Skill Graceful Handling
```

## Related Documentation

- **Skill Injector**: `.claude/tools/skill-injector.mjs`
- **Skill Context Optimizer**: `.claude/tools/skill-context-optimizer.mjs`
- **Skill Integration Matrix**: `.claude/context/skill-integration-matrix.json`
- **Skill Summaries**: `.claude/context/skill-summaries.json`
- **Schemas**: `.claude/schemas/skill-*-output.schema.json`
- **Hook Implementation**: `.claude/hooks/skill-injection-hook.js`

## Contributing

When adding new skills:

1. Add skill to `.claude/skills/<skill-name>/`
2. Create `SKILL.md` with proper frontmatter
3. Add executable script to `scripts/<skill>.mjs`
4. Update `.claude/context/skill-integration-matrix.json` with agent mappings
5. Run `pnpm index-rules` to update rule index
6. Run `node .claude/tools/skill-context-optimizer.mjs --generate-summaries`
7. Run `node .claude/tools/test-skill-integration.mjs` to validate

## License

MIT - See LICENSE file for details
