import { test as setup } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Auth setup using OAuth client credentials.
 * Writes a user.json in the format @umbraco/playwright-testhelpers expects:
 *   origins[0].localStorage['umb:userAuthTokenResponse'].access_token
 *
 * This bypasses the UI login flow (which requires the Umbraco SPA to render
 * the login form) and uses the Management API directly instead.
 */
setup('authenticate', async ({ request }) => {
  const baseUrl = process.env.URL!;

  const response = await request.post(
    `${baseUrl}/umbraco/management/api/v1/security/back-office/token`,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.UMBRACO_CLIENT_ID!,
        client_secret: process.env.UMBRACO_CLIENT_SECRET!,
      }).toString(),
      ignoreHTTPSErrors: true,
    }
  );

  if (!response.ok()) {
    throw new Error(`Auth failed: ${response.status()} ${await response.text()}`);
  }

  const tokenData = await response.json();
  const now = Math.floor(Date.now() / 1000);

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: baseUrl,
        localStorage: [
          {
            name: 'umb:userAuthTokenResponse',
            value: JSON.stringify({
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token || '',
              token_type: tokenData.token_type || 'Bearer',
              expires_in: tokenData.expires_in || 299,
              issued_at: now,
            }),
          },
        ],
      },
    ],
  };

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  fs.writeFileSync(STORAGE_STATE, JSON.stringify(storageState, null, 2));
});
