import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

const bundled = '/opt/pw-browsers/chromium';
const executablePath = fs.existsSync(bundled) && fs.statSync(bundled).isFile() ? bundled : undefined;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 180_000,
  use: {
    baseURL: 'http://localhost:3100',
    viewport: { width: 1366, height: 768 },
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
