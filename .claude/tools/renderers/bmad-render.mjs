#!/usr/bin/env node
/**
 * BMAD (Business Model Artifact Document) Renderer
 *
 * Converts JSON artifacts to human-readable markdown format.
 * Supports: project-brief, prd, ux-spec, test-plan, architecture
 *
 * Usage:
 *   node bmad-render.mjs <artifact-type> <json-file-path>
 *
 * Example:
 *   node bmad-render.mjs project-brief .claude/context/artifacts/project-brief.json
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const artifactType = process.argv[2];
const jsonPath = process.argv[3];

if (!artifactType || !jsonPath) {
  console.error('Usage: node bmad-render.mjs <artifact-type> <json-file-path>');
  console.error('Artifact types: project-brief, prd, ux-spec, test-plan, architecture');
  process.exit(1);
}

// Resolve JSON file path
const resolvedPath = resolve(jsonPath);
if (!existsSync(resolvedPath)) {
  console.error(`Error: JSON file not found: ${resolvedPath}`);
  process.exit(1);
}

// Read and parse JSON
let data;
try {
  const content = readFileSync(resolvedPath, 'utf-8');
  data = JSON.parse(content);
} catch (error) {
  console.error(`Error reading/parsing JSON: ${error.message}`);
  process.exit(1);
}

// Helper functions for markdown formatting
function formatList(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return '';
  return items.map(item => `- ${item}`).join('\n');
}

function formatObject(obj, indent = 0) {
  if (!obj || typeof obj !== 'object') return '';
  const prefix = '  '.repeat(indent);
  return Object.entries(obj)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${prefix}- **${key}**: ${value.join(', ')}`;
      } else if (typeof value === 'object' && value !== null) {
        return `${prefix}- **${key}**:\n${formatObject(value, indent + 1)}`;
      }
      return `${prefix}- **${key}**: ${value}`;
    })
    .join('\n');
}

// Render functions for each artifact type
function renderProjectBrief(data) {
  let md = `# ${data.project_name || 'Project Brief'}\n\n`;

  if (data.executive_summary) {
    md += `## Executive Summary\n\n${data.executive_summary}\n\n`;
  }

  if (data.problem_statement) {
    md += `## Problem Statement\n\n${data.problem_statement}\n\n`;
  }

  if (data.solution_overview) {
    md += `## Solution Overview\n\n${data.solution_overview}\n\n`;
  }

  if (data.market_context) {
    md += `## Market Context\n\n`;
    if (data.market_context.target_audience) {
      md += `### Target Audience\n\n${data.market_context.target_audience}\n\n`;
    }
    if (data.market_context.competitive_landscape) {
      md += `### Competitive Landscape\n\n${data.market_context.competitive_landscape}\n\n`;
    }
    if (data.market_context.market_opportunity) {
      md += `### Market Opportunity\n\n${data.market_context.market_opportunity}\n\n`;
    }
  }

  if (data.success_metrics && data.success_metrics.length > 0) {
    md += `## Success Metrics\n\n${formatList(data.success_metrics)}\n\n`;
  }

  if (data.risks && data.risks.length > 0) {
    md += `## Risks\n\n`;
    data.risks.forEach(risk => {
      md += `### ${risk.risk || 'Risk'}\n\n`;
      if (risk.impact) md += `- **Impact**: ${risk.impact}\n`;
      if (risk.probability) md += `- **Probability**: ${risk.probability}\n`;
      if (risk.mitigation) md += `- **Mitigation**: ${risk.mitigation}\n`;
      md += '\n';
    });
  }

  if (data.technical_considerations) {
    md += `## Technical Considerations\n\n${data.technical_considerations}\n\n`;
  }

  if (data.recommendations && data.recommendations.length > 0) {
    md += `## Recommendations\n\n${formatList(data.recommendations)}\n\n`;
  }

  if (data.next_steps && data.next_steps.length > 0) {
    md += `## Next Steps\n\n${formatList(data.next_steps)}\n\n`;
  }

  if (data.timeline) {
    md += `## Timeline\n\n${data.timeline}\n\n`;
  }

  if (data.stakeholders && data.stakeholders.length > 0) {
    md += `## Stakeholders\n\n${formatList(data.stakeholders)}\n\n`;
  }

  return md;
}

function renderPRD(data) {
  let md = `# ${data.product_name || 'Product Requirements Document'}\n\n`;

  if (data.overview) {
    md += `## Overview\n\n${data.overview}\n\n`;
  }

  if (data.goals_objectives && data.goals_objectives.length > 0) {
    md += `## Goals & Objectives\n\n${formatList(data.goals_objectives)}\n\n`;
  }

  if (data.target_users && data.target_users.length > 0) {
    md += `## Target Users\n\n`;
    data.target_users.forEach(user => {
      md += `### ${user.persona || 'User Persona'}\n\n`;
      if (user.needs && user.needs.length > 0) {
        md += `**Needs**:\n${formatList(user.needs)}\n\n`;
      }
    });
  }

  if (data.user_stories && data.user_stories.length > 0) {
    md += `## User Stories\n\n`;
    data.user_stories.forEach(story => {
      md += `### ${story.id || 'Story'}: ${story.story || ''}\n\n`;
      if (story.priority) {
        md += `**Priority**: ${story.priority}\n\n`;
      }
      if (story.acceptance_criteria && story.acceptance_criteria.length > 0) {
        md += `**Acceptance Criteria**:\n${formatList(story.acceptance_criteria)}\n\n`;
      }
    });
  }

  if (data.features && data.features.length > 0) {
    md += `## Features\n\n`;
    data.features.forEach(feature => {
      md += `### ${feature.name || 'Feature'}\n\n`;
      if (feature.description) {
        md += `${feature.description}\n\n`;
      }
      if (feature.user_stories && feature.user_stories.length > 0) {
        md += `**Related User Stories**:\n${formatList(feature.user_stories)}\n\n`;
      }
    });
  }

  if (data.technical_requirements && data.technical_requirements.length > 0) {
    md += `## Technical Requirements\n\n${formatList(data.technical_requirements)}\n\n`;
  }

  if (data.success_metrics && data.success_metrics.length > 0) {
    md += `## Success Metrics\n\n`;
    data.success_metrics.forEach(metric => {
      if (typeof metric === 'object' && metric.metric) {
        md += `- **${metric.metric}**: ${metric.target || 'N/A'}\n`;
      } else {
        md += `- ${metric}\n`;
      }
    });
    md += '\n';
  }

  if (data.prioritization) {
    md += `## Prioritization\n\n${data.prioritization}\n\n`;
  }

  return md;
}

function renderUXSpec(data) {
  let md = `# ${data.feature_name || 'UX Specification'}\n\n`;

  if (data.overview) {
    md += `## Overview\n\n${data.overview}\n\n`;
  }

  if (data.design_goals && data.design_goals.length > 0) {
    md += `## Design Goals\n\n${formatList(data.design_goals)}\n\n`;
  }

  if (data.user_personas && data.user_personas.length > 0) {
    md += `## User Personas\n\n`;
    data.user_personas.forEach(persona => {
      md += `### ${persona.name || 'Persona'}\n\n`;
      if (persona.characteristics && persona.characteristics.length > 0) {
        md += `**Characteristics**:\n${formatList(persona.characteristics)}\n\n`;
      }
      if (persona.goals && persona.goals.length > 0) {
        md += `**Goals**:\n${formatList(persona.goals)}\n\n`;
      }
    });
  }

  if (data.user_flows && data.user_flows.length > 0) {
    md += `## User Flows\n\n`;
    data.user_flows.forEach(flow => {
      md += `### ${flow.flow_name || 'User Flow'}\n\n`;
      if (flow.steps && flow.steps.length > 0) {
        flow.steps.forEach((step, index) => {
          md += `${index + 1}. ${step}\n`;
        });
        md += '\n';
      }
    });
  }

  if (data.design_system) {
    md += `## Design System\n\n`;
    if (data.design_system.colors) {
      md += `### Colors\n\n${formatObject(data.design_system.colors)}\n\n`;
    }
    if (data.design_system.typography) {
      md += `### Typography\n\n${formatObject(data.design_system.typography)}\n\n`;
    }
    if (data.design_system.components && data.design_system.components.length > 0) {
      md += `### Components\n\n${formatList(data.design_system.components)}\n\n`;
    }
  }

  if (data.accessibility_requirements && data.accessibility_requirements.length > 0) {
    md += `## Accessibility Requirements\n\n${formatList(data.accessibility_requirements)}\n\n`;
  }

  if (data.responsive_design) {
    md += `## Responsive Design\n\n`;
    if (data.responsive_design.breakpoints && data.responsive_design.breakpoints.length > 0) {
      md += `**Breakpoints**:\n${formatList(data.responsive_design.breakpoints)}\n\n`;
    }
    if (data.responsive_design.mobile_first !== undefined) {
      md += `**Mobile First**: ${data.responsive_design.mobile_first ? 'Yes' : 'No'}\n\n`;
    }
  }

  return md;
}

function renderTestPlan(data) {
  let md = `# ${data.feature_name || 'Test Plan'}\n\n`;

  if (data.overview) {
    md += `## Overview\n\n${data.overview}\n\n`;
  }

  if (data.test_strategy) {
    md += `## Test Strategy\n\n${data.test_strategy}\n\n`;
  }

  if (data.test_levels) {
    md += `## Test Levels\n\n`;
    if (data.test_levels.unit && data.test_levels.unit.length > 0) {
      md += `### Unit Tests\n\n`;
      data.test_levels.unit.forEach(test => {
        if (test.component) {
          md += `#### ${test.component}\n\n`;
        }
        if (test.test_cases && test.test_cases.length > 0) {
          md += `${formatList(test.test_cases)}\n\n`;
        }
      });
    }
    if (data.test_levels.integration && data.test_levels.integration.length > 0) {
      md += `### Integration Tests\n\n`;
      data.test_levels.integration.forEach(test => {
        md += `${formatObject(test)}\n\n`;
      });
    }
    if (data.test_levels.e2e && data.test_levels.e2e.length > 0) {
      md += `### End-to-End Tests\n\n`;
      data.test_levels.e2e.forEach(test => {
        md += `${formatObject(test)}\n\n`;
      });
    }
  }

  if (data.test_scenarios && data.test_scenarios.length > 0) {
    md += `## Test Scenarios\n\n`;
    data.test_scenarios.forEach(scenario => {
      md += `### ${scenario.id || 'Scenario'}: ${scenario.name || ''}\n\n`;
      if (scenario.given) md += `**Given**: ${scenario.given}\n\n`;
      if (scenario.when) md += `**When**: ${scenario.when}\n\n`;
      if (scenario.then) md += `**Then**: ${scenario.then}\n\n`;
      if (scenario.priority) md += `**Priority**: ${scenario.priority}\n\n`;
    });
  }

  if (data.test_data_requirements && data.test_data_requirements.length > 0) {
    md += `## Test Data Requirements\n\n${formatList(data.test_data_requirements)}\n\n`;
  }

  if (data.quality_gates) {
    md += `## Quality Gates\n\n`;
    if (data.quality_gates.coverage_threshold) {
      md += `- **Coverage Threshold**: ${data.quality_gates.coverage_threshold}%\n`;
    }
    if (data.quality_gates.required_tests && data.quality_gates.required_tests.length > 0) {
      md += `- **Required Tests**:\n${formatList(data.quality_gates.required_tests)}\n`;
    }
    md += '\n';
  }

  return md;
}

function renderArchitecture(data) {
  let md = `# ${data.system_name || 'System Architecture'}\n\n`;

  if (data.overview) {
    md += `## Overview\n\n${data.overview}\n\n`;
  }

  if (data.architecture_principles && data.architecture_principles.length > 0) {
    md += `## Architecture Principles\n\n${formatList(data.architecture_principles)}\n\n`;
  }

  if (data.technology_stack) {
    md += `## Technology Stack\n\n`;
    if (data.technology_stack.frontend && data.technology_stack.frontend.length > 0) {
      md += `### Frontend\n\n${formatList(data.technology_stack.frontend)}\n\n`;
    }
    if (data.technology_stack.backend && data.technology_stack.backend.length > 0) {
      md += `### Backend\n\n${formatList(data.technology_stack.backend)}\n\n`;
    }
    if (data.technology_stack.database && data.technology_stack.database.length > 0) {
      md += `### Database\n\n${formatList(data.technology_stack.database)}\n\n`;
    }
    if (data.technology_stack.infrastructure && data.technology_stack.infrastructure.length > 0) {
      md += `### Infrastructure\n\n${formatList(data.technology_stack.infrastructure)}\n\n`;
    }
  }

  if (data.component_architecture) {
    md += `## Component Architecture\n\n${formatObject(data.component_architecture)}\n\n`;
  }

  if (data.database_design) {
    md += `## Database Design\n\n`;
    if (data.database_design.schema) {
      md += `### Schema\n\n${formatObject(data.database_design.schema)}\n\n`;
    }
    if (data.database_design.relationships && data.database_design.relationships.length > 0) {
      md += `### Relationships\n\n`;
      data.database_design.relationships.forEach(rel => {
        md += `${formatObject(rel)}\n\n`;
      });
    }
  }

  if (data.api_design) {
    md += `## API Design\n\n`;
    if (data.api_design.endpoints && data.api_design.endpoints.length > 0) {
      md += `### Endpoints\n\n`;
      data.api_design.endpoints.forEach(endpoint => {
        md += `#### ${endpoint.method || 'METHOD'} ${endpoint.path || ''}\n\n`;
        if (endpoint.description) {
          md += `${endpoint.description}\n\n`;
        }
      });
    }
    if (data.api_design.authentication) {
      md += `### Authentication\n\n${data.api_design.authentication}\n\n`;
    }
  }

  if (data.security_architecture) {
    md += `## Security Architecture\n\n${formatObject(data.security_architecture)}\n\n`;
  }

  if (data.deployment_architecture) {
    md += `## Deployment Architecture\n\n${formatObject(data.deployment_architecture)}\n\n`;
  }

  if (data.integration_patterns && data.integration_patterns.length > 0) {
    md += `## Integration Patterns\n\n${formatList(data.integration_patterns)}\n\n`;
  }

  return md;
}

// Route to appropriate renderer
let output = '';
switch (artifactType) {
  case 'project-brief':
    output = renderProjectBrief(data);
    break;
  case 'prd':
    output = renderPRD(data);
    break;
  case 'ux-spec':
    output = renderUXSpec(data);
    break;
  case 'test-plan':
    output = renderTestPlan(data);
    break;
  case 'architecture':
    output = renderArchitecture(data);
    break;
  default:
    console.error(`Error: Unknown artifact type: ${artifactType}`);
    console.error('Supported types: project-brief, prd, ux-spec, test-plan, architecture');
    process.exit(1);
}

// Output markdown to stdout
console.log(output);
