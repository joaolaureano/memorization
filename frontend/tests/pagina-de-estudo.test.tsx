import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
} from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { AleatoriedadeDeterministica } from "../src/sessao-de-estudo/aleatoriedade";
import {
  MENSAGEM_DE_BARALHO_INELEGIVEL,
  MENSAGEM_DE_QUANTIDADE_INVALIDA,
} from "../src/sessao-de-estudo/sessao-de-estudo";
import { PaginaDeEstudo } from "../src/ui/PaginaDeEstudo";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";
import type { ItemDoResumo } from "../src/ui/ResumoDaSessao";

/**
 * T304 — telas de início e de Item da Sessão de estudo
 * (specs/004-sessao-de-estudo/tasks.md, FR-025, FR-027 a FR-029, FR-047).
 *
 * A tela é exercitada com o `ClienteEmMemoria` e o Adapter determinístico de
 * `Aleatoriedade`, sem servidor. As asserções cobrem a recusa de Baralho
 * inelegível, a comunicação da quantidade disponível, o aviso de limite antes
 * do primeiro Item, a recusa de quantidade inválida, a posição contínua e os
 * textos em português.
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

/**
 * Responde o Item em exibição e devolve o que foi apresentado — Frente, Verso
 * e Resultado —, para que a prova compare o Registro com a ordem vista na
 * tela.
 */
async function responderItem(
  resultado: "acertou" | "errou",
): Promise<ItemDoResumo> {
  const frente = conteudoApresentado(0);

  fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
  await screen.findByRole("heading", { name: "Verso" });

  const verso = conteudoApresentado(1);

  fireEvent.click(
    screen.getByRole("button", {
      name: resultado === "acertou" ? "Acertei" : "Errei",
    }),
  );

  return { frente, verso, resultado };
}

/** Preenche a quantidade e inicia a Sessão pela interface. */
function iniciarCom(quantidade: string): void {
  fireEvent.change(screen.getByLabelText("Quantidade de Cartões"), {
    target: { value: quantidade },
  });
  fireEvent.click(screen.getByRole("button", { name: "Iniciar Sessão" }));
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
        name: "Estudar Inglês",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(MENSAGEM_DE_BARALHO_INELEGIVEL)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para o Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${baralho.baralho.id}`);
    expect(
      screen.queryByLabelText("Quantidade de Cartões"),
    ).not.toBeInTheDocument();
  });

  it("comunica a quantidade disponível e inicia uma Sessão com a quantidade informada (FR-027)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(5);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    expect(
      screen.getByLabelText("Quantidade de Cartões"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Este Baralho tem 5 Cartões vinculados."),
    ).toBeInTheDocument();

    iniciarCom("3");

    expect(await screen.findByText("Item 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Frente" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Verso" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Quantidade de Cartões"),
    ).not.toBeInTheDocument();
  });

  it("informa a qualquer momento quantos Itens já foram respondidos e quantos faltam (SC-015)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(3);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    iniciarCom("3");

    expect(await screen.findByText("Item 1 de 3")).toBeInTheDocument();
    expect(
      screen.getByText("0 Itens respondidos; 3 Itens faltando."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(screen.getByRole("button", { name: "Acertei" }));

    expect(await screen.findByText("Item 2 de 3")).toBeInTheDocument();
    expect(
      screen.getByText("1 Item respondido; 2 Itens faltando."),
    ).toBeInTheDocument();
  });

  it("solicitar mais que o disponível inicia com todos e avisa antes do primeiro Item (FR-029)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(5);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    iniciarCom("50");

    expect(await screen.findByText("Item 1 de 5")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Você pediu 50 Cartões, mas este Baralho tem 5. A Sessão terá 5 Itens.",
      ),
    ).toBeInTheDocument();
  });

  it.each(["0", "-1"])(
    "recusa quantidade %s e mantém o foco no campo para correção (FR-028)",
    async (quantidade) => {
      const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
      renderizar(cliente, idDoBaralho);

      await screen.findByRole("heading", {
        level: 1,
        name: "Estudar Inglês",
      });

      iniciarCom(quantidade);

      const alerta = await screen.findByRole("alert");

      expect(alerta).toHaveTextContent(MENSAGEM_DE_QUANTIDADE_INVALIDA);
      expect(screen.getByLabelText("Quantidade de Cartões")).toHaveFocus();
      expect(
        screen.queryByText(/^Item \d+ de \d+$/),
      ).not.toBeInTheDocument();
    },
  );

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

  it("com o cliente indisponível, comunica a falha de carregamento em português", async () => {
    const cliente = clienteDeProva();
    cliente.simularIndisponibilidade();

    renderizar(cliente, "b1");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    );
  });

  it("a tela da Sessão usa os termos canônicos em português (FR-046)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    iniciarCom("2");

    await screen.findByText("Item 1 de 2");

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
    expect(
      screen.getByRole("button", { name: "Acertei" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Errei" }),
    ).toBeInTheDocument();
  });

  it("PaginaDoBaralho oferece o link para a Sessão de estudo (FR-145)", async () => {
    // O caminho para Estudar só existe como link quando o Baralho é elegível
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
      screen.getByRole("link", { name: "Estudar este Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${idDoBaralho}/estudo`);
  });

  it("só oferece Acertei e Errei depois de revelar o Verso (FR-032, FR-034)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    iniciarCom("2");

    await screen.findByText("Item 1 de 2");

    expect(
      screen.getByText("O Verso está oculto. Tente lembrar antes de revelar."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Acertei" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Errei" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));

    expect(
      await screen.findByRole("button", { name: "Acertei" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Errei" }),
    ).toBeInTheDocument();
  });

  it("mostra o percentual de acertos e as contagens do Resumo (FR-152, FR-174, SC-067, SC-073)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(3);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    iniciarCom("3");
    await screen.findByText("Item 1 de 3");

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(screen.getByRole("button", { name: "Acertei" }));
    await screen.findByText("Item 2 de 3");

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(screen.getByRole("button", { name: "Acertei" }));
    await screen.findByText("Item 3 de 3");

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(screen.getByRole("button", { name: "Errei" }));

    expect(
      await screen.findByRole("heading", { name: "Resumo da Sessão" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sessão concluída")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("de acertos")).toBeInTheDocument();
    expect(screen.getByText("2 de 3 Itens")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Acertos (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Erros (1)" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Itens estudados")).not.toBeInTheDocument();
  });

  it("o Resumo oferece voltar ao Baralho e estudar novamente (FR-152)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(1);
    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    iniciarCom("1");
    await screen.findByText("Item 1 de 1");

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(screen.getByRole("button", { name: "Acertei" }));

    await screen.findByRole("heading", { name: "Resumo da Sessão" });

    expect(
      screen.getByRole("link", { name: "Voltar para o Baralho" }),
    ).toHaveAttribute("href", `#/baralhos/${idDoBaralho}`);
    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Estudar novamente" }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Estudar Inglês",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Quantidade de Cartões"),
    ).toBeInTheDocument();
  });

  it("registra a Sessão concluída uma única vez, com os Itens na ordem apresentada (FR-161, FR-163, FR-176)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    const espiao = vi.spyOn(cliente, "registrarSessao");

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    iniciarCom("2");
    await screen.findByText("Item 1 de 2");

    const itensApresentados = [
      await responderItem("acertou"),
      await responderItem("errou"),
    ];

    expect(
      await screen.findByText("Sessão registrada no seu histórico."),
    ).toBeInTheDocument();
    expect(espiao).toHaveBeenCalledTimes(1);
    expect(espiao.mock.calls[0][0]).toEqual({
      id: expect.any(String),
      baralhoId: idDoBaralho,
      nomeDoBaralho: "Inglês",
      itens: itensApresentados,
    });
  });

  it("interromper a Sessão nunca a registra no histórico (FR-162)", async () => {
    const { cliente, idDoBaralho } = await criarAcervoElegivel(2);
    const espiao = vi.spyOn(cliente, "registrarSessao");

    renderizar(cliente, idDoBaralho);

    await screen.findByRole("heading", {
      level: 1,
      name: "Estudar Inglês",
    });

    iniciarCom("2");
    await screen.findByText("Item 1 de 2");

    await responderItem("acertou");

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
      name: "Estudar Inglês",
    });

    iniciarCom("1");
    await screen.findByText("Item 1 de 1");

    await responderItem("acertou");

    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Tentar registrar novamente" }),
    );

    expect(
      await screen.findByText("Sessão registrada no seu histórico."),
    ).toBeInTheDocument();
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
      name: "Estudar Inglês",
    });

    iniciarCom("1");
    await screen.findByText("Item 1 de 1");

    await responderItem("acertou");
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
});
