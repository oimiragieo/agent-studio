#!/usr/bin/env node
/**
 * Compliance Dashboard Generator
 * Tracks orchestrator compliance violations and generates reports
 *
 * Usage:
 *   node compliance-dashboard.mjs generate
 *   node compliance-dashboard.mjs generate --period 30d --format json
 *   node compliance-dashboard.mjs metrics
 *   node compliance-dashboard.mjs analyze --session-id <id>
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';

/**
 * Compliance Dashboard Generator
 */
class ComplianceDashboard {
  constructor() {
    this.violationsPath = '.claude/context/logs/orchestrator-violations.log';
    this.sessionsPath = '.claude/context/tmp/sessions/';
    this.reportsPath = '.claude/context/reports/compliance/';
  }

  /**
   * Generate compliance dashboard
   * @param {Object} options - Generation options
   * @param {string} options.period - Time period (1d, 7d, 30d, all)
   * @param {string} options.format - Output format (html, json, markdown)
   * @returns {Promise<Object>} Dashboard output
   */
  async generate(options = {}) {
    const period = options.period || '7d';
    const format = options.format || 'html';

    console.log(`Generating compliance dashboard for period: ${period}, format: ${format}`);

    const metrics = await this.calculateMetrics(period);
    const dashboard = this.createDashboard(metrics, format);

    // Ensure reports directory exists
    await mkdir(this.reportsPath, { recursive: true });

    const outputPath = join(
      this.reportsPath,
      `compliance-dashboard-${new Date().toISOString().split('T')[0]}.${format === 'html' ? 'html' : format === 'json' ? 'json' : 'md'}`
    );
    await writeFile(outputPath, dashboard);

    console.log(`Dashboard generated: ${outputPath}`);
    console.log(`Compliance Score: ${metrics.complianceScore}%`);

    return { outputPath: resolve(outputPath), metrics };
  }

  /**
   * Calculate compliance metrics
   * @param {string} period - Time period
   * @returns {Promise<Object>} Metrics
   */
  async calculateMetrics(period) {
    const violations = await this.loadViolations(period);
    const sessions = await this.loadSessions(period);

    return {
      complianceScore: this.calculateComplianceScore(violations),
      totalViolations: violations.length,
      violationsByType: this.groupByType(violations),
      violationsBySession: this.groupBySession(violations),
      violationsBySeverity: this.groupBySeverity(violations),
      timeSeries: this.createTimeSeries(violations),
      topViolators: this.findTopViolators(violations),
      trend: this.calculateTrend(violations),
      sessions: {
        total: sessions.length,
        clean: sessions.filter(s => s.violations.length === 0).length,
        violations: sessions.filter(s => s.violations.length > 0).length,
      },
    };
  }

  /**
   * Load violations from log file
   * @param {string} period - Time period
   * @returns {Promise<Array>} Violations
   */
  async loadViolations(period) {
    if (!existsSync(this.violationsPath)) {
      return [];
    }

    const content = await readFile(this.violationsPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const violations = [];

    const cutoffDate = this.getCutoffDate(period);

    for (const line of lines) {
      try {
        const violation = JSON.parse(line);
        const violationDate = new Date(violation.timestamp);

        if (violationDate >= cutoffDate) {
          violations.push(violation);
        }
      } catch (error) {
        // Skip malformed lines
      }
    }

    return violations;
  }

  /**
   * Load sessions from sessions directory
   * @param {string} period - Time period
   * @returns {Promise<Array>} Sessions
   */
  async loadSessions(period) {
    if (!existsSync(this.sessionsPath)) {
      return [];
    }

    const files = readdirSync(this.sessionsPath);
    const sessions = [];
    const cutoffDate = this.getCutoffDate(period);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = join(this.sessionsPath, file);
        const content = JSON.parse(await readFile(filePath, 'utf-8'));
        const sessionDate = new Date(content.created_at || 0);

        if (sessionDate >= cutoffDate) {
          sessions.push({
            session_id: content.session_id,
            created_at: content.created_at,
            violations: content.violations || [],
          });
        }
      } catch (error) {
        // Skip malformed files
      }
    }

    return sessions;
  }

  /**
   * Get cutoff date for period
   * @param {string} period - Time period (1d, 7d, 30d, all)
   * @returns {Date} Cutoff date
   */
  getCutoffDate(period) {
    const now = new Date();
    if (period === 'all') {
      return new Date(0); // Unix epoch
    }

    const match = period.match(/^(\d+)([dwmy])$/);
    if (!match) {
      throw new Error(`Invalid period format: ${period}. Use format like 1d, 7d, 30d, or 'all'`);
    }

    const [, amount, unit] = match;
    const milliseconds = {
      d: 24 * 60 * 60 * 1000, // days
      w: 7 * 24 * 60 * 60 * 1000, // weeks
      m: 30 * 24 * 60 * 60 * 1000, // months (approximate)
      y: 365 * 24 * 60 * 60 * 1000, // years (approximate)
    };

    return new Date(now - parseInt(amount) * milliseconds[unit]);
  }

  /**
   * Calculate compliance score (0-100%)
   * Formula: 100 - sum(violation_penalties)
   * @param {Array} violations - Violations
   * @returns {number} Compliance score
   */
  calculateComplianceScore(violations) {
    const penalties = {
      critical: 10,
      high: 5,
      medium: 2,
      low: 1,
    };

    let totalPenalty = 0;
    for (const violation of violations) {
      const severity = this.inferSeverity(violation);
      totalPenalty += penalties[severity] || 1;
    }

    // Cap at 0%
    return Math.max(0, 100 - totalPenalty);
  }

  /**
   * Infer severity from violation
   * @param {Object} violation - Violation
   * @returns {string} Severity level
   */
  inferSeverity(violation) {
    if (violation.severity) {
      return violation.severity;
    }

    // Infer from violation type
    if (violation.type === 'Write_BLOCKED' || violation.type === 'Edit_BLOCKED') {
      return 'high';
    } else if (violation.type === 'BASH_DANGEROUS_COMMAND') {
      return 'critical';
    } else if (violation.type === 'READ_LIMIT_EXCEEDED') {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Group violations by type
   * @param {Array} violations - Violations
   * @returns {Object} Violations grouped by type
   */
  groupByType(violations) {
    const types = {};
    for (const v of violations) {
      const tool = v.tool || 'unknown';
      types[tool] = (types[tool] || 0) + 1;
    }
    return types;
  }

  /**
   * Group violations by session
   * @param {Array} violations - Violations
   * @returns {Object} Violations grouped by session
   */
  groupBySession(violations) {
    const sessions = {};
    for (const v of violations) {
      const sessionId = v.session_id || 'unknown';
      sessions[sessionId] = (sessions[sessionId] || 0) + 1;
    }
    return sessions;
  }

  /**
   * Group violations by severity
   * @param {Array} violations - Violations
   * @returns {Object} Violations grouped by severity
   */
  groupBySeverity(violations) {
    const severities = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const v of violations) {
      const severity = this.inferSeverity(v);
      severities[severity] = (severities[severity] || 0) + 1;
    }
    return severities;
  }

  /**
   * Create time series of violations
   * @param {Array} violations - Violations
   * @returns {Array} Time series data
   */
  createTimeSeries(violations) {
    const series = {};
    for (const v of violations) {
      const date = new Date(v.timestamp).toISOString().split('T')[0];
      series[date] = (series[date] || 0) + 1;
    }

    return Object.entries(series)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Find top violators
   * @param {Array} violations - Violations
   * @returns {Array} Top violators
   */
  findTopViolators(violations) {
    const counts = this.groupByType(violations);
    return Object.entries(counts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Calculate trend
   * @param {Array} violations - Violations
   * @returns {string} Trend direction
   */
  calculateTrend(violations) {
    if (violations.length < 2) {
      return 'stable';
    }

    const sorted = violations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    if (secondHalf.length < firstHalf.length) {
      return 'improving';
    } else if (secondHalf.length > firstHalf.length) {
      return 'worsening';
    } else {
      return 'stable';
    }
  }

  /**
   * Create dashboard
   * @param {Object} metrics - Metrics
   * @param {string} format - Output format
   * @returns {string} Dashboard content
   */
  createDashboard(metrics, format) {
    if (format === 'html') {
      return this.generateHTML(metrics);
    } else if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    } else {
      return this.generateMarkdown(metrics);
    }
  }

  /**
   * Generate HTML dashboard with charts
   * @param {Object} metrics - Metrics
   * @returns {string} HTML content
   */
  generateHTML(metrics) {
    const scoreClass = metrics.complianceScore >= 80 ? 'high' : metrics.complianceScore >= 60 ? 'medium' : 'low';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orchestrator Compliance Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      padding: 40px;
      background: #f5f5f5;
      color: #333;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      color: #2c3e50;
    }

    .subtitle {
      color: #7f8c8d;
      margin-bottom: 40px;
      font-size: 1.1em;
    }

    .score {
      font-size: 4em;
      font-weight: bold;
      margin: 20px 0;
    }

    .score.high { color: #27ae60; }
    .score.medium { color: #f39c12; }
    .score.low { color: #e74c3c; }

    .metric {
      margin: 30px 0;
      padding: 25px;
      border: 1px solid #ecf0f1;
      border-radius: 4px;
      background: #fafafa;
    }

    .metric h2 {
      font-size: 1.5em;
      margin-bottom: 15px;
      color: #34495e;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }

    .metric ul {
      list-style: none;
      padding: 0;
    }

    .metric li {
      padding: 8px 0;
      border-bottom: 1px solid #ecf0f1;
    }

    .metric li:last-child {
      border-bottom: none;
    }

    .trend {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-weight: bold;
      margin-top: 10px;
    }

    .trend.improving {
      background: #d4edda;
      color: #155724;
    }

    .trend.worsening {
      background: #f8d7da;
      color: #721c24;
    }

    .trend.stable {
      background: #d1ecf1;
      color: #0c5460;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }

    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #ecf0f1;
    }

    th {
      background: #3498db;
      color: white;
      font-weight: bold;
    }

    tr:hover {
      background: #f8f9fa;
    }

    .timestamp {
      color: #7f8c8d;
      font-size: 0.9em;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Orchestrator Compliance Dashboard</h1>
    <p class="subtitle">Generated ${new Date().toLocaleString()}</p>

    <div class="metric">
      <h2>Overall Compliance Score</h2>
      <div class="score ${scoreClass}">
        ${metrics.complianceScore}%
      </div>
      <p>Score calculation: 100 - sum(violation penalties)</p>
      <p>Penalty weights: Critical=10, High=5, Medium=2, Low=1</p>
    </div>

    <div class="metric">
      <h2>Violations Summary</h2>
      <p><strong>Total Violations:</strong> ${metrics.totalViolations}</p>
      <table>
        <thead>
          <tr>
            <th>Tool</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(metrics.violationsByType).map(([type, count]) => `
          <tr>
            <td>${type}</td>
            <td>${count}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="metric">
      <h2>Violations by Severity</h2>
      <ul>
        ${Object.entries(metrics.violationsBySeverity).map(([severity, count]) => `
        <li><strong>${severity.charAt(0).toUpperCase() + severity.slice(1)}:</strong> ${count}</li>
        `).join('')}
      </ul>
    </div>

    <div class="metric">
      <h2>Session Statistics</h2>
      <ul>
        <li><strong>Total Sessions:</strong> ${metrics.sessions.total}</li>
        <li><strong>Clean Sessions:</strong> ${metrics.sessions.clean} (${metrics.sessions.total > 0 ? (metrics.sessions.clean / metrics.sessions.total * 100).toFixed(1) : 0}%)</li>
        <li><strong>Sessions with Violations:</strong> ${metrics.sessions.violations}</li>
      </ul>
    </div>

    <div class="metric">
      <h2>Top Violators</h2>
      <table>
        <thead>
          <tr>
            <th>Tool</th>
            <th>Violations</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.topViolators.map((v, index) => `
          <tr>
            <td>${index + 1}. ${v.tool}</td>
            <td>${v.count}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="metric">
      <h2>Trend Analysis</h2>
      <div class="trend ${metrics.trend}">
        ${metrics.trend === 'improving' ? '✅ Improving' : metrics.trend === 'worsening' ? '❌ Worsening' : '➖ Stable'}
      </div>
    </div>

    ${metrics.timeSeries.length > 0 ? `
    <div class="metric">
      <h2>Violations Over Time</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.timeSeries.map(ts => `
          <tr>
            <td>${ts.date}</td>
            <td>${ts.count}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <p class="timestamp">Generated: ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;
  }

  /**
   * Generate markdown dashboard
   * @param {Object} metrics - Metrics
   * @returns {string} Markdown content
   */
  generateMarkdown(metrics) {
    const scoreEmoji = metrics.complianceScore >= 80 ? '🟢' : metrics.complianceScore >= 60 ? '🟡' : '🔴';

    return `# Orchestrator Compliance Dashboard

**Generated:** ${new Date().toLocaleString()}

## Overall Compliance Score

${scoreEmoji} **${metrics.complianceScore}%**

Score calculation: 100 - sum(violation penalties)
Penalty weights: Critical=10, High=5, Medium=2, Low=1

## Violations Summary

**Total Violations:** ${metrics.totalViolations}

| Tool | Count |
|------|-------|
${Object.entries(metrics.violationsByType).map(([type, count]) => `| ${type} | ${count} |`).join('\n')}

## Violations by Severity

${Object.entries(metrics.violationsBySeverity).map(([severity, count]) => `- **${severity.charAt(0).toUpperCase() + severity.slice(1)}:** ${count}`).join('\n')}

## Session Statistics

- **Total Sessions:** ${metrics.sessions.total}
- **Clean Sessions:** ${metrics.sessions.clean} (${metrics.sessions.total > 0 ? (metrics.sessions.clean / metrics.sessions.total * 100).toFixed(1) : 0}%)
- **Sessions with Violations:** ${metrics.sessions.violations}

## Top Violators

${metrics.topViolators.map((v, index) => `${index + 1}. **${v.tool}:** ${v.count} violations`).join('\n')}

## Trend Analysis

${metrics.trend === 'improving' ? '✅ **Improving**' : metrics.trend === 'worsening' ? '❌ **Worsening**' : '➖ **Stable**'}

${metrics.timeSeries.length > 0 ? `## Violations Over Time

| Date | Count |
|------|-------|
${metrics.timeSeries.map(ts => `| ${ts.date} | ${ts.count} |`).join('\n')}
` : ''}

---

*Generated: ${new Date().toISOString()}*
`;
  }

  /**
   * Analyze specific session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Session analysis
   */
  async analyzeSession(sessionId) {
    const violations = await this.loadViolations('all');
    const sessionViolations = violations.filter(v => v.session_id === sessionId);

    return {
      session_id: sessionId,
      total_violations: sessionViolations.length,
      violations_by_type: this.groupByType(sessionViolations),
      violations_by_severity: this.groupBySeverity(sessionViolations),
      compliance_score: this.calculateComplianceScore(sessionViolations),
      violations: sessionViolations,
    };
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const [,, command, ...args] = process.argv;
  const dashboard = new ComplianceDashboard();

  if (command === 'generate') {
    const periodIndex = args.indexOf('--period');
    const formatIndex = args.indexOf('--format');

    const options = {
      period: periodIndex !== -1 ? args[periodIndex + 1] : '7d',
      format: formatIndex !== -1 ? args[formatIndex + 1] : 'html',
    };

    dashboard.generate(options)
      .then(result => {
        console.log(`\nDashboard saved to: ${result.outputPath}`);
      })
      .catch(error => {
        console.error('Error generating dashboard:', error.message);
        process.exit(1);
      });
  } else if (command === 'metrics') {
    const periodIndex = args.indexOf('--period');
    const period = periodIndex !== -1 ? args[periodIndex + 1] : '7d';

    dashboard.calculateMetrics(period)
      .then(metrics => {
        console.log('\nCompliance Metrics:');
        console.log(`Compliance Score: ${metrics.complianceScore}%`);
        console.log(`Total Violations: ${metrics.totalViolations}`);
        console.log(`\nViolations by Type:`);
        Object.entries(metrics.violationsByType).forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
        console.log(`\nTrend: ${metrics.trend}`);
      })
      .catch(error => {
        console.error('Error calculating metrics:', error.message);
        process.exit(1);
      });
  } else if (command === 'analyze') {
    const sessionIdIndex = args.indexOf('--session-id');

    if (sessionIdIndex === -1 || !args[sessionIdIndex + 1]) {
      console.error('Usage: node compliance-dashboard.mjs analyze --session-id <id>');
      process.exit(1);
    }

    const sessionId = args[sessionIdIndex + 1];

    dashboard.analyzeSession(sessionId)
      .then(analysis => {
        console.log(`\nSession Analysis: ${analysis.session_id}`);
        console.log(`Total Violations: ${analysis.total_violations}`);
        console.log(`Compliance Score: ${analysis.compliance_score}%`);
        console.log(`\nViolations by Type:`);
        Object.entries(analysis.violations_by_type).forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
      })
      .catch(error => {
        console.error('Error analyzing session:', error.message);
        process.exit(1);
      });
  } else {
    console.log('Usage:');
    console.log('  node compliance-dashboard.mjs generate [--period <1d|7d|30d|all>] [--format <html|json|markdown>]');
    console.log('  node compliance-dashboard.mjs metrics [--period <1d|7d|30d|all>]');
    console.log('  node compliance-dashboard.mjs analyze --session-id <id>');
  }
}

export default ComplianceDashboard;
