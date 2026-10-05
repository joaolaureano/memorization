/**
 * Testes do Module puro `revisao.ts` (contrato §1.3): encadeamento das
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
import { aplicarAvaliacoes, reconstruir } from "../../src/repeticao/revisao.ts";
import type { Agendamento, ItemAvaliado } from "../../src/armazenamento/porta.ts";

const MILISSEGUNDOS_POR_DIA = 86_400_000;

const AGORA = new Date("2026-01-10T12:00:00.000Z");

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
  opcoesDeAvaliacao: [
    { chave: "errei", rotulo: "Errei", resultado: "errou" },
    { chave: "dificil", rotulo: "Difícil", resultado: "acertou" },
    { chave: "bom", rotulo: "Bom", resultado: "acertou" },
    { chave: "facil", rotulo: "Fácil", resultado: "acertou" },
  ],
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
