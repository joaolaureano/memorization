import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { versaoCorrenteConhecida } from "../../../src/armazenamento/postgresql/esquema.ts";
import {
  abrirBaseDeTeste,
  criarArmazenamentoDeTeste,
  criarBaseMigrada,
  descartarBasesDeTeste,
} from "./base-de-teste.ts";
import { servidorDeTeste } from "./servidor-de-teste.ts";

/**
 * T902 — cada chamada da fábrica de teste cria uma **base nova e vazia**,
 * migrada pelo mesmo caminho do comando da nuvem, e devolve
 * `{ armazenamento, encerrar() }` na forma que a bateria de `009` espera
 * (FR-111, FR-116, SC-044, SC-048).
 *
 * O que se prova aqui: duas chamadas seguidas produzem bases distintas e
 * independentes — o que uma grava não aparece na outra —, a base entregue já
 * responde na versão corrente do esquema, `encerrar()` em dobro não falha e
 * descarta mesmo a base, e nenhum cenário precisa conhecer porta, senha, base ou
 * TLS.
 */

/** Diz se a base existe no servidor, consultando o catálogo. */
async function existeBase(nomeDaBase: string): Promise<boolean> {
  const linhas = await (await servidorDeTeste()).consultar<{ nome: string }>(
    "postgres",
    "SELECT datname AS nome FROM pg_database WHERE datname = $1;",
    [nomeDaBase],
  );

  return linhas.length > 0;
}

/** Subir o PostgreSQL real leva segundos: o prazo do gancho é folgado. */
beforeAll(async () => {
  await servidorDeTeste();
}, 120_000);

afterAll(async () => {
  await descartarBasesDeTeste();
  await (await servidorDeTeste()).encerrar();
});

describe("a base de cada cenário", () => {
  it("entrega bases distintas e independentes, sem o que a outra gravou", async () => {
    const primeira = await criarArmazenamentoDeTeste();
    const segunda = await criarArmazenamentoDeTeste();

    try {
      await primeira.armazenamento.inserirCartao({
        id: "c1",
        frente: "To walk",
        verso: "Caminhar",
      });

      expect(await primeira.armazenamento.listarCartoes()).toHaveLength(1);
      expect(await segunda.armazenamento.listarCartoes()).toEqual([]);
    } finally {
      await primeira.encerrar();
      await segunda.encerrar();
    }
  });

  it("entrega a base já na versão corrente do esquema", async () => {
    const nomeDaBase = await criarBaseMigrada("versao");

    const versao = await (await servidorDeTeste()).consultar<{ versao: number }>(
      nomeDaBase,
      "SELECT versao FROM versao_do_esquema;",
    );

    expect(versao).toEqual([{ versao: versaoCorrenteConhecida() }]);
  });

  it("encerrar fecha o conjunto, descarta a base e não falha no encerramento repetido", async () => {
    const base = await abrirBaseDeTeste("descarte");

    await base.armazenamento.inserirCartao({
      id: "c1",
      frente: "To walk",
      verso: "Caminhar",
    });

    expect(await existeBase(base.nomeDaBase)).toBe(true);

    await base.encerrar();
    await base.encerrar();

    expect(await existeBase(base.nomeDaBase)).toBe(false);
  });

  it("descarta a base mesmo quando o cenário não encerra o armazenamento", async () => {
    const base = await abrirBaseDeTeste("abandonada");

    await descartarBasesDeTeste();

    expect(await existeBase(base.nomeDaBase)).toBe(false);
  });
});
