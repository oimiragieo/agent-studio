#!/usr/bin/env node
/**
 * Comprehensive Test Suite for Condition Evaluation Engine
 *
 * Tests the nested condition parser with operator precedence
 * and safe variable resolution (Cursor Recommendations #5 and #6)
 *
 * Run with: node .claude/tools/test-condition-evaluation.mjs
 */

import assert from 'assert';

// Import the condition evaluation functions from standalone module
import {
  evaluateCondition,
  tokenizeCondition,
  evaluateAtomic,
  safeGet
} from './condition-evaluator.mjs';

// Test results tracking
let passed = 0;
let failed = 0;
const failures = [];

/**
 * Run a single test case
 */
function runTest(description, testFn) {
  try {
    testFn();
    passed++;
    console.log(`  ✓ ${description}`);
  } catch (error) {
    failed++;
    failures.push({ description, error: error.message });
    console.log(`  ✗ ${description}`);
    console.log(`    Error: ${error.message}`);
  }
}

/**
 * Test group runner
 */
function describe(groupName, testsFn) {
  console.log(`\n${groupName}`);
  console.log('─'.repeat(groupName.length));
  testsFn();
}

// ============================================================================
// TESTS START HERE
// ============================================================================

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   CONDITION EVALUATION ENGINE TEST SUITE                      ║');
console.log('║   Cursor Recommendations #5 (Nested Parsing) and #6 (Safe)   ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ============================================================================
// Test safeGet utility
// ============================================================================
describe('safeGet Utility (Recommendation #6)', () => {
  runTest('returns value at valid path', () => {
    const obj = { a: { b: { c: 'value' } } };
    assert.strictEqual(safeGet(obj, 'a.b.c'), 'value');
  });

  runTest('returns defaultValue for missing path', () => {
    const obj = { a: { b: {} } };
    assert.strictEqual(safeGet(obj, 'a.b.c', 'default'), 'default');
  });

  runTest('returns undefined for missing path without default', () => {
    const obj = { a: {} };
    assert.strictEqual(safeGet(obj, 'a.b.c'), undefined);
  });

  runTest('handles null object', () => {
    assert.strictEqual(safeGet(null, 'a.b'), undefined);
  });

  runTest('handles undefined object', () => {
    assert.strictEqual(safeGet(undefined, 'a.b', 'default'), 'default');
  });

  runTest('handles null in path', () => {
    const obj = { a: { b: null } };
    assert.strictEqual(safeGet(obj, 'a.b.c', 'default'), 'default');
  });

  runTest('handles array access', () => {
    const obj = { items: [{ name: 'first' }, { name: 'second' }] };
    assert.strictEqual(safeGet(obj, 'items.0.name'), 'first');
  });

  runTest('returns false values correctly', () => {
    const obj = { flag: false, count: 0, empty: '' };
    assert.strictEqual(safeGet(obj, 'flag'), false);
    assert.strictEqual(safeGet(obj, 'count'), 0);
    assert.strictEqual(safeGet(obj, 'empty'), '');
  });
});

// ============================================================================
// Test tokenizeCondition
// ============================================================================
describe('Tokenizer (Recommendation #5)', () => {
  runTest('tokenizes simple condition', () => {
    const tokens = tokenizeCondition('A AND B');
    assert.deepStrictEqual(tokens, ['A', 'AND', 'B']);
  });

  runTest('tokenizes condition with parentheses', () => {
    const tokens = tokenizeCondition('(A OR B) AND C');
    assert.deepStrictEqual(tokens, ['(', 'A', 'OR', 'B', ')', 'AND', 'C']);
  });

  runTest('tokenizes condition with quotes', () => {
    const tokens = tokenizeCondition('config.name === "hello world"');
    assert.deepStrictEqual(tokens, ['config.name', '===', '"hello world"']);
  });

  runTest('tokenizes NOT operator', () => {
    const tokens = tokenizeCondition('NOT A AND B');
    assert.deepStrictEqual(tokens, ['NOT', 'A', 'AND', 'B']);
  });

  runTest('tokenizes nested parentheses', () => {
    const tokens = tokenizeCondition('((A AND B) OR C)');
    assert.deepStrictEqual(tokens, ['(', '(', 'A', 'AND', 'B', ')', 'OR', 'C', ')']);
  });

  runTest('handles providers.includes pattern', () => {
    const tokens = tokenizeCondition('providers.includes("claude")');
    assert.deepStrictEqual(tokens, ['providers.includes("claude")']);
  });
});

// ============================================================================
// Test simple conditions
// ============================================================================
describe('Simple Conditions', () => {
  runTest('providers.includes returns true when present', () => {
    const result = evaluateCondition('providers.includes("claude")', {
      providers: ['claude', 'gemini']
    });
    assert.strictEqual(result, true);
  });

  runTest('providers.includes returns false when missing', () => {
    const result = evaluateCondition('providers.includes("codex")', {
      providers: ['claude', 'gemini']
    });
    assert.strictEqual(result, false);
  });

  runTest('config boolean true', () => {
    const result = evaluateCondition('config.enabled === true', {
      config: { enabled: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('config boolean false', () => {
    const result = evaluateCondition('config.enabled === true', {
      config: { enabled: false }
    });
    assert.strictEqual(result, false);
  });

  runTest('config string equality', () => {
    const result = evaluateCondition('config.mode === "production"', {
      config: { mode: 'production' }
    });
    assert.strictEqual(result, true);
  });

  runTest('step.output.field string match', () => {
    const result = evaluateCondition('step.output.risk === "high"', {
      step: { output: { risk: 'high' } }
    });
    assert.strictEqual(result, true);
  });

  runTest('step.output.field boolean match', () => {
    const result = evaluateCondition('step.output.approved === true', {
      step: { output: { approved: true } }
    });
    assert.strictEqual(result, true);
  });

  runTest('simple boolean flag from config', () => {
    const result = evaluateCondition('user_requested_multi_ai_review', {
      config: { user_requested_multi_ai_review: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('simple boolean flag missing returns false', () => {
    const result = evaluateCondition('nonexistent_flag', {
      config: {}
    });
    assert.strictEqual(result, false);
  });
});

// ============================================================================
// Test AND conditions
// ============================================================================
describe('AND Conditions', () => {
  runTest('A AND B - both true', () => {
    const result = evaluateCondition('providers.includes("claude") AND config.enabled === true', {
      providers: ['claude'],
      config: { enabled: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('A AND B - first false', () => {
    const result = evaluateCondition('providers.includes("codex") AND config.enabled === true', {
      providers: ['claude'],
      config: { enabled: true }
    });
    assert.strictEqual(result, false);
  });

  runTest('A AND B - second false', () => {
    const result = evaluateCondition('providers.includes("claude") AND config.enabled === true', {
      providers: ['claude'],
      config: { enabled: false }
    });
    assert.strictEqual(result, false);
  });

  runTest('A AND B AND C - all true', () => {
    const result = evaluateCondition('flag_a AND flag_b AND flag_c', {
      config: { flag_a: true, flag_b: true, flag_c: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('A AND B AND C - one false', () => {
    const result = evaluateCondition('flag_a AND flag_b AND flag_c', {
      config: { flag_a: true, flag_b: false, flag_c: true }
    });
    assert.strictEqual(result, false);
  });
});

// ============================================================================
// Test OR conditions
// ============================================================================
describe('OR Conditions', () => {
  runTest('A OR B - both true', () => {
    const result = evaluateCondition('providers.includes("claude") OR providers.includes("gemini")', {
      providers: ['claude', 'gemini']
    });
    assert.strictEqual(result, true);
  });

  runTest('A OR B - first true', () => {
    const result = evaluateCondition('providers.includes("claude") OR providers.includes("codex")', {
      providers: ['claude']
    });
    assert.strictEqual(result, true);
  });

  runTest('A OR B - second true', () => {
    const result = evaluateCondition('providers.includes("codex") OR providers.includes("claude")', {
      providers: ['claude']
    });
    assert.strictEqual(result, true);
  });

  runTest('A OR B - both false', () => {
    const result = evaluateCondition('providers.includes("codex") OR providers.includes("gpt4")', {
      providers: ['claude']
    });
    assert.strictEqual(result, false);
  });

  runTest('A OR B OR C - one true', () => {
    const result = evaluateCondition('flag_a OR flag_b OR flag_c', {
      config: { flag_a: false, flag_b: true, flag_c: false }
    });
    assert.strictEqual(result, true);
  });
});

// ============================================================================
// Test Operator Precedence (Recommendation #5)
// ============================================================================
describe('Operator Precedence (Recommendation #5)', () => {
  runTest('A OR B AND C - AND binds tighter (B AND C first)', () => {
    // Should be evaluated as: A OR (B AND C)
    // false OR (true AND true) = false OR true = true
    const result = evaluateCondition('flag_a OR flag_b AND flag_c', {
      config: { flag_a: false, flag_b: true, flag_c: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('A OR B AND C - AND binds tighter (C false)', () => {
    // Should be evaluated as: A OR (B AND C)
    // false OR (true AND false) = false OR false = false
    const result = evaluateCondition('flag_a OR flag_b AND flag_c', {
      config: { flag_a: false, flag_b: true, flag_c: false }
    });
    assert.strictEqual(result, false);
  });

  runTest('A AND B OR C - left-to-right with precedence', () => {
    // Should be evaluated as: (A AND B) OR C
    // (true AND false) OR true = false OR true = true
    const result = evaluateCondition('flag_a AND flag_b OR flag_c', {
      config: { flag_a: true, flag_b: false, flag_c: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('A AND B OR C AND D', () => {
    // Should be evaluated as: (A AND B) OR (C AND D)
    // (true AND false) OR (true AND true) = false OR true = true
    const result = evaluateCondition('flag_a AND flag_b OR flag_c AND flag_d', {
      config: { flag_a: true, flag_b: false, flag_c: true, flag_d: true }
    });
    assert.strictEqual(result, true);
  });
});

// ============================================================================
// Test Parentheses (Recommendation #5)
// ============================================================================
describe('Parentheses Support (Recommendation #5)', () => {
  runTest('(A OR B) AND C - parentheses override precedence', () => {
    // Without parens: A OR (B AND C) = false OR (true AND true) = true
    // With parens: (A OR B) AND C = (false OR true) AND true = true
    const result = evaluateCondition('(flag_a OR flag_b) AND flag_c', {
      config: { flag_a: false, flag_b: true, flag_c: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('(A OR B) AND C - C is false', () => {
    // (false OR true) AND false = true AND false = false
    const result = evaluateCondition('(flag_a OR flag_b) AND flag_c', {
      config: { flag_a: false, flag_b: true, flag_c: false }
    });
    assert.strictEqual(result, false);
  });

  runTest('A OR (B AND C) - explicit grouping', () => {
    // false OR (true AND true) = false OR true = true
    const result = evaluateCondition('flag_a OR (flag_b AND flag_c)', {
      config: { flag_a: false, flag_b: true, flag_c: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('nested parentheses: ((A AND B) OR C)', () => {
    // ((true AND true) OR false) = (true OR false) = true
    const result = evaluateCondition('((flag_a AND flag_b) OR flag_c)', {
      config: { flag_a: true, flag_b: true, flag_c: false }
    });
    assert.strictEqual(result, true);
  });

  runTest('complex: (A OR B) AND (C OR D)', () => {
    // (true OR false) AND (false OR true) = true AND true = true
    const result = evaluateCondition('(flag_a OR flag_b) AND (flag_c OR flag_d)', {
      config: { flag_a: true, flag_b: false, flag_c: false, flag_d: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('complex: (A AND B) OR (C AND D)', () => {
    // (true AND false) OR (true AND true) = false OR true = true
    const result = evaluateCondition('(flag_a AND flag_b) OR (flag_c AND flag_d)', {
      config: { flag_a: true, flag_b: false, flag_c: true, flag_d: true }
    });
    assert.strictEqual(result, true);
  });
});

// ============================================================================
// Test NOT operator
// ============================================================================
describe('NOT Operator', () => {
  runTest('NOT true = false', () => {
    const result = evaluateCondition('NOT flag_a', {
      config: { flag_a: true }
    });
    assert.strictEqual(result, false);
  });

  runTest('NOT false = true', () => {
    const result = evaluateCondition('NOT flag_a', {
      config: { flag_a: false }
    });
    assert.strictEqual(result, true);
  });

  runTest('NOT A AND B', () => {
    // NOT true AND true = false AND true = false
    const result = evaluateCondition('NOT flag_a AND flag_b', {
      config: { flag_a: true, flag_b: true }
    });
    assert.strictEqual(result, false);
  });

  runTest('A AND NOT B', () => {
    // true AND NOT true = true AND false = false
    const result = evaluateCondition('flag_a AND NOT flag_b', {
      config: { flag_a: true, flag_b: true }
    });
    assert.strictEqual(result, false);
  });

  runTest('NOT (A AND B) - DeMorgan', () => {
    // NOT (true AND true) = NOT true = false
    const result = evaluateCondition('NOT (flag_a AND flag_b)', {
      config: { flag_a: true, flag_b: true }
    });
    assert.strictEqual(result, false);
  });

  runTest('NOT (A AND B) - DeMorgan with false', () => {
    // NOT (true AND false) = NOT false = true
    const result = evaluateCondition('NOT (flag_a AND flag_b)', {
      config: { flag_a: true, flag_b: false }
    });
    assert.strictEqual(result, true);
  });
});

// ============================================================================
// Test Safe Variable Resolution (Recommendation #6)
// ============================================================================
describe('Safe Variable Resolution (Recommendation #6)', () => {
  runTest('step.output.risk with missing output', () => {
    const result = evaluateCondition('step.output.risk === "high"', {
      step: {} // No output property
    });
    assert.strictEqual(result, false);
  });

  runTest('step.output.risk with missing step', () => {
    const result = evaluateCondition('step.output.risk === "high"', {
      // No step property
    });
    assert.strictEqual(result, false);
  });

  runTest('config.flag with empty config', () => {
    const result = evaluateCondition('config.flag === true', {
      config: {}
    });
    assert.strictEqual(result, false);
  });

  runTest('config.flag with missing config', () => {
    const result = evaluateCondition('config.flag === true', {
      // No config property
    });
    assert.strictEqual(result, false);
  });

  runTest('env.VAR with missing env', () => {
    const result = evaluateCondition('env.CUSTOM_VAR === "value"', {
      // No env property - will use defaults
    });
    assert.strictEqual(result, false);
  });

  runTest('providers.includes with undefined providers', () => {
    const result = evaluateCondition('providers.includes("claude")', {
      // No providers property
    });
    assert.strictEqual(result, false);
  });

  runTest('safe resolution in complex expression', () => {
    // (missing AND true) OR (missing AND true)
    // (false AND true) OR (false AND true) = false OR false = false
    const result = evaluateCondition('(step.output.risk === "high" AND flag_a) OR (config.missing === true AND flag_b)', {
      step: {},
      config: { flag_a: true, flag_b: true }
    });
    assert.strictEqual(result, false);
  });

  runTest('partial resolution - some values present', () => {
    // (true AND missing) OR true
    // (true AND false) OR true = false OR true = true
    const result = evaluateCondition('(flag_a AND step.output.approved === true) OR flag_b', {
      config: { flag_a: true, flag_b: true },
      step: {} // No output
    });
    assert.strictEqual(result, true);
  });
});

// ============================================================================
// Test Edge Cases
// ============================================================================
describe('Edge Cases', () => {
  runTest('empty condition returns true', () => {
    const result = evaluateCondition('', {});
    assert.strictEqual(result, true);
  });

  runTest('null condition returns true', () => {
    const result = evaluateCondition(null, {});
    assert.strictEqual(result, true);
  });

  runTest('undefined condition returns true', () => {
    const result = evaluateCondition(undefined, {});
    assert.strictEqual(result, true);
  });

  runTest('whitespace-only condition returns true', () => {
    const result = evaluateCondition('   ', {});
    assert.strictEqual(result, true);
  });

  runTest('condition with extra whitespace', () => {
    const result = evaluateCondition('  flag_a   AND   flag_b  ', {
      config: { flag_a: true, flag_b: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('condition with single quotes', () => {
    const result = evaluateCondition("config.name === 'test'", {
      config: { name: 'test' }
    });
    assert.strictEqual(result, true);
  });

  runTest('condition with double quotes', () => {
    const result = evaluateCondition('config.name === "test"', {
      config: { name: 'test' }
    });
    assert.strictEqual(result, true);
  });

  runTest('inequality operator !==', () => {
    const result = evaluateCondition('step.output.status !== "failed"', {
      step: { output: { status: 'success' } }
    });
    assert.strictEqual(result, true);
  });

  runTest('loose equality operator ==', () => {
    const result = evaluateCondition('config.count == 5', {
      config: { count: 5 }
    });
    // Note: Our parser uses === internally, so this should still match
    // The == is just part of the pattern match
    assert.strictEqual(result, true);
  });
});

// ============================================================================
// Test Real-World Workflow Conditions
// ============================================================================
describe('Real-World Workflow Conditions', () => {
  runTest('multi-AI review condition from code-review-flow.yaml', () => {
    const result = evaluateCondition(
      'providers.includes("claude") AND providers.includes("gemini")',
      { providers: ['claude', 'gemini', 'codex'] }
    );
    assert.strictEqual(result, true);
  });

  runTest('security check with risk level', () => {
    const result = evaluateCondition(
      'step.output.risk === "high" OR step.output.risk === "critical"',
      { step: { output: { risk: 'critical' } } }
    );
    assert.strictEqual(result, true);
  });

  runTest('conditional multi-AI with user request', () => {
    const result = evaluateCondition(
      'user_requested_multi_ai_review OR critical_security_changes',
      {
        config: { user_requested_multi_ai_review: false, critical_security_changes: true }
      }
    );
    assert.strictEqual(result, true);
  });

  runTest('production deployment guard', () => {
    const result = evaluateCondition(
      'config.environment === "production" AND step.output.approved === true AND NOT config.maintenance_mode',
      {
        config: { environment: 'production', maintenance_mode: false },
        step: { output: { approved: true } }
      }
    );
    assert.strictEqual(result, true);
  });

  runTest('CI/CD pipeline condition', () => {
    const result = evaluateCondition(
      '(config.branch === "main" OR config.branch === "develop") AND step.output.tests_passed === true',
      {
        config: { branch: 'main' },
        step: { output: { tests_passed: true } }
      }
    );
    assert.strictEqual(result, true);
  });
});

// ============================================================================
// Test Alternative Operators
// ============================================================================
describe('Alternative Operators (&& and ||)', () => {
  runTest('&& operator works like AND', () => {
    const result = evaluateCondition('flag_a && flag_b', {
      config: { flag_a: true, flag_b: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('|| operator works like OR', () => {
    const result = evaluateCondition('flag_a || flag_b', {
      config: { flag_a: false, flag_b: true }
    });
    assert.strictEqual(result, true);
  });

  runTest('! operator works like NOT', () => {
    const result = evaluateCondition('! flag_a', {
      config: { flag_a: true }
    });
    assert.strictEqual(result, false);
  });

  runTest('mixed operators && and OR', () => {
    const result = evaluateCondition('flag_a && flag_b OR flag_c', {
      config: { flag_a: true, flag_b: false, flag_c: true }
    });
    assert.strictEqual(result, true);
  });
});

// ============================================================================
// Print Summary
// ============================================================================
console.log('\n' + '═'.repeat(66));
console.log('\n📊 TEST SUMMARY');
console.log('─'.repeat(30));
console.log(`   ✓ Passed: ${passed}`);
console.log(`   ✗ Failed: ${failed}`);
console.log(`   Total:   ${passed + failed}`);

if (failures.length > 0) {
  console.log('\n❌ FAILURES:');
  failures.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.description}`);
    console.log(`      Error: ${f.error}`);
  });
}

console.log('\n' + '═'.repeat(66));

if (failed > 0) {
  console.log('\n❌ Some tests failed!\n');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!\n');
  process.exit(0);
}
