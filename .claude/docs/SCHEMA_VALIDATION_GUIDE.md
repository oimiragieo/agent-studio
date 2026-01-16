# Schema Validation Guide

Comprehensive guide for validating agent outputs against JSON Schema definitions using the schema-validator tool.

---

## Overview

The schema validation system ensures agent outputs conform to standardized structures through evidence-based validation. This enables:

- **Consistency** - All agents produce structured, predictable outputs
- **Reliability** - Automated validation catches errors before they propagate
- **Integration** - Downstream tools can depend on consistent schemas
- **Quality Control** - Evidence-based verdicts prevent hallucinations

**10 Agent Output Schemas**:

1. **developer** - Code artifacts, tests, compilation
2. **qa** - Test results, coverage, quality checks
3. **code-reviewer** - Syntax, paths, dependencies, logic
4. **security-architect** - Vulnerabilities, compliance, security
5. **devops** - Deployment, build, tests, PRs
6. **technical-writer** - Documentation, changelog updates
7. **architect** - Diagrams, design decisions, trade-offs
8. **analyst** - Findings, recommendations, evidence
9. **planner** - Execution plans, dependencies, risks
10. **performance-engineer** - Metrics, bottlenecks, optimizations

---

## Why Schema Validation Matters

### Evidence-Based Validation

Schema validation enforces **evidence-based outputs** from all agents:

- **Developer** must provide: test results (pass rate ≥ 80%), compilation success, deliverables validation
- **QA** must provide: test results (pass rate ≥ 90%), evidence (test command, output)
- **Code Reviewer** must provide: syntax errors (empty for PASS), path/dependency issues, evidence
- **Security Architect** must provide: vulnerabilities (empty for PASS), compliance status, evidence

**Without Evidence → No PASS Verdict**

### Schema Requirements by Agent Type

| Agent | Required for PASS Verdict | Evidence Required |
|-------|---------------------------|-------------------|
| Developer | `compilation_success: true`, `test_results.pass_rate ≥ 80%` | compilation_output, test_output, lint_results |
| QA | `test_results.pass_rate ≥ 90%` | test_command, test_output |
| Code Reviewer | `syntax_errors: []` (empty) | code_snippets, file_references |
| Security Architect | `vulnerabilities: []` (empty) | security_scan_output, manual_review_notes |
| DevOps | `deployment_status.status: "success"`, `test_status.all_passing: true`, `build_status.success: true` | deployment_logs, test_logs, build_logs |
| Technical Writer | `changelog_updated: true` | changelog_content, diff_summary |
| Architect | At least 1 diagram, 1 design decision | diagrams, adr_documents |
| Analyst | At least 1 finding, 1 recommendation | code_samples, metrics |
| Planner | At least 1 step, risk assessment | N/A |
| Performance Engineer | Metrics present, bottlenecks analyzed | profiling_data, benchmark_results |

---

## Using schema-validator.mjs

### Installation

No installation required - the tool uses Node.js built-ins and Ajv (included in project dependencies).

### Basic Usage

```bash
# Validate developer output
node .claude/tools/schema-validator.mjs \
  --agent developer \
  --output .claude/context/artifacts/dev-output.json

# Validate with strict mode (any error blocks)
node .claude/tools/schema-validator.mjs \
  --agent qa \
  --output .claude/context/artifacts/qa-output.json \
  --strict

# Validate with verbose error messages
node .claude/tools/schema-validator.mjs \
  --agent security-architect \
  --output .claude/context/artifacts/security-output.json \
  --verbose
```

### Command Options

| Option | Description | Example |
|--------|-------------|---------|
| `--agent <type>` | Agent type (required) | `--agent developer` |
| `--output <path>` | Path to output JSON (required) | `--output ./dev-output.json` |
| `--strict` | Exit with code 2 for ANY error (blocking) | `--strict` |
| `--verbose` | Show detailed error messages | `--verbose` |
| `--help` | Show usage information | `--help` |

### Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Valid output - passes schema | ✓ Proceed |
| 1 | Invalid (warnings only) | ⚠ Review but may proceed |
| 2 | Invalid (critical errors) | ✗ BLOCK - fix errors |
| 3 | File or schema not found | ✗ BLOCK - check paths |

**In CI/CD**: Use `--strict` mode to block on any validation error.

---

## Schema Requirements by Agent

### 1. Developer Output Schema

**File**: `.claude/schemas/agent-outputs/developer-output.schema.json`

**Required Fields**:
- `verdict`: "PASS" | "CONCERNS" | "FAIL"
- `files_created`: Array of file paths (min 1)
- `test_results`: Object with total_tests, passed, failed, pass_rate
- `compilation_success`: Boolean (must be true for PASS)
- `deliverables`: Array of deliverable objects (min 1)

**PASS Verdict Requirements**:
- `compilation_success` must be `true`
- `test_results.pass_rate` must be ≥ 80%
- All deliverables must exist and be validated

**Evidence Required**:
- `compilation_output`: String
- `test_output`: String
- `lint_results`: String

**Example Valid Output**:

```json
{
  "verdict": "PASS",
  "files_created": [
    "src/components/Button.tsx",
    "src/components/Button.test.tsx"
  ],
  "test_results": {
    "total_tests": 10,
    "passed": 10,
    "failed": 0,
    "pass_rate": 100
  },
  "compilation_success": true,
  "deliverables": [
    {
      "path": "src/components/Button.tsx",
      "exists": true,
      "validated": true
    }
  ],
  "evidence": {
    "compilation_output": "Build successful",
    "test_output": "All tests passed",
    "lint_results": "No linting errors"
  }
}
```

---

### 2. QA Output Schema

**File**: `.claude/schemas/agent-outputs/qa-output.schema.json`

**Required Fields**:
- `verdict`: "PASS" | "CONCERNS" | "FAIL"
- `test_results`: Object with total_tests, passed, failed, pass_rate
- `evidence`: Object with test_command, test_output

**PASS Verdict Requirements**:
- `test_results.pass_rate` must be ≥ 90%

**Evidence Required**:
- `test_command`: String (command used to run tests)
- `test_output`: String (full test execution output)

**Example Valid Output**:

```json
{
  "verdict": "PASS",
  "test_results": {
    "total_tests": 50,
    "passed": 48,
    "failed": 2,
    "pass_rate": 96
  },
  "evidence": {
    "test_command": "npm test",
    "test_output": "Test Suites: 10 passed, 10 total\nTests:       48 passed, 2 failed, 50 total"
  }
}
```

---

### 3. Code Reviewer Output Schema

**File**: `.claude/schemas/agent-outputs/code-reviewer-output.schema.json`

**Required Fields**:
- `verdict`: "PASS" | "CONCERNS" | "FAIL"
- `syntax_errors`: Array (must be empty for PASS)
- `path_issues`: Array
- `dependency_issues`: Array
- `logic_concerns`: Array

**PASS Verdict Requirements**:
- `syntax_errors` must be empty array

**Evidence Required**:
- `code_snippets`: Array of code samples
- `file_references`: Array of file paths

**Example Valid Output**:

```json
{
  "verdict": "PASS",
  "syntax_errors": [],
  "path_issues": [],
  "dependency_issues": [],
  "logic_concerns": [],
  "evidence": {
    "code_snippets": [
      {
        "file": "src/utils/helper.ts",
        "lines": "10-15",
        "issue": "none"
      }
    ],
    "file_references": ["src/utils/helper.ts"]
  }
}
```

---

### 4. Security Architect Output Schema

**File**: `.claude/schemas/agent-outputs/security-architect-output.schema.json`

**Required Fields**:
- `verdict`: "PASS" | "CONCERNS" | "FAIL"
- `vulnerabilities`: Array (must be empty for PASS)
- `security_concerns`: Array
- `compliance_status`: Object with owasp_top_10, secrets_check, auth_check, input_validation

**PASS Verdict Requirements**:
- `vulnerabilities` must be empty array

**Evidence Required**:
- `security_scan_output`: String
- `manual_review_notes`: String

**Example Valid Output**:

```json
{
  "verdict": "PASS",
  "vulnerabilities": [],
  "security_concerns": [],
  "compliance_status": {
    "owasp_top_10": {
      "compliant": true,
      "violations": []
    },
    "secrets_check": {
      "passed": true,
      "secrets_found": []
    },
    "auth_check": {
      "passed": true,
      "issues": []
    },
    "input_validation": {
      "passed": true,
      "unvalidated_inputs": []
    }
  },
  "evidence": {
    "security_scan_output": "No vulnerabilities detected",
    "manual_review_notes": "Manual review completed"
  }
}
```

---

### 5. DevOps Output Schema

**File**: `.claude/schemas/agent-outputs/devops-output.schema.json`

**Required Fields**:
- `verdict`: "PASS" | "CONCERNS" | "FAIL"
- `deployment_status`: Object with status
- `test_status`: Object with all_passing
- `build_status`: Object with success

**PASS Verdict Requirements** (implicit):
- `deployment_status.status`: "success"
- `test_status.all_passing`: true
- `build_status.success`: true

**Evidence Required**:
- `deployment_logs`: String
- `test_logs`: String
- `build_logs`: String

**Example Valid Output**:

```json
{
  "verdict": "PASS",
  "deployment_status": {
    "status": "success",
    "environment": "staging",
    "url": "https://staging.example.com"
  },
  "test_status": {
    "all_passing": true,
    "total_tests": 100,
    "passed": 100,
    "failed": 0
  },
  "build_status": {
    "success": true,
    "build_time_seconds": 120
  },
  "pr_urls": ["https://github.com/org/repo/pull/123"],
  "evidence": {
    "deployment_logs": "Deployment successful",
    "test_logs": "All tests passed",
    "build_logs": "Build completed"
  }
}
```

---

### 6. Technical Writer Output Schema

**File**: `.claude/schemas/agent-outputs/technical-writer-output.schema.json`

**Required Fields**:
- `verdict`: "PASS" | "CONCERNS" | "FAIL"
- `files_updated`: Array (min 1)
- `changelog_updated`: Boolean (must be true for PASS)

**PASS Verdict Requirements**:
- `changelog_updated` must be `true`

**Evidence Required**:
- `changelog_content`: String
- `diff_summary`: String

**Example Valid Output**:

```json
{
  "verdict": "PASS",
  "files_updated": [
    {
      "path": "CHANGELOG.md",
      "type": "changelog",
      "changes": "Added Phase 2.1-2.2 entries"
    }
  ],
  "changelog_updated": true,
  "evidence": {
    "changelog_content": "## [1.1.0] - 2025-01-15\n### Added\n- Phase 2.1-2.2 validation infrastructure",
    "diff_summary": "+15 lines in CHANGELOG.md"
  }
}
```

---

### 7-10. Remaining Agent Schemas

**Architect** (`.claude/schemas/agent-outputs/architect-output.schema.json`):
- Required: architecture_diagrams (min 1), design_decisions (min 1), trade_offs
- Evidence: diagrams, adr_documents

**Analyst** (`.claude/schemas/agent-outputs/analyst-output.schema.json`):
- Required: analysis_type, findings (min 1), recommendations (min 1), evidence
- Evidence: code_samples, metrics (required)

**Planner** (`.claude/schemas/agent-outputs/planner-output.schema.json`):
- Required: plan_id, steps (min 1), dependencies, risk_assessment, success_criteria (min 1)

**Performance Engineer** (`.claude/schemas/agent-outputs/performance-engineer-output.schema.json`):
- Required: performance_metrics (load_time_ms, memory_usage_mb), bottlenecks, optimizations, evidence
- Evidence: profiling_data, benchmark_results (required)

---

## Examples of Valid vs Invalid Outputs

### Developer: PASS vs FAIL

**✓ PASS** - Compilation success, 100% pass rate:

```json
{
  "verdict": "PASS",
  "files_created": ["src/App.tsx"],
  "test_results": {
    "total_tests": 5,
    "passed": 5,
    "failed": 0,
    "pass_rate": 100
  },
  "compilation_success": true,
  "deliverables": [{"path": "src/App.tsx", "exists": true, "validated": true}],
  "evidence": {
    "compilation_output": "Success",
    "test_output": "5 passed",
    "lint_results": "Clean"
  }
}
```

**✗ FAIL** - Compilation failure (should be CONCERNS/FAIL, not PASS):

```json
{
  "verdict": "PASS",  // ✗ INVALID: PASS requires compilation_success: true
  "files_created": ["src/App.tsx"],
  "test_results": {
    "total_tests": 5,
    "passed": 5,
    "failed": 0,
    "pass_rate": 100
  },
  "compilation_success": false,  // ✗ Must be true for PASS
  "deliverables": [{"path": "src/App.tsx", "exists": true, "validated": true}],
  "evidence": {
    "compilation_output": "Compilation failed",
    "test_output": "5 passed",
    "lint_results": "Clean"
  }
}
```

**Validation Error**:
```
✗ VALIDATION FAILED

CRITICAL ERRORS (1):
  root: must match "allOf" schema (PASS verdict requires compilation_success: true)
```

---

## Integration with verification-gate.mjs

The `schema-validator.mjs` tool integrates with `verification-gate.mjs` for end-to-end validation:

```bash
# Step 1: Agent completes and produces output
# Agent saves: .claude/context/artifacts/dev-output.json

# Step 2: Run verification gate (calls schema-validator internally)
node .claude/tools/verification-gate.mjs \
  --output .claude/context/artifacts/dev-output.json \
  --agent developer

# verification-gate.mjs internally calls:
# node .claude/tools/schema-validator.mjs \
#   --agent developer \
#   --output .claude/context/artifacts/dev-output.json \
#   --strict
```

**Verification Gate Flow**:

1. **Load Output**: Read agent output JSON
2. **Schema Validation**: Call schema-validator.mjs
3. **Evidence Validation**: Verify required evidence fields present
4. **Verdict Validation**: Ensure verdict matches criteria (e.g., PASS requires specific conditions)
5. **Generate Report**: Save validation report

---

## Troubleshooting Schema Validation Failures

### Missing Required Field

**Error**:
```
CRITICAL ERRORS (1):
  root: must have required property 'test_results'
```

**Cause**: Required field missing from output

**Fix**:
1. Add the missing field to agent output
2. Ensure all required fields from schema are present
3. Check schema definition for required fields list

### Type Mismatch

**Error**:
```
CRITICAL ERRORS (1):
  /test_results/pass_rate: must be number
```

**Cause**: Field has wrong type (string instead of number)

**Fix**:
1. Ensure field matches expected type
2. Convert values to correct type before output
3. Use TypeScript for type safety

### Enum Violation

**Error**:
```
CRITICAL ERRORS (1):
  /verdict: must be equal to one of the allowed values (PASS, CONCERNS, FAIL)
```

**Cause**: Field value not in allowed enum values

**Fix**:
1. Use only allowed values (check schema enum)
2. Add constants for enum values in code
3. Validate enum values before output

### Conditional Validation Failure

**Error**:
```
CRITICAL ERRORS (1):
  root: must match "allOf" schema (PASS verdict requires pass_rate >= 90%)
```

**Cause**: Conditional requirement not met (e.g., PASS with low pass rate)

**Fix**:
1. Review conditional requirements in schema (allOf/if/then)
2. Ensure verdict matches actual results
3. Use CONCERNS/FAIL verdict if requirements not met

---

## CI/CD Integration Examples

### GitHub Actions

```yaml
name: Validate Agent Outputs

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install Dependencies
        run: npm install

      - name: Validate Developer Output
        run: |
          node .claude/tools/schema-validator.mjs \
            --agent developer \
            --output .claude/context/artifacts/dev-output.json \
            --strict

      - name: Validate QA Output
        run: |
          node .claude/tools/schema-validator.mjs \
            --agent qa \
            --output .claude/context/artifacts/qa-output.json \
            --strict
```

### GitLab CI

```yaml
validate-outputs:
  stage: test
  script:
    - npm install
    - node .claude/tools/schema-validator.mjs --agent developer --output .claude/context/artifacts/dev-output.json --strict
    - node .claude/tools/schema-validator.mjs --agent qa --output .claude/context/artifacts/qa-output.json --strict
  artifacts:
    when: on_failure
    paths:
      - .claude/context/artifacts/*.json
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-15 | Initial release - 10 agent schemas, schema-validator tool |

---

## See Also

- **Schema Validator Tool**: `.claude/tools/schema-validator.mjs`
- **Agent Output Schemas**: `.claude/schemas/agent-outputs/`
- **Verification Gate**: `.claude/tools/verification-gate.mjs`
- **QA Testing Guide**: `.claude/docs/QA_TESTING_GUIDE.md`
