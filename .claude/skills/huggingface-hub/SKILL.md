---
name: huggingface-hub
description: Hugging Face Hub integration for model and dataset operations
allowed-tools: [Bash, Read, WebFetch]
category: ai-tools
requires-env: []
optional-env: [HF_TOKEN, HF_HOME]
---

# Hugging Face Hub Skill

## Overview

The Hugging Face Hub skill provides seamless integration with the Hugging Face model and dataset repository, enabling model discovery, download, and inference operations.

**Context Savings**: 90%+ reduction vs raw MCP server by providing focused, task-specific interfaces to Hugging Face Hub capabilities.

**Use Cases**:

- Model discovery and evaluation
- Dataset exploration and download
- Quick inference testing
- Model card analysis
- Repository management

## Requirements

**Python Dependencies**:

```bash
pip install huggingface_hub transformers torch
```

**Optional Authentication**:

```bash
# For private models/datasets and inference API
export HF_TOKEN="your_hf_token_here"

# Login via CLI
huggingface-cli login
```

**Installation Verification**:

```bash
python -c "import huggingface_hub; print(huggingface_hub.__version__)"
huggingface-cli --version
```

## Tools (Progressive Disclosure)

### Model Operations

| Tool               | Description                                           | Example                              |
| ------------------ | ----------------------------------------------------- | ------------------------------------ |
| `search-models`    | Search HF Hub for models by keywords, tags, or author | Search for "text-generation" models  |
| `model-info`       | Retrieve model card, metadata, and configuration      | Get info for "gpt2"                  |
| `download-model`   | Download model files to local cache                   | Download "bert-base-uncased"         |
| `list-model-files` | List all files in a model repository                  | List files in "openai/whisper-large" |

### Dataset Operations

| Tool               | Description                                    | Example                                  |
| ------------------ | ---------------------------------------------- | ---------------------------------------- |
| `search-datasets`  | Search for datasets by keywords, tags, or task | Search for "sentiment-analysis" datasets |
| `dataset-info`     | Get dataset card, metadata, and structure      | Get info for "squad"                     |
| `download-dataset` | Download dataset files to local cache          | Download "imdb" dataset                  |
| `stream-dataset`   | Stream dataset without full download           | Stream "c4" dataset                      |

### Inference Operations

| Tool                  | Description                                 | Example                            |
| --------------------- | ------------------------------------------- | ---------------------------------- |
| `run-inference`       | Run inference on Hugging Face hosted models | Generate text with "gpt2"          |
| `text-generation`     | Generate text completions                   | Text completion with custom prompt |
| `text-classification` | Classify text into categories               | Sentiment analysis                 |
| `feature-extraction`  | Extract embeddings from text                | Get BERT embeddings                |

### Repository Operations

| Tool          | Description                              | Example                  |
| ------------- | ---------------------------------------- | ------------------------ |
| `create-repo` | Create a new model or dataset repository | Create "myuser/my-model" |
| `upload-file` | Upload files to a repository             | Upload model checkpoint  |
| `delete-file` | Delete files from a repository           | Remove old checkpoint    |
| `repo-info`   | Get repository metadata and stats        | Get repo info            |

## Quick Reference

### Search for Models

```bash
# Search by task
huggingface-cli search models --task text-generation --limit 5

# Search by author
huggingface-cli search models --author openai --limit 10

# Search with filters
huggingface-cli search models --filter "license:apache-2.0" --limit 5
```

### Get Model Information

```bash
# Get full model card
huggingface-cli info openai/whisper-large

# Get model config
python -c "from huggingface_hub import model_info; print(model_info('gpt2').pipeline_tag)"
```

### Download Models

```bash
# Download entire model
huggingface-cli download bert-base-uncased

# Download specific files
huggingface-cli download bert-base-uncased --include "*.safetensors"

# Download to custom location
huggingface-cli download gpt2 --cache-dir ./models
```

### Run Inference

```python
from huggingface_hub import InferenceClient

client = InferenceClient()

# Text generation
result = client.text_generation("Once upon a time", model="gpt2")
print(result)

# Sentiment analysis
result = client.text_classification("I love this product!", model="distilbert-base-uncased-finetuned-sst-2-english")
print(result)

# Feature extraction
embeddings = client.feature_extraction("Hello world", model="sentence-transformers/all-MiniLM-L6-v2")
print(embeddings)
```

### Work with Datasets

```bash
# Search datasets
huggingface-cli search datasets --task text-classification --limit 5

# Get dataset info
huggingface-cli info imdb --type dataset

# Download dataset (via Python)
python -c "from datasets import load_dataset; ds = load_dataset('imdb', split='train[:100]')"
```

### Repository Management

```bash
# Create new repo
huggingface-cli repo create my-awesome-model --type model

# Upload file
huggingface-cli upload myuser/my-model ./model.safetensors

# Delete file
huggingface-cli delete myuser/my-model --file old_model.bin
```

## Configuration

### Environment Variables

| Variable                   | Purpose                                                  | Default                  |
| -------------------------- | -------------------------------------------------------- | ------------------------ |
| `HF_TOKEN`                 | Authentication token for private repos and inference API | None                     |
| `HF_HOME`                  | Custom cache directory for models and datasets           | `~/.cache/huggingface`   |
| `HF_ENDPOINT`              | Custom Hub endpoint (for enterprise deployments)         | `https://huggingface.co` |
| `HF_HUB_DISABLE_TELEMETRY` | Disable anonymous telemetry                              | `0`                      |

### Token Setup

```bash
# Method 1: Environment variable
export HF_TOKEN="hf_..."

# Method 2: CLI login (recommended)
huggingface-cli login

# Method 3: Python API
from huggingface_hub import login
login(token="hf_...")
```

### Cache Management

```bash
# Check cache size
huggingface-cli scan-cache

# Delete specific cached models
huggingface-cli delete-cache --model bert-base-uncased

# Clear entire cache
rm -rf ~/.cache/huggingface
```

## Agent Integration

### Primary Agents

| Agent             | Use Case                                                |
| ----------------- | ------------------------------------------------------- |
| **llm-architect** | Model selection, architecture design, RAG system design |
| **developer**     | Model integration, inference implementation             |
| **analyst**       | Dataset exploration, model evaluation                   |

### Secondary Agents

| Agent                    | Use Case                                |
| ------------------------ | --------------------------------------- |
| **qa**                   | Model testing, benchmark validation     |
| **performance-engineer** | Model optimization, inference profiling |
| **security-architect**   | Model security review, bias detection   |

### Integration Pattern

```python
# LLM Architect: Model selection
from huggingface_hub import list_models

models = list_models(
    task="text-generation",
    filter="license:apache-2.0",
    sort="downloads",
    limit=10
)

for model in models:
    print(f"{model.id}: {model.downloads} downloads")

# Developer: Model integration
from transformers import pipeline

generator = pipeline("text-generation", model="gpt2")
result = generator("Once upon a time", max_length=50)

# Analyst: Dataset exploration
from datasets import load_dataset

dataset = load_dataset("imdb", split="train[:100]")
print(dataset.features)
print(dataset[0])
```

## Examples

### Example 1: Find and Download a Model

```bash
# Search for question-answering models
huggingface-cli search models --task question-answering --sort downloads --limit 5

# Get detailed info about top model
huggingface-cli info deepset/roberta-base-squad2

# Download the model
huggingface-cli download deepset/roberta-base-squad2

# Use in Python
python -c "
from transformers import pipeline
qa = pipeline('question-answering', model='deepset/roberta-base-squad2')
result = qa(question='What is AI?', context='AI stands for Artificial Intelligence.')
print(result)
"
```

### Example 2: Explore and Load a Dataset

```python
from datasets import load_dataset, list_datasets

# Search for datasets
datasets = list_datasets(filter="task:text-classification", limit=5)
for ds in datasets:
    print(f"{ds.id}: {ds.downloads} downloads")

# Load a dataset
dataset = load_dataset("imdb", split="train")

# Inspect structure
print(dataset.features)
print(f"Dataset size: {len(dataset)}")

# Sample examples
for example in dataset.select(range(3)):
    print(f"Label: {example['label']}, Text: {example['text'][:100]}...")
```

### Example 3: Run Quick Inference

```python
from huggingface_hub import InferenceClient

client = InferenceClient()

# Text generation
prompt = "Explain quantum computing in simple terms:"
response = client.text_generation(prompt, model="mistralai/Mistral-7B-v0.1", max_new_tokens=100)
print(f"Generated: {response}")

# Sentiment analysis
text = "This product exceeded my expectations!"
result = client.text_classification(text, model="distilbert-base-uncased-finetuned-sst-2-english")
print(f"Sentiment: {result}")

# Feature extraction
embeddings = client.feature_extraction("Machine learning is fascinating", model="sentence-transformers/all-MiniLM-L6-v2")
print(f"Embedding shape: {len(embeddings)}")
```

### Example 4: Create and Upload a Model

```python
from huggingface_hub import HfApi, create_repo
from transformers import AutoModel, AutoTokenizer

# Initialize API
api = HfApi()

# Create repository
repo_id = "myuser/my-finetuned-model"
create_repo(repo_id, exist_ok=True)

# Upload model files
model = AutoModel.from_pretrained("bert-base-uncased")
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

model.push_to_hub(repo_id)
tokenizer.push_to_hub(repo_id)

print(f"Model uploaded to https://huggingface.co/{repo_id}")
```

### Example 5: Compare Models

```python
from huggingface_hub import model_info
from transformers import pipeline
import time

models = [
    "gpt2",
    "distilgpt2",
    "EleutherAI/gpt-neo-125M"
]

for model_id in models:
    # Get metadata
    info = model_info(model_id)
    print(f"\nModel: {model_id}")
    print(f"Downloads: {info.downloads}")
    print(f"Size: {info.safetensors.total if hasattr(info, 'safetensors') else 'N/A'}")

    # Benchmark inference
    generator = pipeline("text-generation", model=model_id, device=-1)  # CPU
    start = time.time()
    result = generator("Hello world", max_length=20, num_return_sequences=1)
    elapsed = time.time() - start
    print(f"Inference time: {elapsed:.3f}s")
```

## Troubleshooting

### Common Issues

**Issue**: `ImportError: No module named 'huggingface_hub'`

```bash
# Solution: Install the package
pip install huggingface_hub
```

**Issue**: `HTTPError: 401 Unauthorized`

```bash
# Solution: Set up authentication
huggingface-cli login
# Or export HF_TOKEN="your_token"
```

**Issue**: `OSError: Disk quota exceeded` when downloading models

```bash
# Solution: Clean cache or use custom cache directory
huggingface-cli scan-cache
huggingface-cli delete-cache --model <model-name>

# Or set custom cache location
export HF_HOME="/path/to/large/disk/.cache/huggingface"
```

**Issue**: Slow downloads

```bash
# Solution: Use parallel downloads
export HF_HUB_DOWNLOAD_THREADS=4

# Or use snapshot download for faster batch downloads
python -c "from huggingface_hub import snapshot_download; snapshot_download('bert-base-uncased')"
```

**Issue**: `RuntimeError: Model requires too much memory`

```bash
# Solution: Use smaller model variant or quantization
# Try distilled versions: bert-base-uncased → distilbert-base-uncased
# Or use 8-bit/4-bit quantization with bitsandbytes
```

**Issue**: Rate limiting on Inference API

```python
# Solution: Add rate limiting and retries
from huggingface_hub import InferenceClient
import time

client = InferenceClient()
max_retries = 3

for attempt in range(max_retries):
    try:
        result = client.text_generation("Hello", model="gpt2")
        break
    except Exception as e:
        if "rate limit" in str(e).lower() and attempt < max_retries - 1:
            time.sleep(2 ** attempt)  # Exponential backoff
        else:
            raise
```

### Debug Mode

```python
# Enable verbose logging
import logging
logging.basicConfig(level=logging.DEBUG)

from huggingface_hub import HfApi
api = HfApi()
```

### Verify Installation

```bash
# Check package versions
pip list | grep -E "huggingface|transformers|datasets"

# Test basic functionality
python -c "
from huggingface_hub import HfApi
api = HfApi()
models = list(api.list_models(limit=1))
print(f'Successfully connected to Hugging Face Hub')
print(f'Test model: {models[0].id}')
"
```

## Best Practices

1. **Use authenticated access**: Set `HF_TOKEN` for private models and higher rate limits
2. **Cache management**: Regularly clean cache with `scan-cache` and `delete-cache`
3. **Model selection**: Prioritize models with high downloads and recent updates
4. **Inference optimization**: Use local models for production; Inference API for prototyping
5. **Version pinning**: Pin model versions in production with `revision` parameter
6. **License compliance**: Always check model licenses before commercial use
7. **Dataset streaming**: Use streaming for large datasets to avoid memory issues
8. **Error handling**: Implement retries with exponential backoff for API calls

## Related Skills

- **repo-rag**: Search codebase for existing model integrations
- **evaluator**: Evaluate model outputs and performance
- **test-generator**: Generate tests for model inference
- **dependency-analyzer**: Check for compatibility issues with transformers/torch versions

## Additional Resources

- [Hugging Face Hub Documentation](https://huggingface.co/docs/hub)
- [huggingface_hub Python Library](https://huggingface.co/docs/huggingface_hub)
- [Transformers Library](https://huggingface.co/docs/transformers)
- [Datasets Library](https://huggingface.co/docs/datasets)
- [Inference API Documentation](https://huggingface.co/docs/api-inference)
