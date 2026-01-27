#!/usr/bin/env bash
#
# find-polluter.sh - Test Pollution Bisector
#
# PURPOSE:
# Identifies which test creates unwanted files, directories, or side effects.
# Uses binary search approach to efficiently find the polluting test among
# a large test suite.
#
# WHEN TO USE:
# - Tests pass individually but fail when run together
# - Mysterious files appear after running tests
# - Test isolation issues cause flaky tests
# - Debugging shared state pollution
#
# USAGE:
#   ./find-polluter.sh <file_or_dir_to_check> <test_pattern>
#
# EXAMPLES:
#   # Find which test creates a .git directory
#   ./find-polluter.sh '.git' 'src/**/*.test.ts'
#
#   # Find which test leaves behind temp files
#   ./find-polluter.sh 'temp.json' 'tests/*.spec.js'
#
#   # Find which test creates a coverage directory
#   ./find-polluter.sh 'coverage/' '**/*.test.py'
#
# HOW IT WORKS:
# 1. Lists all test files matching the pattern
# 2. Runs each test sequentially
# 3. Checks if the pollution target exists after each test
# 4. Reports the first test that creates the pollution
#
# REQUIREMENTS:
# - npm test must accept a file path argument
# - Tests must be runnable individually
# - Pollution must be consistently reproducible
#
# INTEGRATION WITH DEBUGGING SKILL:
# This tool supports the systematic-debugging skill's Phase 1
# (Root Cause Investigation). Use it when you observe test pollution
# but don't know which test causes it.
#
# Adapted from Superpowers for the agent-studio framework.
#

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 <file_to_check> <test_pattern>"
  echo ""
  echo "Find which test creates unwanted files or side effects."
  echo ""
  echo "Examples:"
  echo "  $0 '.git' 'src/**/*.test.ts'"
  echo "  $0 'temp.json' 'tests/*.spec.js'"
  echo "  $0 'coverage/' '**/*.test.py'"
  exit 1
fi

POLLUTION_CHECK="$1"
TEST_PATTERN="$2"

echo "========================================"
echo "  Test Pollution Bisector"
echo "========================================"
echo ""
echo "Searching for test that creates: $POLLUTION_CHECK"
echo "Test pattern: $TEST_PATTERN"
echo ""

# Get list of test files
TEST_FILES=$(find . -path "$TEST_PATTERN" 2>/dev/null | sort)

if [ -z "$TEST_FILES" ]; then
  echo "ERROR: No test files found matching pattern: $TEST_PATTERN"
  echo ""
  echo "Try a different pattern. Examples:"
  echo "  'src/**/*.test.ts'    - TypeScript tests"
  echo "  'tests/**/*.spec.js'  - JavaScript specs"
  echo "  '**/test_*.py'        - Python tests"
  exit 1
fi

TOTAL=$(echo "$TEST_FILES" | wc -l | tr -d ' ')
echo "Found $TOTAL test files"
echo ""

# Check if pollution already exists
if [ -e "$POLLUTION_CHECK" ]; then
  echo "WARNING: Pollution already exists before starting!"
  echo "  File/Dir: $POLLUTION_CHECK"
  echo ""
  echo "Please remove it first:"
  echo "  rm -rf '$POLLUTION_CHECK'"
  echo ""
  echo "Then run this script again."
  exit 1
fi

echo "Starting bisection..."
echo "----------------------------------------"

COUNT=0
for TEST_FILE in $TEST_FILES; do
  COUNT=$((COUNT + 1))

  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # Run the test (suppress output, allow failures)
  npm test "$TEST_FILE" > /dev/null 2>&1 || true

  # Check if pollution appeared
  if [ -e "$POLLUTION_CHECK" ]; then
    echo ""
    echo "========================================"
    echo "  POLLUTER FOUND!"
    echo "========================================"
    echo ""
    echo "Test file: $TEST_FILE"
    echo "Created:   $POLLUTION_CHECK"
    echo ""
    echo "Pollution details:"
    ls -la "$POLLUTION_CHECK" 2>/dev/null || echo "  (directory)"
    echo ""
    echo "Next steps:"
    echo "  1. Review the test: cat $TEST_FILE"
    echo "  2. Run in isolation: npm test $TEST_FILE"
    echo "  3. Check for cleanup: Look for afterEach/afterAll"
    echo "  4. Add cleanup if missing"
    echo ""
    exit 1
  fi
done

echo ""
echo "========================================"
echo "  No polluter found"
echo "========================================"
echo ""
echo "All $TOTAL tests ran without creating: $POLLUTION_CHECK"
echo ""
echo "Possible explanations:"
echo "  1. Pollution requires multiple tests to trigger"
echo "  2. Test pattern missed the polluting test"
echo "  3. Pollution only happens in certain orders"
echo ""
echo "Try running all tests together and checking after:"
echo "  npm test && ls -la '$POLLUTION_CHECK'"
exit 0
