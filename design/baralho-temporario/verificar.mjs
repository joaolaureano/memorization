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
  // --- Situação derivada, etiquetas e filtro em Baralhos (024, FR-379–FR-382)
  await scenario('baralhos');
  await expect(page.getByRole('button', { name: 'Criar baralho temporário', exact: true })).toHaveClass(/botao--secundario/);
  const linhas = page.locator('#lista-baralhos li');
  const linhaDe = nome => page.locator('#lista-baralhos li').filter({ hasText: nome });
  await expect(linhas).toHaveCount(5);
  await expect(linhaDe('Inglês cotidiano').locator('.bf-etiqueta')).toHaveText('Pendente');
  await expect(linhaDe('Viagens').locator('.bf-etiqueta')).toHaveText('Pendente');
  await expect(linhaDe('Álgebra linear').locator('.bf-etiqueta')).toHaveText('Revisado');
  await expect(linhaDe('Biologia').locator('.bf-etiqueta')).toHaveText('Pendente');
  await expect(linhaDe('História do Brasil').locator('.bf-etiqueta')).toHaveText('Sem cartões');
  // Etiqueta imediatamente à esquerda e antes das ações na ordem de leitura.
  await expect(linhaDe('Viagens').locator('.bf-etiqueta + button')).toHaveText('Revisar');
  await expect(linhaDe('História do Brasil').getByRole('button', { name: 'Revisar História do Brasil', exact: true })).toBeDisabled();
  // Filtro combina com a busca e exclui vazios dos filtros não-Todos.
  await page.getByLabel('Situação da revisão').selectOption('pendente');
  await expect(linhas).toHaveCount(3);
  await expect(linhaDe('Álgebra linear')).toHaveCount(0);
  await expect(linhaDe('História do Brasil')).toHaveCount(0);
  await page.getByLabel('Buscar baralhos').fill('viagens');
  await expect(linhas).toHaveCount(1);
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await expect(page.getByLabel('Buscar baralhos')).toHaveValue('');
  await expect(linhas).toHaveCount(5);
  await page.getByLabel('Situação da revisão').selectOption('revisado');
  await expect(linhas).toHaveCount(1);
  await expect(linhaDe('Álgebra linear')).toHaveCount(1);
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await expect(linhas).toHaveCount(5);

  // --- Modal de Baralho pendente: foco inicial, Tab, Escape e escolhas (FR-383)
  const revisar = nome => page.getByRole('button', { name: `Revisar ${nome}`, exact: true });
  const modal = page.getByRole('dialog', { name: 'Revisar baralho' });
  await revisar('Inglês cotidiano').click();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
  await expect(modal.getByRole('button', { name: 'Só pendentes (2)', exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Todos os cartões (3)', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: 'Só pendentes (2)', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(revisar('Inglês cotidiano')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Revisar Inglês cotidiano' })).toHaveCount(0);

  // Só pendentes inicia o subconjunto, sem duplicatas e sem quantidade.
  await revisar('Inglês cotidiano').click();
  await modal.getByRole('button', { name: 'Só pendentes (2)', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revisar Inglês cotidiano' })).toBeVisible();
  const pendentes = new Set();
  for (let i = 0; i < 2; i++) {
    pendentes.add(await page.locator('.conteudo-do-cartao').first().textContent());
    await page.getByRole('button', { name: 'Revelar verso', exact: true }).click();
    await page.keyboard.press('3');
  }
  if (pendentes.size !== 2) throw new Error('Subconjunto pendente com Cartão duplicado ou ausente');
  // Revisão comum: origem ausente, sem Salvar como baralho, com Revisar novamente.
  await expect(page.getByRole('heading', { name: 'Sessão concluída' })).toBeVisible();
  await expect(page.locator('.resumo-demo > h1 + .texto-secundario')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Revisar novamente', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar como baralho', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir baralho', exact: true })).toHaveCount(0);
  // Concluir deixou os Cartões avaliados em dia, inclusive nos Baralhos que os compartilham.
  await page.getByRole('button', { name: 'Voltar para Baralhos', exact: true }).click();
  await expect(linhaDe('Inglês cotidiano').locator('.bf-etiqueta')).toHaveText('Revisado');
  await expect(linhaDe('Viagens').locator('.bf-etiqueta')).toHaveText('Pendente');

  // Interromper não atualiza a situação: o pendente de Viagens segue igual.
  await revisar('Viagens').click();
  await expect(modal.getByRole('button', { name: 'Só pendentes (1)', exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Todos os cartões (3)', exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Só pendentes (1)', exact: true }).click();
  await expect(page.locator('.cartao-de-estudo')).toHaveAttribute('aria-label', 'Item 1 de 1');
  await page.getByRole('button', { name: 'Interromper', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Descartar este percurso?' })).toBeVisible();
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  await revisar('Viagens').click();
  await expect(modal.getByRole('button', { name: 'Só pendentes (1)', exact: true })).toBeVisible();
  // Todos os cartões conclui o Baralho inteiro; Revisar novamente inicia direto.
  await modal.getByRole('button', { name: 'Todos os cartões (3)', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revisar Viagens' })).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Revelar verso', exact: true }).click();
    await page.keyboard.press('3');
  }
  await expect(page.getByRole('heading', { name: 'Sessão concluída' })).toBeVisible();
  await page.getByRole('button', { name: 'Revisar novamente', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Revisar Viagens' })).toBeVisible();
  await page.getByRole('button', { name: 'Interromper', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  // Baralho revisado inicia direto, sem modal.
  await expect(linhaDe('Viagens').locator('.bf-etiqueta')).toHaveText('Revisado');
  await revisar('Álgebra linear').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Revisar Álgebra linear' })).toBeVisible();
  await page.getByRole('button', { name: 'Interromper', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();

  // --- Montagem: filtro de situação sem etiquetas nas linhas (FR-382)
  await scenario('baralhos');
  await page.getByRole('button', { name: 'Criar baralho temporário', exact: true }).click();
  await expect(page.locator('#tela').getByRole('link', { name: /Voltar para Baralhos/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Revisar', exact: true })).toBeDisabled();
  await page.getByLabel(/Nome do baralho temporário/).fill('Baralho de viagem');
  const fonteDe = nome => page.locator('#lista-fontes li').filter({ hasText: nome });
  await expect(fonteDe('Álgebra linear').locator('.bf-etiqueta')).toHaveCount(0);
  await expect(fonteDe('História do Brasil').locator('.bf-etiqueta')).toHaveCount(0);
  await expect(fonteDe('História do Brasil').getByRole('button', { name: 'Adicionar História do Brasil', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Adicionar Inglês cotidiano', exact: true }).click();
  await expect(page.locator('#selecao li')).toHaveCount(3);
  await page.getByLabel('Situação da revisão').selectOption('revisado');
  await expect(page.locator('#lista-fontes li')).toHaveCount(1);
  await expect(page.locator('#selecao li')).toHaveCount(3);
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await expect(page.locator('#lista-fontes li')).toHaveCount(5);
  await page.getByRole('button', { name: 'Adicionar Viagens', exact: true }).click();
  await expect(page.locator('#selecao li')).toHaveCount(4);
  // Cartões mantém busca e Baralho; Situação sai da fonte de Cartões.
  await page.getByRole('button', { name: 'Adicionar cartões', exact: true }).click();
  await expect(page.getByLabel('Situação da revisão')).toHaveCount(0);
  await expect(page.getByLabel('Baralho', { exact: true })).toBeVisible();
  await page.getByLabel('Baralho', { exact: true }).selectOption('sem');
  await expect(page.locator('#lista-fontes li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Adicionar O que significa aprender ativamente?', exact: true }).click();
  await expect(page.locator('#selecao li')).toHaveCount(5);
  await page.getByLabel('Buscar cartões', { exact: true }).fill('inexistente');
  await expect(page.locator('#lista-fontes')).toContainText('Nenhum resultado');
  await expect(page.locator('#selecao li')).toHaveCount(5);

  // --- Revisão temporária inicia direto, sem modal, com salvamento opcional.
  await page.locator('#filtros-fontes').getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Revisar Baralho de viagem' })).toBeVisible();
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
  await expect(page.locator('.resumo-demo > h1 + .texto-secundario')).toHaveText('Estudo com Baralho de viagem');
  await expect(page.locator('.placar')).toHaveText('80%');
  await expect(page.locator('.detalhes-resultado summary', { hasText: 'Errei (1)' })).toBeVisible();
  await expect(page.locator('.detalhes-resultado summary', { hasText: 'Bom (4)' })).toBeVisible();
  await expect(page.locator('.detalhes-resultado summary', { hasText: 'Acertos (' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Revisar novamente', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Salvar como baralho', exact: true })).toBeEnabled();
  await expect(page.locator('#tela [role="status"]')).toHaveClass(/visualmente-oculto/);
  await page.getByRole('button', { name: 'Salvar como baralho', exact: true }).click();
  await expect(page.getByLabel('Nome do baralho')).toHaveValue('Baralho de viagem');
  await page.getByLabel('Nome do baralho').fill('');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('#erro-salvar')).toContainText('1 a 100');
  await expect(page.getByLabel('Nome do baralho')).toBeFocused();
  await page.getByLabel('Nome do baralho').fill('Minha seleção');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir baralho', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Minha seleção' })).toBeVisible();
  await expect(page.locator('#tela li')).toHaveCount(5);
  // Revisar também vale para o Baralho salvo (aqui Revisado, inicia direto).
  await page.getByRole('button', { name: 'Revisar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Revisar Minha seleção' })).toBeVisible();
  await page.getByRole('button', { name: 'Interromper', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  // A conclusão da revisão temporária também deixou os Baralhos em dia.
  await expect(linhaDe('Inglês cotidiano').locator('.bf-etiqueta')).toHaveText('Revisado');
  await expect(linhaDe('Viagens').locator('.bf-etiqueta')).toHaveText('Revisado');
  await expect(linhaDe('Biologia').locator('.bf-etiqueta')).toHaveText('Pendente');
  await expect(page.locator('#lista-baralhos li')).toHaveCount(6);

  await scenario('resumo');
  await expect(page.locator('.resumo-demo > h1 + .texto-secundario')).toHaveText('Estudo com Baralho temporário');
  await page.getByRole('button', { name: 'Salvar como baralho', exact: true }).click();
  await expect(page.getByLabel('Nome do baralho')).toHaveValue('Baralho temporário');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

  // Registros anteriores à Avaliação mantêm um único grupo Sem avaliação.
  await scenario('resumo-legado');
  await expect(page.locator('.detalhes-resultado summary', { hasText: 'Sem avaliação (5)' })).toBeVisible();
  await expect(page.locator('.detalhes-resultado summary', { hasText: 'Errei (' })).toHaveCount(0);

  // --- Falhas e recuperações existentes.
  await scenario('falha-registro');
  await expect(page.getByRole('button', { name: 'Salvar como baralho', exact: true })).toBeDisabled();
  await expect(page.locator('#tela [role="status"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tentar registrar novamente' }).click();
  await expect(page.getByRole('button', { name: 'Salvar como baralho', exact: true })).toBeEnabled();
  await expect(page.locator('#tela [role="status"]')).toHaveText('Sessão registrada no histórico.');
  await expect(page.locator('#tela [role="status"]')).toHaveClass(/visualmente-oculto/);
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
  await expect(page.locator('#lista-fontes')).toContainText('Não foi possível carregar');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('#lista-fontes li')).toHaveCount(5);
  await scenario('vazio');
  await expect(page.locator('#lista-fontes')).toContainText('Seu acervo está vazio');
  await scenario('selecao');
  await page.evaluate(() => document.body.style.zoom = '200%');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Overflow zoom CSS 200%');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Protótipo 024 validado: 5 telas em 4 larguras; etiquetas e filtro na lista principal; montagem com filtro sem etiquetas e nome opcional; grupos por avaliação e fallback legado; revisão temporária com nome reutilizado ao salvar; fluxos e recuperações; zoom CSS 200%. Capturas geradas.');
} finally { await browser.close(); }
