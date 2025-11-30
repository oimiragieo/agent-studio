# Scaffolder Skill

Generates boilerplate code that automatically follows your project's coding standards.

## When to Use

- Creating new components via droids
- Adding new API endpoints
- Setting up new modules or packages
- Generating test files
- Bootstrapping feature directories

## Invocation

```
Run Task tool with skill scaffolder to create a UserProfile component
Run Task tool with skill scaffolder to generate an API route
```

Or in Specification Mode:
```
[Shift+Tab] Create a new authentication module with login, logout, and password reset
```

## Process

1. **Identify Framework**: Detect which rules apply (nextjs.mdc, fastapi.mdc)
2. **Extract Patterns**: Parse rules for naming, structure, imports
3. **Generate Code**: Apply patterns to create compliant boilerplate
4. **Validate**: Run rule-auditor to verify compliance

## Templates Available

| Template | Framework | Files Generated |
|----------|-----------|-----------------|
| `component` | Next.js/React | index.tsx, types.ts, skeleton.tsx |
| `page` | Next.js App Router | page.tsx, loading.tsx, error.tsx |
| `api` | Next.js App Router | route.ts with handlers |
| `fastapi-route` | FastAPI | router file with endpoints |
| `test` | Jest/Vitest | Test file for component |
| `e2e-test` | Cypress/Playwright | E2E test spec |

## Example Output

**Command**: Scaffold a FastAPI users endpoint

**Generated**: `app/routers/users.py`

```python
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field

router = APIRouter(prefix="/users", tags=["users"])

class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=100)

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: str

@router.get("", response_model=list[UserResponse])
async def list_users(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
) -> list[UserResponse]:
    """List all users with pagination."""
    pass

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user_data: UserCreate) -> UserResponse:
    """Create a new user."""
    pass
```

## Integration with Factory

- Use with developer droid for implementation
- Combine with architect droid for feature planning
- Run in Auto-Run mode for rapid scaffolding

## Related Skills

- `rule-selector` - Configure rules before scaffolding
- `rule-auditor` - Validate scaffolded code
- `context-router` - Route scaffolding context
