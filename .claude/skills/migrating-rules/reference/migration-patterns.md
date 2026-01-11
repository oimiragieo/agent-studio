# Migration Patterns Guide

Common migration patterns for rule updates and framework changes.

## Next.js Migration Patterns

### Pages Router → App Router

**Before** (Pages Router):

```typescript
// pages/users/[id].tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function UserPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${router.query.id}`)
      .then(res => res.json())
      .then(setUser);
  }, [router.query.id]);

  return <div>{user?.name}</div>;
}
```

**After** (App Router):

```typescript
// app/users/[id]/page.tsx
export default async function UserPage({ params }: { params: { id: string } }) {
  const user = await fetch(`/api/users/${params.id}`).then(res => res.json());
  return <div>{user.name}</div>;
}
```

**Key Changes**:

- Move from `pages/` to `app/`
- Use async Server Components
- Remove `useEffect` for data fetching
- Use `params` prop instead of `router.query`

### Next.js 14 → 15

**React 19 Changes**:

```typescript
// Before: React 18
'use client';
import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

```typescript
// After: React 19 (can use use() hook)
'use client';
import { use } from 'react';

export function Counter({ countPromise }: { countPromise: Promise<number> }) {
  const count = use(countPromise);
  return <div>{count}</div>;
}
```

## TypeScript Migration Patterns

### Adding Strict Mode

**Before** (Loose types):

```typescript
function processData(data: any) {
  return data.map(item => item.value);
}
```

**After** (Strict types):

```typescript
interface DataItem {
  value: number;
}

function processData(data: DataItem[]): number[] {
  return data.map(item => item.value);
}
```

### Replacing `any` with `unknown`

**Before**:

```typescript
function handleData(data: any) {
  console.log(data.value);
}
```

**After**:

```typescript
function handleData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    console.log((data as { value: unknown }).value);
  }
}
```

## Python Migration Patterns

### Adding Type Hints

**Before**:

```python
def process_items(items):
    return [item.value for item in items]
```

**After**:

```python
from typing import List

class Item:
    value: int

def process_items(items: List[Item]) -> List[int]:
    return [item.value for item in items]
```

### Async Migration

**Before** (Blocking):

```python
import requests

def fetch_user(user_id: str):
    response = requests.get(f"/api/users/{user_id}")
    return response.json()
```

**After** (Async):

```python
import httpx

async def fetch_user(user_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"/api/users/{user_id}")
        return response.json()
```

## React Migration Patterns

### Class Components → Functional Components

**Before**:

```typescript
class UserProfile extends React.Component {
  state = { user: null };

  componentDidMount() {
    fetchUser(this.props.userId).then(user => {
      this.setState({ user });
    });
  }

  render() {
    return <div>{this.state.user?.name}</div>;
  }
}
```

**After**:

```typescript
export function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

## Migration Workflow

1. **Identify scope**: What files are affected?
2. **Analyze differences**: What changed in the rules?
3. **Create plan**: Step-by-step migration
4. **Execute**: Apply changes systematically
5. **Verify**: Test and validate

## Pattern Matching

When migrating:

1. Identify old pattern in code
2. Find matching migration pattern
3. Apply transformation
4. Verify new pattern works
5. Update related code

## Common Pitfalls

- **Incomplete migration**: Only migrating some files
- **Breaking changes**: Not handling deprecated patterns
- **Type errors**: Not updating types during migration
- **Testing gaps**: Not verifying after migration
