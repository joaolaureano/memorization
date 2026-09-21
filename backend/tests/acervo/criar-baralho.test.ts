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
 * T103 — `Acervo` cria Baralho pela sua Interface, recusando nome inválido.
 * Toda asserção passa pela Interface, com SQLite em memória; nenhum teste
 * inspeciona a tabela. Baralho nesta etapa tem apenas id opaco e nome
 * (FR-018): elegibilidade, contagem e listagem chegam em T104.
 */

const NOME_VALIDO = "Inglês";
const LIMITE_DO_NOME = 100;

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

describe("criarBaralho — criação pela Interface", () => {
  it("cria um Baralho válido com id opaco e nome", () => {
    const baralho = baralhoDo(acervo.criarBaralho({ nome: NOME_VALIDO }));

    expect(baralho).toEqual({
      id: expect.any(String),
      nome: NOME_VALIDO,
    });
  });

  it("recusa nome vazio, com mensagem em português", () => {
    expect(acervo.criarBaralho({ nome: "" })).toEqual({
      ok: false,
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });
  });

  it("trata nome composto só de espaços como vazio", () => {
    expect(acervo.criarBaralho({ nome: "   " })).toEqual({
      ok: false,
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });
  });

  it("recusa nome com 101 caracteres, informando limite e tamanho atual", () => {
    expect(
      acervo.criarBaralho({ nome: "a".repeat(LIMITE_DO_NOME + 1) }),
    ).toEqual({
      ok: false,
      erro: "nome_muito_longo",
      mensagem:
        "O nome do baralho deve ter no máximo 100 caracteres; o informado tem 101.",
    });
  });

  it("aceita nome exatamente no limite de 100 caracteres", () => {
    const nome = "a".repeat(LIMITE_DO_NOME);

    const baralho = baralhoDo(acervo.criarBaralho({ nome }));

    expect(baralho).toEqual({
      id: expect.any(String),
      nome,
    });
  });

  it("aceita dois Baralhos de nome repetido, com identificadores distintos", () => {
    const primeiro = baralhoDo(acervo.criarBaralho({ nome: NOME_VALIDO }));
    const segundo = baralhoDo(acervo.criarBaralho({ nome: NOME_VALIDO }));

    expect(primeiro.nome).toBe(NOME_VALIDO);
    expect(segundo.nome).toBe(NOME_VALIDO);
    expect(segundo.id).not.toBe(primeiro.id);
  });

  it("ignora propriedade extra e não a devolve", () => {
    const entrada = {
      nome: NOME_VALIDO,
      elegivel: "propriedade que não existe em Baralho",
    };

    const baralho = baralhoDo(acervo.criarBaralho(entrada));

    expect(baralho).toEqual({
      id: expect.any(String),
      nome: NOME_VALIDO,
    });
  });
});
