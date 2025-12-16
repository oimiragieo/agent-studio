# UI/UX Specification: {{feature_name}}

## Overview
{{overview}}

## Design Goals
1. {{goal_1}}
2. {{goal_2}}
3. {{goal_3}}

## User Personas

### Primary Persona: {{persona_name}}
- **Role**: {{persona_role}}
- **Goals**: {{persona_goals}}
- **Pain Points**: {{persona_pain_points}}
- **Tech Proficiency**: {{tech_proficiency}}

### Secondary Persona: {{secondary_persona}}
{{secondary_persona_details}}

## User Flows

### Flow 1: {{flow_1_name}}
```
{{flow_1_steps}}
```

### Flow 2: {{flow_2_name}}
```
{{flow_2_steps}}
```

## Information Architecture

### Navigation Structure
```
├── {{nav_item_1}}
│   ├── {{subnav_1a}}
│   └── {{subnav_1b}}
├── {{nav_item_2}}
└── {{nav_item_3}}
```

### Content Hierarchy
{{content_hierarchy}}

## Wireframes

### Screen 1: {{screen_1_name}}
```
+----------------------------------+
|  {{header}}                       |
+----------------------------------+
|                                  |
|  {{main_content}}                 |
|                                  |
+----------------------------------+
|  {{footer}}                       |
+----------------------------------+
```

## Design System

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| --primary | {{primary_color}} | Primary actions |
| --secondary | {{secondary_color}} | Secondary elements |
| --background | {{bg_color}} | Page background |
| --text | {{text_color}} | Body text |
| --error | {{error_color}} | Error states |
| --success | {{success_color}} | Success states |

### Typography
| Token | Font | Size | Weight |
|-------|------|------|--------|
| --heading-1 | {{font}} | 32px | 700 |
| --heading-2 | {{font}} | 24px | 600 |
| --body | {{font}} | 16px | 400 |
| --small | {{font}} | 14px | 400 |

### Spacing
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px

### Components
{{component_list}}

## Accessibility Requirements

### WCAG 2.1 AA Compliance
- [ ] Color contrast minimum 4.5:1
- [ ] All images have alt text
- [ ] Keyboard navigation for all interactive elements
- [ ] Focus indicators visible
- [ ] Form labels properly associated
- [ ] ARIA labels where needed
- [ ] Logical heading structure

### Screen Reader Considerations
{{screen_reader_requirements}}

### Keyboard Navigation
{{keyboard_navigation}}

## Responsive Design

### Breakpoints
| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Mobile | < 640px | {{mobile_behavior}} |
| Tablet | 640-1024px | {{tablet_behavior}} |
| Desktop | > 1024px | {{desktop_behavior}} |

### Mobile-First Approach
{{mobile_first_details}}

## Interaction Patterns

### Micro-interactions
{{micro_interactions}}

### Loading States
{{loading_states}}

### Error States
{{error_states}}

### Empty States
{{empty_states}}

### Success States
{{success_states}}

## Content Guidelines

### Tone & Voice
{{tone_voice}}

### Microcopy
| Context | Copy |
|---------|------|
| Button - Submit | {{submit_copy}} |
| Error - Required | {{required_error}} |
| Success - Saved | {{success_copy}} |

## AI Generation Prompts

### Component: {{component_name}}
```
Create a {{component_type}} component with:
- {{requirement_1}}
- {{requirement_2}}
- {{requirement_3}}

Use Tailwind CSS for styling.
Follow Shadcn UI patterns.
Ensure WCAG 2.1 AA accessibility.
```

## Deliverables Checklist

- [ ] User personas documented
- [ ] User flows mapped
- [ ] Wireframes created
- [ ] Design system defined
- [ ] Accessibility requirements specified
- [ ] Responsive breakpoints defined
- [ ] Interaction patterns documented
- [ ] AI generation prompts prepared

---
*This UI spec follows design standards for consistent user experience.*
