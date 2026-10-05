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
  Estatisticas,
  RegistroResumido,
} from "../src/acervo-cliente/cliente";
import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
} from "../src/acervo-cliente/cliente";
import {
  PainelDaSemana,
  ResumoDeSeteDias,
  UltimasSessoes,
  useEstatisticasDoEstudo,
} from "../src/ui/EstatisticasDoEstudo";

/**
 * Provas do módulo de apresentação das Estatísticas (FR-308, FR-314, FR-321,
 * FR-326).
 *
 * Os três componentes são puros: recebem as Estatísticas e o instante `agora`,
 * e é isso que estas provas entregam, sem cliente nenhum. O hook, que fala com
 * o `ClienteDoAcervo`, é exercitado por um componente de prova que mostra o
 * estado devolvido — assim as provas cobrem o ciclo de vida da leitura
 * (resposta atrasada, falha que não apaga o que havia, releitura na volta da
 * aba e exceção) sem montar a tela inteira que a consome.
 */

afterEach(() => {
  cleanup();
});

/** O instante que serve de "agora" para as provas dos componentes puros. */
const AGORA = new Date();

/** Um resultado de leitura, como o cliente o devolve. */
type ResultadoDasEstatisticas = Awaited<
  ReturnType<ClienteDoAcervo["obterEstatisticas"]>
>;

/**
 * Um meio-dia local, `diasAtras` dias antes de `AGORA`. O meio-dia fica longe
 * das bordas do dia, de modo que o Registro caia no mesmo dia em qualquer fuso
 * de quem corre a prova.
 */
function meioDiaDeHoje(diasAtras = 0): string {
  return new Date(
    AGORA.getFullYear(),
    AGORA.getMonth(),
    AGORA.getDate() - diasAtras,
    12,
  ).toISOString();
}

/** Um Registro de Sessão de prova, com os totais e o resto informados. */
function registroDeProva(
  id: string,
  totais: { estudados: number; acertos: number },
  extras: {
    origem?: RegistroResumido["origem"];
    nomeDoBaralho?: string;
    concluidaEm?: string;
  } = {},
): RegistroResumido {
  return {
    id,
    origem: extras.origem ?? "baralho",
    baralhoId: "baralho-1",
    nomeDoBaralho: extras.nomeDoBaralho ?? "Inglês",
    concluidaEm: extras.concluidaEm ?? meioDiaDeHoje(),
    estudados: totais.estudados,
    acertos: totais.acertos,
    erros: totais.estudados - totais.acertos,
  };
}

/** As Estatísticas de prova, com os Registros da janela informados. */
function estatisticasDe(
  registrosDaJanela: RegistroResumido[] = [],
  extras: { recentes?: RegistroResumido[]; cartoes?: number } = {},
): Estatisticas {
  return {
    cartoes: extras.cartoes ?? 12,
    baralhos: 3,
    registrosDaJanela,
    recentes: extras.recentes ?? [],
  };
}

/**
 * Oito Sessões na janela, somando 120 Itens estudados e 101 acertos — metade
 * hoje, metade três dias atrás. A taxa do período é 84%, e nenhuma Sessão
 * sozinha chega a esse número.
 */
function registrosDaSemana(): RegistroResumido[] {
  return [
    registroDeProva("hoje-1", { estudados: 20, acertos: 17 }),
    registroDeProva("hoje-2", { estudados: 30, acertos: 25 }),
    registroDeProva("hoje-3", { estudados: 10, acertos: 8 }),
    registroDeProva("antes-1", { estudados: 10, acertos: 9 }, {
      concluidaEm: meioDiaDeHoje(3),
    }),
    registroDeProva("antes-2", { estudados: 10, acertos: 9 }, {
      concluidaEm: meioDiaDeHoje(3),
    }),
    registroDeProva("antes-3", { estudados: 12, acertos: 10 }, {
      concluidaEm: meioDiaDeHoje(3),
    }),
    registroDeProva("antes-4", { estudados: 14, acertos: 12 }, {
      concluidaEm: meioDiaDeHoje(3),
    }),
    registroDeProva("antes-5", { estudados: 14, acertos: 11 }, {
      concluidaEm: meioDiaDeHoje(3),
    }),
  ];
}

/** O valor do tile cujo rótulo é informado. */
function valorDaEstatistica(rotulo: string): string {
  const tile = screen.getByText(rotulo).closest(".estatistica");

  return tile?.querySelector(".estatistica__valor")?.textContent ?? "";
}

/** Os totais de Itens da lista textual do gráfico, na ordem dos sete dias. */
function itensDaListaTextual(): number[] {
  const lista = document.querySelector(".visualmente-oculto");
  const itens = lista === null ? [] : Array.from(lista.querySelectorAll("li"));

  return itens.map((item) =>
    Number(
      /:\s*(\d+)\s+Itens$/.exec(item.textContent ?? "")?.[1] ?? Number.NaN,
    ),
  );
}

/** O `ClienteDoAcervo` de prova, restrito à leitura que o hook exercita. */
function clienteComEstatisticas(
  obterEstatisticas: ClienteDoAcervo["obterEstatisticas"],
): ClienteDoAcervo {
  // As demais operações do acervo não são montadas porque o hook não as chama;
  // a asserção é estrutural e não esconde o que a prova cobre.
  return { obterEstatisticas } as ClienteDoAcervo;
}

describe("ResumoDeSeteDias e PainelDaSemana", () => {
  it("resume os sete dias e mostra o painel da semana", () => {
    const estatisticas = estatisticasDe(registrosDaSemana());

    render(
      <div>
        <ResumoDeSeteDias estatisticas={estatisticas} />
        <PainelDaSemana estatisticas={estatisticas} agora={AGORA} />
      </div>,
    );

    // 101 acertos em 120 Itens estudados: a taxa é do período, não de uma
    // Sessão, e aparece tanto no resumo quanto no painel.
    expect(
      screen.getByText("Últimos 7 dias: 120 Itens estudados · 84% de acerto"),
    ).toBeTruthy();
    expect(valorDaEstatistica("Itens estudados")).toBe("120");
    expect(valorDaEstatistica("Sessões concluídas")).toBe("8");
    expect(valorDaEstatistica("Taxa de acerto")).toBe("84%");

    // A lista textual é a do gráfico, com os sete dias somando os mesmos 120.
    expect(screen.getByText("Hoje: 60 Itens")).toBeTruthy();

    const itens = itensDaListaTextual();

    expect(itens).toHaveLength(7);
    expect(itens.reduce((total, valor) => total + valor, 0)).toBe(120);
  });

  it("diz que nenhum Item foi estudado e nunca mostra 0% (FR-308)", () => {
    const estatisticas = estatisticasDe();

    render(
      <div>
        <ResumoDeSeteDias estatisticas={estatisticas} />
        <PainelDaSemana estatisticas={estatisticas} agora={AGORA} />
      </div>,
    );

    expect(
      screen.getByText("Últimos 7 dias: nenhum Item estudado."),
    ).toBeTruthy();
    expect(valorDaEstatistica("Itens estudados")).toBe("0");
    expect(valorDaEstatistica("Sessões concluídas")).toBe("0");
    // Sem Itens não há taxa: o travessão ocupa o lugar do número.
    expect(valorDaEstatistica("Taxa de acerto")).toBe("—");
    expect(
      screen.getByText("Sem Itens estudados nos últimos 7 dias"),
    ).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("desenha os sete dias do gráfico com os números à mão", () => {
    render(
      <PainelDaSemana
        estatisticas={estatisticasDe(registrosDaSemana())}
        agora={AGORA}
      />,
    );

    // O gráfico é decorativo: os `listitem` que sobram são os da lista textual.
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(
      screen.getByRole("region", { name: "Itens estudados nos últimos 7 dias" }),
    ).toBeTruthy();
  });
});

describe("UltimasSessoes", () => {
  it("avisa quando nenhuma Sessão foi concluída", () => {
    render(<UltimasSessoes recentes={[]} />);

    expect(
      screen.getByText("Você ainda não concluiu nenhuma Sessão."),
    ).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("liga cada Sessão ao seu Registro, mesmo com data antiga", () => {
    const concluidaEm = new Date(2024, 0, 5, 14, 30).toISOString();

    render(
      <UltimasSessoes
        recentes={[
          registroDeProva(
            "sessao-1",
            { estudados: 3, acertos: 2 },
            { concluidaEm },
          ),
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: /Inglês/ });

    expect(link.getAttribute("href")).toBe("#/sessoes/sessao-1");
    expect(
      screen.getByText(
        new Date(concluidaEm).toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }),
      ),
    ).toBeTruthy();
    expect(screen.getByText("67%")).toBeTruthy();
  });

  it("apresenta no máximo cinco Sessões, na ordem recebida", () => {
    const recentes = Array.from({ length: 6 }, (_, indice) =>
      registroDeProva(
        `sessao-${indice + 1}`,
        { estudados: 2, acertos: 2 },
        { nomeDoBaralho: `Baralho ${indice + 1}` },
      ),
    );

    render(<UltimasSessoes recentes={recentes} />);

    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /Baralho 5/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Baralho 6/ })).toBeNull();
  });

  it("chama de 'Revisão do dia' a Sessão que veio da revisão", () => {
    render(
      <UltimasSessoes
        recentes={[
          registroDeProva(
            "sessao-1",
            { estudados: 2, acertos: 1 },
            { origem: "revisao" },
          ),
        ]}
      />,
    );

    expect(screen.getByText("Revisão do dia")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Revisão do dia/ })).toBeTruthy();
  });

  it("chama de 'Estudo com baralho temporário' a Sessão do baralho temporário (FR-376, T2318)", () => {
    render(
      <UltimasSessoes
        recentes={[
          registroDeProva("sessao-1", { estudados: 2, acertos: 1 }, {
            origem: "temporario",
            nomeDoBaralho: "Estudo com baralho temporário",
          }),
        ]}
      />,
    );

    expect(
      screen.getByText("Estudo com baralho temporário"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Estudo com baralho temporário/ }),
    ).toBeInTheDocument();
  });

  it("mostra o instante cru quando a data não é legível", () => {
    render(
      <UltimasSessoes
        recentes={[
          registroDeProva(
            "sessao-1",
            { estudados: 1, acertos: 1 },
            { concluidaEm: "sem data" },
          ),
        ]}
      />,
    );

    expect(screen.getByText("sem data")).toBeTruthy();
  });

  it("usa travessão no percentual de uma Sessão sem Itens", () => {
    render(
      <UltimasSessoes
        recentes={[registroDeProva("sessao-1", { estudados: 0, acertos: 0 })]}
      />,
    );

    expect(screen.getByText("—")).toBeTruthy();
  });
});

/**
 * O componente de prova do hook: mostra o que ele devolve e oferece o caminho
 * de tentar de novo, sem depender da tela que o consome.
 */
function ProvaDoHook({ cliente }: { cliente: ClienteDoAcervo }) {
  const { estado, tentarNovamente } = useEstatisticasDoEstudo(cliente);

  return (
    <div>
      <p>{estado.carregando ? "Carregando…" : "Parado"}</p>
      {estado.falha === null ? null : <p role="alert">{estado.falha}</p>}
      <p>
        {estado.dados === null
          ? "Sem dados"
          : `Cartões: ${estado.dados.estatisticas.cartoes}`}
      </p>
      <button type="button" onClick={tentarNovamente}>
        Tentar novamente
      </button>
    </div>
  );
}

describe("useEstatisticasDoEstudo", () => {
  it("descarta a resposta de uma leitura antiga que chega depois da mais nova", async () => {
    const respostas: Array<(resultado: ResultadoDasEstatisticas) => void> = [];
    const cliente = clienteComEstatisticas(
      () =>
        new Promise<ResultadoDasEstatisticas>((resolve) => {
          respostas.push(resolve);
        }),
    );

    render(<ProvaDoHook cliente={cliente} />);
    expect(respostas).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(respostas).toHaveLength(2);

    respostas[1]?.({
      ok: true,
      estatisticas: estatisticasDe([], { cartoes: 7 }),
    });
    expect(await screen.findByText("Cartões: 7")).toBeTruthy();

    // A primeira leitura responde atrasada: ela não pode voltar a valer.
    respostas[0]?.({
      ok: true,
      estatisticas: estatisticasDe([], { cartoes: 3 }),
    });

    await waitFor(() => {
      expect(screen.queryByText("Cartões: 3")).toBeNull();
    });
    expect(screen.getByText("Cartões: 7")).toBeTruthy();
  });

  it("mantém os dados anteriores e mostra a falha quando a nova leitura falha", async () => {
    let leituras = 0;
    const cliente = clienteComEstatisticas(
      async (): Promise<ResultadoDasEstatisticas> => {
        leituras += 1;

        if (leituras === 1) {
          return { ok: true, estatisticas: estatisticasDe([], { cartoes: 4 }) };
        }

        return {
          ok: false,
          erro: INDISPONIVEL,
          mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
        };
      },
    );

    render(<ProvaDoHook cliente={cliente} />);
    expect(await screen.findByText("Cartões: 4")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO),
    ).toBeTruthy();
    // A falha não apaga o que já estava na tela (FR-320).
    expect(screen.getByText("Cartões: 4")).toBeTruthy();
    expect(leituras).toBe(2);
  });

  it("relê quando a aba volta a ficar visível (FR-318)", async () => {
    let leituras = 0;
    const cliente = clienteComEstatisticas(async () => {
      leituras += 1;

      return {
        ok: true,
        estatisticas: estatisticasDe([], { cartoes: leituras }),
      };
    });

    render(<ProvaDoHook cliente={cliente} />);
    expect(await screen.findByText("Cartões: 1")).toBeTruthy();

    // O jsdom mantém a aba visível: o que a prova entrega é o evento que o
    // navegador dispara ao voltar para a tela.
    fireEvent(document, new Event("visibilitychange"));

    expect(await screen.findByText("Cartões: 2")).toBeTruthy();
    expect(leituras).toBe(2);
  });

  it("trata a exceção do cliente como falha, nunca como zero", async () => {
    const cliente = clienteComEstatisticas(async () => {
      throw new Error("acervo fora do ar");
    });

    render(<ProvaDoHook cliente={cliente} />);

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO),
    ).toBeTruthy();
    expect(screen.getByText("Sem dados")).toBeTruthy();
    expect(screen.queryByText("Cartões: 0")).toBeNull();
  });
});
