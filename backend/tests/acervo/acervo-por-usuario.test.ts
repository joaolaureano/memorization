import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarAcervo, type Acervo } from "../../src/acervo/acervo.ts";
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
});

afterEach(async () => {
  await aberto.encerrar();
});

/** Cria um Cartão pela Interface, falhando se a criação for recusada. */
async function criarCartao(acervo: Acervo, frente: string, verso: string) {
  const resultado = await acervo.criarCartao({ frente, verso });

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
    await criarCartao(ana, "To walk", "Caminhar");
    await criarBaralho(ana, "Inglês");
    await criarCartao(bruno, "To read", "Ler");
    await criarBaralho(bruno, "Alemão");

    expect(await ana.listarCartoes()).toEqual([
      expect.objectContaining({ frente: "To walk", verso: "Caminhar" }),
    ]);
    expect(await bruno.listarCartoes()).toEqual([
      expect.objectContaining({ frente: "To read", verso: "Ler" }),
    ]);
    expect(await ana.listarBaralhos()).toEqual([
      expect.objectContaining({ nome: "Inglês", quantidadeDeCartoes: 0 }),
    ]);
    expect(await bruno.listarBaralhos()).toEqual([
      expect.objectContaining({ nome: "Alemão", quantidadeDeCartoes: 0 }),
    ]);
  });

  it("edita e exclui somente o próprio conteúdo, e o do outro permanece intacto", async () => {
    const cartaoDaAna = await criarCartao(ana, "To walk", "Caminhar");
    const baralhoDoBruno = await criarBaralho(bruno, "Alemão");

    expect(
      await ana.editarCartao(cartaoDaAna.id, {
        frente: "To stroll",
        verso: "Passear",
      }),
    ).toMatchObject({ ok: true, cartao: { frente: "To stroll" } });

    expect(await ana.excluirCartao(cartaoDaAna.id)).toEqual({ ok: true });

    /** O outro Usuário continua com o seu, como estava. */
    expect(await bruno.listarBaralhos()).toEqual([
      expect.objectContaining({ id: baralhoDoBruno.id, nome: "Alemão" }),
    ]);
  });

  it("o id do outro Usuário responde como um id que nunca existiu, jamais 403 (SC-030)", async () => {
    const cartaoDoBruno = await criarCartao(bruno, "To read", "Ler");
    const baralhoDoBruno = await criarBaralho(bruno, "Alemão");

    const cartaoInexistente = await ana.obterBaralho("cartao-que-nunca-existiu");
    const edicaoDeInexistente = await ana.editarCartao("outro-que-nunca-existiu", {
      frente: "To walk",
      verso: "Caminhar",
    });
    const exclusaoDeInexistente = await ana.excluirCartao("id-desconhecido");

    expect(await ana.editarCartao(cartaoDoBruno.id, {
      frente: "To drink",
      verso: "Beber",
    })).toEqual(edicaoDeInexistente);
    expect(await ana.excluirCartao(cartaoDoBruno.id)).toEqual(
      exclusaoDeInexistente,
    );
    expect(await ana.obterBaralho(baralhoDoBruno.id)).toEqual(
      cartaoInexistente,
    );

    /** O conteúdo do outro Usuário não mudou com as tentativas. */
    expect(await bruno.listarCartoes()).toEqual([
      expect.objectContaining({ id: cartaoDoBruno.id, frente: "To read" }),
    ]);
    expect(await bruno.listarBaralhos()).toEqual([
      expect.objectContaining({ id: baralhoDoBruno.id, nome: "Alemão" }),
    ]);

    /** E a recusa é a de sempre: `nao_encontrado`, com a mensagem de sempre. */
    expect(edicaoDeInexistente).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });
  });

  it("recusa vincular um Cartão de um Usuário a um Baralho de outro, e nada muda (FR-093)", async () => {
    const cartaoDaAna = await criarCartao(ana, "To walk", "Caminhar");
    const baralhoDoBruno = await criarBaralho(bruno, "Alemão");

    expect(await ana.vincular(cartaoDaAna.id, baralhoDoBruno.id)).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
    expect(await bruno.vincular(cartaoDaAna.id, baralhoDoBruno.id)).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Cartão não encontrado.",
    });

    /** Nenhum Vínculo foi criado de nenhum dos lados. */
    expect(await ana.listarCartoes()).toEqual([
      expect.objectContaining({ id: cartaoDaAna.id, baralhos: [] }),
    ]);
    expect(await bruno.listarBaralhos()).toEqual([
      expect.objectContaining({
        id: baralhoDoBruno.id,
        quantidadeDeCartoes: 0,
        elegivel: false,
      }),
    ]);
  });

  it("conta e deriva a elegibilidade somente dos Vínculos do dono (FR-092)", async () => {
    const cartaoDaAna = await criarCartao(ana, "To walk", "Caminhar");
    const baralhoDaAna = await criarBaralho(ana, "Inglês");
    const cartaoDoBruno = await criarCartao(bruno, "To read", "Ler");
    const baralhoDoBruno = await criarBaralho(bruno, "Alemão");

    expect(await ana.vincular(cartaoDaAna.id, baralhoDaAna.id)).toEqual({
      ok: true,
    });
    expect(await bruno.vincular(cartaoDoBruno.id, baralhoDoBruno.id)).toEqual({
      ok: true,
    });

    expect(await ana.listarBaralhos()).toEqual([
      expect.objectContaining({
        id: baralhoDaAna.id,
        quantidadeDeCartoes: 1,
        elegivel: true,
      }),
    ]);
    expect(await bruno.listarBaralhos()).toEqual([
      expect.objectContaining({
        id: baralhoDoBruno.id,
        quantidadeDeCartoes: 1,
        elegivel: true,
      }),
    ]);

    /** O Baralho do outro nunca aparece na leitura de quem não o possui. */
    const doBruno = await bruno.obterBaralho(baralhoDoBruno.id);

    expect(doBruno).toMatchObject({ ok: true, baralho: { elegivel: true } });
    expect(await bruno.obterBaralho(baralhoDaAna.id)).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });
  });

  it("desvincula somente o próprio Vínculo: o do outro Usuário é nao_encontrado", async () => {
    const cartaoDoBruno = await criarCartao(bruno, "To read", "Ler");
    const baralhoDoBruno = await criarBaralho(bruno, "Alemão");

    await bruno.vincular(cartaoDoBruno.id, baralhoDoBruno.id);

    expect(await ana.desvincular(cartaoDoBruno.id, baralhoDoBruno.id)).toEqual({
      ok: false,
      erro: "vinculo_nao_encontrado",
      mensagem: "O vínculo não existe.",
    });
    expect(await bruno.obterBaralho(baralhoDoBruno.id)).toMatchObject({
      ok: true,
      baralho: { elegivel: true },
    });
  });

  it("os dados de uma Sessão de estudo saem das listagens do dono, e só delas (FR-092, SC-028)", async () => {
    const cartaoDaAna = await criarCartao(ana, "To walk", "Caminhar");
    const baralhoDaAna = await criarBaralho(ana, "Inglês");

    await ana.vincular(cartaoDaAna.id, baralhoDaAna.id);

    /** É por `obterBaralho` que a Sessão carrega os Cartões de um Baralho. */
    const elegivelDaAna = await ana.obterBaralho(baralhoDaAna.id);

    expect(elegivelDaAna).toEqual({
      ok: true,
      baralho: {
        id: baralhoDaAna.id,
        nome: "Inglês",
        elegivel: true,
        cartoes: [
          {
            id: cartaoDaAna.id,
            frente: "To walk",
            verso: "Caminhar",
          },
        ],
      },
    });

    /** O mesmo Baralho não existe para o outro Usuário. */
    expect(await bruno.obterBaralho(baralhoDaAna.id)).toEqual({
      ok: false,
      erro: "nao_encontrado",
      mensagem: "Baralho não encontrado.",
    });

    /** E as listagens do outro dono continuam vazias. */
    expect(await bruno.listarCartoes()).toEqual([]);
    expect(await bruno.listarBaralhos()).toEqual([]);
  });
});
