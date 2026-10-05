import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarAcervo, type Acervo } from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import type { AlgoritmoDeRepeticao } from "../../src/repeticao/algoritmo.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/** Um segundo algoritmo, só para distinguir as Preferências de dois Usuários. */
const ALGORITMO_FALSO: AlgoritmoDeRepeticao = {
  id: "falso",
  versao: 1,
  rotulo: "Falso",
  opcoesDeAvaliacao: [
    { chave: "errei", rotulo: "Errei", resultado: "errou" },
    { chave: "dificil", rotulo: "Difícil", resultado: "acertou" },
    { chave: "bom", rotulo: "Bom", resultado: "acertou" },
    { chave: "facil", rotulo: "Fácil", resultado: "acertou" },
  ],
  avaliar(_estado, avaliacao, agora) {
    return {
      estado: { algoritmo: "falso", versao: 1, dados: { avaliacao } },
      proximaRevisaoEm: agora,
    };
  },
};

/**
 * T1510 — Preferências de repetição do `Acervo`: o padrão, a validação do
 * algoritmo e a troca de algoritmo que dispara a reconstrução (FR-212, FR-213,
 * D5).
 */

let aberto: ArmazenamentoSqliteAberto;
let acervo: Acervo;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  acervo = criarAcervo(
    aberto.armazenamento,
    await criarDonoDeTeste(aberto.usuarios),
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  await aberto.encerrar();
});

describe("obterPreferencias — os padrões", () => {
  it("devolve sm2 quando não há linha gravada, sem gravar nada (FR-212, D5)", async () => {
    expect(await acervo.obterPreferencias()).toEqual({
      ok: true,
      preferencias: {
        algoritmo: "sm2",
        algoritmos: [
          {
            id: "sm2",
            rotulo: "SM-2",
            opcoesDeAvaliacao: [
              { chave: "errei", rotulo: "Errei", resultado: "errou" },
              { chave: "dificil", rotulo: "Difícil", resultado: "acertou" },
              { chave: "bom", rotulo: "Bom", resultado: "acertou" },
              { chave: "facil", rotulo: "Fácil", resultado: "acertou" },
            ],
          },
        ],
      },
    });
  });
});

describe("salvarPreferencias — validação", () => {
  it("aceita o algoritmo disponível e devolve o mesmo formato do GET (FR-212)", async () => {
    expect(await acervo.salvarPreferencias({ algoritmo: "sm2" })).toEqual({
      ok: true,
      preferencias: {
        algoritmo: "sm2",
        algoritmos: [
          {
            id: "sm2",
            rotulo: "SM-2",
            opcoesDeAvaliacao: [
              { chave: "errei", rotulo: "Errei", resultado: "errou" },
              { chave: "dificil", rotulo: "Difícil", resultado: "acertou" },
              { chave: "bom", rotulo: "Bom", resultado: "acertou" },
              { chave: "facil", rotulo: "Fácil", resultado: "acertou" },
            ],
          },
        ],
      },
    });
  });

  it("ignora o antigo limite de Cartões novos por dia, se vier no corpo", async () => {
    expect(
      await acervo.salvarPreferencias({
        algoritmo: "sm2",
        limiteDeNovosPorDia: 5000,
      }),
    ).toEqual({
      ok: true,
      preferencias: {
        algoritmo: "sm2",
        algoritmos: [
          {
            id: "sm2",
            rotulo: "SM-2",
            opcoesDeAvaliacao: [
              { chave: "errei", rotulo: "Errei", resultado: "errou" },
              { chave: "dificil", rotulo: "Difícil", resultado: "acertou" },
              { chave: "bom", rotulo: "Bom", resultado: "acertou" },
              { chave: "facil", rotulo: "Fácil", resultado: "acertou" },
            ],
          },
        ],
      },
    });
  });

  it("recusa algoritmo desconhecido e corpo sem forma como dados_invalidos (FR-191, FR-212)", async () => {
    for (const dados of [
      { algoritmo: "inexistente" },
      { algoritmo: 42 },
      {},
      null,
      undefined,
      42,
      "preferencias",
      [],
    ]) {
      expect(await acervo.salvarPreferencias(dados)).toEqual({
        ok: false,
        erro: "dados_invalidos",
      });
    }
  });
});

describe("salvarPreferencias — reconstrução", () => {
  it("não toca nos Agendamentos quando o algoritmo não muda (FR-212, FR-213)", async () => {
    const espiao = vi.spyOn(aberto.armazenamento, "substituirAgendamentos");

    const resultado = await acervo.salvarPreferencias({ algoritmo: "sm2" });

    expect(resultado.ok).toBe(true);
    expect(espiao).not.toHaveBeenCalled();
  });
});

describe("Preferências entre Usuários", () => {
  it("isola as Preferências de cada Usuário (FR-219)", async () => {
    const algoritmos = new Map([["falso", ALGORITMO_FALSO]]);
    const dono = await criarDonoDeTeste(
      aberto.usuarios,
      "dono-dois",
      "bruno.souza",
    );
    const comFalso = criarAcervo(aberto.armazenamento, dono, { algoritmos });

    await comFalso.salvarPreferencias({ algoritmo: "falso" });

    expect(await comFalso.obterPreferencias()).toMatchObject({
      ok: true,
      preferencias: { algoritmo: "falso" },
    });

    expect(await acervo.obterPreferencias()).toMatchObject({
      ok: true,
      preferencias: { algoritmo: "sm2" },
    });
  });
});
