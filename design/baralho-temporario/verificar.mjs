import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const captures = new URL('./capturas/', import.meta.url);
await mkdir(captures, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(new URL('./index.html', import.meta.url).href);
  async function scenario(name) {
    await page.locator('#cenario').selectOption(name);
    await page.locator('#abrir-cenario').click();
  }
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const screen of ['baralhos', 'selecao', 'sessao', 'resumo', 'salvar']) {
      await scenario(screen);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow ${screen} ${width}`);
      await page.screenshot({ path: new URL(`${screen}-${width}.png`, captures).pathname, fullPage: true });
    }
  }
  await scenario('baralhos');
  const newButton = page.getByRole('button', { name: 'Criar baralho temporário', exact: true });
  await expect(newButton).toHaveClass(/botao--secundario/);
  await newButton.click();
  await expect(page.getByRole('button', { name: 'Estudar', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Adicionar Inglês cotidiano', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar Viagens', exact: true }).click();
  await expect(page.locator('#selecao li')).toHaveCount(4);
  await page.getByRole('button', { name: 'Adicionar cartões', exact: true }).click();
  await page.getByLabel('Baralho', { exact: true }).selectOption('sem');
  await expect(page.locator('#lista-fontes li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Adicionar O que significa aprender ativamente?', exact: true }).click();
  await expect(page.locator('#selecao li')).toHaveCount(5);
  await page.getByLabel('Buscar cartões', { exact: true }).fill('inexistente');
  await expect(page.locator('#lista-fontes')).toContainText('Nenhum resultado');
  await expect(page.locator('#selecao li')).toHaveCount(5);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('#dialogo-cancelar')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Estudar', exact: true }).click();
  const fronts = new Set();
  for (let i = 0; i < 5; i++) {
    fronts.add(await page.locator('.conteudo-do-cartao').first().textContent());
    await expect(page.locator('.avaliacoes')).toHaveCount(0);
    await page.getByRole('button', { name: 'Revelar verso', exact: true }).click();
    await expect(page.locator('#verso-titulo')).toBeFocused();
    await page.keyboard.press(i === 0 ? '1' : '3');
  }
  if (fronts.size !== 5) throw new Error('Cartão duplicado ou ausente na Sessão');
  await expect(page.getByRole('heading', { name: 'Sessão concluída' })).toBeVisible();
  await expect(page.locator('.placar')).toHaveText('80%');
  await page.getByRole('button', { name: 'Salvar como baralho', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('#erro-salvar')).toContainText('1 a 100');
  await expect(page.getByLabel('Nome do baralho')).toBeFocused();
  await page.getByLabel('Nome do baralho').fill('Minha seleção');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir baralho', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Minha seleção' })).toBeVisible();
  await expect(page.locator('#tela li')).toHaveCount(5);
  await page.getByRole('button', { name: 'Voltar para Baralhos', exact: true }).click();
  await expect(page.locator('#lista-baralhos li')).toHaveCount(5);
  await scenario('falha-registro');
  await expect(page.getByRole('button', { name: 'Salvar como baralho', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Tentar registrar novamente' }).click();
  await expect(page.getByRole('button', { name: 'Salvar como baralho', exact: true })).toBeEnabled();
  await scenario('falha-salvar');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('#erro-salvar')).toContainText('Não foi possível salvar');
  await expect(page.getByLabel('Nome do baralho')).toHaveValue('Inglês para a próxima viagem');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir baralho', exact: true })).toBeVisible();
  await scenario('indisponivel');
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retirar indisponíveis', exact: true }).click();
  await expect(page.locator('#form-salvar')).toContainText('4 Cartões serão vinculados');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('#tela')).toContainText('4 de 5 Cartões');
  await page.getByRole('button', { name: 'Abrir baralho', exact: true }).click();
  await expect(page.locator('#tela li')).toHaveCount(4);
  await scenario('falha-carga');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('#lista-fontes li')).toHaveCount(4);
  await scenario('vazio');
  await expect(page.locator('#lista-fontes')).toContainText('Seu acervo está vazio');
  await scenario('selecao');
  await page.evaluate(() => document.body.style.zoom = '200%');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Overflow zoom CSS 200%');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Protótipo 023 validado: 5 telas em 4 larguras; fluxo completo com 5 cartões únicos, filtros, descarte/Escape, avaliação por teclado, salvamento, falhas e recuperação, indisponíveis sem alterar resumo e zoom CSS 200%. 20 capturas geradas.');
} finally { await browser.close(); }
