# {{Plan Title}}

**Date**: {{date}}
**Status**: PENDING_APPROVAL | IN_PROGRESS | COMPLETE
**Author**: {{agent}}

## Executive Summary
{{summary}}

## Phases
{{#phases}}
### Phase {{number}}: {{title}}
**Duration**: {{duration}}
**Dependencies**: {{dependencies}}

#### Tasks
{{#tasks}}
- [ ] {{task}}
{{/tasks}}
{{/phases}}

## Dependencies
{{dependencies_diagram}}

## Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
{{#risks}}
| {{risk}} | {{likelihood}} | {{impact}} | {{mitigation}} |
{{/risks}}

## Success Criteria
{{#criteria}}
- [ ] {{criterion}}
{{/criteria}}
