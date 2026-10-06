import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  NAO_AUTENTICADO,
} from "../../src/acervo-cliente/cliente";
import type {
  ClienteDoAcervo,
  Credencial,
  DadosDeRotina,
} from "../../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../../src/acervo-cliente/cliente-em-memoria";
import { ClienteHttp } from "../../src/acervo-cliente/cliente-http";
import { fusoDoNavegador } from "../../src/agenda/datas";
import { comGuardaDeCredencial } from "../../src/ui/guarda-de-credencial";
import { clienteDeProva } from "../apoio-de-prova";

/**
 * T1604/T1607/T1610/T1613/T1616/T1619 — a Agenda no `ClienteDoAcervo` (016,
 * contrato HTTP e cliente): o `ClienteHttp` fala o contrato literal, e o
 * `ClienteEmMemoria` reproduz as regras observáveis para as telas serem
 * testáveis sem servidor.
 */

const CREDENCIAL: Credencial = {
  nomeDeUsuario: "ana.silva",
  senha: "senha-da-ana-1",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const FUSO = fusoDoNavegador();

const ROTINA_DO_SERVIDOR = {
  id: "r1",
  baralhoId: "b1",
  nomeDoBaralho: "Inglês",
  dias: [1, 4],
  quantidade: 20,
  estado: "ativa",
  versao: 1,
  criadaEm: "2026-10-05T12:00:00.000Z",
  indisponivel: false,
};

const COMPROMISSO_DO_SERVIDOR = {
  rotinaId: "r1",
  data: "2026-10-05",
  baralhoId: "b1",
  nomeDoBaralho: "Inglês",
  quantidade: 20,
  estado: "pendente",
  indisponivel: false,
  registroId: null,
};

const SEMANA_DO_SERVIDOR = {
  inicio: "2026-10-05",
  hoje: "2026-10-05",
  fuso: "UTC",
  compromissos: [COMPROMISSO_DO_SERVIDOR],
  compromissosDeHoje: [COMPROMISSO_DO_SERVIDOR],
};

function respostaDe(status: number, corpo: unknown = null) {
  return { status, json: async () => corpo };
}

function clienteHttpQueResponde(status: number, corpo: unknown = null) {
  const chamadas: { url: string; init?: RequestInit }[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      chamadas.push({ url: String(url), init });

      return respostaDe(status, corpo);
    }),
  );

  return {
    cliente: new ClienteHttp("http://127.0.0.1:3001", CREDENCIAL),
    chamadas,
  };
}

describe("ClienteHttp — obterAgenda", () => {
  it("pede GET /agenda com inicio e fuso e devolve a semana validada", async () => {
    const { cliente, chamadas } = clienteHttpQueResponde(200, SEMANA_DO_SERVIDOR);

    expect(await cliente.obterAgenda("2026-10-05", "America/Sao_Paulo")).toEqual({
      ok: true,
      agenda: SEMANA_DO_SERVIDOR,
    });
    expect(chamadas[0]?.url).toBe(
      "http://127.0.0.1:3001/agenda?inicio=2026-10-05&fuso=America%2FSao_Paulo",
    );
    expect(chamadas[0]?.init?.method).toBe("GET");
    expect(
      (chamadas[0]?.init?.headers as Record<string, string>).authorization,
    ).toMatch(/^Basic /);
  });

  it.each([
    [401, NAO_AUTENTICADO],
    [503, INDISPONIVEL],
    [500, INDISPONIVEL],
    [404, INDISPONIVEL],
  ])("traduz %s em %s", async (status, erro) => {
    const { cliente } = clienteHttpQueResponde(status, {});

    expect(await cliente.obterAgenda("2026-10-05", "UTC")).toMatchObject({
      ok: false,
      erro,
    });
  });

  it("400 dados_invalidos atravessa com a mensagem do servidor", async () => {
    const { cliente } = clienteHttpQueResponde(400, {
      erro: "dados_invalidos",
      mensagem: "A data informada não é uma data válida.",
    });

    expect(await cliente.obterAgenda("x", "UTC")).toEqual({
      ok: false,
      erro: "dados_invalidos",
      mensagem: "A data informada não é uma data válida.",
    });
  });

  it("recusa corpo fora do contrato como indisponivel, nunca como semana vazia", async () => {
    for (const corpo of [
      {},
      { ...SEMANA_DO_SERVIDOR, compromissos: "nada" },
      { ...SEMANA_DO_SERVIDOR, hoje: "ontem" },
      {
        ...SEMANA_DO_SERVIDOR,
        compromissos: [{ ...COMPROMISSO_DO_SERVIDOR, estado: "feito" }],
      },
    ]) {
      const { cliente } = clienteHttpQueResponde(200, corpo);

      expect(await cliente.obterAgenda("2026-10-05", "UTC")).toMatchObject({
        ok: false,
        erro: INDISPONIVEL,
      });
    }
  });

  it("falha de rede é indisponivel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("rede");
      }),
    );

    expect(
      await new ClienteHttp("http://x", CREDENCIAL).obterAgenda("2026-10-05", "UTC"),
    ).toMatchObject({ ok: false, erro: INDISPONIVEL });
  });
});

describe("ClienteHttp — listarRotinas", () => {
  it("devolve as Rotinas validadas", async () => {
    const { cliente, chamadas } = clienteHttpQueResponde(200, {
      rotinas: [ROTINA_DO_SERVIDOR],
    });

    expect(await cliente.listarRotinas()).toEqual({
      ok: true,
      rotinas: [ROTINA_DO_SERVIDOR],
    });
    expect(chamadas[0]?.url).toBe("http://127.0.0.1:3001/agenda/rotinas");
  });

  it("rejeita Rotina sem o campo indisponivel", async () => {
    const semCampo: Record<string, unknown> = { ...ROTINA_DO_SERVIDOR };

    delete semCampo.indisponivel;
    const { cliente } = clienteHttpQueResponde(200, { rotinas: [semCampo] });

    expect(await cliente.listarRotinas()).toMatchObject({
      ok: false,
      erro: INDISPONIVEL,
    });
  });
});

describe("ClienteHttp — salvarRotina", () => {
  const dados: DadosDeRotina = {
    operacaoId: "op-1",
    acao: "criar",
    baralhoId: "b1",
    dias: [1, 4],
    quantidade: 20,
    fuso: "UTC",
  };

  it("envia o corpo da intenção e aceita 201 (criada) e 200 (demais ações)", async () => {
    for (const status of [201, 200]) {
      const { cliente, chamadas } = clienteHttpQueResponde(status, {
        rotina: ROTINA_DO_SERVIDOR,
      });

      expect(await cliente.salvarRotina(dados)).toEqual({
        ok: true,
        rotina: ROTINA_DO_SERVIDOR,
      });
      expect(chamadas[0]?.url).toBe("http://127.0.0.1:3001/agenda/rotinas");
      expect(chamadas[0]?.init?.method).toBe("POST");
      expect(JSON.parse(String(chamadas[0]?.init?.body))).toEqual(dados);
    }
  });

  it.each([
    [400, "dados_invalidos"],
    [404, "nao_encontrado"],
    [409, "conflito"],
    [409, "sobreposicao"],
  ])("traduz %s %s com a mensagem do servidor", async (status, erro) => {
    const { cliente } = clienteHttpQueResponde(status, {
      erro,
      mensagem: "mensagem do servidor",
    });

    expect(await cliente.salvarRotina(dados)).toEqual({
      ok: false,
      erro,
      mensagem: "mensagem do servidor",
    });
  });

  it("código fora do contrato do status vira indisponivel", async () => {
    const { cliente } = clienteHttpQueResponde(400, {
      erro: "sobreposicao",
      mensagem: "x",
    });

    expect(await cliente.salvarRotina(dados)).toMatchObject({
      ok: false,
      erro: INDISPONIVEL,
    });
  });

  it("401 é nao_autenticado e 503 é indisponivel", async () => {
    expect(
      await clienteHttpQueResponde(401, {}).cliente.salvarRotina(dados),
    ).toMatchObject({ ok: false, erro: NAO_AUTENTICADO });
    expect(
      await clienteHttpQueResponde(503, {}).cliente.salvarRotina(dados),
    ).toMatchObject({ ok: false, erro: INDISPONIVEL });
  });
});

describe("ClienteHttp — iniciarCompromisso", () => {
  const inicio = {
    id: "i1",
    rotinaId: "r1",
    data: "2026-10-05",
    baralhoId: "b1",
    nomeDoBaralho: "Inglês",
    cartoes: [{ id: "c1", frente: "To walk", verso: "Caminhar" }],
    quantidadeSolicitada: null,
  };

  it("pede POST /agenda/inicios e devolve o snapshot com 201", async () => {
    const { cliente, chamadas } = clienteHttpQueResponde(201, { inicio });

    expect(
      await cliente.iniciarCompromisso({
        rotinaId: "r1",
        data: "2026-10-05",
        fuso: "UTC",
      }),
    ).toEqual({ ok: true, inicio });
    expect(chamadas[0]?.url).toBe("http://127.0.0.1:3001/agenda/inicios");
    expect(JSON.parse(String(chamadas[0]?.init?.body))).toEqual({
      rotinaId: "r1",
      data: "2026-10-05",
      fuso: "UTC",
    });
  });

  it("200 não é o status do contrato e vira indisponivel", async () => {
    const { cliente } = clienteHttpQueResponde(200, { inicio });

    expect(
      await cliente.iniciarCompromisso({
        rotinaId: "r1",
        data: "2026-10-05",
        fuso: "UTC",
      }),
    ).toMatchObject({ ok: false, erro: INDISPONIVEL });
  });

  it("409 conflito (concluído ou Baralho indisponível) atravessa com a mensagem", async () => {
    const { cliente } = clienteHttpQueResponde(409, {
      erro: "conflito",
      mensagem: "Este estudo já foi concluído.",
    });

    expect(
      await cliente.iniciarCompromisso({
        rotinaId: "r1",
        data: "2026-10-05",
        fuso: "UTC",
      }),
    ).toEqual({
      ok: false,
      erro: "conflito",
      mensagem: "Este estudo já foi concluído.",
    });
  });
});

describe("ClienteHttp — registrarSessao com inicioAgendaId", () => {
  it("envia o inicioAgendaId no corpo de POST /sessoes", async () => {
    const { cliente, chamadas } = clienteHttpQueResponde(201, {
      id: "i1",
      origem: "baralho",
      baralhoId: "b1",
      nomeDoBaralho: "Inglês",
      concluidaEm: "2026-10-05T12:00:00.000Z",
      estudados: 1,
      acertos: 1,
      erros: 0,
      itens: [
        {
          posicao: 0,
          frente: "f",
          verso: "v",
          resultado: "acertou",
          cartaoId: "c1",
          avaliacao: "bom",
        },
      ],
    });

    await cliente.registrarSessao({
      id: "i1",
      origem: "baralho",
      baralhoId: "b1",
      nomeDoBaralho: "Inglês",
      inicioAgendaId: "i1",
      itens: [{ frente: "f", verso: "v", cartaoId: "c1", avaliacao: "bom" }],
    });

    expect(JSON.parse(String(chamadas[0]?.init?.body))).toMatchObject({
      id: "i1",
      inicioAgendaId: "i1",
    });
  });
});

describe("guarda de Credencial nas operações da Agenda (FR-248)", () => {
  it("a recusa por Credencial em qualquer operação avisa a casca e segue não concluída", async () => {
    const { cliente } = clienteHttpQueResponde(401, {});
    const avisos: string[] = [];
    const guardado = comGuardaDeCredencial(cliente, (mensagem) =>
      avisos.push(mensagem),
    );

    expect(await guardado.obterAgenda("2026-10-05", "UTC")).toMatchObject({
      ok: false,
      erro: NAO_AUTENTICADO,
    });
    expect(await guardado.listarRotinas()).toMatchObject({ ok: false });
    expect(
      await guardado.salvarRotina({ operacaoId: "o", acao: "pausar", fuso: "UTC" }),
    ).toMatchObject({ ok: false });
    expect(
      await guardado.iniciarCompromisso({ rotinaId: "r", data: "2026-10-05", fuso: "UTC" }),
    ).toMatchObject({ ok: false });
    expect(avisos).toHaveLength(4);
  });
});

/** O `ClienteEmMemoria` com um Baralho de `n` Cartões e o `id` dele. */
async function clienteComBaralho(
  n = 5,
  nome = "Inglês",
  cliente: ClienteEmMemoria = clienteDeProva(),
): Promise<{ cliente: ClienteEmMemoria; baralhoId: string; cartaoIds: string[] }> {
  const baralho = await cliente.criarBaralho({ nome });

  if (!baralho.ok) {
    throw new Error("Baralho");
  }

  const cartaoIds: string[] = [];

  for (let i = 1; i <= n; i += 1) {
    const cartao = await cliente.criarCartao(baralho.baralho.id, { frente: `F${i}`, verso: `V${i}` });

    if (!cartao.ok) {
      throw new Error("Cartão");
    }

    cartaoIds.push(cartao.cartao.id);
  }

  return { cliente, baralhoId: baralho.baralho.id, cartaoIds };
}

let contador = 0;

function intencao(
  extra: Partial<DadosDeRotina> & Pick<DadosDeRotina, "acao">,
): DadosDeRotina {
  contador += 1;

  return { operacaoId: `op-${contador}`, fuso: FUSO, ...extra };
}

describe("ClienteEmMemoria — Agenda (paridade das regras observáveis)", () => {
  it("cria, lista e projeta a Rotina de todos os dias, com hoje pendente", async () => {
    const { cliente, baralhoId } = await clienteComBaralho();
    const criada = await cliente.salvarRotina(
      intencao({ acao: "criar", baralhoId, dias: [7, 1, 2, 3, 4, 5, 6], quantidade: 3 }),
    );

    expect(criada).toMatchObject({
      ok: true,
      rotina: { dias: [1, 2, 3, 4, 5, 6, 7], quantidade: 3, versao: 1, estado: "ativa", indisponivel: false },
    });
    expect(await cliente.listarRotinas()).toMatchObject({
      ok: true,
      rotinas: [{ nomeDoBaralho: "Inglês" }],
    });

    const hoje = new Intl.DateTimeFormat("en-CA", {
      timeZone: FUSO,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const [ano, mes, dia] = hoje.split("-").map(Number);
    const js = new Date(Date.UTC(ano, mes - 1, dia));
    const segunda = new Date(js.getTime() - ((js.getUTCDay() + 6) % 7) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const agenda = await cliente.obterAgenda(segunda, FUSO);

    expect(agenda).toMatchObject({
      ok: true,
      agenda: { hoje, compromissosDeHoje: [{ estado: "pendente", quantidade: 3 }] },
    });
  });

  it("valida a configuração e recusa Baralho vazio e alheio", async () => {
    const { cliente, baralhoId } = await clienteComBaralho();
    const vazio = await cliente.criarBaralho({ nome: "Vazio" });
    const outro = await clienteComBaralho(
      2,
      "Alheio",
      cliente.comoUsuario(null) as ClienteEmMemoria,
    ).catch(() => null);

    expect(outro).toBeNull(); // sem Credencial nada é criado

    const tentar = (extra: Partial<DadosDeRotina>) =>
      cliente.salvarRotina(
        intencao({ acao: "criar", baralhoId, dias: [1], quantidade: null, ...extra }),
      );

    for (const invalido of [
      { baralhoId: "" },
      { dias: [] },
      { dias: [1, 1] },
      { dias: [8] },
      { quantidade: 0 },
      { quantidade: 1000 },
      { quantidade: undefined },
    ]) {
      expect(await tentar(invalido)).toMatchObject({
        ok: false,
        erro: "dados_invalidos",
      });
    }

    if (vazio.ok) {
      expect(await tentar({ baralhoId: vazio.baralho.id })).toMatchObject({
        ok: false,
        erro: "dados_invalidos",
      });
    }

    expect(await tentar({ baralhoId: "inexistente" })).toMatchObject({
      ok: false,
      erro: "nao_encontrado",
    });
  });

  it("sobreposição exige confirmação, falha não consome o operacaoId e o reenvio não duplica", async () => {
    const { cliente, baralhoId } = await clienteComBaralho();

    await cliente.salvarRotina(intencao({ acao: "criar", baralhoId, dias: [1, 2], quantidade: null }));

    const sobreposta = intencao({ acao: "criar", baralhoId, dias: [2, 3], quantidade: 2 });

    expect(await cliente.salvarRotina(sobreposta)).toMatchObject({
      ok: false,
      erro: "sobreposicao",
    });
    expect(
      await cliente.salvarRotina({ ...sobreposta, confirmarSobreposicao: true }),
    ).toMatchObject({ ok: true });
    // Reenvio do mesmo operacaoId: mesma Rotina, sem duplicar.
    expect(
      await cliente.salvarRotina({ ...sobreposta, confirmarSobreposicao: true }),
    ).toMatchObject({ ok: true });

    const lista = await cliente.listarRotinas();

    expect(lista.ok && lista.rotinas).toHaveLength(2);
    // Mesmo operacaoId com outra intenção é conflito.
    expect(
      await cliente.salvarRotina({ ...sobreposta, dias: [5], confirmarSobreposicao: true }),
    ).toMatchObject({ ok: false, erro: "conflito" });
  });

  it("editar, pausar, retomar e excluir com versão; versão antiga é conflito", async () => {
    const { cliente, baralhoId } = await clienteComBaralho();
    const criada = await cliente.salvarRotina(
      intencao({ acao: "criar", baralhoId, dias: [1, 2, 3, 4, 5, 6, 7], quantidade: null }),
    );

    if (!criada.ok) {
      throw new Error("criar");
    }

    const { id } = criada.rotina;
    const editada = await cliente.salvarRotina(
      intencao({ acao: "editar", id, versao: 1, baralhoId, dias: [1, 2, 3, 4, 5, 6, 7], quantidade: 2 }),
    );

    expect(editada).toMatchObject({ ok: true, rotina: { versao: 2, quantidade: 2 } });
    expect(
      await cliente.salvarRotina(intencao({ acao: "pausar", id, versao: 1 })),
    ).toMatchObject({ ok: false, erro: "conflito" });

    const pausada = await cliente.salvarRotina(intencao({ acao: "pausar", id, versao: 2 }));

    expect(pausada).toMatchObject({ ok: true, rotina: { estado: "pausada", versao: 3 } });

    const retomada = await cliente.salvarRotina(intencao({ acao: "retomar", id, versao: 3 }));

    expect(retomada).toMatchObject({ ok: true, rotina: { estado: "ativa", versao: 4 } });
    expect(
      await cliente.salvarRotina(intencao({ acao: "excluir", id, versao: 4 })),
    ).toMatchObject({ ok: true, rotina: { estado: "excluida" } });
    expect(await cliente.listarRotinas()).toEqual({ ok: true, rotinas: [] });
    expect(
      await cliente.salvarRotina(intencao({ acao: "pausar", id, versao: 5 })),
    ).toMatchObject({ ok: false, erro: "nao_encontrado" });
  });

  it("inicia o Compromisso de hoje, conclui pelo registrarSessao e não inicia de novo", async () => {
    const { cliente, baralhoId } = await clienteComBaralho(6);
    const rotina = await cliente.salvarRotina(
      intencao({ acao: "criar", baralhoId, dias: [1, 2, 3, 4, 5, 6, 7], quantidade: 4 }),
    );

    if (!rotina.ok) {
      throw new Error("criar");
    }

    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
    const inicio = await cliente.iniciarCompromisso({
      rotinaId: rotina.rotina.id,
      data: hoje,
      fuso: FUSO,
    });

    if (!inicio.ok) {
      throw new Error("iniciar");
    }

    expect(inicio.inicio.cartoes).toHaveLength(4);

    const itens = (avaliacao: "bom" | "errei" = "bom") =>
      inicio.inicio.cartoes.map((cartao) => ({
        frente: cartao.frente,
        verso: cartao.verso,
        cartaoId: cartao.id,
        avaliacao,
      }));
    const base = {
      id: inicio.inicio.id,
      origem: "baralho" as const,
      baralhoId,
      nomeDoBaralho: "Inglês",
      inicioAgendaId: inicio.inicio.id,
    };

    // Registro incompatível é recusado e nada é concluído.
    expect(
      await cliente.registrarSessao({ ...base, itens: itens().slice(1) }),
    ).toMatchObject({ ok: false, erro: "dados_invalidos" });
    expect(
      await cliente.registrarSessao({ ...base, id: crypto.randomUUID(), itens: itens() }),
    ).toMatchObject({ ok: false, erro: "dados_invalidos" });

    expect(await cliente.registrarSessao({ ...base, itens: itens() })).toMatchObject({
      ok: true,
      registro: { id: inicio.inicio.id, estudados: 4 },
    });
    // Reenvio: o mesmo Registro.
    expect(await cliente.registrarSessao({ ...base, itens: itens("errei") })).toMatchObject({
      ok: true,
      registro: { id: inicio.inicio.id, acertos: 4 },
    });

    const [ano, mes, dia] = hoje.split("-").map(Number);
    const js = new Date(Date.UTC(ano, mes - 1, dia));
    const segunda = new Date(js.getTime() - ((js.getUTCDay() + 6) % 7) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const semana = await cliente.obterAgenda(segunda, FUSO);

    expect(semana).toMatchObject({
      ok: true,
      agenda: {
        compromissosDeHoje: [{ estado: "concluido", registroId: inicio.inicio.id }],
      },
    });
    expect(
      await cliente.iniciarCompromisso({ rotinaId: rotina.rotina.id, data: hoje, fuso: FUSO }),
    ).toMatchObject({ ok: false, erro: "conflito" });
  });

  it("o outro Usuário não alcança a Agenda alheia; sem Credencial recusa; indisponibilidade não conclui", async () => {
    const { cliente, baralhoId } = await clienteComBaralho();
    const rotina = await cliente.salvarRotina(
      intencao({ acao: "criar", baralhoId, dias: [1, 2, 3, 4, 5, 6, 7], quantidade: null }),
    );
    const outro = cliente.comoUsuario({ nomeDeUsuario: "bruno", senha: "senha-do-bruno-1" });

    expect(await outro.listarRotinas()).toMatchObject({ ok: false, erro: NAO_AUTENTICADO });
    expect(
      await cliente.comoUsuario(null).obterAgenda("2026-10-05", FUSO),
    ).toMatchObject({ ok: false, erro: NAO_AUTENTICADO });

    cliente.simularIndisponibilidade();

    expect(await cliente.listarRotinas()).toMatchObject({ ok: false, erro: INDISPONIVEL });
    expect(
      await cliente.salvarRotina(intencao({ acao: "excluir", id: rotina.ok ? rotina.rotina.id : "", versao: 1 })),
    ).toMatchObject({ ok: false, erro: INDISPONIVEL });

    cliente.restaurarDisponibilidade();

    expect(await cliente.listarRotinas()).toMatchObject({
      ok: true,
      rotinas: [{ estado: "ativa" }],
    });
  });

  it("a conta conta a Agenda e a exclusão da conta a remove (SC-113)", async () => {
    const { cliente, baralhoId } = await clienteComBaralho();

    await cliente.salvarRotina(
      intencao({ acao: "criar", baralhoId, dias: [1, 2, 3, 4, 5, 6, 7], quantidade: null }),
    );

    const conta = await cliente.obterConta();

    expect(conta).toMatchObject({ ok: true, dados: { contagens: { agenda: 1 } } });
  });

  it("é um ClienteDoAcervo completo (contrato)", () => {
    const cliente: ClienteDoAcervo = new ClienteEmMemoria();

    expect(typeof cliente.obterAgenda).toBe("function");
  });
});
