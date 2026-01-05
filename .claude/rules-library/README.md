# Archived Rules

This directory contains rule files that are rarely used or for niche technologies. These rules are not automatically loaded but can be accessed on-demand when needed.

## Lookup Instructions

To use an archived rule:

1. **Via read_file tool**: `read_file .claude/archive/[rule-name]/README.md`
2. **Via search**: Use codebase search to find specific patterns
3. **Manual activation**: Copy the rule back to `.claude/rules/` if you need it regularly

## Archived Categories

### Niche Languages
- `dragonruby-*` - DragonRuby game development
- `elixir-*` - Elixir/Phoenix
- `go-*` - Go language
- `unity-*` - Unity C# development
- `webassembly-*` - WebAssembly
- `salesforce-apex-*` - Salesforce Apex
- `swiftui-*`, `swift-*` - Swift/SwiftUI

### Unused Frameworks
- `laravel-*` - Laravel PHP
- `drupal-*` - Drupal CMS
- `typo3cms-*` - TYPO3 CMS
- `wordpress-*` - WordPress

### Mobile Development
- `android-*` - Android development
- `flutter-*` - Flutter
- `react-native-*` - React Native

### Other Frameworks
- `rails-*` - Ruby on Rails
- `svelte*` - Svelte/SvelteKit
- `vue-*` - Vue.js

### Older Versions
- `nextjs-14-*` - Next.js 14 (superseded by Next.js 15)

## Restoring Archived Rules

If you need to restore a rule:

```bash
# Restore a specific rule
cp -r .claude/archive/[rule-name] .claude/rules/

# Or move it back
mv .claude/archive/[rule-name] .claude/rules/
```

## Notes

- Archived rules are preserved for reference
- They don't consume context tokens unless explicitly loaded
- Consider creating a master ruleset if you frequently need multiple archived rules

