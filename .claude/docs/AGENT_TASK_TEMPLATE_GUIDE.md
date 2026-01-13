# Agent Task Template Guide

## Overview

The agent-task template is a structured format for delegating work to subagents with optimal prompt engineering. This guide explains all fields, when to use them, and how to leverage 2026 prompt optimization best practices.

**Version**: 2.0.0 (2026 Prompt Engineering Update)
**Schema**: `.claude/schemas/agent-task.schema.json`
**Template**: `.claude/templates/agent-task-template.json`

---

## Table of Contents

1. [Core Fields](#core-fields)
2. [Prompt Optimization Fields (New)](#prompt-optimization-fields-new)
3. [Field Usage Guide](#field-usage-guide)
4. [Best Practices](#best-practices)
5. [Examples by Task Type](#examples-by-task-type)
6. [Research References](#research-references)

---

## Core Fields

### `task_id` (required)

**Type**: `string`
**Pattern**: `^[a-z0-9-]+$`
**Length**: 5-100 characters

Unique identifier for the task. Use descriptive kebab-case naming.

**Examples**:

- `fix-auth-bug-001`
- `implement-user-dashboard-042`
- `analyze-performance-bottleneck-003`

**Best Practices**:

- Include action verb (fix, implement, analyze, refactor)
- Add context (what component/feature)
- Add sequence number for tracking

### `objective` (required)

**Type**: `string`
**Length**: 10-200 characters

Clear, single-sentence objective describing what needs to be accomplished.

**Formula**: `[Action Verb] + [What] + [Why/Outcome]`

**Examples**:

- ✅ "Implement JWT authentication middleware to secure API endpoints"
- ✅ "Refactor database queries to reduce latency by 50%"
- ❌ "Fix the thing" (too vague)
- ❌ "We need to improve the authentication system and also add rate limiting and improve the logging and..." (too complex, multiple objectives)

### `context` (required)

**Type**: `object`

Background information to help the subagent understand the problem.

**Required fields**:

- `problem` (string): What problem are we solving? What's broken or missing?
- `why_now` (string): Why is this urgent? What's the business/user impact?

**Optional fields**:

- `previous_attempts` (array): What has already been tried? What didn't work?
- `related_files` (array): Files that may be relevant to this task
- `dependencies` (array): Other tasks or systems this depends on

**Example**:

```json
"context": {
  "problem": "API endpoints lack authentication. Anyone can access sensitive user data.",
  "why_now": "Security audit flagged this as critical. Production deployment blocked.",
  "previous_attempts": [
    "Tried basic auth - doesn't support token refresh",
    "Evaluated OAuth2 libraries - too complex for current requirements"
  ],
  "related_files": [
    "src/middleware/auth.ts",
    "src/config/jwt.config.ts"
  ],
  "dependencies": [
    "User database schema must be finalized"
  ]
}
```

### `deliverables` (required)

**Type**: `array` (minimum 1 item)

Concrete outputs expected from this task.

**Each deliverable includes**:

- `type` (enum): file, report, fix, analysis, refactor, test, documentation
- `path` (string or null): File path where deliverable should be saved
- `description` (string): What this deliverable contains or accomplishes
- `format` (optional enum): json, markdown, typescript, javascript, python, yaml, text
- `validation` (optional string): How to validate this deliverable is correct

**Example**:

```json
"deliverables": [
  {
    "type": "file",
    "path": "src/middleware/auth-middleware.ts",
    "description": "JWT authentication middleware with token validation",
    "format": "typescript",
    "validation": "Must pass type checking and unit tests with 90%+ coverage"
  },
  {
    "type": "test",
    "path": "src/middleware/auth-middleware.test.ts",
    "description": "Test suite covering valid/expired tokens and role-based access",
    "format": "typescript",
    "validation": "All tests must pass; coverage >= 90%"
  }
]
```

### `constraints` (required)

**Type**: `object`

Limits and requirements for task execution.

**Fields**:

- `max_time_minutes` (integer, 1-120, default 30): Maximum time allowed
- `max_file_reads` (integer, 1-50, default 10): Maximum files to read
- `max_tokens` (integer, 1000-200000, default 50000): Maximum context tokens
- `must_validate` (boolean, default true): Whether deliverables must pass validation
- `allowed_tools` (array, default Read/Write/Edit/Grep/Glob): Tools agent can use
- `blocked_operations` (array): Operations explicitly prohibited

**Example**:

```json
"constraints": {
  "max_time_minutes": 45,
  "max_file_reads": 15,
  "max_tokens": 50000,
  "must_validate": true,
  "allowed_tools": ["Read", "Write", "Edit", "Grep"],
  "blocked_operations": [
    "Modifying production environment files",
    "Bypassing security validation"
  ]
}
```

### `success_criteria` (required)

**Type**: `array` (minimum 1 item)

Measurable criteria for task completion. Use SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound).

**Examples**:

```json
"success_criteria": [
  "Middleware correctly validates JWT tokens and rejects invalid/expired tokens",
  "Role-based access control blocks unauthorized users from protected routes",
  "All unit tests pass with >= 90% code coverage",
  "Documentation includes clear setup and usage examples",
  "No security vulnerabilities detected by security-architect review"
]
```

### `priority` (required)

**Type**: `enum`
**Values**: `critical`, `high`, `medium`, `low`
**Default**: `medium`

Task priority level. Affects scheduling and resource allocation.

### `assigned_agent` (optional)

**Type**: `enum`

Specific subagent type to handle this task. See `.claude/docs/AGENT_DIRECTORY.md` for full list.

**Common agents**:

- `developer`: Implementation, code changes
- `analyst`: Research, code analysis
- `architect`: System design, architecture decisions
- `code-reviewer`: Code quality review
- `qa`: Testing, validation
- `security-architect`: Security review, vulnerability analysis
- `technical-writer`: Documentation creation

---

## Prompt Optimization Fields (New)

These fields leverage 2026 prompt engineering research to improve agent reliability, reduce hallucinations, and increase task completion rates.

### `reasoning_style` (optional)

**Type**: `enum`
**Values**: `chain-of-thought`, `step-by-step`, `none`
**Default**: `step-by-step`

Controls how the agent reasons about the task.

**When to use each**:

| Style              | Use When                                 | Benefits                                                       | Example Task                                    |
| ------------------ | ---------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `chain-of-thought` | Complex problem requiring deep reasoning | Shows full reasoning path, reduces errors in logic-heavy tasks | Debugging race condition, architectural design  |
| `step-by-step`     | Multi-step task with clear sequence      | Decomposes problem, prevents skipping steps                    | Implementation with tests, refactoring workflow |
| `none`             | Simple, direct task with single output   | Faster execution, minimal overhead                             | Format conversion, simple fix                   |

**Example**:

```json
"reasoning_style": "step-by-step"
```

**Research**: Chain-of-thought prompting increases complex task performance by 15-30% ([Claude Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/chain-of-thought)).

### `examples` (optional)

**Type**: `array` (0-5 items)

Few-shot examples demonstrating expected behavior and output format. Provide 1-5 concrete examples.

**Structure**:

- `input` (string): Example input or task description
- `output` (string): Expected output format and content
- `explanation` (string): Why this example demonstrates best practices

**When to include examples**:

- Novel task type the agent hasn't seen before
- Complex output format requirements
- Edge cases that need explicit handling
- Demonstrating tone or style preferences

**Example**:

```json
"examples": [
  {
    "input": "Valid JWT token with 'admin' role accessing admin-only endpoint",
    "output": "Request proceeds to route handler; user object attached to request context",
    "explanation": "Demonstrates successful authentication and authorization flow"
  },
  {
    "input": "Expired JWT token accessing any protected endpoint",
    "output": "401 Unauthorized with error: 'Token expired'",
    "explanation": "Shows proper handling of expired tokens"
  }
]
```

**Research**: Few-shot examples guide model behavior and improve output quality by 20-40% ([BrainTrust Systematic Prompt Engineering](https://www.braintrust.dev/articles/systematic-prompt-engineering)).

### `uncertainty_permission` (optional)

**Type**: `boolean`
**Default**: `true`

Allow agent to respond "I don't know" or "I'm uncertain" instead of hallucinating answers.

**When to set to true** (recommended default):

- Research tasks where information may not exist
- Analysis tasks requiring expert knowledge
- Any task where incorrect answers are worse than no answer

**When to set to false**:

- Task where all information is provided in context
- Agent must make best-effort attempt even with incomplete data

**Example**:

```json
"uncertainty_permission": true
```

**Research**: Explicit permission to express uncertainty reduces hallucinations by 25-35% ([Claude Best Practices](https://platform.claude.com/docs/)).

### `output_format` (optional)

**Type**: `object`

Structured output format specification with XML tags for reasoning/answer separation.

**Structure**:

- `structure` (enum): `xml-tagged`, `json-only`, `markdown-sections`, `freeform`
- `sections` (array): Required sections in output

**Default sections**:

```json
"output_format": {
  "structure": "xml-tagged",
  "sections": [
    {
      "tag": "thinking",
      "description": "Agent's reasoning process (not shown to user)",
      "required": false
    },
    {
      "tag": "answer",
      "description": "Final deliverable or response",
      "required": true
    }
  ]
}
```

**Custom sections example**:

```json
"output_format": {
  "structure": "xml-tagged",
  "sections": [
    {
      "tag": "analysis",
      "description": "Problem analysis and root cause identification",
      "required": true
    },
    {
      "tag": "solution",
      "description": "Proposed solution with implementation steps",
      "required": true
    },
    {
      "tag": "risks",
      "description": "Potential risks and mitigation strategies",
      "required": true
    },
    {
      "tag": "validation",
      "description": "Self-check against success criteria",
      "required": true
    }
  ]
}
```

**Research**: XML-tagged outputs improve parsing reliability and enable hiding reasoning from end users ([Claude Extended Thinking](https://platform.claude.com/docs/)).

### `thinking_budget` (optional)

**Type**: `integer`
**Range**: 0-10000 tokens
**Default**: 1000

Token budget allocated for reasoning before producing final answer. Prevents premature conclusions.

**Guidance**:

- Simple tasks: 500-1000 tokens
- Medium complexity: 1000-2500 tokens
- Complex tasks: 2500-5000 tokens
- Very complex: 5000-10000 tokens

**Example**:

```json
"thinking_budget": 2000
```

**Research**: Allocating thinking budget improves solution quality by forcing deliberate reasoning before answering.

### `validation_schema` (optional)

**Type**: `object` (JSON Schema) or `null`
**Default**: `null`

JSON schema for validating agent output. Structured outputs improve reliability 30-60%.

**Example**:

```json
"validation_schema": {
  "type": "object",
  "required": ["middleware_created", "tests_created", "coverage_percentage"],
  "properties": {
    "middleware_created": {
      "type": "boolean",
      "description": "Whether auth-middleware.ts was successfully created"
    },
    "tests_created": {
      "type": "boolean",
      "description": "Whether test file was created with passing tests"
    },
    "coverage_percentage": {
      "type": "number",
      "minimum": 90,
      "description": "Code coverage percentage (must be >= 90%)"
    }
  }
}
```

**Research**: Structured outputs with JSON schemas improve reliability 30-60% ([AI Competence - JSON Prompting](https://aicompetence.org/json-prompting-supercharges-multi-agent-ai-systems/)).

### `mode` (optional)

**Type**: `enum`
**Values**: `plan`, `execute`, `analyze`
**Default**: `execute`

Agent operation mode. Different modes use different prompting strategies.

**Modes**:

| Mode      | Purpose                    | Agent Behavior                                 | Example Task                               |
| --------- | -------------------------- | ---------------------------------------------- | ------------------------------------------ |
| `plan`    | Create strategy or roadmap | Focus on planning, decomposition, alternatives | "Create implementation plan for feature X" |
| `execute` | Implement solution         | Focus on action, deliverables, validation      | "Implement auth middleware"                |
| `analyze` | Review or assess           | Focus on evaluation, findings, recommendations | "Analyze performance bottlenecks"          |

**Example**:

```json
"mode": "execute"
```

---

## Field Usage Guide

### Minimal Task (Quick Fixes)

For simple, low-risk tasks:

```json
{
  "task_id": "fix-typo-001",
  "objective": "Fix typo in user registration error message",
  "context": {
    "problem": "Error message says 'Passwrod' instead of 'Password'",
    "why_now": "User reported confusion in support ticket"
  },
  "deliverables": [
    {
      "type": "fix",
      "path": "src/auth/registration.ts",
      "description": "Correct typo in error message"
    }
  ],
  "constraints": {
    "max_time_minutes": 5,
    "max_file_reads": 2,
    "max_tokens": 10000
  },
  "success_criteria": ["Error message displays 'Password' correctly"],
  "priority": "low",
  "assigned_agent": "developer",
  "reasoning_style": "none"
}
```

### Standard Task (Most Common)

For typical implementation tasks:

```json
{
  "task_id": "implement-feature-001",
  "objective": "Implement user profile editing with validation",
  "context": {
    "problem": "Users cannot update their profile information",
    "why_now": "Feature request with high user demand",
    "related_files": ["src/components/UserProfile.tsx", "src/api/user.ts"]
  },
  "deliverables": [
    {
      "type": "file",
      "path": "src/components/ProfileEditor.tsx",
      "description": "Profile editing component with form validation"
    },
    {
      "type": "test",
      "path": "src/components/ProfileEditor.test.tsx",
      "description": "Test suite with validation edge cases"
    }
  ],
  "constraints": {
    "max_time_minutes": 30,
    "max_file_reads": 10,
    "max_tokens": 50000,
    "must_validate": true
  },
  "success_criteria": [
    "Users can edit name, email, bio fields",
    "Form validates email format and required fields",
    "Tests pass with >= 80% coverage"
  ],
  "priority": "medium",
  "assigned_agent": "developer",
  "reasoning_style": "step-by-step",
  "uncertainty_permission": true
}
```

### Complex Task (High Stakes)

For critical, high-risk tasks requiring maximum reliability:

```json
{
  "task_id": "security-audit-001",
  "objective": "Conduct security audit of authentication system and recommend fixes",
  "context": {
    "problem": "No formal security review has been done on auth system",
    "why_now": "SOC 2 compliance requires security audit before certification",
    "previous_attempts": ["Internal review found some issues but not comprehensive"],
    "related_files": ["src/auth/", "src/middleware/auth-middleware.ts", "src/config/jwt.config.ts"]
  },
  "deliverables": [
    {
      "type": "analysis",
      "path": ".claude/context/reports/auth-security-audit.md",
      "description": "Comprehensive security audit report with findings and recommendations",
      "format": "markdown",
      "validation": "Must follow OWASP Top 10 framework and include severity ratings"
    },
    {
      "type": "fix",
      "path": null,
      "description": "Critical vulnerability fixes (if any found)",
      "validation": "Security-architect must approve fixes"
    }
  ],
  "constraints": {
    "max_time_minutes": 90,
    "max_file_reads": 30,
    "max_tokens": 100000,
    "must_validate": true,
    "allowed_tools": ["Read", "Grep", "Glob"],
    "blocked_operations": ["Modifying production code without security-architect approval"]
  },
  "success_criteria": [
    "All authentication endpoints reviewed against OWASP Top 10",
    "Critical vulnerabilities identified with severity ratings",
    "Remediation recommendations with implementation guidance",
    "Security-architect approval before deployment"
  ],
  "priority": "critical",
  "assigned_agent": "security-architect",
  "reasoning_style": "chain-of-thought",
  "examples": [
    {
      "input": "JWT token without expiration claim",
      "output": "CRITICAL: Tokens never expire, allowing indefinite access. Recommendation: Add 'exp' claim with 1-hour expiration.",
      "explanation": "Demonstrates severity rating and actionable recommendation"
    }
  ],
  "uncertainty_permission": true,
  "output_format": {
    "structure": "xml-tagged",
    "sections": [
      {
        "tag": "methodology",
        "description": "Security audit methodology and scope",
        "required": true
      },
      {
        "tag": "findings",
        "description": "Security vulnerabilities with severity ratings",
        "required": true
      },
      {
        "tag": "recommendations",
        "description": "Remediation steps prioritized by severity",
        "required": true
      },
      {
        "tag": "validation",
        "description": "Self-check against OWASP Top 10 and SOC 2 requirements",
        "required": true
      }
    ]
  },
  "thinking_budget": 5000,
  "validation_schema": {
    "type": "object",
    "required": ["vulnerabilities_found", "severity_breakdown", "recommendations_count"],
    "properties": {
      "vulnerabilities_found": {
        "type": "integer",
        "minimum": 0,
        "description": "Total number of vulnerabilities identified"
      },
      "severity_breakdown": {
        "type": "object",
        "properties": {
          "critical": { "type": "integer" },
          "high": { "type": "integer" },
          "medium": { "type": "integer" },
          "low": { "type": "integer" }
        }
      },
      "recommendations_count": {
        "type": "integer",
        "minimum": 1,
        "description": "Number of remediation recommendations"
      }
    }
  },
  "mode": "analyze",
  "metadata": {
    "workflow_id": "soc2-compliance-workflow",
    "tags": ["security", "audit", "compliance", "authentication"],
    "research_sources": [
      "https://owasp.org/www-project-top-ten/",
      "https://www.soc2.com/requirements/"
    ]
  }
}
```

---

## Best Practices

### 1. Use Few-Shot Examples for Novel Tasks

When delegating a task type the agent hasn't seen before, include 1-3 concrete examples.

**Example**: First time implementing WebSocket connection

```json
"examples": [
  {
    "input": "Client connects with valid token",
    "output": "Connection accepted, client added to active sessions map",
    "explanation": "Shows successful connection flow"
  },
  {
    "input": "Client sends message without authentication",
    "output": "Connection rejected with 401 error",
    "explanation": "Demonstrates security enforcement"
  }
]
```

### 2. Set Appropriate Thinking Budget

Match thinking budget to task complexity:

```
Simple fix (typo, format): 0-500 tokens
Standard feature: 1000-2000 tokens
Complex refactoring: 2500-5000 tokens
Architecture design: 5000-10000 tokens
```

### 3. Use Structured Output for Validation

For tasks requiring verification, use validation_schema:

```json
"validation_schema": {
  "type": "object",
  "required": ["tests_pass", "coverage_percentage", "linting_errors"],
  "properties": {
    "tests_pass": { "type": "boolean" },
    "coverage_percentage": { "type": "number", "minimum": 80 },
    "linting_errors": { "type": "integer", "maximum": 0 }
  }
}
```

### 4. Enable Uncertainty Permission by Default

Unless the task explicitly requires a best-effort answer with incomplete information, set `uncertainty_permission: true` to reduce hallucinations.

### 5. Choose the Right Reasoning Style

- **chain-of-thought**: Debugging, architecture, complex analysis
- **step-by-step**: Implementation, refactoring, multi-step workflows
- **none**: Simple fixes, format conversions, direct tasks

### 6. Define Clear Success Criteria

Use SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound):

✅ "All unit tests pass with >= 90% code coverage"
✅ "API response time reduced from 500ms to <200ms"
❌ "Code is better" (not measurable)
❌ "Make it faster" (not specific)

### 7. Use Output Format for Complex Deliverables

When you need specific sections in the output:

```json
"output_format": {
  "structure": "xml-tagged",
  "sections": [
    { "tag": "problem_analysis", "description": "Root cause analysis", "required": true },
    { "tag": "solution", "description": "Implementation approach", "required": true },
    { "tag": "risks", "description": "Potential risks and mitigations", "required": true },
    { "tag": "validation", "description": "Testing strategy", "required": true }
  ]
}
```

---

## Examples by Task Type

### Implementation Task

```json
{
  "task_id": "implement-pagination-001",
  "objective": "Add pagination to user list API endpoint",
  "assigned_agent": "developer",
  "reasoning_style": "step-by-step",
  "mode": "execute",
  "thinking_budget": 1500,
  "uncertainty_permission": true,
  "examples": [
    {
      "input": "GET /users?page=1&limit=20",
      "output": "{ users: [...], total: 150, page: 1, totalPages: 8 }",
      "explanation": "Standard pagination response format"
    }
  ]
}
```

### Analysis Task

```json
{
  "task_id": "analyze-performance-001",
  "objective": "Analyze database query performance bottlenecks",
  "assigned_agent": "analyst",
  "reasoning_style": "chain-of-thought",
  "mode": "analyze",
  "thinking_budget": 3000,
  "uncertainty_permission": true,
  "output_format": {
    "structure": "xml-tagged",
    "sections": [
      { "tag": "methodology", "description": "Analysis approach", "required": true },
      { "tag": "findings", "description": "Bottlenecks identified", "required": true },
      { "tag": "recommendations", "description": "Optimization suggestions", "required": true }
    ]
  }
}
```

### Planning Task

```json
{
  "task_id": "plan-migration-001",
  "objective": "Create migration plan from REST API to GraphQL",
  "assigned_agent": "architect",
  "reasoning_style": "chain-of-thought",
  "mode": "plan",
  "thinking_budget": 5000,
  "uncertainty_permission": true,
  "output_format": {
    "structure": "xml-tagged",
    "sections": [
      { "tag": "current_state", "description": "Current REST API architecture", "required": true },
      { "tag": "target_state", "description": "Desired GraphQL architecture", "required": true },
      { "tag": "migration_steps", "description": "Phased migration plan", "required": true },
      { "tag": "risks", "description": "Migration risks and mitigations", "required": true }
    ]
  },
  "validation_schema": {
    "type": "object",
    "required": ["phases", "estimated_duration_weeks", "risk_level"],
    "properties": {
      "phases": { "type": "array", "minItems": 1 },
      "estimated_duration_weeks": { "type": "integer", "minimum": 1 },
      "risk_level": { "type": "string", "enum": ["low", "medium", "high"] }
    }
  }
}
```

---

## Research References

1. **Chain-of-Thought Prompting**
   [Claude Docs - Chain of Thought](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/chain-of-thought)
   Increases complex task performance by 15-30%

2. **Structured Outputs with JSON Schemas**
   [AI Competence - JSON Prompting](https://aicompetence.org/json-prompting-supercharges-multi-agent-ai-systems/)
   Improves reliability 30-60%

3. **Systematic Prompt Engineering**
   [BrainTrust - Systematic Prompt Engineering](https://www.braintrust.dev/articles/systematic-prompt-engineering)
   Few-shot examples improve output quality 20-40%

4. **Uncertainty Expression**
   [Claude Best Practices](https://platform.claude.com/docs/)
   Explicit permission to express uncertainty reduces hallucinations 25-35%

5. **Extended Thinking**
   [Claude Extended Thinking](https://platform.claudeusercontent.com/api/files/example)
   XML-tagged outputs enable reasoning separation and user experience optimization

---

## Validation

Validate agent-task JSON files against the schema:

```bash
# Using Node.js JSON Schema validator
node .claude/tools/enforcement-gate.mjs validate-schema \
  --schema .claude/schemas/agent-task.schema.json \
  --input .claude/context/tasks/my-task.json
```

---

## Version History

| Version | Date       | Changes                                                                                                                                           |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.0.0   | 2026-01-12 | Added 2026 prompt optimization fields: reasoning_style, examples, uncertainty_permission, output_format, thinking_budget, validation_schema, mode |
| 1.0.0   | 2025-12-01 | Initial release with core fields                                                                                                                  |

---

## See Also

- `.claude/schemas/agent-task.schema.json` - Full JSON schema
- `.claude/templates/agent-task-template.json` - Working template example
- `.claude/docs/AGENT_DIRECTORY.md` - Available agents and their capabilities
- `.claude/docs/ORCHESTRATION_PATTERNS.md` - Advanced task delegation patterns
