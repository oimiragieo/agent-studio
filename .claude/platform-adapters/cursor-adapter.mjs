/**
 * Cursor Platform Adapter
 * Translates workflows and skills for Cursor IDE execution
 * 
 * @module platform-adapters/cursor-adapter
 * @version 1.0.0
 */

import { BasePlatformAdapter } from './base-adapter.mjs';

export class CursorAdapter extends BasePlatformAdapter {
  constructor() {
    super('cursor');
    this.capabilities = {
      native_workflows: false,
      subagents: true,
      plan_mode: true,
      task_tool: false,
      skills: false
    };
    
    this.skillPromptMap = {
      'response-rater': 'Rate this plan on a scale of 1-10 based on completeness, feasibility, risk mitigation, agent coverage, and integration. Provide specific feedback for improvement.',
      'artifact-publisher': 'Publish the generated artifacts to the project feed with proper versioning.',
      'rule-auditor': 'Audit the code for rule compliance against the loaded rule set.',
      'repo-rag': 'Search the codebase for relevant patterns and implementations.',
      'scaffolder': 'Generate rule-compliant boilerplate code following project conventions.',
      'diagram-generator': 'Create architecture and flow diagrams using Mermaid syntax.',
      'test-generator': 'Generate comprehensive test cases for the implementation.',
      'doc-generator': 'Generate technical documentation for the component.',
      'dependency-analyzer': 'Analyze project dependencies for compatibility and security.',
      'sequential-thinking': 'Break down this complex problem step-by-step with explicit reasoning.'
    };
    
    this.agentPromptMap = {
      'architect': 'You are a system architect. Design systems with scalability, security, and maintainability as primary concerns. Use industry best practices.',
      'developer': 'You are a software developer. Write clean, tested, production-ready code following project conventions and best practices.',
      'qa': 'You are a QA engineer. Ensure code quality through comprehensive testing, edge case analysis, and validation.',
      'security-architect': 'You are a security architect. Evaluate security implications, identify vulnerabilities, and recommend secure implementations.',
      'code-reviewer': 'You are a code reviewer. Analyze code quality, identify issues, suggest improvements, and ensure adherence to standards.',
      'planner': 'You are a project planner. Create comprehensive plans with clear steps, dependencies, risks, and success criteria.',
      'analyst': 'You are a technical analyst. Research requirements, analyze patterns, and provide evidence-based recommendations.',
      'pm': 'You are a product manager. Define requirements, prioritize features, and ensure alignment with business objectives.',
      'ux-expert': 'You are a UX expert. Design intuitive interfaces following accessibility and usability best practices.',
      'devops': 'You are a DevOps engineer. Design infrastructure, CI/CD pipelines, and deployment strategies.',
      'technical-writer': 'You are a technical writer. Create clear, comprehensive documentation for developers and users.'
    };
  }
  
  /**
   * Translate workflow step to Cursor format
   * @param {Object} step - Workflow step
   * @returns {Object} Cursor-compatible step
   */
  translateStep(step) {
    const translated = {
      _platform: 'cursor',
      _original_step: step.step,
      name: step.name,
      agent: step.agent
    };
    
    if (step.skill) {
      translated.prompt = this.skillToPrompt(step.skill, step);
      translated._skill_converted = true;
      translated._original_skill = step.skill;
    } else {
      translated.prompt = step.description || step.name;
    }
    
    if (step.outputs) {
      translated.expected_files = step.outputs.map(o => 
        o.replace(/\{\{workflow_id\}\}/g, '${workflow_id}')
         .replace(/\{\{run_id\}\}/g, '${run_id}')
      );
    }
    
    if (step.validation) {
      translated.manual_validation = {
        required: true,
        criteria: step.validation.criteria || [],
        gate: step.validation.gate || null
      };
    }
    
    return translated;
  }
  
  /**
   * Convert skill invocation to natural language prompt
   * @param {string} skill - Skill name
   * @param {Object} step - Step context
   * @returns {string} Natural language prompt
   */
  skillToPrompt(skill, step) {
    const basePrompt = this.skillPromptMap[skill] || `Execute the ${skill} skill functionality`;
    
    if (step.skill_params) {
      return `${basePrompt}\n\nParameters:\n${JSON.stringify(step.skill_params, null, 2)}`;
    }
    
    return basePrompt;
  }
  
  /**
   * Translate workflow to Cursor format with Plan Mode structure
   * @param {Object} workflow - Full workflow definition
   * @returns {Object} Cursor-compatible workflow
   */
  translateWorkflow(workflow) {
    const phases = this.groupStepsIntoPhases(workflow.steps);
    
    return {
      _platform: 'cursor',
      _translated: true,
      name: workflow.name,
      description: workflow.description,
      plan_mode: {
        enabled: true,
        phases: phases
      },
      steps: workflow.steps.map(s => this.translateStep(s)),
      execution_notes: [
        'Use Cursor Composer for multi-file changes',
        'Enable Plan Mode for step-by-step execution',
        'Skills are converted to prompts - review for accuracy',
        'Validation gates require manual verification'
      ]
    };
  }
  
  /**
   * Group workflow steps into logical phases for Plan Mode
   * @param {Array} steps - Workflow steps
   * @returns {Array} Phase groupings
   */
  groupStepsIntoPhases(steps) {
    const phases = [];
    let currentPhase = { name: 'Phase 1: Planning', steps: [], agents: [] };
    
    const phaseBreaks = {
      'architect': 'Architecture',
      'developer': 'Implementation',
      'qa': 'Testing',
      'security-architect': 'Security Review',
      'code-reviewer': 'Code Review'
    };
    
    for (const step of steps) {
      if (phaseBreaks[step.agent] && currentPhase.steps.length > 0) {
        phases.push(currentPhase);
        currentPhase = { 
          name: `Phase ${phases.length + 1}: ${phaseBreaks[step.agent]}`,
          steps: [],
          agents: []
        };
      }
      currentPhase.steps.push(step.step);
      if (!currentPhase.agents.includes(step.agent)) {
        currentPhase.agents.push(step.agent);
      }
    }
    
    if (currentPhase.steps.length > 0) {
      phases.push(currentPhase);
    }
    
    return phases;
  }
  
  /**
   * Get Cursor-specific agent invocation
   * @param {string} agent - Agent name
   * @param {Object} context - Invocation context
   * @returns {Object} Cursor invocation format
   */
  getAgentInvocation(agent, context) {
    const agentPrompt = this.agentPromptMap[agent] || `You are a ${agent}.`;
    
    return {
      mode: 'composer',
      prompt: `${agentPrompt}\n\n${context.prompt}`,
      plan_mode: context.usePlanMode !== false,
      files: context.files || [],
      _agent: agent
    };
  }
  
  /**
   * Get Cursor rules file path for agent
   * @param {string} agent - Agent name
   * @returns {string} Path to cursor rules
   */
  getCursorRulesPath(agent) {
    return `.cursor/rules/${agent}.cursorrules`;
  }
}
