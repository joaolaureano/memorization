import { expect, test } from '@playwright/test';

import {
  entrarPelaUi,
  prepararEntradaInterceptada,
} from './servidores-locais';

// T307 — Sessão de estudo (agora "Revisar") utilizável em largura de telefone
// e em português (FR-042, FR-046; specs/004-sessao-de-estudo/tasks.md; spec 024).
//
// Exercita o frontend React real servido pelo Vite dev (webServer do harness),
// não uma cópia HTML da tela: `src/main.tsx` monta `Aplicacao` com o
// `ClienteHttp`, e o Playwright intercepta apenas o transporte — o
// GET /baralhos/b1 devolve o Baralho elegível com dois Cartões vinculados
// (ambos novos, ou seja, Pendentes) e o GET /cartoes corrobora a situação.
// Nenhum DOM da tela é reproduzido aqui.
//
// Na spec 024 o formulário de início (Quantidade de Cartões + Iniciar Sessão)
// saiu: no lugar, o Baralho Pendente abre o modal "Revisar baralho" e o botão
// "Só pendentes" começa a Sessão com todos os Cartões pendentes.
//
// Provas: sem rolagem horizontal em viewport de telefone com o modal aberto e
// depois da Revelação e do Resultado; e os controles canônicos — Revelar
// verso, Errei, Difícil, Bom, Fácil e Interromper — permanecem visíveis e em
// português (FR-193, SC-088). O "Interromper" abre a confirmação "Interromper
// a Sessão?", também em português, e "Cancelar" mantém o Item em curso
// (FR-046).

const PORTA_DO_FRONTEND = Number(process.env.E2E_PORTA_DO_FRONTEND ?? 5173);
const ENDERECO_DO_FRONTEND = `http://127.0.0.1:${PORTA_DO_FRONTEND}`;

const CARTOES = [
  { id: 'c1', frente: 'To walk', verso: 'Caminhar', proximaRevisaoEm: null },
  {
    id: 'c2',
    frente: 'Frente longa '.repeat(76),
    verso: 'Verso longo '.repeat(83),
    proximaRevisaoEm: null,
  },
];

test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

for (const largura of [360, 390, 768, 1440]) {
test(`Sessão ${largura}px permanece utilizável e sem rolagem horizontal em telefone (FR-042, FR-046)`, async ({ page, browserName }) => {
  await page.setViewportSize({ width: largura, height: 900 });
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

  // A situação do Baralho é derivada do GET /cartoes (spec 024); os dois
  // Cartões novos o deixam Pendente.
  await page.route(/\/cartoes$/, async (rota) => {
    if (rota.request().method() === 'GET') {
      await rota.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          CARTOES.map((cartao) => ({
            ...cartao,
            baralhos: [{ id: 'b1', nome: 'Inglês' }],
          })),
        ),
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

  // O formulário antigo de início não existe mais (spec 024).
  await expect(page.getByLabel('Quantidade de Cartões')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Iniciar Sessão' }),
  ).toHaveCount(0);

  // Baralho Pendente: o modal decide entre pendentes e todos.
  const modal = page.getByRole('dialog');

  await expect(modal).toBeVisible();
  await expect(modal.getByText('Revisar baralho')).toBeVisible();
  await expect(
    modal.getByRole('button', { name: 'Só pendentes', exact: true }),
  ).toBeVisible();
  await expect(
    modal.getByRole('button', { name: 'Todos os cartões', exact: true }),
  ).toBeVisible();
  await expect(
    modal.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeVisible();

  /** Largura do conteúdo além da janela: 0 quando não há rolagem horizontal. */
  const medirExcessoDeLargura = () =>
    page.evaluate(() => {
      const raiz = document.documentElement;

      return Math.max(raiz.scrollWidth, document.body.scrollWidth) -
        raiz.clientWidth;
    });

  // Sem rolagem horizontal já com o modal aberto.
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);

  await modal.getByRole('button', { name: 'Só pendentes', exact: true }).click();

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

  const cartao = page.getByRole('article');
  const medir = () => cartao.evaluate((elemento) => {
    const caixa = elemento.getBoundingClientRect();
    return { width: caixa.width, height: caixa.height, top: caixa.top + window.scrollY };
  });
  const inicial = await medir();
  await page.getByRole('button', { name: 'Revelar verso' }).click();
  expect(await medir()).toEqual(inicial);
  // A linha de Avaliações é medida no documento, como o cartão: a rolagem da
  // página entre um Item e outro não é o que se prova aqui.
  const medirBotoes = () =>
    page.locator('.botoes-de-resultado').evaluate((elemento) => {
      const caixa = elemento.getBoundingClientRect();
      return {
        width: caixa.width,
        height: caixa.height,
        top: caixa.top + window.scrollY,
      };
    });
  const botoes = await medirBotoes();

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

  // As quatro Avaliações ficam numa única linha, lado a lado.
  const topos = await page
    .locator('.botoes-de-resultado > .botao')
    .evaluateAll((botoes) =>
      botoes.map((botao) => Math.round(botao.getBoundingClientRect().top)),
    );
  expect(topos).toHaveLength(4);
  expect(new Set(topos).size).toBe(1);

  await page.getByRole('button', { name: /^Bom/ }).click();

  await expect(
    page.getByRole("article", { name: "Item 2 de 2" }),
  ).toBeVisible();
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);
  expect(await medir()).toEqual(inicial);
  await page.getByRole('button', { name: 'Revelar verso' }).click();
  expect(await medir()).toEqual(inicial);
  expect(await medirBotoes()).toEqual(botoes);
});
}
