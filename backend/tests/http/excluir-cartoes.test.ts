import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";
import {
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
} from "../../src/http/rotas.ts";


/**
 * T031 (backend) — contrato HTTP de `DELETE /cartoes/{id}`
 * (specs/025-criar-cartoes-baralho/contracts/http.md).
 *
 * O servidor é montado com o `Acervo` sobre o Adapter do armazenamento local
 * em memória e os dois Adapters HTTP registrados sobre a sua Interface; toda
 * asserção atravessa `inject`. A rota devolve 204 sem conteúdo e remove o Cartão
 * do seu Baralho, preservando o Baralho; Cartão inexistente devolve 404 com
 * mensagem em português.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";

let servidor: FastifyInstance;
let contrato: ServidorDeContrato;

beforeEach(async () => {
  /**
   * O servidor é montado como na aplicação, com o hook que exige a Credencial:
   * cada arquivo registra as suas rotas sobre o `Acervo` do Usuário que entrou.
   */
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
  registrarRotasDeCartoes(servidor, acervoDe);
  registrarRotasDeBaralhos(servidor, acervoDe);
  });
  servidor = contrato.servidor;
});

afterEach(async () => {
  await contrato.encerrar();
});

/**
 * Envia a requisição com a Credencial do Usuário que entrou: sem ela, nenhuma
 * rota de acervo roda (FR-090), e é assim que todas as chamadas deste arquivo
 * a apresentam.
 */
function pedir(requisicao: InjectOptions) {
  return pedirComCredencial(servidor, contrato.credencial, requisicao);
}

/** Cria um Baralho pela rota de criação; falha se a criação for recusada. */
async function criarBaralho(): Promise<{ id: string; nome: string }> {
  const resposta = await pedir({
    method: "POST",
    url: "/baralhos",
    payload: { nome: "Inglês" },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação recusada inesperadamente: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string; nome: string };
}

/** Cria um Cartão no Baralho via `POST /baralhos/{id}/cartoes`; falha se recusado. */
async function criarCartaoNoBaralho(
  baralhoId: string,
): Promise<{ id: string; frente: string; verso: string }> {
  const resposta = await pedir({
    method: "POST",
    url: `/baralhos/${baralhoId}/cartoes`,
    payload: { frente: FRENTE_VALIDA, verso: VERSO_VALIDO },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`criação de Cartão recusada: ${resposta.statusCode}`);
  }

  return resposta.json() as { id: string; frente: string; verso: string };
}

describe("DELETE /cartoes/{id} — exclusão conforme o contrato", () => {
  it("responde 204, remove o Cartão e preserva o Baralho", async () => {
    const baralho = await criarBaralho();
    const cartao = await criarCartaoNoBaralho(baralho.id);

    const resposta = await pedir({
      method: "DELETE",
      url: `/cartoes/${cartao.id}`,
    });

    expect(resposta.statusCode).toBe(204);

    const cartoes = await pedir({ method: "GET", url: "/cartoes" });
    expect(cartoes.json()).toEqual([]);

    const baralhos = await pedir({
      method: "GET",
      url: "/baralhos",
    });

    expect(baralhos.json()).toEqual([
      {
        id: baralho.id,
        nome: "Inglês",
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);
  });

  it("excluir Cartão de outro Usuário retorna 404 sem efeito", async () => {
    const baralho = await criarBaralho();
    const cartao = await criarCartaoNoBaralho(baralho.id);
    const outroUsuario = await contrato.cadastrar("outro.usuario");

    const resposta = await pedirComCredencial(servidor, outroUsuario, {
      method: "DELETE",
      url: `/cartoes/${cartao.id}`,
    });

    expect(resposta.statusCode).toBe(404);

    const cartoes = await pedir({ method: "GET", url: "/cartoes" });
    expect(cartoes.json()).toHaveLength(1);
  });

  it("recusa Cartão inexistente com 404 e mensagem em português", async () => {
    const resposta = await pedir({
      method: "DELETE",
      url: "/cartoes/cartao-inexistente",
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });
  });
});
