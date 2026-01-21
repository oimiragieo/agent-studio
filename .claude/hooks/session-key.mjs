import { existsSync } from 'fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_TMP_DIR = join(__dirname, '..', 'context', 'tmp');
const DEFAULT_SHARED_KEY_PATH = join(DEFAULT_TMP_DIR, 'shared-session-key.json');
// Keep this comfortably longer than any realistic single interactive session.
// The key is rotated at SessionStart; this TTL mainly prevents stale keys if that
// hook didn't run (or the file was copied between machines).
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours (sliding/refreshable)

function getEnvTmpDir() {
  const v =
    process.env.CLAUDE_HOOK_TMP_DIR ||
    process.env.CLAUDE_TMP_DIR ||
    process.env.CLAUDE_CONTEXT_TMP_DIR ||
    '';
  return v ? String(v) : '';
}

function makeTempPath(targetPath) {
  const dir = dirname(targetPath);
  const name = `.${basename(targetPath)}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
  return join(dir, name);
}

async function atomicWriteJson(targetPath, data) {
  await mkdir(dirname(targetPath), { recursive: true });
  const tmpPath = makeTempPath(targetPath);
  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  try {
    await rename(tmpPath, targetPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => {});
    throw error;
  }
}

async function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

async function persistSharedSessionKey({ sharedKeyPath, sessionKey, source }) {
  const now = Date.now();
  const normalized = normalizeSessionKey(sessionKey);
  if (!normalized) return;

  try {
    await atomicWriteJson(sharedKeyPath, {
      session_key: normalized,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + DEFAULT_TTL_MS).toISOString(),
      created_by_pid: process.pid,
      created_by: source || 'session-key',
      refreshed_at: new Date(now).toISOString(),
      refreshed_by_pid: process.pid,
    });
  } catch {
    // Best-effort; races are fine.
  }
}

export function getEnvSessionKey() {
  const env =
    process.env.CLAUDE_CODE_SESSION_ID ||
    process.env.CLAUDE_SESSION_ID ||
    process.env.CLAUDE_SESSION ||
    process.env.CLAUDE_CONVERSATION_ID ||
    process.env.CLAUDE_CONVERSATION_UUID ||
    process.env.CLAUDE_CHAT_ID ||
    '';
  return env ? String(env) : '';
}

function normalizeSessionKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('shared-') || s.startsWith('ppid-')) return s;

  // Claude Code commonly provides UUID-like ids via env vars (especially in debug mode).
  // Normalize to the repo's shared session key format so all hook processes converge.
  const uuidish = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidish.test(s)) return `shared-${s}`;

  // Preserve other ids as-is to avoid surprising behavior in tests or integrations
  // that already provide a stable custom session key.
  return s;
}

/**
 * Best-effort extraction of a stable session key from a Claude Code hook payload.
 *
 * Claude Code does not always propagate session ids via env vars to hook processes.
 * When present in the hook payload, prefer these IDs to avoid cross-session state
 * collisions in routing/observability.
 */
export function extractSessionKeyFromHookInput(hookInput) {
  if (!hookInput || typeof hookInput !== 'object') return '';
  const context =
    (hookInput.context && typeof hookInput.context === 'object' ? hookInput.context : null) ||
    (hookInput.ctx && typeof hookInput.ctx === 'object' ? hookInput.ctx : null) ||
    null;

  const candidates = [
    hookInput.session_key,
    hookInput.sessionKey,
    hookInput.session_id,
    hookInput.sessionId,
    hookInput.conversation_id,
    hookInput.conversationId,
    hookInput.conversation_uuid,
    hookInput.conversationUuid,
    hookInput.conversation,
    hookInput.chat_id,
    hookInput.chatId,
    context?.session_key,
    context?.sessionKey,
    context?.session_id,
    context?.sessionId,
    context?.conversation_id,
    context?.conversationId,
    context?.conversation_uuid,
    context?.conversationUuid,
    context?.conversation,
    context?.chat_id,
    context?.chatId,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const normalized = normalizeSessionKey(candidate);
    if (normalized) return normalized;
  }
  return '';
}

/**
 * Returns a stable session key for the current Claude run.
 *
 * Priority:
 * 1) Claude-provided env var ids (best)
 * 2) A shared on-disk key (best-effort, for multi-process runs when env ids are absent)
 * 3) `ppid-<ppid>` fallback (last resort)
 */
export async function getStableSessionKey({ tmpDir = DEFAULT_TMP_DIR } = {}) {
  const effectiveTmpDir = getEnvTmpDir() || tmpDir;
  const sharedKeyPath = join(effectiveTmpDir, 'shared-session-key.json');

  const envKey = normalizeSessionKey(getEnvSessionKey());
  if (envKey) {
    // Ensure all hook processes converge on a single key even when only some of them
    // receive env session ids (common on Windows and in debug mode).
    await persistSharedSessionKey({ sharedKeyPath, sessionKey: envKey, source: 'env-session-id' });
    return envKey;
  }

  const existing = await readJson(sharedKeyPath);
  const now = Date.now();
  if (
    existing &&
    typeof existing.session_key === 'string' &&
    existing.session_key.trim() &&
    typeof existing.expires_at === 'string' &&
    !Number.isNaN(Date.parse(existing.expires_at)) &&
    Date.parse(existing.expires_at) > now
  ) {
    // Sliding refresh: avoid mid-session expiry that would fragment routing/observability state
    // across processes (common on Windows where hooks can run in separate Node processes).
    try {
      await atomicWriteJson(sharedKeyPath, {
        ...existing,
        expires_at: new Date(now + DEFAULT_TTL_MS).toISOString(),
        refreshed_at: new Date(now).toISOString(),
        refreshed_by_pid: process.pid,
      });
    } catch {
      // Best-effort; races are fine.
    }
    return existing.session_key.trim();
  }

  // Create (or rotate) a new shared key. This MUST be overwrite-capable:
  // the file can exist but be expired, and a create-only write would keep
  // returning a stale key forever.
  const created = {
    session_key: `shared-${randomUUID()}`,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + DEFAULT_TTL_MS).toISOString(),
    created_by_pid: process.pid,
  };

  try {
    await atomicWriteJson(sharedKeyPath, created);
    return created.session_key;
  } catch {
    // If another process races us, read again.
    const reread = await readJson(sharedKeyPath);
    if (reread?.session_key && typeof reread.session_key === 'string') return reread.session_key;
  }

  // Last resort (may be process-fragmenting).
  return `ppid-${process.ppid}`;
}

/**
 * Returns the best session key for a given hook invocation and ensures that key
 * is persisted to shared-session-key.json so other hook processes converge.
 *
 * Priority:
 * 1) hook payload ids (when present)
 * 2) env ids (when present)
 * 3) shared on-disk key
 * 4) ppid fallback
 */
export async function getSessionKeyForHook({ hookInput, tmpDir = DEFAULT_TMP_DIR } = {}) {
  const effectiveTmpDir = getEnvTmpDir() || tmpDir;
  const sharedKeyPath = join(effectiveTmpDir, 'shared-session-key.json');

  const fromHook = extractSessionKeyFromHookInput(hookInput);
  if (fromHook) {
    await persistSharedSessionKey({ sharedKeyPath, sessionKey: fromHook, source: 'hook-input' });
    return fromHook;
  }

  return await getStableSessionKey({ tmpDir: effectiveTmpDir });
}
