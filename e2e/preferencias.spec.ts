import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

// T1524 — prova E2E real das Preferências do estudo (FR-200, FR-212 e FR-148;
// SC-081; specs/015-repeticao-espacada/tasks.md).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) são iniciados como
// processos filhos do próprio teste, em portas livres e com um arquivo SQLite
// temporário exclusivo. A navegação e a tela de Preferências são percorridas
// no Chromium pela tela real.
//
// O cenário cobre o padrão exibido na tela — SM-2 selecionado (FR-212). O
// limite de Cartões novos por dia saiu com a Revisão do dia, e com ele os
// cenários que o editavam: com um único algoritmo disponível, a Configuração
// não tem o que alterar pela tela.

test.setTimeout(180_000);

// --- Infraestrutura de execução real ---------------------------------------

interface Ambiente {
  pasta: string;
  api: ProcessoIniciado;
  frontend: ProcessoIniciado;
  enderecoDaApi: string;
  enderecoDoFrontend: string;
}

/**
 * Sobe a API real (SQLite em arquivo temporário exclusivo) e o frontend real
 * (Vite dev) em portas livres, aguardando a prontidão de cada um. Se algo
 * falhar no meio, limpa o que já subiu antes de propagar o erro — o `try`
 * externo do teste só cobre o caso de sucesso.
 */
async function subirAmbiente(): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria("preferencias-");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(join(pasta, "preferencias.sqlite"), portaDaApi);

    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

    await aguardarApiPronta(api, enderecoDaApi);

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    return { pasta, api, frontend, enderecoDaApi, enderecoDoFrontend };
  } catch (erro) {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
    throw erro;
  }
}

/** Encerra os dois processos e remove o arquivo e a pasta temporários. */
async function derrubarAmbiente(ambiente: Ambiente): Promise<void> {
  await encerrarProcesso(ambiente.frontend);
  await encerrarProcesso(ambiente.api);
  await removerPastaTemporaria(ambiente.pasta);
}

// --- Auxiliares de preparação e de tela ------------------------------------

/** Navega para Preferências pela navegação principal (FR-212). */
async function irParaPreferenciasPelaNavegacao(page: Page): Promise<void> {
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Perfil" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Perfil" }),
  ).toBeVisible();
}

// --- Cenário 1: os padrões exibidos ----------------------------------------

test("Preferências abre pela navegação com o SM-2 e sem limite de novos (FR-212)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);

    await page.goto(`${ambiente.enderecoDoFrontend}/#/inicio`);
    await entrarSeNecessario(page, credencial);

    await irParaPreferenciasPelaNavegacao(page);

    // Sem Preferências salvas, vale o padrão: SM-2 (FR-212, contrato §3.2).
    await expect(page.getByLabel("Algoritmo de repetição espaçada")).toHaveValue(
      "sm2",
    );
    await expect(page.getByLabel("Cartões novos por dia")).toHaveCount(0);
  } finally {
    await derrubarAmbiente(ambiente);
  }
});
