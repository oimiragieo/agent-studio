#!/usr/bin/env node
/**
 * Test suite for sanitize-secrets.js
 * 
 * Security tests to verify API key sanitization works correctly
 * Run with: node .claude/tools/test-sanitization.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { 
  sanitize, 
  sanitizeObject, 
  sanitizeError, 
  containsApiKey,
  SENSITIVE_ENV_KEYS 
} = require('../../codex-skills/shared/sanitize-secrets.js');

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertIncludes(text, substring, message) {
  assert(text.includes(substring), message);
}

function assertNotIncludes(text, substring, message) {
  assert(!text.includes(substring), message);
}

console.log('\n=== Sanitization Security Tests ===\n');

// Test 1: Anthropic API key sanitization
console.log('Test 1: Anthropic API Keys');
{
  const msg = 'Error: Invalid key sk-ant-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
  const result = sanitize(msg);
  assertIncludes(result, '[REDACTED', 'Anthropic key should be redacted');
  assertNotIncludes(result, 'sk-ant-abc123', 'Original key should not be present');
}

// Test 2: OpenAI API key sanitization
console.log('\nTest 2: OpenAI API Keys');
{
  const msg = 'Auth failed with key: sk-1234567890abcdefghijklmnopqrstuvwxyz';
  const result = sanitize(msg);
  assertIncludes(result, '[REDACTED', 'OpenAI key should be redacted');
  assertNotIncludes(result, 'sk-1234567890', 'Original key should not be present');
}

// Test 3: Google/Gemini API key sanitization
console.log('\nTest 3: Google/Gemini API Keys');
{
  const msg = 'Config: GOOGLE_API_KEY=AIzaSyAbc123def456ghi789jkl012mno345pqr';
  const result = sanitize(msg);
  assertIncludes(result, '[REDACTED', 'Google key should be redacted');
  assertNotIncludes(result, 'AIzaSy', 'Original key should not be present');
}

// Test 4: Environment variable sanitization
console.log('\nTest 4: Environment Variables');
{
  const msg = 'Config dump: ANTHROPIC_API_KEY=sk-ant-secret123 GEMINI_API_KEY=gemini-key-456';
  const result = sanitize(msg);
  assertIncludes(result, 'ANTHROPIC_API_KEY=[REDACTED]', 'Anthropic env var should be redacted');
  assertIncludes(result, 'GEMINI_API_KEY=[REDACTED]', 'Gemini env var should be redacted');
}

// Test 5: JWT token sanitization
console.log('\nTest 5: JWT Tokens');
{
  const msg = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const result = sanitize(msg);
  assertIncludes(result, '[REDACTED_JWT]', 'JWT should be redacted');
  assertNotIncludes(result, 'eyJhbGci', 'Original JWT should not be present');
}

// Test 6: Authorization header sanitization
console.log('\nTest 6: Authorization Headers');
{
  const msg = 'Request headers: Authorization: Bearer sk-some-secret-token-12345';
  const result = sanitize(msg);
  assertIncludes(result, '[REDACTED]', 'Auth header should be redacted');
  assertNotIncludes(result, 'sk-some-secret', 'Original token should not be present');
}

// Test 7: GitHub token sanitization
console.log('\nTest 7: GitHub Tokens');
{
  const msg = 'GitHub auth: ghp_abcdefghijklmnopqrstuvwxyz1234567890';
  const result = sanitize(msg);
  assertIncludes(result, '[REDACTED_GITHUB_TOKEN]', 'GitHub token should be redacted');
  assertNotIncludes(result, 'ghp_abcdef', 'Original token should not be present');
}

// Test 8: Object sanitization
console.log('\nTest 8: Object Sanitization');
{
  const obj = {
    ANTHROPIC_API_KEY: 'sk-ant-secret123',
    GEMINI_API_KEY: 'gemini-key-456',
    PATH: '/usr/bin',
    HOME: '/home/user',
    MY_PASSWORD: 'secret123',
  };
  const result = sanitizeObject(obj);
  assert(result.ANTHROPIC_API_KEY === '[REDACTED]', 'ANTHROPIC_API_KEY should be redacted');
  assert(result.GEMINI_API_KEY === '[REDACTED]', 'GEMINI_API_KEY should be redacted');
  assert(result.MY_PASSWORD === '[REDACTED]', 'MY_PASSWORD should be redacted (pattern match)');
  assert(result.PATH === '/usr/bin', 'PATH should not be redacted');
  assert(result.HOME === '/home/user', 'HOME should not be redacted');
}

// Test 9: Error object sanitization
console.log('\nTest 9: Error Object Sanitization');
{
  const error = new Error('Auth failed: ANTHROPIC_API_KEY=sk-ant-secret123');
  error.code = 'AUTH_ERROR';
  const result = sanitizeError(error);
  assertIncludes(result.message, '[REDACTED]', 'Error message should be sanitized');
  assertNotIncludes(result.message, 'sk-ant-secret', 'Original key should not be in message');
  assert(result.code === 'AUTH_ERROR', 'Error code should be preserved');
}

// Test 10: containsApiKey detection
console.log('\nTest 10: API Key Detection');
{
  assert(containsApiKey('sk-ant-abc123def456ghi789jkl012mno345'), 'Should detect Anthropic key');
  assert(containsApiKey('sk-1234567890abcdefghijklmnop'), 'Should detect OpenAI key');
  assert(containsApiKey('AIzaSyAbc123def456ghi789jkl012'), 'Should detect Google key');
  assert(!containsApiKey('This is normal text'), 'Should not detect in normal text');
  assert(!containsApiKey('short-key'), 'Should not detect short strings');
}

// Test 11: Null/undefined handling
console.log('\nTest 11: Null/Undefined Handling');
{
  assert(sanitize(null) === '', 'null should return empty string');
  assert(sanitize(undefined) === '', 'undefined should return empty string');
  const nullError = sanitizeError(null);
  assert(nullError.message === 'Unknown error', 'null error should have default message');
}

// Test 12: Multiple patterns in one string
console.log('\nTest 12: Multiple Patterns');
{
  const msg = 'Keys: sk-ant-secret1234567890abcdef, AIzaSyGoogleKey123456789, OPENAI_API_KEY=sk-openai123';
  const result = sanitize(msg);
  assert(!result.includes('sk-ant-secret'), 'Anthropic key should be removed');
  assert(!result.includes('AIzaSy'), 'Google key should be removed');
  assert(!result.includes('sk-openai'), 'OpenAI key should be removed');
  assertIncludes(result, '[REDACTED', 'Should contain redaction markers');
}

// Test 13: Long token sanitization
console.log('\nTest 13: Long Token Sanitization');
{
  const longToken = 'a'.repeat(45); // 45 character token
  const msg = `Token: ${longToken}`;
  const result = sanitize(msg);
  assertIncludes(result, '[REDACTED_LONG_TOKEN]', 'Long tokens should be redacted');
}

// Test 14: AWS credentials sanitization
console.log('\nTest 14: AWS Credentials');
{
  const msg = 'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY AWS_SESSION_TOKEN=FwoGZXIvYXdzEA';
  const result = sanitize(msg);
  assertIncludes(result, 'AWS_SECRET_ACCESS_KEY=[REDACTED]', 'AWS secret should be redacted');
  assertIncludes(result, 'AWS_SESSION_TOKEN=[REDACTED]', 'AWS session token should be redacted');
}

// Test 15: x-api-key header sanitization
console.log('\nTest 15: X-API-Key Header');
{
  const msg = 'Headers: x-api-key: secret-api-key-12345';
  const result = sanitize(msg);
  assertIncludes(result, 'x-api-key: [REDACTED]', 'x-api-key header should be redacted');
}

// Summary
console.log('\n=== Test Summary ===');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total:  ${testsPassed + testsFailed}`);

if (testsFailed > 0) {
  console.error('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
