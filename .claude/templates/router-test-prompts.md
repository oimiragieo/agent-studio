# Router Template Test Prompts

This document contains test prompts for validating the router template's classification accuracy.

## Test Set 1: Simple Queries (shouldRoute: false)

### Test 1.1: File Location Query
**Prompt**: "What files handle routing in this project?"
**Expected**:
```json
{
  "intent": "question",
  "complexity": 0.1,
  "shouldRoute": false,
  "confidence": 0.95,
  "reasoning": "Simple documentation query requiring file search"
}
```

### Test 1.2: Status Check
**Prompt**: "Show me the current workflow status"
**Expected**:
```json
{
  "intent": "question",
  "complexity": 0.1,
  "shouldRoute": false,
  "confidence": 0.97,
  "reasoning": "Simple status query"
}
```

### Test 1.3: Single File Read
**Prompt**: "Read the router agent definition file"
**Expected**:
```json
{
  "intent": "question",
  "complexity": 0.2,
  "shouldRoute": false,
  "confidence": 0.92,
  "reasoning": "Single file read operation"
}
```

### Test 1.4: Quick Explanation
**Prompt**: "Explain what the orchestrator agent does"
**Expected**:
```json
{
  "intent": "question",
  "complexity": 0.2,
  "shouldRoute": false,
  "confidence": 0.93,
  "reasoning": "Simple explanation request"
}
```

### Test 1.5: Documentation Lookup
**Prompt**: "Where can I find the workflow documentation?"
**Expected**:
```json
{
  "intent": "question",
  "complexity": 0.1,
  "shouldRoute": false,
  "confidence": 0.94,
  "reasoning": "Documentation lookup query"
}
```

## Test Set 2: Medium Complexity (shouldRoute: true, complexity 0.3-0.6)

### Test 2.1: Bug Fix
**Prompt**: "Fix the login error in the authentication service"
**Expected**:
```json
{
  "intent": "fix",
  "complexity": 0.5,
  "shouldRoute": true,
  "confidence": 0.9,
  "reasoning": "Bug fix requiring code analysis and modification"
}
```

### Test 2.2: Documentation Update
**Prompt**: "Update the API documentation for user endpoints"
**Expected**:
```json
{
  "intent": "document",
  "complexity": 0.4,
  "shouldRoute": true,
  "confidence": 0.88,
  "reasoning": "Documentation update requiring multiple file modifications"
}
```

### Test 2.3: Test Addition
**Prompt**: "Add unit tests for the authentication module"
**Expected**:
```json
{
  "intent": "test",
  "complexity": 0.5,
  "shouldRoute": true,
  "confidence": 0.91,
  "reasoning": "Test creation requiring code analysis and test generation"
}
```

### Test 2.4: Code Review
**Prompt**: "Review the pull request for security issues"
**Expected**:
```json
{
  "intent": "review",
  "complexity": 0.6,
  "shouldRoute": true,
  "confidence": 0.92,
  "reasoning": "Code review requiring security analysis across multiple files"
}
```

### Test 2.5: Feature Addition
**Prompt**: "Add password reset functionality to the user service"
**Expected**:
```json
{
  "intent": "implement",
  "complexity": 0.6,
  "shouldRoute": true,
  "confidence": 0.89,
  "reasoning": "Feature addition requiring multiple file modifications and integration"
}
```

## Test Set 3: High Complexity (shouldRoute: true, complexity 0.7-1.0)

### Test 3.1: Complex Implementation
**Prompt**: "Implement a new authentication system with JWT and OAuth"
**Expected**:
```json
{
  "intent": "implement",
  "complexity": 0.9,
  "shouldRoute": true,
  "confidence": 0.98,
  "reasoning": "Complex multi-step implementation requiring architecture and multiple files"
}
```

### Test 3.2: Full Application Build
**Prompt**: "Build an enterprise web application connecting to Google Cloud"
**Expected**:
```json
{
  "intent": "implement",
  "complexity": 1.0,
  "shouldRoute": true,
  "confidence": 0.99,
  "reasoning": "Full application development requiring architecture, infrastructure, and multiple services"
}
```

### Test 3.3: Security Audit
**Prompt**: "Audit the entire codebase for security vulnerabilities"
**Expected**:
```json
{
  "intent": "security",
  "complexity": 0.7,
  "shouldRoute": true,
  "confidence": 0.95,
  "reasoning": "Complex security audit requiring cross-module analysis"
}
```

### Test 3.4: Architecture Design
**Prompt**: "Design a microservices architecture for the user management system"
**Expected**:
```json
{
  "intent": "implement",
  "complexity": 0.8,
  "shouldRoute": true,
  "confidence": 0.96,
  "reasoning": "Architecture design requiring system-level planning and design decisions"
}
```

### Test 3.5: Major Refactoring
**Prompt**: "Refactor the entire application to use dependency injection"
**Expected**:
```json
{
  "intent": "refactor",
  "complexity": 0.9,
  "shouldRoute": true,
  "confidence": 0.94,
  "reasoning": "Major refactoring requiring pattern changes across entire application"
}
```

## Test Set 4: Edge Cases and Ambiguity

### Test 4.1: Multi-Step Workflow
**Prompt**: "Implement authentication and then deploy to production"
**Expected**:
```json
{
  "intent": "implement",
  "complexity": 0.9,
  "shouldRoute": true,
  "confidence": 0.95,
  "reasoning": "Multi-step workflow requiring implementation and deployment"
}
```

### Test 4.2: Ambiguous Query
**Prompt**: "Do something with the authentication system"
**Expected**:
```json
{
  "intent": "question",
  "complexity": 0.5,
  "shouldRoute": true,
  "confidence": 0.6,
  "reasoning": "Ambiguous request requiring clarification from orchestrator"
}
```

### Test 4.3: Script Creation
**Prompt**: "Create a simple script to backup the database"
**Expected**:
```json
{
  "intent": "implement",
  "complexity": 0.3,
  "shouldRoute": true,
  "confidence": 0.87,
  "reasoning": "Script creation requiring code generation"
}
```

### Test 4.4: Performance Optimization
**Prompt**: "Optimize the database queries in the user service"
**Expected**:
```json
{
  "intent": "optimize",
  "complexity": 0.6,
  "shouldRoute": true,
  "confidence": 0.9,
  "reasoning": "Performance optimization requiring analysis and code changes"
}
```

### Test 4.5: Infrastructure Setup
**Prompt**: "Set up a CI/CD pipeline for the project"
**Expected**:
```json
{
  "intent": "infrastructure",
  "complexity": 0.7,
  "shouldRoute": true,
  "confidence": 0.93,
  "reasoning": "Infrastructure setup requiring DevOps configuration and multiple integrations"
}
```

## Test Set 5: Intent Category Coverage

### Test 5.1: Analyze Intent
**Prompt**: "Analyze the code quality of the user service"
**Expected**:
```json
{
  "intent": "analyze",
  "complexity": 0.5,
  "shouldRoute": true,
  "confidence": 0.91,
  "reasoning": "Code analysis requiring pattern detection and quality assessment"
}
```

### Test 5.2: Deploy Intent
**Prompt**: "Deploy the application to the staging environment"
**Expected**:
```json
{
  "intent": "deploy",
  "complexity": 0.6,
  "shouldRoute": true,
  "confidence": 0.92,
  "reasoning": "Deployment operation requiring infrastructure coordination"
}
```

### Test 5.3: Question Intent (Complex)
**Prompt**: "How would I implement a real-time notification system using WebSockets?"
**Expected**:
```json
{
  "intent": "question",
  "complexity": 0.4,
  "shouldRoute": true,
  "confidence": 0.85,
  "reasoning": "Complex technical question requiring architectural guidance"
}
```

## Success Criteria

- **Accuracy**: > 95% correct classification on these 28 test cases
- **Response Time**: < 100ms average per classification
- **Confidence**: > 0.85 average confidence across all tests
- **shouldRoute Accuracy**: 100% correct routing decisions (simple vs complex)

## Validation Process

1. Load router template into Haiku session
2. Execute each test prompt
3. Compare output to expected classification
4. Calculate accuracy metrics:
   - Intent accuracy: % correct intent categories
   - Complexity accuracy: % within ±0.2 of expected
   - Routing accuracy: % correct shouldRoute decisions
   - Confidence accuracy: % within ±0.1 of expected

## Performance Benchmarks

| Metric                | Target  | Acceptable | Unacceptable |
| --------------------- | ------- | ---------- | ------------ |
| Classification time   | < 100ms | < 200ms    | > 200ms      |
| Intent accuracy       | > 95%   | > 90%      | < 90%        |
| Routing accuracy      | 100%    | > 98%      | < 98%        |
| Average confidence    | > 0.85  | > 0.80     | < 0.80       |

## Notes

- These test cases cover all 12 intent categories
- Complexity ranges from 0.1 (simple query) to 1.0 (full application)
- Edge cases test ambiguity handling and multi-step workflows
- Real-world prompts may vary; template should generalize well
