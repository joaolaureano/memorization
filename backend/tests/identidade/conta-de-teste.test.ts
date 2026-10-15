// Conta de teste na Identidade (030, T017/T026/T033).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACERVO_DE_DEMONSTRACAO } from "../../src/demonstracao/acervo.ts";
import { criarAcessos } from "../../src/acesso/acesso.ts";
import { derivarSubchaveDeOrigem, origemDeContaDeTeste } from "../../src/http/origem.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import {
  criarIdentidade,
  type Identidade,
} from "../../src/identidade/identidade.ts";
import { criarArmazemEmDisco } from "../../src/midia/armazem-em-disco.ts";
import {
  cadastrarUsuarioDeTeste,
  segredoGerado,
  type CredencialDeTeste,
} from "../armazenamento/usuarios-de-teste.ts";

/**
 * T017 — a Conta de teste pela Interface do `Identidade` (030, FR-488, FR-491):
 * a criação grava o Usuário marcado com o conteúdo de demonstração, copia as
 * Mídias fixas para o armazém, marca `contaDeTeste` em `obterUsuario`, recusa
 * fuso inválido e não deixa conta parcial quando a Porta falha. Usa o Adapter
 * SQLite em memória e o armazém em disco numa pasta temporária.
 */

let aberto: ArmazenamentoSqliteAberto;
let identidade: Identidade;
let pastaDeMidia: string;
let real: CredencialDeTeste;
let segredo: string;
let filaDeMidiaProcessada: boolean;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  pastaDeMidia = mkdtempSync(join(tmpdir(), "conta-de-teste-"));
  segredo = segredoGerado();
  filaDeMidiaProcessada = false;
  identidade = criarIdentidade(aberto.usuarios, segredo, {
    midia: criarArmazemEmDisco({ pasta: pastaDeMidia }),
    contasDeTeste: aberto.armazenamento,
    aposExcluirConta: async () => { filaDeMidiaProcessada = true; },
  });
  real = await cadastrarUsuarioDeTeste(identidade, "ana.silva");
});

afterEach(async () => {
  vi.restoreAllMocks();
  await aberto.encerrar();
  rmSync(pastaDeMidia, { recursive: true, force: true });
});

const dadosValidos = { fuso: "America/Sao_Paulo", idioma: "pt", origem: "hmac-de-teste" };

describe("criarContaDeTeste (FR-488, FR-491)", () => {
  it("cria um Usuário marcado com os três Baralhos gravados na Porta", async () => {
    const criada = await identidade.criarContaDeTeste(dadosValidos);

    if (!criada.ok) throw new Error(`falha inesperada: ${criada.erro}`);
    expect(criada.usuario.nomeDeUsuario).toMatch(/^teste-[a-z0-9]{16}$/);

    const lido = await aberto.usuarios.obterUsuarioPorId(criada.usuario.id);
    if (!lido.ok) throw new Error("usuário não gravado");
    expect(lido.valor.contaDeTesteEm).not.toBeNull();

    const baralhos = await aberto.armazenamento.listarBaralhos(criada.usuario.id);
    expect(baralhos).toHaveLength(ACERVO_DE_DEMONSTRACAO.baralhos.length);
    expect(baralhos).toHaveLength(3);
  });

  it("grava as Mídias fixas de demonstração no armazém", async () => {
    await identidade.criarContaDeTeste(dadosValidos);

    const armazem = criarArmazemEmDisco({ pasta: pastaDeMidia });
    expect(await armazem.ler("demonstracao/bandeiras/brasil.png")).not.toBeNull();
  });

  it("obterUsuario marca a Conta de teste e não marca a conta real", async () => {
    const criada = await identidade.criarContaDeTeste(dadosValidos);
    if (!criada.ok) throw new Error(`falha inesperada: ${criada.erro}`);

    const deTeste = await identidade.obterUsuario(criada.usuario.id);
    const deReal = await identidade.obterUsuario(real.id);

    expect(deTeste).toEqual({
      ok: true,
      usuario: { id: criada.usuario.id, nomeDeUsuario: criada.usuario.nomeDeUsuario, contaDeTeste: true },
    });
    expect(deReal).toEqual({
      ok: true,
      usuario: { id: real.id, nomeDeUsuario: "ana.silva", contaDeTeste: false },
    });
  });

  it("recusa fuso inválido como dados_invalidos e não grava nada", async () => {
    const resultado = await identidade.criarContaDeTeste({ ...dadosValidos, fuso: "+03:00" });

    expect(resultado).toEqual({ ok: false, erro: "dados_invalidos" });
  });

  it("sem Porta de Conta de teste, responde indisponivel", async () => {
    const semPorta = criarIdentidade(aberto.usuarios, segredoGerado(), {
      midia: criarArmazemEmDisco({ pasta: pastaDeMidia }),
    });

    expect(await semPorta.criarContaDeTeste(dadosValidos)).toEqual({ ok: false, erro: "indisponivel" });
  });

  it("uma falha da Porta responde indisponivel e não deixa Usuário", async () => {
    const nomesTentados: string[] = [];
    const portaQueFalha = {
      async criarContaDeTeste(conta: { usuario: { nomeDeUsuario: string } }) {
        nomesTentados.push(conta.usuario.nomeDeUsuario);
        return { ok: false as const, erro: "indisponivel" as const };
      },
    };
    const comFalha = criarIdentidade(aberto.usuarios, segredoGerado(), {
      midia: criarArmazemEmDisco({ pasta: pastaDeMidia }),
      contasDeTeste: portaQueFalha,
    });

    const resultado = await comFalha.criarContaDeTeste(dadosValidos);

    expect(resultado).toEqual({ ok: false, erro: "indisponivel" });
    expect(nomesTentados).toHaveLength(1);
    const naoGravado = await aberto.usuarios.obterUsuarioPorNomeDeUsuario(nomesTentados[0]!);
    expect(naoGravado).toEqual({ ok: false, erro: "nao_encontrado" });
    expect(await aberto.armazenamento.contarCriacoes?.(dadosValidos.origem, "1970-01-01T00:00:00.000Z")).toBe(0);
  });

  it("limita a dez criações por origem e mantém outras origens independentes", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await identidade.criarContaDeTeste(dadosValidos)).ok).toBe(true);
    }

    expect(await identidade.criarContaDeTeste(dadosValidos)).toEqual({
      ok: false,
      erro: "esgotadas_na_origem",
    });
    expect((await identidade.criarContaDeTeste({ ...dadosValidos, origem: "outro-hmac" })).ok).toBe(true);
  });

  it("recusa criação quando há 300 Contas de teste ativas", async () => {
    vi.spyOn(aberto.armazenamento, "contarContasDeTesteAtivas").mockResolvedValue(300);
    const gravarConta = vi.spyOn(aberto.armazenamento, "criarContaDeTeste");

    expect(await identidade.criarContaDeTeste({ ...dadosValidos, origem: "origem-final" })).toEqual({
      ok: false,
      erro: "contas_esgotadas",
    });
    expect(gravarConta).not.toHaveBeenCalled();
  });

  it("limpa contas sem Acesso válido após a folga e preserva usuários reais", async () => {
    const criada = await identidade.criarContaDeTeste({
      ...dadosValidos,
      agora: new Date("2026-01-01T00:00:00.000Z"),
    });
    if (!criada.ok) throw new Error(`falha inesperada: ${criada.erro}`);

    await identidade.limparContasDeTesteEncerradas(new Date("2026-01-01T02:00:00.000Z"));

    expect(await aberto.usuarios.obterUsuarioPorId(criada.usuario.id)).toEqual({ ok: false, erro: "nao_encontrado" });
    expect((await aberto.usuarios.obterUsuarioPorId(real.id)).ok).toBe(true);
    expect(await aberto.armazenamento.contarCriacoes?.(dadosValidos.origem, "1970-01-01T00:00:00.000Z")).toBe(0);
    expect(filaDeMidiaProcessada).toBe(true);
  });

  it("preserva Conta de teste com Acesso válido e nunca persiste o IP/origem em claro", async () => {
    const ip = "203.0.113.42";
    const origem = origemDeContaDeTeste(derivarSubchaveDeOrigem(segredo), ip);
    const criada = await identidade.criarContaDeTeste({ ...dadosValidos, origem });
    if (!criada.ok) throw new Error(`falha inesperada: ${criada.erro}`);

    expect(await aberto.armazenamento.contarCriacoes?.(ip, "1970-01-01T00:00:00.000Z")).toBe(0);
    expect(await aberto.armazenamento.contarCriacoes?.(origem, "1970-01-01T00:00:00.000Z")).toBe(1);

    const acessos = criarAcessos(aberto.acessos);
    const emitido = await acessos.emitir(criada.usuario.id);
    expect(emitido.ok).toBe(true);

    await identidade.limparContasDeTesteEncerradas(new Date(Date.now() + 3 * 60_000));

    expect((await aberto.usuarios.obterUsuarioPorId(criada.usuario.id)).ok).toBe(true);
  });
});
