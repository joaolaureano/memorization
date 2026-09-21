import { expect, test } from '@playwright/test';

// T613 — a tela "Criar conta" permanece utilizável em largura de telefone
// (FR-042; specs/007-criar-usuario/tasks.md).
//
// Exercita o frontend React real servido pelo Vite dev (segundo webServer do
// harness), não uma cópia HTML da tela: `src/main.tsx` monta `Aplicacao` com o
// `ClienteHttp`. A prova é de apresentação e de acessibilidade, e não de rede:
// a recusa exibida é a de Confirmação divergente, decidida na própria tela
// (FR-072) — **nada é enviado**, então nenhuma rota é interceptada.
//
// Provas: os três campos e a recusa convivem em coluna única, sem rolagem
// horizontal em viewport de telefone (scrollWidth <= clientWidth, no topo e
// depois da recusa), e a ação de concluir continua visível.

const PORTA_DO_FRONTEND = Number(process.env.E2E_PORTA_DO_FRONTEND ?? 5173);
const ENDERECO_DO_FRONTEND = `http://127.0.0.1:${PORTA_DO_FRONTEND}`;

test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

test('a tela Criar conta permanece utilizável e sem rolagem horizontal em telefone (FR-042)', async ({ page, browserName }) => {
  // Navegador real: Chromium em viewport de telefone, não um DOM simulado.
  expect(browserName).toBe('chromium');

  await page.goto(`${ENDERECO_DO_FRONTEND}/#/criar-conta`);

  // A tela real chega com os três campos e a ação de concluir.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Criar conta' }),
  ).toBeVisible();

  const campoDoNome = page.getByLabel('Nome de usuário', { exact: true });
  const campoDaSenha = page.getByLabel('Senha', { exact: true });
  const campoDaConfirmacao = page.getByLabel('Confirmação da Senha', { exact: true });
  const botaoDeCadastro = page.getByRole('button', { name: 'Criar conta' });

  await expect(campoDoNome).toBeVisible();
  await expect(campoDaSenha).toBeVisible();
  await expect(campoDaConfirmacao).toBeVisible();
  await expect(botaoDeCadastro).toBeVisible();
  await expect(botaoDeCadastro).toBeEnabled();

  /** Largura do conteúdo além da janela: 0 quando não há rolagem horizontal. */
  const medirExcessoDeLargura = () =>
    page.evaluate(() => {
      const raiz = document.documentElement;

      return Math.max(raiz.scrollWidth, document.body.scrollWidth) -
        raiz.clientWidth;
    });

  // Sem rolagem horizontal já com os três campos exibidos.
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);

  // A recusa de Confirmação divergente é exibida na própria tela, sem enviar
  // nada: o campo passa a dividir o espaço em coluna única com a mensagem.
  await campoDoNome.fill('Ana.Silva');
  await campoDaSenha.fill('senha-de-prova');
  await campoDaConfirmacao.fill('outra-senha');
  await botaoDeCadastro.click();

  const recusa = page.getByRole('alert', { name: 'Falha no Cadastro' });

  await expect(recusa).toBeVisible();
  await expect(recusa).toContainText(
    'A Senha e a Confirmação da Senha estão diferentes.',
  );
  await expect(page.getByLabel('Confirmação da Senha', { exact: true })).toBeFocused();

  // Continua sem rolagem horizontal com a recusa exibida, e a ação de
  // concluir segue visível na coluna única.
  expect(await medirExcessoDeLargura()).toBeLessThanOrEqual(0);
  await expect(botaoDeCadastro).toBeVisible();
});
