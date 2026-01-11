<command_description>
Command: /ui-perfection - Launch the UI Perfection Loop workflow for iterative UI quality improvement.
</command_description>

<instructions>
<execution_steps>

```
/ui-perfection                                    # Start UI perfection workflow
/ui-perfection --component UserProfile.tsx        # Target specific component
/ui-perfection --score 98                        # Set custom target score (default: 95)
/ui-perfection --glassmorphism                   # Enable glassmorphism enforcement
/ui-perfection --images ref1.png ref2.png        # Provide reference images
/ui-perfection --max-iterations 3                 # Set max iterations (default: 5)
```

</execution_steps>

<usage_example>
**Usage**:

- `--component` or `-c`: Path to component or page to optimize (required)
- `--score` or `-s`: Minimum score threshold (default: 95, range: 0-100)
- `--glassmorphism` or `-g`: Boolean flag to enforce glassmorphism design
- `--images` or `-i`: Space-separated list of reference image paths (optional)
- `--max-iterations` or `-m`: Maximum number of iterations (default: 5, max: 10)

## What This Command Does

Invokes the **ui-perfection-loop** workflow with this 4-phase iterative cycle:

### Phase 1: Capture & Audit (Parallel)

1. **UX Expert** - Visual hierarchy, consistency, enterprise polish
   - Visual hierarchy evaluation
   - Design consistency review
   - Enterprise polish assessment
   - Glassmorphism compliance (if enabled)
   - Design system alignment
   - User experience flow analysis

2. **Accessibility Expert** - WCAG compliance and accessibility
   - Color contrast analysis
   - Keyboard navigation assessment
   - Screen reader compatibility
   - ARIA attribute validation
   - Focus management review
   - Semantic HTML structure

### Phase 2: Grading & Validation

3. **Model Orchestrator** - Score calculation and Gemini validation
   - Calculate visual hierarchy score (0-100)
   - Calculate consistency score (0-100)
   - Calculate accessibility score (0-100)
   - Calculate enterprise polish score (0-100)
   - Route to Gemini for external validation
   - Apply consensus rule (if Gemini score >10 points lower, use Gemini score)
   - Calculate total weighted score
   - Generate penalty and recommendation lists

### Phase 3: Execution

4. **Developer** - Implementation of UI improvements
   - Apply visual hierarchy fixes
   - Implement consistency improvements
   - Apply enterprise polish enhancements
   - Fix accessibility issues
   - Implement glassmorphism (if required)
   - Update component styling

5. **Mobile Developer** - Mobile-specific optimizations (if needed)
   - Responsive design fixes
   - Touch target optimization
   - Mobile layout improvements
   - Performance optimization for mobile

### Phase 4: Verification

6. **QA** - Quality verification with anti-hallucination protocol
   - Visual regression testing
   - Accessibility re-audit
   - Cross-browser testing
   - Responsive design validation
   - Performance metrics check
   - Screenshot comparison (if reference images provided)
   - Calculate final score

### Iteration Decision

7. **Orchestrator** - Determine if another iteration is needed
   - Check if final_score >= target_score
   - Check if iteration_count < max_iterations
   - If both conditions met for continuation, return to Phase 1
   - If score threshold met or max iterations reached, complete workflow

## Iteration Behavior

The workflow iterates until:

- **Score threshold met**: Final score >= target_score (default: 95)
- **Max iterations reached**: Reaches max_iterations limit (default: 5)

Each iteration:

- Preserves context from previous iterations
- Compares new scores against previous scores
- Focuses on remaining improvement areas
- Generates iteration-specific reports

## Outputs

All outputs stored in `.claude/context/ui-perfection/{{workflow_id}}/`:

- `ui-audit-report.json` - Phase 1 analysis results (UX + Accessibility)
- `grading-score.json` - Phase 2 scoring with Gemini validation
- `implementation-manifest.json` - Phase 3 code changes
- `verification-report.json` - Phase 4 QA results
- `final-score.json` - Final iteration score
- `iteration-summary.json` - Summary of all iterations

**Subdirectories:**

- `screenshots/` - Before/after comparison screenshots
- `reports/` - Detailed audit and verification reports
- `tests/` - Generated Playwright tests (if applicable)

## When to Use

- UI components need visual refinement
- Achieving enterprise-level polish
- Accessibility compliance improvements
- Design consistency issues
- Visual hierarchy optimization
- Glassmorphism implementation
- Mobile responsiveness fixes
- Cross-browser compatibility issues

## Example Workflows

### Basic UI Polish

```
/ui-perfection --component app/components/Dashboard.tsx
```

### Glassmorphism Implementation

```
/ui-perfection --component app/components/Card.tsx --glassmorphism
```

### High-Quality Target with References

```
/ui-perfection --component app/pages/Profile.tsx --score 98 --images designs/ref-1.png designs/ref-2.png
```

### Quick Iteration (Limited)

```
/ui-perfection --component app/components/Button.tsx --max-iterations 3
```

## Integration

### Mobile Workflow

If mobile-specific issues are detected, the workflow can trigger the mobile-flow sub-workflow automatically.

### Accessibility Workflow

Leverages accessibility-expert's existing WCAG validation and Playwright accessibility testing patterns.

## Tool Integration

See `.claude/docs/UI_PERFECTION_TOOLS.md` for detailed information about:

- Screenshot capture and image analysis
- Gemini validation via model-orchestrator
- Search tools for design patterns
- Visual testing with Playwright
- File operations and context management

## Scoring Framework

**Score Components:**

- Visual Hierarchy (weighted)
- Consistency (weighted)
- Accessibility (weighted)
- Enterprise Polish (weighted)

**Consensus Rule:**

- If Gemini validation score >10 points lower than internal score, use Gemini score
- Ensures external validation prevents over-optimistic scoring

**Penalties:**

- Applied for specific issues (visual hierarchy, consistency, accessibility, etc.)
- Severity levels: low, medium, high, critical

</workflow_description>

<output_format>
**Outputs**:

All outputs stored in `.claude/context/ui-perfection/{{workflow_id}}/`:

- `ui-audit-report.json` - Phase 1 analysis results (UX + Accessibility)
- `grading-score.json` - Phase 2 scoring with Gemini validation
- `implementation-manifest.json` - Phase 3 code changes
- `verification-report.json` - Phase 4 QA results
- `final-score.json` - Final iteration score
- `iteration-summary.json` - Summary of all iterations
  </output_format>
  </instructions>

<examples>
<usage_example>
**Example Workflows**:

- `/mobile` - Mobile-specific development workflow
- `/code-quality` - Code quality and refactoring
- `/performance` - Performance optimization
- `.claude/workflows/ui-perfection-loop.yaml` - Workflow definition
- `.claude/schemas/ui-audit-report.schema.json` - Output schema
- `.claude/docs/UI_PERFECTION_TOOLS.md` - Tool integration guide
