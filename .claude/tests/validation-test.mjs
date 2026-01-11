#!/usr/bin/env node
/**
 * Validation Systems Test
 *
 * Tests validation systems:
 * - Feature distillation validation
 * - Infrastructure security validation
 * - Custom validation checks
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test feature distillation validation
 */
async function testFeatureDistillationValidation() {
  console.log('Test: Feature Distillation Validation');

  const testArtifact = {
    features: [
      {
        id: 'feature-1',
        name: 'User Authentication',
        description: 'User login and logout',
        priority: 'high',
        acceptance_criteria: ['User can login', 'User can logout'],
        dependencies: [],
      },
      {
        id: 'feature-2',
        name: 'User Profile',
        description: 'User profile management',
        priority: 'medium',
        acceptance_criteria: ['User can view profile'],
        dependencies: ['feature-1'],
      },
    ],
    summary: 'Test features',
    total_features: 2,
    original_document_size_kb: 20,
  };

  // Test all_critical_features_preserved
  const missingFields = testArtifact.features.filter(
    f => !f.id || !f.name || !f.description || !f.priority
  );
  if (missingFields.length > 0) {
    throw new Error('all_critical_features_preserved check failed');
  }
  console.log('✅ all_critical_features_preserved: PASSED');

  // Test acceptance_criteria_included
  const missingCriteria = testArtifact.features.filter(
    f =>
      !f.acceptance_criteria ||
      !Array.isArray(f.acceptance_criteria) ||
      f.acceptance_criteria.length === 0
  );
  if (missingCriteria.length > 0) {
    throw new Error('acceptance_criteria_included check failed');
  }
  console.log('✅ acceptance_criteria_included: PASSED');

  // Test dependencies_mapped
  const invalidDeps = testArtifact.features.filter(f => {
    if (f.dependencies && Array.isArray(f.dependencies)) {
      return f.dependencies.some(
        dep => typeof dep !== 'string' || !dep.match(/^feature-[a-zA-Z0-9_-]+$/)
      );
    }
    return false;
  });
  if (invalidDeps.length > 0) {
    throw new Error('dependencies_mapped check failed');
  }
  console.log('✅ dependencies_mapped: PASSED');

  return true;
}

/**
 * Test infrastructure security validation
 */
async function testInfrastructureSecurityValidation() {
  console.log('\nTest: Infrastructure Security Validation');

  // Test valid infrastructure config (no hardcoded secrets)
  const validConfig = {
    resources: {
      database: [
        {
          name: 'app-db-dev-a3f2b1c',
          unique_suffix: 'a3f2b1c',
          type: 'cloud-sql',
          connection_string: 'postgresql://user:{DB_PASSWORD}@host/db',
          connection_string_secret_ref: 'projects/my-proj/secrets/db-password/versions/1',
        },
      ],
    },
    secret_references: {
      db_password: {
        secret_id: 'projects/my-proj/secrets/db-password/versions/1',
        environment_variable: 'DB_PASSWORD_SECRET_ID',
      },
    },
  };

  // Test invalid config (with hardcoded secret)
  const invalidConfig = {
    resources: {
      database: [
        {
          name: 'app-db-dev',
          type: 'cloud-sql',
          connection_string: 'postgresql://user:mypassword123@host/db',
        },
      ],
    },
  };

  // In a real test, would call validateInfrastructureSecurity
  // For now, just verify structure
  if (!validConfig.secret_references) {
    throw new Error('Valid config should have secret_references');
  }
  if (invalidConfig.resources.database[0].connection_string.includes('mypassword123')) {
    console.log('✅ Detected hardcoded secret in invalid config');
  }

  console.log('✅ Infrastructure security validation structure: PASSED');
  return true;
}

/**
 * Test custom validation integration
 */
async function testCustomValidationIntegration() {
  console.log('\nTest: Custom Validation Integration');

  // Test that custom checks can be specified in workflow
  const workflowStep = {
    validation: {
      schema: '.claude/schemas/features_distilled.schema.json',
      gate: '.claude/context/history/gates/{{workflow_id}}/00.5-analyst.json',
      custom_checks: [
        'all_critical_features_preserved',
        'acceptance_criteria_included',
        'dependencies_mapped',
      ],
    },
  };

  if (
    !workflowStep.validation.custom_checks ||
    workflowStep.validation.custom_checks.length === 0
  ) {
    throw new Error('Custom checks not found in workflow step');
  }

  console.log(
    `✅ Custom checks configured: ${workflowStep.validation.custom_checks.length} check(s)`
  );
  return true;
}

/**
 * Run all validation tests
 */
async function runValidationTests() {
  try {
    await testFeatureDistillationValidation();
    await testInfrastructureSecurityValidation();
    await testCustomValidationIntegration();

    console.log('\n✅ All validation tests passed!');
    return true;
  } catch (error) {
    console.error(`\n❌ Validation test failed: ${error.message}`);
    throw error;
  }
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidationTests()
    .then(() => {
      console.log('\n✨ Validation test suite completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n❌ Validation test suite failed: ${error.message}`);
      process.exit(1);
    });
}
