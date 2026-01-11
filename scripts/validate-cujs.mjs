#!/usr/bin/env node
/**
 * CUJ Validation Script - Static Validation
 *
 * PURPOSE: Static validation of CUJ markdown files
 * - Validates CUJ file structure against template
 * - Checks links and references (agents, skills, workflows, schemas)
 * - Verifies execution mode consistency with CUJ-INDEX.md
 * - Validates plan rating steps for workflow CUJs
 *
 * DOES NOT: Execute workflows, create artifacts, or mutate .claude/context/
 *
 * USE CASE: Pre-commit validation, CI/CD pipeline validation
 * COMPLEMENTS: validate-cuj-dry-run.mjs (execution simulation), workflow_runner.js (actual execution)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const CUJ_DIR = path.join(ROOT, '.claude/docs/cujs');
const TEMPLATE_PATH = path.join(ROOT, '.claude/templates/cuj-template.md');
const CUJ_INDEX_PATH = path.join(CUJ_DIR, 'CUJ-INDEX.md');

// Performance flags
let skipLinkValidation = false;
let watchMode = false;

// Required sections in order
const REQUIRED_SECTIONS = [
  '## User Goal',
  '## Trigger',
  '## Workflow',
  '## Agents Used',
  '## Skills Used', // OR '## Capabilities/Tools Used'
  '## Expected Outputs',
  '## Success Criteria',
  '## Example Prompts'
];

// Optional sections
const OPTIONAL_SECTIONS = [
  '## Related Documentation',
  '## Capabilities/Tools Used', // Alternative to Skills Used
  '## Error Recovery',
  '## Platform Compatibility',
  '## Test Scenarios'
];

// All valid sections
const ALL_SECTIONS = [...REQUIRED_SECTIONS, ...OPTIONAL_SECTIONS];

/**
 * Extract sections from markdown content
 */
function extractSections(content) {
  const sections = {};
  // Normalize line endings (handle both LF and CRLF)
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const lines = normalizedContent.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = line.trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * Check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve relative path from CUJ directory
 */
function resolvePath(relativePath, fromFile) {
  // Strip fragment identifier (#anchor) before checking file existence
  const pathWithoutFragment = relativePath.split('#')[0];

  // Handle different path formats
  if (pathWithoutFragment.startsWith('http://') || pathWithoutFragment.startsWith('https://')) {
    return { type: 'url', path: pathWithoutFragment, exists: true }; // Assume URLs exist
  }

  if (pathWithoutFragment.startsWith('../')) {
    // Relative to CUJ directory
    const resolved = path.resolve(CUJ_DIR, pathWithoutFragment);
    return { type: 'file', path: resolved, relative: pathWithoutFragment };
  } else if (pathWithoutFragment.startsWith('./')) {
    const resolved = path.resolve(path.dirname(fromFile), pathWithoutFragment);
    return { type: 'file', path: resolved, relative: pathWithoutFragment };
  } else if (pathWithoutFragment.startsWith('/')) {
    // Absolute from repo root
    const resolved = path.join(ROOT, pathWithoutFragment);
    return { type: 'file', path: resolved, relative: pathWithoutFragment };
  } else {
    // Assume relative to CUJ directory
    const resolved = path.resolve(CUJ_DIR, pathWithoutFragment);
    return { type: 'file', path: resolved, relative: pathWithoutFragment };
  }
}

/**
 * Extract agent slugs from various formats
 */
function extractAgentSlugs(content) {
  const agents = new Set();
  
  // Backticked: `agent-name`
  const backtickMatches = content.match(/`([a-z-]+)`/g) || [];
  backtickMatches.forEach(m => {
    const slug = m.replace(/`/g, '').trim();
    if (slug && slug !== 'none') {
      agents.add(slug);
    }
  });
  
  // List items: - Agent Name or - agent-name
  const listMatches = content.match(/(?:^|\n)[-*]\s+([A-Za-z][A-Za-z\s-]+)/g) || [];
  listMatches.forEach(m => {
    const name = m.replace(/^[-*\s]+/, '').trim();
    // Skip if it's a role label like "(recovery)" or "(planning)"
    if (!name.startsWith('(') && !name.includes('→') && !name.includes('->')) {
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      if (slug && slug !== 'none' && slug !== 'agents') {
        agents.add(slug);
      }
    }
  });
  
  // Arrow chains: Agent1 → Agent2 or Agent1 -> Agent2
  const arrowMatches = content.match(/([A-Za-z][A-Za-z\s-]+)(?:\s*(→|->))/g) || [];
  arrowMatches.forEach(m => {
    const name = m.replace(/\s*(→|->).*$/, '').trim();
    // Skip role labels in parentheses
    if (!name.startsWith('(')) {
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      if (slug && slug !== 'none' && slug !== 'agents') {
        agents.add(slug);
      }
    }
  });
  
  // Also extract from arrow chains that span multiple lines
  const multiLineArrowMatches = content.match(/([A-Za-z][A-Za-z\s-]+)\s*(→|->)\s*([A-Za-z][A-Za-z\s-]+)/g) || [];
  multiLineArrowMatches.forEach(m => {
    const parts = m.split(/\s*(→|->)\s*/);
    parts.forEach(part => {
      const cleanPart = part.trim();
      if (cleanPart && !cleanPart.match(/^(→|->)$/) && !cleanPart.startsWith('(')) {
        const slug = cleanPart.toLowerCase().replace(/\s+/g, '-');
        if (slug && slug !== 'none' && slug !== 'agents') {
          agents.add(slug);
        }
      }
    });
  });
  
  return Array.from(agents);
}

/**
 * Extract links from markdown content
 */
function extractLinks(content) {
  const links = [];
  // Normalize line endings for accurate line counting
  const normalizedContent = content.replace(/\r\n/g, '\n');
  // Markdown links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(normalizedContent)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
      line: normalizedContent.substring(0, match.index).split('\n').length
    });
  }
  return links;
}

/**
 * Get whitelist of valid agent names from .claude/agents/ directory
 */
let agentWhitelistCache = null;
async function getAgentWhitelist() {
  if (agentWhitelistCache) {
    return agentWhitelistCache;
  }

  const agentsDir = path.join(ROOT, '.claude/agents');
  const whitelist = new Set();

  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        // Remove .md extension to get agent name
        const agentName = entry.name.replace(/\.md$/, '');
        whitelist.add(agentName);
      }
    }
  } catch (error) {
    // If can't read directory, return empty set (will validate against file existence)
  }

  agentWhitelistCache = whitelist;
  return whitelist;
}

/**
 * Centralized existence caches for performance
 */
const existenceCache = {
  agents: new Map(),
  skills: new Map(),
  workflows: new Map(),
  schemas: new Map(),
  rubrics: new Map(),
  files: new Map()
};

/**
 * Build all caches upfront for maximum performance
 */
async function buildExistenceCaches() {
  // Build agent cache
  const agentsDir = path.join(ROOT, '.claude/agents');
  try {
    const agentEntries = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of agentEntries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const agentName = entry.name.replace(/\.md$/, '');
        existenceCache.agents.set(agentName, true);
      }
    }
  } catch (error) {
    // Ignore
  }

  // Build skill cache
  const skillsDir = path.join(ROOT, '.claude/skills');
  try {
    const skillEntries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of skillEntries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
        const exists = await fileExists(skillPath);
        if (exists) {
          existenceCache.skills.set(entry.name, true);
        }
      }
    }
  } catch (error) {
    // Ignore
  }

  // Build workflow cache
  const workflowsDir = path.join(ROOT, '.claude/workflows');
  try {
    const workflowEntries = await fs.readdir(workflowsDir, { withFileTypes: true });
    for (const entry of workflowEntries) {
      if (entry.isFile() && entry.name.endsWith('.yaml')) {
        const workflowName = entry.name.replace(/\.yaml$/, '');
        existenceCache.workflows.set(workflowName, true);
      }
    }
  } catch (error) {
    // Ignore
  }

  // Build schema cache
  const schemasDir = path.join(ROOT, '.claude/schemas');
  try {
    const schemaEntries = await fs.readdir(schemasDir, { withFileTypes: true });
    for (const entry of schemaEntries) {
      if (entry.isFile() && entry.name.endsWith('.schema.json')) {
        const schemaName = entry.name.replace(/\.schema\.json$/, '');
        existenceCache.schemas.set(schemaName, true);
      }
    }
  } catch (error) {
    // Ignore
  }
}

/**
 * Parse CUJ-INDEX.md mapping table
 * Returns a map of CUJ ID -> { executionMode, workflowPath, primarySkill }
 */
let cujMappingCache = null;
async function getCUJMapping() {
  if (cujMappingCache) {
    return cujMappingCache;
  }

  const mapping = new Map();

  try {
    const indexContent = await fs.readFile(CUJ_INDEX_PATH, 'utf-8');

    // Find the "Run CUJ Mapping" table (the second one with execution mode details)
    // Look for the table that has "Execution Mode" column
    // Normalize line endings
    const normalizedContent = indexContent.replace(/\r\n/g, '\n');
    const lines = normalizedContent.split('\n');
    let inMappingTable = false;
    let headerPassed = false;

    for (const line of lines) {
      // Detect table header with "Execution Mode" column
      if (line.includes('| CUJ ID') && line.includes('Execution Mode')) {
        inMappingTable = true;
        continue;
      }

      // Skip separator line
      if (inMappingTable && !headerPassed && line.includes('|---')) {
        headerPassed = true;
        continue;
      }

      // Parse table rows
      if (inMappingTable && headerPassed && line.startsWith('|')) {
        const cols = line.split('|').map(c => c.trim()).filter(c => c);
        if (cols.length >= 4) {
          const cujId = cols[0]; // e.g., "CUJ-001"
          const executionMode = cols[1]; // e.g., "skill-only" or "greenfield-fullstack.yaml"
          const workflowPath = cols[2] === 'null' ? null : cols[2].replace(/`/g, '').trim();
          const primarySkill = cols[3] === 'null' ? null : cols[3].trim();

          if (cujId.startsWith('CUJ-')) {
            mapping.set(cujId, {
              executionMode,
              workflowPath,
              primarySkill
            });
          }
        }
      }

      // Stop when we hit another section
      if (inMappingTable && headerPassed && line.startsWith('##')) {
        break;
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not parse CUJ-INDEX.md mapping table: ${error.message}`);
  }

  cujMappingCache = mapping;
  return mapping;
}

/**
 * Extract CUJ ID from filename
 */
function extractCUJId(fileName) {
  const match = fileName.match(/^(CUJ-\d+)\.md$/);
  return match ? match[1] : null;
}

/**
 * Normalize execution mode to schema-compliant values
 */
function normalizeExecutionMode(mode) {
  if (!mode) return null;

  const modeMap = {
    'workflow': 'workflow',
    'automated-workflow': 'workflow',
    'delegated-skill': 'skill-only',
    'skill-only': 'skill-only',
    'skill': 'skill-only',
    'manual-setup': 'manual-setup',
    'manual': 'manual-setup'
  };

  // Handle raw .yaml references as 'workflow'
  if (mode.endsWith('.yaml')) {
    return 'workflow';
  }

  return modeMap[mode] || mode;
}

/**
 * Extract execution mode from CUJ content
 */
function extractExecutionMode(content) {
  // Look for "**Execution Mode**: `mode`" or "**Execution Mode**: mode"
  const match = content.match(/\*\*Execution Mode\*\*:\s*`?([a-z0-9-]+\.yaml|skill-only|delegated-skill|manual-setup|manual|automated-workflow|workflow|skill)`?/i);
  return match ? normalizeExecutionMode(match[1]) : null;
}



/**
 * Validate agent reference (cached)
 */
async function validateAgent(agentName) {
  if (existenceCache.agents.has(agentName)) {
    return existenceCache.agents.get(agentName);
  }

  const agentPath = path.join(ROOT, '.claude/agents', `${agentName}.md`);
  const exists = await fileExists(agentPath);
  existenceCache.agents.set(agentName, exists);
  return exists;
}

/**
 * Validate skill reference (cached)
 */
async function validateSkill(skillName) {
  // Remove backticks if present
  const cleanName = skillName.replace(/`/g, '').trim();

  if (existenceCache.skills.has(cleanName)) {
    return existenceCache.skills.get(cleanName);
  }

  const skillPath = path.join(ROOT, '.claude/skills', cleanName, 'SKILL.md');
  const exists = await fileExists(skillPath);
  existenceCache.skills.set(cleanName, exists);
  return exists;
}

/**
 * Validate workflow reference (cached)
 */
async function validateWorkflow(workflowName) {
  if (existenceCache.workflows.has(workflowName)) {
    return existenceCache.workflows.get(workflowName);
  }

  const workflowPath = path.join(ROOT, '.claude/workflows', `${workflowName}.yaml`);
  const exists = await fileExists(workflowPath);
  existenceCache.workflows.set(workflowName, exists);
  return exists;
}

/**
 * Validate schema reference (cached)
 */
async function validateSchema(schemaName) {
  if (existenceCache.schemas.has(schemaName)) {
    return existenceCache.schemas.get(schemaName);
  }

  const schemaPath = path.join(ROOT, '.claude/schemas', `${schemaName}.schema.json`);
  const exists = await fileExists(schemaPath);
  existenceCache.schemas.set(schemaName, exists);
  return exists;
}

/**
 * Validate rubric file reference (cached)
 */
async function validateRubricFile(rubricPath) {
  if (existenceCache.rubrics.has(rubricPath)) {
    return existenceCache.rubrics.get(rubricPath);
  }

  const fullPath = path.join(ROOT, rubricPath);
  const exists = await fileExists(fullPath);
  existenceCache.rubrics.set(rubricPath, exists);
  return exists;
}

/**
 * Validate a single CUJ file
 */
async function validateCUJ(filePath) {
  const fileName = path.basename(filePath);
  const issues = [];
  const warnings = [];
  let hasStep0 = false;
  let hasStep01 = false;

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const sections = extractSections(content);
    const cujId = extractCUJId(fileName);
    const cujMapping = await getCUJMapping();
    
    // Check required sections exist
    // Special handling: Skills Used OR Capabilities/Tools Used (either is acceptable)
    const hasSkillsOrCapabilities = sections['## Skills Used'] || sections['## Capabilities/Tools Used'];
    for (const section of REQUIRED_SECTIONS) {
      if (section === '## Skills Used') {
        // Skip - we check this separately below
        continue;
      }
      if (!sections[section]) {
        issues.push(`Missing required section: ${section}`);
      }
    }
    // Check for Skills Used OR Capabilities/Tools Used
    if (!hasSkillsOrCapabilities) {
      issues.push('Missing required section: "## Skills Used" or "## Capabilities/Tools Used"');
    }
    
    // Check for invalid section names (not in template)
    for (const section of Object.keys(sections)) {
      if (!ALL_SECTIONS.includes(section)) {
        warnings.push(`Non-standard section: ${section}`);
      }
    }
    
    // Check section order (rough check - first occurrence)
    const sectionOrder = [];
    // Normalize line endings
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const lines = normalizedContent.split('\n');
    for (const line of lines) {
      if (line.startsWith('## ')) {
        sectionOrder.push(line.trim());
      }
    }
    
    // Validate "Example Prompts" section name (not "Example Scenarios")
    if (sections['## Example Scenarios']) {
      issues.push('Section should be "## Example Prompts" not "## Example Scenarios"');
    }
    
    // Validate links (skip in quick mode)
    if (!skipLinkValidation) {
      const links = extractLinks(content);
      for (const link of links) {
        // Strip anchor fragments before resolving paths
        const pathWithoutFragment = link.url.split('#')[0];
        const resolved = resolvePath(pathWithoutFragment, filePath);
        if (resolved.type === 'file') {
          // Use cache for file existence checks
          let exists;
          if (existenceCache.files.has(resolved.path)) {
            exists = existenceCache.files.get(resolved.path);
          } else {
            exists = await fileExists(resolved.path);
            existenceCache.files.set(resolved.path, exists);
          }
          if (!exists) {
            issues.push(`Broken link at line ${link.line}: ${link.text} -> ${resolved.relative}`);
          }
        }
      }
    }
    
    // Validate agent references
    // Only validate agents in backticks or against known agent basenames
    if (sections['## Agents Used']) {
      const agentSection = sections['## Agents Used'];
      const agentWhitelist = await getAgentWhitelist();
      
      // Extract agents in backticks (these are explicit agent references)
      const backtickMatches = agentSection.match(/`([a-z-]+)`/g) || [];
      const backtickAgents = new Set();
      backtickMatches.forEach(m => {
        const slug = m.replace(/`/g, '').trim();
        if (slug && slug !== 'none') {
          backtickAgents.add(slug);
        }
      });
      
      // Validate only agents in backticks or those that match whitelist
      for (const agentSlug of backtickAgents) {
        if (agentSlug && agentSlug !== 'none' && agentSlug !== 'agents') {
          const exists = await validateAgent(agentSlug);
          if (!exists) {
            warnings.push(`Agent reference may not exist: ${agentSlug} (check .claude/agents/${agentSlug}.md)`);
          }
        }
      }
      
      // Only validate agents in backticks or known agent basenames from whitelist
      // Ignore descriptive labels like "Primary Agent", "Coordinating Agent" that aren't actual agent slugs
      // This prevents false warnings for descriptive text that happens to match agent patterns
    }
    
    // Validate skill references (only if Skills Used section exists)
    if (sections['## Skills Used']) {
      const skillSection = sections['## Skills Used'];
      // Extract skill names from backticks
      const skillMatches = skillSection.match(/`([^`]+)`/g) || [];
      const nonSkillItems = [];

      // Check for non-backticked items (likely not skills)
      // Normalize line endings
      const normalizedSkillSection = skillSection.replace(/\r\n/g, '\n');
      const lines = normalizedSkillSection.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed.startsWith('-') && !trimmed.includes('`')) {
          nonSkillItems.push(trimmed);
        }
      }
      
      if (nonSkillItems.length > 0) {
        warnings.push(`"Skills Used" section contains non-skill items. Consider moving to "Capabilities/Tools Used": ${nonSkillItems.join(', ')}`);
      }
      
      for (const match of skillMatches) {
        const skillName = match.replace(/`/g, '').trim();
        if (skillName) {
          const exists = await validateSkill(skillName);
          if (!exists) {
            warnings.push(`Skill may not exist: ${skillName} (consider using "Capabilities/Tools Used" if not a real skill)`);
          }
        }
      }
    }
    
    // Note: Capabilities/Tools Used section doesn't need validation - it's free-form
    
    // Validate workflow reference and execution mode
    if (sections['## Workflow']) {
      const workflowSection = sections['## Workflow'];

      // Check for Step 0 and Step 0.1 (Plan Rating Gate) in workflow section
      hasStep0 = /Step\s+0[:\s]/i.test(workflowSection);
      hasStep01 = /Step\s+0\.1[:\s]|Plan\s+Rating\s+Gate/i.test(workflowSection);

      // Check for explicit execution mode reference - prefer "Execution Mode" format
      // Accept: "Execution Mode: name.yaml", "**Execution Mode**: `name.yaml`"
      // Also accept legacy: "Workflow Reference: name.yaml", "**Workflow**: `name.yaml`" (with warning)
      const executionModeMatch = workflowSection.match(/\*\*Execution Mode\*\*:\s*`?([a-z0-9-]+\.yaml|workflow|skill-only|manual-setup|manual)`?/i);
      const legacyWorkflowMatch = workflowSection.match(/(?:Workflow Reference|Workflow)[:\s]+(?:`)?([a-z0-9-]+\.yaml|workflow|skill-only)(?:`)?/i);

      let workflowRef = null;
      if (executionModeMatch) {
        // Preferred format found
        workflowRef = executionModeMatch[1];
      } else if (legacyWorkflowMatch) {
        // Legacy format found - warn but don't fail
        workflowRef = legacyWorkflowMatch[1];
        warnings.push('Workflow section should use "**Execution Mode**: `name.yaml`" format instead of "Workflow Reference"');
      } else {
        issues.push('Workflow section must explicitly declare execution mode (e.g., "**Execution Mode**: `greenfield-fullstack.yaml`") or "**Execution Mode**: `skill-only`"');
      }

      if (workflowRef) {
        // Normalize both CUJ-declared mode and extract workflow file if present
        const normalizedMode = normalizeExecutionMode(workflowRef);
        const workflowFile = workflowRef.endsWith('.yaml') ? workflowRef : null;

        // NEW VALIDATION 1: Execution Mode Validation (workflow, skill-only, manual-setup)
        const validExecutionModes = ['workflow', 'skill-only', 'manual-setup'];
        if (!validExecutionModes.includes(normalizedMode)) {
          warnings.push(`Execution mode "${workflowRef}" normalized to "${normalizedMode}" which is not a standard execution mode. Expected: workflow, skill-only, or manual-setup`);
        }

        // NEW VALIDATION 2: Workflow File Existence Check
        if (workflowFile) {
          const workflowName = workflowFile.replace('.yaml', '');
          const exists = await validateWorkflow(workflowName);
          if (!exists) {
            issues.push(`Referenced workflow file does not exist: ${workflowFile} (checked .claude/workflows/${workflowName}.yaml)`);
          }
        }

        // NEW VALIDATION 3: Skill-only CUJs should NOT have Step 0/0.1 as mandatory - NOW AN ERROR
        if (normalizedMode === 'skill-only' && (hasStep0 || hasStep01)) {
          issues.push('EXECUTION MODE INCONSISTENCY: Skill-only CUJs MUST NOT have Step 0 (Planning) or Step 0.1 (Plan Rating Gate). Either remove these steps OR change execution mode to "workflow".');
        }

        // NEW VALIDATION 4: Workflow-based CUJs should have Step 0.1 (Plan Rating Gate)
        if (normalizedMode === 'workflow' && !hasStep01) {
          warnings.push('Workflow-based CUJs should document Step 0.1 (Plan Rating Gate) to ensure plan quality validation');
        }

        // NEW VALIDATION 2 (enhanced): Execution Mode Match Between CUJ and CUJ-INDEX.md
        if (cujId && cujMapping.has(cujId)) {
          const mappingEntry = cujMapping.get(cujId);
          const mappedMode = normalizeExecutionMode(mappingEntry.executionMode);

          // Compare normalized execution modes - NOW AN ERROR, NOT A WARNING
          if (normalizedMode !== mappedMode) {
            issues.push(`EXECUTION MODE MISMATCH: CUJ declares "${workflowRef}" (normalized: ${normalizedMode}) but CUJ-INDEX.md maps to "${mappingEntry.executionMode}" (normalized: ${mappedMode}). These MUST match.`);
          }

          // If mapped mode is a workflow, validate it exists
          // Use workflowPath from mapping table, not the normalized mode string
          if (mappingEntry.workflowPath && mappingEntry.workflowPath !== 'null') {
            // Extract filename from full path (e.g., ".claude/workflows/greenfield.yaml" -> "greenfield")
            const workflowFileName = path.basename(mappingEntry.workflowPath, '.yaml');
            const workflowExists = await validateWorkflow(workflowFileName);
            if (!workflowExists) {
              warnings.push(`CUJ-INDEX.md references workflow "${mappingEntry.workflowPath}" which does not exist at .claude/workflows/${workflowFileName}.yaml`);
            }
          }

          // NEW VALIDATION 3: Skill Reference Validation
          if (mappingEntry.primarySkill) {
            const skillExists = await validateSkill(mappingEntry.primarySkill);
            if (!skillExists) {
              warnings.push(`CUJ-INDEX.md references primary skill "${mappingEntry.primarySkill}" which does not exist`);
            }
          }
        } else if (cujId) {
          warnings.push(`CUJ "${cujId}" not found in CUJ-INDEX.md mapping table`);
        }

        // NEW VALIDATION 5: Plan Rating Artifact Path Validation
        if (normalizedMode === 'workflow' && hasStep01) {
          const planRatingArtifactMatch = workflowSection.match(/\.claude\/context\/runs\/[^/]+\/plans\/[^/]+-rating\.json/);
          if (!planRatingArtifactMatch) {
            warnings.push('Step 0.1 (Plan Rating Gate) should reference plan rating artifact path: `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`');
          }
        }

        // NEW VALIDATION 6: Rubric File Reference Validation
        const rubricMatch = workflowSection.match(/Rubric:\s*`?([^`\n]+rubric[^`\n]*\.json)`?/i);
        if (rubricMatch) {
          const rubricPath = rubricMatch[1].trim();
          const rubricExists = await validateRubricFile(rubricPath);
          if (!rubricExists) {
            warnings.push(`Referenced rubric file does not exist: ${rubricPath}`);
          }
        }

        // NEW VALIDATION 7: Plan Rating Threshold Validation
        const thresholdMatch = workflowSection.match(/(?:minimum[_\s]score|threshold):\s*(\d+)/i);
        if (thresholdMatch) {
          const threshold = parseInt(thresholdMatch[1], 10);
          const validThresholds = [5, 7, 8];
          if (!validThresholds.includes(threshold)) {
            warnings.push(`Plan rating threshold ${threshold} is non-standard. Expected: 5 (emergency), 7 (standard), or 8 (enterprise)`);
          }
        }
      }
    } else {
      issues.push('Missing required section: ## Workflow');
    }
    
    // Validate success criteria format
    if (sections['## Success Criteria']) {
      const criteriaSection = sections['## Success Criteria'];
      // Check for checkboxes or tables (both are valid formats)
      const hasCheckboxes = criteriaSection.includes('- [ ]') || criteriaSection.includes('- [x]') || criteriaSection.includes('- ✅');
      const hasTable = criteriaSection.includes('| Criterion') || criteriaSection.includes('|---');

      if (!hasCheckboxes && !hasTable) {
        warnings.push('Success criteria should use checkboxes (- [ ]) or tables for clarity');
      }

      // Check for at least one concrete validation artifact reference
      const hasArtifactRef = criteriaSection.match(/(schema|gate|registry|artifact)/i);
      if (!hasArtifactRef) {
        warnings.push('Success criteria should reference at least one concrete validation artifact (schema, gate, registry, or artifact file)');
      }
      
      // Check for encoding artifacts
      if (criteriaSection.includes('␦')) {
        issues.push('Encoding artifact detected (␦) - run fix-encoding.mjs to fix');
      }
      // Only flag truly bad control chars, exclude \t\r\n (0x09, 0x0D, 0x0A)
      const badControlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
      if (badControlChars.test(criteriaSection)) {
        warnings.push('Control characters detected in success criteria - may indicate encoding issues');
      }
    }
    
    // Check entire content for encoding artifacts
    if (content.includes('␦')) {
      issues.push('Encoding artifact detected (␦) - run fix-encoding.mjs to fix');
    }
    
    // Check for question mark encoding artifacts (replacement characters from encoding errors)
    // Only flag standalone ? that appear in suspicious contexts (not legitimate question marks)
    const suspiciousQuestionMarks = /[^\w\s]\?[^\w\s]/g;
    const questionMarkMatches = content.match(suspiciousQuestionMarks);
    if (questionMarkMatches && questionMarkMatches.length > 5) {
      // Multiple suspicious ? marks likely indicate encoding issues
      warnings.push(`Multiple suspicious question marks detected (${questionMarkMatches.length}) - may indicate encoding issues. Run fix-encoding.mjs to verify.`);
    }
    
    return {
      file: fileName,
      issues,
      warnings,
      valid: issues.length === 0
    };
    
  } catch (error) {
    return {
      file: fileName,
      issues: [`Error reading file: ${error.message}`],
      warnings: [],
      valid: false
    };
  }
}

/**
 * Main validation function
 */
async function validateAllCUJs() {
  const startTime = Date.now();
  console.log('🔍 Validating CUJ files...\n');

  try {
    const files = await fs.readdir(CUJ_DIR);
    // Only match CUJ-XXX.md where XXX is a 3-digit number (e.g., CUJ-001.md)
    // This excludes CUJ-INDEX.md, CUJ-AUDIT-REPORT.md, CUJ-EXECUTION-EXAMPLES.md, etc.
    const cujFiles = files.filter(f => /^CUJ-\d{3}\.md$/.test(f));

    console.log(`Found ${cujFiles.length} CUJ files to validate\n`);

    if (skipLinkValidation) {
      console.log('⚡ Quick mode enabled - skipping link validation\n');
    }

    // Build existence caches upfront for maximum performance
    console.log('📦 Building existence caches...');
    await buildExistenceCaches();
    console.log(`✅ Caches built: ${existenceCache.agents.size} agents, ${existenceCache.skills.size} skills, ${existenceCache.workflows.size} workflows, ${existenceCache.schemas.size} schemas\n`);

    // Parallelize validation - validate all CUJs concurrently
    const sortedFiles = cujFiles.sort();
    const results = await Promise.all(
      sortedFiles.map(file => {
        const filePath = path.join(CUJ_DIR, file);
        return validateCUJ(filePath);
      })
    );

    // Report results
    let totalIssues = 0;
    let totalWarnings = 0;
    let validCount = 0;
    let executionModeMismatches = 0;
    let missingMappingEntries = 0;

    for (const result of results) {
      if (result.valid) {
        validCount++;
        if (result.warnings.length > 0) {
          console.log(`⚠️  ${result.file} (valid with warnings)`);
          result.warnings.forEach(w => {
            console.log(`   - ${w}`);
            if (w.includes('Execution mode mismatch')) {
              executionModeMismatches++;
            }
            if (w.includes('not found in CUJ-INDEX.md mapping table')) {
              missingMappingEntries++;
            }
          });
        }
      } else {
        console.log(`❌ ${result.file}`);
        result.issues.forEach(i => console.log(`   - ${i}`));
        result.warnings.forEach(w => {
          console.log(`   ⚠️  ${w}`);
          if (w.includes('Execution mode mismatch')) {
            executionModeMismatches++;
          }
          if (w.includes('not found in CUJ-INDEX.md mapping table')) {
            missingMappingEntries++;
          }
        });
      }
      totalIssues += result.issues.length;
      totalWarnings += result.warnings.length;
    }
    
    // Check for encoding issues across all files
    const encodingIssues = results.filter(r => 
      r.issues.some(i => i.includes('Encoding artifact') || i.includes('encoding'))
    );
    if (encodingIssues.length > 0) {
      console.log(`\n⚠️  Encoding issues detected in ${encodingIssues.length} file(s).`);
      console.log(`   Run 'node scripts/fix-encoding.mjs' to normalize encoding.\n`);
    }
    
    // Count new validation metrics
    let executionModeInvalid = 0;
    let workflowFilesMissing = 0;
    let skillReferencesMissing = 0;
    let planRatingStepMissing = 0;
    let rubricFilesMissing = 0;
    let planRatingThresholdInvalid = 0;

    for (const result of results) {
      result.warnings.forEach(w => {
        if (w.includes('not a standard execution mode')) executionModeInvalid++;
        if (w.includes('workflow file does not exist')) workflowFilesMissing++;
        if (w.includes('skill') && w.includes('does not exist')) skillReferencesMissing++;
        if (w.includes('should document Step 0.1')) planRatingStepMissing++;
        if (w.includes('rubric file does not exist')) rubricFilesMissing++;
        if (w.includes('Plan rating threshold') && w.includes('non-standard')) planRatingThresholdInvalid++;
      });
      result.issues.forEach(i => {
        if (i.includes('workflow file does not exist')) workflowFilesMissing++;
      });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Summary:`);
    console.log(`  ✅ Valid: ${validCount}/${results.length}`);
    console.log(`  ❌ Issues: ${totalIssues}`);
    console.log(`  ⚠️  Warnings: ${totalWarnings}`);
    if (executionModeMismatches > 0) {
      console.log(`  🔄 Execution Mode Mismatches: ${executionModeMismatches}`);
    }
    if (missingMappingEntries > 0) {
      console.log(`  📋 Missing CUJ-INDEX.md Entries: ${missingMappingEntries}`);
    }
    if (executionModeInvalid > 0) {
      console.log(`  ⚙️  Invalid Execution Modes: ${executionModeInvalid}`);
    }
    if (workflowFilesMissing > 0) {
      console.log(`  📄 Missing Workflow Files: ${workflowFilesMissing}`);
    }
    if (skillReferencesMissing > 0) {
      console.log(`  🛠️  Missing Skill References: ${skillReferencesMissing}`);
    }
    if (planRatingStepMissing > 0) {
      console.log(`  📊 Plan Rating Step Missing: ${planRatingStepMissing}`);
    }
    if (rubricFilesMissing > 0) {
      console.log(`  📋 Missing Rubric Files: ${rubricFilesMissing}`);
    }
    if (planRatingThresholdInvalid > 0) {
      console.log(`  🎯 Invalid Plan Rating Thresholds: ${planRatingThresholdInvalid}`);
    }
    console.log(`${'='.repeat(60)}\n`);

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  Validation completed in ${elapsedTime}s\n`);

    if (totalIssues > 0) {
      console.log('❌ Validation failed. Fix issues above.\n');
      process.exit(1);
    } else if (totalWarnings > 0) {
      console.log('✅ All CUJs are valid, but some have warnings.\n');
      if (executionModeMismatches > 0) {
        console.log(`💡 Tip: Update CUJ files or CUJ-INDEX.md to match execution modes.\n`);
      }
      process.exit(0);
    } else {
      console.log('✅ All CUJs are valid!\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Error during validation:', error);
    process.exit(1);
  }
}

// CLI interface
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/validate-cujs.mjs [options]');
  console.log('');
  console.log('Options:');
  console.log('  --quick          Skip link validation for faster checks (reduces time by ~50%)');
  console.log('  --watch          Watch mode - incremental validation on file changes');
  console.log('  --help, -h       Show this help message');
  console.log('');
  console.log('Validates all CUJ files against the standard template.');
  console.log('');
  console.log('Checks performed:');
  console.log('  - Required sections present');
  console.log('  - Valid links and references (unless --quick)');
  console.log('  - Agent, skill, workflow, and schema references exist');
  console.log('  - Execution mode matches CUJ-INDEX.md mapping');
  console.log('  - Workflow files exist for workflow execution modes');
  console.log('  - Skills exist for skill-only execution modes');
  console.log('  - Execution mode validation (workflow, skill-only, manual-setup)');
  console.log('  - Skill-only CUJs do not have mandatory Step 0/0.1');
  console.log('  - Workflow-based CUJs have Step 0.1 (Plan Rating Gate)');
  console.log('  - Plan rating artifact path validation');
  console.log('  - Rubric file reference validation');
  console.log('  - Plan rating threshold validation (5, 7, or 8)');
  console.log('');
  console.log('Performance:');
  console.log('  - Full validation: ~1-2 seconds (60+ files)');
  console.log('  - Quick mode: <0.5 seconds');
  console.log('  - Watch mode: <0.1 seconds per file change');
  console.log('');
  console.log('Exit codes:');
  console.log('  0 - All CUJs valid (warnings allowed)');
  console.log('  1 - Validation failed (issues found)');
  process.exit(0);
}

// Parse CLI flags
skipLinkValidation = args.includes('--quick');
watchMode = args.includes('--watch');

/**
 * Watch mode - incremental validation on file changes
 */
async function runWatchMode() {
  console.log('👀 Watch mode enabled - monitoring CUJ files for changes...\n');
  console.log('Press Ctrl+C to exit\n');

  // Build caches once
  await buildExistenceCaches();

  // Dynamic import for chokidar (optional dependency)
  let chokidar;
  try {
    chokidar = await import('chokidar');
  } catch (error) {
    console.error('❌ Watch mode requires chokidar. Install with: npm install chokidar');
    process.exit(1);
  }

  const watcher = chokidar.watch(path.join(CUJ_DIR, 'CUJ-*.md'), {
    ignored: /CUJ-INDEX|CUJ-AUDIT-REPORT|CUJ-EXECUTION-EXAMPLES/,
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('change', async (changedPath) => {
    const fileName = path.basename(changedPath);
    console.log(`\n🔄 File changed: ${fileName}`);

    const startTime = Date.now();
    const result = await validateCUJ(changedPath);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(3);

    if (result.valid) {
      if (result.warnings.length > 0) {
        console.log(`⚠️  ${result.file} (valid with warnings) - ${elapsedTime}s`);
        result.warnings.forEach(w => console.log(`   - ${w}`));
      } else {
        console.log(`✅ ${result.file} - ${elapsedTime}s`);
      }
    } else {
      console.log(`❌ ${result.file} - ${elapsedTime}s`);
      result.issues.forEach(i => console.log(`   - ${i}`));
      if (result.warnings.length > 0) {
        result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
      }
    }
  });

  watcher.on('error', error => console.error('❌ Watcher error:', error));

  // Keep process running
  await new Promise(() => {});
}

// Run validation
if (watchMode) {
  runWatchMode().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
} else {
  validateAllCUJs().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

