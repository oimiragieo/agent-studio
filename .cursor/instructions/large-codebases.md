# Large Codebase Optimization Guide

Guidelines for working with large codebases in Cursor, adapted from [Cursor Large Codebases Cookbook](https://cursor.com/docs/cookbook/large-codebases).

## Codebase Indexing Strategy

### Configuration
- Ensure `.cursorignore` excludes unnecessary files (node_modules, dist, build)
- Configure max file size in `.cursor/settings.json`
- Use stack profiles to load only relevant rules

### Indexing Best Practices
- Exclude generated files and build outputs
- Include only source code and critical configs
- Use manifest-based rule loading for performance
- Limit indexing to active project areas

## Context Management

### For Agents
- Reference specific file paths instead of "the codebase"
- Use symbols navigation for large codebases
- Focus on relevant subdirectories
- Leverage codebase search with specific queries

### For Composer
- Work on small, focused changes
- One file or small component at a time
- Use Plan Mode to coordinate larger changes
- Avoid loading entire codebase into context

## Working with Monorepos

### Structure Awareness
- Specify package/workspace in agent prompts
- Use workspace-specific rules
- Isolate changes to specific packages
- Reference cross-package dependencies explicitly

### Multi-Package Workflows
- Create separate plans per package
- Coordinate via handoff artifacts
- Use Cloud Agents for parallel package work
- Document package dependencies in plans

## Performance Optimization

### Indexing Performance
- Exclude test fixtures and large data files
- Limit indexing depth for deep hierarchies
- Use selective indexing for large repos
- Monitor indexing performance in settings

### Agent Performance
- Keep agent prompts focused and specific
- Use Plan Mode to break down large tasks
- Leverage codebase search strategically
- Avoid loading entire codebase unnecessarily

## Best Practices

1. **Be Specific**: Reference exact file paths, not "the codebase"
2. **Use Symbols**: Leverage language server symbols for navigation
3. **Break Down**: Split large tasks into smaller, focused changes
4. **Plan First**: Always use Plan Mode for multi-file changes
5. **Isolate Work**: Focus on specific areas, not entire codebase

## Tools and Features

- **Codebase Indexing**: Configured in `.cursor/settings.json`
- **Symbols**: Language server integration for navigation
- **Search**: Targeted codebase searches with specific queries
- **Plan Mode**: Essential for coordinating large changes
- **Composer**: Fast iterations on focused areas

