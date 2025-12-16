---
description: Master Cypress testing rules - E2E, API, defect tracking, accessibility, and integration testing
globs: **/*.cy.{ts,js}, cypress/**/*, **/cypress/**/*
priority: high
---

# Cypress Testing Master Rules

**Consolidated from**: cypress-e2e-testing, cypress-api-testing, cypress-defect-tracking, cypress-accessibility-testing, cypress-integration-testing.

## Cypress Setup

### Installation

- Use Cypress 13+ (latest stable)
- Install as dev dependency: `npm install -D cypress`
- Use TypeScript for better type safety
- Configure in `cypress.config.ts`

### Project Structure

```
cypress/
├── e2e/
│   ├── auth/
│   ├── checkout/
│   └── user-profile/
├── fixtures/
│   └── test-data.json
├── support/
│   ├── commands.ts
│   └── e2e.ts
└── cypress.config.ts
```

## E2E Testing

### Test Structure

- **Focused test files**: 3-5 tests per file
- **Descriptive test names**: Clear, behavior-focused descriptions
- **TypeScript-aware**: Auto-detect TypeScript projects
- **One flow per test**: Test complete user flows, not isolated functionality

### Best Practices

1. **Use data-testid selectors**: Prefer `data-testid` over CSS classes
2. **Proper waiting strategies**: Use Cypress commands, avoid `cy.wait()` with fixed times
3. **API mocking**: Use `cy.intercept()` to mock external dependencies
4. **Focused tests**: Each test should validate one user flow
5. **Clean state**: Reset state between tests

### Example E2E Test

```typescript
describe('User Login', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: { token: 'mock-token', user: { id: 1, name: 'Test User' } }
    }).as('loginRequest');
    
    cy.visit('/login');
  });

  it('should successfully log in with valid credentials', () => {
    cy.get('[data-testid="email-input"]').type('user@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();
    
    cy.wait('@loginRequest');
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-name"]').should('contain', 'Test User');
  });

  it('should display error message with invalid credentials', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 401,
      body: { error: 'Invalid credentials' }
    }).as('loginError');
    
    cy.get('[data-testid="email-input"]').type('user@example.com');
    cy.get('[data-testid="password-input"]').type('wrong-password');
    cy.get('[data-testid="login-button"]').click();
    
    cy.wait('@loginError');
    cy.get('[data-testid="error-message"]').should('be.visible');
    cy.get('[data-testid="error-message"]').should('contain', 'Invalid credentials');
  });
});
```

## API Testing

### API Test Structure

- Test API endpoints directly
- Validate request/response formats
- Test error scenarios
- Use fixtures for test data

### Best Practices

- Use `cy.request()` for API calls
- Validate response status codes
- Validate response body structure
- Test authentication/authorization
- Test error handling

### Example API Test

```typescript
describe('API: User Endpoints', () => {
  it('should fetch user profile', () => {
    cy.request({
      method: 'GET',
      url: '/api/users/1',
      headers: { Authorization: 'Bearer token' }
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('id');
      expect(response.body).to.have.property('name');
      expect(response.body).to.have.property('email');
    });
  });

  it('should return 401 for unauthorized requests', () => {
    cy.request({
      method: 'GET',
      url: '/api/users/1',
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(401);
    });
  });
});
```

## Defect Tracking

### Defect Reporting

- Capture screenshots on failure
- Include console logs
- Document steps to reproduce
- Include environment information
- Link to related issues

### Test Organization

- Group related tests
- Use tags for test categorization
- Document known issues
- Track flaky tests

## Accessibility Testing

### Accessibility Checks

- Test keyboard navigation
- Validate ARIA attributes
- Test screen reader compatibility
- Check color contrast
- Validate focus management

### Best Practices

- Use `cypress-axe` for automated accessibility testing
- Test with keyboard only
- Validate semantic HTML
- Check ARIA labels and roles

### Example Accessibility Test

```typescript
import 'cypress-axe';

describe('Accessibility', () => {
  it('should have no accessibility violations', () => {
    cy.visit('/');
    cy.injectAxe();
    cy.checkA11y();
  });

  it('should be navigable with keyboard', () => {
    cy.visit('/');
    cy.get('body').tab();
    // Test keyboard navigation
  });
});
```

## Integration Testing

### Integration Test Scope

- Test component interactions
- Test data flow between components
- Test state management
- Test API integration

### Best Practices

- Mock external services
- Test real component interactions
- Validate data transformations
- Test error propagation

## Common Patterns

### Custom Commands

```typescript
// cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.intercept('POST', '/api/auth/login').as('login');
  cy.visit('/login');
  cy.get('[data-testid="email-input"]').type(email);
  cy.get('[data-testid="password-input"]').type(password);
  cy.get('[data-testid="login-button"]').click();
  cy.wait('@login');
});
```

### Fixtures

```typescript
// Use fixtures for test data
cy.fixture('user-data').then((userData) => {
  cy.get('[data-testid="email-input"]').type(userData.email);
});
```

### Page Object Model (Optional)

```typescript
class LoginPage {
  visit() {
    cy.visit('/login');
  }

  fillEmail(email: string) {
    cy.get('[data-testid="email-input"]').type(email);
  }

  fillPassword(password: string) {
    cy.get('[data-testid="password-input"]').type(password);
  }

  submit() {
    cy.get('[data-testid="login-button"]').click();
  }
}
```

## Configuration

### cypress.config.ts

```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // Configure plugins
    },
  },
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Cypress tests
  uses: cypress-io/github-action@v5
  with:
    install: true
    wait-on: 'http://localhost:3000'
    wait-on-timeout: 120
```

## Best Practices Summary

1. **Use data-testid selectors** - More stable than CSS classes
2. **Mock external dependencies** - Use `cy.intercept()` for APIs
3. **Avoid hardcoded waits** - Use Cypress's built-in waiting
4. **Keep tests focused** - One user flow per test
5. **Use TypeScript** - Better type safety and IDE support
6. **Clean state** - Reset between tests
7. **Test user behavior** - Not implementation details
8. **Capture failures** - Screenshots and videos on failure
9. **Accessibility testing** - Include a11y checks
10. **Document tests** - Clear test descriptions

## Migration Notes

This master file consolidates rules from:
- `cypress-e2e-testing-cursorrules-prompt-file`
- `cypress-api-testing-cursorrules-prompt-file`
- `cypress-defect-tracking-cursorrules-prompt-file`
- `cypress-accessibility-testing-cursorrules-prompt-file`
- `cypress-integration-testing-cursorrules-prompt-file`

**Old rule files can be archived** - this master file is the single source of truth for Cypress testing.

