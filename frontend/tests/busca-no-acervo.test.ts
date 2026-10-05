import { describe, expect, it } from "vitest";

import {
  filtrarBaralhos,
  filtrarCartoes,
  situacaoDaRevisao,
} from "../src/acervo-cliente/busca-no-acervo";
import type {
  BaralhoPesquisavel,
  CartaoPesquisavel,
  CriteriosDeCartoes,
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
    situacao: "todos",
    ...parcial,
  };
}

/** Um Cartão pesquisável montado a partir dos Vínculos por id. */
function cartao(
  id: string,
  frente: string,
  verso: string,
  baralhos: readonly string[],
  proximaRevisaoEm: string | null = null,
): CartaoPesquisavel {
  return {
    id,
    frente,
    verso,
    baralhos: baralhos.map((baralhoId) => ({ id: baralhoId })),
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
      cartao("c1", "Capital da França", "Paris", ["b1"]),
      cartao("c2", "Capital da Itália", "Roma", ["b1"]),
    ];

    expect(
      filtrarCartoes(cartoes, criterios({ consulta: "paris" }), AGORA),
    ).toEqual([cartoes[0]]);
  });

  it("combina texto, baralho e situação por interseção, devolvendo só o Cartão que satisfaz os três (FR-353)", () => {
    const pendente = new Date(2026, 9, 4, 15, 0).toISOString();
    const futura = new Date(2026, 9, 6, 0, 30).toISOString();
    const satisfaz = cartao(
      "c1",
      "Matriz identidade",
      "Álgebra",
      ["b1"],
      pendente,
    );
    const cartoes = [
      satisfaz,
      cartao("c2", "Matriz identidade", "Álgebra", ["b2"], pendente),
      cartao("c3", "Matriz identidade", "Álgebra", ["b1"], futura),
      cartao("c4", "Determinante", "Cálculo", ["b1"], pendente),
    ];

    const resultado = filtrarCartoes(
      cartoes,
      criterios({
        consulta: "matriz",
        baralho: "b1",
        situacao: "revisao-pendente",
      }),
      AGORA,
    );

    expect(resultado).toEqual([satisfaz]);
  });

  it("devolve o Cartão em dois Baralhos uma única vez, ao filtrar por qualquer um deles (FR-351)", () => {
    const compartilhado = cartao("c1", "Frente", "Verso", ["b1", "b2"]);

    const porB1 = filtrarCartoes(
      [compartilhado],
      criterios({ baralho: "b1" }),
      AGORA,
    );
    const porB2 = filtrarCartoes(
      [compartilhado],
      criterios({ baralho: "b2" }),
      AGORA,
    );

    expect(porB1).toEqual([compartilhado]);
    expect(porB2).toEqual([compartilhado]);
    expect(porB1).toHaveLength(1);
  });

  it('devolve só os Cartões sem Vínculos com o filtro "sem-baralho" (FR-351)', () => {
    const solto = cartao("c1", "Solto", "Sem Baralho", []);
    const vinculado = cartao("c2", "Vinculado", "Com Baralho", ["b1"]);

    expect(
      filtrarCartoes(
        [solto, vinculado],
        criterios({ baralho: "sem-baralho" }),
        AGORA,
      ),
    ).toEqual([solto]);
  });

  it("mantém dois Cartões de mesma Frente como dois resultados distintos (FR-353)", () => {
    const primeiro = cartao("c1", "Mesma frente", "Primeiro verso", ["b1"]);
    const segundo = cartao("c2", "Mesma frente", "Segundo verso", ["b1"]);

    const resultado = filtrarCartoes(
      [primeiro, segundo],
      criterios({ consulta: "mesma frente" }),
      AGORA,
    );

    expect(resultado).toHaveLength(2);
    expect(resultado.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("preserva a ordem recebida dos Cartões ao filtrar (FR-353)", () => {
    const cartoes = [
      cartao("c3", "Conceito C", "Verso", []),
      cartao("c1", "Conceito A", "Verso", []),
      cartao("c2", "Conceito B", "Verso", []),
    ];

    const ordem = filtrarCartoes(
      cartoes,
      criterios({ consulta: "conceito" }),
      AGORA,
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
