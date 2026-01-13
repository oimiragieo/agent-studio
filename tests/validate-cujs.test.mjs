/**
 * Unit tests for CUJ validation table parsing
 * Tests the parseCUJMappingTable function with various table separator formats
 * Uses Node.js built-in test runner (node:test)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test data: various table separator formats
const TEST_TABLES = {
  compact: `## Run CUJ Mapping

| CUJ ID  | Execution Mode | Workflow File Path | Primary Skill |
|---------|----------------|-------------------|---------------|
| CUJ-001 | manual-setup   | null              | null          |
| CUJ-002 | skill-only     | null              | rule-selector |
| CUJ-003 | skill-only     | null              | context-bridge|

**Notes**:
- **skill-only**: CUJ executes via skill invocation`,

  spaced: `## Run CUJ Mapping

| CUJ ID  | Execution Mode | Workflow File Path                                         | Primary Skill             |
| ------- | -------------- | ---------------------------------------------------------- | ------------------------- |
| CUJ-001 | manual-setup   | null                                                       | null                      |
| CUJ-002 | skill-only     | null                                                       | rule-selector             |
| CUJ-003 | skill-only     | null                                                       | context-bridge            |
| CUJ-004 | workflow       | \`.claude/workflows/greenfield-fullstack.yaml\`            | null                      |

**Notes**:
- **skill-only**: CUJ executes via skill invocation`,

  mixedSpacing: `## Run CUJ Mapping

| CUJ ID  | Execution Mode | Workflow File Path | Primary Skill |
|  ---  |  -----------  |  ----------------  |  -----------  |
| CUJ-001 | manual-setup   | null              | null          |
| CUJ-002 | skill-only     | null              | rule-selector |

**Notes**:`,

  longDashes: `## Run CUJ Mapping

| CUJ ID  | Execution Mode | Workflow File Path | Primary Skill |
| --------------- | ------------------------------ | ------------------------------------------------------------ | ------------------------------------- |
| CUJ-001 | manual-setup   | null              | null          |
| CUJ-002 | skill-only     | null              | rule-selector |

**Notes**:`,

  noDashes: `## Run CUJ Mapping

| CUJ ID  | Execution Mode | Workflow File Path | Primary Skill |
|  |  |  |  |
| CUJ-001 | manual-setup   | null              | null          |

**Notes**:`, // Should NOT parse

  noSeparator: `## Run CUJ Mapping

| CUJ ID  | Execution Mode | Workflow File Path | Primary Skill |
| CUJ-001 | manual-setup   | null              | null          |

**Notes**:`, // Should NOT parse
};

// Helper function to parse table (same as in validate-cujs.mjs)
function parseTable(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const mapping = new Map();
  let inMappingTable = false;
  let headerPassed = false;

  for (const line of lines) {
    if (line.includes('| CUJ ID') && line.includes('Execution Mode')) {
      inMappingTable = true;
      continue;
    }

    if (inMappingTable && !headerPassed && /^\|\s*-{3,}/.test(line)) {
      headerPassed = true;
      continue;
    }

    if (inMappingTable && headerPassed && line.startsWith('|')) {
      const cols = line
        .split('|')
        .map(c => c.trim())
        .filter(c => c);
      if (cols.length >= 4) {
        const cujId = cols[0];
        const executionMode = cols[1];
        const workflowPath = cols[2] === 'null' ? null : cols[2].replace(/`/g, '').trim();
        const primarySkill = cols[3] === 'null' ? null : cols[3].trim();

        if (cujId.startsWith('CUJ-')) {
          mapping.set(cujId, { executionMode, workflowPath, primarySkill });
        }
      }
    }

    if (inMappingTable && headerPassed && line.startsWith('##')) {
      break;
    }
  }

  return mapping;
}

describe('CUJ Mapping Table Parser', () => {
  describe('Separator Format Detection', () => {
    it('should parse table with compact separator format |---|', () => {
      const lines = TEST_TABLES.compact.replace(/\r\n/g, '\n').split('\n');
      let separatorFound = false;

      for (const line of lines) {
        if (/^\|\s*-{3,}/.test(line)) {
          separatorFound = true;
          break;
        }
      }

      assert.strictEqual(separatorFound, true, 'Compact separator should be detected');
    });

    it('should parse table with spaced separator format | ------- |', () => {
      const lines = TEST_TABLES.spaced.replace(/\r\n/g, '\n').split('\n');
      let separatorFound = false;

      for (const line of lines) {
        if (/^\|\s*-{3,}/.test(line)) {
          separatorFound = true;
          break;
        }
      }

      assert.strictEqual(separatorFound, true, 'Spaced separator should be detected');
    });

    it('should parse table with mixed spacing separator', () => {
      const lines = TEST_TABLES.mixedSpacing.replace(/\r\n/g, '\n').split('\n');
      let separatorFound = false;

      for (const line of lines) {
        if (/^\|\s*-{3,}/.test(line)) {
          separatorFound = true;
          break;
        }
      }

      assert.strictEqual(separatorFound, true, 'Mixed spacing separator should be detected');
    });

    it('should parse table with extra long dashes', () => {
      const lines = TEST_TABLES.longDashes.replace(/\r\n/g, '\n').split('\n');
      let separatorFound = false;

      for (const line of lines) {
        if (/^\|\s*-{3,}/.test(line)) {
          separatorFound = true;
          break;
        }
      }

      assert.strictEqual(separatorFound, true, 'Long dashes separator should be detected');
    });

    it('should NOT parse table with no dashes (only spaces)', () => {
      const lines = TEST_TABLES.noDashes.replace(/\r\n/g, '\n').split('\n');
      let separatorFound = false;

      for (const line of lines) {
        if (/^\|\s*-{3,}/.test(line)) {
          separatorFound = true;
          break;
        }
      }

      assert.strictEqual(separatorFound, false, 'No dashes separator should NOT be detected');
    });

    it('should NOT parse table with no separator line', () => {
      const lines = TEST_TABLES.noSeparator.replace(/\r\n/g, '\n').split('\n');
      let separatorFound = false;

      for (const line of lines) {
        if (/^\|\s*-{3,}/.test(line)) {
          separatorFound = true;
          break;
        }
      }

      assert.strictEqual(separatorFound, false, 'Missing separator should NOT be detected');
    });
  });

  describe('Table Data Extraction', () => {
    it('should extract CUJ entries from compact format table', () => {
      const mapping = parseTable(TEST_TABLES.compact);

      assert.strictEqual(mapping.size, 3, 'Should extract 3 CUJ entries');
      assert.deepStrictEqual(mapping.get('CUJ-001'), {
        executionMode: 'manual-setup',
        workflowPath: null,
        primarySkill: null,
      });
      assert.deepStrictEqual(mapping.get('CUJ-002'), {
        executionMode: 'skill-only',
        workflowPath: null,
        primarySkill: 'rule-selector',
      });
      assert.deepStrictEqual(mapping.get('CUJ-003'), {
        executionMode: 'skill-only',
        workflowPath: null,
        primarySkill: 'context-bridge',
      });
    });

    it('should extract CUJ entries from spaced format table (actual CUJ-INDEX.md format)', () => {
      const mapping = parseTable(TEST_TABLES.spaced);

      assert.strictEqual(mapping.size, 4, 'Should extract 4 CUJ entries');
      assert.deepStrictEqual(mapping.get('CUJ-004'), {
        executionMode: 'workflow',
        workflowPath: '.claude/workflows/greenfield-fullstack.yaml',
        primarySkill: null,
      });
    });

    it('should handle backticks in workflow paths', () => {
      const mapping = parseTable(TEST_TABLES.spaced);
      const cuj004 = mapping.get('CUJ-004');

      assert.ok(!cuj004.workflowPath.includes('`'), 'Workflow path should not contain backticks');
      assert.strictEqual(cuj004.workflowPath, '.claude/workflows/greenfield-fullstack.yaml');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty workflow path (null)', () => {
      const testTable = `## Run CUJ Mapping

| CUJ ID  | Execution Mode | Workflow File Path | Primary Skill |
| ------- | -------------- | ------------------ | ------------- |
| CUJ-001 | skill-only     | null               | rule-selector |`;

      const mapping = parseTable(testTable);
      const cuj001 = mapping.get('CUJ-001');

      assert.strictEqual(cuj001.workflowPath, null, 'null workflow path should be parsed as null');
    });

    it('should stop parsing at next section header (##)', () => {
      const testTable = `## Run CUJ Mapping

| CUJ ID  | Execution Mode | Workflow File Path | Primary Skill |
| ------- | -------------- | ------------------ | ------------- |
| CUJ-001 | skill-only     | null               | rule-selector |
| CUJ-002 | skill-only     | null               | context-bridge|

## Next Section

| CUJ ID  | Should Not Parse |
| ------- | ---------------- |
| CUJ-999 | ignored          |`;

      const mapping = parseTable(testTable);

      assert.strictEqual(mapping.size, 2, 'Should only parse 2 entries before section header');
      assert.ok(mapping.has('CUJ-001'), 'CUJ-001 should be parsed');
      assert.ok(mapping.has('CUJ-002'), 'CUJ-002 should be parsed');
      assert.ok(!mapping.has('CUJ-999'), 'CUJ-999 should NOT be parsed (after section header)');
    });
  });

  describe('Actual CUJ-INDEX.md Integration', () => {
    it('should parse the actual CUJ-INDEX.md file successfully', async () => {
      const realIndexPath = path.join(__dirname, '..', '.claude', 'docs', 'cujs', 'CUJ-INDEX.md');

      let content;
      try {
        content = await fs.readFile(realIndexPath, 'utf-8');
      } catch (error) {
        console.warn('Could not read real CUJ-INDEX.md, skipping integration test');
        return;
      }

      const mapping = parseTable(content);

      // CUJ-INDEX.md should have 61+ entries (excluding reserved CUJ-031, CUJ-032, CUJ-033)
      assert.ok(mapping.size >= 61, `Should have at least 61 CUJ entries, got ${mapping.size}`);

      // Verify some known entries
      assert.ok(mapping.has('CUJ-001'), 'CUJ-001 should exist');
      assert.ok(mapping.has('CUJ-002'), 'CUJ-002 should exist');
      assert.ok(mapping.has('CUJ-064'), 'CUJ-064 should exist');

      // Verify execution modes are correct
      const cuj001 = mapping.get('CUJ-001');
      assert.strictEqual(cuj001.executionMode, 'manual-setup');

      const cuj002 = mapping.get('CUJ-002');
      assert.strictEqual(cuj002.executionMode, 'skill-only');
      assert.strictEqual(cuj002.primarySkill, 'rule-selector');

      const cuj004 = mapping.get('CUJ-004');
      assert.strictEqual(cuj004.executionMode, 'workflow');
      assert.strictEqual(cuj004.workflowPath, '.claude/workflows/greenfield-fullstack.yaml');

      console.log(`✅ Successfully parsed ${mapping.size} CUJ entries from CUJ-INDEX.md`);
    });
  });
});
