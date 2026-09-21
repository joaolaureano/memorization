import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarAcervo } from "../../src/acervo/acervo.ts";
import { abrirBanco } from "../../src/acervo/esquema.ts";
import { criarServidor } from "../../src/http/servidor.ts";
import { registrarRotasDeCartoes } from "../../src/http/rotas.ts";

/**
 * T007 — contrato HTTP de `GET /cartoes`
 * (specs/001-criar-cartao/contracts/api-cartoes.md).
 *
 * Toda asserção atravessa `inject` sobre o Adapter HTTP registrado com o
 * `Acervo` em memória. A Frente não é identificador: dois Cartões com a
 * mesma Frente são ambos devolvidos (FR-003; invariante 2 de `spec.md`), e a
 * ordem não é pré-condição do contrato, então as asserções comparam
 * conjuntos de Cartões, nunca posições.
 */

const FRENTE_REPETIDA = "To walk";
const VERSO_UM = "Caminhar";
const VERSO_OUTRO = "Andar";

let banco: DatabaseSync;
let servidor: FastifyInstance;

beforeEach(() => {
  banco = abrirBanco(":memory:");
  servidor = criarServidor();
  registrarRotasDeCartoes(servidor, criarAcervo(banco));
});

afterEach(async () => {
  await servidor.close();
  banco.close();
});

/** Cria um Cartão pela rota de criação; falha se a criação for recusada. */
async function criar(
  frente: string,
  verso: string,
): Promise<{ id: string; frente: string; verso: string }> {
  const resposta = await servidor.inject({
    method: "POST",
    url: "/cartoes",
    payload: { frente, verso },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada inesperadamente: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string; frente: string; verso: string };
}

describe("GET /cartoes — leitura conforme o contrato", () => {
  it("responde 200 com lista vazia quando nenhum Cartão existe", async () => {
    const resposta = await servidor.inject({ method: "GET", url: "/cartoes" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual([]);
  });

  it("responde 200 com os dois Cartões de Frente idêntica, ambos presentes", async () => {
    const primeiro = await criar(FRENTE_REPETIDA, VERSO_UM);
    const segundo = await criar(FRENTE_REPETIDA, VERSO_OUTRO);

    const resposta = await servidor.inject({ method: "GET", url: "/cartoes" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual(
      expect.arrayContaining([primeiro, segundo]),
    );
  });

  it("devolve cada Cartão com exatamente id, Frente e Verso (FR-004)", async () => {
    await criar(FRENTE_REPETIDA, VERSO_UM);
    await criar(FRENTE_REPETIDA, VERSO_OUTRO);

    const resposta = await servidor.inject({ method: "GET", url: "/cartoes" });
    const listados = resposta.json() as {
      id: string;
      frente: string;
      verso: string;
    }[];

    expect(listados).toHaveLength(2);
    for (const cartao of listados) {
      expect(Object.keys(cartao).sort()).toEqual(["frente", "id", "verso"]);
      expect(cartao.id).toEqual(expect.any(String));
      expect(cartao.frente).toBe(FRENTE_REPETIDA);
    }
  });
});
