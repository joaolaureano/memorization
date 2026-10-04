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
} from "../src/acervo-cliente/cliente";
import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
} from "../src/acervo-cliente/cliente";
import { segundaFeiraDe } from "../src/agenda/datas";
import { PaginaDaCentralDeEstudo } from "../src/ui/PaginaDaCentralDeEstudo";

/**
 * Provas da área Estudo (FR-312..FR-315, FR-319, FR-320).
 *
 * A tela reúne três blocos com estado próprio — a Agenda semanal, as
 * Estatísticas dos últimos sete dias e as últimas Sessões —, e a prova monta um
 * `ClienteDoAcervo` restrito às duas leituras que ela consome, `obterAgenda` e
 * `obterEstatisticas`. Assim cada prova fala de um bloco sem atravessar as
 * regras de janela, de idempotência e de rotina, que são de outras features.
 */

afterEach(() => {
  cleanup();
});

/**
 * O `ClienteDoAcervo` de prova, restrito às leituras da área Estudo. A Agenda
 * padrão é a semana pedida, sem Compromissos; as demais operações não são
 * montadas porque a tela não as chama.
 */
function clienteDeProva(
  obterEstatisticas: ClienteDoAcervo["obterEstatisticas"],
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
  return { obterEstatisticas, obterAgenda } as ClienteDoAcervo;
}

/** As Estatísticas de prova, com acervo e listas vazios por padrão. */
function estatisticasDeProva(extras: Partial<Estatisticas> = {}): Estatisticas {
  return {
    cartoes: 0,
    baralhos: 0,
    registrosDaJanela: [],
    recentes: [],
    ...extras,
  };
}

/** Um Registro de Sessão de prova, com os totais e o resto informados. */
function registroDeProva(
  id: string,
  totais: { estudados: number; acertos: number; erros: number },
  extras: { nomeDoBaralho?: string; concluidaEm?: string } = {},
): RegistroResumido {
  return {
    id,
    origem: "baralho",
    baralhoId: "baralho-1",
    nomeDoBaralho: extras.nomeDoBaralho ?? "Inglês",
    concluidaEm: extras.concluidaEm ?? new Date().toISOString(),
    estudados: totais.estudados,
    acertos: totais.acertos,
    erros: totais.erros,
  };
}

/** O valor do tile cujo rótulo é informado (FR-314). */
function valorDaEstatistica(rotulo: string): string {
  const tile = screen.getByText(rotulo).closest(".estatistica");

  return tile?.querySelector(".estatistica__valor")?.textContent ?? "";
}

/** Monta a área Estudo com as Estatísticas informadas. */
function renderDaPagina(
  estatisticas: Estatisticas,
  obterAgenda?: ClienteDoAcervo["obterAgenda"],
): void {
  render(
    <PaginaDaCentralDeEstudo
      cliente={clienteDeProva(
        async () => ({ ok: true, estatisticas }),
        obterAgenda,
      )}
    />,
  );
}

/** Os sete botões de dia do calendário da Agenda semanal (FR-228). */
function botoesDeDia(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(".agenda__dia"),
  );
}

/**
 * O botão de dia com o estado de seleção pedido. A prova da seleção precisa
 * dele antes e depois da releitura: é o `aria-pressed` que diz qual dia está
 * escolhido (FR-228, FR-319).
 */
function diaComSelecao(pressionado: boolean): HTMLButtonElement {
  const dia = botoesDeDia().find(
    (candidato) =>
      candidato.getAttribute("aria-pressed") === String(pressionado),
  );

  if (dia === undefined) {
    throw new Error(
      `A Agenda não desenhou um dia com aria-pressed="${pressionado}".`,
    );
  }

  return dia;
}

describe("PaginaDaCentralDeEstudo", () => {
  it("apresenta o título da área e as duas ações no cabeçalho (FR-312)", async () => {
    renderDaPagina(estatisticasDeProva({ cartoes: 4, baralhos: 2 }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Estudo" }),
    ).toBeTruthy();
    expect(screen.getByText("Seu estudo")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Agendar estudo" }).getAttribute("href"),
    ).toBe("#/agenda/nova");
    expect(
      screen
        .getByRole("link", { name: "Gerenciar rotinas" })
        .getAttribute("href"),
    ).toBe("#/agenda");

    // As Estatísticas chegam depois; esperá-las evita terminar a prova com uma
    // leitura ainda a meio caminho.
    await screen.findByText("Itens estudados");
  });

  it("ordena os blocos: Agenda, Estatísticas e últimas Sessões (FR-312)", async () => {
    renderDaPagina(estatisticasDeProva());

    await screen.findByText("Itens estudados");

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((titulo) => titulo.textContent),
    ).toEqual([
      "Agenda semanal",
      "Seu estudo nos últimos 7 dias",
      "Últimas sessões",
    ]);
  });

  it("soma os Itens da semana e calcula a taxa de acerto (FR-314)", async () => {
    // Oito Sessões que somam 120 Itens estudados e 101 acertos: 84%.
    renderDaPagina(
      estatisticasDeProva({
        registrosDaJanela: [
          ...[0, 1, 2, 3, 4].map((indice) =>
            registroDeProva(`sessao-${indice}`, {
              estudados: 15,
              acertos: 13,
              erros: 2,
            }),
          ),
          ...[5, 6, 7].map((indice) =>
            registroDeProva(`sessao-${indice}`, {
              estudados: 15,
              acertos: 12,
              erros: 3,
            }),
          ),
        ],
      }),
    );

    await screen.findByText("Itens estudados");

    expect(valorDaEstatistica("Itens estudados")).toBe("120");
    expect(valorDaEstatistica("Sessões concluídas")).toBe("8");
    expect(valorDaEstatistica("Taxa de acerto")).toBe("84%");
  });

  it("usa travessão na taxa quando não há Registros na janela (FR-314)", async () => {
    renderDaPagina(estatisticasDeProva({ cartoes: 5, baralhos: 1 }));

    await screen.findByText("Sem Itens estudados nos últimos 7 dias");

    expect(valorDaEstatistica("Taxa de acerto")).toBe("—");
  });

  it("lista as últimas Sessões mesmo fora da janela de sete dias (FR-315)", async () => {
    renderDaPagina(
      estatisticasDeProva({
        recentes: [
          registroDeProva(
            "sessao-de-2024",
            { estudados: 10, acertos: 8, erros: 2 },
            {
              nomeDoBaralho: "História",
              // Fora da janela dos últimos sete dias: a lista é das últimas
              // Sessões, não das Sessões da semana.
              concluidaEm: "2024-01-05T10:00:00.000Z",
            },
          ),
        ],
      }),
    );

    const ultimas = screen.getByRole("region", { name: "Últimas sessões" });
    const sessao = await within(ultimas).findByRole("link", {
      name: /História/,
    });

    expect(sessao.getAttribute("href")).toBe("#/sessoes/sessao-de-2024");
    expect(sessao.getAttribute("aria-label")).toContain("80%");
  });

  it("mantém a Agenda quando as Estatísticas falham e permite tentar de novo (FR-318)", async () => {
    let tentativas = 0;

    render(
      <PaginaDaCentralDeEstudo
        cliente={clienteDeProva(async () => {
          tentativas += 1;

          return tentativas === 1
            ? {
                ok: false,
                erro: INDISPONIVEL,
                mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
              }
            : { ok: true, estatisticas: estatisticasDeProva() };
        })}
      />,
    );

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO),
    ).toBeTruthy();
    // A falha das Estatísticas não esconde a Agenda: ela segue inteira.
    expect(
      screen.getByRole("heading", { level: 2, name: "Agenda semanal" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Semana anterior" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Atualizar agenda" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(valorDaEstatistica("Itens estudados")).toBe("0");
    });
    expect(tentativas).toBe(2);
  });

  it("mantém as Estatísticas quando a Agenda falha (FR-318)", async () => {
    render(
      <PaginaDaCentralDeEstudo
        cliente={clienteDeProva(
          async () => ({ ok: true, estatisticas: estatisticasDeProva() }),
          async () => ({
            ok: false,
            erro: "indisponivel",
            mensagem: "Agenda fora",
          }),
        )}
      />,
    );

    expect(await screen.findByText("Agenda fora")).toBeTruthy();
    await screen.findByText("Itens estudados");
    expect(valorDaEstatistica("Itens estudados")).toBe("0");
    expect(
      screen.getByRole("region", { name: "Seu estudo nos últimos 7 dias" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Atualizar agenda" }),
    ).toBeNull();
  });

  it("preserva o dia escolhido quando a tela volta a ficar visível (FR-319, FR-320)", async () => {
    const chamadas = { total: 0, primeiraSemana: "", ultimaSemana: "" };

    render(
      <PaginaDaCentralDeEstudo
        cliente={clienteDeProva(
          async () => ({ ok: true, estatisticas: estatisticasDeProva() }),
          // A semana pedida volta como veio, e o «hoje» do servidor é a sua
          // segunda-feira: o dia de hoje fica sempre dentro da semana em vista.
          async (inicio, fuso) => {
            chamadas.total += 1;

            if (chamadas.total === 1) {
              chamadas.primeiraSemana = inicio;
            }

            chamadas.ultimaSemana = inicio;

            return {
              ok: true,
              agenda: {
                inicio,
                hoje: segundaFeiraDe(inicio),
                fuso,
                compromissos: [],
                compromissosDeHoje: [],
              },
            };
          },
        )}
      />,
    );

    await screen.findByRole("button", { name: "Semana anterior" });
    expect(chamadas.total).toBe(1);

    // Hoje é o dia que vem selecionado; escolhemos outro e guardamos qual é.
    const outroDia = diaComSelecao(false);
    const dataEscolhida = outroDia.dataset.data;

    fireEvent.click(outroDia);
    expect(outroDia.getAttribute("aria-pressed")).toBe("true");

    fireEvent(document, new Event("visibilitychange"));

    await waitFor(() => {
      expect(chamadas.total).toBe(2);
    });
    // A releitura é da mesma semana — e a escolha do dia continua de pé.
    expect(chamadas.ultimaSemana).toBe(chamadas.primeiraSemana);

    await waitFor(() => {
      expect(diaComSelecao(true).dataset.data).toBe(dataEscolhida);
    });
  });
});
