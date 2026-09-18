# E2E Tests for ChatSched Marketplace

End-to-end tests for the ChatSched marketplace platform using Playwright.

## Overview

These tests exercise the core marketplace flows:

- **Business posts request → Publisher accepts**: A business creates a campaign request and sends it to multiple publishers. A publisher receives the request, reviews it, and accepts it.
- **Publisher posts opportunity → Business applies**: A publisher creates a marketplace opportunity. A business discovers it, reviews the details, and applies for it.
- **Authentication flows**: Sign up and login for both roles, including logout.

## Setup

### Prerequisites

1. Node.js 18+ installed
2. A Supabase project (staging/test, never production)
3. Environment variables configured

### Installation

```bash
# Install Playwright and dependencies
npm install
```

### Environment Configuration

1. Copy `.env.test` to `.env.test.local` (not committed to version control):
   ```bash
   cp .env.test .env.test.local
   ```

2. Fill in your staging Supabase credentials:
   ```dotenv
   VITE_SUPABASE_URL=https://your-staging-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-staging-anon-key
   ```

3. Set up test accounts in your Supabase project with:
   - Publisher account: `publisher-test@example.com`
   - Business account: `business-test@example.com`
   - Password: `test-password-123`

## Running Tests

### All E2E Tests

```bash
# Run all tests headless (CI mode)
npm run test:e2e

# Run in UI mode (interactive, recommended for development)
npm run test:e2e:ui

# Debug mode (interactive with console access)
npm run test:e2e:debug
```

### Specific Tests

```bash
# Run only authentication tests
npx playwright test e2e/auth-flows.spec.ts

# Run only marketplace happy-path tests
npx playwright test e2e/marketplace-happy-path.spec.ts

# Run a specific test by name
npx playwright test -g "Business posts request"
```

### Watch Mode

```bash
# Re-run tests on file changes
npx playwright test --watch
```

## Test Reports

After running tests, Playwright generates an HTML report:

```bash
# View the report
npx playwright show-report
```

Screenshots and traces of failures are saved in `test-results/`.

## Writing New Tests

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Follow the existing pattern:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    // Test code here
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

## Troubleshooting

### Tests timeout or fail to connect

- Ensure the dev server is running: `npm run dev`
- Check that `PLAYWRIGHT_TEST_BASE_URL` is correct in `.env.test.local`
- Verify Supabase credentials are valid
- Check browser console for errors: `npm run test:e2e:ui` and inspect the browser

### Authentication issues

- Ensure test accounts exist in your Supabase project
- Verify email/password are correct in both test files and Supabase
- Check if your Supabase project has email auth enabled

### Flaky tests

- Increase timeouts: `page.waitForURL('/path', { timeout: 10000 })`
- Add explicit waits for elements: `await expect(page.locator('...')).toBeVisible()`
- Use `test.slow()` to triple the timeout: `test.slow()` at the beginning of a test

## CI/CD Integration

Add this to your GitHub Actions workflow:

```yaml
- name: Run E2E tests
  run: npm run test:e2e
  env:
    VITE_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
```

## Known Limitations

- Tests require real Supabase instance (no mocking yet)
- Payment flows are not fully tested (depends on PayFast sandbox setup)
- Some UI elements may need to be updated as the app evolves
- Tests are sequential by default to avoid account conflicts

## Future Improvements

- [ ] Add API mocking for PayFast to test payment flows
- [ ] Add visual regression tests
- [ ] Add performance/load testing
- [ ] Add mobile device testing
- [ ] Implement test data factories for easier setup
- [ ] Add fixtures for pre-created test users
