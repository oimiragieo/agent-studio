#!/usr/bin/env node
/**
 * Orchestrator Enforcement Hook (legacy entrypoint)
 *
 * This file is intentionally tiny: many existing configurations reference
 * `.claude/hooks/orchestrator-enforcement-hook.mjs` as the PreToolUse hook.
 *
 * The real implementation lives in:
 * - `.claude/hooks/orchestrator-enforcement-pre-tool.mjs`
 */
import './orchestrator-enforcement-pre-tool.mjs';
