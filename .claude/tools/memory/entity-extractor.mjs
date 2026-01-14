/**
 * Entity Extractor
 *
 * Extracts entities from text, JSON, and structured data
 * Supports 6 entity types with regex-based Named Entity Recognition
 *
 * Performance Targets:
 * - Text extraction: <50ms
 * - JSON extraction: <30ms
 * - Classification accuracy: >85%
 *
 * Entity Types:
 * - PERSON: Developers, users, stakeholders
 * - ORGANIZATION: Companies, teams, projects
 * - TOOL: Technologies, frameworks, libraries
 * - PROJECT: Repositories, initiatives
 * - DECISION: Technical decisions, ADRs
 * - ARTIFACT: Files, documents, outputs
 */

/**
 * Entity types enumeration
 */
export const ENTITY_TYPES = {
  PERSON: 'person',
  ORGANIZATION: 'organization',
  TOOL: 'tool',
  PROJECT: 'project',
  DECISION: 'decision',
  ARTIFACT: 'artifact',
};

/**
 * Entity Extractor Class
 */
export class EntityExtractor {
  constructor() {
    // Regex patterns for entity extraction
    this.patterns = {
      // Person: GitHub username (@user), capitalized names (John Doe)
      person: [
        /@([a-zA-Z0-9_-]+)/g, // GitHub usernames
        /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g, // Full names (capitalized)
      ],

      // Organization: Company names, Team names
      organization: [
        /\b(?:Team|Squad|Group)\s+([A-Z][a-zA-Z0-9\s]+)/gi,
        /\b([A-Z][a-zA-Z0-9]+\s+(?:Inc|LLC|Corp|Ltd|Team|Labs))\b/gi,
      ],

      // Tool: npm packages, frameworks, programming languages
      tool: [
        /\b(React|Vue|Angular|Node\.js|Python|TypeScript|JavaScript|Java|Go|Rust|Ruby)\b/gi,
        /\b(npm|pnpm|yarn|pip|cargo|gradle|maven)\b/gi,
        /\b(Express|FastAPI|Django|Flask|Spring|Rails)\b/gi,
        /\b(PostgreSQL|MySQL|MongoDB|Redis|SQLite)\b/gi,
        /\b(Docker|Kubernetes|AWS|GCP|Azure)\b/gi,
      ],

      // Project: Repository names (org/repo), project names
      project: [
        /\b([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)\b/g, // org/repo format
        /\b([A-Z][a-zA-Z0-9-]+\s+[Pp]roject)\b/g,
      ],

      // Decision: Decision markers
      decision: [
        /(?:decided to|chose to|will use|selected)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:for|to|as|in)|[.,;])/gi,
      ],

      // Artifact: File paths, URLs, document names
      artifact: [
        /\b([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)\b/g, // Filenames with extensions
        /https?:\/\/[^\s]+/g, // URLs
        /\b([A-Z][a-zA-Z0-9]+\.(?:md|json|yaml|yml|txt|pdf|docx))\b/g, // Document names
      ],
    };

    // Common tools for faster classification
    this.knownTools = new Set([
      'react',
      'vue',
      'angular',
      'node.js',
      'python',
      'typescript',
      'javascript',
      'java',
      'go',
      'rust',
      'ruby',
      'express',
      'fastapi',
      'django',
      'flask',
      'spring',
      'rails',
      'postgresql',
      'mysql',
      'mongodb',
      'redis',
      'sqlite',
      'docker',
      'kubernetes',
      'aws',
      'gcp',
      'azure',
      'npm',
      'pnpm',
      'yarn',
      'pip',
      'cargo',
    ]);
  }

  /**
   * Extract entities from text
   *
   * @param {string} text - Text to extract entities from
   * @returns {Array} Extracted entities
   */
  extractFromText(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const entities = [];
    const seenValues = new Set(); // Deduplicate

    // Extract each entity type
    for (const [type, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        const matches = text.matchAll(pattern);

        for (const match of matches) {
          const value = match[1] || match[0];
          const normalizedValue = value.trim().toLowerCase();

          // Skip if already seen or too short
          if (seenValues.has(normalizedValue) || value.length < 2) {
            continue;
          }

          // Get context (50 chars before and after)
          const matchIndex = match.index || 0;
          const contextStart = Math.max(0, matchIndex - 50);
          const contextEnd = Math.min(text.length, matchIndex + value.length + 50);
          const context = text.substring(contextStart, contextEnd);

          // Calculate confidence based on pattern strength
          const confidence = this.calculateConfidence(type, value, pattern);

          entities.push({
            type,
            value: value.trim(),
            confidence,
            context: context.trim(),
            source: 'text_extraction',
          });

          seenValues.add(normalizedValue);
        }
      }
    }

    return entities;
  }

  /**
   * Extract entities from JSON data
   *
   * @param {object} data - JSON data to extract entities from
   * @returns {Array} Extracted entities
   */
  extractFromJSON(data) {
    if (!data || typeof data !== 'object') {
      return [];
    }

    const entities = [];
    const seenValues = new Set();

    // Recursively extract entities from JSON
    const extract = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (value === null || value === undefined) {
          continue;
        }

        // Classify based on key name
        const classification = this.classifyByKey(key, value);

        if (classification) {
          const normalizedValue =
            typeof value === 'string' ? value.toLowerCase() : JSON.stringify(value).toLowerCase();

          if (!seenValues.has(normalizedValue)) {
            entities.push({
              type: classification.type,
              value: typeof value === 'string' ? value : JSON.stringify(value),
              confidence: classification.confidence,
              context: `Key: ${key}, Path: ${currentPath}`,
              source: 'json_extraction',
            });

            seenValues.add(normalizedValue);
          }
        }

        // Recurse for nested objects
        if (typeof value === 'object' && !Array.isArray(value)) {
          extract(value, currentPath);
        }

        // Process arrays
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              extract(item, `${currentPath}[${index}]`);
            } else if (typeof item === 'string') {
              // Treat array items as entities based on parent key
              const classification = this.classifyByKey(key, item);

              if (classification) {
                const normalizedValue = item.toLowerCase();

                if (!seenValues.has(normalizedValue)) {
                  entities.push({
                    type: classification.type,
                    value: item,
                    confidence: classification.confidence,
                    context: `Array item in ${currentPath}[${index}]`,
                    source: 'json_extraction',
                  });

                  seenValues.add(normalizedValue);
                }
              }
            }
          });
        }
      }
    };

    extract(data);

    return entities;
  }

  /**
   * Classify entity by JSON key name
   *
   * @param {string} key - JSON key name
   * @param {*} value - JSON value
   * @returns {object|null} Classification result
   */
  classifyByKey(key, value) {
    const keyLower = key.toLowerCase();

    // Person indicators
    if (
      [
        'author',
        'user',
        'developer',
        'creator',
        'owner',
        'name',
        'username',
        'developers',
      ].includes(keyLower)
    ) {
      return { type: ENTITY_TYPES.PERSON, confidence: 0.9 };
    }

    // Organization indicators
    if (['organization', 'org', 'company', 'team', 'group'].includes(keyLower)) {
      return { type: ENTITY_TYPES.ORGANIZATION, confidence: 0.9 };
    }

    // Tool indicators
    if (
      ['tool', 'framework', 'library', 'package', 'dependency', 'technology', 'tools'].includes(
        keyLower
      )
    ) {
      return { type: ENTITY_TYPES.TOOL, confidence: 0.9 };
    }

    // Project indicators
    if (['project', 'repository', 'repo', 'initiative'].includes(keyLower)) {
      return { type: ENTITY_TYPES.PROJECT, confidence: 0.9 };
    }

    // Decision indicators
    if (['decision', 'choice', 'selected', 'decided'].includes(keyLower)) {
      return { type: ENTITY_TYPES.DECISION, confidence: 0.9 };
    }

    // Artifact indicators
    if (['file', 'document', 'artifact', 'output', 'path', 'url'].includes(keyLower)) {
      return { type: ENTITY_TYPES.ARTIFACT, confidence: 0.9 };
    }

    return null;
  }

  /**
   * Classify entity type based on value
   *
   * @param {string} value - Entity value
   * @returns {object} Classification result
   */
  classifyEntity(value) {
    if (!value || typeof value !== 'string') {
      return { type: ENTITY_TYPES.ARTIFACT, confidence: 0.3 };
    }

    const valueLower = value.toLowerCase();

    // Project: org/repo pattern (check this BEFORE tool patterns)
    if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(value)) {
      return { type: ENTITY_TYPES.PROJECT, confidence: 0.9 };
    }

    // Tool: Check against known tools
    if (this.knownTools.has(valueLower)) {
      return { type: ENTITY_TYPES.TOOL, confidence: 1.0 };
    }

    // Tool: Framework/library patterns (scoped packages like @babel/core)
    if (/\.(js|ts|py|rb|go|rs)$/i.test(value) || /^@[a-z0-9-]+\/[a-z0-9-]+$/i.test(value)) {
      return { type: ENTITY_TYPES.TOOL, confidence: 0.8 };
    }

    // Artifact: File extensions
    if (/\.[a-z0-9]+$/i.test(value) && value.split('.').length === 2) {
      return { type: ENTITY_TYPES.ARTIFACT, confidence: 0.85 };
    }

    // Artifact: URLs
    if (/^https?:\/\//.test(value)) {
      return { type: ENTITY_TYPES.ARTIFACT, confidence: 0.9 };
    }

    // Person: Capitalized name pattern (First Last)
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(value)) {
      return { type: ENTITY_TYPES.PERSON, confidence: 0.8 };
    }

    // Organization: Company suffixes
    if (/\b(?:Inc|LLC|Corp|Ltd|Team|Labs)\b/i.test(value)) {
      return { type: ENTITY_TYPES.ORGANIZATION, confidence: 0.85 };
    }

    // Decision: Decision keywords
    if (/(decided|chose|selected|will use|adopted)/i.test(value)) {
      return { type: ENTITY_TYPES.DECISION, confidence: 0.7 };
    }

    // Default: Low confidence artifact
    return { type: ENTITY_TYPES.ARTIFACT, confidence: 0.4 };
  }

  /**
   * Calculate confidence score for entity
   *
   * @param {string} type - Entity type
   * @param {string} value - Entity value
   * @param {RegExp} pattern - Pattern used to extract
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(type, value, pattern) {
    // Base confidence by pattern specificity
    let confidence = 0.7;

    // Boost for known tools
    if (type === ENTITY_TYPES.TOOL && this.knownTools.has(value.toLowerCase())) {
      confidence = 1.0;
    }

    // Boost for GitHub username patterns
    if (type === ENTITY_TYPES.PERSON && pattern.toString().includes('@')) {
      confidence = 0.95;
    }

    // Boost for org/repo patterns
    if (type === ENTITY_TYPES.PROJECT && /\//.test(value)) {
      confidence = 0.9;
    }

    // Boost for full names (multiple capitalized words)
    if (type === ENTITY_TYPES.PERSON && /\s/.test(value)) {
      confidence = 0.85;
    }

    // Penalize short values
    if (value.length < 3) {
      confidence *= 0.6;
    }

    // Penalize very long values (likely false positives)
    if (value.length > 50) {
      confidence *= 0.7;
    }

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Extract and classify entities from mixed content
   *
   * @param {string|object} content - Content to extract from
   * @returns {Array} Extracted entities
   */
  extractEntities(content) {
    if (typeof content === 'string') {
      return this.extractFromText(content);
    }

    if (typeof content === 'object') {
      return this.extractFromJSON(content);
    }

    return [];
  }
}

/**
 * Create default entity extractor
 *
 * @returns {EntityExtractor}
 */
export function createEntityExtractor() {
  return new EntityExtractor();
}
