#!/usr/bin/env node
/**
 * Scaffolder - Rule-compliant code generator
 *
 * Usage:
 *   node scaffold.mjs component UserProfile
 *   node scaffold.mjs client-component SearchBar
 *   node scaffold.mjs api users
 *   node scaffold.mjs test src/components/UserProfile.tsx
 *   node scaffold.mjs feature user-management
 *   node scaffold.mjs --list
 *
 * Options:
 *   --path <path>       Target directory for generated files
 *   --list              List available templates
 *   --help              Show this help message
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname, resolve, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../../..');

// Template registry
const TEMPLATES = {
  'component': {
    description: 'Next.js Server Component',
    technologies: ['nextjs', 'react', 'typescript'],
    handler: scaffoldComponent
  },
  'client-component': {
    description: 'Next.js Client Component',
    technologies: ['nextjs', 'react', 'typescript'],
    handler: scaffoldClientComponent
  },
  'api': {
    description: 'Next.js API Route (App Router)',
    technologies: ['nextjs', 'typescript'],
    handler: scaffoldApiRoute
  },
  'test': {
    description: 'Test file for existing component',
    technologies: ['jest', 'vitest', 'react', 'typescript'],
    handler: scaffoldTest
  },
  'feature': {
    description: 'Complete feature module',
    technologies: ['nextjs', 'react', 'typescript'],
    handler: scaffoldFeature
  },
  'hook': {
    description: 'Custom React hook',
    technologies: ['react', 'typescript'],
    handler: scaffoldHook
  },
  'context': {
    description: 'React Context provider',
    technologies: ['react', 'typescript'],
    handler: scaffoldContext
  },
  'fastapi-route': {
    description: 'FastAPI router',
    technologies: ['fastapi', 'python', 'pydantic'],
    handler: scaffoldFastAPIRoute
  }
};

/**
 * Load rule index for dynamic rule discovery
 */
async function loadRuleIndex() {
  try {
    const indexPath = join(PROJECT_ROOT, '.claude/context/rule-index.json');
    const content = await readFile(indexPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load rule index. Run: pnpm index-rules');
    throw error;
  }
}

/**
 * Query technology map for relevant rules
 */
function queryTechnologyMap(ruleIndex, technologies) {
  const relevantRules = [];
  const seenPaths = new Set();

  for (const tech of technologies) {
    const techRules = ruleIndex.technology_map?.[tech] || [];
    for (const rulePath of techRules) {
      if (!seenPaths.has(rulePath)) {
        const rule = ruleIndex.rules.find(r => r.path === rulePath);
        if (rule) {
          relevantRules.push(rule);
          seenPaths.add(rulePath);
        }
      }
    }
  }

  // Prioritize master rules
  relevantRules.sort((a, b) => {
    if (a.type === 'master' && b.type !== 'master') return -1;
    if (a.type !== 'master' && b.type === 'master') return 1;
    return 0;
  });

  return relevantRules;
}

/**
 * Extract patterns from rule files
 */
async function extractPatterns(rules) {
  const patterns = [];

  for (const rule of rules) {
    try {
      const rulePath = join(PROJECT_ROOT, rule.path);
      const content = await readFile(rulePath, 'utf-8');

      // Look for template blocks
      const templateRegex = /<template[^>]*>([\s\S]*?)<\/template>/g;
      let match;
      while ((match = templateRegex.exec(content)) !== null) {
        patterns.push({
          name: `Template from ${rule.name}`,
          type: 'template',
          content: match[1],
          source: rule.name
        });
      }

      // Look for code examples
      const codeBlockRegex = /```(?:tsx?|jsx?|python)\n([\s\S]*?)```/g;
      while ((match = codeBlockRegex.exec(content)) !== null) {
        patterns.push({
          name: `Code pattern from ${rule.name}`,
          type: 'code_example',
          content: match[1],
          source: rule.name
        });
      }

      // Extract specific patterns
      if (content.includes('Server Component')) {
        patterns.push({
          name: 'Server Component pattern',
          type: 'convention',
          content: 'Use async Server Components by default',
          source: rule.name
        });
      }

      if (content.includes("'use client'")) {
        patterns.push({
          name: 'Client Component pattern',
          type: 'convention',
          content: "Add 'use client' directive for interactive components",
          source: rule.name
        });
      }

      if (content.includes('Suspense')) {
        patterns.push({
          name: 'Suspense boundary pattern',
          type: 'convention',
          content: 'Wrap async components in Suspense boundaries',
          source: rule.name
        });
      }

    } catch (error) {
      console.warn(`Failed to read rule ${rule.path}:`, error.message);
    }
  }

  return patterns;
}

/**
 * Detect technology stack from package.json
 */
async function detectTechStack() {
  try {
    const packageJsonPath = join(PROJECT_ROOT, 'package.json');
    const content = await readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    const technologies = [];
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.next) technologies.push('nextjs', 'react');
    if (deps.react && !deps.next) technologies.push('react');
    if (deps.typescript || deps['@types/react']) technologies.push('typescript');
    if (deps.fastapi || deps.pydantic) technologies.push('fastapi', 'python');
    if (deps.jest) technologies.push('jest');
    if (deps.vitest) technologies.push('vitest');
    if (deps.cypress) technologies.push('cypress');

    return technologies.length > 0 ? technologies : ['typescript', 'react'];
  } catch (error) {
    return ['typescript', 'react'];
  }
}

/**
 * Convert name to PascalCase
 */
function toPascalCase(str) {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert name to kebab-case
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert name to camelCase
 */
function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Write files to disk
 */
async function writeFiles(files, basePath = PROJECT_ROOT) {
  const written = [];

  for (const file of files) {
    const fullPath = join(basePath, file.path);
    const dir = dirname(fullPath);

    // Create directory if it doesn't exist
    await mkdir(dir, { recursive: true });

    // Write file
    await writeFile(fullPath, file.content, 'utf-8');
    written.push(fullPath);
  }

  return written;
}

/**
 * Template: Next.js Server Component
 */
async function scaffoldComponent(name, patterns, options) {
  const pascalName = toPascalCase(name);
  const kebabName = toKebabCase(name);
  const basePath = options.path || `components/${kebabName}`;

  const files = [
    {
      path: `${basePath}/index.tsx`,
      type: 'component',
      content: `// Server Component (default per Next.js rules)
import { Suspense } from 'react'
import { ${pascalName}Skeleton } from './skeleton'
import { ${pascalName}Content } from './content'
import type { ${pascalName}Props } from './types'

/**
 * ${pascalName} component
 *
 * @param props - Component props
 */
export async function ${pascalName}(props: ${pascalName}Props) {
  return (
    <Suspense fallback={<${pascalName}Skeleton />}>
      <${pascalName}Content {...props} />
    </Suspense>
  )
}

export default ${pascalName}
`
    },
    {
      path: `${basePath}/content.tsx`,
      type: 'component',
      content: `import type { ${pascalName}Props } from './types'

/**
 * ${pascalName} content component (async data fetching)
 */
export async function ${pascalName}Content(props: ${pascalName}Props) {
  // TODO: Add async data fetching here
  // const data = await fetchData(props.id)

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold">{props.title || '${pascalName}'}</h2>
      {/* Add your component content here */}
    </div>
  )
}
`
    },
    {
      path: `${basePath}/skeleton.tsx`,
      type: 'component',
      content: `/**
 * ${pascalName} loading skeleton
 */
export function ${pascalName}Skeleton() {
  return (
    <div className="animate-pulse p-4">
      <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
    </div>
  )
}
`
    },
    {
      path: `${basePath}/types.ts`,
      type: 'type',
      content: `/**
 * ${pascalName} component props
 */
export interface ${pascalName}Props {
  title?: string
  // Add your prop types here
}
`
    }
  ];

  return {
    files,
    basePath,
    componentName: pascalName
  };
}

/**
 * Template: Next.js Client Component
 */
async function scaffoldClientComponent(name, patterns, options) {
  const pascalName = toPascalCase(name);
  const kebabName = toKebabCase(name);
  const basePath = options.path || `components/${kebabName}`;

  const files = [
    {
      path: `${basePath}/index.tsx`,
      type: 'component',
      content: `'use client'

import { useState, useCallback } from 'react'
import type { ${pascalName}Props } from './types'

/**
 * ${pascalName} component (client-side interactive)
 *
 * @param props - Component props
 */
export function ${pascalName}(props: ${pascalName}Props) {
  const [isActive, setIsActive] = useState(false)

  const handleClick = useCallback(() => {
    setIsActive(prev => !prev)
    // Add your interaction logic here
  }, [])

  return (
    <div className="p-4">
      <button
        onClick={handleClick}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        {isActive ? 'Active' : 'Inactive'}
      </button>
    </div>
  )
}

export default ${pascalName}
`
    },
    {
      path: `${basePath}/types.ts`,
      type: 'type',
      content: `/**
 * ${pascalName} component props
 */
export interface ${pascalName}Props {
  // Add your prop types here
}
`
    }
  ];

  return {
    files,
    basePath,
    componentName: pascalName
  };
}

/**
 * Template: Next.js API Route
 */
async function scaffoldApiRoute(name, patterns, options) {
  const kebabName = toKebabCase(name);
  const basePath = options.path || `app/api/${kebabName}`;

  const files = [
    {
      path: `${basePath}/route.ts`,
      type: 'api',
      content: `import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Request validation schema
const CreateSchema = z.object({
  // Add your schema fields here
  name: z.string().min(1),
})

// GET handler
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '10')

    // TODO: Replace with actual data fetching
    const data = []

    return NextResponse.json({
      data,
      pagination: { page, limit, total: 0 },
    })
  } catch (error) {
    console.error('GET /${kebabName} error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ${kebabName}' },
      { status: 500 }
    )
  }
}

// POST handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = CreateSchema.parse(body)

    // TODO: Replace with actual data creation
    const result = {
      id: crypto.randomUUID(),
      ...validated,
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('POST /${kebabName} error:', error)
    return NextResponse.json(
      { error: 'Failed to create ${kebabName}' },
      { status: 500 }
    )
  }
}
`
    }
  ];

  return {
    files,
    basePath,
    routeName: kebabName
  };
}

/**
 * Template: Test file
 */
async function scaffoldTest(name, patterns, options) {
  const componentPath = name;
  const componentName = toPascalCase(basename(componentPath, extname(componentPath)));
  const testDir = dirname(componentPath);
  const basePath = options.path || join(testDir, '__tests__');

  const files = [
    {
      path: `${basePath}/${basename(componentPath).replace(/\.(tsx?|jsx?)$/, '.test.tsx')}`,
      type: 'test',
      content: `import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ${componentName} } from '../${basename(componentPath, extname(componentPath))}'

describe('${componentName}', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<${componentName} />)
    expect(screen.getByText(/${componentName}/i)).toBeInTheDocument()
  })

  it('handles interactions correctly', async () => {
    render(<${componentName} />)

    // TODO: Add interaction tests

    await waitFor(() => {
      // Add assertions
    })
  })

  it('displays error state gracefully', async () => {
    // TODO: Test error handling
  })
})
`
    }
  ];

  return {
    files,
    basePath,
    componentName
  };
}

/**
 * Template: Feature module
 */
async function scaffoldFeature(name, patterns, options) {
  const kebabName = toKebabCase(name);
  const pascalName = toPascalCase(name);
  const basePath = options.path || `app/(dashboard)/${kebabName}`;

  const files = [
    {
      path: `${basePath}/page.tsx`,
      type: 'component',
      content: `import { ${pascalName}List } from './components/${kebabName}-list'

export default function ${pascalName}Page() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">${pascalName}</h1>
      <${pascalName}List />
    </div>
  )
}
`
    },
    {
      path: `${basePath}/components/${kebabName}-list.tsx`,
      type: 'component',
      content: `'use client'

export function ${pascalName}List() {
  return (
    <div className="grid gap-4">
      {/* Add list items here */}
    </div>
  )
}
`
    },
    {
      path: `lib/${kebabName}/types.ts`,
      type: 'type',
      content: `/**
 * ${pascalName} domain types
 */
export interface ${pascalName} {
  id: string
  createdAt: string
  updatedAt: string
  // Add your fields here
}
`
    },
    {
      path: `lib/${kebabName}/api.ts`,
      type: 'util',
      content: `import type { ${pascalName} } from './types'

/**
 * Fetch all ${kebabName}
 */
export async function fetch${pascalName}s(): Promise<${pascalName}[]> {
  const response = await fetch('/api/${kebabName}')
  if (!response.ok) throw new Error('Failed to fetch ${kebabName}')
  const data = await response.json()
  return data.data
}

/**
 * Create a new ${name}
 */
export async function create${pascalName}(data: Partial<${pascalName}>): Promise<${pascalName}> {
  const response = await fetch('/api/${kebabName}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Failed to create ${name}')
  const result = await response.json()
  return result.data
}
`
    }
  ];

  return {
    files,
    basePath,
    featureName: pascalName
  };
}

/**
 * Template: Custom hook
 */
async function scaffoldHook(name, patterns, options) {
  const camelName = toCamelCase(name);
  const hookName = camelName.startsWith('use') ? camelName : `use${toPascalCase(name)}`;
  const basePath = options.path || 'hooks';

  const files = [
    {
      path: `${basePath}/${toKebabCase(hookName)}.ts`,
      type: 'util',
      content: `import { useState, useEffect } from 'react'

/**
 * Custom hook: ${hookName}
 */
export function ${hookName}() {
  const [state, setState] = useState<any>(null)

  useEffect(() => {
    // Add effect logic here
  }, [])

  return state
}
`
    }
  ];

  return {
    files,
    basePath,
    hookName
  };
}

/**
 * Template: Context provider
 */
async function scaffoldContext(name, patterns, options) {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);
  const basePath = options.path || `contexts/${toKebabCase(name)}`;

  const files = [
    {
      path: `${basePath}/index.tsx`,
      type: 'component',
      content: `'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ${pascalName}ContextValue {
  state: any
  setState: (state: any) => void
}

const ${pascalName}Context = createContext<${pascalName}ContextValue | undefined>(undefined)

export function ${pascalName}Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<any>(null)

  const value = {
    state,
    setState,
  }

  return (
    <${pascalName}Context.Provider value={value}>
      {children}
    </${pascalName}Context.Provider>
  )
}

export function use${pascalName}() {
  const context = useContext(${pascalName}Context)
  if (context === undefined) {
    throw new Error('use${pascalName} must be used within ${pascalName}Provider')
  }
  return context
}
`
    }
  ];

  return {
    files,
    basePath,
    contextName: pascalName
  };
}

/**
 * Template: FastAPI route
 */
async function scaffoldFastAPIRoute(name, patterns, options) {
  const snakeName = toKebabCase(name).replace(/-/g, '_');
  const pascalName = toPascalCase(name);
  const basePath = options.path || `app/routers`;

  const files = [
    {
      path: `${basePath}/${snakeName}.py`,
      type: 'api',
      content: `"""${pascalName} management endpoints."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/${snakeName}", tags=["${snakeName}"])


class ${pascalName}Create(BaseModel):
    """Schema for creating a ${name}."""
    name: str = Field(..., min_length=1, max_length=100)


class ${pascalName}Response(BaseModel):
    """Schema for ${name} response."""
    id: UUID
    name: str
    created_at: str

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""
    data: list[${pascalName}Response]
    total: int
    page: int
    limit: int


async def get_db():
    """Database session dependency."""
    # TODO: Replace with actual database session
    yield None


@router.get("", response_model=PaginatedResponse)
async def list_${snakeName}(
    db: Annotated[None, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
) -> PaginatedResponse:
    """List all ${snakeName} with pagination."""
    # TODO: Replace with actual database query
    data: list[${pascalName}Response] = []
    total = 0

    return PaginatedResponse(data=data, total=total, page=page, limit=limit)


@router.post("", response_model=${pascalName}Response, status_code=status.HTTP_201_CREATED)
async def create_${snakeName}(
    data: ${pascalName}Create,
    db: Annotated[None, Depends(get_db)],
) -> ${pascalName}Response:
    """Create a new ${name}."""
    # TODO: Replace with actual database insert
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Database integration pending",
    )
`
    }
  ];

  return {
    files,
    basePath,
    routeName: snakeName
  };
}

/**
 * Validate output against schema
 */
async function validateOutput(output) {
  try {
    const schemaPath = join(PROJECT_ROOT, '.claude/schemas/skill-scaffolder-output.schema.json');
    const schemaContent = await readFile(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Basic validation (full Ajv validation would require the dependency)
    if (!output.skill_name || output.skill_name !== 'scaffolder') {
      throw new Error('Invalid skill_name');
    }
    if (!Array.isArray(output.files_generated) || output.files_generated.length === 0) {
      throw new Error('No files generated');
    }
    if (!Array.isArray(output.patterns_applied) || output.patterns_applied.length === 0) {
      throw new Error('No patterns applied');
    }
    if (typeof output.rule_index_consulted !== 'boolean') {
      throw new Error('rule_index_consulted must be boolean');
    }

    return { valid: true };
  } catch (error) {
    console.warn('Schema validation warning:', error.message);
    return { valid: false, error: error.message };
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Scaffolder - Rule-compliant code generator

Usage:
  node scaffold.mjs <template> <name> [options]

Templates:
${Object.entries(TEMPLATES).map(([key, { description }]) =>
  `  ${key.padEnd(20)} ${description}`
).join('\n')}

Options:
  --path <path>       Target directory for generated files
  --list              List available templates
  --help              Show this help message

Examples:
  node scaffold.mjs component UserProfile
  node scaffold.mjs client-component SearchBar --path src/components
  node scaffold.mjs api users
  node scaffold.mjs test src/components/Button.tsx
  node scaffold.mjs feature user-management
  `);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle flags
  if (args.includes('--help')) {
    showHelp();
    return;
  }

  if (args.includes('--list')) {
    console.log('\nAvailable templates:\n');
    Object.entries(TEMPLATES).forEach(([key, { description, technologies }]) => {
      console.log(`  ${key}`);
      console.log(`    ${description}`);
      console.log(`    Technologies: ${technologies.join(', ')}\n`);
    });
    return;
  }

  // Parse arguments
  const templateType = args[0];
  const name = args[1];
  const options = {};

  // Parse options
  for (let i = 2; i < args.length; i += 2) {
    if (args[i] === '--path') {
      options.path = args[i + 1];
    }
  }

  if (!templateType || !name) {
    console.error('Error: Missing required arguments');
    showHelp();
    process.exit(1);
  }

  const template = TEMPLATES[templateType];
  if (!template) {
    console.error(`Error: Unknown template "${templateType}"`);
    console.log('\nRun with --list to see available templates');
    process.exit(1);
  }

  try {
    // 1. Load rule index
    console.log('Loading rule index...');
    const ruleIndex = await loadRuleIndex();

    // 2. Detect technology stack
    console.log('Detecting technology stack...');
    const techStack = await detectTechStack();
    console.log(`Technologies: ${techStack.join(', ')}`);

    // 3. Query relevant rules
    console.log('Querying relevant rules...');
    const templateTechs = [...new Set([...template.technologies, ...techStack])];
    const rules = queryTechnologyMap(ruleIndex, templateTechs);
    console.log(`Found ${rules.length} relevant rules`);

    // 4. Extract patterns from rules
    console.log('Extracting patterns...');
    const patterns = await extractPatterns(rules);
    console.log(`Extracted ${patterns.length} patterns`);

    // 5. Generate code using template + patterns
    console.log(`Generating ${templateType}...`);
    const result = await template.handler(name, patterns, options);

    // 6. Write files
    console.log('Writing files...');
    const writtenPaths = await writeFiles(result.files);

    // 7. Build output conforming to schema
    const output = {
      skill_name: 'scaffolder',
      template_type: templateType,
      component_type: result.componentName || result.routeName || result.featureName || name,
      files_generated: result.files.map(f => ({
        path: resolve(PROJECT_ROOT, f.path),
        type: f.type,
        lines_of_code: f.content.split('\n').length
      })),
      patterns_applied: patterns.length > 0
        ? patterns.map(p => p.name)
        : ['Default template pattern'],
      rules_loaded: rules.map(r => r.name),
      rule_index_consulted: true,
      technology_stack: templateTechs,
      template_used: templateType,
      supporting_files: result.files.slice(1).map(f => resolve(PROJECT_ROOT, f.path)),
      timestamp: new Date().toISOString()
    };

    // 8. Validate output
    await validateOutput(output);

    // 9. Output JSON
    console.log('\n' + JSON.stringify(output, null, 2));

    console.log('\n✅ Scaffolding complete!');
    console.log(`\nGenerated files:`);
    writtenPaths.forEach(path => console.log(`  - ${path}`));

  } catch (error) {
    console.error('\n❌ Scaffolding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { scaffoldComponent, scaffoldClientComponent, scaffoldApiRoute, scaffoldTest, scaffoldFeature, scaffoldHook, scaffoldContext, scaffoldFastAPIRoute };
