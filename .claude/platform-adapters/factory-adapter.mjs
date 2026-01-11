/**
 * Factory Droid Platform Adapter
 * Translates workflows for Factory Droid execution (limited capability)
 *
 * @module platform-adapters/factory-adapter
 * @version 1.0.0
 */

import { BasePlatformAdapter } from './base-adapter.mjs';

export class FactoryAdapter extends BasePlatformAdapter {
  constructor() {
    super('factory');
    this.capabilities = {
      native_workflows: false,
      subagents: false,
      plan_mode: false,
      task_tool: true,
      skills: false,
    };

    this.agentPromptMap = {
      architect:
        'You are a system architect. Design systems with scalability and maintainability in mind. Follow industry best practices for system design.',
      developer:
        'You are a software developer. Write clean, tested, production-ready code. Follow coding standards and best practices.',
      qa: 'You are a QA engineer. Ensure code quality through comprehensive testing and validation. Identify edge cases and potential issues.',
      'security-architect':
        'You are a security architect. Evaluate and design secure systems. Identify vulnerabilities and recommend mitigations.',
      'code-reviewer':
        'You are a code reviewer. Analyze code quality, identify issues, and suggest improvements.',
      planner:
        'You are a project planner. Create detailed plans with clear steps, dependencies, and success criteria.',
      analyst:
        'You are a technical analyst. Research and analyze requirements. Provide data-driven recommendations.',
      pm: 'You are a product manager. Define requirements and prioritize features based on business value.',
      'ux-expert':
        'You are a UX expert. Design intuitive, accessible interfaces following UX best practices.',
      devops: 'You are a DevOps engineer. Design infrastructure and deployment pipelines.',
      'technical-writer': 'You are a technical writer. Create clear, comprehensive documentation.',
    };
  }

  /**
   * Translate workflow step to Factory Droid format
   * @param {Object} step - Workflow step
   * @returns {Object} Factory-compatible step
   */
  translateStep(step) {
    return {
      _platform: 'factory',
      _original_step: step.step,
      task: {
        name: step.name,
        agent_prompt: this.agentToPrompt(step.agent),
        description: step.description || step.name,
        inputs: step.inputs || [],
        expected_outputs: step.outputs || [],
      },
      execution: {
        mode: 'sequential',
        requires_manual_setup: true,
        checkpoint_after: true,
      },
      _limitations: this.getStepLimitations(step),
    };
  }

  /**
   * Get agent system prompt
   * @param {string} agent - Agent name
   * @returns {string} Agent prompt
   */
  agentToPrompt(agent) {
    return (
      this.agentPromptMap[agent] ||
      `You are a ${agent}. Perform tasks related to ${agent} responsibilities.`
    );
  }

  /**
   * Identify step limitations for Factory Droid
   * @param {Object} step - Workflow step
   * @returns {Array} List of limitations
   */
  getStepLimitations(step) {
    const limitations = [];

    if (step.skill) {
      limitations.push(`Skill "${step.skill}" must be executed manually as a prompt`);
    }
    if (step.parallel) {
      limitations.push('Parallel execution not supported - execute sequentially');
    }
    if (step.validation?.gate) {
      limitations.push('Validation gate must be checked manually');
    }
    if (step.retry) {
      limitations.push('Automatic retry not supported - manual retry required');
    }

    return limitations;
  }

  /**
   * Translate workflow to Factory Droid format
   * @param {Object} workflow - Full workflow definition
   * @returns {Object} Factory-compatible workflow
   */
  translateWorkflow(workflow) {
    const compatibility = this.checkCompatibility(workflow);

    return {
      _platform: 'factory',
      _translated: true,
      _compatibility: compatibility.compatible ? 'partial' : 'limited',
      name: workflow.name,
      description: workflow.description,
      manual_steps: workflow.steps.map(s => this.translateStep(s)),
      execution_guide: {
        mode: 'sequential_manual',
        total_steps: workflow.steps.length,
        estimated_manual_effort: this.estimateManualEffort(workflow),
      },
      compatibility_issues: compatibility.issues,
      adaptation_notes: [
        'Factory Droid requires manual task creation for each step',
        'Skills must be converted to natural language prompts',
        'Subagent functionality not available - single agent per task',
        'Use task_tool for sequential execution',
        'Validation gates require manual verification',
        'No automatic checkpoint restoration',
      ],
      workarounds: {
        skills: 'Convert skill invocations to detailed prompts',
        parallel: 'Execute parallel steps sequentially with manual coordination',
        validation: 'Create manual checklist for validation criteria',
        retry: 'Manually re-run failed steps',
      },
    };
  }

  /**
   * Estimate manual effort for workflow on Factory Droid
   * @param {Object} workflow - Workflow definition
   * @returns {Object} Effort estimate
   */
  estimateManualEffort(workflow) {
    const steps = workflow.steps || [];
    const skillSteps = steps.filter(s => s.skill).length;
    const parallelSteps = steps.filter(s => s.parallel).length;
    const validationSteps = steps.filter(s => s.validation?.gate).length;

    return {
      base_steps: steps.length,
      skill_conversions: skillSteps,
      parallel_serializations: parallelSteps,
      manual_validations: validationSteps,
      overhead_factor: 1.5 + skillSteps * 0.1 + parallelSteps * 0.2,
      recommendation:
        steps.length > 5
          ? 'Consider using Claude Code for complex workflows'
          : 'Feasible with manual coordination',
    };
  }

  /**
   * Get Factory Droid agent invocation
   * @param {string} agent - Agent name
   * @param {Object} context - Invocation context
   * @returns {Object} Factory invocation format
   */
  getAgentInvocation(agent, context) {
    return {
      tool: 'task',
      prompt: `${this.agentToPrompt(agent)}\n\n${context.prompt}`,
      expected_output: context.expectedOutput || 'Task completion confirmation',
      _agent: agent,
      _requires_manual_setup: true,
    };
  }

  /**
   * Generate manual execution checklist
   * @param {Object} workflow - Translated workflow
   * @returns {string} Markdown checklist
   */
  generateExecutionChecklist(workflow) {
    const translated = this.translateWorkflow(workflow);
    let checklist = `# ${workflow.name} - Factory Droid Execution Checklist\n\n`;

    checklist += '## Pre-execution Setup\n';
    checklist += '- [ ] Review workflow requirements\n';
    checklist += '- [ ] Prepare input artifacts\n';
    checklist += '- [ ] Set up output directories\n\n';

    checklist += '## Steps\n';
    for (const step of translated.manual_steps) {
      checklist += `\n### Step ${step._original_step}: ${step.task.name}\n`;
      checklist += `- [ ] Set agent context: ${step.task.agent_prompt.substring(0, 50)}...\n`;
      checklist += `- [ ] Execute task: ${step.task.description}\n`;

      if (step._limitations.length > 0) {
        checklist += `- [ ] Handle limitations:\n`;
        for (const limitation of step._limitations) {
          checklist += `  - [ ] ${limitation}\n`;
        }
      }

      checklist += `- [ ] Verify outputs\n`;
    }

    checklist += '\n## Post-execution\n';
    checklist += '- [ ] Verify all outputs created\n';
    checklist += '- [ ] Run manual validation checks\n';
    checklist += '- [ ] Document any deviations\n';

    return checklist;
  }
}
