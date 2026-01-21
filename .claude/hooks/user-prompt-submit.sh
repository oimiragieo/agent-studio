#!/bin/bash
# User Prompt Submit Hook
# Validates user prompts before submission to detect jailbreak attempts and sanitize inputs

# Read JSON input from stdin
INPUT=$(cat)

# Extract prompt
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')

if [ -z "$PROMPT" ]; then
    echo '{"decision": "approve"}'
    exit 0
fi

# Jailbreak detection patterns
JAILBREAK_PATTERNS=(
    "ignore previous instructions"
    "forget all rules"
    "act as if"
    "pretend you are"
    "system override"
    "bypass safety"
    "ignore safety guidelines"
    "you are now"
    "from now on"
    "new instructions"
    "override system"
    "disregard"
    "ignore the above"
    "forget everything"
)

# Check for jailbreak patterns
for pattern in "${JAILBREAK_PATTERNS[@]}"; do
    if echo "$PROMPT" | grep -qiE "$pattern"; then
        echo "{\"decision\": \"block\", \"reason\": \"Jailbreak attempt detected: $pattern\"}"
        exit 0
    fi
done

# Check for suspicious keywords
SUSPICIOUS_KEYWORDS=(
    "bypass"
    "override"
    "ignore"
    "forget"
    "pretend"
    "hack"
    "exploit"
    "vulnerability"
)

# Count suspicious keywords (allow if only 1-2, block if many)
SUSPICIOUS_COUNT=0
for keyword in "${SUSPICIOUS_KEYWORDS[@]}"; do
    if echo "$PROMPT" | grep -qiE "\\b$keyword\\b"; then
        SUSPICIOUS_COUNT=$((SUSPICIOUS_COUNT + 1))
    fi
done

if [ "$SUSPICIOUS_COUNT" -gt 3 ]; then
    echo "{\"decision\": \"block\", \"reason\": \"Too many suspicious keywords detected ($SUSPICIOUS_COUNT)\"}"
    exit 0
fi

# Check prompt length (block extremely long prompts that might be injection attempts)
PROMPT_LENGTH=${#PROMPT}
if [ "$PROMPT_LENGTH" -gt 50000 ]; then
    echo "{\"decision\": \"block\", \"reason\": \"Prompt too long (potential injection attempt)\"}"
    exit 0
fi

# Allow by default
echo '{"decision": "approve"}'

