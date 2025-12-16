# Migration Guide: Legacy to SDK Integration

This guide helps you migrate from the legacy configuration-based approach to the new SDK-integrated system.

## Overview

The SDK integration provides:
- Native tool implementations with streaming
- Proper permission management
- Session tracking
- Enterprise APIs
- Enhanced hooks

## Migration Steps

### Step 1: Update Dependencies

```bash
pnpm install @anthropic-ai/sdk zod ws
```

### Step 2: Update Agent Files

Add XML structure to agent files:

**Before:**
```markdown
# Developer Agent

## Identity
You are Alex...
```

**After:**
```markdown
# Developer Agent

<identity>
You are Alex...
</identity>

<capabilities>
- Frontend Implementation
- Backend Development
</capabilities>

<instructions>
## Execution Process
...
</instructions>

<constraints>
- Never skip tests
- Always validate inputs
</constraints>
```

### Step 3: Register Native Tools

Update your code to use native tools:

**Before:**
```javascript
// Direct system call
exec('npm test', (error, stdout) => {
  // Handle result
});
```

**After:**
```javascript
import { bashTool } from '.claude/tools/native/bash-tool.mjs';

const result = await bashTool.execute({
  command: 'npm test',
  timeout: 30000
});
```

### Step 4: Enable Streaming

For long-running operations:

```javascript
import { createStreamingTool } from '.claude/tools/native/streaming-wrapper.mjs';

const streamingTool = createStreamingTool(bashTool);
for await (const event of streamingTool.execute({ command: 'npm test' })) {
  // Handle progress updates
}
```

### Step 5: Set Up Permissions

Update `config.yaml` to use permission system:

```yaml
tool_restrictions:
  developer:
    allowed_tools:
      - bash
      - text_editor
      - web_fetch
    restricted_tools:
      - docker
```

Then check permissions:

```javascript
import { checkPermission } from '.claude/agents/sdk/permissions.mjs';

const result = await checkPermission('developer', 'bash');
```

### Step 6: Enable Hooks

Register all hooks in Claude Code settings:

```json
{
  "hooks": {
    "PreToolUse": [".claude/hooks/security-pre-tool.sh"],
    "PostToolUse": [".claude/hooks/audit-post-tool.sh"],
    "UserPromptSubmit": [".claude/hooks/user-prompt-submit.sh"],
    "Notification": [".claude/hooks/notification.sh"],
    "Stop": [".claude/hooks/stop.sh"]
  }
}
```

### Step 7: Set Up Enterprise APIs

Configure API keys:

```bash
export ANTHROPIC_API_KEY=your-key-here
export EXA_API_KEY=your-exa-key  # For web search
export GOOGLE_SEARCH_API_KEY=your-google-key  # Optional
```

### Step 8: Update Skills

Skills automatically work with SDK, but you can enhance them:

```javascript
import { registerSkill } from '.claude/skills/sdk/skill-registry.mjs';

const skill = await registerSkill('rule-auditor');
// Skill is now registered and available
```

## Validation

After migration, validate your setup:

```bash
# Check native tools
node -e "import('.claude/tools/native/registry.mjs').then(r => console.log(r.getToolNames()))"

# Check agents
node -e "import('.claude/agents/sdk/subagent-manager.mjs').then(r => r.getAllAgents().then(console.log))"

# Check skills
node -e "import('.claude/skills/sdk/skill-registry.mjs').then(r => r.getAllSkills().then(console.log))"
```

## Rollback

If you need to rollback:

1. Remove SDK dependencies from `package.json`
2. Revert agent files to non-XML structure
3. Use direct system calls instead of native tools
4. Disable hooks in Claude Code settings

## Troubleshooting

### Tools Not Found

Ensure native tools are in `.claude/tools/native/` and registry is loaded.

### Permission Errors

Check `config.yaml` tool_restrictions section and permission system.

### Hook Errors

Verify hooks are executable: `chmod +x .claude/hooks/*.sh`

### API Errors

Ensure API keys are set in environment variables.

## Next Steps

- Review `SDK_INTEGRATION_GUIDE.md` for detailed usage
- Check `NATIVE_TOOLS_GUIDE.md` for tool-specific documentation
- See `STREAMING_GUIDE.md` for streaming patterns

