### Guardrails Policy (Config Pack)

- **Command Safety**: Block destructive bash patterns (`rm -rf`, `mkfs`, `dd`, `sudo *`, `curl|bash`, `wget|sh`). Prefer dry runs and explicit paths.
- **Secrets/PII**: Never commit or echo secrets. Redact PII in artifacts. Avoid touching `.env*` or credential files.
- **Protected Files**: Treat config/infra/auth files as sensitive; require human confirmation before edits.
- **Output Discipline**: Cite sources for risky changes; avoid hallucinated APIs; prefer minimal, testable diffs.
- **Data Handling**: No production data in prompts or artifacts. Strip identifiers in logs/artifacts.

Use these rules in hooks, prompts, and reviews. The native hooks in `.claude/hooks/security-pre-tool.sh` enforce basic command blocking; extend as needed for your org.
