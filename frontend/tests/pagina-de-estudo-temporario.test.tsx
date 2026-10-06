import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
  type Cartao,
} from "../src/acervo-cliente/cliente";
import type { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { AleatoriedadeDeterministica } from "../src/sessao-de-estudo/aleatoriedade";
import { PaginaDeEstudo } from "../src/ui/PaginaDeEstudo";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";

async function criarSelecao(cliente: ClienteEmMemoria): Promise<Cartao[]> {
  const baralho = await cliente.criarBaralho({ nome: "Inglês" });
  if (!baralho.ok) throw new Error("Baralho de prova não criado");
  const definicoes = [
    { frente: "How are you?", verso: "Como você está?" },
    { frente: "Good morning", verso: "Bom dia" },
    { frente: "Thank you", verso: "Obrigado" },
  ];
  const selecao: Cartao[] = [];
  for (const definicao of definicoes) {
    const resultado = await cliente.criarCartao(baralho.baralho.id, definicao);
    if (!resultado.ok) {
      throw new Error("não foi possível criar o Cartão de prova");
    }
    selecao.push(resultado.cartao);
  }
  return selecao;
}

function renderizar(
  cliente: ClienteEmMemoria,
  selecao: Cartao[],
  valores: number[] = [0.99, 0.99],
  aoSair = vi.fn(),
) {
  render(
    comProtecaoDeSaida(
      <PaginaDeEstudo
        cliente={cliente}
        id=""
        selecaoTemporaria={selecao}
        aleatoriedade={new AleatoriedadeDeterministica(valores)}
        aoSair={aoSair}
      />,
    ),
  );
  return aoSair;
}

function frenteApresentada(): string {
  const conteudo = document.querySelector(
    ".cartao-de-estudo .conteudo-do-cartao",
  );
  return conteudo?.textContent ?? "";
}

async function responder(): Promise<string> {
  const frente = frenteApresentada();
  fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
  await screen.findByRole("heading", { name: "Verso" });
  fireEvent.click(screen.getByRole("button", { name: /^Bom/ }));
  return frente;
}

async function concluirSessao(): Promise<string[]> {
  const frentes: string[] = [];
  for (let indice = 0; indice < 3; indice += 1) {
    frentes.push(await responder());
  }
  return frentes;
}

it(
  "começa direto com os 3 Cartões, sem configurar quantidade (FR-365, FR-366)",
  async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    renderizar(cliente, selecao);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Revisar baralho temporário",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "Item 1 de 3" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Quantidade de Cartões"),
    ).not.toBeInTheDocument();
    expect(frenteApresentada()).toBe("How are you?");
  },
);

describe(
  "apresenta cada Cartão uma única vez, na ordem inicial (FR-364, FR-366)",
  () => {
    it("mantém a ordem original com [0.99, 0.99]", async () => {
      const cliente = clienteDeProva();
      const selecao = await criarSelecao(cliente);
      renderizar(cliente, selecao);

      expect(await concluirSessao()).toEqual([
        "How are you?",
        "Good morning",
        "Thank you",
      ]);
    });

    it("embaralha na ordem [0, 0]", async () => {
      const cliente = clienteDeProva();
      const selecao = await criarSelecao(cliente);
      renderizar(cliente, selecao, [0, 0]);

      expect(await concluirSessao()).toEqual([
        "Good morning",
        "Thank you",
        "How are you?",
      ]);
    });
  },
);

it(
  "concluir registra um único Registro e mostra o Resumo (FR-369, FR-370)",
  async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    const espiao = vi.spyOn(cliente, "registrarSessao");
    renderizar(cliente, selecao);

    await concluirSessao();

    await screen.findByRole("heading", {
      level: 1,
      name: "Sessão concluída",
    });
    expect(
      screen.getByText("Baralho temporário"),
    ).toBeInTheDocument();

    expect(espiao).toHaveBeenCalledTimes(1);
    const registro = espiao.mock.calls[0][0];
    expect(registro.origem).toBe("temporario");
    expect(registro.baralhoId).toBe("");
    expect(registro.itens).toHaveLength(3);

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Situação do registro da Sessão" }),
      ).toHaveTextContent("Sessão registrada no histórico."),
    );

    const salvar = screen.getByRole("button", { name: "Salvar como baralho" });
    expect(salvar).toBeEnabled();
    expect(salvar).not.toHaveAccessibleDescription();

    const voltar = screen.getByRole("link", {
      name: "Voltar para Baralhos",
    });
    expect(voltar).toHaveAttribute("href", "#/baralhos");
  },
);

it(
  "falha no registro mantém o bloqueio e reenvia o mesmo id (FR-370, SC-145)",
  async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    const espiao = vi.spyOn(cliente, "registrarSessao");
    espiao.mockResolvedValueOnce({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    });
    renderizar(cliente, selecao);

    await concluirSessao();

    await screen.findByRole("heading", {
      level: 1,
      name: "Sessão concluída",
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    );

    const salvar = screen.getByRole("button", { name: "Salvar como baralho" });
    expect(salvar).toBeDisabled();
    expect(salvar).toHaveAccessibleDescription(
      "Registre a Sessão para salvar o baralho.",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Tentar registrar novamente" }),
    );

    await waitFor(() => expect(espiao).toHaveBeenCalledTimes(2));
    expect(espiao.mock.calls[1][0].id).toBe(espiao.mock.calls[0][0].id);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Salvar como baralho" }),
      ).toBeEnabled(),
    );
  },
);

it("interromper e confirmar não registra nada (FR-375)", async () => {
  const cliente = clienteDeProva();
  const selecao = await criarSelecao(cliente);
  const espiao = vi.spyOn(cliente, "registrarSessao");
  const aoSair = renderizar(cliente, selecao);

  fireEvent.click(screen.getByRole("button", { name: "Interromper" }));

  const dialogo = await screen.findByRole("dialog");
  fireEvent.click(
    within(dialogo).getByRole("button", { name: "Interromper" }),
  );

  await waitFor(() => expect(aoSair).toHaveBeenCalledTimes(1));
  expect(espiao).not.toHaveBeenCalled();
});

// T2319 — Formulário "Salvar como baralho" com nome inicial
it(
  "sem nome no baralho temporário, " +
    '"Salvar como baralho" abre com "Baralho temporário" no campo (T2319)',
  async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    renderizar(cliente, selecao);

    await concluirSessao();
    await screen.findByRole("heading", {
      level: 1,
      name: "Sessão concluída",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Salvar como baralho" }),
    );
    await screen.findByRole("heading", { name: "Salvar como baralho" });

    const campoDeNome = screen.getByLabelText(
      "Nome do baralho",
    ) as HTMLInputElement;
    expect(campoDeNome.value).toBe("Baralho temporário");
  },
);

it(
  'com nome "Inglês da viagem" no baralho temporário, ' +
    '"Salvar como baralho" abre com esse nome no campo (T2319)',
  async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    const nomeTemporario = "Inglês da viagem";

    render(
      comProtecaoDeSaida(
        <PaginaDeEstudo
          cliente={cliente}
          id=""
          selecaoTemporaria={selecao}
          nomeDoBaralhoTemporario={nomeTemporario}
          aleatoriedade={new AleatoriedadeDeterministica([0.99, 0.99])}
          aoSair={vi.fn()}
        />,
      ),
    );

    await concluirSessao();
    await screen.findByRole("heading", {
      level: 1,
      name: "Sessão concluída",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Salvar como baralho" }),
    );
    await screen.findByRole("heading", { name: "Salvar como baralho" });

    const campoDeNome = screen.getByLabelText(
      "Nome do baralho",
    ) as HTMLInputElement;
    expect(campoDeNome.value).toBe(nomeTemporario);
  },
);

it(
  'o registro enviado tem nomeDoBaralho com o nome temporário ou "Baralho temporário" (T2319)',
  async () => {
    const cliente = clienteDeProva();
    const selecao = await criarSelecao(cliente);
    const nomeTemporario = "Inglês da viagem";
    const espiao = vi.spyOn(cliente, "registrarSessao");

    render(
      comProtecaoDeSaida(
        <PaginaDeEstudo
          cliente={cliente}
          id=""
          selecaoTemporaria={selecao}
          nomeDoBaralhoTemporario={nomeTemporario}
          aleatoriedade={new AleatoriedadeDeterministica([0.99, 0.99])}
          aoSair={vi.fn()}
        />,
      ),
    );

    await concluirSessao();

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Situação do registro da Sessão" }),
      ).toHaveTextContent("Sessão registrada no histórico."),
    );

    // Verifica que registrarSessao foi chamado com o nome correto
    expect(espiao).toHaveBeenCalled();
    const registroChamado = espiao.mock.calls[0][0];
    expect(registroChamado.nomeDoBaralho).toBe(nomeTemporario);
  },
);
