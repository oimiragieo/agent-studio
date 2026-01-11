# Prompt Template Library

This directory contains proven prompt patterns for common development tasks.

## Available Templates

### 1. Codebase Walkthrough

**File**: `codebase-walkthrough.md`
**Purpose**: Comprehensive codebase understanding and exploration
**Agents**: analyst, architect, developer

### 2. Deep Dive

**File**: `deep-dive.md`
**Purpose**: Detailed analysis of specific code areas or features
**Agents**: code-reviewer, architect, developer, performance-engineer

### 3. Senior Review

**File**: `senior-review.md`
**Purpose**: Comprehensive code review from a senior engineer perspective
**Agents**: code-reviewer, security-architect, performance-engineer

### 4. UI Perfection Loop

**File**: `ui-perfection-loop.md`
**Purpose**: Iterative UI improvement with visual perfection focus
**Agents**: ux-expert, accessibility-expert, developer, mobile-developer

## Usage

Templates can be used directly or customized for specific needs. Each template includes:

- Purpose and context
- Template structure
- Usage guidelines
- Recommended agents

## Integration

Templates are referenced in:

- Agent prompts (planner, orchestrator, code-reviewer, ux-expert)
- Prompt library YAML registry
- Workflow definitions

## Adding New Templates

1. Create template file in this directory
2. Follow existing template structure
3. Add to prompt-library.yaml
4. Update agent prompts to reference new template
