/**
 * AI Council Tool
 * Integrates llm-council for multi-agent debates
 * Uses headless-ai-cli for tool call execution
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

// Ensure temp directory exists
async function ensureTempDir() {
  const tempDir = join(process.cwd(), '.claude/temp');
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true });
  }
}

/**
 * Initiate multi-agent debate using llm-council
 * 
 * @param {string} issue - The issue/question to debate
 * @param {Array<string>} agents - List of agent names to include in council
 * @param {Object} context - Additional context for the debate
 * @returns {Promise<Object>} Debate results with consensus and recommendations
 */
export async function initiateCouncilDebate(issue, agents, context) {
  await ensureTempDir();
  
  // Prepare debate configuration
  const debateConfig = {
    issue,
    agents,
    context,
    format: 'structured',
    maxRounds: 5,
    consensusThreshold: 0.7
  };
  
  // Use headless-ai-cli to execute llm-council
  const configPath = join(process.cwd(), '.claude/temp/council-config.json');
  await writeFile(configPath, JSON.stringify(debateConfig, null, 2));
  
  // Execute via headless-ai-cli
  // Note: This assumes headless-ai-cli is installed and configured
  try {
    const { stdout, stderr } = await execAsync(
      `headless-ai-cli council --config ${configPath} --output .claude/temp/council-results.json`
    );
    
    if (stderr && !stderr.includes('warning')) {
      throw new Error(`Council debate failed: ${stderr}`);
    }
    
    // Read results
    const resultsPath = join(process.cwd(), '.claude/temp/council-results.json');
    if (existsSync(resultsPath)) {
      const results = JSON.parse(await readFile(resultsPath, 'utf-8'));
      
      return {
        consensus: results.consensus,
        recommendations: results.recommendations,
        arguments: results.arguments,
        participants: results.participants,
        rounds: results.rounds
      };
    } else {
      // Fallback if headless-ai-cli not available
      return {
        consensus: 'Manual review required',
        recommendations: ['Use planner to analyze issue'],
        arguments: [],
        participants: agents,
        rounds: 0
      };
    }
  } catch (error) {
    // Fallback if headless-ai-cli not available
    console.warn('headless-ai-cli not available, using fallback');
    return {
      consensus: 'Manual review required',
      recommendations: ['Use planner to analyze issue'],
      arguments: [],
      participants: agents,
      rounds: 0
    };
  }
}

/**
 * Specialized debate for architecture decisions
 */
export async function debateArchitectureDecision(decision, options) {
  const agents = ['architect', 'security-architect', 'performance-engineer', 'developer'];
  return await initiateCouncilDebate(
    `Architecture decision: ${decision}`,
    agents,
    { options, type: 'architecture' }
  );
}

/**
 * Specialized debate for bug fixes
 */
export async function debateBugFix(bug, proposedFixes) {
  const agents = ['developer', 'qa', 'security-architect', 'code-reviewer'];
  return await initiateCouncilDebate(
    `Bug fix analysis: ${bug.description}`,
    agents,
    { bug, proposedFixes, type: 'bug-fix' }
  );
}

/**
 * Specialized debate for feature design
 */
export async function debateFeatureDesign(feature, requirements) {
  const agents = ['architect', 'ux-expert', 'developer', 'pm'];
  return await initiateCouncilDebate(
    `Feature design: ${feature}`,
    agents,
    { requirements, type: 'feature-design' }
  );
}

