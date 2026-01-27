# Ecosystem Assessor

Automatically analyzes agents and skills to recommend ecosystem integrations including hooks, MCP servers, and skills.

## Overview

When creating or updating agents/skills, the ecosystem assessor:

1. **Hook Assessment**: Analyzes keywords to recommend appropriate pre/post hooks
2. **MCP Discovery**: Scans configured MCP servers to find matches
3. **Skill Suggestions**: Identifies skills that should be created or assigned
4. **Action Plan**: Generates prioritized list of integration actions

## Usage

### Command Line

```bash
# Assess an agent
node .claude/tools/ecosystem-assessor/assess-ecosystem.mjs \
  --name "payment-processor" \
  --description "Handles payment transactions and billing"

# Assess a skill
node .claude/tools/ecosystem-assessor/assess-ecosystem.mjs \
  --type skill \
  --name "auth-validator" \
  --description "Validates authentication tokens"

# Get JSON output
node .claude/tools/ecosystem-assessor/assess-ecosystem.mjs \
  --name "github-specialist" --json
```

### Programmatic Usage

```javascript
import { assessEcosystem } from './assess-ecosystem.mjs';

const result = assessEcosystem({
  type: 'agent',
  name: 'payment-processor',
  description: 'Handles payment transactions',
  capabilities: ['Process payments', 'Generate invoices'],
});

console.log(result.recommendations);
```

## Hook Assessment

The hook assessor maps keywords to recommended hooks:

| Category       | Keywords                               | Recommended Hooks                                             |
| -------------- | -------------------------------------- | ------------------------------------------------------------- |
| Financial      | payment, financial, money, transaction | PreToolUse (validation), PostToolUse (audit)                  |
| Security       | auth, password, token, secret          | PreToolUse (scope check), UserPromptSubmit (intent detection) |
| Database       | database, migration, schema, sql       | PreToolUse (backup check, dry-run)                            |
| Deployment     | deploy, release, production            | PreToolUse (approval gate), PostToolUse (notify)              |
| Infrastructure | terraform, kubernetes, docker          | PreToolUse (plan-first, destructive check)                    |
| External API   | api, external, webhook, http           | PostToolUse (response validation)                             |

### Hook Templates

Available templates for common patterns:

- `financial-validation` - Validates financial operations
- `security-scope-check` - Blocks sensitive file access
- `audit-logger` - Logs operations to audit trail
- `backup-check` - Ensures backup exists before changes
- `deployment-gate` - Approval gate for deployments

```bash
# List available templates
node .claude/tools/ecosystem-assessor/hook-assessor.mjs --templates
```

## MCP Discovery

The MCP discoverer scans `.claude/.mcp.json` and matches servers to agent purposes:

| MCP Server | Related Skills         | Relevant Agents            |
| ---------- | ---------------------- | -------------------------- |
| github     | github-ops, github-mcp | developer, architect       |
| git        | git-expert             | developer                  |
| slack      | slack-notifications    | incident-responder, devops |
| postgres   | text-to-sql            | developer, data-expert     |
| kubernetes | kubernetes-flux        | devops                     |
| terraform  | terraform-infra        | devops, architect          |

```bash
# List configured MCP servers
node .claude/tools/ecosystem-assessor/mcp-discoverer.mjs --list
```

## Integration with Agent/Skill Creation

### In create-agent.mjs

```javascript
import { assessEcosystem } from '../ecosystem-assessor/assess-ecosystem.mjs';

// After creating agent, assess ecosystem
const assessment = assessEcosystem({
  type: 'agent',
  name: agentName,
  description: agentDescription,
});

if (assessment.summary.hasRecommendations) {
  displayRecommendations(assessment);
}
```

### In skill-creator create.cjs

```javascript
const { assessHooks } = require('../ecosystem-assessor/hook-assessor.mjs');

// When creating skill with --hooks flag
const hookRecs = assessHooks({
  name: skillName,
  description: skillDescription,
});

if (hookRecs.hasRecommendations) {
  suggestAdditionalHooks(hookRecs);
}
```

## Output Example

```
══════════════════════════════════════════════════════════════
  🔍 ECOSYSTEM ASSESSMENT: payment-processor
══════════════════════════════════════════════════════════════

📊 SUMMARY
────────────────────────────────────────
  Type: agent
  Critical items: 1
  High priority: 2
  Total recommendations: 4

⚠️  HOOK RECOMMENDATIONS
────────────────────────────────────────
  🔴 [CRITICAL] PreToolUse
     Purpose: Validate financial operations before execution
     Category: financial
     Matched: payment, transaction
     Template: financial-validation

  🟠 [HIGH] PostToolUse
     Purpose: Audit log for financial transactions
     Category: financial
     Template: audit-logger

🔗 MCP SERVER MATCHES
────────────────────────────────────────
  ✅ sqlite (score: 1)
     Matched: data
     Skill: text-to-sql
     Tools: mcp__sqlite__*

📋 ACTION PLAN
────────────────────────────────────────
  1. [CRITICAL] Create PreToolUse hook: Validate financial operations (manual)
  2. [HIGH] Create PostToolUse hook: Audit log for transactions (manual)
  3. [LOW] Add skill text-to-sql to agent (auto)
```

## Files

```
.claude/tools/ecosystem-assessor/
├── assess-ecosystem.mjs    # Main orchestrator
├── hook-assessor.mjs       # Hook recommendation engine
├── mcp-discoverer.mjs      # MCP server discovery
└── README.md               # This file
```

## Extending

### Add New Hook Patterns

Edit `hook-assessor.mjs` and add to `HOOK_PATTERNS`:

```javascript
const HOOK_PATTERNS = {
  // ... existing patterns ...
  myCategory: {
    keywords: ['keyword1', 'keyword2'],
    hooks: [
      {
        type: 'PreToolUse',
        purpose: 'Description of hook purpose',
        priority: 'high',
        template: 'my-template',
        matcher: 'Edit|Write',
      },
    ],
  },
};
```

### Add New MCP Mappings

Edit `mcp-discoverer.mjs` and add to `MCP_SKILL_MAPPING`:

```javascript
const MCP_SKILL_MAPPING = {
  // ... existing mappings ...
  'my-mcp-server': {
    skills: ['related-skill'],
    agents: ['developer', 'devops'],
    keywords: ['keyword1', 'keyword2'],
    toolPrefix: 'mcp__my-mcp-server__',
  },
};
```
