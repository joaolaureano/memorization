import { defineConfig, devices } from '@playwright/test';

// Harness e2e (T003). Sem domínio: apenas prova que um navegador real abre
// uma página local real. Os cenários de domínio pertencem a T014 e T013.
const PORTA = Number(process.env.E2E_PORTA ?? 4173);
const BASE_URL = `http://127.0.0.1:${PORTA}`;

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node servidor-estatico.mjs',
    cwd: import.meta.dirname,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { E2E_PORTA: String(PORTA) },
  },
});
