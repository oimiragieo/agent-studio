# Extended Thinking Guide

## Overview

Extended thinking enables Claude to use enhanced reasoning capabilities for complex tasks while providing transparency into its step-by-step thought process. When extended thinking is enabled, Claude creates `thinking` content blocks where it outputs its internal reasoning before crafting a final response.

## What is Extended Thinking?

Extended thinking gives Claude:
- **Enhanced Reasoning**: Better problem-solving for complex tasks
- **Transparency**: Visible step-by-step thought process
- **Better Decisions**: More thorough analysis before responding
- **Budget Control**: Configurable token budget for thinking

## When to Use Extended Thinking

### Use Extended Thinking For:

1. **Complex Orchestration Decisions**
   - Routing ambiguous requests
   - Selecting between workflow patterns
   - Resolving conflicting requirements
   - Determining optimal agent sequencing

2. **Complex Planning Scenarios**
   - Ambiguous or incomplete requirements
   - Multi-agent coordination
   - Evaluating trade-offs between approaches
   - Assessing plan feasibility and risks

3. **Complex Architectural Decisions**
   - Technology selection with trade-offs
   - System design with multiple valid approaches
   - Performance vs. complexity decisions
   - Security vs. usability trade-offs

4. **Complex Quality Decisions**
   - High-risk scenarios
   - Quality gate decisions
   - Test strategy for complex systems
   - Risk evaluation and mitigation

5. **Complex Database Decisions**
   - Data architecture choices
   - Performance trade-offs
   - Migration risks
   - Optimization strategies

### Don't Use Extended Thinking For:

- Simple, straightforward tasks
- Tasks with clear, unambiguous requirements
- Routine operations
- Quick fixes or small changes

## Configuration

### Agent Configuration

Extended thinking is configured in `.claude/config.yaml`:

```yaml
agent_routing:
  orchestrator:
    extended_thinking: true
    # ... other config
  planner:
    extended_thinking: true
    # ... other config
  architect:
    extended_thinking: true
    # ... other config
```

### API Configuration

When using the API directly:

```javascript
const response = await client.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 4000,
  thinking: {
    type: "enabled",
    budget_tokens: 2000  // Budget for thinking blocks
  },
  messages: [{
    role: "user",
    content: "Solve this complex problem..."
  }]
});
```

### Budget Tokens

**Recommended Budgets** (based on Claude Cookbooks patterns):
- **Simple tasks**: 500-1000 tokens
- **Medium complexity**: 1000-2000 tokens
- **Complex tasks**: 2000-4000 tokens
- **Very complex**: 4000-8000 tokens

**Best Practice**: Start with 2000 tokens and adjust based on task complexity.

**Example from Cookbooks**:
```python
response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=4000,
    thinking={
        "type": "enabled",
        "budget_tokens": 2000  # Budget for thinking blocks
    },
    messages=[{
        "role": "user",
        "content": "Solve this complex problem..."
    }]
)
```

## Extended Thinking Process

### 1. Task Decomposition

Break down the request into component tasks:
- Identify all sub-problems
- Map dependencies between tasks
- Determine task sequencing

### 2. Analysis and Evaluation

Evaluate options and trade-offs:
- List all possible approaches
- Evaluate pros and cons of each
- Consider constraints and requirements
- Assess risks and mitigation strategies

### 3. Decision Making

Make informed decisions:
- Select optimal approach based on analysis
- Justify decision with reasoning
- Document assumptions and constraints
- Identify potential issues

### 4. Synthesis

Combine insights into final answer:
- Integrate analysis results
- Create coherent response
- Reference key insights from thinking
- Provide actionable recommendations

## Understanding Thinking Blocks

### Thinking Block Structure

When extended thinking is enabled, responses include:

1. **Thinking Blocks** (`thinking` type):
   - Internal reasoning process
   - Step-by-step analysis
   - Decision rationale
   - May be truncated for readability

2. **Redacted Thinking Blocks** (`redacted_thinking` type):
   - Compressed thinking content
   - Used when thinking exceeds budget
   - Contains signature for verification

3. **Final Answer** (`text` type):
   - Final response after thinking
   - Incorporates insights from thinking
   - Actionable recommendations

### Reading Thinking Blocks

**In API Responses**:
```javascript
for (const block of response.content) {
  if (block.type === "thinking") {
    console.log("Thinking:", block.thinking);
  } else if (block.type === "redacted_thinking") {
    console.log("Redacted thinking (compressed)");
  } else if (block.type === "text") {
    console.log("Final answer:", block.text);
  }
}
```

**In Claude Code**:
- Thinking blocks are visible in the response
- Can be expanded/collapsed for readability
- Signature available for verification

## Best Practices

### 1. Use for Complex Decisions

Only enable extended thinking for tasks that benefit from deep reasoning:
- Complex orchestration decisions
- Ambiguous requirements
- Multi-option trade-offs
- High-risk scenarios

**Example from Cookbooks**:
```python
# Complex puzzle solving
response = client.messages.create(
    model="claude-sonnet-4-5",
    thinking={"type": "enabled", "budget_tokens": 2000},
    messages=[{"role": "user", "content": "Solve this complex puzzle..."}]
)
```

### 2. Set Appropriate Budgets

Match budget to task complexity:
- Don't waste tokens on simple tasks
- Don't under-budget complex tasks
- Start with 2000 tokens and adjust

### 3. Review Thinking Blocks

Use thinking blocks to:
- Understand agent reasoning
- Debug decision-making
- Improve prompts
- Validate approach

### 4. Reference Thinking Insights

In final responses:
- Reference key insights from thinking
- Explain decision rationale
- Document assumptions
- Note trade-offs considered

### 5. Monitor Token Usage

Track thinking token usage:
- Monitor budget consumption
- Adjust budgets based on actual usage
- Balance thinking depth vs. efficiency

## Agent-Specific Patterns

### Orchestrator

**Use Extended Thinking When**:
- Analyzing ambiguous requests
- Selecting workflow patterns
- Resolving conflicting requirements
- Determining agent sequencing

**Process**:
1. Task decomposition
2. Agent matching
3. Workflow selection
4. Risk assessment
5. Synthesis strategy

### Planner

**Use Extended Thinking When**:
- Analyzing ambiguous requirements
- Determining task sequencing
- Evaluating planning approaches
- Coordinating multi-agent planning

**Process**:
1. Requirement decomposition
2. Dependency analysis
3. Risk assessment
4. Agent coordination
5. Plan validation

### Architect

**Use Extended Thinking When**:
- Evaluating technology choices
- Making architecture trade-offs
- Resolving conflicting requirements
- Assessing scalability options

**Process**:
1. Requirement analysis
2. Option evaluation
3. Trade-off analysis
4. Decision justification
5. Architecture synthesis

### QA

**Use Extended Thinking When**:
- Designing test strategies
- Evaluating risk scenarios
- Making quality gate decisions
- Assessing test coverage

**Process**:
1. Risk identification
2. Test strategy evaluation
3. Coverage analysis
4. Quality gate assessment
5. Test plan synthesis

## Token Counting and Management

### Counting Tokens

```javascript
const result = await client.messages.count_tokens({
  model: "claude-sonnet-4-5",
  messages: messages
});

console.log(`Input tokens: ${result.input_tokens}`);
console.log(`Output tokens: ${result.output_tokens}`);
```

### Managing Thinking Budget

- **Monitor usage**: Track thinking token consumption
- **Adjust budgets**: Increase/decrease based on needs
- **Balance depth vs. efficiency**: Don't over-think simple tasks

## Streaming with Extended Thinking

Extended thinking works with streaming:

```javascript
const stream = await client.messages.stream({
  model: "claude-sonnet-4-5",
  thinking: { type: "enabled", budget_tokens: 2000 },
  messages: [/* ... */]
});

for await (const event of stream) {
  if (event.type === "thinking") {
    console.log("Thinking:", event.thinking);
  } else if (event.type === "text") {
    console.log("Text:", event.text);
  }
}
```

## Error Handling

### Common Issues

**Thinking Budget Exceeded**:
- Solution: Increase budget_tokens or simplify task
- Result: Thinking block becomes redacted

**No Thinking Output**:
- Check: Extended thinking enabled in config
- Verify: Task complexity warrants thinking
- Ensure: Budget tokens set appropriately

**Thinking Too Verbose**:
- Solution: Reduce budget_tokens
- Alternative: Break task into smaller parts
- Use: More focused prompts

## Examples

### Example 1: Orchestrator Routing Decision

**Scenario**: Ambiguous request requiring multiple agents

**Extended Thinking Process**:
1. Analyze request for implicit requirements
2. Evaluate which agents are needed
3. Determine optimal sequencing
4. Assess coordination challenges
5. Select workflow pattern

**Final Decision**: Route to Analyst → PM → Architect → Developer

### Example 2: Architecture Trade-off

**Scenario**: Choosing between microservices and monolith

**Extended Thinking Process**:
1. Analyze requirements and constraints
2. Evaluate pros/cons of each approach
3. Assess scalability needs
4. Consider team capabilities
5. Make decision with justification

**Final Decision**: Monolith with clear service boundaries (justified by team size and timeline)

### Example 3: Test Strategy

**Scenario**: Complex system requiring comprehensive testing

**Extended Thinking Process**:
1. Identify critical paths and risks
2. Evaluate test types needed
3. Assess coverage requirements
4. Consider resource constraints
5. Design balanced test strategy

**Final Decision**: Unit tests (80%) + Integration tests (15%) + E2E tests (5%)

## Related Documentation

- [Everlasting Agent System](EVERLASTING_AGENTS.md) - Context window management
- [Context Optimization](CONTEXT_OPTIMIZATION.md) - Context management
- [Orchestration Patterns](ORCHESTRATION_PATTERNS.md) - Agent coordination

## Streaming with Extended Thinking

### Handling Streaming Responses

From Claude Cookbooks, streaming with extended thinking requires handling different block types:

```python
with client.messages.stream(
    model="claude-sonnet-4-5",
    thinking={"type": "enabled", "budget_tokens": 2000},
    messages=[{"role": "user", "content": query}]
) as stream:
    current_block_type = None
    
    for event in stream:
        if event.type == "content_block_start":
            current_block_type = event.content_block.type
            print(f"\n--- Starting {current_block_type} block ---")
            
        elif event.type == "content_block_delta":
            if event.delta.type == "thinking_delta":
                print(event.delta.thinking, end="", flush=True)
            elif event.delta.type == "text_delta":
                print(event.delta.text, end="", flush=True)
                
        elif event.type == "content_block_stop":
            print(f"\n--- Finished {current_block_type} block ---\n")
```

## Token Counting

### Tracking Token Usage

From Cookbooks patterns, track token usage with extended thinking:

```python
# Count tokens without thinking
base_tokens = client.messages.count_tokens(
    model="claude-sonnet-4-5",
    messages=messages
)

# Estimate thinking tokens (rough)
thinking_tokens = sum(
    len(block.thinking.split()) * 1.3  # Rough estimate
    for block in response.content 
    if block.type == "thinking"
)

total_tokens = base_tokens + thinking_tokens
```

## References

- [Extended Thinking Documentation](https://docs.claude.com/en/docs/build-with-claude/extended-thinking)
- [Claude Cookbooks - Extended Thinking](https://github.com/anthropics/anthropic-cookbook/tree/main/extended_thinking)
- [Claude API Reference](https://docs.claude.com/en/api/messages)

