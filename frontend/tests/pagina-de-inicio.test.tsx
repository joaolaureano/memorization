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
  CompromissoDeEstudo,
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
 * Provas da tela de Início, agora compacta (FR-308..FR-311, FR-318, FR-320,
 * FR-321).
 *
 * A tela consome três operações do `ClienteDoAcervo` — as Estatísticas, o
 * resumo da Revisão do dia e a Agenda —, e é isso que estas provas exercitam: o
 * duplo responde só o que a tela pede. Montar o Adapter de memória inteiro
 * traria para a prova as regras de janela, de idempotência e de agenda, que são
 * de outras features — aqui interessa o que a tela faz com o que recebeu.
 */

afterEach(() => {
  cleanup();
});

/**
 * O `ClienteDoAcervo` de prova, restrito às leituras que a tela exercita. As
 * demais operações não são montadas porque a tela não as chama; a asserção é
 * estrutural e não esconde o que a prova cobre.
 */
function clienteComEstatisticas(
  obterEstatisticas: ClienteDoAcervo["obterEstatisticas"],
  obterResumoDaRevisao: ClienteDoAcervo["obterResumoDaRevisao"] = async () => ({
    ok: true,
    resumo: { vencidos: 0, novosHoje: 0, total: 0 },
  }),
  // A Agenda (016) vive ao lado da Revisão, mas tem estado próprio: por padrão
  // fica vazia e sem falha, para não interferir no que cada prova exercita.
  obterAgenda: ClienteDoAcervo["obterAgenda"] = async (inicio, fuso) => ({
    ok: true,
    agenda: {
      inicio,
      hoje: inicio,
      fuso,
      compromissos: [],
      compromissosDeHoje: [],
    },
  }),
): ClienteDoAcervo {
  return {
    obterEstatisticas,
    obterResumoDaRevisao,
    obterAgenda,
  } as ClienteDoAcervo;
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

/** A data local de hoje em `YYYY-MM-DD`, como a Agenda a pede (FR-311). */
function dataLocalDeHoje(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * Os clientes de prova devolvem sempre as mesmas Estatísticas e o mesmo resumo
 * da Revisão do dia. O resumo padrão é o de "nada para revisar", de modo que os
 * testes das Estatísticas não precisem conhecê-lo.
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
  it("cumprimenta quem estuda com o nome e a data de hoje (FR-308, SC-125)", async () => {
    renderDaPagina({
      cartoes: 4,
      baralhos: 1,
      registrosDaJanela: [],
      recentes: [],
    });

    expect(await screen.findByText("Olá, joao")).toBeTruthy();
    expect(screen.getByText("Seu estudo")).toBeTruthy();

    const dataDeHoje = new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    expect(screen.getByText(dataDeHoje)).toBeTruthy();
  });

  it("resume os últimos sete dias numa linha (FR-308, FR-314)", async () => {
    // Oito Sessões de 15 Itens cada: 120 Itens estudados no período, com 101
    // acertos — 84% na conta do período, não de uma Sessão.
    const acertos = [15, 15, 15, 15, 15, 15, 11, 0];
    const registrosDaJanela = acertos.map((total, indice) =>
      registroDeProva(`sessao-${indice}`, {
        estudados: 15,
        acertos: total,
        erros: 15 - total,
      }),
    );

    renderDaPagina({
      cartoes: 20,
      baralhos: 3,
      registrosDaJanela,
      recentes: [],
    });

    expect(
      await screen.findByText(
        "Últimos 7 dias: 120 Itens estudados · 84% de acerto",
      ),
    ).toBeTruthy();
  });

  it("não inventa uma taxa quando ninguém estudou (FR-321)", async () => {
    renderDaPagina({
      cartoes: 4,
      baralhos: 1,
      registrosDaJanela: [],
      recentes: [],
    });

    expect(
      await screen.findByText("Últimos 7 dias: nenhum Item estudado."),
    ).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("deixa o gráfico, as Sessões e os indicadores de acervo para a área Estudo (FR-309, SC-125)", async () => {
    renderDaPagina(
      {
        cartoes: 12,
        baralhos: 2,
        registrosDaJanela: [],
        recentes: [
          registroDeProva("sessao-1", { estudados: 3, acertos: 2, erros: 1 }),
        ],
      },
      { vencidos: 1, novosHoje: 1, total: 2 },
    );

    // Espera as duas leituras assentarem antes de negar o que não deve existir.
    expect(await screen.findByText("1 Cartão para revisar hoje")).toBeTruthy();

    expect(screen.queryByText("Cartões")).toBeNull();
    expect(screen.queryByText("Baralhos")).toBeNull();
    expect(document.querySelector(".grafico-semanal")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Últimas Sessões" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Semana anterior" }),
    ).toBeNull();
  });

  it("põe a Revisão do dia antes da Agenda de hoje (FR-310, FR-311)", async () => {
    renderDaPagina({
      cartoes: 4,
      baralhos: 1,
      registrosDaJanela: [],
      recentes: [],
    });

    const revisao = await screen.findByRole("heading", {
      name: "Revisão do dia",
    });
    const agenda = screen.getByRole("heading", { name: "Agenda de hoje" });

    expect(
      revisao.compareDocumentPosition(agenda) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("leva a Revisar quando há o que revisar, inclusive só novos (FR-310)", async () => {
    renderDaPagina(
      { cartoes: 8, baralhos: 2, registrosDaJanela: [], recentes: [] },
      { vencidos: 0, novosHoje: 4, total: 4 },
    );

    expect(await screen.findByText("Nenhum Cartão vencido hoje")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Revisar" }).getAttribute("href"),
    ).toBe("#/revisao");
  });

  it("desabilita Revisar com a explicação associada quando nada venceu (FR-310)", async () => {
    renderDaPagina(
      { cartoes: 5, baralhos: 1, registrosDaJanela: [], recentes: [] },
      { vencidos: 0, novosHoje: 0, total: 0 },
    );

    expect(await screen.findByText("Nada para revisar hoje")).toBeTruthy();
    // Sem nada para revisar, "Revisar" deixa de ser um link...
    expect(screen.queryByRole("link", { name: "Revisar" })).toBeNull();
    // ...e vira um botão desabilitado, com a explicação associada (FR-324).
    const revisar = screen.getByRole("button", { name: "Revisar" });
    expect((revisar as HTMLButtonElement).disabled).toBe(true);
    expect(revisar.getAttribute("aria-describedby")).toBe(
      "explicacao-da-revisao",
    );
  });

  it("mantém a Revisão e a Agenda quando as Estatísticas falham, e oferece Tentar novamente (FR-320)", async () => {
    let tentativas = 0;

    render(
      <PaginaDeInicio
        cliente={clienteComEstatisticas(
          async () => {
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
          },
          async () => ({
            ok: true,
            resumo: { vencidos: 1, novosHoje: 0, total: 1 },
          }),
        )}
        nomeDeUsuario="joao"
      />,
    );

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO),
    ).toBeTruthy();
    // A falha de um bloco não esconde o que é de outro.
    expect(await screen.findByText("1 Cartão para revisar hoje")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Agenda de hoje" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(
        screen.getByText("Últimos 7 dias: nenhum Item estudado."),
      ).toBeTruthy();
    });
    expect(tentativas).toBe(2);
  });

  it("não deixa a falha da Revisão esconder o resumo (FR-320)", async () => {
    render(
      <PaginaDeInicio
        cliente={clienteComEstatisticas(
          async () => ({
            ok: true,
            estatisticas: {
              cartoes: 7,
              baralhos: 2,
              registrosDaJanela: [
                registroDeProva("sessao-1", {
                  estudados: 4,
                  acertos: 4,
                  erros: 0,
                }),
              ],
              recentes: [],
            },
          }),
          async () => ({
            ok: false,
            erro: INDISPONIVEL,
            mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
          }),
        )}
        nomeDeUsuario="joao"
      />,
    );

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO),
    ).toBeTruthy();
    expect(
      screen.getByText("Últimos 7 dias: 4 Itens estudados · 100% de acerto"),
    ).toBeTruthy();
  });

  it("convida a criar o primeiro Cartão quando o acervo está vazio (FR-321)", async () => {
    renderDaPagina({
      cartoes: 0,
      baralhos: 0,
      registrosDaJanela: [],
      recentes: [],
    });

    expect(
      await screen.findByText("Últimos 7 dias: nenhum Item estudado."),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Criar o primeiro Cartão" })
        .getAttribute("href"),
    ).toBe("#/cartoes/novo");
  });

  it("mostra até três estudos de hoje e leva à Agenda completa em Estudo (FR-311, FR-322)", async () => {
    const hoje = dataLocalDeHoje();
    const compromissos = [1, 2, 3, 4].map(
      (numero): CompromissoDeEstudo => ({
        rotinaId: `rotina-${numero}`,
        baralhoId: `baralho-${numero}`,
        data: hoje,
        nomeDoBaralho: `Baralho ${numero}`,
        quantidade: 10,
        estado: "pendente",
        indisponivel: false,
        registroId: null,
      }),
    );

    const { container } = render(
      <PaginaDeInicio
        cliente={clienteComEstatisticas(
          async () => ({
            ok: true,
            estatisticas: {
              cartoes: 4,
              baralhos: 1,
              registrosDaJanela: [],
              recentes: [],
            },
          }),
          undefined,
          async (inicio, fuso) => ({
            ok: true,
            agenda: {
              inicio,
              hoje,
              fuso,
              compromissos,
              compromissosDeHoje: compromissos,
            },
          }),
        )}
        nomeDeUsuario="joao"
      />,
    );

    expect(await screen.findByText("0 de 4 estudos concluídos")).toBeTruthy();

    const estudos = container.querySelector(".agenda__estudos");
    expect(estudos).not.toBeNull();
    expect(
      within(estudos as HTMLElement).getAllByRole("listitem"),
    ).toHaveLength(3);

    expect(
      screen
        .getByRole("link", { name: "Ver todos em Estudo" })
        .getAttribute("href"),
    ).toBe("#/estudo");
  });
});
