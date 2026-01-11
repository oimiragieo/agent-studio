#!/usr/bin/env node
/**
 * Task Complexity Classifier
 *
 * Classifies incoming tasks by complexity to determine which gates are required:
 * - trivial: Single file, <50 lines -> No plan, no review
 * - simple: Single file, <200 lines -> No plan, yes review
 * - moderate: 2-5 files, single module -> Yes plan, yes review
 * - complex: 5+ files, cross-module -> Yes plan, yes review, yes impact analysis
 * - critical: Architecture/API changes -> Yes plan, yes review, yes impact analysis
 *
 * Usage:
 *   node task-classifier.mjs --task "Add user authentication to the app"
 *   node task-classifier.mjs --task "Fix typo in README"
 *   node task-classifier.mjs --task "Refactor all API endpoints" --files "src/api/**"
 *
 * Programmatic:
 *   import { classifyTask } from './task-classifier.mjs';
 *   const result = classifyTask(taskDescription, options);
 */

import { readdir, stat, access } from 'fs/promises';
import { join, dirname, resolve, normalize, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { constants } from 'fs';

const __filename = fileURLToPath(import.meta.url);

// Security: Allowed base path for file operations
const ALLOWED_BASE_PATH = process.cwd();

// Security: Input validation limits (MEDIUM-3)
const MAX_TASK_DESCRIPTION_LENGTH = 10000;
const MAX_FILE_PATTERN_LENGTH = 500;
const MAX_FILE_PATTERNS = 50;

// Security: Cache size limit (MEDIUM-5)
const MAX_CACHE_ENTRIES = 100;

// Security: Keywords that enforce complexity floor (MEDIUM-4)
const SECURITY_KEYWORDS = [
  'authentication',
  'authorization',
  'security',
  'password',
  'credential',
  'token',
  'oauth',
  'jwt',
  'encryption',
  'secret',
  'permission',
  'access control',
];

// Lazy-load glob to reduce startup time (Priority 2)
let _glob = null;
let _globChecked = false;

async function getGlob() {
  if (_globChecked) return _glob;
  _globChecked = true;
  try {
    const globModule = await import('glob');
    _glob = globModule.glob;
  } catch {
    _glob = null;
  }
  return _glob;
}

/**
 * Sanitize file pattern to prevent path traversal attacks (HIGH-1, HIGH-2)
 * @param {string} pattern - File pattern to sanitize
 * @returns {string} Sanitized pattern
 * @throws {Error} If pattern contains malicious components
 */
function sanitizePattern(pattern) {
  // Validate input type
  if (typeof pattern !== 'string') {
    throw new Error('File pattern must be a string');
  }

  // Validate length (MEDIUM-3)
  if (pattern.length > MAX_FILE_PATTERN_LENGTH) {
    throw new Error(`File pattern exceeds maximum length of ${MAX_FILE_PATTERN_LENGTH} characters`);
  }

  // Block absolute paths (HIGH-1)
  if (isAbsolute(pattern)) {
    throw new Error('Absolute paths are not allowed in file patterns');
  }

  // Block parent directory traversal (HIGH-1)
  if (pattern.includes('..')) {
    throw new Error('Parent directory traversal (..) is not allowed');
  }

  // Block null bytes and other injection attempts (HIGH-2)
  if (pattern.includes('\0') || pattern.includes('\x00')) {
    throw new Error('Null bytes are not allowed in file patterns');
  }

  // Block shell metacharacters that could lead to injection (HIGH-2)
  const dangerousChars = /[;&|`$()]/;
  if (dangerousChars.test(pattern)) {
    throw new Error('Shell metacharacters are not allowed in file patterns');
  }

  // Normalize and verify within base path (HIGH-1)
  const normalized = normalize(pattern);
  const resolved = resolve(ALLOWED_BASE_PATH, normalized);

  if (!resolved.startsWith(ALLOWED_BASE_PATH)) {
    throw new Error('Pattern resolves outside allowed directory');
  }

  return normalized;
}

/**
 * Simple glob-like pattern matching fallback
 * @param {string} pattern - Glob pattern
 * @param {Object} options - Options
 * @returns {Promise<string[]>} Matched files
 */
async function simpleGlob(pattern, options = {}) {
  // Sanitize pattern before use (HIGH-1, HIGH-2)
  const sanitized = sanitizePattern(pattern);

  // For basic patterns without wildcards, just check if file exists
  if (!sanitized.includes('*') && !sanitized.includes('{')) {
    const resolved = resolve(ALLOWED_BASE_PATH, sanitized);
    try {
      // Replace existsSync with async version (Priority 4)
      await access(resolved, constants.F_OK);
      const stats = await stat(resolved);
      if (stats.isFile()) {
        return [sanitized];
      }
    } catch (error) {
      // File doesn't exist or can't be accessed
    }
    return [];
  }

  // For patterns with wildcards, return empty and let heuristics handle it
  return [];
}
const __dirname = dirname(__filename);

// Glob result caching to prevent repeated disk scans (Priority 3)
const globCache = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds
const MAX_RESOLVED_FILES = 1000; // Prevent unbounded memory (Priority 5)

/**
 * Cached glob resolution with size limit enforcement (MEDIUM-5)
 * @param {string} pattern - Glob pattern
 * @param {Object} options - Glob options
 * @returns {Promise<string[]>} Matched files
 */
async function cachedGlobResolve(pattern, options) {
  // Sanitize pattern before use (HIGH-1, HIGH-2)
  const sanitized = sanitizePattern(pattern);

  const key = `${sanitized}|${JSON.stringify(options)}`;
  const cached = globCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  const globFn = (await getGlob()) || simpleGlob;
  const results = await globFn(sanitized, options);

  // Limit resolved files to prevent unbounded memory (Priority 5)
  const limitedResults = results.slice(0, MAX_RESOLVED_FILES);

  // Enforce cache size limit - evict oldest entry when full (MEDIUM-5)
  if (globCache.size >= MAX_CACHE_ENTRIES) {
    // Find and delete oldest entry
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [cacheKey, cacheValue] of globCache.entries()) {
      if (cacheValue.timestamp < oldestTime) {
        oldestTime = cacheValue.timestamp;
        oldestKey = cacheKey;
      }
    }

    if (oldestKey) {
      globCache.delete(oldestKey);
    }
  }

  globCache.set(key, { results: limitedResults, timestamp: Date.now() });
  return limitedResults;
}

/**
 * Complexity levels with their gate requirements
 */
const COMPLEXITY_LEVELS = {
  trivial: {
    level: 'trivial',
    description: 'Single file, minimal changes (<50 lines)',
    gates: {
      planner: false,
      review: false,
      impactAnalysis: false,
    },
  },
  simple: {
    level: 'simple',
    description: 'Single file, moderate changes (<200 lines)',
    gates: {
      planner: false,
      review: true,
      impactAnalysis: false,
    },
  },
  moderate: {
    level: 'moderate',
    description: '2-5 files, single module',
    gates: {
      planner: true,
      review: true,
      impactAnalysis: false,
    },
  },
  complex: {
    level: 'complex',
    description: '5+ files, cross-module changes',
    gates: {
      planner: true,
      review: true,
      impactAnalysis: true,
    },
  },
  critical: {
    level: 'critical',
    description: 'Architecture, API, or breaking changes',
    gates: {
      planner: true,
      review: true,
      impactAnalysis: true,
    },
  },
};

/**
 * Task type indicators with primary agent assignments
 */
const TASK_TYPE_INDICATORS = {
  UI_UX: {
    keywords: [
      'ui',
      'ux',
      'design',
      'wireframe',
      'interface',
      'tailwind',
      'css',
      'component',
      'layout',
      'styling',
      'theme',
      'button',
      'form',
      'alignment',
    ],
    patterns: [
      /ui\s+(design|fix|update|bug)/i,
      /user\s+interface/i,
      /wireframe/i,
      /mockup/i,
      /button\s+(alignment|issue|fix)/i,
      /form\s+(issue|fix|alignment)/i,
    ],
    primaryAgent: 'ux-expert',
    weight: 100,
  },
  MOBILE: {
    keywords: [
      'mobile',
      'ios',
      'android',
      'react native',
      'flutter',
      'swift',
      'kotlin',
      'app store',
    ],
    patterns: [/mobile\s+(app|dev)/i, /(ios|android)/i, /react\s+native/i],
    primaryAgent: 'mobile-developer',
    weight: 100,
  },
  DATABASE: {
    keywords: ['database', 'schema', 'migration', 'sql', 'postgresql', 'mongodb', 'query', 'index'],
    patterns: [/database|schema|migration/i, /sql\s+(query|table)/i],
    primaryAgent: 'database-architect',
    weight: 100,
  },
  API: {
    keywords: ['api design', 'rest', 'graphql', 'grpc', 'openapi', 'endpoint'],
    patterns: [/api\s+(design|endpoint)/i, /(rest|graphql|grpc)\s+api/i],
    primaryAgent: 'api-designer',
    weight: 100,
  },
  SECURITY: {
    keywords: ['security', 'auth', 'encryption', 'vulnerability', 'oauth', 'jwt', 'audit'],
    patterns: [
      /security|auth|encrypt/i,
      /vulnerability\s+(scan|fix)/i,
      /security\s+audit/i,
      /audit\s+(authentication|security)/i,
    ],
    primaryAgent: 'security-architect',
    weight: 100,
  },
  PERFORMANCE: {
    keywords: ['performance', 'optimize', 'profiling', 'benchmark', 'latency', 'slow'],
    patterns: [/performance|optimize|slow/i, /latency|throughput/i],
    primaryAgent: 'performance-engineer',
    weight: 100,
  },
  AI_LLM: {
    keywords: ['ai', 'llm', 'prompt', 'rag', 'embeddings', 'chatbot', 'claude', 'gpt'],
    patterns: [/ai\s+system|llm|prompt/i, /rag|embeddings/i],
    primaryAgent: 'llm-architect',
    weight: 100,
  },
  LEGACY: {
    keywords: ['legacy', 'modernize', 'migrate', 'upgrade', 'rewrite', 'obsolete'],
    patterns: [/legacy|modernize|migrate/i, /upgrade\s+(from|to)/i],
    primaryAgent: 'legacy-modernizer',
    weight: 100,
  },
  INCIDENT: {
    keywords: ['incident', 'outage', 'emergency', 'production issue', 'crisis', 'down'],
    patterns: [/incident|outage|emergency/i, /production\s+(issue|down)/i],
    primaryAgent: 'incident-responder',
    weight: 100,
  },
  COMPLIANCE: {
    keywords: ['gdpr', 'hipaa', 'soc2', 'pci', 'compliance', 'regulation'],
    patterns: [
      /gdpr|hipaa/i,
      /(soc2|pci)\s+(audit|compliance)/i,
      /compliance\s+(audit|review)/i,
      /gdpr\s+compliance/i,
    ],
    primaryAgent: 'compliance-auditor',
    weight: 100,
  },
  INFRASTRUCTURE: {
    keywords: ['infrastructure', 'deployment', 'ci/cd', 'kubernetes', 'docker', 'terraform'],
    patterns: [/infrastructure|deployment|devops/i, /(kubernetes|docker|terraform)/i],
    primaryAgent: 'devops',
    weight: 100,
  },
  DOCUMENTATION: {
    keywords: ['documentation', 'docs', 'readme', 'guide', 'tutorial', 'api docs'],
    patterns: [/documentation|docs|readme/i, /(guide|tutorial)\s+for/i],
    primaryAgent: 'technical-writer',
    weight: 100,
  },
  RESEARCH: {
    keywords: ['research', 'analysis', 'requirements', 'feasibility', 'investigate'],
    patterns: [/research|analysis|investigate/i, /feasibility\s+(study|analysis)/i],
    primaryAgent: 'analyst',
    weight: 100,
  },
  PRODUCT: {
    keywords: ['prd', 'product', 'user story', 'epic', 'backlog', 'roadmap'],
    patterns: [/product|user\s+story|backlog/i, /(prd|epic|roadmap)/i],
    primaryAgent: 'pm',
    weight: 100,
  },
  ARCHITECTURE: {
    keywords: ['architecture', 'system design', 'technology stack', 'scalability'],
    patterns: [/architecture|system\s+design/i, /(scalability|tech\s+stack)/i],
    primaryAgent: 'architect',
    weight: 100,
  },
  REFACTORING: {
    keywords: ['refactor', 'code smell', 'clean code', 'technical debt', 'maintainability'],
    patterns: [/refactor|tech\s+debt/i, /code\s+(smell|quality)/i],
    primaryAgent: 'refactoring-specialist',
    weight: 100,
  },
  IMPLEMENTATION: {
    keywords: ['implement', 'code', 'feature', 'bug fix', 'develop', 'build'],
    patterns: [/implement|feature|bug/i, /(develop|build)\s+(new|a)/i],
    primaryAgent: 'developer',
    weight: 50, // Lower weight - default fallback
  },
};

/**
 * Keywords that indicate higher complexity
 */
const COMPLEXITY_INDICATORS = {
  // Critical complexity indicators (architecture/API/breaking changes)
  critical: {
    keywords: [
      'architecture',
      'redesign',
      'breaking change',
      'major version',
      'schema migration',
      'database migration',
      'api redesign',
      'infrastructure',
      'security overhaul',
      'authentication system',
      'authorization system',
      'core refactor',
      'system redesign',
      'microservices',
      'monolith',
      'platform migration',
    ],
    patterns: [
      /breaking\s+change/i,
      /major\s+version/i,
      /schema\s+migrat/i,
      /database\s+migrat/i,
      /api\s+(redesign|overhaul|v\d)/i,
      /architect(ure|ural)\s+(change|redesign|overhaul)/i,
      /security\s+(overhaul|redesign|audit)/i,
      /auth(entication|orization)\s+system/i,
      /platform\s+migrat/i,
      /infrastructure\s+(change|update|migration)/i,
    ],
    weight: 100,
  },

  // Complex indicators (cross-module, multi-file)
  complex: {
    keywords: [
      'refactor',
      'migration',
      'integration',
      'across',
      'all',
      'every',
      'entire',
      'throughout',
      'global',
      'multiple modules',
      'cross-module',
      'end-to-end',
      'full-stack',
      'comprehensive',
      'system-wide',
    ],
    patterns: [
      /refactor\s+(all|every|entire)/i,
      /across\s+(all|multiple|the\s+entire)/i,
      /(all|every|entire)\s+(files?|modules?|components?)/i,
      /end[- ]to[- ]end/i,
      /full[- ]stack/i,
      /cross[- ]module/i,
      /system[- ]wide/i,
      /comprehensive\s+(refactor|update|change)/i,
    ],
    weight: 50,
  },

  // Moderate indicators (feature work)
  moderate: {
    keywords: [
      'feature',
      'implement',
      'add',
      'create',
      'build',
      'update',
      'modify',
      'enhance',
      'improve',
      'extend',
      'component',
      'module',
      'service',
      'endpoint',
    ],
    patterns: [
      /add\s+(new\s+)?(feature|functionality)/i,
      /implement\s+(new\s+)?/i,
      /create\s+(new\s+)?(component|module|service)/i,
      /build\s+(out|new)/i,
      /enhance\s+(the\s+)?/i,
      /extend\s+(the\s+)?/i,
    ],
    weight: 20,
  },

  // Simple indicators (single file changes)
  simple: {
    keywords: [
      'fix',
      'update',
      'change',
      'modify',
      'adjust',
      'tweak',
      'correct',
      'patch',
      'hotfix',
    ],
    patterns: [
      /fix\s+(a\s+)?(bug|issue|problem)/i,
      /update\s+(the\s+)?/i,
      /change\s+(the\s+)?/i,
      /correct\s+(the\s+)?/i,
      /hotfix/i,
    ],
    weight: 10,
  },

  // Trivial indicators (documentation, typos)
  trivial: {
    keywords: [
      'typo',
      'spelling',
      'grammar',
      'readme',
      'comment',
      'documentation',
      'docs',
      'changelog',
      'license',
      'formatting',
      'whitespace',
      'lint',
    ],
    patterns: [
      /fix\s+(a\s+)?typo/i,
      /spelling\s+(error|mistake|fix)/i,
      /update\s+(the\s+)?(readme|docs?|documentation)/i,
      /add\s+comment/i,
      /formatting\s+(fix|change)/i,
      /lint(ing)?\s+(fix|error)/i,
      /whitespace/i,
    ],
    weight: 5,
  },
};

/**
 * Cross-module indicators (directories that suggest cross-cutting changes)
 */
const CROSS_MODULE_PATTERNS = [
  /src\/.*\/.*\//, // Nested directories
  /\*\*\//, // Glob patterns with recursive search
  /\{.*,.*\}/, // Multiple file patterns
  /(components|pages|api|services|utils|lib|hooks)/, // Multiple concern areas
];

/**
 * File scope indicators
 */
const FILE_SCOPE_PATTERNS = {
  single: [/single\s+file/i, /one\s+file/i, /this\s+file/i, /just\s+(the\s+)?file/i],
  multiple: [
    /multiple\s+files?/i,
    /several\s+files?/i,
    /many\s+files?/i,
    /all\s+files?/i,
    /\d+\s+files?/i,
  ],
};

/**
 * Analyze task type to determine primary agent
 * @param {string} task - Task description
 * @returns {Object} Task type analysis with primary agent
 */
function analyzeTaskType(task) {
  const taskLower = task.toLowerCase();
  const scores = {};

  // Calculate scores for each task type
  for (const [type, indicators] of Object.entries(TASK_TYPE_INDICATORS)) {
    scores[type] = 0;

    // Check keywords
    for (const keyword of indicators.keywords) {
      if (taskLower.includes(keyword)) {
        scores[type] += indicators.weight;
      }
    }

    // Check patterns with higher weight
    for (const pattern of indicators.patterns) {
      if (pattern.test(task)) {
        scores[type] += indicators.weight * 1.5;
      }
    }
  }

  // Find highest scoring type
  let maxScore = 0;
  let taskType = 'IMPLEMENTATION'; // Default

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      taskType = type;
    }
  }

  return {
    taskType,
    primaryAgent: TASK_TYPE_INDICATORS[taskType].primaryAgent,
    confidence: maxScore,
    allScores: scores,
  };
}

/**
 * Analyze task description for complexity indicators
 * @param {string} task - Task description
 * @returns {Object} Analysis results with scores and matched indicators
 */
function analyzeTaskDescription(task) {
  const analysis = {
    scores: {
      critical: 0,
      complex: 0,
      moderate: 0,
      simple: 0,
      trivial: 0,
    },
    matchedIndicators: [],
    fileScopeHint: null,
  };

  const taskLower = task.toLowerCase();

  // Check each complexity level
  for (const [level, indicators] of Object.entries(COMPLEXITY_INDICATORS)) {
    // Check keywords
    for (const keyword of indicators.keywords) {
      if (taskLower.includes(keyword)) {
        analysis.scores[level] += indicators.weight;
        analysis.matchedIndicators.push({
          level,
          type: 'keyword',
          match: keyword,
        });
      }
    }

    // Check patterns
    for (const pattern of indicators.patterns) {
      if (pattern.test(task)) {
        analysis.scores[level] += indicators.weight * 1.5; // Patterns get higher weight
        analysis.matchedIndicators.push({
          level,
          type: 'pattern',
          match: pattern.toString(),
        });
      }
    }
  }

  // Check file scope hints
  for (const pattern of FILE_SCOPE_PATTERNS.single) {
    if (pattern.test(task)) {
      analysis.fileScopeHint = 'single';
      break;
    }
  }

  if (!analysis.fileScopeHint) {
    for (const pattern of FILE_SCOPE_PATTERNS.multiple) {
      if (pattern.test(task)) {
        analysis.fileScopeHint = 'multiple';
        break;
      }
    }
  }

  return analysis;
}

/**
 * Analyze file patterns for complexity
 * @param {string|string[]} files - File patterns or paths
 * @returns {Promise<Object>} File analysis results
 */
async function analyzeFilePatterns(files) {
  if (!files) {
    return {
      count: 0,
      patterns: [],
      isCrossModule: false,
      directories: new Set(),
    };
  }

  const patterns = Array.isArray(files) ? files : [files];

  // Validate pattern count (MEDIUM-3)
  if (patterns.length > MAX_FILE_PATTERNS) {
    throw new Error(
      `Number of file patterns (${patterns.length}) exceeds maximum allowed (${MAX_FILE_PATTERNS})`
    );
  }

  // Sanitize all patterns before processing (HIGH-1, HIGH-2)
  const sanitizedPatterns = patterns.map(pattern => {
    if (typeof pattern !== 'string') {
      throw new Error('All file patterns must be strings');
    }
    return sanitizePattern(pattern);
  });

  const analysis = {
    count: 0,
    patterns: sanitizedPatterns,
    isCrossModule: false,
    directories: new Set(),
    resolvedFiles: [],
  };

  // Check for cross-module patterns
  for (const pattern of sanitizedPatterns) {
    for (const crossModulePattern of CROSS_MODULE_PATTERNS) {
      if (crossModulePattern.test(pattern)) {
        analysis.isCrossModule = true;
        break;
      }
    }

    // Try to resolve glob patterns using cached resolver
    try {
      const matches = await cachedGlobResolve(pattern, {
        nodir: true,
        ignore: ['node_modules/**', '.git/**'],
      });

      if (matches && matches.length > 0) {
        analysis.resolvedFiles.push(...matches);

        // Extract directories
        for (const file of matches) {
          const dir = dirname(file);
          analysis.directories.add(dir);
        }
      } else if (pattern.includes('*') || pattern.includes('{')) {
        // Pattern couldn't be resolved, estimate from pattern
        if (pattern.includes('**')) {
          analysis.isCrossModule = true;
          analysis.count += 10; // Estimate for recursive patterns
        } else if (pattern.includes('*')) {
          analysis.count += 5; // Estimate for single-level wildcards
        }
      } else {
        // Single file pattern
        analysis.count += 1;
      }
    } catch (error) {
      // Glob resolution failed, estimate from pattern
      if (pattern.includes('**')) {
        analysis.isCrossModule = true;
        analysis.count += 10; // Estimate for recursive patterns
      } else if (pattern.includes('*')) {
        analysis.count += 5; // Estimate for single-level wildcards
      } else {
        analysis.count += 1;
      }
    }
  }

  // Update count from resolved files
  if (analysis.resolvedFiles.length > 0) {
    analysis.count = analysis.resolvedFiles.length;
  }

  // Multiple directories suggests cross-module
  if (analysis.directories.size > 2) {
    analysis.isCrossModule = true;
  }

  return analysis;
}

/**
 * Determine final complexity level based on analysis
 * @param {Object} taskAnalysis - Task description analysis
 * @param {Object} fileAnalysis - File pattern analysis
 * @param {string} taskDescription - Original task description for security checks
 * @returns {Object} Complexity determination
 */
function determineComplexity(taskAnalysis, fileAnalysis, taskDescription = '') {
  const { scores, fileScopeHint } = taskAnalysis;
  const { count: fileCount, isCrossModule, directories } = fileAnalysis;

  // Start with score-based determination
  let complexity = 'moderate'; // Default
  let maxScore = 0;

  for (const [level, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      complexity = level;
    }
  }

  // Security keyword floor - security-related tasks cannot be downgraded below 'complex' (MEDIUM-4)
  const taskLower = taskDescription.toLowerCase();
  const hasSecurityKeyword = SECURITY_KEYWORDS.some(keyword => taskLower.includes(keyword));
  const complexityLevels = ['trivial', 'simple', 'moderate', 'complex', 'critical'];
  const currentIndex = complexityLevels.indexOf(complexity);
  const complexIndex = complexityLevels.indexOf('complex');

  if (hasSecurityKeyword && currentIndex < complexIndex) {
    complexity = 'complex';
  }

  // Adjust based on file analysis
  if (fileCount > 0) {
    if (fileCount === 1 && !isCrossModule) {
      // Single file - cap at simple unless critical indicators
      if (complexity !== 'critical') {
        complexity = scores.trivial > scores.simple ? 'trivial' : 'simple';
      }
    } else if (fileCount > 5 || isCrossModule) {
      // Many files or cross-module - at least complex
      if (complexity !== 'critical') {
        complexity = 'complex';
      }
    } else if (fileCount >= 2 && fileCount <= 5) {
      // 2-5 files - at least moderate
      if (['trivial', 'simple'].includes(complexity)) {
        complexity = 'moderate';
      }
    }
  }

  // Apply file scope hints from task description
  if (fileScopeHint === 'single' && complexity === 'moderate') {
    complexity = 'simple';
  } else if (fileScopeHint === 'multiple' && complexity === 'simple') {
    complexity = 'moderate';
  }

  // Build reasoning
  const reasons = [];

  if (maxScore > 0) {
    const topIndicators = taskAnalysis.matchedIndicators
      .filter(i => i.level === complexity)
      .slice(0, 3)
      .map(i => i.match);
    if (topIndicators.length > 0) {
      reasons.push(`Keywords detected: ${topIndicators.join(', ')}`);
    }
  }

  if (fileCount > 0) {
    reasons.push(`Affects ${fileCount} file${fileCount !== 1 ? 's' : ''}`);
  }

  if (isCrossModule) {
    reasons.push('Cross-module changes detected');
  }

  if (directories.size > 1) {
    reasons.push(`Spans ${directories.size} directories`);
  }

  if (fileScopeHint) {
    reasons.push(`Task mentions ${fileScopeHint} file scope`);
  }

  // Add security keyword reasoning (MEDIUM-4)
  if (hasSecurityKeyword) {
    reasons.push('Security-related task (minimum complexity: complex)');
  }

  return {
    complexity,
    reasons,
    scores,
    fileCount,
    isCrossModule,
    directoryCount: directories.size,
  };
}

/**
 * Classify a task by complexity
 * @param {string} taskDescription - Description of the task
 * @param {Object} options - Classification options
 * @param {string|string[]} options.files - File patterns affected by the task
 * @param {boolean} options.verbose - Include detailed analysis in output
 * @returns {Promise<Object>} Classification result
 */
export async function classifyTask(taskDescription, options = {}) {
  if (!taskDescription || typeof taskDescription !== 'string') {
    throw new Error('Task description is required and must be a string');
  }

  // Validate task description length (MEDIUM-3)
  if (taskDescription.length > MAX_TASK_DESCRIPTION_LENGTH) {
    throw new Error(
      `Task description exceeds maximum length of ${MAX_TASK_DESCRIPTION_LENGTH} characters`
    );
  }

  // Analyze task type
  const typeAnalysis = analyzeTaskType(taskDescription);

  // Analyze task description
  const taskAnalysis = analyzeTaskDescription(taskDescription);

  // Analyze file patterns (includes sanitization and validation)
  const fileAnalysis = await analyzeFilePatterns(options.files);

  // Determine complexity (includes security keyword floor check)
  const determination = determineComplexity(taskAnalysis, fileAnalysis, taskDescription);

  // Get gate requirements
  const complexityConfig = COMPLEXITY_LEVELS[determination.complexity];

  // Build result
  const result = {
    complexity: determination.complexity,
    taskType: typeAnalysis.taskType,
    primaryAgent: typeAnalysis.primaryAgent,
    gates: { ...complexityConfig.gates },
    reasoning: determination.reasons.join('. ') || 'Default classification based on task scope',
  };

  // Add verbose details if requested
  if (options.verbose) {
    result.details = {
      description: complexityConfig.description,
      taskTypeAnalysis: {
        confidence: typeAnalysis.confidence,
        allScores: typeAnalysis.allScores,
      },
      analysis: {
        taskIndicators: taskAnalysis.matchedIndicators,
        scores: determination.scores,
        fileCount: determination.fileCount,
        isCrossModule: determination.isCrossModule,
        directoryCount: determination.directoryCount,
      },
      filePatterns: fileAnalysis.patterns,
      resolvedFiles: (fileAnalysis.resolvedFiles || []).slice(0, 20), // Limit for readability
    };
  }

  return result;
}

/**
 * Classify multiple tasks in batch with parallel processing (Priority 1)
 * @param {Array<{task: string, files?: string|string[]}>} tasks - Tasks to classify
 * @param {Object} options - Classification options
 * @param {number} options.concurrency - Max concurrent classifications (default: 10)
 * @returns {Promise<Array>} Classification results
 */
export async function classifyTasks(tasks, options = {}) {
  const CONCURRENCY_LIMIT = options.concurrency || 10;
  const results = [];

  // Process in batches to limit concurrent operations
  for (let i = 0; i < tasks.length; i += CONCURRENCY_LIMIT) {
    const batch = tasks.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map(async taskInfo => {
        const result = await classifyTask(taskInfo.task, {
          files: taskInfo.files,
          ...options,
        });
        return { task: taskInfo.task, ...result };
      })
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Get complexity level configuration
 * @param {string} level - Complexity level name
 * @returns {Object|null} Level configuration or null if not found
 */
export function getComplexityLevel(level) {
  return COMPLEXITY_LEVELS[level] || null;
}

/**
 * Get all complexity levels
 * @returns {Object} All complexity level configurations
 */
export function getAllComplexityLevels() {
  return { ...COMPLEXITY_LEVELS };
}

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs(args) {
  const parsed = {
    task: null,
    files: null,
    verbose: false,
    help: false,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--task' || arg === '-t') {
      parsed.task = args[++i];
    } else if (arg === '--files' || arg === '-f') {
      parsed.files = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.verbose = true;
    } else if (arg === '--json' || arg === '-j') {
      parsed.json = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }

  return parsed;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Task Complexity Classifier

Classifies tasks by complexity to determine required workflow gates.

USAGE:
  node task-classifier.mjs --task <description> [options]

OPTIONS:
  --task, -t <desc>    Task description to classify (required)
  --files, -f <glob>   File patterns affected by the task
  --verbose, -v        Include detailed analysis in output
  --json, -j           Output as JSON (default for programmatic use)
  --help, -h           Show this help message

COMPLEXITY LEVELS:
  trivial   Single file, <50 lines     -> No plan, no review
  simple    Single file, <200 lines    -> No plan, yes review
  moderate  2-5 files, single module   -> Yes plan, yes review
  complex   5+ files, cross-module     -> Yes plan, yes review, yes impact
  critical  Architecture/API changes   -> Yes plan, yes review, yes impact

EXAMPLES:
  node task-classifier.mjs --task "Fix typo in README"
  node task-classifier.mjs --task "Add user authentication" --verbose
  node task-classifier.mjs --task "Refactor all API endpoints" --files "src/api/**"
  node task-classifier.mjs --task "Database schema migration" --json

PROGRAMMATIC USE:
  import { classifyTask } from './task-classifier.mjs';
  const result = await classifyTask("Add new feature", { files: "src/**" });
`);
}

/**
 * Format result for console output
 * @param {Object} result - Classification result
 * @param {boolean} verbose - Include verbose details
 * @returns {string} Formatted output
 */
function formatResult(result, verbose = false) {
  const lines = [];

  // Complexity badge
  const badges = {
    trivial: '[TRIVIAL]',
    simple: '[SIMPLE]',
    moderate: '[MODERATE]',
    complex: '[COMPLEX]',
    critical: '[CRITICAL]',
  };

  lines.push(`\nComplexity: ${badges[result.complexity]} ${result.complexity.toUpperCase()}`);
  lines.push(`Task Type:  ${result.taskType}`);
  lines.push(`Primary Agent: ${result.primaryAgent}`);
  lines.push(`\nReasoning: ${result.reasoning}`);

  // Gates
  lines.push('\nRequired Gates:');
  lines.push(`  Planner:        ${result.gates.planner ? 'Yes' : 'No'}`);
  lines.push(`  Review:         ${result.gates.review ? 'Yes' : 'No'}`);
  lines.push(`  Impact Analysis: ${result.gates.impactAnalysis ? 'Yes' : 'No'}`);

  // Verbose details
  if (verbose && result.details) {
    lines.push('\nDetailed Analysis:');
    lines.push(`  Description: ${result.details.description}`);
    lines.push(`  File Count: ${result.details.analysis.fileCount}`);
    lines.push(`  Cross-Module: ${result.details.analysis.isCrossModule ? 'Yes' : 'No'}`);
    lines.push(`  Directories: ${result.details.analysis.directoryCount}`);

    if (result.details.analysis.taskIndicators.length > 0) {
      lines.push('\n  Matched Indicators:');
      for (const indicator of result.details.analysis.taskIndicators.slice(0, 5)) {
        lines.push(`    - [${indicator.level}] ${indicator.type}: ${indicator.match}`);
      }
    }

    if (result.details.resolvedFiles && result.details.resolvedFiles.length > 0) {
      lines.push('\n  Resolved Files:');
      for (const file of result.details.resolvedFiles.slice(0, 10)) {
        lines.push(`    - ${file}`);
      }
      if (result.details.resolvedFiles.length > 10) {
        lines.push(`    ... and ${result.details.resolvedFiles.length - 10} more`);
      }
    }
  }

  return lines.join('\n');
}

// CLI interface
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.task) {
    console.error('Error: Task description is required. Use --task <description>');
    console.error('Use --help for usage information.');
    process.exit(1);
  }

  try {
    const result = await classifyTask(args.task, {
      files: args.files,
      verbose: args.verbose,
    });

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatResult(result, args.verbose));
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch(console.error);
}

export { analyzeTaskType, TASK_TYPE_INDICATORS };

export default {
  classifyTask,
  classifyTasks,
  getComplexityLevel,
  getAllComplexityLevels,
  analyzeTaskType,
  COMPLEXITY_LEVELS,
  TASK_TYPE_INDICATORS,
};
