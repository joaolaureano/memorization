import type { FastifyInstance, InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CORPO_INVALIDO,
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
  registrarRotasDeUsuarios,
} from "../../src/http/rotas.ts";
import { senhaGerada } from "../armazenamento/usuarios-de-teste.ts";
import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";

/**
 * T703 — o hook `onRequest` exige a Credencial antes de toda rota, e a rota
 * **não roda** sem ela (FR-090, FR-088, FR-079, FR-046, FR-078, SC-028).
 *
 * Cada requisição sem cabeçalho, com cabeçalho malformado ou com Credencial que
 * não confere responde `401` com o código estável e a **mensagem única** em
 * português, sem `WWW-Authenticate` — que faria o navegador memorizar a
 * Credencial, contra FR-089 e FR-078 — e sem `Set-Cookie`. Em toda recusa o
 * acervo permanece inalterado, e as três isenções do contrato continuam
 * alcançáveis: o Cadastro, a prova de vida e o pré-voo de CORS.
 */

/** A recusa uniforme de Credencial, como o contrato a publica (FR-088). */
const CREDENCIAL_INVALIDA = {
  erro: "credencial_invalida",
  mensagem: "Nome de usuário ou Senha incorretos.",
};

let contrato: ServidorDeContrato;
let servidor: FastifyInstance;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(
    ({ servidor, acervoDe, identidade }) => {
      registrarRotasDeCartoes(servidor, acervoDe);
      registrarRotasDeBaralhos(servidor, acervoDe);
      registrarRotasDeUsuarios(servidor, identidade);
    },
  );
  servidor = contrato.servidor;
});

afterEach(async () => {
  await contrato.encerrar();
});

/** Todas as rotas de acervo do contrato, com uma carga válida de cada uma. */
function rotasDeAcervo(): InjectOptions[] {
  return [
    { method: "POST", url: "/cartoes", payload: { frente: "To walk", verso: "Caminhar" } },
    { method: "GET", url: "/cartoes" },
    { method: "PUT", url: "/cartoes/c1", payload: { frente: "To walk", verso: "Caminhar" } },
    { method: "DELETE", url: "/cartoes/c1" },
    { method: "POST", url: "/baralhos", payload: { nome: "Inglês" } },
    { method: "GET", url: "/baralhos" },
    { method: "GET", url: "/baralhos/b1" },
    { method: "PUT", url: "/baralhos/b1", payload: { nome: "Inglês" } },
    { method: "DELETE", url: "/baralhos/b1" },
    { method: "POST", url: "/baralhos/b1/vinculos", payload: { cartaoId: "c1" } },
    { method: "DELETE", url: "/baralhos/b1/vinculos/c1" },
    { method: "POST", url: "/entrar" },
  ];
}

/** O cabeçalho de uma Credencial que não existe, e nunca existirá. */
function cabecalhoDeCredencialDesconhecida(): string {
  return `Basic ${Buffer.from(`ninguem.aqui:${senhaGerada()}`, "utf8").toString(
    "base64",
  )}`;
}

describe("Credencial obrigatória — sem ela, a rota não roda", () => {
  it("recusa toda rota de acervo sem cabeçalho, com o mesmo 401 (FR-090, SC-028)", async () => {
    for (const requisicao of rotasDeAcervo()) {
      const resposta = await servidor.inject(requisicao);
      const rotulo = `${requisicao.method} ${String(requisicao.url)}`;

      expect(resposta.statusCode, rotulo).toBe(401);
      expect(resposta.json(), rotulo).toEqual(CREDENCIAL_INVALIDA);
    }
  });

  it("recusa com cabeçalho malformado, com o mesmo 401 (FR-090)", async () => {
    for (const cabecalho of [
      "",
      "sem-esquema",
      "Basic",
      "Bearer abc",
      "Basic ",
      `Basic ${Buffer.from("semDoisPontos", "utf8").toString("base64")}`,
      "Basic ist0-n4o-é-base64",
    ]) {
      const resposta = await pedirComCredencial(
        servidor,
        { ...contrato.credencial, cabecalho: { authorization: cabecalho } },
        { method: "GET", url: "/cartoes" },
      );

      expect(resposta.statusCode, cabecalho).toBe(401);
      expect(resposta.json(), cabecalho).toEqual(CREDENCIAL_INVALIDA);
    }
  });

  it("recusa Credencial que não confere, com o mesmo 401 (FR-088)", async () => {
    const resposta = await servidor.inject({
      method: "GET",
      url: "/cartoes",
      headers: { authorization: cabecalhoDeCredencialDesconhecida() },
    });

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual(CREDENCIAL_INVALIDA);
  });

  it("recusa com exatamente o corpo de duas chaves, sem valor reutilizável (FR-079)", async () => {
    const resposta = await servidor.inject({ method: "GET", url: "/cartoes" });

    expect(Object.keys(resposta.json() as object).sort()).toEqual([
      "erro",
      "mensagem",
    ]);
    expect(resposta.body).not.toMatch(/token|sessao|cookie/i);
  });

  it("não publica WWW-Authenticate nem Set-Cookie na recusa (FR-078, FR-079)", async () => {
    const resposta = await servidor.inject({ method: "GET", url: "/cartoes" });

    expect(resposta.headers["www-authenticate"]).toBeUndefined();
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });

  it("aborta antes do handler em toda rota: nada é criado sem Credencial (SC-028)", async () => {
    await servidor.inject({
      method: "POST",
      url: "/cartoes",
      payload: { frente: "To walk", verso: "Caminhar" },
    });

    const leitura = await pedirComCredencial(
      servidor,
      contrato.credencial,
      { method: "GET", url: "/cartoes" },
    );

    expect(leitura.statusCode).toBe(200);
    expect(leitura.json()).toEqual([]);
  });

  it("a recusa não distingue quem existe: sem Credencial, o acervo de qualquer Usuário responde 401", async () => {
    const outro = await contrato.cadastrar("bruno.souza");
    const criado = await pedirComCredencial(servidor, outro, {
      method: "POST",
      url: "/cartoes",
      payload: { frente: "To walk", verso: "Caminhar" },
    });

    expect(criado.statusCode).toBe(201);

    /** Sem Credencial, nem o acervo do dono nem o de qualquer outro aparece. */
    const semCredencial = await servidor.inject({
      method: "GET",
      url: "/cartoes",
    });
    const doDono = await pedirComCredencial(servidor, contrato.credencial, {
      method: "GET",
      url: "/cartoes",
    });
    const doOutro = await pedirComCredencial(servidor, outro, {
      method: "GET",
      url: "/cartoes",
    });

    expect(semCredencial.statusCode).toBe(401);
    expect(semCredencial.json()).toEqual(CREDENCIAL_INVALIDA);
    expect(doDono.json()).toEqual([]);
    expect(doOutro.json()).toEqual([
      expect.objectContaining({ frente: "To walk" }),
    ]);
  });
});

describe("Rotas isentas — alcançáveis sem Credencial", () => {
  it("POST /usuarios continua criando o Usuário (FR-097)", async () => {
    const resposta = await servidor.inject({
      method: "POST",
      url: "/usuarios",
      payload: { nomeDeUsuario: "novo.usuario", senha: senhaGerada() },
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({
      id: expect.any(String),
      nomeDeUsuario: "novo.usuario",
    });
  });

  it("POST /usuarios continua recusando a forma inválida na borda, sem Credencial", async () => {
    const resposta = await servidor.inject({
      method: "POST",
      url: "/usuarios",
      payload: { nomeDeUsuario: "ab" },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(CORPO_INVALIDO);
  });

  it("GET /health continua sendo a prova de vida, sem Credencial", async () => {
    const resposta = await servidor.inject({ method: "GET", url: "/health" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ status: "ok" });
  });

  it("o pré-voo de CORS continua respondendo 204, sem Credencial", async () => {
    for (const url of ["/cartoes", "/baralhos", "/usuarios", "/entrar"]) {
      const resposta = await servidor.inject({ method: "OPTIONS", url });

      expect(resposta.statusCode, url).toBe(204);
    }
  });
});

describe("Rota nova nasce exigindo Credencial", () => {
  it("uma rota registrada fora da lista isenta exige Credencial, sem que ninguém a proteja", async () => {
    servidor.post("/rota-nova", async () => ({ ok: true }));

    const semCredencial = await servidor.inject({
      method: "POST",
      url: "/rota-nova",
    });
    const comCredencial = await pedirComCredencial(
      servidor,
      contrato.credencial,
      { method: "POST", url: "/rota-nova" },
    );

    expect(semCredencial.statusCode).toBe(401);
    expect(semCredencial.json()).toEqual(CREDENCIAL_INVALIDA);
    expect(comCredencial.statusCode).toBe(200);
    expect(comCredencial.json()).toEqual({ ok: true });
  });
});
