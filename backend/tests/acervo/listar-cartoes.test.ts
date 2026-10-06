import { randomUUID } from "node:crypto";

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
 * cada Cartão passa a trazer seu Baralho dono (Pertencimento, FR-389).
 *
 * Toda asserção atravessa a Interface (`criarCartao`, `criarBaralho` e
 * `listarCartoes`) sobre o Adapter do armazenamento local em memória; nenhum
 * teste inspeciona a tabela. A Frente não é identificador: dois Cartões podem
 * compartilhá-la e ambos devem aparecer (FR-003, FR-004; invariante 2 de
 * `spec.md`). Cada Cartão pertence a exatamente UM Baralho (FR-389).
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
let baralho: Baralho;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  /**
   * O acervo é de um **dono**: todo Cartão e todo Baralho pertencem a um
   * Usuário, e a Interface do `Acervo` recebe o dono na construção (FR-092).
   */
  const dono = await criarDonoDeTeste(aberto.usuarios);

  acervo = criarAcervo(aberto.armazenamento, dono);
  baralho = baralhoDo(await acervo.criarBaralho({ nome: "Inglês" }));
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

/** Cria um Cartão válido no Baralho de testes e devolve o Cartão criado. */
async function criar(frente: string, verso: string): Promise<Cartao> {
  return cartaoDo(await acervo.criarCartao(baralho.id, { frente, verso }));
}

/** Cria um Baralho válido pela Interface e devolve o Baralho criado. */
async function criarBaralho(nome: string): Promise<Baralho> {
  return baralhoDo(await acervo.criarBaralho({ nome }));
}

describe("listarCartoes — leitura pela Interface", () => {
  it("devolve lista vazia quando nenhum Cartão existe", async () => {
    // Sem criar Cartões, mas há Baralho de testes
    expect(await acervo.listarCartoes()).toEqual([]);
  });

  it("devolve os dois Cartões de Frente idêntica, ambos presentes, no mesmo Baralho", async () => {
    const primeiro = await criar(FRENTE_REPETIDA, VERSO_UM);
    const segundo = await criar(FRENTE_REPETIDA, VERSO_OUTRO);

    const listados = await acervo.listarCartoes();

    expect(listados).toHaveLength(2);
    expect(listados).toEqual(
      expect.arrayContaining([
        { ...primeiro, baralho, proximaRevisaoEm: null },
        { ...segundo, baralho, proximaRevisaoEm: null },
      ]),
    );
  });

  it("não trata a Frente como identificador: cada Cartão mantém id, Verso e Frente numerada próprios", async () => {
    const um = await criar(FRENTE_REPETIDA, VERSO_UM);
    const dois = await criar(FRENTE_REPETIDA, VERSO_OUTRO);

    const listados = await acervo.listarCartoes();

    expect(listados).toHaveLength(2);
    expect(new Set(listados.map((cartao) => cartao.id)).size).toBe(2);
    expect(listados.map((cartao) => cartao.verso).sort()).toEqual(
      [VERSO_UM, VERSO_OUTRO].sort(),
    );
    // Verifica que as Frentes foram numeradas
    expect(listados.find((c) => c.id === um.id)?.frente).toBe(FRENTE_REPETIDA);
    expect(listados.find((c) => c.id === dois.id)?.frente).toBe(`${FRENTE_REPETIDA} (2)`);
    expect(listados.every((cartao) => cartao.baralho.id === baralho.id)).toBe(true);
  });

  it("devolve todos os Cartões existentes, cada um com sua Frente, Verso e Baralho dono", async () => {
    const primeiro = await criar(FRENTE_REPETIDA, VERSO_UM);
    const segundo = await criar(FRENTE_REPETIDA, VERSO_OUTRO);
    const terceiro = await criar(OUTRA_FRENTE, VERSO_DA_OUTRA_FRENTE);

    const listados = await acervo.listarCartoes();

    expect(listados).toHaveLength(3);
    expect(listados).toEqual(
      expect.arrayContaining([
        { ...primeiro, baralho, proximaRevisaoEm: null },
        { ...segundo, baralho, proximaRevisaoEm: null },
        { ...terceiro, baralho, proximaRevisaoEm: null },
      ]),
    );
  });

  it("Cartão em outro Baralho devolve seu Baralho dono, não vários", async () => {
    const outroBaralho = await criarBaralho("Espanhol");
    const cartao = cartaoDo(
      await acervo.criarCartao(outroBaralho.id, {
        frente: FRENTE_REPETIDA,
        verso: VERSO_UM,
      }),
    );

    const listados = await acervo.listarCartoes();

    expect(listados).toHaveLength(1);
    expect(listados[0].id).toBe(cartao.id);
    expect(listados[0].frente).toBe(FRENTE_REPETIDA);
    expect(listados[0].verso).toBe(VERSO_UM);
    expect(listados[0].baralho).toEqual(outroBaralho);
  });
});

describe("listarCartoes — próxima revisão (022)", () => {
  it("devolve proximaRevisaoEm null para Cartão sem Agendamento (FR-352)", async () => {
    const cartao = await criar(FRENTE_REPETIDA, VERSO_UM);

    expect(await acervo.listarCartoes()).toEqual([
      { ...cartao, baralho, proximaRevisaoEm: null },
    ]);
  });

  it("devolve a próxima revisão do Agendamento depois de estudar o Cartão (FR-352)", async () => {
    const estudado = await criar(FRENTE_REPETIDA, VERSO_UM);
    const naoEstudado = await criar(OUTRA_FRENTE, VERSO_DA_OUTRA_FRENTE);

    const resultado = await acervo.registrarSessao({
      id: randomUUID(),
      origem: "baralho",
      baralhoId: baralho.id,
      nomeDoBaralho: baralho.nome,
      itens: [
        {
          frente: estudado.frente,
          verso: estudado.verso,
          cartaoId: estudado.id,
          avaliacao: "bom",
        },
      ],
    });

    expect(resultado.ok).toBe(true);

    const listados = await acervo.listarCartoes();
    const comRevisao = listados.find((cartao) => cartao.id === estudado.id);
    const semRevisao = listados.find((cartao) => cartao.id === naoEstudado.id);

    expect(typeof comRevisao?.proximaRevisaoEm).toBe("string");
    expect(
      Number.isNaN(Date.parse(comRevisao?.proximaRevisaoEm ?? "")),
    ).toBe(false);
    expect(semRevisao?.proximaRevisaoEm).toBeNull();
  });

  it("não expõe Agendamentos de outro Usuário (FR-359)", async () => {
    const cartaoDoPrimeiro = await criar(FRENTE_REPETIDA, VERSO_UM);

    const donoDois = await criarDonoDeTeste(
      aberto.usuarios,
      "dono-dois",
      "bruno.souza",
    );
    const acervoDoDonoDois = criarAcervo(aberto.armazenamento, donoDois);
    const baralhoDoDonoDois = baralhoDo(
      await acervoDoDonoDois.criarBaralho({ nome: "Baralho do outro" }),
    );

    const cartaoDoDonoDois = cartaoDo(
      await acervoDoDonoDois.criarCartao(baralhoDoDonoDois.id, {
        frente: OUTRA_FRENTE,
        verso: VERSO_DA_OUTRA_FRENTE,
      }),
    );

    const resultado = await acervoDoDonoDois.registrarSessao({
      id: randomUUID(),
      origem: "baralho",
      baralhoId: baralhoDoDonoDois.id,
      nomeDoBaralho: baralhoDoDonoDois.nome,
      itens: [
        {
          frente: cartaoDoDonoDois.frente,
          verso: cartaoDoDonoDois.verso,
          cartaoId: cartaoDoDonoDois.id,
          avaliacao: "bom",
        },
      ],
    });

    expect(resultado.ok).toBe(true);

    const listados = await acervo.listarCartoes();

    expect(listados).toEqual([
      { ...cartaoDoPrimeiro, baralho, proximaRevisaoEm: null },
    ]);
    expect(listados.map((cartao) => cartao.id)).not.toContain(
      cartaoDoDonoDois.id,
    );
  });
});
