# Schema Validation Implementation Task

## Overview
Implement comprehensive schema validation system for workflow files to address Issue #8.

## Tasks

### 1. Create Schema Validation Script
Create `.claude/tools/validate-schemas.mjs` that:
- Scans all workflow YAML files
- Extracts schema references
- Validates schema files exist
- Reports missing schemas with actionable errors

### 2. Standardize Validation Timing
- Review all workflow files
- Add validation timing specification to artifact-generating steps
- Use `timing: post_generation` or `pre_validation`

### 3. Enhance Gate File Format
- Create/update `.claude/schemas/gate-result.schema.json`
- Include validation details: timestamp, schema used, errors, warnings
- Add duration tracking

### 4. Run Validation and Fix Missing Schemas
- Execute validation script
- Identify missing schemas
- Create missing schemas with proper JSON Schema definitions
- Common schemas: plan, architecture, test-plan, deployment

### 5. Generate Report
- Create `.claude/context/reports/schema-validation-report.md`
- List all schema references found
- Document which schemas exist vs missing
- List schemas created

## Acceptance Criteria
- All schema references in workflows validated
- Missing schemas created
- Gate file schema enhanced
- Validation timing standardized
- Comprehensive report generated

## File Locations
- Script: `.claude/tools/validate-schemas.mjs`
- Gate schema: `.claude/schemas/gate-result.schema.json`
- Report: `.claude/context/reports/schema-validation-report.md`
- All paths must follow subagent file rules (no root directory violations)

## Reference
- Issue #8: Validation and schema consistency
- Related workflows: All 14 workflow YAML files

