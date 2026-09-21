import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

// Harness e2e (T003): prova que um navegador real abre uma página local real
// servida de e2e/fixtures. T013 acrescenta um segundo servidor — o frontend
// React real em Vite dev — para exercitar a tela de Cartões em navegador real.
const PORTA = Number(process.env.E2E_PORTA ?? 4173);
const BASE_URL = `http://127.0.0.1:${PORTA}`;

// Frontend real de T013. O endereço da API (plan.md) aponta para a mesma
// origem do Vite: a interceptação de /cartoes acontece no Playwright, antes
// de qualquer rede — o teste de T013 injeta os 50 Cartões determinísticos.
const PORTA_DO_FRONTEND = Number(process.env.E2E_PORTA_DO_FRONTEND ?? 5173);
const ENDERECO_DO_FRONTEND = `http://127.0.0.1:${PORTA_DO_FRONTEND}`;

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
  webServer: [
    {
      command: 'node servidor-estatico.mjs',
      cwd: import.meta.dirname,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { E2E_PORTA: String(PORTA) },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${PORTA_DO_FRONTEND} --strictPort`,
      cwd: join(import.meta.dirname, '..', 'frontend'),
      url: ENDERECO_DO_FRONTEND,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { VITE_ENDERECO_DA_API: ENDERECO_DO_FRONTEND },
    },
  ],
});
