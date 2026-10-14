import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance, InjectOptions } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarArmazemEmDisco } from "../../src/midia/armazem-em-disco.ts";
import { registrarRotasDeBaralhos, registrarRotasDeExportacao } from "../../src/http/rotas.ts";
import { montarServidorDeContrato, pedirComCredencial, type ServidorDeContrato } from "./apoio-de-contrato.ts";

let contrato: ServidorDeContrato;
let servidor: FastifyInstance;
let pasta: string;

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), "http-exportacao-"));
  const imagens = criarArmazemEmDisco({ pasta });
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
    registrarRotasDeBaralhos(servidor, acervoDe);
    registrarRotasDeExportacao(servidor, acervoDe);
  }, {}, {}, { imagens });
  servidor = contrato.servidor;
});

afterEach(async () => {
  await contrato.encerrar();
  await rm(pasta, { recursive: true, force: true });
});

function pedir(requisicao: InjectOptions) {
  return pedirComCredencial(servidor, contrato.credencial, requisicao);
}

describe("POST /exportacoes", () => {
  it("exige autenticação e valida os corpos nos dois endpoints", async () => {
    const semCredencial = await servidor.inject({ method: "POST", url: "/exportacoes/previa", payload: { formato: "apkg", baralhos: "todos" } });
    expect(semCredencial.statusCode).toBe(401);

    for (const [url, payload] of [
      ["/exportacoes/previa", { formato: "apkg", baralhos: [] }],
      ["/exportacoes", { formato: "apkg", baralhos: "todos", fuso: "not-a-zone", idioma: "pt" }],
      ["/exportacoes", { formato: "apkg", baralhos: "todos", fuso: "UTC", idioma: "fr" }],
    ] as const) {
      const resposta = await pedir({ method: "POST", url, payload });
      expect(resposta.statusCode).toBe(400);
    }
  });

  it("retorna recusa estável para um acervo sem cartões", async () => {
    const baralho = await pedir({ method: "POST", url: "/baralhos", payload: { nome: "Vazio" } });
    expect(baralho.statusCode).toBe(201);
    const resultado = await pedir({
      method: "POST", url: "/exportacoes/previa",
      payload: { formato: "apkg", baralhos: [(baralho.json() as { id: string }).id] },
    });
    expect(resultado.statusCode).toBe(422);
    expect(resultado.json()).toMatchObject({ erro: "exportacao_vazia", mensagem: "Nothing to export." });
  });
});
