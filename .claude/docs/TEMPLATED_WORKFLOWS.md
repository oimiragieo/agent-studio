# Templated Workflows

## Overview

Templated workflows use placeholder variables (e.g., `{{primary_agent}}`, `{{fallback_agent}}`) to create reusable, generic workflow patterns. These workflows are instantiated dynamically at runtime with concrete agent values.

## When to Use Placeholders vs Concrete Agents

### Use Placeholders When:

1. **Testing Frameworks**: Workflows designed to test orchestration patterns with multiple agent combinations
   - Example: `fallback-routing-flow.yaml` tests fallback routing with any primary/fallback agent pair
   - Benefit: Single workflow definition tests all agent combinations

2. **Reusable Templates**: Workflows that need to be instantiated multiple times with different agents
   - Example: A generic "validation workflow" that can use any validator agent
   - Benefit: DRY principle - maintain one workflow instead of multiple copies

3. **Dynamic Routing**: Workflows where agent selection depends on runtime context
   - Example: Multi-model validation routing to different AI validators
   - Benefit: Flexible routing based on runtime conditions

### Use Concrete Agents When:

1. **Production Workflows**: Workflows for specific use cases with defined agent responsibilities
   - Example: `greenfield-fullstack.yaml` uses specific agents (planner, architect, developer, etc.)
   - Benefit: Clear, predictable agent assignments

2. **Single-Purpose Workflows**: Workflows designed for one specific task
   - Example: `auth-flow.yaml` for authentication implementation
   - Benefit: Explicit agent assignments improve readability

3. **Critical Paths**: Workflows where agent expertise is critical to success
   - Example: Security-sensitive workflows requiring specific security-architect agent
   - Benefit: Guaranteed correct agent expertise

## Placeholder Syntax

### Standard Placeholders

- `{{primary_agent}}` - Primary agent for task execution
- `{{fallback_agent}}` - Fallback agent for error recovery
- `{{workflow_id}}` - Unique workflow instance identifier
- `{{run_id}}` - Unique run identifier
- `{{plan_id}}` - Plan document identifier

### Custom Placeholders

Workflows can define custom placeholders in `workflow_inputs` section:

```yaml
workflow_inputs:
  required:
    - primary_agent # Custom placeholder
    - test_scenario # Custom placeholder
  optional:
    - max_fallback_attempts # Optional placeholder
```

## Validator Handling of Placeholders

### Current Behavior

Validators (e.g., `workflow-validator.mjs`) currently treat placeholders as missing agent definitions and flag them as errors.

**Example Error**:

```
❌ Step 1 references undefined agent: {{primary_agent}}
```

### Recommended Validator Strategy

1. **Detect Template Mode**: Check for placeholders in agent field

   ```javascript
   const isTemplated = /\{\{.*\}\}/.test(step.agent);
   ```

2. **Validate Placeholder Declaration**: Ensure placeholders are declared in `workflow_inputs`

   ```javascript
   if (isTemplated) {
     const placeholder = step.agent.match(/\{\{(.*)\}\}/)[1];
     if (
       !workflowInputs.required.includes(placeholder) &&
       !workflowInputs.optional.includes(placeholder)
     ) {
       errors.push(`Undeclared placeholder: ${placeholder}`);
     }
   }
   ```

3. **Skip Agent Existence Check**: For templated workflows, skip validation that agent exists in `.claude/agents/`

   ```javascript
   if (!isTemplated && !agentExists(step.agent)) {
     errors.push(`Undefined agent: ${step.agent}`);
   }
   ```

4. **Validate at Instantiation**: Validate concrete agent values when workflow is instantiated
   ```javascript
   // At runtime, before executing step
   const concreteAgent = resolveplaceholder(step.agent, runtimeInputs);
   if (!agentExists(concreteAgent)) {
     throw new Error(`Invalid agent: ${concreteAgent}`);
   }
   ```

## Example: Templated Workflow

### Definition (fallback-routing-flow.yaml)

```yaml
name: Fallback Routing Test Workflow
type: testing

workflow_inputs:
  required:
    - primary_agent # Dynamic agent selection
    - failure_type # Test scenario
  optional:
    - max_fallback_attempts

steps:
  - step: 1
    name: 'Primary Agent Execution'
    agent: '{{primary_agent}}' # Placeholder
    inputs:
      - test_scenario
    outputs:
      - artifacts.json
```

### Instantiation (at runtime)

```javascript
const runtimeInputs = {
  primary_agent: 'architect', // Concrete value
  failure_type: 'timeout',
  max_fallback_attempts: 3,
};

// Validator checks:
// 1. primary_agent declared in workflow_inputs.required ✓
// 2. primary_agent resolves to valid agent "architect" ✓
// 3. Execute step with agent "architect"
```

## Workflow-Level vs Step-Level Inputs

### Workflow-Level Context Inputs

Provided at workflow start, available to all steps, not artifact files:

```yaml
workflow_inputs:
  required:
    - primary_agent # Context input
    - test_scenario # Context input
```

**Usage in Steps**:

```yaml
steps:
  - step: 1
    agent: '{{primary_agent}}' # Use context input
    inputs:
      - test_scenario # Reference context input
```

### Step-Level Artifact Inputs

Files produced by previous steps:

```yaml
steps:
  - step: 1
    inputs:
      - plan-{{workflow_id}}.json (from step 0) # Artifact file
      - test_scenario # Context input (not a file)
```

## Validator Implementation Checklist

- [ ] Detect placeholder syntax `{{...}}` in agent field
- [ ] Validate placeholders declared in `workflow_inputs`
- [ ] Skip agent existence check for placeholders
- [ ] Validate concrete agents at instantiation time
- [ ] Distinguish workflow-level context inputs from artifact files
- [ ] Document placeholder usage in workflow YAML comments

## Migration Path for fallback-routing-flow.yaml

### Option 1: Keep Templated (Recommended for Testing)

- Maintain placeholders for flexibility
- Update validators to handle placeholders correctly
- Document that this is a test framework workflow

### Option 2: Convert to Concrete Agents

- Replace `{{primary_agent}}` with specific agent (e.g., `architect`)
- Replace `{{fallback_agent}}` with specific fallback (e.g., `developer`)
- Lose flexibility but gain explicit agent assignments

**Recommendation**: Keep templated for `fallback-routing-flow.yaml` since it's a test framework workflow designed to validate fallback patterns with multiple agent combinations.

## Best Practices

1. **Document Placeholder Intent**: Add comments explaining why placeholders are used
2. **Validate at Multiple Points**: Validate placeholder declarations (definition time) and concrete values (instantiation time)
3. **Explicit Fallbacks**: Even with placeholders, define concrete fallback agent lists in `fallback_agents` section
4. **Test Mode Flag**: Use `test_mode: true` to signal templated test workflows
5. **Runtime Validation**: Always validate concrete agent values before step execution

## Related Documentation

- `.claude/workflows/WORKFLOW-GUIDE.md` - Workflow execution and structure
- `.claude/tools/workflow_runner.js` - Workflow execution engine
- `.claude/workflows/fallback-routing-flow.yaml` - Example templated workflow
- `.claude/workflows/greenfield-fullstack.yaml` - Example concrete workflow
