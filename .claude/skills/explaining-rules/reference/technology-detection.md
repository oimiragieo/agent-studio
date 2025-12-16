# Technology Detection Guide

How to detect technologies from files, imports, and project structure.

## File Extension Detection

| Extension | Technologies |
|-----------|-------------|
| `.tsx`, `.ts` | TypeScript, React (if .tsx) |
| `.jsx`, `.js` | JavaScript, React (if .jsx) |
| `.py` | Python |
| `.sol` | Solidity |
| `.vue` | Vue.js |
| `.svelte` | Svelte |
| `.swift` | Swift, iOS |
| `.kt`, `.kts` | Kotlin, Android |
| `.dart` | Flutter, Dart |
| `.go` | Go |
| `.rs` | Rust |
| `.java` | Java |
| `.php` | PHP |

## Import Statement Detection

### Next.js
```typescript
import { NextRequest, NextResponse } from 'next/server'
import Image from 'next/image'
import Link from 'next/link'
```

### React
```typescript
import { useState, useEffect } from 'react'
import React from 'react'
```

### FastAPI
```python
from fastapi import APIRouter, Depends
from fastapi import FastAPI
```

### Django
```python
from django.shortcuts import render
from django.db import models
```

### Express
```javascript
const express = require('express')
import express from 'express'
```

## Directory Structure Detection

### Next.js App Router
- `app/` directory with `page.tsx`, `layout.tsx`
- `app/api/` for API routes
- `components/` for shared components

### Next.js Pages Router
- `pages/` directory
- `pages/api/` for API routes

### React (non-Next.js)
- `src/components/`
- `src/hooks/`
- `src/utils/`

### FastAPI
- `app/routers/`
- `app/models/`
- `app/schemas/`

### Django
- `app_name/models.py`
- `app_name/views.py`
- `app_name/urls.py`

## Framework-Specific Patterns

### Next.js Patterns
- `'use client'` directive → Client Component
- `async function` in components → Server Component
- `generateStaticParams()` → Static generation
- `metadata` export → App Router metadata

### React Patterns
- `useState`, `useEffect` → Client-side React
- Context API → React Context
- Custom hooks (`use*`) → React hooks

### TypeScript Patterns
- Interface definitions → TypeScript
- Type annotations → TypeScript
- Generic types (`<T>`) → TypeScript

### Python Patterns
- `async def` → Async Python
- Type hints (`def func(param: str) -> int`) → Python 3.5+
- Pydantic models → FastAPI/Django REST
- `@router.get()` → FastAPI

## Detection Algorithm

1. **Check file extension** → Primary technology
2. **Scan imports** (first 50 lines) → Framework/library
3. **Check directory structure** → Project type
4. **Look for framework patterns** → Specific features

## Technology Mapping

Map detected technologies to rule index keys:

- `nextjs` → Next.js rules
- `react` → React rules
- `typescript` → TypeScript rules
- `python` → Python rules
- `fastapi` → FastAPI rules
- `django` → Django rules
- `cypress` → Cypress testing rules
- `playwright` → Playwright testing rules

Use these keys to query `index.technology_map`.

