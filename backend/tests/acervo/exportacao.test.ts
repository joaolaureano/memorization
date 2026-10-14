import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarAcervo, processarFilaDeMidia } from "../../src/acervo/acervo.ts";
import { abrirArmazenamentoSqlite, type ArmazenamentoSqliteAberto } from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarArmazemEmDisco } from "../../src/midia/armazem-em-disco.ts";
import type { ArmazemDeMidia } from "../../src/midia/armazem.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

let aberto: ArmazenamentoSqliteAberto;
let pasta: string;
let dono: string;
let acervo: ReturnType<typeof criarAcervo>;
let baralhoId: string;
let imagens: ReturnType<typeof criarArmazemEmDisco>;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  dono = await criarDonoDeTeste(aberto.usuarios);
  pasta = mkdtempSync(join(tmpdir(), "exportacao-acervo-"));
  imagens = criarArmazemEmDisco({ pasta });
  acervo = criarAcervo(aberto.armazenamento, dono, { imagens });
  const baralho = await acervo.criarBaralho({ nome: "Inglês" });
  if (!baralho.ok) throw new Error("baralho recusado");
  baralhoId = baralho.baralho.id;
});

afterEach(async () => {
  await aberto.encerrar();
  await rm(pasta, { recursive: true, force: true });
});

describe("exportação pelo Acervo", () => {
  it("gera e guarda um pacote do baralho escolhido", async () => {
    await acervo.criarCartao(baralhoId, { frente: "hello", verso: "olá", tags: ["vocabulário"] });

    await expect(acervo.previaDaExportacao({ formato: "apkg", baralhos: [baralhoId] })).resolves.toMatchObject({
      ok: true, previa: { formato: "apkg", baralhos: 1, cartoes: 1, cartoesComImagem: 0, cartoesComAudio: 0 },
    });
    const resultado = await acervo.exportar({
      formato: "apkg", baralhos: [baralhoId], idioma: "pt", fuso: "America/Sao_Paulo",
    });

    expect(resultado).toMatchObject({ ok: true, nomeDoArquivo: "Inglês.apkg", baralhos: 1, cartoes: 1 });
    if (!resultado.ok) throw new Error("exportação recusada");
    const guardado = await readFile(join(pasta, "exportacoes", dono));
    expect(guardado.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  it("recusa um baralho vazio e ids que não pertencem ao usuário", async () => {
    await expect(acervo.previaDaExportacao({ formato: "apkg", baralhos: [baralhoId] })).resolves.toMatchObject({
      ok: false, erro: "exportacao_vazia",
    });
    await expect(acervo.previaDaExportacao({ formato: "apkg", baralhos: ["ausente"] })).resolves.toMatchObject({
      ok: false, erro: "nao_encontrado",
    });
  });

  it("inclui os baralhos vazios ao exportar todos, se algum tem cartões", async () => {
    await acervo.criarCartao(baralhoId, { frente: "hello", verso: "olá" });
    const vazio = await acervo.criarBaralho({ nome: "Sem cartões" });
    if (!vazio.ok) throw new Error("baralho recusado");

    await expect(acervo.previaDaExportacao({ formato: "apkg", baralhos: "todos" })).resolves.toMatchObject({
      ok: true, previa: { baralhos: 2, cartoes: 1 },
    });
    await expect(acervo.exportar({ formato: "apkg", baralhos: "todos", idioma: "pt", fuso: "UTC" })).resolves.toMatchObject({
      ok: true, baralhos: 2, cartoes: 1, nomeDoArquivo: expect.stringMatching(/^Exportacao-\d{4}-\d{2}-\d{2}\.apkg$/),
    });
  });

  it("oculta baralhos de outro dono e mapeia falha ao guardar para indisponível", async () => {
    const outroDono = await criarDonoDeTeste(aberto.usuarios, "dono-dois", "outro.usuario");
    const outroAcervo = criarAcervo(aberto.armazenamento, outroDono, { imagens });
    const alheio = await outroAcervo.criarBaralho({ nome: "Privado" });
    if (!alheio.ok) throw new Error("baralho recusado");
    await expect(acervo.previaDaExportacao({ formato: "apkg", baralhos: [alheio.baralho.id] })).resolves.toMatchObject({
      ok: false, erro: "nao_encontrado",
    });

    await acervo.criarCartao(baralhoId, { frente: "hello", verso: "olá" });
    const indisponivel: ArmazemDeMidia = {
      ...imagens,
      guardarExportacao: async () => { throw new Error("store offline"); },
    };
    const comFalha = criarAcervo(aberto.armazenamento, dono, { imagens: indisponivel });
    await expect(comFalha.exportar({ formato: "apkg", baralhos: [baralhoId], idioma: "pt", fuso: "UTC" })).resolves.toEqual({
      ok: false, erro: "exportacao_indisponivel",
    });
  });

  it("remove o arquivo exportado pela fila de exclusão da conta", async () => {
    await acervo.criarCartao(baralhoId, { frente: "hello", verso: "olá" });
    const resultado = await acervo.exportar({
      formato: "apkg", baralhos: [baralhoId], idioma: "pt", fuso: "UTC",
    });
    if (!resultado.ok) throw new Error("exportação recusada");
    const caminho = join(pasta, "exportacoes", dono);
    expect(await readFile(caminho)).toBeDefined();

    expect((await aberto.usuarios.excluirUsuario(dono)).ok).toBe(true);
    await processarFilaDeMidia(aberto.armazenamento, imagens);

    await expect(readFile(caminho)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
  });

  it("preserva a chave na fila quando a remoção do arquivo falha e tenta de novo", async () => {
    await acervo.criarCartao(baralhoId, { frente: "hello", verso: "olá" });
    const resultado = await acervo.exportar({
      formato: "apkg", baralhos: [baralhoId], idioma: "pt", fuso: "UTC",
    });
    if (!resultado.ok) throw new Error("exportação recusada");
    const caminho = join(pasta, "exportacoes", dono);
    await aberto.usuarios.excluirUsuario(dono);
    const armazemQueFalha: ArmazemDeMidia = {
      ...imagens,
      remover: async () => { throw new Error("store offline"); },
    };

    await processarFilaDeMidia(aberto.armazenamento, armazemQueFalha);
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toContain(`exportacoes/${dono}`);
    await processarFilaDeMidia(aberto.armazenamento, imagens);
    await expect(readFile(caminho)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
  });
});
