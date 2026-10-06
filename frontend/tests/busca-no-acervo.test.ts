import { describe, expect, it } from "vitest";

import {
  cartoesDoBaralho,
  cartoesPendentes,
  classificarBaralhos,
  filtrarBaralhos,
  filtrarBaralhosPorSituacao,
  filtrarCartoes,
  rotuloDaSituacaoDoBaralho,
  situacaoDaRevisao,
  situacaoDoBaralho,
} from "../src/acervo-cliente/busca-no-acervo";
import type {
  BaralhoPesquisavel,
  CartaoPesquisavel,
  CriteriosDeCartoes,
  SituacaoDoBaralho,
} from "../src/acervo-cliente/busca-no-acervo";

/** O instante fixo dos testes: 5 de outubro de 2026, 9h locais. */
const AGORA = new Date(2026, 9, 5, 9, 0);

/** Os critérios com os padrões da página, sobrescritos pelo que o teste pedir. */
function criterios(
  parcial: Partial<CriteriosDeCartoes> = {},
): CriteriosDeCartoes {
  return {
    consulta: "",
    baralho: "todos",
    ...parcial,
  };
}

/** Um Cartão pesquisável montado com seu Baralho dono. */
function cartao(
  id: string,
  frente: string,
  verso: string,
  baralhoId: string,
  proximaRevisaoEm: string | null = null,
): CartaoPesquisavel {
  return {
    id,
    frente,
    verso,
    baralho: { id: baralhoId },
    proximaRevisaoEm,
  };
}

describe("filtrarBaralhos", () => {
  const baralhos: BaralhoPesquisavel[] = [
    { id: "b1", nome: "Álgebra linear" },
    { id: "b2", nome: "Cálculo" },
    { id: "b3", nome: "Geometria analítica" },
  ];

  it('encontra "Álgebra linear" ao buscar "algebra", sem acento e sem caixa (FR-348, FR-350)', () => {
    expect(filtrarBaralhos(baralhos, "algebra")).toEqual([baralhos[0]]);
  });

  it('encontra "Álgebra linear" com "  ÁLGEBRA  ", aparado nas pontas (FR-348, FR-350)', () => {
    expect(filtrarBaralhos(baralhos, "  ÁLGEBRA  ")).toEqual([baralhos[0]]);
  });

  it("devolve todos os Baralhos, na ordem recebida, com consulta vazia ou só espaços (FR-350)", () => {
    expect(filtrarBaralhos(baralhos, "")).toEqual(baralhos);
    expect(filtrarBaralhos(baralhos, "   ")).toEqual(baralhos);
  });

  it("devolve [] quando nenhum Baralho corresponde à consulta (FR-350)", () => {
    expect(filtrarBaralhos(baralhos, "física")).toEqual([]);
  });
});

describe("filtrarCartoes", () => {
  it("encontra o Cartão por um termo que só aparece no Verso (FR-349)", () => {
    const cartoes = [
      cartao("c1", "Capital da França", "Paris", "b1"),
      cartao("c2", "Capital da Itália", "Roma", "b1"),
    ];

    expect(
      filtrarCartoes(cartoes, criterios({ consulta: "paris" })),
    ).toEqual([cartoes[0]]);
  });

  it("combina texto e baralho por interseção, devolvendo só o Cartão que satisfaz os dois (FR-353, FR-382)", () => {
    const satisfaz = cartao("c1", "Matriz identidade", "Álgebra", "b1");
    const cartoes = [
      satisfaz,
      cartao("c2", "Matriz identidade", "Álgebra", "b2"),
      cartao("c3", "Determinante", "Cálculo", "b1"),
      cartao("c4", "Determinante", "Matriz", "b2"),
    ];

    const resultado = filtrarCartoes(
      cartoes,
      criterios({ consulta: "matriz", baralho: "b1" }),
    );

    expect(resultado).toEqual([satisfaz]);
  });

  it("filtra cada Cartão pelo seu único Baralho", () => {
    const primeiro = cartao("c1", "Frente", "Verso", "b1");
    const segundo = cartao("c2", "Frente", "Verso", "b2");

    const porB1 = filtrarCartoes([primeiro, segundo], criterios({ baralho: "b1" }));
    const porB2 = filtrarCartoes([primeiro, segundo], criterios({ baralho: "b2" }));

    expect(porB1).toEqual([primeiro]);
    expect(porB2).toEqual([segundo]);
    expect(porB1).toHaveLength(1);
  });

  it("mantém dois Cartões de mesma Frente como dois resultados distintos (FR-353)", () => {
    const primeiro = cartao("c1", "Mesma frente", "Primeiro verso", "b1");
    const segundo = cartao("c2", "Mesma frente", "Segundo verso", "b1");

    const resultado = filtrarCartoes(
      [primeiro, segundo],
      criterios({ consulta: "mesma frente" }),
    );

    expect(resultado).toHaveLength(2);
    expect(resultado.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("preserva a ordem recebida dos Cartões ao filtrar (FR-353)", () => {
    const cartoes = [
      cartao("c3", "Conceito C", "Verso", "b1"),
      cartao("c1", "Conceito A", "Verso", "b1"),
      cartao("c2", "Conceito B", "Verso", "b1"),
    ];

    const ordem = filtrarCartoes(
      cartoes,
      criterios({ consulta: "conceito" }),
    ).map((c) => c.id);

    expect(ordem).toEqual(["c3", "c1", "c2"]);
  });
});

describe("situacaoDaRevisao", () => {
  it('classifica como "novos" o Cartão sem Agendamento (FR-352, SC-140)', () => {
    expect(situacaoDaRevisao(null, AGORA)).toBe("novos");
  });

  it('classifica como "revisao-pendente" o dia local anterior a agora (FR-352, SC-140)', () => {
    const ontem = new Date(2026, 9, 4, 15, 0).toISOString();

    expect(situacaoDaRevisao(ontem, AGORA)).toBe("revisao-pendente");
  });

  it('classifica como "revisao-pendente" hoje com horário ainda não alcançado (FR-352, SC-140)', () => {
    const hojeMaisTarde = new Date(2026, 9, 5, 23, 0).toISOString();

    expect(situacaoDaRevisao(hojeMaisTarde, AGORA)).toBe("revisao-pendente");
  });

  it('classifica como "em-dia" o dia local seguinte a agora (FR-352, SC-140)', () => {
    const amanha = new Date(2026, 9, 6, 0, 30).toISOString();

    expect(situacaoDaRevisao(amanha, AGORA)).toBe("em-dia");
  });

  it('classifica como "revisao-pendente" uma data ilegível, para não esconder o Cartão de quem procura revisões (FR-352)', () => {
    expect(situacaoDaRevisao("nem parece uma data", AGORA)).toBe(
      "revisao-pendente",
    );
  });
});

/** As datas de prova, relativas ao dia local de AGORA (FR-379). */
const ONTEM = new Date(2026, 9, 4, 15, 0).toISOString();
const HOJE_MAIS_TARDE = new Date(2026, 9, 5, 23, 0).toISOString();
const AMANHA = new Date(2026, 9, 6, 0, 30).toISOString();

describe("situacaoDoBaralho", () => {
  it("classifica o conjunto sem Cartões como sem-cartoes, nunca como revisado (FR-380, SC-151)", () => {
    expect(situacaoDoBaralho([], AGORA)).toBe("sem-cartoes");
  });

  it("um Cartão novo deixa o Baralho pendente (FR-379)", () => {
    expect(situacaoDoBaralho([null, AMANHA], AGORA)).toBe("pendente");
  });

  it("um Cartão com a revisão de ontem deixa o Baralho pendente (FR-379, SC-151)", () => {
    expect(situacaoDoBaralho([ONTEM, AMANHA], AGORA)).toBe("pendente");
  });

  it("um Cartão com a revisão de hoje, mesmo mais tarde, deixa o Baralho pendente (FR-379, SC-151)", () => {
    expect(situacaoDoBaralho([HOJE_MAIS_TARDE], AGORA)).toBe("pendente");
  });

  it("só o conjunto não vazio com todos os Cartões no futuro é revisado (FR-379, SC-151)", () => {
    expect(situacaoDoBaralho([AMANHA], AGORA)).toBe("revisado");
  });

  it("uma data ilegível conta como pendente e nunca produz um revisado falso (FR-387, SC-151)", () => {
    expect(situacaoDoBaralho([AMANHA, "nem parece uma data"], AGORA)).toBe(
      "pendente",
    );
  });
});

describe("classificarBaralhos", () => {
  it("devolve uma entrada para todo Baralho, com sem-cartoes para o vazio (FR-380, SC-151)", () => {
    const situacoes = classificarBaralhos(
      [{ id: "vazio" }, { id: "em-dia" }],
      [cartao("c1", "Frente", "Verso", "em-dia", AMANHA)],
      AGORA,
    );

    expect(situacoes.get("vazio")).toBe("sem-cartoes");
    expect(situacoes.get("em-dia")).toBe("revisado");
    expect(situacoes.size).toBe(2);
  });

  it("classifica cada Baralho pelas datas dos seus Cartões, inclusive novos, de ontem, de hoje e de amanhã (FR-379, SC-151)", () => {
    const situacoes = classificarBaralhos(
      [{ id: "b-novo" }, { id: "b-ontem" }, { id: "b-hoje" }, { id: "b-amanha" }],
      [
        cartao("c1", "Novo", "Verso", "b-novo", null),
        cartao("c2", "Ontem", "Verso", "b-ontem", ONTEM),
        cartao("c3", "Hoje", "Verso", "b-hoje", HOJE_MAIS_TARDE),
        cartao("c4", "Amanhã", "Verso", "b-amanha", AMANHA),
      ],
      AGORA,
    );

    expect(situacoes.get("b-novo")).toBe("pendente");
    expect(situacoes.get("b-ontem")).toBe("pendente");
    expect(situacoes.get("b-hoje")).toBe("pendente");
    expect(situacoes.get("b-amanha")).toBe("revisado");
  });

  it("cópias em Baralhos distintos são classificadas separadamente (FR-379)", () => {
    const original = cartao("c1", "Frente", "Verso", "b1", ONTEM);
    const copia = cartao("c1-copia", "Frente", "Verso", "b2", ONTEM);
    const futuros = [
      cartao("c2", "Frente 2", "Verso 2", "b2", AMANHA),
    ];

    const situacoes = classificarBaralhos(
      [{ id: "b1" }, { id: "b2" }],
      [original, copia, ...futuros],
      AGORA,
    );

    expect(situacoes.get("b1")).toBe("pendente");
    expect(situacoes.get("b2")).toBe("pendente");
  });
});

describe("filtrarBaralhosPorSituacao", () => {
  const baralhos: BaralhoPesquisavel[] = [
    { id: "b1", nome: "Pendente" },
    { id: "b2", nome: "Revisado" },
    { id: "b3", nome: "Vazio" },
  ];
  const situacoes = new Map<string, SituacaoDoBaralho>([
    ["b1", "pendente"],
    ["b2", "revisado"],
    ["b3", "sem-cartoes"],
  ]);

  it("Todos devolve a lista inteira, inclusive os Baralhos vazios (FR-381)", () => {
    expect(filtrarBaralhosPorSituacao(baralhos, situacoes, "todos")).toEqual(
      baralhos,
    );
  });

  it("Pendente devolve só os pendentes, excluindo revisados e vazios (FR-380, FR-381)", () => {
    expect(
      filtrarBaralhosPorSituacao(baralhos, situacoes, "pendente"),
    ).toEqual([baralhos[0]]);
  });

  it("Revisado devolve só os revisados, excluindo vazios (FR-380, FR-381)", () => {
    expect(
      filtrarBaralhosPorSituacao(baralhos, situacoes, "revisado"),
    ).toEqual([baralhos[1]]);
  });

  it("preserva a ordem recebida e trata um Baralho fora do mapa como vazio (FR-381)", () => {
    const comDesconhecido = [...baralhos, { id: "b4", nome: "Desconhecido" }];

    expect(
      filtrarBaralhosPorSituacao(comDesconhecido, situacoes, "todos").map(
        (baralho) => baralho.id,
      ),
    ).toEqual(["b1", "b2", "b3", "b4"]);
    expect(
      filtrarBaralhosPorSituacao(comDesconhecido, situacoes, "revisado").map(
        (baralho) => baralho.id,
      ),
    ).toEqual(["b2"]);
  });
});

describe("cartoesDoBaralho", () => {
  it("devolve os Cartões do Baralho na ordem recebida (FR-384)", () => {
    const cartoes = [
      cartao("c1", "Um", "Verso", "b1"),
      cartao("c2", "Dois", "Verso", "b1"),
      cartao("c3", "Três", "Verso", "b2"),
    ];

    expect(cartoesDoBaralho(cartoes, "b1").map((c) => c.id)).toEqual([
      "c1",
      "c2",
    ]);
    expect(cartoesDoBaralho(cartoes, "b2").map((c) => c.id)).toEqual([
      "c3",
    ]);
    expect(cartoesDoBaralho(cartoes, "b3")).toEqual([]);
  });
});

describe("cartoesPendentes", () => {
  it("inclui novos, vencidos e datas ilegíveis, e exclui os em dia (FR-383, SC-152)", () => {
    const cartoes = [
      cartao("novo", "Novo", "Verso", "b1", null),
      cartao("ontem", "Ontem", "Verso", "b1", ONTEM),
      cartao("hoje", "Hoje", "Verso", "b1", HOJE_MAIS_TARDE),
      cartao("ilegivel", "Ilegível", "Verso", "b1", "nem parece uma data"),
      cartao("amanha", "Amanhã", "Verso", "b1", AMANHA),
    ];

    expect(cartoesPendentes(cartoes, AGORA).map((c) => c.id)).toEqual([
      "novo",
      "ontem",
      "hoje",
      "ilegivel",
    ]);
  });
});

describe("rotuloDaSituacaoDoBaralho", () => {
  it('rotula as três situações: "Sem cartões", "Pendente" e "Revisado" (FR-380, SC-152)', () => {
    expect(rotuloDaSituacaoDoBaralho("sem-cartoes")).toBe("Sem cartões");
    expect(rotuloDaSituacaoDoBaralho("pendente")).toBe("Pendente");
    expect(rotuloDaSituacaoDoBaralho("revisado")).toBe("Revisado");
  });
});
