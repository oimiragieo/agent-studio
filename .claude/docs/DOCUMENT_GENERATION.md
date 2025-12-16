# Document Generation Guide

## Overview

Comprehensive guide to generating professional documents (Excel, PowerPoint, PDF) using Claude's Skills feature. Based on patterns from Claude Cookbooks.

## What are Skills?

Skills are organized packages of instructions, executable code, and resources that give Claude specialized capabilities for specific tasks. Think of them as "expertise packages" that Claude can discover and load dynamically.

## Built-in Skills

Claude comes with these pre-built document generation skills:

| Skill      | ID     | Description                                                                 |
| ---------- | ------ | --------------------------------------------------------------------------- |
| Excel      | `xlsx` | Create and manipulate Excel workbooks with formulas, charts, and formatting |
| PowerPoint | `pptx` | Generate professional presentations with slides, charts, and transitions    |
| PDF        | `pdf`  | Create formatted PDF documents with text, tables, and images                |
| Word       | `docx` | Generate Word documents with rich formatting and structure                  |

## Excel Generation

### Capabilities

- **Workbook Creation**: Multi-sheet workbooks
- **Formulas**: Complex calculations and formulas
- **Charts**: Visualizations and graphs
- **Formatting**: Professional styling
- **Data Analysis**: Pivot tables and analysis

### Best Practices

**Workbook Structure**:
- **2-3 sheets per workbook** - Optimal performance
- **Focus each sheet** on a specific purpose
- **Add complexity incrementally** - Start simple, then enhance

**For Complex Dashboards**:
1. Create multiple focused files instead of one complex file
2. Use the pipeline pattern to create and enhance files sequentially
3. Combine files programmatically if needed

**Performance**:
- Simple 2-sheet dashboards: ~1-2 minutes
- Structured data (JSON/CSV): More efficient than prose
- Batch operations: Process multiple files in a single conversation

### Usage

```python
response = client.beta.messages.create(
    model="claude-sonnet-4-5",
    container={
        "type": "skills",
        "skills": [{"type": "anthropic", "skill_id": "xlsx", "version": "latest"}]
    },
    messages=[{
        "role": "user",
        "content": "Create an Excel workbook with Q4 financial data including P&L, balance sheet, and cash flow statements with formulas and charts."
    }]
)

# Extract file_id from response
file_id = response.content[0].file_id
file_content = client.beta.files.content(file_id)
```

## PowerPoint Generation

### Capabilities

- **Presentation Creation**: Multi-slide presentations
- **Charts**: Data visualizations
- **Formatting**: Professional templates
- **Transitions**: Slide transitions and animations
- **Content Organization**: Logical structure

### Best Practices

**Presentation Structure**:
- Clear slide structure: Title, content, summary
- Visual focus: Use charts and diagrams
- Consistent formatting: Apply templates
- Concise content: Keep slides focused

**For Complex Presentations**:
1. Create from data: Use Excel data as source
2. Visualize key insights: Focus on important metrics
3. Tell a story: Logical flow and narrative
4. Professional polish: Consistent formatting

**Performance**:
- PowerPoint generation: Very reliable for complex content
- Chart integration: Works well with Excel data
- Batch operations: Process multiple presentations

### Usage

```python
response = client.beta.messages.create(
    model="claude-sonnet-4-5",
    container={
        "type": "skills",
        "skills": [{"type": "anthropic", "skill_id": "pptx", "version": "latest"}]
    },
    messages=[{
        "role": "user",
        "content": "Create a PowerPoint presentation for Q4 results with executive summary, financial highlights, key metrics, and trends."
    }]
)
```

## PDF Generation

### Capabilities

- **Document Creation**: Formatted PDF documents
- **Text Formatting**: Rich text with formatting
- **Tables**: Structured tables
- **Images**: Graphics and images
- **Professional Layout**: Document structure

### Best Practices

**Document Structure**:
- Clear organization: Logical sections and flow
- Structured content: Use headings and subheadings
- Visual elements: Tables, charts, images
- Professional polish: Consistent formatting

**For Complex Documents**:
1. Plan structure: Outline before generation
2. Use templates: Consistent formatting
3. Include metadata: Title, author, date
4. Professional quality: High-quality output

**Performance**:
- PDF generation: Very reliable for complex content
- Structured data: More efficient than prose
- Batch operations: Process multiple documents

### Usage

```python
response = client.beta.messages.create(
    model="claude-sonnet-4-5",
    container={
        "type": "skills",
        "skills": [{"type": "anthropic", "skill_id": "pdf", "version": "latest"}]
    },
    messages=[{
        "role": "user",
        "content": "Create a PDF report summarizing the project with executive summary, technical details, results, and conclusions."
    }]
)
```

## Integration with Workflows

### Artifact Publishing

Document generation integrates with artifact publishing:
- Save files to `.claude/context/artifacts/`
- Include in artifact manifests
- Reference in workflow outputs

### Pipeline Pattern

Create documents in sequence:
1. Generate Excel with data
2. Create PowerPoint from Excel data
3. Generate PDF summary
4. Publish all as artifacts

## Common Use Cases

### Financial Reporting

- Automated quarterly reports
- Budget variance analysis
- Investment performance dashboards
- Financial statements

### Data Analysis

- Excel-based analytics with complex formulas
- Pivot table generation
- Statistical analysis and visualization
- Dashboard creation

### Document Automation

- Branded presentation generation
- Report compilation from multiple sources
- Cross-format document conversion
- Template-based generation

## Technical Requirements

### Beta API

All Skills functionality uses `client.beta.*` namespace:
- Required beta headers: `code-execution-2025-08-25`, `files-api-2025-04-14`, `skills-2025-10-02`
- Must use `client.beta.messages.create()` with `container` parameter
- Code execution tool (`code_execution_20250825`) is REQUIRED

### Files API

Skills generate files and return `file_id` attributes:
- Use `client.beta.files.download()` to download files
- Use `client.beta.files.retrieve_metadata()` to get file info
- Files are overwritten by default (rerunning replaces existing files)

## Performance Tips

1. **Use Progressive Disclosure**: Skills load in stages to minimize token usage
2. **Batch Operations**: Process multiple files in a single conversation
3. **Skill Composition**: Combine multiple skills for complex workflows
4. **Cache Reuse**: Use container IDs to reuse loaded skills

## Troubleshooting

### Files Not Generated

- Check beta headers are set correctly
- Verify skill_id is correct (`xlsx`, `pptx`, `pdf`)
- Ensure code execution tool is available
- Check API key has beta access

### Poor Quality Output

- Provide clear, structured instructions
- Use structured data (JSON/CSV) when possible
- Break complex documents into smaller parts
- Iterate and refine

### Performance Issues

- Reduce complexity (fewer sheets/slides)
- Use structured data instead of prose
- Batch operations efficiently
- Cache and reuse containers

## Related Skills

- **excel-generator**: Excel workbook generation
- **powerpoint-generator**: PowerPoint presentation generation
- **pdf-generator**: PDF document generation
- **artifact-publisher**: Artifact publishing workflow

## Related Documentation

- [Skills Cookbook](https://github.com/anthropics/anthropic-cookbook/tree/main/skills) - Reference implementation
- [Claude Skills Documentation](https://docs.claude.com/en/docs/agents-and-tools/skills)

