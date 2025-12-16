# RAG Evaluation Guide

## Overview

Systematic evaluation framework for RAG (Retrieval Augmented Generation) quality. Evaluates both retrieval accuracy and end-to-end answer quality.

## Evaluation Metrics

### Retrieval Metrics

**Precision**: Percentage of retrieved documents that are relevant
```
Precision = (Relevant Retrieved) / (Total Retrieved)
```

**Recall**: Percentage of relevant documents that were retrieved
```
Recall = (Relevant Retrieved) / (Total Relevant)
```

**F1 Score**: Harmonic mean of precision and recall
```
F1 = 2 * (Precision * Recall) / (Precision + Recall)
```

### End-to-End Metrics

**Relevance** (0-1): How relevant is the answer to the query?

**Completeness** (0-1): How complete is the answer?

**Accuracy** (0-1): How accurate is the information?

**Overall Quality** (0-1): Overall assessment

## Evaluation Process

### 1. Create Evaluation Dataset

Format: `.claude/evaluation/datasets/rag-dataset.jsonl`

```json
{
  "query": "How is user authentication implemented?",
  "expected_retrieval": [
    "src/auth/middleware.ts",
    "src/auth/types.ts",
    "src/auth/utils.ts"
  ],
  "ground_truth_answer": "User authentication uses JWT tokens with middleware validation...",
  "category": "authentication"
}
```

### 2. Run Retrieval Evaluation

Evaluates how well the RAG system retrieves relevant files:

```bash
python .claude/evaluation/rag-eval.py \
  --mode retrieval \
  --dataset .claude/evaluation/datasets/rag-dataset.jsonl \
  --output .claude/evaluation/results/rag-retrieval.json
```

**Metrics**:
- Average precision
- Average recall
- Average F1 score
- Missing files
- Extra files

### 3. Run End-to-End Evaluation

Evaluates the quality of final answers:

```bash
python .claude/evaluation/rag-eval.py \
  --mode end_to_end \
  --dataset .claude/evaluation/datasets/rag-dataset.jsonl \
  --output .claude/evaluation/results/rag-end-to-end.json
```

**Metrics**:
- Average relevance
- Average completeness
- Average accuracy
- Average overall quality

### 4. Run Both Evaluations

```bash
python .claude/evaluation/rag-eval.py \
  --mode both \
  --dataset .claude/evaluation/datasets/rag-dataset.jsonl \
  --output .claude/evaluation/results/rag-complete.json
```

## Evaluation Dataset

### Creating Test Cases

**Query Types**:
- **Symbol queries**: "UserAuthentication class"
- **Concept queries**: "authentication middleware logic"
- **Pattern queries**: "How is error handling implemented?"
- **Structure queries**: "Where are API routes defined?"

**Expected Retrieval**:
- List of file paths that should be retrieved
- Can include patterns (e.g., `src/app/api/**/route.ts`)
- Should be comprehensive but not exhaustive

**Ground Truth Answers**:
- Expected answer to the query
- Should be accurate and complete
- Used for end-to-end evaluation

### Dataset Categories

Organize by category:
- **authentication**: Auth-related queries
- **api_structure**: API organization queries
- **database**: Database-related queries
- **components**: Component queries
- **utilities**: Utility function queries

## Integration with repo-rag Skill

The repo-rag skill uses RAG evaluation to:
- Measure search quality
- Improve retrieval strategies
- Track performance over time
- Identify areas for improvement

### Evaluation Workflow

1. **Create Dataset**: Build comprehensive test cases
2. **Run Evaluation**: Test current RAG performance
3. **Analyze Results**: Identify weak areas
4. **Improve RAG**: Update search strategies
5. **Re-evaluate**: Measure improvements

## Best Practices

### 1. Comprehensive Test Cases

- Cover common use cases
- Include edge cases
- Test different query types
- Update as codebase evolves

### 2. Regular Evaluation

- After codebase changes
- After RAG improvements
- Before major releases
- In CI/CD pipeline

### 3. Track Metrics Over Time

- Precision trends
- Recall trends
- Answer quality trends
- Improvement tracking

### 4. Use Results to Improve

- Identify weak retrieval areas
- Improve search strategies
- Refine query processing
- Update indexing

## Promptfoo Integration

### Retrieval Evaluation Config

```yaml
description: "RAG Retrieval Evaluation"

providers:
  - custom: retrieval_provider

tests:
  - vars:
      query: "How is authentication implemented?"
      expected_files: ["src/auth/middleware.ts"]
    assert:
      - type: contains-all
        value: ["src/auth/middleware.ts"]
```

### End-to-End Evaluation Config

```yaml
description: "RAG End-to-End Evaluation"

providers:
  - claude-sonnet-4-5:
      id: anthropic:claude-sonnet-4-5-20250929

tests:
  - vars:
      query: "How is authentication implemented?"
      expected_answer: "User authentication uses JWT tokens..."
    assert:
      - type: model-graded
        value: "Answer quality and relevance"
```

## Troubleshooting

### Low Precision

- Too many irrelevant files retrieved
- Improve search query processing
- Refine file filtering
- Update indexing

### Low Recall

- Missing relevant files
- Improve search coverage
- Expand search scope
- Review indexing

### Low Answer Quality

- Poor retrieval results
- Insufficient context
- Improve answer generation
- Enhance RAG pipeline

## Related Documentation

- [Evaluation Guide](EVALUATION_GUIDE.md) - Comprehensive evaluation guide
- [repo-rag Skill](../skills/repo-rag/SKILL.md) - RAG implementation
- [Evaluation Framework](../evaluation/README.md) - Framework overview

## References

- [RAG Evaluation Cookbook](https://github.com/anthropics/anthropic-cookbook/tree/main/capabilities/retrieval_augmented_generation/evaluation)
- [Promptfoo Documentation](https://promptfoo.dev/docs/)

