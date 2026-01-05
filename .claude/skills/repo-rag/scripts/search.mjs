#!/usr/bin/env node
/**
 * Repo RAG - High-recall codebase retrieval using multiple search strategies
 *
 * Usage:
 *   node search.mjs --query "authentication patterns"
 *   node search.mjs --query "class UserService" --type symbol
 *   node search.mjs --query "error handling" --path src/ --limit 20
 *   node search.mjs --query "authentication middleware" --extensions ts,js
 *   node search.mjs --query "payment processing" --format markdown
 *
 * Outputs conforming JSON to skill-repo-rag-output.schema.json
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, dirname, relative, extname, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../../..');

// Default configuration
const DEFAULT_LIMIT = 10;
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.mjs', '.cjs', '.vue', '.svelte'];
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'coverage'];

/**
 * Parse command-line arguments
 */
function parseArgs(args) {
  const parsed = {
    query: null,
    path: null,
    limit: DEFAULT_LIMIT,
    type: 'hybrid', // hybrid, keyword, symbol, semantic, path
    extensions: null,
    format: 'json',
    threshold: 0.3 // minimum relevance score
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--query' && args[i + 1]) {
      parsed.query = args[++i];
    } else if (arg === '--path' && args[i + 1]) {
      parsed.path = args[++i];
    } else if (arg === '--limit' && args[i + 1]) {
      parsed.limit = parseInt(args[++i], 10);
    } else if (arg === '--type' && args[i + 1]) {
      parsed.type = args[++i];
    } else if (arg === '--extensions' && args[i + 1]) {
      parsed.extensions = args[++i].split(',').map(e => e.trim().startsWith('.') ? e.trim() : `.${e.trim()}`);
    } else if (arg === '--format' && args[i + 1]) {
      parsed.format = args[++i];
    } else if (arg === '--threshold' && args[i + 1]) {
      parsed.threshold = parseFloat(args[++i]);
    }
  }

  return parsed;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Repo RAG - High-recall codebase retrieval

Usage:
  node search.mjs --query "search query" [options]

Options:
  --query <query>       Search query (required)
  --path <path>         Target directory to search (default: current dir)
  --limit <n>           Maximum results to return (default: 10)
  --type <type>         Search type: hybrid, keyword, symbol, semantic, path (default: hybrid)
  --extensions <exts>   Comma-separated file extensions (default: ts,tsx,js,jsx,py,mjs,cjs,vue,svelte)
  --format <format>     Output format: json, markdown (default: json)
  --threshold <n>       Minimum relevance score 0-1 (default: 0.3)

Examples:
  node search.mjs --query "authentication patterns"
  node search.mjs --query "class UserService" --type symbol
  node search.mjs --query "error handling" --path src/ --limit 20
  node search.mjs --query "authentication middleware" --extensions ts,js
  `);
}

/**
 * Extract keywords from query
 */
function extractKeywords(query) {
  // Remove common words
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'can', 'could', 'may', 'might', 'must']);

  // Split on non-word characters and filter
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)]; // unique keywords
}

/**
 * Generate semantic expansions (simple synonym/related term mapping)
 */
function expandQuerySemantics(query) {
  const expansions = {
    'auth': ['authentication', 'authorize', 'login', 'signin', 'session', 'token', 'jwt', 'oauth'],
    'authentication': ['auth', 'login', 'signin', 'credential', 'password', 'token'],
    'user': ['account', 'profile', 'member', 'customer'],
    'error': ['exception', 'failure', 'fault', 'bug', 'issue'],
    'handle': ['process', 'manage', 'deal', 'catch'],
    'database': ['db', 'storage', 'repository', 'model', 'schema'],
    'api': ['endpoint', 'route', 'handler', 'controller', 'service'],
    'test': ['spec', 'unittest', 'integration', 'e2e'],
    'component': ['widget', 'element', 'module', 'part'],
    'function': ['method', 'procedure', 'routine', 'fn'],
    'class': ['type', 'interface', 'struct', 'object'],
    'config': ['configuration', 'settings', 'options', 'setup']
  };

  const keywords = extractKeywords(query);
  const expanded = new Set(keywords);

  keywords.forEach(keyword => {
    if (expansions[keyword]) {
      expansions[keyword].forEach(term => expanded.add(term));
    }
  });

  return Array.from(expanded);
}

/**
 * Recursively scan directory for files
 */
async function scanDirectory(dirPath, extensions) {
  const files = [];

  async function scan(currentPath) {
    try {
      const entries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // Skip excluded directories
          if (EXCLUDE_DIRS.includes(entry.name)) continue;
          await scan(fullPath);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (extensions.includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');
              const stats = await stat(fullPath);
              files.push({
                path: fullPath,
                relativePath: relative(PROJECT_ROOT, fullPath),
                content,
                lineCount: content.split('\n').length,
                extension: ext,
                size: stats.size
              });
            } catch (error) {
              // Skip files that can't be read
              console.error(`Warning: Failed to read ${fullPath}: ${error.message}`);
            }
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be accessed
      console.error(`Warning: Failed to scan ${currentPath}: ${error.message}`);
    }
  }

  await scan(dirPath);
  return files;
}

/**
 * Extract symbols (functions, classes, types) from file
 */
function extractSymbols(file) {
  const symbols = [];
  const lines = file.content.split('\n');

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Function declarations
    const funcMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      symbols.push({
        name: funcMatch[1],
        type: 'function',
        line: idx + 1,
        signature: trimmed
      });
    }

    // Arrow functions
    const arrowMatch = trimmed.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/);
    if (arrowMatch) {
      symbols.push({
        name: arrowMatch[1],
        type: 'function',
        line: idx + 1,
        signature: trimmed
      });
    }

    // Class declarations
    const classMatch = trimmed.match(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        type: 'class',
        line: idx + 1,
        signature: trimmed
      });
    }

    // Interface/Type declarations (TypeScript)
    const interfaceMatch = trimmed.match(/(?:export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      symbols.push({
        name: interfaceMatch[1],
        type: 'interface',
        line: idx + 1,
        signature: trimmed
      });
    }

    const typeMatch = trimmed.match(/(?:export\s+)?type\s+(\w+)/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[1],
        type: 'type',
        line: idx + 1,
        signature: trimmed
      });
    }

    // Python class/function
    if (file.extension === '.py') {
      const pyClassMatch = trimmed.match(/class\s+(\w+)/);
      if (pyClassMatch) {
        symbols.push({
          name: pyClassMatch[1],
          type: 'class',
          line: idx + 1,
          signature: trimmed
        });
      }

      const pyFuncMatch = trimmed.match(/def\s+(\w+)/);
      if (pyFuncMatch) {
        symbols.push({
          name: pyFuncMatch[1],
          type: 'function',
          line: idx + 1,
          signature: trimmed
        });
      }
    }
  });

  return symbols;
}

/**
 * Search strategy: Keyword search
 */
function keywordSearch(files, keywords) {
  const results = [];

  files.forEach(file => {
    const lines = file.content.split('\n');
    const lowerContent = file.content.toLowerCase();

    // Calculate keyword matches
    let matchCount = 0;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) matchCount += matches.length;
    });

    if (matchCount === 0) return;

    // Find specific line matches
    lines.forEach((line, idx) => {
      const lowerLine = line.toLowerCase();
      let lineMatchCount = 0;

      keywords.forEach(keyword => {
        if (lowerLine.includes(keyword)) lineMatchCount++;
      });

      if (lineMatchCount > 0) {
        // Get context (3 lines before and after)
        const contextStart = Math.max(0, idx - 3);
        const contextEnd = Math.min(lines.length, idx + 4);
        const context = lines.slice(contextStart, contextEnd).join('\n');

        // Calculate relevance based on keyword density
        const relevance = Math.min(1.0, (lineMatchCount / keywords.length) + (matchCount / 100));

        results.push({
          file: file.relativePath,
          line: idx + 1,
          column: line.indexOf(keywords[0]) + 1,
          match_type: 'keyword',
          relevance_score: relevance,
          context,
          snippet: line.trim(),
          keywords_matched: keywords.filter(k => lowerLine.includes(k))
        });
      }
    });
  });

  return results;
}

/**
 * Search strategy: Symbol search
 */
function symbolSearch(files, query) {
  const results = [];
  const queryLower = query.toLowerCase();
  const keywords = extractKeywords(query);

  files.forEach(file => {
    const symbols = extractSymbols(file);

    symbols.forEach(symbol => {
      const nameLower = symbol.name.toLowerCase();
      let matchScore = 0;

      // Exact match
      if (nameLower === queryLower) {
        matchScore = 1.0;
      }
      // Contains query
      else if (nameLower.includes(queryLower)) {
        matchScore = 0.8;
      }
      // Keyword match
      else {
        const matched = keywords.filter(k => nameLower.includes(k));
        if (matched.length > 0) {
          matchScore = 0.5 + (matched.length / keywords.length) * 0.3;
        }
      }

      if (matchScore > 0) {
        // Get context around symbol
        const lines = file.content.split('\n');
        const contextStart = Math.max(0, symbol.line - 4);
        const contextEnd = Math.min(lines.length, symbol.line + 10);
        const context = lines.slice(contextStart, contextEnd).join('\n');

        results.push({
          file: file.relativePath,
          line: symbol.line,
          column: 1,
          match_type: 'symbol',
          relevance_score: matchScore,
          context,
          snippet: symbol.signature,
          symbol: {
            name: symbol.name,
            type: symbol.type,
            signature: symbol.signature
          }
        });
      }
    });
  });

  return results;
}

/**
 * Search strategy: Semantic search (keyword expansion)
 */
function semanticSearch(files, query) {
  const expandedTerms = expandQuerySemantics(query);
  return keywordSearch(files, expandedTerms);
}

/**
 * Search strategy: Path search
 */
function pathSearch(files, query) {
  const results = [];
  const queryLower = query.toLowerCase();
  const keywords = extractKeywords(query);

  files.forEach(file => {
    const pathLower = file.relativePath.toLowerCase();
    let matchScore = 0;

    // Direct path match
    if (pathLower.includes(queryLower)) {
      matchScore = 0.9;
    }
    // Keyword in path
    else {
      const matched = keywords.filter(k => pathLower.includes(k));
      if (matched.length > 0) {
        matchScore = 0.6 + (matched.length / keywords.length) * 0.3;
      }
    }

    if (matchScore > 0) {
      results.push({
        file: file.relativePath,
        line: 1,
        column: 1,
        match_type: 'path',
        relevance_score: matchScore,
        context: file.content.split('\n').slice(0, 10).join('\n'), // First 10 lines
        snippet: `File path: ${file.relativePath}`
      });
    }
  });

  return results;
}

/**
 * Hybrid search combining all strategies
 */
function hybridSearch(files, query, keywords) {
  const keywordResults = keywordSearch(files, keywords);
  const symbolResults = symbolSearch(files, query);
  const semanticResults = semanticSearch(files, query);
  const pathResults = pathSearch(files, query);

  // Merge results (deduplicate by file+line)
  const merged = new Map();

  [...keywordResults, ...symbolResults, ...semanticResults, ...pathResults].forEach(result => {
    const key = `${result.file}:${result.line}`;

    if (!merged.has(key)) {
      merged.set(key, result);
    } else {
      // Keep higher relevance score
      const existing = merged.get(key);
      if (result.relevance_score > existing.relevance_score) {
        merged.set(key, result);
      }
    }
  });

  return Array.from(merged.values());
}

/**
 * Execute search based on type
 */
function executeSearch(files, query, type) {
  const keywords = extractKeywords(query);
  const startTime = Date.now();

  let results = [];
  let strategiesUsed = [];

  switch (type) {
    case 'keyword':
      results = keywordSearch(files, keywords);
      strategiesUsed = ['keyword'];
      break;
    case 'symbol':
      results = symbolSearch(files, query);
      strategiesUsed = ['symbol'];
      break;
    case 'semantic':
      results = semanticSearch(files, query);
      strategiesUsed = ['semantic'];
      break;
    case 'path':
      results = pathSearch(files, query);
      strategiesUsed = ['path'];
      break;
    case 'hybrid':
    default:
      results = hybridSearch(files, query, keywords);
      strategiesUsed = ['keyword', 'symbol', 'semantic', 'path'];
      break;
  }

  const duration = Date.now() - startTime;

  return { results, strategiesUsed, duration };
}

/**
 * Rank and filter results
 */
function rankResults(results, limit, threshold) {
  // Sort by relevance (descending)
  const sorted = results.sort((a, b) => b.relevance_score - a.relevance_score);

  // Filter by threshold
  const filtered = sorted.filter(r => r.relevance_score >= threshold);

  // Limit results
  return filtered.slice(0, limit);
}

/**
 * Calculate summary statistics
 */
function calculateSummary(results, files) {
  const topFiles = [...new Set(results.map(r => r.file))].slice(0, 5);

  const symbolTypes = new Set();
  results.forEach(r => {
    if (r.symbol) {
      symbolTypes.add(r.symbol.type);
    }
  });

  const matchTypes = new Map();
  results.forEach(r => {
    matchTypes.set(r.match_type, (matchTypes.get(r.match_type) || 0) + 1);
  });

  return {
    top_files: topFiles,
    symbol_types_found: Array.from(symbolTypes),
    match_type_distribution: Object.fromEntries(matchTypes),
    recommendations: generateRecommendations(results)
  };
}

/**
 * Generate recommendations based on results
 */
function generateRecommendations(results) {
  const recommendations = [];

  if (results.length === 0) {
    recommendations.push('No results found. Try broadening your search query.');
  } else if (results.length < 3) {
    recommendations.push('Few results found. Consider using semantic search or hybrid mode.');
  }

  const symbolMatches = results.filter(r => r.match_type === 'symbol').length;
  if (symbolMatches > results.length * 0.7) {
    recommendations.push('Most matches are symbols. Consider reviewing symbol definitions.');
  }

  const avgScore = results.reduce((sum, r) => sum + r.relevance_score, 0) / results.length;
  if (avgScore < 0.5) {
    recommendations.push('Low average relevance. Try refining your query with more specific terms.');
  }

  return recommendations;
}

/**
 * Validate output against schema
 */
async function validateOutput(output, schemaPath) {
  try {
    const schemaContent = await readFile(join(PROJECT_ROOT, schemaPath), 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Basic validation - check required fields
    const requiredFields = schema.required || [];
    for (const field of requiredFields) {
      if (!(field in output)) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('Schema validation failed:', err.message);
    return false;
  }
}

/**
 * Format output according to schema
 */
function formatOutput(query, files, searchResults, args) {
  const { results, strategiesUsed, duration } = searchResults;
  const rankedResults = rankResults(results, args.limit, args.threshold);
  const summary = calculateSummary(rankedResults, files);

  return {
    skill_name: 'repo-rag',
    query,
    query_type: args.type,
    results_count: rankedResults.length,
    files_searched: files.map(f => f.relativePath).slice(0, 100), // Limit to first 100 files
    semantic_matches: rankedResults.map(r => ({
      file: r.file,
      line_start: r.line,
      line_end: r.line,
      relevance_score: Math.round(r.relevance_score * 100) / 100,
      snippet: r.snippet,
      match_type: r.match_type,
      context: r.context
    })),
    search_metadata: {
      total_files_scanned: files.length,
      total_lines_analyzed: files.reduce((sum, f) => sum + f.lineCount, 0),
      search_duration_ms: duration
    },
    filters_applied: {
      file_extensions: args.extensions || DEFAULT_EXTENSIONS,
      directories: args.path ? [args.path] : []
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Format as markdown
 */
function formatMarkdown(output) {
  const lines = [];

  lines.push('# Repo RAG Search Results\n');
  lines.push(`**Query**: ${output.input.query}`);
  lines.push(`**Strategy**: ${output.search.strategies_used.join(', ')}`);
  lines.push(`**Files Scanned**: ${output.search.files_scanned}`);
  lines.push(`**Matches Found**: ${output.search.matches_found}`);
  lines.push(`**Duration**: ${output.execution.duration_ms}ms\n`);

  if (output.results.length === 0) {
    lines.push('*No results found.*\n');
  } else {
    lines.push('## Results\n');

    output.results.forEach((result, idx) => {
      lines.push(`### ${idx + 1}. ${result.file}:${result.line}`);
      lines.push(`- **Type**: ${result.match_type}`);
      lines.push(`- **Relevance**: ${(result.relevance_score * 100).toFixed(0)}%`);

      if (result.symbol) {
        lines.push(`- **Symbol**: ${result.symbol.type} \`${result.symbol.name}\``);
      }

      lines.push('\n```');
      lines.push(result.snippet);
      lines.push('```\n');
    });
  }

  if (output.summary.recommendations.length > 0) {
    lines.push('## Recommendations\n');
    output.summary.recommendations.forEach(rec => {
      lines.push(`- ${rec}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Main execution
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.query) {
    showHelp();
    process.exit(1);
  }

  try {
    const searchPath = args.path ? join(PROJECT_ROOT, args.path) : PROJECT_ROOT;
    const extensions = args.extensions || DEFAULT_EXTENSIONS;

    // Scan directory for files
    const files = await scanDirectory(searchPath, extensions);

    if (files.length === 0) {
      console.error('No files found to search');
      process.exit(1);
    }

    // Execute search
    const searchResults = executeSearch(files, args.query, args.type);

    // Format output
    const output = formatOutput(args.query, files, searchResults, args);

    // Validate output
    const schemaPath = '.claude/schemas/skill-repo-rag-output.schema.json';
    const isValid = await validateOutput(output, schemaPath);

    if (!isValid) {
      console.error('Warning: Output does not conform to schema');
    }

    // Output result
    if (args.format === 'markdown') {
      console.log(formatMarkdown(output));
    } else {
      console.log(JSON.stringify(output, null, 2));
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:')) {
  const modulePath = fileURLToPath(import.meta.url);
  if (process.argv[1] === modulePath || process.argv[1] === modulePath.replace(/\\/g, '/')) {
    main();
  }
}

export { executeSearch, extractSymbols, keywordSearch, symbolSearch, semanticSearch, pathSearch };
