# BMAD Validation Schemas & Data Models

This document defines the validation schemas and data models used throughout the BMAD-Spec Orchestrator system to ensure consistency and correctness.

## Core Data Models

### WorkflowModel
Defines the structure of BMAD workflow definitions:

```yaml
# Required Fields
id: string                    # Unique workflow identifier
name: string                  # Human-readable workflow name  
description: string           # Workflow description
type: WorkflowType           # greenfield | brownfield
project_types: [ProjectType] # Supported project types
sequence: [SequenceStep]     # Workflow sequence steps

# Optional Fields  
flow_diagram: string         # Mermaid diagram definition
decision_guidance: object    # Decision guidance information
handoff_prompts: object      # Agent handoff prompts
```

### SequenceStep
Defines individual steps within a workflow:

```yaml
# Agent Assignment
agent: string               # Agent responsible for this step

# Actions (at least one required)
creates: string            # Output file/artifact created
updates: string            # File/artifact updated  
validates: string          # Artifact to validate
action: StepAction         # create | update | validate | execute | guide | shard | review

# Dependencies
requires: [string]         # Required input files/artifacts
uses: string              # Checklist or template to use

# Metadata
step: string              # Step identifier
notes: string             # Additional notes/instructions
condition: string         # Condition for execution
repeats: string           # Repetition condition
optional: boolean         # Whether step is optional
optional_steps: [OptionalStep] # Optional sub-steps
```

### AgentModel
Defines agent configurations:

```yaml
# Required Fields
name: string               # Agent name
id: string                 # Agent identifier  
title: string              # Agent title/role
persona: object            # Agent persona definition

# Optional Fields
icon: string               # Agent icon
when_to_use: string        # Usage guidance
customization: string      # Agent customization
commands: object           # Available commands
file_path: string          # Path to agent file
```

### TemplateModel
Defines template structures:

```yaml
# Required Fields
name: string               # Template name
content: string            # Template content

# Optional Fields  
description: string        # Template description
variables: [string]        # Template variables
file_path: string          # Path to template file
```

## Enumerated Types

### WorkflowType
```yaml
GREENFIELD: "greenfield"   # New projects from scratch
BROWNFIELD: "brownfield"   # Modifications to existing projects
```

### ProjectType
```yaml
# Frontend Types
SPA: "spa"                        # Single Page Application
MOBILE_APP: "mobile-app"          # Mobile Application
MICRO_FRONTEND: "micro-frontend"  # Micro-frontend Architecture
STATIC_SITE: "static-site"        # Static Website
UI_PROTOTYPE: "ui-prototype"      # UI Prototype
SIMPLE_INTERFACE: "simple-interface" # Simple Interface

# Backend Types  
API_SERVICE: "api-service"        # API Service
API: "api"                        # API
MICROSERVICE: "microservice"      # Microservice
BACKEND_SERVICE: "backend-service" # Backend Service

# Full-stack Types
FULLSTACK: "fullstack"            # Full-stack Application
```

### StepAction
```yaml
CREATE: "create"           # Create new artifact
UPDATE: "update"           # Update existing artifact
VALIDATE: "validate"       # Validate artifact
EXECUTE: "execute"         # Execute process
GUIDE: "guide"            # Provide guidance
SHARD: "shard"            # Split large artifact
REVIEW: "review"          # Review artifact
```

## Validation Rules

### Workflow Validation
- **ID Uniqueness**: Workflow IDs must be unique across all workflows
- **Sequence Non-Empty**: Every workflow must have at least one sequence step
- **Agent References**: All referenced agents must exist in the system
- **Template References**: All referenced templates must exist in the system
- **Step Dependencies**: Required artifacts must be created by previous steps

### Step Validation
- **Action Required**: Each step must define at least one action (creates, updates, validates, or action field)
- **Agent Assignment**: Steps with creates/updates/validates must have an assigned agent
- **Dependency Order**: Required artifacts must be available before the step executes
- **Conditional Logic**: Conditions must use valid expression syntax

### Template Validation
- **Variable Syntax**: All variables must use {{variable_name}} syntax
- **Required Variables**: Templates must document their required variables
- **Content Structure**: Templates must follow markdown formatting standards

### Agent Validation
- **Persona Definition**: All agents must have a defined persona with role, expertise, and style
- **Command Dependencies**: Agent commands must reference valid tasks/templates/checklists
- **Capability Alignment**: Agent capabilities must align with assigned workflow steps

## Error Handling

### Validation Errors (Block Execution)
- Missing required fields
- Invalid references to non-existent resources
- Circular dependencies in workflow steps
- Invalid enumeration values
- Malformed YAML structure

### Validation Warnings (Allow with Caution)
- Optional fields with empty values
- Unused templates or agents
- Long workflow sequences (>10 steps)
- Missing documentation for complex steps

### Runtime Errors
- Agent execution failures
- Template rendering errors
- File system access issues
- Context serialization problems

## Quality Standards

### Template Quality
- All variables must be documented
- Templates must include usage examples
- Output format must be specified
- Error conditions must be handled

### Workflow Quality  
- Each step must have clear objectives
- Dependencies must be explicitly defined
- Error paths must be considered
- Rollback procedures must be documented

### Agent Quality
- Personas must be consistent and detailed  
- Expertise areas must be clearly defined
- Communication style must be professional
- Output quality must be production-ready

## Usage Guidelines

### For Workflow Authors
1. **Start with Requirements**: Define what the workflow accomplishes
2. **Map Dependencies**: Identify all required inputs and outputs
3. **Assign Agents**: Match step requirements to agent expertise
4. **Validate Early**: Test workflow structure before implementation
5. **Document Decisions**: Include rationale for complex steps

### For Agent Authors
1. **Define Clear Persona**: Establish role, expertise, and communication style
2. **Document Capabilities**: List all tasks the agent can perform
3. **Handle Errors Gracefully**: Provide helpful error messages and recovery options
4. **Maintain Context**: Reference previous outputs appropriately
5. **Follow Templates**: Use provided templates consistently

### For Template Authors
1. **Use Standard Variables**: Follow {{variable_name}} convention
2. **Document Requirements**: List all required and optional variables
3. **Provide Examples**: Include sample outputs
4. **Consider Edge Cases**: Handle empty or invalid variable values
5. **Maintain Formatting**: Ensure output is well-structured

## Implementation Notes

### File System Organization
- Workflows: `.claude/workflows/*.yaml`
- Agents: `.claude/agents/*/prompt.md`
- Templates: `.claude/templates/*.md`
- Tasks: `.claude/tasks/*/*.md`
- Context: `.claude/context/session.json`

### Context Management
- Session state persists between workflow steps
- Previous outputs are available to subsequent agents
- Project knowledge accumulates throughout execution
- Context includes metadata for all generated artifacts

### Error Recovery
- Failed steps can be retried with corrected inputs
- Partial workflow execution is supported
- Context can be restored from previous successful state
- Manual intervention points are clearly documented

---

*This document establishes the validation framework for all BMAD-Spec Orchestrator components. All workflows, agents, and templates must conform to these schemas to ensure system reliability and consistency.*