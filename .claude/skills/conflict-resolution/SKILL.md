---
name: conflict-resolution
description: Multi-agent conflict resolution protocol for detecting and resolving conflicts when multiple agents produce conflicting outputs or requirements. Handles technical, requirements, design, and data conflicts.
version: 1.0.0
allowed-tools: read, grep, search
---

# Conflict Resolution Skill

Multi-agent conflict resolution protocol for detecting and resolving conflicts when multiple agents produce conflicting outputs or requirements.

## When to Use

**Trigger Conditions**:

- Multiple agents provide conflicting recommendations on the same component
- Requirements from different agents are incompatible (e.g., PM wants feature X, Security says block it)
- Technical decisions conflict between agents (e.g., Architect chooses REST, Developer implements GraphQL)
- Design choices conflict between agents (e.g., UX wants modal, Architect wants separate page)
- Data requirements conflict between agents (e.g., PM wants user emails, DBA says normalize to user_id FK)
- Workflow execution blocked due to contradictory agent outputs

**When NOT to Use**:

- Agents provide different but compatible approaches (that's healthy diversity)
- Minor style preferences (use code-style-validator instead)
- Performance trade-offs without clear winner (use performance-engineer for analysis)

**Real-World Triggers**:

1. Planner detects contradictory requirements in workflow step outputs
2. Developer receives conflicting specifications from Architect and UX Expert
3. Two agents update the same artifact with incompatible changes
4. Validation gate fails due to conflicting schema requirements
5. Orchestrator receives conflicting routing decisions from multiple agents

## Instructions

### Step 1: Conflict Detection

1. **Compare agent outputs**:
   - Identify which agents provided input
   - Extract key decisions from each agent
   - Compare outputs for contradictions

2. **Detect conflict types**:
   - **Technical Conflicts**: Architect vs Developer on implementation approach
   - **Requirements Conflicts**: PM vs Analyst on feature priorities
   - **Design Conflicts**: UX Expert vs Architect on interface design
   - **Data Conflicts**: Database Architect vs Analyst on data requirements

3. **Assess conflict severity**:
   - **Critical**: Blocks workflow execution, requires immediate resolution
   - **High**: Significant impact, should be resolved before proceeding
   - **Medium**: Moderate impact, can be resolved during execution
   - **Low**: Minor inconsistency, can be noted and resolved later

### Step 2: Conflict Resolution Process

1. **Set timeout**:
   - Use `config.workflow_thresholds.conflict_resolution_timeout_seconds` (default: 30 seconds)
   - Start timer for resolution attempts

2. **Document conflict**:
   - Record conflict details in reasoning file
   - Document which agents are in conflict
   - Record conflict type and severity
   - Log impact on workflow

3. **Escalate to appropriate resolution agent** (within timeout):
   - **Technical Conflicts**: Escalate to Architect (has final authority on technical decisions)
   - **Requirements Conflicts**: Escalate to PM (has final authority on product decisions)
   - **Design Conflicts**: Escalate to UX Expert (has final authority on design decisions)
   - **Data Conflicts**: Escalate to Database Architect (has final authority on data decisions)
   - **Multi-Domain Conflicts**: Escalate to AI Council for consensus building

4. **Timeout handling**:
   - If timeout exceeded: Log timeout in reasoning file
   - Escalate to AI Council for final resolution
   - Document timeout and escalation in plan

5. **Document resolution**:
   - Record resolution decision in reasoning file
   - Update plan to reflect resolution
   - Communicate resolution to affected agents

### Step 3: Resolution Methods

1. **Authority-based resolution**:
   - Escalate to agent with final authority for conflict type
   - Accept authoritative decision
   - Update plan accordingly

2. **Consensus building**:
   - Facilitate discussion between conflicting agents
   - Find common ground
   - Build consensus solution

3. **AI Council resolution**:
   - Escalate complex multi-domain conflicts
   - Use extended thinking for analysis
   - Generate comprehensive resolution

## Conflict Resolution Matrix

| Conflict Type | Resolution Agent   | Timeout | Escalation   |
| ------------- | ------------------ | ------- | ------------ |
| Technical     | Architect          | 30s     | AI Council   |
| Requirements  | PM                 | 30s     | AI Council   |
| Design        | UX Expert          | 30s     | AI Council   |
| Data          | Database Architect | 30s     | AI Council   |
| Multi-Domain  | AI Council         | 60s     | Human Review |

## Usage Patterns

### Detect and Resolve Conflicts

**When to Use**:

- Workflow step outputs contradict each other
- Multiple agents provide incompatible recommendations
- Agent outputs fail validation due to conflicts

**How to Invoke**:

```
"Detect conflicts between architect and developer outputs"
"Resolve conflict in authentication implementation"
"Check for conflicts in workflow artifacts"
```

**What It Does**:

- Loads agent outputs from workflow artifacts
- Compares outputs for contradictions
- Detects conflict type and severity
- Escalates to appropriate resolution agent
- Documents resolution in reasoning file

## Examples

### Example 1: Technical Conflict (Architect vs Developer)

**Scenario**: Architect specifies REST API, Developer implements GraphQL

**Conflict Detection**:

```json
{
  "conflict_type": "technical",
  "severity": "high",
  "agents_in_conflict": ["architect", "developer"],
  "conflict_details": {
    "architect_output": {
      "artifact": "architecture-workflow-123.json",
      "decision": "Use REST API with JSON responses",
      "rationale": "Team familiarity, industry standard, simple caching"
    },
    "developer_output": {
      "artifact": "dev-manifest-workflow-123.json",
      "implementation": "GraphQL API with Apollo Server",
      "rationale": "Better developer experience, type safety, efficient queries"
    },
    "impact": "Workflow blocked - cannot proceed without resolution"
  }
}
```

**Resolution Process**:

1. **Timeout Start**: 30 seconds for resolution
2. **Escalation**: Escalate to Architect (has final authority on technical decisions)
3. **Architect Decision**: "Use REST for v1, evaluate GraphQL for v2 after metrics"
4. **Resolution Documented**:
   ```json
   {
     "resolution": "Use REST API as specified in architecture",
     "resolution_agent": "architect",
     "resolution_time": "15s",
     "updated_plan": {
       "developer_task": "Implement REST API with Express.js",
       "future_consideration": "Evaluate GraphQL for v2 based on v1 metrics"
     }
   }
   ```

**Before State**:

- Architect: REST API specified
- Developer: GraphQL implemented
- Status: Conflicting implementations

**After State**:

- Architect: REST API confirmed (authority decision)
- Developer: REST API implementation started
- Status: Conflict resolved, workflow proceeding

### Example 2: Requirements Conflict (PM vs Security)

**Scenario**: PM wants public user profiles, Security Architect flags privacy risk

**Conflict Detection**:

```json
{
  "conflict_type": "requirements",
  "severity": "critical",
  "agents_in_conflict": ["pm", "security-architect"],
  "conflict_details": {
    "pm_output": {
      "artifact": "prd-workflow-456.json",
      "requirement": "Public user profiles with full name, email, location visible to all users",
      "business_value": "Networking feature, user discovery, community building"
    },
    "security_output": {
      "artifact": "security-review-workflow-456.json",
      "violation": "PII exposure risk - email addresses publicly visible",
      "severity": "critical",
      "recommendation": "Block feature or implement privacy controls"
    },
    "impact": "Feature cannot ship without addressing security concerns"
  }
}
```

**Resolution Process**:

1. **Timeout Start**: 30 seconds for resolution
2. **Escalation**: Escalate to PM (has final authority on requirements)
3. **PM Decision**: "Implement privacy controls - make email optional, add visibility toggles"
4. **Resolution Documented**:
   ```json
   {
     "resolution": "Add privacy controls to meet both requirements",
     "resolution_agent": "pm",
     "resolution_time": "22s",
     "updated_requirements": {
       "public_profile_fields": ["username", "bio", "profile_image"],
       "optional_fields": ["full_name", "location"],
       "private_by_default": ["email"],
       "user_controls": ["visibility_toggle_per_field", "profile_privacy_level"]
     }
   }
   ```

**Before State**:

- PM: Public profiles with all fields visible
- Security: Block feature due to PII exposure
- Status: Critical conflict blocking feature

**After State**:

- PM: Updated requirements with privacy controls
- Security: Approved with privacy controls
- Status: Conflict resolved, feature can proceed

### Example 3: Design Conflict (UX vs Architect)

**Scenario**: UX wants modal for file upload, Architect wants dedicated page for scalability

**Conflict Detection**:

```json
{
  "conflict_type": "design",
  "severity": "medium",
  "agents_in_conflict": ["ux-expert", "architect"],
  "conflict_details": {
    "ux_output": {
      "artifact": "ui-spec-workflow-789.json",
      "design": "Modal dialog for file upload - keeps user in context",
      "user_flow": "Click upload → modal opens → select file → upload → modal closes"
    },
    "architect_output": {
      "artifact": "architecture-workflow-789.json",
      "concern": "Modal limits functionality - need dedicated page for batch uploads, progress tracking, file management",
      "recommendation": "Use dedicated upload page with full functionality"
    },
    "impact": "Cannot finalize UI spec without resolving approach"
  }
}
```

**Resolution Process**:

1. **Timeout Start**: 30 seconds for resolution
2. **Escalation**: Escalate to UX Expert (has final authority on design)
3. **UX Decision**: "Use modal for single file, dedicated page for batch - best of both"
4. **Resolution Documented**:
   ```json
   {
     "resolution": "Hybrid approach - modal for simple upload, page for advanced",
     "resolution_agent": "ux-expert",
     "resolution_time": "18s",
     "updated_design": {
       "simple_upload": {
         "component": "UploadModal",
         "trigger": "Quick upload button",
         "use_case": "Single file upload in-context"
       },
       "advanced_upload": {
         "component": "UploadPage",
         "trigger": "Upload center link",
         "use_case": "Batch uploads, file management, progress tracking"
       }
     }
   }
   ```

**Before State**:

- UX: Modal for all uploads
- Architect: Dedicated page for all uploads
- Status: Design conflict blocking implementation

**After State**:

- UX: Hybrid approach approved
- Architect: Scalability concerns addressed
- Status: Conflict resolved, implementation can proceed

### Example 4: Multi-Domain Conflict (Timeout → AI Council)

**Scenario**: Complex conflict involving Architect, Security, and Performance Engineer

**Conflict Detection**:

```json
{
  "conflict_type": "multi-domain",
  "severity": "high",
  "agents_in_conflict": ["architect", "security-architect", "performance-engineer"],
  "conflict_details": {
    "architect": "Use microservices for scalability",
    "security": "Monolith easier to secure, fewer network boundaries",
    "performance": "Microservices add latency, monolith faster for current scale"
  },
  "timeout_exceeded": true,
  "escalation": "AI Council"
}
```

**AI Council Resolution**:

```json
{
  "resolution": "Start with modular monolith, extract services as needed",
  "consensus_approach": "Incremental migration based on metrics",
  "phase_1": {
    "architecture": "Modular monolith with clear service boundaries",
    "security": "Simplified security perimeter, easier to audit",
    "performance": "Optimal for current scale"
  },
  "phase_2_triggers": {
    "extract_to_microservice_if": [
      "Service load > 10k req/sec",
      "Team size > 8 developers",
      "Independent scaling needed"
    ]
  },
  "all_agents_approve": true
}
```

## Invocation Commands

**Natural Language**:

```
"Detect conflicts in workflow artifacts"
"Resolve conflict between architect and developer"
"Check for requirements conflicts in PRD"
"Escalate authentication design conflict to architect"
```

**Skill Tool**:

```
Skill: conflict-resolution
Parameters: {
  "workflow_id": "workflow-123",
  "artifacts": ["architecture.json", "dev-manifest.json"],
  "conflict_type": "technical"
}
```

**Via Orchestrator**:

```
When orchestrator detects conflicting outputs:
1. Pause workflow execution
2. Invoke conflict-resolution skill
3. Wait for resolution
4. Update workflow plan with resolution
5. Resume workflow execution
```

## Related Skills

- **evaluator**: Evaluates agent performance to prevent conflicts
- **plan-generator**: Creates conflict-free plans
- **rule-auditor**: Validates compliance to prevent conflicts

## Related Documentation

- [Planner Agent](../../agents/planner.md) - Specialist Coordination with Timeout
- [Orchestrator Agent](../../agents/orchestrator.md) - Conflict Detection and Resolution Protocol
- [CUJ-047](../../docs/cujs/CUJ-047.md) - Multi-Agent Conflict Resolution
