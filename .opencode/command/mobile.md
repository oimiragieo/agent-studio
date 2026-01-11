# /mobile

Launch a mobile application development workflow.

## Usage

```
/mobile                          # Start mobile workflow
/mobile "ios app"                # With platform hint
/mobile "react-native fitness"   # With framework hint
```

## Workflow

This command coordinates multiple agents for mobile development:

### 1. Mobile Developer

- Platform selection (native vs cross-platform)
- Architecture patterns (MVVM, Clean, etc.)
- State management strategy
- Navigation structure
- Offline-first capabilities
- Push notification design

### 2. UX Expert

- Touch-first interface design
- Gesture patterns
- Platform guidelines (HIG, Material)
- Responsive layouts
- Accessibility considerations
- Animation and micro-interactions

### 3. Developer

- Core app structure
- UI components
- Navigation implementation
- API integration
- Local storage

### 4. QA

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

## Platform Options

- **ios** - Native Swift/SwiftUI
- **android** - Native Kotlin/Compose
- **react-native** - Cross-platform with React Native
- **flutter** - Cross-platform with Flutter

## Expected Outputs

- App architecture design
- Platform strategy decisions
- UX specifications
- Test results and compliance

## See Also

- `/scaffold` - Generate mobile components
- `/code-quality` - Review mobile code quality
