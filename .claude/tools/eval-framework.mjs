#!/usr/bin/env node
/**
 * Evaluation Framework
 * Implements Claude testing and evaluation patterns
 * Based on: https://docs.claude.com/en/docs/test-and-evaluate/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVALS_DIR = path.join(__dirname, '../context/evals');
const RESULTS_DIR = path.join(__dirname, '../context/evals/results');

/**
 * Define success criteria for evaluation
 */
export function defineSuccessCriteria(name, criteria) {
  const evalDef = {
    name,
    criteria,
    createdAt: new Date().toISOString(),
    version: '1.0',
  };

  const filePath = path.join(EVALS_DIR, `${name}.json`);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(evalDef, null, 2), 'utf8');
  return evalDef;
}

/**
 * Run evaluation test
 */
export function runEval(evalName, testCase) {
  const evalDef = loadEval(evalName);
  if (!evalDef) {
    throw new Error(`Evaluation ${evalName} not found`);
  }

  const result = {
    evalName,
    testCase: testCase.name || 'unnamed',
    timestamp: new Date().toISOString(),
    criteria: evalDef.criteria,
    results: {},
    passed: false,
    score: 0,
  };

  // Evaluate against each criterion
  let totalScore = 0;
  let maxScore = 0;

  evalDef.criteria.forEach(criterion => {
    maxScore += criterion.weight || 1;

    const criterionResult = evaluateCriterion(criterion, testCase);
    result.results[criterion.name] = criterionResult;

    if (criterionResult.passed) {
      totalScore += criterion.weight || 1;
    }
  });

  result.score = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  result.passed = result.score >= (testCase.passingThreshold || 80);

  // Save result
  saveEvalResult(result);

  return result;
}

/**
 * Evaluate a single criterion
 */
function evaluateCriterion(criterion, testCase) {
  const result = {
    name: criterion.name,
    passed: false,
    score: 0,
    details: {},
  };

  switch (criterion.type) {
    case 'exact_match':
      result.passed = testCase.output === criterion.expected;
      result.score = result.passed ? 1 : 0;
      result.details = {
        expected: criterion.expected,
        actual: testCase.output,
      };
      break;

    case 'contains':
      result.passed = testCase.output.includes(criterion.expected);
      result.score = result.passed ? 1 : 0;
      result.details = {
        expected: criterion.expected,
        found: result.passed,
      };
      break;

    case 'regex':
      const regex = new RegExp(criterion.pattern);
      result.passed = regex.test(testCase.output);
      result.score = result.passed ? 1 : 0;
      result.details = {
        pattern: criterion.pattern,
        matched: result.passed,
      };
      break;

    case 'custom':
      // Custom evaluation function
      if (criterion.evaluator) {
        const customResult = criterion.evaluator(testCase);
        result.passed = customResult.passed;
        result.score = customResult.score || (result.passed ? 1 : 0);
        result.details = customResult.details || {};
      }
      break;

    default:
      result.passed = false;
      result.details = { error: `Unknown criterion type: ${criterion.type}` };
  }

  return result;
}

/**
 * Develop test cases
 */
export function developTests(evalName, testCases) {
  const evalDef = loadEval(evalName);
  if (!evalDef) {
    throw new Error(`Evaluation ${evalName} not found`);
  }

  const tests = {
    evalName,
    testCases: testCases.map(tc => ({
      name: tc.name,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      context: tc.context || {},
      metadata: tc.metadata || {},
    })),
    createdAt: new Date().toISOString(),
  };

  const filePath = path.join(EVALS_DIR, `${evalName}_tests.json`);
  fs.writeFileSync(filePath, JSON.stringify(tests, null, 2), 'utf8');

  return tests;
}

/**
 * Run test suite
 */
export function runTestSuite(evalName) {
  const tests = loadTests(evalName);
  if (!tests) {
    throw new Error(`Test suite ${evalName} not found`);
  }

  const results = {
    evalName,
    timestamp: new Date().toISOString(),
    testResults: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      averageScore: 0,
    },
  };

  tests.testCases.forEach(testCase => {
    const result = runEval(evalName, testCase);
    results.testResults.push(result);

    results.summary.total++;
    if (result.passed) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }
    results.summary.averageScore += result.score;
  });

  if (results.summary.total > 0) {
    results.summary.averageScore = results.summary.averageScore / results.summary.total;
  }

  // Save suite results
  saveSuiteResults(results);

  return results;
}

/**
 * Generate evaluation report
 */
export function generateEvalReport(evalName, days = 7) {
  const results = loadEvalResults(evalName, days);

  if (!results || results.length === 0) {
    return {
      evalName,
      message: 'No evaluation results found',
      period: `${days} days`,
    };
  }

  const report = {
    evalName,
    period: `${days} days`,
    totalRuns: results.length,
    summary: {
      averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
      passRate: (results.filter(r => r.passed).length / results.length) * 100,
      totalTests: results.length,
    },
    trends: analyzeTrends(results),
    recommendations: generateRecommendations(results),
  };

  return report;
}

/**
 * Analyze trends in results
 */
function analyzeTrends(results) {
  if (results.length < 2) {
    return { message: 'Insufficient data for trend analysis' };
  }

  const sorted = results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

  const firstAvg = firstHalf.reduce((sum, r) => sum + r.score, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, r) => sum + r.score, 0) / secondHalf.length;

  return {
    trend: secondAvg > firstAvg ? 'improving' : secondAvg < firstAvg ? 'declining' : 'stable',
    firstHalfAverage: firstAvg,
    secondHalfAverage: secondAvg,
    change: secondAvg - firstAvg,
  };
}

/**
 * Generate recommendations
 */
function generateRecommendations(results) {
  const recommendations = [];

  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  if (avgScore < 70) {
    recommendations.push({
      type: 'low_score',
      message: 'Average score is below 70%. Review evaluation criteria and test cases.',
      priority: 'high',
    });
  }

  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length > results.length * 0.3) {
    recommendations.push({
      type: 'high_failure_rate',
      message: `Failure rate is ${((failedTests.length / results.length) * 100).toFixed(1)}%. Investigate common failure patterns.`,
      priority: 'high',
    });
  }

  return recommendations;
}

/**
 * Load evaluation definition
 */
function loadEval(evalName) {
  const filePath = path.join(EVALS_DIR, `${evalName}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
}

/**
 * Load test cases
 */
function loadTests(evalName) {
  const filePath = path.join(EVALS_DIR, `${evalName}_tests.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
}

/**
 * Save evaluation result
 */
function saveEvalResult(result) {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const filename = `${result.evalName}_${Date.now()}.json`;
  const filePath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');
}

/**
 * Save suite results
 */
function saveSuiteResults(results) {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const filename = `suite_${results.evalName}_${Date.now()}.json`;
  const filePath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf8');
}

/**
 * Load evaluation results
 */
function loadEvalResults(evalName, days = 7) {
  if (!fs.existsSync(RESULTS_DIR)) {
    return [];
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const files = fs.readdirSync(RESULTS_DIR);
  const results = [];

  files.forEach(file => {
    if (file.startsWith(`${evalName}_`) && file.endsWith('.json')) {
      const filePath = path.join(RESULTS_DIR, file);
      const result = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const resultDate = new Date(result.timestamp);
      if (resultDate >= cutoff) {
        results.push(result);
      }
    }
  });

  return results;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const arg1 = process.argv[3];

  if (command === 'define' && arg1) {
    // Example: node eval-framework.mjs define "code-quality" '{"criteria": [...]}'
    const criteria = JSON.parse(process.argv[4] || '[]');
    const result = defineSuccessCriteria(arg1, criteria);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'run' && arg1) {
    const testCase = JSON.parse(process.argv[4] || '{}');
    const result = runEval(arg1, testCase);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'report' && arg1) {
    const days = parseInt(process.argv[4]) || 7;
    const report = generateEvalReport(arg1, days);
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Usage: eval-framework.mjs [define|run|report] <eval-name> [args...]');
  }
}
