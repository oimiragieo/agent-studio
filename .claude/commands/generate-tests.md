# Generate Tests

Automatically generates test code for components, functions, or API endpoints.

## Usage

`/generate-tests [file] [--type unit|integration|e2e]`

## Examples

- `/generate-tests src/components/Button.tsx` - Generate tests for component
- `/generate-tests src/api/users.ts --type integration` - Generate integration tests
- `/generate-tests` - Generate tests for recently modified files

## What It Does

1. Analyzes the target code
2. Identifies testable units (functions, components, endpoints)
3. Generates test cases covering:
   - Happy path scenarios
   - Edge cases
   - Error conditions
   - Boundary values
4. Follows project testing patterns

## Test Types

- **unit** - Isolated function/component tests
- **integration** - Multiple component interactions
- **e2e** - End-to-end user flow tests

## Output

Creates test files following project conventions:

- React: `ComponentName.test.tsx`
- Node: `functionName.test.js`
- API: `endpoint.integration.test.js`

## Related Skills

- scaffolder - Generate boilerplate code
- doc-generator - Generate documentation
