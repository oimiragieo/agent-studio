import { tool } from "@opencode-ai/plugin"

/**
 * Run tests with optional path filter
 */
export const run = tool({
  description: "Run Jest tests with optional file path",
  args: {
    path: tool.schema.string().optional().describe("Test file path or pattern"),
    coverage: tool.schema.boolean().optional().describe("Include coverage report"),
  },
  async execute(args) {
    const cmd = args.coverage 
      ? `npm run test:coverage${args.path ? ` -- ${args.path}` : ""}`
      : `npm test${args.path ? ` -- ${args.path}` : ""}`
    
    try {
      const result = await Bun.$`${cmd}`.text()
      return result
    } catch (error) {
      return `Test execution failed:\n${error.message}`
    }
  },
})

/**
 * Run integration tests
 */
export const integration = tool({
  description: "Run integration test suite",
  args: {},
  async execute() {
    try {
      const result = await Bun.$`npm run test:integration`.text()
      return result
    } catch (error) {
      return `Integration tests failed:\n${error.message}`
    }
  },
})
