import type { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Baralho,
  type ResultadoDeCriacaoDeBaralho,
} from "../../src/acervo/acervo.ts";
import { abrirBanco } from "../../src/acervo/esquema.ts";

/**
 * T104 — `Acervo` lista Baralhos pela sua Interface. Cada item carrega
 * exatamente id, nome, quantidadeDeCartoes e elegivel. Sem tabela de vínculo
 * nesta etapa, a contagem é derivada como 0 na leitura e a elegibilidade,
 * como contagem maior que 0: nenhum Baralho é elegível. O nome é rótulo, não
 * identificador: dois Baralhos homônimos aparecem separadamente.
 *
 * Toda asserção atravessa a Interface (`criarBaralho` e `listarBaralhos`)
 * sobre SQLite em memória; nenhum teste inspeciona a tabela. A ordem não é
 * pré-condição da Interface, portanto as asserções comparam conjuntos de
 * Baralhos, nunca posições na lista.
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

/** Cria um Baralho válido pela Interface e devolve o Baralho criado. */
function criar(nome: string): Baralho {
  return baralhoDo(acervo.criarBaralho({ nome }));
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

  it("deriva quantidadeDeCartoes como 0 e elegivel como contagem > 0, portanto falso", () => {
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
});
