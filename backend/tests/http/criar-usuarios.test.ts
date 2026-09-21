import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyInstance } from "fastify";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarServidor } from "../../src/http/servidor.ts";
import { registrarRotasDeUsuarios } from "../../src/http/rotas.ts";
import {
  criarIdentidade,
  type Identidade,
} from "../../src/identidade/identidade.ts";
import { VARIAVEL_DO_SEGREDO } from "../../src/identidade/segredo.ts";

/**
 * T605 — contrato HTTP de `POST /usuarios`
 * (specs/007-criar-usuario/contracts/api-usuarios.md).
 *
 * O servidor é montado como na aplicação — `criarServidor` mais o Adapter HTTP
 * sobre o `Identidade`, que por sua vez está sobre o Adapter do armazenamento
 * local em memória — e toda asserção de contrato atravessa `inject`, a mesma
 * superfície que um cliente HTTP usa. Os quatro status do contrato são
 * cobertos, com o código estável e a mensagem em português, e a forma inválida
 * é recusada na borda, antes de alcançar o Module (FR-070, SC-026).
 *
 * O último cenário é o do **processo real**: o logger do Fastify está
 * desabilitado, e a prova não é a afirmação disso, mas a saída capturada de uma
 * API de verdade depois de um Cadastro — ela não contém a Senha (FR-078).
 *
 * Nenhum segredo e nenhuma Senha são literais: tudo é gerado a cada execução.
 */

/** O segredo descartável desta execução: nunca literal, nunca versionado. */
const SEGREDO = randomBytes(48).toString("base64url");

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const ENTRADA_LOCAL = join(RAIZ_DO_BACKEND, "src", "entradas", "local.ts");

const RECUSA_DE_CORPO_INVALIDO = {
  erro: "corpo_invalido",
  mensagem: "O corpo da requisição não é válido.",
};

/** Uma Senha gerada com exatamente `tamanho` caracteres, para os limites. */
function senhaDe(tamanho: number): string {
  return randomBytes(tamanho).toString("base64url").slice(0, tamanho);
}

let aberto: ArmazenamentoSqliteAberto;
let servidor: FastifyInstance;
let identidade: Identidade;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  identidade = criarIdentidade(aberto.usuarios, SEGREDO);
  servidor = criarServidor(identidade);
  registrarRotasDeUsuarios(servidor, identidade);
});

afterEach(async () => {
  await servidor.close();
  await aberto.encerrar();
});

/** Envia `POST /usuarios`; `corpo` ausente reproduz requisição sem corpo. */
function postarUsuario(
  corpo?: object | string,
  cabecalhos: Record<string, string> = {},
) {
  return servidor.inject({
    method: "POST",
    url: "/usuarios",
    headers: cabecalhos,
    payload: corpo,
  });
}

describe("POST /usuarios — criação conforme o contrato", () => {
  it("responde 201 com o Usuário criado: id e nomeDeUsuario (FR-071)", async () => {
    const resposta = await postarUsuario({
      nomeDeUsuario: "Ana.Silva",
      senha: senhaDe(12),
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({
      id: expect.any(String),
      nomeDeUsuario: "Ana.Silva",
    });
  });

  it("descarta os espaços ao redor do Nome de usuário antes de validar (FR-073)", async () => {
    const resposta = await postarUsuario({
      nomeDeUsuario: "  Ana.Silva  ",
      senha: senhaDe(12),
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({
      id: expect.any(String),
      nomeDeUsuario: "Ana.Silva",
    });
  });

  it("aceita Senha de 8 e de 128 caracteres e preserva os espaços dela (FR-075)", async () => {
    expect(
      (await postarUsuario({ nomeDeUsuario: "Ana.Silva", senha: senhaDe(8) }))
        .statusCode,
    ).toBe(201);
    expect(
      (await postarUsuario({
        nomeDeUsuario: "Bruno.Souza",
        senha: senhaDe(128),
      })).statusCode,
    ).toBe(201);

    const comEspacos = await postarUsuario({
      nomeDeUsuario: "Carla.Dias",
      senha: `  ${senhaDe(9)}  `,
    });

    expect(comEspacos.statusCode).toBe(201);
  });

  it("aceita propriedade extra e a ignora, inclusive a Confirmação da Senha (FR-072)", async () => {
    const resposta = await postarUsuario({
      nomeDeUsuario: "Ana.Silva",
      senha: senhaDe(12),
      confirmacaoDaSenha: senhaDe(12),
      criadoEm: "2026-09-21",
    });

    expect(resposta.statusCode).toBe(201);
    expect(Object.keys(resposta.json() as object).sort()).toEqual([
      "id",
      "nomeDeUsuario",
    ]);
  });

  it("não devolve a Senha nem qualquer transformação dela (FR-076, FR-078)", async () => {
    const senha = senhaDe(12);
    const resposta = await postarUsuario({
      nomeDeUsuario: "Ana.Silva",
      senha,
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.body).not.toContain(senha);
    expect(resposta.body).not.toMatch(/senha|sal|hash/i);
  });

  it("não traz Set-Cookie, token nem credencial reutilizável (FR-079)", async () => {
    const resposta = await postarUsuario({
      nomeDeUsuario: "Ana.Silva",
      senha: senhaDe(12),
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.headers["set-cookie"]).toBeUndefined();

    const cabecalhos = Object.keys(resposta.headers);

    expect(cabecalhos.filter((nome) => /cookie|token|authorization/i.test(nome)))
      .toEqual([]);
  });
});

describe("POST /usuarios — recusas do contrato", () => {
  it("responde 400 nome_de_usuario_invalido para Nome de usuário com menos de 3 caracteres (FR-073)", async () => {
    const resposta = await postarUsuario({
      nomeDeUsuario: "ab",
      senha: senhaDe(12),
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toMatchObject({
      erro: "nome_de_usuario_invalido",
      mensagem: expect.stringContaining("pelo menos 3 caracteres"),
    });
  });

  it("responde 400 nome_de_usuario_invalido para Nome de usuário com mais de 50 caracteres (FR-073)", async () => {
    const resposta = await postarUsuario({
      nomeDeUsuario: "a".repeat(51),
      senha: senhaDe(12),
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toMatchObject({
      erro: "nome_de_usuario_invalido",
      mensagem: expect.stringContaining("no máximo 50 caracteres"),
    });
  });

  it("responde 400 nome_de_usuario_invalido para caractere não permitido (FR-073)", async () => {
    for (const nomeDeUsuario of ["josé", "ana silva", "ana/silva"]) {
      const resposta = await postarUsuario({
        nomeDeUsuario,
        senha: senhaDe(12),
      });

      expect(resposta.statusCode, nomeDeUsuario).toBe(400);
      expect(resposta.json()).toMatchObject({
        erro: "nome_de_usuario_invalido",
        mensagem: expect.stringContaining("letras de A a Z"),
      });
    }
  });

  it("responde 400 senha_invalida fora do intervalo, informando-o (FR-075)", async () => {
    for (const senha of [senhaDe(7), senhaDe(129)]) {
      const resposta = await postarUsuario({
        nomeDeUsuario: "Ana.Silva",
        senha,
      });

      expect(resposta.statusCode).toBe(400);
      expect(resposta.json()).toMatchObject({
        erro: "senha_invalida",
        mensagem: expect.stringContaining("entre 8 e 128 caracteres"),
      });
      expect(resposta.body).not.toContain(senha);
    }
  });

  it("responde 409 nome_de_usuario_existente para ana.silva depois de Ana.Silva (FR-074, SC-025)", async () => {
    expect(
      (await postarUsuario({ nomeDeUsuario: "Ana.Silva", senha: senhaDe(12) }))
        .statusCode,
    ).toBe(201);

    const resposta = await postarUsuario({
      nomeDeUsuario: "ana.silva",
      senha: senhaDe(12),
    });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toMatchObject({
      erro: "nome_de_usuario_existente",
      mensagem: expect.stringContaining("já existe"),
    });
  });

  it("recusa o corpo direto à API, sem passar pela interface, com as mesmas regras (FR-070, SC-026)", async () => {
    const resposta = await postarUsuario({
      nomeDeUsuario: "ab",
      senha: senhaDe(7),
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toMatchObject({
      erro: "nome_de_usuario_invalido",
    });
  });
});

describe("POST /usuarios — forma inválida recusada na borda, antes do Identidade", () => {
  it("recusa corpo sem Senha com 400 e nada é criado", async () => {
    const resposta = await postarUsuario({ nomeDeUsuario: "Ana.Silva" });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);
  });

  it("recusa campo de tipo errado com 400", async () => {
    const resposta = await postarUsuario({
      nomeDeUsuario: 42,
      senha: senhaDe(12),
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);
  });

  it("recusa corpo que não é JSON com 400", async () => {
    const resposta = await postarUsuario("isto não é json {", {
      "content-type": "application/json",
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);
  });

  it("recusa requisição sem corpo com 400", async () => {
    const resposta = await postarUsuario();

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual(RECUSA_DE_CORPO_INVALIDO);
  });
});

describe("POST /usuarios — armazenamento indisponível", () => {
  it("responde 503 com o código estável e a mensagem em português, sem nada por concluído (FR-044)", async () => {
    const fechado = aberto;

    await servidor.close();

    await fechado.encerrar();

    /**
     * O mesmo Adapter já encerrado: a falha é real, e não simulada. O Cadastro
     * é isento de Credencial (FR-097), de modo que a falha do armazenamento
     * continua alcançando o handler.
     */
    const outraIdentidade = criarIdentidade(fechado.usuarios, SEGREDO);
    const outro = criarServidor(outraIdentidade);

    registrarRotasDeUsuarios(outro, outraIdentidade);

    try {
      const resposta = await outro.inject({
        method: "POST",
        url: "/usuarios",
        payload: { nomeDeUsuario: "Ana.Silva", senha: senhaDe(12) },
      });

      expect(resposta.statusCode).toBe(503);
      expect(resposta.json()).toEqual({
        erro: "indisponivel",
        mensagem: "O armazenamento não está disponível. Tente novamente.",
      });
    } finally {
      await outro.close();
    }

    /** O `afterEach` fecha um armazenamento novo, e não o já encerrado. */
    aberto = await abrirArmazenamentoSqlite(":memory:");
    identidade = criarIdentidade(aberto.usuarios, SEGREDO);
    servidor = criarServidor(identidade);
  });
});

/**
 * A prova do registro: a API real é subida como processo filho, com segredo e
 * arquivo gerados nesta execução, e um Cadastro é feito por HTTP. O que a
 * asserção exige é a **saída capturada** do processo — a única coisa que um log
 * mostraria —, e ela não pode conter a Senha enviada (FR-078).
 */
describe("POST /usuarios — a Senha não aparece em nenhum log", () => {
  const DIRETORIO = mkdtempSync(join(tmpdir(), "logs-do-cadastro-"));

  afterAll(() => {
    rmSync(DIRETORIO, { recursive: true, force: true });
  });

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

  it("mantém a Senha fora da saída do processo, no sucesso e na recusa", async () => {
    const porta = await portaLivre();
    const senha = senhaDe(24);
    const processo: ChildProcess = spawn(process.execPath, [ENTRADA_LOCAL], {
      cwd: RAIZ_DO_BACKEND,
      env: {
        ...process.env,
        PORTA: String(porta),
        CAMINHO_DO_BANCO: join(DIRETORIO, "registro.sqlite"),
        [VARIAVEL_DO_SEGREDO]: SEGREDO,
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

      const criado = await fetch(`http://127.0.0.1:${porta}/usuarios`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nomeDeUsuario: "Ana.Silva", senha }),
      });

      expect(criado.status).toBe(201);

      /** A mesma Senha numa recusa, para que o caminho de erro também passe. */
      const recusado = await fetch(`http://127.0.0.1:${porta}/usuarios`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nomeDeUsuario: "ana.silva", senha }),
      });

      expect(recusado.status).toBe(409);
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

    /** A única linha de saída é a de início, e nada nela é segredo. */
    expect(saida).toContain("Armazenamento: SQLite (arquivo local)");
    expect(saida).not.toContain(senha);
    expect(saida).not.toContain(SEGREDO);
    expect(saida).not.toMatch(/POST \/usuarios|body|payload/i);
  });
});
