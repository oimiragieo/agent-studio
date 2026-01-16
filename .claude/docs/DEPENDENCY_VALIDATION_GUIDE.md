# Dependency Validation Guide

## Overview

Dependency validation ensures all required tools, packages, and files are available before task execution. This prevents mid-execution failures due to missing dependencies.

### What It Checks
- Node.js version compatibility
- npm package versions
- System command availability
- Critical file existence
- Environment variables

### Why It Matters
- Prevents "works on my machine" issues
- Catches missing dependencies early
- Reduces debugging time
- Ensures consistent environments across team

## When to Run Validation

### Before Task Execution
Run validation before starting any development task:
```bash
node .claude/tools/dependency-validator.mjs validate-all
```

### In CI/CD Pipelines
Add validation as first step in CI/CD:
```yaml
# GitHub Actions
- name: Validate Dependencies
  run: node .claude/tools/dependency-validator.mjs validate-all
```

### Pre-commit Hooks
Validate dependencies before every commit:
```json
{
  "hooks": {
    "pre-commit": "node .claude/tools/dependency-validator.mjs validate-all"
  }
}
```

## Configuration

Create `.claude/schemas/dependency-requirements.json`:

```json
{
  "node": { "min_version": "18.0.0" },
  "npm_packages": [
    { "name": "prettier", "min_version": "3.0.0" }
  ],
  "system_commands": [
    { "command": "git", "purpose": "Version control" }
  ],
  "critical_files": [
    { "path": "package.json", "description": "NPM manifest" }
  ]
}
```

## Usage Examples

### Command 1: validate-all
```bash
node .claude/tools/dependency-validator.mjs validate-all
# Validates all dependency types
```

### Command 2: validate-node
```bash
node .claude/tools/dependency-validator.mjs validate-node --min-version 18.0.0
# Validates Node.js version only
```

### Command 3: validate-packages
```bash
node .claude/tools/dependency-validator.mjs validate-packages --config .claude/schemas/dependency-requirements.json
# Validates npm packages from config
```

### Command 4: validate-commands
```bash
node .claude/tools/dependency-validator.mjs validate-commands --config .claude/schemas/dependency-requirements.json
# Validates system commands exist
```

### Command 5: validate-files
```bash
node .claude/tools/dependency-validator.mjs validate-files --config .claude/schemas/dependency-requirements.json
# Validates critical files exist
```

## Validation Types

### 1. Node.js Version
Checks Node.js version meets minimum requirement:
- **Min Version**: 18.0.0 (required)
- **Check**: `node --version`
- **Failure**: "Node.js 16.x.x detected, minimum 18.0.0 required"

### 2. npm Packages
Checks package versions in package.json:
- **Source**: package.json dependencies
- **Check**: Version comparison
- **Failure**: "prettier 2.8.0 detected, minimum 3.0.0 required"

### 3. System Commands
Checks commands available in PATH:
- **Commands**: git, npm, pnpm, eslint, prettier
- **Check**: `which <command>` or `where <command>`
- **Failure**: "git command not found, install from https://git-scm.com"

### 4. Critical Files
Checks files exist at specified paths:
- **Files**: package.json, .gitignore, tsconfig.json
- **Check**: File existence
- **Failure**: "package.json not found, initialize with npm init"

### 5. Environment Variables
Checks required env vars are set:
- **Variables**: NODE_ENV, API_KEY, etc.
- **Check**: process.env
- **Failure**: "NODE_ENV not set, required for production"

## Interpreting Results

### Exit Codes
- **0**: All dependencies valid
- **1**: Warnings (non-blocking issues)
- **2**: Critical missing dependencies (blocking)
- **3**: Validation error (config issue)

### JSON Output
```json
{
  "valid": false,
  "missing_dependencies": [
    {
      "type": "npm_package",
      "name": "prettier",
      "required": "3.0.0",
      "installed": "2.8.0",
      "action": "npm install prettier@^3.0.0"
    }
  ],
  "warnings": [
    {
      "type": "optional_command",
      "command": "pnpm",
      "recommendation": "Install pnpm for faster installs: npm install -g pnpm"
    }
  ]
}
```

## Troubleshooting

### Issue 1: Node.js Version Too Old
**Error**: "Node.js 16.x.x detected, minimum 18.0.0 required"
**Fix**: Install Node.js 18+ from https://nodejs.org

### Issue 2: Missing npm Package
**Error**: "prettier not found in package.json"
**Fix**: `npm install -D prettier`

### Issue 3: System Command Not Found
**Error**: "git command not found"
**Fix**: Install Git from https://git-scm.com

### Issue 4: Critical File Missing
**Error**: "package.json not found"
**Fix**: Initialize project with `npm init -y`

### Issue 5: Invalid Config File
**Error**: "dependency-requirements.json invalid JSON"
**Fix**: Validate JSON syntax at https://jsonlint.com

## CI/CD Integration

### GitHub Actions
```yaml
name: CI
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Validate Dependencies
        run: node .claude/tools/dependency-validator.mjs validate-all
```

### GitLab CI
```yaml
validate-dependencies:
  stage: test
  script:
    - node .claude/tools/dependency-validator.mjs validate-all
```

### Jenkins
```groovy
stage('Validate Dependencies') {
  steps {
    sh 'node .claude/tools/dependency-validator.mjs validate-all'
  }
}
```

## Pre-commit Hook Integration

Add to `.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

node .claude/tools/dependency-validator.mjs validate-all || exit 1
```

## Best Practices

### 1. Required vs Optional
- **Required**: Core dependencies (Node.js, git, package.json)
- **Optional**: Nice-to-have tools (pnpm, docker)

### 2. Version Pinning
- **Strict**: Use exact versions for production (18.0.0)
- **Flexible**: Use ranges for development (^18.0.0)

### 3. Validation Frequency
- **Always**: Pre-commit, CI/CD pipeline start
- **Occasionally**: Before major releases
- **Never**: During active development (slows down)

### 4. Error Handling
- **Block**: Missing required dependencies
- **Warn**: Missing optional dependencies
- **Ignore**: Development-only dependencies in production

### 5. Config Management
- **Single Source**: One dependency-requirements.json file
- **Environment-Specific**: Different configs for dev/staging/prod
- **Version Control**: Commit dependency config files

## Examples

### Example 1: Basic Project
```json
{
  "node": { "min_version": "18.0.0" },
  "npm_packages": [
    { "name": "typescript", "min_version": "5.0.0" }
  ],
  "system_commands": [
    { "command": "git", "purpose": "Version control" }
  ],
  "critical_files": [
    { "path": "package.json", "description": "NPM manifest" }
  ]
}
```

### Example 2: Full-Stack Project
```json
{
  "node": { "min_version": "18.0.0" },
  "npm_packages": [
    { "name": "react", "min_version": "18.0.0" },
    { "name": "next", "min_version": "14.0.0" },
    { "name": "typescript", "min_version": "5.0.0" }
  ],
  "system_commands": [
    { "command": "git", "purpose": "Version control" },
    { "command": "docker", "purpose": "Containerization", "optional": true }
  ],
  "critical_files": [
    { "path": "package.json", "description": "NPM manifest" },
    { "path": "tsconfig.json", "description": "TypeScript config" },
    { "path": ".env.local", "description": "Environment variables", "optional": true }
  ]
}
```

## Advanced Configuration

### Environment-Specific Requirements

You can define different dependency requirements for different environments:

```json
{
  "environments": {
    "development": {
      "node": { "min_version": "18.0.0" },
      "npm_packages": [
        { "name": "typescript", "min_version": "5.0.0" },
        { "name": "eslint", "min_version": "8.0.0" },
        { "name": "prettier", "min_version": "3.0.0" }
      ]
    },
    "production": {
      "node": { "min_version": "20.0.0" },
      "npm_packages": [
        { "name": "typescript", "min_version": "5.3.0" }
      ],
      "system_commands": [
        { "command": "pm2", "purpose": "Process management" }
      ]
    }
  }
}
```

### Custom Validation Rules

Create custom validation functions for project-specific requirements:

```javascript
// .claude/tools/custom-validators.mjs
export async function validateCustomRequirement() {
  // Check custom requirement
  const isValid = await checkSomething();

  return {
    valid: isValid,
    message: isValid ? "Custom check passed" : "Custom check failed",
    action: isValid ? null : "Run: npm run fix-custom-issue"
  };
}
```

### Dependency Caching

For faster validation, enable dependency caching:

```json
{
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "location": ".claude/context/tmp/dependency-cache.json"
  },
  "node": { "min_version": "18.0.0" }
}
```

### Parallel Validation

Validate multiple dependency types in parallel for faster execution:

```bash
node .claude/tools/dependency-validator.mjs validate-all --parallel --max-workers 4
```

## Integration with Workflows

### Pre-Workflow Validation

Add dependency validation as first step in workflows:

```yaml
# .claude/workflows/feature-development.yaml
workflow:
  name: Feature Development
  steps:
    - id: '01-validate-deps'
      agent: orchestrator
      action: validate-dependencies
      required: true
      blocking: true
      config:
        requirements: .claude/schemas/dependency-requirements.json

    - id: '02-implement-feature'
      agent: developer
      depends_on: ['01-validate-deps']
      action: implement-feature
```

### Post-Installation Validation

Automatically validate dependencies after package installation:

```json
{
  "scripts": {
    "postinstall": "node .claude/tools/dependency-validator.mjs validate-packages"
  }
}
```

### Continuous Validation

Set up continuous validation with file watchers:

```bash
# Watch package.json for changes and validate
node .claude/tools/dependency-validator.mjs watch --file package.json
```

## Error Recovery

### Auto-Fix Mode

Enable auto-fix to automatically resolve common dependency issues:

```bash
node .claude/tools/dependency-validator.mjs validate-all --auto-fix
```

Auto-fix capabilities:
- Install missing npm packages
- Update outdated packages
- Create missing critical files
- Set default environment variables

### Manual Recovery Steps

When auto-fix is not available:

1. **Review Validation Report**
   ```bash
   node .claude/tools/dependency-validator.mjs validate-all --report .claude/context/reports/dependency-report.json
   ```

2. **Identify Root Cause**
   - Check error messages for specific issues
   - Review recommended actions
   - Verify system PATH and environment

3. **Apply Fixes**
   - Install missing dependencies
   - Update outdated packages
   - Configure environment variables
   - Create missing files

4. **Re-validate**
   ```bash
   node .claude/tools/dependency-validator.mjs validate-all
   ```

## Security Considerations

### Package Vulnerability Scanning

Integrate vulnerability scanning with dependency validation:

```bash
node .claude/tools/dependency-validator.mjs validate-packages --security-scan
```

Security checks include:
- Known CVEs in dependencies
- Outdated packages with security patches
- Malicious packages
- License compliance

### Trusted Sources

Configure trusted package registries:

```json
{
  "security": {
    "allowed_registries": [
      "https://registry.npmjs.org"
    ],
    "block_unknown_sources": true
  }
}
```

### Dependency Pinning

Enforce exact version pinning for critical dependencies:

```json
{
  "npm_packages": [
    {
      "name": "express",
      "exact_version": "4.18.2",
      "allow_updates": false,
      "reason": "Security critical - only update with explicit approval"
    }
  ]
}
```

## Performance Optimization

### Validation Caching

Cache validation results to reduce overhead:

```javascript
// .claude/tools/dependency-validator.mjs
const cache = new ValidationCache({
  ttl: 3600, // 1 hour
  invalidateOn: ['package.json', 'package-lock.json']
});

const result = await cache.getOrCompute('node-version', async () => {
  return validateNodeVersion();
});
```

### Incremental Validation

Only validate changed dependencies:

```bash
node .claude/tools/dependency-validator.mjs validate-all --incremental
```

### Parallel Execution

Run validations in parallel:

```javascript
const results = await Promise.all([
  validateNodeVersion(),
  validatePackages(),
  validateCommands(),
  validateFiles()
]);
```

## Reporting and Monitoring

### Detailed Reports

Generate comprehensive validation reports:

```bash
node .claude/tools/dependency-validator.mjs validate-all \
  --report .claude/context/reports/dependency-validation-report.json \
  --format json
```

Report includes:
- Validation timestamp
- System information
- Dependency status (valid/invalid/warning)
- Missing dependencies with remediation steps
- Validation duration
- Environment details

### Continuous Monitoring

Monitor dependency health over time:

```bash
# Run validation every hour and store results
node .claude/tools/dependency-validator.mjs monitor \
  --interval 3600 \
  --output .claude/context/logs/dependency-monitor.log
```

### Metrics and Analytics

Track validation metrics:
- Success rate over time
- Most common missing dependencies
- Average validation duration
- Environment-specific issues

## Migration Guide

### Migrating from Manual Checks

Replace manual dependency checks with automated validation:

**Before (Manual)**:
```bash
# Manual check script
#!/bin/bash
node --version
npm --version
git --version
test -f package.json
```

**After (Automated)**:
```bash
# Automated validation
node .claude/tools/dependency-validator.mjs validate-all
```

### Integrating with Existing Workflows

Add validation to existing workflows without disruption:

1. **Start with warnings only** (non-blocking)
2. **Monitor validation results** for 1-2 weeks
3. **Fix common issues** identified
4. **Enable blocking mode** after stabilization

### Legacy System Support

Support older Node.js versions during migration:

```json
{
  "node": {
    "min_version": "16.0.0",
    "recommended_version": "18.0.0",
    "deprecation_warning": "Node.js 16 support ends 2025-06-01"
  }
}
```

## Common Patterns

### Pattern 1: Monorepo Validation

Validate dependencies across multiple packages:

```bash
# Validate all packages in monorepo
for dir in packages/*; do
  cd $dir
  node ../../.claude/tools/dependency-validator.mjs validate-all
  cd ../..
done
```

### Pattern 2: Docker Container Validation

Validate dependencies inside Docker containers:

```dockerfile
FROM node:18-alpine

# Copy validator
COPY .claude/tools/dependency-validator.mjs /app/.claude/tools/
COPY .claude/schemas/dependency-requirements.json /app/.claude/schemas/

# Validate before build
RUN node /app/.claude/tools/dependency-validator.mjs validate-all
```

### Pattern 3: Multi-Environment Validation

Validate different requirements per environment:

```bash
# Development
node .claude/tools/dependency-validator.mjs validate-all --env development

# Production
node .claude/tools/dependency-validator.mjs validate-all --env production
```

### Pattern 4: Custom Validation Pipeline

Chain multiple validation steps:

```bash
# Comprehensive validation pipeline
node .claude/tools/dependency-validator.mjs validate-node && \
node .claude/tools/dependency-validator.mjs validate-packages && \
node .claude/tools/dependency-validator.mjs validate-commands && \
node .claude/tools/dependency-validator.mjs validate-files && \
echo "All validations passed!"
```

## FAQ

### Q: How often should I run validation?
**A**: Run validation before every commit (pre-commit hook) and in CI/CD pipelines. For local development, run when changing dependencies.

### Q: What if validation fails in CI/CD?
**A**: CI/CD should block on validation failures. Fix dependencies before proceeding with deployment.

### Q: Can I skip validation for hotfixes?
**A**: No. Validation catches critical issues that could cause production failures. Even hotfixes should validate.

### Q: How do I handle optional dependencies?
**A**: Mark dependencies as optional in config. Validation will warn but not fail:
```json
{
  "system_commands": [
    { "command": "docker", "optional": true }
  ]
}
```

### Q: What about platform-specific dependencies?
**A**: Use conditional validation based on platform:
```json
{
  "system_commands": [
    {
      "command": "apt-get",
      "platforms": ["linux"],
      "purpose": "Package management"
    }
  ]
}
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-15 | Initial release |
