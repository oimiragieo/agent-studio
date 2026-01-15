# Success Criteria Template

This template provides guidance for writing measurable, verifiable success criteria for Customer User Journeys (CUJs).

## Core Principle

**Every success criterion must be verifiable through at least one of:**

- **Artifact Reference**: A file that can be checked for existence and content
- **Gate Reference**: A validation gate that produces pass/fail status
- **Schema Reference**: A JSON schema that validates artifact structure
- **Metric Reference**: A quantifiable measurement with threshold

---

## Measurability Categories

### Category 1: Artifact Existence

**Pattern**: Verify that a specific file exists with expected content.

**Template**:

```markdown
| Criterion               | Measurement     | Target                                                        |
| ----------------------- | --------------- | ------------------------------------------------------------- |
| [Artifact name] created | Artifact exists | `<artifact-path>.json` exists in `.claude/context/artifacts/` |
```

**Examples**:
| Criterion | Measurement | Target |
|-----------|-------------|--------|
| Plan created | Artifact exists | `plan-{{workflow_id}}.json` exists in `.claude/context/artifacts/` |
| Test results generated | Artifact exists | `test-results-{{workflow_id}}.json` exists |
| Documentation complete | Artifact exists | `docs-{{workflow_id}}.md` rendered from JSON |

---

### Category 2: Gate Validation

**Pattern**: Verify that a validation gate passes.

**Template**:

```markdown
| Criterion             | Measurement     | Target                                                |
| --------------------- | --------------- | ----------------------------------------------------- |
| [Step name] validated | Gate validation | Validated by gate file at `gates/<step>-<agent>.json` |
```

**Examples**:
| Criterion | Measurement | Target |
|-----------|-------------|--------|
| Code review complete | Gate validation | Validated by `gates/01-code-reviewer.json` |
| QA validation passed | Gate validation | Gate file shows `status: "passed"` |
| All gates passed | Gate file status check | All gate files in `gates/` show `status: "passed"` |

---

### Category 3: Schema Validation

**Pattern**: Verify that an artifact conforms to a JSON schema.

**Template**:

```markdown
| Criterion             | Measurement       | Target                                                        |
| --------------------- | ----------------- | ------------------------------------------------------------- |
| [Artifact name] valid | Schema validation | Validated against `.claude/schemas/<schema-name>.schema.json` |
```

**Examples**:
| Criterion | Measurement | Target |
|-----------|-------------|--------|
| Architecture valid | Schema validation | Validated against `.claude/schemas/system_architecture.schema.json` |
| Test plan valid | Schema validation | Validated against `.claude/schemas/test_plan.schema.json` |
| PRD valid | Schema validation | `prd-{{workflow_id}}.json` validated against `.claude/schemas/prd.schema.json` |

---

### Category 4: Numeric Metrics

**Pattern**: Verify that a measurement meets a numeric threshold.

**Template**:

```markdown
| Criterion                | Measurement         | Target                          |
| ------------------------ | ------------------- | ------------------------------- |
| [Metric name] acceptable | Numeric measurement | [Metric] [operator] [threshold] |
```

**Examples**:
| Criterion | Measurement | Target |
|-----------|-------------|--------|
| Plan quality | response-rater skill score | >= 7/10 (recorded in `.claude/context/runtime/runs/<run_id>/plans/<plan_id>-rating.json`) |
| Test coverage | Coverage percentage | >= 80% in coverage report |
| Performance | Response time | < 200ms P95 |
| Build success | Exit code | Exit code 0 |

---

### Category 5: Field/Content Validation

**Pattern**: Verify that an artifact contains specific fields or content.

**Template**:

```markdown
| Criterion              | Measurement          | Target                                               |
| ---------------------- | -------------------- | ---------------------------------------------------- |
| [Field name] populated | Artifact field check | `<field>` array/field populated in `<artifact>.json` |
```

**Examples**:
| Criterion | Measurement | Target |
|-----------|-------------|--------|
| Issues identified | Artifact issues field | `issues` array populated in `code-review-report-{{workflow_id}}.json` |
| Files reviewed | Artifact files_reviewed field | `files_reviewed` array populated |
| Recommendations provided | Artifact recommendations field | `recommendations` array in report |

---

### Category 6: Subjective Criteria (Human Review)

**Pattern**: For inherently subjective criteria, flag for human review.

**Template**:

```markdown
| Criterion              | Measurement  | Target                                      |
| ---------------------- | ------------ | ------------------------------------------- |
| [Subjective criterion] | Human review | [subjective:true] Requires human validation |
```

**Examples**:
| Criterion | Measurement | Target |
|-----------|-------------|--------|
| UX quality acceptable | Human review | [subjective:true] UX review approval |
| Design consistency | Human review | [subjective:true] Design review by UX-Expert |

---

## Transformation Examples

### Non-Measurable to Measurable

**Before (Non-Measurable)**:

```markdown
- ✅ Configuration files copied correctly
- ✅ Validation passes without errors
- ✅ Agents can be invoked
```

**After (Measurable)**:

```markdown
| Criterion                 | Measurement      | Target                                                                |
| ------------------------- | ---------------- | --------------------------------------------------------------------- |
| Configuration files exist | File existence   | `.claude/` directory contains all required files (per checklist)      |
| Validation passes         | Script exit code | `pnpm validate` returns exit code 0                                   |
| Agents invokable          | Smoke test       | Agent invocation succeeds without errors (logged in `validation.log`) |
```

---

**Before (Non-Measurable)**:

```markdown
- ✅ claude.md generated
- ✅ Structure correct
- ✅ Content complete
```

**After (Measurable)**:

```markdown
| Criterion           | Measurement       | Target                                                                    |
| ------------------- | ----------------- | ------------------------------------------------------------------------- |
| claude.md generated | Artifact exists   | `<module>/claude.md` file created                                         |
| Structure valid     | Schema validation | Validated against `.claude/schemas/claude-md.schema.json`                 |
| Content complete    | Field validation  | Required sections present: Purpose, Key Functions, Dependencies, Patterns |
```

---

**Before (Non-Measurable)**:

```markdown
| Mobile features implemented | Implementation complete | Mobile features developed and functional |
| Quality validated | QA validation complete | Quality standards met |
```

**After (Measurable)**:

```markdown
| Criterion                   | Measurement       | Target                                                                           |
| --------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| Mobile features implemented | Artifact manifest | Features listed in `dev-manifest-{{workflow_id}}.json` with `status: "complete"` |
| Quality validated           | Gate validation   | QA gate at `gates/04-qa.json` shows `status: "passed"`                           |
```

---

## Validation Command

To check measurability of success criteria:

```bash
node scripts/validate-cujs.mjs --measurability
```

This will report the percentage of measurable vs non-measurable criteria across all CUJs.

---

## Best Practices

1. **Always include artifact paths**: Specify where outputs are saved
2. **Reference schemas**: Link to validation schemas where applicable
3. **Use table format**: Tables make criteria clearer and more consistent
4. **Include workflow_id**: Use `{{workflow_id}}` placeholder for traceability
5. **Flag subjective criteria**: Mark with `[subjective:true]` if human review needed
6. **Avoid vague terms**: Replace "improved", "better", "working" with specific measurements

---

## Quick Reference

| Type       | Pattern                                  | Example                             |
| ---------- | ---------------------------------------- | ----------------------------------- |
| Artifact   | `<path>.json exists`                     | `plan-{{workflow_id}}.json` exists  |
| Gate       | `gates/<step>.json status: passed`       | QA gate passes                      |
| Schema     | `validated against <schema>.schema.json` | Validated against `prd.schema.json` |
| Metric     | `<value> <op> <threshold>`               | Score >= 7/10                       |
| Field      | `<field> populated in <artifact>`        | `issues` array populated            |
| Subjective | `[subjective:true]`                      | Requires human review               |
