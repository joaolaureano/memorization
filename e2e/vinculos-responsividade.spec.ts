import { expect, test } from '@playwright/test';

import {
  entrarPelaUi,
  prepararEntradaInterceptada,
} from './servidores-locais';

// T213 — tela de Vínculos utilizável em largura de telefone
// (FR-042; specs/003-vincular-cartao-baralho/tasks.md).
//
// Exercita o frontend React real servido pelo Vite dev (webServer do harness),
// não uma cópia HTML da tela: `src/main.tsx` monta `Aplicacao` com o
// `ClienteHttp`, e o Playwright intercepta apenas o transporte — o
// GET /baralhos/b1 devolve o Baralho com Cartões vinculados, e o GET /cartoes
// devolve todos os Cartões do acervo. Nenhum DOM da tela é reproduzido aqui.
//
// Provas: sem rolagem horizontal em viewport de telefone (scrollWidth <=
// clientWidth, no topo e no fim da lista) e um Cartão conhecido é visualmente
// localizável sem busca ou paginação.

const PORTA_DO_FRONTEND = Number(process.env.E2E_PORTA_DO_FRONTEND ?? 5173);
const ENDERECO_DO_FRONTEND = `http://127.0.0.1:${PORTA_DO_FRONTEND}`;

const QUANTIDADE_DE_CARTOES = 13;
const QUANTIDADE_DE_VINCULADOS = 5;

function cartoesDeterministicos(): Array<{
  id: string;
  frente: string;
  verso: string;
  baralhos: Array<{ id: string; nome: string }>;
}> {
  return Array.from({ length: QUANTIDADE_DE_CARTOES }, (_, indice) => {
    const numero = String(indice + 1).padStart(2, '0');

    return {
      id: `c${numero}`,
      frente: `Frente do Cartão ${numero}`,
      verso: `Verso do Cartão ${numero}`,
      baralhos:
        indice < QUANTIDADE_DE_VINCULADOS
          ? [{ id: 'b1', nome: 'Inglês' }]
          : [],
    };
  });
}

test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

test('tela de Vínculos permanece utilizável e sem rolagem horizontal em telefone (FR-042)', async ({ page, browserName }) => {
  // Navegador real: Chromium em viewport de telefone, não um DOM simulado.
  expect(browserName).toBe('chromium');

  const cartoes = cartoesDeterministicos();

  // A prova entra antes de medir: sem Credencial, a única tela é "Entrar"
  // (FR-097, FR-090).
  const credencial = await prepararEntradaInterceptada(page);
  const vinculados = cartoes
    .slice(0, QUANTIDADE_DE_VINCULADOS)
    .map(({ id, frente, verso }) => ({ id, frente, verso }));

  await page.route(/\/baralhos\/b1$/, async (rota) => {
    if (rota.request().method() === 'GET') {
      await rota.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'b1',
          nome: 'Inglês',
          elegivel: true,
          cartoes: vinculados,
        }),
      });
      return;
    }

    await rota.fallback();
  });

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

  await page.goto(`${ENDERECO_DO_FRONTEND}/#/baralhos/b1`);
  await entrarPelaUi(page, credencial);

  // A tela real de Vínculos carrega: o Baralho, a elegibilidade e as duas
  // listas — a dos vinculados e a dos ainda não vinculados.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Inglês' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Cartões do Baralho' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Cartões não vinculados' }),
  ).toBeVisible();
  await expect(page.getByText('Elegível para estudo.')).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(QUANTIDADE_DE_CARTOES);

  /** Largura do conteúdo além da janela: 0 quando não há rolagem horizontal. */
  const medirExcessoDeLargura = () =>
    page.evaluate(() => {
      const raiz = document.documentElement;

      return Math.max(raiz.scrollWidth, document.body.scrollWidth) -
        raiz.clientWidth;
    });

  // Sem rolagem horizontal já no topo da lista.
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);

  // A lista é navegável até o fim: a rolagem vertical alcança o último
  // Cartão não vinculado, visualmente localizável sem busca ou paginação.
  const ultimoCartao = cartoes[QUANTIDADE_DE_CARTOES - 1];
  const itemConhecido = page
    .getByRole('listitem')
    .filter({ hasText: ultimoCartao.frente });

  await itemConhecido.scrollIntoViewIfNeeded();
  await expect(itemConhecido).toBeVisible();
  await expect(itemConhecido).toContainText(ultimoCartao.verso);

  // E continua sem rolagem horizontal com a lista rolada até o fim.
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);
});
