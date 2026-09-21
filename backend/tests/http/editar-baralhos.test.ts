import type { FastifyInstance } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarAcervo } from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarServidor } from "../../src/http/servidor.ts";
import { registrarRotasDeBaralhos } from "../../src/http/rotas.ts";

/**
 * T403 (backend) — contrato HTTP de `PUT /baralhos/{id}`
 * (specs/005-editar-cartao-e-baralho/contracts/api-edicao.md).
 *
 * O servidor é montado com o `Acervo` sobre o Adapter do armazenamento local
 * em memória e o Adapter HTTP registrado sobre a sua Interface; toda asserção
 * atravessa `inject`. A rota devolve 200 com o Baralho renomeado, 400 para nome
 * inválido — as mesmas recusas da criação — e 404 para Baralho inexistente,
 * sempre com mensagem em português.
 */

const NOME_VALIDO = "Inglês";
const NOME_EDITADO = "Inglês britânico";

const RECUSA_DE_CORPO_INVALIDO = {
  erro: "corpo_invalido",
  mensagem: "O corpo da requisição não é válido.",
};

let aberto: ArmazenamentoSqliteAberto;
let servidor: FastifyInstance;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  servidor = criarServidor();
  registrarRotasDeBaralhos(servidor, criarAcervo(aberto.armazenamento));
});

afterEach(async () => {
  await servidor.close();
  await aberto.encerrar();
});

/** Cria um Baralho pela rota de criação; falha se a criação for recusada. */
async function criarBaralho(): Promise<{ id: string }> {
  const resposta = await servidor.inject({
    method: "POST",
    url: "/baralhos",
    payload: { nome: NOME_VALIDO },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada inesperadamente: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string };
}

describe("PUT /baralhos/{id} — edição conforme o contrato", () => {
  it("responde 200 com o Baralho renomeado", async () => {
    const baralho = await criarBaralho();

    const resposta = await servidor.inject({
      method: "PUT",
      url: `/baralhos/${baralho.id}`,
      payload: { nome: NOME_EDITADO },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      id: baralho.id,
      nome: NOME_EDITADO,
    });

    const leitura = await servidor.inject({ method: "GET", url: "/baralhos" });
    expect(leitura.json()).toEqual([
      {
        id: baralho.id,
        nome: NOME_EDITADO,
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);
  });

  it("recusa nome vazio com 400 e a mesma mensagem da criação", async () => {
    const baralho = await criarBaralho();

    const resposta = await servidor.inject({
      method: "PUT",
      url: `/baralhos/${baralho.id}`,
      payload: { nome: "" },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });
  });

  it("recusa Baralho inexistente com 404 e mensagem em português", async () => {
    const resposta = await servidor.inject({
      method: "PUT",
      url: "/baralhos/baralho-inexistente",
      payload: { nome: NOME_EDITADO },
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });

  it("recusa corpo sem nome com 400 e não altera o Baralho", async () => {
    const baralho = await criarBaralho();

    const resposta = await servidor.inject({
      method: "PUT",
      url: `/baralhos/${baralho.id}`,
      payload: {},
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);

    const leitura = await servidor.inject({ method: "GET", url: "/baralhos" });
    expect(leitura.json()).toEqual([
      {
        id: baralho.id,
        nome: NOME_VALIDO,
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);
  });
});
