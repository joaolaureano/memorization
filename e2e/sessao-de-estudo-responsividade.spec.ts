import { expect, test } from '@playwright/test';

import {
  entrarPelaUi,
  prepararEntradaInterceptada,
} from './servidores-locais';

// T307 — Sessão de estudo utilizável em largura de telefone e em português
// (FR-042, FR-046; specs/004-sessao-de-estudo/tasks.md).
//
// Exercita o frontend React real servido pelo Vite dev (webServer do harness),
// não uma cópia HTML da tela: `src/main.tsx` monta `Aplicacao` com o
// `ClienteHttp`, e o Playwright intercepta apenas o transporte — o
// GET /baralhos/b1 devolve o Baralho elegível com três Cartões vinculados.
// Nenhum DOM da tela é reproduzido aqui.
//
// Provas: sem rolagem horizontal em viewport de telefone no início, depois da
// Revelação e depois do Resultado; e os controles canônicos — Iniciar Sessão,
// Revelar verso, Errei, Difícil, Bom, Fácil e Interromper — permanecem
// visíveis e em português (FR-193, SC-088). O "Interromper" abre a confirmação
// "Interromper a Sessão?", também em português, e "Cancelar" mantém o Item em
// curso (FR-046).

const PORTA_DO_FRONTEND = Number(process.env.E2E_PORTA_DO_FRONTEND ?? 5173);
const ENDERECO_DO_FRONTEND = `http://127.0.0.1:${PORTA_DO_FRONTEND}`;

const CARTOES = [
  { id: 'c1', frente: 'To walk', verso: 'Caminhar' },
  { id: 'c2', frente: 'To run', verso: 'Correr' },
  { id: 'c3', frente: 'To read', verso: 'Ler' },
];

test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

test('Sessão de estudo permanece utilizável e sem rolagem horizontal em telefone (FR-042, FR-046)', async ({ page, browserName }) => {
  // Navegador real: Chromium em viewport de telefone, não um DOM simulado.
  expect(browserName).toBe('chromium');

  await page.route(/\/baralhos\/b1$/, async (rota) => {
    if (rota.request().method() === 'GET') {
      await rota.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'b1',
          nome: 'Inglês',
          elegivel: true,
          cartoes: CARTOES,
        }),
      });
      return;
    }

    await rota.fallback();
  });

  // A prova entra antes de medir: sem Credencial, a única tela é "Entrar"
  // (FR-097, FR-090).
  const credencial = await prepararEntradaInterceptada(page);

  await page.goto(`${ENDERECO_DO_FRONTEND}/#/baralhos/b1/estudo`);
  await entrarPelaUi(page, credencial);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Estudar Inglês' }),
  ).toBeVisible();
  await expect(page.getByLabel('Quantidade de Cartões')).toBeVisible();
  await expect(
    page.getByText('Este Baralho tem 3 Cartões vinculados.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Iniciar Sessão' }),
  ).toBeVisible();

  /** Largura do conteúdo além da janela: 0 quando não há rolagem horizontal. */
  const medirExcessoDeLargura = () =>
    page.evaluate(() => {
      const raiz = document.documentElement;

      return Math.max(raiz.scrollWidth, document.body.scrollWidth) -
        raiz.clientWidth;
    });

  // Sem rolagem horizontal já na tela de início.
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);

  await page.getByLabel('Quantidade de Cartões').fill('2');
  await page.getByRole('button', { name: 'Iniciar Sessão' }).click();

  await expect(
    page.getByRole("article", { name: "Item 1 de 2" }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Revelar verso' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Interromper' }),
  ).toBeVisible();
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);

  // Interromper pede confirmação; "Cancelar" mantém a Sessão e o Item atual.
  await page.getByRole('button', { name: 'Interromper' }).click();
  await expect(page.getByText('Interromper a Sessão?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(
    page.getByRole("article", { name: "Item 1 de 2" }),
  ).toBeVisible();
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Revelar verso' }).click();

  await expect(page.getByRole('heading', { name: 'Verso' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Errei/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Difícil/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Bom/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Fácil/ }),
  ).toBeVisible();
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: /^Bom/ }).click();

  await expect(
    page.getByRole("article", { name: "Item 2 de 2" }),
  ).toBeVisible();
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);
});
