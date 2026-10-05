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
  await expect(page.locator('#resultados .bf-etiqueta')).toHaveText('Revisado');
  await page.getByLabel('Buscar baralhos').fill('');
  await expect(page.locator('#resultados .bf-etiqueta')).toHaveCount(5);
  await expect(page.locator('#resultados li', { hasText: 'História do Brasil' }).locator('.bf-etiqueta')).toHaveText('Sem cartões');
  await expect(page.getByRole('button', { name: 'Revisar Inglês cotidiano' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Revisar História do Brasil' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Estudar/ })).toHaveCount(0);
  // O filtro de Situação passou a viver em Baralhos e usa a etiqueta derivada dos Cartões.
  await expect(page.locator('#campo-situacao')).toBeVisible();
  await expect(page.locator('#campo-baralho')).toBeHidden();
  const opcoesDeSituacao = await page.locator('#situacao option').allTextContents();
  if (opcoesDeSituacao.join(',') !== 'Todos,Pendente,Revisado') throw new Error(`Opções de situação inesperadas: ${opcoesDeSituacao.join(',')}`);
  await page.locator('#situacao').selectOption('pendente');
  await expect(page.locator('#resultados li')).toHaveCount(3);
  await expect(page.locator('#resultados .bf-etiqueta')).toHaveText(['Pendente', 'Pendente', 'Pendente']);
  await expect(page.locator('#resultados')).not.toContainText('História do Brasil');
  await page.locator('#situacao').selectOption('revisado');
  await expect(page.locator('#resultados li')).toHaveCount(1);
  await expect(page.locator('#resultados')).toContainText('Álgebra linear');
  await expect(page.locator('#resultados .bf-etiqueta')).toHaveText('Revisado');
  await page.locator('#situacao').selectOption('todos');
  // Modal de revisão (024, FR-383): nome, contagens, foco inicial e Escape sem iniciar.
  const revisar = (nome) => page.getByRole('button', { name: `Revisar ${nome}`, exact: true });
  const modal = page.getByRole('dialog', { name: 'Revisar baralho' });
  await page.getByLabel('Buscar baralhos').fill('inglês');
  await expect(page.locator('#resultados li')).toHaveCount(1);
  await revisar('Inglês cotidiano').click();
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Inglês cotidiano');
  await expect(modal.locator('#contagem-pendentes')).toHaveText('1 Cartão');
  await expect(modal.locator('#contagem-todas')).toHaveText('2 Cartões');
  await expect(modal.getByRole('button', { name: 'Só pendentes', exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Todos os cartões', exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: new URL('modal-revisao-1440.png', captures).pathname, fullPage: true });
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(revisar('Inglês cotidiano')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Revisar Inglês cotidiano' })).toHaveCount(0);
  // Cancelar e Escape não iniciam Sessão e preservam a busca aplicada.
  await expect(page.getByLabel('Buscar baralhos')).toHaveValue('inglês');
  await expect(page.locator('#resultados li')).toHaveCount(1);

  // Modal em 390 px: sem rolagem horizontal; Cancelar fecha mantendo os filtros.
  await page.setViewportSize({ width: 390, height: 844 });
  await revisar('Inglês cotidiano').click();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Overflow modal de revisão 390');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: new URL('modal-revisao-390.png', captures).pathname, fullPage: true });
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByLabel('Buscar baralhos')).toHaveValue('inglês');
  await expect(page.locator('#resultados li')).toHaveCount(1);

  // Só pendentes inicia o subconjunto (novos entram); interromper não altera etiquetas.
  await revisar('Inglês cotidiano').click();
  await modal.getByRole('button', { name: 'Só pendentes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revisar Inglês cotidiano' })).toBeVisible();
  await expect(page.locator('.bf-cartao')).toHaveAttribute('aria-label', 'Item 1 de 1');
  await expect(page.locator('.bf-cartao')).toContainText('Where is the nearest station?');
  await page.getByRole('button', { name: 'Revelar verso', exact: true }).click();
  await expect(page.locator('#verso-titulo')).toBeFocused();
  await expect(page.locator('.bf-cartao')).toContainText('Onde fica a estação mais próxima?');
  await expect(page.locator('.bf-avaliacoes button')).toHaveCount(4);
  await page.getByRole('button', { name: 'Interromper', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Interromper revisão?' })).toBeVisible();
  await page.locator('#cancelar').click();
  await expect(page.getByRole('heading', { name: 'Revisar Inglês cotidiano' })).toBeVisible();
  await page.getByRole('button', { name: 'Interromper', exact: true }).click();
  await page.locator('#confirmar').click();
  await expect(page.locator('#visao-lista')).toBeVisible();
  await expect(page.getByLabel('Buscar baralhos')).toHaveValue('inglês');
  await expect(page.locator('#resultados .bf-etiqueta')).toHaveText('Pendente');
  await page.getByLabel('Buscar baralhos').fill('viagens');
  await expect(page.locator('#resultados .bf-etiqueta')).toHaveText('Pendente');

  // Todos os cartões embaralha todos; avaliar e interromper não altera a situação.
  await page.getByLabel('Buscar baralhos').fill('inglês');
  await revisar('Inglês cotidiano').click();
  await modal.getByRole('button', { name: 'Todos os cartões', exact: true }).click();
  await expect(page.locator('.bf-cartao')).toHaveAttribute('aria-label', 'Item 1 de 2');
  await expect(page.locator('#progresso-revisao')).toHaveText('Cartão 1 de 2');
  await page.getByRole('button', { name: 'Revelar verso', exact: true }).click();
  await page.getByRole('button', { name: /^Bom/ }).click();
  await expect(page.locator('#progresso-revisao')).toHaveText('Cartão 2 de 2');
  await page.getByRole('button', { name: 'Interromper', exact: true }).click();
  await page.locator('#confirmar').click();
  await expect(page.locator('#visao-lista')).toBeVisible();
  await expect(page.locator('#resultados .bf-etiqueta')).toHaveText('Pendente');

  // Concluir Só pendentes simula em dia e atualiza etiquetas, inclusive de Baralhos que compartilham.
  await revisar('Inglês cotidiano').click();
  await modal.getByRole('button', { name: 'Só pendentes', exact: true }).click();
  await page.getByRole('button', { name: 'Revelar verso', exact: true }).click();
  await page.getByRole('button', { name: /^Bom/ }).click();
  await expect(page.getByRole('heading', { name: 'Sessão concluída' })).toBeVisible();
  await expect(page.locator('.bf-placar')).toHaveText('100%');
  await page.getByRole('button', { name: 'Voltar para Baralhos', exact: true }).click();
  await expect(page.locator('#visao-lista')).toBeVisible();
  await expect(page.getByLabel('Buscar baralhos')).toHaveValue('inglês');
  await expect(page.locator('#resultados .bf-etiqueta')).toHaveText('Revisado');
  await page.getByLabel('Buscar baralhos').fill('viagens');
  await expect(page.locator('#resultados .bf-etiqueta')).toHaveText('Revisado');

  // Baralho Revisado inicia todos direto, sem modal.
  await page.getByLabel('Buscar baralhos').fill('inglês');
  await revisar('Inglês cotidiano').click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Revisar Inglês cotidiano' })).toBeVisible();
  await expect(page.locator('.bf-cartao')).toHaveAttribute('aria-label', 'Item 1 de 2');
  await page.getByRole('button', { name: 'Interromper', exact: true }).click();
  await page.locator('#confirmar').click();
  await expect(page.locator('#visao-lista')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: 'Cartões', exact: true }).click();
  await expect(page.locator('#campo-baralho')).toBeVisible();
  await expect(page.getByLabel('Situação da revisão')).toBeHidden();
  await page.getByLabel('Buscar cartões').fill('ATP');
  await expect(page.locator('#resultados li')).toHaveCount(1);
  await expect(page.locator('#resultados')).toContainText('mitocôndrias');
  await expect(page.getByLabel('Buscar cartões')).toBeFocused();
  await page.locator('#limpar').click();
  await page.getByLabel('Baralho', { exact: true }).selectOption('ingles');
  await expect(page.locator('#resultados li')).toHaveCount(2);
  await page.screenshot({ path: new URL('cartoes-filtrados-1440.png', captures).pathname, fullPage: true });
  await page.locator('#cenario').selectOption('falha');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('#baralho')).toHaveValue('ingles');
  await expect(page.locator('#resultados li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Excluir How are you?' }).click();
  await expect(page.locator('#dialogo').getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Excluir How are you?' })).toBeFocused();
  await page.getByRole('button', { name: 'Excluir How are you?' }).click();
  await page.locator('#confirmar').click();
  await expect(page.locator('#resultados li')).toHaveCount(1);
  await expect(page.locator('#resultados')).toContainText('Where is the nearest station?');
  await expect(page.locator('#baralho')).toHaveValue('ingles');
  await page.locator('#limpar').click();
  await page.locator('#baralho').selectOption('sem');
  await expect(page.locator('#resultados li')).toHaveCount(2);
  await page.locator('#cenario').selectOption('sem-resultados');
  await expect(page.getByRole('heading', { name: 'Nenhum resultado encontrado' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: new URL('cartoes-sem-resultados-390.png', captures).pathname, fullPage: true });
  await page.locator('#cenario').selectOption('vazio');
  await expect(page.locator('#resultados')).toContainText('Ainda não há Cartões');
  await page.locator('#reiniciar').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.body.style.zoom = '200%');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Overflow zoom CSS 200%');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Protótipo validado: 2 telas × 4 larguras; busca normalizada e no Verso; Situação derivada dos Cartões (Pendente/Revisado/Sem cartões) e filtro em Baralhos; ausência do seletor de situação em Cartões; modal de revisão com nome, contagens, foco inicial e Escape; Só pendentes inicia o subconjunto (novos incluídos) e Todos os cartões embaralha todos; Revisado inicia direto sem modal; interromper não altera a situação; concluir simula em dia e atualiza etiquetas, inclusive de Baralhos que compartilham Cartões; filtros preservados ao cancelar modal; filtros combinados; sem baralho; recuperação; exclusão; foco; estados vazios; fluxo de revisão em 390 px; zoom CSS 200%. 12 capturas geradas.');
} finally {
  await browser.close();
}
