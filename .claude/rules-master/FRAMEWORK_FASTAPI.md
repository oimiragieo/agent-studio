---
description: FastAPI framework-specific best practices and patterns
globs: **/*.py, app/**/*.py, api/**/*.py
priority: high
---

# FastAPI Framework Master Rules

**Consolidated from**: python-fastapi-best-practices, python-fastapi-cursorrules, python-fastapi-scalable-api, python-312-fastapi-best-practices, cursorrules-file-cursor-ai-python-fastapi-api.

**Note**: This file covers FastAPI-specific patterns. General Python rules are in `LANG_PYTHON_GENERAL.md`.

## FastAPI Version

- Use **FastAPI 0.104+** (latest stable)
- Use **Python 3.12+**
- Use **Pydantic v2** for models

## Project Structure

### Recommended Structure

```
app/
├── __init__.py
├── main.py
├── api/
│   ├── __init__.py
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── endpoints/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   └── items.py
│   │   └── api_router.py
├── core/
│   ├── config.py
│   ├── security.py
│   └── dependencies.py
├── models/
│   ├── user.py
│   └── item.py
├── schemas/
│   ├── user.py
│   └── item.py
├── services/
│   ├── user_service.py
│   └── item_service.py
├── db/
│   ├── base.py
│   ├── session.py
│   └── models.py
└── utils/
    └── helpers.py
```

### Best Practices

- Use proper directory structure
- Implement proper module organization
- Use proper dependency injection
- Keep routes organized by domain
- Implement proper middleware
- Use proper configuration management

## API Design

### HTTP Methods and Status Codes

- Use proper HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Implement proper status codes:
  - `200 OK`: Successful GET, PUT, PATCH
  - `201 Created`: Successful POST
  - `204 No Content`: Successful DELETE
  - `400 Bad Request`: Invalid input
  - `401 Unauthorized`: Authentication required
  - `403 Forbidden`: Insufficient permissions
  - `404 Not Found`: Resource not found
  - `422 Unprocessable Entity`: Validation error
  - `500 Internal Server Error`: Server error

### Request/Response Models

- Use Pydantic models for request/response validation
- Implement proper validation
- Use proper type hints
- Keep models organized
- Use proper inheritance
- Implement proper serialization

### Example

```python
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import List, Optional

app = FastAPI(title="My API", version="1.0.0")

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str

@app.post("/users", response_model=UserResponse, status_code=201)
async def create_user(user: UserCreate):
    # Implementation
    pass
```

## Dependency Injection

### FastAPI Dependencies

- Use FastAPI's dependency injection system
- Create reusable dependencies
- Use dependency overrides for testing
- Implement proper dependency chains

### Example

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    # Validate token and return user
    pass

@app.get("/users/me")
async def read_users_me(current_user = Depends(get_current_user)):
    return current_user
```

## Database Integration

### SQLAlchemy Setup

- Use **SQLAlchemy 2.0+** with async support
- Use proper connection pooling
- Implement proper migrations with Alembic
- Use proper query optimization
- Handle database errors properly

### Example

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

engine = create_async_engine("postgresql+asyncpg://...")
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@app.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()
```

## Authentication & Security

### JWT Authentication

- Implement proper JWT authentication
- Use proper password hashing (bcrypt, argon2)
- Implement proper role-based access control (RBAC)
- Use proper session management
- Implement proper OAuth2
- Handle authentication errors properly

### Security Best Practices

- Implement proper CORS
- Use proper rate limiting
- Implement proper input validation
- Use proper security headers
- Handle security errors properly
- Implement proper logging

### Example

```python
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)
```

## Async Operations

### Async Best Practices

- Use `async def` for I/O-bound operations
- Use proper async database operations
- Use background tasks for heavy operations
- Implement proper async error handling
- Use `asyncio.gather()` for concurrent operations

### Example

```python
from fastapi import BackgroundTasks

async def send_email(email: str, message: str):
    # Async email sending
    pass

@app.post("/users")
async def create_user(
    user: UserCreate,
    background_tasks: BackgroundTasks
):
    # Create user
    background_tasks.add_task(send_email, user.email, "Welcome!")
    return user
```

## Performance Optimization

### Caching

- Use proper caching (Redis, in-memory)
- Implement cache invalidation
- Use cache headers appropriately
- Cache expensive computations

### Database Optimization

- Use proper connection pooling
- Implement proper query optimization
- Use lazy loading appropriately
- Implement proper pagination
- Use database indexes

### Example

```python
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.decorator import cache

@app.get("/users")
@cache(expire=60)
async def get_users():
    # Cached endpoint
    pass
```

## Error Handling

### Custom Exceptions

- Create custom exception classes
- Use proper HTTP exceptions
- Implement proper error responses
- Handle edge cases properly
- Use proper error messages

### Example

```python
from fastapi import HTTPException, status

class UserNotFoundError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    user = await get_user_by_id(user_id)
    if not user:
        raise UserNotFoundError()
    return user
```

## Testing

### Test Structure

- Write proper unit tests
- Implement proper integration tests
- Use proper test fixtures
- Implement proper mocking
- Test error scenarios
- Use proper test coverage

### Example

```python
from fastapi.testclient import TestClient

client = TestClient(app)

def test_create_user():
    response = client.post("/users", json={
        "email": "test@example.com",
        "name": "Test User",
        "password": "password123"
    })
    assert response.status_code == 201
    assert response.json()["email"] == "test@example.com"
```

## Documentation

### OpenAPI/Swagger

- Use proper docstrings
- Implement proper API documentation
- Use proper type hints
- Keep documentation updated
- Document error scenarios
- Use proper versioning

### Example

```python
@app.post(
    "/users",
    response_model=UserResponse,
    status_code=201,
    summary="Create a new user",
    description="Create a new user with email and password",
    response_description="The created user",
    tags=["users"]
)
async def create_user(user: UserCreate):
    """Create a new user.
    
    - **email**: User's email address
    - **name**: User's full name
    - **password**: User's password (will be hashed)
    """
    pass
```

## Deployment

### Docker Configuration

- Use proper Docker configuration
- Use multi-stage builds
- Implement proper CI/CD
- Use proper environment variables
- Implement proper logging
- Use proper monitoring

### Example Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Migration Notes

This master file consolidates rules from:
- `python-fastapi-best-practices-cursorrules-prompt-f`
- `python-fastapi-cursorrules-prompt-file`
- `python-fastapi-scalable-api-cursorrules-prompt-fil`
- `python-312-fastapi-best-practices-cursorrules-prom`
- `cursorrules-file-cursor-ai-python-fastapi-api`

**Old rule files can be archived** - this master file is the single source of truth for FastAPI development.

