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
 * T402 — `Acervo` renomeia Baralho pela sua Interface, reaplicando as regras
 * da criação e preservando Vínculos e elegibilidade.
 *
 * Toda asserção atravessa a Interface (`criarBaralho`, `criarCartao`,
 * `vincular`, `renomearBaralho`, `listarBaralhos` e `listarCartoes`) sobre
 * SQLite em memória; nenhum teste inspeciona a tabela. O nome novo vale em
 * todos os lugares (FR-015), os Vínculos permanecem intactos e a elegibilidade
 * continua derivada da contagem. Nome inválido é recusado como na criação e
 * Baralho inexistente, como `nao_encontrado`.
 */

const NOME_VALIDO = "Inglês";
const NOME_EDITADO = "Inglês britânico";

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

/** Cria um Baralho válido pela Interface. */
function criarBaralho(nome = NOME_VALIDO): Baralho {
  return baralhoDo(acervo.criarBaralho({ nome }));
}

/** Cria um Cartão válido pela Interface. */
function criarCartao(): Cartao {
  return cartaoDo(
    acervo.criarCartao({ frente: "To walk", verso: "Caminhar" }),
  );
}

describe("renomearBaralho — edição pela Interface", () => {
  it("renomeia e devolve o Baralho atualizado", () => {
    const baralho = criarBaralho();

    expect(acervo.renomearBaralho(baralho.id, { nome: NOME_EDITADO })).toEqual({
      ok: true,
      baralho: { id: baralho.id, nome: NOME_EDITADO },
    });

    expect(acervo.listarBaralhos()).toEqual([
      {
        id: baralho.id,
        nome: NOME_EDITADO,
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);
  });

  it("preserva Vínculos e elegibilidade ao renomear", () => {
    const baralho = criarBaralho();
    const cartao = criarCartao();

    acervo.vincular(cartao.id, baralho.id);

    expect(acervo.renomearBaralho(baralho.id, { nome: NOME_EDITADO })).toEqual({
      ok: true,
      baralho: { id: baralho.id, nome: NOME_EDITADO },
    });

    expect(acervo.listarBaralhos()).toEqual([
      {
        id: baralho.id,
        nome: NOME_EDITADO,
        quantidadeDeCartoes: 1,
        elegivel: true,
      },
    ]);
    expect(acervo.listarCartoes()).toEqual([
      { ...cartao, baralhos: [{ id: baralho.id, nome: NOME_EDITADO }] },
    ]);
  });

  it("recusa nome vazio com a mesma mensagem da criação", () => {
    const baralho = criarBaralho();

    expect(acervo.renomearBaralho(baralho.id, { nome: "" })).toEqual({
      ok: false,
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });

    expect(acervo.listarBaralhos()).toEqual([
      {
        id: baralho.id,
        nome: NOME_VALIDO,
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);
  });

  it("recusa nome acima de 100 caracteres com a mesma mensagem da criação", () => {
    const baralho = criarBaralho();

    expect(
      acervo.renomearBaralho(baralho.id, { nome: "a".repeat(101) }),
    ).toEqual({
      ok: false,
      erro: "nome_muito_longo",
      mensagem:
        "O nome do baralho deve ter no máximo 100 caracteres; o informado tem 101.",
    });
  });

  it("recusa Baralho inexistente como nao_encontrado", () => {
    expect(
      acervo.renomearBaralho("baralho-inexistente", { nome: NOME_EDITADO }),
    ).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });
});
