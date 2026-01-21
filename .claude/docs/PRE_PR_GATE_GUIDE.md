# Pre-PR Quality Gate Guide

## Overview

The **Pre-PR Quality Gate** is a MANDATORY enforcement system that BLOCKS PR creation if code quality checks fail. This fixes a critical gap where workflows DOCUMENT quality steps but don't actually ENFORCE them.

**The Problem**: Workflows claim to run `pnpm format`, `npm run lint`, and tests, but agents can skip these checks and still create PRs with unformatted code, lint errors, or failing tests.

**The Solution**: A pre-PR gate tool that:

1. **Auto-detects** which formatter/linter/test runner is used
2. **RUNS** the checks automatically
3. **BLOCKS** PR creation if any check fails (exit code 1)
4. **Reports** what failed and how to fix it
5. Works across different codebases and tech stacks

---

## Why This Is Critical

### Before Pre-PR Gate

```
❌ PROBLEM: Claiming "ready for PR" without validation

Workflow says:
  - "Run prettier to format code"
  - "Run eslint to check linting"
  - "Run tests to ensure quality"

Reality:
  - Agent skips formatting (code has inconsistent style)
  - Agent skips linting (code has 20 lint errors)
  - Agent skips tests (3 tests are failing)
  - Agent creates PR anyway ❌

Result: PR has quality issues, wastes reviewer time
```

### After Pre-PR Gate

```
✅ SOLUTION: Enforcing quality checks before PR creation

Pre-PR Gate:
  - Auto-detects prettier is installed
  - RUNS prettier format check
  - Format check FAILS (files need formatting)
  - Gate BLOCKS with exit code 1
  - Reports: "Files need formatting: src/index.ts, src/utils.ts"
  - Agent CANNOT create PR until checks pass ✅

Result: Only quality code reaches PR stage
```

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Pre-PR Gate Execution Flow                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Tool Detection (Auto-discover what's available)        │
│     - Check package.json scripts                           │
│     - Check devDependencies                                │
│     - Check system PATH for tools                          │
│     → Detected: prettier, eslint, jest                     │
│                                                             │
│  2. Run Formatting Check                                   │
│     - Tool: prettier                                       │
│     - Command: npm run format:check                        │
│     → Result: PASS ✅                                      │
│                                                             │
│  3. Run Linting Check                                      │
│     - Tool: eslint                                         │
│     - Command: npm run lint                                │
│     → Result: FAIL ❌ (12 errors)                          │
│                                                             │
│  4. Run Validation Check                                   │
│     - Tool: custom                                         │
│     - Command: npm run validate                            │
│     → Result: SKIPPED (no validator detected)             │
│                                                             │
│  5. Run Tests                                              │
│     - Tool: jest                                           │
│     - Command: npm test                                    │
│     → Result: PASS ✅                                      │
│                                                             │
│  6. Generate Report                                        │
│     - Summary: 1 failed, 2 passed, 1 skipped               │
│     - Failed check: linting (eslint)                       │
│     - Error: "12 lint errors found"                        │
│                                                             │
│  7. Block PR Creation                                      │
│     - Exit code: 1 (BLOCKED)                               │
│     - Message: "PRE-PR GATE FAILED - Fix lint errors"      │
│     - Cannot proceed without --force                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Auto-Detection System

The gate **automatically detects** which tools are available by inspecting:

### 1. Formatter Detection

| Tool     | Detection Method                                 | Languages         |
| -------- | ------------------------------------------------ | ----------------- |
| Prettier | `package.json` scripts: `format`, `format:check` | JS, TS, JSON, CSS |
| Black    | `devDependencies.black` or system `black`        | Python            |
| Rustfmt  | System command `rustfmt`                         | Rust              |
| Gofmt    | System command `gofmt`                           | Go                |
| Biome    | `devDependencies['@biomejs/biome']`              | JS, TS            |

### 2. Linter Detection

| Tool          | Detection Method                          | Languages |
| ------------- | ----------------------------------------- | --------- |
| ESLint        | `devDependencies.eslint` + `scripts.lint` | JS, TS    |
| Pylint        | `devDependencies.pylint`                  | Python    |
| Flake8        | `devDependencies.flake8`                  | Python    |
| Clippy        | System command `cargo clippy`             | Rust      |
| golangci-lint | System command `golangci-lint`            | Go        |
| Biome         | `devDependencies['@biomejs/biome']`       | JS, TS    |

### 3. Test Runner Detection

| Tool    | Detection Method                        | Languages |
| ------- | --------------------------------------- | --------- |
| Jest    | `devDependencies.jest` + `scripts.test` | JS, TS    |
| Vitest  | `devDependencies.vitest`                | JS, TS    |
| Mocha   | `devDependencies.mocha`                 | JS, TS    |
| Ava     | `devDependencies.ava`                   | JS, TS    |
| Pytest  | `devDependencies.pytest`                | Python    |
| Cargo   | System command `cargo test`             | Rust      |
| Go Test | System command `go test`                | Go        |

### 4. Validator Detection

| Tool   | Detection Method                                    | Purpose          |
| ------ | --------------------------------------------------- | ---------------- |
| Custom | `package.json` scripts: `validate`, `validate:full` | Project-specific |

---

## Exit Codes

The pre-PR gate uses standard exit codes to communicate results:

| Exit Code | Meaning                      | Action                          |
| --------- | ---------------------------- | ------------------------------- |
| **0**     | All checks passed            | Proceed to PR creation          |
| **1**     | One or more checks failed    | BLOCKED - fix issues first      |
| **2**     | Fatal error during execution | BLOCKED - investigate gate tool |

**Workflow Integration**:

```yaml
- id: '01a-pre-pr-gate'
  agent: 'devops'
  tasks:
    - 'Run: node .claude/tools/pre-pr-gate.mjs'
  validation:
    - 'Exit code 0 (passed)'
  failure_action: 'HARD BLOCK if exit code != 0'
```

---

## Usage

### Basic Usage

```bash
# Run all checks (formatting, linting, validation, tests)
node .claude/tools/pre-pr-gate.mjs

# Example output (all passed):
🚦 Running Pre-PR Gate Checks...

📦 Detected Tools:
   Formatter:  prettier
   Linter:     eslint
   Validator:  none
   Test Runner: jest

🎨 Checking code formatting...
  ✅ Formatting check passed

🔍 Checking linting...
  ✅ Linting check passed

✓ Checking validation...
  ⚠️  No validator detected - skipping

🧪 Checking tests...
  ✅ Tests passed

✅ PRE-PR GATE PASSED - Ready for PR creation

All quality checks completed successfully:
  ✓ Formatting (prettier)
  ✓ Linting (eslint)
  ✓ Tests (jest)
```

### Verbose Mode

```bash
# Run with verbose output (shows commands being executed)
node .claude/tools/pre-pr-gate.mjs --verbose

# OR
node .claude/tools/pre-pr-gate.mjs -v
```

### Skip Tests

```bash
# Run formatting + linting only (skip tests for speed)
node .claude/tools/pre-pr-gate.mjs --skip-tests
```

### Bypass Gate (NOT RECOMMENDED)

```bash
# Force bypass failures (creates technical debt!)
node .claude/tools/pre-pr-gate.mjs --force

# Output:
⚠️  PRE-PR GATE FAILED - BYPASSED WITH --force

┌─────────────────────────────────────────────────────────┐
│  WARNING: This PR has known quality issues!            │
│  Fix before merge to avoid technical debt              │
└─────────────────────────────────────────────────────────┘
```

### JSON Output

```bash
# Get machine-readable report
node .claude/tools/pre-pr-gate.mjs --json

# Output:
{
  "passed": true,
  "timestamp": "2025-01-15T10:30:00Z",
  "summary": {
    "total": 4,
    "passed": 3,
    "failed": 0,
    "skipped": 1
  },
  "results": {
    "formatting": {
      "status": "passed",
      "errors": [],
      "tool": "prettier"
    },
    "linting": {
      "status": "passed",
      "errors": [],
      "tool": "eslint"
    },
    "validation": {
      "status": "skipped",
      "errors": [],
      "tool": null
    },
    "tests": {
      "status": "passed",
      "errors": [],
      "tool": "jest"
    }
  },
  "failedChecks": []
}
```

---

## Fixing Failures

### Formatting Failures

**Problem**:

```
❌ Formatting check failed
   Files were reformatted - commit the changes before creating PR
```

**Solution**:

```bash
# Run formatter to fix files
npm run format

# OR (if format:check exists)
npm run format:check

# Then commit the formatted files
git add .
git commit -m "style: format code with prettier"
```

### Linting Failures

**Problem**:

```
❌ Linting check failed
   12 lint errors found:
   - Unexpected console statement (no-console)
   - Missing semicolon (semi)
   - Unused variable 'x' (no-unused-vars)
```

**Solution**:

```bash
# Auto-fix lint errors
npm run lint -- --fix

# Manually fix remaining errors
# (edit files to address non-auto-fixable issues)

# Then commit the fixes
git add .
git commit -m "fix: resolve lint errors"
```

### Validation Failures

**Problem**:

```
❌ Validation check failed
   Schema validation failed for .claude/context/artifacts/plan.json
```

**Solution**:

```bash
# Run validator with details
npm run validate:full

# Fix validation errors based on output
# (edit files to match schema requirements)

# Re-run validation to verify
npm run validate

# Then commit the fixes
git add .
git commit -m "fix: resolve validation errors"
```

### Test Failures

**Problem**:

```
❌ Tests failed
   3 tests failed in src/__tests__/utils.test.ts:
   - should calculate sum correctly
   - should handle edge cases
   - should throw on invalid input
```

**Solution**:

```bash
# Run tests to see details
npm test

# Fix failing tests
# (edit code to make tests pass)

# Re-run tests to verify
npm test

# Then commit the fixes
git add .
git commit -m "fix: resolve test failures"
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Pre-PR Quality Gate

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run Pre-PR Gate
        run: node .claude/tools/pre-pr-gate.mjs

      - name: Upload gate report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: pre-pr-gate-report
          path: .claude/context/reports/pre-pr-gate-report.json
```

### GitLab CI

```yaml
pre-pr-gate:
  stage: test
  script:
    - npm ci
    - node .claude/tools/pre-pr-gate.mjs
  artifacts:
    when: on_failure
    paths:
      - .claude/context/reports/pre-pr-gate-report.json
  only:
    - merge_requests
```

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash
node .claude/tools/pre-pr-gate.mjs --skip-tests
if [ $? -ne 0 ]; then
  echo "Pre-PR gate failed - fix issues before committing"
  exit 1
fi
```

---

## Tech Stack Support

### JavaScript/TypeScript (Node.js)

**Detected Tools**:

- Formatter: Prettier, Biome
- Linter: ESLint, Biome
- Test Runner: Jest, Vitest, Mocha, Ava

**Package.json Example**:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint .",
    "test": "jest"
  },
  "devDependencies": {
    "prettier": "^3.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0"
  }
}
```

### Python

**Detected Tools**:

- Formatter: Black
- Linter: Pylint, Flake8
- Test Runner: Pytest

**Setup**:

```bash
# Install tools
pip install black pylint pytest

# Add to package.json (if using Node.js build system)
{
  "scripts": {
    "format": "black .",
    "lint": "pylint .",
    "test": "pytest"
  }
}

# OR use pyproject.toml
[tool.black]
line-length = 88

[tool.pylint]
max-line-length = 88
```

### Rust

**Detected Tools**:

- Formatter: Rustfmt
- Linter: Clippy
- Test Runner: Cargo

**Usage**:

```bash
# Format check
cargo fmt -- --check

# Lint
cargo clippy -- -D warnings

# Tests
cargo test
```

### Go

**Detected Tools**:

- Formatter: Gofmt
- Linter: golangci-lint
- Test Runner: Go test

**Usage**:

```bash
# Format check
gofmt -l .

# Lint
golangci-lint run

# Tests
go test ./...
```

---

## Custom Checks

### Adding Custom Validation

If your project has custom validation logic, add a `validate` script to `package.json`:

```json
{
  "scripts": {
    "validate": "node .claude/tools/custom-validator.mjs",
    "validate:full": "npm run validate && npm run validate:schemas"
  }
}
```

The gate will automatically detect and run the validator.

### Custom Validator Example

```javascript
// .claude/tools/custom-validator.mjs
import fs from 'fs';
import Ajv from 'ajv';

const ajv = new Ajv();

// Validate all JSON schemas
const schemas = fs.readdirSync('.claude/schemas').filter(f => f.endsWith('.schema.json'));

let errors = 0;

for (const schemaFile of schemas) {
  const schema = JSON.parse(fs.readFileSync(`.claude/schemas/${schemaFile}`));
  const valid = ajv.validateSchema(schema);

  if (!valid) {
    console.error(`❌ Invalid schema: ${schemaFile}`);
    console.error(ajv.errors);
    errors++;
  }
}

if (errors > 0) {
  process.exit(1); // Fail validation
}

console.log('✅ All schemas valid');
```

---

## Troubleshooting

### Gate Not Detecting Tools

**Problem**: Gate skips all checks (reports "No formatter detected", "No linter detected")

**Cause**: Tools not configured in `package.json` or not installed

**Solution**:

1. Check `package.json` has `scripts.format`, `scripts.lint`, `scripts.test`
2. Check `devDependencies` includes the tools (prettier, eslint, jest)
3. Run `npm install` to ensure tools are installed
4. Verify tools are executable: `npx prettier --version`

### Gate Fails with "Command not found"

**Problem**: Gate exits with error "Command not found: prettier"

**Cause**: Tool is listed in `package.json` but not installed

**Solution**:

```bash
# Install missing dependencies
npm install

# OR install specific tool
npm install --save-dev prettier
```

### Format Check Fails Even After Formatting

**Problem**: `npm run format` runs successfully, but gate still reports formatting errors

**Cause**: Files were formatted but not committed to git

**Solution**:

```bash
# Check which files changed
git status

# Stage and commit formatted files
git add .
git commit -m "style: format code"

# Re-run gate
node .claude/tools/pre-pr-gate.mjs
```

### Gate Takes Too Long

**Problem**: Gate takes 5+ minutes to run all checks

**Cause**: Large test suite or slow linter

**Solution**:

```bash
# Skip tests during local development
node .claude/tools/pre-pr-gate.mjs --skip-tests

# OR optimize test suite (run in parallel, mock slow operations)
# OR optimize linter (cache results, run only on changed files)
```

---

## Best Practices

### 1. Run Gate Before Every PR

**Workflow Integration** (Automatic):

```yaml
# .claude/workflows/pr-creation-workflow.yaml
steps:
  - id: '01a-pre-pr-gate'
    agent: 'devops'
    tasks:
      - 'Run: node .claude/tools/pre-pr-gate.mjs'
```

**Pre-commit Hook** (Local):

```bash
# .git/hooks/pre-commit
node .claude/tools/pre-pr-gate.mjs --skip-tests
```

### 2. Never Bypass with --force

**Why?**

- Creates technical debt
- Wastes reviewer time
- Allows broken code into PRs
- Defeats purpose of gate

**Exception**: ONLY use `--force` if:

- Gate tool is malfunctioning (file issue)
- Urgent hotfix required (document in PR description)

### 3. Fix Issues Incrementally

**Strategy**:

```bash
# Step 1: Fix formatting
npm run format
git commit -m "style: format code"

# Step 2: Fix linting
npm run lint -- --fix
git commit -m "fix: resolve lint errors"

# Step 3: Fix tests
npm test
# (edit code to fix failures)
git commit -m "fix: resolve test failures"

# Step 4: Re-run gate
node .claude/tools/pre-pr-gate.mjs
```

### 4. Keep Tools Updated

**Monthly Maintenance**:

```bash
# Update all tools to latest versions
npm update prettier eslint jest

# Re-run gate to ensure compatibility
node .claude/tools/pre-pr-gate.mjs
```

### 5. Document Custom Checks

If adding custom validation, document in project README:

```markdown
## Quality Checks

This project uses automated quality checks before PR creation:

- **Formatting**: Prettier (ES6+ code style)
- **Linting**: ESLint (Airbnb config)
- **Validation**: Custom schema validator
- **Tests**: Jest (90%+ coverage required)

Run all checks: `node .claude/tools/pre-pr-gate.mjs`
```

---

## Schema Validation

Gate reports conform to `.claude/schemas/pre-pr-gate-report.schema.json`:

```json
{
  "passed": true,
  "timestamp": "2025-01-15T10:30:00Z",
  "summary": {
    "total": 4,
    "passed": 3,
    "failed": 0,
    "skipped": 1
  },
  "results": {
    "formatting": {
      "status": "passed",
      "errors": [],
      "tool": "prettier"
    },
    "linting": {
      "status": "passed",
      "errors": [],
      "tool": "eslint"
    },
    "validation": {
      "status": "skipped",
      "errors": [],
      "tool": null
    },
    "tests": {
      "status": "passed",
      "errors": [],
      "tool": "jest"
    }
  },
  "failedChecks": []
}
```

**Validation**:

```bash
# Validate report against schema
node .claude/tools/enforcement-gate.mjs validate-schema \
  --schema .claude/schemas/pre-pr-gate-report.schema.json \
  --input .claude/context/reports/pre-pr-gate-report.json
```

---

## FAQ

### Q: What if my project doesn't use any of the detected tools?

**A**: The gate will skip checks for undetected tools. Add your tools to `package.json`:

```json
{
  "scripts": {
    "format": "your-formatter .",
    "lint": "your-linter .",
    "test": "your-test-runner"
  }
}
```

The gate will run custom scripts even if it doesn't recognize the specific tool.

### Q: Can I disable specific checks?

**A**: Not recommended, but you can modify the tool's `run()` method to skip checks. Better approach: configure tools to ignore specific files via `.prettierignore`, `.eslintignore`, etc.

### Q: Does this work with monorepos?

**A**: Yes, but each package needs its own `package.json` with `scripts`. You can create a root-level `package.json` that runs checks across all packages:

```json
{
  "scripts": {
    "format": "pnpm -r format",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test"
  }
}
```

### Q: What about performance?

**A**: The gate adds 10-60 seconds to PR creation depending on project size:

- Formatting: 2-10s
- Linting: 5-30s
- Tests: 10-120s (use `--skip-tests` for speed)

**Trade-off**: Slightly slower PR creation vs. significantly faster code review (no quality issues).

### Q: Can I use this outside the PR workflow?

**A**: Yes! Run it anytime:

```bash
# Before committing
node .claude/tools/pre-pr-gate.mjs --skip-tests

# Before pushing
node .claude/tools/pre-pr-gate.mjs

# In CI/CD
node .claude/tools/pre-pr-gate.mjs --json
```

---

## Contributing

### Reporting Issues

If the gate fails to detect your tools or has false positives:

1. Check `.claude/tools/pre-pr-gate.mjs` detection logic
2. File issue with `package.json` and error output
3. Include tool versions (`npm list prettier eslint jest`)

### Adding New Tool Support

To add support for a new formatter/linter/test runner:

1. Edit `.claude/tools/pre-pr-gate.mjs`
2. Add detection logic in `detectTools()`
3. Add execution logic in `check*()` methods
4. Test with your project
5. Submit PR with example `package.json`

**Example**:

```javascript
// Add support for Deno fmt
if (this.commandExists('deno')) {
  tools.formatter = 'deno';
}

// In checkFormatting():
else if (tools.formatter === 'deno') {
  this.execCommand('deno fmt --check', 'Deno format check');
}
```

---

## Related Documentation

- **PR Creation Workflow**: `.claude/workflows/pr-creation-workflow.yaml`
- **Pre-PR Gate Schema**: `.claude/schemas/pre-pr-gate-report.schema.json`
- **Enforcement Gates**: `.claude/docs/ENFORCEMENT_EXAMPLES.md`
- **Code Quality Standards**: `.claude/docs/CODE_QUALITY_STANDARDS.md`

---

## Version History

| Version | Date       | Changes                                  |
| ------- | ---------- | ---------------------------------------- |
| 1.0.0   | 2025-01-15 | Initial release - MANDATORY quality gate |

---

**Remember**: The pre-PR gate is not optional. It ensures that only quality code reaches the PR stage, saving reviewer time and preventing technical debt. Always fix issues rather than bypassing with `--force`.
