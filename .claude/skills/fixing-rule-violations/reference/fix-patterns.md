# Fix Patterns Guide

Common fix patterns for rule violations, organized by violation type.

## TypeScript Fix Patterns

### Violation: Using `any` type

**Problem**:
```typescript
const user: any = await getUser();
```

**Fix**:
```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

const user: User = await getUser();
```

### Violation: Missing return type

**Problem**:
```typescript
function processData(data) {
  return data.map(item => item.value);
}
```

**Fix**:
```typescript
function processData(data: DataItem[]): number[] {
  return data.map(item => item.value);
}
```

### Violation: Using `any` in function parameters

**Problem**:
```typescript
function handleEvent(event: any) {
  console.log(event.target.value);
}
```

**Fix**:
```typescript
function handleEvent(event: React.ChangeEvent<HTMLInputElement>) {
  console.log(event.target.value);
}
```

## React/Next.js Fix Patterns

### Violation: Missing 'use client' directive

**Problem**:
```tsx
// components/InteractiveButton.tsx
import { useState } from 'react';

export function InteractiveButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**Fix**:
```tsx
'use client';  // Add this directive

import { useState } from 'react';

export function InteractiveButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### Violation: Using useEffect for data fetching

**Problem**:
```tsx
'use client';

export function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(setUser);
  }, [userId]);
  
  return <div>{user?.name}</div>;
}
```

**Fix** (Server Component):
```tsx
// Remove 'use client', make async
export async function UserProfile({ userId }: { userId: string }) {
  const user = await fetch(`/api/users/${userId}`).then(res => res.json());
  return <div>{user.name}</div>;
}
```

### Violation: Not using next/image

**Problem**:
```tsx
<img src="/logo.png" alt="Logo" />
```

**Fix**:
```tsx
import Image from 'next/image';

<Image src="/logo.png" alt="Logo" width={200} height={200} />
```

## Python Fix Patterns

### Violation: Missing type hints

**Problem**:
```python
def process_data(data):
    return [item.value for item in data]
```

**Fix**:
```python
from typing import List

def process_data(data: List[DataItem]) -> List[int]:
    return [item.value for item in data]
```

### Violation: Blocking call in async function

**Problem**:
```python
async def fetch_user(user_id: str):
    response = requests.get(f"/api/users/{user_id}")  # Blocking!
    return response.json()
```

**Fix**:
```python
import httpx

async def fetch_user(user_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"/api/users/{user_id}")
        return response.json()
```

### Violation: Missing error handling

**Problem**:
```python
def divide(a, b):
    return a / b
```

**Fix**:
```python
def divide(a: float, b: float) -> float:
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b
```

## Code Quality Fix Patterns

### Violation: Magic numbers

**Problem**:
```typescript
if (items.length > 10) {
  // Show pagination
}
```

**Fix**:
```typescript
const MAX_ITEMS_PER_PAGE = 10;

if (items.length > MAX_ITEMS_PER_PAGE) {
  // Show pagination
}
```

### Violation: Unclear variable names

**Problem**:
```typescript
const d = new Date();
const u = await getUser();
```

**Fix**:
```typescript
const currentDate = new Date();
const currentUser = await getUser();
```

### Violation: Missing error boundaries

**Problem**:
```tsx
export function App() {
  return (
    <div>
      <ComponentThatMightError />
    </div>
  );
}
```

**Fix**:
```tsx
export function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <ComponentThatMightError />
    </ErrorBoundary>
  );
}
```

## Fix Workflow

1. **Identify violation**: What rule is violated?
2. **Load rule**: Get full rule file from index
3. **Find pattern**: Match violation to fix pattern
4. **Apply fix**: Use pattern to fix code
5. **Verify**: Check fix resolves violation

## Pattern Matching

When a violation is reported:
1. Extract violation type (TypeScript, React, Python, etc.)
2. Look up fix pattern in this guide
3. Adapt pattern to specific code
4. Provide before/after example

