import { expect, test } from '@playwright/test';

// T714 — a tela "Entrar" permanece utilizável em largura de telefone
// (FR-042; specs/008-entrar/tasks.md).
//
// Exercita o frontend React real servido pelo Vite dev (webServer do harness),
// não uma cópia HTML da tela: `src/main.tsx` monta `Aplicacao` com o
// `ClienteHttp`. A tela "Entrar" é a primeira e única sem Credencial (FR-097);
// a recusa é interceptada no transporte, porque é o texto da recusa real que
// precisa conviver com a coluna única (FR-046).
//
// Provas: Nome de usuário, Senha, Entrar e Criar conta alcançáveis em coluna
// única, sem rolagem horizontal em viewport de telefone (scrollWidth <=
// clientWidth, no topo e depois da recusa), e a recusa exibida sem introduzir
// rolagem.

const PORTA_DO_FRONTEND = Number(process.env.E2E_PORTA_DO_FRONTEND ?? 5173);
const ENDERECO_DO_FRONTEND = `http://127.0.0.1:${PORTA_DO_FRONTEND}`;

const SENHA_ERRADA = 'senha-que-nao-confere';

test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

test('a tela Entrar permanece utilizável e sem rolagem horizontal em telefone (FR-042)', async ({ page, browserName }) => {
  // Navegador real: Chromium em viewport de telefone, não um DOM simulado.
  expect(browserName).toBe('chromium');

  // A recusa de Entrar vem do contrato: uma só mensagem, sem revelar qual
  // parte da Credencial falhou (FR-088).
  await page.route(/\/entrar$/, async (rota) => {
    await rota.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        erro: 'credencial_invalida',
        mensagem: 'Nome de usuário ou Senha incorretos.',
      }),
    });
  });

  await page.goto(`${ENDERECO_DO_FRONTEND}/#/entrar`);

  // A tela real chega com os dois campos, a ação de Entrar e o acesso a Criar
  // conta — sem navegação principal, que só existe depois de Entrar (FR-098).
  await expect(
    page.getByRole('heading', { level: 1, name: 'Entrar' }),
  ).toBeVisible();

  const campoDoNome = page.getByLabel('Nome de usuário', { exact: true });
  const campoDaSenha = page.getByLabel('Senha', { exact: true });
  const botaoDeEntrada = page.getByRole('button', { name: 'Entrar' });
  const acessoAoCadastro = page.getByRole('link', { name: 'Criar conta' });

  await expect(campoDoNome).toBeVisible();
  await expect(campoDaSenha).toBeVisible();
  await expect(botaoDeEntrada).toBeVisible();
  await expect(botaoDeEntrada).toBeEnabled();
  await expect(acessoAoCadastro).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(
    0,
  );

  /** Largura do conteúdo além da janela: 0 quando não há rolagem horizontal. */
  const medirExcessoDeLargura = () =>
    page.evaluate(() => {
      const raiz = document.documentElement;

      return Math.max(raiz.scrollWidth, document.body.scrollWidth) -
        raiz.clientWidth;
    });

  // Sem rolagem horizontal com os dois campos e o acesso ao Cadastro.
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);

  // A recusa é exibida na própria tela, e continua sem rolagem horizontal.
  await campoDoNome.fill('ana.silva');
  await campoDaSenha.fill(SENHA_ERRADA);
  await botaoDeEntrada.click();

  const recusa = page.getByRole('alert', { name: 'Falha ao Entrar' });

  await expect(recusa).toBeVisible();
  await expect(recusa).toContainText('Nome de usuário ou Senha incorretos.');
  await expect(page.getByLabel('Senha', { exact: true })).toBeFocused();
  await expect(campoDoNome).toHaveValue('ana.silva');
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');

  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);
  await expect(botaoDeEntrada).toBeVisible();
  await expect(acessoAoCadastro).toBeVisible();
});
