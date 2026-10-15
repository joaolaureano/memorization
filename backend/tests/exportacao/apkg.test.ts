import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import initSqlJs from "sql.js/dist/sql-asm.js";

import { exportar } from "../../src/exportacao/apkg/pacote.ts";
import { exportar as exportarPeloFormato } from "../../src/exportacao/exportar.ts";
import { FORMATOS_DE_EXPORTACAO, ehFormatoDeExportacao } from "../../src/exportacao/formatos.ts";
import { lerPacoteAnki } from "../../src/importacao/anki.ts";
import { gifComMetadados, jpegComMetadados, pngComMetadados, webpComMetadados } from "../midia/amostras.ts";
import { amostraM4a } from "../midia/amostras-de-audio/mp4.ts";
import { amostraMp3 } from "../midia/amostras-de-audio/mp3.ts";
import { amostraOgg } from "../midia/amostras-de-audio/ogg.ts";
import { amostraWav } from "../midia/amostras-de-audio/wav.ts";
import { amostraWebm } from "../midia/amostras-de-audio/webm.ts";

type CartaoDeEntrada = Parameters<typeof exportar>[0]["baralhos"][number]["cartoes"][number];

/** Exporta um Baralho com os Cartões dados e abre o collection.anki2 gerado. */
async function abrirColecao(cartoes: CartaoDeEntrada[], opcoes: { fuso?: string; idioma?: "pt" | "en" | "es"; agora?: Date } = {}) {
  const resultado = await exportar({ baralhos: [{ id: "d", nome: "Deck", cartoes }] }, "apkg", {
    fuso: opcoes.fuso ?? "UTC", idioma: opcoes.idioma ?? "pt",
    agora: opcoes.agora ?? new Date("2026-10-14T12:00:00.000Z"), lerMidia: async () => null,
  });
  const SQL = await initSqlJs();
  return { resultado, db: new SQL.Database(unzipSync(resultado.bytes)["collection.anki2"]) };
}

describe("pacote Anki", () => {
  it("gera collection.anki2, cartões com progresso e permite importar os textos de volta", async () => {
    const conteudo = { baralhos: [{ id: "d1", nome: "Inglês::Básico", cartoes: [{
      id: "card-a", tipo: "frente-verso" as const, frente: "<b>hello</b> &\nthere", verso: 'olá "mundo"', tags: ["duas palavras"], progresso: {
        proximaRevisaoEm: "2026-10-20T00:00:00.000Z", repeticoes: 3, intervaloEmDias: 5, facilidade: 2.5,
      },
    }] }] };
    const result = await exportar(conteudo, "apkg", {
      fuso: "America/Sao_Paulo", idioma: "pt", agora: new Date("2026-10-14T12:00:00.000Z"),
      lerMidia: async () => null,
    });
    const zip = unzipSync(result.bytes);
    expect(zip["collection.anki2"]).toBeDefined();
    expect(JSON.parse(new TextDecoder().decode(zip.media))).toEqual({});
    const SQL = await initSqlJs();
    const db = new SQL.Database(zip["collection.anki2"]);
    expect(db.exec("SELECT ver FROM col")[0]?.values).toEqual([[11]]);
    expect(db.exec("SELECT guid, tags FROM notes")[0]?.values[0]).toEqual(["card-a", " duas_palavras "]);
    expect(db.exec("SELECT type, queue, ivl, factor, reps FROM cards")[0]?.values[0]).toEqual([2, 2, 5, 2500, 3]);
    expect(db.exec("SELECT count(*) FROM revlog")[0]?.values[0]).toEqual([0]);
    db.close();
    const imported = await lerPacoteAnki(Buffer.from(result.bytes));
    expect(imported.baralhos[0]?.nome).toBe("Inglês::Básico");
    expect(imported.baralhos[0]?.cartoes[0]?.tags).toEqual(["duas_palavras"]);
  });

  it("inclui Imagem e Áudio no pacote e mantém o cartão em texto quando a mídia falta", async () => {
    const imagem = pngComMetadados();
    const audio = amostraWav({ segundos: 1 });
    const conteudo = { baralhos: [{ id: "deck", nome: "Mídia", cartoes: [
      { id: "imagem-1", tipo: "imagem" as const, frente: "legenda", verso: "mapa", tags: [], descricaoAlternativa: 'mapa "azul"', midiaChave: "imagem-key", progresso: null },
      { id: "audio-1", tipo: "audio" as const, frente: "ouvir & repetir", verso: "som", tags: [], midiaChave: "audio-key", progresso: null },
      { id: "ausente-1", tipo: "imagem" as const, frente: "", verso: "continua", tags: [], descricaoAlternativa: "mapa", midiaChave: "missing-key", progresso: null },
    ] }] };
    const resultado = await exportar(conteudo, "apkg", {
      fuso: "UTC", idioma: "pt", agora: new Date("2026-10-14T12:00:00.000Z"),
      lerMidia: async (chave) => ({ "imagem-key": imagem, "audio-key": audio }[chave] ?? null),
    });
    const zip = unzipSync(resultado.bytes);
    const arquivosDeMidia = JSON.parse(new TextDecoder().decode(zip.media)) as Record<string, string>;
    expect(arquivosDeMidia).toEqual({ "0": "memorization-imagem-1.png", "1": "memorization-audio-1.wav" });
    expect(zip["0"]).toEqual(imagem);
    expect(zip["1"]).toEqual(audio);
    expect(resultado.cartoesSemMidia).toBe(1);
    const SQL = await initSqlJs();
    const db = new SQL.Database(zip["collection.anki2"]);
    const notas = db.exec("SELECT guid, flds FROM notes")[0]?.values;
    const camposDe = (id: string) => notas?.find(([guid]) => guid === id)?.[1];
    expect(camposDe("imagem-1")).toBe('<img src="memorization-imagem-1.png" alt="mapa &quot;azul&quot;"><br>legenda\x1fmapa');
    expect(camposDe("audio-1")).toBe("ouvir &amp; repetir<br>[sound:memorization-audio-1.wav]\x1fsom");
    expect(camposDe("ausente-1")).toBe("[Imagem]\x1fcontinua");
    db.close();
  });

  it("propaga falha de leitura de mídia para que nenhuma exportação parcial seja salva", async () => {
    await expect(exportar({ baralhos: [{ id: "d", nome: "Deck", cartoes: [
      { id: "i", tipo: "imagem", frente: "", verso: "back", tags: [], midiaChave: "key", progresso: null },
    ] }] }, "apkg", {
      fuso: "UTC", idioma: "pt", lerMidia: async () => { throw new Error("store offline"); },
    })).rejects.toThrow("store offline");
  });

  it("escapa HTML e quebras de linha nos campos (FR-466)", async () => {
    const { db } = await abrirColecao([
      { id: "esc-1", tipo: "frente-verso", frente: 'a <b> & "c"', verso: "x\ny", tags: [], progresso: null },
    ]);
    expect(db.exec("SELECT flds FROM notes")[0]?.values[0]).toEqual(['a &lt;b&gt; &amp; &quot;c&quot;\x1fx<br>y']);
    db.close();
  });

  it("crt e due seguem o dia local do fuso, inclusive perto da meia-noite UTC (FR-469, R8)", async () => {
    const agora = new Date("2026-03-10T02:30:00.000Z");
    const { db } = await abrirColecao([
      { id: "futuro", tipo: "frente-verso", frente: "f", verso: "v", tags: [], progresso: { proximaRevisaoEm: "2026-03-12T01:00:00.000Z", repeticoes: 1, intervaloEmDias: 2, facilidade: 2.5 } },
    ], { fuso: "America/Sao_Paulo", agora });
    const crt = Number(db.exec("SELECT crt FROM col")[0]?.values[0]?.[0]);
    const due = Number(db.exec("SELECT due FROM cards")[0]?.values[0]?.[0]);
    expect(crt).toBe(Date.UTC(2026, 2, 9) / 1000);
    expect((crt + due * 86_400) * 1000).toBe(Date.UTC(2026, 2, 11));
    db.close();
  });

  it("Revisão atrasada: crt é o dia local dela e due é 0, nunca negativo (FR-469, R8)", async () => {
    const agora = new Date("2026-03-10T02:30:00.000Z");
    const { db } = await abrirColecao([
      { id: "atrasado", tipo: "frente-verso", frente: "f", verso: "v", tags: [], progresso: { proximaRevisaoEm: "2026-03-05T15:00:00.000Z", repeticoes: 1, intervaloEmDias: 2, facilidade: 2.5 } },
      { id: "novo", tipo: "frente-verso", frente: "g", verso: "w", tags: [], progresso: null },
    ], { fuso: "America/Sao_Paulo", agora });
    expect(Number(db.exec("SELECT crt FROM col")[0]?.values[0]?.[0])).toBe(Date.UTC(2026, 2, 5) / 1000);
    const dues = Object.fromEntries((db.exec("SELECT n.guid, c.due FROM cards c JOIN notes n ON n.id = c.nid")[0]?.values ?? []));
    expect(dues).toEqual({ atrasado: 0, novo: 1 });
    expect(Object.values(dues).every((d) => Number(d) >= 0)).toBe(true);
    db.close();
  });

  it("não grava identificação de usuário em nenhuma tabela nem na mídia (FR-480)", async () => {
    const segredo = "usuario-secreto-123";
    // Os tipos de conteúdo não têm campo de usuário; o id é passado por fora dos tipos.
    const baralho = { id: "d", nome: "Deck", dono: segredo, cartoes: [
      { id: "c1", tipo: "frente-verso" as const, frente: "a", verso: "b", tags: [], progresso: null, criadoPor: segredo },
    ] };
    const contexto = { fuso: "UTC", idioma: "pt" as const, agora: new Date("2026-10-14T12:00:00.000Z"), lerMidia: async () => null, usuarioId: segredo };
    const resultado = await exportar({ baralhos: [baralho] }, "apkg", contexto);
    const zip = unzipSync(resultado.bytes);
    expect(new TextDecoder().decode(zip.media)).not.toContain(segredo);
    const SQL = await initSqlJs();
    const db = new SQL.Database(zip["collection.anki2"]);
    for (const tabela of ["col", "notes", "cards", "revlog", "graves"]) {
      expect(JSON.stringify(db.exec(`SELECT * FROM ${tabela}`))).not.toContain(segredo);
    }
    db.close();
  });

  it("o tipo de nota tem o mesmo id em exportações com conteúdos diferentes (R15)", async () => {
    const modeloDe = async (frente: string) => {
      const { db } = await abrirColecao([{ id: "c", tipo: "frente-verso", frente, verso: "b", tags: [], progresso: null }]);
      const modelos = Object.keys(JSON.parse(String(db.exec("SELECT models FROM col")[0]?.values[0]?.[0])));
      const mid = Number(db.exec("SELECT mid FROM notes")[0]?.values[0]?.[0]);
      db.close();
      return { modelos, mid };
    };
    const primeira = await modeloDe("um");
    const segunda = await modeloDe("outra frente, outro conteúdo");
    expect(segunda).toEqual(primeira);
    expect(primeira.modelos).toEqual([String(primeira.mid)]);
  });

  it("ida e volta pelo lerPacoteAnki preserva Frente, Verso e Tags, sem agendamento (SC-184, FR-470)", async () => {
    const { resultado } = await abrirColecao([
      { id: "rt-1", tipo: "frente-verso", frente: "linha 1\nlinha 2", verso: "fim", tags: ["verbo irregular", "x"], progresso: { proximaRevisaoEm: "2026-10-20T00:00:00.000Z", repeticoes: 2, intervaloEmDias: 4, facilidade: 2.5 } },
      { id: "rt-2", tipo: "frente-verso", frente: "hello", verso: "oi", tags: [], progresso: null },
    ]);
    const previa = await lerPacoteAnki(Buffer.from(resultado.bytes));
    expect(previa.baralhos[0]?.nome).toBe("Deck");
    const normalizar = (texto: string) => texto.replace(/\s+/g, " ").trim();
    const importados = [...(previa.baralhos[0]?.cartoes ?? [])].sort((a, b) => a.frente.localeCompare(b.frente));
    expect(importados.map((c) => ({ frente: normalizar(c.frente), verso: normalizar(c.verso), tags: c.tags }))).toEqual([
      { frente: "hello", verso: "oi", tags: [] },
      { frente: "linha 1 linha 2", verso: "fim", tags: ["verbo_irregular", "x"] },
    ]);
    for (const cartao of importados) expect(Object.keys(cartao).sort()).toEqual(["estado", "frente", "tags", "verso"]);
  });

  it("rótulos de texto para mídia ilegível saem no idioma pedido (R9)", async () => {
    const cartoes: CartaoDeEntrada[] = [
      { id: "img", tipo: "imagem", frente: "", verso: "v", tags: [], midiaChave: "sumiu", progresso: null },
      { id: "aud", tipo: "audio", frente: "", verso: "v", tags: [], midiaChave: "sumiu", progresso: null },
    ];
    const emIngles = await abrirColecao(cartoes, { idioma: "en" });
    expect(emIngles.resultado.cartoesSemMidia).toBe(2);
    expect(emIngles.db.exec("SELECT guid, flds FROM notes ORDER BY guid")[0]?.values).toEqual([
      ["aud", "[Audio]\x1fv"], ["img", "[Image]\x1fv"],
    ]);
    emIngles.db.close();
    const emEspanhol = await abrirColecao(cartoes, { idioma: "es" });
    expect(emEspanhol.db.exec("SELECT guid, flds FROM notes ORDER BY guid")[0]?.values).toEqual([
      ["aud", "[Audio]\x1fv"], ["img", "[Imagen]\x1fv"],
    ]);
    emEspanhol.db.close();
  });
});

describe("registro de formatos e interface exportar", () => {
  it("tem exatamente o formato apkg e rejeita identificadores desconhecidos", () => {
    expect([...FORMATOS_DE_EXPORTACAO.keys()]).toEqual(["apkg"]);
    expect(FORMATOS_DE_EXPORTACAO.get("apkg")?.extensao).toBe("apkg");
    expect(ehFormatoDeExportacao("apkg")).toBe(true);
    expect(ehFormatoDeExportacao("csv")).toBe(false);
    expect(ehFormatoDeExportacao(123)).toBe(false);
  });

  it("devolve bytes, nome do arquivo e tipo de conteúdo", async () => {
    const resultado = await exportarPeloFormato({ baralhos: [{ id: "d", nome: "Deck", cartoes: [
      { id: "c", tipo: "frente-verso", frente: "a", verso: "b", tags: [], progresso: null },
    ] }] }, "apkg", {
      fuso: "UTC", idioma: "pt", agora: new Date("2026-10-14T12:00:00.000Z"), lerMidia: async () => null,
    });
    expect(resultado.nomeDoArquivo).toBe("Deck.apkg");
    expect(resultado.tipoDeConteudo).toBe("application/octet-stream");
    expect(resultado.cartoesSemMidia).toBe(0);
    expect(resultado.bytes.length).toBeGreaterThan(0);
  });

  it("troca '::' do nome do Baralho por '-' só no nome do arquivo", async () => {
    const resultado = await exportarPeloFormato({ baralhos: [{ id: "d", nome: "Inglês::Básico", cartoes: [
      { id: "c", tipo: "frente-verso", frente: "a", verso: "b", tags: [], progresso: null },
    ] }] }, "apkg", {
      fuso: "UTC", idioma: "pt", agora: new Date("2026-10-14T12:00:00.000Z"), lerMidia: async () => null,
    });
    expect(resultado.nomeDoArquivo).toBe("Inglês--Básico.apkg");
  });

  it("um Cartão novo tem type=0, queue=0, factor=0 e due igual à sua posição", async () => {
    const resultado = await exportarPeloFormato({ baralhos: [{ id: "d", nome: "Deck", cartoes: [
      { id: "primeiro", tipo: "frente-verso", frente: "a", verso: "b", tags: [], progresso: null },
      { id: "segundo", tipo: "frente-verso", frente: "c", verso: "d", tags: [], progresso: null },
    ] }] }, "apkg", {
      fuso: "UTC", idioma: "pt", agora: new Date("2026-10-14T12:00:00.000Z"), lerMidia: async () => null,
    });
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipSync(resultado.bytes)["collection.anki2"]);
    expect(db.exec("SELECT type, queue, factor, due FROM cards ORDER BY due")[0]?.values).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 1],
    ]);
    db.close();
  });

  it("o pacote tem a tabela graves no esquema 11", async () => {
    const resultado = await exportarPeloFormato({ baralhos: [] }, "apkg", {
      fuso: "UTC", idioma: "pt", agora: new Date("2026-10-14T12:00:00.000Z"), lerMidia: async () => null,
    });
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipSync(resultado.bytes)["collection.anki2"]);
    expect(db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='graves'")[0]?.values).toEqual([["graves"]]);
    db.close();
  });
});

describe("Baralhos e mídia no pacote Anki (FR-465, FR-468, SC-185)", () => {
  const contextoFixo = { fuso: "UTC", idioma: "pt" as const, agora: new Date("2026-10-14T12:00:00.000Z"), lerMidia: async () => null };

  it("três Baralhos viram três Baralhos Anki, o vazio incluído, e cada Cartão cai no seu (FR-465, SC-185)", async () => {
    const cartao = (id: string) => ({ id, tipo: "frente-verso" as const, frente: id, verso: "v", tags: [], progresso: null });
    const resultado = await exportarPeloFormato({ baralhos: [
      { id: "a", nome: "A", cartoes: [cartao("a1"), cartao("a2")] },
      { id: "b", nome: "B", cartoes: [cartao("b1")] },
      { id: "c", nome: "C", cartoes: [] },
    ] }, "apkg", contextoFixo);
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipSync(resultado.bytes)["collection.anki2"]);
    const decks = JSON.parse(String(db.exec("SELECT decks FROM col")[0]?.values[0]?.[0])) as Record<string, { id: number; name: string }>;
    const nomes = Object.values(decks).map((d) => d.name).sort();
    expect(nomes).toEqual(["A", "B", "C", "Default"]);
    const idDoBaralho = Object.fromEntries(Object.values(decks).map((d) => [d.name, d.id]));
    const porCartao = db.exec("SELECT n.guid, c.did FROM cards c JOIN notes n ON n.id = c.nid")[0]?.values ?? [];
    expect(porCartao).toHaveLength(3);
    expect(new Set(porCartao.map(([guid]) => guid)).size).toBe(3);
    expect(Object.fromEntries(porCartao)).toEqual({ a1: idDoBaralho.A, a2: idDoBaralho.A, b1: idDoBaralho.B });
    expect(db.exec("SELECT count(*) FROM notes")[0]?.values[0]).toEqual([3]);
    db.close();
  });

  it.each<[string, "imagem" | "audio", () => Uint8Array, string]>([
    ["JPEG", "imagem", () => jpegComMetadados(), "jpg"],
    ["WebP", "imagem", () => webpComMetadados(), "webp"],
    ["GIF", "imagem", () => gifComMetadados(), "gif"],
    ["MP3", "audio", () => amostraMp3({ quadros: 200 }), "mp3"],
    ["M4A", "audio", () => amostraM4a({ duracaoMs: 2500 }), "m4a"],
    ["OGG", "audio", () => amostraOgg({ codec: "vorbis", granulo: 44100 }), "ogg"],
    ["WebM", "audio", () => amostraWebm({ duracaoMs: 2500 }), "webm"],
  ])("%s entra no pacote com a extensão %s e é referenciado na Frente (FR-468)", async (_formato, tipo, bytesDaAmostra, extensao) => {
    const bytes = bytesDaAmostra();
    const nome = `memorization-midia-1.${extensao}`;
    const resultado = await exportarPeloFormato({ baralhos: [{ id: "d", nome: "Mídia", cartoes: [
      { id: "midia-1", tipo, frente: "legenda", verso: "v", tags: [], descricaoAlternativa: "alt", midiaChave: "chave", progresso: null },
    ] }] }, "apkg", { ...contextoFixo, lerMidia: async (chave) => (chave === "chave" ? bytes : null) });
    const zip = unzipSync(resultado.bytes);
    const midia = JSON.parse(new TextDecoder().decode(zip.media)) as Record<string, string>;
    const indice = Object.keys(midia).find((k) => midia[k] === nome);
    expect(indice).toBeDefined();
    expect(Object.keys(midia)).toHaveLength(1);
    expect(zip[indice!]).toEqual(bytes);
    const SQL = await initSqlJs();
    const db = new SQL.Database(zip["collection.anki2"]);
    const frente = String(db.exec("SELECT flds FROM notes")[0]?.values[0]?.[0]);
    db.close();
    if (tipo === "imagem") expect(frente).toContain(`<img src="${nome}"`);
    else expect(frente).toContain(`[sound:${nome}]`);
  });
});
