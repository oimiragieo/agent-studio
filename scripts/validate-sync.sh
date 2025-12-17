#!/bin/bash
# validate-sync.sh - Validates cross-platform sync and configuration integrity
# Run: bash scripts/validate-sync.sh

set -e

echo "=========================================="
echo "Agent Studio Configuration Validation"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((ERRORS++))
}

warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

info() {
    echo "[INFO] $1"
}

# ====================
# 1. Count Agents
# ====================
echo "1. Validating Agent Counts"
echo "-------------------------------------------"

CLAUDE_AGENTS=$(find .claude/agents -name "*.md" 2>/dev/null | wc -l)
CURSOR_AGENTS=$(find .cursor/subagents -name "*.mdc" 2>/dev/null | wc -l)
FACTORY_AGENTS=$(find .factory/droids -name "*.md" 2>/dev/null | wc -l)

info "Claude agents: $CLAUDE_AGENTS"
info "Cursor subagents: $CURSOR_AGENTS"
info "Factory droids: $FACTORY_AGENTS"

if [ "$CLAUDE_AGENTS" -eq "$CURSOR_AGENTS" ] && [ "$CLAUDE_AGENTS" -eq "$FACTORY_AGENTS" ]; then
    success "Agent counts match across all platforms"
else
    warning "Agent counts differ: Claude=$CLAUDE_AGENTS, Cursor=$CURSOR_AGENTS, Factory=$FACTORY_AGENTS"
fi

# ====================
# 2. Cross-Platform Agent Sync
# ====================
echo ""
echo "2. Validating Cross-Platform Agent Sync"
echo "-------------------------------------------"

# Get Claude agent names
for claude_agent in .claude/agents/*.md; do
    agent_name=$(basename "$claude_agent" .md)

    # Check Cursor
    cursor_file=".cursor/subagents/${agent_name}.mdc"
    if [ -f "$cursor_file" ]; then
        success "Agent '$agent_name' exists in Cursor"
    else
        warning "Agent '$agent_name' missing in Cursor (.cursor/subagents/${agent_name}.mdc)"
    fi

    # Check Factory
    factory_file=".factory/droids/${agent_name}.md"
    if [ -f "$factory_file" ]; then
        success "Agent '$agent_name' exists in Factory"
    else
        warning "Agent '$agent_name' missing in Factory (.factory/droids/${agent_name}.md)"
    fi
done

# ====================
# 3. Validate Workflows
# ====================
echo ""
echo "3. Validating Workflow Definitions"
echo "-------------------------------------------"

WORKFLOWS=$(find .claude/workflows -name "*.yaml" 2>/dev/null | wc -l)
info "Found $WORKFLOWS workflow definitions"

for workflow in .claude/workflows/*.yaml; do
    workflow_name=$(basename "$workflow")

    # Check YAML syntax (if yq is available)
    if command -v yq &> /dev/null; then
        if yq eval '.' "$workflow" > /dev/null 2>&1; then
            success "Workflow '$workflow_name' has valid YAML syntax"
        else
            error "Workflow '$workflow_name' has invalid YAML syntax"
        fi
    else
        info "Skipping YAML validation (yq not installed) for $workflow_name"
    fi

    # Check for referenced agents
    if grep -q "agent:" "$workflow" 2>/dev/null; then
        agents_in_workflow=$(grep "agent:" "$workflow" | sed 's/.*agent: *//' | sort -u)
        for agent in $agents_in_workflow; do
            agent_file=".claude/agents/${agent}.md"
            if [ -f "$agent_file" ]; then
                success "Workflow '$workflow_name' references existing agent '$agent'"
            else
                error "Workflow '$workflow_name' references non-existent agent '$agent'"
            fi
        done
    fi
done

# ====================
# 4. Security Validation
# ====================
echo ""
echo "4. Security Pattern Validation"
echo "-------------------------------------------"

# Check for bypassPermissions in model commands
if grep -rn "bypassPermissions" .claude/tools/ 2>/dev/null | grep -v "#" | grep -v "//"; then
    warning "Found 'bypassPermissions' in tools (should be opt-in only)"
fi

# Check security hook exists
if [ -f ".claude/hooks/security-pre-tool.sh" ]; then
    success "Security pre-tool hook exists"

    # Check for key patterns
    required_patterns=("rm -rf" "sudo" "python -c" "DROP DATABASE" "powershell -enc")
    for pattern in "${required_patterns[@]}"; do
        if grep -q "$pattern" .claude/hooks/security-pre-tool.sh 2>/dev/null; then
            success "Security hook blocks '$pattern'"
        else
            warning "Security hook missing pattern: '$pattern'"
        fi
    done
else
    error "Security pre-tool hook missing (.claude/hooks/security-pre-tool.sh)"
fi

# Check for eval in shell scripts (potential injection)
eval_usage=$(grep -rn "eval " .claude/tools/*.sh 2>/dev/null | grep -v "#" | head -5)
if [ -n "$eval_usage" ]; then
    warning "Found 'eval' usage in shell scripts (potential security risk):"
    echo "$eval_usage"
fi

# ====================
# 5. Documentation Consistency
# ====================
echo ""
echo "5. Documentation Consistency"
echo "-------------------------------------------"

# Check README.md agent count
if [ -f "README.md" ]; then
    readme_count=$(grep -oE "[0-9]+ (specialized )?agents" README.md | head -1 | grep -oE "[0-9]+")
    if [ -n "$readme_count" ]; then
        if [ "$readme_count" -eq "$CLAUDE_AGENTS" ]; then
            success "README.md agent count ($readme_count) matches actual count ($CLAUDE_AGENTS)"
        else
            warning "README.md claims $readme_count agents but found $CLAUDE_AGENTS"
        fi
    fi
fi

# Check CLAUDE.md exists
if [ -f "CLAUDE.md" ]; then
    success "Root CLAUDE.md exists"
else
    error "Root CLAUDE.md missing (required for Claude Code)"
fi

# Check GETTING_STARTED.md
if [ -f "GETTING_STARTED.md" ]; then
    success "GETTING_STARTED.md quick start guide exists"
else
    warning "GETTING_STARTED.md missing (recommended for onboarding)"
fi

# ====================
# 6. Required Files Check
# ====================
echo ""
echo "6. Required Files Check"
echo "-------------------------------------------"

required_files=(
    ".claude/config.yaml"
    ".claude/settings.json"
    ".claude/CLAUDE.md"
    "CLAUDE.md"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        success "Required file exists: $file"
    else
        error "Required file missing: $file"
    fi
done

# ====================
# Summary
# ====================
echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}$WARNINGS warning(s), 0 errors${NC}"
    exit 0
else
    echo -e "${RED}$ERRORS error(s), $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix the errors above before deploying."
    exit 1
fi
