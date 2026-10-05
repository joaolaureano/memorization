import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  ClienteDoAcervo,
  RegistroDeSessao,
} from "../src/acervo-cliente/cliente";
import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
  MENSAGEM_DE_SESSAO_NAO_ENCONTRADA,
} from "../src/acervo-cliente/cliente";
import { PaginaDoRegistro } from "../src/ui/PaginaDoRegistro";

/**
 * Provas da tela de um Registro do histórico (FR-166, FR-177..FR-179).
 *
 * A tela consome uma única operação — `obterRegistroDeSessao` —, e o duplo
 * responde só a ela: o encadeamento de Registro e Itens, a idempotência e o
 * recorte por Usuário são do Adapter e têm provas próprias. Aqui interessa o
 * que a tela faz com o que voltou: o selo do Baralho excluído, o resumo e a
 * mensagem de Registro inexistente.
 */

afterEach(() => {
  cleanup();
});

/**
 * O `ClienteDoAcervo` de prova, restrito à leitura que a tela exercita. As
 * demais operações não são montadas porque a tela não as chama.
 */
function clienteComRegistro(
  obterRegistroDeSessao: ClienteDoAcervo["obterRegistroDeSessao"],
): ClienteDoAcervo {
  return { obterRegistroDeSessao } as ClienteDoAcervo;
}

/** Um Registro de prova, com os Itens na ordem em que foram apresentados. */
const REGISTRO: RegistroDeSessao = {
  id: "sessao-1",
  origem: "baralho",
  baralhoId: "baralho-1",
  nomeDoBaralho: "Inglês",
  concluidaEm: "2026-09-30T12:30:00.000Z",
  estudados: 3,
  acertos: 2,
  erros: 1,
  itens: [
    {
      posicao: 0,
      frente: "ephemeral",
      verso: "efêmero, passageiro",
      resultado: "acertou",
    },
    {
      posicao: 1,
      frente: "to cope with",
      verso: "lidar com",
      resultado: "acertou",
    },
    {
      posicao: 2,
      frente: "thoroughly",
      verso: "minuciosamente",
      resultado: "errou",
    },
  ],
};

/** Um Registro da Revisão do dia, com Avaliação em todos os Itens (FR-196). */
const REGISTRO_DA_REVISAO: RegistroDeSessao = {
  id: "sessao-2",
  origem: "revisao",
  baralhoId: "",
  nomeDoBaralho: "Revisão do dia",
  concluidaEm: "2026-10-01T09:00:00.000Z",
  estudados: 2,
  acertos: 1,
  erros: 1,
  itens: [
    {
      posicao: 0,
      frente: "ephemeral",
      verso: "efêmero, passageiro",
      resultado: "acertou",
      cartaoId: "cartao-1",
      avaliacao: "bom",
    },
    {
      posicao: 1,
      frente: "thoroughly",
      verso: "minuciosamente",
      resultado: "errou",
      cartaoId: "cartao-2",
      avaliacao: "errei",
    },
  ],
};

/** Um Registro do baralho temporário (FR-376). */
const REGISTRO_TEMPORARIO: RegistroDeSessao = {
  ...REGISTRO_DA_REVISAO,
  id: "sessao-3",
  origem: "temporario",
  nomeDoBaralho: "Baralho temporário",
};

describe("PaginaDoRegistro", () => {
  it("mostra a Sessão, o Baralho vivo e o resumo dos acertos", async () => {
    const idsPedidos: string[] = [];

    render(
      <PaginaDoRegistro
        cliente={clienteComRegistro(async (id) => {
          idsPedidos.push(id);

          return { ok: true, registro: REGISTRO, baralhoExiste: true };
        })}
        id="sessao-1"
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Sessão concluída" }),
    ).toBeTruthy();
    expect(screen.getByText("Inglês")).toBeTruthy();
    expect(screen.getByText(/2026/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ver baralho" }).getAttribute("href"),
    ).toBe("#/baralhos/baralho-1");
    // O resumo dos itens vem do componente de Resumo da Sessão (FR-178).
    expect(screen.getByText(/de acertos/)).toBeTruthy();
    expect(idsPedidos).toEqual(["sessao-1"]);
  });

  it("traz o selo do Baralho excluído em vez de um link quebrado", async () => {
    render(
      <PaginaDoRegistro
        cliente={clienteComRegistro(async () => ({
          ok: true,
          registro: REGISTRO,
          baralhoExiste: false,
        }))}
        id="sessao-1"
      />,
    );

    expect(await screen.findByText("Baralho excluído")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ver baralho" })).toBeNull();
    // O que foi estudado continua à vista (FR-166).
    expect(screen.getByText("Inglês")).toBeTruthy();
  });

  it("mostra 'Estudo com baralho temporário' sem selo nem link para Baralho (FR-376)", async () => {
    render(
      <PaginaDoRegistro
        cliente={clienteComRegistro(async () => ({
          ok: true,
          registro: REGISTRO_TEMPORARIO,
          baralhoExiste: false,
        }))}
        id="sessao-3"
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Sessão concluída" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Baralho temporário"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Baralho excluído")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ver baralho" }),
    ).not.toBeInTheDocument();
  });

  it("mostra 'Revisão do dia' sem selo nem link para Baralho (FR-215)", async () => {
    render(
      <PaginaDoRegistro
        cliente={clienteComRegistro(async () => ({
          ok: true,
          registro: REGISTRO_DA_REVISAO,
          baralhoExiste: false,
        }))}
        id="sessao-2"
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Sessão concluída" }),
    ).toBeTruthy();
    expect(screen.getByText("Revisão do dia")).toBeTruthy();
    // A ausência de Baralho é própria da Revisão, e não de um Baralho excluído:
    // nem selo, nem link quebrado (FR-215).
    expect(screen.queryByText("Baralho excluído")).toBeNull();
    expect(screen.queryByRole("link", { name: "Ver baralho" })).toBeNull();
    // As Avaliações dos Itens chegam ao Resumo (FR-197, FR-216, T2316).
    expect(
      screen.getByLabelText("Contagem por opção de Avaliação"),
    ).toBeTruthy();
    expect(screen.getByText("Bom 1")).toBeTruthy();
    expect(screen.getByText("Errei 1")).toBeTruthy();
  });

  it("mantém o Baralho no estudo livre e não anuncia a Revisão (FR-178, FR-197)", async () => {
    render(
      <PaginaDoRegistro
        cliente={clienteComRegistro(async () => ({
          ok: true,
          registro: REGISTRO,
          baralhoExiste: true,
        }))}
        id="sessao-1"
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Sessão concluída" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Revisão do dia" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Ver baralho" }).getAttribute("href"),
    ).toBe("#/baralhos/baralho-1");
    // Itens sem Avaliação — Registros anteriores à 015 — agora mostram a
    // legenda com "Sem avaliação" (FR-174, FR-197, FR-214, T2316).
    expect(
      screen.getByLabelText("Contagem por opção de Avaliação"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sem avaliação 3")).toBeInTheDocument();
  });

  it("avisa quando o Registro não existe e oferece a volta a Estudo", async () => {
    render(
      <PaginaDoRegistro
        cliente={clienteComRegistro(async () => ({
          ok: false,
          erro: "nao_encontrado",
          mensagem: MENSAGEM_DE_SESSAO_NAO_ENCONTRADA,
        }))}
        id="sessao-inexistente"
      />,
    );

    expect(
      await screen.findByText(MENSAGEM_DE_SESSAO_NAO_ENCONTRADA),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Voltar para Estudo" })
        .getAttribute("href"),
    ).toBe("#/estudo");
  });

  it("preserva a página e permite tentar de novo quando a leitura falha", async () => {
    let tentativas = 0;

    render(
      <PaginaDoRegistro
        cliente={clienteComRegistro(async () => {
          tentativas += 1;

          return tentativas === 1
            ? {
                ok: false,
                erro: INDISPONIVEL,
                mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
              }
            : { ok: true, registro: REGISTRO, baralhoExiste: true };
        })}
        id="sessao-1"
      />,
    );

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO),
    ).toBeTruthy();
    expect(screen.getByText("← Voltar para Estudo")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(screen.getByText("Inglês")).toBeTruthy();
    });
    expect(tentativas).toBe(2);
  });
});
