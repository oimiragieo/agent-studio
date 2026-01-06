# Stripe Billing Skill Implementation Task

## Objective
Implement a new Claude Code Skill called "stripe-billing" based on the Stripe Agent Toolkit.

## Source
https://github.com/stripe/agent-toolkit - Stripe's official agent toolkit for AI assistants

## Requirements

### 1. File Structure
Create `.claude/skills/stripe-billing/SKILL.md` following the skill template pattern from existing skills.

### 2. Progressive Disclosure Pattern
Show only relevant operations based on context (similar to github and cloud-run skills).

### 3. Operations to Include

**Customers**:
- create_customer
- update_customer
- list_customers
- retrieve_customer

**Subscriptions**:
- create_subscription
- cancel_subscription
- update_subscription
- list_subscriptions

**Invoices**:
- create_invoice
- finalize_invoice
- pay_invoice
- list_invoices

**Payments**:
- create_payment_intent
- confirm_payment_intent
- refund_payment
- list_payments

**Products/Prices**:
- create_product
- update_product
- list_products
- create_price
- update_price
- list_prices

### 4. Skill Structure Requirements

**SKILL.md Contents**:
- Frontmatter with name, description, allowed-tools
- Overview section with context savings statistics
- Requirements section (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET env vars)
- Toolsets/Operations section organized by category
- Quick Reference with example commands
- Configuration section with environment variables
- Security notes (mark all write operations as requiring confirmation)
- Error handling section
- Integration with agents section

### 5. Security Requirements
- Mark all write operations (create, update, delete, finalize, pay) as requiring confirmation
- Never log or expose API keys
- Document environment variable requirements clearly
- Include warning about test vs live mode keys

### 6. Context Savings Target
Achieve 90%+ context savings vs raw MCP server (similar to github skill: ~95% reduction)

### 7. Agent Mapping
This skill should be mapped to:
- **developer** (primary) - for payment integrations
- **analyst** (secondary) - for billing analytics
- **devops** (supporting) - for webhook configuration

### 8. Implementation Pattern
Follow the pattern established in:
- `.claude/skills/github/SKILL.md` for structure
- `.claude/skills/cloud-run/SKILL.md` for GCP-style authentication
- Use progressive disclosure (don't load all tools at once)

### 9. Deliverables
1. `.claude/skills/stripe-billing/SKILL.md` - Complete skill documentation
2. Update `.claude/docs/AGENT_SKILL_MATRIX.md` to include stripe-billing mapping
3. Document in implementation notes any deviations from existing patterns

## Success Criteria
- [ ] SKILL.md created with all required sections
- [ ] All operations documented with parameters
- [ ] Security requirements clearly documented
- [ ] Progressive disclosure pattern implemented
- [ ] Agent mapping documented
- [ ] Context savings target achieved (90%+)
- [ ] Follows existing skill patterns consistently
