import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarAcervo } from "../../src/acervo/acervo.ts";
import { abrirBanco } from "../../src/acervo/esquema.ts";
import { criarServidor } from "../../src/http/servidor.ts";
import { registrarRotasDeBaralhos } from "../../src/http/rotas.ts";

/**
 * T105 — contrato HTTP de `POST /baralhos`
 * (specs/002-criar-baralho/contracts/api-baralhos.md).
 *
 * O servidor é montado com o `Acervo` sobre SQLite em memória e o Adapter
 * HTTP registrado sobre a sua Interface; toda asserção atravessa `inject`, a
 * mesma superfície que um cliente HTTP usa. Os dois códigos de erro do
 * contrato são cobertos com mensagem exata em português, nome repetido é
 * criação válida — jamais `409` — e a forma inválida é recusada na borda,
 * antes de alcançar o `Acervo`.
 */

const NOME_VALIDO = "Inglês";

const RECUSA_DE_CORPO_INVALIDO = {
  erro: "corpo_invalido",
  mensagem: "O corpo da requisição não é válido.",
};

let banco: DatabaseSync;
let servidor: FastifyInstance;

beforeEach(() => {
  banco = abrirBanco(":memory:");
  servidor = criarServidor();
  registrarRotasDeBaralhos(servidor, criarAcervo(banco));
});

afterEach(async () => {
  await servidor.close();
  banco.close();
});

/**
 * Envia `POST /baralhos`. `corpo` ausente reproduz requisição sem corpo;
 * `cabecalhos` permite forçar content-type na requisição.
 */
function postarBaralho(
  corpo?: object | string,
  cabecalhos: Record<string, string> = {},
) {
  return servidor.inject({
    method: "POST",
    url: "/baralhos",
    headers: cabecalhos,
    payload: corpo,
  });
}

describe("POST /baralhos — criação conforme o contrato", () => {
  it("responde 201 com o Baralho criado: id e nome (FR-010)", async () => {
    const resposta = await postarBaralho({ nome: NOME_VALIDO });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({
      id: expect.any(String),
      nome: NOME_VALIDO,
    });
  });

  it("aceita nome com exatamente 100 caracteres: limite inclusivo (FR-061)", async () => {
    const resposta = await postarBaralho({ nome: "a".repeat(100) });

    expect(resposta.statusCode).toBe(201);
  });

  it("aceita nome repetido com 201 — nunca 409 (FR-012)", async () => {
    const primeira = await postarBaralho({ nome: NOME_VALIDO });
    const segunda = await postarBaralho({ nome: NOME_VALIDO });

    expect(primeira.statusCode).toBe(201);
    expect(segunda.statusCode).toBe(201);
    expect(segunda.statusCode).not.toBe(409);

    const leitura = await servidor.inject({ method: "GET", url: "/baralhos" });
    expect(leitura.statusCode).toBe(200);
    expect(leitura.json()).toHaveLength(2);
  });

  it("ignora propriedade extra e ela não retorna nas leituras (FR-018)", async () => {
    const resposta = await postarBaralho({
      nome: NOME_VALIDO,
      descricao: "propriedade que não existe em Baralho",
    });

    expect(resposta.statusCode).toBe(201);
    const baralho = resposta.json();
    expect(baralho).toEqual({
      id: expect.any(String),
      nome: NOME_VALIDO,
    });

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

  it("recusa nome vazio com 400, código nome_vazio e mensagem em português (FR-011)", async () => {
    const resposta = await postarBaralho({ nome: "" });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });
  });

  it("trata nome composto só de espaços como vazio (FR-011)", async () => {
    const resposta = await postarBaralho({ nome: "   " });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });
  });

  it("recusa nome acima de 100 caracteres com 400, nome_muito_longo, informando limite e tamanho (FR-061, SC-016)", async () => {
    const resposta = await postarBaralho({ nome: "a".repeat(101) });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: "nome_muito_longo",
      mensagem:
        "O nome do baralho deve ter no máximo 100 caracteres; o informado tem 101.",
    });
  });
});

describe("POST /baralhos — forma inválida recusada na borda, antes do Acervo", () => {
  it("recusa corpo sem nome com 400 e nada é criado", async () => {
    const resposta = await postarBaralho({});

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);

    const leitura = await servidor.inject({ method: "GET", url: "/baralhos" });
    expect(leitura.json()).toEqual([]);
  });

  it("recusa nome de tipo errado com 400 e nada é criado", async () => {
    const resposta = await postarBaralho({ nome: 42 });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);

    const leitura = await servidor.inject({ method: "GET", url: "/baralhos" });
    expect(leitura.json()).toEqual([]);
  });

  it("recusa corpo que não é JSON com 400 e nada é criado", async () => {
    const resposta = await postarBaralho("isto não é json {", {
      "content-type": "application/json",
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);

    const leitura = await servidor.inject({ method: "GET", url: "/baralhos" });
    expect(leitura.json()).toEqual([]);
  });

  it("recusa requisição sem corpo com 400 e nada é criado", async () => {
    const resposta = await postarBaralho();

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);
  });
});
