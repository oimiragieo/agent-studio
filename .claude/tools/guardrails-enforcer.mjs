#!/usr/bin/env node
/**
 * Guardrails Enforcer
 * Implements Claude guardrails for latency, hallucinations, consistency, and jailbreak mitigation
 * Based on: https://docs.claude.com/en/docs/test-and-evaluate/strengthen-guardrails/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Guardrail patterns
const GUARDRAILS = {
  // Reduce latency: Block long-running operations
  latency: {
    maxToolExecutionTime: 30000, // 30 seconds
    maxResponseLength: 10000, // 10k characters
    blockedCommands: [
      /npm\s+install/,
      /npm\s+run\s+dev/,
      /docker\s+build/,
      /npm\s+run\s+build/
    ]
  },
  
  // Reduce hallucinations: Require verification
  hallucinations: {
    requireSourceCitation: true,
    blockedPatterns: [
      /I\s+think/,
      /probably/,
      /might\s+be/,
      /could\s+be/
    ],
    requireVerification: [
      'API endpoints',
      'library versions',
      'configuration values',
      'command syntax'
    ]
  },
  
  // Increase consistency: Enforce patterns
  consistency: {
    requireTemplates: true,
    enforceNaming: true,
    requireTests: true
  },
  
  // Mitigate jailbreaks: Block suspicious patterns
  jailbreaks: {
    blockedPatterns: [
      /ignore\s+previous\s+instructions/i,
      /forget\s+all\s+rules/i,
      /act\s+as\s+if/i,
      /pretend\s+you\s+are/i,
      /system\s+override/i
    ],
    suspiciousKeywords: [
      'bypass',
      'override',
      'ignore',
      'forget',
      'pretend'
    ]
  },
  
  // Handle streaming refusals
  streaming: {
    checkRefusals: true,
    maxRetries: 3
  },
  
  // Reduce prompt leak
  promptLeak: {
    blockPatterns: [
      /system\s+prompt/i,
      /instructions\s+are/i,
      /you\s+are\s+an\s+ai/i
    ]
  },
  
  // Keep Claude in character
  character: {
    enforcePersona: true,
    validateResponses: true,
    blockedPersonaChanges: [
      /act as/i,
      /pretend you are/i,
      /you are now/i
    ]
  }
};

/**
 * Check latency guardrails
 */
export function checkLatency(command, responseLength) {
  const latency = GUARDRAILS.latency;
  
  // Check response length
  if (responseLength > latency.maxResponseLength) {
    return {
      passed: false,
      reason: `Response length ${responseLength} exceeds maximum ${latency.maxResponseLength}`
    };
  }
  
  // Check blocked commands
  for (const pattern of latency.blockedCommands) {
    if (pattern.test(command)) {
      return {
        passed: false,
        reason: `Command matches blocked pattern: ${pattern}`
      };
    }
  }
  
  return { passed: true };
}

/**
 * Check hallucination guardrails
 */
export function checkHallucinations(text, requireVerification = false) {
  const hallucinations = GUARDRAILS.hallucinations;
  
  // Check for uncertain language
  for (const pattern of hallucinations.blockedPatterns) {
    if (pattern.test(text)) {
      return {
        passed: false,
        reason: `Text contains uncertain language: ${pattern}`,
        suggestion: 'Use definitive statements with citations'
      };
    }
  }
  
  // Check if verification is required
  if (requireVerification && hallucinations.requireSourceCitation) {
    const hasCitation = /\[.*?\]|\(.*?\)|source:|reference:/i.test(text);
    if (!hasCitation) {
      return {
        passed: false,
        reason: 'Source citation required but not found',
        suggestion: 'Add citations for claims'
      };
    }
  }
  
  return { passed: true };
}

/**
 * Check consistency guardrails
 */
export function checkConsistency(code, options = {}) {
  const consistency = GUARDRAILS.consistency;
  
  const issues = [];
  
  // Check naming conventions
  if (consistency.enforceNaming && options.namingPattern) {
    // Would implement actual naming validation
  }
  
  // Check for templates
  if (consistency.requireTemplates && options.template) {
    // Would check if code follows template
  }
  
  // Check for tests
  if (consistency.requireTests && options.requireTests) {
    // Would check if tests exist
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

/**
 * Check jailbreak guardrails
 */
export function checkJailbreaks(prompt) {
  const jailbreaks = GUARDRAILS.jailbreaks;
  
  // Check blocked patterns
  for (const pattern of jailbreaks.blockedPatterns) {
    if (pattern.test(prompt)) {
      return {
        passed: false,
        reason: `Jailbreak pattern detected: ${pattern}`,
        severity: 'high'
      };
    }
  }
  
  // Check suspicious keywords
  const suspiciousCount = jailbreaks.suspiciousKeywords.filter(keyword =>
    new RegExp(`\\b${keyword}\\b`, 'i').test(prompt)
  ).length;
  
  if (suspiciousCount > 2) {
    return {
      passed: false,
      reason: `Multiple suspicious keywords detected (${suspiciousCount})`,
      severity: 'medium'
    };
  }
  
  return { passed: true };
}

/**
 * Handle streaming refusals (official pattern)
 */
export function handleStreamingRefusals(stream, maxRetries = 3, fallbackStrategy = 'simplify_request') {
  const streaming = GUARDRAILS.streaming;
  
  let retryCount = 0;
  const refusalPatterns = [
    /I\s+cannot/i,
    /I\s+cannot\s+help/i,
    /I'm\s+not\s+able/i,
    /I\s+don't\s+have/i,
    /I\s+can't\s+assist/i
  ];
  
  return {
    check: async (chunk) => {
      const isRefusal = refusalPatterns.some(pattern => pattern.test(chunk));
      
      if (isRefusal) {
        if (retryCount < (maxRetries || streaming.maxRetries)) {
          retryCount++;
          return { 
            shouldRetry: true, 
            retryCount,
            strategy: fallbackStrategy,
            suggestion: 'Simplify request or break into smaller steps'
          };
        }
        return { 
          shouldRetry: false, 
          reason: 'Max retries exceeded',
          suggestion: 'Request may be too complex or outside capabilities'
        };
      }
      return { shouldRetry: false };
    },
    simplify: (request) => {
      // Simplify request by breaking into smaller parts
      return {
        original: request,
        simplified: request.split('.').slice(0, 2).join('.') + '.',
        strategy: 'break_into_steps'
      };
    }
  };
}

/**
 * Check prompt leak guardrails
 */
export function checkPromptLeak(output) {
  const promptLeak = GUARDRAILS.promptLeak;
  
  for (const pattern of promptLeak.blockPatterns) {
    if (pattern.test(output)) {
      return {
        passed: false,
        reason: `Potential prompt leak detected: ${pattern}`,
        action: 'sanitize'
      };
    }
  }
  
  return { passed: true };
}

/**
 * Check character enforcement (official pattern)
 */
export function checkCharacter(response, expectedPersona) {
  const character = GUARDRAILS.character;
  
  if (!character.enforcePersona) {
    return { passed: true };
  }
  
  const issues = [];
  
  // Check for persona changes
  for (const pattern of character.blockedPersonaChanges) {
    if (pattern.test(response)) {
      issues.push({
        type: 'character',
        severity: 'error',
        message: `Persona change attempt detected: ${pattern}`,
        action: 'reject'
      });
    }
  }
  
  // Validate response alignment with expected persona
  if (character.validateResponses && expectedPersona) {
    // Check if response maintains persona characteristics
    const personaKeywords = expectedPersona.toLowerCase().split(/\s+/);
    const responseLower = response.toLowerCase();
    const personaMatch = personaKeywords.some(keyword => 
      keyword.length > 3 && responseLower.includes(keyword)
    );
    
    if (!personaMatch && response.length > 100) {
      issues.push({
        type: 'character',
        severity: 'warning',
        message: 'Response may not align with expected persona',
        suggestion: 'Ensure response maintains agent character'
      });
    }
  }
  
  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues
  };
}

/**
 * Main guardrail checker (official SDK pattern)
 * Note: Full implementation would use: import { Guardrails } from '@anthropic-ai/sdk';
 */
export function checkGuardrails(type, input, options = {}) {
  switch (type) {
    case 'latency':
      return checkLatency(input.command, input.responseLength);
    case 'hallucinations':
      return checkHallucinations(input.text, options.requireVerification);
    case 'consistency':
      return checkConsistency(input.code, options);
    case 'jailbreaks':
      return checkJailbreaks(input.prompt);
    case 'streaming_refusals':
      return handleStreamingRefusals(input.stream, options.maxRetries, options.fallbackStrategy);
    case 'prompt_leak':
      return checkPromptLeak(input.output);
    case 'character':
      return checkCharacter(input.response, options.expectedPersona);
    default:
      throw new Error(`Unknown guardrail type: ${type}`);
  }
}

/**
 * Create SDK Guardrails instance
 * Note: Full implementation would use SDK Guardrails class
 */
export function createSDKGuardrails(config = {}) {
  // In production, this would use SDK Guardrails class:
  // return new Guardrails({
  //   reduce_latency: {
  //     max_tool_execution_time: config.maxToolExecutionTime || 30000,
  //     timeout_handling: config.timeoutHandling || 'fail_fast'
  //   },
  //   reduce_hallucinations: {
  //     require_citations: config.requireCitations !== false,
  //     validate_claims: config.validateClaims !== false
  //   },
  //   increase_consistency: {
  //     enforce_templates: config.enforceTemplates !== false,
  //     validate_outputs: config.validateOutputs !== false
  //   },
  //   mitigate_jailbreaks: {
  //     detect_patterns: true,
  //     block_suspicious: true
  //   },
  //   handle_streaming_refusals: {
  //     max_retries: config.maxRetries || 3,
  //     fallback_strategy: config.fallbackStrategy || 'simplify_request'
  //   },
  //   reduce_prompt_leak: {
  //     sanitize_outputs: true,
  //     detect_leaks: true
  //   },
  //   keep_in_character: {
  //     enforce_persona: true,
  //     validate_responses: true
  //   }
  // });

  // For now, return guardrails configuration
  return {
    reduce_latency: {
      max_tool_execution_time: config.maxToolExecutionTime || GUARDRAILS.latency.maxToolExecutionTime,
      timeout_handling: config.timeoutHandling || 'fail_fast',
      max_response_length: config.maxResponseLength || GUARDRAILS.latency.maxResponseLength
    },
    reduce_hallucinations: {
      require_citations: config.requireCitations !== false,
      validate_claims: config.validateClaims !== false,
      blocked_patterns: GUARDRAILS.hallucinations.blockedPatterns
    },
    increase_consistency: {
      enforce_templates: config.enforceTemplates !== false,
      validate_outputs: config.validateOutputs !== false,
      require_tests: GUARDRAILS.consistency.requireTests
    },
    mitigate_jailbreaks: {
      detect_patterns: true,
      block_suspicious: true,
      blocked_patterns: GUARDRAILS.jailbreaks.blockedPatterns
    },
    handle_streaming_refusals: {
      max_retries: config.maxRetries || GUARDRAILS.streaming.maxRetries,
      fallback_strategy: config.fallbackStrategy || 'simplify_request',
      check_refusals: GUARDRAILS.streaming.checkRefusals
    },
    reduce_prompt_leak: {
      sanitize_outputs: true,
      detect_leaks: true,
      block_patterns: GUARDRAILS.promptLeak.blockPatterns
    },
    keep_in_character: {
      enforce_persona: GUARDRAILS.character.enforcePersona,
      validate_responses: GUARDRAILS.character.validateResponses,
      blocked_persona_changes: GUARDRAILS.character.blockedPersonaChanges
    }
  };
}

/**
 * Check if a command should be blocked (latency guardrail)
 */
export function checkLatencyGuardrail(command, context = {}) {
  const issues = [];
  
  // Check execution time estimate
  if (context.estimatedTime && context.estimatedTime > GUARDRAILS.latency.maxToolExecutionTime) {
    issues.push({
      type: 'latency',
      severity: 'warning',
      message: `Command may take longer than ${GUARDRAILS.latency.maxToolExecutionTime}ms`,
      suggestion: 'Consider running in background or breaking into smaller steps'
    });
  }
  
  // Check blocked commands
  for (const pattern of GUARDRAILS.latency.blockedCommands) {
    if (pattern.test(command)) {
      issues.push({
        type: 'latency',
        severity: 'error',
        message: 'Command is blocked to reduce latency',
        command: command,
        suggestion: 'Use alternative approach or run manually'
      });
    }
  }
  
  return {
    allowed: issues.filter(i => i.severity === 'error').length === 0,
    issues
  };
}

/**
 * Check for potential hallucinations
 */
export function checkHallucinationGuardrail(content, context = {}) {
  const issues = [];
  
  if (!GUARDRAILS.hallucinations.requireSourceCitation) {
    return { allowed: true, issues: [] };
  }
  
  // Check for unverified claims
  for (const pattern of GUARDRAILS.hallucinations.blockedPatterns) {
    if (pattern.test(content)) {
      issues.push({
        type: 'hallucination',
        severity: 'warning',
        message: 'Uncertain language detected',
        pattern: pattern.toString(),
        suggestion: 'Verify information and cite sources'
      });
    }
  }
  
  // Check for unverified technical claims
  const requiresVerification = GUARDRAILS.hallucinations.requireVerification.some(
    topic => content.toLowerCase().includes(topic.toLowerCase())
  );
  
  if (requiresVerification && !context.hasSource) {
    issues.push({
      type: 'hallucination',
      severity: 'warning',
      message: 'Technical claim requires source verification',
      suggestion: 'Cite documentation or code reference'
    });
  }
  
  return {
    allowed: true, // Warnings don't block
    issues
  };
}

/**
 * Check for jailbreak attempts
 */
export function checkJailbreakGuardrail(prompt) {
  const issues = [];
  
  // Check blocked patterns
  for (const pattern of GUARDRAILS.jailbreaks.blockedPatterns) {
    if (pattern.test(prompt)) {
      issues.push({
        type: 'jailbreak',
        severity: 'error',
        message: 'Potential jailbreak attempt detected',
        pattern: pattern.toString(),
        action: 'blocked'
      });
    }
  }
  
  // Check suspicious keywords
  const suspiciousCount = GUARDRAILS.jailbreaks.suspiciousKeywords.filter(
    keyword => prompt.toLowerCase().includes(keyword.toLowerCase())
  ).length;
  
  if (suspiciousCount >= 2) {
    issues.push({
      type: 'jailbreak',
      severity: 'warning',
      message: 'Multiple suspicious keywords detected',
      keywords: suspiciousCount,
      suggestion: 'Review prompt for potential manipulation'
    });
  }
  
  return {
    allowed: issues.filter(i => i.severity === 'error').length === 0,
    issues
  };
}

/**
 * Check for prompt leak
 */
export function checkPromptLeakGuardrail(content) {
  const issues = [];
  
  for (const pattern of GUARDRAILS.promptLeak.blockedPatterns) {
    if (pattern.test(content)) {
      issues.push({
        type: 'prompt_leak',
        severity: 'warning',
        message: 'Potential prompt leak detected',
        pattern: pattern.toString(),
        suggestion: 'Review content for sensitive information'
      });
    }
  }
  
  return {
    allowed: true, // Warnings don't block
    issues
  };
}

/**
 * Validate consistency
 */
export function checkConsistencyGuardrail(code, template = null) {
  const issues = [];
  
  if (GUARDRAILS.consistency.requireTemplates && template) {
    // Check if code follows template structure
    // This is a simplified check - implement full AST comparison if needed
    if (!code.includes(template.keyPattern)) {
      issues.push({
        type: 'consistency',
        severity: 'warning',
        message: 'Code may not follow project template',
        suggestion: 'Use scaffolder skill to generate compliant code'
      });
    }
  }
  
  return {
    allowed: true,
    issues
  };
}

/**
 * Comprehensive guardrail check
 */
export function checkAllGuardrails(prompt, command = null, context = {}) {
  const results = {
    allowed: true,
    issues: [],
    checks: {}
  };
  
  // Check jailbreak
  const jailbreakCheck = checkJailbreakGuardrail(prompt);
  results.checks.jailbreak = jailbreakCheck;
  if (!jailbreakCheck.allowed) {
    results.allowed = false;
  }
  results.issues.push(...jailbreakCheck.issues);
  
  // Check prompt leak
  const leakCheck = checkPromptLeakGuardrail(prompt);
  results.checks.promptLeak = leakCheck;
  results.issues.push(...leakCheck.issues);
  
  // Check latency (if command provided)
  if (command) {
    const latencyCheck = checkLatencyGuardrail(command, context);
    results.checks.latency = latencyCheck;
    if (!latencyCheck.allowed) {
      results.allowed = false;
    }
    results.issues.push(...latencyCheck.issues);
  }
  
  // Check hallucinations
  const hallucinationCheck = checkHallucinationGuardrail(prompt, context);
  results.checks.hallucination = hallucinationCheck;
  results.issues.push(...hallucinationCheck.issues);
  
  // Check character (if persona provided)
  if (context.expectedPersona) {
    const characterCheck = checkCharacter(prompt, context.expectedPersona);
    results.checks.character = characterCheck;
    if (!characterCheck.passed) {
      results.allowed = false;
    }
    results.issues.push(...(characterCheck.issues || []));
  }
  
  return results;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const input = process.argv[3];
  
  if (command === 'check' && input) {
    const results = checkAllGuardrails(input);
    console.log(JSON.stringify(results, null, 2));
  } else if (command === 'jailbreak' && input) {
    const results = checkJailbreakGuardrail(input);
    console.log(JSON.stringify(results, null, 2));
  } else if (command === 'latency' && input) {
    const results = checkLatencyGuardrail(input);
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('Usage: guardrails-enforcer.mjs [check|jailbreak|latency] <input>');
  }
}

