/**
 * Claude Code Platform Adapter
 * Native adapter for Claude Code platform with full workflow support
 *
 * @module platform-adapters/claude-adapter
 * @version 1.0.0
 */

import { BasePlatformAdapter } from './base-adapter.mjs';

export class ClaudeAdapter extends BasePlatformAdapter {
  constructor() {
    super('claude');
    this.capabilities = {
      native_workflows: true,
      subagents: true,
      plan_mode: true,
      task_tool: true,
      skills: true,
    };
  }

  /**
   * Translate step to Claude format (native, no translation needed)
   * @param {Object} step - Workflow step
   * @returns {Object} Claude-native step
   */
  translateStep(step) {
    return {
      ...step,
      _platform: 'claude',
      _native: true,
    };
  }

  /**
   * Translate workflow to Claude format (native, minimal translation)
   * @param {Object} workflow - Full workflow definition
   * @returns {Object} Claude-native workflow
   */
  translateWorkflow(workflow) {
    return {
      ...workflow,
      _platform: 'claude',
      _translated: false,
      steps: workflow.steps.map(s => this.translateStep(s)),
    };
  }

  /**
   * Get Claude-native agent invocation using Task tool
   * @param {string} agent - Agent name
   * @param {Object} context - Invocation context
   * @returns {Object} Task tool invocation
   */
  getAgentInvocation(agent, context) {
    return {
      tool: 'Task',
      params: {
        subagent_type: agent,
        prompt: context.prompt,
        description: context.description,
      },
    };
  }

  /**
   * Get skill invocation for Claude
   * @param {string} skill - Skill name
   * @param {Object} params - Skill parameters
   * @returns {Object} Skill invocation
   */
  getSkillInvocation(skill, params) {
    return {
      type: 'skill',
      name: skill,
      params: params,
      _native: true,
    };
  }

  /**
   * Get validation gate invocation
   * @param {Object} gate - Gate configuration
   * @returns {Object} Gate validation command
   */
  getValidationGate(gate) {
    return {
      command: 'node',
      args: [
        '.claude/tools/enforcement-gate.mjs',
        'validate-all',
        '--workflow',
        gate.workflow,
        '--step',
        gate.step.toString(),
      ],
      _native: true,
    };
  }
}
