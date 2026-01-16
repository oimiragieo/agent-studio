# Schema Validation Quick Reference

## Command Cheat Sheet

```bash
# Validate developer output
node .claude/tools/schema-validator.mjs --agent developer --output output.json

# Validate QA output
node .claude/tools/schema-validator.mjs --agent qa --output qa-results.json

# Strict mode (warnings block)
node .claude/tools/schema-validator.mjs --agent qa --output output.json --strict

# Custom schema
node .claude/tools/schema-validator.mjs --schema custom.schema.json --output output.json

# Verbose mode
node .claude/tools/schema-validator.mjs --agent developer --output output.json --verbose

# Help
node .claude/tools/schema-validator.mjs --help
```

## Exit Codes

| Code | Meaning           | Action          |
| ---- | ----------------- | --------------- |
| 0    | Validation passed | ✅ Proceed      |
| 1    | Validation failed | ❌ Fix errors   |
| 2    | Warnings found    | ⚠️ Review       |
| 3    | Invalid arguments | 🔧 Check syntax |

## Agent Type Map

| Agent                  | Schema File                               | Key Fields                             |
| ---------------------- | ----------------------------------------- | -------------------------------------- |
| `developer`            | `developer-output.schema.json`            | `test_results`, `compilation_success`  |
| `qa`                   | `qa-output.schema.json`                   | `test_results`, `evidence.test_output` |
| `code-reviewer`        | `code-reviewer-output.schema.json`        | `findings`, `severity_counts`          |
| `security-architect`   | `security-architect-output.schema.json`   | `vulnerabilities`, `risk_score`        |
| `devops`               | `devops-output.schema.json`               | `deployment_status`, `health_checks`   |
| `technical-writer`     | `technical-writer-output.schema.json`     | `files_updated`, `word_count`          |
| `architect`            | `architect-output.schema.json`            | `design_artifacts`, `risk_analysis`    |
| `analyst`              | `analyst-output.schema.json`              | `analysis_results`, `data_quality`     |
| `planner`              | `planner-output.schema.json`              | `plan_document`, `success_criteria`    |
| `performance-engineer` | `performance-engineer-output.schema.json` | `metrics`, `benchmarks`                |

## Universal Required Fields

```json
{
  "verdict": "PASS|CONCERNS|FAIL",
  "metadata": {
    "agent": "agent-name",
    "timestamp": "2026-01-15T10:30:00Z"
  }
}
```

## PASS Verdict Requirements

| Agent                | Threshold                                   |
| -------------------- | ------------------------------------------- |
| Developer            | `test_results.pass_rate ≥ 80%`              |
| QA                   | `test_results.pass_rate ≥ 90%`              |
| Code Reviewer        | `severity_counts.critical: 0` AND `high: 0` |
| Security Architect   | `risk_score < 30`                           |
| DevOps               | `health_checks.all_passing: true`           |
| Planner              | `quality_score ≥ 7`                         |
| Performance Engineer | ≥10% improvement                            |

## Workflow Integration Pattern

```yaml
steps:
  - name: 'Step Name'
    agent: developer
    validation:
      schema: agent-outputs/developer-output.schema.json
      exit_on_failure: true
      strict_mode: false
```

## Orchestrator Verification Pattern

```javascript
const exitCode = await Bash({
  command: 'node .claude/tools/schema-validator.mjs --agent developer --output output.json',
});

if (exitCode !== 0) {
  console.error('❌ Validation failed');
  return; // STOP - do not proceed
}

console.log('✅ Validated - proceeding');
```

## Common Validation Errors

| Error                                                | Fix                               |
| ---------------------------------------------------- | --------------------------------- |
| "Missing required property: test_results"            | Add test execution results        |
| "Property 'verdict' must be PASS, CONCERNS, or FAIL" | Use exact enum values             |
| "Property 'pass_rate' must be >= 90"                 | Improve test pass rate            |
| "Property 'verdict_reason' is required"              | Add explanation for CONCERNS/FAIL |

## Programmatic Validation

### Node.js

```javascript
import { OutputValidator } from './.claude/tools/output-validator.mjs';

const validator = new OutputValidator();
const result = validator.validate(output, schema);

if (!result.valid) {
  console.error(result.errors);
  process.exit(1);
}
```

### Python

```python
import jsonschema

jsonschema.validate(output, schema)
```

## Resources

- **Guide**: `.claude/docs/SCHEMA_VALIDATION_GUIDE.md`
- **Schemas**: `.claude/schemas/agent-outputs/`
- **Validator**: `.claude/tools/schema-validator.mjs`
- **Library**: `.claude/tools/output-validator.mjs`
