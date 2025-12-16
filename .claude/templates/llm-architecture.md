<template_structure>
# LLM Architecture: {{system_name}}

## Metadata
- **Version**: {{version}}
- **Created**: {{created_date}}
- **Last Modified**: {{last_modified}}
- **Author**: {{author}}
- **Status**: {{status}} (draft/review/approved)
- **Related Documents**: {{related_docs}}

## Use Case
- **Task**: {{task_description}}
- **Users**: {{target_users}}
- **Constraints**: {{constraints}}
- **Success Criteria**: {{success_criteria}}

## Model Selection
### Primary Model
- **Model**: {{primary_model}}
- **Version**: {{version}}
- **Provider**: {{provider}}
- **Context Window**: {{context_window}}
- **Cost per Token**: {{cost}}
- **Latency**: {{latency}}ms
- **Throughput**: {{throughput}} req/s

### Fallback Model
- **Model**: {{fallback_model}}
- **Version**: {{fallback_version}}
- **Provider**: {{fallback_provider}}
- **Trigger Conditions**: {{trigger_conditions}}

### Model Comparison Matrix
| Model | Strengths | Weaknesses | Use Case | Cost | Latency | Context Window |
|-------|-----------|------------|----------|------|---------|----------------|
| {{model}} | {{strengths}} | {{weaknesses}} | {{use_case}} | {{cost}} | {{latency}} | {{context_window}} |

## Routing Strategy
### When to Switch Models
{{routing_conditions}}

### Tool Selection
{{tool_selection_strategy}}

### Skill Selection
{{skill_selection_strategy}}

### Cost Optimization
{{cost_optimization_strategy}}

## Context Management
### Retrieval Strategy
{{retrieval_strategy}}

### Memory Limits
- **Context Window**: {{context_window}}
- **Token Budget**: {{token_budget}}
- **Memory Management**: {{memory_management}}

### Redaction Strategy
{{redaction_strategy}}

### Context Compression
{{context_compression}}

## Safety & Guardrails
### Guardrails
{{guardrails}}

### PII Handling
{{pii_handling}}

### Jailbreak Mitigations
{{jailbreak_mitigations}}

### Content Filtering
{{content_filtering}}

### Rate Limiting
{{rate_limiting}}

## Evaluation Framework
### Metrics
{{evaluation_metrics}}

### Test Datasets
{{test_datasets}}

### Success Criteria
{{success_criteria}}

### Evaluation Process
{{evaluation_process}}

## Operations
### Logging
{{logging_strategy}}

### Observability
{{observability_setup}}

### Rate Limits
{{rate_limits}}

### Error Handling
{{error_handling_strategy}}

### Monitoring
{{monitoring_setup}}

### Alerting
{{alerting_rules}}

## Cost Analysis
- **Estimated Monthly Cost**: {{monthly_cost}}
- **Cost per Request**: {{cost_per_request}}
- **Cost Optimization Strategies**: {{cost_optimization}}

## Related Documents
- Architecture: {{architecture_link}}
- Implementation Plan: {{implementation_plan_link}}
- Test Plan: {{test_plan_link}}

---
</template_structure>

<usage_instructions>
**When to Use**: When creating architecture documents for LLM/AI systems.

**Required Sections**: Use Case, Model Selection, Routing Strategy, Prompt Engineering, Observability Setup.

**Template Variables**: All `{{variable}}` placeholders should be replaced with actual values when using this template.

**Best Practices**: This LLM architecture follows best practices for AI system design and operations.
</usage_instructions>
