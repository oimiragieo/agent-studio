# System Architecture Diagram

> Generated: 2026-01-27
> Purpose: Visualizes the overall framework architecture and component relationships

## Overview

This diagram shows the high-level system architecture of the Claude Code Enterprise Framework, illustrating how the Router orchestrates Agents, Skills, Workflows, and Hooks.

## System Architecture

```mermaid
flowchart TB
    subgraph User["User Layer"]
        UP[User Prompt]
    end

    subgraph Router["Router Layer"]
        R[Router]
        RC{Complexity<br/>Check}
        RA{Agent<br/>Selection}
    end

    subgraph Hooks["Hook System"]
        direction TB
        UPH[UserPromptSubmit<br/>Hooks]
        PRE[PreToolUse<br/>Hooks]
        POST[PostToolUse<br/>Hooks]
        SES[SessionEnd<br/>Hooks]
    end

    subgraph Agents["Agent Layer"]
        direction TB
        CA[Core Agents]
        DA[Domain Agents]
        SA[Specialized Agents]
        OA[Orchestrators]
    end

    subgraph Skills["Skill Layer"]
        direction TB
        CS[Core Skills]
        CRS[Creator Skills]
        WS[Workflow Skills]
    end

    subgraph Workflows["Workflow Layer"]
        direction TB
        CW[Core Workflows]
        EW[Enterprise Workflows]
        OW[Operations Workflows]
    end

    subgraph State["State & Memory"]
        direction TB
        RS[Router State]
        ES[Evolution State]
        MEM[Memory Files]
        TL[Task List]
    end

    subgraph Tools["Claude Tools"]
        direction TB
        TT[Task Tool]
        RW[Read/Write/Edit]
        BG[Bash/Glob/Grep]
        SK[Skill Tool]
    end

    %% Flow
    UP --> UPH
    UPH --> R
    R --> RC
    RC -->|Low| RA
    RC -->|High/Epic| OA
    RA --> CA
    RA --> DA
    RA --> SA

    %% Agent to Tools
    CA --> PRE
    DA --> PRE
    SA --> PRE
    OA --> PRE
    PRE --> RW
    PRE --> BG
    PRE --> TT
    RW --> POST
    BG --> POST
    TT --> POST

    %% Skill Invocation
    CA --> SK
    DA --> SK
    SA --> SK
    SK --> Skills

    %% Skills to Workflows
    Skills --> Workflows

    %% State Management
    R --> RS
    CA --> TL
    DA --> TL
    SA --> TL
    OA --> ES

    %% Memory
    POST --> MEM
    SES --> MEM

    %% Styling
    classDef userLayer fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef routerLayer fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef hookLayer fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    classDef agentLayer fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef skillLayer fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef workflowLayer fill:#e8eaf6,stroke:#1a237e,stroke-width:2px
    classDef stateLayer fill:#fff8e1,stroke:#ff6f00,stroke-width:2px
    classDef toolLayer fill:#eceff1,stroke:#37474f,stroke-width:2px

    class UP userLayer
    class R,RC,RA routerLayer
    class UPH,PRE,POST,SES hookLayer
    class CA,DA,SA,OA agentLayer
    class CS,CRS,WS skillLayer
    class CW,EW,OW workflowLayer
    class RS,ES,MEM,TL stateLayer
    class TT,RW,BG,SK toolLayer
```

## Component Descriptions

| Component | Purpose | Location |
|-----------|---------|----------|
| **Router** | Classifies requests, selects agents | `.claude/agents/core/router.md` |
| **Core Agents** | Developer, Planner, Architect, QA, PM, Technical-Writer | `.claude/agents/core/` |
| **Domain Agents** | Language/framework specialists | `.claude/agents/domain/` |
| **Specialized Agents** | Task-specific experts | `.claude/agents/specialized/` |
| **Orchestrators** | Multi-agent coordinators | `.claude/agents/orchestrators/` |
| **Hooks** | Pre/Post tool validation | `.claude/hooks/` |
| **Skills** | Reusable capabilities | `.claude/skills/` |
| **Workflows** | Multi-phase processes | `.claude/workflows/` |
| **State Files** | Runtime state persistence | `.claude/context/` |

## Data Flow

1. **User Prompt** -> UserPromptSubmit hooks classify complexity
2. **Router** analyzes intent and selects appropriate agent(s)
3. **Agents** execute using Tools (with PreToolUse/PostToolUse hooks)
4. **Skills** are invoked via the Skill() tool for specialized capabilities
5. **Workflows** orchestrate multi-phase, multi-agent processes
6. **Memory** persists learnings, decisions, and issues across sessions

## Key Integrations

- **Task Tool**: Spawns subagents with isolated context
- **Router State**: Tracks mode (router/agent), complexity, spawn status
- **Evolution State**: Tracks self-evolution progress through EVOLVE phases
- **Memory Files**: `learnings.md`, `decisions.md`, `issues.md`
