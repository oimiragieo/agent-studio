#!/bin/bash
# Phase 3 & 4 Completion Verification Script

echo "========================================"
echo "  Phase 3 & 4 Verification"
echo "========================================"
echo ""

# Check if files exist
echo "1. Checking files created..."
files=(
  ".claude/conductor/feature-toggles.json"
  ".claude/tools/conductor-status.mjs"
  ".claude/tools/conductor-telemetry.mjs"
  ".claude/context/artifacts/dev-manifest-phase34-completion.json"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (MISSING)"
  fi
done
echo ""

# Check if master-orchestrator was updated
echo "2. Checking master-orchestrator.md updates..."
if grep -q "Track-Aware Workflow Routing" .claude/agents/master-orchestrator.md; then
  echo "  ✓ Track-aware routing section added"
else
  echo "  ✗ Track-aware routing section missing"
fi
echo ""

# Verify feature-toggles.json structure
echo "3. Verifying feature-toggles.json..."
if jq -e '.features.track_system' .claude/conductor/feature-toggles.json > /dev/null 2>&1; then
  echo "  ✓ track_system feature defined"
else
  echo "  ✗ track_system feature missing"
fi

if jq -e '.features.telemetry' .claude/conductor/feature-toggles.json > /dev/null 2>&1; then
  echo "  ✓ telemetry feature defined"
else
  echo "  ✗ telemetry feature missing"
fi
echo ""

# Test conductor-status tool (dry run)
echo "4. Testing conductor-status.mjs..."
if node .claude/tools/conductor-status.mjs --format json > /dev/null 2>&1; then
  echo "  ✓ conductor-status.mjs executes successfully"
else
  echo "  ✗ conductor-status.mjs failed"
fi
echo ""

# Test conductor-telemetry tool (status check)
echo "5. Testing conductor-telemetry.mjs..."
if node .claude/tools/conductor-telemetry.mjs status > /dev/null 2>&1; then
  echo "  ✓ conductor-telemetry.mjs executes successfully"
else
  echo "  ✗ conductor-telemetry.mjs failed"
fi
echo ""

echo "========================================"
echo "  Verification Complete"
echo "========================================"
