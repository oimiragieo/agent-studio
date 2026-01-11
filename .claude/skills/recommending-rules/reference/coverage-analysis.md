# Coverage Analysis Guide

How to analyze codebase to identify technologies and recommend rules.

## Codebase Scanning Strategy

### 1. Package Files

**package.json** (Node.js/JavaScript projects):

```json
{
  "dependencies": {
    "next": "^15.0.0", // → Next.js
    "react": "^19.0.0", // → React
    "typescript": "^5.0.0", // → TypeScript
    "tailwindcss": "^3.0.0" // → Tailwind CSS
  },
  "devDependencies": {
    "cypress": "^13.0.0", // → Cypress
    "jest": "^29.0.0" // → Jest
  }
}
```

**requirements.txt** (Python projects):

```
fastapi==0.104.0      # → FastAPI
pydantic==2.0.0       # → Pydantic
pytest==7.4.0         # → pytest
```

**Cargo.toml** (Rust projects):

```toml
[dependencies]
tokio = "1.0"         # → Async Rust
serde = "1.0"         # → Serialization
```

### 2. Configuration Files

**next.config.js** → Next.js
**tsconfig.json** → TypeScript
**tailwind.config.js** → Tailwind CSS
**docker-compose.yml** → Docker
**Dockerfile** → Docker
**kubernetes/** → Kubernetes
**terraform/** → Terraform

### 3. Directory Structure

**Next.js App Router**:

- `app/` directory
- `app/api/` for API routes
- `components/` for shared components

**Next.js Pages Router**:

- `pages/` directory
- `pages/api/` for API routes

**FastAPI**:

- `app/routers/`
- `app/models/`
- `app/schemas/`

**Django**:

- `app_name/models.py`
- `app_name/views.py`
- `app_name/urls.py`

### 4. File Extensions

Scan for file extensions:

- `.tsx`, `.ts` → TypeScript, React
- `.jsx`, `.js` → JavaScript, React
- `.py` → Python
- `.sol` → Solidity
- `.vue` → Vue.js
- `.svelte` → Svelte
- `.swift` → Swift
- `.kt` → Kotlin
- `.dart` → Flutter

### 5. Import Patterns

**Next.js**:

```typescript
import { NextRequest } from 'next/server';
import Image from 'next/image';
```

**React**:

```typescript
import { useState } from 'react';
```

**FastAPI**:

```python
from fastapi import APIRouter, Depends
```

**Django**:

```python
from django.db import models
```

## Technology Detection Algorithm

1. **Scan package files** → Primary dependencies
2. **Check config files** → Framework configuration
3. **Analyze directory structure** → Project type
4. **Count file extensions** → Languages used
5. **Scan imports** → Libraries/frameworks

## Rule Matching

For each detected technology:

1. Query `index.technology_map[technology]`
2. Get all rules for that technology
3. Check if rule is currently active
4. If not active, add to recommendations

## Priority Calculation

### High Priority

- Technology appears in >50% of files
- Core framework (Next.js, React, FastAPI)
- Universal standards (PROTOCOL_ENGINEERING)
- Testing framework actively used

### Medium Priority

- Technology appears in 10-50% of files
- Secondary framework
- Build/deployment tools
- Code style rules

### Low Priority

- Technology appears in <10% of files
- Niche tools
- Optional features
- Deprecated patterns

## Coverage Metrics

Calculate coverage:

```
Coverage = (Active Rules / Relevant Rules) × 100%

Where:
- Active Rules = Rules currently loaded
- Relevant Rules = Rules matching codebase technologies
```

## Example Analysis

**Codebase**:

- 80% TypeScript files
- `next.config.js` present
- `package.json` has `next`, `react`, `typescript`
- `cypress/` directory exists

**Detected Technologies**:

- nextjs (high priority)
- react (high priority)
- typescript (high priority)
- cypress (medium priority)

**Query Index**:

- `index.technology_map['nextjs']` → 5 rules
- `index.technology_map['react']` → 3 rules
- `index.technology_map['typescript']` → 4 rules
- `index.technology_map['cypress']` → 2 rules

**Currently Active**:

- TECH_STACK_NEXTJS (master)
- PROTOCOL_ENGINEERING (master)

**Recommendations**:

- High: TOOL_CYPRESS_MASTER (testing rules)
- Medium: Additional TypeScript rules from archive
- Low: Niche React patterns
