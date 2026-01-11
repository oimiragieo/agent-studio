# Terraform Infrastructure Skill Implementation Task

## Objective

Create a new Claude Code Skill called "terraform-infra" based on Terraform MCP servers.

## Requirements

### 1. File Structure

Create `.claude/skills/terraform-infra/SKILL.md` following the skill template pattern from existing skills.

### 2. Core Operations

Implement progressive disclosure for these Terraform operations:

**Planning & Preview**:

- `plan`: Generate and display terraform plan
- `validate`: Validate configuration files
- `format`: Format terraform files

**State Management**:

- `show`: Display current state
- `list`: List resources in state
- `move`: Move resources in state

**Workspace Management**:

- `workspace-list`: List workspaces
- `workspace-select`: Select workspace
- `workspace-create`: Create workspace

**Execution**:

- `apply`: Apply terraform changes (REQUIRES CONFIRMATION)

### 3. Safety Requirements

**CRITICAL SAFETY RULES**:

- `terraform apply` MUST require explicit confirmation
- `terraform destroy` operations MUST be BLOCKED by default
- State modifications (move, rm) MUST require confirmation
- Include safety warnings in documentation

### 4. Implementation Pattern

Follow these patterns from existing skills:

**From cloud-run skill**:

- Tool categorization (Deployment, Management, etc.)
- Environment variable configuration
- Quick reference section
- Troubleshooting guide

**From dependency-analyzer skill**:

- Progressive disclosure structure
- Step-by-step execution process
- Integration with agents section
- Best practices section

### 5. Agent Mapping

Document integration with:

- **devops** (primary) - Infrastructure management
- **architect** (secondary) - Infrastructure design
- **cloud-integrator** (secondary) - Cloud resource provisioning

### 6. Context Savings Target

Achieve 90%+ context savings vs raw MCP server by:

- Using progressive disclosure
- Loading only relevant operations on-demand
- Minimal metadata in skill header

### 7. Documentation Requirements

Include:

- Overview with context savings comparison
- Requirements section (Terraform CLI version, cloud credentials)
- Tools table with descriptions
- Quick reference with examples
- Configuration section (environment variables, working directory)
- Safety and confirmation requirements
- Integration with agents
- Troubleshooting guide

## Source Reference

- HashiCorp terraform-mcp-server
- Community Terraform MCPs

## Deliverables

1. `.claude/skills/terraform-infra/SKILL.md` - Main skill documentation
2. Follow existing skill structure and formatting
3. Include all safety warnings and confirmation requirements
4. Document agent integration points

## Safety Notes

- Terraform operations can modify infrastructure
- Always require confirmation for destructive operations
- Block `terraform destroy` by default
- Warn about state modifications
