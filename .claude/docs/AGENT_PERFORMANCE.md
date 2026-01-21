# Agent Performance

This document collects practical, repo-specific guidance for measuring agent performance.

## What to Measure

- Correctness (passes validators/tests, produces required artifacts)
- Reliability (recovers from failures, avoids deadlocks)
- Efficiency (keeps output concise, avoids unnecessary tool calls)
- Safety (respects permissions + routing rules)
- Observability (progress visibility, resumability)

## Related Docs

- [Evaluation Guide](./EVALUATION_GUIDE.md)
- [QA Testing Guide](./QA_TESTING_GUIDE.md)
- [Test Framework Architecture](./TEST_FRAMEWORK_ARCHITECTURE.md)
- [Orchestration Monitoring](./ORCHESTRATION_MONITORING.md)
