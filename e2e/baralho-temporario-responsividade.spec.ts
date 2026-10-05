// T2313 — responsividade do estudo com Baralho temporário (spec 023; SC-148, FR-377)
//
// Prova, contra o frontend React real (não uma cópia HTML da tela), que a
// montagem, a Sessão e o Resumo do estudo temporário cabem na largura da
// janela — nenhum pixel do documento ultrapassa `clientWidth` — e que todo
// controle tem alvo de toque de 44 px em 360, 390, 768 e 1440 px. Cobre
// também o reflow de 640 px (equivalente a 1280 px com zoom de 200%) e a
// montagem percorrível só por teclado.
//
// O ambiente (API + Vite dev) sobe uma vez por arquivo — `describe.serial` —
// e cada caso abre a própria página para fixar o viewport. O acervo é o mesmo
// do spec funcional: C1–C3 avulsos e o Baralho «Inglês» com C1 + C2.

import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  criarBaralhoPelaApi,
  criarCartaoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  portaLivre,
  removerPastaTemporaria,
  vincularCartaoPelaApi,
  AMBIENTE_COM_RELOGIO_FIXO,
  fixarRelogioDoContexto,
} from "./servidores-locais";
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

test.setTimeout(240_000);

// O dia de «hoje» é o mesmo na API e no navegador, e não o da máquina que roda.
test.beforeEach(async ({ context }) => {
  await fixarRelogioDoContexto(context);
});

/** As três frentes semeadas; o Baralho «Inglês» reúne as duas primeiras. */
const FRENTES = ["How are you?", "Good morning", "Thank you"] as const;
const LARGURAS = [360, 390, 768, 1440] as const;

interface Ambiente {
  pasta: string;
  api: ProcessoIniciado;
  frontend: ProcessoIniciado;
  enderecoDaApi: string;
  enderecoDoFrontend: string;
}

interface CartaoSemeado {
  id: string;
  frente: string;
  verso: string;
}

async function subirAmbiente(): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria("baralho-temporario-responsivo-");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(
      join(pasta, "baralho-temporario.sqlite"),
      portaDaApi,
      AMBIENTE_COM_RELOGIO_FIXO,
    );

    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

    await aguardarApiPronta(api, enderecoDaApi);

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(frontend, enderecoDoFrontend, (r) => r.ok);

    return { pasta, api, frontend, enderecoDaApi, enderecoDoFrontend };
  } catch (erro) {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
    throw erro;
  }
}

async function derrubarAmbiente(ambiente: Ambiente): Promise<void> {
  await encerrarProcesso(ambiente.frontend);
  await encerrarProcesso(ambiente.api);
  await removerPastaTemporaria(ambiente.pasta);
}

async function prepararCartao(
  ambiente: Ambiente,
  credencial: CredencialDeProva,
  frente: string,
  verso: string,
): Promise<CartaoSemeado> {
  return criarCartaoPelaApi(
    ambiente.enderecoDaApi,
    { frente, verso },
    credencial,
  );
}

async function prepararBaralho(
  ambiente: Ambiente,
  credencial: CredencialDeProva,
  nome: string,
  cartoes: CartaoSemeado[],
): Promise<void> {
  const baralho = await criarBaralhoPelaApi(
    ambiente.enderecoDaApi,
    { nome },
    credencial,
  );

  for (const cartao of cartoes) {
    await vincularCartaoPelaApi(
      ambiente.enderecoDaApi,
      cartao.id,
      baralho.id,
      credencial,
    );
  }
}

/** Verdadeiro quando o documento não ultrapassa a largura da janela. */
function semRolagemHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
}

/** Falha quando o alvo não está visível ou mede menos de 44 px de altura. */
async function exigirAlvoDeToque(alvo: Locator): Promise<void> {
  await expect(alvo).toBeVisible();

  const caixa = await alvo.boundingBox();

  expect(caixa).not.toBeNull();

  if (caixa === null) {
    throw new Error("Elemento sem caixa visível.");
  }

  expect(caixa.height).toBeGreaterThanOrEqual(44);
}

/** A região com a contagem da Seleção do estudo. */
function selecaoDoEstudo(page: Page) {
  return page.getByRole("region", { name: "Seleção do estudo" });
}

/** Os 4 botões de Avaliação liberados depois de «Revelar verso». */
function botoesDeAvaliacao(page: Page): Locator {
  return page.getByRole("button", { name: /^(Errei|Difícil|Bom|Fácil)/ });
}

/** Abre a montagem já Entrada e adiciona o Baralho «Inglês» (C1 + C2). */
async function abrirMontagem(
  page: Page,
  ambiente: Ambiente,
  credencial: CredencialDeProva,
): Promise<void> {
  await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/temporario`);
  await entrarSeNecessario(page, credencial);

  await expect(
    page.getByRole("heading", { name: "Criar baralho temporário" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Adicionar Inglês", exact: true })
    .click();

  await expect(selecaoDoEstudo(page)).toContainText("2 Cartões");
}

/** Percorre com Tab até o elemento focado ter o nome acessível pedido. */
async function tabularAte(
  page: Page,
  nome: string,
  maximo = 30,
): Promise<boolean> {
  for (let passo = 0; passo < maximo; passo++) {
    await page.keyboard.press("Tab");

    const focado = await page.evaluate(() => {
      const elemento = document.activeElement as HTMLElement | null;

      if (elemento === null) {
        return "";
      }

      const rotulo = elemento.getAttribute("aria-label");

      return (rotulo && rotulo.trim()) || (elemento.textContent ?? "").trim();
    });

    if (focado === nome) {
      return true;
    }
  }

  return false;
}

test.describe.serial("Responsividade do Baralho temporário", () => {
  let ambiente: Ambiente;
  let credencial: CredencialDeProva;

  test.beforeAll(async () => {
    ambiente = await subirAmbiente();

    credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.responsividade",
    );

    const c1 = await prepararCartao(ambiente, credencial, FRENTES[0], "Como você está?");
    const c2 = await prepararCartao(ambiente, credencial, FRENTES[1], "Bom dia");
    await prepararCartao(ambiente, credencial, FRENTES[2], "Obrigado");

    await prepararBaralho(ambiente, credencial, "Inglês", [c1, c2]);
  });

  test.afterAll(async () => {
    await derrubarAmbiente(ambiente);
  });

  for (const largura of LARGURAS) {
    test(`Montagem, Sessão e Resumo sem rolagem horizontal e com alvos de 44 px em ${largura} px (SC-148)`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });

      // 1. Montagem: depois de «Adicionar Inglês», nada estoura a janela e
      // os controles de comando e de remoção têm alvo de toque.
      await abrirMontagem(page, ambiente, credencial);

      expect(await semRolagemHorizontal(page)).toBe(true);

      for (const nome of [
        "Adicionar baralhos",
        "Adicionar cartões",
        "Revisar",
        "Cancelar",
        "Limpar seleção",
      ]) {
        await exigirAlvoDeToque(
          page.getByRole("button", { name: nome, exact: true }).first(),
        );
      }

      const remover = page.getByRole("button", { name: /^Remover / });
      const quantidadeDeRemover = await remover.count();

      expect(quantidadeDeRemover).toBeGreaterThan(0);

      for (let indice = 0; indice < quantidadeDeRemover; indice++) {
        await exigirAlvoDeToque(remover.nth(indice));
      }

      // 2. Sessão: «Revelar verso» e os 4 botões de Avaliação também cabem.
      await page.getByRole("button", { name: "Revisar", exact: true }).click();
      await expect(page).toHaveURL(/#\/baralhos\/temporario\/estudo$/);
      await expect(
        page.getByRole("heading", { name: "Revisar baralho temporário" }),
      ).toBeVisible();

      expect(await semRolagemHorizontal(page)).toBe(true);

      await exigirAlvoDeToque(
        page.getByRole("button", { name: "Revelar verso", exact: true }),
      );

      for (let indice = 1; indice <= 2; indice++) {
        await expect(
          page.getByRole("article", { name: `Item ${indice} de 2` }),
        ).toBeVisible();

        await page
          .getByRole("button", { name: "Revelar verso", exact: true })
          .click();

        const avaliacao = botoesDeAvaliacao(page);

        await expect(avaliacao).toHaveCount(4);

        for (let posicao = 0; posicao < 4; posicao++) {
          await exigirAlvoDeToque(avaliacao.nth(posicao));
        }

        await page.getByRole("button", { name: /^Bom/ }).click();
      }

      // 3. Resumo: «Salvar como baralho» habilita e a tela de salvamento
      // continua sem rolagem horizontal, com «Salvar» e «Cancelar» ≥ 44.
      await expect(
        page.getByRole("heading", { name: "Sessão concluída" }),
      ).toBeVisible();

      expect(await semRolagemHorizontal(page)).toBe(true);

      const salvarComoBaralho = page.getByRole("button", {
        name: "Salvar como baralho",
        exact: true,
      });

      await expect(salvarComoBaralho).toBeEnabled();
      await exigirAlvoDeToque(salvarComoBaralho);
      await salvarComoBaralho.click();

      expect(await semRolagemHorizontal(page)).toBe(true);

      await exigirAlvoDeToque(
        page.getByRole("button", { name: "Salvar", exact: true }).first(),
      );
      await exigirAlvoDeToque(
        page.getByRole("button", { name: "Cancelar", exact: true }).first(),
      );
    });
  }

  test("Montagem percorrível só por teclado em 1440 px (FR-377)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });

    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/temporario`);
    await entrarSeNecessario(page, credencial);

    await expect(
      page.getByRole("heading", { name: "Criar baralho temporário" }),
    ).toBeVisible();

    expect(await tabularAte(page, "Adicionar Inglês")).toBe(true);

    await page.keyboard.press("Enter");
    await expect(selecaoDoEstudo(page)).toContainText("2 Cartões");

    expect(await tabularAte(page, "Revisar")).toBe(true);

    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { level: 1, name: "Revisar baralho temporário" }),
    ).toBeVisible();
  });

  test("Reflow de 200% (640 px) mantém a montagem sem rolagem horizontal (SC-148)", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });

    await abrirMontagem(page, ambiente, credencial);

    expect(await semRolagemHorizontal(page)).toBe(true);
  });
});
