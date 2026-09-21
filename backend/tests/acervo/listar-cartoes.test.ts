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
 * T006 — `Acervo` lista Cartões, inclusive dois com a mesma Frente; e T206 —
 * cada Cartão passa a trazer os Baralhos a que está vinculado.
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho`,
 * `vincular` e `listarCartoes`) sobre o Adapter do armazenamento local em
 * memória; nenhum teste inspeciona a tabela. A Frente não é identificador: dois
 * Cartões podem compartilhá-la e ambos devem aparecer (FR-003, FR-004;
 * invariante 2 de `spec.md`). Um Cartão sem Baralho devolve `baralhos: []` —
 * estado legítimo que garante SC-006.
 *
 * A ordem não é pré-condição da Interface, portanto as asserções comparam
 * conjuntos de Cartões, nunca posições na lista.
 */

const FRENTE_REPETIDA = "To walk";
const VERSO_UM = "Caminhar";
const VERSO_OUTRO = "Andar";
const OUTRA_FRENTE = "To sleep";
const VERSO_DA_OUTRA_FRENTE = "Dormir";

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

/** Desembrulha o Baralho de uma criação aceita; falha se foi recusada. */
function baralhoDo(resultado: ResultadoDeCriacaoDeBaralho): Baralho {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.baralho;
}

/** Cria um Cartão válido pela Interface e devolve o Cartão criado. */
async function criar(frente: string, verso: string): Promise<Cartao> {
  return cartaoDo(await acervo.criarCartao({ frente, verso }));
}

/** Cria um Baralho válido pela Interface e devolve o Baralho criado. */
async function criarBaralho(nome: string): Promise<Baralho> {
  return baralhoDo(await acervo.criarBaralho({ nome }));
}

describe("listarCartoes — leitura pela Interface", () => {
  it("devolve lista vazia quando nenhum Cartão existe", async () => {
    expect(await acervo.listarCartoes()).toEqual([]);
  });

  it("devolve os dois Cartões de Frente idêntica, ambos presentes, sem Baralhos", async () => {
    const primeiro = await criar(FRENTE_REPETIDA, VERSO_UM);
    const segundo = await criar(FRENTE_REPETIDA, VERSO_OUTRO);

    const listados = await acervo.listarCartoes();

    expect(listados).toHaveLength(2);
    expect(listados).toEqual(
      expect.arrayContaining([
        { ...primeiro, baralhos: [] },
        { ...segundo, baralhos: [] },
      ]),
    );
  });

  it("não trata a Frente como identificador: cada Cartão mantém id e Verso próprios", async () => {
    await criar(FRENTE_REPETIDA, VERSO_UM);
    await criar(FRENTE_REPETIDA, VERSO_OUTRO);

    const deMesmaFrente = (await acervo.listarCartoes()).filter(
      (cartao) => cartao.frente === FRENTE_REPETIDA,
    );

    expect(deMesmaFrente).toHaveLength(2);
    expect(new Set(deMesmaFrente.map((cartao) => cartao.id)).size).toBe(2);
    expect(deMesmaFrente.map((cartao) => cartao.verso).sort()).toEqual(
      [VERSO_UM, VERSO_OUTRO].sort(),
    );
    expect(deMesmaFrente.every((cartao) => cartao.baralhos.length === 0)).toBe(
      true,
    );
  });

  it("devolve todos os Cartões existentes, cada um com sua Frente, seu Verso e baralhos vazios", async () => {
    const primeiro = await criar(FRENTE_REPETIDA, VERSO_UM);
    const segundo = await criar(FRENTE_REPETIDA, VERSO_OUTRO);
    const terceiro = await criar(OUTRA_FRENTE, VERSO_DA_OUTRA_FRENTE);

    const listados = await acervo.listarCartoes();

    expect(listados).toHaveLength(3);
    expect(listados).toEqual(
      expect.arrayContaining([
        { ...primeiro, baralhos: [] },
        { ...segundo, baralhos: [] },
        { ...terceiro, baralhos: [] },
      ]),
    );
  });

  it("devolve um Cartão em três Baralhos uma única vez, com os três Baralhos", async () => {
    const cartao = await criar(FRENTE_REPETIDA, VERSO_UM);
    const primeiroBaralho = await criarBaralho("Inglês");
    const segundoBaralho = await criarBaralho("Espanhol");
    const terceiroBaralho = await criarBaralho("Francês");

    for (const baralho of [primeiroBaralho, segundoBaralho, terceiroBaralho]) {
      expect(await acervo.vincular(cartao.id, baralho.id)).toEqual({ ok: true });
    }

    const listados = await acervo.listarCartoes();

    expect(listados).toHaveLength(1);
    expect(listados[0].id).toBe(cartao.id);
    expect(listados[0].frente).toBe(FRENTE_REPETIDA);
    expect(listados[0].verso).toBe(VERSO_UM);
    expect(listados[0].baralhos).toEqual(
      expect.arrayContaining([
        primeiroBaralho,
        segundoBaralho,
        terceiroBaralho,
      ]),
    );
  });

  it("mantém o Cartão órfão presente, com baralhos: []", async () => {
    const cartao = await criar(OUTRA_FRENTE, VERSO_DA_OUTRA_FRENTE);

    await criarBaralho("Inglês");

    expect(await acervo.listarCartoes()).toEqual([
      { ...cartao, baralhos: [] },
    ]);
  });
});
