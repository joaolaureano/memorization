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
 * T105 — contrato HTTP de `GET /baralhos`
 * (specs/002-criar-baralho/contracts/api-baralhos.md).
 *
 * Toda asserção atravessa `inject` sobre o Adapter HTTP registrado com o
 * `Acervo` sobre o Adapter do armazenamento local em memória. O nome é rótulo,
 * não identificador: dois Baralhos com o mesmo nome são ambos devolvidos
 * (FR-012). `quantidadeDeCartoes` e `elegivel` são derivados na leitura —
 * nesta feature, sempre `0` e `false`, porque ainda não existe Vínculo
 * (FR-024).
 */

const NOME_REPETIDO = "Inglês";

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
async function criar(
  nome: string,
): Promise<{ id: string; nome: string }> {
  const resposta = await servidor.inject({
    method: "POST",
    url: "/baralhos",
    payload: { nome },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada inesperadamente: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string; nome: string };
}

describe("GET /baralhos — leitura conforme o contrato", () => {
  it("responde 200 com lista vazia quando nenhum Baralho existe", async () => {
    const resposta = await servidor.inject({ method: "GET", url: "/baralhos" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual([]);
  });

  it("responde 200 com os dois Baralhos de nome idêntico, ambos presentes", async () => {
    const primeiro = await criar(NOME_REPETIDO);
    const segundo = await criar(NOME_REPETIDO);

    const resposta = await servidor.inject({ method: "GET", url: "/baralhos" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual(
      expect.arrayContaining([
        {
          ...primeiro,
          quantidadeDeCartoes: 0,
          elegivel: false,
        },
        {
          ...segundo,
          quantidadeDeCartoes: 0,
          elegivel: false,
        },
      ]),
    );
  });

  it("devolve cada Baralho com exatamente id, nome, quantidadeDeCartoes e elegivel (FR-013)", async () => {
    await criar(NOME_REPETIDO);
    await criar(NOME_REPETIDO);

    const resposta = await servidor.inject({ method: "GET", url: "/baralhos" });
    const listados = resposta.json() as {
      id: string;
      nome: string;
      quantidadeDeCartoes: number;
      elegivel: boolean;
    }[];

    expect(listados).toHaveLength(2);
    for (const baralho of listados) {
      expect(Object.keys(baralho).sort()).toEqual([
        "elegivel",
        "id",
        "nome",
        "quantidadeDeCartoes",
      ]);
      expect(baralho.id).toEqual(expect.any(String));
      expect(baralho.nome).toBe(NOME_REPETIDO);
      expect(baralho.quantidadeDeCartoes).toBe(0);
      expect(baralho.elegivel).toBe(false);
    }
  });

  it("deriva elegivel de quantidadeDeCartoes > 0: recém-criado é não elegível (FR-024)", async () => {
    await criar(NOME_REPETIDO);

    const resposta = await servidor.inject({ method: "GET", url: "/baralhos" });
    const [listado] = resposta.json() as {
      id: string;
      nome: string;
      quantidadeDeCartoes: number;
      elegivel: boolean;
    }[];

    expect(listado.quantidadeDeCartoes).toBe(0);
    expect(listado.elegivel).toBe(listado.quantidadeDeCartoes > 0);
  });
});
