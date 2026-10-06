import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registrarRotasDaAplicacao } from "../../src/http/servidor.ts";
import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "../http/apoio-de-contrato.ts";

/**
 * T1613 — o contrato HTTP da Agenda (016): status, códigos, isolamento entre
 * Usuários, entrada inválida fora da interface, CORS e Credencial (FR-248,
 * FR-250, FR-254, SC-100). O relógio é o real e o fuso é `UTC`, de modo que
 * "hoje" é calculado aqui do mesmo jeito que no servidor.
 */

let contrato: ServidorDeContrato;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(
    ({ servidor, acervoDe, identidade, acessos }) => {
      registrarRotasDaAplicacao(servidor, identidade, acervoDe, acessos);
    },
  );
});

afterEach(async () => {
  await contrato.encerrar();
});

const ORIGEM = "http://127.0.0.1:5173";

function hojeEmUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A segunda-feira da semana de hoje, em UTC. */
function segundaDeHoje(): string {
  const base = new Date(`${hojeEmUtc()}T00:00:00Z`);

  base.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));

  return base.toISOString().slice(0, 10);
}

function diaDeHoje(): number {
  const dia = new Date(`${hojeEmUtc()}T00:00:00Z`).getUTCDay();

  return dia === 0 ? 7 : dia;
}

function pedir(
  metodo: "GET" | "POST",
  url: string,
  corpo?: unknown,
  credencial = contrato.credencial,
) {
  return pedirComCredencial(contrato.servidor, credencial, {
    method: metodo,
    url,
    ...(corpo === undefined ? {} : { payload: corpo as object }),
  });
}

async function criarBaralho(cartoes = 2, credencial = contrato.credencial) {
  const baralho = await pedir("POST", "/baralhos", { nome: "Inglês" }, credencial);
  const id = (baralho.json() as { id: string }).id;

  for (let indice = 0; indice < cartoes; indice += 1) {
    await pedir(
      "POST",
      `/baralhos/${id}/cartoes`,
      { frente: `F${indice}`, verso: `V${indice}` },
      credencial,
    );
  }

  return id;
}

function corpoDeCriacao(baralhoId: string, extra: object = {}) {
  return {
    operacaoId: randomUUID(),
    acao: "criar",
    baralhoId,
    dias: [diaDeHoje()],
    quantidade: null,
    fuso: "UTC",
    ...extra,
  };
}

describe("POST /agenda/rotinas (FR-222–FR-226, FR-249)", () => {
  it("responde 201 ao criar, 200 no reenvio idempotente e 200 nas demais ações", async () => {
    const baralhoId = await criarBaralho();
    const corpo = corpoDeCriacao(baralhoId);

    const criada = await pedir("POST", "/agenda/rotinas", corpo);

    expect(criada.statusCode).toBe(201);

    const rotina = (criada.json() as { rotina: { id: string; versao: number } })
      .rotina;
    const reenvio = await pedir("POST", "/agenda/rotinas", corpo);

    expect(reenvio.statusCode).toBe(200);
    expect((reenvio.json() as { rotina: { id: string } }).rotina.id).toBe(
      rotina.id,
    );

    const pausada = await pedir("POST", "/agenda/rotinas", {
      operacaoId: randomUUID(),
      acao: "pausar",
      id: rotina.id,
      versao: rotina.versao,
      fuso: "UTC",
    });

    expect(pausada.statusCode).toBe(200);
    expect(pausada.json()).toMatchObject({ rotina: { estado: "pausada" } });

    const lista = await pedir("GET", "/agenda/rotinas");

    expect(lista.statusCode).toBe(200);
    expect((lista.json() as { rotinas: unknown[] }).rotinas).toHaveLength(1);
  });

  it("recusa forma inválida com 400 e domínio inválido com 400, versão antiga com 409 e sobreposição com 409", async () => {
    const baralhoId = await criarBaralho();

    expect((await pedir("POST", "/agenda/rotinas", {})).statusCode).toBe(400);
    expect(
      (await pedir("POST", "/agenda/rotinas", { ...corpoDeCriacao(baralhoId), dias: "1" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await pedir("POST", "/agenda/rotinas", corpoDeCriacao(baralhoId, { dias: [] })))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await pedir(
          "POST",
          "/agenda/rotinas",
          corpoDeCriacao(baralhoId, { quantidade: 1000 }),
        )
      ).statusCode,
    ).toBe(400);

    const primeira = await pedir("POST", "/agenda/rotinas", corpoDeCriacao(baralhoId));
    const rotina = (primeira.json() as { rotina: { id: string } }).rotina;
    const sobreposta = await pedir("POST", "/agenda/rotinas", corpoDeCriacao(baralhoId));

    expect(sobreposta.statusCode).toBe(409);
    expect(sobreposta.json()).toMatchObject({ erro: "sobreposicao" });
    expect(
      (
        await pedir(
          "POST",
          "/agenda/rotinas",
          corpoDeCriacao(baralhoId, { confirmarSobreposicao: true }),
        )
      ).statusCode,
    ).toBe(201);

    const velha = await pedir("POST", "/agenda/rotinas", {
      operacaoId: randomUUID(),
      acao: "excluir",
      id: rotina.id,
      versao: 9,
      fuso: "UTC",
    });

    expect(velha.statusCode).toBe(409);
    expect(velha.json()).toMatchObject({ erro: "conflito" });
  });

  it("não aceita o dono pelo corpo: usuarioId é ignorado", async () => {
    const baralhoId = await criarBaralho();
    const resposta = await pedir(
      "POST",
      "/agenda/rotinas",
      corpoDeCriacao(baralhoId, { usuarioId: "outro" }),
    );

    expect(resposta.statusCode).toBe(201);
    expect(JSON.stringify(resposta.json())).not.toContain("usuarioId");
  });
});

describe("GET /agenda (FR-227–FR-230, FR-250)", () => {
  it("devolve a semana com hoje, fuso e Compromissos", async () => {
    const baralhoId = await criarBaralho();

    await pedir("POST", "/agenda/rotinas", corpoDeCriacao(baralhoId));

    const resposta = await pedir(
      "GET",
      `/agenda?inicio=${segundaDeHoje()}&fuso=UTC`,
    );

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({
      inicio: segundaDeHoje(),
      hoje: hojeEmUtc(),
      fuso: "UTC",
      compromissos: [{ data: hojeEmUtc(), estado: "pendente" }],
      compromissosDeHoje: [{ data: hojeEmUtc(), estado: "pendente" }],
    });
  });

  it("recusa consulta ausente, data inexistente, não segunda e fuso inválido com 400", async () => {
    for (const url of [
      "/agenda",
      "/agenda?inicio=2026-10-05",
      "/agenda?inicio=2026-02-31&fuso=UTC",
      "/agenda?inicio=2026-10-06&fuso=UTC",
      "/agenda?inicio=2026-10-05&fuso=Marte/Fobos",
    ]) {
      expect((await pedir("GET", url)).statusCode, url).toBe(400);
    }
  });
});

describe("POST /agenda/inicios e conclusão pelo POST /sessoes (FR-231, FR-254)", () => {
  it("autoriza o início de hoje e conclui o Compromisso com o mesmo id", async () => {
    const baralhoId = await criarBaralho(3);
    const rotina = (
      (await pedir("POST", "/agenda/rotinas", corpoDeCriacao(baralhoId))).json() as {
        rotina: { id: string };
      }
    ).rotina;

    const inicio = await pedir("POST", "/agenda/inicios", {
      rotinaId: rotina.id,
      data: hojeEmUtc(),
      fuso: "UTC",
    });

    expect(inicio.statusCode).toBe(201);

    const autorizado = (
      inicio.json() as {
        inicio: {
          id: string;
          cartoes: Array<{ id: string; frente: string; verso: string }>;
        };
      }
    ).inicio;

    expect(autorizado.cartoes).toHaveLength(3);

    const conclusao = (extra: object = {}) =>
      pedir("POST", "/sessoes", {
        id: autorizado.id,
        inicioAgendaId: autorizado.id,
        origem: "baralho",
        baralhoId,
        nomeDoBaralho: "Inglês",
        itens: autorizado.cartoes.map((cartao) => ({
          frente: cartao.frente,
          verso: cartao.verso,
          cartaoId: cartao.id,
          avaliacao: "bom",
        })),
        ...extra,
      });

    // Registro incompatível é recusado fora da interface.
    expect((await conclusao({ id: randomUUID() })).statusCode).toBe(400);
    expect((await conclusao({ itens: [] })).statusCode).toBe(400);

    const concluida = await conclusao();

    expect(concluida.statusCode).toBe(201);
    expect((await conclusao()).statusCode).toBe(200);

    const semana = await pedir("GET", `/agenda?inicio=${segundaDeHoje()}&fuso=UTC`);

    expect(semana.json()).toMatchObject({
      compromissosDeHoje: [{ estado: "concluido", registroId: autorizado.id }],
    });

    // Concluído não inicia de novo.
    expect(
      (
        await pedir("POST", "/agenda/inicios", {
          rotinaId: rotina.id,
          data: hojeEmUtc(),
          fuso: "UTC",
        })
      ).statusCode,
    ).toBe(409);
  });

  it("recusa início fora de hoje, de Rotina inexistente ou de forma inválida", async () => {
    const baralhoId = await criarBaralho();
    const rotina = (
      (await pedir("POST", "/agenda/rotinas", corpoDeCriacao(baralhoId))).json() as {
        rotina: { id: string };
      }
    ).rotina;

    expect(
      (
        await pedir("POST", "/agenda/inicios", {
          rotinaId: rotina.id,
          data: "2000-01-03",
          fuso: "UTC",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await pedir("POST", "/agenda/inicios", {
          rotinaId: randomUUID(),
          data: hojeEmUtc(),
          fuso: "UTC",
        })
      ).statusCode,
    ).toBe(404);
    expect((await pedir("POST", "/agenda/inicios", {})).statusCode).toBe(400);
  });
});

describe("isolamento entre Usuários e Credencial (FR-248, SC-100)", () => {
  it("o outro Usuário não lê, altera, inicia nem conclui o que não é dele", async () => {
    const baralhoId = await criarBaralho(2);
    const rotina = (
      (await pedir("POST", "/agenda/rotinas", corpoDeCriacao(baralhoId))).json() as {
        rotina: { id: string; versao: number };
      }
    ).rotina;
    const inicio = (
      (
        await pedir("POST", "/agenda/inicios", {
          rotinaId: rotina.id,
          data: hojeEmUtc(),
          fuso: "UTC",
        })
      ).json() as { inicio: { id: string; cartoes: Array<{ id: string }> } }
    ).inicio;
    const outro = await contrato.cadastrar("bruno.lima");

    const lista = await pedir("GET", "/agenda/rotinas", undefined, outro);
    const semana = await pedir(
      "GET",
      `/agenda?inicio=${segundaDeHoje()}&fuso=UTC`,
      undefined,
      outro,
    );
    const excluir = await pedir(
      "POST",
      "/agenda/rotinas",
      {
        operacaoId: randomUUID(),
        acao: "excluir",
        id: rotina.id,
        versao: rotina.versao,
        fuso: "UTC",
      },
      outro,
    );
    const iniciar = await pedir(
      "POST",
      "/agenda/inicios",
      { rotinaId: rotina.id, data: hojeEmUtc(), fuso: "UTC" },
      outro,
    );
    const concluir = await pedir(
      "POST",
      "/sessoes",
      {
        id: inicio.id,
        inicioAgendaId: inicio.id,
        origem: "baralho",
        baralhoId,
        nomeDoBaralho: "Inglês",
        itens: inicio.cartoes.map((cartao) => ({
          frente: "f",
          verso: "v",
          cartaoId: cartao.id,
          avaliacao: "bom",
        })),
      },
      outro,
    );

    expect(lista.json()).toEqual({ rotinas: [] });
    expect((semana.json() as { compromissos: unknown[] }).compromissos).toEqual([]);
    expect(excluir.statusCode).toBe(404);
    expect(iniciar.statusCode).toBe(404);
    expect(concluir.statusCode).toBe(400);

    // A Rotina do dono segue intacta e sem conclusão.
    const dono = await pedir("GET", `/agenda?inicio=${segundaDeHoje()}&fuso=UTC`);

    expect(dono.json()).toMatchObject({
      compromissosDeHoje: [{ estado: "pendente" }],
    });
  });

  it("sem Credencial toda rota recusa com 401", async () => {
    for (const [metodo, url] of [
      ["GET", "/agenda?inicio=2026-10-05&fuso=UTC"],
      ["GET", "/agenda/rotinas"],
      ["POST", "/agenda/rotinas"],
      ["POST", "/agenda/inicios"],
    ] as const) {
      const resposta = await contrato.servidor.inject({
        method: metodo,
        url,
        ...(metodo === "POST" ? { payload: {} } : {}),
      });

      expect(resposta.statusCode, url).toBe(401);
    }
  });
});

describe("CORS das rotas da Agenda (lição da 015)", () => {
  it("responde ao pré-voo e concede origem exata e credenciais nas respostas", async () => {
    for (const [metodo, url] of [
      ["GET", "/agenda"],
      ["GET", "/agenda/rotinas"],
      ["POST", "/agenda/rotinas"],
      ["POST", "/agenda/inicios"],
    ] as const) {
      const preVoo = await contrato.servidor.inject({
        method: "OPTIONS",
        url,
        headers: {
          origin: ORIGEM,
          "access-control-request-method": metodo,
          "access-control-request-headers": "content-type",
        },
      });

      expect(preVoo.statusCode, url).toBe(204);
      expect(preVoo.headers["access-control-allow-origin"]).toBe(ORIGEM);
    }

    const resposta = await pedirComCredencial(contrato.servidor, contrato.credencial, {
      method: "GET",
      url: "/agenda/rotinas",
      headers: { origin: ORIGEM },
    });

    expect(resposta.headers["access-control-allow-origin"]).toBe(ORIGEM);
    expect(resposta.headers["access-control-allow-credentials"]).toBe("true");
  });
});
