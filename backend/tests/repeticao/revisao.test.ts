/**
 * Testes do Module puro `revisao.ts` (contrato §1.3): contagens de Início
 * (SC-080, SC-081), ordem e teto do lote (FR-201, FR-203), encadeamento das
 * Avaliações (FR-205) e reconstrução por replay (FR-213, SC-083), inclusive a
 * plugabilidade de algoritmos (FR-191).
 */
import { describe, expect, it } from "vitest";

import { ALGORITMOS } from "../../src/repeticao/algoritmo.ts";
import type {
  AlgoritmoDeRepeticao,
  Avaliacao,
} from "../../src/repeticao/algoritmo.ts";
import { sm2 } from "../../src/repeticao/sm2.ts";
import {
  aplicarAvaliacoes,
  loteDeRevisao,
  reconstruir,
  resumoDaRevisao,
  TAMANHO_DO_LOTE,
} from "../../src/repeticao/revisao.ts";
import type {
  Agendamento,
  Cartao,
  ItemAvaliado,
  Preferencias,
} from "../../src/armazenamento/porta.ts";

const MILISSEGUNDOS_POR_DIA = 86_400_000;

const INICIO_DO_DIA = new Date("2026-01-10T00:00:00.000Z");
const FIM_DO_DIA = new Date("2026-01-11T00:00:00.000Z");
const AGORA = new Date("2026-01-10T12:00:00.000Z");

const PADRAO: Preferencias = { algoritmo: "sm2", limiteDeNovosPorDia: 20 };

function cartao(id: string): Cartao {
  return { id, frente: `Frente ${id}`, verso: `Verso ${id}` };
}

function agendamento(
  cartaoId: string,
  campos: Partial<Agendamento> = {},
): Agendamento {
  return {
    cartaoId,
    algoritmo: campos.algoritmo ?? "sm2",
    versaoDoAlgoritmo: campos.versaoDoAlgoritmo ?? 1,
    estado:
      campos.estado ?? { repeticoes: 1, facilidade: 2.5, intervaloEmDias: 1 },
    proximaRevisaoEm: campos.proximaRevisaoEm ?? "2026-01-09T00:00:00.000Z",
    ultimaAvaliacao: campos.ultimaAvaliacao ?? "bom",
    revisadoEm: campos.revisadoEm ?? "2026-01-08T00:00:00.000Z",
    criadoEm: campos.criadoEm ?? "2025-12-01T00:00:00.000Z",
  };
}

/** Estado interno do SM-2, só para as asserções do teste. */
function dadosDoSm2(agendamento: Agendamento): {
  repeticoes: number;
  facilidade: number;
  intervaloEmDias: number;
} {
  return agendamento.estado as {
    repeticoes: number;
    facilidade: number;
    intervaloEmDias: number;
  };
}

function soUm(agendamentos: readonly Agendamento[]): Agendamento {
  const primeiro = agendamentos[0];
  if (primeiro === undefined) throw new Error("esperava um Agendamento");
  return primeiro;
}

describe("resumoDaRevisao (FR-198, FR-199, SC-080, SC-081)", () => {
  it("conta vencidos antes do fim do dia e novos dentro do limite (SC-080)", () => {
    const cartoes = [cartao("a"), cartao("b"), cartao("c")];
    const agendamentos = [
      agendamento("a", { proximaRevisaoEm: "2026-01-10T23:59:59.000Z" }),
    ];
    expect(
      resumoDaRevisao(cartoes, agendamentos, PADRAO, INICIO_DO_DIA, FIM_DO_DIA),
    ).toEqual({ vencidos: 1, novosHoje: 2 });
  });

  it("não conta como vencido o Agendamento com revisão exatamente no fim do dia", () => {
    const cartoes = [cartao("a")];
    const agendamentos = [
      agendamento("a", { proximaRevisaoEm: FIM_DO_DIA.toISOString() }),
    ];
    expect(
      resumoDaRevisao(cartoes, agendamentos, PADRAO, INICIO_DO_DIA, FIM_DO_DIA),
    ).toEqual({ vencidos: 0, novosHoje: 0 });
  });

  it("ignora Agendamentos de Cartões fora do acervo informado", () => {
    const cartoes = [cartao("a")];
    const agendamentos = [agendamento("z")];
    expect(
      resumoDaRevisao(cartoes, agendamentos, PADRAO, INICIO_DO_DIA, FIM_DO_DIA),
    ).toEqual({ vencidos: 0, novosHoje: 1 });
  });

  it("não introduz novos quando o limite diário é 0 (SC-081)", () => {
    const cartoes = [cartao("a"), cartao("b"), cartao("c")];
    const preferencias: Preferencias = {
      algoritmo: "sm2",
      limiteDeNovosPorDia: 0,
    };
    expect(
      resumoDaRevisao(cartoes, [], preferencias, INICIO_DO_DIA, FIM_DO_DIA),
    ).toEqual({ vencidos: 0, novosHoje: 0 });
  });

  it("introduz no máximo 1 novo quando o limite diário é 1 (SC-081)", () => {
    const cartoes = [cartao("a"), cartao("b"), cartao("c")];
    const preferencias: Preferencias = {
      algoritmo: "sm2",
      limiteDeNovosPorDia: 1,
    };
    expect(
      resumoDaRevisao(cartoes, [], preferencias, INICIO_DO_DIA, FIM_DO_DIA),
    ).toEqual({ vencidos: 0, novosHoje: 1 });
  });

  it("introduz no máximo 20 novos quando o limite diário é 20 (SC-081)", () => {
    const cartoes = Array.from({ length: 25 }, (_, i) => cartao(`c${i}`));
    expect(
      resumoDaRevisao(cartoes, [], PADRAO, INICIO_DO_DIA, FIM_DO_DIA),
    ).toEqual({ vencidos: 0, novosHoje: 20 });
  });

  it("desconta do limite os Cartões já introduzidos hoje (SC-081)", () => {
    const cartoes = Array.from({ length: 8 }, (_, i) => cartao(`c${i}`));
    const agendamentos = [
      agendamento("c0", { criadoEm: "2026-01-10T08:00:00.000Z" }),
      agendamento("c1", { criadoEm: "2026-01-10T09:00:00.000Z" }),
    ];
    const preferencias: Preferencias = {
      algoritmo: "sm2",
      limiteDeNovosPorDia: 3,
    };
    expect(
      resumoDaRevisao(
        cartoes,
        agendamentos,
        preferencias,
        INICIO_DO_DIA,
        FIM_DO_DIA,
      ),
    ).toEqual({ vencidos: 2, novosHoje: 1 });
  });

  it("não introduz novos quando o já introduzido hoje alcança o limite (SC-081)", () => {
    const cartoes = [cartao("c0"), cartao("c1"), cartao("c2")];
    const agendamentos = [
      agendamento("c0", { criadoEm: "2026-01-10T08:00:00.000Z" }),
      agendamento("c1", { criadoEm: "2026-01-10T09:00:00.000Z" }),
    ];
    const preferencias: Preferencias = {
      algoritmo: "sm2",
      limiteDeNovosPorDia: 1,
    };
    expect(
      resumoDaRevisao(
        cartoes,
        agendamentos,
        preferencias,
        INICIO_DO_DIA,
        FIM_DO_DIA,
      ).novosHoje,
    ).toBe(0);
  });
});

describe("loteDeRevisao (FR-201, FR-203)", () => {
  it("ordena os vencidos por próxima revisão e depois os novos (FR-201)", () => {
    const cartoes = [
      cartao("novo"),
      cartao("vencido_longe"),
      cartao("vencido_perto"),
    ];
    const agendamentos = [
      agendamento("vencido_longe", {
        proximaRevisaoEm: "2026-01-10T18:00:00.000Z",
      }),
      agendamento("vencido_perto", {
        proximaRevisaoEm: "2026-01-09T00:00:00.000Z",
      }),
    ];
    const lote = loteDeRevisao(
      cartoes,
      agendamentos,
      PADRAO,
      INICIO_DO_DIA,
      FIM_DO_DIA,
    );
    expect(lote.map((c) => c.id)).toEqual([
      "vencido_perto",
      "vencido_longe",
      "novo",
    ]);
  });

  it("desempata os vencidos pela ordem de criação do array de Cartões (FR-201)", () => {
    const cartoes = [cartao("primeiro"), cartao("segundo")];
    const mesmaData = "2026-01-09T00:00:00.000Z";
    const agendamentos = [
      agendamento("segundo", { proximaRevisaoEm: mesmaData }),
      agendamento("primeiro", { proximaRevisaoEm: mesmaData }),
    ];
    const lote = loteDeRevisao(
      cartoes,
      agendamentos,
      PADRAO,
      INICIO_DO_DIA,
      FIM_DO_DIA,
    );
    expect(lote.map((c) => c.id)).toEqual(["primeiro", "segundo"]);
  });

  it("não repete Cartão no lote (FR-203)", () => {
    const cartoes = [
      cartao("v1"),
      cartao("v2"),
      cartao("n1"),
      cartao("n2"),
    ];
    const agendamentos = [agendamento("v1"), agendamento("v2")];
    const lote = loteDeRevisao(
      cartoes,
      agendamentos,
      PADRAO,
      INICIO_DO_DIA,
      FIM_DO_DIA,
    );
    const ids = lote.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["v1", "v2", "n1", "n2"]);
  });

  it("limita o lote a 20 Cartões vencidos (FR-203)", () => {
    const cartoes = Array.from({ length: 25 }, (_, i) => cartao(`c${i}`));
    const base = Date.parse("2026-01-09T00:00:00.000Z");
    const agendamentos = cartoes.map((c, i) =>
      agendamento(c.id, {
        proximaRevisaoEm: new Date(base + i * 60_000).toISOString(),
      }),
    );
    const lote = loteDeRevisao(
      cartoes,
      agendamentos,
      PADRAO,
      INICIO_DO_DIA,
      FIM_DO_DIA,
    );
    expect(lote).toHaveLength(TAMANHO_DO_LOTE);
    expect(lote.map((c) => c.id)).toEqual(cartoes.slice(0, 20).map((c) => c.id));
  });

  it("preenche com novos até o teto do lote (FR-203)", () => {
    const cartoes = [
      cartao("v"),
      ...Array.from({ length: 25 }, (_, i) => cartao(`n${i}`)),
    ];
    const agendamentos = [agendamento("v")];
    const lote = loteDeRevisao(
      cartoes,
      agendamentos,
      PADRAO,
      INICIO_DO_DIA,
      FIM_DO_DIA,
    );
    expect(lote).toHaveLength(TAMANHO_DO_LOTE);
    expect(lote[0]?.id).toBe("v");
    expect(lote.slice(1).map((c) => c.id)).toEqual(
      cartoes.slice(1, 20).map((c) => c.id),
    );
  });

  it("não inclui novos quando já há 20 vencidos (FR-203)", () => {
    const vencidos = Array.from({ length: 20 }, (_, i) => cartao(`v${i}`));
    const novos = Array.from({ length: 5 }, (_, i) => cartao(`n${i}`));
    const base = Date.parse("2026-01-09T00:00:00.000Z");
    const agendamentos = vencidos.map((c, i) =>
      agendamento(c.id, {
        proximaRevisaoEm: new Date(base + i * 60_000).toISOString(),
      }),
    );
    const lote = loteDeRevisao(
      [...vencidos, ...novos],
      agendamentos,
      PADRAO,
      INICIO_DO_DIA,
      FIM_DO_DIA,
    );
    expect(lote).toHaveLength(TAMANHO_DO_LOTE);
    expect(lote.every((c) => c.id.startsWith("v"))).toBe(true);
  });

  it("respeita o limite de novos do dia no lote (FR-200)", () => {
    const cartoes = [
      cartao("v"),
      ...Array.from({ length: 5 }, (_, i) => cartao(`n${i}`)),
    ];
    const agendamentos = [agendamento("v")];
    const preferencias: Preferencias = {
      algoritmo: "sm2",
      limiteDeNovosPorDia: 2,
    };
    const lote = loteDeRevisao(
      cartoes,
      agendamentos,
      preferencias,
      INICIO_DO_DIA,
      FIM_DO_DIA,
    );
    expect(lote.map((c) => c.id)).toEqual(["v", "n0", "n1"]);
  });
});

describe("aplicarAvaliacoes (FR-205, FR-210)", () => {
  it("encadeia as Avaliações do mesmo Cartão na ordem dos Itens (FR-205)", () => {
    const itens: { cartaoId: string; avaliacao: Avaliacao }[] = [
      { cartaoId: "a", avaliacao: "bom" },
      { cartaoId: "a", avaliacao: "bom" },
    ];
    const resultado = aplicarAvaliacoes([], itens, sm2, AGORA);
    const alterado = soUm(resultado);
    expect(alterado.cartaoId).toBe("a");
    expect(dadosDoSm2(alterado).repeticoes).toBe(2);
    expect(dadosDoSm2(alterado).intervaloEmDias).toBe(6);
    expect(alterado.proximaRevisaoEm).toBe(
      new Date(AGORA.getTime() + 6 * MILISSEGUNDOS_POR_DIA).toISOString(),
    );
  });

  it("cria o Agendamento novo com criadoEm e revisadoEm iguais a agora (FR-199)", () => {
    const resultado = aplicarAvaliacoes(
      [],
      [{ cartaoId: "a", avaliacao: "bom" }],
      sm2,
      AGORA,
    );
    const criado = soUm(resultado);
    expect(criado.criadoEm).toBe(AGORA.toISOString());
    expect(criado.revisadoEm).toBe(AGORA.toISOString());
    expect(criado.ultimaAvaliacao).toBe("bom");
  });

  it("preserva criadoEm do Agendamento existente e atualiza revisadoEm (FR-205)", () => {
    const existente = agendamento("a", {
      criadoEm: "2025-12-01T00:00:00.000Z",
    });
    const resultado = aplicarAvaliacoes(
      [existente],
      [{ cartaoId: "a", avaliacao: "facil" }],
      sm2,
      AGORA,
    );
    const alterado = soUm(resultado);
    expect(alterado.criadoEm).toBe("2025-12-01T00:00:00.000Z");
    expect(alterado.revisadoEm).toBe(AGORA.toISOString());
    expect(alterado.ultimaAvaliacao).toBe("facil");
  });

  it("devolve só os Agendamentos alterados ou criados", () => {
    const existentes = [agendamento("a"), agendamento("b")];
    const resultado = aplicarAvaliacoes(
      existentes,
      [{ cartaoId: "a", avaliacao: "bom" }],
      sm2,
      AGORA,
    );
    expect(resultado.map((a) => a.cartaoId)).toEqual(["a"]);
  });

  it("não altera nada quando não há Itens", () => {
    const existentes = [agendamento("a")];
    expect(aplicarAvaliacoes(existentes, [], sm2, AGORA)).toEqual([]);
  });
});

/**
 * Algoritmo falso só do teste: intervalo fixo de 2 dias, id "fixo". Prova que
 * `reconstruir` aceita qualquer `AlgoritmoDeRepeticao`, sem depender do
 * registro `ALGORITMOS` (FR-191, SC-083) — de propósito, ele NÃO entra nele.
 */
const fixo: AlgoritmoDeRepeticao = {
  id: "fixo",
  versao: 1,
  rotulo: "Fixo",
  avaliar(_estado, _avaliacao, agora) {
    return {
      estado: { algoritmo: "fixo", versao: 1, dados: { intervalos: 2 } },
      proximaRevisaoEm: new Date(agora.getTime() + 2 * MILISSEGUNDOS_POR_DIA),
    };
  },
};

describe("reconstruir (FR-213, SC-083)", () => {
  const itens: ItemAvaliado[] = [
    {
      cartaoId: "a",
      avaliacao: "bom",
      concluidaEm: "2026-01-01T10:00:00.000Z",
      posicao: 0,
    },
    {
      cartaoId: "b",
      avaliacao: "facil",
      concluidaEm: "2026-01-01T10:00:10.000Z",
      posicao: 1,
    },
    {
      cartaoId: "a",
      avaliacao: "bom",
      concluidaEm: "2026-01-02T10:00:00.000Z",
      posicao: 0,
    },
  ];

  it("é determinístico: a mesma entrada produz a mesma saída (SC-083)", () => {
    expect(reconstruir(itens, ["a", "b"], sm2)).toEqual(
      reconstruir(itens, ["a", "b"], sm2),
    );
  });

  it("ignora Itens de Cartões excluídos (FR-213)", () => {
    const resultado = reconstruir(itens, ["a"], sm2);
    expect(resultado.map((a) => a.cartaoId)).toEqual(["a"]);
  });

  it("usa a concluidaEm do primeiro Item do Cartão como criadoEm (FR-213)", () => {
    const a = reconstruir(itens, ["a", "b"], sm2).find(
      (agendamento) => agendamento.cartaoId === "a",
    );
    expect(a?.criadoEm).toBe("2026-01-01T10:00:00.000Z");
    expect(a?.revisadoEm).toBe("2026-01-02T10:00:00.000Z");
    expect(dadosDoSm2(a as Agendamento).repeticoes).toBe(2);
  });

  it("reconstrói com sm2, com um algoritmo não registrado e de novo com sm2, sem diferença (FR-191, SC-083)", () => {
    const primeiro = reconstruir(itens, ["a", "b"], sm2);
    const intermediario = reconstruir(itens, ["a", "b"], fixo);
    const terceiro = reconstruir(itens, ["a", "b"], sm2);
    expect(ALGORITMOS.has("fixo")).toBe(false);
    expect(intermediario).not.toEqual(primeiro);
    expect(terceiro).toEqual(primeiro);
  });
});
