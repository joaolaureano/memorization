import type { FastifyInstance } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarAcervo } from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarServidor } from "../../src/http/servidor.ts";
import {
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
} from "../../src/http/rotas.ts";

/**
 * T503 (backend) — contrato HTTP de `DELETE /baralhos/{id}`
 * (specs/006-excluir-cartao-e-baralho/contracts/api-exclusao.md).
 *
 * O servidor é montado com o `Acervo` sobre o Adapter do armazenamento local
 * em memória e os dois Adapters HTTP registrados sobre a sua Interface; toda
 * asserção atravessa `inject`. A rota devolve 204 sem conteúdo e remove somente
 * o Baralho e seus Vínculos, preservando os Cartões; Baralho inexistente
 * devolve 404 com mensagem em português.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";

let aberto: ArmazenamentoSqliteAberto;
let servidor: FastifyInstance;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  servidor = criarServidor();

  const acervo = criarAcervo(aberto.armazenamento);

  registrarRotasDeCartoes(servidor, acervo);
  registrarRotasDeBaralhos(servidor, acervo);
});

afterEach(async () => {
  await servidor.close();
  await aberto.encerrar();
});

/** Cria um Cartão pela rota de criação; falha se a criação for recusada. */
async function criarCartao(): Promise<{ id: string; frente: string; verso: string }> {
  const resposta = await servidor.inject({
    method: "POST",
    url: "/cartoes",
    payload: { frente: FRENTE_VALIDA, verso: VERSO_VALIDO },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada inesperadamente: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string; frente: string; verso: string };
}

/** Cria um Baralho pela rota de criação; falha se a criação for recusada. */
async function criarBaralho(): Promise<{ id: string; nome: string }> {
  const resposta = await servidor.inject({
    method: "POST",
    url: "/baralhos",
    payload: { nome: "Inglês" },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada inesperadamente: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string; nome: string };
}

describe("DELETE /baralhos/{id} — exclusão conforme o contrato", () => {
  it("responde 204, remove o Baralho e preserva o Cartão acessível", async () => {
    const cartao = await criarCartao();
    const baralho = await criarBaralho();

    await servidor.inject({
      method: "POST",
      url: `/baralhos/${baralho.id}/vinculos`,
      payload: { cartaoId: cartao.id },
    });

    const resposta = await servidor.inject({
      method: "DELETE",
      url: `/baralhos/${baralho.id}`,
    });

    expect(resposta.statusCode).toBe(204);

    const baralhos = await servidor.inject({
      method: "GET",
      url: "/baralhos",
    });

    expect(baralhos.json()).toEqual([]);

    const cartoes = await servidor.inject({ method: "GET", url: "/cartoes" });
    expect(cartoes.json()).toEqual([{ ...cartao, baralhos: [] }]);
  });

  it("recusa Baralho inexistente com 404 e mensagem em português", async () => {
    const resposta = await servidor.inject({
      method: "DELETE",
      url: "/baralhos/baralho-inexistente",
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });
});
