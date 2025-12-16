# Programmatic Tool Calling (PTC) Patterns

Comprehensive guide to Programmatic Tool Calling (PTC) based on Claude Cookbooks patterns. PTC allows Claude to write code that calls tools programmatically within the Code Execution environment, reducing token consumption and latency for workflows with large datasets or sequential dependencies.

## Overview

Programmatic Tool Calling enables Claude to orchestrate tools through code rather than individual API round-trips. Claude writes Python code that calls multiple tools, processes outputs, and controls what enters its context window.

### Key Benefits

- **85%+ token reduction** for large, metadata-rich datasets
- **Sequential dependency optimization** - handles multi-step workflows efficiently
- **Context preservation** - processes data before sending to model
- **Reduced latency** - eliminates multiple inference passes for tool orchestration

## When to Use PTC

### Most Beneficial When

1. **Large Datasets (100+ items with rich metadata)**
   - Processing expense reports with hundreds of line items
   - Analyzing customer data with detailed attributes
   - Batch operations on multiple entities

2. **Sequential Dependencies**
   - One tool call depends on results of previous calls
   - Multi-step workflows with conditional logic
   - Cascading lookups (e.g., check budgets only for employees who exceeded limits)

3. **Multiple Tool Calls in Loops**
   - Iterating over entities and calling tools for each
   - Parallel operations across similar items
   - Batch processing with dependencies

4. **Computational Logic**
   - Aggregations, filtering, or transformations needed
   - Data processing before Claude sees results
   - Reducing what needs to flow through context

5. **Tools Safe for Programmatic Execution**
   - Idempotent operations
   - Read-only or safe write operations
   - Tools that can be called repeatedly without side effects

### Less Beneficial When

- Simple single-tool invocations
- Tasks where Claude should see all intermediate results
- Quick lookups with small responses
- Tools with side effects that require human oversight

## Example: Team Expense Analysis

### Traditional Approach (Without PTC)

```
1. Fetch team members → 20 people
2. For each person, fetch Q3 expenses → 20 tool calls
3. Fetch budget limits
4. All 2,000+ expense line items enter Claude's context (50 KB+)
5. Claude manually sums expenses, compares to budgets
```

**Problems:**
- 20+ tool calls = 20+ inference passes
- 2,000+ expense items in context (50KB+)
- High token consumption
- Slow execution

### With Programmatic Tool Calling

```python
import asyncio
import json

# Fetch team members
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

**Benefits:**
- Parallel tool calls (async execution)
- Data processed in code (only final result to Claude)
- 2-3 people in context instead of 2,000+ line items
- Single inference pass instead of 20+

## Configuration

### Mark Tools for Programmatic Calling

In `.claude/.mcp.json`:

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

### Required Setup

1. **Enable Code Execution Tool**
   - Ensure `code_execution_20250825` tool is available
   - Required for PTC to work

2. **Mark Tools as Programmatic**
   - Add `"programmatic": true` to tool configuration
   - Tools must be safe for programmatic execution

3. **Document Return Formats**
   - Clear documentation of tool response structures
   - Helps Claude write correct code

## Patterns

### Pattern 1: Parallel Operations

**Use Case**: Fetching data for multiple entities independently

```python
# Fetch data for multiple items in parallel
results = await asyncio.gather(*[
    get_item_details(item_id) for item_id in item_ids
])

# Process results
processed = [process_item(r) for r in results]
print(json.dumps(processed))
```

### Pattern 2: Sequential Dependencies

**Use Case**: One operation depends on previous results

```python
# Step 1: Get initial data
customers = await get_customers()

# Step 2: For customers meeting criteria, get details
high_value = [c for c in customers if c["revenue"] > 10000]
details = await asyncio.gather(*[
    get_customer_details(c["id"]) for c in high_value
])

# Step 3: Process and return only relevant data
summary = [{"id": d["id"], "status": d["status"]} for d in details]
print(json.dumps(summary))
```

### Pattern 3: Data Aggregation

**Use Case**: Processing large datasets to extract summaries

```python
# Fetch all data
all_data = await fetch_all_records()

# Aggregate in code
summary = {
    "total": len(all_data),
    "by_category": {},
    "top_items": []
}

for item in all_data:
    category = item["category"]
    summary["by_category"][category] = summary["by_category"].get(category, 0) + 1

# Sort and get top items
summary["top_items"] = sorted(
    all_data, 
    key=lambda x: x["value"], 
    reverse=True
)[:10]

print(json.dumps(summary))
```

### Pattern 4: Conditional Tool Calls

**Use Case**: Calling tools based on data analysis

```python
# Initial scan
items = await scan_items()

# Only check custom budgets for items that exceeded standard limits
exceeded_standard = [i for i in items if i["amount"] > i["standard_limit"]]

if exceeded_standard:
    # Only fetch custom budgets for these items
    custom_budgets = await asyncio.gather(*[
        get_custom_budget(i["id"]) for i in exceeded_standard
    ])
    
    # Compare
    violations = [
        {"id": i["id"], "exceeded": i["amount"] > b["limit"]}
        for i, b in zip(exceeded_standard, custom_budgets)
    ]
    print(json.dumps(violations))
else:
    print(json.dumps({"status": "all_within_limits"}))
```

## Best Practices

### 1. Document Return Formats Clearly

```json
{
  "name": "get_orders",
  "description": "Retrieve orders for a customer. Returns: List of order objects, each containing: - id (str): Order identifier - total (float): Order total in USD - status (str): One of 'pending', 'shipped', 'delivered' - items (list): Array of {sku, quantity, price} - created_at (str): ISO 8601 timestamp"
}
```

### 2. Use for Parallel Operations

- Tools that can run independently
- Operations safe to retry (idempotent)
- Batch operations

### 3. Keep Intermediate Results Out of Context

- Process data in code
- Return only final summaries
- Filter irrelevant information

### 4. Handle Errors Gracefully

```python
try:
    results = await asyncio.gather(*[
        get_data(id) for id in ids
    ], return_exceptions=True)
    
    # Filter out errors
    successful = [r for r in results if not isinstance(r, Exception)]
    errors = [r for r in results if isinstance(r, Exception)]
    
    print(json.dumps({
        "successful": successful,
        "error_count": len(errors)
    }))
except Exception as e:
    print(json.dumps({"error": str(e)}))
```

### 5. Use Structured Output

- Return JSON for easy parsing
- Include metadata (counts, summaries)
- Structure data for Claude's understanding

## Integration with Tool Search

PTC works well with Tool Search Tool:

1. **Tool Search** finds relevant tools (on-demand loading)
2. **PTC** orchestrates tools efficiently (reduced context)
3. **Result**: Optimal tool usage with minimal token consumption

## Performance Metrics

### Token Savings

- **Traditional**: 43,588 tokens average
- **With PTC**: 27,297 tokens average
- **Reduction**: 37% token savings

### Latency Reduction

- **Traditional**: 19+ inference passes for 20+ tool calls
- **With PTC**: 1 inference pass (code execution)
- **Reduction**: ~95% latency reduction for multi-tool workflows

### Accuracy Improvements

- Knowledge retrieval: 25.6% → 28.5%
- GIA benchmarks: 46.5% → 51.2%

## Common Use Cases

### Financial Data Analysis

- Expense analysis with hundreds of line items
- Budget compliance checking
- Financial reporting with aggregations

### Multi-Entity Health Checks

- System health monitoring
- Dependency analysis
- Conditional diagnostics

### Database Query Result Aggregation

- Large query results
- Multi-step queries with dependencies
- Result processing and filtering

### Batch API Operations

- Processing multiple items
- Conditional logic based on initial results
- Parallel operations with dependencies

## Troubleshooting

### Code Execution Errors

**Problem**: Code fails to execute

**Solutions**:
- Document return formats clearly
- Ensure tools are marked with `programmatic: true`
- Check tool responses match expected format
- Add error handling in code

### Intermediate Results Still Entering Context

**Problem**: Raw tool outputs appear in context

**Solutions**:
- Verify code processes results before returning
- Ensure only final output is printed/returned
- Use structured JSON output
- Filter irrelevant data in code

### Tools Not Available for PTC

**Problem**: Tools not marked as programmatic

**Solutions**:
- Add `"programmatic": true` to tool configuration
- Ensure `allowedCallers` includes `code_execution_20250825`
- Verify tool is safe for programmatic execution

## References

- [Claude Cookbooks - Programmatic Tool Calling](https://github.com/anthropics/anthropic-cookbook/tree/main/tool_use/programmatic_tool_calling_ptc.ipynb)
- [Advanced Tool Use Guide](./ADVANCED_TOOL_USE.md)
- [Tool Search Skill](../skills/tool-search/SKILL.md)
