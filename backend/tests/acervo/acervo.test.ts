import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Cartao,
  type ResultadoDeCriacaoDeCartao,
} from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T005 — `Acervo` cria Cartão pela sua Interface, recusando conteúdo
 * inválido. Toda asserção passa pela Interface, com o Adapter do armazenamento
 * local em memória; nenhum teste inspeciona a tabela.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";

let aberto: ArmazenamentoSqliteAberto;
let acervo: Acervo;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  /**
   * O acervo é de um **dono**: todo Cartão e todo Baralho pertencem a um
   * Usuário, e a Interface do `Acervo` recebe o dono na construção (FR-092).
   */
  const dono = await criarDonoDeTeste(aberto.usuarios);

  acervo = criarAcervo(aberto.armazenamento, dono);
});

afterEach(async () => {
  await aberto.encerrar();
});

/** Desembrulha o Cartão de uma criação aceita; falha se foi recusada. */
function cartaoDo(resultado: ResultadoDeCriacaoDeCartao): Cartao {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.cartao;
}

describe("criarCartao — criação pela Interface", () => {
  it("cria um Cartão válido com Frente e Verso, sem nenhum Baralho", async () => {
    const cartao = cartaoDo(
      await acervo.criarCartao({ frente: FRENTE_VALIDA, verso: VERSO_VALIDO }),
    );

    expect(cartao).toEqual({
      id: expect.any(String),
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });
  });

  it("recusa Frente vazia, com mensagem em português", async () => {
    expect(await acervo.criarCartao({ frente: "", verso: VERSO_VALIDO })).toEqual(
      {
        ok: false,
        erro: "frente_vazia",
        mensagem: "A frente do cartão não pode ficar vazia.",
      },
    );
  });

  it("recusa Verso vazio, com mensagem em português", async () => {
    expect(
      await acervo.criarCartao({ frente: FRENTE_VALIDA, verso: "" }),
    ).toEqual({
      ok: false,
      erro: "verso_vazio",
      mensagem: "O verso do cartão não pode ficar vazio.",
    });
  });

  it("trata Frente composta só de espaços como vazia", async () => {
    expect(
      await acervo.criarCartao({ frente: "   ", verso: VERSO_VALIDO }),
    ).toEqual({
      ok: false,
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });
  });

  it("recusa Frente com 1001 caracteres, informando limite e tamanho atual", async () => {
    expect(
      await acervo.criarCartao({
        frente: "a".repeat(1001),
        verso: VERSO_VALIDO,
      }),
    ).toEqual({
      ok: false,
      erro: "frente_muito_longa",
      mensagem:
        "A frente do cartão deve ter no máximo 1000 caracteres; a informada tem 1001.",
    });
  });

  it("ignora propriedade extra e não a devolve nas leituras", async () => {
    const entrada = {
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
      titulo: "propriedade que não existe em Cartão",
    };

    const cartao = cartaoDo(await acervo.criarCartao(entrada));

    expect(cartao).toEqual({
      id: expect.any(String),
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });
    expect(await acervo.listarCartoes()).toEqual([{ ...cartao, baralhos: [] }]);
  });
});
