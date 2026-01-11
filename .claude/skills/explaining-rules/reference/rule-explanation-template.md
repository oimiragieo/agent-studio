# Rule Explanation Template

Standard format for explaining rules to users.

## Template Structure

```markdown
## Rules Applicable to [target]

**Technologies Detected**: [technology1, technology2, ...]
**Analysis Date**: [timestamp]

### Master Rules (Always Active)

#### [Rule Name]

**Path**: `.claude/rules-master/[filename].md`
**Applies because**: [specific reason related to target]
**Priority**: [high/medium/low]

**Key Requirements**:

- [Requirement 1 with brief explanation]
- [Requirement 2 with brief explanation]
- [Requirement 3 with brief explanation]

**Example**:
\`\`\`[language]
[Code example showing compliance]
\`\`\`

**Why This Matters**:
[Brief explanation of why this rule improves code quality/maintainability]

---

### Archive Rules (On-Demand)

#### [Rule Name]

**Path**: `.claude/archive/[path].md`
**When to use**: [specific context]
**Relevance**: [why it applies to this target]

**Key Points**:

- [Point 1]
- [Point 2]

**Example**:
\`\`\`[language]
[Code example]
\`\`\`

---
```

## Explanation Guidelines

### Be Specific

- Don't just list rules; explain why they apply
- Connect rules to the specific file/query
- Show concrete examples

### Prioritize

- Master rules first (always active)
- Archive rules second (context-specific)
- Most relevant rules first

### Use Examples

- Extract code examples from rule files
- Show both compliant and non-compliant code
- Make examples relevant to the target

### Explain Impact

- Why following the rule matters
- What happens if rule is violated
- How rule improves code quality

## Example Output

```markdown
## Rules Applicable to src/components/UserAuth.tsx

**Technologies Detected**: nextjs, react, typescript
**Analysis Date**: 2025-01-XX

### Master Rules (Always Active)

#### TECH_STACK_NEXTJS

**Path**: `.claude/rules-master/TECH_STACK_NEXTJS.md`
**Applies because**: File is a Next.js component using TypeScript and React
**Priority**: high

**Key Requirements**:

- Use Server Components by default (no 'use client' unless needed)
- Place shared components in `components/` directory
- Use lowercase-with-dashes for directories

**Example**:
\`\`\`tsx
// Server Component (default)
export async function UserProfile({ userId }: { userId: string }) {
const user = await fetchUser(userId);
return <div>{user.name}</div>;
}
\`\`\`

**Why This Matters**:
Server Components reduce client-side JavaScript and improve performance.

---

#### PROTOCOL_ENGINEERING

**Path**: `.claude/rules-master/PROTOCOL_ENGINEERING.md`
**Applies because**: Universal code quality standards apply to all files
**Priority**: high

**Key Requirements**:

- Use explicit variable names
- Handle edge cases
- Implement proper error handling

**Example**:
\`\`\`tsx
// Good: Explicit naming
const userEmail = await getUserEmail(userId);

// Bad: Ambiguous naming
const data = await getData(id);
\`\`\`

---
```

## Customization

Adapt template based on:

- **User experience level**: More detail for beginners
- **Query type**: File-specific vs. general
- **Rule count**: Summarize if many rules apply
- **Context**: Project-specific considerations
