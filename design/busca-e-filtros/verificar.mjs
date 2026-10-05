import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const captures = new URL('./capturas/', import.meta.url);
await mkdir(captures, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const screen of ['baralhos', 'cartoes']) {
      await page.goto(new URL(`./index.html#${screen}`, import.meta.url).href);
      await expect(page.locator('#resultados li')).toHaveCount(screen === 'baralhos' ? 5 : 8);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow: ${screen} ${width}`);
      await page.screenshot({ path: new URL(`${screen}-${width}.png`, captures).pathname, fullPage: true });
    }
  }
  await page.goto(new URL('./index.html#baralhos', import.meta.url).href);
  await page.getByLabel('Buscar baralhos').fill('  ALGEBRA  ');
  await expect(page.locator('#resultados li')).toHaveCount(1);
  await expect(page.locator('#resultados')).toContainText('Álgebra linear');
  await page.getByRole('link', { name: 'Cartões', exact: true }).click();
  await page.getByLabel('Buscar cartões').fill('ATP');
  await expect(page.locator('#resultados li')).toHaveCount(1);
  await expect(page.locator('#resultados')).toContainText('mitocôndrias');
  await expect(page.getByLabel('Buscar cartões')).toBeFocused();
  await page.locator('#limpar').click();
  await page.getByLabel('Baralho', { exact: true }).selectOption('ingles');
  await page.getByLabel('Situação da revisão').selectOption('pendente');
  await expect(page.locator('#resultados li')).toHaveCount(1);
  await expect(page.locator('#resultados')).toContainText('How are you?');
  await page.screenshot({ path: new URL('cartoes-filtrados-1440.png', captures).pathname, fullPage: true });
  await page.locator('#cenario').selectOption('falha');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('#baralho')).toHaveValue('ingles');
  await expect(page.locator('#situacao')).toHaveValue('pendente');
  await expect(page.locator('#resultados li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Excluir How are you?' }).click();
  await expect(page.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Excluir How are you?' })).toBeFocused();
  await page.getByRole('button', { name: 'Excluir How are you?' }).click();
  await page.locator('#confirmar').click();
  await expect(page.getByRole('heading', { name: 'Nenhum resultado encontrado' })).toBeVisible();
  await expect(page.locator('#baralho')).toHaveValue('ingles');
  await page.locator('#limpar').click();
  await page.locator('#baralho').selectOption('sem');
  await expect(page.locator('#resultados li')).toHaveCount(2);
  await page.locator('#situacao').selectOption('novos');
  await expect(page.locator('#resultados li')).toHaveCount(1);
  await page.locator('#cenario').selectOption('sem-resultados');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: new URL('cartoes-sem-resultados-390.png', captures).pathname, fullPage: true });
  await page.locator('#cenario').selectOption('vazio');
  await expect(page.locator('#resultados')).toContainText('Ainda não há Cartões');
  await page.locator('#reiniciar').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.body.style.zoom = '200%');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Overflow zoom CSS 200%');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Protótipo validado: 2 telas × 4 larguras; busca normalizada e no Verso; filtros combinados; sem baralho; recuperação; exclusão; foco; estados vazios; zoom CSS 200%. 10 capturas geradas.');
} finally {
  await browser.close();
}
