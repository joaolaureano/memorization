import { randomBytes } from "node:crypto";

import type { InjectOptions } from "fastify";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CABECALHO_DE_ORIGEM, PROIBIDO } from "../../src/http/origem.ts";
import {
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
  registrarRotasDeUsuarios,
} from "../../src/http/rotas.ts";
import type { OpcoesDoServidor } from "../../src/http/servidor.ts";
import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";

/**
 * T1002 — a guarda do segredo de origem: toda requisição que não trouxer o
 * segredo que só o CloudFront injeta é recusada com `403`, sem revelar o
 * motivo, **antes** de qualquer trabalho de Credencial (FR-125, FR-131;
 * SC-053).
 *
 * A prova é a **ausência** de distinção entre os casos de recusa — cabeçalho
 * ausente, curto, longo e errado respondem o mesmo status e o mesmo corpo —, e
 * a ordem das guardas: sem o segredo, a rota de acervo responde `403` e **não**
 * `401`, o que só acontece porque a guarda é o primeiro `onRequest` da
 * aplicação. O segredo é gerado nesta execução, e nunca versionado
 * (Princípio VIII).
 */

/** O segredo de origem desta execução: descartável, e nunca literal. */
const SEGREDO_DE_ORIGEM = randomBytes(48).toString("base64url");

/** O mesmo segredo com um caractere a menos — a recusa por tamanho. */
const SEGREDO_CURTO = SEGREDO_DE_ORIGEM.slice(0, -1);

/** O mesmo segredo com um caractere a mais — a recusa por tamanho. */
const SEGREDO_LONGO = `${SEGREDO_DE_ORIGEM}x`;

/** Outro segredo, do mesmo tamanho — a recusa por conteúdo. */
const OUTRO_SEGREDO = randomBytes(48).toString("base64url");

/** A credencial de um Nome de usuário que não existe: nunca confere (FR-088). */
const CREDENCIAL_INVALIDA = `Basic ${Buffer.from(
  "ninguem.silva:senha-que-nao-existe",
  "utf8",
).toString("base64")}`;

/** A combinação da Função da nuvem: guarda de origem, e política de origem desligada. */
const OPCOES_DA_FUNCAO: OpcoesDoServidor = {
  segredoDeOrigem: SEGREDO_DE_ORIGEM,
  politicaDeOutraOrigem: false,
};

/** O servidor de contrato com as rotas da aplicação, na combinação informada. */
async function montar(opcoes: OpcoesDoServidor): Promise<ServidorDeContrato> {
  return await montarServidorDeContrato(({ servidor, acervoDe, identidade }) => {
    registrarRotasDeCartoes(servidor, acervoDe);
    registrarRotasDeBaralhos(servidor, acervoDe);
    registrarRotasDeUsuarios(servidor, identidade);
  }, opcoes);
}

/** Os cabeçalhos de recusa possíveis: ausente, errado, curto e longo. */
const RECUSAS: { rotulo: string; cabecalho?: string }[] = [
  { rotulo: "cabeçalho ausente" },
  { rotulo: "cabeçalho errado", cabecalho: OUTRO_SEGREDO },
  { rotulo: "cabeçalho curto", cabecalho: SEGREDO_CURTO },
  { rotulo: "cabeçalho longo", cabecalho: SEGREDO_LONGO },
  { rotulo: "cabeçalho vazio", cabecalho: "" },
];

describe("a guarda do segredo de origem (T1002, SC-053)", () => {
  let contrato: ServidorDeContrato;

  beforeEach(async () => {
    contrato = await montar(OPCOES_DA_FUNCAO);
  });

  afterEach(async () => {
    await contrato.encerrar();
  });

  /** Envia a requisição com o segredo de origem e a Credencial informados. */
  function pedir(
    requisicao: InjectOptions,
    cabecalhoDeOrigem?: string,
    credencial?: string,
  ) {
    return contrato.servidor.inject({
      ...requisicao,
      headers: {
        ...requisicao.headers,
        ...(cabecalhoDeOrigem === undefined
          ? {}
          : { [CABECALHO_DE_ORIGEM]: cabecalhoDeOrigem }),
        ...(credencial === undefined ? {} : { authorization: credencial }),
      },
    });
  }

  it.each(RECUSAS)(
    "recusa com 403 sem revelar o motivo: $rotulo",
    async (caso) => {
      const resposta = await pedir(
        { method: "GET", url: "/cartoes" },
        caso.cabecalho,
        contrato.credencial.cabecalho.authorization,
      );

      expect(resposta.statusCode).toBe(403);
      expect(resposta.body).toBe(JSON.stringify(PROIBIDO));

      /** A recusa não publica credencial nem guarda valor reutilizável. */
      expect(resposta.headers["www-authenticate"]).toBeUndefined();
      expect(resposta.headers["set-cookie"]).toBeUndefined();
    },
  );

  it("responde exatamente o mesmo corpo e status em todos os casos de recusa", async () => {
    const respostas = await Promise.all(
      RECUSAS.map((caso) =>
        pedir({ method: "GET", url: "/cartoes" }, caso.cabecalho),
      ),
    );

    const primeiras = respostas[0];

    for (const resposta of respostas) {
      expect(resposta.statusCode).toBe(primeiras?.statusCode);
      expect(resposta.body).toBe(primeiras?.body);
      expect(resposta.rawPayload.toString("utf8")).toBe(
        primeiras?.rawPayload.toString("utf8"),
      );
    }
  });

  it("recusa antes do hook da Credencial: sem o segredo, a rota de acervo não responde 401", async () => {
    const semSegredo = await pedir(
      { method: "GET", url: "/cartoes" },
      undefined,
      CREDENCIAL_INVALIDA,
    );

    expect(semSegredo.statusCode).toBe(403);
    expect(semSegredo.body).toBe(JSON.stringify(PROIBIDO));

    /** Com o segredo, é a Credencial que recusa — e a recusa é a de `008`. */
    const comSegredo = await pedir(
      { method: "GET", url: "/cartoes" },
      SEGREDO_DE_ORIGEM,
      CREDENCIAL_INVALIDA,
    );

    expect(comSegredo.statusCode).toBe(401);
    expect(comSegredo.body).not.toBe(JSON.stringify(PROIBIDO));
  });

  it("deixa passar a requisição que traz o segredo: a rota de acervo responde", async () => {
    const resposta = await pedirComCredencial(
      contrato.servidor,
      contrato.credencial,
      {
        method: "GET",
        url: "/cartoes",
        headers: { [CABECALHO_DE_ORIGEM]: SEGREDO_DE_ORIGEM },
      },
    );

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual([]);
  });

  it("exige o segredo até na prova de vida, que segue isenta de Credencial", async () => {
    const comSegredo = await pedir({ method: "GET", url: "/health" }, SEGREDO_DE_ORIGEM);

    expect(comSegredo.statusCode).toBe(200);
    expect(comSegredo.json()).toEqual({ status: "ok" });

    const semSegredo = await pedir({ method: "GET", url: "/health" });

    expect(semSegredo.statusCode).toBe(403);
    expect(semSegredo.body).toBe(JSON.stringify(PROIBIDO));
  });

  it("não imprime nada no caminho da recusa", async () => {
    const gritos = vi.spyOn(console, "error").mockImplementation(() => {});
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
    const escritas = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      for (const caso of RECUSAS) {
        await pedir({ method: "GET", url: "/cartoes" }, caso.cabecalho);
      }

      expect(gritos).not.toHaveBeenCalled();
      expect(avisos).not.toHaveBeenCalled();
      expect(escritas).not.toHaveBeenCalled();
    } finally {
      gritos.mockRestore();
      avisos.mockRestore();
      escritas.mockRestore();
    }
  });

  it("não envia cabeçalho permissivo de outra origem nas respostas da função", async () => {
    const recusa = await pedir({ method: "GET", url: "/cartoes" });
    const sucesso = await pedir({ method: "GET", url: "/health" }, SEGREDO_DE_ORIGEM);

    for (const resposta of [recusa, sucesso]) {
      const permissivos = Object.keys(resposta.headers).filter((cabecalho) =>
        cabecalho.toLowerCase().startsWith("access-control-"),
      );

      expect(permissivos).toEqual([]);
    }
  });
});

describe("a guarda não depende da política de outra origem", () => {
  let contrato: ServidorDeContrato;

  beforeEach(async () => {
    /** A mesma guarda, com a política permissiva da execução local ligada. */
    contrato = await montar({ segredoDeOrigem: SEGREDO_DE_ORIGEM });
  });

  afterEach(async () => {
    await contrato.encerrar();
  });

  it("recusa com o mesmo status e o mesmo corpo da função", async () => {
    const resposta = await contrato.servidor.inject({
      method: "GET",
      url: "/cartoes",
    });

    expect(resposta.statusCode).toBe(403);
    expect(resposta.body).toBe(JSON.stringify(PROIBIDO));
  });
});
