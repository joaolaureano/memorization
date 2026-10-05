import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  entrarPelaUi,
  prepararEntradaInterceptada,
} from './servidores-locais';

// T2208 — busca e filtros utilizáveis por teclado e sem rolagem horizontal em
// 360, 390, 768 e 1440 px e com zoom de 200% (spec 022; FR-358, SC-142).
//
// Exercita o frontend React real servido pelo Vite dev (segundo webServer do
// harness), não uma cópia HTML da tela: `src/main.tsx` monta as páginas de
// Cartões e de Baralhos com o `ClienteHttp`, e o Playwright intercepta apenas
// o transporte — GET /cartoes responde 6 Cartões (c01–c03 no Baralho "Inglês
// cotidiano", c04 em "Álgebra linear" já agendado para o futuro e c05/c06 sem
// Baralho) e GET /baralhos responde 3 Baralhos. Nenhum DOM da tela é
// reproduzido aqui.
//
// Na spec 024 o filtro "Situação da revisão" saiu da tela de Cartões (que
// mantém busca e Baralho) e passou para a lista de Baralhos, alimentado pelo
// cruzamento entre GET /baralhos e GET /cartoes — por isso os dois mocks.
//
// Cada caso abre o próprio contexto porque viewport e `deviceScaleFactor`
// (o zoom de 200%) são fixados na criação do contexto. As provas são: os
// controles de busca e filtro têm alvo de toque, respondem às teclas (foco,
// Tab, Enter, digitação) e nenhum pixel do documento ultrapassa a largura da
// janela (scrollWidth <= clientWidth).

const PORTA_DO_FRONTEND = Number(process.env.E2E_PORTA_DO_FRONTEND ?? 5173);
const ENDERECO_DO_FRONTEND = `http://127.0.0.1:${PORTA_DO_FRONTEND}`;

const CASOS = [
  { nome: '360 px', viewport: { width: 360, height: 800 }, escala: 1 },
  { nome: '390 px', viewport: { width: 390, height: 844 }, escala: 1 },
  { nome: '768 px', viewport: { width: 768, height: 1024 }, escala: 1 },
  { nome: '1440 px', viewport: { width: 1440, height: 900 }, escala: 1 },
  { nome: 'zoom de 200%', viewport: { width: 720, height: 900 }, escala: 2 },
];

/** 6 Cartões determinísticos: c01–c03 em "Inglês cotidiano" e c04 em
 * "Álgebra linear" (spec 024); c05/c06 ficam sem Baralho. */
function cartoesInterceptados(): Array<{
  id: string;
  frente: string;
  verso: string;
  baralhos: Array<{ id: string; nome: string }>;
  proximaRevisaoEm: string | null;
}> {
  return Array.from({ length: 6 }, (_, indice) => {
    const numero = String(indice + 1).padStart(2, '0');

    return {
      id: `c${numero}`,
      frente: `Frente do Cartão ${numero}`,
      verso: `Verso do Cartão ${numero}`,
      baralhos:
        indice < 3
          ? [{ id: 'b1', nome: 'Inglês cotidiano' }]
          : indice === 3
            ? [{ id: 'b2', nome: 'Álgebra linear' }]
            : [],
      // c01–c03 novos (Pendente); c04 agendado para o futuro (Revisado).
      proximaRevisaoEm: indice === 3 ? '2099-01-01T12:00:00.000Z' : null,
    };
  });
}

/** Os Baralhos do seletor de filtro da tela de Cartões e da lista de
 * Baralhos (specs 022 e 024): "Inglês cotidiano" sai Pendente (Cartões novos
 * interceptados), "Álgebra linear" sai Revisado (único Cartão no futuro) e
 * "Vazio" sai "Sem cartões" (nenhum Cartão aponta para ele). */
const BARALHOS = [
  {
    id: 'b1',
    nome: 'Inglês cotidiano',
    quantidadeDeCartoes: 3,
    elegivel: true,
  },
  {
    id: 'b2',
    nome: 'Álgebra linear',
    quantidadeDeCartoes: 1,
    elegivel: true,
  },
  {
    id: 'b3',
    nome: 'Vazio',
    quantidadeDeCartoes: 0,
    elegivel: false,
  },
];

/** Caixa visível do elemento: falha quando ele não está renderizado. */
async function exigirCaixa(locator: Locator) {
  const caixa = await locator.boundingBox();

  expect(caixa).not.toBeNull();

  if (caixa === null) {
    throw new Error('Elemento sem caixa visível.');
  }

  return caixa;
}

/** Item da lista de Baralhos cujo nome é exatamente `nome` (spec 024). */
function itemDeBaralho(page: Page, nome: string) {
  return page
    .getByRole('listitem')
    .filter({ has: page.getByText(nome, { exact: true }) });
}

for (const caso of CASOS) {
  test(`busca e filtros utilizáveis por teclado e sem rolagem horizontal em ${caso.nome} (FR-358, SC-142)`, async ({ browser }) => {
    const contexto = await browser.newContext({
      viewport: caso.viewport,
      deviceScaleFactor: caso.escala,
    });

    try {
      const page = await contexto.newPage();

      // Depois de `008-entrar`, o acervo só é alcançado com Credencial: a
      // prova intercepta o Entrar e entra antes de medir a tela (FR-097,
      // FR-090).
      const credencial = await prepararEntradaInterceptada(page);

      const cartoes = cartoesInterceptados();

      await page.route(/\/cartoes$/, async (rota) => {
        if (rota.request().method() === 'GET') {
          await rota.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(cartoes),
          });
          return;
        }

        await rota.fallback();
      });

      await page.route(/\/baralhos$/, async (rota) => {
        if (rota.request().method() === 'GET') {
          await rota.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(BARALHOS),
          });
          return;
        }

        await rota.fallback();
      });

      await page.goto(ENDERECO_DO_FRONTEND);
      await entrarPelaUi(page, credencial);

      // Troca de fragmento: o documento não recarrega e a Credencial em
      // memória continua valendo.
      await page.goto(`${ENDERECO_DO_FRONTEND}/#/cartoes`);

      /** Verdadeiro quando o documento não ultrapassa a largura da janela. */
      const semRolagemHorizontal = () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        );

      const buscaDeCartoes = page.getByRole('searchbox', {
        name: 'Buscar cartões',
      });
      const filtroDeBaralho = page.getByRole('combobox', { name: 'Baralho' });
      const limparFiltros = page
        .getByRole('button', { name: 'Limpar filtros' })
        .first();
      const contagem = page.getByRole('status').filter({
        hasText: /resultado/,
      });

      // 1. A tela carrega com a lista inteira, sem estourar a largura da
      // janela, e busca e filtros têm alvo de toque (44 px). A situação da
      // revisão não é mais um filtro desta tela (spec 024).
      await expect(page.getByText('6 resultados')).toBeVisible();
      expect(await semRolagemHorizontal()).toBe(true);

      await expect(
        page.getByRole('combobox', { name: 'Situação da revisão' }),
      ).toHaveCount(0);

      const alvosDeToque = [buscaDeCartoes, filtroDeBaralho];

      for (const alvo of alvosDeToque) {
        const caixa = await exigirCaixa(alvo);

        expect(caixa.height).toBeGreaterThanOrEqual(44);
      }

      const caixaDeLimparFiltros = await exigirCaixa(limparFiltros);

      expect(caixaDeLimparFiltros.height).toBeGreaterThanOrEqual(44);
      expect(caixaDeLimparFiltros.width).toBeGreaterThanOrEqual(44);

      // 2. Teclado: digitar filtra sem tirar o foco, Tab percorre Baralho e
      // Limpar filtros; Enter limpa e devolve o foco à busca.
      await buscaDeCartoes.focus();
      await page.keyboard.type('03');

      await expect(buscaDeCartoes).toBeFocused();
      await expect(contagem).toContainText('1 resultado');

      await page.keyboard.press('Tab');
      await expect(filtroDeBaralho).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(limparFiltros).toBeFocused();

      await page.keyboard.press('Enter');
      await expect(buscaDeCartoes).toBeEmpty();
      await expect(buscaDeCartoes).toBeFocused();
      await expect(contagem).toContainText('6 resultados');

      // 3. Filtrar por Baralho encolhe a lista para os 3 Cartões de "Inglês
      // cotidiano", ainda sem rolagem horizontal.
      await filtroDeBaralho.selectOption({ label: 'Inglês cotidiano' });

      await expect(contagem).toContainText('3 resultados');
      expect(await semRolagemHorizontal()).toBe(true);

      // 4. Baralhos: a mesma busca responde na tela de Baralhos, que a sessão
      // já aberta alcança sem recarregar o documento. Aqui também vivem a
      // etiqueta e o filtro de situação da revisão (spec 024), derivados do
      // cruzamento entre GET /baralhos e GET /cartoes.
      await page.goto(`${ENDERECO_DO_FRONTEND}/#/baralhos`);

      await expect(page.getByText('3 resultados')).toBeVisible();

      const buscaDeBaralhos = page.getByRole('searchbox', {
        name: 'Buscar baralhos',
      });
      const filtroDeSituacao = page.getByRole('combobox', {
        name: 'Situação da revisão',
      });
      const caixaDaBuscaDeBaralhos = await exigirCaixa(buscaDeBaralhos);
      const caixaDoFiltroDeSituacao = await exigirCaixa(filtroDeSituacao);

      expect(caixaDaBuscaDeBaralhos.height).toBeGreaterThanOrEqual(44);
      expect(caixaDoFiltroDeSituacao.height).toBeGreaterThanOrEqual(44);

      const linhaDoIngles = itemDeBaralho(page, 'Inglês cotidiano');
      const linhaDaAlgebra = itemDeBaralho(page, 'Álgebra linear');
      const linhaVazia = itemDeBaralho(page, 'Vazio');

      await expect(
        linhaDoIngles.getByText('Pendente', { exact: true }),
      ).toBeVisible();
      await expect(
        linhaDaAlgebra.getByText('Revisado', { exact: true }),
      ).toBeVisible();
      await expect(
        linhaVazia.getByText('Sem cartões', { exact: true }),
      ).toBeVisible();

      await buscaDeBaralhos.fill('algebra');

      await expect(page.getByText('1 resultado')).toBeVisible();
      expect(await semRolagemHorizontal()).toBe(true);

      await buscaDeBaralhos.fill('');

      await expect(page.getByText('3 resultados')).toBeVisible();

      await filtroDeSituacao.selectOption({ label: 'Pendente' });
      await expect(page.getByText('1 resultado')).toBeVisible();
      await expect(linhaDoIngles).toBeVisible();

      await filtroDeSituacao.selectOption({ label: 'Revisado' });
      await expect(page.getByText('1 resultado')).toBeVisible();
      await expect(linhaDaAlgebra).toBeVisible();

      await filtroDeSituacao.selectOption({ label: 'Todos' });
      await expect(page.getByText('3 resultados')).toBeVisible();
      expect(await semRolagemHorizontal()).toBe(true);
    } finally {
      await contexto.close();
    }
  });
}
