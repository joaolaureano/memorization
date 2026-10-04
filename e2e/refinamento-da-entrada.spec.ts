import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { prepararAcessoAusente } from './servidores-locais';

// T2010 — matriz visual e de teclado do refinamento da tela Entrar (spec 020;
// FR-327–329, FR-338, SC-131–133).
//
// Exercita o frontend React real servido pelo Vite dev. Como em
// entrar-responsividade, o acesso ausente é preparado no transporte: a tela
// Entrar é a primeira e única sem Credencial.
//
// Provas, em 360, 390, 768 e 1440 px e com zoom de 200% (720 px @2x):
// - sobretítulo «Bem-vindo» e opção de acesso sem texto de ajuda (FR-327, FR-328);
// - caixa de marcar grande de 37 px e rótulo clicável de pelo menos 44 x 44 px (FR-328);
// - Mostrar/Ocultar com 7 rem de largura, antes e depois de alternar (FR-329);
// - sem rolagem horizontal e com a ordem de Tab Nome de usuário → Senha →
//   Mostrar → opção de acesso → Entrar (FR-338).

const PORTA_DO_FRONTEND = Number(process.env.E2E_PORTA_DO_FRONTEND ?? 5173);
const ENDERECO_DO_FRONTEND = `http://127.0.0.1:${PORTA_DO_FRONTEND}`;

const CENARIOS = [
  { nome: '360', largura: 360, escala: 1 },
  { nome: '390', largura: 390, escala: 1 },
  { nome: '768', largura: 768, escala: 1 },
  { nome: '1440', largura: 1440, escala: 1 },
  { nome: 'zoom 200%', largura: 720, escala: 2 },
];

async function larguraEmRem(page: Page, nome: string): Promise<number> {
  return await page.getByRole('button', { name: nome }).evaluate((botao) => {
    const raiz = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    return botao.getBoundingClientRect().width / raiz;
  });
}

for (const cenario of CENARIOS) {
  test.describe(`Entrar em ${cenario.nome}`, () => {
    test.use({
      viewport: { width: cenario.largura, height: 900 },
      deviceScaleFactor: cenario.escala,
    });

    test(`textos, caixa de marcar, Mostrar/Ocultar e teclado (FR-327–329, FR-338)`, async ({
      page,
    }) => {
      await prepararAcessoAusente(page);
      await page.goto(`${ENDERECO_DO_FRONTEND}/#/entrar`);

      await expect(page.getByText('Bem-vindo', { exact: true })).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Entrar' }),
      ).toBeVisible();

      // FR-328: a opção de acesso mantém o rótulo e não tem texto de ajuda.
      const opcao = page.getByLabel('Continuar conectado neste navegador');

      await expect(opcao).toBeVisible();
      await expect(opcao).not.toHaveAttribute('aria-describedby', /.+/);

      const medidasDaOpcao = await opcao.evaluate((caixa) => {
        const rotulo = caixa.closest('label');
        const alvo = rotulo?.getBoundingClientRect();
        const propria = caixa.getBoundingClientRect();

        return {
          caixa: [propria.width, propria.height],
          alvo: alvo === undefined ? null : [alvo.width, alvo.height],
        };
      });

      expect(medidasDaOpcao.caixa).toEqual([37, 37]);
      expect(medidasDaOpcao.alvo).not.toBeNull();
      expect(medidasDaOpcao.alvo?.[0] ?? 0).toBeGreaterThanOrEqual(44);
      expect(medidasDaOpcao.alvo?.[1] ?? 0).toBeGreaterThanOrEqual(44);

      // FR-329: 7 rem de largura, sem variação ao alternar.
      const antes = await larguraEmRem(page, 'Mostrar Senha');

      expect(antes).toBeCloseTo(7, 1);

      await page.getByRole('button', { name: 'Mostrar Senha' }).click();

      const depois = await larguraEmRem(page, 'Ocultar Senha');

      expect(depois).toBeCloseTo(antes, 1);

      await page.getByRole('button', { name: 'Ocultar Senha' }).click();

      // FR-338: sem rolagem horizontal.
      const excesso = await page.evaluate(() => {
        const raiz = document.documentElement;

        return Math.max(raiz.scrollWidth, document.body.scrollWidth) -
          raiz.clientWidth;
      });

      expect(excesso).toBeLessThanOrEqual(0);

      // FR-338: o teclado percorre a tela na ordem visual, com o foco visível.
      await page.getByLabel('Nome de usuário', { exact: true }).focus();

      const ordem: string[] = [];

      for (let passo = 0; passo < 5; passo += 1) {
        ordem.push(
          await page.evaluate(() => {
            const ativo = document.activeElement as HTMLElement | null;
            const rotulo =
              ativo instanceof HTMLInputElement
                ? ativo.labels?.[0]?.textContent?.trim()
                : undefined;

            return (
              ativo?.getAttribute('aria-label') ??
              rotulo ??
              ativo?.textContent?.trim() ??
              ''
            );
          }),
        );
        await page.keyboard.press('Tab');
      }

      expect(ordem[0]).toMatch(/Nome de usuário/);
      expect(ordem[1]).toMatch(/Senha/);
      expect(ordem[2]).toBe('Mostrar Senha');
      expect(ordem[3]).toBe('Continuar conectado neste navegador');
      expect(ordem[4]).toBe('Entrar');
    });
  });
}
