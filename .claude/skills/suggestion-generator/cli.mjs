#!/usr/bin/env node

/**
 * Suggestion Generator CLI
 *
 * Command-line interface for managing suggestions.
 *
 * @module suggestion-generator/cli
 * @version 1.0.0
 */

import { program } from 'commander';
import {
  getByStatus,
  getPrioritized,
  getSuggestion,
  respondToSuggestion,
  getByAgent,
  expireStale,
  listSuggestions,
} from './queue-manager.mjs';
import { executeSuggestion, rollback } from './executor.mjs';

// Configure CLI
program.name('suggestion-generator').description('Manage agent suggestions').version('1.0.0');

// List suggestions command
program
  .command('list')
  .description('List suggestions with optional filters')
  .option('-s, --status <statuses>', 'Filter by status (comma-separated)')
  .option('-p, --priority <priorities>', 'Filter by priority (comma-separated)')
  .option('-t, --type <type>', 'Filter by type')
  .option('-a, --agent <agent>', 'Filter by agent')
  .option('-l, --limit <number>', 'Limit results', parseInt, 10)
  .option('-o, --offset <number>', 'Offset for pagination', parseInt, 0)
  .action(async options => {
    try {
      const filters = {
        status: options.status ? options.status.split(',') : undefined,
        priority: options.priority ? options.priority.split(',') : undefined,
        type: options.type,
        agent: options.agent,
        limit: options.limit,
        offset: options.offset,
      };

      const suggestions = await listSuggestions(filters);

      if (suggestions.length === 0) {
        console.log('No suggestions found.');
        return;
      }

      console.log(`\n📋 Found ${suggestions.length} suggestions:\n`);

      for (const suggestion of suggestions) {
        const icon = getPriorityIcon(suggestion.priority);
        console.log(`${icon} [${suggestion.priority}] ${suggestion.suggestion_id}`);
        console.log(`   Type: ${suggestion.type} | Agent: ${suggestion.agent}`);
        console.log(`   Status: ${suggestion.status}`);
        console.log(`   Created: ${new Date(suggestion.created_at).toLocaleString()}`);
        console.log('');
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Show suggestion details command
program
  .command('show <suggestion-id>')
  .description('Show detailed information for a suggestion')
  .action(async suggestionId => {
    try {
      const suggestion = await getSuggestion(suggestionId);

      if (!suggestion) {
        console.error(`Suggestion not found: ${suggestionId}`);
        process.exit(1);
      }

      console.log('\n📄 Suggestion Details\n');
      console.log('═'.repeat(80));
      console.log(`ID: ${suggestion.suggestion_id}`);
      console.log(`Type: ${suggestion.type}`);
      console.log(`Priority: ${suggestion.priority}`);
      console.log(`Status: ${suggestion.status}`);
      console.log('\n─'.repeat(80));
      console.log(`Title: ${suggestion.title}`);
      console.log(`Description: ${suggestion.description}`);
      console.log('\n─'.repeat(80));
      console.log('Action:');
      console.log(JSON.stringify(suggestion.action, null, 2));

      if (suggestion.impact) {
        console.log('\n─'.repeat(80));
        console.log('Impact:');
        console.log(`  Confidence: ${suggestion.impact.confidence}`);
        console.log(`  Risk Level: ${suggestion.impact.risk_level}`);
        console.log(`  Areas Affected: ${suggestion.impact.areas_affected?.join(', ') || 'N/A'}`);
      }

      if (suggestion.effort) {
        console.log('\n─'.repeat(80));
        console.log('Effort:');
        console.log(`  Complexity: ${suggestion.effort.complexity}`);
        console.log(`  Time Estimate: ${suggestion.effort.time_estimate}`);
        console.log(
          `  Recommended Agents: ${suggestion.effort.agents_recommended?.join(', ') || 'N/A'}`
        );
      }

      if (suggestion.user_response) {
        console.log('\n─'.repeat(80));
        console.log('User Response:');
        console.log(`  Action: ${suggestion.user_response.action_taken}`);
        console.log(`  Notes: ${suggestion.user_response.notes || 'N/A'}`);
        console.log(
          `  Responded At: ${new Date(suggestion.user_response.responded_at).toLocaleString()}`
        );
      }

      console.log('═'.repeat(80));
      console.log('');
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Accept suggestion command
program
  .command('accept <suggestion-id>')
  .description('Accept a suggestion')
  .option('-n, --notes <notes>', 'Add notes about the decision')
  .action(async (suggestionId, options) => {
    try {
      const result = await respondToSuggestion(suggestionId, {
        action: 'accepted',
        notes: options.notes,
      });

      if (!result) {
        console.error('Failed to accept suggestion');
        process.exit(1);
      }

      console.log(`✓ Suggestion accepted: ${suggestionId}`);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Reject suggestion command
program
  .command('reject <suggestion-id>')
  .description('Reject a suggestion')
  .option('-r, --reason <reason>', 'Reason for rejection')
  .action(async (suggestionId, options) => {
    try {
      const result = await respondToSuggestion(suggestionId, {
        action: 'rejected',
        notes: options.reason,
      });

      if (!result) {
        console.error('Failed to reject suggestion');
        process.exit(1);
      }

      console.log(`✓ Suggestion rejected: ${suggestionId}`);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Defer suggestion command
program
  .command('defer <suggestion-id>')
  .description('Defer a suggestion for later review')
  .option('-u, --until <date>', 'Defer until date (ISO format)')
  .option('-n, --notes <notes>', 'Add notes about deferral')
  .action(async (suggestionId, options) => {
    try {
      const result = await respondToSuggestion(suggestionId, {
        action: 'deferred',
        defer_until: options.until,
        notes: options.notes,
      });

      if (!result) {
        console.error('Failed to defer suggestion');
        process.exit(1);
      }

      console.log(`✓ Suggestion deferred: ${suggestionId}`);
      if (options.until) {
        console.log(`  Until: ${new Date(options.until).toLocaleString()}`);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Execute suggestion command
program
  .command('execute <suggestion-id>')
  .description('Execute an accepted suggestion')
  .action(async suggestionId => {
    try {
      console.log(`Executing suggestion: ${suggestionId}...`);

      const result = await executeSuggestion(suggestionId);

      if (result.success) {
        console.log(`✓ Execution successful (${result.duration_ms}ms)`);
        if (result.output) {
          console.log('\nOutput:');
          console.log(result.output);
        }
        if (result.artifacts_created?.length > 0) {
          console.log('\nArtifacts Created:');
          result.artifacts_created.forEach(artifact => {
            console.log(`  - ${artifact}`);
          });
        }
      } else {
        console.error(`✗ Execution failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Rollback suggestion command
program
  .command('rollback <suggestion-id>')
  .description('Rollback an executed suggestion')
  .action(async suggestionId => {
    try {
      console.log(`Rolling back suggestion: ${suggestionId}...`);

      const result = await rollback(suggestionId);

      if (result.success) {
        console.log(`✓ Rollback successful`);
      } else {
        console.error(`✗ Rollback failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Cleanup stale suggestions command
program
  .command('cleanup')
  .description('Expire stale suggestions')
  .option('-m, --max-age-hours <hours>', 'Maximum age in hours', parseInt, 72)
  .action(async options => {
    try {
      console.log(`Expiring suggestions older than ${options.maxAgeHours} hours...`);

      const count = await expireStale(options.maxAgeHours);

      console.log(`✓ Expired ${count} stale suggestions`);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Analytics command
program
  .command('analytics')
  .description('View suggestion analytics')
  .option('-d, --days <days>', 'Number of days to analyze', parseInt, 30)
  .action(async options => {
    try {
      // Get all suggestions
      const allSuggestions = await listSuggestions({});

      // Calculate metrics
      const totalCount = allSuggestions.length;
      const acceptedCount = allSuggestions.filter(
        s => s.status === 'accepted' || s.status === 'completed'
      ).length;
      const rejectedCount = allSuggestions.filter(s => s.status === 'rejected').length;
      const pendingCount = allSuggestions.filter(s => s.status === 'pending').length;

      const acceptanceRate = totalCount > 0 ? ((acceptedCount / totalCount) * 100).toFixed(1) : 0;

      // By priority
      const byPriority = {
        P0: allSuggestions.filter(s => s.priority === 'P0').length,
        P1: allSuggestions.filter(s => s.priority === 'P1').length,
        P2: allSuggestions.filter(s => s.priority === 'P2').length,
        P3: allSuggestions.filter(s => s.priority === 'P3').length,
      };

      // By type
      const typeCount = {};
      allSuggestions.forEach(s => {
        typeCount[s.type] = (typeCount[s.type] || 0) + 1;
      });

      console.log('\n📊 Suggestion Analytics\n');
      console.log('═'.repeat(80));
      console.log(`Total Suggestions: ${totalCount}`);
      console.log(`Accepted: ${acceptedCount}`);
      console.log(`Rejected: ${rejectedCount}`);
      console.log(`Pending: ${pendingCount}`);
      console.log(`Acceptance Rate: ${acceptanceRate}%`);
      console.log('\n─'.repeat(80));
      console.log('By Priority:');
      console.log(`  P0 (Critical): ${byPriority.P0}`);
      console.log(`  P1 (High): ${byPriority.P1}`);
      console.log(`  P2 (Medium): ${byPriority.P2}`);
      console.log(`  P3 (Low): ${byPriority.P3}`);
      console.log('\n─'.repeat(80));
      console.log('By Type:');
      Object.entries(typeCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
      console.log('═'.repeat(80));
      console.log('');
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Get icon for priority level
 *
 * @param {string} priority - Priority level
 * @returns {string} - Icon
 */
function getPriorityIcon(priority) {
  const icons = {
    P0: '🔴',
    P1: '🟠',
    P2: '🟡',
    P3: '🟢',
  };
  return icons[priority] || '⚪';
}

// Parse arguments and run
program.parse(process.argv);
