# Generate Docs

Automatically generates documentation from code, APIs, and specifications.

## Usage

`/generate-docs [module] [--type api|user|developer]`

## Examples

- `/generate-docs src/api/` - Generate API documentation
- `/generate-docs --type user` - Generate user guide
- `/generate-docs src/components/ --type developer` - Generate developer docs

## What It Does

1. Analyzes code structure and comments
2. Extracts API signatures, parameters, return types
3. Generates comprehensive documentation:
   - Function/class descriptions
   - Parameter explanations
   - Usage examples
   - Code snippets
4. Follows project documentation standards

## Documentation Types

- **api** - API reference with endpoints, parameters, responses
- **user** - User-facing guides and tutorials
- **developer** - Technical documentation for contributors

## Output Formats

- Markdown (default)
- OpenAPI/Swagger (for API docs)
- JSDoc comments (inline)

## Related Skills

- api-contract-generator - Generate OpenAPI schemas
- test-generator - Generate test code
- diagram-generator - Generate architecture diagrams
