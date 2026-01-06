---
name: openai-api
description: OpenAI API for chat completions, embeddings, and assistants
version: 2.0.0
allowed-tools: [Bash, Read, WebFetch]
primary-agents: [llm-architect, developer]
supporting-agents: [qa, security-architect]
skill-category: ai-integration
context-efficiency: high
requires-env: [OPENAI_API_KEY]
optional-env: [OPENAI_ORG_ID, OPENAI_BASE_URL]
---

# OpenAI API Skill

## Purpose

Provides direct integration with OpenAI's API for chat completions, embeddings, assistants, file operations, and fine-tuning. Enables AI-powered features without relying on MCP servers.

## When to Use

**Primary Use Cases**:
- Chat completion generation (streaming and non-streaming)
- Text embeddings for semantic search and RAG systems
- Assistant creation and management
- File upload/management for assistants
- Model information retrieval
- Fine-tuning job management (with explicit confirmation)

**Triggered By**:
- "Generate chat completion using OpenAI"
- "Create embeddings for semantic search"
- "Set up OpenAI assistant"
- "List available OpenAI models"
- "Upload file to OpenAI"
- "Fine-tune a model" (requires confirmation)

## Tool Categories

### 1. Chat Completions

**chat**: Generate chat completion (non-streaming)
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}],
    "temperature": 0.7
  }'
```

**chat-stream**: Generate streaming chat completion
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

### 2. Embeddings

**embed**: Generate single embedding
```bash
curl https://api.openai.com/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "Your text here"
  }'
```

**embed-batch**: Generate embeddings for multiple texts
```bash
curl https://api.openai.com/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "text-embedding-3-small",
    "input": ["Text 1", "Text 2", "Text 3"]
  }'
```

### 3. Assistants

**list-assistants**: List all assistants
```bash
curl https://api.openai.com/v1/assistants \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "OpenAI-Beta: assistants=v2"
```

**create-assistant**: Create new assistant
```bash
curl https://api.openai.com/v1/assistants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "OpenAI-Beta: assistants=v2" \
  -d '{
    "model": "gpt-4",
    "name": "Assistant Name",
    "instructions": "System instructions here",
    "tools": [{"type": "code_interpreter"}]
  }'
```

**create-thread**: Create conversation thread
```bash
curl https://api.openai.com/v1/threads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "OpenAI-Beta: assistants=v2" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**run-assistant**: Run assistant on thread
```bash
curl https://api.openai.com/v1/threads/{thread_id}/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "OpenAI-Beta: assistants=v2" \
  -d '{
    "assistant_id": "{assistant_id}"
  }'
```

### 4. File Operations

**list-files**: List all uploaded files
```bash
curl https://api.openai.com/v1/files \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**upload-file**: Upload file for assistants/fine-tuning
```bash
curl https://api.openai.com/v1/files \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F purpose="assistants" \
  -F file="@path/to/file.pdf"
```

**delete-file**: Delete uploaded file
```bash
curl -X DELETE https://api.openai.com/v1/files/{file_id} \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### 5. Models

**list-models**: List all available models
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**model-info**: Get specific model details
```bash
curl https://api.openai.com/v1/models/{model_id} \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### 6. Fine-tuning (⚠️ CONFIRMATION REQUIRED)

**list-jobs**: List fine-tuning jobs
```bash
curl https://api.openai.com/v1/fine_tuning/jobs \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**create-job**: Create fine-tuning job (⚠️ COSTS MONEY)
```bash
# REQUIRES USER CONFIRMATION - INCURS SIGNIFICANT COSTS
curl https://api.openai.com/v1/fine_tuning/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "training_file": "file-abc123",
    "model": "gpt-3.5-turbo",
    "hyperparameters": {
      "n_epochs": 3
    }
  }'
```

## Security Requirements

### API Key Management

**CRITICAL: Never expose API key in logs, files, or responses**

1. **Environment Variable**: Always use `$OPENAI_API_KEY` environment variable
2. **Never Hard-code**: Never include API key in code or configuration files
3. **Secure Storage**: Store in `.env` file (add to `.gitignore`)
4. **Rotation**: Rotate keys periodically via OpenAI dashboard

### Fine-tuning Confirmation

**MANDATORY: Fine-tuning incurs significant costs and MUST have user confirmation**

Before creating fine-tuning job:
1. Confirm with user: "⚠️ Fine-tuning will incur costs. Estimated cost: $X. Proceed? (yes/no)"
2. Document training data size and expected cost
3. Only proceed with explicit "yes" confirmation
4. Log fine-tuning job details for audit trail

### Data Privacy

- **PII Handling**: Never send PII or sensitive data to OpenAI without encryption/redaction
- **Compliance**: Ensure OpenAI usage complies with GDPR/HIPAA/SOC2 requirements
- **Data Retention**: Understand OpenAI's data retention policies

## Agent Integration

### Primary Agents

**llm-architect**:
- Design RAG systems using embeddings
- Configure assistants for AI features
- Optimize model selection and parameters
- Plan fine-tuning strategies

**developer**:
- Implement chat completion integrations
- Build embedding pipelines
- Integrate assistants into applications
- Upload files for processing

### Supporting Agents

**qa**:
- Test API integrations
- Validate embedding quality
- Verify assistant responses

**security-architect**:
- Audit API key usage
- Review data privacy compliance
- Validate security controls

## Usage Patterns

### Pattern 1: Chat Completion Integration

```typescript
// Developer implements chat completion
async function getChatCompletion(prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### Pattern 2: Embedding-based Search

```typescript
// LLM-architect designs semantic search
async function semanticSearch(query: string, documents: string[]): Promise<string[]> {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 2. Generate document embeddings (batch)
  const docEmbeddings = await generateEmbeddings(documents);

  // 3. Calculate cosine similarity
  const similarities = docEmbeddings.map((docEmb, idx) => ({
    document: documents[idx],
    similarity: cosineSimilarity(queryEmbedding, docEmb)
  }));

  // 4. Return top matches
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map(s => s.document);
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });

  const data = await response.json();
  return data.data[0].embedding;
}
```

### Pattern 3: Assistant Integration

```typescript
// Developer integrates OpenAI assistant
class OpenAIAssistantClient {
  async createAssistant(name: string, instructions: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        name,
        instructions,
        tools: [{ type: 'code_interpreter' }]
      })
    });

    const data = await response.json();
    return data.id;
  }

  async chat(assistantId: string, message: string): Promise<string> {
    // Create thread
    const thread = await this.createThread(message);

    // Run assistant
    const run = await this.runAssistant(assistantId, thread.id);

    // Wait for completion
    await this.waitForCompletion(thread.id, run.id);

    // Get response
    return await this.getLatestMessage(thread.id);
  }
}
```

## Error Handling

### Common Errors

**401 Unauthorized**:
- Check `OPENAI_API_KEY` environment variable is set
- Verify API key is valid via OpenAI dashboard
- Ensure key has required permissions

**429 Rate Limit**:
- Implement exponential backoff
- Use batch operations when possible
- Consider upgrading API tier

**400 Bad Request**:
- Validate request payload matches API spec
- Check model availability
- Verify file format for uploads

**500 Server Error**:
- Retry with exponential backoff
- Check OpenAI status page
- Implement fallback logic

### Retry Logic

```typescript
async function callOpenAIWithRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Best Practices

1. **Use Environment Variables**: Never hard-code API keys
2. **Implement Retry Logic**: Handle transient errors gracefully
3. **Batch Operations**: Use batch embeddings for efficiency
4. **Cache Results**: Cache embeddings and completions when possible
5. **Monitor Costs**: Track API usage to avoid unexpected bills
6. **Validate Inputs**: Sanitize user inputs before sending to API
7. **Stream Responses**: Use streaming for better UX in chat applications
8. **Error Handling**: Implement comprehensive error handling
9. **Rate Limiting**: Respect API rate limits with backoff
10. **Security**: Never log API keys or sensitive data

## Context Efficiency

**High Efficiency** (90%+ savings vs MCP):
- Skill loads only when invoked
- No persistent MCP server connection
- Minimal context footprint
- Direct API calls without MCP overhead

## Related Skills

- `repo-rag`: Semantic search using embeddings
- `text-to-sql`: Natural language to SQL conversion
- `summarizer`: Text summarization using chat completions
- `classifier`: Text classification using chat completions
- `evaluator`: Response evaluation using chat completions

## Validation

To validate OpenAI API integration:

```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test chat completion
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }'

# Test embeddings
curl https://api.openai.com/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "Test"
  }'
```

## Changelog

- **2.0.0** (2026-01-05): Restructured with YAML metadata, curl examples, and enhanced security focus
- **1.0.0** (2026-01-05): Initial skill creation with Python examples
