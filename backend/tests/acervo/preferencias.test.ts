import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarAcervo, type Acervo } from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T1510 — Preferências de repetição do `Acervo`: os padrões, a validação do
 * limite e do algoritmo, e a troca de algoritmo que dispara a reconstrução
 * (FR-200, FR-212, FR-213, D5).
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
  it("devolve sm2 e 20 quando não há linha gravada, sem gravar nada (FR-212, D5)", async () => {
    expect(await acervo.obterPreferencias()).toEqual({
      ok: true,
      preferencias: {
        algoritmo: "sm2",
        limiteDeNovosPorDia: 20,
        algoritmos: [{ id: "sm2", rotulo: "SM-2" }],
      },
    });
  });
});

describe("salvarPreferencias — validação", () => {
  it("aceita o limite inteiro de 0 a 999 e devolve o mesmo formato do GET (FR-200, FR-212)", async () => {
    for (const limite of [0, 1, 20, 999]) {
      expect(
        await acervo.salvarPreferencias({
          algoritmo: "sm2",
          limiteDeNovosPorDia: limite,
        }),
      ).toEqual({
        ok: true,
        preferencias: {
          algoritmo: "sm2",
          limiteDeNovosPorDia: limite,
          algoritmos: [{ id: "sm2", rotulo: "SM-2" }],
        },
      });
    }
  });

  it("recusa limite fora do intervalo ou não inteiro como dados_invalidos (FR-200)", async () => {
    for (const limiteDeNovosPorDia of [
      -1,
      1000,
      1.5,
      "10",
      null,
      undefined,
      Number.NaN,
    ]) {
      expect(
        await acervo.salvarPreferencias({
          algoritmo: "sm2",
          limiteDeNovosPorDia,
        }),
      ).toEqual({ ok: false, erro: "dados_invalidos" });
    }
  });

  it("recusa algoritmo desconhecido e corpo sem forma como dados_invalidos (FR-191, FR-212)", async () => {
    for (const dados of [
      { algoritmo: "inexistente", limiteDeNovosPorDia: 20 },
      { limiteDeNovosPorDia: 20 },
      { algoritmo: "sm2" },
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

    const resultado = await acervo.salvarPreferencias({
      algoritmo: "sm2",
      limiteDeNovosPorDia: 5,
    });

    expect(resultado.ok).toBe(true);
    expect(espiao).not.toHaveBeenCalled();
  });
});

describe("Preferências entre Usuários", () => {
  it("isola as Preferências de cada Usuário (FR-219)", async () => {
    const outro = criarAcervo(
      aberto.armazenamento,
      await criarDonoDeTeste(aberto.usuarios, "dono-dois", "bruno.souza"),
    );

    await acervo.salvarPreferencias({
      algoritmo: "sm2",
      limiteDeNovosPorDia: 3,
    });

    expect(await acervo.obterPreferencias()).toMatchObject({
      ok: true,
      preferencias: { limiteDeNovosPorDia: 3 },
    });

    expect(await outro.obterPreferencias()).toMatchObject({
      ok: true,
      preferencias: { limiteDeNovosPorDia: 20 },
    });
  });
});
