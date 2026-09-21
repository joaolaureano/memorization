import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bateriaDaPorta } from "../bateria-da-porta.ts";
import { bateriaDaPortaDeUsuarios } from "../bateria-da-porta-de-usuarios.ts";
import {
  abrirArmazenamentoDaBase,
  criarArmazenamentoDeTeste,
  criarArmazenamentoDeUsuariosDeTeste,
  criarBaseMigrada,
  descartarBasesDeTeste,
} from "./base-de-teste.ts";
import { servidorDeTeste } from "./servidor-de-teste.ts";

/**
 * T904 — a bateria compartilhada da Porta de `009` contra o Adapter de
 * PostgreSQL, exigindo cem por cento de aprovação (FR-110, FR-111, SC-044).
 *
 * A chamada é a **mesma** função que o Adapter do armazenamento local exercita,
 * sem uma linha de edição nela e sem edição em nenhum Module: é a medida de que
 * a Seam da Porta é real e de que PostgreSQL e o armazenamento local não
 * duplicam regra. Cada cenário recebe uma base nova e vazia, migrada pelo mesmo
 * caminho do comando da nuvem — e nenhum cenário conhece porta, senha, base ou
 * TLS, porque isso é do apoio de teste.
 *
 * A persistência entre duas aberturas do mesmo armazenamento — FR-112 — é
 * exercitada aqui sobre a mesma base: o Adapter não migra ao abrir, e o que uma
 * abertura gravou continua lá para a seguinte.
 */

/** Subir o PostgreSQL real leva segundos: o prazo do gancho é folgado. */
beforeAll(async () => {
  await servidorDeTeste();
}, 120_000);

afterAll(async () => {
  await descartarBasesDeTeste();
  await (await servidorDeTeste()).encerrar();
});

bateriaDaPorta(criarArmazenamentoDeTeste, "PostgreSQL na nuvem");

/**
 * A bateria da segunda Porta contra o **mesmo** Adapter: os Usuários são da
 * tabela `usuario` da migração 4, e as duas baterias compartilhadas provam que
 * SQLite e PostgreSQL não duplicam regra (FR-111, SC-044).
 */
bateriaDaPortaDeUsuarios(
  criarArmazenamentoDeUsuariosDeTeste,
  "PostgreSQL na nuvem",
);

describe("persistência entre duas aberturas do mesmo armazenamento", () => {
  it("devolve o mesmo conteúdo depois de encerrar o conjunto e abrir de novo", async () => {
    const nomeDaBase = await criarBaseMigrada("persistencia");

    const primeira = await abrirArmazenamentoDaBase(nomeDaBase);

    await primeira.armazenamento.inserirCartao({
      id: "c1",
      frente: "To walk",
      verso: "Caminhar",
    });
    await primeira.armazenamento.inserirBaralho({ id: "b1", nome: "Inglês" });
    await primeira.armazenamento.vincular("c1", "b1");

    /** Encerrar em dobro não falha: o conjunto já fechado não se fecha de novo. */
    await primeira.encerrar();
    await primeira.encerrar();

    const segunda = await abrirArmazenamentoDaBase(nomeDaBase);

    try {
      expect(await segunda.armazenamento.listarCartoes()).toEqual([
        { id: "c1", frente: "To walk", verso: "Caminhar" },
      ]);
      expect(await segunda.armazenamento.listarBaralhos()).toEqual([
        { id: "b1", nome: "Inglês" },
      ]);
      expect(await segunda.armazenamento.listarBaralhosDoCartao("c1")).toEqual([
        { id: "b1", nome: "Inglês" },
      ]);
      expect(
        await segunda.armazenamento.contarCartoesPorBaralho(),
      ).toContainEqual({ baralhoId: "b1", quantidadeDeCartoes: 1 });
    } finally {
      await segunda.encerrar();
    }
  });
});
