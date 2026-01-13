# Memory Database - Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies

```bash
pnpm install
```

This installs `better-sqlite3@^11.0.0` for SQLite access.

### 2. Initialize Database

```javascript
import { createMemoryDatabase } from '.claude/tools/memory/database.mjs';

const db = createMemoryDatabase();
await db.initialize(); // Creates schema, runs migrations (~50ms)
```

### 3. Create Your First Session

```javascript
db.createSession({
  sessionId: 'my-session-001',
  userId: 'developer-123',
  projectId: 'my-project',
  metadata: { environment: 'development' },
});
```

### 4. Add a Conversation

```javascript
const convId = db.createConversation({
  sessionId: 'my-session-001',
  conversationId: 'conv-001',
  title: 'Getting Started with Memory DB',
});
```

### 5. Add Messages

```javascript
db.addMessage({
  conversationId: convId,
  role: 'user',
  content: 'How do I use the memory database?',
  tokenCount: 8,
});

db.addMessage({
  conversationId: convId,
  role: 'assistant',
  content: 'Follow the Quick Start guide!',
  tokenCount: 6,
});
```

### 6. Search Messages

```javascript
// Full-text search (FTS5)
const results = db.searchMessages('memory database', 10);

results.forEach(msg => {
  console.log(`[${msg.role}]: ${msg.content}`);
});
```

### 7. Get Recent Messages

```javascript
const messages = db.getRecentMessages('my-session-001', 5);
```

### 8. Close Database

```javascript
db.close();
```

---

## Common Patterns

### Pattern 1: Session Lifecycle

```javascript
// Create session when user connects
const sessionId = `sess-${Date.now()}`;
db.createSession({ sessionId, userId, projectId });

// Update last activity on each interaction
db.updateSession(sessionId, { metadata: { lastAction: 'code_review' } });

// Pause session when user disconnects
db.updateSession(sessionId, { status: 'paused' });

// Resume session later
db.updateSession(sessionId, { status: 'active' });

// Archive old sessions
db.updateSession(sessionId, { status: 'archived' });
```

### Pattern 2: Conversation Flow

```javascript
// Start conversation
const convId = db.createConversation({
  sessionId,
  conversationId: `conv-${Date.now()}`,
  title: 'Code Review Request',
});

// Add messages as conversation progresses
db.addMessage({ conversationId: convId, role: 'user', content: '...' });
db.addMessage({ conversationId: convId, role: 'assistant', content: '...' });

// End conversation with summary
db.prepare(
  `
    UPDATE conversations
    SET ended_at = CURRENT_TIMESTAMP,
        summary = ?
    WHERE id = ?
`
).run('Reviewed authentication logic', convId);
```

### Pattern 3: Cost Tracking

```javascript
// Track costs per request
function trackCost({ sessionId, model, inputTokens, outputTokens }) {
  const cost = calculateCost(model, inputTokens, outputTokens);

  db.prepare(
    `
        INSERT INTO cost_tracking (session_id, model, input_tokens, output_tokens, cost_usd)
        VALUES (?, ?, ?, ?, ?)
    `
  ).run(sessionId, model, inputTokens, outputTokens, cost);
}

// Get total cost for session
const totalCost = db
  .prepare(
    `
    SELECT SUM(cost_usd) as total FROM cost_tracking WHERE session_id = ?
`
  )
  .get(sessionId);
```

### Pattern 4: Batch Operations

```javascript
// Use transactions for bulk inserts
db.transaction(() => {
  for (const message of bulkMessages) {
    db.addMessage(message);
  }
})();
```

### Pattern 5: User Preferences

```javascript
// Save preference
db.prepare(
  `
    INSERT INTO user_preferences (user_id, preference_key, preference_value)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, preference_key) DO UPDATE SET
        preference_value = ?,
        updated_at = CURRENT_TIMESTAMP
`
).run(userId, 'code_style', 'prettier', 'prettier');

// Get all preferences
const prefs = db
  .prepare(
    `
    SELECT preference_key, preference_value
    FROM user_preferences
    WHERE user_id = ?
`
  )
  .all(userId);
```

---

## Testing

Run the test suite:

```bash
node .claude/tools/memory/database.test.mjs
```

Expected output:

```
=== Memory Database Test Suite ===

✅ Database initialization completes in <100ms
✅ Database creates all required tables
✅ WAL mode is enabled
✅ Foreign keys are enabled
✅ Schema version is tracked
... (17 more tests)

=== Test Results ===
Passed: 22
Failed: 0
Total: 22
```

---

## Performance Tips

### 1. Use Prepared Statements

```javascript
// ❌ Slow: Create new statement each time
for (const msg of messages) {
  db.prepare('INSERT INTO messages ...').run(msg.content);
}

// ✅ Fast: Reuse prepared statement
const stmt = db.prepare('INSERT INTO messages ...');
for (const msg of messages) {
  stmt.run(msg.content);
}
```

### 2. Use Transactions for Bulk Writes

```javascript
// ❌ Slow: Individual inserts
for (const msg of messages) {
  db.addMessage(msg);
}

// ✅ Fast: Batch in transaction
db.transaction(() => {
  for (const msg of messages) {
    db.addMessage(msg);
  }
})();
```

### 3. Limit Result Sets

```javascript
// ❌ Slow: Load all messages
const all = db.prepare('SELECT * FROM messages').all();

// ✅ Fast: Limit to needed rows
const recent = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 10').all();
```

---

## Troubleshooting

### Error: "Cannot open database"

**Cause**: Database directory doesn't exist.

**Solution**:

```javascript
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const dbPath = '.claude/context/memory/sessions.db';
mkdirSync(dirname(dbPath), { recursive: true });
```

### Error: "Database is locked"

**Cause**: Another process has write lock.

**Solution**: Close other connections or wait for write to complete. WAL mode allows concurrent reads.

### Error: "FTS5 extension not found"

**Cause**: SQLite built without FTS5.

**Solution**: Use `better-sqlite3` which includes FTS5 by default.

### Slow Queries

**Diagnosis**:

```javascript
const plan = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM messages WHERE ...').all();
console.log(plan);
```

**Solutions**:

- Add missing indexes
- Use `LIMIT` clauses
- Run `VACUUM` to optimize
- Update statistics: `db.exec('ANALYZE')`

---

## Next Steps

1. **Read Full Documentation**: `.claude/tools/memory/README.md`
2. **Review Architecture**: `.claude/context/artifacts/architecture-phase-2-memory-system.md`
3. **Integrate with Router**: Connect to Phase 1 Router Session Handler
4. **Build Memory Injection**: Implement memory retrieval for context injection

---

## Need Help?

- **Full Documentation**: `.claude/tools/memory/README.md`
- **Implementation Report**: `.claude/context/reports/phase-2-memory-database-implementation.md`
- **Architecture Design**: `.claude/context/artifacts/architecture-phase-2-memory-system.md`
- **Test Examples**: `.claude/tools/memory/database.test.mjs`

---

**Happy Coding! 🚀**
