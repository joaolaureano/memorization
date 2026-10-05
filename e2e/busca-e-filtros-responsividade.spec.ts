import { expect, test, type Locator } from '@playwright/test';

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
// o transporte — GET /cartoes responde 6 Cartões (os 3 primeiros no Baralho
// "Inglês cotidiano") e GET /baralhos responde 2 Baralhos. Nenhum DOM da tela
// é reproduzido aqui.
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

/** 6 Cartões determinísticos: os 3 primeiros no Baralho "Inglês cotidiano". */
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
      baralhos: indice < 3 ? [{ id: 'b1', nome: 'Inglês cotidiano' }] : [],
      proximaRevisaoEm: null,
    };
  });
}

/** Os 2 Baralhos do seletor de filtro da tela de Cartões (spec 022). */
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
      const filtroDeSituacao = page.getByRole('combobox', {
        name: 'Situação da revisão',
      });
      const limparFiltros = page
        .getByRole('button', { name: 'Limpar filtros' })
        .first();
      const contagem = page.getByRole('status').filter({
        hasText: /resultado/,
      });

      // 1. A tela carrega com a lista inteira, sem estourar a largura da
      // janela, e busca e filtros têm alvo de toque (44 px).
      await expect(page.getByText('6 resultados')).toBeVisible();
      expect(await semRolagemHorizontal()).toBe(true);

      const alvosDeToque = [buscaDeCartoes, filtroDeBaralho, filtroDeSituacao];

      for (const alvo of alvosDeToque) {
        const caixa = await exigirCaixa(alvo);

        expect(caixa.height).toBeGreaterThanOrEqual(44);
      }

      const caixaDeLimparFiltros = await exigirCaixa(limparFiltros);

      expect(caixaDeLimparFiltros.height).toBeGreaterThanOrEqual(44);
      expect(caixaDeLimparFiltros.width).toBeGreaterThanOrEqual(44);

      // 2. Teclado: digitar filtra sem tirar o foco, Tab percorre Baralho,
      // Situação e Limpar filtros; Enter limpa e devolve o foco à busca.
      await buscaDeCartoes.focus();
      await page.keyboard.type('03');

      await expect(buscaDeCartoes).toBeFocused();
      await expect(contagem).toContainText('1 resultado');

      await page.keyboard.press('Tab');
      await expect(filtroDeBaralho).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(filtroDeSituacao).toBeFocused();

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

      // 4. Baralhos: a mesma busca responde na tela de Baralhos, que a
      // sessão já aberta alcança sem recarregar o documento.
      await page.goto(`${ENDERECO_DO_FRONTEND}/#/baralhos`);

      await expect(page.getByText('2 resultados')).toBeVisible();

      const buscaDeBaralhos = page.getByRole('searchbox', {
        name: 'Buscar baralhos',
      });
      const caixaDaBuscaDeBaralhos = await exigirCaixa(buscaDeBaralhos);

      expect(caixaDaBuscaDeBaralhos.height).toBeGreaterThanOrEqual(44);

      await buscaDeBaralhos.fill('algebra');

      await expect(page.getByText('1 resultado')).toBeVisible();
      expect(await semRolagemHorizontal()).toBe(true);
    } finally {
      await contexto.close();
    }
  });
}
