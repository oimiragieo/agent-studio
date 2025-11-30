# Command: /ai-system

Launch an AI/LLM system development workflow.

## Usage

```
/ai-system                       # Start AI system workflow
/ai-system "build a chatbot"     # With initial requirements
```

## What This Command Does

Invokes the **ai-system-flow** workflow with this agent sequence:

1. **Model Orchestrator** - Multi-model strategy
   - Model selection for different tasks
   - Cost/performance trade-offs
   - Fallback strategies
   - Provider diversification
   - Rate limiting considerations

2. **LLM Architect** - System design
   - RAG pipeline design
   - Embedding strategy
   - Vector database selection
   - Prompt engineering patterns
   - Context management
   - Guardrails and safety

3. **API Designer** - Interface design
   - Streaming endpoint patterns
   - Request/response schemas
   - Error handling for AI failures
   - Rate limiting and quotas
   - Webhook integrations

4. **Developer** - Implementation
   - LLM integration code
   - RAG pipeline implementation
   - Vector store integration
   - Prompt templates

5. **QA** - AI quality validation
   - Prompt testing
   - Response quality assessment
   - Hallucination detection
   - Edge case handling

## When to Use

- Building chatbots or conversational AI
- Implementing RAG systems
- Adding AI features to existing apps
- Creating AI-powered search
- Building content generation tools

## Outputs

- `model-strategy.json` - Model selection plan
- `llm-architecture.json` - System architecture
- `api-specification.json` - API design
- `ai-test-results.json` - Quality assessment

## See Also

- `/scaffold` - Generate AI boilerplate
- `/performance` - Optimize AI system performance
