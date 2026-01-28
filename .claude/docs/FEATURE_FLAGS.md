# Feature Flags

**Version**: 1.0.0
**Last Updated**: 2026-01-28
**Maintainer**: Developer Team

Feature flags enable safe, gradual rollout of new features with the ability to disable them immediately if issues arise.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Usage](#usage)
4. [Configuration](#configuration)
5. [Available Feature Flags](#available-feature-flags)
6. [Environment Variables](#environment-variables)
7. [Runtime API](#runtime-api)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The feature flag system provides three levels of control:

1. **Environment Variables** (highest priority) - Emergency override capability
2. **Config File** (`.claude/config.yaml`) - Default configuration
3. **Runtime API** (in-memory) - Dynamic toggling during development

### Benefits

- **Safe Rollout**: Enable features for specific users/environments
- **Emergency Disable**: Turn off features immediately without code changes
- **A/B Testing**: Compare feature impact with/without activation
- **Gradual Adoption**: Roll out to 10%, 50%, 100% of users
- **Cost Control**: Monitor costs before full rollout

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   FeatureFlagManager                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Priority (highest to lowest):                               │
│  1. Environment Variables  (PARTY_MODE_ENABLED=true)        │
│  2. Config File            (features.partyMode.enabled)     │
│  3. Runtime API            (enable/disable methods)         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         v                    v                    v
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Skills    │      │   Agents    │      │    Hooks    │
│             │      │             │      │             │
│ isEnabled() │      │ isEnabled() │      │ isEnabled() │
│ getConfig() │      │ getConfig() │      │ getConfig() │
└─────────────┘      └─────────────┘      └─────────────┘
```

---

## Usage

### Basic Usage (JavaScript)

```javascript
const featureFlags = require('./.claude/lib/utils/feature-flags.cjs');

// Check if feature is enabled
if (featureFlags.isEnabled('features.partyMode.enabled')) {
  console.log('Party Mode is enabled');
  // Enable multi-agent collaboration
}

// Get full configuration
const config = featureFlags.getConfig('partyMode');
console.log('Max agents:', config.maxAgents); // 5
console.log('Turn limit:', config.turnLimit); // 20
console.log('Cost limit:', config.costLimit); // 50.0
```

### Usage in Skills

```javascript
// .claude/skills/party-mode/party-mode-orchestrator.cjs
const featureFlags = require('../../lib/utils/feature-flags.cjs');

function startPartyMode() {
  // Check if feature is enabled
  if (!featureFlags.isEnabled('features.partyMode.enabled')) {
    console.warn('[party-mode] Feature disabled via flag');
    return { success: false, reason: 'feature_disabled' };
  }

  // Get configuration
  const config = featureFlags.getConfig('partyMode');
  const maxAgents = config.maxAgents || 5;
  const turnLimit = config.turnLimit || 20;

  // Proceed with party mode
  return orchestrateAgents(maxAgents, turnLimit);
}
```

### Usage in Hooks

```javascript
// .claude/hooks/routing/elicitation-wrapper.cjs
const featureFlags = require('../../lib/utils/feature-flags.cjs');

function preToolUse(tool, params, context) {
  if (tool === 'Task' && featureFlags.isEnabled('features.advancedElicitation.enabled')) {
    // Wrap task with elicitation
    const config = featureFlags.getConfig('advancedElicitation');
    if (context.confidence < config.minConfidence) {
      console.log('[elicitation] Skipping - confidence too low');
      return { tool, params };
    }
    // Apply elicitation
    return wrapWithElicitation(tool, params, config);
  }
  return { tool, params };
}
```

---

## Configuration

### Config File (`.claude/config.yaml`)

Default configuration for all features:

```yaml
# --- Feature Flags (Gradual Rollout System) ---
features:
  partyMode:
    enabled: false  # Multi-agent collaboration (default: off)
    maxAgents: 5    # Maximum agents per round
    turnLimit: 20   # Maximum turns per session
    costLimit: 50.0 # Cost limit per session (USD)

  advancedElicitation:
    enabled: false  # Advanced meta-cognitive reasoning (default: off)
    methods:        # Available reasoning methods
      - first-principles
      - pre-mortem
      - socratic
      - red-team-blue-team
    costBudget: 10.0    # Budget for elicitation queries (USD)
    minConfidence: 0.7  # Skip if confidence below threshold
```

---

## Available Feature Flags

### 1. Party Mode (`features.partyMode`)

**Purpose**: Multi-agent collaboration in single conversation

**Flag**: `features.partyMode.enabled`

**Configuration**:
- `maxAgents` (default: 5) - Maximum agents per round
- `turnLimit` (default: 20) - Maximum turns per session
- `costLimit` (default: 50.0) - Cost limit per session (USD)

**Environment Variable**: `PARTY_MODE_ENABLED=true|false`

**Usage**:
```javascript
if (featureFlags.isEnabled('features.partyMode.enabled')) {
  const config = featureFlags.getConfig('partyMode');
  startPartyMode(config.maxAgents, config.turnLimit);
}
```

**Risks**:
- Context overflow (multi-agent responses)
- Cost scaling (N agents = N LLM calls)
- Response conflicts

**Mitigation**:
- Context summarization after 10 turns
- Agent limit enforced (4 max)
- Cost tracking integration

---

### 2. Advanced Elicitation (`features.advancedElicitation`)

**Purpose**: Meta-cognitive reasoning with 15+ methods

**Flag**: `features.advancedElicitation.enabled`

**Configuration**:
- `methods` (array) - Available reasoning methods
- `costBudget` (default: 10.0) - Budget for queries (USD)
- `minConfidence` (default: 0.7) - Skip if confidence < threshold

**Environment Variable**: `ELICITATION_ENABLED=true|false`

**Usage**:
```javascript
if (featureFlags.isEnabled('features.advancedElicitation.enabled')) {
  const config = featureFlags.getConfig('advancedElicitation');
  if (confidence >= config.minConfidence) {
    applyElicitation(config.methods, config.costBudget);
  }
}
```

**Risks**:
- 2x LLM cost (elicitation = second pass)
- Method selection may be irrelevant

**Mitigation**:
- Cost tracking integration
- Confidence threshold filtering
- User opt-in required

---

## Environment Variables

Environment variables provide the **highest priority** override for emergency situations.

### Available Variables

| Variable | Feature | Values | Priority |
|----------|---------|--------|----------|
| `PARTY_MODE_ENABLED` | Party Mode | `true`, `false`, `1`, `0` | Highest |
| `ELICITATION_ENABLED` | Advanced Elicitation | `true`, `false`, `1`, `0` | Highest |

### Usage

**Windows (PowerShell)**:
```powershell
# Enable party mode
$env:PARTY_MODE_ENABLED = "true"

# Disable advanced elicitation
$env:ELICITATION_ENABLED = "false"

# Restart Claude Code session
```

**Unix/Mac**:
```bash
# Enable party mode
export PARTY_MODE_ENABLED=true

# Disable advanced elicitation
export ELICITATION_ENABLED=false

# Restart Claude Code session
```

**Verification**:
```bash
# Check environment variable
echo $PARTY_MODE_ENABLED

# Test feature flag
node -e "const ff = require('./.claude/lib/utils/feature-flags.cjs'); console.log('Party Mode:', ff.isEnabled('features.partyMode.enabled'));"
```

---

## Runtime API

Runtime API allows dynamic toggling during development (in-memory only, does not persist).

### Methods

#### `isEnabled(flagName)`

Check if a feature flag is enabled.

```javascript
const enabled = featureFlags.isEnabled('features.partyMode.enabled');
// Returns: boolean
```

#### `getConfig(featureName)`

Get full configuration object for a feature.

```javascript
const config = featureFlags.getConfig('partyMode');
// Returns: { enabled: false, maxAgents: 5, turnLimit: 20, costLimit: 50.0 }
```

#### `enable(flagName)`

Enable a feature flag at runtime (in-memory only).

```javascript
featureFlags.enable('features.partyMode.enabled');
// Flag is now enabled for this session
```

#### `disable(flagName)`

Disable a feature flag at runtime (in-memory only).

```javascript
featureFlags.disable('features.partyMode.enabled');
// Flag is now disabled for this session
```

#### `persist()`

Persist runtime changes back to config file (optional, use with caution).

```javascript
featureFlags.enable('features.partyMode.enabled');
featureFlags.persist();
// Config file is updated on disk
```

**Warning**: `persist()` modifies `.claude/config.yaml` directly. Use only during development.

---

## Best Practices

### 1. Default to OFF

All new features should be **disabled by default** in config.yaml:

```yaml
features:
  newFeature:
    enabled: false  # Always start disabled
```

### 2. Environment Variables for Production

Use environment variables for production overrides:

```bash
# Production emergency disable
export PARTY_MODE_ENABLED=false
```

### 3. Type Safety

Always check configuration exists before accessing properties:

```javascript
const config = featureFlags.getConfig('partyMode');
if (!config) {
  console.error('Party mode config not found');
  return;
}
const maxAgents = config.maxAgents || 5;  // Fallback to default
```

### 4. Graceful Degradation

Features should fail gracefully when disabled:

```javascript
if (!featureFlags.isEnabled('features.partyMode.enabled')) {
  console.warn('[party-mode] Feature disabled, falling back to single-agent mode');
  return singleAgentMode();
}
```

### 5. Logging

Log feature flag state at startup:

```javascript
console.log('[feature-flags] Party Mode:', featureFlags.isEnabled('features.partyMode.enabled'));
console.log('[feature-flags] Advanced Elicitation:', featureFlags.isEnabled('features.advancedElicitation.enabled'));
```

### 6. Testing

Test both enabled and disabled states:

```javascript
describe('Party Mode', () => {
  it('should work when enabled', () => {
    featureFlags.enable('features.partyMode.enabled');
    // Test enabled behavior
  });

  it('should fallback when disabled', () => {
    featureFlags.disable('features.partyMode.enabled');
    // Test disabled behavior
  });
});
```

---

## Troubleshooting

### Issue: Feature is enabled but not working

**Diagnosis**:
```javascript
// Check flag state
console.log('Enabled:', featureFlags.isEnabled('features.partyMode.enabled'));

// Check config
console.log('Config:', featureFlags.getConfig('partyMode'));
```

**Possible Causes**:
1. Environment variable override
2. Config file not loaded
3. Code not checking flag

**Fix**:
```bash
# Clear environment variable
unset PARTY_MODE_ENABLED

# Restart session
```

---

### Issue: Environment variable not working

**Diagnosis**:
```bash
# Check environment variable is set
echo $PARTY_MODE_ENABLED

# Check with Node
node -e "console.log('Env:', process.env.PARTY_MODE_ENABLED)"
```

**Possible Causes**:
1. Variable not exported
2. Session not restarted
3. Typo in variable name

**Fix**:
```bash
# Export variable
export PARTY_MODE_ENABLED=true

# Restart Claude Code completely
```

---

### Issue: Config file changes not reflecting

**Diagnosis**:
```bash
# Check config file
cat .claude/config.yaml | grep -A 5 "features:"

# Check parsed config
node -e "const yaml = require('js-yaml'); const fs = require('fs'); const config = yaml.load(fs.readFileSync('.claude/config.yaml', 'utf8')); console.log(config.features);"
```

**Possible Causes**:
1. YAML syntax error
2. Config not reloaded
3. Environment variable override

**Fix**:
```bash
# Validate YAML
node -e "const yaml = require('js-yaml'); yaml.load(require('fs').readFileSync('.claude/config.yaml', 'utf8'));"

# Clear environment overrides
unset PARTY_MODE_ENABLED
unset ELICITATION_ENABLED

# Restart session
```

---

### Issue: Feature flag coercion not working

**Diagnosis**:
```javascript
// Check type
const enabled = featureFlags.isEnabled('features.partyMode.enabled');
console.log('Type:', typeof enabled);  // Should be 'boolean'
console.log('Value:', enabled);
```

**Possible Causes**:
1. String not coerced to boolean
2. Invalid value (not 'true', 'false', '1', '0')

**Fix**:
```bash
# Use valid values
export PARTY_MODE_ENABLED=true  # Not "yes" or "1"
```

---

## Related Documentation

- [Rollback Procedures](./ROLLBACK_PROCEDURES.md) - Emergency disable procedures
- [Architecture Review](../context/artifacts/research-reports/architecture-review-upgrade-roadmap-20260128.md) - Feature design decisions
- [Security Review](../context/artifacts/research-reports/security-review-upgrade-roadmap-20260128.md) - Security implications

---

**Document Version**: 1.0.0
**Next Review**: 2026-02-28
**Maintained By**: Developer Team
