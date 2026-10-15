import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarAcervo, processarFilaDeMidia } from "../../src/acervo/acervo.ts";
import { abrirArmazenamentoSqlite, type ArmazenamentoSqliteAberto } from "../../src/armazenamento/sqlite/armazenamento.ts";
import type { ArmazenamentoDoAcervo, ConteudoArmazenado } from "../../src/armazenamento/porta.ts";
import { exportar as exportarPacote } from "../../src/exportacao/exportar.ts";
import { FORMATOS_DE_EXPORTACAO } from "../../src/exportacao/formatos.ts";
import { lerPacoteAnki } from "../../src/importacao/anki.ts";
import { criarArmazemEmDisco } from "../../src/midia/armazem-em-disco.ts";
import type { ArmazemDeMidia } from "../../src/midia/armazem.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";
import { jpegComMetadados, pngComMetadados, webpComMetadados } from "../midia/amostras.ts";
import { amostraMp3 } from "../midia/amostras-de-audio/mp3.ts";
import { amostraWav } from "../midia/amostras-de-audio/wav.ts";

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
      ok: true, baralhos: 2, cartoes: 1, nomeDoArquivo: expect.stringMatching(/^memorization-\d{4}-\d{2}-\d{2}\.apkg$/),
    });
  });

  it("'todos' com um só baralho também usa memorization-AAAA-MM-DD (FR-474)", async () => {
    await acervo.criarCartao(baralhoId, { frente: "hello", verso: "olá" });

    await expect(acervo.exportar({ formato: "apkg", baralhos: "todos", idioma: "pt", fuso: "UTC" })).resolves.toMatchObject({
      ok: true, baralhos: 1, nomeDoArquivo: expect.stringMatching(/^memorization-\d{4}-\d{2}-\d{2}\.apkg$/),
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

  it("recusa um formato desconhecido como dados inválidos, sem URL", async () => {
    await acervo.criarCartao(baralhoId, { frente: "hello", verso: "olá" });

    await expect(acervo.previaDaExportacao({ formato: "csv", baralhos: [baralhoId] })).resolves.toEqual({
      ok: false, erro: "dados_invalidos",
    });
    const resultado = await acervo.exportar({ formato: "csv", baralhos: [baralhoId], idioma: "pt", fuso: "UTC" });
    expect(resultado).toEqual({ ok: false, erro: "dados_invalidos" });
    expect(resultado).not.toHaveProperty("url");
  });

  it("a prévia leva formato e extensão do registro FORMATOS_DE_EXPORTACAO (FR-462)", async () => {
    await acervo.criarCartao(baralhoId, { frente: "hello", verso: "olá" });
    const registro = FORMATOS_DE_EXPORTACAO.get("apkg")!;

    await expect(acervo.previaDaExportacao({ formato: "apkg", baralhos: [baralhoId] })).resolves.toMatchObject({
      ok: true, previa: { formato: registro.id, extensao: registro.extensao },
    });
  });

  it("recusa mais de 10.000 cartões sem ler nem medir a mídia", async () => {
    const ler = vi.fn(async () => null);
    const medir = vi.fn(async () => 0);
    const cartoes = Array.from({ length: 10_001 }, (_, i) => cartaoFalso(`c${i}`, { tipo: "imagem", imagemChave: `imagens/u/${i}.png` }));
    const alvo = acervoComSnapshot(conteudoCom(cartoes), { ...imagens, ler, medir });

    const previa = await alvo.previaDaExportacao({ formato: "apkg", baralhos: "todos" });
    expect(previa).toEqual({ ok: false, erro: "exportacao_grande_demais", motivo: "cartoes", limite: 10_000 });
    const resultado = await alvo.exportar({ formato: "apkg", baralhos: "todos", idioma: "pt", fuso: "UTC" });
    expect(resultado).toEqual({ ok: false, erro: "exportacao_grande_demais", motivo: "cartoes", limite: 10_000 });
    expect(resultado).not.toHaveProperty("url");
    expect(ler).not.toHaveBeenCalled();
    expect(medir).not.toHaveBeenCalled();
  });

  it("recusa mídia acima de 104.857.600 bytes com motivo midia", async () => {
    const midiaGrande: ArmazemDeMidia = { ...imagens, medir: async () => 104_857_601 };
    const alvo = acervoComSnapshot(conteudoCom([cartaoFalso("c1", { tipo: "imagem", imagemChave: "imagens/u/a.png" })]), midiaGrande);

    await expect(alvo.previaDaExportacao({ formato: "apkg", baralhos: "todos" })).resolves.toEqual({
      ok: false, erro: "exportacao_grande_demais", motivo: "midia", limite: 104_857_600,
    });
  });

  it("conta cartões com imagem e com áudio na prévia", async () => {
    const medir = async () => 0;
    const alvo = acervoComSnapshot(conteudoCom([
      cartaoFalso("i1", { tipo: "imagem", imagemChave: "imagens/u/1.png" }),
      cartaoFalso("i2", { tipo: "imagem", imagemChave: "imagens/u/2.png" }),
      cartaoFalso("a1", { tipo: "audio", audioChave: "audios/u/1.mp3" }),
    ]), { ...imagens, medir });

    await expect(alvo.previaDaExportacao({ formato: "apkg", baralhos: "todos" })).resolves.toMatchObject({
      ok: true, previa: { cartoes: 3, cartoesComImagem: 2, cartoesComAudio: 1 },
    });
  });

  it("exporta mesmo com mídia ausente no armazém e conta o cartão em cartoesSemMidia", async () => {
    const semMidia: ArmazemDeMidia = { ...imagens, ler: async () => null, medir: async () => 0 };
    const alvo = acervoComSnapshot(conteudoCom([cartaoFalso("c1", { tipo: "imagem", imagemChave: "imagens/u/a.png" })]), semMidia);

    await expect(alvo.exportar({ formato: "apkg", baralhos: "todos", idioma: "pt", fuso: "UTC" })).resolves.toMatchObject({
      ok: true, cartoes: 1, cartoesSemMidia: 1,
    });
  });

  it("responde exportacao_indisponivel, sem URL, quando o armazém de mídia falha na leitura", async () => {
    const lerFalha: ArmazemDeMidia = {
      ...imagens,
      medir: async () => 0,
      ler: async () => { throw new Error("armazém fora do ar"); },
    };
    const alvo = acervoComSnapshot(conteudoCom([cartaoFalso("c1", { tipo: "imagem", imagemChave: "imagens/u/a.png" })]), lerFalha);

    const resultado = await alvo.exportar({ formato: "apkg", baralhos: "todos", idioma: "pt", fuso: "UTC" });
    expect(resultado).toEqual({ ok: false, erro: "exportacao_indisponivel" });
    expect(resultado).not.toHaveProperty("url");
  });

  it("usa o conteúdo lido no início mesmo se um cartão for editado depois da leitura (FR-473)", async () => {
    const criado = await acervo.criarCartao(baralhoId, { frente: "hello", verso: "olá" });
    if (!criado.ok) throw new Error("cartão recusado");
    const cartaoId = criado.cartao.id;
    const armazenamento: ArmazenamentoDoAcervo = {
      ...aberto.armazenamento,
      async lerAcervoParaExportacao(usuarioId, baralhos) {
        const lido = await aberto.armazenamento.lerAcervoParaExportacao(usuarioId, baralhos);
        await acervo.editarCartao(cartaoId, { frente: "editado", verso: "editado" });
        return lido;
      },
    };
    const comLeituraAntiga = criarAcervo(armazenamento, dono, { imagens });

    const resultado = await comLeituraAntiga.exportar({ formato: "apkg", baralhos: [baralhoId], idioma: "pt", fuso: "UTC" });
    expect(resultado).toMatchObject({ ok: true });
    const guardado = await readFile(join(pasta, "exportacoes", dono));
    const previa = await lerPacoteAnki(guardado);
    const frentes = previa.baralhos.flatMap((b) => b.cartoes.map((c) => c.frente));
    expect(frentes).toEqual(["hello"]);
  });

  it("guarda exatamente os bytes que exportar gera para o mesmo conteúdo", async () => {
    const agora = new Date("2026-10-15T12:00:00Z");
    const criado = await acervo.criarCartao(baralhoId, { frente: "hello", verso: "olá" });
    if (!criado.ok) throw new Error("cartão recusado");
    const comRelogio = criarAcervo(aberto.armazenamento, dono, { imagens, agora: () => agora });

    const resultado = await comRelogio.exportar({ formato: "apkg", baralhos: [baralhoId], idioma: "pt", fuso: "UTC" });
    expect(resultado).toMatchObject({ ok: true });
    const guardado = await readFile(join(pasta, "exportacoes", dono));
    const esperado = await exportarPacote({
      baralhos: [{
        id: baralhoId,
        nome: "Inglês",
        cartoes: [{ id: criado.cartao.id, tipo: "frente-verso", frente: "hello", verso: "olá", tags: [], progresso: null }],
      }],
    }, "apkg", { agora, fuso: "UTC", idioma: "pt", lerMidia: async () => null, pedidoDeTodos: false });
    expect(Buffer.from(guardado).equals(Buffer.from(esperado.bytes))).toBe(true);
  });

  it("'todos' sem nenhum cartão responde exportacao_vazia", async () => {
    await expect(acervo.previaDaExportacao({ formato: "apkg", baralhos: "todos" })).resolves.toEqual({
      ok: false, erro: "exportacao_vazia",
    });
    await expect(acervo.exportar({ formato: "apkg", baralhos: "todos", idioma: "pt", fuso: "UTC" })).resolves.toEqual({
      ok: false, erro: "exportacao_vazia",
    });
  });

  it("mistura de id próprio e id alheio responde nao_encontrado", async () => {
    const outroDono = await criarDonoDeTeste(aberto.usuarios, "dono-tres", "terceiro.usuario");
    const outroAcervo = criarAcervo(aberto.armazenamento, outroDono, { imagens });
    const alheio = await outroAcervo.criarBaralho({ nome: "Alheio" });
    if (!alheio.ok) throw new Error("baralho recusado");
    await acervo.criarCartao(baralhoId, { frente: "hello", verso: "olá" });

    await expect(acervo.previaDaExportacao({ formato: "apkg", baralhos: [baralhoId, alheio.baralho.id] })).resolves.toEqual({
      ok: false, erro: "nao_encontrado",
    });
    await expect(acervo.exportar({ formato: "apkg", baralhos: [baralhoId, alheio.baralho.id], idioma: "pt", fuso: "UTC" })).resolves.toEqual({
      ok: false, erro: "nao_encontrado",
    });
  });

  it("a prévia de cartões de texto funciona sem armazém de mídia configurado", async () => {
    const semArmazem = criarAcervo(aberto.armazenamento, dono);
    const criado = await semArmazem.criarBaralho({ nome: "Sem mídia" });
    if (!criado.ok) throw new Error("baralho recusado");
    await semArmazem.criarCartao(criado.baralho.id, { frente: "hello", verso: "olá" });

    await expect(semArmazem.previaDaExportacao({ formato: "apkg", baralhos: [criado.baralho.id] })).resolves.toMatchObject({
      ok: true, previa: { cartoes: 1, cartoesComImagem: 0, cartoesComAudio: 0 },
    });
  });
});

describe("tamanho aproximado da prévia (FR-472, research R6)", () => {
  it("bytesEstimados fica a até 20% do arquivo real numa coleção mista de texto, Imagem e Áudio", async () => {
    for (let i = 0; i < 30; i += 1) {
      await acervo.criarCartao(baralhoId, { frente: textoDeTamanho(i, 20 + ((i * 17) % 61)), verso: textoDeTamanho(i + 3, 20 + ((i * 23) % 61)) });
    }
    for (const bytes of [pngComMetadados(), jpegComMetadados(), webpComMetadados()]) {
      const criado = await acervo.criarCartao(baralhoId, { tipo: "imagem", imagemId: await enviarMidia("imagem", bytes), frente: "", verso: "Pernambuco" });
      expect(criado.ok).toBe(true);
    }
    for (const bytes of [amostraWav({ segundos: 1 }), amostraMp3({ quadros: 100 })]) {
      const criado = await acervo.criarCartao(baralhoId, { tipo: "audio", audioId: await enviarMidia("audio", bytes), frente: "", verso: "Obrigado" });
      expect(criado.ok).toBe(true);
    }

    await conferirEstimativaContraArquivo();
  });

  it("bytesEstimados fica a até 20% do arquivo real numa coleção só de texto, com 200 cartões", async () => {
    for (let i = 0; i < 200; i += 1) {
      await acervo.criarCartao(baralhoId, { frente: textoDeTamanho(i, 20 + ((i * 17) % 61)), verso: textoDeTamanho(i + 3, 20 + ((i * 23) % 61)) });
    }

    await conferirEstimativaContraArquivo();
  });
});

/** Um texto de `tamanho` caracteres, com palavras comuns e sem espaço no fim. */
function textoDeTamanho(semente: number, tamanho: number): string {
  let texto = "";
  for (let i = semente; texto.length < tamanho; i += 7) {
    texto += `${texto ? " " : ""}${PALAVRAS_DE_TESTE[i % PALAVRAS_DE_TESTE.length]}`;
  }
  return texto.slice(0, tamanho).trimEnd();
}

const PALAVRAS_DE_TESTE = "casa água luz música rio jardim janela café manhã amigo viagem carta mercado número prata lápis time house water garden window friend letter market silver pencil".split(" ");

/** Envia a Mídia como o navegador faria e devolve o id do envio. */
async function enviarMidia(midia: "imagem" | "audio", bytes: Uint8Array): Promise<string> {
  const envio = await imagens.prepararEnvio(dono, midia);
  const token = new URL(envio.envio.url, "http://local").searchParams.get("t")!;
  expect(await imagens.receberEnvio(token, bytes)).toBe("ok");
  return envio.envioId;
}

/** Confere a prévia contra o arquivo que o `exportar` guarda para o mesmo acervo. */
async function conferirEstimativaContraArquivo(): Promise<void> {
  const previa = await acervo.previaDaExportacao({ formato: "apkg", baralhos: "todos" });
  if (!previa.ok) throw new Error("prévia recusada");
  const resultado = await acervo.exportar({ formato: "apkg", baralhos: "todos", idioma: "pt", fuso: "UTC" });
  if (!resultado.ok) throw new Error("exportação recusada");
  const real = (await readFile(join(pasta, "exportacoes", dono))).byteLength;
  const estimado = previa.previa.bytesEstimados;
  expect(Math.abs(estimado - real) / real).toBeLessThanOrEqual(0.2);
}

function conteudoCom(cartoes: ConteudoArmazenado["baralhos"][number]["cartoes"]): ConteudoArmazenado {
  return { baralhos: [{ id: "00000000-0000-4000-8000-000000000001", nome: "Grande", criadoEm: null, cartoes }] };
}

function cartaoFalso(id: string, extra: { tipo?: "frente-verso" | "imagem" | "audio"; imagemChave?: string; audioChave?: string } = {}) {
  return { id, frente: `Frente ${id}`, verso: "Verso", tipo: extra.tipo ?? "frente-verso", tags: [], progresso: null, ...extra };
}

/** Acervo cujo Port devolve sempre `conteudo` como leitura para exportação. */
function acervoComSnapshot(conteudo: ConteudoArmazenado, midia: ArmazemDeMidia) {
  const armazenamento: ArmazenamentoDoAcervo = {
    ...aberto.armazenamento,
    async lerAcervoParaExportacao() {
      return { ok: true, valor: conteudo };
    },
  };
  return criarAcervo(armazenamento, dono, { imagens: midia });
}
