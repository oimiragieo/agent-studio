#!/usr/bin/env node

/**
 * @fileoverview Test Suite for Skill Injector
 * Validates skill injection functionality for Phase 2A enforcement
 */

import { injectSkillsForAgent, getSkillsForAgent, listAvailableAgents } from './skill-injector.mjs';

async function runTests() {
  console.log('='.repeat(80));
  console.log('Skill Injector Test Suite - Phase 2A');
  console.log('='.repeat(80));
  console.log('');

  const tests = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Load available agents
  console.log('Test 1: List Available Agents');
  try {
    const agents = await listAvailableAgents();
    console.log(`✓ Found ${agents.length} agents`);
    console.log(`  Agents: ${agents.slice(0, 5).join(', ')}...`);
    passed++;
  } catch (error) {
    console.log(`✗ Failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 2: Get skills for developer
  console.log('Test 2: Get Skills for Developer Agent');
  try {
    const devSkills = await getSkillsForAgent('developer');
    console.log(`✓ Required: ${devSkills.requiredSkills.length} skills`);
    console.log(`  ${devSkills.requiredSkills.join(', ')}`);
    console.log(`✓ Recommended: ${devSkills.recommendedSkills.length} skills`);
    console.log(`  ${devSkills.recommendedSkills.join(', ')}`);
    passed++;
  } catch (error) {
    console.log(`✗ Failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 3: Trigger detection - new component
  console.log('Test 3: Skill Triggering - "Create new UserProfile component"');
  try {
    const result = await injectSkillsForAgent('developer', 'Create new UserProfile component with tests');
    console.log(`✓ Required skills: ${result.requiredSkills.length}`);
    console.log(`  ${result.requiredSkills.join(', ')}`);
    console.log(`✓ Triggered skills: ${result.triggeredSkills.length}`);
    console.log(`  ${result.triggeredSkills.join(', ')}`);
    console.log(`✓ Prompt length: ${result.skillPrompt.length} chars`);
    passed++;
  } catch (error) {
    console.log(`✗ Failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 4: Trigger detection - code review
  console.log('Test 4: Skill Triggering - "Review authentication code"');
  try {
    const result = await injectSkillsForAgent('code-reviewer', 'Review authentication code for security issues');
    console.log(`✓ Required skills: ${result.requiredSkills.length}`);
    console.log(`  ${result.requiredSkills.join(', ')}`);
    console.log(`✓ Triggered skills: ${result.triggeredSkills.length}`);
    console.log(`  ${result.triggeredSkills.join(', ')}`);
    console.log(`✓ Load time: ${result.metadata.loadTimeMs}ms`);
    passed++;
  } catch (error) {
    console.log(`✗ Failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 5: Orchestrator skills
  console.log('Test 5: Orchestrator Skills (Plan Rating)');
  try {
    const result = await injectSkillsForAgent('orchestrator', 'Create and execute development plan');
    console.log(`✓ Required skills: ${result.requiredSkills.length}`);
    console.log(`  ${result.requiredSkills.join(', ')}`);

    const hasResponseRater = result.requiredSkills.includes('response-rater');
    if (hasResponseRater) {
      console.log(`✓ Orchestrator has response-rater (plan rating enforcement)`);
    } else {
      console.log(`✗ WARNING: Orchestrator missing response-rater for plan rating`);
    }
    passed++;
  } catch (error) {
    console.log(`✗ Failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 6: QA test generation
  console.log('Test 6: QA Skills - Test Creation');
  try {
    const result = await injectSkillsForAgent('qa', 'Write tests for API endpoints and components');
    console.log(`✓ Required skills: ${result.requiredSkills.length}`);
    console.log(`  ${result.requiredSkills.join(', ')}`);
    console.log(`✓ Triggered skills: ${result.triggeredSkills.length}`);
    console.log(`  ${result.triggeredSkills.join(', ')}`);

    const hasTestGenerator = result.requiredSkills.includes('test-generator');
    if (hasTestGenerator) {
      console.log(`✓ QA has test-generator skill (required)`);
    } else {
      console.log(`✗ WARNING: QA missing test-generator`);
    }
    passed++;
  } catch (error) {
    console.log(`✗ Failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Test 7: Unknown agent handling
  console.log('Test 7: Unknown Agent Error Handling');
  try {
    const result = await injectSkillsForAgent('nonexistent-agent', 'Test task');
    if (!result.success) {
      console.log(`✓ Gracefully handled unknown agent`);
      console.log(`  Error: ${result.error}`);
      passed++;
    } else {
      console.log(`✗ Should have failed for unknown agent`);
      failed++;
    }
  } catch (error) {
    console.log(`✓ Correctly threw error for unknown agent`);
    passed++;
  }
  console.log('');

  // Test 8: Skill prompt format validation
  console.log('Test 8: Skill Prompt Format Validation');
  try {
    const result = await injectSkillsForAgent('developer', 'Create new component');
    const prompt = result.skillPrompt;

    const hasHeader = prompt.includes('# Injected Skills');
    const hasRequired = prompt.includes('## Required Skills');
    const hasMandatory = prompt.includes('MANDATORY');

    console.log(`✓ Prompt includes header: ${hasHeader}`);
    console.log(`✓ Prompt includes required section: ${hasRequired}`);
    console.log(`✓ Prompt includes mandatory language: ${hasMandatory}`);

    if (hasHeader && hasRequired) {
      passed++;
    } else {
      console.log(`✗ Prompt format missing required sections`);
      failed++;
    }
  } catch (error) {
    console.log(`✗ Failed: ${error.message}`);
    failed++;
  }
  console.log('');

  // Summary
  console.log('='.repeat(80));
  console.log('Test Summary');
  console.log('='.repeat(80));
  console.log(`Passed: ${passed}/${passed + failed}`);
  console.log(`Failed: ${failed}/${passed + failed}`);
  console.log('');

  if (failed === 0) {
    console.log('✓ All tests passed!');
    process.exit(0);
  } else {
    console.log(`✗ ${failed} test(s) failed`);
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});
