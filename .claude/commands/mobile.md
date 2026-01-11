<command_description>
Command: /mobile - Launch a mobile application development workflow.
</command_description>

<instructions>
<execution_steps>

```
/mobile                          # Start mobile workflow
/mobile --platform ios           # Target specific platform
/mobile --framework react-native # Specify framework
```

## What This Command Does

Invokes the **mobile-flow** workflow with this agent sequence:

1. **Mobile Developer** - Platform strategy
   - Platform selection (native vs cross-platform)
   - Architecture patterns (MVVM, Clean, etc.)
   - State management strategy
   - Navigation structure
   - Offline-first capabilities
   - Push notification design

2. **UX Expert** - Mobile UX design
   - Touch-first interface design
   - Gesture patterns
   - Platform guidelines (HIG, Material)
   - Responsive layouts
   - Accessibility considerations
   - Animation and micro-interactions

3. **Developer** - Implementation
   - Core app structure
   - UI components
   - Navigation implementation
   - API integration
   - Local storage

4. **QA** - Mobile quality assurance
   - Device compatibility testing
   - Performance profiling
   - Battery usage analysis
   - Network condition testing
   - App store compliance check

## When to Use

- Building new mobile apps
- Porting web apps to mobile
- Cross-platform development
- Native iOS/Android development
- Mobile-first features

## Outputs

- `mobile-architecture.json` - App architecture
- `platform-strategy.json` - Platform decisions
- `mobile-ux-spec.json` - UX specifications
- `mobile-test-results.json` - Testing results

</execution_steps>

<output_format>
**Outputs**:

- `mobile-architecture.json` - App architecture
- `platform-strategy.json` - Platform decisions
- `mobile-ux-spec.json` - UX specifications
- `mobile-test-results.json` - Testing results
  </output_format>
  </instructions>
