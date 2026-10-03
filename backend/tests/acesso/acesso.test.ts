import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ACESSO_EXPIRADO,
  criarAcessos,
  validadeConfigurada,
  type Acessos,
} from "../../src/acesso/acesso.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "./../armazenamento/usuarios-de-teste.ts";

/**
 * O Module `Acessos` (018; FR-289, FR-291, FR-294, FR-297, FR-301, FR-306):
 * valor opaco de 256 bits, **só o digest guardado**, validade deslizante do
 * servidor, expiração, encerramento e o formato do cookie.
 */

let aberto: ArmazenamentoSqliteAberto;
let instante: number;
let acessos: Acessos;

/** O relógio do servidor, controlado pelo teste. */
function agora(): Date {
  return new Date(instante);
}

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  instante = Date.parse("2026-03-01T12:00:00.000Z");
  acessos = criarAcessos(aberto.acessos, {
    validadeEmSegundos: 300,
    agora,
  });
  await criarDonoDeTeste(aberto.usuarios, "u1", "ana.silva");
  await criarDonoDeTeste(aberto.usuarios, "u2", "bruno.souza");
});

afterEach(async () => {
  await aberto.encerrar();
});

describe("emitir e autorizar", () => {
  it("emite um valor opaco de 256 bits, diferente a cada emissão (FR-297, FR-306)", async () => {
    const um = await acessos.emitir("u1");
    const outro = await acessos.emitir("u1");

    expect(um.ok && outro.ok).toBe(true);

    if (um.ok && outro.ok) {
      // 32 bytes em base64url são 43 caracteres.
      expect(um.valor).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(um.valor).not.toBe(outro.valor);
    }
  });

  it("autoriza o Acesso válido e devolve o dono (FR-289)", async () => {
    const emitido = await acessos.emitir("u1");

    expect(emitido.ok && (await acessos.autorizar(emitido.valor))).toEqual({
      ok: true,
      usuarioId: "u1",
    });
  });

  it("sem valor ou com valor desconhecido é sem_acesso", async () => {
    expect(await acessos.autorizar(undefined)).toEqual({
      ok: false,
      erro: "sem_acesso",
    });
    expect(await acessos.autorizar("inventado")).toEqual({
      ok: false,
      erro: "sem_acesso",
    });
  });

  it("a validade é deslizante: cada autorização a renova por mais 5 minutos (FR-291)", async () => {
    const emitido = await acessos.emitir("u1");
    const valor = emitido.ok ? emitido.valor : "";

    // 4 minutos depois, ainda vale — e renova.
    instante += 4 * 60_000;
    expect(await acessos.autorizar(valor)).toMatchObject({ ok: true });

    // Mais 4 minutos: sem a renovação, o Acesso original já teria vencido.
    instante += 4 * 60_000;
    expect(await acessos.autorizar(valor)).toMatchObject({ ok: true });

    // 5 minutos sem nenhuma ação: expira (FR-294).
    instante += 5 * 60_000;
    expect(await acessos.autorizar(valor)).toEqual({
      ok: false,
      erro: "acesso_expirado",
    });
  });

  it("decide pelo relógio do servidor, no instante exato do vencimento (FR-297)", async () => {
    const quaseVencido = await acessos.emitir("u1");
    const vencido = await acessos.emitir("u2");

    instante += 300_000 - 1;
    expect(quaseVencido.ok && (await acessos.autorizar(quaseVencido.valor))).toMatchObject({
      ok: true,
    });

    // `expiraEm <= agora` é expirado: o outro vence exatamente em +300 s.
    instante += 1;
    expect(vencido.ok && (await acessos.autorizar(vencido.valor))).toEqual({
      ok: false,
      erro: "acesso_expirado",
    });
  });

  it("limpa os expirados preguiçosamente ao emitir (D7)", async () => {
    const velho = await acessos.emitir("u1");

    instante += 10 * 60_000;
    await acessos.emitir("u2");

    expect(velho.ok && (await acessos.autorizar(velho.valor))).toEqual({
      ok: false,
      erro: "sem_acesso",
    });
  });
});

describe("encerrar", () => {
  it("encerra só o Acesso indicado e é idempotente (FR-293, FR-295)", async () => {
    const a = await acessos.emitir("u1");
    const b = await acessos.emitir("u1");

    expect(a.ok && b.ok).toBe(true);

    if (a.ok && b.ok) {
      expect(await acessos.encerrar(a.valor)).toEqual({ ok: true });
      expect(await acessos.encerrar(a.valor)).toEqual({ ok: true });
      expect(await acessos.encerrar(undefined)).toEqual({ ok: true });
      expect(await acessos.autorizar(a.valor)).toMatchObject({
        ok: false,
        erro: "sem_acesso",
      });
      expect(await acessos.autorizar(b.valor)).toMatchObject({ ok: true });
    }
  });

  it("encerra todos os Acessos do Usuário e preserva os do outro (FR-296, FR-299)", async () => {
    const a = await acessos.emitir("u1");
    const b = await acessos.emitir("u1");
    const c = await acessos.emitir("u2");

    await acessos.encerrarTodosDoUsuario("u1");

    expect(a.ok && (await acessos.autorizar(a.valor))).toMatchObject({
      ok: false,
    });
    expect(b.ok && (await acessos.autorizar(b.valor))).toMatchObject({
      ok: false,
    });
    expect(c.ok && (await acessos.autorizar(c.valor))).toEqual({
      ok: true,
      usuarioId: "u2",
    });
  });
});

describe("falha do armazenamento (FR-301)", () => {
  it("é indisponivel, e nunca expiração ou ausência", async () => {
    const emitido = await acessos.emitir("u1");
    const valor = emitido.ok ? emitido.valor : "";

    aberto.acessos.obterValido = async () => ({
      ok: false,
      erro: "indisponivel",
    });

    expect(await acessos.autorizar(valor)).toEqual({
      ok: false,
      erro: "indisponivel",
    });
  });

  it("emitir para Usuário inexistente falha como indisponivel", async () => {
    expect(await acessos.emitir("ninguem")).toEqual({
      ok: false,
      erro: "indisponivel",
    });
  });
});

describe("cookie", () => {
  it("entrega o Acesso em cookie HttpOnly, SameSite=Strict, Path=/ e Max-Age longo (D2)", () => {
    const cookie = acessos.cookieDeAcesso("abc");

    expect(cookie).toBe(
      "acesso=abc; HttpOnly; SameSite=Strict; Path=/; Max-Age=34560000",
    );
  });

  it("leva Secure na nuvem, e só nela", () => {
    const seguro = criarAcessos(aberto.acessos, { cookieSeguro: true });

    expect(seguro.cookieDeAcesso("abc")).toMatch(/; Secure$/);
    expect(seguro.cookieDeLimpeza()).toMatch(/; Secure$/);
    expect(acessos.cookieDeAcesso("abc")).not.toContain("Secure");
  });

  it("descarta o Acesso com Max-Age=0", () => {
    expect(acessos.cookieDeLimpeza()).toBe(
      "acesso=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
    );
  });

  it("lê o valor do cabeçalho Cookie entre outros cookies", () => {
    expect(acessos.valorDoCookie("a=1; acesso=xyz; b=2")).toBe("xyz");
    expect(acessos.valorDoCookie("acesso=xyz")).toBe("xyz");
    expect(acessos.valorDoCookie("outro=1")).toBeUndefined();
    expect(acessos.valorDoCookie("acesso=")).toBeUndefined();
    expect(acessos.valorDoCookie(undefined)).toBeUndefined();
  });

  it("a mensagem de expiração é a exigida pela spec (FR-294)", () => {
    expect(ACESSO_EXPIRADO).toEqual({
      erro: "acesso_expirado",
      mensagem: "Seu acesso expirou. Entre novamente.",
    });
  });
});

describe("validadeConfigurada", () => {
  it("usa 300 segundos por padrão e aceita só inteiros positivos", () => {
    expect(validadeConfigurada({})).toBe(300);
    expect(validadeConfigurada({ ACESSO_VALIDADE_SEGUNDOS: "5" })).toBe(5);
    expect(() =>
      validadeConfigurada({ ACESSO_VALIDADE_SEGUNDOS: "0" }),
    ).toThrow(/ACESSO_VALIDADE_SEGUNDOS/);
    expect(() =>
      validadeConfigurada({ ACESSO_VALIDADE_SEGUNDOS: "abc" }),
    ).toThrow(/ACESSO_VALIDADE_SEGUNDOS/);
  });
});

describe("só o digest é guardado (FR-297, SC-116)", () => {
  const diretorio = mkdtempSync(join(tmpdir(), "acesso-digest-"));

  afterEach(() => {
    rmSync(diretorio, { recursive: true, force: true });
  });

  it("a linha contém o SHA-256 do valor, e o valor em claro não aparece no arquivo", async () => {
    const caminho = join(diretorio, "digest.sqlite");
    const emArquivo = await abrirArmazenamentoSqlite(caminho);

    try {
      await criarDonoDeTeste(emArquivo.usuarios, "u1", "ana.silva");

      const emitido = await criarAcessos(emArquivo.acessos).emitir("u1");

      expect(emitido.ok).toBe(true);

      const valor = emitido.ok ? emitido.valor : "";
      const banco = new DatabaseSync(caminho, { readOnly: true });

      try {
        const linhas = banco
          .prepare("SELECT * FROM acesso_temporario")
          .all() as Record<string, unknown>[];

        expect(linhas).toHaveLength(1);
        expect(linhas[0]?.digest).toBe(
          createHash("sha256").update(valor, "utf8").digest("hex"),
        );
        expect(JSON.stringify(linhas)).not.toContain(valor);
      } finally {
        banco.close();
      }
    } finally {
      await emArquivo.encerrar();
    }
  });
});
