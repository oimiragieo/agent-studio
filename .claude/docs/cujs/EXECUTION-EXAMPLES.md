# CUJ Execution Examples

Practical examples of executing Critical User Journeys (CUJs) across workflow-based, skill-only, and quick-flow patterns.

## Table of Contents

- [Workflow-Based CUJ Execution (CUJ-005)](#workflow-based-cuj-execution-cuj-005)
- [Skill-Only CUJ Execution (CUJ-002)](#skill-only-cuj-execution-cuj-002)
- [Quick-Flow CUJ Execution (CUJ-011)](#quick-flow-cuj-execution-cuj-011)
- [CUJ Simulation and Validation](#cuj-simulation-and-validation)
- [Error Handling and Recovery](#error-handling-and-recovery)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Quick Reference](#quick-reference)

---

## Workflow-Based CUJ Execution (CUJ-005)

**CUJ**: Greenfield Full-Stack Application Development

### User Prompt Example

```
I want to build a task management SaaS application with:
- Next.js 14 frontend with TypeScript
- FastAPI backend
- PostgreSQL database
- User authentication
- Real-time updates
- Deployment to Google Cloud Run

Can you help me plan and build this?
```

### Orchestrator Detection Output

```
🎯 Analyzing request...

Detected intent: Greenfield application development
Technology stack: Next.js, FastAPI, PostgreSQL, Google Cloud
Recommended workflow: fullstack (11 steps)
Estimated duration: 45-60 minutes

Creating workflow run: run-20260103-145023

📋 Execution Plan:
Step 0: Analyst - Project discovery and requirements
Step 1: PM - Product requirements document
Step 2: Architect - System architecture design
Step 3: Database Architect - Database schema design
Step 4: UX Expert - UI/UX specifications
Step 5: DevOps - Infrastructure setup
Step 6: Developer - Core implementation
Step 7: QA - Test strategy and execution
Step 8: Security Architect - Security review
Step 9: Technical Writer - Documentation
Step 10: Code Reviewer - Final review

Proceeding with workflow execution...
```

### Create Workflow Run

```bash
node .claude/tools/run-manager.mjs create \
  --run-id run-20260103-145023 \
  --workflow .claude/workflows/greenfield-fullstack.yaml
```

**Output**:
```
✅ Run created: run-20260103-145023
📁 State directory: .claude/context/runs/run-20260103-145023/
📝 Artifacts: .claude/context/runs/run-20260103-145023/artifacts/
🔒 Gates: .claude/context/runs/run-20260103-145023/gates/
📋 Registry: .claude/context/runs/run-20260103-145023/artifact-registry.json
```

### Execute Workflow Steps Sequentially

#### Step 0: Analyst - Project Discovery

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 0 \
  --id run-20260103-145023
```

**Terminal Output**:
```
🔍 Step 0: Analyst - Project Discovery
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent: analyst
Task: Conduct project discovery and create project brief

📥 Inputs: None (initial step)

🤖 Executing analyst agent...

Analyzing requirements...
✓ Identified core features: task management, user auth, real-time updates
✓ Detected tech stack: Next.js 14, FastAPI, PostgreSQL, Google Cloud
✓ Estimated complexity: Medium (8-12 weeks)
✓ Identified risks: real-time sync complexity, cloud cost management

Creating project brief artifact...

📤 Outputs:
✓ project-brief-run-20260103-145023.json
  Location: .claude/context/runs/run-20260103-145023/artifacts/
  Size: 4.2 KB

🔍 Validating output...
Schema: .claude/schemas/project_brief.schema.json
✓ Required fields present: business_objective, target_users, tech_stack
✓ Tech stack valid: nextjs, fastapi, postgresql
✓ Risk assessment complete: 3 risks identified

✅ Validation passed

📝 Gate file created:
.claude/context/runs/run-20260103-145023/gates/00-analyst.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Step 0 complete (duration: 45s)
```

#### Step 1: PM - Product Requirements

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 1 \
  --id run-20260103-145023
```

**Terminal Output**:
```
📋 Step 1: PM - Product Requirements Document
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent: pm
Task: Create product requirements document

📥 Inputs:
✓ project-brief-run-20260103-145023.json (from step 0)

🤖 Executing pm agent...

Reading project brief...
✓ Business objective: Task management SaaS for teams
✓ Target users: Small to medium teams (5-50 users)

Creating user stories...
✓ Epic 1: User Management (5 stories)
✓ Epic 2: Task Management (8 stories)
✓ Epic 3: Real-Time Collaboration (4 stories)
✓ Epic 4: Notifications (3 stories)

Defining acceptance criteria...
✓ 20 user stories with detailed acceptance criteria
✓ Non-functional requirements: performance, security, scalability

Creating PRD artifact...

📤 Outputs:
✓ prd-run-20260103-145023.json
  Location: .claude/context/runs/run-20260103-145023/artifacts/
  Size: 12.8 KB

🔍 Validating output...
Schema: .claude/schemas/prd.schema.json
✓ All user stories have acceptance criteria
✓ Non-functional requirements defined
✓ Success metrics identified

✅ Validation passed

📝 Gate file created:
.claude/context/runs/run-20260103-145023/gates/01-pm.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Step 1 complete (duration: 62s)
```

#### Step 2: Architect - System Design

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 2 \
  --id run-20260103-145023
```

**Terminal Output**:
```
🏗️ Step 2: Architect - System Architecture Design
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent: architect
Task: Design system architecture

📥 Inputs:
✓ project-brief-run-20260103-145023.json (from step 0)
✓ prd-run-20260103-145023.json (from step 1)

🤖 Executing architect agent...

Analyzing requirements...
✓ Frontend: Next.js 14 App Router with Server Components
✓ Backend: FastAPI with async endpoints
✓ Database: PostgreSQL with connection pooling
✓ Real-time: WebSocket via FastAPI WebSocket support
✓ Authentication: JWT with refresh tokens
✓ Deployment: Google Cloud Run (frontend + backend)

Designing architecture layers...
✓ Presentation Layer: React components, client state (Zustand)
✓ API Layer: RESTful endpoints + WebSocket
✓ Business Logic: Service layer with transaction management
✓ Data Layer: PostgreSQL with migrations (Alembic)
✓ Infrastructure: Cloud Run, Cloud SQL, Secret Manager

Creating architecture diagram...
✓ Component diagram generated
✓ Data flow diagram generated
✓ Deployment architecture diagram generated

Creating architecture artifact...

📤 Outputs:
✓ architecture-run-20260103-145023.json
  Location: .claude/context/runs/run-20260103-145023/artifacts/
  Size: 18.5 KB

🔍 Validating output...
Schema: .claude/schemas/architecture.schema.json
✓ All layers defined with technology choices
✓ API contracts specified
✓ Deployment strategy complete
✓ Security controls identified

✅ Validation passed

📝 Gate file created:
.claude/context/runs/run-20260103-145023/gates/02-architect.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Step 2 complete (duration: 78s)
```

#### Step 3: Database Architect - Schema Design

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 3 \
  --id run-20260103-145023
```

**Terminal Output**:
```
🗄️ Step 3: Database Architect - Schema Design
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent: database-architect
Task: Design database schema and migrations

📥 Inputs:
✓ prd-run-20260103-145023.json (from step 1)
✓ architecture-run-20260103-145023.json (from step 2)

🤖 Executing database-architect agent...

Analyzing data requirements...
✓ Core entities: Users, Teams, Tasks, Comments, Attachments
✓ Relationships: 1:N (User:Tasks), M:N (User:Teams)
✓ Audit requirements: created_at, updated_at, deleted_at

Designing schema...
✓ Table: users (id, email, password_hash, created_at, ...)
✓ Table: teams (id, name, owner_id, created_at, ...)
✓ Table: team_members (team_id, user_id, role, joined_at)
✓ Table: tasks (id, title, description, assignee_id, team_id, ...)
✓ Table: comments (id, task_id, user_id, content, created_at, ...)

Creating indexes...
✓ Index: tasks.assignee_id (query performance)
✓ Index: tasks.team_id (team task queries)
✓ Index: comments.task_id (task comments)
✓ Composite index: tasks(team_id, status) (dashboard queries)

Creating migrations...
✓ Migration 001: Initial schema
✓ Migration 002: Add audit columns
✓ Migration 003: Add indexes

Optimizing queries...
✓ Query plan analyzed for dashboard query
✓ Query plan analyzed for task search
✓ Recommended materialized view for team statistics

Creating schema artifact...

📤 Outputs:
✓ database-schema-run-20260103-145023.json
  Location: .claude/context/runs/run-20260103-145023/artifacts/
  Size: 15.2 KB

🔍 Validating output...
Schema: .claude/schemas/database_schema.schema.json
✓ All tables have primary keys
✓ Foreign keys defined with cascade rules
✓ Indexes cover common query patterns
✓ Migration scripts valid

✅ Validation passed

📝 Gate file created:
.claude/context/runs/run-20260103-145023/gates/03-database-architect.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Step 3 complete (duration: 52s)
```

#### Steps 4-9 (Abbreviated)

```bash
# Step 4: UX Expert - UI/UX Specifications
node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 4 --id run-20260103-145023
# Output: ui-spec-run-20260103-145023.json (8.9 KB)

# Step 5: DevOps - Infrastructure Setup
node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 5 --id run-20260103-145023
# Output: infrastructure-config-run-20260103-145023.json (6.3 KB)

# Step 6: Developer - Core Implementation
node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 6 --id run-20260103-145023
# Output: dev-manifest-run-20260103-145023.json (22.7 KB, 47 files created)

# Step 7: QA - Test Strategy
node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 7 --id run-20260103-145023
# Output: test-plan-run-20260103-145023.json (11.4 KB)

# Step 8: Security Architect - Security Review
node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 8 --id run-20260103-145023
# Output: security-report-run-20260103-145023.json (9.8 KB)

# Step 9: Technical Writer - Documentation
node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 9 --id run-20260103-145023
# Output: documentation-run-20260103-145023.json (14.5 KB)
```

#### Step 10: Code Reviewer - Final Review

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 10 \
  --id run-20260103-145023
```

**Terminal Output**:
```
🔍 Step 10: Code Reviewer - Final Review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent: code-reviewer
Task: Comprehensive code review and quality gate

📥 Inputs:
✓ dev-manifest-run-20260103-145023.json (from step 6)
✓ test-plan-run-20260103-145023.json (from step 7)
✓ security-report-run-20260103-145023.json (from step 8)

🤖 Executing code-reviewer agent...

Reviewing implementation...
✓ 47 files reviewed
✓ Code style: 98% compliant (2 minor issues)
✓ Test coverage: 87% (meets 80% threshold)
✓ Security: No critical issues (3 minor recommendations)
✓ Performance: No blocking issues (1 optimization suggestion)

Creating review report...

📤 Outputs:
✓ code-review-report-run-20260103-145023.json
  Location: .claude/context/runs/run-20260103-145023/artifacts/
  Size: 16.9 KB

🔍 Validating output...
Schema: .claude/schemas/code_review_report.schema.json
✓ All files reviewed with ratings
✓ Issues categorized by severity
✓ Recommendations actionable

✅ Validation passed

📝 Gate file created:
.claude/context/runs/run-20260103-145023/gates/10-code-reviewer.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Step 10 complete (duration: 89s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Workflow complete: fullstack
Run ID: run-20260103-145023
Total duration: 8m 42s
Steps completed: 11/11
Artifacts created: 11
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Artifacts Summary:
.claude/context/runs/run-20260103-145023/artifacts/
├── project-brief-run-20260103-145023.json (4.2 KB)
├── prd-run-20260103-145023.json (12.8 KB)
├── architecture-run-20260103-145023.json (18.5 KB)
├── database-schema-run-20260103-145023.json (15.2 KB)
├── ui-spec-run-20260103-145023.json (8.9 KB)
├── infrastructure-config-run-20260103-145023.json (6.3 KB)
├── dev-manifest-run-20260103-145023.json (22.7 KB)
├── test-plan-run-20260103-145023.json (11.4 KB)
├── security-report-run-20260103-145023.json (9.8 KB)
├── documentation-run-20260103-145023.json (14.5 KB)
└── code-review-report-run-20260103-145023.json (16.9 KB)

Next steps:
1. Review artifacts in .claude/context/runs/run-20260103-145023/artifacts/
2. Deploy to staging: node .claude/tools/deploy.mjs --env staging
3. Run integration tests: npm run test:integration
```

---

## Skill-Only CUJ Execution (CUJ-002)

**CUJ**: Configure Project Rules for Tech Stack

### User Prompt Examples

```
/select-rules
```

Or:

```
I'm starting a new Next.js project with TypeScript and Tailwind CSS.
Can you configure the right rules?
```

### Execute Skill Command

```bash
# Skill invoked automatically via natural language or slash command
# No manual command needed
```

### Output Showing Stack Detection and Rule Selection

```
🔍 Analyzing project for tech stack detection...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Reading package.json...
✓ Found: package.json
✓ Dependencies detected: next, react, typescript, tailwindcss

📁 Scanning project structure...
✓ Found: tsconfig.json (TypeScript configured)
✓ Found: tailwind.config.js (Tailwind CSS configured)
✓ Found: next.config.js (Next.js configured)

🏗️ Detected Tech Stack:
├── Framework: Next.js 14 (App Router)
├── Language: TypeScript
├── Styling: Tailwind CSS
├── Testing: Not detected
└── Database: Not detected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Loading rule index...
✓ Rule index loaded: 1,081 rules available

🔎 Querying rules for detected technologies...
✓ nextjs: 47 rules found
✓ typescript: 89 rules found
✓ tailwindcss: 23 rules found
✓ react: 112 rules found

📋 Recommended Rules:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Master Rules (8):
✓ .claude/rules-master/PROTOCOL_ENGINEERING.md
✓ .claude/rules-master/TECH_STACK_NEXTJS.md

Library Rules (5):
✓ .claude/rules-library/nextjs-app-router-cursorrules-prompt-file/next-js-app-router-best-practices.mdc
✓ .claude/rules-library/nextjs-app-router-cursorrules-prompt-file/next-js-typescript-usage.mdc
✓ .claude/rules-library/nextjs-app-router-cursorrules-prompt-file/next-js-folder-structure.mdc
✓ .claude/rules-library/javascript-typescript-code-quality-cursorrules-pro/coding-guidelines---dry-and-functional-style.mdc
✓ .claude/rules-library/nextjs-react-tailwind-cursorrules-prompt-file/ui-and-styling-with-shadcn-ui-and-tailwind.mdc

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💾 Creating configuration...

Writing .claude/project-rules.json...
{
  "tech_stack": {
    "framework": "nextjs",
    "language": "typescript",
    "styling": "tailwindcss",
    "runtime": "nodejs"
  },
  "master_rules": [
    ".claude/rules-master/PROTOCOL_ENGINEERING.md",
    ".claude/rules-master/TECH_STACK_NEXTJS.md"
  ],
  "library_rules": [
    ".claude/rules-library/nextjs-app-router-cursorrules-prompt-file/next-js-app-router-best-practices.mdc",
    ".claude/rules-library/nextjs-app-router-cursorrules-prompt-file/next-js-typescript-usage.mdc",
    ".claude/rules-library/nextjs-app-router-cursorrules-prompt-file/next-js-folder-structure.mdc",
    ".claude/rules-library/javascript-typescript-code-quality-cursorrules-pro/coding-guidelines---dry-and-functional-style.mdc",
    ".claude/rules-library/nextjs-react-tailwind-cursorrules-prompt-file/ui-and-styling-with-shadcn-ui-and-tailwind.mdc"
  ],
  "auto_load": true
}

✅ Configuration saved

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Rules Summary:
Master Rules: 2
Library Rules: 5
Total Rules: 7
Auto-load: Enabled

🎯 Next Steps:
1. Rules will auto-load in future conversations
2. Use /audit to validate code against rules
3. Use /scaffold to generate rule-compliant code
4. Add testing rules: /select-rules --testing
5. Add database rules: /select-rules --database

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Rule configuration complete (duration: 12s)
```

---

## Quick-Flow CUJ Execution (CUJ-011)

**CUJ**: Quick Bug Fix

### User Prompt Example

```
/quick-ship

There's a bug in the user authentication flow. When users try to reset their password,
they get a 500 error. The error logs show "Invalid token format" from the email service.
```

### Create Run and Execute Steps

```bash
# Quick-ship workflow auto-creates run
# No manual run-manager command needed
```

**Terminal Output**:
```
🚀 Quick-Ship Workflow Activated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detected: Bug fix request
Target: User authentication (password reset)
Workflow: quick-ship (3 steps)

Creating run: run-20260103-151234

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Step 0: Developer - Investigate Issue
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Searching codebase for password reset logic...
✓ Found: src/api/auth/reset-password.ts
✓ Found: src/services/email/password-reset-email.ts

Reading error logs...
✓ Error: "Invalid token format" from email service
✓ Stack trace points to: src/services/email/password-reset-email.ts:47

Analyzing code...
✓ Issue identified: JWT token contains newlines causing email template parsing error
✓ Root cause: Missing .trim() on token before email template insertion

Creating fix...
✓ File: src/services/email/password-reset-email.ts
✓ Change: Added .trim() to token variable before template insertion
✓ Added validation: Token format check before email send

Creating test...
✓ Test: src/services/email/password-reset-email.test.ts
✓ Test case: "should handle tokens with whitespace"
✓ Test case: "should validate token format before sending"

Running tests...
✓ All tests pass (2 new tests, 18 total)

📤 Output: dev-manifest-run-20260103-151234.json
✅ Step 0 complete (duration: 23s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Step 1: QA - Validate Fix
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Running unit tests...
✓ password-reset-email.test.ts: 18/18 passed

Running integration tests...
✓ auth.integration.test.ts: 24/24 passed
✓ Password reset flow tested end-to-end

Validating fix manually...
✓ Triggered password reset with test user
✓ Email sent successfully
✓ Token validated and password updated
✓ No 500 errors

📤 Output: test-results-run-20260103-151234.json
✅ Step 1 complete (duration: 31s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Step 2: Code Reviewer - Quick Review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reviewing changes...
✓ Files changed: 2
  - src/services/email/password-reset-email.ts (8 lines changed)
  - src/services/email/password-reset-email.test.ts (42 lines added)

Code quality checks...
✓ No linting errors
✓ Type checking passed
✓ Security: No new vulnerabilities introduced
✓ Test coverage: 100% for changed code

Review summary...
✓ Fix is minimal and targeted
✓ Root cause addressed
✓ Tests cover edge cases
✓ Ready for merge

📤 Output: code-review-report-run-20260103-151234.json
✅ Step 2 complete (duration: 18s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Quick-Ship Workflow Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run ID: run-20260103-151234
Total duration: 1m 12s
Steps completed: 3/3

📋 Changes:
✓ Fixed password reset token formatting issue
✓ Added token validation before email send
✓ Added 2 new test cases

Next steps:
1. git add src/services/email/
2. git commit -m "fix: validate token format in password reset emails"
3. git push origin fix/password-reset-token
4. Create PR: gh pr create --title "Fix password reset token format validation"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Ready to deploy (duration: 1m 12s)
```

---

## CUJ Simulation and Validation

Use `--cuj-simulation` to validate CUJ execution without actually running workflow steps.

### Syntax

```bash
node .claude/tools/cuj-validator.mjs \
  --cuj CUJ-005 \
  --cuj-simulation \
  --verbose
```

### Example: Validating CUJ-005 (Greenfield Project)

```bash
node .claude/tools/cuj-validator.mjs \
  --cuj CUJ-005 \
  --cuj-simulation \
  --verbose
```

**Output**:
```
🧪 CUJ Simulation Mode: CUJ-005
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CUJ: Greenfield Full-Stack Application Development
Workflow: greenfield-fullstack.yaml (11 steps)
Mode: Simulation (no actual execution)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Simulating workflow execution...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 0: Analyst
  Agent: analyst
  Task: Conduct project discovery
  Inputs: None (initial step)
  Expected Outputs: project-brief.json
  Validation Schema: .claude/schemas/project_brief.schema.json
  ✅ Schema file exists
  ✅ Agent file exists: .claude/agents/analyst.md
  ✅ Template exists: .claude/templates/project-brief.md

Step 1: PM
  Agent: pm
  Task: Create product requirements
  Inputs: project-brief.json (from step 0)
  Expected Outputs: prd.json
  Validation Schema: .claude/schemas/prd.schema.json
  ✅ Schema file exists
  ✅ Agent file exists: .claude/agents/pm.md
  ✅ Template exists: .claude/templates/prd.md
  ✅ Input artifact available from previous step

Step 2: Architect
  Agent: architect
  Task: Design system architecture
  Inputs: project-brief.json (from step 0), prd.json (from step 1)
  Expected Outputs: architecture.json
  Validation Schema: .claude/schemas/architecture.schema.json
  ✅ Schema file exists
  ✅ Agent file exists: .claude/agents/architect.md
  ✅ Template exists: .claude/templates/architecture.md
  ✅ All input artifacts available from previous steps

Step 3: Database Architect
  Agent: database-architect
  Task: Design database schema
  Inputs: prd.json (from step 1), architecture.json (from step 2)
  Expected Outputs: database-schema.json
  Validation Schema: .claude/schemas/database_schema.schema.json
  ✅ Schema file exists
  ✅ Agent file exists: .claude/agents/database-architect.md
  ✅ Template exists: .claude/templates/database-schema.md
  ✅ All input artifacts available from previous steps

Step 4: UX Expert
  Agent: ux-expert
  Task: Create UI/UX specifications
  Inputs: prd.json (from step 1), architecture.json (from step 2)
  Expected Outputs: ui-spec.json
  Validation Schema: .claude/schemas/ui_spec.schema.json
  ✅ Schema file exists
  ✅ Agent file exists: .claude/agents/ux-expert.md
  ✅ Template exists: .claude/templates/ui-spec.md
  ✅ All input artifacts available from previous steps

Step 5: DevOps
  Agent: devops
  Task: Setup infrastructure
  Inputs: architecture.json (from step 2)
  Expected Outputs: infrastructure-config.json
  Validation Schema: .claude/schemas/infrastructure_config.schema.json
  ✅ Schema file exists
  ✅ Agent file exists: .claude/agents/devops.md
  ✅ Template exists: .claude/templates/infrastructure-setup.md
  ✅ All input artifacts available from previous steps

Step 6: Developer
  Agent: developer
  Task: Implement core features
  Inputs: architecture.json, database-schema.json, ui-spec.json, infrastructure-config.json
  Expected Outputs: dev-manifest.json, code-artifacts
  Validation Schema: .claude/schemas/dev_manifest.schema.json
  ✅ Schema file exists
  ✅ Agent file exists: .claude/agents/developer.md
  ✅ Template exists: .claude/templates/implementation-plan.md
  ✅ All input artifacts available from previous steps

Step 7: QA
  Agent: qa
  Task: Create test strategy and execute tests
  Inputs: dev-manifest.json (from step 6), prd.json (from step 1)
  Expected Outputs: test-plan.json
  Validation Schema: .claude/schemas/test_plan.schema.json
  ✅ Schema file exists
  ✅ Agent file exists: .claude/agents/qa.md
  ✅ Template exists: .claude/templates/test-plan.md
  ✅ All input artifacts available from previous steps

Step 8: Security Architect
  Agent: security-architect
  Task: Conduct security review
  Inputs: architecture.json, dev-manifest.json
  Expected Outputs: security-report.json
  Validation Schema: .claude/schemas/security_report.schema.json
  ✅ Schema file exists
  ✅ Agent file exists: .claude/agents/security-architect.md
  ✅ Template exists: .claude/templates/security-review.md
  ✅ All input artifacts available from previous steps

Step 9: Technical Writer
  Agent: technical-writer
  Task: Create documentation
  Inputs: architecture.json, dev-manifest.json
  Expected Outputs: documentation.json
  Validation Schema: .claude/schemas/documentation.schema.json
  ✅ Schema file exists
  ✅ Agent file exists: .claude/agents/technical-writer.md
  ✅ Template exists: .claude/templates/documentation-plan.md
  ✅ All input artifacts available from previous steps

Step 10: Code Reviewer
  Agent: code-reviewer
  Task: Final code review
  Inputs: dev-manifest.json, test-plan.json, security-report.json
  Expected Outputs: code-review-report.json
  Validation Schema: .claude/schemas/code_review_report.schema.json
  ✅ Schema file exists
  ✅ Agent file exists: .claude/agents/code-reviewer.md
  ✅ Template exists: .claude/templates/code-review-report.md
  ✅ All input artifacts available from previous steps

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Simulation Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ All workflow steps validated
✅ All schemas exist
✅ All agents exist
✅ All templates exist
✅ All artifact dependencies satisfied

Total Steps: 11
Total Agents: 9 (unique)
Total Artifacts: 11
Estimated Duration: 8-12 minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CUJ-005 simulation passed (duration: 2s)
```

---

## Error Handling and Recovery

### 1. CUJ Not Found Error

**Error**:
```
❌ Error: CUJ not found
CUJ ID: CUJ-999
Expected location: .claude/docs/cujs/CUJ-999.md
```

**Solution**:
```bash
# List all available CUJs
ls .claude/docs/cujs/CUJ-*.md

# Use a valid CUJ ID
node .claude/tools/cuj-validator.mjs --cuj CUJ-005
```

### 2. Workflow File Missing Error

**Error**:
```
❌ Error: Workflow file not found
Workflow: .claude/workflows/custom-workflow.yaml
Referenced in: CUJ-015
```

**Solution**:
```bash
# List available workflows
ls .claude/workflows/*.yaml

# Update CUJ to reference correct workflow
# Or create missing workflow file
```

### 3. Artifact Not Found Error

**Error**:
```
❌ Error: Required artifact not found
Step 2 requires: project-brief.json (from step 0)
Location checked: .claude/context/runs/run-123/artifacts/project-brief.json
```

**Solution**:
```bash
# Run previous steps first
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 0 \
  --id run-123

# Then retry the failing step
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 2 \
  --id run-123
```

### 4. Validation Schema Mismatch Error

**Error**:
```
❌ Validation failed: Schema mismatch
Schema: .claude/schemas/prd.schema.json
Artifact: prd-run-123.json

Errors:
- Missing required field: "user_stories"
- Invalid type for "success_metrics": expected array, got string
```

**Solution**:
```bash
# Read gate file for detailed feedback
cat .claude/context/runs/run-123/gates/01-pm.json

# Gate file contains:
# {
#   "validation_status": "failed",
#   "errors": [
#     {
#       "field": "user_stories",
#       "error": "missing_required_field",
#       "message": "Field 'user_stories' is required but not found",
#       "correction": "Add 'user_stories' array with at least one story"
#     }
#   ]
# }

# Fix agent output based on feedback
# Re-run workflow step
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 1 \
  --id run-123
```

### 5. Agent Not Found Error

**Error**:
```
❌ Error: Agent file not found
Agent: custom-agent
Expected location: .claude/agents/custom-agent.md
```

**Solution**:
```bash
# List available agents
ls .claude/agents/*.md

# Use a valid agent or create the missing agent file
```

---

## Troubleshooting Guide

### Issue: Workflow Takes Too Long

**Symptoms**:
- Step execution exceeds expected duration
- Agent appears stuck

**Diagnosis**:
```bash
# Check run state
cat .claude/context/runs/run-123/artifact-registry.json

# Check agent logs (if available)
tail -f .claude/logs/workflow-run-123.log
```

**Solutions**:
1. **Break down complex steps**: Split large steps into smaller substeps
2. **Use checkpoints**: Agent saves intermediate state every 5 minutes
3. **Resume from checkpoint**: If interrupted, agent resumes from last checkpoint
4. **Increase timeout**: Modify workflow YAML to increase step timeout

### Issue: Out of Context Window

**Symptoms**:
- "Context window full" error
- Agent stops mid-execution

**Diagnosis**:
```bash
# Check current context usage (approximation)
wc -l .claude/context/runs/run-123/artifacts/*.json
```

**Solutions**:
1. **Auto-compaction**: Context auto-compacts at limit (no action needed)
2. **Use structured state**: Save state to JSON files, not conversation
3. **Progressive disclosure**: Load artifacts only when needed
4. **Clear between steps**: Use `/clear` between workflow steps

### Issue: Validation Keeps Failing

**Symptoms**:
- Same validation errors after 3 retries
- Gate file shows persistent schema violations

**Diagnosis**:
```bash
# Read gate file for detailed errors
cat .claude/context/runs/run-123/gates/01-pm.json

# Check schema for requirements
cat .claude/schemas/prd.schema.json
```

**Solutions**:
1. **Review schema**: Ensure agent output matches schema exactly
2. **Check required fields**: All required fields must be present
3. **Validate types**: Field types must match schema (string, array, object)
4. **Use template**: Reference `.claude/templates/` for correct structure
5. **Manual review**: Review agent output JSON for syntax errors

### Issue: Rule Not Found

**Symptoms**:
- `/audit` reports "no applicable rules"
- Skill reports "rule not found in index"

**Diagnosis**:
```bash
# Check if rule index exists
ls .claude/context/rule-index.json

# Check rule index timestamp
stat .claude/context/rule-index.json
```

**Solutions**:
1. **Regenerate index**: `pnpm index-rules`
2. **Verify rule exists**: Check `.claude/rules-master/` and `.claude/rules-library/`
3. **Check technology mapping**: Ensure rule is tagged with correct technologies

### Debug Commands

```bash
# List all runs
ls .claude/context/runs/

# View run artifacts
ls .claude/context/runs/run-123/artifacts/

# View run gates
ls .claude/context/runs/run-123/gates/

# View artifact registry
cat .claude/context/runs/run-123/artifact-registry.json

# Validate specific artifact against schema
node .claude/tools/gates/gate.mjs \
  --schema .claude/schemas/prd.schema.json \
  --input .claude/context/runs/run-123/artifacts/prd.json \
  --gate .claude/context/runs/run-123/gates/01-pm.json

# Simulate CUJ execution
node .claude/tools/cuj-validator.mjs \
  --cuj CUJ-005 \
  --cuj-simulation \
  --verbose

# List available workflows
ls .claude/workflows/*.yaml

# List available agents
ls .claude/agents/*.md

# List available skills
ls .claude/skills/*/SKILL.md
```

---

## Quick Reference

| Execution Method | User Prompt | Command | Duration | Output |
|------------------|-------------|---------|----------|--------|
| **Workflow-Based** | "Build a full-stack app" | Auto-detected, runs `greenfield-fullstack.yaml` | 8-12 min | 11 artifacts |
| **Skill-Only** | `/select-rules` | Skill auto-invoked | 10-20 sec | `.claude/project-rules.json` |
| **Quick-Flow** | `/quick-ship` + bug description | Auto-detected, runs `quick-ship.yaml` | 1-3 min | 3 artifacts |
| **Manual Workflow** | N/A | `node .claude/tools/workflow_runner.js --workflow <path> --step <n> --id <run_id>` | Varies | Step-specific artifacts |
| **CUJ Simulation** | N/A | `node .claude/tools/cuj-validator.mjs --cuj <id> --cuj-simulation` | 2-5 sec | Validation report |

### Common User Prompts → Workflow Mapping

| User Prompt | Detected Workflow | Steps | Duration |
|-------------|-------------------|-------|----------|
| "Build a [tech] application" | `fullstack` | 11 | 8-12 min |
| "Fix this bug" | `quick-ship` | 3 | 1-3 min |
| "Optimize performance" | `performance` | 5 | 4-8 min |
| "Review this PR" | `code-quality` | 4 | 3-6 min |
| "Production is down!" | `incident` | 6 | 5-10 min |
| "Build a mobile app" | `mobile` | 9 | 7-11 min |
| "Design an AI system" | `ai-system` | 8 | 6-10 min |

### Skill Invocation Methods

| Method | Example | Use Case |
|--------|---------|----------|
| **Natural Language** | "Audit this code for rule violations" | Most user-friendly |
| **Slash Command** | `/select-rules` | Quick, predefined workflows |
| **Skill Tool** | `Skill: rule-auditor` with parameters | Programmatic control |

### Artifact Locations

| Run Mode | Artifacts | Gates | Registry |
|----------|-----------|-------|----------|
| **New (Recommended)** | `.claude/context/runs/<run_id>/artifacts/` | `.claude/context/runs/<run_id>/gates/` | `.claude/context/runs/<run_id>/artifact-registry.json` |
| **Legacy** | `.claude/context/artifacts/` | `.claude/context/history/gates/<workflow_id>/` | `.claude/context/session.json` |

---

## See Also

- **CUJ Master List**: [CUJ-MASTER-LIST.md](./CUJ-MASTER-LIST.md)
- **CUJ Test Protocol**: [CUJ-TEST-PROTOCOL.md](./CUJ-TEST-PROTOCOL.md)
- **Workflow Guide**: [WORKFLOW-GUIDE.md](../../workflows/WORKFLOW-GUIDE.md)
- **Run Manager**: [run-manager.mjs](../../tools/run-manager.mjs)
- **Workflow Runner**: [workflow_runner.js](../../tools/workflow_runner.js)
