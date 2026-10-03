import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  ClienteDoAcervo,
  Estatisticas,
  RegistroResumido,
  ResumoDaRevisao,
} from "../src/acervo-cliente/cliente";
import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
} from "../src/acervo-cliente/cliente";
import { PaginaDeInicio } from "../src/ui/PaginaDeInicio";

/**
 * Provas da tela de Início (FR-164, FR-165, FR-168..FR-173).
 *
 * A tela só consome uma operação do `ClienteDoAcervo`, e é isso que estas
 * provas exercitam: o duplo responde `obterEstatisticas` e nada mais. Montar o
 * Adapter de memória inteiro traria para a prova as regras de janela e de
 * idempotência, que são de outra feature — aqui interessa o que a tela faz com
 * os números que recebeu.
 */

afterEach(() => {
  cleanup();
});

/**
 * O `ClienteDoAcervo` de prova, restrito à leitura que a tela exercita. As
 * demais operações não são montadas porque a tela não as chama; a asserção é
 * estrutural e não esconde o que a prova cobre.
 */
function clienteComEstatisticas(
  obterEstatisticas: ClienteDoAcervo["obterEstatisticas"],
  obterResumoDaRevisao: ClienteDoAcervo["obterResumoDaRevisao"] = async () => ({
    ok: true,
    resumo: { vencidos: 0, novosHoje: 0, total: 0 },
  }),
): ClienteDoAcervo {
  return { obterEstatisticas, obterResumoDaRevisao } as ClienteDoAcervo;
}

/** Um Registro de Sessão de prova, com os totais e o resto informados. */
function registroDeProva(
  id: string,
  totais: { estudados: number; acertos: number; erros: number },
  extras: {
    baralhoId?: string;
    nomeDoBaralho?: string;
    concluidaEm?: string;
  } = {},
): RegistroResumido {
  return {
    id,
    origem: "baralho",
    baralhoId: extras.baralhoId ?? "baralho-1",
    nomeDoBaralho: extras.nomeDoBaralho ?? "Inglês",
    concluidaEm: extras.concluidaEm ?? new Date().toISOString(),
    estudados: totais.estudados,
    acertos: totais.acertos,
    erros: totais.erros,
  };
}

/** O valor do tile cujo rótulo é informado (FR-164). */
function valorDaEstatistica(rotulo: string): string {
  const tile = screen.getByText(rotulo).closest(".estatistica");

  return tile?.querySelector(".estatistica__valor")?.textContent ?? "";
}

/**
 * Os clientes de prova devolvem sempre as mesmas Estatísticas e o mesmo resumo
 * da Revisão do dia. O resumo padrão é o de "nada para revisar", de modo que
 * os testes das Estatísticas não precisem conhecê-lo.
 */
function renderDaPagina(
  estatisticas: Estatisticas,
  resumo: ResumoDaRevisao = { vencidos: 0, novosHoje: 0, total: 0 },
): void {
  render(
    <PaginaDeInicio
      cliente={clienteComEstatisticas(
        async () => ({ ok: true, estatisticas }),
        async () => ({ ok: true, resumo }),
      )}
      nomeDeUsuario="joao"
    />,
  );
}

describe("PaginaDeInicio", () => {
  it("cumprimenta quem estuda e mostra os números do acervo", async () => {
    renderDaPagina({
      cartoes: 16,
      baralhos: 3,
      registrosDaJanela: [
        registroDeProva("sessao-1", { estudados: 3, acertos: 2, erros: 1 }),
        registroDeProva("sessao-2", { estudados: 2, acertos: 0, erros: 2 }),
      ],
      recentes: [],
    });

    expect(await screen.findByText("Olá, joao")).toBeTruthy();
    expect(screen.getByText("Seu estudo")).toBeTruthy();
    expect(valorDaEstatistica("Cartões")).toBe("16");
    expect(valorDaEstatistica("Baralhos")).toBe("3");
    expect(valorDaEstatistica("Sessões nos últimos 7 dias")).toBe("2");
    // 2 acertos em 5 Itens estudados: a taxa é do período, não de uma Sessão.
    expect(valorDaEstatistica("Taxa de acerto (7 dias)")).toBe("40%");
  });

  it("mostra travessão e explica a ausência da taxa sem Itens", async () => {
    renderDaPagina({
      cartoes: 5,
      baralhos: 1,
      registrosDaJanela: [],
      recentes: [],
    });

    expect(
      await screen.findByText("Sem Itens estudados nos últimos 7 dias"),
    ).toBeTruthy();
    expect(valorDaEstatistica("Taxa de acerto (7 dias)")).toBe("—");
  });

  it("desenha os sete dias e repete os números numa lista acessível", async () => {
    renderDaPagina({
      cartoes: 4,
      baralhos: 1,
      registrosDaJanela: [
        registroDeProva("sessao-1", { estudados: 3, acertos: 3, erros: 0 }),
      ],
      recentes: [],
    });

    const grafico = await screen.findByRole("region", {
      name: "Itens estudados nos últimos 7 dias",
    });

    // Sete colunas, a mais antiga primeiro; o gráfico é decorativo e a lista
    // oculta é o que resta a um leitor de tela (FR-171).
    expect(within(grafico).getAllByRole("listitem")).toHaveLength(7);
    expect(within(grafico).getByText("Hoje")).toBeTruthy();
    expect(within(grafico).getByText("3")).toBeTruthy();
    expect(within(grafico).getByText("Hoje: 3 Itens")).toBeTruthy();
  });

  it("liga cada Sessão recente ao seu Registro, com data e percentual", async () => {
    renderDaPagina({
      cartoes: 10,
      baralhos: 2,
      registrosDaJanela: [],
      recentes: [
        registroDeProva(
          "sessao-1",
          { estudados: 3, acertos: 2, erros: 1 },
          { nomeDoBaralho: "Inglês" },
        ),
        registroDeProva(
          "sessao-2",
          { estudados: 4, acertos: 4, erros: 0 },
          { nomeDoBaralho: "Algoritmos" },
        ),
      ],
    });

    const ingles = await screen.findByRole("link", { name: "Inglês" });
    expect(ingles.getAttribute("href")).toBe("#/sessoes/sessao-1");
    expect(
      screen.getByRole("link", { name: "Algoritmos" }).getAttribute("href"),
    ).toBe("#/sessoes/sessao-2");
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("convida a criar o primeiro Cartão quando o acervo está vazio", async () => {
    renderDaPagina({
      cartoes: 0,
      baralhos: 0,
      registrosDaJanela: [],
      recentes: [],
    });

    expect(
      await screen.findByText("Você ainda não concluiu nenhuma Sessão."),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Criar o primeiro Cartão" })
        .getAttribute("href"),
    ).toBe("#/cartoes/novo");
  });

  it("convida a ir para os Baralhos quando já há Cartões", async () => {
    renderDaPagina({
      cartoes: 5,
      baralhos: 1,
      registrosDaJanela: [],
      recentes: [],
    });

    expect(
      await screen.findByText("Você ainda não concluiu nenhuma Sessão."),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ir para Baralhos" }).getAttribute("href"),
    ).toBe("#/baralhos");
  });

  it("mantém a página e permite tentar de novo quando a leitura falha", async () => {
    let tentativas = 0;

    render(
      <PaginaDeInicio
        cliente={clienteComEstatisticas(async () => {
          tentativas += 1;

          return tentativas === 1
            ? {
                ok: false,
                erro: INDISPONIVEL,
                mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
              }
            : {
                ok: true,
                estatisticas: {
                  cartoes: 1,
                  baralhos: 1,
                  registrosDaJanela: [],
                  recentes: [],
                },
              };
        })}
        nomeDeUsuario="joao"
      />,
    );

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO),
    ).toBeTruthy();
    // A falha não esconde o cabeçalho nem a navegação (FR-173).
    expect(screen.getByText("Olá, joao")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(valorDaEstatistica("Cartões")).toBe("1");
    });
    expect(tentativas).toBe(2);
  });

  it("mostra quantos vencem e quantos novos entram, com o link para a Revisão do dia (FR-198, FR-199)", async () => {
    renderDaPagina(
      { cartoes: 8, baralhos: 2, registrosDaJanela: [], recentes: [] },
      { vencidos: 3, novosHoje: 5, total: 8 },
    );

    expect(await screen.findByText("Revisão do dia")).toBeTruthy();
    expect(screen.getByText("3 Cartões para revisar hoje")).toBeTruthy();
    expect(screen.getByText("5 Cartões novos entram hoje")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Revisar" }).getAttribute("href"),
    ).toBe("#/revisao");
  });

  it("usa o singular para um Cartão vencido e um novo (FR-198, FR-199)", async () => {
    renderDaPagina(
      { cartoes: 2, baralhos: 1, registrosDaJanela: [], recentes: [] },
      { vencidos: 1, novosHoje: 1, total: 2 },
    );

    expect(await screen.findByText("1 Cartão para revisar hoje")).toBeTruthy();
    expect(screen.getByText("1 Cartão novo entra hoje")).toBeTruthy();
  });

  it("avisa que nenhum Cartão venceu quando só há novos, mantendo Revisar ativo (FR-198, FR-199)", async () => {
    renderDaPagina(
      { cartoes: 4, baralhos: 1, registrosDaJanela: [], recentes: [] },
      { vencidos: 0, novosHoje: 4, total: 4 },
    );

    expect(await screen.findByText("Nenhum Cartão vencido hoje")).toBeTruthy();
    expect(screen.getByText("4 Cartões novos entram hoje")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Revisar" }).getAttribute("href"),
    ).toBe("#/revisao");
  });

  it("mostra 'Nada para revisar hoje' e desabilita Revisar com a explicação associada (FR-202)", async () => {
    renderDaPagina({
      cartoes: 5,
      baralhos: 1,
      registrosDaJanela: [],
      recentes: [],
    });

    expect(await screen.findByText("Nada para revisar hoje")).toBeTruthy();
    // Sem nada para revisar, "Revisar" deixa de ser um link...
    expect(screen.queryByRole("link", { name: "Revisar" })).toBeNull();
    // ...e vira um botão desabilitado, com a explicação associada (FR-202).
    const revisar = screen.getByRole("button", { name: "Revisar" });
    expect((revisar as HTMLButtonElement).disabled).toBe(true);
    expect(revisar.getAttribute("aria-describedby")).toBe(
      "explicacao-da-revisao",
    );
  });

  it("não deixa a falha da Revisão esconder as Estatísticas, e permite tentar de novo (FR-217)", async () => {
    let tentativas = 0;

    render(
      <PaginaDeInicio
        cliente={clienteComEstatisticas(
          async () => ({
            ok: true,
            estatisticas: {
              cartoes: 7,
              baralhos: 2,
              registrosDaJanela: [],
              recentes: [],
            },
          }),
          async () => {
            tentativas += 1;

            return tentativas === 1
              ? {
                  ok: false,
                  erro: INDISPONIVEL,
                  mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
                }
              : { ok: true, resumo: { vencidos: 2, novosHoje: 0, total: 2 } };
          },
        )}
        nomeDeUsuario="joao"
      />,
    );

    // A falha do bloco de revisão aparece, mas os números seguem à vista.
    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO),
    ).toBeTruthy();
    await waitFor(() => {
      expect(valorDaEstatistica("Cartões")).toBe("7");
    });

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(screen.getByText("2 Cartões para revisar hoje")).toBeTruthy();
    });
    expect(tentativas).toBe(2);
  });
});
