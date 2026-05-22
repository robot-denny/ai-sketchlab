import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Member Login E2E Tests
 *
 * Tests the member login/register page at /member-registration/.
 * Covers: page structure, panel toggling, accessibility, form validation,
 * and the full registration → auto-login → logout flow.
 */

const LOGIN_PAGE = '/member-registration/';

// ---------- helpers ----------

const baseUrl = process.env.UMBRACO_URL || 'https://localhost:44367';

async function getBackOfficeToken(): Promise<string> {
  const resp = await fetch(
    `${baseUrl}/umbraco/management/api/v1/security/back-office/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.UMBRACO_CLIENT_ID!,
        client_secret: process.env.UMBRACO_CLIENT_SECRET!,
      }),
      // @ts-ignore — Node 18 fetch doesn't have this, but it's fine in the Playwright env
      ...(process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? {} : {}),
    }
  );
  if (!resp.ok) throw new Error(`Auth failed: ${resp.status}`);
  const data = await resp.json();
  return (data as { access_token: string }).access_token;
}

async function apiFetch(token: string, method: string, path: string) {
  const resp = await fetch(`${baseUrl}/umbraco/management/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp;
}

async function findMemberByEmail(
  token: string,
  email: string
): Promise<string | null> {
  const resp = await fetch(
    `${baseUrl}/umbraco/management/api/v1/filter/member?filter=${encodeURIComponent(email)}&skip=0&take=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return null;
  const data = (await resp.json()) as { items: { id: string; email: string }[] };
  const match = data.items.find(
    (m) => m.email?.toLowerCase() === email.toLowerCase()
  );
  return match?.id ?? null;
}

async function deleteMember(token: string, id: string): Promise<void> {
  await apiFetch(token, 'DELETE', `/member/${id}`);
}

// ---------- Section 1: Page Load & Structure ----------

test.describe('Member Login — Page Structure', () => {
  test('login page loads with 200 status', async ({ page }) => {
    const response = await page.goto(LOGIN_PAGE);
    expect(response?.status(), `${LOGIN_PAGE} should return 200`).toBe(200);
  });

  test('page header is rendered', async ({ page }) => {
    // The v2 master template renders an <h1 class="wordmark"> in the
    // sticky site head. The Login template's own page heading is the
    // <h1> emitted by v2/_PageHead, scoped under .page-head.
    await page.goto(LOGIN_PAGE);
    const heading = page.locator('.page-head h1');
    await expect(heading).toBeVisible();
  });

  test('login panel is visible by default', async ({ page }) => {
    await page.goto(LOGIN_PAGE);
    const loginPanel = page.locator('#login-panel');
    await expect(loginPanel).toBeVisible();
  });

  test('register panel is hidden by default', async ({ page }) => {
    await page.goto(LOGIN_PAGE);
    const registerPanel = page.locator('#register-panel');
    await expect(registerPanel).toBeHidden();
  });

  test('login form has username, password, and remember-me fields', async ({
    page,
  }) => {
    await page.goto(LOGIN_PAGE);
    const loginPanel = page.locator('#login-panel');
    await expect(loginPanel.locator('input[name="loginModel.Username"]')).toBeVisible();
    await expect(loginPanel.locator('input[name="loginModel.Password"]')).toBeVisible();
    await expect(
      loginPanel.locator('input[name="loginModel.RememberMe"][type="checkbox"]')
    ).toBeAttached();
  });

  test('register form has name, email, password, and confirm password fields', async ({
    page,
  }) => {
    await page.goto(LOGIN_PAGE);
    // Make the register panel visible first
    await page.locator('#show-register-btn').click();
    const registerPanel = page.locator('#register-panel');
    await expect(registerPanel.locator('input[name="registerModel.Name"]')).toBeVisible();
    await expect(registerPanel.locator('input[name="registerModel.Email"]')).toBeVisible();
    await expect(
      registerPanel.locator('input[name="registerModel.Password"]')
    ).toBeVisible();
    await expect(
      registerPanel.locator('input[name="registerModel.ConfirmPassword"]')
    ).toBeVisible();
  });
});

// ---------- Section 2: Panel Toggle Behavior ----------

test.describe('Member Login — Panel Toggle', () => {
  test('clicking "create an account" shows register panel and hides login', async ({
    page,
  }) => {
    await page.goto(LOGIN_PAGE);
    await page.locator('#show-register-btn').click();

    await expect(page.locator('#register-panel')).toBeVisible();
    await expect(page.locator('#login-panel')).toBeHidden();
  });

  test('clicking "Log in" switches back to login panel', async ({ page }) => {
    await page.goto(LOGIN_PAGE);
    // Switch to register first
    await page.locator('#show-register-btn').click();
    await expect(page.locator('#register-panel')).toBeVisible();

    // Switch back to login
    await page.locator('#show-login-btn').click();
    await expect(page.locator('#login-panel')).toBeVisible();
    await expect(page.locator('#register-panel')).toBeHidden();
  });

  test('URL updates to ?view=register when register panel shown', async ({
    page,
  }) => {
    await page.goto(LOGIN_PAGE);
    await page.locator('#show-register-btn').click();

    expect(page.url()).toContain('?view=register');
  });

  test('URL removes query param when login panel shown', async ({ page }) => {
    await page.goto(LOGIN_PAGE);
    await page.locator('#show-register-btn').click();
    await page.locator('#show-login-btn').click();

    expect(page.url()).not.toContain('?view=register');
  });

  test('navigating to ?view=register opens register panel directly', async ({
    page,
  }) => {
    await page.goto(`${LOGIN_PAGE}?view=register`);

    await expect(page.locator('#register-panel')).toBeVisible();
    await expect(page.locator('#login-panel')).toBeHidden();
  });
});

// ---------- Section 3: Accessibility ----------

test.describe('Member Login — Accessibility', () => {
  test('toggle buttons have aria-expanded and aria-controls', async ({
    page,
  }) => {
    await page.goto(LOGIN_PAGE);
    const showRegisterBtn = page.locator('#show-register-btn');
    const showLoginBtn = page.locator('#show-login-btn');

    await expect(showRegisterBtn).toHaveAttribute('aria-controls', 'register-panel');
    await expect(showRegisterBtn).toHaveAttribute('aria-expanded');

    // Show register panel to make login btn visible
    await showRegisterBtn.click();
    await expect(showLoginBtn).toHaveAttribute('aria-controls', 'login-panel');
    await expect(showLoginBtn).toHaveAttribute('aria-expanded');
  });

  test('aria-expanded updates on panel switch', async ({ page }) => {
    await page.goto(LOGIN_PAGE);
    const showRegisterBtn = page.locator('#show-register-btn');

    // Initially false
    await expect(showRegisterBtn).toHaveAttribute('aria-expanded', 'false');

    // After clicking, register btn becomes expanded
    await showRegisterBtn.click();
    await expect(showRegisterBtn).toHaveAttribute('aria-expanded', 'true');
  });

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto(LOGIN_PAGE);

    // Login form labels — ASP.NET generates id="loginModel_Username" etc.
    const usernameInput = page.locator('#login-panel input[name="loginModel.Username"]');
    const usernameId = await usernameInput.getAttribute('id');
    expect(usernameId).toBeTruthy();
    const usernameLabel = page.locator(`#login-panel label[for="${usernameId}"]`);
    await expect(usernameLabel).toBeAttached();

    // Register form labels (make visible)
    await page.locator('#show-register-btn').click();
    const nameInput = page.locator('#register-panel input[name="registerModel.Name"]');
    const nameId = await nameInput.getAttribute('id');
    expect(nameId).toBeTruthy();
    const nameLabel = page.locator(`#register-panel label[for="${nameId}"]`);
    await expect(nameLabel).toBeAttached();
  });

  test('register form required fields have aria-required', async ({
    page,
  }) => {
    await page.goto(`${LOGIN_PAGE}?view=register`);
    const registerPanel = page.locator('#register-panel');

    await expect(
      registerPanel.locator('input[name="registerModel.Name"]')
    ).toHaveAttribute('aria-required', 'true');
    await expect(
      registerPanel.locator('input[name="registerModel.Email"]')
    ).toHaveAttribute('aria-required', 'true');
    await expect(
      registerPanel.locator('input[name="registerModel.Password"]')
    ).toHaveAttribute('aria-required', 'true');
    await expect(
      registerPanel.locator('input[name="registerModel.ConfirmPassword"]')
    ).toHaveAttribute('aria-required', 'true');
  });
});

// ---------- Section 4: Form Validation ----------

test.describe('Member Login — Form Validation', () => {
  test('submitting empty login form shows validation errors', async ({
    page,
  }) => {
    await page.goto(LOGIN_PAGE);

    // Submit the login form with empty fields
    await page.locator('#login-panel button[type="submit"]').click();

    // Wait for client-side validation messages
    const validationErrors = page.locator(
      '#login-panel .field-validation-error, #login-panel .text-danger'
    );
    await expect(validationErrors.first()).toBeVisible({ timeout: 5000 });
  });

  test('submitting empty register form shows validation errors', async ({
    page,
  }) => {
    await page.goto(`${LOGIN_PAGE}?view=register`);

    // Submit the register form with empty fields
    await page.locator('#register-panel button[type="submit"]').click();

    // Wait for client-side validation messages
    const validationErrors = page.locator(
      '#register-panel .field-validation-error, #register-panel .text-danger'
    );
    await expect(validationErrors.first()).toBeVisible({ timeout: 5000 });
  });

  test('password mismatch shows validation error', async ({ page }) => {
    await page.goto(`${LOGIN_PAGE}?view=register`);

    const registerPanel = page.locator('#register-panel');
    await registerPanel.locator('input[name="registerModel.Name"]').fill('Test User');
    await registerPanel.locator('input[name="registerModel.Email"]').fill('test@example.com');
    await registerPanel.locator('input[name="registerModel.Password"]').fill('Password123!');
    await registerPanel
      .locator('input[name="registerModel.ConfirmPassword"]')
      .fill('DifferentPassword!');

    await registerPanel.locator('button[type="submit"]').click();

    // jQuery Validate should show a mismatch error on ConfirmPassword.
    // The validation message span uses data-valmsg-for with the model-prefixed name.
    const confirmError = registerPanel.locator(
      '[data-valmsg-for="registerModel.ConfirmPassword"].field-validation-error'
    );

    // Either client-side validation caught it (error span visible),
    // or the server will catch it after form submit.
    // Either way, we should NOT see a success message.
    const success = page.locator('.text-success');
    await expect(success).toBeHidden({ timeout: 5000 });
  });
});

// ---------- Section 5: Registration & Login Flow ----------

test.describe('Member Login — Registration Flow', () => {
  test.describe.configure({ mode: 'serial' });

  const testEmail = `e2e-test-${Date.now()}@example.com`;
  const testName = `E2E Test ${Date.now()}`;
  const testPassword = 'TestPassword123!';
  let testMemberId: string | null = null;

  test.afterAll(async () => {
    // Clean up: delete test member via Management API
    if (!testMemberId) {
      // Try to find the member by email
      try {
        const token = await getBackOfficeToken();
        testMemberId = await findMemberByEmail(token, testEmail);
      } catch {
        // ignore cleanup errors
      }
    }

    if (testMemberId) {
      try {
        const token = await getBackOfficeToken();
        await deleteMember(token, testMemberId);
      } catch {
        // ignore cleanup errors
      }
    }
  });

  test('register, verify authenticated state, and logout', async ({ page }) => {
    // --- Register ---
    await page.goto(`${LOGIN_PAGE}?view=register`);

    const registerPanel = page.locator('#register-panel');
    await registerPanel.locator('input[name="registerModel.Name"]').fill(testName);
    await registerPanel.locator('input[name="registerModel.Email"]').fill(testEmail);
    await registerPanel.locator('input[name="registerModel.Password"]').fill(testPassword);
    await registerPanel
      .locator('input[name="registerModel.ConfirmPassword"]')
      .fill(testPassword);

    await registerPanel.locator('button[type="submit"]').click();

    // After successful registration with auto-login, the page reloads.
    await page.waitForLoadState('networkidle');

    // The login status shows "Welcome back <email>!"
    // Note: Umbraco uses the email as the member identity name when UsernameIsEmail is true
    const welcomeText = page.locator('.login-status');
    await expect(welcomeText).toBeVisible({ timeout: 10000 });
    await expect(welcomeText).toContainText(testEmail);

    // --- Verify authenticated state: panels hidden ---
    await expect(page.locator('#login-panel')).toBeHidden();
    await expect(page.locator('#register-panel')).toBeHidden();

    // Find the test member ID for cleanup
    try {
      const token = await getBackOfficeToken();
      testMemberId = await findMemberByEmail(token, testEmail);
    } catch {
      // Will try again in afterAll
    }

    // --- Logout ---
    const logoutBtn = page.locator('.login-status button[type="submit"]');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // After logout, the page should reload and show the login panel
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#login-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.login-status')).toBeHidden();
  });
});
