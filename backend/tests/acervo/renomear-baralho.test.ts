import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Baralho,
  type Cartao,
  type ResultadoDeCriacaoDeBaralho,
  type ResultadoDeCriacaoDeCartao,
} from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T402 — `Acervo` renomeia Baralho pela sua Interface, reaplicando as regras
 * da criação e preservando Vínculos e elegibilidade.
 *
 * Toda asserção atravessa a Interface (`criarBaralho`, `criarCartao`,
 * `vincular`, `renomearBaralho`, `listarBaralhos` e `listarCartoes`) sobre o
 * Adapter do armazenamento local em memória; nenhum teste inspeciona a tabela.
 * O nome novo vale em todos os lugares (FR-015), os Vínculos permanecem
 * intactos e a elegibilidade continua derivada da contagem. Nome inválido é
 * recusado como na criação e Baralho inexistente, como `nao_encontrado`.
 */

const NOME_VALIDO = "Inglês";
const NOME_EDITADO = "Inglês britânico";

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

/** Desembrulha o Cartão de uma criação aceita; falha se foi recusada. */
function cartaoDo(resultado: ResultadoDeCriacaoDeCartao): Cartao {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.cartao;
}

/** Cria um Baralho válido pela Interface. */
async function criarBaralho(nome = NOME_VALIDO): Promise<Baralho> {
  return baralhoDo(await acervo.criarBaralho({ nome }));
}

/** Cria um Cartão válido pela Interface. */
async function criarCartao(): Promise<Cartao> {
  return cartaoDo(
    await acervo.criarCartao({ frente: "To walk", verso: "Caminhar" }),
  );
}

describe("renomearBaralho — edição pela Interface", () => {
  it("renomeia e devolve o Baralho atualizado", async () => {
    const baralho = await criarBaralho();

    expect(
      await acervo.renomearBaralho(baralho.id, { nome: NOME_EDITADO }),
    ).toEqual({
      ok: true,
      baralho: { id: baralho.id, nome: NOME_EDITADO },
    });

    expect(await acervo.listarBaralhos()).toEqual([
      {
        id: baralho.id,
        nome: NOME_EDITADO,
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);
  });

  it("preserva Vínculos e elegibilidade ao renomear", async () => {
    const baralho = await criarBaralho();
    const cartao = await criarCartao();

    await acervo.vincular(cartao.id, baralho.id);

    expect(
      await acervo.renomearBaralho(baralho.id, { nome: NOME_EDITADO }),
    ).toEqual({
      ok: true,
      baralho: { id: baralho.id, nome: NOME_EDITADO },
    });

    expect(await acervo.listarBaralhos()).toEqual([
      {
        id: baralho.id,
        nome: NOME_EDITADO,
        quantidadeDeCartoes: 1,
        elegivel: true,
      },
    ]);
    expect(await acervo.listarCartoes()).toEqual([
      { ...cartao, baralhos: [{ id: baralho.id, nome: NOME_EDITADO }] },
    ]);
  });

  it("recusa nome vazio com a mesma mensagem da criação", async () => {
    const baralho = await criarBaralho();

    expect(await acervo.renomearBaralho(baralho.id, { nome: "" })).toEqual({
      ok: false,
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });

    expect(await acervo.listarBaralhos()).toEqual([
      {
        id: baralho.id,
        nome: NOME_VALIDO,
        quantidadeDeCartoes: 0,
        elegivel: false,
      },
    ]);
  });

  it("recusa nome acima de 100 caracteres com a mesma mensagem da criação (SC-016)", async () => {
    const baralho = await criarBaralho();

    expect(
      await acervo.renomearBaralho(baralho.id, { nome: "a".repeat(101) }),
    ).toEqual({
      ok: false,
      erro: "nome_muito_longo",
      mensagem:
        "O nome do baralho deve ter no máximo 100 caracteres; o informado tem 101.",
    });
  });

  it("recusa Baralho inexistente como nao_encontrado", async () => {
    expect(
      await acervo.renomearBaralho("baralho-inexistente", {
        nome: NOME_EDITADO,
      }),
    ).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });
});
