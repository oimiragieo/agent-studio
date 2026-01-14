/**
 * Tests for A2A Message Wrapper
 *
 * Comprehensive test suite covering:
 * - Message conversion (internal ↔ A2A)
 * - Part types (text, file, data)
 * - Multi-part messages
 * - Feature flags
 * - Performance benchmarks
 * - Error handling
 *
 * @module message-wrapper.test
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { A2AMessageWrapper, Role, createMessageWrapper } from './message-wrapper.mjs';

describe('A2A Message Wrapper', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = createMessageWrapper({
      featureFlags: { a2a_message_wrapper: true },
    });
  });

  describe('toA2AMessage()', () => {
    it('should convert simple text prompt to A2A Message', () => {
      const prompt = 'Implement user authentication feature';
      const message = wrapper.toA2AMessage(prompt);

      assert.ok(message.messageId);
      assert.strictEqual(message.role, Role.USER);
      assert.ok(Array.isArray(message.parts));
      assert.strictEqual(message.parts.length, 1);
      assert.strictEqual(message.parts[0].text, prompt);
    });

    it('should support custom role', () => {
      const prompt = 'Task completed successfully';
      const message = wrapper.toA2AMessage(prompt, { role: Role.AGENT });

      assert.strictEqual(message.role, Role.AGENT);
    });

    it('should support custom messageId', () => {
      const messageId = 'msg-custom-123';
      const message = wrapper.toA2AMessage('Hello', { messageId });

      assert.strictEqual(message.messageId, messageId);
    });

    it('should support contextId', () => {
      const contextId = 'ctx-session-456';
      const message = wrapper.toA2AMessage('Hello', { contextId });

      assert.strictEqual(message.contextId, contextId);
    });

    it('should support taskId', () => {
      const taskId = 'task-789';
      const message = wrapper.toA2AMessage('Hello', { taskId });

      assert.strictEqual(message.taskId, taskId);
    });

    it('should support metadata', () => {
      const metadata = { agentId: 'developer', priority: 'high' };
      const message = wrapper.toA2AMessage('Hello', { metadata });

      assert.deepStrictEqual(message.metadata, metadata);
    });

    it('should convert object prompt to data part', () => {
      const prompt = { feature: 'authentication', priority: 1 };
      const message = wrapper.toA2AMessage(prompt);

      assert.strictEqual(message.parts.length, 1);
      assert.ok(message.parts[0].data);
      assert.deepStrictEqual(message.parts[0].data, prompt);
    });

    it('should preserve existing parts', () => {
      const prompt = {
        parts: [{ text: 'Hello' }, { data: { key: 'value' } }],
      };
      const message = wrapper.toA2AMessage(prompt);

      assert.strictEqual(message.parts.length, 2);
      assert.strictEqual(message.parts[0].text, 'Hello');
      assert.deepStrictEqual(message.parts[1].data, { key: 'value' });
    });

    it('should throw if feature flag disabled', () => {
      const disabledWrapper = createMessageWrapper({
        featureFlags: { a2a_message_wrapper: false },
      });

      assert.throws(() => {
        disabledWrapper.toA2AMessage('Hello');
      }, /feature flag is disabled/);
    });

    it('should complete in <10ms', () => {
      const start = Date.now();
      wrapper.toA2AMessage('Test performance');
      const duration = Date.now() - start;

      assert.ok(duration < 10, `Expected <10ms, got ${duration}ms`);
    });
  });

  describe('fromA2AMessage()', () => {
    it('should extract text from A2A Message', () => {
      const message = {
        messageId: 'msg-123',
        role: Role.USER,
        parts: [{ text: 'Implement feature X' }],
        metadata: {},
      };

      const prompt = wrapper.fromA2AMessage(message);

      assert.strictEqual(prompt.messageId, 'msg-123');
      assert.strictEqual(prompt.role, 'user');
      assert.strictEqual(prompt.content, 'Implement feature X');
    });

    it('should extract contextId and taskId', () => {
      const message = {
        messageId: 'msg-123',
        contextId: 'ctx-456',
        taskId: 'task-789',
        role: Role.AGENT,
        parts: [{ text: 'Done' }],
      };

      const prompt = wrapper.fromA2AMessage(message);

      assert.strictEqual(prompt.contextId, 'ctx-456');
      assert.strictEqual(prompt.taskId, 'task-789');
      assert.strictEqual(prompt.role, 'agent');
    });

    it('should combine multiple text parts', () => {
      const message = {
        messageId: 'msg-123',
        role: Role.USER,
        parts: [{ text: 'Part 1' }, { text: 'Part 2' }, { text: 'Part 3' }],
      };

      const prompt = wrapper.fromA2AMessage(message);

      assert.strictEqual(prompt.content, 'Part 1\n\nPart 2\n\nPart 3');
    });

    it('should extract data parts', () => {
      const message = {
        messageId: 'msg-123',
        role: Role.USER,
        parts: [
          { text: 'Analyze this:' },
          { data: { type: 'feature', priority: 1 } },
          { data: { status: 'pending' } },
        ],
      };

      const prompt = wrapper.fromA2AMessage(message);

      assert.ok(Array.isArray(prompt.data));
      assert.strictEqual(prompt.data.length, 2);
      assert.deepStrictEqual(prompt.data[0], { type: 'feature', priority: 1 });
      assert.deepStrictEqual(prompt.data[1], { status: 'pending' });
    });

    it('should extract file parts', () => {
      const message = {
        messageId: 'msg-123',
        role: Role.USER,
        parts: [
          { text: 'Review this file:' },
          { file: { name: 'report.pdf', mime_type: 'application/pdf', uri: 'gs://bucket/file' } },
        ],
      };

      const prompt = wrapper.fromA2AMessage(message);

      assert.ok(Array.isArray(prompt.files));
      assert.strictEqual(prompt.files.length, 1);
      assert.strictEqual(prompt.files[0].name, 'report.pdf');
    });

    it('should throw if parts missing', () => {
      const message = { messageId: 'msg-123', role: Role.USER };

      assert.throws(() => {
        wrapper.fromA2AMessage(message);
      }, /parts array required/);
    });

    it('should throw if feature flag disabled', () => {
      const disabledWrapper = createMessageWrapper({
        featureFlags: { a2a_message_wrapper: false },
      });

      const message = {
        messageId: 'msg-123',
        role: Role.USER,
        parts: [{ text: 'Hello' }],
      };

      assert.throws(() => {
        disabledWrapper.fromA2AMessage(message);
      }, /feature flag is disabled/);
    });

    it('should complete in <10ms', () => {
      const message = {
        messageId: 'msg-123',
        role: Role.USER,
        parts: [{ text: 'Test' }],
      };

      const start = Date.now();
      wrapper.fromA2AMessage(message);
      const duration = Date.now() - start;

      assert.ok(duration < 10, `Expected <10ms, got ${duration}ms`);
    });
  });

  describe('Part Conversion', () => {
    it('should convert text to TextPart', () => {
      const part = wrapper.convertTextToPart('Hello world');

      assert.deepStrictEqual(part, { text: 'Hello world' });
    });

    it('should throw if text is not string', () => {
      assert.throws(() => {
        wrapper.convertTextToPart(123);
      }, /Text must be a string/);
    });

    it('should convert parts to text', () => {
      const parts = [{ text: 'Part 1' }, { text: 'Part 2' }, { data: {} }];

      const text = wrapper.convertPartsToText(parts);

      assert.strictEqual(text, 'Part 1\n\nPart 2');
    });

    it('should convert file to FilePart', () => {
      const file = {
        name: 'document.pdf',
        mimeType: 'application/pdf',
        uri: 'gs://bucket/doc.pdf',
      };

      const part = wrapper.convertFileToPart(file);

      assert.strictEqual(part.file.name, 'document.pdf');
      assert.strictEqual(part.file.mime_type, 'application/pdf');
      assert.strictEqual(part.file.uri, 'gs://bucket/doc.pdf');
    });

    it('should support file bytes instead of URI', () => {
      const file = {
        name: 'image.png',
        mimeType: 'image/png',
        bytes: 'iVBORw0KGgoAAAANS...',
      };

      const part = wrapper.convertFileToPart(file);

      assert.strictEqual(part.file.bytes, 'iVBORw0KGgoAAAANS...');
      assert.ok(!part.file.uri);
    });

    it('should use default mime type if missing', () => {
      const file = { name: 'unknown.bin' };

      const part = wrapper.convertFileToPart(file);

      assert.strictEqual(part.file.mime_type, 'application/octet-stream');
    });

    it('should convert data to DataPart', () => {
      const data = { type: 'feature', status: 'pending' };

      const part = wrapper.convertDataToPart(data);

      assert.deepStrictEqual(part, { data });
    });

    it('should throw if data is not object', () => {
      assert.throws(() => {
        wrapper.convertDataToPart('string');
      }, /Data must be an object/);
    });
  });

  describe('Multi-Part Messages', () => {
    it('should create multi-part message from text strings', () => {
      const parts = ['Text part 1', 'Text part 2', 'Text part 3'];

      const message = wrapper.createMultiPartMessage(parts);

      assert.strictEqual(message.parts.length, 3);
      assert.strictEqual(message.parts[0].text, 'Text part 1');
      assert.strictEqual(message.parts[1].text, 'Text part 2');
      assert.strictEqual(message.parts[2].text, 'Text part 3');
    });

    it('should create multi-part message from mixed types', () => {
      const parts = [
        'Analyze this data:',
        { data: { metric: 'latency', value: 120 } },
        { file: true, name: 'logs.txt', mimeType: 'text/plain', uri: 'gs://logs/file' },
      ];

      const message = wrapper.createMultiPartMessage(parts);

      assert.strictEqual(message.parts.length, 3);
      assert.strictEqual(message.parts[0].text, 'Analyze this data:');
      assert.ok(message.parts[1].data);
      assert.ok(message.parts[2].file);
    });

    it('should support custom options', () => {
      const parts = ['Part 1', 'Part 2'];
      const options = {
        role: Role.AGENT,
        contextId: 'ctx-123',
        metadata: { source: 'test' },
      };

      const message = wrapper.createMultiPartMessage(parts, options);

      assert.strictEqual(message.role, Role.AGENT);
      assert.strictEqual(message.contextId, 'ctx-123');
      assert.deepStrictEqual(message.metadata, { source: 'test' });
    });
  });

  describe('Message Validation', () => {
    it('should validate valid message', () => {
      const message = {
        messageId: 'msg-123',
        role: Role.USER,
        parts: [{ text: 'Hello' }],
      };

      const result = wrapper.validateMessage(message);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should detect missing role', () => {
      const message = {
        messageId: 'msg-123',
        parts: [{ text: 'Hello' }],
      };

      const result = wrapper.validateMessage(message);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('role')));
    });

    it('should detect invalid role', () => {
      const message = {
        messageId: 'msg-123',
        role: 'INVALID_ROLE',
        parts: [{ text: 'Hello' }],
      };

      const result = wrapper.validateMessage(message);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Invalid role')));
    });

    it('should detect missing parts', () => {
      const message = {
        messageId: 'msg-123',
        role: Role.USER,
      };

      const result = wrapper.validateMessage(message);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('parts')));
    });

    it('should detect empty parts array', () => {
      const message = {
        messageId: 'msg-123',
        role: Role.USER,
        parts: [],
      };

      const result = wrapper.validateMessage(message);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('at least one element')));
    });

    it('should detect invalid parts', () => {
      const message = {
        messageId: 'msg-123',
        role: Role.USER,
        parts: [{ invalid: 'field' }],
      };

      const result = wrapper.validateMessage(message);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('must have text, file, or data')));
    });
  });

  describe('Performance Benchmarks', () => {
    it('should wrap 100 messages in <1000ms', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        wrapper.toA2AMessage(`Message ${i}`);
      }

      const duration = Date.now() - start;

      assert.ok(duration < 1000, `Expected <1000ms for 100 messages, got ${duration}ms`);
    });

    it('should unwrap 100 messages in <1000ms', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        messageId: `msg-${i}`,
        role: Role.USER,
        parts: [{ text: `Message ${i}` }],
      }));

      const start = Date.now();

      for (const message of messages) {
        wrapper.fromA2AMessage(message);
      }

      const duration = Date.now() - start;

      assert.ok(duration < 1000, `Expected <1000ms for 100 messages, got ${duration}ms`);
    });

    it('should validate 100 messages in <100ms', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        messageId: `msg-${i}`,
        role: Role.USER,
        parts: [{ text: `Message ${i}` }],
      }));

      const start = Date.now();

      for (const message of messages) {
        wrapper.validateMessage(message);
      }

      const duration = Date.now() - start;

      assert.ok(duration < 100, `Expected <100ms for 100 validations, got ${duration}ms`);
    });
  });
});
