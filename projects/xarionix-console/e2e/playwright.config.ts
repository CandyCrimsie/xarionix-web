import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

const filename = process.env['CONSOLE_E2E_STATE'];
if (!filename)
  throw new Error(
    'Run scripts/console_integration.py: a real disposable Core/Keycloak stack is required',
  );
const state = JSON.parse(fs.readFileSync(filename, 'utf8')) as { baseUrl: string };
export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180000,
  expect: { timeout: 15000 },
  outputDir: '../../../reports/console-playwright-private',
  reporter: [['./safe-reporter.ts']],
  use: {
    baseURL: state.baseUrl,
    headless: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    viewport: { width: 1440, height: 1000 },
  },
});
