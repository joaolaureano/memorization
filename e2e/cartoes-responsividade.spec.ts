import { expect, test } from '@playwright/test';

// T013 — telas utilizáveis em largura de telefone (FR-042, SC-011;
// specs/001-criar-cartao/tasks.md).
//
// Exercita o frontend React real servido pelo Vite dev (segundo webServer do
// harness), não uma cópia HTML da tela: `src/main.tsx` monta `PaginaDeCartoes`
// com o `ClienteHttp`, e o Playwright intercepta apenas o transporte — o
// GET /cartoes responde 50 Cartões determinísticos. Nenhum DOM da tela é
// reproduzido aqui.
//
// Provas: sem rolagem horizontal em viewport de telefone (scrollWidth <=
// clientWidth, no topo e no fim da lista) e um Cartão conhecido é visualmente
// localizável sem busca ou paginação.

const PORTA_DO_FRONTEND = Number(process.env.E2E_PORTA_DO_FRONTEND ?? 5173);
const ENDERECO_DO_FRONTEND = `http://127.0.0.1:${PORTA_DO_FRONTEND}`;

const QUANTIDADE_DE_CARTOES = 50;

/** 50 Cartões determinísticos, cada um com Frente e Verso próprios. */
function cartoesDeterministicos(): Array<{
  id: string;
  frente: string;
  verso: string;
}> {
  return Array.from({ length: QUANTIDADE_DE_CARTOES }, (_, indice) => {
    const numero = String(indice + 1).padStart(2, '0');

    return {
      id: `c${numero}`,
      frente: `Frente do Cartão ${numero}`,
      verso: `Verso do Cartão ${numero}`,
    };
  });
}

test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

test('lista com 50 Cartões permanece utilizável e sem rolagem horizontal em telefone (FR-042, SC-011)', async ({ page, browserName }) => {
  // Navegador real: Chromium em viewport de telefone, não um DOM simulado.
  expect(browserName).toBe('chromium');

  const cartoes = cartoesDeterministicos();

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

  await page.goto(ENDERECO_DO_FRONTEND);

  // A tela real de Cartões carrega: cabeçalho, formulário de criação e a
  // lista com os 50 Cartões do acervo interceptado.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Cartões' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Novo Cartão' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar Cartão' })).toBeEnabled();
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
  // Cartão, e o Cartão conhecido é visualmente localizável sem busca ou
  // paginação.
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
