# Task Queue Guide

**Version:** 1.0.0
**Last Updated:** 2025-01-15

## Table of Contents

1. [Overview](#overview)
2. [Why Task Queue](#why-task-queue)
3. [Task Queue API](#task-queue-api)
4. [Priority Levels](#priority-levels)
5. [Dependency Management](#dependency-management)
6. [Retry Policies](#retry-policies)
7. [Concurrency Control](#concurrency-control)
8. [Usage Examples](#usage-examples)
9. [Integration with Workflow Orchestration](#integration-with-workflow-orchestration)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Task Queue system provides centralized task coordination for workflow orchestration. It manages task execution order, enforces concurrency limits, handles dependencies, and provides automatic retry capabilities.

### Key Features

- **Concurrency Control**: Max 2 parallel tasks (API limit enforcement)
- **Priority Queue**: High/medium/low priority levels
- **Task Dependencies**: Tasks wait for dependent tasks to complete
- **Automatic Retry**: Configurable retry policies for failed tasks
- **Timeout Tracking**: Track task execution duration
- **Auto-Start**: Automatically start tasks when capacity available
- **State Persistence**: Save queue state to disk for recovery

### Architecture

```
Task Enqueued
    ↓
Priority Sorting (high → medium → low)
    ↓
Dependency Check (can task start?)
    ↓
Concurrency Check (< 2 running?)
    ↓
Task Execution
    ↓
Complete/Fail → Auto-Start Next Task
```

---

## Why Task Queue?

### Problem: API Concurrency Limits

Claude API limits concurrent tool calls to 2 per request. Without a queue system:

- **❌ 3+ parallel tasks**: API returns 400 error
- **❌ Unmanaged retries**: Wasted API calls
- **❌ No dependency tracking**: Tasks run out of order
- **❌ Manual coordination**: Complex orchestrator logic

### Solution: Task Queue System

With task queue:

- **✅ Enforced concurrency**: Never exceed 2 parallel tasks
- **✅ Automatic retry**: Failed tasks retry with delay
- **✅ Dependency resolution**: Tasks wait for dependencies
- **✅ Priority ordering**: High-priority tasks run first
- **✅ State persistence**: Queue survives crashes
- **✅ Statistics tracking**: Monitor queue performance

---

## Task Queue API

### Initialization

```javascript
import TaskQueue from './.claude/tools/task-queue.mjs';

const queue = new TaskQueue('run-001');
await queue.init();
```

### Core Methods

#### `enqueue(taskSpec)`

Add task to queue.

```javascript
const task = queue.enqueue({
  agent: 'developer',
  task: 'Implement authentication',
  priority: 'high',
  dependencies: [],
  timeout_ms: 120000,
  retry_policy: {
    max_retries: 2,
    retry_delay_ms: 5000
  }
});

console.log(`Task ID: ${task.id}`);
```

**Returns:** Task object with generated ID and metadata

#### `complete(taskId, result)`

Mark task as completed.

```javascript
await queue.complete('550e8400-e29b-41d4-a716-446655440001', {
  success: true,
  artifacts: ['auth.ts', 'auth.test.ts'],
  metadata: { lines_of_code: 250 }
});
```

#### `fail(taskId, error)`

Mark task as failed (triggers retry if configured).

```javascript
await queue.fail(
  '550e8400-e29b-41d4-a716-446655440001',
  new Error('Compilation failed')
);
```

#### `cancel(taskId)`

Cancel queued or running task.

```javascript
await queue.cancel('550e8400-e29b-41d4-a716-446655440001');
```

#### `getStatus(taskId)`

Get task status.

```javascript
const status = queue.getStatus('550e8400-e29b-41d4-a716-446655440001');
console.log(`Status: ${status.status}`);
console.log(`Duration: ${status.duration_ms}ms`);
```

#### `waitForCompletion(taskId, timeoutMs)`

Wait for task to complete.

```javascript
const result = await queue.waitForCompletion(
  '550e8400-e29b-41d4-a716-446655440001',
  300000 // 5 minutes
);

if (result.success) {
  console.log('Task completed:', result.result);
} else {
  console.error('Task failed:', result.error);
}
```

#### `getQueueStats()`

Get queue statistics.

```javascript
const stats = queue.getQueueStats();
console.log(`Queued: ${stats.queued}`);
console.log(`Running: ${stats.running}`);
console.log(`Completed: ${stats.completed}`);
console.log(`Success Rate: ${stats.success_rate}`);
```

---

## Priority Levels

### Priority Values

| Priority | Use Case                           | Example Tasks                    |
| -------- | ---------------------------------- | -------------------------------- |
| `high`   | Critical path, blocking operations | Security fixes, critical bugs    |
| `medium` | Standard workflow tasks            | Feature implementation, tests    |
| `low`    | Background tasks, non-urgent       | Documentation, cleanup, metrics  |

### Priority Ordering

Tasks are sorted by:
1. **Priority** (high → medium → low)
2. **Creation Time** (older first)

**Example:**

```javascript
// Queue state:
// 1. Task A (high, 10:00)
// 2. Task B (high, 10:05)
// 3. Task C (medium, 10:02)
// 4. Task D (low, 10:01)

// Execution order: A → B → C → D
```

### Setting Priority

```javascript
queue.enqueue({
  agent: 'security-architect',
  task: 'Fix critical vulnerability',
  priority: 'high' // Runs before medium/low
});

queue.enqueue({
  agent: 'developer',
  task: 'Implement feature',
  priority: 'medium' // Default
});

queue.enqueue({
  agent: 'technical-writer',
  task: 'Update documentation',
  priority: 'low' // Runs last
});
```

---

## Dependency Management

### Declaring Dependencies

Tasks can depend on other tasks completing first.

```javascript
// Task 1: Architect designs system
const task1 = queue.enqueue({
  id: 'arch-001',
  agent: 'architect',
  task: 'Design authentication system',
  priority: 'high'
});

// Task 2: Developer implements (depends on architect)
const task2 = queue.enqueue({
  agent: 'developer',
  task: 'Implement authentication',
  dependencies: ['arch-001'], // Wait for task1
  priority: 'high'
});

// Task 3: QA tests (depends on developer)
const task3 = queue.enqueue({
  agent: 'qa',
  task: 'Test authentication',
  dependencies: [task2.id], // Wait for task2
  priority: 'medium'
});
```

### Dependency Resolution

The queue automatically:
1. **Blocks dependent tasks**: Tasks wait in queue until dependencies complete
2. **Checks on dequeue**: Only dequeues tasks with met dependencies
3. **Handles failures**: If dependency fails, dependent task may need cancellation

### Circular Dependencies

**Warning:** Avoid circular dependencies - they cause deadlock.

**❌ Bad:**
```javascript
queue.enqueue({ id: 'A', dependencies: ['B'] });
queue.enqueue({ id: 'B', dependencies: ['A'] }); // Deadlock!
```

**✅ Good:**
```javascript
queue.enqueue({ id: 'A', dependencies: [] });
queue.enqueue({ id: 'B', dependencies: ['A'] }); // Linear dependency
```

---

## Retry Policies

### Configuring Retries

```javascript
queue.enqueue({
  agent: 'developer',
  task: 'npm install dependencies',
  retry_policy: {
    max_retries: 3, // Retry up to 3 times
    retry_delay_ms: 5000 // Wait 5 seconds between retries
  }
});
```

### Retry Behavior

When a task fails:
1. **Check retry count**: If `retry_count < max_retries`
2. **Delay**: Wait `retry_delay_ms` milliseconds
3. **Re-enqueue**: Add task back to queue
4. **Increment counter**: `retry_count++`
5. **Repeat**: Until max retries or success

### When to Use Retries

**✅ Use Retries For:**
- Network timeouts (API calls, downloads)
- Transient failures (npm registry issues)
- Resource unavailable (temporary service outage)

**❌ Don't Use Retries For:**
- Compilation errors (code needs fixing)
- Test failures (logic errors)
- Authentication failures (credentials invalid)

### Example: Network Call with Retry

```javascript
queue.enqueue({
  agent: 'developer',
  task: 'Fetch API documentation',
  retry_policy: {
    max_retries: 4,
    retry_delay_ms: 2000
  },
  timeout_ms: 30000
});

// Execution timeline:
// Attempt 1: Fail (timeout) → Wait 2s
// Attempt 2: Fail (timeout) → Wait 2s
// Attempt 3: Success → Complete
```

---

## Concurrency Control

### Max Concurrent Tasks: 2

The queue enforces a **hard limit of 2 concurrent tasks** to comply with API constraints.

```javascript
const queue = new TaskQueue('run-001');
queue.maxConcurrent; // 2 (hardcoded)
```

### Auto-Start Mechanism

When capacity is available (<2 running), the queue automatically:
1. **Dequeue next task**: Get highest priority task with met dependencies
2. **Start execution**: Move task to `running` array
3. **Update state**: Persist queue state
4. **Repeat**: Continue until queue empty or capacity full

### Example: Concurrency Enforcement

```javascript
// Enqueue 5 tasks
queue.enqueue({ id: 'T1', agent: 'developer', task: 'Task 1' });
queue.enqueue({ id: 'T2', agent: 'qa', task: 'Task 2' });
queue.enqueue({ id: 'T3', agent: 'architect', task: 'Task 3' });
queue.enqueue({ id: 'T4', agent: 'developer', task: 'Task 4' });
queue.enqueue({ id: 'T5', agent: 'qa', task: 'Task 5' });

// Queue state after auto-start:
// running: [T1, T2]  ← 2 tasks running (max)
// queued: [T3, T4, T5]  ← 3 tasks waiting

// When T1 completes:
await queue.complete('T1');
// running: [T2, T3]  ← T3 auto-started
// queued: [T4, T5]

// When T2 completes:
await queue.complete('T2');
// running: [T3, T4]  ← T4 auto-started
// queued: [T5]
```

### Preventing Concurrency Violations

The queue prevents:
- **❌ 3+ parallel spawns**: API would return 400 error
- **❌ Unbounded parallelism**: Resource exhaustion
- **❌ Queue starvation**: High-priority tasks blocked

---

## Usage Examples

### Example 1: Sequential Workflow

```javascript
const queue = new TaskQueue('run-001');
await queue.init();

// Step 1: Plan
const planTask = queue.enqueue({
  id: 'plan-001',
  agent: 'planner',
  task: 'Create implementation plan',
  priority: 'high'
});

// Step 2: Implement (depends on plan)
const devTask = queue.enqueue({
  agent: 'developer',
  task: 'Implement planned features',
  dependencies: ['plan-001'],
  priority: 'high'
});

// Step 3: Test (depends on implementation)
const testTask = queue.enqueue({
  agent: 'qa',
  task: 'Test implemented features',
  dependencies: [devTask.id],
  priority: 'medium'
});

// Wait for all to complete
await queue.waitForCompletion(testTask.id);
```

### Example 2: Parallel Tasks with Merge

```javascript
// Two parallel tasks
const task1 = queue.enqueue({
  id: 'feature-a',
  agent: 'developer',
  task: 'Implement feature A',
  priority: 'high'
});

const task2 = queue.enqueue({
  id: 'feature-b',
  agent: 'developer',
  task: 'Implement feature B',
  priority: 'high'
});

// Merge task (depends on both)
const mergeTask = queue.enqueue({
  agent: 'code-reviewer',
  task: 'Review and merge features A and B',
  dependencies: ['feature-a', 'feature-b'],
  priority: 'medium'
});
```

### Example 3: Retry on Failure

```javascript
const task = queue.enqueue({
  agent: 'developer',
  task: 'Install npm dependencies',
  retry_policy: {
    max_retries: 3,
    retry_delay_ms: 5000
  }
});

// Simulate failure
await queue.fail(task.id, new Error('npm ERR! ETIMEDOUT'));
// Task auto-retries after 5 seconds

// Check retry count
const status = queue.getStatus(task.id);
console.log(`Retry count: ${status.retry_count}`); // 1
```

### Example 4: Priority Ordering

```javascript
// Enqueue in mixed order
queue.enqueue({ agent: 'technical-writer', task: 'Docs', priority: 'low' });
queue.enqueue({ agent: 'security-architect', task: 'Security', priority: 'high' });
queue.enqueue({ agent: 'developer', task: 'Feature', priority: 'medium' });

// Execution order:
// 1. Security (high)
// 2. Feature (medium)
// 3. Docs (low)
```

---

## Integration with Workflow Orchestration

### Workflow Executor Example

```javascript
import TaskQueue from './.claude/tools/task-queue.mjs';

class WorkflowExecutor {
  constructor(workflowId) {
    this.queue = new TaskQueue(workflowId);
  }

  async executeWorkflow(workflow) {
    await this.queue.init();

    const taskIds = [];

    for (const step of workflow.steps) {
      const task = this.queue.enqueue({
        agent: step.agent,
        task: step.task,
        priority: step.priority || 'medium',
        dependencies: step.dependencies || [],
        timeout_ms: step.timeout_ms || 120000,
        retry_policy: step.retry_policy
      });

      taskIds.push(task.id);
    }

    // Wait for all tasks to complete
    for (const taskId of taskIds) {
      await this.queue.waitForCompletion(taskId);
    }

    // Get final statistics
    const stats = this.queue.getQueueStats();
    console.log('Workflow complete:', stats);
  }
}

// Usage
const executor = new WorkflowExecutor('run-001');
await executor.executeWorkflow({
  steps: [
    { agent: 'planner', task: 'Create plan', priority: 'high' },
    { agent: 'developer', task: 'Implement', dependencies: ['plan-001'] },
    { agent: 'qa', task: 'Test' }
  ]
});
```

### Task Result Handling

```javascript
// Complete with result
await queue.complete(taskId, {
  success: true,
  artifacts: ['file1.ts', 'file2.ts'],
  metadata: {
    lines_of_code: 500,
    tests_created: 10
  }
});

// Retrieve result
const status = queue.getStatus(taskId);
console.log('Artifacts:', status.result.artifacts);
console.log('Metadata:', status.result.metadata);
```

---

## Troubleshooting

### Queue Not Processing

**Symptoms:** Tasks stuck in queue, not running

**Checks:**
1. **Running tasks**: `queue.running.length === 2` (at capacity)
2. **Dependencies**: Tasks waiting for dependencies to complete
3. **Initialization**: `queue.initialized === true`

**Solution:**
```javascript
// Check queue stats
const stats = queue.getQueueStats();
console.log('Running:', stats.running); // If 2, at capacity
console.log('Queued:', stats.queued);

// Check specific task
const status = queue.getStatus(taskId);
console.log('Dependencies:', status.dependencies);

// Manually complete stuck task
await queue.complete(stuckTaskId);
```

### Task Retrying Forever

**Symptoms:** Task failing and retrying endlessly

**Cause:** `max_retries` too high or not set

**Solution:**
```javascript
// Set reasonable retry limit
queue.enqueue({
  task: 'Risky operation',
  retry_policy: {
    max_retries: 3, // Stop after 3 attempts
    retry_delay_ms: 5000
  }
});
```

### Circular Dependency Deadlock

**Symptoms:** Tasks never start, queue frozen

**Cause:** Task A depends on B, B depends on A

**Detection:**
```javascript
// Check dependencies
const taskA = queue.getStatus('task-a');
const taskB = queue.getStatus('task-b');

console.log('A depends on:', taskA.dependencies); // ['task-b']
console.log('B depends on:', taskB.dependencies); // ['task-a'] ← Circular!
```

**Solution:** Remove circular dependency, use linear chain

### Queue State Corruption

**Symptoms:** Queue state inconsistent after crash

**Recovery:**
```javascript
// Reset queue
await queue.reset();

// Or manually fix state file
const statePath = '.claude/context/runtime/runs/<run-id>/task-queue.json';
// Edit JSON file to fix corruption
```

### Tasks Not Auto-Starting

**Symptoms:** Queue has capacity but tasks not starting

**Checks:**
1. Dependencies met?
2. Queue initialized?
3. Auto-start called?

**Solution:**
```javascript
// Manually trigger auto-start
await queue.autoStart();
```

---

## CLI Usage

### Enqueue Task

```bash
node .claude/tools/task-queue.mjs enqueue \
  --run-id run-001 \
  --agent developer \
  --task "Implement feature X" \
  --priority high
```

### Complete Task

```bash
node .claude/tools/task-queue.mjs complete \
  --run-id run-001 \
  --task-id 550e8400-e29b-41d4-a716-446655440001
```

### Get Statistics

```bash
node .claude/tools/task-queue.mjs stats --run-id run-001
```

### List All Tasks

```bash
node .claude/tools/task-queue.mjs list --run-id run-001
```

### Cancel Task

```bash
node .claude/tools/task-queue.mjs cancel \
  --run-id run-001 \
  --task-id 550e8400-e29b-41d4-a716-446655440001
```

---

## Best Practices

### 1. Set Appropriate Priorities

```javascript
// Critical path
queue.enqueue({ task: 'Fix security bug', priority: 'high' });

// Standard work
queue.enqueue({ task: 'Implement feature', priority: 'medium' });

// Background tasks
queue.enqueue({ task: 'Update docs', priority: 'low' });
```

### 2. Use Dependencies for Ordering

```javascript
// Ensure correct execution order
const plan = queue.enqueue({ id: 'plan', task: 'Plan' });
const impl = queue.enqueue({ task: 'Implement', dependencies: ['plan'] });
const test = queue.enqueue({ task: 'Test', dependencies: [impl.id] });
```

### 3. Configure Retries Wisely

```javascript
// Transient failures: Retry
queue.enqueue({
  task: 'API call',
  retry_policy: { max_retries: 3, retry_delay_ms: 2000 }
});

// Code errors: No retry
queue.enqueue({
  task: 'Compile code',
  retry_policy: { max_retries: 0 } // Don't retry compilation errors
});
```

### 4. Monitor Queue Statistics

```javascript
// Periodically check queue health
setInterval(() => {
  const stats = queue.getQueueStats();
  console.log(`Queue: ${stats.queued} | Running: ${stats.running}`);
  if (stats.failed > 0) {
    console.warn(`${stats.failed} tasks failed`);
  }
}, 60000); // Every minute
```

### 5. Handle Task Results

```javascript
const result = await queue.waitForCompletion(taskId);

if (result.success) {
  // Process artifacts
  const artifacts = result.result.artifacts;
  console.log('Created files:', artifacts);
} else {
  // Handle failure
  console.error('Task failed:', result.error.message);
  // Escalate or retry
}
```

---

## Summary

The Task Queue provides:

- **Concurrency Control**: Max 2 parallel tasks (API limit)
- **Priority Queue**: high > medium > low ordering
- **Dependencies**: Task execution ordering
- **Retry Policies**: Automatic failure recovery
- **State Persistence**: Crash recovery
- **Auto-Start**: Automatic task execution
- **Statistics**: Queue health monitoring

Use the task queue to build robust, scalable workflow orchestration.

---

**See Also:**
- [Task Queue Schema](./../schemas/task-queue.schema.json)
- [Recovery DSL Guide](./RECOVERY_DSL_GUIDE.md)
- [Workflow Guide](./../workflows/WORKFLOW-GUIDE.md)
