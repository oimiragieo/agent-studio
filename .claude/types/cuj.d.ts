/**
 * TypeScript type definitions for Customer User Journeys (CUJs)
 *
 * @module cuj-types
 * @version 1.0.0
 */

/**
 * Execution mode for a CUJ
 *
 * - `workflow`: YAML workflow execution with multi-agent orchestration
 * - `skill-only`: Direct skill invocation without workflow or agents
 * - `manual-setup`: Manual setup steps required (no automation)
 */
export type ExecutionMode = 'workflow' | 'skill-only' | 'manual-setup';

/**
 * Platform compatibility
 *
 * - `claude`: Claude Code / Agent Studio
 * - `cursor`: Cursor IDE
 * - `factory`: Factory Droid
 */
export type Platform = 'claude' | 'cursor' | 'factory';

/**
 * CUJ status
 *
 * - `active`: CUJ is implemented and tested
 * - `draft`: CUJ is documented but not fully implemented
 * - `deprecated`: CUJ is deprecated and will be removed
 */
export type CUJStatus = 'active' | 'draft' | 'deprecated';

/**
 * Skill reference in a CUJ
 */
export interface SkillReference {
  /** Skill name (e.g., 'rule-selector') */
  name: string;
  /** Whether skill is required (vs optional) */
  required?: boolean;
  /** Skill type (agent-studio or codex) */
  type?: 'agent-studio' | 'codex';
  /** CLI providers required for Codex skills */
  requires_cli?: string[];
}

/**
 * Agent reference in a CUJ
 */
export interface AgentReference {
  /** Agent slug (e.g., 'developer') */
  name: string;
  /** Role in the workflow (e.g., 'primary', 'supporting') */
  role?: string;
  /** Agent model tier (haiku, sonnet, opus) */
  model?: 'haiku' | 'sonnet' | 'opus';
}

/**
 * Expected output from a CUJ
 */
export interface ExpectedOutput {
  /** Output type (e.g., 'artifact', 'report', 'code') */
  type: string;
  /** Output description */
  description: string;
  /** File path or location */
  path?: string;
  /** Schema reference for validation */
  schema?: string;
}

/**
 * Success criterion for a CUJ
 */
export interface SuccessCriterion {
  /** Criterion description */
  description: string;
  /** Whether criterion is required (vs optional) */
  required?: boolean;
  /** Validation method (e.g., 'schema', 'manual', 'automated') */
  validation?: string;
}

/**
 * Complete CUJ object
 */
export interface CUJ {
  /** CUJ identifier (e.g., 'CUJ-005') */
  id: string;

  /** Human-readable name */
  name: string;

  /** Execution mode */
  execution_mode: ExecutionMode;

  /** CUJ status */
  status?: CUJStatus;

  /** User goal description */
  user_goal?: string;

  /** Trigger description */
  trigger?: string;

  /** Workflow file path (for workflow execution mode) */
  workflow?: string | null;

  /** Primary skill (for skill-only execution mode) */
  primary_skill?: string | null;

  /** All skills used in the CUJ */
  skills?: Array<string | SkillReference>;

  /** All agents used in the CUJ */
  agents?: Array<string | AgentReference>;

  /** Expected outputs */
  expected_outputs?: ExpectedOutput[];

  /** Success criteria */
  success_criteria?: SuccessCriterion[];

  /** Platform compatibility */
  platforms?: Platform[];

  /** Related CUJ IDs */
  related_cujs?: string[];

  /** Tags for categorization */
  tags?: string[];

  /** Estimated duration in seconds */
  estimated_duration_sec?: number;

  /** Metadata from CUJ-INDEX.md mapping (if different from CUJ doc) */
  execution_mode_mapping?: ExecutionMode;
  workflow_path_mapping?: string | null;
  primary_skill_mapping?: string | null;

  /** Source indicator (for debugging) */
  source?: 'registry' | 'mapping-only';

  /** Skill type (for codex skills) */
  skill_type?: 'agent-studio' | 'codex' | 'hybrid';

  /** Whether CUJ uses Codex skills */
  uses_codex_skills?: boolean;
}

/**
 * CUJ registry object
 */
export interface CUJRegistry {
  /** Version of the registry format */
  version?: string;

  /** Last updated timestamp */
  last_updated?: string;

  /** Array of all CUJs */
  cujs: CUJ[];

  /** Total count of CUJs */
  total?: number;

  /** Statistics */
  stats?: {
    workflow: number;
    skill_only: number;
    manual_setup: number;
  };
}

/**
 * CUJ mapping entry (from CUJ-INDEX.md)
 */
export interface CUJMappingEntry {
  /** Execution mode */
  executionMode: ExecutionMode;

  /** Workflow file path */
  workflowPath: string | null;

  /** Primary skill */
  primarySkill: string | null;
}

/**
 * CUJ validation result
 */
export interface CUJValidationResult {
  /** Whether CUJ is valid */
  valid: boolean;

  /** Validation errors (blocking issues) */
  errors: string[];

  /** Validation warnings (non-blocking issues) */
  warnings: string[];
}

/**
 * Stateless validation metadata
 */
export interface ValidationMetadata {
  /** Timestamp of last file read */
  lastFileReadTimestamp: string | null;

  /** Modification time of last file read */
  lastFileModificationTime: string | null;

  /** Source of data (always 'file_system') */
  source: 'file_system';

  /** Whether conversation history was referenced (always false) */
  conversationHistoryReferenced: false;
}

/**
 * CUJ parser module exports
 */
declare module '@claude/cuj-parser' {
  /**
   * Load CUJ registry from cuj-registry.json
   */
  export function loadRegistry(): Promise<CUJRegistry>;

  /**
   * Parse CUJ-INDEX.md mapping table
   */
  export function loadCUJMapping(): Promise<Map<string, CUJMappingEntry>>;

  /**
   * Normalize execution mode to schema-compliant values
   */
  export function normalizeExecutionMode(mode: string): ExecutionMode | null;

  /**
   * Get a single CUJ by ID
   */
  export function getCUJById(cujId: string): Promise<CUJ | null>;

  /**
   * Get all CUJs by execution mode
   */
  export function getCUJsByMode(mode: ExecutionMode): Promise<CUJ[]>;

  /**
   * Get all CUJ IDs from both registry and mapping
   */
  export function getAllCUJIds(): Promise<string[]>;

  /**
   * Validate CUJ structure against schema requirements
   */
  export function validateCUJStructure(cuj: CUJ): CUJValidationResult;

  /**
   * Check if CUJ documentation file exists
   */
  export function cujDocExists(cujId: string): Promise<boolean>;

  /**
   * Get stateless validation metadata
   */
  export function getValidationMetadata(): ValidationMetadata;
}
