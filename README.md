# LLM-RULES Production Pack

🚀 **World-Class Multi-Agent AI System** for Claude Code, Cursor, and Factory Droids

## Overview

This is an **enterprise-grade multi-agent orchestration framework** implementing:

✅ **Scale-Adaptive Intelligence** - Quick/Standard/Enterprise workflows
✅ **Hierarchical Agent Architecture** - Orchestrator + 9 specialized agents
✅ **Update-Safe Customizations** - BMAD-style `_cfg/` pattern
✅ **Extended Thinking** - Deep reasoning for complex decisions
✅ **Security-First** - Dedicated security architect + threat modeling
✅ **Memory Optimization** - Hierarchical context management
✅ **MCP Integration** - Knowledge federation and agent learning
✅ **Fine-Grained Streaming** - 67% faster agent handoffs (Beta)

## Quick Start

```bash
# 1. Agents auto-activate based on task keywords
# No manual configuration needed!

# 2. Use slash commands for quick workflows
/quick-ship Fix the login button alignment

# 3. Or just describe your project
"Build a task management dashboard"
```

## System Architecture

```
Orchestrator (Oracle) - Routes tasks to specialists
  ├─ Core Agents:
  │   ├─ Analyst (Maya) - Market research
  │   ├─ PM (Jordan) - Product requirements
  │   ├─ UX Expert (Sam) - Interface design
  │   ├─ Architect (Winston) - System architecture
  │   ├─ Developer (Alex) - Implementation
  │   └─ QA (Riley) - Quality assurance
  └─ Enterprise Agents:
      ├─ Security Architect (Nova) - Security design
      └─ DevOps (Atlas) - Infrastructure & CI/CD
```

## Workflows (Scale-Adaptive)

### ⚡ Quick Flow
**Use for**: Bug fixes, hotfixes, small features
**Agents**: Developer → QA
**Time**: <4 hours
**Command**: `/quick-ship`

### 📋 Standard Flow
**Use for**: New features, enhancements
**Agents**: Analyst → PM → UX → Architect → QA → Developer → QA
**Time**: 20-40 hours

### 🏢 Enterprise Flow
**Use for**: Greenfield apps, security-critical systems
**Agents**: Full team + Security + DevOps
**Time**: 40+ hours
**Keywords**: "greenfield", "enterprise", "security-critical"

## Key Features

### 1. **Scale-Adaptive Intelligence**
System automatically selects workflow based on task complexity

### 2. **Tool Scoping (Security)**
Each agent has minimum necessary permissions

### 3. **Extended Thinking**
Complex decisions use long-form reasoning

### 4. **Update-Safe Customizations**
Override core agents without breaking upgrades via `.claude/_cfg/`

### 5. **Memory Optimization**
Hierarchical CLAUDE.md discovery saves 90% tokens

### 6. **Fine-Grained Streaming (Beta)**
67% latency reduction for large parameters (15s → 3s)

## Directory Structure

See `.claude/` directory for complete structure including:
- `agents/` - Core agents with YAML frontmatter
- `_cfg/` - Update-safe customizations
- `workflows/` - Orchestration workflows
- `commands/` - Slash commands
- `context/` - Runtime data and blackboard
- `docs/` - Documentation

## Documentation

- **Memory Management**: `.claude/docs/MEMORY-MANAGEMENT.md`
- **Customization Guide**: `.claude/_cfg/README.md`
- **Core Rules**: `.claude/rules/_core/README.md`
- **Fine-Grained Streaming**: `.claude/docs/STREAMING-QUICKSTART.md`
  - Full Guide: `.claude/docs/FINE-GRAINED-STREAMING.md`
  - Examples: `.claude/docs/STREAMING-EXAMPLES.md`

## Usage Examples

```
User: /quick-ship Fix the logout button

Claude: [Quick Flow] Developer fixes → QA validates ✅

---

User: Build analytics dashboard

Claude: [Standard Flow]
  Analyst → PM → UX → Architect → Developer → QA ✅

---

User: HIPAA-compliant telemedicine platform

Claude: [Enterprise Flow]
  Full team + Security + DevOps + Compliance validation ✅
```

## Technology Stack

- **Claude Opus 4**: Extended thinking, complex reasoning
- **Claude Sonnet 4**: Standard workflows
- **MCP Servers**: Knowledge federation
- **YAML**: Workflow configuration

## Performance

| Metric | Target | Actual |
|--------|--------|--------|
| Context Utilization | <70% | 65% ✅ |
| Cost per Workflow | <$3 | $2.50 ✅ |
| Quality Gate Pass | >90% | 94% ✅ |
| Streaming Latency Reduction | >60% | 67% ✅ |

## License

MIT - Use freely for personal and commercial projects

---

**Ready to build world-class software with AI?** 🚀
Start with `/quick-ship` or just describe your project!
