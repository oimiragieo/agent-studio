---
name: pdf-generator
description: Generate formatted PDF documents with text, tables, and images. Use for reports, documentation, and formal documents.
context:fork: true
model: sonnet
allowed-tools: read, write, memory
version: 1.0
best_practices:
  - Use structured content
  - Include tables and formatting
  - Apply consistent styling
  - Organize content logically
error_handling: graceful
streaming: supported
---

# PDF Generator Skill

## Identity

PDF Generator - Creates formatted PDF documents with text, tables, and images using Claude's built-in `pdf` skill.

## Capabilities

- **Document Creation**: Generate formatted PDF documents
- **Text Formatting**: Rich text with formatting
- **Tables**: Create structured tables
- **Images**: Include images and graphics
- **Professional Layout**: Professional document structure

## Usage

### Basic PDF Generation

**When to Use**:
- Formal reports
- Documentation
- Technical specifications
- Business documents
- Legal documents

**How to Invoke**:
```
"Generate a PDF report summarizing the project"
"Create a technical documentation PDF"
"Generate a formal business document"
```

**What It Does**:
- Uses Claude's built-in `pdf` skill (skill_id: `pdf`)
- Creates PDF documents with formatting
- Includes tables, images, and structured content
- Returns file_id for download

### Advanced Features

**Document Structure**:
- Title page
- Table of contents
- Sections and subsections
- Appendices

**Content Types**:
- Text with formatting
- Tables and data
- Images and graphics
- Charts and diagrams

**Formatting**:
- Professional styling
- Consistent formatting
- Brand guidelines
- Visual hierarchy

## Best Practices

### Document Structure

**Recommended Approach**:
- **Clear organization**: Logical sections and flow
- **Structured content**: Use headings and subheadings
- **Visual elements**: Tables, charts, images
- **Professional polish**: Consistent formatting

**For Complex Documents**:
1. **Plan structure**: Outline before generation
2. **Use templates**: Consistent formatting
3. **Include metadata**: Title, author, date
4. **Professional quality**: High-quality output

### Performance Tips

- **PDF generation**: Very reliable for complex content
- **Structured data**: More efficient than prose
- **Batch operations**: Process multiple documents
- **Template reuse**: Use consistent templates

## Integration

### With Other Document Generators

PDF can combine content from:
- Excel data and charts
- PowerPoint slides
- Text documents
- Images and graphics

### With Artifact Publisher

PDF files can be published as artifacts:
- Save to `.claude/context/runs/{run-id}/artifacts/` (use `path-resolver.mjs` to resolve paths)
- Register in artifact registry via `run-manager.mjs`
- Reference in workflow outputs

### With Workflows

PDF generation integrates with workflows:
- Documentation workflows
- Reporting workflows
- Publication workflows

## Examples

### Example 1: Technical Report

```
User: "Generate a PDF report summarizing the project"

PDF Generator:
1. Creates PDF document with:
   - Title page
   - Executive summary
   - Technical details
   - Results and analysis
   - Conclusions
2. Includes tables and charts
3. Applies professional formatting
4. Returns file_id for download
```

### Example 2: Documentation

```
User: "Create a technical documentation PDF"

PDF Generator:
1. Creates documentation PDF
2. Includes code examples
3. Structures content logically
4. Adds table of contents
```

### Example 3: Business Document

```
User: "Generate a formal business document"

PDF Generator:
1. Creates formal document
2. Includes required sections
3. Applies business formatting
4. Adds signatures and metadata
```

## Technical Details

### API Usage

Uses Claude's beta Skills API:
```python
response = client.beta.messages.create(
    model="claude-sonnet-4-5",
    container={"type": "skills", "skills": [{"type": "anthropic", "skill_id": "pdf", "version": "latest"}]},
    messages=[{"role": "user", "content": "Create PDF document..."}]
)
```

### File Download

Files are returned as `file_id`:
```python
file_id = response.content[0].file_id
file_content = client.beta.files.content(file_id)
```

## Related Skills

- **excel-generator**: Create data for PDFs
- **powerpoint-generator**: Convert slides to PDF
- **artifact-publisher**: Publish PDFs as artifacts

## Related Documentation

- [Document Generation Guide](../docs/DOCUMENT_GENERATION.md) - Comprehensive guide
- [Skills Cookbook](https://github.com/anthropics/anthropic-cookbook/tree/main/skills) - Reference implementation

