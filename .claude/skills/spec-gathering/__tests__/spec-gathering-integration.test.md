# Spec Gathering Integration Test

## Purpose
Test that `spec-gathering` properly invokes `template-renderer` after collecting requirements.

## Test Case 1: Complete Requirements Gathering → Template Rendering

**Input**: User requests "Add user authentication"

**Expected Workflow**:
1. spec-gathering collects requirements via progressive disclosure
2. Maps gathered requirements to template tokens
3. Invokes: `Skill({ skill: "template-renderer", args: {...} })`
4. Outputs rendered specification to `.claude/context/artifacts/specifications/user-authentication-spec.md`

**Token Mapping**:
```javascript
{
  FEATURE_NAME: "User Authentication",
  VERSION: "1.0.0",
  AUTHOR: "Claude",
  DATE: "2026-01-28",
  STATUS: "draft",
  ACCEPTANCE_CRITERIA_1: "User can log in with email and password",
  ACCEPTANCE_CRITERIA_2: "Password meets complexity requirements",
  ACCEPTANCE_CRITERIA_3: "Failed login attempts are logged"
}
```

**Verification**:
```bash
# Check file exists
test -f .claude/context/artifacts/specifications/user-authentication-spec.md && echo "✓ Spec file created" || echo "✗ Spec file missing"

# Check no unresolved tokens
grep "{{" .claude/context/artifacts/specifications/user-authentication-spec.md && echo "✗ Unresolved tokens found" || echo "✓ All tokens resolved"

# Check YAML frontmatter valid
head -50 .claude/context/artifacts/specifications/user-authentication-spec.md | grep -E "^---$" | wc -l  # Should output: 2
```

## Test Case 2: Minimal Requirements → Spec Output

**Input**: Minimal feature request "Add health check endpoint"

**Expected Workflow**:
1. spec-gathering collects minimal requirements
2. Maps to template tokens (fills required, leaves optional empty)
3. Invokes template-renderer
4. Outputs valid spec with all required tokens

**Token Mapping**:
```javascript
{
  FEATURE_NAME: "Health Check Endpoint",
  VERSION: "1.0.0",
  AUTHOR: "Claude",
  DATE: "2026-01-28",
  STATUS: "draft",
  ACCEPTANCE_CRITERIA_1: "Endpoint returns 200 OK when service is healthy",
  ACCEPTANCE_CRITERIA_2: "Endpoint returns 503 when service is unhealthy",
  ACCEPTANCE_CRITERIA_3: "Response includes uptime and dependencies status"
}
```

## Test Case 3: Error Handling - Missing Required Token

**Input**: Requirements gathered but acceptance criteria missing

**Expected Behavior**:
- spec-gathering detects missing required criteria
- Prompts user for missing acceptance criteria
- DOES NOT invoke template-renderer until all required tokens available

**Verification**:
```bash
# Should NOT create spec file yet
test ! -f .claude/context/artifacts/specifications/incomplete-spec.md && echo "✓ Spec not created (missing tokens)" || echo "✗ Spec created prematurely"
```

## Test Case 4: End-to-End Validation

**Input**: Complete requirements for "Payment Processing"

**Expected Workflow**:
1. spec-gathering → requirements collected
2. template-renderer → spec rendered
3. Schema validation → YAML frontmatter valid
4. Output verification → no unresolved tokens

**Verification Commands**:
```bash
# Full validation chain
SPEC_FILE=".claude/context/artifacts/specifications/payment-processing-spec.md"

# 1. File exists
test -f "$SPEC_FILE" && echo "✓ Spec file exists" || echo "✗ Spec file missing"

# 2. No unresolved tokens
grep "{{" "$SPEC_FILE" && echo "✗ Unresolved tokens" || echo "✓ All tokens resolved"

# 3. YAML frontmatter valid (2 delimiters)
YAML_COUNT=$(head -50 "$SPEC_FILE" | grep -E "^---$" | wc -l)
test "$YAML_COUNT" -eq 2 && echo "✓ YAML valid" || echo "✗ YAML invalid"

# 4. Required frontmatter fields present
grep -q "^title:" "$SPEC_FILE" && echo "✓ title present" || echo "✗ title missing"
grep -q "^version:" "$SPEC_FILE" && echo "✓ version present" || echo "✗ version missing"
grep -q "^author:" "$SPEC_FILE" && echo "✓ author present" || echo "✗ author missing"
grep -q "^acceptance_criteria:" "$SPEC_FILE" && echo "✓ acceptance_criteria present" || echo "✗ acceptance_criteria missing"
```

## Success Criteria

- [ ] spec-gathering invokes template-renderer skill
- [ ] Token mapping from requirements to template is correct
- [ ] Output spec file has no unresolved tokens
- [ ] YAML frontmatter is valid
- [ ] All required fields present in frontmatter
- [ ] Spec saved to correct location (`.claude/context/artifacts/specifications/`)
