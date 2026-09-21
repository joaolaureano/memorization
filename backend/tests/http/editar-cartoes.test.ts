import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarAcervo } from "../../src/acervo/acervo.ts";
import { abrirBanco } from "../../src/acervo/esquema.ts";
import { criarServidor } from "../../src/http/servidor.ts";
import { registrarRotasDeCartoes } from "../../src/http/rotas.ts";

/**
 * T403 (backend) — contrato HTTP de `PUT /cartoes/{id}`
 * (specs/005-editar-cartao-e-baralho/contracts/api-edicao.md).
 *
 * O servidor é montado com o `Acervo` sobre SQLite em memória e o Adapter
 * HTTP registrado sobre a sua Interface; toda asserção atravessa `inject`. A
 * rota devolve 200 com o Cartão atualizado, 400 para conteúdo inválido — as
 * mesmas recusas da criação — e 404 para Cartão inexistente, sempre com
 * mensagem em português.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const FRENTE_EDITADA = "To stroll";
const VERSO_EDITADO = "Passear";

const RECUSA_DE_CORPO_INVALIDO = {
  erro: "corpo_invalido",
  mensagem: "O corpo da requisição não é válido.",
};

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
async function criarCartao(): Promise<{ id: string }> {
  const resposta = await servidor.inject({
    method: "POST",
    url: "/cartoes",
    payload: { frente: FRENTE_VALIDA, verso: VERSO_VALIDO },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada inesperadamente: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string };
}

describe("PUT /cartoes/{id} — edição conforme o contrato", () => {
  it("responde 200 com o Cartão atualizado", async () => {
    const cartao = await criarCartao();

    const resposta = await servidor.inject({
      method: "PUT",
      url: `/cartoes/${cartao.id}`,
      payload: { frente: FRENTE_EDITADA, verso: VERSO_EDITADO },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      id: cartao.id,
      frente: FRENTE_EDITADA,
      verso: VERSO_EDITADO,
    });

    const leitura = await servidor.inject({ method: "GET", url: "/cartoes" });
    expect(leitura.json()).toEqual([
      {
        id: cartao.id,
        frente: FRENTE_EDITADA,
        verso: VERSO_EDITADO,
        baralhos: [],
      },
    ]);
  });

  it("recusa Frente vazia com 400 e a mesma mensagem da criação", async () => {
    const cartao = await criarCartao();

    const resposta = await servidor.inject({
      method: "PUT",
      url: `/cartoes/${cartao.id}`,
      payload: { frente: "", verso: VERSO_EDITADO },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });
  });

  it("recusa Cartão inexistente com 404 e mensagem em português", async () => {
    const resposta = await servidor.inject({
      method: "PUT",
      url: "/cartoes/cartao-inexistente",
      payload: { frente: FRENTE_EDITADA, verso: VERSO_EDITADO },
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });
  });

  it("recusa corpo sem Verso com 400 e não altera o Cartão", async () => {
    const cartao = await criarCartao();

    const resposta = await servidor.inject({
      method: "PUT",
      url: `/cartoes/${cartao.id}`,
      payload: { frente: FRENTE_EDITADA },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);

    const leitura = await servidor.inject({ method: "GET", url: "/cartoes" });
    expect(leitura.json()).toEqual([
      {
        id: cartao.id,
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
        baralhos: [],
      },
    ]);
  });
});
