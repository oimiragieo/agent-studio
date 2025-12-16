# Advanced Tool Use - Anthropic Beta Features

Comprehensive guide to Anthropic's three beta features for optimizing tool usage and reducing context consumption.

## Overview

On November 24, 2025, Anthropic released three beta features that revolutionize how Claude interacts with tools:

1. **Tool Search Tool** - On-demand tool discovery (85% token reduction)
2. **Programmatic Tool Calling** - Code-based tool orchestration (37% token reduction)
3. **Tool Use Examples** - Parameter accuracy improvements (72% → 90% accuracy)

## Expected Impact

### Current State
- MCP tools: 80.3k tokens (40.2% of context)
- Total context: 174k/200k (87%)
- Tool selection accuracy: 79.5% (Opus 4.5)

### With Tool Search Tool Enabled
- MCP tools: ~12k tokens (6% of context) - **85% reduction**
- Total context: ~105k/200k (52.5%) - **Within optimal range**
- Tool selection accuracy: 88.1% (Opus 4.5) - **11% improvement**

## Feature 1: Tool Search Tool

### The Challenge

As more MCP servers connect, tool definitions consume massive token budgets. A typical setup:
- GitHub: 35 tools (~26K tokens)
- Slack: 11 tools (~21K tokens)
- Sentry: 5 tools (~3K tokens)
- Grafana: 5 tools (~3K tokens)
- Splunk: 2 tools (~2K tokens)

**Total: 58 tools consuming ~55K tokens before the conversation starts.**

### The Solution

Instead of loading all tool definitions upfront, the Tool Search Tool discovers tools on-demand. Claude only sees the tools it actually needs for the current task.

**How It Works:**
1. Mark tools with `defer_loading: true` in configuration
2. Only Tool Search Tool + critical tools loaded initially (~500 tokens)
3. When Claude needs capabilities, it searches for relevant tools
4. Matching tools get expanded into full definitions (~3-5 tools, ~3K tokens)
5. Total context consumption: ~8.7K tokens vs. ~77K traditional

### Configuration

**Global Settings** (`.claude/.mcp.json`):
```json
{
  "betaFeatures": ["advanced-tool-use-2025-11-20"],
  "toolSearch": {
    "enabled": true,
    "autoEnableThreshold": 20,
    "defaultDeferLoading": true
  }
}
```

**Per-Server Configuration**:
```json
{
  "mcpServers": {
    "repo": {
      "deferLoading": true,
      "alwaysLoadTools": ["search_code", "read_file"]
    },
    "github": {
      "deferLoading": true,
      "alwaysLoadTools": ["create_pull_request", "get_issue"]
    }
  }
}
```

### When to Use

**Most Beneficial When:**
- Tool definitions consuming >10K tokens
- Experiencing tool selection accuracy issues
- Building MCP-powered systems with multiple servers
- 10+ tools available

**Less Beneficial When:**
- Small tool library (<10 tools)
- All tools used frequently in every session
- Tool definitions are compact

### Tool Search with Embeddings

**Advanced Pattern**: For even better tool discovery, use embedding-based semantic search.

**How It Works**:
1. Create embeddings for all tool definitions
2. Create embedding for user query
3. Find tools with similar embeddings (cosine similarity)
4. Return top-k most relevant tools

**Implementation** (`.claude/tools/tool_search.mjs`):
- Loads tool definitions from MCP configuration
- Creates embeddings for tools (name + description)
- Searches using semantic similarity
- Returns most relevant tools

**Benefits Over Simple Search**:
- Better semantic understanding
- Handles synonyms and related concepts
- More accurate tool matching
- Scales to thousands of tools

See `.claude/skills/tool-search/SKILL.md` for detailed implementation.

### Best Practices

1. **Keep 3-5 Most-Used Tools Always Loaded**
   - Core file operations: `read_file`, `write_file`
   - Essential integrations: `create_pull_request`, `get_issue`
   - Frequently used: `take_screenshot`, `navigate_page`

2. **Use Clear, Descriptive Tool Names**
   ```json
   // Good
   {
     "name": "search_customer_orders",
     "description": "Search for customer orders by date range, status, or total amount. Returns order details including items, shipping, and payment info."
   }
   
   // Bad
   {
     "name": "query_db_orders",
     "description": "Execute order query"
   }
   ```

3. **Add System Prompt Guidance**
   ```
   You have access to tools for Slack messaging, Google Drive file management, 
   Jira ticket tracking, and GitHub repository operations. Use the tool search 
   to find specific capabilities.
   ```

## Feature 2: Programmatic Tool Calling (PTC)

Programmatic Tool Calling allows Claude to write code that calls tools programmatically within the Code Execution environment, reducing token consumption and latency for workflows with large datasets or sequential dependencies.

### Key Benefits

- **85%+ token reduction** for large, metadata-rich datasets
- **Sequential dependency optimization** - handles multi-step workflows
- **Context preservation** - processes data before sending to model
- **37% average token reduction** (43,588 → 27,297 tokens)
- **Reduced latency** - eliminates 19+ inference passes for 20+ tool calls

### When to Use

- Large datasets (100+ items with rich metadata)
- Sequential dependencies between tool calls
- Multiple tool calls in loops
- Computational logic (aggregations, filtering)
- Tools safe for programmatic/repeated execution

### Example Use Cases

- Team expense analysis with hundreds of line items
- Multi-entity health checks with conditional diagnostics
- Database query result aggregation
- Batch API operations with conditional logic

### Quick Example

**Traditional Approach:**
```
Fetch team → 20 people
For each: fetch expenses → 20 tool calls
All 2,000+ items enter context (50KB+)
```

**With PTC:**
```python
team = await get_team_members("engineering")
expenses = await asyncio.gather(*[get_expenses(m["id"]) for m in team])
exceeded = [m for m, e in zip(team, expenses) if sum(e) > budget]
print(json.dumps(exceeded))  # Only 2-3 people in context
```

### Implementation

See [PTC Patterns Guide](./PTC_PATTERNS.md) for comprehensive documentation, examples, patterns, and best practices from Claude Cookbooks.

## Feature 2 (Legacy): Programmatic Tool Calling

### The Challenge

Traditional tool calling creates two problems:
1. **Context pollution**: Intermediate results consume token budgets
2. **Inference overhead**: Each tool call requires a full model inference pass

Example: Analyzing a 10MB log file means the entire file enters context, even though Claude only needs error frequency summaries.

### The Solution

Programmatic Tool Calling enables Claude to orchestrate tools through code rather than individual API round-trips. Claude writes Python code that calls multiple tools, processes outputs, and controls what enters its context window.

**Benefits:**
- **Token savings**: 37% reduction (43,588 → 27,297 tokens average)
- **Reduced latency**: Eliminates 19+ inference passes for 20+ tool calls
- **Improved accuracy**: Knowledge retrieval 25.6% → 28.5%; GIA benchmarks 46.5% → 51.2%

### Example: Budget Compliance Check

**Traditional Approach:**
```
Fetch team members → 20 people
For each person, fetch Q3 expenses → 20 tool calls
Fetch budget limits
All 2,000+ expense line items enter Claude's context (50 KB+)
Claude manually sums expenses, compares to budgets
```

**With Programmatic Tool Calling:**
```python
team = await get_team_members("engineering")

# Fetch budgets for each unique level in parallel
levels = list(set(m["level"] for m in team))
budget_results = await asyncio.gather(*[
    get_budget_by_level(level) for level in levels
])

# Create lookup dictionary
budgets = {level: budget for level, budget in zip(levels, budget_results)}

# Fetch all expenses in parallel
expenses = await asyncio.gather(*[
    get_expenses(m["id"], "Q3") for m in team
])

# Find employees who exceeded budget
exceeded = []
for member, exp in zip(team, expenses):
    budget = budgets[member["level"]]
    total = sum(e["amount"] for e in exp)
    if total > budget["travel_limit"]:
        exceeded.append({
            "name": member["name"],
            "spent": total,
            "limit": budget["travel_limit"]
        })

print(json.dumps(exceeded))
```

**Result**: Claude's context receives only the final result (2-3 people), not 2,000+ line items.

### Configuration

**Mark Tools for Programmatic Calling**:
```json
{
  "mcpServers": {
    "github": {
      "allowedCallers": ["code_execution_20250825"],
      "tools": {
        "list_issues": {
          "programmatic": true
        },
        "create_pull_request": {
          "programmatic": true
        },
        "get_file_contents": {
          "programmatic": true
        }
      }
    }
  }
}
```

### When to Use

**Most Beneficial When:**
- Processing large datasets (only need aggregates/summaries)
- Multi-step workflows (3+ dependent tool calls)
- Parallel operations across many items
- Filtering/transforming results before Claude sees them
- Handling tasks where intermediate data shouldn't influence reasoning

**Less Beneficial When:**
- Making simple single-tool invocations
- Working on tasks where Claude should see all intermediate results
- Running quick lookups with small responses

### Best Practices

1. **Document Return Formats Clearly**
   ```json
   {
     "name": "get_orders",
     "description": "Retrieve orders for a customer.
   Returns:
       List of order objects, each containing:
       - id (str): Order identifier
       - total (float): Order total in USD
       - status (str): One of 'pending', 'shipped', 'delivered'
       - items (list): Array of {sku, quantity, price}
       - created_at (str): ISO 8601 timestamp"
   }
   ```

2. **Use for Parallel Operations**
   - Tools that can run independently
   - Operations safe to retry (idempotent)
   - Batch operations

3. **Keep Intermediate Results Out of Context**
   - Process data in code
   - Return only final summaries
   - Filter irrelevant information

## Feature 3: Tool Use Examples

### The Challenge

JSON Schema defines structure but can't express usage patterns:
- Format ambiguity: Date formats, ID conventions
- Nested structure usage: When to populate optional nested objects
- Parameter correlations: How optional parameters relate to each other
- Domain-specific conventions: API-specific patterns not in schema

### The Solution

Tool Use Examples provide sample tool calls directly in tool definitions. Instead of relying on schema alone, you show Claude concrete usage patterns.

**Impact**: Accuracy improved from 72% to 90% on complex parameter handling.

### Example: Support Ticket API

**Schema Only** (Ambiguous):
```json
{
  "name": "create_ticket",
  "input_schema": {
    "properties": {
      "title": {"type": "string"},
      "priority": {"enum": ["low", "medium", "high", "critical"]},
      "reporter": {
        "type": "object",
        "properties": {
          "id": {"type": "string"},
          "contact": {
            "type": "object",
            "properties": {
              "email": {"type": "string"}
            }
          }
        }
      }
    }
  }
}
```

**With Examples** (Clear):
```json
{
  "name": "create_ticket",
  "input_schema": { /* same as above */ },
  "input_examples": [
    {
      "title": "Login page returns 500 error",
      "priority": "critical",
      "labels": ["bug", "authentication", "production"],
      "reporter": {
        "id": "USR-12345",
        "name": "Jane Smith",
        "contact": {
          "email": "jane@acme.com",
          "phone": "+1-555-0123"
        }
      },
      "due_date": "2024-11-06",
      "escalation": {
        "level": 2,
        "notify_manager": true,
        "sla_hours": 4
      }
    },
    {
      "title": "Add dark mode support",
      "labels": ["feature-request", "ui"],
      "reporter": {
        "id": "USR-67890",
        "name": "Alex Chen"
      }
    },
    {
      "title": "Update API documentation"
    }
  ]
}
```

**What Claude Learns:**
- Format conventions: Dates use YYYY-MM-DD, user IDs follow USR-XXXXX
- Nested structure patterns: How to construct reporter object with contact
- Optional parameter correlations: Critical bugs have full contact + escalation; feature requests have reporter only

### Configuration

**Add Examples to Tools**:
```json
{
  "mcpServers": {
    "github": {
      "inputExamples": {
        "create_pull_request": [
          {
            "title": "Fix authentication bug",
            "body": "Resolves #123\n\nThis PR fixes the authentication bug.",
            "head": "feature/fix-auth",
            "base": "main",
            "draft": false
          },
          {
            "title": "Add dark mode support",
            "body": "Implements dark mode toggle.",
            "head": "feature/dark-mode",
            "base": "develop",
            "draft": true
          }
        ]
      }
    }
  }
}
```

### When to Use

**Most Beneficial When:**
- Complex nested structures where valid JSON doesn't imply correct usage
- Tools with many optional parameters and inclusion patterns matter
- APIs with domain-specific conventions not captured in schemas
- Similar tools where examples clarify which one to use

**Less Beneficial When:**
- Simple single-parameter tools with obvious usage
- Standard formats like URLs or emails that Claude already understands
- Validation concerns better handled by JSON Schema constraints

### Best Practices

1. **Use Realistic Data**
   - Real city names, plausible prices
   - Not "string" or "value" placeholders

2. **Show Variety**
   - Minimal specification (title only)
   - Partial specification (title + labels)
   - Full specification (all parameters)

3. **Keep It Concise**
   - 1-5 examples per tool
   - Focus on ambiguity areas only

4. **Focus on Ambiguity**
   - Only add examples where correct usage isn't obvious from schema
   - Don't duplicate what schema already makes clear

## Tool Choice Strategies

The `tool_choice` parameter controls how Claude decides to use tools. Understanding these strategies helps optimize tool usage patterns.

### Three Tool Choice Options

#### 1. `auto` (Default)
Claude automatically decides whether to call tools or not.

**Use When:**
- Claude should decide if tools are needed
- Flexible workflows where tools are optional
- General-purpose agents

**Example:**
```python
response = client.messages.create(
    model="claude-sonnet-4-5",
    tools=tools,
    tool_choice={"type": "auto"},  # Default behavior
    messages=[{"role": "user", "content": "What's the weather?"}]
)
```

**Behavior:**
- Claude may answer directly if it has sufficient knowledge
- Claude will call tools when needed
- Most flexible option

#### 2. `any`
Claude must use one of the provided tools, but can choose which one.

**Use When:**
- Tool usage is required for the task
- Multiple tools available and Claude should choose
- Ensuring tool execution happens

**Example:**
```python
response = client.messages.create(
    model="claude-sonnet-4-5",
    tools=[web_search, calculator, database_query],
    tool_choice={"type": "any"},  # Must use a tool
    messages=[{"role": "user", "content": "Find information about Python"}]
)
```

**Behavior:**
- Claude must call at least one tool
- Claude chooses which tool to use
- Useful for enforcing tool-based workflows

#### 3. `tool` (Specific Tool)
Force Claude to use a specific tool.

**Use When:**
- Specific tool must be used for the task
- Enforcing consistent tool usage
- Building specialized workflows

**Example:**
```python
response = client.messages.create(
    model="claude-sonnet-4-5",
    tools=[sentiment_analyzer, calculator],
    tool_choice={"type": "tool", "name": "sentiment_analyzer"},  # Force specific tool
    messages=[{"role": "user", "content": "Analyze this tweet sentiment"}]
)
```

**Behavior:**
- Claude must call the specified tool
- Useful for specialized functions
- Ensures consistent behavior

### Tool Choice Patterns

#### Pattern 1: Customer Service Agent

**Scenario**: Agent must always use tools, but can choose which one based on query.

```python
tools = [
    {"name": "get_customer_info", "description": "Get customer details"},
    {"name": "check_order_status", "description": "Check order status"},
    {"name": "process_refund", "description": "Process refund"}
]

# Agent must use a tool, but chooses which one
response = client.messages.create(
    model="claude-sonnet-4-5",
    tools=tools,
    tool_choice={"type": "any"},  # Must use a tool
    messages=[{"role": "user", "content": user_message}]
)
```

#### Pattern 2: Forced Tool Execution

**Scenario**: Always use sentiment analysis tool, regardless of query.

```python
def analyze_sentiment(text):
    response = client.messages.create(
        model="claude-sonnet-4-5",
        tools=[sentiment_tool],
        tool_choice={"type": "tool", "name": "sentiment_analyzer"},
        messages=[{"role": "user", "content": f"Analyze: {text}"}]
    )
    return response
```

#### Pattern 3: Flexible Tool Usage

**Scenario**: Let Claude decide if tools are needed (default behavior).

```python
# Claude can answer directly or use tools
response = client.messages.create(
    model="claude-sonnet-4-5",
    tools=tools,
    tool_choice={"type": "auto"},  # Optional tool usage
    messages=[{"role": "user", "content": "What is 2+2?"}]
)
# Claude may answer directly or use calculator tool
```

### Best Practices

1. **Use `auto` for General Agents**
   - Most flexible
   - Claude decides when tools are needed
   - Good default choice

2. **Use `any` for Tool-Required Workflows**
   - When tool execution is mandatory
   - Multiple tools available
   - Claude chooses appropriate tool

3. **Use `tool` for Specialized Functions**
   - When specific tool must be used
   - Enforcing consistent behavior
   - Building deterministic workflows

4. **Combine with System Prompts**
   - Guide Claude's tool selection
   - Provide context about when to use tools
   - Set expectations for tool usage

### Common Mistakes

**Mistake 1**: Using `tool` when `any` would be better
```python
# ❌ Too restrictive
tool_choice={"type": "tool", "name": "web_search"}

# ✅ More flexible
tool_choice={"type": "any"}  # Claude chooses web_search or calculator
```

**Mistake 2**: Using `any` when `auto` is sufficient
```python
# ❌ Forces tool usage when not needed
tool_choice={"type": "any"}

# ✅ Allows Claude to answer directly when appropriate
tool_choice={"type": "auto"}
```

**Mistake 3**: Not providing clear tool descriptions
```python
# ❌ Vague description
{"name": "search", "description": "Search for information"}

# ✅ Clear description
{"name": "web_search", "description": "Search the web for current information. Use when user asks about recent events, news, or information not in training data."}
```

## Combining Features Strategically

### Layered Approach

Not every agent needs all three features. Start with your biggest bottleneck:

1. **Context bloat from tool definitions** → Tool Search Tool
2. **Large intermediate results** → Programmatic Tool Calling
3. **Parameter errors** → Tool Use Examples

Then layer additional features as needed. They're complementary:
- Tool Search Tool ensures the right tools are found
- Programmatic Tool Calling ensures efficient execution
- Tool Use Examples ensure correct invocation

### Recommended Setup

**For Most Projects:**
1. Enable Tool Search Tool (immediate 85% reduction)
2. Add Programmatic Tool Calling for suitable workflows
3. Add Tool Use Examples for complex tools

**For Simple Projects (<10 tools):**
- Tool Search Tool may not be necessary
- Focus on Tool Use Examples for accuracy

**For Complex Workflows:**
- All three features working together
- Tool Search Tool for discovery
- Programmatic Tool Calling for orchestration
- Tool Use Examples for precision

## Migration Guide

### Step 1: Enable Tool Search Tool

1. Add beta features to `.claude/.mcp.json`:
   ```json
   {
     "betaFeatures": ["advanced-tool-use-2025-11-20"],
     "toolSearch": {
       "enabled": true,
       "defaultDeferLoading": true
     }
   }
   ```

2. Mark servers for deferred loading:
   ```json
   {
     "mcpServers": {
       "github": {
         "deferLoading": true,
         "alwaysLoadTools": ["create_pull_request"]
       }
     }
   }
   ```

3. Verify context usage reduction (should drop from 80k+ to ~12k tokens)

### Step 2: Add Programmatic Tool Calling

1. Identify tools suitable for programmatic calling:
   - Parallel operations
   - Data processing
   - Batch operations

2. Mark tools in configuration:
   ```json
   {
     "tools": {
       "list_issues": {
         "programmatic": true
       }
     }
   }
   ```

3. Test with workflows that process large datasets

### Step 3: Add Tool Use Examples

1. Identify complex tools needing examples:
   - Nested structures
   - Many optional parameters
   - Domain-specific conventions

2. Add examples to configuration:
   ```json
   {
     "inputExamples": {
       "create_pull_request": [/* examples */]
     }
   }
   ```

3. Monitor parameter accuracy improvements

## Troubleshooting

### Tool Search Tool Issues

**Problem**: Tools not being discovered
- **Solution**: Check tool names and descriptions are clear and descriptive
- **Solution**: Verify `deferLoading` is set correctly
- **Solution**: Ensure Tool Search Tool is enabled in beta features

**Problem**: Critical tools not available immediately
- **Solution**: Add to `alwaysLoadTools` array
- **Solution**: Verify tool names match exactly

### Programmatic Tool Calling Issues

**Problem**: Code execution errors
- **Solution**: Document return formats clearly
- **Solution**: Ensure tools are marked with `programmatic: true`
- **Solution**: Check tool responses match expected format

**Problem**: Intermediate results still entering context
- **Solution**: Verify code processes results before returning
- **Solution**: Ensure only final output is printed/returned

### Tool Use Examples Issues

**Problem**: Examples not improving accuracy
- **Solution**: Use realistic, varied examples
- **Solution**: Focus on ambiguous areas only
- **Solution**: Ensure examples match actual API behavior

## Performance Monitoring

### Metrics to Track

1. **Context Usage**
   - MCP tool token consumption
   - Total context percentage
   - Target: <70% total context

2. **Tool Selection Accuracy**
   - Correct tool chosen rate
   - Parameter correctness rate
   - Target: >85% accuracy

3. **Latency**
   - Tool discovery time
   - Code execution time
   - Overall workflow time

### Monitoring Commands

```bash
# Check context usage
/context

# Monitor tool usage patterns
# Review Claude Code logs for tool discovery patterns
```

## References

- [Anthropic Blog: Advanced Tool Use](https://www.anthropic.com/news/advanced-tool-use)
- [Tool Search Tool Documentation](https://docs.anthropic.com/claude/docs/tool-search-tool)
- [Programmatic Tool Calling Cookbook](https://docs.anthropic.com/claude/docs/programmatic-tool-calling)
- [Tool Use Examples Documentation](https://docs.anthropic.com/claude/docs/tool-use-examples)

## Quick Reference

### Configuration Checklist

- [ ] Beta features enabled: `advanced-tool-use-2025-11-20`
- [ ] Tool Search Tool enabled
- [ ] Critical tools in `alwaysLoadTools`
- [ ] Programmatic tools marked with `programmatic: true`
- [ ] Complex tools have `inputExamples`
- [ ] System prompt mentions available tools

### When to Use Each Feature

| Feature | Use When | Avoid When |
|---------|----------|------------|
| Tool Search Tool | 10+ tools, >10K tokens | <10 tools, all used frequently |
| Programmatic Tool Calling | Large datasets, parallel ops | Simple lookups, need all results |
| Tool Use Examples | Complex params, domain conventions | Simple tools, obvious usage |

