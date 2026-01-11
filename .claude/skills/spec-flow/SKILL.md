---
name: spec-flow
description: Specification and requirements flow management
allowed-tools: [Bash, Read, Glob, Write]
---

# Spec Flow Skill

## Overview

Specification and requirements management. 90%+ context savings.

## Tools (Progressive Disclosure)

### Specifications

| Tool          | Description                | Confirmation |
| ------------- | -------------------------- | ------------ |
| list-specs    | List all specifications    | No           |
| create-spec   | Create specification       | Yes          |
| update-spec   | Update specification       | Yes          |
| validate-spec | Validate spec completeness | No           |

### Requirements

| Tool                 | Description             |
| -------------------- | ----------------------- |
| extract-requirements | Extract from documents  |
| link-requirements    | Link specs to code      |
| trace-requirements   | Trace to implementation |

### Flow Management

| Tool    | Description              |
| ------- | ------------------------ |
| status  | Get spec workflow status |
| approve | Mark spec as approved    |
| reject  | Mark spec as rejected    |

## Agent Integration

- **analyst** (primary): Requirements analysis
- **pm** (primary): Spec management
- **architect** (secondary): Technical specs
