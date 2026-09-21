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
 * T502 — `Acervo` exclui Baralho pela sua Interface, preservando Cartões e
 * removendo Vínculos.
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho`,
 * `vincular`, `excluirBaralho`, `listarCartoes` e `listarBaralhos`) sobre
 * SQLite em memória; nenhum teste inspeciona a tabela. Excluir um Baralho
 * remove apenas o Baralho e os seus Vínculos — nenhum Cartão é destruído
 * (FR-017) — e os Cartões continuam alcançáveis pela lista, inclusive os que
 * ficarem sem Baralho (SC-006). Baralho inexistente é recusado como
 * `nao_encontrado`.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";

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
function criarBaralho(nome: string): Baralho {
  return baralhoDo(acervo.criarBaralho({ nome }));
}

describe("excluirBaralho — exclusão pela Interface", () => {
  it("exclui o Baralho e preserva os Cartões, que ficam alcançáveis sem Baralho", () => {
    const baralho = criarBaralho("Inglês");
    const primeiro = criarCartao();
    const segundo = criarCartao();

    acervo.vincular(primeiro.id, baralho.id);
    acervo.vincular(segundo.id, baralho.id);

    expect(acervo.excluirBaralho(baralho.id)).toEqual({ ok: true });

    expect(acervo.listarBaralhos()).toEqual([]);
    expect(acervo.listarCartoes()).toEqual(
      expect.arrayContaining([
        { ...primeiro, baralhos: [] },
        { ...segundo, baralhos: [] },
      ]),
    );
  });

  it("não torna órfão o Cartão que também está em outro Baralho", () => {
    const excluido = criarBaralho("Inglês");
    const preservado = criarBaralho("Espanhol");
    const cartao = criarCartao();

    acervo.vincular(cartao.id, excluido.id);
    acervo.vincular(cartao.id, preservado.id);

    expect(acervo.excluirBaralho(excluido.id)).toEqual({ ok: true });

    expect(acervo.listarCartoes()).toEqual([
      { ...cartao, baralhos: [preservado] },
    ]);
    expect(acervo.listarBaralhos()).toEqual([
      {
        id: preservado.id,
        nome: "Espanhol",
        quantidadeDeCartoes: 1,
        elegivel: true,
      },
    ]);
  });

  it("recusa Baralho inexistente como nao_encontrado", () => {
    expect(acervo.excluirBaralho("baralho-inexistente")).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });
});
