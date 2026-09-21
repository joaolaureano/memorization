import { afterAll, describe, expect, it } from "vitest";

import { abrirArmazenamentoSqlite } from "../src/armazenamento/sqlite/armazenamento.ts";
import { criarServidor } from "../src/http/servidor.ts";
import { criarIdentidade } from "../src/identidade/identidade.ts";
import { segredoGerado } from "./armazenamento/usuarios-de-teste.ts";

/**
 * Desde a `008-entrar` não há como montar um servidor sem `Identidade`: é ele
 * quem verifica a Credencial em toda rota, exceto o Cadastro, a prova de vida e
 * o pré-voo (FR-090). A prova de vida continua alcançável sem Credencial.
 */
const aberto = await abrirArmazenamentoSqlite(":memory:");
const servidor = criarServidor(criarIdentidade(aberto.usuarios, segredoGerado()));

afterAll(async () => {
  await servidor.close();
  await aberto.encerrar();
});

describe("GET /health", () => {
  it("responde 200 com { status: 'ok' }", async () => {
    const resposta = await servidor.inject({ method: "GET", url: "/health" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ status: "ok" });
  });
});
