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
 * T203 e T204 — `Acervo` vincula e desvincula pela sua Interface.
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho`,
 * `vincular`, `desvincular`, `listarBaralhos` e `listarCartoes`) sobre SQLite
 * em memória; nenhum teste inspeciona a tabela. A recusa de duplicata vem da
 * chave composta do esquema e o erro do driver é traduzido em
 * `vinculo_duplicado` — nenhum erro de banco vaza. Desvincular preserva
 * Cartão e Baralho (FR-021) e a elegibilidade é reavaliada na leitura
 * (FR-024).
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

/** Desembrulha o Cartão de uma criação aceita; falha se foi recusada. */
function cartaoDo(resultado: ResultadoDeCriacaoDeCartao): Cartao {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.cartao;
}

/** Desembrulha o Baralho de uma criação aceita; falha se foi recusada. */
function baralhoDo(resultado: ResultadoDeCriacaoDeBaralho): Baralho {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.baralho;
}

/** Cria um Cartão válido pela Interface. */
function criarCartao(): Cartao {
  return cartaoDo(
    acervo.criarCartao({ frente: FRENTE_VALIDA, verso: VERSO_VALIDO }),
  );
}

/** Cria um Baralho válido pela Interface. */
function criarBaralho(nome = NOME_VALIDO): Baralho {
  return baralhoDo(acervo.criarBaralho({ nome }));
}

describe("vincular — criação de Vínculo pela Interface", () => {
  it("vincula um Cartão existente a um Baralho existente e torna o Baralho elegível", () => {
    const cartao = criarCartao();
    const baralho = criarBaralho();

    expect(acervo.vincular(cartao.id, baralho.id)).toEqual({ ok: true });

    expect(acervo.listarBaralhos()).toEqual([
      {
        id: baralho.id,
        nome: NOME_VALIDO,
        quantidadeDeCartoes: 1,
        elegivel: true,
      },
    ]);
    expect(acervo.listarCartoes()).toEqual([
      { ...cartao, baralhos: [baralho] },
    ]);
  });

  it("recusa Vínculo duplicado com código estável e mensagem em português (FR-023, SC-009)", () => {
    const cartao = criarCartao();
    const baralho = criarBaralho();

    expect(acervo.vincular(cartao.id, baralho.id)).toEqual({ ok: true });
    expect(acervo.vincular(cartao.id, baralho.id)).toEqual({
      ok: false,
      erro: "vinculo_duplicado",
      mensagem: "O vínculo já existe.",
    });

    // O esquema é a autoridade da unicidade: a recusa não deixou duplicata.
    const listados = acervo.listarBaralhos();

    expect(listados).toHaveLength(1);
    expect(listados[0].quantidadeDeCartoes).toBe(1);
  });

  it("recusa Cartão inexistente com código nao_encontrado e mensagem em português", () => {
    const baralho = criarBaralho();

    expect(acervo.vincular("cartao-inexistente", baralho.id)).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });
  });

  it("recusa Baralho inexistente com código nao_encontrado e mensagem em português", () => {
    const cartao = criarCartao();

    expect(acervo.vincular(cartao.id, "baralho-inexistente")).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });

  it("aceita um Cartão vinculado a 20 Baralhos e um Baralho com 60 Cartões", () => {
    const cartao = criarCartao();

    for (let i = 0; i < 20; i += 1) {
      const baralho = criarBaralho(`Baralho ${i}`);

      expect(acervo.vincular(cartao.id, baralho.id)).toEqual({ ok: true });
    }

    const baralho = criarBaralho("Baralho grande");

    for (let i = 0; i < 60; i += 1) {
      const cartaoDoLote = criarCartao();

      expect(acervo.vincular(cartaoDoLote.id, baralho.id)).toEqual({ ok: true });
    }

    expect(acervo.listarCartoes()).toHaveLength(61);
    expect(
      acervo.listarBaralhos().find((listado) => listado.id === baralho.id)
        ?.quantidadeDeCartoes,
    ).toBe(60);
  });
});

describe("desvincular — remoção de Vínculo pela Interface", () => {
  it("desvincula preservando Cartão e Baralho", () => {
    const cartao = criarCartao();
    const baralho = criarBaralho();

    acervo.vincular(cartao.id, baralho.id);
    expect(acervo.desvincular(cartao.id, baralho.id)).toEqual({ ok: true });

    expect(acervo.listarCartoes()).toEqual([{ ...cartao, baralhos: [] }]);
    expect(acervo.listarBaralhos()).toEqual([
      {
        id: baralho.id,
        nome: NOME_VALIDO,
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);
  });

  it("recusa Vínculo inexistente com código estável e mensagem em português", () => {
    const cartao = criarCartao();
    const baralho = criarBaralho();

    expect(acervo.desvincular(cartao.id, baralho.id)).toEqual({
      ok: false,
      erro: "vinculo_nao_encontrado",
      mensagem: "O vínculo não existe.",
    });
  });

  it("faz o Baralho perder a elegibilidade ao perder o último Cartão, preservando-o", () => {
    const cartao = criarCartao();
    const baralho = criarBaralho();

    acervo.vincular(cartao.id, baralho.id);

    expect(acervo.listarBaralhos()[0].elegivel).toBe(true);

    acervo.desvincular(cartao.id, baralho.id);

    const [listado] = acervo.listarBaralhos();

    expect(listado.elegivel).toBe(false);
    expect(listado.quantidadeDeCartoes).toBe(0);
    expect(acervo.listarCartoes()).toEqual([{ ...cartao, baralhos: [] }]);
  });
});
