# Claude 4.5 Best Practices Review

Comprehensive review of LLM-RULES configuration against Claude 4.5 prompting best practices.

## Executive Summary

**Status**: ✅ **Good Foundation** - Core patterns implemented, but significant opportunities for optimization

**Key Findings**:
- ✅ Extended thinking properly configured for complex agents
- ✅ Explicit instructions in agent definitions
- ⚠️ Missing context awareness and multi-window workflow guidance
- ⚠️ Missing proactive action defaults
- ⚠️ Missing parallel tool calling optimization
- ⚠️ Missing overeagerness prevention
- ⚠️ Missing frontend design aesthetics guidance
- ⚠️ Missing code exploration and hallucination prevention

## Detailed Analysis

### ✅ Implemented Best Practices

#### 1. Extended Thinking Configuration
**Status**: ✅ **Well Implemented**

**Current Implementation**:
- Extended thinking enabled for high-complexity agents (architect, qa, orchestrator, security-architect, database-architect, etc.)
- Clear guidance on when to use extended thinking in agent files
- Structured reasoning JSON format for auditable decisions

**Best Practice Alignment**: ✅ Matches Claude 4.5 guidance on leveraging thinking capabilities

**Recommendation**: ✅ No changes needed

#### 2. Explicit Instructions
**Status**: ✅ **Good**

**Current Implementation**:
- Agent files contain explicit role definitions and capabilities
- Clear execution processes defined
- Structured output requirements

**Best Practice Alignment**: ✅ Follows "be explicit with your instructions" guidance

**Recommendation**: ✅ Continue current approach

#### 3. Context Management
**Status**: ✅ **Excellent**

**Current Implementation**:
- Lazy loading strategy implemented
- Master rules outside `.claude/rules/` to prevent auto-loading
- Archive strategy for niche rules
- Context optimization documentation

**Best Practice Alignment**: ✅ Aligns with context awareness guidance

**Recommendation**: ✅ Add context awareness prompt (see recommendations)

### ⚠️ Missing or Incomplete Best Practices

#### 1. Context Awareness and Multi-Window Workflows
**Status**: ⚠️ **Missing**

**Best Practice**: Claude 4.5 models feature context awareness and should be informed about context compaction.

**Recommendation**: Add to `.claude/CLAUDE.md`:

```markdown
## Context Window Management

Your context window will be automatically compacted as it approaches its limit, allowing you to continue working indefinitely from where you left off. Therefore, do not stop tasks early due to token budget concerns. As you approach your token budget limit, save your current progress and state to memory before the context window refreshes. Always be as persistent and autonomous as possible and complete tasks fully, even if the end of your budget is approaching. Never artificially stop any task early regardless of the context remaining.

For tasks spanning multiple context windows:
1. Use the first context window to set up a framework (write tests, create setup scripts)
2. Use future context windows to iterate on a todo-list
3. Write tests in a structured format (e.g., `tests.json`) before starting work
4. Create setup scripts (e.g., `init.sh`) to gracefully start servers, run test suites, and linters
5. When a context window is cleared, start fresh by calling `pwd`, reviewing `progress.txt`, `tests.json`, and git logs
6. Manually run through a fundamental integration test before moving on to implementing new features
```

**Priority**: 🔴 **High** - Critical for long-horizon tasks

#### 2. Proactive Action Defaults
**Status**: ⚠️ **Missing**

**Best Practice**: Claude 4.5 models benefit from explicit guidance on whether to implement vs. suggest.

**Recommendation**: Add to `.claude/CLAUDE.md`:

```markdown
## Default Action Behavior

<default_to_action>
By default, implement changes rather than only suggesting them. If the user's intent is unclear, infer the most useful likely action and proceed, using tools to discover any missing details instead of guessing. Try to infer the user's intent about whether a tool call (e.g., file edit or read) is intended or not, and act accordingly.
</default_to_action>
```

**Alternative for Conservative Agents**: For read-only agents (analyst, pm, ux-expert, technical-writer), add:

```markdown
<do_not_act_before_instructions>
Do not jump into implementation or change files unless clearly instructed to make changes. When the user's intent is ambiguous, default to providing information, doing research, and providing recommendations rather than taking action. Only proceed with edits, modifications, or implementations when the user explicitly requests them.
</do_not_act_before_instructions>
```

**Priority**: 🟡 **Medium** - Improves user experience

#### 3. Parallel Tool Calling Optimization
**Status**: ⚠️ **Missing**

**Best Practice**: Claude 4.5 models excel at parallel tool execution and should be explicitly encouraged.

**Recommendation**: Add to `.claude/CLAUDE.md`:

```markdown
## Parallel Tool Execution

<use_parallel_tool_calls>
If you intend to call multiple tools and there are no dependencies between the tool calls, make all of the independent tool calls in parallel. Prioritize calling tools simultaneously whenever the actions can be done in parallel rather than sequentially. For example, when reading 3 files, run 3 tool calls in parallel to read all 3 files into context at the same time. Maximize use of parallel tool calls where possible to increase speed and efficiency. However, if some tool calls depend on previous calls to inform dependent values like the parameters, do NOT call these tools in parallel and instead call them sequentially. Never use placeholders or guess missing parameters in tool calls.
</use_parallel_tool_calls>
```

**Priority**: 🟡 **Medium** - Performance optimization

#### 4. Overeagerness and File Creation Prevention
**Status**: ⚠️ **Partially Addressed**

**Current Implementation**: Developer agent has some guidance on not inventing features.

**Best Practice**: Claude Opus 4.5 has a tendency to overengineer by creating extra files.

**Recommendation**: Add to `.claude/agents/developer.md`:

```markdown
## Overeagerness Prevention

Avoid over-engineering. Only make changes that are directly requested or clearly necessary. Keep solutions simple and focused.

Don't add features, refactor code, or make "improvements" beyond what was asked. A bug fix doesn't need surrounding code cleaned up. A simple feature doesn't need extra configurability.

Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries (user input, external APIs). Don't use backwards-compatibility shims when you can just change the code.

Don't create helpers, utilities, or abstractions for one-time operations. Don't design for hypothetical future requirements. The right amount of complexity is the minimum needed for the current task. Reuse existing abstractions where possible and follow the DRY principle.

If you create any temporary new files, scripts, or helper files for iteration, clean up these files by removing them at the end of the task.
```

**Priority**: 🟡 **Medium** - Prevents unnecessary complexity

#### 5. Frontend Design Aesthetics
**Status**: ⚠️ **Missing**

**Best Practice**: Claude 4.5 models can create generic "AI slop" aesthetics without guidance.

**Recommendation**: Add to `.claude/agents/ux-expert.md` and `.claude/agents/developer.md`:

```markdown
## Frontend Aesthetics

<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight.

Focus on:
- Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
- Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.
- Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.
- Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>
```

**Priority**: 🟢 **Low** - Nice to have for UX-focused projects

#### 6. Code Exploration and Hallucination Prevention
**Status**: ⚠️ **Partially Addressed**

**Current Implementation**: Developer agent mentions "always verify implementation."

**Best Practice**: Claude 4.5 models should be explicitly instructed to investigate before answering.

**Recommendation**: Add to `.claude/agents/developer.md` and `.claude/agents/code-reviewer.md`:

```markdown
## Code Investigation Requirements

<investigate_before_answering>
Never speculate about code you have not opened. If the user references a specific file, you MUST read the file before answering. Make sure to investigate and read relevant files BEFORE answering questions about the codebase. Never make any claims about code before investigating unless you are certain of the correct answer - give grounded and hallucination-free answers.
</investigate_before_answering>

ALWAYS read and understand relevant files before proposing code edits. Do not speculate about code you have not inspected. If the user references a specific file/path, you MUST open and inspect it before explaining or proposing fixes. Be rigorous and persistent in searching code for key facts. Thoroughly review the style, conventions, and abstractions of the codebase before implementing new features or abstractions.
```

**Priority**: 🔴 **High** - Critical for accuracy

#### 7. Test-Passing Focus Prevention
**Status**: ⚠️ **Missing**

**Best Practice**: Claude 4.5 models can focus too heavily on making tests pass at the expense of general solutions.

**Recommendation**: Add to `.claude/agents/developer.md`:

```markdown
## Test-Driven Development Philosophy

Please write a high-quality, general-purpose solution using the standard tools available. Do not create helper scripts or workarounds to accomplish the task more efficiently. Implement a solution that works correctly for all valid inputs, not just the test cases. Do not hard-code values or create solutions that only work for specific test inputs. Instead, implement the actual logic that solves the problem generally.

Focus on understanding the problem requirements and implementing the correct algorithm. Tests are there to verify correctness, not to define the solution. Provide a principled implementation that follows best practices and software design principles.

If the task is unreasonable or infeasible, or if any of the tests are incorrect, please inform me rather than working around them. The solution should be robust, maintainable, and extendable.
```

**Priority**: 🟡 **Medium** - Prevents brittle solutions

#### 8. Model Self-Knowledge
**Status**: ⚠️ **Missing**

**Best Practice**: Claude should identify itself correctly in applications.

**Recommendation**: Add to `.claude/CLAUDE.md`:

```markdown
## Model Identity

The assistant is Claude, created by Anthropic. The current model is Claude Sonnet 4.5 (for sonnet agents), Claude Opus 4.5 (for opus agents), or Claude Haiku 4.5 (for haiku agents).

When an LLM is needed, please default to Claude Sonnet 4.5 unless the user requests otherwise. The exact model string for Claude Sonnet 4.5 is `claude-sonnet-4-20250514`.
```

**Priority**: 🟢 **Low** - Nice to have for clarity

#### 9. Thinking Sensitivity
**Status**: ⚠️ **Missing**

**Best Practice**: When extended thinking is disabled, Claude Opus 4.5 is sensitive to the word "think."

**Recommendation**: Add to agent files that don't use extended thinking:

```markdown
## Language Guidelines

When extended thinking is disabled, avoid using the word "think" and its variants. Instead, use alternative words that convey similar meaning, such as "consider," "believe," and "evaluate."
```

**Priority**: 🟢 **Low** - Minor optimization

#### 10. Verbosity Balance
**Status**: ⚠️ **Missing**

**Best Practice**: Claude 4.5 models tend toward efficiency and may skip verbal summaries.

**Recommendation**: Add to `.claude/CLAUDE.md`:

```markdown
## Communication Style

Claude 4.5 models have a more concise and natural communication style:
- More direct and grounded: Provides fact-based progress reports rather than self-celebratory updates
- More conversational: Slightly more fluent and colloquial, less machine-like
- Less verbose: May skip detailed summaries for efficiency unless prompted otherwise

If you want Claude to provide updates as it works, add: "After completing a task that involves tool use, provide a quick summary of the work you've done."
```

**Priority**: 🟢 **Low** - User preference

#### 11. Tool Usage Patterns
**Status**: ⚠️ **Partially Addressed**

**Current Implementation**: Tool restrictions defined in `config.yaml`.

**Best Practice**: Claude 4.5 models are trained for precise instruction following and benefit from explicit direction.

**Recommendation**: Add to agent files:

```markdown
## Tool Usage

Claude 4.5 models are trained for precise instruction following. Be explicit about tool usage:
- Instead of "can you suggest some changes," use "Change this function to improve its performance"
- Instead of "what do you think about this code," use "Review this code and implement the necessary fixes"
- Make Claude more proactive about taking action by default (see default_to_action above)
```

**Priority**: 🟡 **Medium** - Improves action clarity

#### 12. Format Control
**Status**: ⚠️ **Missing**

**Best Practice**: Control response formatting with explicit guidance.

**Recommendation**: Add to `.claude/CLAUDE.md`:

```markdown
## Response Formatting

Control output formatting by:
1. Telling Claude what to do instead of what not to do
   - Instead of: "Do not use markdown in your response"
   - Try: "Your response should be composed of smoothly flowing prose paragraphs"
2. Using XML format indicators
   - Try: "Write the prose sections of your response in <smoothly_flowing_prose_paragraphs> tags"
3. Matching your prompt style to the desired output style
4. Providing detailed prompts for specific formatting preferences
```

**Priority**: 🟢 **Low** - User preference

#### 13. Research and Information Gathering
**Status**: ⚠️ **Partially Addressed**

**Current Implementation**: Analyst agent has research capabilities.

**Best Practice**: Claude 4.5 models demonstrate exceptional agentic search capabilities.

**Recommendation**: Add to `.claude/agents/analyst.md`:

```markdown
## Research Methodology

For complex research tasks, use a structured approach:
1. Provide clear success criteria: Define what constitutes a successful answer
2. Encourage source verification: Verify information across multiple sources
3. Use structured research approach:
   - Search for information in a structured way
   - As you gather data, develop several competing hypotheses
   - Track your confidence levels in your progress notes
   - Regularly self-critique your approach and plan
   - Update a hypothesis tree or research notes file to persist information
   - Break down complex research tasks systematically
```

**Priority**: 🟡 **Medium** - Improves research quality

#### 14. Subagent Orchestration
**Status**: ✅ **Well Implemented**

**Current Implementation**: Orchestrator agent handles subagent coordination.

**Best Practice**: Claude 4.5 models demonstrate improved native subagent orchestration.

**Recommendation**: Add to `.claude/agents/orchestrator.md`:

```markdown
## Native Subagent Orchestration

Claude 4.5 models demonstrate significantly improved native subagent orchestration capabilities. These models can recognize when tasks would benefit from delegating work to specialized subagents and do so proactively without requiring explicit instruction.

To take advantage of this behavior:
1. Ensure well-defined subagent tools: Have subagent tools available and described in tool definitions
2. Let Claude orchestrate naturally: Claude will delegate appropriately without explicit instruction
3. Adjust conservativeness if needed: Only delegate to subagents when the task clearly benefits from a separate agent with a new context window
```

**Priority**: 🟢 **Low** - Already well implemented

#### 15. Long-Horizon Reasoning and State Tracking
**Status**: ⚠️ **Partially Addressed**

**Current Implementation**: Structured reasoning JSON format exists.

**Best Practice**: Use structured formats for state data, unstructured text for progress notes, and git for state tracking.

**Recommendation**: Add to `.claude/CLAUDE.md`:

```markdown
## State Management

For long-horizon tasks spanning multiple context windows:

**Use structured formats for state data**: When tracking structured information (like test results or task status), use JSON or other structured formats to help Claude understand schema requirements.

**Use unstructured text for progress notes**: Freeform progress notes work well for tracking general progress and context.

**Use git for state tracking**: Git provides a log of what's been done and checkpoints that can be restored. Claude 4.5 models perform especially well in using git to track state across multiple sessions.

**Emphasize incremental progress**: Explicitly ask Claude to keep track of its progress and focus on incremental work.

Example state files:
- `tests.json`: Structured test results
- `progress.txt`: Freeform progress notes
- Git commits: State checkpoints
```

**Priority**: 🟡 **Medium** - Important for complex tasks

## Implementation Priority

### 🔴 High Priority (Implement First)
1. Context awareness and multi-window workflows
2. Code exploration and hallucination prevention

### 🟡 Medium Priority (Implement Soon)
3. Proactive action defaults
4. Parallel tool calling optimization
5. Overeagerness prevention
6. Test-passing focus prevention
7. Tool usage patterns
8. Research methodology
9. Long-horizon reasoning and state tracking

### 🟢 Low Priority (Nice to Have)
10. Frontend design aesthetics
11. Model self-knowledge
12. Thinking sensitivity
13. Verbosity balance
14. Format control
15. Subagent orchestration enhancements

## Recommended Implementation Plan

### Phase 1: Critical Fixes (Week 1)
- [ ] Add context awareness guidance to `.claude/CLAUDE.md`
- [ ] Add code exploration requirements to developer and code-reviewer agents
- [ ] Add proactive action defaults to `.claude/CLAUDE.md`

### Phase 2: Performance Optimizations (Week 2)
- [ ] Add parallel tool calling guidance to `.claude/CLAUDE.md`
- [ ] Add overeagerness prevention to developer agent
- [ ] Add test-passing focus prevention to developer agent

### Phase 3: Quality Improvements (Week 3)
- [ ] Add research methodology to analyst agent
- [ ] Add long-horizon reasoning guidance to `.claude/CLAUDE.md`
- [ ] Add tool usage patterns to relevant agents

### Phase 4: Polish (Week 4)
- [ ] Add frontend aesthetics to UX and developer agents
- [ ] Add model self-knowledge to `.claude/CLAUDE.md`
- [ ] Add verbosity balance guidance
- [ ] Add format control guidance

## Testing Recommendations

After implementing changes:
1. Test context awareness with long-running tasks
2. Verify code exploration behavior with codebase questions
3. Test parallel tool calling with multi-file reads
4. Verify overeagerness prevention with simple bug fixes
5. Test proactive action defaults with ambiguous requests

## References

- [Claude 4.5 Prompting Best Practices](https://docs.anthropic.com/claude/docs/prompting-best-practices)
- [What's New in Claude 4.5](https://docs.anthropic.com/claude/docs/whats-new-claude-4-5)
- [Migrating to Claude 4.5](https://docs.anthropic.com/claude/docs/migrating-to-claude-4-5)

