import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  criarAcervo,
  type Acervo,
  type Baralho,
} from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * T706 — o escopo por dono está na construção do `Acervo`: cada Usuário opera
 * somente o seu (FR-090, FR-092, FR-093, FR-044, SC-028, SC-030).
 *
 * Os dois `Acervo` são criados sobre o **mesmo** armazenamento, com donos
 * diferentes, e toda asserção atravessa a Interface: o conteúdo de um Usuário é
 * indistinguível de inexistente para o outro — o mesmo `nao_encontrado`, com a
 * mesma mensagem, de um `id` que nunca existiu, e **jamais** um código novo que
 * revelasse a existência (nunca 403). O Vínculo entre donos diferentes é
 * recusado e nada muda; as recusas de Credencial não chegam a esta Interface —
 * são do hook, em `tests/http/` —, e é por isso que aqui se prova o que ela
 * mesma promete: **escopo**.
 */

let aberto: ArmazenamentoSqliteAberto;
let ana: Acervo;
let bruno: Acervo;
let baralhoDeAna: Baralho;
let baralhoDeBruno: Baralho;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");

  const donaAna = await criarDonoDeTeste(aberto.usuarios, "ana", "ana.silva");
  const donoBruno = await criarDonoDeTeste(
    aberto.usuarios,
    "bruno",
    "bruno.souza",
  );

  ana = criarAcervo(aberto.armazenamento, donaAna);
  bruno = criarAcervo(aberto.armazenamento, donoBruno);

  // Cria Baralhos de testes para cada usuário
  const resultadoAna = await ana.criarBaralho({ nome: "Inglês" });
  if (!resultadoAna.ok) {
    throw new Error(`criação de Baralho recusada: ${resultadoAna.mensagem}`);
  }
  baralhoDeAna = resultadoAna.baralho;

  const resultadoBruno = await bruno.criarBaralho({ nome: "Alemão" });
  if (!resultadoBruno.ok) {
    throw new Error(`criação de Baralho recusada: ${resultadoBruno.mensagem}`);
  }
  baralhoDeBruno = resultadoBruno.baralho;
});

afterEach(async () => {
  await aberto.encerrar();
});

/** Cria um Cartão no Baralho padrão do Usuário, falhando se a criação for recusada. */
async function criarCartao(
  acervo: Acervo,
  baralho: Baralho,
  frente: string,
  verso: string,
) {
  const resultado = await acervo.criarCartao(baralho.id, { frente, verso });

  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.cartao;
}

/** Cria um Baralho pela Interface, falhando se a criação for recusada. */
async function criarBaralho(acervo: Acervo, nome: string) {
  const resultado = await acervo.criarBaralho({ nome });

  if (!resultado.ok) {
    throw new Error(`criação recusada inesperadamente: ${resultado.mensagem}`);
  }

  return resultado.baralho;
}

describe("acervo por usuário — cada um vê e opera somente o seu", () => {
  it("lista somente os Cartões e Baralhos do próprio dono (SC-030)", async () => {
    await criarCartao(ana, baralhoDeAna, "To walk", "Caminhar");
    await criarBaralho(ana, "Francês");
    await criarCartao(bruno, baralhoDeBruno, "To read", "Ler");
    await criarBaralho(bruno, "Espanhol");

    expect(await ana.listarCartoes()).toEqual([
      expect.objectContaining({ frente: "To walk", verso: "Caminhar" }),
    ]);
    expect(await bruno.listarCartoes()).toEqual([
      expect.objectContaining({ frente: "To read", verso: "Ler" }),
    ]);
    expect(await ana.listarBaralhos()).toContainEqual(
      expect.objectContaining({ nome: "Inglês", quantidadeDeCartoes: 1 }),
    );
    expect(await bruno.listarBaralhos()).toContainEqual(
      expect.objectContaining({ nome: "Alemão", quantidadeDeCartoes: 1 }),
    );
  });

  it("edita e exclui somente o próprio conteúdo, e o do outro permanece intacto", async () => {
    const cartaoDaAna = await criarCartao(ana, baralhoDeAna, "To walk", "Caminhar");
    const outroBaralhoDeBruno = await criarBaralho(bruno, "Espanhol");
    const cartaoDoBruno = await criarCartao(bruno, baralhoDeBruno, "To read", "Ler");

    expect(
      await ana.editarCartao(cartaoDaAna.id, {
        frente: "To stroll",
        verso: "Passear",
      }),
    ).toMatchObject({ ok: true, cartao: { frente: "To stroll" } });

    expect(await ana.excluirCartao(cartaoDaAna.id)).toEqual({ ok: true });

    /** O outro Usuário continua com seus Baralhos e Cartões, como estavam. */
    expect(await bruno.listarBaralhos()).toContainEqual(
      expect.objectContaining({ id: baralhoDeBruno.id, nome: "Alemão" }),
    );
    expect(await bruno.listarBaralhos()).toContainEqual(
      expect.objectContaining({ id: outroBaralhoDeBruno.id, nome: "Espanhol" }),
    );
    expect(await bruno.listarCartoes()).toContainEqual(
      expect.objectContaining({ id: cartaoDoBruno.id, frente: "To read" }),
    );
  });

  it("o id do outro Usuário responde como um id que nunca existiu, jamais 403 (SC-030)", async () => {
    const cartaoDoBruno = await criarCartao(bruno, baralhoDeBruno, "To read", "Ler");
    const outroBaralhoDoBruno = await criarBaralho(bruno, "Espanhol");

    const baralhoInexistente = await ana.obterBaralho("baralho-que-nunca-existiu");
    const edicaoDeInexistente = await ana.editarCartao("cartao-que-nunca-existiu", {
      frente: "To walk",
      verso: "Caminhar",
    });
    const exclusaoDeInexistente = await ana.excluirCartao("id-desconhecido");

    // Tentar editar/excluir Cartão de outro Usuário retorna o mesmo erro de inexistente
    expect(await ana.editarCartao(cartaoDoBruno.id, {
      frente: "To drink",
      verso: "Beber",
    })).toEqual(edicaoDeInexistente);
    expect(await ana.excluirCartao(cartaoDoBruno.id)).toEqual(
      exclusaoDeInexistente,
    );
    expect(await ana.obterBaralho(outroBaralhoDoBruno.id)).toEqual(
      baralhoInexistente,
    );

    /** O conteúdo do outro Usuário não mudou com as tentativas. */
    expect(await bruno.listarCartoes()).toEqual([
      expect.objectContaining({ id: cartaoDoBruno.id, frente: "To read" }),
    ]);
    expect(await bruno.listarBaralhos()).toContainEqual(
      expect.objectContaining({ id: baralhoDeBruno.id, nome: "Alemão" }),
    );

    /** E a recusa é a de sempre: `nao_encontrado`, com a mensagem de sempre. */
    expect(edicaoDeInexistente).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });
  });

  it("cada Cartão pertence a exatamente um Baralho e é contado no seu dono (FR-389)", async () => {
    const cartaoDaAna = await criarCartao(ana, baralhoDeAna, "To walk", "Caminhar");
    const cartaoDoBruno = await criarCartao(bruno, baralhoDeBruno, "To read", "Ler");

    expect(await ana.listarBaralhos()).toContainEqual(
      expect.objectContaining({
        id: baralhoDeAna.id,
        quantidadeDeCartoes: 1,
        elegivel: true,
      }),
    );
    expect(await bruno.listarBaralhos()).toContainEqual(
      expect.objectContaining({
        id: baralhoDeBruno.id,
        quantidadeDeCartoes: 1,
        elegivel: true,
      }),
    );

    // Ana vê seu Cartão no seu Baralho
    expect(await ana.listarCartoes()).toContainEqual(
      expect.objectContaining({
        id: cartaoDaAna.id,
        baralho: expect.objectContaining({ id: baralhoDeAna.id }),
      }),
    );

    // Bruno vê seu Cartão no seu Baralho
    expect(await bruno.listarCartoes()).toContainEqual(
      expect.objectContaining({
        id: cartaoDoBruno.id,
        baralho: expect.objectContaining({ id: baralhoDeBruno.id }),
      }),
    );

    // Ana não vê o Cartão de Bruno
    expect(await ana.listarCartoes()).not.toContainEqual(
      expect.objectContaining({ id: cartaoDoBruno.id }),
    );
  });

  it("cada Baralho é visível apenas para o seu dono (FR-092)", async () => {
    const outroBaralhoDaAna = await criarBaralho(ana, "Francês");
    const cartao = await criarCartao(ana, baralhoDeAna, "To walk", "Caminhar");
    expect(await ana.listarCartoes()).toContainEqual(
      expect.objectContaining({ id: cartao.id, baralho: expect.objectContaining({ id: baralhoDeAna.id }) }),
    );
    expect(await ana.listarBaralhos()).toContainEqual(
      expect.objectContaining({ id: outroBaralhoDaAna.id }),
    );

    // Ana vê seus Baralhos
    const baralhosDaAna = await ana.obterBaralho(baralhoDeAna.id);
    expect(baralhosDaAna).toMatchObject({ ok: true, baralho: { elegivel: true } });

    // Bruno não vê o Baralho de Ana
    expect(await bruno.obterBaralho(baralhoDeAna.id)).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });

    // Cada um vê apenas seus Baralhos
    expect(await ana.listarBaralhos()).not.toContainEqual(
      expect.objectContaining({ id: baralhoDeBruno.id }),
    );
    expect(await bruno.listarBaralhos()).not.toContainEqual(
      expect.objectContaining({ id: baralhoDeAna.id }),
    );
  });

  it("os dados de uma Sessão de estudo saem das listagens do dono, e só delas (FR-092, SC-028)", async () => {
    const cartaoDaAna = await criarCartao(ana, baralhoDeAna, "To walk", "Caminhar");

    /** É por `obterBaralho` que a Sessão carrega os Cartões de um Baralho. */
    const baralhoComCartoes = await ana.obterBaralho(baralhoDeAna.id);

    expect(baralhoComCartoes).toEqual({
      ok: true,
      baralho: {
        id: baralhoDeAna.id,
        nome: "Inglês",
        elegivel: true,
        cartoes: [
          {
            id: cartaoDaAna.id,
            frente: "To walk",
            verso: "Caminhar",
          },
        ],
        quantidadeDeAgendamentos: 0,
      },
    });

    /** O mesmo Baralho não existe para o outro Usuário. */
    expect(await bruno.obterBaralho(baralhoDeAna.id)).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });

    /** E as listagens do outro dono continuam apenas com seus próprios Baralhos e Cartões. */
    expect(await bruno.listarCartoes()).toEqual([]);
    expect(await bruno.listarBaralhos()).toContainEqual(
      expect.objectContaining({ id: baralhoDeBruno.id }),
    );
  });
});
