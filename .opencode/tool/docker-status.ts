import { tool } from "@opencode-ai/plugin"

/**
 * Get status of Docker containers for Omega
 */
export default tool({
  description: "Get Docker container status for Omega services",
  args: {},
  async execute() {
    try {
      const result = await Bun.$`docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"`.text()
      return result.trim() || "No containers found. Run: npm run docker:up"
    } catch (error) {
      return `Docker error: ${error.message}\n\nTry: npm run docker:up`
    }
  },
})
