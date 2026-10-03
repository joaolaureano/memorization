import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import type { Acervo } from "../../src/acervo/acervo.ts";
import type { Avaliacao } from "../../src/repeticao/algoritmo.ts";
import {
  ALGORITMOS,
} from "../../src/repeticao/algoritmo.ts";
import type { InicioDeCompromisso } from "../../src/agenda/agenda.ts";
import {
  FUSO,
  SEGUNDA,
  criarRotina,
  operacao,
  prepararMundo,
  semana,
} from "./apoio-de-agenda.ts";
import type { MundoDeAgenda } from "./apoio-de-agenda.ts";

/**
 * Início autorizado e conclusão atômica do Compromisso (FR-231–FR-236, FR-245,
 * FR-247, FR-254, FR-256, SC-097, SC-104). Armazenamento SQLite real.
 */

let mundo: MundoDeAgenda | undefined;

afterEach(async () => {
  await mundo?.encerrar();
  mundo = undefined;
});

async function novoMundo(
  instante = SEGUNDA,
  opcoes: Parameters<typeof prepararMundo>[1] = {},
): Promise<MundoDeAgenda> {
  mundo = await prepararMundo(instante, opcoes);
  return mundo;
}

/** Inicia o Compromisso de hoje e falha o teste se for recusado. */
async function iniciar(
  acervo: Acervo,
  rotinaId: string,
  data = "2026-10-05",
): Promise<InicioDeCompromisso> {
  const resultado = await acervo.iniciarCompromisso({
    rotinaId,
    data,
    fuso: FUSO,
  });

  if (!resultado.ok) {
    throw new Error(`início recusado: ${resultado.mensagem}`);
  }

  return resultado.inicio;
}

/** O corpo de conclusão de `inicio`, avaliando todos os Cartões. */
function conclusao(
  inicio: InicioDeCompromisso,
  avaliacao: Avaliacao = "bom",
  extra: Record<string, unknown> = {},
) {
  return {
    id: inicio.id,
    origem: "baralho",
    baralhoId: inicio.baralhoId,
    nomeDoBaralho: inicio.nomeDoBaralho,
    inicioAgendaId: inicio.id,
    itens: inicio.cartoes.map((cartao) => ({
      cartaoId: cartao.id,
      frente: cartao.frente,
      verso: cartao.verso,
      avaliacao: avaliacao,
    })),
    ...extra,
  };
}

describe("iniciarCompromisso: autorização e snapshot (FR-231, FR-232, FR-254)", () => {
  it("seleciona no servidor 20 Cartões distintos de um Baralho de 30", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 30);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
      quantidade: 20,
    });

    const inicio = await iniciar(m.acervo, rotina.id);

    expect(inicio).toMatchObject({
      rotinaId: rotina.id,
      data: "2026-10-05",
      baralhoId: ingles.id,
      nomeDoBaralho: "Inglês",
      quantidadeSolicitada: 20,
    });
    expect(inicio.cartoes).toHaveLength(20);
    expect(new Set(inicio.cartoes.map((c) => c.id)).size).toBe(20);
    expect(
      inicio.cartoes.every((c) => ingles.cartaoIds.includes(c.id)),
    ).toBe(true);

    // O snapshot fica guardado, com dono e Cartões capturados.
    const guardado = await m.armazenamento.obterInicio(m.dono, inicio.id);

    expect(guardado).toMatchObject({
      ok: true,
      valor: { id: inicio.id, rotinaId: rotina.id, fuso: FUSO, quantidade: 20 },
    });
  });

  it("usa o disponível quando a quantidade é maior; Todos usa tudo", async () => {
    const m = await novoMundo();
    const pequeno = await m.baralhoComCartoes("Pequeno", 8);
    const todos = await m.baralhoComCartoes("Todos", 12);
    const a = await criarRotina(m.acervo, {
      baralhoId: pequeno.id,
      dias: [1],
      quantidade: 20,
    });
    const b = await criarRotina(m.acervo, {
      baralhoId: todos.id,
      dias: [1],
      quantidade: null,
    });

    expect((await iniciar(m.acervo, a.id)).cartoes).toHaveLength(8);

    const inicioTodos = await iniciar(m.acervo, b.id);

    expect(inicioTodos.cartoes).toHaveLength(12);
    expect(inicioTodos.quantidadeSolicitada).toBeNull();
  });

  it("só o Compromisso pendente de hoje pode ser iniciado (FR-231, FR-247)", async () => {
    const m = await novoMundo("2026-09-28T15:00:00Z");
    const ingles = await m.baralhoComCartoes("Inglês", 3);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1, 4],
    });

    m.definirAgora(SEGUNDA);

    const tentar = (data: string) =>
      m.acervo.iniciarCompromisso({ rotinaId: rotina.id, data, fuso: FUSO });

    // Passado, futuro e dia sem programação.
    for (const data of ["2026-09-28", "2026-10-08", "2026-10-06"]) {
      expect(await tentar(data)).toMatchObject({
        ok: false,
        erro: "dados_invalidos",
      });
    }

    // Hoje, sim.
    expect(await tentar("2026-10-05")).toMatchObject({ ok: true });
  });

  it("Rotina que não programa hoje, cancelada ou de outro dono não inicia", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 3);
    const quinta = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [4],
    });
    const segunda = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
      confirmarSobreposicao: true,
    });

    expect(
      await m.acervo.iniciarCompromisso({
        rotinaId: quinta.id,
        data: "2026-10-05",
        fuso: FUSO,
      }),
    ).toMatchObject({ ok: false, erro: "nao_encontrado" });

    await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "pausar",
      id: segunda.id,
      versao: segunda.versao,
      fuso: FUSO,
    });

    expect(
      await m.acervo.iniciarCompromisso({
        rotinaId: segunda.id,
        data: "2026-10-05",
        fuso: FUSO,
      }),
    ).toMatchObject({ ok: false, erro: "nao_encontrado" });
  });

  it("Baralho excluído ou vazio impede o início com a causa (FR-243)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 1);
    const frances = await m.baralhoComCartoes("Francês", 1);
    const a = await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [1] });
    const b = await criarRotina(m.acervo, { baralhoId: frances.id, dias: [1] });

    await m.acervo.desvincular(ingles.cartaoIds[0], ingles.id);
    await m.acervo.excluirBaralho(frances.id);

    for (const rotina of [a, b]) {
      const recusado = await m.acervo.iniciarCompromisso({
        rotinaId: rotina.id,
        data: "2026-10-05",
        fuso: FUSO,
      });

      expect(recusado).toMatchObject({ ok: false, erro: "conflito" });
    }

    // Nada foi concluído nem cancelado.
    const s = await semana(m.acervo, "2026-10-05");

    expect(s.compromissosDeHoje.map((c) => c.estado)).toEqual([
      "pendente",
      "pendente",
    ]);
  });

  it("a autorização pode ser repetida, cada uma com o seu id", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 3);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const primeiro = await iniciar(m.acervo, rotina.id);
    const segundo = await iniciar(m.acervo, rotina.id);

    expect(primeiro.id).not.toBe(segundo.id);
  });
});

describe("registrarSessao com inicioAgendaId: conclusão atômica (FR-233–FR-236, FR-256)", () => {
  it("grava Registro, Agendamentos e conclusão juntos e a Agenda passa a contar uma conclusão", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 6);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
      quantidade: 4,
    });
    const inicio = await iniciar(m.acervo, rotina.id);

    const resultado = await m.acervo.registrarSessao(conclusao(inicio));

    expect(resultado).toMatchObject({
      ok: true,
      registro: {
        id: inicio.id,
        baralhoId: ingles.id,
        nomeDoBaralho: "Inglês",
        origem: "baralho",
        estudados: 4,
        acertos: 4,
        erros: 0,
      },
    });

    const s = await semana(m.acervo, "2026-10-05");

    expect(s.compromissosDeHoje).toMatchObject([
      { estado: "concluido", registroId: inicio.id },
    ]);

    const agendamentos = await m.armazenamento.listarAgendamentos(m.dono);

    expect(agendamentos.map((a) => a.cartaoId).sort()).toEqual(
      inicio.cartoes.map((c) => c.id).sort(),
    );

    const lido = await m.acervo.obterRegistroDeSessao(inicio.id);

    expect(lido).toMatchObject({ ok: true, registro: { estudados: 4 } });
  });

  it("qualquer distribuição de Avaliações satisfaz o Compromisso, inclusive tudo Errei", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 3);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const inicio = await iniciar(m.acervo, rotina.id);

    expect(
      await m.acervo.registrarSessao(conclusao(inicio, "errei")),
    ).toMatchObject({ ok: true, registro: { erros: 3, acertos: 0 } });
    expect(
      (await semana(m.acervo, "2026-10-05")).compromissosDeHoje[0].estado,
    ).toBe("concluido");
  });

  it("o reenvio devolve o mesmo Registro sem duplicar nem reaplicar os Agendamentos (FR-235, SC-097)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 3);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const inicio = await iniciar(m.acervo, rotina.id);

    const primeiro = await m.acervo.registrarSessao(conclusao(inicio, "facil"));
    const antes = await m.armazenamento.listarAgendamentos(m.dono);
    const segundo = await m.acervo.registrarSessao(conclusao(inicio, "errei"));
    const depois = await m.armazenamento.listarAgendamentos(m.dono);

    expect(primeiro.ok && segundo.ok && segundo.registro).toEqual(
      primeiro.ok && primeiro.registro,
    );
    expect(depois).toEqual(antes);
    expect(
      (await m.armazenamento.listarRegistrosRecentes(m.dono, 10)).length,
    ).toBe(1);
  });

  it("recusa o que não corresponde ao início autorizado (FR-254)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const outro = await m.baralhoComCartoes("Francês", 2);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
      quantidade: 3,
    });
    const inicio = await iniciar(m.acervo, rotina.id);
    const itens = conclusao(inicio).itens;

    const casos: Array<[string, Record<string, unknown>]> = [
      ["id diferente do início", { id: randomUUID() }],
      ["início desconhecido", { id: randomUUID(), inicioAgendaId: randomUUID() }],
      ["origem de revisão", { origem: "revisao" }],
      ["Baralho de outra origem", { baralhoId: outro.id }],
      ["Item a menos", { itens: itens.slice(1) }],
      ["Item a mais", { itens: [...itens, { ...itens[0], cartaoId: "x" }] }],
      ["Cartão repetido", { itens: [itens[0], itens[0], itens[1]] }],
      [
        "Cartão fora do conjunto",
        { itens: [{ ...itens[0], cartaoId: outro.cartaoIds[0] }, itens[1], itens[2]] },
      ],
      ["Avaliação inválida", { itens: [{ ...itens[0], avaliacao: "otimo" }, itens[1], itens[2]] }],
      ["itens que não são lista", { itens: "tudo" }],
    ];

    for (const [, extra] of casos) {
      expect(await m.acervo.registrarSessao(conclusao(inicio, "bom", extra))).toEqual(
        { ok: false, erro: "dados_invalidos" },
      );
    }

    // Nada foi gravado: o Compromisso segue pendente e não há Registro.
    expect(
      (await semana(m.acervo, "2026-10-05")).compromissosDeHoje[0].estado,
    ).toBe("pendente");
    expect(await m.armazenamento.listarRegistrosRecentes(m.dono, 10)).toEqual([]);
    expect(await m.armazenamento.listarAgendamentos(m.dono)).toEqual([]);
  });

  it("deriva Frente e Verso do snapshot do servidor, ignorando o texto do cliente", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 2);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const inicio = await iniciar(m.acervo, rotina.id);
    const adulterado = conclusao(inicio);

    adulterado.itens = adulterado.itens.map((item) => ({
      ...item,
      frente: "texto forjado",
      verso: "outro texto",
    }));

    const resultado = await m.acervo.registrarSessao(
      conclusao(inicio, "bom", { itens: adulterado.itens, nomeDoBaralho: "Forjado" }),
    );

    expect(resultado.ok).toBe(true);

    if (resultado.ok) {
      expect(resultado.registro.nomeDoBaralho).toBe("Inglês");
      expect(resultado.registro.itens.map((i) => i.frente)).toEqual(
        inicio.cartoes.map((c) => c.frente),
      );
    }
  });

  it("início de outro Usuário é recusado como inexistente (FR-248)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 2);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const inicio = await iniciar(m.acervo, rotina.id);
    const outro = await m.outroUsuario();

    expect(await outro.acervo.registrarSessao(conclusao(inicio))).toEqual({
      ok: false,
      erro: "dados_invalidos",
    });
    expect(
      (await semana(m.acervo, "2026-10-05")).compromissosDeHoje[0].estado,
    ).toBe("pendente");
  });

  it("duas Sessões do mesmo Compromisso geram dois Registros e uma só conclusão, do primeiro (FR-235)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 3);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const a = await iniciar(m.acervo, rotina.id);
    const b = await iniciar(m.acervo, rotina.id);

    const [ra, rb] = await Promise.all([
      m.acervo.registrarSessao(conclusao(a)),
      m.acervo.registrarSessao(conclusao(b, "facil")),
    ]);

    expect(ra.ok && rb.ok).toBe(true);
    expect(
      (await m.armazenamento.listarRegistrosRecentes(m.dono, 10)).length,
    ).toBe(2);

    const compromisso = (await semana(m.acervo, "2026-10-05"))
      .compromissosDeHoje;

    expect(compromisso).toHaveLength(1);
    expect(compromisso[0].estado).toBe("concluido");
    expect([a.id, b.id]).toContain(compromisso[0].registroId);

    // Um terceiro Registro não substitui o vínculo.
    const vinculo = compromisso[0].registroId;
    const c = await iniciar(m.acervo, rotina.id).catch(() => null);

    expect(c).toBeNull(); // concluído não inicia de novo
    expect((await semana(m.acervo, "2026-10-05")).compromissosDeHoje[0].registroId).toBe(
      vinculo,
    );
  });

  it("conclui só o Compromisso escolhido quando há duas Rotinas do mesmo Baralho (FR-226, FR-236)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 3);
    const primeira = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });

    m.definirAgora("2026-10-05T15:01:00Z");

    const segunda = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
      confirmarSobreposicao: true,
    });
    const inicio = await iniciar(m.acervo, segunda.id);

    await m.acervo.registrarSessao(conclusao(inicio));

    const hoje = (await semana(m.acervo, "2026-10-05")).compromissosDeHoje;

    expect(hoje.map((c) => [c.rotinaId, c.estado])).toEqual([
      [primeira.id, "pendente"],
      [segunda.id, "concluido"],
    ]);
  });

  it("estudo livre e Revisão do dia não concluem Compromisso algum (FR-236)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 3);

    await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [1] });

    const livre = await m.acervo.registrarSessao({
      id: randomUUID(),
      origem: "baralho",
      baralhoId: ingles.id,
      nomeDoBaralho: "Inglês",
      itens: ingles.cartaoIds.map((cartaoId) => ({
        cartaoId,
        frente: "f",
        verso: "v",
        avaliacao: "bom",
      })),
    });

    expect(livre.ok).toBe(true);
    expect(
      (await semana(m.acervo, "2026-10-05")).compromissosDeHoje[0].estado,
    ).toBe("pendente");
  });

  it("alterar, pausar ou excluir a Rotina depois do início ainda permite concluir o Compromisso capturado (FR-245)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 4);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
      quantidade: 4,
    });
    const inicio = await iniciar(m.acervo, rotina.id);

    // Em "outra aba": a Rotina é editada (dia removido cancela hoje) e depois excluída.
    const editada = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "editar",
      id: rotina.id,
      versao: rotina.versao,
      baralhoId: ingles.id,
      dias: [2],
      quantidade: 1,
      fuso: FUSO,
    });

    expect(
      (await semana(m.acervo, "2026-10-05")).compromissosDeHoje[0].estado,
    ).toBe("cancelado");

    await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "excluir",
      id: rotina.id,
      versao: editada.ok ? editada.rotina.versao : 0,
      fuso: FUSO,
    });

    expect(await m.acervo.registrarSessao(conclusao(inicio))).toMatchObject({
      ok: true,
    });

    // Cancelado vira concluído, com a configuração estudada.
    expect((await semana(m.acervo, "2026-10-05")).compromissosDeHoje).toMatchObject([
      { estado: "concluido", quantidade: 4, registroId: inicio.id },
    ]);
  });

  it("a data do Compromisso não muda quando a Sessão termina após a meia-noite (FR-247)", async () => {
    const m = await novoMundo("2026-10-06T01:58:00Z"); // segunda 22h58 em São Paulo
    const ingles = await m.baralhoComCartoes("Inglês", 2);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1, 2],
    });
    const inicio = await iniciar(m.acervo, rotina.id, "2026-10-05");

    m.definirAgora("2026-10-06T03:05:00Z"); // 00h05 de terça em São Paulo

    const resultado = await m.acervo.registrarSessao(conclusao(inicio));
    const s = await semana(m.acervo, "2026-10-05");

    expect(resultado).toMatchObject({ ok: true });
    expect(s.hoje).toBe("2026-10-06");
    // A segunda foi concluída; a terça (hoje) segue pendente e independente.
    expect(s.compromissos.map((c) => [c.data, c.estado])).toEqual([
      ["2026-10-05", "concluido"],
      ["2026-10-06", "pendente"],
    ]);
  });

  it("Todos os Cartões acima de 1000 Itens é aceito pela Agenda e recusado fora dela (FR-254, plan)", async () => {
    const m = await novoMundo();
    const grande = await m.baralhoComCartoes("Grande", 1001);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: grande.id,
      dias: [1],
    });
    const inicio = await iniciar(m.acervo, rotina.id);

    expect(inicio.cartoes).toHaveLength(1001);

    const livre = await m.acervo.registrarSessao({
      id: randomUUID(),
      origem: "baralho",
      baralhoId: grande.id,
      nomeDoBaralho: "Grande",
      itens: grande.cartaoIds.map((cartaoId) => ({
        cartaoId,
        frente: "f",
        verso: "v",
        avaliacao: "bom",
      })),
    });

    expect(livre).toEqual({ ok: false, erro: "dados_invalidos" });
    expect(await m.acervo.registrarSessao(conclusao(inicio))).toMatchObject({
      ok: true,
      registro: { estudados: 1001 },
    });
  });

  it("uma falha na gravação desfaz tudo: sem Registro, sem Agendamento e sem conclusão (FR-233, FR-235)", async () => {
    const quebrado = new Map(ALGORITMOS);
    const sm2 = ALGORITMOS.get("sm2");

    if (sm2 === undefined) {
      throw new Error("algoritmo sm2 ausente");
    }

    let falhar = false;

    quebrado.set("sm2", {
      ...sm2,
      avaliar(estado, avaliacao, agora) {
        if (falhar) {
          throw new Error("falha simulada na transação");
        }

        return sm2.avaliar(estado, avaliacao, agora);
      },
    });

    const m = await novoMundo(SEGUNDA, { algoritmos: quebrado });
    const ingles = await m.baralhoComCartoes("Inglês", 3);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const inicio = await iniciar(m.acervo, rotina.id);

    falhar = true;

    expect(await m.acervo.registrarSessao(conclusao(inicio))).toEqual({
      ok: false,
      erro: "indisponivel",
    });
    expect(
      (await semana(m.acervo, "2026-10-05")).compromissosDeHoje[0].estado,
    ).toBe("pendente");
    expect(await m.armazenamento.listarRegistrosRecentes(m.dono, 10)).toEqual([]);
    expect(await m.armazenamento.listarAgendamentos(m.dono)).toEqual([]);

    // Nova tentativa com o mesmo id: no máximo um Registro e uma conclusão.
    falhar = false;

    expect(await m.acervo.registrarSessao(conclusao(inicio))).toMatchObject({
      ok: true,
    });
    expect(
      (await m.armazenamento.listarRegistrosRecentes(m.dono, 10)).length,
    ).toBe(1);
  });
});

describe("SC-104: a programação não altera a repetição espaçada (FR-256)", () => {
  it("criar, editar e pausar Rotinas não mexe nos Agendamentos dos Cartões", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 3);
    const livre = await m.acervo.registrarSessao({
      id: randomUUID(),
      origem: "baralho",
      baralhoId: ingles.id,
      nomeDoBaralho: "Inglês",
      itens: ingles.cartaoIds.map((cartaoId) => ({
        cartaoId,
        frente: "f",
        verso: "v",
        avaliacao: "dificil",
      })),
    });

    expect(livre.ok).toBe(true);

    const antes = await m.armazenamento.listarAgendamentos(m.dono);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const editada = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "editar",
      id: rotina.id,
      versao: rotina.versao,
      baralhoId: ingles.id,
      dias: [2, 3],
      quantidade: 2,
      fuso: FUSO,
    });

    await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "pausar",
      id: rotina.id,
      versao: editada.ok ? editada.rotina.versao : 0,
      fuso: FUSO,
    });

    expect(await m.armazenamento.listarAgendamentos(m.dono)).toEqual(antes);
  });

  it("concluir pela Agenda produz os mesmos Agendamentos de um estudo equivalente por Baralho", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 3);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const inicio = await iniciar(m.acervo, rotina.id);

    await m.acervo.registrarSessao(conclusao(inicio, "bom"));

    const pelaAgenda = await m.armazenamento.listarAgendamentos(m.dono);
    const outro = await m.outroUsuario();
    const baralhoDoOutro = await m.baralhoComCartoes("Inglês", 3, outro.acervo);

    // O mesmo estudo equivalente, por Baralho, para outro Usuário.
    await outro.acervo.registrarSessao({
      id: randomUUID(),
      origem: "baralho",
      baralhoId: baralhoDoOutro.id,
      nomeDoBaralho: "Inglês",
      itens: baralhoDoOutro.cartaoIds.map((cartaoId) => ({
        cartaoId,
        frente: "f",
        verso: "v",
        avaliacao: "bom",
      })),
    });

    const porBaralho = await m.armazenamento.listarAgendamentos(outro.id);
    const forma = (lista: typeof pelaAgenda) =>
      lista.map((a) => [a.algoritmo, a.ultimaAvaliacao, a.versaoDoAlgoritmo]);

    expect(forma(pelaAgenda)).toEqual(forma(porBaralho));
    expect(pelaAgenda).toHaveLength(porBaralho.length);
  });
});
