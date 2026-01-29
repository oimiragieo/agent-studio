#!/usr/bin/env node
/**
 * Skill Consolidation Tool
 *
 * Consolidates granular skills into domain-based expert skills
 * to reduce context overhead and simplify router selection.
 */

const fs = require('fs');
const path = require('path');

const CLAUDE_DIR = path.resolve(__dirname, '../../..');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');

// Domain buckets with their patterns and descriptions
const DOMAIN_BUCKETS = {
  // Frontend Frameworks
  'react-expert': {
    patterns: [/^react-/, /^shadcn-/, /^radix-/],
    description:
      'React ecosystem expert including hooks, state management, component patterns, Shadcn UI, and Radix primitives',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
  'angular-expert': {
    patterns: [/^angular-/, /^novo-elements-/],
    description:
      'Angular framework expert including components, services, RxJS, templates, and testing',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
  'vue-expert': {
    patterns: [/^vue-/, /^nuxt-/, /^pinia-/],
    description: 'Vue.js ecosystem expert including Vue 3, Composition API, Nuxt, and Pinia',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
  'svelte-expert': {
    patterns: [/^svelte-/, /^sveltekit-/],
    description: 'Svelte and SvelteKit expert including components, stores, and routing',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
  'astro-expert': {
    patterns: [/^astro-/],
    description:
      'Astro framework expert including components, content collections, and integrations',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
  'nextjs-expert': {
    patterns: [/^next-/, /^nextjs-/],
    description: 'Next.js framework expert including App Router, Server Components, and API routes',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
  'solidjs-expert': {
    patterns: [/^solidjs-/, /^solid-/],
    description: 'SolidJS expert including reactivity, components, and store patterns',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
  'qwik-expert': {
    patterns: [/^qwik-/],
    description: 'Qwik framework expert including resumability, lazy loading, and optimization',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Mobile
  'android-expert': {
    patterns: [/^android-/, /^jetpack-/, /^kotlin-/],
    description:
      'Android development expert including Jetpack Compose, Kotlin, and Material Design',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
  'flutter-expert': {
    patterns: [/^flutter-/, /^dart-/],
    description:
      'Flutter and Dart expert including widgets, state management, and platform integration',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
  'ios-expert': {
    patterns: [/^ios-/, /^swift-/, /^swiftui-/],
    description: 'iOS development expert including SwiftUI, UIKit, and Apple frameworks',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Backend - Python
  'python-backend-expert': {
    patterns: [
      /^python-/,
      /^django-/,
      /^fastapi-/,
      /^flask-/,
      /^pydantic-/,
      /^sqlalchemy-/,
      /^alembic-/,
    ],
    description:
      'Python backend expert including Django, FastAPI, Flask, SQLAlchemy, and async patterns',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Backend - Go
  'go-expert': {
    patterns: [/^go-/, /^golang-/, /^grpc-/],
    description: 'Go programming expert including APIs, gRPC, concurrency, and best practices',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Backend - Node.js
  'nodejs-expert': {
    patterns: [/^node-/, /^nodejs-/, /^express-/, /^nestjs-/, /^nest-/],
    description: 'Node.js backend expert including Express, NestJS, and async patterns',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Backend - Java/Spring
  'java-expert': {
    patterns: [/^java-/, /^spring-/, /^springboot-/],
    description: 'Java and Spring Boot expert including REST APIs, JPA, and microservices',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Backend - Rust
  'rust-expert': {
    patterns: [/^rust-/, /^cargo-/, /^tokio-/],
    description: 'Rust programming expert including async, ownership, and systems programming',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Data & APIs
  'graphql-expert': {
    patterns: [/^graphql-/, /^apollo-/],
    description: 'GraphQL expert including schema design, Apollo Client/Server, and caching',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
  'database-expert': {
    patterns: [/^prisma-/, /^supabase-/, /^database-/, /^sql-/, /^mongodb-/, /^postgres-/],
    description: 'Database expert including Prisma, Supabase, SQL, and NoSQL patterns',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // DevOps & Cloud
  'cloud-devops-expert': {
    patterns: [/^aws-/, /^gcp-/, /^azure-/, /^terraform-/, /^cloudflare-/],
    description: 'Cloud and DevOps expert including AWS, GCP, Azure, and Terraform',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
  'container-expert': {
    patterns: [/^docker-/, /^kubernetes-/, /^k8s-/, /^helm-/, /^knative-/, /^istio-/],
    description:
      'Container orchestration expert including Docker, Kubernetes, Helm, and service mesh',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Testing
  'testing-expert': {
    patterns: [
      /^cypress-/,
      /^jest-/,
      /^vitest-/,
      /^playwright-/,
      /^selenium-/,
      /^testing-/,
      /^test-/,
    ],
    description:
      'Testing expert including unit tests, E2E, integration, and test-driven development',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Styling
  'styling-expert': {
    patterns: [/^tailwind-/, /^css-/, /^sass-/, /^styled-/, /^emotion-/],
    description: 'CSS and styling expert including Tailwind, CSS-in-JS, and responsive design',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // UI Component Libraries
  'ui-components-expert': {
    patterns: [/^chakra-/, /^material-/, /^mantine-/, /^ant-/, /^bootstrap-/],
    description: 'UI component library expert including Chakra, Material UI, and Mantine',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // TypeScript/JavaScript
  'typescript-expert': {
    patterns: [/^typescript-/, /^javascript-/, /^es-module-/, /^esm-/],
    description: 'TypeScript and JavaScript expert including type systems, patterns, and tooling',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // HTMX
  'htmx-expert': {
    patterns: [/^htmx-/],
    description: 'HTMX expert including hypermedia patterns, Django/Flask integration',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Code Quality
  'code-quality-expert': {
    patterns: [
      /^clean-code/,
      /^code-style/,
      /^code-quality/,
      /^coding-guidelines/,
      /^refactoring-/,
      /^linting-/,
    ],
    description: 'Code quality expert including clean code, style guides, and refactoring',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // C/C++
  'cpp-expert': {
    patterns: [/^cpp-/, /^c\+\+-/, /^cmake-/],
    description: 'C/C++ programming expert including modern C++, CMake, and systems programming',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Elixir
  'elixir-expert': {
    patterns: [/^elixir-/, /^phoenix-/, /^ecto-/],
    description: 'Elixir and Phoenix expert including OTP, Ecto, and functional programming',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Chrome Extensions
  'chrome-extension-expert': {
    patterns: [/^chrome-extension-/, /^browser-extension-/, /^extension-/],
    description: 'Browser extension expert including Chrome APIs, manifest, and security',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Game Development
  'gamedev-expert': {
    patterns: [/^dragonruby-/, /^game-/, /^unity-/, /^godot-/],
    description: 'Game development expert including DragonRuby, Unity, and game mechanics',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // AI/ML
  'ai-ml-expert': {
    patterns: [/^ai-/, /^ml-/, /^pytorch-/, /^tensorflow-/, /^langchain-/, /^llm-/, /^chemistry-/],
    description:
      'AI and ML expert including PyTorch, LangChain, LLM integration, and scientific computing',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch'],
  },

  // PHP/Laravel
  'php-expert': {
    patterns: [/^php-/, /^laravel-/, /^wordpress-/, /^drupal-/],
    description: 'PHP expert including Laravel, WordPress, and Drupal development',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Web3/Blockchain
  'web3-expert': {
    patterns: [/^solidity-/, /^web3-/, /^ethereum-/, /^blockchain-/, /^cairo-/, /^hardhat-/],
    description: 'Web3 and blockchain expert including Solidity, Ethereum, and smart contracts',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // State Management
  'state-management-expert': {
    patterns: [/^mobx-/, /^redux-/, /^zustand-/, /^jotai-/, /^recoil-/],
    description: 'State management expert including MobX, Redux, Zustand, and reactive patterns',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // General Best Practices (catch-all for general-* skills)
  'general-best-practices': {
    patterns: [
      /^general-/,
      /^project-/,
      /^documentation-/,
      /^naming-/,
      /^error-handling-/,
      /^performance-/,
      /^security-/,
      /^accessibility-/,
    ],
    description:
      'General software development best practices including naming, error handling, documentation, and security',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Behavioral Rules (no-* patterns)
  'assistant-behavior-rules': {
    patterns: [/^no-/, /^assistant-/, /^response-/, /^clarification-/],
    description:
      'AI assistant behavior rules including response formatting and interaction patterns',
    tools: ['Read', 'Write', 'Edit'],
  },

  // API Development
  'api-development-expert': {
    patterns: [/^api-/, /^rest-/, /^openapi-/, /^swagger-/],
    description: 'API development expert including REST design, OpenAPI, and documentation',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Frontend General
  'frontend-expert': {
    patterns: [/^frontend-/, /^ui-/, /^ux-/, /^responsive-/, /^web-/],
    description:
      'Frontend development expert including UI/UX patterns, responsive design, and accessibility',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Backend General
  'backend-expert': {
    patterns: [/^backend-/, /^server-/, /^middleware-/],
    description:
      'Backend development expert including server architecture, middleware, and data handling',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Build Tools
  'build-tools-expert': {
    patterns: [/^webpack-/, /^vite-/, /^esbuild-/, /^rollup-/, /^turbo-/, /^biome-/],
    description: 'Build tools expert including Vite, Webpack, and bundler configuration',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Data Processing
  'data-expert': {
    patterns: [/^data-/, /^csv-/, /^json-/, /^xml-/, /^parsing-/],
    description: 'Data processing expert including parsing, transformation, and validation',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Auth & Security
  'auth-security-expert': {
    patterns: [/^auth-/, /^oauth-/, /^jwt-/, /^bcrypt-/, /^encryption-/],
    description: 'Authentication and security expert including OAuth, JWT, and encryption',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // CMS & Content
  'cms-expert': {
    patterns: [/^cms-/, /^contentful-/, /^sanity-/, /^strapi-/],
    description: 'CMS expert including headless CMS integration and content management',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },

  // Ruby
  'ruby-expert': {
    patterns: [/^ruby-/, /^rails-/, /^sinatra-/],
    description: 'Ruby and Rails expert including ActiveRecord, Gems, and best practices',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  },
};

// Core skills to never consolidate (original framework skills)
const PROTECTED_SKILLS = [
  // Core creator/generator skills
  'skill-creator',
  'agent-creator',
  'diagram-generator',
  'doc-generator',
  'test-generator',
  'tdd',
  'computer-use',
  // DevOps/Infrastructure skills
  'aws-cloud-ops',
  'docker-compose',
  'gcloud-cli',
  'kubernetes-flux',
  'terraform-infra',
  // Code quality skills
  'code-analyzer',
  'code-style-validator',
  'commit-validator',
  'debugging',
  // Git/GitHub skills
  'git-expert',
  'github-mcp',
  'github-ops',
  // Project management skills
  'incident-runbook-templates',
  'jira-pm',
  'linear-pm',
  'on-call-handoff-patterns',
  'postmortem-writing',
  // Utility skills
  'mcp-converter',
  'project-analyzer',
  'repo-rag',
  'sentry-monitoring',
  'sequential-thinking',
  'slack-notifications',
  'smart-debug',
  'swarm',
  'text-to-sql',
  'tool-search',
  // Agent-referenced skills (DO NOT CONSOLIDATE - actively used by agents)
  'security-architect',
  'database-architect',
  'architecture-review',
  'context-compressor',
  'swarm-coordination',
  'consensus-voting',
  'plan-generator',
  'dependency-analyzer',
  'rule-auditor',
  'response-rater',
  'filesystem',
  'explaining-rules',
  'artifact-publisher',
  'recovery',
];

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    options[key] = value;
  }
}

/**
 * Get all skill directories
 */
function getAllSkills() {
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .filter(name => !PROTECTED_SKILLS.includes(name));
}

/**
 * Read a skill's content
 */
function readSkillContent(skillName) {
  const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return null;
  return fs.readFileSync(skillPath, 'utf-8');
}

/**
 * Extract instructions/guidelines from a skill
 */
function extractGuidelines(content) {
  // Try to extract <instructions> block
  const instructionsMatch = content.match(/<instructions>([\s\S]*?)<\/instructions>/);
  if (instructionsMatch) return instructionsMatch[1].trim();

  // Try to extract after frontmatter
  const bodyMatch = content.match(/^---[\s\S]*?---\n([\s\S]*)$/);
  if (bodyMatch) {
    // Remove Memory Protocol section
    let body = bodyMatch[1];
    body = body.replace(/## Memory Protocol[\s\S]*$/m, '').trim();
    return body;
  }

  return content;
}

/**
 * Match skills to buckets
 */
function matchSkillsToBuckets() {
  const skills = getAllSkills();
  const bucketAssignments = {};
  const unassigned = [];

  // Initialize buckets
  for (const bucket of Object.keys(DOMAIN_BUCKETS)) {
    bucketAssignments[bucket] = [];
  }

  // Match each skill to a bucket
  for (const skill of skills) {
    let matched = false;
    for (const [bucket, config] of Object.entries(DOMAIN_BUCKETS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(skill)) {
          bucketAssignments[bucket].push(skill);
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (!matched) {
      unassigned.push(skill);
    }
  }

  return { bucketAssignments, unassigned };
}

/**
 * Analyze buckets and show what would be consolidated
 */
function analyzeBuckets() {
  const { bucketAssignments, unassigned } = matchSkillsToBuckets();

  console.log('\n📊 SKILL CONSOLIDATION ANALYSIS\n');
  console.log('='.repeat(60) + '\n');

  let totalToConsolidate = 0;
  const activeBuckets = [];

  for (const [bucket, skills] of Object.entries(bucketAssignments)) {
    if (skills.length > 0) {
      activeBuckets.push({ bucket, skills, config: DOMAIN_BUCKETS[bucket] });
      totalToConsolidate += skills.length;
    }
  }

  // Sort by count descending
  activeBuckets.sort((a, b) => b.skills.length - a.skills.length);

  for (const { bucket, skills, config } of activeBuckets) {
    console.log(`📦 ${bucket} (${skills.length} skills)`);
    console.log(`   ${config.description}`);
    if (options.verbose) {
      skills.slice(0, 10).forEach(s => console.log(`     - ${s}`));
      if (skills.length > 10) console.log(`     ... and ${skills.length - 10} more`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`\n📈 SUMMARY:`);
  console.log(`   Total skills to consolidate: ${totalToConsolidate}`);
  console.log(`   Will create: ${activeBuckets.length} expert skills`);
  console.log(`   Unassigned skills: ${unassigned.length}`);

  if (options.verbose && unassigned.length > 0) {
    console.log('\n⚠️  Unassigned skills (will remain as-is):');
    unassigned.slice(0, 20).forEach(s => console.log(`   - ${s}`));
    if (unassigned.length > 20) console.log(`   ... and ${unassigned.length - 20} more`);
  }

  console.log('\n💡 Run with --execute to perform consolidation');
  console.log('   Run with --verbose to see all skills');

  return { bucketAssignments, unassigned, activeBuckets };
}

/**
 * Generate consolidated skill content
 */
function generateConsolidatedSkill(bucket, skills, config) {
  const titleCase = bucket
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Collect all guidelines from source skills
  const allGuidelines = [];
  for (const skill of skills) {
    const content = readSkillContent(skill);
    if (content) {
      const guidelines = extractGuidelines(content);
      if (guidelines && guidelines.length > 50) {
        allGuidelines.push({
          skill,
          guidelines: guidelines.slice(0, 2000), // Limit each to 2000 chars
        });
      }
    }
  }

  // Build consolidated guidelines (limit total size)
  let consolidatedGuidelines = '';
  let currentSize = 0;
  const maxSize = 15000; // 15KB max for guidelines

  for (const { skill, guidelines } of allGuidelines) {
    const section = `### ${skill.replace(/-/g, ' ')}\n\n${guidelines}\n\n`;
    if (currentSize + section.length > maxSize) {
      consolidatedGuidelines += `\n... and ${allGuidelines.length - consolidatedGuidelines.split('###').length + 1} more skill guidelines (see references/)\n`;
      break;
    }
    consolidatedGuidelines += section;
    currentSize += section.length;
  }

  return `---
name: ${bucket}
description: ${config.description}
version: 1.0.0
model: sonnet
invoked_by: both
user_invocable: true
tools: [${config.tools.join(', ')}]
consolidated_from: ${skills.length} skills
best_practices:
  - Follow domain-specific conventions
  - Apply patterns consistently
  - Prioritize type safety and testing
error_handling: graceful
streaming: supported
---

# ${titleCase}

<identity>
You are a ${titleCase.toLowerCase()} with deep knowledge of ${config.description.toLowerCase()}.
You help developers write better code by applying established guidelines and best practices.
</identity>

<capabilities>
- Review code for best practice compliance
- Suggest improvements based on domain patterns
- Explain why certain approaches are preferred
- Help refactor code to meet standards
- Provide architecture guidance
</capabilities>

<instructions>
${consolidatedGuidelines}
</instructions>

<examples>
Example usage:
\`\`\`
User: "Review this code for ${bucket.replace('-expert', '')} best practices"
Agent: [Analyzes code against consolidated guidelines and provides specific feedback]
\`\`\`
</examples>

## Consolidated Skills

This expert skill consolidates ${skills.length} individual skills:
${skills
  .slice(0, 20)
  .map(s => `- ${s}`)
  .join('\n')}
${skills.length > 20 ? `\n... and ${skills.length - 20} more (see references/)` : ''}

## Memory Protocol (MANDATORY)

**Before starting:**
\`\`\`bash
cat .claude/context/memory/learnings.md
\`\`\`

**After completing:** Record any new patterns or exceptions discovered.

> ASSUME INTERRUPTION: Your context may reset. If it's not in memory, it didn't happen.
`;
}

/**
 * Execute consolidation
 */
function executeConsolidation() {
  const { _bucketAssignments, unassigned, activeBuckets } = analyzeBuckets();

  if (!options.execute) {
    return;
  }

  console.log('\n🔧 EXECUTING CONSOLIDATION...\n');

  const consolidated = [];
  const removed = [];
  const errors = [];

  for (const { bucket, skills, config } of activeBuckets) {
    if (skills.length === 0) continue;

    try {
      console.log(`\n📦 Creating ${bucket}...`);

      // Create consolidated skill directory
      const skillDir = path.join(SKILLS_DIR, bucket);
      if (!fs.existsSync(skillDir)) {
        fs.mkdirSync(skillDir, { recursive: true });
      }

      // Generate and write consolidated skill
      const content = generateConsolidatedSkill(bucket, skills, config);
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
      console.log(`   ✅ Created SKILL.md`);

      // Create scripts directory
      const scriptsDir = path.join(skillDir, 'scripts');
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }

      // Create main.cjs
      const mainScript = `#!/usr/bin/env node
/**
 * ${bucket} - Consolidated Expert Skill
 * Consolidates ${skills.length} individual skills
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(\`
${bucket} - Expert Skill

Usage:
  node main.cjs --list     List consolidated skills
  node main.cjs --help     Show this help

Description:
  ${config.description}

Consolidated from: ${skills.length} skills
\`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Consolidated skills:');
  ${JSON.stringify(skills)}.forEach(s => console.log('  - ' + s));
  process.exit(0);
}

console.log('${bucket} skill loaded. Use with Claude for expert guidance.');
`;
      fs.writeFileSync(path.join(scriptsDir, 'main.cjs'), mainScript);
      console.log(`   ✅ Created scripts/main.cjs`);

      // Create references directory with list of source skills
      const refsDir = path.join(skillDir, 'references');
      if (!fs.existsSync(refsDir)) {
        fs.mkdirSync(refsDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(refsDir, 'source-skills.json'),
        JSON.stringify({ bucket, skills, consolidatedAt: new Date().toISOString() }, null, 2)
      );
      console.log(`   ✅ Created references/source-skills.json`);

      consolidated.push(bucket);

      // Remove source skills if --remove flag is set
      if (options.remove) {
        for (const skill of skills) {
          const skillPath = path.join(SKILLS_DIR, skill);
          if (fs.existsSync(skillPath)) {
            fs.rmSync(skillPath, { recursive: true, force: true });
            removed.push(skill);
          }
        }
        console.log(`   🗑️  Removed ${skills.length} source skills`);
      }
    } catch (e) {
      errors.push({ bucket, error: e.message });
      console.log(`   ❌ Error: ${e.message}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 CONSOLIDATION COMPLETE\n');
  console.log(`✅ Created: ${consolidated.length} expert skills`);
  if (options.remove) {
    console.log(`🗑️  Removed: ${removed.length} source skills`);
  }
  console.log(`⚠️  Unassigned: ${unassigned.length} skills (unchanged)`);
  console.log(`❌ Errors: ${errors.length}`);

  if (!options.remove) {
    console.log('\n💡 Run with --remove to delete source skills after consolidation');
  }

  // Update memory
  const memoryPath = path.join(CLAUDE_DIR, 'context', 'memory', 'learnings.md');
  if (fs.existsSync(memoryPath)) {
    const timestamp = new Date().toISOString().split('T')[0];
    const entry = `
## [${timestamp}] Skills Consolidated

- **Expert skills created**: ${consolidated.length}
- **Source skills consolidated**: ${activeBuckets.reduce((sum, b) => sum + b.skills.length, 0)}
${options.remove ? `- **Source skills removed**: ${removed.length}` : '- **Source skills preserved**: (run with --remove to clean up)'}
- **Expert skills**: ${consolidated.join(', ')}

`;
    const memContent = fs.readFileSync(memoryPath, 'utf-8');
    fs.writeFileSync(memoryPath, memContent + entry);
    console.log(`\n📝 Updated memory: ${memoryPath}`);
  }
}

// Help
if (options.help) {
  console.log(`
Skill Consolidation Tool

Consolidates granular skills into domain-based expert skills to reduce
context overhead and simplify router selection.

Usage:
  node consolidate.cjs                    Analyze and show consolidation plan
  node consolidate.cjs --execute          Execute consolidation
  node consolidate.cjs --execute --remove Execute and remove source skills
  node consolidate.cjs --verbose          Show all skills in each bucket
  node consolidate.cjs --list-buckets     List all defined buckets

Options:
  --execute     Perform the consolidation
  --remove      Remove source skills after consolidation
  --verbose     Show detailed skill lists
  --list-buckets List all domain buckets and their patterns
  --help        Show this help

Examples:
  # Preview consolidation
  node consolidate.cjs --verbose

  # Execute consolidation but keep source skills
  node consolidate.cjs --execute

  # Execute and clean up source skills
  node consolidate.cjs --execute --remove
`);
  process.exit(0);
}

if (options['list-buckets']) {
  console.log('\n📦 DOMAIN BUCKETS\n');
  for (const [bucket, config] of Object.entries(DOMAIN_BUCKETS)) {
    console.log(`${bucket}:`);
    console.log(`  Description: ${config.description}`);
    console.log(`  Patterns: ${config.patterns.map(p => p.toString()).join(', ')}`);
    console.log('');
  }
  process.exit(0);
}

// Main execution
executeConsolidation();
