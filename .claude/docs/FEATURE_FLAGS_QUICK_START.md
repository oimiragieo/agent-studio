# Feature Flags Quick Start Guide

## Overview

Feature flags enable gradual, safe rollout of A2A protocol integration components with instant rollback capability.

**Key Benefits**:

- ✅ Granular control over 8 A2A components
- ✅ Environment-aware (dev, staging, prod)
- ✅ Instant rollback without redeployment
- ✅ Automatic dependency validation
- ✅ Complete audit trail
- ✅ Safe defaults (all flags OFF)

---

## Quick Start (30 seconds)

### 1. Check if a feature is enabled

```javascript
import { isEnabled } from '.claude/tools/feature-flags-manager.mjs';

if (isEnabled('agent_card_generation')) {
  // Feature enabled - execute A2A code
  const agentCard = generateAgentCard(agentDef);
} else {
  // Feature disabled - use fallback
  return routeViaKeywords(agentDef);
}
```

### 2. Validate dependencies before enabling

```javascript
import { validateDependencies } from '.claude/tools/feature-flags-manager.mjs';

const validation = validateDependencies('streaming_support');
if (!validation.valid) {
  console.error('Missing dependencies:', validation.missingDependencies);
  // Cannot enable - dependencies not met
}
```

### 3. Get all flags for current environment

```javascript
import { getFlags } from '.claude/tools/feature-flags-manager.mjs';

const flags = getFlags(); // Uses NODE_ENV or defaults to 'dev'
console.log('Current flags:', flags);
// { agent_card_generation: true, ... }
```

---

## Common Use Cases

### Use Case 1: Conditional Feature Execution

```javascript
import { isEnabled } from '.claude/tools/feature-flags-manager.mjs';

export function handleMessage(message) {
  if (isEnabled('a2a_message_wrapper')) {
    // A2A protocol enabled
    return handleA2AMessage(message);
  }

  // Legacy behavior
  return handleLegacyMessage(message);
}
```

### Use Case 2: Phase-Based Rollout

```javascript
import { FeatureFlagsManager } from '.claude/tools/feature-flags-manager.mjs';

const manager = new FeatureFlagsManager();

// Get flags for POC phase
const pocFlags = manager.getFlagsByPhase('POC');
console.log('POC flags:', pocFlags);
// ['agent_card_generation', 'agent_card_discovery']

// Enable all POC flags in dev
for (const flagName of pocFlags) {
  manager.updateFlag(flagName, true, 'dev', 'developer');
}
```

### Use Case 3: Safe Rollback

```javascript
import { FeatureFlagsManager } from '.claude/tools/feature-flags-manager.mjs';

const manager = new FeatureFlagsManager();

// Instant disable without redeployment
manager.updateFlag('streaming_support', false, 'prod', 'incident-responder');

// Verify disabled
console.log('Disabled:', !manager.isEnabled('streaming_support', 'prod'));
```

---

## Available Flags

| Flag                    | Phase     | Dependencies                                                  | Default |
| ----------------------- | --------- | ------------------------------------------------------------- | ------- |
| `agent_card_generation` | POC       | None                                                          | OFF     |
| `agent_card_discovery`  | POC       | agent_card_generation                                         | OFF     |
| `memory_a2a_bridge`     | Memory    | agent_card_generation                                         | OFF     |
| `a2a_message_wrapper`   | Lifecycle | agent_card_generation                                         | OFF     |
| `task_state_manager`    | Lifecycle | a2a_message_wrapper                                           | OFF     |
| `push_notifications`    | External  | task_state_manager                                            | OFF     |
| `streaming_support`     | External  | a2a_message_wrapper, task_state_manager                       | OFF     |
| `external_federation`   | External  | agent_card_discovery, a2a_message_wrapper, task_state_manager | OFF     |

---

## Environment Overrides

Flags can have different values per environment:

```javascript
// feature-flags.json
{
  "agent_card_generation": {
    "enabled": false,  // Global default
    "environments": {
      "dev": true,     // Enabled in dev
      "staging": false,
      "prod": false
    }
  }
}
```

Check for specific environment:

```javascript
const enabledInDev = isEnabled('agent_card_generation', 'dev'); // true
const enabledInProd = isEnabled('agent_card_generation', 'prod'); // false
```

---

## Manager API Reference

### Core Methods

```javascript
import { FeatureFlagsManager } from '.claude/tools/feature-flags-manager.mjs';

const manager = new FeatureFlagsManager();

// Check if flag enabled
manager.isEnabled('flag_name', 'dev');

// Validate dependencies
manager.validateDependencies('flag_name');
// Returns: { valid: true/false, missingDependencies: [] }

// Get all flags for environment
manager.getFlags('dev');

// Get flag details
manager.getFlagDetails('flag_name');

// Update flag (modifies config file)
manager.updateFlag('flag_name', true, 'staging', 'user');

// Log to audit trail
manager.auditLog('flag_name', 'enable', 'user', { reason: '...' });

// Get audit history
manager.getAuditLog('flag_name', 10); // Last 10 entries

// Get flags by phase
manager.getFlagsByPhase('POC');

// Get rollout status
manager.getRolloutStatus('dev');

// Check if flag can be safely enabled
manager.canEnableFlag('flag_name', 'dev');
// Returns: { canEnable: true/false, blockers: [] }
```

---

## Rollback Procedures

### Instant Rollback (No Redeployment)

**Step 1**: Disable flag

```javascript
import { FeatureFlagsManager } from '.claude/tools/feature-flags-manager.mjs';

const manager = new FeatureFlagsManager();
manager.updateFlag('streaming_support', false, 'prod', 'incident-responder');
```

**Step 2**: Verify

```bash
node -e "
const { isEnabled } = require('./.claude/tools/feature-flags-manager.mjs');
console.log('Enabled:', isEnabled('streaming_support', 'prod'));
"
```

No restart required - next request checks updated state.

---

## Audit Trail

All flag changes are logged to `.claude/context/logs/feature-flags-audit.log`:

```json
{
  "timestamp": "2025-01-13T10:30:00Z",
  "flag": "agent_card_generation",
  "action": "enable",
  "user": "developer",
  "metadata": { "env": "staging", "reason": "Phase 1 validation complete" }
}
```

Query audit log:

```javascript
const manager = new FeatureFlagsManager();

// Get last 10 changes to specific flag
const entries = manager.getAuditLog('agent_card_generation', 10);

// Get all changes
const allEntries = manager.getAuditLog();
```

---

## Testing with Feature Flags

### Unit Tests

```javascript
import { FeatureFlagsManager } from '.claude/tools/feature-flags-manager.mjs';

describe('MyFeature', () => {
  it('should work with flag enabled', () => {
    const manager = new FeatureFlagsManager();
    manager.updateFlag('my_flag', true, 'dev');

    const result = myFeature();
    expect(result).toBe('A2A behavior');
  });

  it('should work with flag disabled', () => {
    const manager = new FeatureFlagsManager();
    manager.updateFlag('my_flag', false, 'dev');

    const result = myFeature();
    expect(result).toBe('Legacy behavior');
  });
});
```

---

## Troubleshooting

### Flag not changing

**Problem**: Updated flag but behavior unchanged.

**Solution**: Reload config:

```javascript
const manager = new FeatureFlagsManager();
manager.reload(); // Reload from disk
```

### Dependency errors

**Problem**: Flag enabled but dependencies missing.

**Solution**: Use `canEnableFlag()` before enabling:

```javascript
const check = manager.canEnableFlag('streaming_support', 'dev');
if (!check.canEnable) {
  console.error('Blockers:', check.blockers);
  // Enable dependencies first
}
```

### Audit log not created

**Problem**: Audit entries not appearing.

**Solution**: Ensure audit enabled in config:

```json
{
  "audit": {
    "enabled": true,
    "log_path": ".claude/context/logs/feature-flags-audit.log"
  }
}
```

---

## Files and Locations

| File                                                             | Purpose                        |
| ---------------------------------------------------------------- | ------------------------------ |
| `.claude/config/feature-flags.json`                              | Configuration file (all flags) |
| `.claude/tools/feature-flags-manager.mjs`                        | Manager module (API)           |
| `.claude/context/logs/feature-flags-audit.log`                   | Audit trail                    |
| `.claude/schemas/feature-flags.schema.json`                      | JSON Schema validation         |
| `.claude/context/reports/feature-flags-implementation-report.md` | Full documentation             |

---

## Advanced Usage

### Programmatic Rollout

```javascript
const manager = new FeatureFlagsManager();

// Enable flags in rollout order
const flagsInOrder = manager.getFlagsInRolloutOrder();

for (const flagName of flagsInOrder) {
  const check = manager.canEnableFlag(flagName, 'staging');
  if (check.canEnable) {
    manager.updateFlag(flagName, true, 'staging', 'automation');
    console.log(`Enabled: ${flagName}`);
  } else {
    console.log(`Skipped: ${flagName} (blockers: ${check.blockers})`);
  }
}
```

### Rollout Status Dashboard

```javascript
const manager = new FeatureFlagsManager();

const status = manager.getRolloutStatus('prod');

console.log('=== A2A Rollout Status ===');
for (const [phase, phaseStatus] of Object.entries(status)) {
  const progress = `${phaseStatus.enabled}/${phaseStatus.total}`;
  const icon = phaseStatus.complete ? '✅' : '⏳';
  console.log(`${icon} ${phase}: ${progress}`);
}
```

---

## Best Practices

1. **Always check dependencies** before enabling a flag
2. **Use environment overrides** for gradual rollout (dev → staging → prod)
3. **Log changes to audit trail** with meaningful metadata
4. **Test with flags both ON and OFF** in unit tests
5. **Monitor rollout status** to track phase completion
6. **Document rollback procedures** for each flag
7. **Keep flags temporary** - remove after full rollout complete

---

## Next Steps

1. Read full documentation: `.claude/context/reports/feature-flags-implementation-report.md`
2. Review A2A integration architecture: `.claude/context/artifacts/a2a-integration-architecture.md`
3. Run demo: `node .claude/context/tmp/tmp-feature-flags-demo.mjs`
4. Run tests: `node .claude/tools/feature-flags-manager.test.mjs`

---

**Questions?** See `.claude/context/reports/feature-flags-implementation-report.md` for detailed documentation.
