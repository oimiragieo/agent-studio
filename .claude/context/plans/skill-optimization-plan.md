# Plan: Skill Optimization and Merge

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Clean up duplicate skills, add Memory Protocol to missing skills, and fix incomplete instructions.

**Architecture:** Sequential phases to ensure safe deletion and consistent skill quality.

**Tech Stack:** Shell commands, file operations, pattern matching

---

## Executive Summary

This plan addresses findings from the skill audit:
1. 2 duplicate skills to delete (swarm, codequality)
2. 21 skills missing Memory Protocol (verified subset from audit)
3. 1 skill with incomplete instruction (code-quality-expert line 102)
4. 2 persona skills evaluated for merge (KEEP SEPARATE - both are minimal and serve different purposes)

## Objectives

- Delete confirmed duplicate skills
- Add Memory Protocol to all skills missing it
- Fix incomplete instruction in code-quality-expert
- Maintain skill quality standards

---

## Phase 1: Delete Duplicates
**Dependencies**: None
**Parallel OK**: Yes

### Analysis Summary

| Skill to Delete | Lines | Comprehensive Skill | Lines | Reason |
|-----------------|-------|---------------------|-------|--------|
| `swarm` | 23 | `swarm-coordination` | 192 | swarm is stub (3 bullet points), swarm-coordination has full 5-step process, handoff formats, aggregation patterns |
| `codequality` | 98 | `code-quality-expert` | 131 | codequality has AI behavior guidelines, code-quality-expert has actual clean code patterns (DRY, SRP, naming, testing) |

#### Tasks

- [ ] **1.1** Delete swarm skill directory (~1 min)
  - **Command**: `Remove-Item -Recurse -Force "C:\dev\projects\agent-studio\.claude\skills\swarm"`
  - **Verify**: `if (Test-Path "C:\dev\projects\agent-studio\.claude\skills\swarm") { "EXISTS" } else { "DELETED" }`
  - **Rollback**: `git checkout HEAD -- ".claude/skills/swarm/"`

- [ ] **1.2** Delete codequality skill directory (~1 min) [parallel OK]
  - **Command**: `Remove-Item -Recurse -Force "C:\dev\projects\agent-studio\.claude\skills\codequality"`
  - **Verify**: `if (Test-Path "C:\dev\projects\agent-studio\.claude\skills\codequality") { "EXISTS" } else { "DELETED" }`
  - **Rollback**: `git checkout HEAD -- ".claude/skills/codequality/"`

- [ ] **1.3** Verify comprehensive skills still exist (~1 min)
  - **Command**: `Test-Path "C:\dev\projects\agent-studio\.claude\skills\swarm-coordination\SKILL.md", "C:\dev\projects\agent-studio\.claude\skills\code-quality-expert\SKILL.md"`
  - **Verify**: Both return `True`

#### Phase 1 Error Handling
If any task fails:
1. Run rollback commands for completed tasks (reverse order)
2. Document error: `echo "Phase 1 failed: [error]" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase 2

#### Phase 1 Verification Gate
```powershell
# All must pass before proceeding
$swarmDeleted = -not (Test-Path "C:\dev\projects\agent-studio\.claude\skills\swarm")
$codequalityDeleted = -not (Test-Path "C:\dev\projects\agent-studio\.claude\skills\codequality")
$swarmCoordExists = Test-Path "C:\dev\projects\agent-studio\.claude\skills\swarm-coordination\SKILL.md"
$codeQualityExpertExists = Test-Path "C:\dev\projects\agent-studio\.claude\skills\code-quality-expert\SKILL.md"
Write-Host "Phase 1 Status: swarmDeleted=$swarmDeleted codequalityDeleted=$codequalityDeleted swarmCoordExists=$swarmCoordExists codeQualityExpertExists=$codeQualityExpertExists"
if ($swarmDeleted -and $codequalityDeleted -and $swarmCoordExists -and $codeQualityExpertExists) { "PASS" } else { "FAIL" }
```

---

## Phase 2: Fix Incomplete Instruction
**Dependencies**: Phase 1
**Parallel OK**: No

### Issue Details

File: `.claude/skills/code-quality-expert/SKILL.md`
Line 102-103 shows incomplete content:
```markdown
### code quality standards

When reviewing or writing code, apply


</instructions>
```

The instruction is cut off mid-sentence.

#### Tasks

- [ ] **2.1** Fix incomplete instruction in code-quality-expert (~2 min)
  - **File**: `C:\dev\projects\agent-studio\.claude\skills\code-quality-expert\SKILL.md`
  - **Old string (lines 100-105)**:
    ```
    ### code quality standards

    When reviewing or writing code, apply


    </instructions>
    ```
  - **New string**:
    ```
    ### code quality standards

    When reviewing or writing code, apply the principles above consistently. Focus on:
    - Readability over cleverness
    - Consistency within the codebase
    - Progressive improvement (leave code better than you found it)

    </instructions>
    ```
  - **Verify**: `Select-String -Path "C:\dev\projects\agent-studio\.claude\skills\code-quality-expert\SKILL.md" -Pattern "Readability over cleverness"`
  - **Rollback**: `git checkout HEAD -- ".claude/skills/code-quality-expert/SKILL.md"`

#### Phase 2 Verification Gate
```powershell
$fixed = Select-String -Path "C:\dev\projects\agent-studio\.claude\skills\code-quality-expert\SKILL.md" -Pattern "Readability over cleverness" -Quiet
if ($fixed) { "PASS" } else { "FAIL" }
```

---

## Phase 3: Add Memory Protocol to Missing Skills
**Dependencies**: Phase 2
**Parallel OK**: Yes (batch processing)

### Skills Missing Memory Protocol

Based on verification, these skills need Memory Protocol added:

**Core/Infrastructure Skills (HIGH priority - used by many agents):**
1. aws-cloud-ops
2. code-analyzer
3. code-style-validator
4. commit-validator
5. diagram-generator
6. doc-generator
7. docker-compose
8. gcloud-cli
9. git-expert
10. github-mcp
11. github-ops
12. mcp-converter
13. project-analyzer
14. repo-rag
15. sequential-thinking
16. smart-debug
17. terraform-infra
18. test-generator
19. tool-search

**Incident Response Skills (MEDIUM priority):**
20. incident-runbook-templates
21. on-call-handoff-patterns
22. postmortem-writing
23. sentry-monitoring
24. slack-notifications

**PM Skills (MEDIUM priority):**
25. jira-pm
26. linear-pm

### Memory Protocol Text to Append

```markdown

## Memory Protocol (MANDATORY)

**Before starting:**
```bash
cat .claude/context/memory/learnings.md
```

**After completing:**
- New pattern -> `.claude/context/memory/learnings.md`
- Issue found -> `.claude/context/memory/issues.md`
- Decision made -> `.claude/context/memory/decisions.md`

> ASSUME INTERRUPTION: Your context may reset. If it's not in memory, it didn't happen.
```

#### Tasks

- [ ] **3.1** Add Memory Protocol to infrastructure skills (batch 1) (~5 min)
  - **Skills**: aws-cloud-ops, code-analyzer, code-style-validator, commit-validator, diagram-generator
  - **Command**: For each skill, append Memory Protocol section to SKILL.md
  - **Verify**: `Select-String -Path "C:\dev\projects\agent-studio\.claude\skills\aws-cloud-ops\SKILL.md" -Pattern "Memory Protocol"`

- [ ] **3.2** Add Memory Protocol to infrastructure skills (batch 2) (~5 min) [parallel OK]
  - **Skills**: doc-generator, docker-compose, gcloud-cli, git-expert, github-mcp
  - **Command**: For each skill, append Memory Protocol section to SKILL.md
  - **Verify**: `Select-String -Path "C:\dev\projects\agent-studio\.claude\skills\git-expert\SKILL.md" -Pattern "Memory Protocol"`

- [ ] **3.3** Add Memory Protocol to infrastructure skills (batch 3) (~5 min) [parallel OK]
  - **Skills**: github-ops, mcp-converter, project-analyzer, repo-rag, sequential-thinking
  - **Command**: For each skill, append Memory Protocol section to SKILL.md
  - **Verify**: `Select-String -Path "C:\dev\projects\agent-studio\.claude\skills\sequential-thinking\SKILL.md" -Pattern "Memory Protocol"`

- [ ] **3.4** Add Memory Protocol to infrastructure skills (batch 4) (~5 min) [parallel OK]
  - **Skills**: smart-debug, terraform-infra, test-generator, tool-search
  - **Command**: For each skill, append Memory Protocol section to SKILL.md
  - **Verify**: `Select-String -Path "C:\dev\projects\agent-studio\.claude\skills\test-generator\SKILL.md" -Pattern "Memory Protocol"`

- [ ] **3.5** Add Memory Protocol to incident response skills (~3 min)
  - **Skills**: incident-runbook-templates, on-call-handoff-patterns, postmortem-writing, sentry-monitoring, slack-notifications
  - **Command**: For each skill, append Memory Protocol section to SKILL.md
  - **Verify**: `Select-String -Path "C:\dev\projects\agent-studio\.claude\skills\postmortem-writing\SKILL.md" -Pattern "Memory Protocol"`

- [ ] **3.6** Add Memory Protocol to PM skills (~2 min)
  - **Skills**: jira-pm, linear-pm
  - **Command**: For each skill, append Memory Protocol section to SKILL.md
  - **Verify**: `Select-String -Path "C:\dev\projects\agent-studio\.claude\skills\jira-pm\SKILL.md" -Pattern "Memory Protocol"`

#### Phase 3 Error Handling
If any batch fails:
1. Document which skills failed in issues.md
2. Continue with remaining batches (partial success acceptable)
3. Track failed skills for retry

#### Phase 3 Verification Gate
```powershell
# Verify at least 80% of skills have Memory Protocol
$skills = @(
    "aws-cloud-ops", "code-analyzer", "git-expert", "github-ops",
    "sequential-thinking", "test-generator", "jira-pm", "linear-pm"
)
$passed = 0
foreach ($skill in $skills) {
    $path = "C:\dev\projects\agent-studio\.claude\skills\$skill\SKILL.md"
    if (Test-Path $path) {
        $hasMP = Select-String -Path $path -Pattern "Memory Protocol" -Quiet
        if ($hasMP) { $passed++ }
    }
}
$rate = [math]::Round(($passed / $skills.Count) * 100)
Write-Host "Memory Protocol coverage: $passed/$($skills.Count) = $rate%"
if ($rate -ge 80) { "PASS" } else { "FAIL - Only $rate% coverage" }
```

---

## Phase 4: Commit Changes
**Dependencies**: Phase 3
**Parallel OK**: No

#### Tasks

- [ ] **4.1** Stage all changes (~1 min)
  - **Command**: `git add -A`
  - **Verify**: `git status --porcelain | Select-String -Pattern "\.claude/skills"`

- [ ] **4.2** Commit with descriptive message (~1 min)
  - **Command**: `git commit -m "refactor(skills): delete duplicates, fix incomplete instruction, add Memory Protocol" -m "- Delete swarm (duplicate of swarm-coordination)" -m "- Delete codequality (duplicate of code-quality-expert)" -m "- Fix incomplete instruction in code-quality-expert line 102" -m "- Add Memory Protocol to 26 skills missing it"`
  - **Verify**: `git log -1 --oneline | Select-String "refactor\(skills\)"`

#### Phase 4 Verification Gate
```powershell
$committed = git log -1 --oneline | Select-String "refactor\(skills\)" -Quiet
if ($committed) { "PASS" } else { "FAIL" }
```

---

## Decision: Persona Skills - KEEP SEPARATE

### Analysis

**full-stack-developer-persona** (56 lines):
- Description: "full-stack developer with expertise in React, TypeScript, PHP, Symfony, and Docker"
- Specific tech stack focus

**persona-senior-full-stack-developer** (56 lines):
- Description: "senior full-stack developer... rare 10x developers that has incredible knowledge"
- General seniority/expertise focus

### Recommendation

**KEEP BOTH SEPARATE** because:
1. Both are minimal stubs (56 lines each) - no consolidation benefit
2. Different purposes: one is tech-stack specific, one is seniority mindset
3. Both already have Memory Protocol
4. Neither is comprehensive enough to warrant merging effort
5. If consolidation desired, recommend creating new `full-stack-developer-expert` skill instead

---

## Risks
| Risk | Impact | Mitigation | Rollback |
|------|--------|------------|----------|
| Delete wrong skill | High | Verify comprehensive versions exist before delete | `git checkout HEAD -- ".claude/skills/[skill]/"` |
| Memory Protocol append breaks skill | Medium | Validate YAML frontmatter after append | `git checkout HEAD -- ".claude/skills/[skill]/SKILL.md"` |
| Incomplete fix makes skill worse | Low | Test skill parsing after edit | `git checkout HEAD -- ".claude/skills/code-quality-expert/SKILL.md"` |

## Timeline Summary
| Phase | Tasks | Est. Time | Parallel? |
|-------|-------|-----------|-----------|
| 1 | 3 | 3 min | Yes |
| 2 | 1 | 2 min | No |
| 3 | 6 | 20 min | Yes |
| 4 | 2 | 2 min | No |
| **Total** | **12** | **~27 min** | |

---

## Review Required

- [ ] **Architect Review**: Optional - Simple file operations, no architectural concerns
- [ ] **Security Review**: Not Required - No security-sensitive changes

### Review Focus Areas
- Architect: Verify skill consolidation decisions are correct
- Security: N/A
