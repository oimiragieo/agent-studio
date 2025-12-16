---
description: Master Playwright testing rules - E2E, API, defect tracking, accessibility, and integration testing
globs: **/*.spec.{ts,js}, **/*.test.{ts,js}, tests/**/*, **/playwright/**/*
priority: high
---

# Playwright Testing Master Rules

**Consolidated from**: playwright-e2e-testing, playwright-api-testing, playwright-defect-tracking, playwright-accessibility-testing, playwright-integration-testing.

## Playwright Setup

### Installation

- Use Playwright 1.40+ (latest stable)
- Install: `npm install -D @playwright/test`
- Install browsers: `npx playwright install`
- Use TypeScript for better type safety

### Project Structure

```
tests/
├── e2e/
│   ├── auth.spec.ts
│   ├── checkout.spec.ts
│   └── user-profile.spec.ts
├── api/
│   └── users.spec.ts
├── fixtures/
│   └── test-data.ts
└── playwright.config.ts
```

## E2E Testing

### Test Structure

- **Focused test files**: 3-5 tests per file
- **Descriptive test names**: Clear, behavior-focused descriptions
- **TypeScript-aware**: Auto-detect TypeScript projects
- **One flow per test**: Test complete user flows, not isolated functionality

### Best Practices

1. **Use test IDs or semantic selectors**: Prefer `data-testid` or semantic HTML
2. **Leverage auto-waiting**: Playwright auto-waits, no explicit waits needed
3. **API mocking**: Use `page.route()` to mock external dependencies
4. **Focused tests**: Each test should validate one user flow
5. **Clean state**: Reset state between tests

### Example E2E Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'mock-token', user: { id: 1, name: 'Test User' } })
      });
    });
    
    await page.goto('/login');
  });

  test('should successfully log in with valid credentials', async ({ page }) => {
    await page.getByTestId('email-input').fill('user@example.com');
    await page.getByTestId('password-input').fill('password123');
    await page.getByTestId('login-button').click();
    
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByTestId('user-name')).toContainText('Test User');
  });

  test('should display error message with invalid credentials', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' })
      });
    });
    
    await page.getByTestId('email-input').fill('user@example.com');
    await page.getByTestId('password-input').fill('wrong-password');
    await page.getByTestId('login-button').click();
    
    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByTestId('error-message')).toContainText('Invalid credentials');
  });
});
```

## API Testing

### API Test Structure

- Test API endpoints directly using `request` context
- Validate request/response formats
- Test error scenarios
- Use fixtures for test data

### Best Practices

- Use `request` context for API calls
- Validate response status codes
- Validate response body structure
- Test authentication/authorization
- Test error handling

### Example API Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('API: User Endpoints', () => {
  test('should fetch user profile', async ({ request }) => {
    const response = await request.get('/api/users/1', {
      headers: { Authorization: 'Bearer token' }
    });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('email');
  });

  test('should return 401 for unauthorized requests', async ({ request }) => {
    const response = await request.get('/api/users/1');
    expect(response.status()).toBe(401);
  });
});
```

## Defect Tracking

### Defect Reporting

- Capture screenshots on failure (automatic)
- Include console logs
- Document steps to reproduce
- Include environment information
- Link to related issues
- Use trace viewer for debugging

### Test Organization

- Group related tests with `test.describe()`
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

- Use `@axe-core/playwright` for automated accessibility testing
- Test with keyboard only
- Validate semantic HTML
- Check ARIA labels and roles

### Example Accessibility Test

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should be navigable with keyboard', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
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

- Mock external services with `page.route()`
- Test real component interactions
- Validate data transformations
- Test error propagation

## Cross-Browser Testing

### Browser Configuration

- Test on Chromium, Firefox, and WebKit
- Use project configuration for different browsers
- Test responsive design on different viewports

### Example Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

## Mobile Emulation

### Device Emulation

- Test on mobile devices
- Use device presets
- Test touch interactions
- Validate responsive design

### Example

```typescript
test('should work on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  // Test mobile interactions
});
```

## Visual Testing

### Screenshot Comparison

- Capture screenshots for visual regression
- Compare across browsers
- Use `toHaveScreenshot()` for visual testing

### Example

```typescript
test('should match screenshot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png');
});
```

## Common Patterns

### Custom Fixtures

```typescript
// tests/fixtures.ts
import { test as base } from '@playwright/test';

type MyFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<MyFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login logic
    await page.goto('/login');
    await page.getByTestId('email-input').fill('user@example.com');
    await page.getByTestId('password-input').fill('password');
    await page.getByTestId('login-button').click();
    await use(page);
  },
});
```

### Page Object Model

```typescript
class LoginPage {
  constructor(private page: Page) {}

  async visit() {
    await this.page.goto('/login');
  }

  async fillEmail(email: string) {
    await this.page.getByTestId('email-input').fill(email);
  }

  async fillPassword(password: string) {
    await this.page.getByTestId('password-input').fill(password);
  }

  async submit() {
    await this.page.getByTestId('login-button').click();
  }
}
```

## Configuration

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run Playwright tests
  run: npx playwright test

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Best Practices Summary

1. **Use test IDs or semantic selectors** - More stable than CSS classes
2. **Leverage auto-waiting** - Playwright auto-waits, no explicit waits needed
3. **Mock external dependencies** - Use `page.route()` for APIs
4. **Keep tests focused** - One user flow per test
5. **Use TypeScript** - Better type safety and IDE support
6. **Clean state** - Reset between tests
7. **Test user behavior** - Not implementation details
8. **Cross-browser testing** - Test on multiple browsers
9. **Accessibility testing** - Include a11y checks
10. **Visual testing** - Use screenshots for regression testing

## Migration Notes

This master file consolidates rules from:
- `playwright-e2e-testing-cursorrules-prompt-file`
- `playwright-api-testing-cursorrules-prompt-file`
- `playwright-defect-tracking-cursorrules-prompt-file`
- `playwright-accessibility-testing-cursorrules-prompt-file`
- `playwright-integration-testing-cursorrules-prompt-file`

**Old rule files can be archived** - this master file is the single source of truth for Playwright testing.

