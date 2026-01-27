# Audit Report: {{Target}}

**Date**: {{date}}
**Auditor**: {{agent}}
**Scope**: {{scope}}

## Executive Summary

{{summary}}

## Methodology

{{methodology}}

## Findings

### Critical (P0)

{{#critical}}

- **{{id}}**: {{description}}
  - **Impact**: {{impact}}
  - **Remediation**: {{remediation}}
    {{/critical}}

### High (P1)

{{#high}}

- **{{id}}**: {{description}}
  {{/high}}

### Medium (P2)

{{#medium}}

- **{{id}}**: {{description}}
  {{/medium}}

## Recommendations

{{#recommendations}}

1. {{recommendation}}
   {{/recommendations}}

## Next Steps

{{next_steps}}
