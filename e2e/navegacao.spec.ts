import { expect, test } from '@playwright/test';

// T003 — teste trivial de navegação: um navegador real abre uma página local
// real e interage com o DOM renderizado.
test('abre uma página local real em navegador real', async ({ page, browserName }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Harness e2e');
  await expect(page.getByRole('heading', { name: 'Harness e2e' })).toBeVisible();
  await expect(page.locator('#estado')).toHaveText(
    'página local servida para o teste de navegação',
  );

  // Motor de navegador efetivamente em execução — não um DOM simulado.
  expect(browserName).toBe('chromium');
  const urlDaPagina = await page.evaluate(() => window.location.href);
  expect(urlDaPagina).toMatch(/^http:\/\/127\.0\.0\.1:/);
});
