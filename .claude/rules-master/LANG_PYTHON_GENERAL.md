---
description: General Python development best practices and patterns (framework-agnostic)
globs: **/*.py, src/**/*.py, tests/**/*.py
priority: high
validation:
  forbidden_patterns:
    - pattern: "from typing import List, Dict"
      message: "Use built-in generics (list[], dict[]) in Python 3.9+."
      severity: "warning"
    - pattern: "print\\("
      message: "Use logging instead of print() in production code."
      severity: "warning"
    - pattern: "except:\\s*$"
      message: "Avoid bare except; catch specific exceptions."
      severity: "error"
    - pattern: "# type: ignore"
      message: "Fix type errors instead of ignoring them."
      severity: "warning"
---

<template name="pydantic-model">
```python
from pydantic import BaseModel, Field

class {{Name}}(BaseModel):
    """{{Description}}"""

    id: str = Field(..., description="Unique identifier")
    name: str = Field(..., min_length=1, max_length=100)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )
```
</template>

<template name="class">
```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class {{Name}}:
    """{{Description}}"""

    def __init__(self, {{params}}) -> None:
        self.{{attr}} = {{attr}}

    def __repr__(self) -> str:
        return f"{{Name}}({self.{{attr}}!r})"
```
</template>

<template name="function">
```python
def {{name}}({{params}}) -> {{ReturnType}}:
    """{{Description}}

    Args:
        {{param}}: {{param_description}}

    Returns:
        {{return_description}}

    Raises:
        ValueError: If {{error_condition}}.
    """
    # Implementation
    return result
```
</template>

# Python General Development Master Rules

**Consolidated from**: python-developer, python-cursorrules-best-practices, python-projects-guide, python-github-setup, python-containerization.

**Note**: Framework-specific rules (Django, FastAPI, Flask) are kept separate. This file covers general Python practices.

## Python Version

- Use **Python 3.12+** (latest stable version)
- Specify Python version in `pyproject.toml` or `.python-version`
- Use type hints (Python 3.9+ features)

## Project Structure

### Directory Layout

```
project/
├── src/
│   └── your_package_name/
│       ├── __init__.py
│       ├── models/
│       ├── services/
│       ├── controllers/
│       ├── utils/
│       └── config/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
├── config/
├── .github/
│   └── workflows/
├── requirements.txt  # or pyproject.toml
├── README.md
└── .env.example
```

### Best Practices

- Use **src-layout** with `src/your_package_name/`
- Place tests in `tests/` directory parallel to `src/`
- Keep configuration in `config/` or as environment variables
- Store requirements in `requirements.txt` or `pyproject.toml`
- Use separate directories for models, services, controllers, utilities

## Code Style

### PEP 8 Compliance

- Follow **Black** code formatting (88 character line length)
- Use **isort** for import sorting
- Follow PEP 8 naming conventions:
  - `snake_case` for functions and variables
  - `PascalCase` for classes
  - `UPPER_CASE` for constants
- Maximum line length of **88 characters** (Black default)
- Use **absolute imports** over relative imports

### Code Organization

- **Modular design**: Separate concerns into distinct modules
- **DRY principle**: Don't Repeat Yourself
- **Single Responsibility**: Each module/class should have one responsibility
- Use descriptive, explicit variable names
- Avoid magic numbers - use named constants
- Keep functions small and focused

## Type Hints

### Type Annotation Standards

- Use **type hints for all function parameters and returns**
- Import types from `typing` module
- Use `Optional[Type]` instead of `Type | None` (for Python < 3.10)
- Use `TypeVar` for generic types
- Define custom types in `types.py`
- Use `Protocol` for duck typing
- Use `TypedDict` for dictionary structures

### Examples

```python
from typing import Optional, List, Dict, Protocol

def process_data(
    items: List[str],
    config: Optional[Dict[str, str]] = None
) -> Dict[str, int]:
    """Process items and return results."""
    pass
```

## Error Handling and Logging

### Exception Handling

- Create **custom exception classes** for domain-specific errors
- Use proper try-except blocks with specific exceptions
- Implement proper logging with context
- Return proper error responses
- Handle edge cases properly
- Use proper error messages (user-friendly when appropriate)

### Logging Best Practices

- Use Python's `logging` module (not `print`)
- Set appropriate log levels (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- Include context in log messages
- Use structured logging when possible
- Log exceptions with traceback
- Configure logging in configuration files

### Example

```python
import logging

logger = logging.getLogger(__name__)

try:
    result = process_data(items)
except ValueError as e:
    logger.error(f"Invalid data: {e}", exc_info=True)
    raise
```

## Dependencies Management

### Package Management

- Use **Rye** or **poetry** for modern projects
- Use **virtual environments** (venv) for isolation
- Pin dependency versions in `requirements.txt` or `pyproject.toml`
- Separate dev dependencies from production
- Regularly update dependencies
- Check for security vulnerabilities (use `safety` or `pip-audit`)

### Requirements Files

- `requirements.txt` for production dependencies
- `requirements-dev.txt` for development dependencies
- Use `pyproject.toml` for modern projects (preferred)

## Testing

### Testing Framework

- Use **pytest** for testing (not unittest)
- Write tests for all public functions
- Use **pytest-cov** for coverage
- Aim for **80%+ coverage** on critical paths
- Implement proper fixtures
- Use proper mocking with `pytest-mock`
- Test all error scenarios

### Test Organization

- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- Use fixtures for test data
- Keep tests isolated and independent
- Use descriptive test names

### Example

```python
import pytest

def test_process_data_success():
    items = ["item1", "item2"]
    result = process_data(items)
    assert result["count"] == 2

def test_process_data_empty_list():
    result = process_data([])
    assert result["count"] == 0
```

## Configuration Management

### Environment Variables

- Use **environment variables** for configuration
- Store secrets in environment variables (never in code)
- Use `.env` files for local development
- Provide `.env.example` with required variables
- Use libraries like `python-dotenv` for loading `.env` files
- Validate configuration on startup

### Configuration Files

- Keep configuration in `config/` directory
- Use YAML or TOML for complex configurations
- Separate development, staging, and production configs
- Document all configuration options

## Security

### General Security

- **Never commit secrets, API keys, or credentials**
- Use environment variables for sensitive data
- **Sanitize all user inputs**
- Use HTTPS in production
- Implement proper CORS policies
- Follow **OWASP Top 10** guidelines
- Keep dependencies up to date (check for vulnerabilities)

### Authentication and Authorization

- Hash passwords with **bcrypt** or **argon2**
- Use proper session security
- Implement CSRF protection
- Use proper role-based access control (RBAC)
- Implement proper token management

## Performance

### Optimization Strategies

- Use proper caching (e.g., `functools.lru_cache`)
- Implement database query optimization
- Use proper connection pooling
- Implement proper pagination
- Use background tasks for heavy operations
- Monitor application performance
- Profile code with `cProfile` when needed

### Concurrency and Parallelism

- Use `asyncio` for I/O-bound tasks
- Use `multiprocessing` for CPU-bound tasks
- Use `threading` sparingly (GIL limitations)
- Understand when to use each approach

## Documentation

### Docstrings

- Use **Google-style docstrings** or **NumPy-style**
- Document all public APIs
- Include parameter descriptions
- Include return value descriptions
- Include exception descriptions
- Include usage examples

### Example

```python
def process_data(items: List[str], config: Optional[Dict] = None) -> Dict[str, int]:
    """Process a list of items and return statistics.
    
    Args:
        items: List of item strings to process
        config: Optional configuration dictionary
        
    Returns:
        Dictionary containing processing statistics
        
    Raises:
        ValueError: If items list is invalid
        
    Example:
        >>> process_data(["item1", "item2"])
        {'count': 2, 'processed': 2}
    """
    pass
```

### Project Documentation

- Keep `README.md` updated
- Document environment setup
- Include installation instructions
- Document API usage
- Generate API documentation (Sphinx, MkDocs)

## Development Workflow

### Version Control

- Use **Git** with **GitHub Flow** branching strategy
- Follow conventional commit messages
- Use semantic versioning
- Implement pre-commit hooks
- Use proper `.gitignore` for Python projects

### CI/CD

- Set up CI/CD with **GitHub Actions** or **GitLab CI**
- Run tests on every push
- Run linting and type checking
- Build and test Docker images
- Deploy automatically (when appropriate)

### Pre-commit Hooks

- Format code with Black
- Sort imports with isort
- Run linting (ruff, flake8)
- Run type checking (mypy)
- Run tests

## Containerization

### Docker Best Practices

- Use **multi-stage builds** for smaller images
- Use `.dockerignore` to exclude unnecessary files
- Use specific Python version tags
- Run as non-root user when possible
- Use health checks
- Optimize layer caching

### Docker Compose

- Use Docker Compose for local development
- Separate services appropriately
- Use environment variables for configuration
- Document service dependencies

## Code Quality Tools

### Linting and Formatting

- **Black**: Code formatting
- **isort**: Import sorting
- **ruff**: Fast Python linter (replaces flake8, isort)
- **mypy**: Static type checking
- **pylint**: Additional linting (optional)

### Setup Example

```toml
[tool.black]
line-length = 88
target-version = ['py312']

[tool.isort]
profile = "black"
line_length = 88

[tool.mypy]
python_version = "3.12"
strict = true
```

## AI-Friendly Coding Practices

### For AI Code Generation

- Use **descriptive names** with clear intent
- Include **detailed comments** for complex logic
- Provide **rich error context** in exceptions
- Use **type hints** extensively
- Write **comprehensive docstrings**
- Structure code for clarity

## Migration Notes

This master file consolidates rules from:
- `python-developer-cursorrules-prompt-file`
- `python-cursorrules-prompt-file-best-practices`
- `python-projects-guide-cursorrules-prompt-file`
- `python-github-setup-cursorrules-prompt-file`
- `python-containerization-cursorrules-prompt-file`

**Framework-specific rules** (Django, FastAPI, Flask) are kept separate in their own master files.

