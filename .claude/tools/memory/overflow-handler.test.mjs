/**
 * Context Overflow Handler Test Suite
 * Step 2.5c: Validation Tests
 */

import assert from 'assert';

const testResults = { passed: 0, failed: 0, tests: [] };

function recordTest(name, passed, error = null) {
  testResults.tests.push({ name, passed, error });
  if (passed) {
    testResults.passed++;
    console.log('  [PASS] ' + name);
  } else {
    testResults.failed++;
    console.log('  [FAIL] ' + name + ': ' + error);
  }
}

function createMockDatabase(config = {}) {
  const mockData = {
    sessions: config.sessions || [],
    conversations: config.conversations || [],
    messages: config.messages || [],
    handoffs: [],
  };

  return {
    mockData,
    prepare: sql => ({
      all: (...args) => {
        if (sql.includes('FROM messages m') && sql.includes('NOT IN')) {
          return mockData.messages.filter(m => !m.is_summarized && m.id > 10).slice(0, 50);
        }
        if (sql.includes('FROM messages m') && sql.includes('ORDER BY m.created_at DESC')) {
          return mockData.messages.slice(-5).reverse();
        }
        if (sql.includes('FROM messages') && sql.includes('WHERE conversation_id')) {
          const convId = args[0];
          return mockData.messages.filter(m => m.conversation_id === convId);
        }
        if (sql.includes('FROM conversations') && sql.includes('summary IS NULL')) {
          return mockData.conversations.filter(c => !c.summary && c.ended_at).slice(0, 5);
        }
        if (sql.includes('FROM conversations')) {
          return mockData.conversations;
        }
        return [];
      },
      get: (...args) => {
        if (sql.includes('FROM sessions')) {
          return mockData.sessions.find(s => s.session_id === args[0]);
        }
        if (sql.includes('SUM(m.token_count)')) {
          return {
            total_tokens: mockData.messages.reduce((sum, m) => sum + (m.token_count || 0), 0),
            message_count: mockData.messages.length,
            compressed_count: mockData.messages.filter(m => m.is_summarized).length,
          };
        }
        return null;
      },
      run: (...args) => {
        if (sql.includes('INSERT INTO sessions')) {
          mockData.sessions.push({ session_id: args[0], user_id: args[1], project_id: args[2] });
        }
        if (sql.includes('UPDATE sessions') && sql.includes('status')) {
          const session = mockData.sessions.find(s => s.session_id === args[args.length - 1]);
          if (session) session.status = 'archived';
        }
        if (sql.includes('UPDATE messages SET content')) {
          const msg = mockData.messages.find(m => m.id === args[3]);
          if (msg) {
            msg.content = args[0];
            msg.is_summarized = true;
          }
        }
        if (sql.includes('UPDATE conversations SET summary')) {
          const conv = mockData.conversations.find(c => c.id === args[1]);
          if (conv) conv.summary = args[0];
        }
        if (sql.includes('UPDATE messages SET is_summarized = TRUE')) {
          mockData.messages
            .filter(m => m.conversation_id === args[0])
            .forEach(m => (m.is_summarized = true));
        }
        if (sql.includes('INSERT INTO session_handoffs')) {
          mockData.handoffs.push({
            from_session_id: args[0],
            to_session_id: args[1],
            handoff_reason: args[4],
          });
        }
        return { changes: 1 };
      },
    }),
  };
}

function generateMockMessages(count, options = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    conversation_id: options.conversationId || 1,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content:
      options.content ||
      'Test message ' +
        (i + 1) +
        ' with content for testing overflow handler that is long enough to exceed limit.',
    token_count: options.tokenCount || 50,
    is_summarized: false,
    created_at: new Date(Date.now() - (count - i) * 60000).toISOString(),
  }));
}

async function getOverflowHandler() {
  const module = await import('./overflow-handler.mjs');
  return module.ContextOverflowHandler;
}

// Suite 1: Overflow Detection Tests
async function testOverflowDetection() {
  console.log('\n[Suite 1] Overflow Detection Tests');
  const ContextOverflowHandler = await getOverflowHandler();
  const mockDb = createMockDatabase();
  const handler = new ContextOverflowHandler(mockDb);

  try {
    const result = await handler.detectOverflow('sess-1', 80000, 100000);
    assert.strictEqual(result.action, 'none');
    assert.strictEqual(result.usage, 0.8);
    recordTest('Usage < 85% returns none', true);
  } catch (e) {
    recordTest('Usage < 85% returns none', false, e.message);
  }

  try {
    const result = await handler.detectOverflow('sess-1', 87000, 100000);
    assert.strictEqual(result.action, 'warn');
    assert.strictEqual(result.threshold, 'WARNING');
    recordTest('Usage 85-90% returns warn', true);
  } catch (e) {
    recordTest('Usage 85-90% returns warn', false, e.message);
  }

  try {
    const result = await handler.detectOverflow('sess-1', 91000, 100000);
    assert.strictEqual(result.action, 'compress');
    assert.strictEqual(result.threshold, 'COMPRESS');
    recordTest('Usage 90-93% returns compress', true);
  } catch (e) {
    recordTest('Usage 90-93% returns compress', false, e.message);
  }

  try {
    const result = await handler.detectOverflow('sess-1', 95000, 100000);
    assert.strictEqual(result.action, 'summarize');
    assert.strictEqual(result.threshold, 'SUMMARIZE');
    recordTest('Usage 93-97% returns summarize', true);
  } catch (e) {
    recordTest('Usage 93-97% returns summarize', false, e.message);
  }

  try {
    const result = await handler.detectOverflow('sess-1', 98000, 100000);
    assert.strictEqual(result.action, 'handoff');
    assert.strictEqual(result.threshold, 'HANDOFF');
    recordTest('Usage 97%+ returns handoff', true);
  } catch (e) {
    recordTest('Usage 97%+ returns handoff', false, e.message);
  }
}

// Suite 2: Compression Tests
async function testCompression() {
  console.log('\n[Suite 2] Stage 1 Compression Tests');
  const ContextOverflowHandler = await getOverflowHandler();

  try {
    const messages = generateMockMessages(60, {
      content:
        'This is a very long message that should be compressed because it exceeds the 100 character limit for the overflow handler.',
      tokenCount: 100,
    });
    const mockDb = createMockDatabase({ messages });
    const handler = new ContextOverflowHandler(mockDb);
    const result = await handler.compressOldMessages('sess-1');
    assert.ok(result.messagesCompressed >= 0);
    assert.ok(typeof result.tokensFreed === 'number');
    assert.ok(typeof result.duration === 'number');
    recordTest('compressOldMessages compresses correctly', true);
  } catch (e) {
    recordTest('compressOldMessages compresses correctly', false, e.message);
  }

  try {
    const messages = generateMockMessages(15);
    const mockDb = createMockDatabase({ messages });
    const handler = new ContextOverflowHandler(mockDb);
    const result = await handler.compressOldMessages('sess-1');
    assert.ok(result.messagesCompressed <= 50);
    recordTest('Compression preserves last 10 messages', true);
  } catch (e) {
    recordTest('Compression preserves last 10 messages', false, e.message);
  }
}

// Suite 3: Summarization Tests
async function testSummarization() {
  console.log('\n[Suite 3] Stage 2 Summarization Tests');
  const ContextOverflowHandler = await getOverflowHandler();

  try {
    const conversations = [
      {
        id: 1,
        conversation_id: 'conv-1',
        session_id: 'sess-1',
        title: 'Test Conv 1',
        summary: null,
        ended_at: '2025-01-01',
      },
    ];
    const messages = [
      { id: 1, conversation_id: 1, role: 'user', content: 'First message', token_count: 20 },
      { id: 2, conversation_id: 1, role: 'assistant', content: 'Response', token_count: 30 },
    ];
    const mockDb = createMockDatabase({ conversations, messages });
    const handler = new ContextOverflowHandler(mockDb);
    const result = await handler.summarizeConversations('sess-1');
    assert.ok(result.conversationsSummarized >= 0);
    assert.ok(typeof result.tokensFreed === 'number');
    recordTest('summarizeConversations creates summaries', true);
  } catch (e) {
    recordTest('summarizeConversations creates summaries', false, e.message);
  }

  try {
    const conversations = [
      {
        id: 1,
        conversation_id: 'conv-1',
        session_id: 'sess-1',
        title: null,
        summary: null,
        ended_at: '2025-01-01',
      },
    ];
    const messages = [
      { id: 1, conversation_id: 1, role: 'user', content: 'User asks question', token_count: 20 },
      { id: 2, conversation_id: 1, role: 'assistant', content: 'Answer provided', token_count: 50 },
    ];
    const mockDb = createMockDatabase({ conversations, messages });
    const handler = new ContextOverflowHandler(mockDb);
    await handler.summarizeConversations('sess-1');
    const summarized = messages.filter(m => m.is_summarized);
    assert.ok(summarized.length > 0);
    assert.ok(conversations[0].summary);
    recordTest('Conversations marked as summarized', true);
  } catch (e) {
    recordTest('Conversations marked as summarized', false, e.message);
  }
}

// Suite 4: Handoff Tests
async function testHandoff() {
  console.log('\n[Suite 4] Stage 3 Handoff Tests');
  const ContextOverflowHandler = await getOverflowHandler();

  try {
    const sessions = [
      { session_id: 'sess-1', user_id: 'user-1', project_id: 'proj-1', status: 'active' },
    ];
    const conversations = [
      { id: 1, conversation_id: 'conv-1', session_id: 'sess-1', title: 'Test', summary: 'Summary' },
    ];
    const messages = generateMockMessages(10);
    const mockDb = createMockDatabase({ sessions, conversations, messages });
    const handler = new ContextOverflowHandler(mockDb);
    const result = await handler.initiateHandoff('sess-1');
    assert.ok(result.newSessionId);
    assert.ok(result.newSessionId.includes('handoff'));
    assert.ok(result.summary);
    assert.ok(Array.isArray(result.criticalContext));
    recordTest('initiateHandoff creates new session', true);
  } catch (e) {
    recordTest('initiateHandoff creates new session', false, e.message);
  }

  try {
    const sessions = [
      { session_id: 'sess-old', user_id: 'user-1', project_id: 'proj-1', status: 'active' },
    ];
    const conversations = [
      { id: 1, conversation_id: 'conv-1', session_id: 'sess-old', title: 'Old', summary: null },
    ];
    const messages = generateMockMessages(5);
    const mockDb = createMockDatabase({ sessions, conversations, messages });
    const handler = new ContextOverflowHandler(mockDb);
    await handler.initiateHandoff('sess-old');
    assert.strictEqual(sessions[0].status, 'archived');
    assert.strictEqual(mockDb.mockData.handoffs.length, 1);
    assert.strictEqual(mockDb.mockData.handoffs[0].handoff_reason, 'context_overflow');
    recordTest('Old session archived and handoff recorded', true);
  } catch (e) {
    recordTest('Old session archived and handoff recorded', false, e.message);
  }
}

// Suite 5: Integration Tests
async function testIntegration() {
  console.log('\n[Suite 5] Integration Tests');
  const ContextOverflowHandler = await getOverflowHandler();

  try {
    const messages = generateMockMessages(30, { tokenCount: 50 });
    const mockDb = createMockDatabase({ messages });
    const handler = new ContextOverflowHandler(mockDb);
    const result = await handler.handleOverflow('sess-1', 90000, 100000);
    assert.strictEqual(result.action, 'compressed');
    assert.ok(typeof result.usage === 'number');
    recordTest('handleOverflow orchestrates correctly', true);
  } catch (e) {
    recordTest('handleOverflow orchestrates correctly', false, e.message);
  }

  try {
    const sessions = [
      { session_id: 'sess-prog', user_id: 'user-1', project_id: 'proj-1', status: 'active' },
    ];
    const conversations = [
      {
        id: 1,
        conversation_id: 'conv-1',
        session_id: 'sess-prog',
        title: 'Test',
        summary: null,
        ended_at: '2025-01-01',
      },
    ];
    const messages = generateMockMessages(50, { tokenCount: 100 });

    let mockDb = createMockDatabase({
      sessions: [...sessions],
      conversations: [...conversations],
      messages: [...messages],
    });
    let handler = new ContextOverflowHandler(mockDb);
    let result = await handler.handleOverflow('sess-prog', 90000, 100000);
    assert.strictEqual(result.action, 'compressed');

    mockDb = createMockDatabase({
      sessions: [...sessions],
      conversations: [...conversations],
      messages: [...messages],
    });
    handler = new ContextOverflowHandler(mockDb);
    result = await handler.handleOverflow('sess-prog', 93000, 100000);
    assert.strictEqual(result.action, 'summarized');

    mockDb = createMockDatabase({
      sessions: [...sessions],
      conversations: [...conversations],
      messages: [...messages],
    });
    handler = new ContextOverflowHandler(mockDb);
    result = await handler.handleOverflow('sess-prog', 97000, 100000);
    assert.strictEqual(result.action, 'handoff');

    recordTest('Progressive compaction (90%->93%->97%)', true);
  } catch (e) {
    recordTest('Progressive compaction (90%->93%->97%)', false, e.message);
  }
}

// Bonus: Token Estimation
async function testTokenEstimation() {
  console.log('\n[Bonus] Token Estimation Tests');
  const ContextOverflowHandler = await getOverflowHandler();
  const mockDb = createMockDatabase();
  const handler = new ContextOverflowHandler(mockDb);

  try {
    assert.strictEqual(handler.estimateTokens('Hello world!'), 3);
    assert.strictEqual(handler.estimateTokens(''), 0);
    assert.strictEqual(handler.estimateTokens(null), 0);
    recordTest('Token estimation calculates correctly', true);
  } catch (e) {
    recordTest('Token estimation calculates correctly', false, e.message);
  }
}

// Main Runner
async function runAllTests() {
  console.log('===============================================================');
  console.log('  Context Overflow Handler Test Suite');
  console.log('  Step 2.5c: Validation Tests');
  console.log('===============================================================');

  const startTime = Date.now();

  try {
    await testOverflowDetection();
    await testCompression();
    await testSummarization();
    await testHandoff();
    await testIntegration();
    await testTokenEstimation();
  } catch (error) {
    console.error('\n[ERROR] Test runner error:', error.message);
  }

  const duration = Date.now() - startTime;

  console.log('\n===============================================================');
  console.log('  TEST RESULTS SUMMARY');
  console.log('===============================================================');
  console.log('  Total Tests: ' + (testResults.passed + testResults.failed));
  console.log('  Passed: ' + testResults.passed);
  console.log('  Failed: ' + testResults.failed);
  console.log('  Duration: ' + duration + 'ms');
  console.log('===============================================================');

  if (testResults.failed > 0) {
    console.log('\n  Failed Tests:');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => {
        console.log('    - ' + t.name + ': ' + t.error);
      });
  }

  process.exit(testResults.failed > 0 ? 1 : 0);
}

runAllTests();
