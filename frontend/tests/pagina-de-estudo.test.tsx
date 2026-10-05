import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
} from "../src/acervo-cliente/cliente";
import type {
  Avaliacao,
  CartaoListado,
  DadosDeRegistro,
} from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { AleatoriedadeDeterministica } from "../src/sessao-de-estudo/aleatoriedade";
import { LIMITE_DA_SELECAO } from "../src/sessao-de-estudo/selecao-temporaria";
import { MENSAGEM_DE_BARALHO_INELEGIVEL } from "../src/sessao-de-estudo/sessao-de-estudo";
import { PaginaDeEstudo } from "../src/ui/PaginaDeEstudo";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T304 — telas de início e de Item da Sessão de estudo
 * (specs/004-sessao-de-estudo/tasks.md, FR-025, FR-027 a FR-029, FR-047).
 *
 * A tela é exercitada com o `ClienteEmMemoria` e o Adapter determinístico de
 * `Aleatoriedade`, sem servidor. As asserções cobrem a recusa de Baralho
 * inelegível, a modal «Revisar baralho» com as contagens e o foco em
 * Cancelar, as escolhas «Só pendentes» e «Todos os cartões», o início direto
 * de um Baralho Revisado, a falha de leitura dos Agendamentos com «Tentar
 * novamente», a recusa por limite sem truncar, a repetição por «Revisar
 * novamente», a posição contínua e os textos em português (024:
 * FR-378–FR-387, SC-151–SC-154).
 *
 * A 015 acrescenta as quatro Avaliações (FR-192), a prévia da próxima revisão
 * nos botões e no nome acessível (FR-221), a falha de prévia que não bloqueia
 * o estudo e os atalhos 1 a 4 (FR-218), além do Registro com `origem` e a
 * Avaliação de cada Item (FR-196).
 */

const VALORES_DETERMINISTICOS = [0, 0, 0, 0];

interface AcervoDeTeste {
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
}

async function criarAcervoElegivel(
  quantidadeDeCartoes: number,
): Promise<AcervoDeTeste> {
  const cliente = clienteDeProva();

  for (let indice = 1; indice <= quantidadeDeCartoes; indice += 1) {
    const cartao = await cliente.criarCartao({
      frente: `Frente ${indice}`,
      verso: `Verso ${indice}`,
    });

    if (!cartao.ok) {
      throw new Error("a criação do Cartão deveria ser aceita");
    }
  }

  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!baralho.ok) {
    throw new Error("a criação do Baralho deveria ser aceita");
  }

  const cartoes = await cliente.listarCartoes();

  if (!cartoes.ok) {
    throw new Error("a listagem de Cartões deveria ser aceita");
  }

  for (const cartao of cartoes.cartoes) {
    await cliente.vincular(cartao.id, baralho.baralho.id);
  }

  return { cliente, idDoBaralho: baralho.baralho.id };
}

function renderizar(cliente: ClienteEmMemoria, idDoBaralho: string): void {
  render(
    comProtecaoDeSaida(
      <PaginaDeEstudo
        cliente={cliente}
        id={idDoBaralho}
        aleatoriedade={
          new AleatoriedadeDeterministica(VALORES_DETERMINISTICOS)
        }
      />,
    ),
  );
}

/**
 * O texto do `n`-ésimo conteúdo do cartão em exibição (0 = Frente, 1 = Verso),
 * com que a prova captura o que foi de fato apresentado.
 */
function conteudoApresentado(indice: number): string {
  const conteudos = document.querySelectorAll(
    ".cartao-de-estudo .conteudo-do-cartao",
  );

  return conteudos[indice]?.textContent ?? "";
}

/** O Item como o Registro transporta, sem o `cartaoId` (que é opaco). */
type ItemDaProva = Omit<DadosDeRegistro["itens"][number], "cartaoId">;

/**
 * O nome acessível de cada Avaliação começa pelo rótulo (FR-192); a prévia,
 * quando existe, entra depois, então o casamento por prefixo serve aos dois
 * casos (FR-221).
 */
const ROTULO_POR_AVALIACAO: Record<Avaliacao, RegExp> = {
  errei: /^Errei/,
  dificil: /^Difícil/,
  bom: /^Bom/,
  facil: /^Fácil/,
};

/** Aciona o botão de uma Avaliação (FR-192, FR-193). */
function escolherAvaliacao(avaliacao: Avaliacao): void {
  fireEvent.click(
    screen.getByRole("button", { name: ROTULO_POR_AVALIACAO[avaliacao] }),
  );
}

/**
 * Responde o Item em exibição com a Avaliação informada e devolve o que foi
 * apresentado — Frente, Verso e Avaliação —, para que a prova compare o
 * Registro com a ordem vista na tela (FR-193, FR-196).
 */
async function responderItem(avaliacao: Avaliacao): Promise<ItemDaProva> {
  const frente = conteudoApresentado(0);

  fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
  await screen.findByRole("heading", { name: "Verso" });

  const verso = conteudoApresentado(1);

  escolherAvaliacao(avaliacao);

  return { frente, verso, avaliacao };
}

/** Instante ISO a `dias` dias locais de hoje, ao meio-dia (FR-221). */
function isoDaquiA(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  data.setHours(12, 0, 0, 0);

  return data.toISOString();
}

/**
 * Inicia a Sessão pela modal «Revisar baralho» (FR-383): «Todos os cartões»
 * usa o conjunto carregado inteiro, embaralhado pela própria Sessão.
 */
function iniciarComTodos(): void {
  fireEvent.click(screen.getByRole("button", { name: "Todos os cartões" }));
}

/** Inicia a Sessão pela modal, com «Só pendentes» (FR-383). */
function iniciarComPendentes(): void {
  fireEvent.click(screen.getByRole("button", { name: "Só pendentes" }));
}

/**
 * Deixa o Cartão da frente informada com a próxima revisão no futuro,
 * registrando uma Sessão com Avaliação «Bom» (+3 dias) — o caminho real de
 * Agendamento, sem tocar no estado interno do Adapter (FR-379).
 */
async function agendarParaOFuturo(
  cliente: ClienteEmMemoria,
  idDoBaralho: string,
  frente: string,
): Promise<void> {
  const listagem = await cliente.listarCartoes();

  if (!listagem.ok) {
    throw new Error("a listagem de Cartões deveria ser aceita");
  }

  const cartao = listagem.cartoes.find((item) => item.frente === frente);

  if (cartao === undefined) {
    throw new Error(`o Cartão "${frente}" deveria existir`);
  }

  const registro = await cliente.registrarSessao({
    id: crypto.randomUUID(),
    origem: "baralho",
    baralhoId: idDoBaralho,
    nomeDoBaralho: "Inglês",
    itens: [
      {
        frente: cartao.frente,
        verso: cartao.verso,
        cartaoId: cartao.id,
        avaliacao: "bom",
      },
    ],
  });

  if (!registro.ok) {
    throw new Error("a Sessão de Agendamento deveria ser registrada");
  }
}

describe("PaginaDeEstudo", () => {
  it("recusa Baralho inelegível e oferece o caminho de volta (FR-025)", async () => {
    const cliente = clienteDeProva();
    const baralho = await cliente.criarBaralho({ nome: "Inglês" });

    if (!baralho.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    renderizar(cliente, baralho.baralho.id);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Revisar Inglês",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(MENSAGEM_DE_BARALHO_INELEGIVEL)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para o Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${baralho.baralho.id}`);
    // Um conjunto vazio não abre a modal nem inicia Sessão vazia (FR-386).
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre a modal «Revisar baralho» com as contagens e «Todos os cartões» inicia a Sessão (FR-383, FR-387)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(5);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    // Cartões novos não têm Agendamento: o conjunto está pendente e a modal
    // pede a escolha antes de iniciar (FR-383).
    const dialogo = await screen.findByRole("dialog");
    expect(
      within(dialogo).getByRole("heading", { name: "Revisar baralho" }),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByRole("button", { name: "Só pendentes" }),
    ).toHaveAccessibleDescription("5 Cartões pendentes");
    const todos = within(dialogo).getByRole("button", {
      name: "Todos os cartões",
    });
    expect(todos).toHaveAccessibleDescription("5 Cartões no Baralho");

    // A modal não inicia nada sozinha: sem escolha, não há Item.
    expect(screen.queryByRole("article")).not.toBeInTheDocument();

    fireEvent.click(todos);

    expect(
      await screen.findByRole("article", { name: "Item 1 de 5" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Frente" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Verso" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("expõe posição e total só para leitor de tela, sem contagem visível (SC-015, FR-150)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(3);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();

    expect(
      await screen.findByRole("article", { name: "Item 1 de 3" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    escolherAvaliacao("bom");

    expect(
      await screen.findByRole("article", { name: "Item 2 de 3" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Faltam|Falta 1 Cartão/),
    ).not.toBeInTheDocument();
  });

  it("mantém o anúncio visualmente oculto e não renderiza barra de progresso (FR-150)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();
    await screen.findByRole("article", { name: "Item 1 de 2" });

    const anuncio = screen.getByRole("status", {
      name: "Mudança de estado da Sessão",
    });

    expect(anuncio).toHaveClass("visualmente-oculto");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("«Só pendentes» inclui o Cartão novo e deixa de fora o agendado para o futuro (FR-379, FR-383)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(3);
    await agendarParaOFuturo(cliente, idDoBaralho, "Frente 1");

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    const dialogo = await screen.findByRole("dialog");
    expect(
      within(dialogo).getByRole("button", { name: "Só pendentes" }),
    ).toHaveAccessibleDescription("2 Cartões pendentes");
    expect(
      within(dialogo).getByRole("button", { name: "Todos os cartões" }),
    ).toHaveAccessibleDescription("3 Cartões no Baralho");

    iniciarComPendentes();

    expect(
      await screen.findByRole("article", { name: "Item 1 de 2" }),
    ).toBeInTheDocument();

    // Os dois Itens apresentados são os dois Cartões novos — o agendado para
    // o futuro fica fora do conjunto pendente.
    const frentes: string[] = [];
    for (let indice = 0; indice < 2; indice += 1) {
      frentes.push(conteudoApresentado(0));
      fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
      await screen.findByRole("heading", { name: "Verso" });
      escolherAvaliacao("bom");
    }

    expect(frentes.slice().sort()).toEqual(["Frente 2", "Frente 3"]);
  });

  it("um Baralho Revisado começa direto com todos, sem modal (FR-384)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    await agendarParaOFuturo(cliente, idDoBaralho, "Frente 1");
    await agendarParaOFuturo(cliente, idDoBaralho, "Frente 2");

    renderizar(cliente, idDoBaralho);

    expect(
      await screen.findByRole("article", { name: "Item 1 de 2" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Revisar Inglês" }),
    ).toBeInTheDocument();
  });

  it("a modal abre com o foco em Cancelar; Escape cancela sem iniciar e volta ao Baralho (FR-383, FR-387)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    renderizar(cliente, idDoBaralho);

    const dialogo = await screen.findByRole("dialog");
    const cancelar = within(dialogo).getByRole("button", {
      name: "Cancelar",
    });
    expect(cancelar).toHaveFocus();

    fireEvent.keyDown(dialogo, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(window.location.hash).toBe(`#/baralhos/${idDoBaralho}`);
  });

  it("Cancelar fecha a modal sem iniciar Sessão (FR-383, FR-387)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    renderizar(cliente, idDoBaralho);

    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Cancelar" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("acima do limite, só a opção excedente fica desabilitada, com o motivo, sem truncar (FR-386)", async () => {
    const cliente = clienteDeProva();
    const criacao = await cliente.criarBaralho({ nome: "Inglês" });

    if (!criacao.ok) {
      throw new Error("a criação do Baralho deveria ser aceita");
    }

    const idDoBaralho = criacao.baralho.id;
    // Um Cartão pendente e o restante agendado para o futuro: o subconjunto
    // pendente cabe no limite, o conjunto inteiro não (FR-386).
    const vinculados: CartaoListado[] = Array.from(
      { length: LIMITE_DA_SELECAO + 1 },
      (_, indice) => ({
        id: `c${indice + 1}`,
        frente: `Frente ${indice + 1}`,
        verso: `Verso ${indice + 1}`,
        baralhos: [{ id: idDoBaralho, nome: "Inglês" }],
        proximaRevisaoEm: indice === 0 ? null : isoDaquiA(3),
      }),
    );

    vi.spyOn(cliente, "listarCartoes").mockResolvedValue({
      ok: true,
      cartoes: vinculados,
    });
    vi.spyOn(cliente, "obterBaralho").mockResolvedValue({
      ok: true,
      baralho: {
        id: idDoBaralho,
        nome: "Inglês",
        elegivel: true,
        cartoes: [],
      },
    });

    renderizar(cliente, idDoBaralho);

    const dialogo = await screen.findByRole("dialog");
    const pendentes = within(dialogo).getByRole("button", {
      name: "Só pendentes",
    });
    const todos = within(dialogo).getByRole("button", {
      name: "Todos os cartões",
    });

    expect(pendentes).toBeEnabled();
    expect(pendentes).toHaveAccessibleDescription("1 Cartão pendente");
    expect(todos).toBeDisabled();
    expect(todos).toHaveAccessibleDescription(
      /1001 Cartões no Baralho.*excede o limite de 1\.000 por Sessão.*seleção temporária\./,
    );

    // O subconjunto pendente continua disponível, sem truncamento.
    fireEvent.click(pendentes);

    expect(
      await screen.findByRole("article", { name: "Item 1 de 1" }),
    ).toBeInTheDocument();
  });

  it("Baralho inexistente mostra a mensagem em português com o link de volta", async () => {
    renderizar(clienteDeProva(), "b-inexistente");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Baralho não encontrado",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Baralho não encontrado.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para o Baralho" }),
    ).toHaveAttribute("href", "#/baralhos/b-inexistente");
  });

  it("com o cliente indisponível, a falha é recuperável com «Tentar novamente» (FR-046, FR-148)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(1);
    cliente.simularIndisponibilidade();

    renderizar(cliente, idDoBaralho);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    );

    cliente.restaurarDisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    // A releitura refaz a carga e a modal de escolha volta a aparecer.
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("falha ao ler os Agendamentos é recuperável, com «Tentar novamente», e nunca vira «Revisado» (FR-385, SC-151)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    vi.spyOn(cliente, "listarCartoes").mockResolvedValueOnce({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });

    renderizar(cliente, idDoBaralho);

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE);
    expect(alerta).toHaveAccessibleName("Falha ao carregar o Baralho");
    // Sem os Agendamentos não há classificação confiável: nada de modal nem
    // de início direto como «Revisado».
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    const dialogo = await screen.findByRole("dialog");
    expect(
      within(dialogo).getByRole("button", { name: "Todos os cartões" }),
    ).toHaveAccessibleDescription("2 Cartões no Baralho");
  });

  it("a tela da Sessão usa os termos canônicos em português (FR-046)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();

    await screen.findByRole("article", { name: "Item 1 de 2" });

    expect(screen.getByRole("heading", { name: "Frente" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revelar verso" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Interromper" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));

    expect(
      await screen.findByRole("heading", { name: "Verso" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Errei/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Difícil/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Bom/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Fácil/ })).toBeInTheDocument();
  });

  it("PaginaDoBaralho oferece o link para a revisão do Baralho (FR-145, FR-378)", async () => {
    // O caminho para Revisar só existe como link quando o Baralho é elegível
    // — com Cartões vinculados — e a página precisa estar sob o provedor de
    // proteção de saída, já que usa os hooks de proteção.
    const { cliente, idDoBaralho } = await criarAcervoElegivel(1);

    render(
      comProtecaoDeSaida(
        <PaginaDoBaralho cliente={cliente} id={idDoBaralho} />,
      ),
    );

    await screen.findByRole("heading", { level: 1, name: "Inglês" });

    expect(
      screen.getByRole("link", { name: "Revisar este Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${idDoBaralho}/estudo`);
  });

  it("só oferece as quatro Avaliações depois de revelar o Verso (FR-032, FR-034, FR-193)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();

    await screen.findByRole("article", { name: "Item 1 de 2" });

    expect(
      screen.queryByText("O Verso está oculto. Tente lembrar antes de revelar."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revelar verso" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Errei/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Bom/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));

    expect(
      await screen.findByRole("button", { name: /^Errei/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Difícil/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Bom/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Fácil/ })).toBeInTheDocument();
  });

  it("mostra o percentual de acertos e as contagens do Resumo (FR-152, FR-174, SC-067, SC-073)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(3);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();
    await screen.findByRole("article", { name: "Item 1 de 3" });

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    escolherAvaliacao("bom");
    await screen.findByRole("article", { name: "Item 2 de 3" });

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    escolherAvaliacao("bom");
    await screen.findByRole("article", { name: "Item 3 de 3" });

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    escolherAvaliacao("errei");

    expect(
      await screen.findByRole("heading", { name: "Sessão concluída" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sessão concluída")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("de acertos")).toBeInTheDocument();
    expect(screen.getByText("2 de 3 Cartões")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Acertos (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Erros (1)" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Itens estudados")).not.toBeInTheDocument();
  });

  it("o Resumo oferece voltar ao Baralho e «Revisar novamente» relê e inicia direto quando já está Revisado (FR-152, FR-378, FR-385)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(1);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();
    await screen.findByRole("article", { name: "Item 1 de 1" });

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    escolherAvaliacao("bom");

    await screen.findByRole("heading", { name: "Sessão concluída" });

    expect(
      screen.getByRole("link", { name: "Voltar para o Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${idDoBaralho}`);
    expect(screen.getByText("100%")).toBeInTheDocument();

    // A Avaliação «Bom» agendou o Cartão para o futuro: esperar o registro
    // garante que a releitura de «Revisar novamente» enxergue esse estado.
    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Situação do registro da Sessão",
        }),
      ).toHaveTextContent(/Sessão registrada no histórico/);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Revisar novamente" }),
    );

    // Relido como Revisado, o Baralho inicia todos direto, sem modal (FR-384,
    // FR-385).
    expect(
      await screen.findByRole("article", { name: "Item 1 de 1" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Revisar Inglês" }),
    ).toBeInTheDocument();
  });

  it("registra a Sessão concluída uma única vez, com os Itens na ordem apresentada (FR-161, FR-163, FR-176)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    const espiao = vi.spyOn(cliente, "registrarSessao");

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();
    await screen.findByRole("article", { name: "Item 1 de 2" });

    const itensApresentados = [
      await responderItem("bom"),
      await responderItem("errei"),
    ];

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Situação do registro da Sessão",
        }),
      ).toHaveTextContent(/Sessão registrada no histórico/);
    });
    expect(screen.queryByRole("link", { name: "Ver em Início" })).toBeNull();
    expect(espiao).toHaveBeenCalledTimes(1);
    expect(espiao.mock.calls[0][0]).toEqual({
      id: expect.any(String),
      origem: "baralho",
      baralhoId: idDoBaralho,
      nomeDoBaralho: "Inglês",
      itens: itensApresentados.map((item) => ({
        ...item,
        cartaoId: expect.any(String),
      })),
    });
  });

  it("interromper a Sessão nunca a registra no histórico (FR-162)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    const espiao = vi.spyOn(cliente, "registrarSessao");

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();
    await screen.findByRole("article", { name: "Item 1 de 2" });

    await responderItem("bom");

    fireEvent.click(screen.getByRole("button", { name: "Interromper" }));

    const dialogo = await screen.findByRole("dialog");

    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Interromper" }),
    );

    expect(espiao).not.toHaveBeenCalled();
  });

  it("falha ao registrar mostra a mensagem do cliente e reenvia com o mesmo id (FR-163, FR-165)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(1);
    const espiao = vi.spyOn(cliente, "registrarSessao").mockResolvedValueOnce({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();
    await screen.findByRole("article", { name: "Item 1 de 1" });

    await responderItem("bom");

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Tentar registrar novamente" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Situação do registro da Sessão",
        }),
      ).toHaveTextContent(/Sessão registrada no histórico/);
    });
    expect(screen.queryByRole("link", { name: "Ver em Início" })).toBeNull();
    expect(espiao).toHaveBeenCalledTimes(2);
    expect(espiao.mock.calls[1][0].id).toBe(espiao.mock.calls[0][0].id);
  });

  it("sair do Resumo sem registrar pede confirmação (FR-164)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(1);
    vi.spyOn(cliente, "registrarSessao").mockResolvedValueOnce({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();
    await screen.findByRole("article", { name: "Item 1 de 1" });

    await responderItem("bom");
    await screen.findByRole("alert");

    fireEvent.click(
      screen.getByRole("link", { name: "Voltar para o Baralho" }),
    );
    fireEvent(window, new HashChangeEvent("hashchange"));

    expect(
      await screen.findByText("Sair sem registrar a Sessão?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Esta Sessão não ficará no seu histórico."),
    ).toBeInTheDocument();
  });

  it("mostra as quatro Avaliações com a prévia no texto e no nome acessível (FR-192, FR-221)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(1);

    const cartoes = await cliente.listarCartoes();

    if (!cartoes.ok) {
      throw new Error("a listagem de Cartões deveria ser aceita");
    }

    const cartaoId = cartoes.cartoes[0].id;

    vi.spyOn(cliente, "obterPrevias").mockResolvedValue({
      ok: true,
      previas: {
        [cartaoId]: {
          errei: isoDaquiA(0),
          dificil: isoDaquiA(1),
          bom: isoDaquiA(3),
          facil: isoDaquiA(5),
        },
      },
    });

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();
    await screen.findByRole("article", { name: "Item 1 de 1" });

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    await screen.findByRole("heading", { name: "Verso" });

    const botaoBom = await screen.findByRole("button", {
      name: "Bom, próxima revisão em 3 dias",
    });

    expect(botaoBom).toHaveTextContent("Bom · 3 dias");
    expect(
      screen.getByRole("button", { name: "Errei, próxima revisão em 0 dias" }),
    ).toHaveTextContent("Errei · 0 dias");
    expect(
      screen.getByRole("button", { name: "Difícil, próxima revisão em 1 dia" }),
    ).toHaveTextContent("Difícil · 1 dia");
    expect(
      screen.getByRole("button", { name: "Fácil, próxima revisão em 5 dias" }),
    ).toHaveTextContent("Fácil · 5 dias");
  });

  it("uma falha ao obter as prévias é anunciada sem impedir o estudo (FR-221)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(1);

    vi.spyOn(cliente, "obterPrevias").mockResolvedValue({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
    });

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();
    await screen.findByRole("article", { name: "Item 1 de 1" });

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    await screen.findByRole("heading", { name: "Verso" });

    expect(screen.getByRole("button", { name: "Bom" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Errei" })).toBeInTheDocument();

    escolherAvaliacao("bom");

    expect(
      await screen.findByRole("heading", { name: "Sessão concluída" }),
    ).toBeInTheDocument();
  });

  it("os atalhos 1 a 4 registram a Avaliação somente após a Revelação (FR-218)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Revisar Inglês",
    });

    iniciarComTodos();
    await screen.findByRole("article", { name: "Item 1 de 2" });

    // Antes da Revelação o atalho é ignorado: a Sessão não avança.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "4" });
    expect(
      screen.getByRole("article", { name: "Item 1 de 2" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    await screen.findByRole("heading", { name: "Verso" });

    // 3 corresponde a Bom (FR-192, FR-218).
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "3" });

    expect(
      await screen.findByRole("article", { name: "Item 2 de 2" }),
    ).toBeInTheDocument();
  });
});
