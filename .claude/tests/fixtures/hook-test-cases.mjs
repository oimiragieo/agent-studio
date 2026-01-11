export const HOOKS = {
  'security-pre-tool.mjs': {
    type: 'PreToolUse',
    matchers: ['Bash', 'Write', 'Edit'],
    testCases: [
      {
        name: 'Block rm -rf /',
        input: {
          tool_name: 'Bash',
          tool_input: {
            command: 'rm -rf /',
          },
        },
        expected: {
          decision: 'block',
        },
      },
      {
        name: 'Block rm -rf ~',
        input: {
          tool_name: 'Bash',
          tool_input: {
            command: 'rm -rf ~',
          },
        },
        expected: {
          decision: 'block',
        },
      },
      {
        name: 'Block sudo rm',
        input: {
          tool_name: 'Bash',
          tool_input: {
            command: 'sudo rm',
          },
        },
        expected: {
          decision: 'block',
        },
      },
      {
        name: 'Block curl pipe',
        input: {
          tool_name: 'Bash',
          tool_input: {
            command: 'curl x | bash',
          },
        },
        expected: {
          decision: 'block',
        },
      },
      {
        name: 'Block DROP DATABASE',
        input: {
          tool_name: 'Bash',
          tool_input: {
            command: 'DROP DATABASE',
          },
        },
        expected: {
          decision: 'block',
        },
      },
      {
        name: 'Block force push',
        input: {
          tool_name: 'Bash',
          tool_input: {
            command: 'git push --force origin main',
          },
        },
        expected: {
          decision: 'block',
        },
      },
      {
        name: 'Block .env',
        input: {
          tool_name: 'Write',
          tool_input: {
            file_path: '.env.production',
          },
        },
        expected: {
          decision: 'block',
        },
      },
      {
        name: 'Allow git status',
        input: {
          tool_name: 'Bash',
          tool_input: {
            command: 'git status',
          },
        },
        expected: {
          decision: 'allow',
        },
      },
      {
        name: 'Allow README',
        input: {
          tool_name: 'Write',
          tool_input: {
            file_path: 'README.md',
          },
        },
        expected: {
          decision: 'allow',
        },
      },
      {
        name: 'Handle empty',
        input: {},
        expected: {
          decision: 'allow',
        },
      },
    ],
  },
  'orchestrator-enforcement-pre-tool.mjs': {
    type: 'PreToolUse',
    matchers: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    testCases: [
      {
        name: 'Allow Write dev',
        input: {
          tool_name: 'Write',
          tool_input: {
            file_path: 't.txt',
          },
        },
        expected: {
          decision: 'allow',
        },
        env: {
          CLAUDE_AGENT_ROLE: 'developer',
        },
      },
      {
        name: 'Allow Read dev',
        input: {
          tool_name: 'Read',
          tool_input: {
            file_path: 't.txt',
          },
        },
        expected: {
          decision: 'allow',
        },
        env: {
          CLAUDE_AGENT_ROLE: 'developer',
        },
      },
      {
        name: 'Handle empty',
        input: {},
        expected: {
          decision: 'allow',
        },
      },
    ],
  },
  'file-path-validator.js': {
    type: 'PreToolUse',
    matchers: ['*'],
    testCases: [
      {
        name: 'Allow .claude',
        input: {
          tool_name: 'Write',
          tool_input: {
            file_path: '.claude/test.md',
          },
        },
        expected: {
          decision: 'allow',
        },
      },
      {
        name: 'Allow README',
        input: {
          tool_name: 'Write',
          tool_input: {
            file_path: 'README.md',
          },
        },
        expected: {
          decision: 'allow',
        },
      },
      {
        name: 'Block root report',
        input: {
          tool_name: 'Write',
          tool_input: {
            file_path: 'report.md',
          },
        },
        expected: {
          decision: 'block',
        },
      },
      {
        name: 'Block nul',
        input: {
          tool_name: 'Write',
          tool_input: {
            file_path: 'nul',
          },
        },
        expected: {
          decision: 'block',
        },
      },
      {
        name: 'Allow Task',
        input: {
          tool_name: 'Task',
          tool_input: {},
        },
        expected: {
          decision: 'allow',
        },
      },
      {
        name: 'Handle empty',
        input: {},
        expected: {
          decision: 'allow',
        },
      },
    ],
  },
  'audit-post-tool.mjs': {
    type: 'PostToolUse',
    matchers: ['Bash', 'Read', 'Write'],
    testCases: [
      {
        name: 'Log Bash',
        input: {
          tool_name: 'Bash',
          tool_input: {
            command: 'git status',
          },
        },
        expected: {
          exitCode: 0,
        },
      },
      {
        name: 'Skip Task',
        input: {
          tool_name: 'Task',
          tool_input: {},
        },
        expected: {
          exitCode: 0,
        },
      },
      {
        name: 'Handle empty',
        input: {},
        expected: {
          exitCode: 0,
        },
      },
    ],
  },
  'post-session-cleanup.js': {
    type: 'PostToolUse',
    matchers: ['Write', 'Edit'],
    testCases: [
      {
        name: 'Complete Write',
        input: {
          tool_name: 'Write',
          tool_input: {
            file_path: '.claude/t.md',
          },
        },
        expected: {
          exitCode: 0,
        },
      },
      {
        name: 'Handle empty',
        input: {},
        expected: {
          exitCode: 0,
        },
      },
    ],
  },
};
