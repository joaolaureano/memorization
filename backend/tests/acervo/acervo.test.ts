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
 * T005, T020 — `Acervo` cria Cartão pela sua Interface, recusando conteúdo
 * inválido. Toda asserção passa pela Interface, com o Adapter do armazenamento
 * local em memória; nenhum teste inspeciona a tabela. T020: criação dentro de
 * Baralho com numeração de Frente duplicada (FR-398).
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

/** Desembrulha o Baralho de uma criação aceita; falha se foi recusada. */
function baralhoDo(resultado: ResultadoDeCriacaoDeBaralho): Baralho {
  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.baralho;
}

describe("criarCartao — criação pela Interface", () => {
  it("cria um Cartão válido com Frente e Verso no Baralho (FR-020)", async () => {
    const baralho = baralhoDo(await acervo.criarBaralho({ nome: "Inglês" }));
    const cartao = cartaoDo(
      await acervo.criarCartao(baralho.id, { frente: FRENTE_VALIDA, verso: VERSO_VALIDO }),
    );

    expect(cartao).toEqual({
      id: expect.any(String),
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });

    expect(await acervo.listarCartoes()).toEqual([
      {
        ...cartao,
        baralho,
        proximaRevisaoEm: null,
      },
    ]);
  });

  it("recusa Frente vazia, com mensagem em português", async () => {
    const baralho = baralhoDo(await acervo.criarBaralho({ nome: "Inglês" }));

    expect(await acervo.criarCartao(baralho.id, { frente: "", verso: VERSO_VALIDO })).toEqual(
      {
        ok: false,
        erro: "frente_vazia",
        mensagem: "A frente do cartão não pode ficar vazia.",
      },
    );
  });

  it("recusa Verso vazio, com mensagem em português", async () => {
    const baralho = baralhoDo(await acervo.criarBaralho({ nome: "Inglês" }));

    expect(
      await acervo.criarCartao(baralho.id, { frente: FRENTE_VALIDA, verso: "" }),
    ).toEqual({
      ok: false,
      erro: "verso_vazio",
      mensagem: "O verso do cartão não pode ficar vazio.",
    });
  });

  it("trata Frente composta só de espaços como vazia", async () => {
    const baralho = baralhoDo(await acervo.criarBaralho({ nome: "Inglês" }));

    expect(
      await acervo.criarCartao(baralho.id, { frente: "   ", verso: VERSO_VALIDO }),
    ).toEqual({
      ok: false,
      erro: "frente_vazia",
      mensagem: "A frente do cartão não pode ficar vazia.",
    });
  });

  it("recusa Frente com 1001 caracteres, informando limite e tamanho atual", async () => {
    const baralho = baralhoDo(await acervo.criarBaralho({ nome: "Inglês" }));

    expect(
      await acervo.criarCartao(baralho.id, {
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
    const baralho = baralhoDo(await acervo.criarBaralho({ nome: "Inglês" }));
    const entrada = {
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
      titulo: "propriedade que não existe em Cartão",
    };

    const cartao = cartaoDo(await acervo.criarCartao(baralho.id, entrada));

    expect(cartao).toEqual({
      id: expect.any(String),
      frente: FRENTE_VALIDA,
      verso: VERSO_VALIDO,
    });
    expect(await acervo.listarCartoes()).toEqual([{ ...cartao, baralho, proximaRevisaoEm: null }]);
  });

  it("recusa Baralho inexistente com nao_encontrado (T020)", async () => {
    const inexistenteId = "00000000-0000-0000-0000-000000000000";

    expect(
      await acervo.criarCartao(inexistenteId, { frente: FRENTE_VALIDA, verso: VERSO_VALIDO }),
    ).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });

  it("numera Frente duplicada no mesmo Baralho com (2), (3)... (T020, FR-398)", async () => {
    const baralho = baralhoDo(await acervo.criarBaralho({ nome: "Inglês" }));

    const um = cartaoDo(
      await acervo.criarCartao(baralho.id, { frente: "To walk", verso: "Caminhar" }),
    );
    expect(um.frente).toBe("To walk");

    const dois = cartaoDo(
      await acervo.criarCartao(baralho.id, { frente: "To walk", verso: "Andar" }),
    );
    expect(dois.frente).toBe("To walk (2)");

    const tres = cartaoDo(
      await acervo.criarCartao(baralho.id, { frente: "To walk", verso: "Caminhada" }),
    );
    expect(tres.frente).toBe("To walk (3)");
  });

  it("trata variações de caso/acento/espaço como duplicata (T020, FR-398)", async () => {
    const baralho = baralhoDo(await acervo.criarBaralho({ nome: "Inglês" }));

    const um = cartaoDo(
      await acervo.criarCartao(baralho.id, { frente: "To walk", verso: "Caminhar" }),
    );
    expect(um.frente).toBe("To walk");

    // "to walk" (lowercase) deve ser tratado como duplicata
    const dois = cartaoDo(
      await acervo.criarCartao(baralho.id, { frente: "to walk", verso: "Andar" }),
    );
    expect(dois.frente).toBe("to walk (2)");

    // " TÓ WALK " (com acento, espaços, maiúsculas) é normalizado para "to walk"
    // que já está ocupado em "to walk (2)", então tenta "TÓ WALK (2)" que também
    // normaliza para "to walk (2)", então pula para "TÓ WALK (3)"
    const tres = cartaoDo(
      await acervo.criarCartao(baralho.id, { frente: " TÓ WALK ", verso: "Marcha" }),
    );
    expect(tres.frente).toBe("TÓ WALK (3)");
  });

  it("mesma Frente em outro Baralho fica sem número (T020)", async () => {
    const baralho1 = baralhoDo(await acervo.criarBaralho({ nome: "Inglês" }));
    const baralho2 = baralhoDo(await acervo.criarBaralho({ nome: "Espanhol" }));

    const um = cartaoDo(
      await acervo.criarCartao(baralho1.id, { frente: "To walk", verso: "Caminhar" }),
    );
    expect(um.frente).toBe("To walk");

    const dois = cartaoDo(
      await acervo.criarCartao(baralho1.id, { frente: "To walk", verso: "Andar" }),
    );
    expect(dois.frente).toBe("To walk (2)");

    // Mesma Frente em outro Baralho não colide
    const tres = cartaoDo(
      await acervo.criarCartao(baralho2.id, { frente: "To walk", verso: "Caminar" }),
    );
    expect(tres.frente).toBe("To walk");
  });

  it("Frente de 1000 caracteres que colida recusa frente_muito_longa e nada é criado (T020)", async () => {
    const baralho = baralhoDo(await acervo.criarBaralho({ nome: "Inglês" }));

    // Cria Cartão com Frente de exatamente 1000 caracteres
    const um = cartaoDo(
      await acervo.criarCartao(baralho.id, {
        frente: "a".repeat(1000),
        verso: "Verso 1",
      }),
    );
    expect(um.frente).toBe("a".repeat(1000));

    // Tenta criar outro com Frente igual (1000 caracteres) — após numeração ficaria > 1000
    const resultado = await acervo.criarCartao(baralho.id, {
      frente: "a".repeat(1000),
      verso: "Verso 2",
    });

    expect(resultado).toEqual({
      ok: false,
      erro: "frente_muito_longa",
      mensagem: expect.stringContaining("1000 caracteres"),
    });

    // Verifica que nenhum segundo Cartão foi criado
    const cartoes = await acervo.listarCartoes();
    expect(cartoes).toHaveLength(1);
    expect(cartoes[0].frente).toBe("a".repeat(1000));
  });
});
