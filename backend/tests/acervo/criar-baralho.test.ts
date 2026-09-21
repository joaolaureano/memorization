import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Baralho,
  type ResultadoDeCriacaoDeBaralho,
} from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T103 — `Acervo` cria Baralho pela sua Interface, recusando nome inválido.
 * Toda asserção passa pela Interface, com o Adapter do armazenamento local em
 * memória; nenhum teste inspeciona a tabela. Baralho nesta etapa tem apenas id
 * opaco e nome (FR-018): elegibilidade, contagem e listagem chegam em T104.
 */

const NOME_VALIDO = "Inglês";
const LIMITE_DO_NOME = 100;

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

/** Desembrulha o Baralho de uma criação aceita; falha se foi recusada. */
function baralhoDo(resultado: ResultadoDeCriacaoDeBaralho): Baralho {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.baralho;
}

describe("criarBaralho — criação pela Interface", () => {
  it("cria um Baralho válido com id opaco e nome", async () => {
    const baralho = baralhoDo(await acervo.criarBaralho({ nome: NOME_VALIDO }));

    expect(baralho).toEqual({
      id: expect.any(String),
      nome: NOME_VALIDO,
    });
  });

  it("recusa nome vazio, com mensagem em português (FR-023)", async () => {
    expect(await acervo.criarBaralho({ nome: "" })).toEqual({
      ok: false,
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });
  });

  it("trata nome composto só de espaços como vazio", async () => {
    expect(await acervo.criarBaralho({ nome: "   " })).toEqual({
      ok: false,
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });
  });

  it("recusa nome com 101 caracteres, informando limite e tamanho atual (FR-023, SC-016)", async () => {
    expect(
      await acervo.criarBaralho({ nome: "a".repeat(LIMITE_DO_NOME + 1) }),
    ).toEqual({
      ok: false,
      erro: "nome_muito_longo",
      mensagem:
        "O nome do baralho deve ter no máximo 100 caracteres; o informado tem 101.",
    });
  });

  it("aceita nome exatamente no limite de 100 caracteres", async () => {
    const nome = "a".repeat(LIMITE_DO_NOME);

    const baralho = baralhoDo(await acervo.criarBaralho({ nome }));

    expect(baralho).toEqual({
      id: expect.any(String),
      nome,
    });
  });

  it("aceita dois Baralhos de nome repetido, com identificadores distintos", async () => {
    const primeiro = baralhoDo(await acervo.criarBaralho({ nome: NOME_VALIDO }));
    const segundo = baralhoDo(await acervo.criarBaralho({ nome: NOME_VALIDO }));

    expect(primeiro.nome).toBe(NOME_VALIDO);
    expect(segundo.nome).toBe(NOME_VALIDO);
    expect(segundo.id).not.toBe(primeiro.id);
  });

  it("ignora propriedade extra e não a devolve", async () => {
    const entrada = {
      nome: NOME_VALIDO,
      elegivel: "propriedade que não existe em Baralho",
    };

    const baralho = baralhoDo(await acervo.criarBaralho(entrada));

    expect(baralho).toEqual({
      id: expect.any(String),
      nome: NOME_VALIDO,
    });
  });
});
