import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const STORAGE_STATE = join(__dirname, 'tests/e2e/.auth/user.json');

// CRITICAL: testhelpers read auth tokens from this exact env-var name.
// "STAGE" (not STATE) is an upstream typo in @umbraco/playwright-testhelpers — don't "fix" it.
process.env.STORAGE_STAGE_PATH = STORAGE_STATE;

// Hoisted from per-spec module scope (Step 1, _plans/arch-safety-net.md): every spec
// historically set this to tolerate the self-signed HTTPS dev cert on localhost.
// Setting it once here is equivalent (env is inherited by all worker processes at
// spawn time) and prevents the line from re-appearing in every new spec.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'html',
  use: {
    baseURL: process.env.UMBRACO_URL || 'https://localhost:44367',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    // CRITICAL: Umbraco uses 'data-mark' not 'data-testid'
    testIdAttribute: 'data-mark',
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/*.setup.ts',
    },
    {
      name: 'e2e',
      testMatch: '**/*.spec.ts',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        ignoreHTTPSErrors: true,
        storageState: STORAGE_STATE,
      },
    },
  ],
});
