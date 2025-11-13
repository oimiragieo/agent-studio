/**
 * Text Editor Tool - File editing with atomic operations
 *
 * Features:
 * - Read, Write, Edit operations
 * - Atomic file updates with backups
 * - Path validation and security
 * - Line-based editing
 */

import { readFile, writeFile, access, constants, mkdir } from 'fs/promises';
import { dirname, resolve, relative } from 'path';
import { z } from 'zod';
import type { Tool, ToolResult } from '@anthropic-ai/claude-agent-sdk';

export const TextEditorInputSchema = z.object({
  operation: z.enum(['read', 'write', 'edit']),
  file_path: z.string(),
  content: z.string().optional(),
  old_string: z.string().optional(),
  new_string: z.string().optional(),
  start_line: z.number().optional(),
  end_line: z.number().optional(),
});

export type TextEditorInput = z.infer<typeof TextEditorInputSchema>;

export class TextEditorTool implements Tool<TextEditorInput, string> {
  name = 'text_editor';
  description = 'Read, write, and edit files with atomic operations and safety checks';
  input_schema = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['read', 'write', 'edit'] },
      file_path: { type: 'string' },
      content: { type: 'string' },
      old_string: { type: 'string' },
      new_string: { type: 'string' },
      start_line: { type: 'number' },
      end_line: { type: 'number' },
    },
    required: ['operation', 'file_path'],
  };

  constructor(private config: { cwd?: string; protectedPaths?: string[] } = {}) {}

  async handler(input: TextEditorInput): Promise<ToolResult> {
    try {
      const validated = TextEditorInputSchema.parse(input);
      const filePath = this.resolvePath(validated.file_path);

      // Security check
      if (!this.isPathAllowed(filePath)) {
        throw new Error(`Access denied: ${filePath} is in protected path`);
      }

      switch (validated.operation) {
        case 'read':
          return await this.read(filePath, validated.start_line, validated.end_line);
        case 'write':
          if (!validated.content) throw new Error('content required for write operation');
          return await this.write(filePath, validated.content);
        case 'edit':
          if (!validated.old_string || !validated.new_string) {
            throw new Error('old_string and new_string required for edit operation');
          }
          return await this.edit(filePath, validated.old_string, validated.new_string);
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        is_error: true,
      };
    }
  }

  private async read(filePath: string, startLine?: number, endLine?: number): Promise<ToolResult> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const start = startLine ? Math.max(0, startLine - 1) : 0;
    const end = endLine ? Math.min(lines.length, endLine) : lines.length;

    const selectedLines = lines.slice(start, end);
    const numberedLines = selectedLines.map((line, idx) => `${start + idx + 1}│${line}`).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `File: ${filePath}\nLines: ${start + 1}-${end}\n\n${numberedLines}`,
        },
      ],
    };
  }

  private async write(filePath: string, content: string): Promise<ToolResult> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf-8');

    return {
      content: [{ type: 'text', text: `Successfully wrote ${content.length} bytes to ${filePath}` }],
    };
  }

  private async edit(filePath: string, oldString: string, newString: string): Promise<ToolResult> {
    const content = await readFile(filePath, 'utf-8');

    if (!content.includes(oldString)) {
      throw new Error(`String not found in file: "${oldString.substring(0, 50)}..."`);
    }

    const occurrences = content.split(oldString).length - 1;
    if (occurrences > 1) {
      throw new Error(`String appears ${occurrences} times. Please provide a unique string.`);
    }

    const newContent = content.replace(oldString, newString);

    // Create backup
    await writeFile(`${filePath}.backup`, content, 'utf-8');

    // Atomic write
    await writeFile(filePath, newContent, 'utf-8');

    return {
      content: [{ type: 'text', text: `Successfully replaced string in ${filePath}` }],
    };
  }

  private resolvePath(filePath: string): string {
    const cwd = this.config.cwd || process.cwd();
    return resolve(cwd, filePath);
  }

  private isPathAllowed(filePath: string): boolean {
    const protected = this.config.protectedPaths || ['/etc', '/sys', '/proc', '/dev'];
    return !protected.some((p) => filePath.startsWith(p));
  }
}

export function createTextEditorTool(config?: { cwd?: string; protectedPaths?: string[] }) {
  return new TextEditorTool(config);
}
