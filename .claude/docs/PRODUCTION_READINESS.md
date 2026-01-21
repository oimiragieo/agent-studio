# Production Readiness (Push-Button)

This repo supports two “modes”:

- **Claude Code UI**: best for interactive development and manual auditing.
- **Headless/CI**: best for stability and deterministic, process-isolated runs.

## 1) One Command: Full Integration (Headless)

Runs baseline suites + headless agent smoke + verification, writes all artifacts under `.claude/context/`.

```bash
pnpm integration:headless:json
```

Notes:

- Uses a safer per-agent `claude -p` timeout by default (`--timeout-ms 90000`) to reduce flaky smoke failures.
- Smoke receipts are written even when an agent’s output format is non-standard (derived receipt), as long as the headless run succeeds.

Outputs:

- Run report: `.claude/context/reports/testing/agent-integration-v1-<...>-run-report.md`
- Results JSON: `.claude/context/artifacts/testing/agent-integration-v1-<...>-run-results.json`
- Verification JSON/MD: `.claude/context/artifacts/testing/agent-integration-v1-<...>-verification.json` and `.claude/context/reports/testing/agent-integration-v1-<...>-verification-report.md`
- Payload snapshots (sanitized, when enabled by the script): `.claude/context/payloads/trace-<trace_id>/span-<span_id>.json`
- Headless trace stream:
  - `.claude/context/runtime/headless/runs/<run_id>/events.ndjson`
  - `.claude/context/runtime/headless/runs/<run_id>/tool-events.ndjson`
    - Includes a deterministic denial proof entry (`denied: true`, `denied_by: "read-path-guard"`) when `pnpm integration:headless:json` is used.

## 2) Cleanup / Retention

Preview:

```bash
pnpm cleanup:headless:check
```

Execute:

```bash
pnpm cleanup:headless
```

Custom retention:

```bash
node .claude/tools/cleanup-headless-runs.mjs --dry-run --retention-days 3 --include-otlp
node .claude/tools/cleanup-headless-runs.mjs --execute --yes --retention-days 3 --include-otlp
```

## 3) OTLP Export (Enterprise Observability)

Export any `events.ndjson` to OTLP/JSON:

```bash
node .claude/tools/otlp-export.mjs --events "<events.ndjson>" --out ".claude/context/artifacts/observability/<id>-otlp.json"
```

Optional: POST to an OTLP/HTTP JSON endpoint:

```bash
node .claude/tools/otlp-export.mjs --events "<events.ndjson>" --endpoint "https://<collector>/v1/traces"
```

Validate the OTLP output:

```bash
node .claude/tools/validate-schemas.mjs --file ".claude/context/artifacts/observability/<id>-otlp.json"
```

## 4) RAG Tuning (Local Only)

Repo defaults enable RAG. If background indexing causes local memory pressure, add a local override:

- Copy `.claude/templates/settings.local.example.json` to `.claude/settings.local.json`
- Adjust as needed (batch size, interval, background indexing).
