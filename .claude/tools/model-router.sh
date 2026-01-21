#!/bin/bash
# Model Router - Intelligent multi-model CLI execution tool
# Routes tasks to optimal AI models and synthesizes results

set -e

# Configuration
CACHE_DIR="${HOME}/.claude/model-router-cache"
LOG_FILE="${HOME}/.claude/model-router.log"
TIMEOUT_SECONDS=300

# Create directories
mkdir -p "$CACHE_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Default values
MODEL=""
MODELS=""
PROMPT=""
STRATEGY="single"
OUTPUT_FORMAT="json"
VERBOSE=false
CACHE_ENABLED=true
BYPASS_PERMISSIONS=false

# Model CLI commands
# Updated Nov 2025: Opus 4.5, Sonnet 4.5, Gemini 3.0 Pro
# Note: cursor-agent requires WSL on Windows
declare -A MODEL_COMMANDS=(
    # Direct API models
    # NOTE: --permission-mode bypassPermissions removed for security
    # Use --bypass-permissions flag to enable (with warning)
    ["opus"]="claude -p \"\$PROMPT\" --model claude-opus-4-5-20251101 --output-format json"
    ["sonnet"]="claude -p \"\$PROMPT\" --model claude-sonnet-4-5 --output-format json"
    # Gemini - positional prompt (one-shot), -p is DEPRECATED
    ["gemini"]="gemini \"\$PROMPT\" --model gemini-3-pro-preview --output-format json"
    # Codex - use 'codex exec' for non-interactive, --json for structured output
    # Note: --full-auto sets reasoning to xhigh, mini model only supports low/medium/high
    # If global config has model_reasoning_effort=xhigh, override with -c flag for mini
    ["codex"]="codex exec \"\$PROMPT\" --model gpt-5.1-codex-max --full-auto --json"
    ["codex-mini"]="codex exec \"\$PROMPT\" --model gpt-5.1-codex-mini -c 'model_reasoning_effort=\"medium\"' --json"
    # Cursor Agent - requires WSL on Windows, use -p for prompt, --force for file writes
    ["cursor"]="wsl bash -lc \"cursor-agent -p --model sonnet-4.5 --output-format json '\$PROMPT'\""
    ["cursor-auto"]="wsl bash -lc \"cursor-agent -p --model auto --output-format json '\$PROMPT'\""
    ["cursor-opus"]="wsl bash -lc \"cursor-agent -p --model opus-4.5 --output-format json '\$PROMPT'\""
    ["cursor-thinking"]="wsl bash -lc \"cursor-agent -p --model opus-4.5-thinking --output-format json '\$PROMPT'\""
    ["cursor-sonnet-thinking"]="wsl bash -lc \"cursor-agent -p --model sonnet-4.5-thinking --output-format json '\$PROMPT'\""
    ["cursor-gpt5"]="wsl bash -lc \"cursor-agent -p --model gpt-5.1 --output-format json '\$PROMPT'\""
    ["cursor-gpt5-high"]="wsl bash -lc \"cursor-agent -p --model gpt-5.1-high --output-format json '\$PROMPT'\""
    ["cursor-codex"]="wsl bash -lc \"cursor-agent -p --model gpt-5.1-codex --output-format json '\$PROMPT'\""
    ["cursor-codex-high"]="wsl bash -lc \"cursor-agent -p --model gpt-5.1-codex-high --output-format json '\$PROMPT'\""
    ["cursor-gemini"]="wsl bash -lc \"cursor-agent -p --model gemini-3-pro --output-format json '\$PROMPT'\""
    ["cursor-grok"]="wsl bash -lc \"cursor-agent -p --model grok --output-format json '\$PROMPT'\""
    ["cursor-composer"]="wsl bash -lc \"cursor-agent -p --model composer-1 --output-format json '\$PROMPT'\""
)

# Model capabilities for auto-routing
declare -A MODEL_STRENGTHS=(
    # Direct API models
    ["opus"]="planning,architecture,reasoning,security,refactoring,debugging"
    ["sonnet"]="implementation,documentation,testing,quick-fixes"
    ["gemini"]="research,analysis,large-context,fact-finding,1M-context"
    # Codex variants (OpenAI)
    ["codex"]="ui-generation,scaffolding,prototypes,deep-reasoning"
    ["codex-mini"]="fast-prototypes,simple-tasks,cost-effective"
    # Cursor Agent variants (via Cursor subscription) - requires WSL on Windows
    ["cursor"]="detailed-implementation,ui,frontend,iteration,diff-application"
    ["cursor-auto"]="auto-selection,free-tier,balanced"
    ["cursor-opus"]="planning,architecture,complex-tasks"
    ["cursor-thinking"]="extended-reasoning,deep-analysis,complex-problems"
    ["cursor-sonnet-thinking"]="balanced-reasoning,analysis"
    ["cursor-gpt5"]="reasoning,coding,flagship"
    ["cursor-gpt5-high"]="extended-reasoning,complex-coding"
    ["cursor-codex"]="code-generation,implementation"
    ["cursor-codex-high"]="code-generation,extended-reasoning"
    ["cursor-gemini"]="research,large-context,analysis"
    ["cursor-grok"]="fast-responses,coding"
    ["cursor-composer"]="cursor-native,fast,proprietary"
)

# Usage
usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Intelligent multi-model CLI router for AI tasks.

OPTIONS:
    -m, --model MODEL           Single model to use (opus|sonnet|gemini|cursor|codex|aider)
    -M, --models MODELS         Comma-separated models for multi-model execution
    -p, --prompt PROMPT         The prompt/task to execute
    -s, --strategy STRATEGY     Execution strategy (single|sequential|parallel|synthesis)
    -o, --output-format FORMAT  Output format (json|text) [default: json]
    -t, --task-type TYPE        Task type for auto-routing (planning|research|implementation|review|debug)
    -v, --verbose               Enable verbose logging
    --no-cache                  Disable response caching
    --bypass-permissions        DANGEROUS: Disable Claude security hooks (use with caution!)
    -h, --help                  Show this help message

EXAMPLES:
    # Single model execution
    $(basename "$0") -m gemini -p "Research authentication patterns"

    # Multi-model synthesis
    $(basename "$0") -M "opus,gemini" -s synthesis -p "Design auth system"

    # Auto-route based on task type
    $(basename "$0") -t planning -p "Design microservice architecture"

    # Sequential execution
    $(basename "$0") -M "gemini,opus,cursor" -s sequential -p "Build login component"

MODELS:
    Direct API Models:
    opus           - Claude Opus 4.5: Complex reasoning, planning, security
    sonnet         - Claude Sonnet 4.5: Fast daily driver, TDD, UI iterations
    gemini         - Gemini 3 Pro Preview: 1M context, research, analysis
                     CLI: gemini "query" --model gemini-3-pro-preview -o json
    codex          - GPT-5.1 Codex Max: UI generation, deep reasoning
    codex-mini     - GPT-5.1 Codex Mini: Fast prototypes, cost-effective
                     CLI: codex exec "query" --model MODEL --full-auto --json

    Cursor Agent Models (via Cursor subscription - WSL required on Windows):
    CLI: wsl bash -lc "cursor-agent -p --model MODEL --output-format json 'prompt'"
    cursor              - Sonnet 4.5: Detailed implementation, UI
    cursor-auto         - Auto: Free tier, auto-selects best model
    cursor-opus         - Opus 4.5: Complex tasks, planning
    cursor-thinking     - Opus 4.5 Thinking: Extended reasoning mode
    cursor-sonnet-thinking - Sonnet 4.5 Thinking: Balanced reasoning
    cursor-gpt5         - GPT-5.1: Flagship reasoning
    cursor-gpt5-high    - GPT-5.1 High: Extended reasoning
    cursor-codex        - GPT-5.1 Codex: Code generation
    cursor-codex-high   - GPT-5.1 Codex High: Code gen + extended reasoning
    cursor-gemini       - Gemini 3 Pro: Large context research
    cursor-grok         - Grok: Fast xAI model
    cursor-composer     - Composer 1: Cursor's proprietary model

STRATEGIES:
    single     - Execute with one model
    sequential - Run models in sequence, building on each output
    parallel   - Run models simultaneously (requires parallel command)
    synthesis  - Get multiple perspectives, synthesize into one answer

EOF
    exit 0
}

# Logging
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    if [ "$VERBOSE" = true ]; then
        echo "[$level] $message" >&2
    fi
}

# Auto-route based on task type
auto_route() {
    local task_type="$1"
    case "$task_type" in
        planning|architecture)
            echo "opus"
            ;;
        research|analysis|large-context)
            echo "gemini"
            ;;
        implementation|coding)
            echo "cursor"
            ;;
        ui|frontend)
            echo "cursor"
            ;;
        review|security)
            echo "opus"
            ;;
        debug|debugging)
            echo "opus"
            ;;
        documentation|docs)
            echo "sonnet"
            ;;
        testing|tests)
            echo "sonnet"
            ;;
        quick-fix|hotfix)
            echo "sonnet"
            ;;
        *)
            echo "sonnet"  # Default fallback
            ;;
    esac
}

# Generate cache key
cache_key() {
    echo "$1" | md5sum | cut -d' ' -f1
}

# Check cache
check_cache() {
    local key=$(cache_key "$MODEL:$PROMPT")
    local cache_file="$CACHE_DIR/$key.json"
    if [ "$CACHE_ENABLED" = true ] && [ -f "$cache_file" ]; then
        # Cache valid for 1 hour
        local cache_age=$(($(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || stat -f %m "$cache_file" 2>/dev/null)))
        if [ "$cache_age" -lt 3600 ]; then
            log "INFO" "Cache hit for $MODEL"
            cat "$cache_file"
            return 0
        fi
    fi
    return 1
}

# Save to cache
save_cache() {
    local key=$(cache_key "$MODEL:$PROMPT")
    local cache_file="$CACHE_DIR/$key.json"
    echo "$1" > "$cache_file"
}

# Execute single model
execute_model() {
    local model="$1"
    local prompt="$2"
    local start_time=$(date +%s%3N)

    log "INFO" "Executing model: $model"

    # Get command template
    local cmd_template="${MODEL_COMMANDS[$model]}"
    if [ -z "$cmd_template" ]; then
        log "ERROR" "Unknown model: $model"
        echo "{\"error\": \"Unknown model: $model\", \"success\": false}"
        return 1
    fi

    # SECURITY FIX: Safely escape prompt to prevent command injection
    # Previously used: local cmd=$(eval echo "$cmd_template") - VULNERABLE to injection!
    # Now using safe string substitution with properly escaped prompt
    local escaped_prompt
    # Use printf %q to safely escape all shell metacharacters
    printf -v escaped_prompt '%q' "$prompt"
    # Replace the $PROMPT placeholder with escaped prompt (handles literal $PROMPT string)
    local cmd="${cmd_template//\$PROMPT/$escaped_prompt}"

    # Apply bypass-permissions flag for Claude models if requested
    if [ "$BYPASS_PERMISSIONS" = true ]; then
        case "$model" in
            opus|sonnet)
                cmd="$cmd --permission-mode bypassPermissions"
                log "WARN" "Applying bypassPermissions to $model (security hooks disabled)"
                ;;
        esac
    fi

    log "DEBUG" "Command: $cmd"

    # Execute with timeout
    local response
    if response=$(timeout "$TIMEOUT_SECONDS" bash -c "$cmd" 2>&1); then
        local end_time=$(date +%s%3N)
        local duration=$((end_time - start_time))

        log "INFO" "Model $model completed in ${duration}ms"

        # Return structured response
        jq -n \
            --arg model "$model" \
            --arg response "$response" \
            --argjson duration "$duration" \
            --argjson success true \
            '{
                model: $model,
                response: $response,
                execution_time_ms: $duration,
                success: $success
            }'
    else
        local exit_code=$?
        log "ERROR" "Model $model failed with exit code $exit_code"

        jq -n \
            --arg model "$model" \
            --arg error "$response" \
            --argjson exit_code "$exit_code" \
            --argjson success false \
            '{
                model: $model,
                error: $error,
                exit_code: $exit_code,
                success: $success
            }'
        return 1
    fi
}

# Sequential execution
execute_sequential() {
    local models_array=($1)
    local prompt="$2"
    local results=()
    local accumulated_context=""

    log "INFO" "Starting sequential execution with models: ${models_array[*]}"

    for model in "${models_array[@]}"; do
        # Build prompt with accumulated context
        local enhanced_prompt="$prompt"
        if [ -n "$accumulated_context" ]; then
            enhanced_prompt="Previous context:\n$accumulated_context\n\nTask: $prompt"
        fi

        local result=$(execute_model "$model" "$enhanced_prompt")
        results+=("$result")

        # Extract response for next model
        local model_response=$(echo "$result" | jq -r '.response // empty')
        if [ -n "$model_response" ]; then
            accumulated_context="$accumulated_context\n[$model response]: $model_response"
        fi
    done

    # Combine results
    printf '%s\n' "${results[@]}" | jq -s '{
        strategy: "sequential",
        model_responses: .,
        final_context: "'"$(echo -e "$accumulated_context")"'"
    }'
}

# Parallel execution
execute_parallel() {
    local models_array=($1)
    local prompt="$2"
    local temp_dir=$(mktemp -d)
    local pids=()

    log "INFO" "Starting parallel execution with models: ${models_array[*]}"

    # Launch all models in parallel
    for model in "${models_array[@]}"; do
        (
            execute_model "$model" "$prompt" > "$temp_dir/$model.json"
        ) &
        pids+=($!)
    done

    # Wait for all to complete
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done

    # Combine results
    local results=()
    for model in "${models_array[@]}"; do
        if [ -f "$temp_dir/$model.json" ]; then
            results+=("$(cat "$temp_dir/$model.json")")
        fi
    done

    # Cleanup
    rm -rf "$temp_dir"

    printf '%s\n' "${results[@]}" | jq -s '{
        strategy: "parallel",
        model_responses: .
    }'
}

# Synthesis execution - get multiple perspectives and combine
execute_synthesis() {
    local models_array=($1)
    local prompt="$2"

    log "INFO" "Starting synthesis execution with models: ${models_array[*]}"

    # First, get all responses in parallel
    local parallel_results=$(execute_parallel "$1" "$2")

    # Then, use Claude Opus to synthesize
    local synthesis_prompt="You are synthesizing responses from multiple AI models.

Original task: $prompt

Model responses:
$(echo "$parallel_results" | jq -r '.model_responses[] | "[\(.model)]: \(.response)"')

Please synthesize these perspectives into a unified, actionable response that:
1. Identifies the best insights from each model
2. Resolves any conflicts or contradictions
3. Provides a clear recommendation
4. Notes confidence level and any uncertainties

Output format:
{
    \"synthesis\": \"combined answer\",
    \"key_insights\": [\"insight1\", \"insight2\"],
    \"conflicts_resolved\": [\"any conflicts and how resolved\"],
    \"confidence\": \"high|medium|low\",
    \"recommended_actions\": [\"action1\", \"action2\"]
}"

    local synthesis=$(execute_model "opus" "$synthesis_prompt")

    # Combine everything
    echo "$parallel_results" | jq --argjson synthesis "$synthesis" '{
        strategy: "synthesis",
        model_responses: .model_responses,
        synthesis: $synthesis
    }'
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--model)
            MODEL="$2"
            shift 2
            ;;
        -M|--models)
            MODELS="$2"
            shift 2
            ;;
        -p|--prompt)
            PROMPT="$2"
            shift 2
            ;;
        -s|--strategy)
            STRATEGY="$2"
            shift 2
            ;;
        -o|--output-format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -t|--task-type)
            MODEL=$(auto_route "$2")
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --no-cache)
            CACHE_ENABLED=false
            shift
            ;;
        --bypass-permissions)
            BYPASS_PERMISSIONS=true
            echo "WARNING: Security hooks disabled via --bypass-permissions flag" >&2
            echo "WARNING: This bypasses all Claude safety mechanisms. Use with caution!" >&2
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Validate inputs
if [ -z "$PROMPT" ]; then
    echo "Error: Prompt is required" >&2
    exit 1
fi

if [ -z "$MODEL" ] && [ -z "$MODELS" ]; then
    echo "Error: Either --model or --models is required" >&2
    exit 1
fi

# Execute based on strategy
log "INFO" "Starting model-router with strategy: $STRATEGY"

case "$STRATEGY" in
    single)
        if [ -n "$MODEL" ]; then
            # Check cache first
            if check_cache; then
                exit 0
            fi
            result=$(execute_model "$MODEL" "$PROMPT")
            if [ "$CACHE_ENABLED" = true ]; then
                save_cache "$result"
            fi
            echo "$result"
        else
            echo "Error: Single strategy requires --model" >&2
            exit 1
        fi
        ;;
    sequential)
        if [ -n "$MODELS" ]; then
            IFS=',' read -ra models_array <<< "$MODELS"
            execute_sequential "${models_array[*]}" "$PROMPT"
        else
            echo "Error: Sequential strategy requires --models" >&2
            exit 1
        fi
        ;;
    parallel)
        if [ -n "$MODELS" ]; then
            IFS=',' read -ra models_array <<< "$MODELS"
            execute_parallel "${models_array[*]}" "$PROMPT"
        else
            echo "Error: Parallel strategy requires --models" >&2
            exit 1
        fi
        ;;
    synthesis)
        if [ -n "$MODELS" ]; then
            IFS=',' read -ra models_array <<< "$MODELS"
            execute_synthesis "${models_array[*]}" "$PROMPT"
        else
            echo "Error: Synthesis strategy requires --models" >&2
            exit 1
        fi
        ;;
    *)
        echo "Error: Unknown strategy: $STRATEGY" >&2
        exit 1
        ;;
esac

log "INFO" "Model-router completed"
