import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  CartaoListado,
  ClienteDoAcervo,
  CompromissoDeEstudo,
  ResumoDaRevisao,
} from "../src/acervo-cliente/cliente";
import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
} from "../src/acervo-cliente/cliente";
import { PaginaDeInicio } from "../src/ui/PaginaDeInicio";

/**
 * Provas da tela de Início da feature 020 (FR-330, FR-331).
 *
 * A tela consome três operações do `ClienteDoAcervo` — `listarCartoes`, o
 * resumo da Revisão do dia e a Agenda —, e é isso que estas provas exercitam:
 * o duplo responde só o que a tela pede. Montar o Adapter de memória inteiro
 * traria para a prova as regras de janela, de idempotência e de agenda, que são
 * de outras features — aqui interessa o que a tela faz com o que recebeu.
 *
 * `listarCartoes` não alimenta número nenhum: serve apenas para a tela saber se
 * o acervo está vazio (FR-330). `obterEstatisticas`, por sua vez, **não deve
 * ser chamada**: o duplo a monta lançando, de modo que qualquer prova desta
 * suíte falha se Início voltar a ler as Estatísticas (FR-330).
 */

afterEach(() => {
  cleanup();
});

/** Um Cartão de prova com os Baralhos a que está vinculado (FR-003). */
function cartaoDeProva(id: string): CartaoListado {
  return {
    id,
    frente: `Frente ${id}`,
    verso: `Verso ${id}`,
    baralhos: [],
  };
}

/**
 * O `ClienteDoAcervo` de prova, restrito às leituras que a tela exercita. As
 * demais operações não são montadas porque a tela não as chama; a asserção é
 * estrutural e não esconde o que a prova cobre. A única exceção é
 * `obterEstatisticas`, que lança se for chamada: é assim que a prova garante
 * que Início não lê Registros nem Estatísticas (FR-330).
 */
function clienteDeProva(
  listarCartoes: ClienteDoAcervo["listarCartoes"] = async () => ({
    ok: true,
    cartoes: [cartaoDeProva("cartao-1")],
  }),
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
    listarCartoes,
    obterResumoDaRevisao,
    obterAgenda,
    obterEstatisticas: async () => {
      throw new Error("Início não lê as Estatísticas (FR-330).");
    },
  } as unknown as ClienteDoAcervo;
}

/** A data local de hoje em `YYYY-MM-DD`, como a Agenda a pede (FR-311). */
function dataLocalDeHoje(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * Monta a tela com o resumo da Revisão informado — por padrão, o de "nada para
 * revisar" — e com um acervo de um Cartão, para que as provas que não falam do
 * acervo vazio não vejam o convite. As provas que o exercitam passam o seu
 * próprio `listarCartoes`.
 */
function renderDaPagina(
  resumo: ResumoDaRevisao = { vencidos: 0, novosHoje: 0, total: 0 },
  listarCartoes: ClienteDoAcervo["listarCartoes"] = async () => ({
    ok: true,
    cartoes: [cartaoDeProva("cartao-1")],
  }),
): void {
  render(
    <PaginaDeInicio
      cliente={clienteDeProva(
        listarCartoes,
        async () => ({ ok: true, resumo }),
      )}
      nomeDeUsuario="joao"
    />,
  );
}

describe("PaginaDeInicio", () => {
  it("cumprimenta quem estuda e nada mais, sem sobretítulo, data nem semana (FR-330)", async () => {
    renderDaPagina();

    const cabecalho = document.querySelector(".inicio__cabecalho");
    expect(cabecalho).not.toBeNull();

    expect(
      within(cabecalho as HTMLElement).getByRole("heading", {
        name: "Olá, joao",
        level: 1,
      }),
    ).toBeTruthy();
    expect(
      await screen.findByRole("heading", {
        name: "Olá, joao",
        level: 1,
      }),
    ).toBeTruthy();

    // O sobretítulo, a data e o resumo dos sete dias saíram do Início.
    expect(screen.queryByText("Seu estudo")).toBeNull();
    expect(screen.queryByText(/Últimos 7 dias/)).toBeNull();

    const dataDeHoje = new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    expect(
      within(cabecalho as HTMLElement).queryByText(dataDeHoje),
    ).toBeNull();
  });

  it("põe a Revisão do dia antes da Agenda de hoje, numa coluna (FR-330)", async () => {
    renderDaPagina();

    const blocos = document.querySelector(".inicio__blocos");
    expect(blocos).not.toBeNull();

    const revisao = await screen.findByRole("heading", {
      name: "Revisão do dia",
    });
    const agenda = screen.getByRole("heading", { name: "Agenda de hoje" });

    // Os dois blocos vivem na mesma coluna, na ordem em que o dia acontece.
    expect(
      within(blocos as HTMLElement).getByRole("heading", {
        name: "Revisão do dia",
      }),
    ).toBe(revisao);
    expect(
      within(blocos as HTMLElement).getByRole("heading", {
        name: "Agenda de hoje",
      }),
    ).toBe(agenda);
    expect(
      revisao.compareDocumentPosition(agenda) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("desabilita Revisar com a explicação associada quando nada há para revisar (FR-331)", async () => {
    renderDaPagina({ vencidos: 0, novosHoje: 0, total: 0 });

    const titulo = await screen.findByText("Nada para revisar.");
    expect(titulo).toBeTruthy();

    // Sem nada para revisar, "Revisar" deixa de ser um link...
    expect(screen.queryByRole("link", { name: "Revisar" })).toBeNull();
    // ...e vira um botão desabilitado, com a explicação associada (FR-324).
    const revisar = screen.getByRole("button", { name: "Revisar" });
    expect((revisar as HTMLButtonElement).disabled).toBe(true);
    expect(revisar.getAttribute("aria-describedby")).toBe(
      "explicacao-da-revisao",
    );
    // A explicação não é mais um parágrafo à parte: é o próprio título.
    expect(
      document.getElementById("explicacao-da-revisao")?.textContent,
    ).toBe("Nada para revisar.");
  });

  it("conta pelo total elegível quando só há novos (FR-331)", async () => {
    renderDaPagina({ vencidos: 0, novosHoje: 4, total: 4 });

    expect(await screen.findByText("4 Cartões para revisar")).toBeTruthy();
    expect(screen.queryByText("Nada para revisar.")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Revisar" }).getAttribute("href"),
    ).toBe("#/revisao");
  });

  it("conta um único Cartão elegível no singular (FR-331)", async () => {
    renderDaPagina({ vencidos: 1, novosHoje: 0, total: 1 });

    expect(await screen.findByText("1 Cartão para revisar")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Revisar" }).getAttribute("href"),
    ).toBe("#/revisao");
  });

  it("conta pelo total elegível, e não pelos vencidos, quando há os dois (FR-331)", async () => {
    renderDaPagina({ vencidos: 2, novosHoje: 3, total: 5 });

    expect(await screen.findByText("5 Cartões para revisar")).toBeTruthy();
    expect(screen.queryByText("2 Cartões para revisar")).toBeNull();
    expect(screen.queryByText("3 Cartões para revisar")).toBeNull();
  });

  it("não fala em Cartões vencidos nem em Cartões novos no bloco (FR-331)", async () => {
    renderDaPagina({ vencidos: 2, novosHoje: 3, total: 5 });

    expect(await screen.findByText("5 Cartões para revisar")).toBeTruthy();

    const bloco = (
      screen.getByRole("heading", { name: "Revisão do dia" }) as HTMLElement
    ).closest("section");
    expect(bloco).not.toBeNull();
    expect((bloco as HTMLElement).textContent).not.toMatch(/vencid|nov[oa]s?/i);
  });

  it("convida a criar o primeiro Cartão quando o acervo está vazio (FR-330)", async () => {
    renderDaPagina(undefined, async () => ({ ok: true, cartoes: [] }));

    expect(
      (
        await screen.findByRole("link", {
          name: "Criar o primeiro Cartão",
        })
      ).getAttribute("href"),
    ).toBe("#/cartoes/novo");
  });

  it("não convida nem inventa mensagem quando a leitura do acervo falha (FR-330)", async () => {
    renderDaPagina(undefined, async () => ({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    }));

    // A Revisão assentar é o sinal de que a falha do acervo já chegou.
    expect(await screen.findByText("Nada para revisar.")).toBeTruthy();

    expect(
      screen.queryByRole("link", { name: "Criar o primeiro Cartão" }),
    ).toBeNull();
    expect(screen.queryByText(MENSAGEM_DE_INDISPONIBILIDADE)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("mostra a falha da Revisão com Tentar novamente, sem esconder a Agenda (FR-320, FR-331)", async () => {
    let leituras = 0;

    render(
      <PaginaDeInicio
        cliente={clienteDeProva(
          async () => ({ ok: true, cartoes: [cartaoDeProva("cartao-1")] }),
          async () => {
            leituras += 1;

            return leituras === 1
              ? {
                  ok: false,
                  erro: INDISPONIVEL,
                  mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
                }
              : {
                  ok: true,
                  resumo: { vencidos: 1, novosHoje: 0, total: 1 },
                };
          },
        )}
        nomeDeUsuario="joao"
      />,
    );

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO),
    ).toBeTruthy();
    // A falha de um bloco não esconde o que é de outro.
    expect(
      screen.getByRole("heading", { name: "Agenda de hoje" }),
    ).toBeTruthy();

    // O "Tentar novamente" é do bloco da Revisão, e só dele.
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("1 Cartão para revisar")).toBeTruthy();
    expect(leituras).toBe(2);
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
        cliente={clienteDeProva(
          async () => ({ ok: true, cartoes: [cartaoDeProva("cartao-1")] }),
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
