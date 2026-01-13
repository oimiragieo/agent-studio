/**
 * Preference Tracker Tests
 *
 * Test suite for PreferenceTracker class (Step 2.8)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { unlink } from 'node:fs/promises';
import { MemoryDatabase } from './database.mjs';
import { PreferenceTracker } from './preference-tracker.mjs';

const TEST_DB_PATH = './.claude/context/memory/test-preferences.db';

describe('PreferenceTracker', () => {
  let db;
  let tracker;
  const testSessionId = 'test-session-001';
  const testUserId = 'test-user-001';

  before(async () => {
    // Initialize database
    db = new MemoryDatabase(TEST_DB_PATH);
    await db.initialize();

    // Create test session
    db.createSession({
      sessionId: testSessionId,
      userId: testUserId,
      projectId: 'test-project',
    });

    // Create tracker
    tracker = new PreferenceTracker(db);
  });

  after(async () => {
    // Cleanup
    db.close();
    try {
      await unlink(TEST_DB_PATH);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('recordPreference()', () => {
    it('should record a new preference', async () => {
      const result = await tracker.recordPreference(testSessionId, 'code_style', 'airbnb', 0.9);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.userId, testUserId);
      assert.strictEqual(result.key, 'code_style');
      assert.strictEqual(result.value, 'airbnb');
      assert.strictEqual(result.confidence, 0.9);
    });

    it('should update an existing preference', async () => {
      // Initial preference
      await tracker.recordPreference(testSessionId, 'language', 'javascript', 0.7);

      // Update preference
      const result = await tracker.recordPreference(testSessionId, 'language', 'typescript', 0.95);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.value, 'typescript');
      assert.strictEqual(result.confidence, 0.95);

      // Verify update
      const pref = await tracker.getPreference(testUserId, 'language');
      assert.strictEqual(pref.value, 'typescript');
      assert.strictEqual(pref.confidence, 0.95);
    });

    it('should default confidence to 1.0', async () => {
      const result = await tracker.recordPreference(testSessionId, 'framework', 'react');

      assert.strictEqual(result.confidence, 1.0);
    });

    it('should throw on invalid sessionId', async () => {
      await assert.rejects(async () => {
        await tracker.recordPreference('', 'key', 'value');
      }, /Valid sessionId required/);
    });

    it('should throw on invalid confidence', async () => {
      await assert.rejects(async () => {
        await tracker.recordPreference(testSessionId, 'key', 'value', 1.5);
      }, /Confidence must be a number between 0.0 and 1.0/);
    });
  });

  describe('getPreference()', () => {
    before(async () => {
      await tracker.recordPreference(testSessionId, 'editor', 'vscode', 0.85);
    });

    it('should retrieve existing preference', async () => {
      const pref = await tracker.getPreference(testUserId, 'editor');

      assert.ok(pref);
      assert.strictEqual(pref.key, 'editor');
      assert.strictEqual(pref.value, 'vscode');
      assert.strictEqual(pref.confidence, 0.85);
      assert.ok(pref.lastUpdated);
    });

    it('should return null for non-existent preference', async () => {
      const pref = await tracker.getPreference(testUserId, 'non_existent');
      assert.strictEqual(pref, null);
    });

    it('should throw on invalid userId', async () => {
      await assert.rejects(async () => {
        await tracker.getPreference('', 'key');
      }, /Valid userId required/);
    });
  });

  describe('getAllPreferences()', () => {
    before(async () => {
      // Clear previous preferences by creating a new session
      const newSessionId = 'test-session-002';
      const newUserId = 'test-user-002';

      db.createSession({
        sessionId: newSessionId,
        userId: newUserId,
        projectId: 'test-project',
      });

      // Add multiple preferences
      await tracker.recordPreference(newSessionId, 'code_style', 'standard', 0.8);
      await tracker.recordPreference(newSessionId, 'language', 'python', 0.9);
      await tracker.recordPreference(newSessionId, 'framework', 'fastapi', 0.7);
    });

    it('should retrieve all preferences for a user', async () => {
      const prefs = await tracker.getAllPreferences('test-user-002');

      assert.strictEqual(prefs.length, 3);
      assert.ok(prefs.every(p => ['code_style', 'language', 'framework'].includes(p.key)));
      assert.ok(prefs.every(p => p.confidence > 0));
    });

    it('should return empty array for user with no preferences', async () => {
      const prefs = await tracker.getAllPreferences('non-existent-user');
      assert.strictEqual(prefs.length, 0);
    });

    it('should sort by most recently updated first', async () => {
      const prefs = await tracker.getAllPreferences('test-user-002');

      // Most recent should be first
      assert.ok(prefs[0].lastUpdated >= prefs[1].lastUpdated);
    });
  });

  describe('updateConfidence()', () => {
    const updateUserId = 'test-user-003';
    const updateSessionId = 'test-session-003';

    before(async () => {
      db.createSession({
        sessionId: updateSessionId,
        userId: updateUserId,
        projectId: 'test-project',
      });

      await tracker.recordPreference(updateSessionId, 'theme', 'dark', 0.5);
    });

    it('should update confidence score', async () => {
      const result = await tracker.updateConfidence(updateUserId, 'theme', 0.95);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.key, 'theme');
      assert.strictEqual(result.oldConfidence, 0.5);
      assert.strictEqual(result.newConfidence, 0.95);

      // Verify update
      const pref = await tracker.getPreference(updateUserId, 'theme');
      assert.strictEqual(pref.confidence, 0.95);
    });

    it('should throw for non-existent preference', async () => {
      await assert.rejects(async () => {
        await tracker.updateConfidence(updateUserId, 'non_existent', 0.5);
      }, /Preference not found/);
    });

    it('should throw on invalid confidence', async () => {
      await assert.rejects(async () => {
        await tracker.updateConfidence(updateUserId, 'theme', -0.1);
      }, /Confidence must be a number between 0.0 and 1.0/);
    });
  });

  describe('deletePreference()', () => {
    const deleteUserId = 'test-user-004';
    const deleteSessionId = 'test-session-004';

    before(async () => {
      db.createSession({
        sessionId: deleteSessionId,
        userId: deleteUserId,
        projectId: 'test-project',
      });

      await tracker.recordPreference(deleteSessionId, 'temp_pref', 'value', 0.5);
    });

    it('should delete existing preference', async () => {
      const result = await tracker.deletePreference(deleteUserId, 'temp_pref');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.deleted, true);

      // Verify deletion
      const pref = await tracker.getPreference(deleteUserId, 'temp_pref');
      assert.strictEqual(pref, null);
    });

    it('should return deleted: false for non-existent preference', async () => {
      const result = await tracker.deletePreference(deleteUserId, 'non_existent');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.deleted, false);
    });
  });

  describe('getPreferencesByPattern()', () => {
    const patternUserId = 'test-user-005';
    const patternSessionId = 'test-session-005';

    before(async () => {
      db.createSession({
        sessionId: patternSessionId,
        userId: patternUserId,
        projectId: 'test-project',
      });

      await tracker.recordPreference(patternSessionId, 'lang_primary', 'typescript', 0.9);
      await tracker.recordPreference(patternSessionId, 'lang_secondary', 'python', 0.7);
      await tracker.recordPreference(patternSessionId, 'editor', 'vscode', 0.8);
    });

    it('should retrieve preferences matching pattern', async () => {
      const langPrefs = await tracker.getPreferencesByPattern(patternUserId, 'lang_%');

      assert.strictEqual(langPrefs.length, 2);
      assert.ok(langPrefs.every(p => p.key.startsWith('lang_')));
    });

    it('should return empty array for non-matching pattern', async () => {
      const prefs = await tracker.getPreferencesByPattern(patternUserId, 'no_match_%');
      assert.strictEqual(prefs.length, 0);
    });
  });

  describe('applyConfidenceDecay()', () => {
    const decayUserId = 'test-user-006';
    const decaySessionId = 'test-session-006';

    before(async () => {
      db.createSession({
        sessionId: decaySessionId,
        userId: decayUserId,
        projectId: 'test-project',
      });

      // Record preferences
      await tracker.recordPreference(decaySessionId, 'old_pref', 'value', 1.0);

      // Manually update timestamp to make it stale
      db.exec(`
                UPDATE user_preferences
                SET updated_at = datetime('now', '-40 days')
                WHERE user_id = '${decayUserId}' AND preference_key = 'old_pref'
            `);

      // Recent preference (should not decay)
      await tracker.recordPreference(decaySessionId, 'recent_pref', 'value', 1.0);
    });

    it('should decay stale preferences', async () => {
      const result = await tracker.applyConfidenceDecay(decayUserId, 30, 0.8);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decayed, 1); // Only old_pref should decay

      // Verify decay
      const oldPref = await tracker.getPreference(decayUserId, 'old_pref');
      assert.strictEqual(oldPref.confidence, 0.8); // 1.0 * 0.8

      // Recent preference should not decay
      const recentPref = await tracker.getPreference(decayUserId, 'recent_pref');
      assert.strictEqual(recentPref.confidence, 1.0);
    });

    it('should enforce minimum confidence of 0.1', async () => {
      // Apply multiple decays
      await tracker.applyConfidenceDecay(decayUserId, 30, 0.1);

      const pref = await tracker.getPreference(decayUserId, 'old_pref');
      assert.ok(pref.confidence >= 0.1);
    });
  });

  describe('getPreferenceStats()', () => {
    const statsUserId = 'test-user-007';
    const statsSessionId = 'test-session-007';

    before(async () => {
      db.createSession({
        sessionId: statsSessionId,
        userId: statsUserId,
        projectId: 'test-project',
      });

      await tracker.recordPreference(statsSessionId, 'pref1', 'value1', 0.8);
      await tracker.recordPreference(statsSessionId, 'pref2', 'value2', 0.6);
      await tracker.recordPreference(statsSessionId, 'pref3', 'value3', 1.0);
    });

    it('should return accurate statistics', async () => {
      const stats = await tracker.getPreferenceStats(statsUserId);

      assert.strictEqual(stats.totalPreferences, 3);
      assert.strictEqual(stats.avgConfidence, 0.8); // (0.8 + 0.6 + 1.0) / 3
      assert.ok(stats.mostRecent);
      assert.ok(stats.oldestUpdated);
    });

    it('should return zero stats for user with no preferences', async () => {
      const stats = await tracker.getPreferenceStats('non-existent-user');

      assert.strictEqual(stats.totalPreferences, 0);
      assert.strictEqual(stats.avgConfidence, 0);
      assert.strictEqual(stats.mostRecent, null);
      assert.strictEqual(stats.oldestUpdated, null);
    });
  });
});
