import { afterEach, describe, expect, it } from "vitest";

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
 * Domínio da Agenda de estudo pela Interface do `Acervo` (FR-222–FR-226,
 * FR-227–FR-230, FR-237–FR-239, FR-243–FR-247), com armazenamento SQLite real e
 * relógio controlado. A segunda-feira de referência é 2026-10-05.
 */

let mundo: MundoDeAgenda | undefined;

afterEach(async () => {
  await mundo?.encerrar();
  mundo = undefined;
});

async function novoMundo(instante = SEGUNDA): Promise<MundoDeAgenda> {
  mundo = await prepararMundo(instante);
  return mundo;
}

describe("entradas inválidas da Agenda (FR-248, FR-250, FR-254)", () => {
  it("recusa data civil inexistente, domingo e fuso inválido em obterAgenda", async () => {
    const m = await novoMundo();

    expect(await m.acervo.obterAgenda("2026-02-31", FUSO)).toMatchObject({
      ok: false,
      erro: "dados_invalidos",
    });
    expect(await m.acervo.obterAgenda("2026-10-03", FUSO)).toMatchObject({
      ok: false,
      erro: "dados_invalidos",
    });
    expect(
      await m.acervo.obterAgenda("2026-09-28", "Marte/Fobos"),
    ).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });

  it("recusa fuso inválido e operacaoId vazio em salvarRotina", async () => {
    const m = await novoMundo();
    const base = {
      acao: "criar" as const,
      baralhoId: "x",
      dias: [1],
      quantidade: null,
    };

    expect(
      await m.acervo.salvarRotina({ ...base, operacaoId: "a", fuso: "Marte/Fobos" }),
    ).toMatchObject({ ok: false, erro: "dados_invalidos" });
    expect(
      await m.acervo.salvarRotina({ ...base, operacaoId: "", fuso: FUSO }),
    ).toMatchObject({ ok: false, erro: "dados_invalidos" });
    expect(
      await m.acervo.salvarRotina({ ...base, operacaoId: "   ", fuso: FUSO }),
    ).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });

  it("recusa data inexistente e fuso inválido em iniciarCompromisso", async () => {
    const m = await novoMundo();

    expect(
      await m.acervo.iniciarCompromisso({
        rotinaId: "r",
        data: "2026-02-31",
        fuso: FUSO,
      }),
    ).toMatchObject({ ok: false, erro: "dados_invalidos" });
    expect(
      await m.acervo.iniciarCompromisso({
        rotinaId: "r",
        data: "2026-10-05",
        fuso: "Marte/Fobos",
      }),
    ).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });

  it("a composição expõe as quatro operações no Acervo", async () => {
    const m = await novoMundo();

    expect(typeof m.acervo.obterAgenda).toBe("function");
    expect(typeof m.acervo.listarRotinas).toBe("function");
    expect(typeof m.acervo.salvarRotina).toBe("function");
    expect(typeof m.acervo.iniciarCompromisso).toBe("function");
    expect(await m.acervo.listarRotinas()).toEqual({ ok: true, rotinas: [] });
  });
});

describe("US1: programar o estudo (FR-222–FR-226, SC-095)", () => {
  it("cria a Rotina de segunda e quinta com 20 Cartões e a reencontra", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 30);

    const resultado = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "criar",
      baralhoId: ingles.id,
      dias: [4, 1],
      quantidade: 20,
      fuso: FUSO,
    });

    expect(resultado).toMatchObject({
      ok: true,
      criada: true,
      rotina: {
        baralhoId: ingles.id,
        nomeDoBaralho: "Inglês",
        dias: [1, 4],
        quantidade: 20,
        estado: "ativa",
        versao: 1,
        indisponivel: false,
      },
    });

    const lista = await m.acervo.listarRotinas();

    expect(lista).toMatchObject({
      ok: true,
      rotinas: [{ nomeDoBaralho: "Inglês", dias: [1, 4], quantidade: 20 }],
    });
    // Sem vazar o dono nem as versões internas (contrato).
    expect(JSON.stringify(lista)).not.toContain("usuarioId");
    expect(JSON.stringify(lista)).not.toContain("versoes");
  });

  it("gera Compromissos só a partir de hoje, sem obrigação retroativa", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);

    await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [1, 4] });

    const corrente = await semana(m.acervo, "2026-10-05");
    const anterior = await semana(m.acervo, "2026-09-28");

    expect(
      corrente.compromissos.map((c) => [c.data, c.estado]),
    ).toEqual([
      ["2026-10-05", "pendente"],
      ["2026-10-08", "programado"],
    ]);
    expect(anterior.compromissos).toEqual([]);
    expect(corrente.hoje).toBe("2026-10-05");
    expect(corrente.fuso).toBe(FUSO);
    expect(corrente.compromissosDeHoje).toHaveLength(1);
  });

  it("não inclui hoje quando o dia da criação não foi selecionado", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);

    await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [4] });

    const corrente = await semana(m.acervo, "2026-10-05");

    expect(corrente.compromissosDeHoje).toEqual([]);
    expect(corrente.compromissos.map((c) => c.data)).toEqual(["2026-10-08"]);
  });

  it("recusa configuração inválida identificando a causa", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const tentar = (extra: Record<string, unknown>) =>
      m.acervo.salvarRotina({
        operacaoId: operacao(),
        acao: "criar",
        baralhoId: ingles.id,
        dias: [1],
        quantidade: null,
        fuso: FUSO,
        ...extra,
      } as never);

    for (const invalido of [
      { baralhoId: "" },
      { dias: [] },
      { dias: [1, 1] },
      { dias: [0] },
      { dias: [8] },
      { dias: [1.5] },
      { dias: "1" },
      { quantidade: 0 },
      { quantidade: 1000 },
      { quantidade: 1.5 },
      { quantidade: "20" },
      { quantidade: undefined },
    ]) {
      expect(await tentar(invalido)).toMatchObject({
        ok: false,
        erro: "dados_invalidos",
      });
    }

    expect(await tentar({ quantidade: 999 })).toMatchObject({ ok: true });
    expect(
      await tentar({
        quantidade: 1,
        dias: [1, 2, 3, 4, 5, 6, 7],
        confirmarSobreposicao: true,
      }),
    ).toMatchObject({ ok: true });
  });

  it("recusa Baralho vazio e trata Baralho alheio como inexistente (FR-223, FR-248)", async () => {
    const m = await novoMundo();
    const vazio = await m.acervo.criarBaralho({ nome: "Vazio" });
    const outro = await m.outroUsuario();
    const alheio = await m.baralhoComCartoes("Alheio", 3, outro.acervo);

    if (!vazio.ok) {
      throw new Error("Baralho");
    }

    expect(
      await m.acervo.salvarRotina({
        operacaoId: operacao(),
        acao: "criar",
        baralhoId: vazio.baralho.id,
        dias: [1],
        quantidade: null,
        fuso: FUSO,
      }),
    ).toMatchObject({ ok: false, erro: "dados_invalidos" });
    expect(
      await m.acervo.salvarRotina({
        operacaoId: operacao(),
        acao: "criar",
        baralhoId: alheio.id,
        dias: [1],
        quantidade: null,
        fuso: FUSO,
      }),
    ).toMatchObject({ ok: false, erro: "nao_encontrado" });
    expect(await m.acervo.listarRotinas()).toEqual({ ok: true, rotinas: [] });
  });

  it("exige confirmação para Rotinas ativas do mesmo Baralho com dias em comum (FR-226)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const outro = await m.baralhoComCartoes("Francês", 5);

    await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [1, 4] });

    const sobreposta = {
      operacaoId: operacao(),
      acao: "criar" as const,
      baralhoId: ingles.id,
      dias: [1],
      quantidade: 10,
      fuso: FUSO,
    };
    const recusada = await m.acervo.salvarRotina(sobreposta);

    expect(recusada).toMatchObject({ ok: false, erro: "sobreposicao" });
    expect(recusada.ok === false && recusada.mensagem).toContain("segunda");
    expect(await m.acervo.listarRotinas()).toMatchObject({
      rotinas: [{ dias: [1, 4] }],
    });

    // Outro Baralho no mesmo dia não é sobreposição.
    expect(
      await m.acervo.salvarRotina({
        ...sobreposta,
        operacaoId: operacao(),
        baralhoId: outro.id,
      }),
    ).toMatchObject({ ok: true });

    // Falha não consome o operacaoId: confirmar reenvia a mesma intenção.
    const confirmada = await m.acervo.salvarRotina({
      ...sobreposta,
      confirmarSobreposicao: true,
    });

    expect(confirmada).toMatchObject({ ok: true, criada: true });

    const hoje = await semana(m.acervo, "2026-10-05");

    // Dois estudos independentes do mesmo Baralho no mesmo dia.
    expect(
      hoje.compromissosDeHoje.filter((c) => c.baralhoId === ingles.id),
    ).toHaveLength(2);
  });

  it("o reenvio com o mesmo operacaoId devolve a mesma Rotina sem duplicar (FR-249)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const envio = {
      operacaoId: operacao(),
      acao: "criar" as const,
      baralhoId: ingles.id,
      dias: [2],
      quantidade: null,
      fuso: FUSO,
    };

    const primeiro = await m.acervo.salvarRotina(envio);
    const segundo = await m.acervo.salvarRotina(envio);

    expect(primeiro).toMatchObject({ ok: true, criada: true });
    expect(segundo).toMatchObject({ ok: true, criada: false });
    expect(segundo.ok && primeiro.ok && segundo.rotina.id).toBe(
      primeiro.ok && primeiro.rotina.id,
    );

    const lista = await m.acervo.listarRotinas();

    expect(lista.ok && lista.rotinas).toHaveLength(1);

    // Mesmo operacaoId com outra intenção é conflito.
    expect(
      await m.acervo.salvarRotina({ ...envio, dias: [3] }),
    ).toMatchObject({ ok: false, erro: "conflito" });
  });
});

describe("US2: projeção semanal, estados e totais (FR-227–FR-230, SC-096)", () => {
  it("projeta passado, hoje e futuro com as situações da tabela", async () => {
    // A Rotina nasce na segunda anterior e a consulta é feita na quinta.
    const m = await novoMundo("2026-09-28T15:00:00Z");
    const ingles = await m.baralhoComCartoes("Inglês", 5);

    await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [1, 3, 5, 7] });
    m.definirAgora("2026-10-01T15:00:00Z"); // quinta

    const s = await semana(m.acervo, "2026-09-28");

    expect(s.hoje).toBe("2026-10-01");
    expect(s.compromissos.map((c) => [c.data, c.estado])).toEqual([
      ["2026-09-28", "nao_realizado"],
      ["2026-09-30", "nao_realizado"],
      ["2026-10-02", "programado"],
      ["2026-10-04", "programado"],
    ]);
  });

  it("devolve hoje e seus Compromissos mesmo quando a semana consultada é outra", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);

    await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [1] });

    const seguinte = await semana(m.acervo, "2026-10-12");

    expect(seguinte.hoje).toBe("2026-10-05");
    expect(seguinte.compromissosDeHoje).toMatchObject([
      { data: "2026-10-05", estado: "pendente" },
    ]);
    expect(seguinte.compromissos.map((c) => [c.data, c.estado])).toEqual([
      ["2026-10-12", "programado"],
    ]);
  });

  it("ordena os Compromissos do dia pela criação das Rotinas", async () => {
    const m = await novoMundo();
    const a = await m.baralhoComCartoes("Alfa", 2);
    const b = await m.baralhoComCartoes("Beta", 2);

    await criarRotina(m.acervo, { baralhoId: b.id, dias: [1] });
    m.definirAgora("2026-10-05T15:01:00Z");
    await criarRotina(m.acervo, { baralhoId: a.id, dias: [1] });

    const s = await semana(m.acervo, "2026-10-05");

    expect(s.compromissosDeHoje.map((c) => c.nomeDoBaralho)).toEqual([
      "Beta",
      "Alfa",
    ]);
  });

  it("conclusões persistidas prevalecem e contam como concluídas", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });

    await m.armazenamento.gravarCompromisso(m.dono, {
      rotinaId: rotina.id,
      data: "2026-10-05",
      estado: "concluido",
      registroId: "registro-1",
      baralhoId: ingles.id,
      nomeDoBaralho: "Inglês",
      quantidade: null,
    });

    const s = await semana(m.acervo, "2026-10-05");

    expect(s.compromissosDeHoje).toMatchObject([
      { estado: "concluido", registroId: "registro-1" },
    ]);
  });

  it("virada de mês e de ano usa datas civis e a janela de sete dias", async () => {
    const m = await novoMundo("2026-12-30T15:00:00Z");
    const ingles = await m.baralhoComCartoes("Inglês", 5);

    await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    const s = await semana(m.acervo, "2026-12-28");

    expect(s.compromissos.map((c) => c.data)).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});

describe("US5: editar, pausar, retomar e excluir (FR-237–FR-239, SC-098)", () => {
  it("editar preserva identidade e passado; dia removido cancela hoje e dia novo cria", async () => {
    const m = await novoMundo("2026-09-28T15:00:00Z"); // segunda
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
      quantidade: 5,
    });

    m.definirAgora(SEGUNDA); // uma semana depois

    const editada = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "editar",
      id: rotina.id,
      versao: rotina.versao,
      baralhoId: ingles.id,
      dias: [2],
      quantidade: 3,
      fuso: FUSO,
    });

    expect(editada).toMatchObject({
      ok: true,
      criada: false,
      rotina: { id: rotina.id, dias: [2], quantidade: 3, versao: 2 },
    });

    const s = await semana(m.acervo, "2026-10-05");
    const anterior = await semana(m.acervo, "2026-09-28");

    expect(s.compromissos.map((c) => [c.data, c.estado, c.quantidade])).toEqual([
      ["2026-10-05", "cancelado", 5],
      ["2026-10-06", "programado", 3],
    ]);
    // Passado preservado com a configuração da época.
    expect(anterior.compromissos).toMatchObject([
      { data: "2026-09-28", estado: "nao_realizado", quantidade: 5 },
    ]);
  });

  it("editar só a quantidade atualiza a configuração pendente de hoje", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 10);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
      quantidade: 5,
    });

    await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "editar",
      id: rotina.id,
      versao: rotina.versao,
      baralhoId: ingles.id,
      dias: [1],
      quantidade: 8,
      fuso: FUSO,
    });

    const s = await semana(m.acervo, "2026-10-05");

    expect(s.compromissosDeHoje).toMatchObject([
      { estado: "pendente", quantidade: 8 },
    ]);
  });

  it("recusa a edição de versão antiga sem sobrescrever a mudança (FR-249)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const edicao = (dias: number[], versao: number) =>
      m.acervo.salvarRotina({
        operacaoId: operacao(),
        acao: "editar",
        id: rotina.id,
        versao,
        baralhoId: ingles.id,
        dias,
        quantidade: null,
        fuso: FUSO,
      });

    expect(await edicao([2], 1)).toMatchObject({ ok: true });
    expect(await edicao([3], 1)).toMatchObject({ ok: false, erro: "conflito" });

    const lista = await m.acervo.listarRotinas();

    expect(lista).toMatchObject({ rotinas: [{ dias: [2], versao: 2 }] });
  });

  it("pausar cancela hoje e não programa mais; retomar volta a hoje sem recriar a pausa", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1, 3],
    });

    const pausada = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "pausar",
      id: rotina.id,
      versao: rotina.versao,
      fuso: FUSO,
    });

    expect(pausada).toMatchObject({ ok: true, rotina: { estado: "pausada" } });

    const durante = await semana(m.acervo, "2026-10-05");

    expect(durante.compromissos.map((c) => [c.data, c.estado])).toEqual([
      ["2026-10-05", "cancelado"],
    ]);

    // Pausar de novo é recusado: já está pausada.
    expect(
      await m.acervo.salvarRotina({
        operacaoId: operacao(),
        acao: "pausar",
        id: rotina.id,
        versao: pausada.ok ? pausada.rotina.versao : 0,
        fuso: FUSO,
      }),
    ).toMatchObject({ ok: false, erro: "dados_invalidos" });

    // Dias depois, retomar começa nesse dia e não recria a pausa.
    m.definirAgora("2026-10-07T15:00:00Z"); // quarta

    const retomada = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "retomar",
      id: rotina.id,
      versao: pausada.ok ? pausada.rotina.versao : 0,
      fuso: FUSO,
    });

    expect(retomada).toMatchObject({ ok: true, rotina: { estado: "ativa" } });

    const depois = await semana(m.acervo, "2026-10-05");

    expect(depois.compromissos.map((c) => [c.data, c.estado])).toEqual([
      ["2026-10-05", "cancelado"],
      ["2026-10-07", "pendente"],
    ]);
  });

  it("pausar e retomar no mesmo dia reutiliza o Compromisso de hoje", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const pausada = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "pausar",
      id: rotina.id,
      versao: rotina.versao,
      fuso: FUSO,
    });

    if (!pausada.ok) {
      throw new Error("pausar");
    }

    await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "retomar",
      id: rotina.id,
      versao: pausada.rotina.versao,
      fuso: FUSO,
    });

    const s = await semana(m.acervo, "2026-10-05");

    expect(s.compromissosDeHoje).toMatchObject([{ estado: "pendente" }]);
    expect(s.compromissos).toHaveLength(1);
  });

  it("uma conclusão de hoje sobrevive a pausar, retomar e excluir (FR-239, FR-245)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });

    await m.armazenamento.gravarCompromisso(m.dono, {
      rotinaId: rotina.id,
      data: "2026-10-05",
      estado: "concluido",
      registroId: "registro-1",
      baralhoId: ingles.id,
      nomeDoBaralho: "Inglês",
      quantidade: null,
    });

    const pausada = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "pausar",
      id: rotina.id,
      versao: rotina.versao,
      fuso: FUSO,
    });
    const retomada = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "retomar",
      id: rotina.id,
      versao: pausada.ok ? pausada.rotina.versao : 0,
      fuso: FUSO,
    });
    const excluida = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "excluir",
      id: rotina.id,
      versao: retomada.ok ? retomada.rotina.versao : 0,
      fuso: FUSO,
    });

    expect(excluida).toMatchObject({ ok: true });

    const s = await semana(m.acervo, "2026-10-05");

    expect(s.compromissos).toMatchObject([
      { estado: "concluido", registroId: "registro-1" },
    ]);
  });

  it("excluir tira a Rotina da lista, preserva o passado e todo o acervo", async () => {
    const m = await novoMundo("2026-09-28T15:00:00Z");
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });

    m.definirAgora(SEGUNDA);

    const excluida = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "excluir",
      id: rotina.id,
      versao: rotina.versao,
      fuso: FUSO,
    });

    expect(excluida).toMatchObject({ ok: true, rotina: { estado: "excluida" } });
    expect(await m.acervo.listarRotinas()).toEqual({ ok: true, rotinas: [] });

    const s = await semana(m.acervo, "2026-10-05");
    const anterior = await semana(m.acervo, "2026-09-28");

    expect(s.compromissos.map((c) => c.estado)).toEqual(["cancelado"]);
    expect(anterior.compromissos.map((c) => c.estado)).toEqual(["nao_realizado"]);
    expect((await m.acervo.listarBaralhos()).map((b) => b.id)).toContain(ingles.id);
    expect(await m.acervo.listarCartoes()).toHaveLength(5);

    // Excluir de novo ou alterar uma excluída se comporta como inexistente.
    expect(
      await m.acervo.salvarRotina({
        operacaoId: operacao(),
        acao: "pausar",
        id: rotina.id,
        versao: 2,
        fuso: FUSO,
      }),
    ).toMatchObject({ ok: false, erro: "nao_encontrado" });
  });

  it("Rotina de outro Usuário se comporta como inexistente (FR-248)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const rotina = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const outro = await m.outroUsuario();

    expect(
      await outro.acervo.salvarRotina({
        operacaoId: operacao(),
        acao: "excluir",
        id: rotina.id,
        versao: rotina.versao,
        fuso: FUSO,
      }),
    ).toMatchObject({ ok: false, erro: "nao_encontrado" });
    expect(await outro.acervo.listarRotinas()).toEqual({ ok: true, rotinas: [] });
    expect((await semana(outro.acervo, "2026-10-05")).compromissos).toEqual([]);
    expect(
      await outro.acervo.iniciarCompromisso({
        rotinaId: rotina.id,
        data: "2026-10-05",
        fuso: FUSO,
      }),
    ).toMatchObject({ ok: false, erro: "nao_encontrado" });
  });

  it("ações que precisam de id e versão recusam entrada incompleta", async () => {
    const m = await novoMundo();

    for (const dados of [
      { acao: "pausar" as const },
      { acao: "excluir" as const, id: "x" },
      { acao: "retomar" as const, id: "x", versao: 0 },
      { acao: "voar" as never },
    ]) {
      expect(
        await m.acervo.salvarRotina({ operacaoId: operacao(), fuso: FUSO, ...dados }),
      ).toMatchObject({ ok: false, erro: "dados_invalidos" });
    }
  });

  it("retomar com dias em comum de Rotina ativa do mesmo Baralho exige confirmação (FR-226)", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 5);
    const primeira = await criarRotina(m.acervo, {
      baralhoId: ingles.id,
      dias: [1],
    });
    const pausada = await m.acervo.salvarRotina({
      operacaoId: operacao(),
      acao: "pausar",
      id: primeira.id,
      versao: primeira.versao,
      fuso: FUSO,
    });

    await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [1] });

    const retomada = (confirmar: boolean) =>
      m.acervo.salvarRotina({
        operacaoId: operacao(),
        acao: "retomar",
        id: primeira.id,
        versao: pausada.ok ? pausada.rotina.versao : 0,
        confirmarSobreposicao: confirmar,
        fuso: FUSO,
      });

    expect(await retomada(false)).toMatchObject({
      ok: false,
      erro: "sobreposicao",
    });
    expect(await retomada(true)).toMatchObject({ ok: true });
  });
});

describe("US6: indisponibilidade, nomes e datas (FR-243–FR-247, SC-099)", () => {
  it("Baralho esvaziado ou excluído deixa o Compromisso indisponível, sem concluí-lo nem cancelá-lo", async () => {
    const m = await novoMundo();
    const ingles = await m.baralhoComCartoes("Inglês", 2);
    const frances = await m.baralhoComCartoes("Francês", 2);

    await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [1] });
    m.definirAgora("2026-10-05T15:01:00Z");
    await criarRotina(m.acervo, { baralhoId: frances.id, dias: [1] });

    for (const cartaoId of ingles.cartaoIds) {
      await m.acervo.desvincular(cartaoId, ingles.id);
    }

    await m.acervo.excluirBaralho(frances.id);

    const s = await semana(m.acervo, "2026-10-05");

    expect(
      s.compromissosDeHoje.map((c) => [c.nomeDoBaralho, c.estado, c.indisponivel]),
    ).toEqual([
      ["Inglês", "pendente", true],
      ["Francês", "pendente", true],
    ]);

    const lista = await m.acervo.listarRotinas();

    expect(lista.ok && lista.rotinas.map((r) => r.indisponivel)).toEqual([
      true,
      true,
    ]);

    // Baralho recriado com o mesmo nome não substitui o excluído (FR-243).
    await m.baralhoComCartoes("Francês", 3);

    const depois = await semana(m.acervo, "2026-10-05");

    expect(
      depois.compromissosDeHoje.find((c) => c.nomeDoBaralho === "Francês")
        ?.indisponivel,
    ).toBe(true);
  });

  it("renomear o Baralho muda o nome de hoje e do futuro, mas não do passado", async () => {
    const m = await novoMundo("2026-09-28T15:00:00Z");
    const ingles = await m.baralhoComCartoes("Inglês", 2);

    await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [1] });
    m.definirAgora(SEGUNDA);
    await m.acervo.renomearBaralho(ingles.id, { nome: "English" });

    const atual = await semana(m.acervo, "2026-10-05");
    const passada = await semana(m.acervo, "2026-09-28");

    expect(atual.compromissos[0].nomeDoBaralho).toBe("English");
    expect(passada.compromissos[0].nomeDoBaralho).toBe("Inglês");
  });

  it("trocar o fuso não duplica nem desloca Compromissos associados a datas (FR-246, FR-247)", async () => {
    // 2026-10-06T02:30Z é segunda 23h30 em São Paulo e terça 11h30 em Tóquio.
    const m = await novoMundo("2026-10-06T02:30:00Z");
    const ingles = await m.baralhoComCartoes("Inglês", 2);

    await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [1, 2] });

    const sp = await m.acervo.obterAgenda("2026-10-05", "America/Sao_Paulo");
    const toquio = await m.acervo.obterAgenda("2026-10-05", "Asia/Tokyo");

    expect(sp.ok && sp.agenda.hoje).toBe("2026-10-05");
    expect(toquio.ok && toquio.agenda.hoje).toBe("2026-10-06");

    if (!sp.ok || !toquio.ok) {
      throw new Error("agenda");
    }

    // A segunda não migrou: continua um único Compromisso por data.
    expect(sp.agenda.compromissos.map((c) => c.data)).toEqual([
      "2026-10-05",
      "2026-10-06",
    ]);
    expect(toquio.agenda.compromissos.map((c) => [c.data, c.estado])).toEqual([
      ["2026-10-05", "nao_realizado"],
      ["2026-10-06", "pendente"],
    ]);
  });

  it("não há Compromissos antes da criação nem acúmulo de pendências", async () => {
    const m = await novoMundo("2026-09-28T15:00:00Z");
    const ingles = await m.baralhoComCartoes("Inglês", 2);

    await criarRotina(m.acervo, { baralhoId: ingles.id, dias: [1] });
    m.definirAgora("2026-10-12T15:00:00Z");

    const s = await semana(m.acervo, "2026-10-12");

    // Hoje tem um Compromisso; as segundas anteriores não migraram para cá.
    expect(s.compromissosDeHoje).toHaveLength(1);
    expect((await semana(m.acervo, "2026-09-21")).compromissos).toEqual([]);
  });
});
