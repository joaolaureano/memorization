import { describe, expect, it } from "vitest";

import {
  LIMITE_DA_SELECAO,
  adicionarCartoes,
  cartoesAusentes,
  indisponiveis,
  limparSelecao,
  removerCartao,
  retirarIndisponiveis,
  situacaoDaSelecao,
  type SelecaoTemporaria,
} from "../src/sessao-de-estudo/selecao-temporaria";

/** Baralho A: ["c1", "c2"] — congelado, para provar que nada o muta. */
const A: SelecaoTemporaria = Object.freeze(["c1", "c2"]);
/** Baralho B: ["c2", "c3"] — o "c2" já está em A: entra uma única vez. */
const B: SelecaoTemporaria = Object.freeze(["c2", "c3"]);
/** Cartão avulso: "c4". */
const AVULSO: SelecaoTemporaria = Object.freeze(["c4"]);

/** Uma seleção com `quantidade` ids distintos, na ordem crescente. */
function selecaoDe(quantidade: number): SelecaoTemporaria {
  return Array.from({ length: quantidade }, (_, indice) => `c${indice}`);
}

describe("adicionarCartoes", () => {
  it("soma A, B e o avulso na ordem de inclusão, sem repetir (SC-143, FR-364)", () => {
    const primeiro = adicionarCartoes(limparSelecao(), A);
    const segundo = adicionarCartoes(primeiro, B);
    const terceiro = adicionarCartoes(segundo, AVULSO);

    expect(terceiro).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("não muda nada ao repetir a adição do mesmo Baralho (FR-363)", () => {
    const comA = adicionarCartoes(limparSelecao(), A);

    expect(adicionarCartoes(comA, A)).toEqual(["c1", "c2"]);
    expect(adicionarCartoes(comA, A)).toEqual(comA);
  });

  it("não repete um id dentro do próprio lote (FR-363)", () => {
    expect(adicionarCartoes([], ["c1", "c1", "c2", "c1"])).toEqual([
      "c1",
      "c2",
    ]);
  });

  it("não muta o array recebido — Object.freeze na entrada (FR-363)", () => {
    const entrada = Object.freeze(["c1", "c2"]) as SelecaoTemporaria;

    const resultado = adicionarCartoes(entrada, Object.freeze(["c3"]));

    expect(entrada).toEqual(["c1", "c2"]);
    expect(resultado).toEqual(["c1", "c2", "c3"]);
    expect(resultado).not.toBe(entrada);
  });
});

describe("removerCartao", () => {
  it("tira só aquele Cartão e mantém o resto na ordem (FR-363)", () => {
    const selecao = adicionarCartoes(adicionarCartoes([], A), B);

    expect(removerCartao(selecao, "c2")).toEqual(["c1", "c3"]);
    expect(removerCartao(selecao, "c1")).toEqual(["c2", "c3"]);
  });

  it("não muta a seleção recebida — Object.freeze na entrada (FR-363)", () => {
    const selecao: SelecaoTemporaria = Object.freeze(["c1", "c2", "c3"]);

    const resultado = removerCartao(selecao, "c2");

    expect(selecao).toEqual(["c1", "c2", "c3"]);
    expect(resultado).toEqual(["c1", "c3"]);
    expect(resultado).not.toBe(selecao);
  });

  it("devolve a mesma lista quando o Cartão não está na seleção (FR-363)", () => {
    expect(removerCartao(["c1"], "c9")).toEqual(["c1"]);
  });
});

describe("limparSelecao", () => {
  it("esvazia a seleção (FR-363)", () => {
    expect(limparSelecao()).toEqual([]);
  });
});

describe("situacaoDaSelecao", () => {
  it("é vazia com 0 Cartões (FR-365)", () => {
    expect(situacaoDaSelecao(limparSelecao())).toBe("vazia");
  });

  it("é ok com 1 Cartão (FR-365)", () => {
    expect(situacaoDaSelecao(selecaoDe(1))).toBe("ok");
  });

  it("é ok com exatamente 1000 Cartões (FR-365, SC-143)", () => {
    const selecao = selecaoDe(LIMITE_DA_SELECAO);

    expect(selecao).toHaveLength(1000);
    expect(situacaoDaSelecao(selecao)).toBe("ok");
  });

  it("é acima-do-limite com 1001 Cartões (FR-365, SC-143)", () => {
    const selecao = selecaoDe(LIMITE_DA_SELECAO + 1);

    expect(selecao).toHaveLength(1001);
    expect(situacaoDaSelecao(selecao)).toBe("acima-do-limite");
  });
});

describe("cartoesAusentes", () => {
  it("lista os que ainda não estão na seleção, na ordem recebida (FR-363)", () => {
    expect(cartoesAusentes(["c1", "c3"], ["c3", "c1", "c2", "c4"])).toEqual([
      "c2",
      "c4",
    ]);
  });

  it("devolve vazio quando todos já estão na seleção (FR-363)", () => {
    expect(cartoesAusentes(["c1", "c2"], ["c2", "c1"])).toEqual([]);
  });

  it("não repete um id dentro do lote recebido (FR-363)", () => {
    expect(cartoesAusentes([], ["c1", "c1", "c2"])).toEqual(["c1", "c2"]);
  });
});

describe("indisponiveis e retirarIndisponiveis", () => {
  it("aponta os que saíram do acervo, na ordem da seleção (FR-367, FR-374)", () => {
    const selecao = adicionarCartoes(adicionarCartoes([], A), B);
    const noAcervo = new Set(["c3", "c1"]);

    expect(indisponiveis(selecao, noAcervo)).toEqual(["c2"]);
  });

  it("preserva a ordem da seleção ao listar vários indisponíveis (FR-367, FR-374)", () => {
    const selecao: SelecaoTemporaria = ["c3", "c1", "c4", "c2"];
    const noAcervo = new Set(["c2", "c4"]);

    expect(indisponiveis(selecao, noAcervo)).toEqual(["c3", "c1"]);
  });

  it("retira os indisponíveis preservando a ordem dos que ficam (FR-367, FR-374)", () => {
    const selecao: SelecaoTemporaria = ["c3", "c1", "c4", "c2"];
    const noAcervo = new Set(["c2", "c4"]);

    expect(retirarIndisponiveis(selecao, noAcervo)).toEqual(["c4", "c2"]);
  });

  it("devolve a seleção inteira quando todos estão disponíveis (FR-367)", () => {
    const selecao = adicionarCartoes(adicionarCartoes([], A), B);
    const noAcervo = new Set(["c1", "c2", "c3"]);

    expect(indisponiveis(selecao, noAcervo)).toEqual([]);
    expect(retirarIndisponiveis(selecao, noAcervo)).toEqual(selecao);
    expect(retirarIndisponiveis(selecao, noAcervo)).not.toBe(selecao);
  });

  it("não muta a seleção recebida — Object.freeze na entrada (FR-363, FR-374)", () => {
    const selecao: SelecaoTemporaria = Object.freeze(["c1", "c2", "c3"]);
    const noAcervo = new Set(["c1", "c3"]);

    const disponivel = retirarIndisponiveis(selecao, noAcervo);

    expect(selecao).toEqual(["c1", "c2", "c3"]);
    expect(indisponiveis(selecao, noAcervo)).toEqual(["c2"]);
    expect(disponivel).toEqual(["c1", "c3"]);
  });
});
