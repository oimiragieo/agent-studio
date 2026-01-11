# Rate Plan

Evaluates plan quality using the response-rater skill (minimum score: 7/10).

## Usage

`/rate-plan [file]`

## Examples

- `/rate-plan` - Rate the most recent plan
- `/rate-plan plan-architecture.md` - Rate specific plan file

## What It Does

1. Reads the plan file
2. Evaluates against rubric:
   - Completeness (30%)
   - Feasibility (25%)
   - Risk Mitigation (20%)
   - Agent Coverage (15%)
   - Integration (10%)
3. Returns score (0-10) and detailed feedback
4. **Blocks execution if score < 7**

## Rubric Criteria

- **Completeness**: All requirements covered, no gaps
- **Feasibility**: Realistic scope, proper sequencing
- **Risk Mitigation**: Identified risks with mitigations
- **Agent Coverage**: Right agents for each task
- **Integration**: Clear handoffs between phases

## Minimum Passing Score

**7/10** - Plans scoring below 7 must be improved before execution

## Related Skills

- plan-generator - Generate comprehensive plans
- sequential-thinking - Break down complex problems
