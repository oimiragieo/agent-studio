# LLM Architecture: {{system_name}}

## Overview
{{overview}}

## System Goals
1. {{goal_1}}
2. {{goal_2}}
3. {{goal_3}}

## Model Strategy

### Model Selection
| Use Case | Model | Rationale |
|----------|-------|-----------|
| {{use_case_1}} | {{model_1}} | {{rationale_1}} |
| {{use_case_2}} | {{model_2}} | {{rationale_2}} |
| {{use_case_3}} | {{model_3}} | {{rationale_3}} |

### Cost Optimization
{{cost_optimization}}

### Fallback Strategy
{{fallback_strategy}}

## RAG Pipeline

### Architecture
```
User Query
    |
    v
[Query Understanding]
    |
    v
[Embedding Generation] --> [Vector Store]
    |                           |
    v                           v
[Semantic Search] <-------- [Retrieval]
    |
    v
[Context Assembly]
    |
    v
[LLM Generation]
    |
    v
Response
```

### Embedding Strategy
- **Model**: {{embedding_model}}
- **Dimensions**: {{embedding_dimensions}}
- **Chunk Size**: {{chunk_size}}
- **Chunk Overlap**: {{chunk_overlap}}

### Vector Store
- **Database**: {{vector_db}}
- **Index Type**: {{index_type}}
- **Similarity Metric**: {{similarity_metric}}

### Retrieval Configuration
| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Top-K | {{top_k}} | {{top_k_rationale}} |
| Similarity Threshold | {{threshold}} | {{threshold_rationale}} |
| Hybrid Search | {{hybrid}} | {{hybrid_rationale}} |

## Prompt Engineering

### System Prompt Template
```
{{system_prompt}}
```

### User Prompt Template
```
{{user_prompt}}
```

### Context Template
```
{{context_template}}
```

### Prompt Optimization
{{prompt_optimization}}

## Context Management

### Context Window Strategy
- **Max Tokens**: {{max_tokens}}
- **Reserved for Response**: {{response_tokens}}
- **Context Prioritization**: {{context_priority}}

### Conversation Memory
{{conversation_memory}}

### Session Management
{{session_management}}

## Guardrails & Safety

### Input Validation
{{input_validation}}

### Output Filtering
{{output_filtering}}

### Content Moderation
{{content_moderation}}

### Hallucination Prevention
{{hallucination_prevention}}

## Performance Optimization

### Caching
| Cache Layer | TTL | Hit Rate Target |
|-------------|-----|-----------------|
| Embedding Cache | {{embed_ttl}} | {{embed_hit_rate}} |
| Response Cache | {{response_ttl}} | {{response_hit_rate}} |

### Streaming
{{streaming_strategy}}

### Batching
{{batching_strategy}}

## Evaluation & Monitoring

### Quality Metrics
| Metric | Measurement | Target |
|--------|-------------|--------|
| Relevance | {{relevance_measure}} | {{relevance_target}} |
| Groundedness | {{groundedness_measure}} | {{groundedness_target}} |
| Coherence | {{coherence_measure}} | {{coherence_target}} |

### Monitoring
{{monitoring_strategy}}

### A/B Testing
{{ab_testing}}

## Error Handling

### Rate Limiting
{{rate_limiting}}

### Retry Strategy
{{retry_strategy}}

### Graceful Degradation
{{graceful_degradation}}

## Cost Management

### Token Tracking
{{token_tracking}}

### Budget Alerts
{{budget_alerts}}

### Optimization Techniques
{{optimization_techniques}}

## Security

### API Key Management
{{api_key_management}}

### Data Privacy
{{data_privacy}}

### Audit Logging
{{audit_logging}}

---
*LLM Architecture designed for {{system_name}}.*
