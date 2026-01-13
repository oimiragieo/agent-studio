/**
 * Pattern Learning Engine Tests
 *
 * Test suite for pattern-learner.mjs
 */

import { createMemoryDatabase } from './database.mjs';
import { createPatternLearner } from './pattern-learner.mjs';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB_PATH = '.claude/context/memory/test-pattern-learner.db';

/**
 * Test suite runner
 */
class PatternLearnerTestSuite {
    constructor() {
        this.db = null;
        this.learner = null;
        this.results = {
            passed: 0,
            failed: 0,
            total: 0
        };
    }

    /**
     * Setup test environment
     */
    async setup() {
        // Clean up old test database
        if (existsSync(TEST_DB_PATH)) {
            unlinkSync(TEST_DB_PATH);
        }

        // Create fresh database
        this.db = createMemoryDatabase(TEST_DB_PATH);
        await this.db.initialize();

        // Create pattern learner
        this.learner = createPatternLearner(this.db);
    }

    /**
     * Teardown test environment
     */
    async teardown() {
        if (this.db) {
            this.db.close();
        }

        // Clean up test database
        if (existsSync(TEST_DB_PATH)) {
            unlinkSync(TEST_DB_PATH);
        }
    }

    /**
     * Assert helper
     */
    assert(condition, message) {
        this.results.total++;

        if (condition) {
            console.log(`✅ ${message}`);
            this.results.passed++;
        } else {
            console.error(`❌ ${message}`);
            this.results.failed++;
        }
    }

    /**
     * Test: Pattern learner initialization
     */
    async testInitialization() {
        console.log('\n=== Test: Initialization ===\n');

        this.assert(
            this.learner !== null,
            'Pattern learner instance created'
        );

        this.assert(
            this.learner.PATTERN_TYPES.WORKFLOW === 'workflow',
            'Pattern type constants defined'
        );

        this.assert(
            this.learner.CONFIDENCE_THRESHOLDS.MIN === 0.1,
            'Confidence thresholds defined'
        );

        this.assert(
            this.learner.FREQUENCY_THRESHOLDS.RARE === 1,
            'Frequency thresholds defined'
        );
    }

    /**
     * Test: Record new pattern
     */
    async testRecordNewPattern() {
        console.log('\n=== Test: Record New Pattern ===\n');

        const patternData = {
            name: 'feature-implementation',
            sequence: ['architect', 'developer', 'code-reviewer', 'qa'],
            success_rate: 0.95
        };

        const result = await this.learner.recordPattern('workflow', patternData);

        this.assert(
            result.isNew === true,
            'Pattern marked as new'
        );

        this.assert(
            typeof result.id === 'number' && result.id > 0,
            'Pattern ID assigned'
        );

        this.assert(
            result.confidence === 0.1,
            'Initial confidence is 0.1'
        );

        this.assert(
            result.occurrenceCount === 1,
            'Initial occurrence count is 1'
        );

        this.assert(
            typeof result.durationMs === 'number' && result.durationMs >= 0,
            'Execution time tracked'
        );
    }

    /**
     * Test: Record duplicate pattern (should update)
     */
    async testRecordDuplicatePattern() {
        console.log('\n=== Test: Record Duplicate Pattern ===\n');

        const patternData = {
            name: 'bug-fix-workflow',
            sequence: ['developer', 'qa'],
            success_rate: 0.9
        };

        // Record first time
        const firstResult = await this.learner.recordPattern('workflow', patternData);

        // Record again (should update)
        const secondResult = await this.learner.recordPattern('workflow', patternData);

        this.assert(
            secondResult.isNew === false,
            'Pattern not marked as new on second recording'
        );

        this.assert(
            secondResult.id === firstResult.id,
            'Same pattern ID used'
        );

        this.assert(
            secondResult.occurrenceCount === 2,
            'Occurrence count incremented'
        );

        this.assert(
            secondResult.confidence > firstResult.confidence,
            'Confidence increased'
        );
    }

    /**
     * Test: Get pattern by type and key
     */
    async testGetPattern() {
        console.log('\n=== Test: Get Pattern ===\n');

        const patternData = {
            tools: ['Read', 'Edit', 'Bash'],
            purpose: 'file modification'
        };

        await this.learner.recordPattern('tool_sequence', patternData);

        const pattern = await this.learner.getPattern('tool_sequence', 'tools:Read->Edit->Bash');

        this.assert(
            pattern !== null,
            'Pattern retrieved successfully'
        );

        this.assert(
            pattern.type === 'tool_sequence',
            'Pattern type matches'
        );

        this.assert(
            Array.isArray(pattern.data.tools) && pattern.data.tools.length === 3,
            'Pattern data parsed correctly'
        );

        this.assert(
            pattern.frequency === 1,
            'Frequency matches'
        );

        this.assert(
            typeof pattern.confidence === 'number',
            'Confidence is a number'
        );
    }

    /**
     * Test: Get frequent patterns
     */
    async testGetFrequentPatterns() {
        console.log('\n=== Test: Get Frequent Patterns ===\n');

        // Record multiple workflow patterns
        const workflows = [
            { sequence: ['architect', 'developer', 'qa'], frequency: 10 },
            { sequence: ['developer', 'code-reviewer', 'qa'], frequency: 8 },
            { sequence: ['planner', 'developer', 'devops'], frequency: 5 },
            { sequence: ['security-architect', 'developer', 'qa'], frequency: 3 }
        ];

        for (const wf of workflows) {
            for (let i = 0; i < wf.frequency; i++) {
                await this.learner.recordPattern('workflow', {
                    name: `workflow-${wf.sequence.join('-')}`,
                    sequence: wf.sequence
                });
            }
        }

        const patterns = await this.learner.getFrequentPatterns('workflow', 3, 0.1);

        this.assert(
            patterns.length <= 3,
            'Limit respected'
        );

        this.assert(
            patterns[0].frequency >= patterns[1].frequency,
            'Patterns sorted by frequency (descending)'
        );

        this.assert(
            patterns.every(p => p.confidence >= 0.1),
            'Minimum confidence threshold applied'
        );
    }

    /**
     * Test: Increment frequency
     */
    async testIncrementFrequency() {
        console.log('\n=== Test: Increment Frequency ===\n');

        const patternData = {
            errorType: 'TypeError',
            solution: 'add type checking'
        };

        const initialResult = await this.learner.recordPattern('error_pattern', patternData);
        const initialConfidence = initialResult.confidence;

        const updateResult = await this.learner.incrementFrequency(initialResult.id, 5);

        this.assert(
            updateResult.frequency === 6,
            'Frequency incremented correctly (1 + 5 = 6)'
        );

        this.assert(
            updateResult.confidence > initialConfidence,
            'Confidence increased after increment'
        );

        // Verify in database
        const pattern = await this.learner.getPattern('error_pattern', 'error:TypeError:add type checking');

        this.assert(
            pattern.frequency === 6,
            'Database reflects updated frequency'
        );
    }

    /**
     * Test: Get high-confidence patterns
     */
    async testGetHighConfidencePatterns() {
        console.log('\n=== Test: Get High-Confidence Patterns ===\n');

        // Create patterns with varying frequencies
        const patternData = { name: 'high-confidence-test', sequence: ['a', 'b'] };

        // Record 50 times to get high confidence
        for (let i = 0; i < 50; i++) {
            await this.learner.recordPattern('workflow', patternData);
        }

        const highConfPatterns = await this.learner.getHighConfidencePatterns(0.5, 10);

        this.assert(
            highConfPatterns.length > 0,
            'High-confidence patterns found'
        );

        this.assert(
            highConfPatterns.every(p => p.confidence >= 0.5),
            'All patterns meet minimum confidence threshold'
        );

        this.assert(
            highConfPatterns[0].confidence >= highConfPatterns[highConfPatterns.length - 1].confidence,
            'Patterns sorted by confidence (descending)'
        );
    }

    /**
     * Test: Get patterns for specific agent
     */
    async testGetPatternsForAgent() {
        console.log('\n=== Test: Get Patterns For Agent ===\n');

        // Record developer-specific patterns with higher frequency
        const devPatterns = [
            { sequence: ['developer', 'qa'], name: 'dev-workflow-1' },
            { sequence: ['developer', 'code-reviewer', 'qa'], name: 'dev-workflow-2' }
        ];

        for (const pattern of devPatterns) {
            for (let i = 0; i < 10; i++) {  // Increased from 5 to 10
                await this.learner.recordPattern('workflow', pattern);
            }
        }

        // Record architect patterns (should not be returned)
        await this.learner.recordPattern('workflow', {
            sequence: ['architect', 'developer'],
            name: 'arch-workflow'
        });

        const devWorkflows = await this.learner.getPatternsForAgent('developer', 5);

        this.assert(
            devWorkflows.length > 0,
            'Developer patterns found'
        );

        this.assert(
            devWorkflows.every(p => p.key.includes('developer')),
            'All patterns relate to developer agent'
        );
    }

    /**
     * Test: Cleanup low-confidence patterns
     */
    async testCleanupLowConfidencePatterns() {
        console.log('\n=== Test: Cleanup Low-Confidence Patterns ===\n');

        // Create a low-confidence pattern with old timestamp
        const lowConfPattern = {
            name: 'stale-pattern',
            sequence: ['test']
        };

        const result = await this.learner.recordPattern('workflow', lowConfPattern);

        // Manually update last_seen to 60 days ago
        this.db.prepare(`
            UPDATE learned_patterns
            SET last_seen = datetime('now', '-60 days')
            WHERE id = ?
        `).run(result.id);

        const cleanupResult = await this.learner.cleanupLowConfidencePatterns(0.3, 30);

        this.assert(
            cleanupResult.deleted >= 1,
            'Stale low-confidence pattern deleted'
        );

        // Verify pattern is gone
        const pattern = await this.learner.getPattern('workflow', 'workflow:test');

        this.assert(
            pattern === null,
            'Pattern no longer exists after cleanup'
        );
    }

    /**
     * Test: Get statistics
     */
    async testGetStatistics() {
        console.log('\n=== Test: Get Statistics ===\n');

        // Record various pattern types
        await this.learner.recordPattern('workflow', { sequence: ['a', 'b'] });
        await this.learner.recordPattern('tool_sequence', { tools: ['Read', 'Write'] });
        await this.learner.recordPattern('error_pattern', { errorType: 'Error', solution: 'fix' });

        const stats = await this.learner.getStatistics();

        this.assert(
            typeof stats.total === 'number' && stats.total > 0,
            'Total count available'
        );

        this.assert(
            typeof stats.byType === 'object',
            'Statistics grouped by type'
        );

        this.assert(
            Object.keys(stats.byType).length > 0,
            'Statistics contain pattern types'
        );

        this.assert(
            stats.byType.workflow && typeof stats.byType.workflow.avgConfidence === 'number',
            'Average confidence calculated'
        );
    }

    /**
     * Test: Performance - record pattern
     */
    async testPerformanceRecordPattern() {
        console.log('\n=== Test: Performance - Record Pattern ===\n');

        const patternData = {
            name: 'perf-test',
            sequence: ['agent1', 'agent2']
        };

        const startTime = Date.now();
        await this.learner.recordPattern('workflow', patternData);
        const duration = Date.now() - startTime;

        this.assert(
            duration < 5,
            `Record pattern completes in <5ms (actual: ${duration}ms)`
        );
    }

    /**
     * Test: Performance - get frequent patterns
     */
    async testPerformanceGetFrequentPatterns() {
        console.log('\n=== Test: Performance - Get Frequent Patterns ===\n');

        // Create 100 patterns
        for (let i = 0; i < 100; i++) {
            await this.learner.recordPattern('workflow', {
                name: `pattern-${i}`,
                sequence: [`agent-${i}`]
            });
        }

        const startTime = Date.now();
        await this.learner.getFrequentPatterns('workflow', 10);
        const duration = Date.now() - startTime;

        this.assert(
            duration < 10,
            `Get frequent patterns completes in <10ms (actual: ${duration}ms)`
        );
    }

    /**
     * Test: Error handling - invalid pattern type
     */
    async testErrorHandlingInvalidPatternType() {
        console.log('\n=== Test: Error Handling - Invalid Pattern Type ===\n');

        let errorCaught = false;

        try {
            await this.learner.recordPattern('invalid_type', { data: 'test' });
        } catch (error) {
            errorCaught = true;
            this.assert(
                error.message.includes('Invalid pattern type'),
                'Correct error message for invalid type'
            );
        }

        this.assert(
            errorCaught,
            'Error thrown for invalid pattern type'
        );
    }

    /**
     * Test: Error handling - invalid pattern data
     */
    async testErrorHandlingInvalidPatternData() {
        console.log('\n=== Test: Error Handling - Invalid Pattern Data ===\n');

        let errorCaught = false;

        try {
            await this.learner.recordPattern('workflow', null);
        } catch (error) {
            errorCaught = true;
            this.assert(
                error.message.includes('Pattern data must be'),
                'Correct error message for invalid data'
            );
        }

        this.assert(
            errorCaught,
            'Error thrown for invalid pattern data'
        );
    }

    /**
     * Test: Confidence calculation progression
     */
    async testConfidenceCalculation() {
        console.log('\n=== Test: Confidence Calculation ===\n');

        const patternData = {
            name: 'confidence-test',
            sequence: ['a', 'b']
        };

        const confidences = [];

        // Record pattern 100 times and track confidence
        for (let i = 0; i < 100; i++) {
            const result = await this.learner.recordPattern('workflow', patternData);
            if (i % 10 === 0) {
                confidences.push(result.confidence);
            }
        }

        this.assert(
            confidences.length > 0,
            'Confidence values tracked'
        );

        // Verify confidence increases monotonically
        let isMonotonic = true;
        for (let i = 1; i < confidences.length; i++) {
            if (confidences[i] < confidences[i - 1]) {
                isMonotonic = false;
                break;
            }
        }

        this.assert(
            isMonotonic,
            'Confidence increases monotonically'
        );

        this.assert(
            confidences[confidences.length - 1] < 1.0,
            'Confidence capped below 1.0'
        );

        this.assert(
            confidences[confidences.length - 1] > 0.5,
            'Confidence reaches useful threshold after many occurrences'
        );
    }

    /**
     * Run all tests
     */
    async runAll() {
        console.log('=== Pattern Learner Test Suite ===\n');

        try {
            await this.setup();

            // Run all tests
            await this.testInitialization();
            await this.testRecordNewPattern();
            await this.testRecordDuplicatePattern();
            await this.testGetPattern();
            await this.testGetFrequentPatterns();
            await this.testIncrementFrequency();
            await this.testGetHighConfidencePatterns();
            await this.testGetPatternsForAgent();
            await this.testCleanupLowConfidencePatterns();
            await this.testGetStatistics();
            await this.testPerformanceRecordPattern();
            await this.testPerformanceGetFrequentPatterns();
            await this.testErrorHandlingInvalidPatternType();
            await this.testErrorHandlingInvalidPatternData();
            await this.testConfidenceCalculation();

            // Print results
            console.log('\n=== Test Results ===');
            console.log(`Passed: ${this.results.passed}`);
            console.log(`Failed: ${this.results.failed}`);
            console.log(`Total: ${this.results.total}`);
            console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

            await this.teardown();

            return this.results.failed === 0;
        } catch (error) {
            console.error('\n❌ Test suite failed with error:', error);
            await this.teardown();
            return false;
        }
    }
}

// Run tests
const suite = new PatternLearnerTestSuite();
const success = await suite.runAll();

process.exit(success ? 0 : 1);
