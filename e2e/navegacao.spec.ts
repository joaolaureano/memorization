import { expect, test } from '@playwright/test';
import { entrarPelaUi, prepararEntradaInterceptada } from './servidores-locais';

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

test('a navegação autenticada não oferece uma tela global de Cartões', async ({ page }) => {
  const porta = Number(process.env.E2E_PORTA_DO_FRONTEND ?? 5173);
  const credencial = await prepararEntradaInterceptada(page);
  await page.route(/\/baralhos$/, async (rota) => {
    if (rota.request().method() === 'GET') {
      await rota.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    await rota.fallback();
  });
  await page.goto(`http://127.0.0.1:${porta}/#/baralhos`);
  await entrarPelaUi(page, credencial);
  await expect(page.getByRole('heading', { level: 1, name: 'Baralhos' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Cartões' })).toHaveCount(0);
  await page.goto(`http://127.0.0.1:${porta}/#/cartoes`);
  await expect(page.getByRole('heading', { level: 1, name: 'Cartões' })).toHaveCount(0);
});
