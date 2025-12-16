# RAG Implementation Patterns

Comprehensive guide to implementing Retrieval Augmented Generation (RAG) systems based on Claude Cookbooks patterns. This guide covers basic RAG, advanced techniques, and evaluation best practices.

## Overview

RAG enables Claude to leverage your internal knowledge bases or customer support documents, significantly enhancing its ability to answer domain-specific questions. This guide demonstrates progressive implementation levels from basic to advanced.

## Level 1: Basic RAG (Naive Approach)

The simplest RAG implementation, sometimes called "Naive RAG."

### Implementation Steps

1. **Chunk Documents**: Split documents by heading or fixed size
2. **Embed Each Chunk**: Create embeddings for each document chunk
3. **Retrieve Similar Chunks**: Use cosine similarity to find relevant chunks
4. **Generate Answer**: Pass retrieved chunks as context to Claude

### Example Implementation

```python
from anthropic import Anthropic
import numpy as np
from typing import List, Dict

client = Anthropic()

def basic_rag(query: str, documents: List[Dict], k: int = 3):
    """
    Basic RAG implementation.
    
    Args:
        query: User query
        documents: List of document chunks with embeddings
        k: Number of chunks to retrieve
    """
    # 1. Embed query
    query_embedding = create_embedding(query)
    
    # 2. Calculate similarities
    similarities = []
    for doc in documents:
        similarity = cosine_similarity(query_embedding, doc["embedding"])
        similarities.append((similarity, doc))
    
    # 3. Retrieve top-k chunks
    similarities.sort(reverse=True)
    top_chunks = [doc for _, doc in similarities[:k]]
    
    # 4. Build context
    context = "\n\n".join([chunk["text"] for chunk in top_chunks])
    
    # 5. Generate answer
    prompt = f"""
    You have been tasked with helping us to answer the following query:
    <query>
    {query}
    </query>
    
    You have access to the following documents which are meant to provide context:
    <documents>
    {context}
    </documents>
    
    Please remain faithful to the underlying context, and only deviate from it if you are 100% sure that you know the answer already.
    Answer the question now, and avoid providing preamble such as 'Here is the answer', etc.
    """
    
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=2500,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    
    return response.content[0].text
```

### Characteristics

- **Simple**: Easy to implement
- **Fast**: Minimal processing overhead
- **Limited**: No re-ranking or advanced techniques
- **Baseline**: Good starting point for evaluation

## Level 2: Summary Indexing

Enhance basic RAG by creating summaries of document sections for better retrieval.

### Implementation Steps

1. **Create Section Summaries**: Generate summaries for each document section
2. **Embed Summaries**: Create embeddings for summaries (not full text)
3. **Two-Stage Retrieval**: 
   - First: Retrieve relevant sections using summary embeddings
   - Second: Retrieve full chunks from selected sections
4. **Generate Answer**: Use full chunks as context

### Benefits

- **Better Retrieval**: Summaries capture key concepts more accurately
- **Reduced Noise**: Focus on relevant sections
- **Improved Precision**: Less irrelevant content in context

### Example Implementation

```python
def summary_indexing_rag(query: str, documents: List[Dict], k: int = 3):
    """
    RAG with summary indexing.
    
    Args:
        query: User query
        documents: List of document sections with summaries and embeddings
        k: Number of sections to retrieve
    """
    # 1. Embed query
    query_embedding = create_embedding(query)
    
    # 2. Calculate similarities with summaries
    similarities = []
    for doc in documents:
        # Use summary embedding, not full text embedding
        similarity = cosine_similarity(query_embedding, doc["summary_embedding"])
        similarities.append((similarity, doc))
    
    # 3. Retrieve top-k sections
    similarities.sort(reverse=True)
    top_sections = [doc for _, doc in similarities[:k]]
    
    # 4. Build context from full chunks of selected sections
    context = "\n\n".join([chunk["full_text"] for chunk in top_sections])
    
    # 5. Generate answer (same as basic RAG)
    # ... (prompt and generation code)
```

## Level 3: Re-ranking with Claude

Use Claude to re-rank retrieved chunks for better relevance ordering.

### Implementation Steps

1. **Initial Retrieval**: Get top-k chunks using embedding similarity (k=10-20)
2. **Re-rank with Claude**: Use Claude to score and re-rank chunks
3. **Select Top Chunks**: Take top-ranked chunks (k=3-5)
4. **Generate Answer**: Use re-ranked chunks as context

### Benefits

- **Better Ranking**: Claude understands semantic relevance better than embeddings
- **Improved Precision**: Most relevant chunks ranked first
- **Higher Quality**: Better context leads to better answers

### Example Implementation

```python
def reranking_rag(query: str, documents: List[Dict], initial_k: int = 20, final_k: int = 3):
    """
    RAG with Claude re-ranking.
    
    Args:
        query: User query
        documents: List of document chunks with embeddings
        initial_k: Number of chunks for initial retrieval
        final_k: Number of chunks after re-ranking
    """
    # 1. Initial retrieval (embedding-based)
    query_embedding = create_embedding(query)
    similarities = []
    for doc in documents:
        similarity = cosine_similarity(query_embedding, doc["embedding"])
        similarities.append((similarity, doc))
    
    similarities.sort(reverse=True)
    candidate_chunks = [doc for _, doc in similarities[:initial_k]]
    
    # 2. Re-rank with Claude
    rerank_prompt = f"""
    You are helping to rank document chunks by relevance to a query.
    
    Query: {query}
    
    Chunks:
    {chr(10).join([f"{i+1}. {chunk['text'][:200]}..." for i, chunk in enumerate(candidate_chunks)])}
    
    Rank the chunks by relevance to the query. Return a JSON array of chunk indices (1-indexed) in order of relevance.
    """
    
    rerank_response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=500,
        messages=[{"role": "user", "content": rerank_prompt}],
        temperature=0,
    )
    
    # Parse ranking
    ranked_indices = parse_ranking(rerank_response.content[0].text)
    
    # 3. Select top chunks
    top_chunks = [candidate_chunks[i-1] for i in ranked_indices[:final_k]]
    
    # 4. Generate answer
    context = "\n\n".join([chunk["text"] for chunk in top_chunks])
    # ... (prompt and generation code)
```

## Evaluation Best Practices

### Separate Retrieval and End-to-End Evaluation

**Critical**: Evaluate retrieval and end-to-end performance separately.

1. **Retrieval Evaluation**: Test if correct chunks are retrieved
2. **End-to-End Evaluation**: Test if final answers are correct

### Retrieval Metrics

Use `.claude/evaluation/retrieval_metrics.py`:

- **Precision**: Proportion of retrieved chunks that are relevant
- **Recall**: Proportion of relevant chunks that were retrieved
- **F1 Score**: Harmonic mean of precision and recall
- **MRR**: Mean Reciprocal Rank (ranking quality)

### End-to-End Metrics

Use `.claude/evaluation/end_to_end_eval.py`:

- **LLM-as-Judge**: Claude evaluates answer correctness
- **Substance-based**: Focuses on meaning, not exact wording
- **Completeness**: Checks for missing information
- **Contradiction Detection**: Identifies incorrect information

### Evaluation Dataset Structure

```json
{
  "query": "How do I configure authentication?",
  "correct_chunks": ["auth_config.md", "api_setup.md"],
  "correct_answer": "Authentication is configured using API keys...",
  "category": "authentication",
  "difficulty": "medium"
}
```

### Running Evaluations

```bash
# Retrieval evaluation
python .claude/evaluation/retrieval_metrics.py \
  --dataset .claude/evaluation/datasets/rag_eval.json \
  --output results/retrieval.json

# End-to-end evaluation
python .claude/evaluation/end_to_end_eval.py \
  --dataset .claude/evaluation/datasets/rag_eval.json \
  --output results/end_to_end.json
```

## Performance Improvements

### Expected Gains (Based on Cookbooks)

From basic RAG to Level 3 (with re-ranking):
- **Precision**: 0.43 → 0.44
- **Recall**: 0.66 → 0.69
- **F1 Score**: 0.52 → 0.54
- **MRR**: 0.74 → 0.87
- **End-to-End Accuracy**: 71% → 81%

### Optimization Tips

1. **Chunk Size**: 200-500 tokens per chunk (balance detail vs. noise)
2. **Retrieval Count**: Start with k=3, increase if recall is low
3. **Re-ranking**: Use for important queries, skip for simple lookups
4. **Embedding Model**: Use high-quality embeddings (Voyage AI, OpenAI)
5. **Temperature**: Use temperature=0 for deterministic retrieval

## Integration with repo-rag Skill

The `repo-rag` skill uses these patterns:

- **Symbol Search**: For finding code structures (classes, functions)
- **Semantic Search**: For finding concepts and patterns
- **Hybrid Approach**: Combines both for comprehensive retrieval

See `.claude/skills/repo-rag/SKILL.md` for usage patterns.

## Common Pitfalls

### 1. Chunking Too Small

**Problem**: Chunks too small lose context
**Solution**: Use semantic chunking (by heading/section) rather than fixed size

### 2. Retrieving Too Many Chunks

**Problem**: Too much context dilutes relevance
**Solution**: Start with k=3, increase only if needed

### 3. Ignoring Re-ranking

**Problem**: Embedding similarity doesn't always match semantic relevance
**Solution**: Use Claude re-ranking for important queries

### 4. Not Evaluating Separately

**Problem**: Can't identify if issue is retrieval or generation
**Solution**: Evaluate retrieval and end-to-end separately

## References

- [Claude Cookbooks - RAG Guide](https://github.com/anthropics/anthropic-cookbook/tree/main/capabilities/retrieval_augmented_generation)
- [Retrieval Metrics](../evaluation/retrieval_metrics.py)
- [End-to-End Evaluation](../evaluation/end_to_end_eval.py)
- [RAG Evaluation Guide](./RAG_EVALUATION.md)
- [repo-rag Skill](../skills/repo-rag/SKILL.md)
