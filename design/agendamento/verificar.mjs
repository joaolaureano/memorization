import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('./index.html', import.meta.url).href);

  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      throw new Error(`Rolagem horizontal em ${width}px`);
    }
  }

  await page.getByText('Gerenciar agenda', { exact: true }).click();
  const history = page.locator('.routine').filter({ hasText: 'História' });
  await expect(history).toHaveClass(/paused/);
  await expect(history.locator('.routine-status')).toHaveText('Pausada');

  await page.getByRole('button', { name: 'Editar História', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Editar rotina' })).toBeVisible();
  await expect(page.locator('#deck')).toHaveCSS('text-align', 'center');
  await expect(page.getByText(/A mudança vale para o estudo de hoje/)).toHaveCount(0);
  await page.getByLabel('Baralho').selectOption('Geografia');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Confirmar alterações' });
  await expect(confirm).toContainText('Compromissos pendentes de hoje e futuros');
  await expect(confirm).toContainText('Sessões já iniciadas');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Editar rotina' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.getByRole('button', { name: 'Pausar Inglês', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pausar rotina' })).toContainText('cancela compromissos pendentes de hoje');
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  const english = page.locator('.routine').filter({ hasText: 'Inglês' });
  await expect(english).toHaveClass(/paused/);
  await expect(english.locator('.routine-status')).toHaveText('Pausada');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Protótipo de Agenda validado: layout em quatro larguras, editar com combo centralizado e confirmação contextual, parágrafo removido e estado de rotina pausada com realce textual e âmbar.');
} finally {
  await browser.close();
}
