#!/usr/bin/env node
/**
 * Text Editor Tool - Native Agent SDK Implementation
 * File editing with validation, diff generation, and backup support
 * Based on: https://docs.claude.com/en/docs/agents-and-tools/tool-use/text-editor-tool.md
 */

import { readFile, writeFile, copyFile, mkdir } from 'fs/promises';
import { dirname, join, relative } from 'path';
import { existsSync } from 'fs';

const BACKUP_DIR = '.claude/backups';

/**
 * Generate diff between old and new content
 */
function generateDiff(oldContent, newContent, filePath) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff = [];
  
  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      diff.push({ type: 'add', line: j + 1, content: newLines[j] });
      j++;
    } else if (j >= newLines.length) {
      diff.push({ type: 'remove', line: i + 1, content: oldLines[i] });
      i++;
    } else if (oldLines[i] === newLines[j]) {
      diff.push({ type: 'keep', line: i + 1, content: oldLines[i] });
      i++;
      j++;
    } else {
      // Check if it's a modification or just moved lines
      const nextOldMatch = newLines.slice(j).indexOf(oldLines[i]);
      const nextNewMatch = oldLines.slice(i).indexOf(newLines[j]);
      
      if (nextOldMatch === -1 && nextNewMatch === -1) {
        diff.push({ type: 'remove', line: i + 1, content: oldLines[i] });
        diff.push({ type: 'add', line: j + 1, content: newLines[j] });
        i++;
        j++;
      } else if (nextOldMatch !== -1 && (nextNewMatch === -1 || nextOldMatch < nextNewMatch)) {
        diff.push({ type: 'add', line: j + 1, content: newLines[j] });
        j++;
      } else {
        diff.push({ type: 'remove', line: i + 1, content: oldLines[i] });
        i++;
      }
    }
  }
  
  return {
    file: filePath,
    changes: diff.filter(c => c.type !== 'keep'),
    summary: {
      added: diff.filter(c => c.type === 'add').length,
      removed: diff.filter(c => c.type === 'remove').length,
      modified: diff.filter(c => c.type === 'add' || c.type === 'remove').length
    }
  };
}

/**
 * Create backup of file
 */
async function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `${relative(process.cwd(), filePath)}.${timestamp}.bak`);
  await mkdir(dirname(backupPath), { recursive: true });
  await copyFile(filePath, backupPath);
  return backupPath;
}

/**
 * Generate unique tool call ID
 */
function generateToolCallId() {
  return `tool_call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Edit file with validation and backup (with streaming support for large files)
 */
export async function* editFile(input, context = {}) {
  const toolCallId = context.tool_call_id || generateToolCallId();
  const {
    file_path,
    edits,
    create_backup = true,
    validate = true
  } = input;

  // Yield start event
  yield {
    type: 'tool_call_start',
    tool_name: 'text_editor',
    tool_call_id: toolCallId,
    input: { file_path, edit_type: Array.isArray(edits) ? 'array' : typeof edits }
  };

  try {
    // Validate file path
    if (!file_path || typeof file_path !== 'string') {
      yield {
        type: 'tool_call_error',
        tool_call_id: toolCallId,
        error: { message: 'file_path is required and must be a string', code: 'INVALID_INPUT' }
      };
      return;
    }

    // Yield progress: reading file
    yield {
      type: 'tool_call_progress',
      tool_call_id: toolCallId,
      progress: { stage: 'reading', message: `Reading file: ${file_path}` }
    };

    // Read existing file if it exists
    let oldContent = '';
    const fileExists = existsSync(file_path);
    
    if (fileExists) {
      oldContent = await readFile(file_path, 'utf8');
    }

    // Yield progress: applying edits
    yield {
      type: 'tool_call_progress',
      tool_call_id: toolCallId,
      progress: { stage: 'applying_edits', message: 'Applying edits to file...' }
    };

    // Apply edits
    let newContent = oldContent;
    
    if (Array.isArray(edits)) {
      // Multiple edits - apply in order
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        if (edit.type === 'replace') {
          newContent = newContent.replace(edit.old_text, edit.new_text);
        } else if (edit.type === 'insert') {
          const lines = newContent.split('\n');
          lines.splice(edit.line - 1, 0, edit.content);
          newContent = lines.join('\n');
        } else if (edit.type === 'delete') {
          const lines = newContent.split('\n');
          lines.splice(edit.line - 1, 1);
          newContent = lines.join('\n');
        }
        
        // Yield progress for large edit operations
        if (edits.length > 10 && i % 5 === 0) {
          yield {
            type: 'tool_call_progress',
            tool_call_id: toolCallId,
            progress: { stage: 'applying_edits', message: `Applied ${i + 1}/${edits.length} edits...` }
          };
        }
      }
    } else if (typeof edits === 'string') {
      // Direct content replacement
      newContent = edits;
    } else if (edits && edits.new_text) {
      // Single replace operation
      newContent = oldContent.replace(edits.old_text, edits.new_text);
    }

    // Yield progress: generating diff
    yield {
      type: 'tool_call_progress',
      tool_call_id: toolCallId,
      progress: { stage: 'generating_diff', message: 'Generating diff...' }
    };

    // Generate diff
    const diff = generateDiff(oldContent, newContent, file_path);

    // Create backup if requested and file exists
    let backupPath = null;
    if (create_backup && fileExists) {
      yield {
        type: 'tool_call_progress',
        tool_call_id: toolCallId,
        progress: { stage: 'creating_backup', message: 'Creating backup...' }
      };
      backupPath = await createBackup(file_path);
    }

    // Validate (basic checks)
    if (validate) {
      // Check for common issues
      if (newContent.length > 10 * 1024 * 1024) {
        yield {
          type: 'tool_call_error',
          tool_call_id: toolCallId,
          error: { message: 'File size exceeds 10MB limit', code: 'FILE_TOO_LARGE' }
        };
        return;
      }
    }

    // Yield progress: writing file
    yield {
      type: 'tool_call_progress',
      tool_call_id: toolCallId,
      progress: { stage: 'writing', message: 'Writing file...' }
    };

    // Write file
    await mkdir(dirname(file_path), { recursive: true });
    await writeFile(file_path, newContent, 'utf8');

    // Yield completion
    yield {
      type: 'tool_call_complete',
      tool_call_id: toolCallId,
      output: {
        success: true,
        file_path,
        backup_path: backupPath,
        diff,
        file_created: !fileExists,
        file_modified: fileExists && oldContent !== newContent
      }
    };
  } catch (error) {
    // Yield error
    yield {
      type: 'tool_call_error',
      tool_call_id: toolCallId,
      error: {
        message: error.message,
        code: error.code || 'EDIT_ERROR'
      }
    };
  }
}

/**
 * Tool definition for Agent SDK
 */
export const textEditorTool = {
  name: 'text_editor',
  description: 'Edit text files with validation, diff generation, and backup support',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to file to edit'
      },
      edits: {
        oneOf: [
          {
            type: 'array',
            description: 'Array of edit operations',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['replace', 'insert', 'delete'] },
                old_text: { type: 'string' },
                new_text: { type: 'string' },
                line: { type: 'number' },
                content: { type: 'string' }
              }
            }
          },
          { type: 'string', description: 'Direct content replacement' },
          {
            type: 'object',
            properties: {
              old_text: { type: 'string' },
              new_text: { type: 'string' }
            }
          }
        ]
      },
      create_backup: {
        type: 'boolean',
        description: 'Create backup before editing',
        default: true
      },
      validate: {
        type: 'boolean',
        description: 'Validate edits before applying',
        default: true
      }
    },
    required: ['file_path', 'edits']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: 'Whether the edit operation succeeded'
      },
      file_path: {
        type: 'string',
        description: 'Path to the edited file'
      },
      backup_path: {
        type: ['string', 'null'],
        description: 'Path to backup file if created, null otherwise'
      },
      diff: {
        type: 'object',
        description: 'Diff object showing changes made',
        properties: {
          file: { type: 'string' },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['add', 'remove'] },
                line: { type: 'number' },
                content: { type: 'string' }
              }
            }
          },
          summary: {
            type: 'object',
            properties: {
              added: { type: 'number' },
              removed: { type: 'number' },
              modified: { type: 'number' }
            }
          }
        }
      },
      file_created: {
        type: 'boolean',
        description: 'Whether the file was newly created'
      },
      file_modified: {
        type: 'boolean',
        description: 'Whether the file was modified'
      }
    },
    required: ['success', 'file_path', 'diff', 'file_created', 'file_modified']
  },
  execute: editFile
};

export default textEditorTool;

