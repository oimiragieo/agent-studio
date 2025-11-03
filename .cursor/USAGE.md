# Complete Usage Guide

## How It Works

### Auto-Discovery Process

When you copy `.cursor/` to your project root and restart Cursor:

1. **Cursor scans** `.cursor/subagents/*.mdc` → Loads all 10 agents
2. **Cursor scans** `.cursor/rules/` → Loads rules based on file patterns
3. **Cursor scans** `.cursor/hooks/*.json` → Registers lifecycle hooks
4. **Cursor scans** `.cursorrules` (root) → Loads universal rules

**All automatic - no configuration files needed!**

### Plan Mode Integration

Plan Mode is integrated throughout:

#### 1. Auto-Trigger Hook
`hooks/preflight-plan.json` automatically triggers Plan Mode when:
- You're about to modify ≥2 files
- Large refactoring detected
- Multi-file feature addition

#### 2. Agent Instructions
All agents are instructed to:
- Use Plan Mode before multi-file changes
- Reference plans in their work
- Update plans as work progresses
- Store plans for handoffs

#### 3. Instructions Directory
`instructions/plan-mode.md` provides comprehensive guidance on:
- When to use Plan Mode
- How to create effective plans
- Integrating plans with agents
- Best practices

## Usage Workflows

### Workflow 1: New Feature Development

```
1. Press Shift+Tab → Plan Mode activates
2. Describe: "Add user authentication with JWT"
3. Cursor researches repo, asks questions
4. Plan generated: files, diffs, tests
5. Review and approve plan
6. Select Developer agent
7. Developer uses plan as context
8. Implementation follows plan step-by-step
9. Plan updates as work progresses
10. QA reviews against plan
```

### Workflow 2: Architecture Changes

```
1. Select Architect agent
2. Press Shift+Tab → Plan Mode
3. Describe architecture change
4. Architect creates plan with:
   - System diagrams
   - Technology choices
   - Migration steps
5. Plan saved to .cursor/plans/
6. Developer uses plan for implementation
7. QA validates against architecture plan
```

### Workflow 3: Multi-Agent Coordination

```
1. Analyst creates project brief (artifact)
2. PM uses brief → Creates PRD (plan created)
3. Architect uses PRD → Creates architecture (plan updated)
4. Developer uses architecture plan → Implements
5. QA uses implementation plan → Creates tests
6. All plans linked and traceable
```

## Key Features

### Plan Mode is Everywhere

✅ **Auto-triggers** for multi-file changes  
✅ **Referenced** in all agent prompts  
✅ **Documented** in instructions/plan-mode.md  
✅ **Integrated** in hooks/preflight-plan.json  
✅ **Emphasized** in this README  

### Agent Capabilities

- **Analyst** 📊: Market research, requirements, competitive analysis
- **PM** 📋: PRDs, user stories, roadmaps, prioritization
- **Architect** 🏗️: System design, tech selection, architecture docs
- **Developer** 💻: Code implementation, debugging, refactoring
- **QA** 🧪: Test plans, quality gates, risk assessment
- **UX Expert** 🎨: UI/UX specs, accessibility, design systems

All agents optimized for Plan Mode workflows!

## Verification Checklist

After copying `.cursor/` to your project:

- [ ] `.cursor/` folder exists in project root
- [ ] `subagents/` contains 10 `.mdc` files
- [ ] `hooks/preflight-plan.json` exists
- [ ] Restarted Cursor completely
- [ ] Agents appear in Cursor UI
- [ ] Plan Mode works (`Shift+Tab`)
- [ ] Rules loading in Settings → Rules

## Troubleshooting

See `QUICK_START.md` for detailed troubleshooting guide.

## Next Steps

1. ✅ Copy `.cursor/` to your project
2. ✅ Read `QUICK_START.md`
3. ✅ Test Plan Mode (`Shift+Tab`)
4. ✅ Review `instructions/plan-mode.md`
5. ✅ Start using agents with Plan Mode!

**Remember: Plan Mode + Agents = Smart Development** 🚀

