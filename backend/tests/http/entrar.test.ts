import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyInstance } from "fastify";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { registrarRotaDeEntrada } from "../../src/http/rotas.ts";
import { VARIAVEL_DO_SEGREDO } from "../../src/identidade/segredo.ts";
import {
  segredoGerado,
  senhaGerada,
} from "../armazenamento/usuarios-de-teste.ts";
import {
  montarServidorDeContrato,
  pedirComCredencial,
  type ServidorDeContrato,
} from "./apoio-de-contrato.ts";

/**
 * T704 — `POST /entrar` verifica a Credencial e responde quem entrou, ou o
 * mesmo `401` (FR-086, FR-046, FR-079, FR-078, SC-033).
 *
 * A rota não tem corpo: a Credencial é o cabeçalho `Authorization: Basic ...`,
 * verificada pelo hook antes de o handler rodar (FR-090). O que a asserção
 * exige: `200` com **exatamente** `id` e `nomeDeUsuario`, `401` com a mensagem
 * única tanto para Nome de usuário inexistente quanto para Senha errada, e
 * nenhum `Set-Cookie` ou valor reutilizável em resposta alguma (FR-079). O
 * pré-voo de `/entrar` permite `authorization`, sem o que o navegador recusaria
 * o `fetch` que carrega o cabeçalho.
 */

/** A recusa uniforme de Credencial, como o contrato a publica (FR-088). */
const CREDENCIAL_INVALIDA = {
  erro: "credencial_invalida",
  mensagem: "Nome de usuário ou Senha incorretos.",
};

let contrato: ServidorDeContrato;
let servidor: FastifyInstance;

beforeEach(async () => {
  contrato = await montarServidorDeContrato(({ servidor }) => {
    registrarRotaDeEntrada(servidor);
  });
  servidor = contrato.servidor;
});

afterEach(async () => {
  await contrato.encerrar();
});

describe("POST /entrar — o Usuário que entrou", () => {
  it("responde 200 com exatamente id e nomeDeUsuario (FR-086)", async () => {
    const resposta = await pedirComCredencial(servidor, contrato.credencial, {
      method: "POST",
      url: "/entrar",
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      id: contrato.credencial.id,
      nomeDeUsuario: contrato.credencial.nomeDeUsuario,
    });
    expect(Object.keys(resposta.json() as object).sort()).toEqual([
      "id",
      "nomeDeUsuario",
    ]);
  });

  it("aceita os espaços ao redor e a caixa diferente do Cadastro (FR-087, SC-036)", async () => {
    const resposta = await pedirComCredencial(
      servidor,
      {
        ...contrato.credencial,
        cabecalho: {
          authorization: `Basic ${Buffer.from(
            `  ${contrato.credencial.nomeDeUsuario.toUpperCase()}  :${contrato.credencial.senha}`,
            "utf8",
          ).toString("base64")}`,
        },
      },
      { method: "POST", url: "/entrar" },
    );

    expect(resposta.statusCode).toBe(200);
    /** O Nome de usuário devolvido é o do Cadastro, e não o digitado. */
    expect(resposta.json()).toEqual({
      id: contrato.credencial.id,
      nomeDeUsuario: contrato.credencial.nomeDeUsuario,
    });
  });

  it("responde 200 sem corpo de requisição e sem efeito colateral algum", async () => {
    const resposta = await pedirComCredencial(servidor, contrato.credencial, {
      method: "POST",
      url: "/entrar",
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers["set-cookie"]).toBeUndefined();
    expect(resposta.body).not.toContain(contrato.credencial.senha);
  });
});

describe("POST /entrar — a mesma recusa de toda Credencial", () => {
  it("recusa sem cabeçalho com 401 e a mensagem única (FR-090)", async () => {
    const resposta = await servidor.inject({ method: "POST", url: "/entrar" });

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual(CREDENCIAL_INVALIDA);
  });

  it("recusa Nome de usuário inexistente e Senha errada com a mesma resposta (FR-088, SC-029)", async () => {
    const semEsseNome = await servidor.inject({
      method: "POST",
      url: "/entrar",
      headers: {
        authorization: `Basic ${Buffer.from(
          `ninguem.aqui:${senhaGerada()}`,
          "utf8",
        ).toString("base64")}`,
      },
    });
    const comSenhaErrada = await pedirComCredencial(
      servidor,
      {
        ...contrato.credencial,
        senha: senhaGerada(),
        cabecalho: {
          authorization: `Basic ${Buffer.from(
            `${contrato.credencial.nomeDeUsuario}:${senhaGerada()}`,
            "utf8",
          ).toString("base64")}`,
        },
      },
      { method: "POST", url: "/entrar" },
    );

    expect(semEsseNome.statusCode).toBe(401);
    expect(comSenhaErrada.statusCode).toBe(401);
    expect(comSenhaErrada.json()).toEqual(semEsseNome.json());
    expect(comSenhaErrada.json()).toEqual(CREDENCIAL_INVALIDA);
    expect(comSenhaErrada.headers["www-authenticate"]).toBeUndefined();
    expect(comSenhaErrada.headers["set-cookie"]).toBeUndefined();
  });

  it("recusa o cabeçalho malformado com a mesma resposta (FR-090)", async () => {
    const resposta = await servidor.inject({
      method: "POST",
      url: "/entrar",
      headers: { authorization: "Basic" },
    });

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual(CREDENCIAL_INVALIDA);
  });

  it("não devolve nada reutilizável: nenhuma resposta traz token, sessão ou cookie (FR-079, SC-033)", async () => {
    const recusa = await servidor.inject({ method: "POST", url: "/entrar" });
    const sucesso = await pedirComCredencial(servidor, contrato.credencial, {
      method: "POST",
      url: "/entrar",
    });

    for (const resposta of [recusa, sucesso]) {
      expect(resposta.headers["set-cookie"]).toBeUndefined();
      expect(resposta.body).not.toMatch(/token|sessao|session|cookie/i);
      expect(resposta.body).not.toContain(contrato.credencial.senha);
      expect(resposta.body).not.toContain(
        Buffer.from(contrato.credencial.senha, "utf8").toString("base64"),
      );
    }
  });
});

/**
 * A prova do registro, no **processo real**: a API é subida como processo
 * filho — com segredo, arquivo e Senha gerados nesta execução —, um Cadastro e
 * um Entrar são feitos por HTTP, e a **saída capturada** do processo não pode
 * conter a Senha nem o cabeçalho de autorização (FR-078, SC-033).
 */
describe("POST /entrar — a Senha e o cabeçalho não aparecem em log algum", () => {
  const DIRETORIO = mkdtempSync(join(tmpdir(), "logs-do-entrar-"));

  afterAll(() => {
    rmSync(DIRETORIO, { recursive: true, force: true });
  });

  const RAIZ_DO_BACKEND = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
  );

  const ENTRADA_LOCAL = join(RAIZ_DO_BACKEND, "src", "entradas", "local.ts");

  /** Devolve uma porta livre do loopback, escolhida pelo sistema operacional. */
  async function portaLivre(): Promise<number> {
    return await new Promise((resolver, recusar) => {
      const sondagem = createServer();

      sondagem.once("error", recusar);
      sondagem.listen(0, "127.0.0.1", () => {
        const endereco = sondagem.address();

        if (endereco === null || typeof endereco === "string") {
          recusar(new Error("não foi possível determinar a porta livre"));
          return;
        }

        sondagem.close(() => resolver((endereco as AddressInfo).port));
      });
    });
  }

  /** Aguarda a API responder `{"status":"ok"}` no `/health`. */
  async function aguardarSaude(porta: number): Promise<void> {
    const inicio = Date.now();

    while (Date.now() - inicio < 30_000) {
      try {
        if ((await fetch(`http://127.0.0.1:${porta}/health`)).ok) {
          return;
        }
      } catch {
        // Ainda não escuta; a sondagem continua até o tempo limite.
      }

      await new Promise((resolver) => setTimeout(resolver, 100));
    }

    throw new Error("a API não respondeu em 30000ms");
  }

  it("mantém a Senha e o cabeçalho fora da saída, no sucesso e na recusa", async () => {
    const porta = await portaLivre();
    const segredo = segredoGerado();
    const senha = senhaGerada();
    const nomeDeUsuario = "Ana.Silva";
    const cabecalho = `Basic ${Buffer.from(`${nomeDeUsuario}:${senha}`, "utf8").toString("base64")}`;
    const processo: ChildProcess = spawn(process.execPath, [ENTRADA_LOCAL], {
      cwd: RAIZ_DO_BACKEND,
      env: {
        ...process.env,
        PORTA: String(porta),
        CAMINHO_DO_BANCO: join(DIRETORIO, "registro.sqlite"),
        [VARIAVEL_DO_SEGREDO]: segredo,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const capturado: string[] = [];

    processo.stdout?.setEncoding("utf8");
    processo.stdout?.on("data", (pedaco: string) => capturado.push(pedaco));
    processo.stderr?.setEncoding("utf8");
    processo.stderr?.on("data", (pedaco: string) => capturado.push(pedaco));

    try {
      await aguardarSaude(porta);

      const cadastro = await fetch(`http://127.0.0.1:${porta}/usuarios`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nomeDeUsuario, senha }),
      });

      expect(cadastro.status).toBe(201);

      const entrou = await fetch(`http://127.0.0.1:${porta}/entrar`, {
        method: "POST",
        headers: { authorization: cabecalho },
      });

      expect(entrou.status).toBe(200);
      expect(await entrou.json()).toEqual({
        id: expect.any(String),
        nomeDeUsuario,
      });

      /** A mesma Credencial com outro Nome de usuário: o caminho da recusa. */
      const recusado = await fetch(`http://127.0.0.1:${porta}/entrar`, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`ninguem.aqui:${senha}`, "utf8").toString("base64")}`,
        },
      });

      expect(recusado.status).toBe(401);
    } finally {
      const saiu = new Promise<void>((resolver) => {
        processo.once("exit", () => resolver());
      });

      processo.kill("SIGTERM");

      await Promise.race([
        saiu,
        new Promise<void>((resolver) => setTimeout(resolver, 5_000)),
      ]);
    }

    const saida = capturado.join("");

    /** A única linha de saída é a de início, e nada nela é sensível. */
    expect(saida).toContain("Armazenamento: SQLite (arquivo local)");
    expect(saida).not.toContain(senha);
    expect(saida).not.toContain(cabecalho);
    expect(saida).not.toContain("authorization");
    expect(saida).not.toContain(segredo);
    expect(saida).not.toMatch(/POST \/entrar|body|payload/i);
  });
});

describe("POST /entrar — pré-voo de CORS", () => {
  it("responde 204 permitindo authorization e POST", async () => {
    const resposta = await servidor.inject({
      method: "OPTIONS",
      url: "/entrar",
      headers: {
        origin: "http://127.0.0.1:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization",
      },
    });

    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-headers"]).toContain(
      "authorization",
    );
    expect(resposta.headers["access-control-allow-methods"]).toContain("POST");
  });
});
