import { expect, test } from '@playwright/test';

import {
  entrarPelaUi,
  prepararEntradaInterceptada,
} from './servidores-locais';

// T111 — telas utilizáveis em largura de telefone, com 10 Baralhos
// (FR-042, SC-011; specs/002-criar-baralho/tasks.md).
//
// Exercita o frontend React real servido pelo Vite dev (segundo webServer do
// harness), não uma cópia HTML da tela: `src/main.tsx` monta `Aplicacao` com o
// `ClienteHttp`, e o Playwright intercepta apenas o transporte — o
// GET /baralhos responde 10 Baralhos determinísticos. Nenhum DOM da tela é
// reproduzido aqui.
//
// Provas: sem rolagem horizontal em viewport de telefone (scrollWidth <=
// clientWidth, no topo e no fim da lista) e um Baralho conhecido é visualmente
// localizável sem busca ou paginação, com a elegibilidade comunicada por texto.

const PORTA_DO_FRONTEND = Number(process.env.E2E_PORTA_DO_FRONTEND ?? 5173);
const ENDERECO_DO_FRONTEND = `http://127.0.0.1:${PORTA_DO_FRONTEND}`;

const QUANTIDADE_DE_BARALHOS = 10;

/** 10 Baralhos determinísticos, todos não elegíveis nesta feature. */
function baralhosDeterministicos(): Array<{
  id: string;
  nome: string;
  quantidadeDeCartoes: number;
  elegivel: boolean;
}> {
  return Array.from({ length: QUANTIDADE_DE_BARALHOS }, (_, indice) => {
    const numero = String(indice + 1).padStart(2, '0');

    return {
      id: `b${numero}`,
      nome: `Baralho ${numero}`,
      quantidadeDeCartoes: 0,
      elegivel: false,
    };
  });
}

test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

test('lista com 10 Baralhos permanece utilizável e sem rolagem horizontal em telefone (FR-042, SC-011)', async ({ page, browserName }) => {
  // Navegador real: Chromium em viewport de telefone, não um DOM simulado.
  expect(browserName).toBe('chromium');

  const baralhos = baralhosDeterministicos();

  // A prova entra antes de medir: sem Credencial, a única tela é "Entrar"
  // (FR-097, FR-090).
  const credencial = await prepararEntradaInterceptada(page);

  await page.route(/\/baralhos$/, async (rota) => {
    if (rota.request().method() === 'GET') {
      await rota.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(baralhos),
      });
      return;
    }

    await rota.fallback();
  });

  await page.goto(`${ENDERECO_DO_FRONTEND}/#/baralhos`);
  await entrarPelaUi(page, credencial);

  // A tela real de Baralhos carrega: cabeçalho, formulário de criação e a
  // lista com os 10 Baralhos do acervo interceptado.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Baralhos' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Novo Baralho' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar Baralho' })).toBeEnabled();
  await expect(page.getByRole('listitem')).toHaveCount(QUANTIDADE_DE_BARALHOS);

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
  // Baralho, e o Baralho conhecido é visualmente localizável sem busca ou
  // paginação, com a elegibilidade comunicada por texto.
  const ultimoBaralho = baralhos[QUANTIDADE_DE_BARALHOS - 1];
  const itemConhecido = page
    .getByRole('listitem')
    .filter({ hasText: ultimoBaralho.nome });

  await itemConhecido.scrollIntoViewIfNeeded();
  await expect(itemConhecido).toBeVisible();
  await expect(itemConhecido).toContainText(
    'Não elegível para estudo: nenhum Cartão vinculado.',
  );

  // E continua sem rolagem horizontal com a lista rolada até o fim.
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);
});
