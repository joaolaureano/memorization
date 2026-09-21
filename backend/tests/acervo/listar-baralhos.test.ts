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
 * T104 — `Acervo` lista Baralhos pela sua Interface; e T205 — a contagem e a
 * elegibilidade passam a ser derivadas dos Vínculos na leitura, nunca lidas de
 * coluna.
 *
 * Cada item carrega exatamente id, nome, quantidadeDeCartoes e elegivel. O
 * nome é rótulo, não identificador: dois Baralhos homônimos aparecem
 * separadamente. A elegibilidade é `quantidadeDeCartoes > 0` (FR-024).
 *
 * Toda asserção atravessa a Interface (`criarBaralho`, `criarCartao`,
 * `vincular` e `listarBaralhos`) sobre SQLite em memória; nenhum teste
 * inspeciona a tabela. A ordem não é pré-condição da Interface, portanto as
 * asserções comparam conjuntos de Baralhos, nunca posições na lista.
 */

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

/** Cria um Baralho válido pela Interface e devolve o Baralho criado. */
function criar(nome: string): Baralho {
  return baralhoDo(acervo.criarBaralho({ nome }));
}

/** Cria um Cartão válido pela Interface e devolve o Cartão criado. */
function criarCartao(frente: string, verso: string): Cartao {
  return cartaoDo(acervo.criarCartao({ frente, verso }));
}

describe("listarBaralhos — leitura pela Interface", () => {
  it("devolve lista vazia quando nenhum Baralho existe", () => {
    expect(acervo.listarBaralhos()).toEqual([]);
  });

  it("devolve cada Baralho com exatamente id, nome, quantidadeDeCartoes e elegivel", () => {
    const criado = criar(NOME_VALIDO);

    expect(acervo.listarBaralhos()).toEqual([
      {
        id: criado.id,
        nome: NOME_VALIDO,
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);
  });

  it("deriva quantidadeDeCartoes como 0 e elegivel como contagem > 0 para Baralho sem Vínculo", () => {
    criar(NOME_VALIDO);

    const [listado] = acervo.listarBaralhos();

    expect(listado.quantidadeDeCartoes).toBe(0);
    expect(listado.elegivel).toBe(listado.quantidadeDeCartoes > 0);
    expect(listado.elegivel).toBe(false);
  });

  it("devolve os dois Baralhos de nome idêntico, ambos presentes, sem deduplicação", () => {
    const primeiro = criar(NOME_VALIDO);
    const segundo = criar(NOME_VALIDO);

    const listados = acervo.listarBaralhos();

    expect(listados).toHaveLength(2);
    expect(listados).toEqual(
      expect.arrayContaining([
        {
          id: primeiro.id,
          nome: NOME_VALIDO,
          quantidadeDeCartoes: 0,
          elegivel: false,
        },
        {
          id: segundo.id,
          nome: NOME_VALIDO,
          quantidadeDeCartoes: 0,
          elegivel: false,
        },
      ]),
    );
    expect(new Set(listados.map((baralho) => baralho.id)).size).toBe(2);
  });

  it("deriva quantidadeDeCartoes e elegivel da contagem de Vínculos para 0, 1 e 3 Cartões", () => {
    const vazio = criar("Vazio");
    const comUm = criar("Com um");
    const comTres = criar("Com três");

    acervo.vincular(criarCartao("To walk", "Caminhar").id, comUm.id);

    for (const cartao of [
      criarCartao("To run", "Correr"),
      criarCartao("To sleep", "Dormir"),
      criarCartao("To read", "Ler"),
    ]) {
      acervo.vincular(cartao.id, comTres.id);
    }

    const listados = acervo.listarBaralhos();

    expect(listados).toEqual(
      expect.arrayContaining([
        {
          id: vazio.id,
          nome: "Vazio",
          quantidadeDeCartoes: 0,
          elegivel: false,
        },
        {
          id: comUm.id,
          nome: "Com um",
          quantidadeDeCartoes: 1,
          elegivel: true,
        },
        {
          id: comTres.id,
          nome: "Com três",
          quantidadeDeCartoes: 3,
          elegivel: true,
        },
      ]),
    );

    for (const listado of listados) {
      expect(listado.elegivel).toBe(listado.quantidadeDeCartoes > 0);
    }
  });
});
