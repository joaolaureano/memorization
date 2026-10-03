import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
} from "../src/acervo-cliente/cliente";
import type {
  Cartao,
  ClienteDoAcervo,
  DadosDeRegistro,
  ItemDoLoteDeRevisao,
  Previa,
  RegistroDeSessao,
  ResultadoDeRegistroDeSessao,
  ResultadoDoLoteDeRevisao,
  ResultadoDoResumoDaRevisao,
} from "../src/acervo-cliente/cliente";
import { PaginaDaRevisao } from "../src/ui/PaginaDaRevisao";
import { ProvedorDeProtecaoDeSaida } from "../src/ui/protecao-de-saida";

/**
 * Testes da tela da Revisão do dia (T1518; FR-201, FR-202, FR-203, FR-215,
 * FR-221). O cliente é falso: cada teste declara só as operações que a tela
 * usa, e o lote chega pronto, como o servidor o entrega.
 */

beforeEach(() => {
  window.location.hash = "#/revisao";
});

function cartao(id: string, frente: string): Cartao {
  return { id, frente, verso: `Verso de ${frente}` };
}

/** Uma prévia fixa, em instantes distantes, para os botões exibirem o rótulo. */
function previaFixa(): Previa {
  return {
    errei: "2030-01-01T00:00:00.000Z",
    dificil: "2030-01-02T00:00:00.000Z",
    bom: "2030-01-03T00:00:00.000Z",
    facil: "2030-01-04T00:00:00.000Z",
  };
}

function itemDoLote(id: string, frente: string): ItemDoLoteDeRevisao {
  return { cartao: cartao(id, frente), previa: previaFixa() };
}

function loteDe(itens: ItemDoLoteDeRevisao[]): ResultadoDoLoteDeRevisao {
  return { ok: true, itens };
}

function registroFalso(): RegistroDeSessao {
  return {
    id: "registro-1",
    origem: "revisao",
    baralhoId: "",
    nomeDoBaralho: "Revisão do dia",
    concluidaEm: "2026-10-02T12:00:00.000Z",
    estudados: 1,
    acertos: 1,
    erros: 0,
    itens: [],
  };
}

/** Os padrões das operações que a tela sempre chama. */
function padroes(): Partial<ClienteDoAcervo> {
  return {
    async obterLoteDeRevisao(): Promise<ResultadoDoLoteDeRevisao> {
      return loteDe([]);
    },
    async obterResumoDaRevisao(): Promise<ResultadoDoResumoDaRevisao> {
      return { ok: true, resumo: { vencidos: 0, novosHoje: 0, total: 0 } };
    },
    async registrarSessao(): Promise<ResultadoDeRegistroDeSessao> {
      return { ok: true, registro: registroFalso() };
    },
  };
}

function criarCliente(metodos: Partial<ClienteDoAcervo>): ClienteDoAcervo {
  const cliente: Partial<ClienteDoAcervo> = { ...padroes(), ...metodos };

  return cliente as ClienteDoAcervo;
}

function renderizar(cliente: ClienteDoAcervo) {
  return render(
    <ProvedorDeProtecaoDeSaida temCredencial>
      <PaginaDaRevisao cliente={cliente} />
    </ProvedorDeProtecaoDeSaida>,
  );
}

describe("PaginaDaRevisao", () => {
  it("preserva a ordem do lote recebido, sem embaralhar (FR-201)", async () => {
    renderizar(
      criarCliente({
        async obterLoteDeRevisao(): Promise<ResultadoDoLoteDeRevisao> {
          return loteDe([
            itemDoLote("a", "Frente A"),
            itemDoLote("b", "Frente B"),
            itemDoLote("c", "Frente C"),
          ]);
        },
      }),
    );

    expect(await screen.findByText("Frente A")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(screen.getByRole("button", { name: /^Bom/ }));

    expect(await screen.findByText("Frente B")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(screen.getByRole("button", { name: /^Bom/ }));

    expect(await screen.findByText("Frente C")).toBeTruthy();
  });

  it("mostra 'Nada para revisar hoje' com lote vazio, sem iniciar Sessão (FR-202)", async () => {
    renderizar(
      criarCliente({
        async obterLoteDeRevisao(): Promise<ResultadoDoLoteDeRevisao> {
          return loteDe([]);
        },
      }),
    );

    expect(await screen.findByText("Nada para revisar hoje")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Revelar verso" }),
    ).toBeNull();

    const link = screen.getByRole("link", {
      name: "Voltar a Início",
    }) as HTMLAnchorElement;

    expect(link.getAttribute("href")).toBe("#/inicio");
  });

  it("registra a Sessão concluída com origem revisao (FR-196, FR-215)", async () => {
    // O tipo do mock é declarado no genérico para que `mock.calls[0][0]`
    // continue sendo `DadosDeRegistro`; a implementação não usa o argumento
    // porque o registro devolvido é fixo para a prova.
    const registrarSessao = vi.fn<
      (dados: DadosDeRegistro) => Promise<ResultadoDeRegistroDeSessao>
    >(async () => ({
      ok: true,
      registro: registroFalso(),
    }));

    renderizar(
      criarCliente({
        async obterLoteDeRevisao(): Promise<ResultadoDoLoteDeRevisao> {
          return loteDe([itemDoLote("a", "Frente única")]);
        },
        registrarSessao,
      }),
    );

    await screen.findByText("Frente única");
    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(screen.getByRole("button", { name: /^Bom/ }));

    await waitFor(() => {
      expect(registrarSessao).toHaveBeenCalledTimes(1);
    });

    const dados = registrarSessao.mock.calls[0][0];

    expect(dados.origem).toBe("revisao");
    expect(dados.baralhoId).toBe("");
    expect(dados.nomeDoBaralho).toBe("Revisão do dia");
    expect(dados.itens).toEqual([
      {
        frente: "Frente única",
        verso: "Verso de Frente única",
        cartaoId: "a",
        avaliacao: "bom",
      },
    ]);
  });

  it("'Continuar revisão' carrega o próximo lote quando há Cartões para hoje (FR-215)", async () => {
    const obterLoteDeRevisao = vi.fn(
      async (): Promise<ResultadoDoLoteDeRevisao> => loteDe([]),
    );
    obterLoteDeRevisao
      .mockResolvedValueOnce(loteDe([itemDoLote("a", "Frente A")]))
      .mockResolvedValueOnce(loteDe([itemDoLote("b", "Frente B")]));

    const obterResumoDaRevisao = vi.fn(
      async (): Promise<ResultadoDoResumoDaRevisao> => ({
        ok: true,
        resumo: { vencidos: 1, novosHoje: 0, total: 1 },
      }),
    );

    renderizar(criarCliente({ obterLoteDeRevisao, obterResumoDaRevisao }));

    await screen.findByText("Frente A");
    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(screen.getByRole("button", { name: /^Bom/ }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Continuar revisão" }),
    );

    expect(await screen.findByText("Frente B")).toBeTruthy();
  });

  it("'Continuar revisão' mostra 'Nada para revisar hoje' sem Cartões restantes (FR-202, FR-215)", async () => {
    const obterResumoDaRevisao = vi.fn(
      async (): Promise<ResultadoDoResumoDaRevisao> => ({
        ok: true,
        resumo: { vencidos: 0, novosHoje: 0, total: 0 },
      }),
    );

    renderizar(
      criarCliente({
        async obterLoteDeRevisao(): Promise<ResultadoDoLoteDeRevisao> {
          return loteDe([itemDoLote("a", "Frente A")]);
        },
        obterResumoDaRevisao,
      }),
    );

    await screen.findByText("Frente A");
    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(screen.getByRole("button", { name: /^Bom/ }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Continuar revisão" }),
    );

    expect(await screen.findByText("Nada para revisar hoje")).toBeTruthy();
  });

  it("mostra a falha do lote com nova tentativa (FR-153, FR-217)", async () => {
    const obterLoteDeRevisao = vi.fn(
      async (): Promise<ResultadoDoLoteDeRevisao> => loteDe([]),
    );
    obterLoteDeRevisao
      .mockResolvedValueOnce({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
      })
      .mockResolvedValueOnce(loteDe([itemDoLote("a", "Frente A")]));

    renderizar(criarCliente({ obterLoteDeRevisao }));

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Frente A")).toBeTruthy();
  });

  it("exibe a prévia de cada Avaliação no nome acessível do botão (FR-221)", async () => {
    renderizar(
      criarCliente({
        async obterLoteDeRevisao(): Promise<ResultadoDoLoteDeRevisao> {
          return loteDe([itemDoLote("a", "Frente A")]);
        },
      }),
    );

    await screen.findByText("Frente A");
    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));

    for (const nivel of ["Errei", "Difícil", "Bom", "Fácil"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^${nivel}`) }),
      ).toBeTruthy();
    }

    expect(
      screen.getByRole("button", {
        name: /^Bom, próxima revisão em \d+ dias?$/,
      }),
    ).toBeTruthy();
  });

  it("mostra 'Revisão do dia' no cabeçalho do Resumo (FR-215)", async () => {
    renderizar(
      criarCliente({
        async obterLoteDeRevisao(): Promise<ResultadoDoLoteDeRevisao> {
          return loteDe([itemDoLote("a", "Frente única")]);
        },
      }),
    );

    await screen.findByText("Frente única");
    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(screen.getByRole("button", { name: /^Bom/ }));

    expect(
      await screen.findByRole("heading", { name: "Sessão concluída" }),
    ).toBeTruthy();
    expect(await screen.findByText("Revisão do dia")).toBeTruthy();
  });

  it("avalia com a tecla 3 depois de revelar (FR-218)", async () => {
    const registrarSessao = vi.fn<
      (dados: DadosDeRegistro) => Promise<ResultadoDeRegistroDeSessao>
    >(async () => ({
      ok: true,
      registro: registroFalso(),
    }));

    renderizar(
      criarCliente({
        async obterLoteDeRevisao(): Promise<ResultadoDoLoteDeRevisao> {
          return loteDe([itemDoLote("a", "Frente única")]);
        },
        registrarSessao,
      }),
    );

    await screen.findByText("Frente única");
    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));

    // O foco está no título do Verso; a tecla 3 avalia como Bom.
    fireEvent.keyDown(screen.getByRole("heading", { name: "Verso" }), {
      key: "3",
    });

    await waitFor(() => {
      expect(registrarSessao).toHaveBeenCalledTimes(1);
    });

    const dados = registrarSessao.mock.calls[0][0];
    expect(dados.itens).toEqual([
      {
        frente: "Frente única",
        verso: "Verso de Frente única",
        cartaoId: "a",
        avaliacao: "bom",
      },
    ]);
  });

  it("ignora a tecla 3 antes de revelar (FR-218)", async () => {
    const registrarSessao = vi.fn<
      (dados: DadosDeRegistro) => Promise<ResultadoDeRegistroDeSessao>
    >(async () => ({
      ok: true,
      registro: registroFalso(),
    }));

    renderizar(
      criarCliente({
        async obterLoteDeRevisao(): Promise<ResultadoDoLoteDeRevisao> {
          return loteDe([itemDoLote("a", "Frente única")]);
        },
        registrarSessao,
      }),
    );

    const botaoDeRevelar = await screen.findByRole("button", {
      name: "Revelar verso",
    });

    fireEvent.keyDown(botaoDeRevelar, { key: "3" });

    // A Sessão continua no mesmo Item, sem Resumo.
    expect(screen.getByText("Frente única")).toBeTruthy();
    expect(screen.queryByText("Sessão concluída")).toBeNull();
    expect(registrarSessao).not.toHaveBeenCalled();
  });

  it("ignora a tecla 3 com o diálogo de interrupção aberto (FR-218)", async () => {
    const registrarSessao = vi.fn<
      (dados: DadosDeRegistro) => Promise<ResultadoDeRegistroDeSessao>
    >(async () => ({
      ok: true,
      registro: registroFalso(),
    }));

    renderizar(
      criarCliente({
        async obterLoteDeRevisao(): Promise<ResultadoDoLoteDeRevisao> {
          return loteDe([itemDoLote("a", "Frente única")]);
        },
        registrarSessao,
      }),
    );

    await screen.findByText("Frente única");
    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));

    // Abre o diálogo de interrupção.
    fireEvent.click(screen.getByRole("button", { name: "Interromper" }));

    // O diálogo deve estar visível.
    const botaoCancelar = await screen.findByRole("button", {
      name: "Cancelar",
    });

    fireEvent.keyDown(botaoCancelar, { key: "3" });

    expect(registrarSessao).not.toHaveBeenCalled();
    // A Sessão continua em andamento.
    expect(screen.getByText("Frente única")).toBeTruthy();
  });
});
