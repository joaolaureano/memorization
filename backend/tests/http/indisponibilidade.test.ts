import type { FastifyInstance } from "fastify";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarAcervo } from "../../src/acervo/acervo.ts";
import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarServidor } from "../../src/http/servidor.ts";
import {
  CORPO_INVALIDO,
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
} from "../../src/http/rotas.ts";

/**
 * T805 — a falha do armazenamento é respondida como indisponibilidade, e o
 * contrato HTTP não muda (FR-044, FR-045, FR-105, FR-107).
 *
 * O servidor é montado exatamente como na aplicação, com o `Acervo` sobre o
 * Adapter do armazenamento local — encerrado antes das requisições, para que a
 * indisponibilidade seja real. O que a asserção exige: resposta que não é de
 * sucesso, com o código estável e a mensagem em português do Module e **nada**
 * além disso — nenhum trecho do driver, caminho de arquivo, URL, senha ou
 * cadeia de conexão. As rotas continuam sendo as mesmas de `001` a `006`.
 */

const INDISPONIVEL = {
  erro: "indisponivel",
  mensagem: "O armazenamento não está disponível. Tente novamente.",
};

let servidor: FastifyInstance;

beforeAll(async () => {
  const aberto = await abrirArmazenamentoSqlite(":memory:");

  await aberto.encerrar();

  servidor = criarServidor();

  const acervo = criarAcervo(aberto.armazenamento);

  registrarRotasDeCartoes(servidor, acervo);
  registrarRotasDeBaralhos(servidor, acervo);
});

afterAll(async () => {
  await servidor.close();
});

describe("falha do armazenamento — resposta sem detalhe do driver", () => {
  it("responde 503 na criação de Cartão, com o código estável e a mensagem em português", async () => {
    const resposta = await servidor.inject({
      method: "POST",
      url: "/cartoes",
      payload: { frente: "To walk", verso: "Caminhar" },
    });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual(INDISPONIVEL);
  });

  it("repete a mesma resposta enquanto o armazenamento estiver indisponível, sem nada por concluído", async () => {
    const requisicao = () =>
      servidor.inject({
        method: "POST",
        url: "/baralhos",
        payload: { nome: "Inglês" },
      });

    const primeira = await requisicao();

    expect(primeira.statusCode).toBe(503);
    expect(primeira.json()).toEqual(INDISPONIVEL);

    const segunda = await requisicao();

    expect(segunda.statusCode).toBe(503);
    expect(segunda.json()).toEqual(INDISPONIVEL);
  });

  it("responde 503 nas demais rotas que reportam a falha", async () => {
    const leituraDeBaralho = await servidor.inject({
      method: "GET",
      url: "/baralhos/baralho-inexistente",
    });
    const edicaoDeCartao = await servidor.inject({
      method: "PUT",
      url: "/cartoes/cartao-inexistente",
      payload: { frente: "To walk", verso: "Caminhar" },
    });
    const exclusaoDeCartao = await servidor.inject({
      method: "DELETE",
      url: "/cartoes/cartao-inexistente",
    });
    const edicaoDeBaralho = await servidor.inject({
      method: "PUT",
      url: "/baralhos/baralho-inexistente",
      payload: { nome: "Inglês" },
    });
    const exclusaoDeBaralho = await servidor.inject({
      method: "DELETE",
      url: "/baralhos/baralho-inexistente",
    });
    const criacaoDeVinculo = await servidor.inject({
      method: "POST",
      url: "/baralhos/baralho-inexistente/vinculos",
      payload: { cartaoId: "cartao-inexistente" },
    });
    const remocaoDeVinculo = await servidor.inject({
      method: "DELETE",
      url: "/baralhos/baralho-inexistente/vinculos/cartao-inexistente",
    });

    for (const resposta of [
      leituraDeBaralho,
      edicaoDeCartao,
      exclusaoDeCartao,
      edicaoDeBaralho,
      exclusaoDeBaralho,
      criacaoDeVinculo,
      remocaoDeVinculo,
    ]) {
      expect(resposta.statusCode).toBe(503);
      expect(resposta.json()).toEqual(INDISPONIVEL);
    }
  });

  it("responde a falha sem texto do driver, caminho de arquivo, URL ou cadeia de conexão", async () => {
    const resposta = await servidor.inject({
      method: "POST",
      url: "/cartoes",
      payload: { frente: "To walk", verso: "Caminhar" },
    });

    const corpo = resposta.body;

    expect(Object.keys(resposta.json() as object).sort()).toEqual([
      "erro",
      "mensagem",
    ]);
    expect(corpo).not.toMatch(
      /sqlite|statement|no such table|unable to open|\.sqlite/i,
    );
    expect(corpo).not.toContain("://");
  });

  it("continua recusando a forma inválida na borda, antes do armazenamento", async () => {
    const resposta = await servidor.inject({
      method: "POST",
      url: "/cartoes",
      payload: { verso: "Caminhar" },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(CORPO_INVALIDO);
  });

  it("não registra rota nova: /health continua 200 e a rota desconhecida continua 404", async () => {
    const saude = await servidor.inject({ method: "GET", url: "/health" });
    const desconhecida = await servidor.inject({
      method: "GET",
      url: "/indisponivel",
    });

    expect(saude.statusCode).toBe(200);
    expect(saude.json()).toEqual({ status: "ok" });
    expect(desconhecida.statusCode).toBe(404);
  });
});
