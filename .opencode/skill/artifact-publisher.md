---
name: artifact-publisher
description: Publishes completed artifacts to appropriate locations. Handles versioning, formatting, and distribution of generated documents and code.
allowed-tools: read, write, glob, bash
---

# Artifact Publisher

Manages the publication and distribution of generated artifacts.

## When to Use

- Finalizing a document for review
- Publishing approved specifications
- Distributing code to repositories
- Archiving completed work
- Versioning artifact updates

## Instructions

### Step 1: Validate Artifact

Before publishing, verify:

- [ ] All required sections complete
- [ ] Metadata properly filled
- [ ] No placeholder content
- [ ] Links and references valid
- [ ] Formatting consistent

### Step 2: Apply Versioning

Version artifacts appropriately:

**Semantic Versioning for Specs**

```
v1.0.0 - Initial approved version
v1.1.0 - Minor additions
v1.0.1 - Corrections only
v2.0.0 - Major changes
```

**Date-based for Documents**

```
2025-01-01-project-brief.md
2025-01-15-project-brief-v2.md
```

### Step 3: Format for Publication

Prepare artifact for target audience:

**For Human Readers**

- Clean formatting
- Table of contents
- Proper headings
- Executive summary

**For Machine Processing**

- Valid JSON/YAML
- Schema compliance
- Consistent structure
- Proper escaping

### Step 4: Publish to Target

**Local Storage**

```
.opencode/context/artifacts/
└── published/
    └── architecture-v1.0.0.md
```

**Version Control**

```bash
git add docs/architecture.md
git commit -m "docs: publish architecture v1.0.0"
```

**Documentation Site**

- Export to docs folder
- Update index/navigation
- Generate static pages

### Step 5: Notify Stakeholders

After publication:

- Update relevant indexes
- Notify dependent agents
- Log publication event
- Archive previous version

## Artifact Types

### Documents

- PRD (Product Requirements)
- Architecture Specs
- API Documentation
- User Guides

### Code

- Generated modules
- Configuration files
- Migration scripts
- Test suites

### Data

- Schema definitions
- Seed data
- Configuration
- Templates

## Publication Checklist

### Pre-Publication

- [ ] Content complete
- [ ] Reviewed and approved
- [ ] Version number assigned
- [ ] Changelog updated

### Publication

- [ ] Formatted correctly
- [ ] Placed in correct location
- [ ] Permissions set
- [ ] Indexed/linked

### Post-Publication

- [ ] Notification sent
- [ ] Previous version archived
- [ ] Dependent docs updated
- [ ] Publication logged

## Versioning Strategy

### When to Version

- Initial release: v1.0.0
- Bug fixes: v1.0.x
- New features: v1.x.0
- Breaking changes: vX.0.0

### Version History

Maintain changelog:

```markdown
## Changelog

### v1.1.0 (2025-01-15)

- Added authentication section
- Updated API endpoints

### v1.0.0 (2025-01-01)

- Initial release
```

## Archive Management

### Active Artifacts

Current working versions in main folders

### Archived Artifacts

```
.opencode/context/artifacts/archive/
└── architecture/
    ├── v1.0.0-2025-01-01.md
    └── v1.1.0-2025-01-15.md
```

### Retention Policy

- Keep all major versions
- Keep latest 5 minor versions
- Archive older versions
- Delete drafts after publication
