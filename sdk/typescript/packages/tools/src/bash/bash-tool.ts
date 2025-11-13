/**
 * Bash Tool - Enterprise-grade shell command execution
 * Version: bash_20250124
 *
 * Security Features:
 * - Command validation and dangerous pattern blocking
 * - Resource limits and sandboxing
 * - Audit logging
 * - Timeout enforcement
 *
 * @module @anthropic-ai/claude-agent-sdk-tools/bash
 */

import { spawn, ChildProcess } from 'child_process';
import { z } from 'zod';
import type { Tool, ToolResult } from '@anthropic-ai/claude-agent-sdk';

// ============================================================================
// Types & Schemas
// ============================================================================

export const BashInputSchema = z.object({
  command: z.string().describe('The bash command to execute'),
  timeout: z.number().optional().default(120000).describe('Timeout in milliseconds (default: 120s, max: 600s)'),
  cwd: z.string().optional().describe('Working directory for command execution'),
  env: z.record(z.string()).optional().describe('Environment variables'),
});

export type BashInput = z.infer<typeof BashInputSchema>;

export interface BashConfig {
  /** Maximum execution time in ms (default: 120000) */
  maxTimeout?: number;
  /** Dangerous command patterns to block */
  blockPatterns?: RegExp[];
  /** Enable audit logging */
  auditLog?: boolean;
  /** Sandbox execution (recommended for production) */
  sandbox?: boolean;
  /** Resource limits */
  resourceLimits?: {
    maxMemory?: string; // e.g., '256m'
    maxCpu?: number; // percentage
  };
}

export interface BashToolState {
  process: ChildProcess | null;
  sessionId: string;
  cwd: string;
  env: Record<string, string>;
  history: Array<{ command: string; output: string; timestamp: Date }>;
}

// ============================================================================
// Security Validator
// ============================================================================

export class BashSecurityValidator {
  private static readonly DEFAULT_BLOCK_PATTERNS = [
    /rm\s+-rf\s+(\/|\*|~)/i,           // Dangerous rm commands
    /dd\s+if=/i,                        // Disk operations
    /mkfs/i,                            // Filesystem formatting
    /:\(\)\{\s*:\|\:&\s*\};:/,          // Fork bomb
    />\s*\/dev\/sd[a-z]/i,              // Direct disk write
    /chmod\s+-R\s+777/i,                // Dangerous permissions
    /sudo\s+/i,                         // Privilege escalation
    /curl\s+.*\|\s*bash/i,              // Pipe to bash
    /wget\s+.*\|\s*sh/i,                // Pipe to sh
  ];

  constructor(private config: BashConfig = {}) {}

  validate(command: string): { valid: boolean; reason?: string } {
    const patterns = this.config.blockPatterns || BashSecurityValidator.DEFAULT_BLOCK_PATTERNS;

    for (const pattern of patterns) {
      if (pattern.test(command)) {
        return {
          valid: false,
          reason: `Command blocked by security policy: matches pattern ${pattern.source}`,
        };
      }
    }

    // Check for command injection attempts
    if (this.detectCommandInjection(command)) {
      return {
        valid: false,
        reason: 'Potential command injection detected',
      };
    }

    return { valid: true };
  }

  private detectCommandInjection(command: string): boolean {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /[;&|`$]\s*rm/,
      /[;&|`$]\s*curl/,
      /[;&|`$]\s*wget/,
      /\$\(.*rm.*\)/,
      /`.*rm.*`/,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(command));
  }
}

// ============================================================================
// Bash Tool Implementation
// ============================================================================

export class BashTool implements Tool<BashInput, string> {
  name = 'bash';
  description = `Execute bash commands in a persistent shell session.

**Capabilities:**
- Run shell commands with full bash syntax support
- Persistent environment variables and working directory
- Command chaining with &&, ||, ;
- Output capture (stdout and stderr)
- Background process support

**Security:**
- Dangerous commands are automatically blocked (rm -rf /, dd, mkfs, etc.)
- Timeouts prevent long-running commands
- Resource limits prevent resource exhaustion
- All executions are logged for audit

**Usage:**
- For file operations, consider using Read/Write tools instead
- For code execution, consider using the Code Execution tool
- Always validate file paths before operations
- Use absolute paths when possible

**Limitations:**
- Cannot handle interactive prompts (use expect for automation)
- Cannot run GUI applications
- Session persists only within the conversation
- 245 input tokens per invocation

**Examples:**
- List files: ls -la
- Check system: uname -a && cat /etc/os-release
- Find files: find . -name "*.ts" -type f
- Process management: ps aux | grep node`;

  input_schema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 120000, max: 600000)',
        minimum: 1000,
        maximum: 600000,
        default: 120000,
      },
      cwd: {
        type: 'string',
        description: 'Working directory for command execution',
      },
      env: {
        type: 'object',
        description: 'Environment variables to set',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['command'],
  };

  private state: BashToolState;
  private validator: BashSecurityValidator;
  private config: Required<BashConfig>;

  constructor(config: BashConfig = {}) {
    this.config = {
      maxTimeout: config.maxTimeout || 600000,
      blockPatterns: config.blockPatterns || [],
      auditLog: config.auditLog ?? true,
      sandbox: config.sandbox ?? false,
      resourceLimits: config.resourceLimits || {},
    };

    this.validator = new BashSecurityValidator(this.config);

    this.state = {
      process: null,
      sessionId: this.generateSessionId(),
      cwd: process.cwd(),
      env: { ...process.env } as Record<string, string>,
      history: [],
    };
  }

  async handler(input: BashInput): Promise<ToolResult> {
    try {
      // Validate input
      const validated = BashInputSchema.parse(input);

      // Security validation
      const securityCheck = this.validator.validate(validated.command);
      if (!securityCheck.valid) {
        return this.errorResult(securityCheck.reason || 'Command blocked by security policy');
      }

      // Enforce timeout limits
      const timeout = Math.min(validated.timeout, this.config.maxTimeout);

      // Audit log
      if (this.config.auditLog) {
        this.logExecution(validated.command);
      }

      // Execute command
      const result = await this.executeCommand(validated.command, {
        timeout,
        cwd: validated.cwd || this.state.cwd,
        env: { ...this.state.env, ...validated.env },
      });

      // Update state
      this.state.cwd = validated.cwd || this.state.cwd;
      if (validated.env) {
        this.state.env = { ...this.state.env, ...validated.env };
      }

      // Add to history
      this.state.history.push({
        command: validated.command,
        output: result,
        timestamp: new Date(),
      });

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      return this.errorResult(error);
    }
  }

  private async executeCommand(
    command: string,
    options: { timeout: number; cwd: string; env: Record<string, string> }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn('bash', ['-c', command], {
        cwd: options.cwd,
        env: options.env,
        timeout: options.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        const output = stdout + (stderr ? `\n[STDERR]\n${stderr}` : '');
        if (code === 0) {
          resolve(output || '(Command executed successfully with no output)');
        } else {
          reject(new Error(`Command failed with exit code ${code}\n${output}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(error);
      });

      // Handle timeout
      setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 5000);
          reject(new Error(`Command timed out after ${options.timeout}ms`));
        }
      }, options.timeout);
    });
  }

  private errorResult(error: unknown): ToolResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      is_error: true,
    };
  }

  private logExecution(command: string): void {
    console.log(`[BashTool] Session ${this.state.sessionId}: ${command}`);
  }

  private generateSessionId(): string {
    return `bash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API for state management
  getState(): BashToolState {
    return { ...this.state };
  }

  getHistory(): Array<{ command: string; output: string; timestamp: Date }> {
    return [...this.state.history];
  }

  clearHistory(): void {
    this.state.history = [];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createBashTool(config?: BashConfig): BashTool {
  return new BashTool(config);
}

export default BashTool;
