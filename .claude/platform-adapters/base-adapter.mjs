/**
 * Base Platform Adapter
 * Abstract class for platform-specific workflow translation
 * 
 * @module platform-adapters/base-adapter
 * @version 1.0.0
 */

export class BasePlatformAdapter {
  /**
   * Create a new platform adapter
   * @param {string} platform - Platform identifier (claude, cursor, factory)
   */
  constructor(platform) {
    this.platform = platform;
    this.capabilities = {
      native_workflows: false,
      subagents: false,
      plan_mode: false,
      task_tool: false,
      skills: false
    };
  }
  
  /**
   * Translate a workflow step to platform-specific format
   * @param {Object} step - Workflow step definition
   * @returns {Object} Platform-specific step
   * @throws {Error} Must be implemented by subclass
   */
  translateStep(step) {
    throw new Error('translateStep must be implemented by subclass');
  }
  
  /**
   * Translate entire workflow to platform format
   * @param {Object} workflow - Full workflow definition
   * @returns {Object} Platform-specific workflow
   * @throws {Error} Must be implemented by subclass
   */
  translateWorkflow(workflow) {
    throw new Error('translateWorkflow must be implemented by subclass');
  }
  
  /**
   * Get platform-specific agent invocation
   * @param {string} agent - Agent name
   * @param {Object} context - Invocation context
   * @returns {string|Object} Platform command or prompt
   * @throws {Error} Must be implemented by subclass
   */
  getAgentInvocation(agent, context) {
    throw new Error('getAgentInvocation must be implemented by subclass');
  }
  
  /**
   * Check if workflow is compatible with platform
   * @param {Object} workflow - Workflow to check
   * @returns {{ compatible: boolean, issues: string[] }}
   */
  checkCompatibility(workflow) {
    const issues = [];
    
    for (const step of workflow.steps || []) {
      if (step.skill && !this.capabilities.skills) {
        issues.push(`Step ${step.step}: Skills not supported on ${this.platform}`);
      }
      if (step.parallel && !this.capabilities.subagents) {
        issues.push(`Step ${step.step}: Parallel execution not supported on ${this.platform}`);
      }
      if (step.validation?.gate && !this.capabilities.native_workflows) {
        issues.push(`Step ${step.step}: Validation gates require native workflow support`);
      }
    }
    
    return {
      compatible: issues.length === 0,
      issues
    };
  }
  
  /**
   * Get platform capabilities summary
   * @returns {Object} Capabilities object
   */
  getCapabilities() {
    return { ...this.capabilities };
  }
  
  /**
   * Get platform identifier
   * @returns {string} Platform name
   */
  getPlatform() {
    return this.platform;
  }
}
