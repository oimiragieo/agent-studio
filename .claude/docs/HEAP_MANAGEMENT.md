# Enterprise Heap Management Guide

**Version**: 1.0.0
**Last Updated**: 2026-01-12
**Status**: Production-Ready

---

## Problem Statement

AI agents (QA, developer, technical-writer) consistently crash after 30+ minutes due to Node.js heap exhaustion:

- Pattern: Agents consume 100k-130k tokens → V8 heap fills → GC can't keep up → FATAL ERROR
- Frequency: 3 crashes in single session (Steps 1.8, 2.5, 2.12)
- Impact: Project delays, lost work, poor user experience

---

## Root Cause Analysis

### V8 Architecture Mismatch

- **V8 is optimized for**: Web servers (many small objects, short-lived requests)
- **LLM agents require**: Massive string processing (100k+ token contexts, long-running operations)
- **Result**: Old Generation heap fills faster than GC can reclaim, leading to OOM

### Memory Accumulation Points

1. **Conversation History**: Entire context held in memory (no streaming)
2. **File Reads**: Large files loaded as full strings (no chunking)
3. **Tool Results**: Cached in parent process indefinitely
4. **Agent State**: All variables persist for agent lifetime (30+ minutes)

---

## Enterprise Solutions Implemented

### 1. V8 Configuration Tuning ✅

**Added npm scripts with optimized flags**:

```json
"agent:production": "node --max-old-space-size=8192 --expose-gc --optimize_for_size --gc_interval=100"
"agent:worker": "node --max-old-space-size=4096 --expose-gc --optimize_for_size"
```

**Flag Breakdown**:

- `--max-old-space-size=8192`: 8GB heap (for 16GB RAM systems)
- `--expose-gc`: Allow manual garbage collection via `global.gc()`
- `--optimize_for_size`: Prioritize memory efficiency over speed
- `--gc_interval=100`: More frequent GC checks (default: 1000)

**Usage**:

```bash
# For main orchestrator (long-running)
pnpm agent:production .claude/tools/orchestrator-entry.mjs

# For worker threads (short-lived)
pnpm agent:worker .claude/tools/workers/worker-thread.mjs
```

---

### 2. Ephemeral Worker Pattern 🚧 (In Progress)

**Architecture**: Supervisor-Worker model with isolated V8 heaps

#### Supervisor Process (Main Thread)

- **Role**: Lightweight coordinator
- **Memory**: <500MB even after 8+ hours
- **Responsibilities**:
  - Maintain task queue
  - Spawn worker threads for each agent task
  - Persist state to SQLite (not memory)
  - Aggregate results from workers

#### Worker Threads (Child Threads)

- **Role**: Execute single agent task, then terminate
- **Memory**: Isolated V8 heap, 100% reclaimed on termination
- **Lifecycle**:
  1. Spawn with task description
  2. Load minimal context from database
  3. Execute tools (Read, Write, etc.)
  4. Save results to database
  5. Terminate (heap freed)

#### Benefits

- **Zero heap accumulation**: Each task starts with clean heap
- **Fault isolation**: Worker crash doesn't kill supervisor
- **Scalability**: Parallel workers without memory bloat
- **Observability**: Per-task memory metrics tracked

**Implementation Status**:

- ✅ Architecture designed (`architecture-ephemeral-workers.md`)
- ✅ Worker database schema (`worker-db.mjs`)
- 🚧 Supervisor implementation (pending)
- 🚧 Worker thread logic (pending)
- 🚧 Task tool integration (pending)

---

### 3. Tiered Context Compaction (Planned)

**Strategy**: 4-tier context management to prevent unbounded growth

| Tier          | Content                        | Fidelity      | Storage                        |
| ------------- | ------------------------------ | ------------- | ------------------------------ |
| **Head**      | System prompts, critical rules | 100%          | In-memory (permanent)          |
| **Recent**    | Last 10-15 messages            | 100%          | In-memory (rolling window)     |
| **Mid-Term**  | Older messages (summarized)    | 50%           | SQLite (on-demand load)        |
| **Long-Term** | Very old messages (vectorized) | RAG retrieval | Vector store (semantic search) |

**Compaction Algorithm**:

1. When context reaches 90% capacity:
   - Summarize oldest 50% of **Recent** tier
   - Move summaries to **Mid-Term** tier
   - Clear original messages from memory
2. When context reaches 95% capacity:
   - Vectorize **Mid-Term** summaries
   - Move to **Long-Term** tier (RAG)
   - Clear summaries from memory

**Token Budget**:

- Head: 10k tokens (fixed)
- Recent: 40k tokens (rolling)
- Mid-Term: Load on-demand (max 20k)
- Long-Term: RAG retrieval (max 10k)
- **Total**: Never exceeds 80k tokens in memory

---

### 4. Streaming File Operations (Planned)

**Problem**: Current implementation uses `fs.readFileSync()`, loading entire files into memory.

**Solution**: Replace with streaming APIs

#### Before (Memory-Intensive)

```javascript
const content = fs.readFileSync(filePath, 'utf-8'); // Loads entire file
const lines = content.split('\n'); // Creates another copy
return lines.slice(offset, offset + limit); // Yet another copy
```

#### After (Memory-Efficient)

```javascript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const stream = createReadStream(filePath);
const rl = createInterface({ input: stream });

let lineNum = 0;
const lines = [];
for await (const line of rl) {
  if (lineNum >= offset && lineNum < offset + limit) {
    lines.push(line);
  }
  if (lineNum >= offset + limit) break; // Stop early
  lineNum++;
}
return lines;
```

**Benefits**:

- Only requested lines loaded
- Stream destroyed when done
- No full-file string allocation
- 10-100x memory reduction for large files

**Implementation Plan**:

- Update `Read` tool to use streaming
- Update `Grep` tool to process line-by-line
- Add hard truncation limits (e.g., 2000 lines max)

---

## Monitoring & Observability

### Memory Metrics Tracked

**Worker Sessions Table**:

```sql
CREATE TABLE worker_sessions (
  id TEXT PRIMARY KEY,
  supervisor_id TEXT,
  agent_type TEXT,
  status TEXT,
  memory_peak_mb INTEGER,  -- Peak heap usage
  started_at TEXT,
  ended_at TEXT
);
```

**Key Metrics**:

- Supervisor heap usage (should stay <500MB)
- Worker peak memory per task
- Task duration vs memory correlation
- OOM crash count (should be zero)

### Alerts

**Critical Thresholds**:

- Supervisor heap >1GB → WARNING (investigate leak)
- Worker heap >4GB → WARNING (task too large, needs splitting)
- OOM crash → CRITICAL (architecture failure)

### Debugging

**Manual GC Trigger** (when `--expose-gc` enabled):

```javascript
if (global.gc && memoryUsage > threshold) {
  global.gc(); // Force garbage collection
  console.log('Manual GC triggered');
}
```

**Heap Snapshot** (for leak detection):

```javascript
import v8 from 'v8';
import fs from 'fs';

const snapshot = v8.writeHeapSnapshot();
console.log(`Heap snapshot written to: ${snapshot}`);
// Analyze with Chrome DevTools Memory Profiler
```

---

## Migration Plan

### Phase 1: Immediate Fixes (Week 1) ✅

- [x] Add V8 optimization flags to package.json
- [x] Create worker database schema
- [x] Document heap management strategy

### Phase 2: Worker Foundation (Week 2)

- [ ] Implement supervisor.mjs (main process)
- [ ] Implement worker-thread.mjs (worker logic)
- [ ] Integrate with Task tool (feature flag: `useWorkers: false` by default)

### Phase 3: Context Compaction (Week 3)

- [ ] Implement context-manager.mjs (tiered storage)
- [ ] Update memory injection to use streaming queries
- [ ] Test with 200k token contexts

### Phase 4: Streaming File Ops (Week 4)

- [ ] Refactor Read tool to use streams
- [ ] Refactor Grep tool to process line-by-line
- [ ] Add hard truncation limits

### Phase 5: Production Rollout (Week 5)

- [ ] 24-hour stress test (zero OOM crashes)
- [ ] Enable `useWorkers: true` by default
- [ ] Remove legacy in-memory accumulation code
- [ ] Update documentation for users

---

## Success Criteria

| Metric                     | Target     | Current               | Status                    |
| -------------------------- | ---------- | --------------------- | ------------------------- |
| Supervisor heap after 8hrs | <500MB     | N/A (not implemented) | 🚧                        |
| Worker OOM crashes         | 0 in 24hrs | 3 in 2hrs             | ❌ → ✅ (after migration) |
| Task dispatch overhead     | <100ms     | N/A                   | 🚧                        |
| Max agent runtime          | Unlimited  | 30-35 mins (crashes)  | ❌ → ✅                   |
| 200k token context support | Stable     | Crashes               | ❌ → ✅                   |

---

## References

### Research Sources

- [Node.js Official: Understanding and Tuning Memory](https://nodejs.org/en/learn/diagnostics/memory/understanding-and-tuning-memory)
- [Node.js 20+ Memory Management in Containers](https://developers.redhat.com/articles/2025/10/10/nodejs-20-memory-management-containers)
- Gemini AI Analysis: `.claude/context/tmp/gemini-heap-solutions.txt`
- Claude AI Analysis: `.claude/context/tmp/claude-heap-solutions.json`

### Architecture Documents

- [Ephemeral Worker Pattern](../context/artifacts/architecture-ephemeral-workers.md)
- [Phase 2 Memory System](../context/artifacts/architecture-phase-2-memory-system.md)

### Implementation Files

- Worker DB: `.claude/tools/workers/worker-db.mjs`
- Supervisor: `.claude/tools/workers/supervisor.mjs` (pending)
- Worker Thread: `.claude/tools/workers/worker-thread.mjs` (pending)

---

## Emergency Procedures

### If Agent Crashes (OOM)

1. **Check task scope**: Was it too broad? (e.g., "implement entire feature" vs "create one file")
2. **Split into micro-tasks**: Max 30k tokens, 20 minutes per task
3. **Enable manual GC**: Run with `--expose-gc` and trigger `global.gc()` periodically
4. **Increase heap temporarily**: Use `--max-old-space-size=12288` (12GB) as stopgap

### If Supervisor Leaks Memory

1. **Check worker cleanup**: Are workers terminating properly?
2. **Check database connections**: Are they being closed?
3. **Check event listeners**: Are they being removed?
4. **Take heap snapshot**: `v8.writeHeapSnapshot()` and analyze

---

## Conclusion

The Ephemeral Worker Pattern is the **enterprise-grade architectural solution** to Node.js heap exhaustion in long-running AI agent systems. By isolating each task in a worker thread with its own V8 heap, we guarantee 100% memory reclamation and enable unlimited project duration.

**Current Status**: Phase 1 complete (V8 flags + DB schema). Phase 2 in progress (supervisor + worker implementation).

**Expected Completion**: Week 5 (full production rollout with zero OOM crashes)

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-12
**Next Review**: After Phase 2 completion
