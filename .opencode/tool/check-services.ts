import { tool } from "@opencode-ai/plugin"

/**
 * Check if Omega services are running on correct ports
 * Critical: Ollama uses 11435 (not 11434), Chroma uses 8001 (not 8000)
 */
export default tool({
  description: "Check if Omega services are running on correct ports",
  args: {},
  async execute() {
    const services = [
      { name: "API Server", port: 5000, url: "http://localhost:5000/api/health" },
      { name: "Frontend", port: 3000, url: "http://localhost:3000" },
      { name: "Ollama", port: 11435, url: "http://localhost:11435/api/tags" },
      { name: "ChromaDB", port: 8001, url: "http://localhost:8001/api/v1/heartbeat" },
    ]

    const results = []
    
    for (const service of services) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)
        
        const response = await fetch(service.url, { 
          signal: controller.signal,
          method: "GET"
        })
        clearTimeout(timeout)
        
        results.push(`✓ ${service.name} (port ${service.port}): Running`)
      } catch (error) {
        results.push(`✗ ${service.name} (port ${service.port}): Not responding`)
      }
    }

    return results.join("\n")
  },
})
