import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateClaudePaths } from './path-validator.mjs';
import { resolveRuntimePath } from './context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CLAUDE_DIR = path.join(PROJECT_ROOT, '.claude');
const TEMP_DIR = resolveRuntimePath('tmp', { write: true });

// Safeguard: Validate paths to prevent nested .claude folders
validateClaudePaths({
  projectRoot: PROJECT_ROOT,
  claudeDir: CLAUDE_DIR,
  tempDir: TEMP_DIR,
});

/**
 * Centralized temp file manager - ensures all temp files go to .claude/context/runtime/tmp/
 * Never creates files in project root.
 */
export class TempFileManager {
  static ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  }

  static createTempDir(prefix = 'tmpclaude-') {
    this.ensureTempDir();
    return fs.mkdtempSync(path.join(TEMP_DIR, prefix));
  }

  static createTempFile(name) {
    this.ensureTempDir();
    return path.join(TEMP_DIR, name);
  }

  static cleanup(olderThanHours = 24) {
    if (!fs.existsSync(TEMP_DIR)) return 0;

    const now = Date.now();
    const cutoff = olderThanHours * 60 * 60 * 1000;
    let cleaned = 0;

    for (const file of fs.readdirSync(TEMP_DIR)) {
      if (file.startsWith('.')) continue; // Skip hidden files

      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > cutoff) {
        fs.rmSync(filePath, { recursive: true, force: true });
        cleaned++;
      }
    }

    return cleaned;
  }
}
