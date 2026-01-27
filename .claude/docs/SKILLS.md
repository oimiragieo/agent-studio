# Skills System

Complete reference for the Claude Code Enterprise Framework skill system with 426+ reusable capabilities.

## What Are Skills?

Skills are reusable capabilities that agents can invoke to perform specialized tasks. Each skill encapsulates best practices, workflows, and technical knowledge in a standardized format.

**Key characteristics:**

- **Reusable**: One skill, many agents
- **Discoverable**: Cataloged for easy lookup
- **Executable**: Agents invoke with `Skill()` tool
- **Validated**: JSON Schema enforcement
- **Versioned**: Track changes over time

**426+ skills available** across development, security, DevOps, scientific research, and more.

## How to Invoke Skills

**Agents use the `Skill()` tool to invoke skills, not just read them.**

### Correct Invocation

```javascript
// CORRECT: Use Skill tool to invoke
Skill({ skill: 'tdd' });
Skill({ skill: 'debugging' });
Skill({ skill: 'plan-generator' });

// For sub-skills, use full path (REQUIRED)
Skill({ skill: 'scientific-skills/rdkit' }); // Cheminformatics
Skill({ skill: 'scientific-skills/scanpy' }); // Single-cell analysis
Skill({ skill: 'scientific-skills/biopython' }); // Bioinformatics
```

### Incorrect Usage

```javascript
// WRONG: Just reading the file doesn't apply the skill
Read('.claude/skills/tdd/SKILL.md'); // ❌ Reading is not invoking
```

**Why this matters:** The `Skill()` tool activates the skill's capabilities. Simply reading the file only provides documentation without applying the workflow.

## Skill Discovery

Skills are dynamically discovered from the skill catalog.

### Finding Skills

1. **Read the skill catalog:**

   ```bash
   cat .claude/context/artifacts/skill-catalog.md
   ```

2. **Search by category or keyword:**
   - Core Development: tdd, debugging, testing-expert
   - Security: security-architect, auth-security-expert
   - Languages: python-pro, rust-pro, go-expert
   - Frameworks: react-expert, nextjs-pro, flutter-expert

3. **Invoke with skill name:**
   ```javascript
   Skill({ skill: 'skill-name' });
   ```

### Skill Catalog Location

**File:** `.claude/context/artifacts/skill-catalog.md`

**Total Skills:** See catalog header for current count (426+ as of 2026-01-25)

## Skill Consolidation and Deprecations

To reduce duplication and improve maintenance, several skills have been merged:

| Deprecated Skill | Replacement      | Status | Compatibility               |
| ---------------- | ---------------- | ------ | --------------------------- |
| `testing-expert` | `tdd`            | Merged | Alias preserved - both work |
| `writing`        | `writing-skills` | Merged | Alias preserved - both work |

**What this means:**

- **Backward Compatible**: Old skill names still work via aliases
- **Redirects Automatically**: `Skill({ skill: "testing-expert" })` → loads `tdd` skill
- **No Breaking Changes**: Existing agents continue to work
- **6 Skill Pairs**: Now have cross-references between original and consolidated versions

**Migration Guide:**

```javascript
// Old (still works)
Skill({ skill: 'testing-expert' });
Skill({ skill: 'writing' });

// Recommended (use consolidated versions)
Skill({ skill: 'tdd' });
Skill({ skill: 'writing-skills' });
```

**Content Migration:**

- **testing-expert → tdd**: Testing patterns merged into TDD skill
- **writing → writing-skills**: Writing guidelines now in "Writing Style Guidelines" section of writing-skills

## Skill Categories

### Core Development (10 skills)

Essential development workflow skills.

| Skill                 | Description                            | Invocation                                 |
| --------------------- | -------------------------------------- | ------------------------------------------ |
| `tdd`                 | Test-Driven Development with Iron Laws | `Skill({ skill: 'tdd' });`                 |
| `debugging`           | Systematic 4-phase debugging           | `Skill({ skill: 'debugging' });`           |
| `testing-expert`      | Unit tests, E2E, integration           | `Skill({ skill: 'testing-expert' });`      |
| `code-quality-expert` | Clean code and refactoring             | `Skill({ skill: 'code-quality-expert' });` |

**Use when:** Writing production code, fixing bugs, improving code quality.

### Planning & Architecture (6 skills)

Design and planning skills.

| Skill                 | Description                | Invocation                                 |
| --------------------- | -------------------------- | ------------------------------------------ |
| `plan-generator`      | Creates structured plans   | `Skill({ skill: 'plan-generator' });`      |
| `architecture-review` | Design validation          | `Skill({ skill: 'architecture-review' });` |
| `diagram-generator`   | Architecture diagrams      | `Skill({ skill: 'diagram-generator' });`   |
| `brainstorming`       | Socratic design refinement | `Skill({ skill: 'brainstorming' });`       |

**Use when:** Designing features, reviewing architecture, creating diagrams.

### Security (6 skills)

Security analysis and validation.

| Skill                  | Description                     | Invocation                                  |
| ---------------------- | ------------------------------- | ------------------------------------------- |
| `security-architect`   | OWASP Top 10, threat modeling   | `Skill({ skill: 'security-architect' });`   |
| `auth-security-expert` | OAuth 2.1, JWT, encryption      | `Skill({ skill: 'auth-security-expert' });` |
| `memory-forensics`     | Memory acquisition and analysis | `Skill({ skill: 'memory-forensics' });`     |

**Use when:** Implementing authentication, reviewing security, analyzing vulnerabilities.

### Languages (16 skills)

Language-specific expertise.

| Skill                   | Description                   | Invocation                                   |
| ----------------------- | ----------------------------- | -------------------------------------------- |
| `python-backend-expert` | Django, FastAPI, Flask        | `Skill({ skill: 'python-backend-expert' });` |
| `typescript-expert`     | TypeScript patterns and types | `Skill({ skill: 'typescript-expert' });`     |
| `rust-pro`              | Rust programming              | `Skill({ skill: 'rust-pro' });`              |
| `golang-pro`            | Go programming                | `Skill({ skill: 'golang-pro' });`            |

**Use when:** Writing or reviewing code in a specific language.

### Frameworks (24 skills)

Framework-specific expertise.

| Skill           | Description                       | Invocation                           |
| --------------- | --------------------------------- | ------------------------------------ |
| `react-expert`  | React 19, hooks, state management | `Skill({ skill: 'react-expert' });`  |
| `nextjs-expert` | Next.js App Router                | `Skill({ skill: 'nextjs-expert' });` |
| `fastapi-pro`   | FastAPI best practices            | `Skill({ skill: 'fastapi-pro' });`   |
| `svelte-expert` | Svelte and SvelteKit              | `Skill({ skill: 'svelte-expert' });` |

**Use when:** Building applications with specific frameworks.

### DevOps & Infrastructure (18 skills)

Cloud, containers, and infrastructure.

| Skill             | Description                    | Invocation                             |
| ----------------- | ------------------------------ | -------------------------------------- |
| `aws-cloud-ops`   | CloudWatch, S3, Lambda         | `Skill({ skill: 'aws-cloud-ops' });`   |
| `docker-compose`  | Docker orchestration           | `Skill({ skill: 'docker-compose' });`  |
| `kubernetes-flux` | Kubernetes with Flux           | `Skill({ skill: 'kubernetes-flux' });` |
| `terraform-infra` | Terraform with safety controls | `Skill({ skill: 'terraform-infra' });` |

**Use when:** Deploying infrastructure, managing containers, setting up CI/CD.

### Scientific Research (139 sub-skills)

Comprehensive scientific research toolkit for biology, chemistry, medicine, data science.

**Source:** Integrated from [K-Dense-AI/claude-scientific-skills](https://github.com/K-Dense-AI/claude-scientific-skills)

#### Invocation

```javascript
// Invoke the main skill catalog
Skill({ skill: 'scientific-skills' });

// Invoke specific sub-skills using full path (REQUIRED)
Skill({ skill: 'scientific-skills/rdkit' }); // Cheminformatics
Skill({ skill: 'scientific-skills/scanpy' }); // Single-cell analysis
Skill({ skill: 'scientific-skills/biopython' }); // Bioinformatics
Skill({ skill: 'scientific-skills/chembl-database' }); // ChEMBL database
```

#### Sub-Skill Categories

| Category                         | Count | Key Skills                                                                |
| -------------------------------- | ----- | ------------------------------------------------------------------------- |
| Scientific Databases             | 28+   | `pubchem-database`, `chembl-database`, `uniprot-database`, `pdb-database` |
| Python Analysis Libraries        | 55+   | `rdkit`, `scanpy`, `biopython`, `pytorch-lightning`                       |
| Bioinformatics & Genomics        | 10+   | `gget`, `pysam`, `deeptools`, `pydeseq2`                                  |
| Cheminformatics & Drug Discovery | 7+    | `datamol`, `molfeat`, `diffdock`, `torchdrug`                             |
| Scientific Communication         | 10+   | `literature-review`, `scientific-writing`, `hypothesis-generation`        |
| Clinical & Medical               | 5+    | `clinical-decision-support`, `pyhealth`, `pydicom`                        |
| Laboratory & Integration         | 5+    | `benchling-integration`, `dnanexus-integration`, `pylabrobot`             |
| Machine Learning & AI            | 15+   | `pytorch-lightning`, `transformers`, `scikit-learn`, `shap`               |
| Document Processing              | 4     | `docx`, `pdf`, `pptx`, `xlsx`                                             |

#### Example Workflows

**Drug Discovery Pipeline:**

```javascript
Skill({ skill: 'scientific-skills/chembl-database' });
Skill({ skill: 'scientific-skills/rdkit' });
Skill({ skill: 'scientific-skills/datamol' });
Skill({ skill: 'scientific-skills/diffdock' });
```

**Single-Cell Analysis:**

```javascript
Skill({ skill: 'scientific-skills/scanpy' });
Skill({ skill: 'scientific-skills/anndata' });
Skill({ skill: 'scientific-skills/cellxgene-census' });
```

**Literature Review:**

```javascript
Skill({ skill: 'scientific-skills/literature-review' });
Skill({ skill: 'scientific-skills/pubmed-database' });
Skill({ skill: 'scientific-skills/citation-management' });
```

**Use when:** Conducting scientific research, analyzing biological data, drug discovery.

### Creator Tools (9 skills)

Framework self-evolution tools.

| Skill              | Description                   | Invocation                              |
| ------------------ | ----------------------------- | --------------------------------------- |
| `agent-creator`    | Creates specialized AI agents | `Skill({ skill: 'agent-creator' });`    |
| `skill-creator`    | Creates and converts skills   | `Skill({ skill: 'skill-creator' });`    |
| `workflow-creator` | Creates multi-agent workflows | `Skill({ skill: 'workflow-creator' });` |
| `hook-creator`     | Creates validation hooks      | `Skill({ skill: 'hook-creator' });`     |
| `template-creator` | Creates templates             | `Skill({ skill: 'template-creator' });` |
| `schema-creator`   | Creates JSON Schemas          | `Skill({ skill: 'schema-creator' });`   |

**Use when:** Extending the framework with new agents, skills, workflows, or schemas.

See [CLAUDE.md Section 4.1](../CLAUDE.md) for the complete Creator Ecosystem documentation.

### Documentation (11 skills)

Documentation generation and writing.

| Skill            | Description                 | Invocation                            |
| ---------------- | --------------------------- | ------------------------------------- |
| `doc-generator`  | Comprehensive documentation | `Skill({ skill: 'doc-generator' });`  |
| `writing`        | Writing guidelines          | `Skill({ skill: 'writing' });`        |
| `writing-skills` | TDD for documentation       | `Skill({ skill: 'writing-skills' });` |
| `readme`         | README generation           | `Skill({ skill: 'readme' });`         |

**Use when:** Creating API docs, user guides, README files.

## Skill Structure (SKILL.md Format)

All skills use standardized YAML frontmatter:

```yaml
---
name: skill-name
description: What the skill does and when to use it
version: 1.0.0
model: sonnet
invoked_by: both
user_invocable: true
tools: [Read, Write, Edit, Bash, Glob, Grep]
best_practices:
  - Write failing test before any production code
  - Watch the test fail before implementing
error_handling: strict
streaming: supported
---

# Skill Name

## Overview
Core principle in 1-2 sentences.

## Purpose
What this skill accomplishes.

## Usage
How to invoke and use the skill.

## Examples
Concrete usage examples.

## Memory Protocol (MANDATORY)
**Before starting:** Read `.claude/context/memory/learnings.md`
**After completing:** Record learnings, issues, decisions.
```

**Key fields:**

- `name`: Skill identifier (letters, numbers, hyphens only)
- `description`: When to use (triggers, symptoms, contexts)
- `version`: Semantic version
- `model`: Recommended model (haiku, sonnet, opus)
- `tools`: Required Claude Code tools
- `invoked_by`: `user`, `agent`, or `both`

## Creating New Skills

Use the `skill-creator` skill to create new skills.

```javascript
// Invoke the skill creator
Skill({ skill: 'skill-creator' });
```

### Creation Workflow

```bash
# Create a basic skill
node .claude/skills/skill-creator/scripts/create.cjs \
  --name "pdf-extractor" \
  --description "Extract text and images from PDF documents" \
  --tools "Read,Write,Bash"

# Create skill with hooks and schemas (auto-creates tool)
node .claude/skills/skill-creator/scripts/create.cjs \
  --name "data-validator" \
  --description "Validate and sanitize data inputs before processing" \
  --hooks --schemas
```

### Conversion from MCP Servers

Convert Model Context Protocol servers to skills:

```bash
# Convert npm MCP server
node .claude/skills/skill-creator/scripts/convert.cjs \
  --server "@modelcontextprotocol/server-filesystem"

# Convert PyPI server
node .claude/skills/skill-creator/scripts/convert.cjs \
  --server "mcp-server-git" --source pypi
```

### Conversion from Legacy Rules

Convert old rule files to skills:

```bash
# Convert a single rule file
node .claude/skills/skill-creator/scripts/create.cjs \
  --convert-rule "/path/to/rule.mdc"

# Convert all rules in a directory
node .claude/skills/skill-creator/scripts/create.cjs \
  --convert-rules "/path/to/rules-library"
```

## Creator Skills Ecosystem

The framework includes a self-evolution system where skills can create other artifacts.

| Creator            | Creates      | Output Location      |
| ------------------ | ------------ | -------------------- |
| `agent-creator`    | Agents       | `.claude/agents/`    |
| `skill-creator`    | Skills       | `.claude/skills/`    |
| `workflow-creator` | Workflows    | `.claude/workflows/` |
| `hook-creator`     | Hooks        | `.claude/hooks/`     |
| `template-creator` | Templates    | `.claude/templates/` |
| `schema-creator`   | JSON Schemas | `.claude/schemas/`   |

**Example chain:**

```text
User: "I need sentiment analysis capability"

[ROUTER] No matching skill found
[ROUTER] -> Spawning SKILL-CREATOR

[SKILL-CREATOR] Creating skill...
[SKILL-CREATOR] -> Invoking agent-creator for dedicated agent
[AGENT-CREATOR] Created sentiment-analyst agent with sentiment-analyzer skill

[ROUTER] Capability ready. Routing to sentiment-analyst agent.
```

## Agent Assignment

Skills are assigned to agents in two ways:

### 1. Agent Frontmatter

```yaml
---
name: developer
skills:
  - tdd
  - debugging
  - git-expert
---
```

### 2. Agent Workflow

```markdown
### Step 0: Load Skills (FIRST)

Read your assigned skill files:

- `.claude/skills/tdd/SKILL.md`
- `.claude/skills/debugging/SKILL.md`
- `.claude/skills/git-expert/SKILL.md`
```

**Auto-assignment:** When creating skills, the `skill-creator` automatically assigns them to relevant agents based on domain keywords.

## Skill Catalog Maintenance

The skill catalog is the source of truth for skill discovery.

**Location:** `.claude/context/artifacts/skill-catalog.md`

**Structure:**

```markdown
# Skill Catalog

> **Total Skills: 426** | Last Updated: 2026-01-25

## Quick Reference by Category

| Category                | Count | Key Skills                          |
| ----------------------- | ----- | ----------------------------------- |
| Core Development        | 10    | tdd, debugging, testing-expert      |
| Planning & Architecture | 6     | plan-generator, architecture-review |

...

## Core Development

| Skill | Description             | Tools                   |
| ----- | ----------------------- | ----------------------- |
| `tdd` | Test-Driven Development | Read, Write, Edit, Bash |

...
```

**Updating the catalog:**

1. Create new skill
2. Determine category
3. Add entry to category table
4. Update Quick Reference counts
5. Verify with grep:
   ```bash
   grep "skill-name" .claude/context/artifacts/skill-catalog.md
   ```

## Advanced Features

### Hooks (Pre/Post Execution)

Skills can define hooks for validation:

```bash
# Create skill with hooks
node .claude/skills/skill-creator/scripts/create.cjs \
  --name "security-check" \
  --hooks --register-hooks
```

**Hook structure:**

```
.claude/skills/security-check/
├── SKILL.md
├── hooks/
│   ├── pre-execute.cjs   # Validate inputs
│   └── post-execute.cjs  # Validate outputs
```

### Schemas (Input/Output Validation)

Skills can define JSON Schemas:

```bash
# Create skill with schemas
node .claude/skills/skill-creator/scripts/create.cjs \
  --name "data-validator" \
  --schemas --register-schemas
```

**Schema structure:**

```
.claude/skills/data-validator/
├── SKILL.md
├── schemas/
│   ├── input.schema.json
│   └── output.schema.json
```

### Companion Tools

Complex skills automatically get companion CLI tools:

```
.claude/tools/data-validator/
├── data-validator.cjs   # CLI wrapper
└── README.md
```

**Invocation:**

```bash
node .claude/tools/data-validator/data-validator.cjs --input data.json
```

## Workflow Integration

Skills integrate with the multi-agent orchestration system.

### Router Integration

The Router uses skills to determine agent capabilities:

```text
User: "Fix the authentication bug"

[ROUTER] Analyzing request...
- Bug fix in auth code
- Requires: debugging, security review

[ROUTER] Spawning DEVELOPER with debugging skill
[ROUTER] Spawning SECURITY-ARCHITECT for review

[DEVELOPER] Invoking debugging skill...
Skill({ skill: 'debugging' });
```

### Agent Workflows

Agents invoke skills as part of their workflow:

```markdown
## Developer Agent Workflow

### Step 1: Invoke TDD Skill

Skill({ skill: 'tdd' });

### Step 2: Implement with Tests

- Write failing test
- Implement minimal code
- Verify green

### Step 3: Code Quality Check

Skill({ skill: 'code-quality-expert' });
```

## Best Practices

### Skill Invocation

1. **Always use `Skill()` tool** - Never just read SKILL.md
2. **Invoke at task start** - Load skills before executing work
3. **Use full paths for sub-skills** - `scientific-skills/rdkit` not just `rdkit`
4. **Check skill catalog first** - Avoid creating duplicate skills

### Skill Creation

1. **Follow standardized structure** - Use `skill-creator` templates
2. **Include Memory Protocol** - Every skill MUST have it
3. **Update skill catalog** - Make skills discoverable
4. **Assign to agents** - Unassigned skills are never used
5. **Validate after creation** - Run validation checks

### Skill Documentation

1. **Clear description** - Focus on when to use (triggers, symptoms)
2. **No workflow in description** - Keep description focused on triggering conditions
3. **Concrete examples** - Show real usage, not templates
4. **Tool requirements** - List all required Claude Code tools

## Troubleshooting

### Skill Not Found

```text
Error: Skill 'my-skill' not found
```

**Solution:**

1. Check skill catalog: `grep "my-skill" .claude/context/artifacts/skill-catalog.md`
2. Verify skill exists: `ls .claude/skills/my-skill/SKILL.md`
3. If missing, create with `skill-creator`

### Skill Not Invoked

```text
Agent completed task without using assigned skill
```

**Solution:**

1. Verify agent has skill in frontmatter `skills:` array
2. Check agent workflow includes skill loading step
3. Verify agent calls `Skill()` tool, not just `Read()`

### Skill Validation Errors

```bash
node .claude/skills/skill-creator/scripts/validate-all.cjs
```

**Common errors:**

- Multi-line YAML description (use single-line)
- Missing Memory Protocol section
- Invalid tool references
- Broken file pointers

## Reference

### Complete Skill List

See `.claude/context/artifacts/skill-catalog.md` for the complete list of 426+ skills organized by category.

### Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Multi-agent orchestration system
- [AGENTS.md](./AGENTS.md) - Agent system documentation
- [skill-creator SKILL.md](../skills/skill-creator/SKILL.md) - Skill creation guide
- [Skill Lifecycle Workflow](../workflows/core/skill-lifecycle.md) - Artifact lifecycle

### Example Usage

**Full workflow example:**

```javascript
// User: "Implement user authentication"

// Router analyzes and spawns planner
Task({
  description: 'Planning auth feature',
  prompt: `You are PLANNER.

## Instructions
1. Invoke plan-generator skill
   Skill({ skill: 'plan-generator' });
2. Create implementation plan
3. Create tasks from plan
  `,
});

// Planner creates plan and tasks
// Router spawns developer to execute

Task({
  description: 'Implementing auth feature',
  prompt: `You are DEVELOPER.

## Instructions
1. Invoke TDD skill
   Skill({ skill: 'tdd' });
2. Invoke security-architect skill
   Skill({ skill: 'security-architect' });
3. Execute tasks following TDD cycle
  `,
});

// Developer completes implementation with skills
```

---

**Skills are the foundation of the multi-agent ecosystem. Master skill invocation and creation to build powerful, reusable capabilities.**
