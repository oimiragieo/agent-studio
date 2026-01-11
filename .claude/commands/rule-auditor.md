# Rule Auditor

Validates code against loaded rules and reports violations.

## Usage

`/rule-auditor [path] [--format json]`

## Examples

- `/rule-auditor` - Audit current directory
- `/rule-auditor src/components/` - Audit specific directory
- `/rule-auditor --format json` - Get JSON output for CI/CD

## What It Does

1. Loads all active rules from `.claude/rules-master/` and `.claude/rules-library/`
2. Analyzes code in the specified path
3. Reports violations with:
   - File path and line number
   - Rule violated
   - Suggested fix
4. Provides compliance score

## Options

- `[path]` - Directory or file to audit (default: current directory)
- `--format json` - Output as JSON for automation
- `--auto-fix` - Automatically fix violations (with confirmation)

## Related Skills

- code-style-validator - Style-specific validation
- fixing-rule-violations - Get detailed fix instructions
- explaining-rules - Understand why rules matter
