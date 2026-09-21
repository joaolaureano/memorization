import type { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Cartao,
  type ResultadoDeCriacaoDeCartao,
} from "../../src/acervo/acervo.ts";
import { abrirBanco } from "../../src/acervo/esquema.ts";

/**
 * T006 — `Acervo` lista Cartões, inclusive dois com a mesma Frente.
 *
 * Toda asserção atravessa a Interface (`criarCartao` e `listarCartoes`) sobre
 * SQLite em memória; nenhum teste inspeciona a tabela. A Frente não é
 * identificador: dois Cartões podem compartilhá-la e ambos devem aparecer
 * (FR-003, FR-004; invariante 2 de `spec.md`).
 *
 * A ordem não é pré-condição da Interface, portanto as asserções comparam
 * conjuntos de Cartões, nunca posições na lista.
 */

const FRENTE_REPETIDA = "To walk";
const VERSO_UM = "Caminhar";
const VERSO_OUTRO = "Andar";
const OUTRA_FRENTE = "To sleep";
const VERSO_DA_OUTRA_FRENTE = "Dormir";

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

/** Cria um Cartão válido pela Interface e devolve o Cartão criado. */
function criar(frente: string, verso: string): Cartao {
  return cartaoDo(acervo.criarCartao({ frente, verso }));
}

describe("listarCartoes — leitura pela Interface", () => {
  it("devolve lista vazia quando nenhum Cartão existe", () => {
    expect(acervo.listarCartoes()).toEqual([]);
  });

  it("devolve os dois Cartões de Frente idêntica, ambos presentes", () => {
    const primeiro = criar(FRENTE_REPETIDA, VERSO_UM);
    const segundo = criar(FRENTE_REPETIDA, VERSO_OUTRO);

    const listados = acervo.listarCartoes();

    expect(listados).toHaveLength(2);
    expect(listados).toEqual(expect.arrayContaining([primeiro, segundo]));
  });

  it("não trata a Frente como identificador: cada Cartão mantém id e Verso próprios", () => {
    criar(FRENTE_REPETIDA, VERSO_UM);
    criar(FRENTE_REPETIDA, VERSO_OUTRO);

    const deMesmaFrente = acervo
      .listarCartoes()
      .filter((cartao) => cartao.frente === FRENTE_REPETIDA);

    expect(deMesmaFrente).toHaveLength(2);
    expect(new Set(deMesmaFrente.map((cartao) => cartao.id)).size).toBe(2);
    expect(deMesmaFrente.map((cartao) => cartao.verso).sort()).toEqual(
      [VERSO_UM, VERSO_OUTRO].sort(),
    );
  });

  it("devolve todos os Cartões existentes, cada um com sua Frente e seu Verso", () => {
    const primeiro = criar(FRENTE_REPETIDA, VERSO_UM);
    const segundo = criar(FRENTE_REPETIDA, VERSO_OUTRO);
    const terceiro = criar(OUTRA_FRENTE, VERSO_DA_OUTRA_FRENTE);

    const listados = acervo.listarCartoes();

    expect(listados).toHaveLength(3);
    expect(listados).toEqual(
      expect.arrayContaining([primeiro, segundo, terceiro]),
    );
  });
});
