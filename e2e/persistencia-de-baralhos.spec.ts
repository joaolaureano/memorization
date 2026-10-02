import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { MIGRACOES } from "../backend/src/armazenamento/sqlite/migracoes";

import {
  aguardarProntidao,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  lerVersaoDoEsquema,
  listarBaralhosPelaApi,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

// T112 — prova E2E real de persistência e de migração única
// (FR-040, SC-003; specs/002-criar-baralho/tasks.md).
//
// Diferente de T111, nenhuma rede é interceptada e nenhum dado é fabricado: a
// API real (node + SQLite em arquivo) e o frontend real (Vite dev) são
// iniciados como processos filhos do próprio teste, em portas livres e com um
// arquivo SQLite temporário exclusivo. No Chromium, dois Baralhos de mesmo
// nome são criados pela tela real de Baralhos; API e frontend são então
// encerrados e reiniciados apontando para o mesmo arquivo; a UI é reaberta e
// os dois Baralhos precisam reaparecer com o mesmo nome, não elegíveis e com
// os mesmos ids, conferidos também direto na API. A versão do esquema é lida
// do arquivo nas duas subidas: permanece a versão mais recente exportada
// pelas migrações do backend, provando que a migração de Baralho — como as
// demais — rodou uma única vez.
//
// O teste aguarda a prontidão de cada processo antes de usá-lo e encerra
// ambos no `finally`, inclusive quando a prova falha no meio.

const NOME_DO_BARALHO = "Inglês";

/** A versão que uma base nova deve registrar depois que todas as migrações rodam. */
const ULTIMA_VERSAO_DO_ESQUEMA = MIGRACOES.reduce(
  (maisRecente, migracao) => Math.max(maisRecente, migracao.versao),
  0,
);

test.setTimeout(120_000);

test("Baralhos criados pela UI persistem após reiniciar API e frontend, e a migração não reaplica (FR-040, SC-003)", async ({ page, browserName }) => {
  // Navegador real: Chromium, sem DOM simulado.
  expect(browserName).toBe("chromium");

  const pasta = await criarPastaTemporaria("baralhos-t112-");
  const caminhoDoBanco = join(pasta, "baralhos.sqlite");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    // Primeira execução: API com arquivo SQLite temporário exclusivo e
    // frontend real, cada um em porta livre e aguardando prontidão.
    const portaDaApi = await portaLivre();

    api = iniciarApi(caminhoDoBanco, portaDaApi);

    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

    await aguardarApiPronta(api, enderecoDaApi);

    // A primeira subida aplica todas as migrações pendentes: a base nova
    // termina na versão mais recente do esquema.
    const versaoNaPrimeiraSubida = lerVersaoDoEsquema(caminhoDoBanco);
    expect(versaoNaPrimeiraSubida).toBe(ULTIMA_VERSAO_DO_ESQUEMA);

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    // O Usuário de prova é cadastrado antes de qualquer operação de acervo
    // (FR-090), e a UI real exige Entrar antes de mostrar a lista.
    await criarUsuarioDeProva(enderecoDaApi);

    // A UI real abre a lista de Baralhos sobre um acervo vazio.
    await page.goto(`${enderecoDoFrontend}/#/baralhos`);
    await entrarSeNecessario(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Baralhos" }),
    ).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(0);
    // Na UI de 012 a lista não tem formulário inline: criar é uma página
    // própria, alcançada pelo link "Criar baralho".
    await expect(
      page.getByRole("link", { name: "Criar baralho" }),
    ).toBeVisible();

    // Dois Baralhos com o mesmo nome, como no roteiro da spec: o nome é
    // rótulo, não identificador. Cada POST chega ao banco SQLite em arquivo.
    // Criar Baralho agora é uma página própria (#/baralhos/novo) e o sucesso
    // leva ao detalhe do Baralho novo, de onde se volta à lista pela
    // navegação principal.
    await criarBaralhoPelaUi(page, NOME_DO_BARALHO);
    await voltarParaBaralhos(page);
    await expect(page.getByRole("listitem")).toHaveCount(1);

    await criarBaralhoPelaUi(page, NOME_DO_BARALHO);
    await voltarParaBaralhos(page);
    await expect(page.getByRole("listitem")).toHaveCount(2);

    const criados = await listarBaralhosPelaApi(enderecoDaApi);

    expect(criados).toHaveLength(2);

    // Encerrar os dois processos...
    await encerrarProcesso(frontend);
    frontend = null;

    await encerrarProcesso(api);
    api = null;

    // ...e reiniciar ambos apontando para o mesmo arquivo SQLite, nas
    // mesmas portas.
    api = iniciarApi(caminhoDoBanco, portaDaApi);

    await aguardarApiPronta(api, enderecoDaApi);

    // A migração já aplicada não roda de novo: o servidor sobe saudável e a
    // versão do esquema não avança além da mais recente.
    const versaoNaSegundaSubida = lerVersaoDoEsquema(caminhoDoBanco);

    expect(versaoNaSegundaSubida).toBe(ULTIMA_VERSAO_DO_ESQUEMA);
    expect(versaoNaSegundaSubida).toBe(versaoNaPrimeiraSubida);

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    // Reabrir a UI: a Credencial não sobreviveu ao recarregamento, então
    // Entrar é exigido de novo (FR-089, SC-031); os dois Baralhos persistem,
    // cada um com o mesmo nome e a elegibilidade derivada comunicada pelo
    // próprio controle Estudar — link quando há Cartões, botão desabilitado
    // descrito pelo estado do Baralho quando não há (FR-144).
    await page.goto(`${enderecoDoFrontend}/#/baralhos`);
    await entrarSeNecessario(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Baralhos" }),
    ).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(2);

    const itens = page
      .getByRole("listitem")
      .filter({ hasText: NOME_DO_BARALHO });

    await expect(itens).toHaveCount(2);

    // FR-144: sem Cartões, cada Baralho se apresenta como não pronto para
    // estudar e o controle Estudar é um botão desabilitado — não um link.
    for (const item of [itens.nth(0), itens.nth(1)]) {
      await expect(item).toContainText("0 Cartões");
      await expect(item).toContainText(
        "Adicione Cartões para começar a estudar.",
      );
      await expect(
        item.getByRole("button", { name: `Estudar ${NOME_DO_BARALHO}` }),
      ).toBeDisabled();
    }

    // Persistência exata conferida também direto na API: os mesmos ids, os
    // mesmos nomes e a mesma elegibilidade — os Baralhos foram relidos do
    // arquivo, não recriados.
    const persistidos = await listarBaralhosPelaApi(enderecoDaApi);

    expect(persistidos).toHaveLength(2);
    expect(persistidos).toEqual(expect.arrayContaining(criados));
  } finally {
    // Encerrar sempre, mesmo quando a prova falha no meio, e remover o
    // arquivo e a pasta temporários.
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});

/**
 * Cria um Baralho pela tela real da UI de 012: abre a página de criação
 * (#/baralhos/novo), preenche o Nome e submete com "Salvar". O sucesso leva ao
 * detalhe do Baralho novo, cujo título assume o nome informado.
 */
async function criarBaralhoPelaUi(page: Page, nome: string): Promise<void> {
  await page.getByRole("link", { name: "Criar baralho" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Criar baralho" }),
  ).toBeVisible();
  await page.getByLabel("Nome").fill(nome);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: nome }),
  ).toBeVisible();
}

/**
 * Volta à lista de Baralhos pela navegação principal — o caminho da UI depois
 * de criar um Baralho, cujo sucesso abre o detalhe.
 */
async function voltarParaBaralhos(page: Page): Promise<void> {
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Baralhos" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Baralhos" }),
  ).toBeVisible();
}

/** Aguarda a API responder `{ status: "ok" }` no `/health`. */
async function aguardarApiPronta(
  api: ProcessoIniciado,
  enderecoDaApi: string,
): Promise<void> {
  await aguardarProntidao(
    api,
    `${enderecoDaApi}/health`,
    async (resposta) => {
      if (!resposta.ok) {
        return false;
      }

      const corpo = (await resposta.json()) as { status?: unknown };

      return corpo.status === "ok";
    },
  );
}
