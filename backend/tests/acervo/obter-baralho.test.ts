import type { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Baralho,
  type Cartao,
  type ResultadoDeCriacaoDeBaralho,
  type ResultadoDeCriacaoDeCartao,
} from "../../src/acervo/acervo.ts";
import { abrirBanco } from "../../src/acervo/esquema.ts";

/**
 * T205 — `obterBaralho` devolve o Baralho com a elegibilidade derivada e os
 * Cartões vinculados, conforme o contrato de `GET /baralhos/{id}` (FR-014).
 *
 * Toda asserção atravessa a Interface (`criarBaralho`, `criarCartao`,
 * `vincular` e `obterBaralho`) sobre SQLite em memória; nenhum teste
 * inspeciona a tabela. A ordem dos Cartões não é pré-condição do contrato,
 * portanto as asserções comparam conjuntos, nunca posições.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const NOME_VALIDO = "Inglês";

let banco: DatabaseSync;
let acervo: Acervo;

beforeEach(() => {
  banco = abrirBanco(":memory:");
  acervo = criarAcervo(banco);
});

afterEach(() => {
  banco.close();
});

/** Desembrulha o Baralho de uma criação aceita; falha se foi recusada. */
function baralhoDo(resultado: ResultadoDeCriacaoDeBaralho): Baralho {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.baralho;
}

/** Desembrulha o Cartão de uma criação aceita; falha se foi recusada. */
function cartaoDo(resultado: ResultadoDeCriacaoDeCartao): Cartao {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.cartao;
}

function criarBaralho(nome = NOME_VALIDO): Baralho {
  return baralhoDo(acervo.criarBaralho({ nome }));
}

function criarCartao(frente: string, verso: string): Cartao {
  return cartaoDo(acervo.criarCartao({ frente, verso }));
}

describe("obterBaralho — leitura pela Interface", () => {
  it("recusa Baralho inexistente com código nao_encontrado e mensagem em português", () => {
    expect(acervo.obterBaralho("baralho-inexistente")).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });

  it("devolve Baralho sem Cartões como não elegível, com cartoes vazio", () => {
    const baralho = criarBaralho();

    expect(acervo.obterBaralho(baralho.id)).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: NOME_VALIDO,
        elegivel: false,
        cartoes: [],
      },
    });
  });

  it("devolve Baralho elegível com os três Cartões vinculados", () => {
    const baralho = criarBaralho();
    const primeiro = criarCartao("To walk", "Caminhar");
    const segundo = criarCartao("To run", "Correr");
    const terceiro = criarCartao("To sleep", "Dormir");

    for (const cartao of [primeiro, segundo, terceiro]) {
      acervo.vincular(cartao.id, baralho.id);
    }

    const resultado = acervo.obterBaralho(baralho.id);

    expect(resultado).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: NOME_VALIDO,
        elegivel: true,
        cartoes: expect.arrayContaining([primeiro, segundo, terceiro]),
      },
    });
    expect(resultado.ok ? resultado.baralho.cartoes : []).toHaveLength(3);
  });

  it("deriva a elegibilidade da presença de Cartões, nunca de coluna", () => {
    const baralho = criarBaralho();
    const cartao = criarCartao(FRENTE_VALIDA, VERSO_VALIDO);

    const antes = acervo.obterBaralho(baralho.id);

    expect(antes).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: NOME_VALIDO,
        elegivel: false,
        cartoes: [],
      },
    });

    acervo.vincular(cartao.id, baralho.id);

    expect(acervo.obterBaralho(baralho.id)).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: NOME_VALIDO,
        elegivel: true,
        cartoes: [cartao],
      },
    });

    acervo.desvincular(cartao.id, baralho.id);

    expect(acervo.obterBaralho(baralho.id)).toEqual({
      ok: true,
      baralho: {
        id: baralho.id,
        nome: NOME_VALIDO,
        elegivel: false,
        cartoes: [],
      },
    });
  });
});
