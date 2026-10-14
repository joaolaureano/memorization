import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zstdCompressSync } from "node:zlib";
import { zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { lerPacoteAnki, LIMITE_APKG } from "../../src/importacao/anki.ts";

const dirs: string[] = [];
function pacote(moderno = false) {
  const dir = mkdtempSync(join(tmpdir(), "anki-fixture-")); dirs.push(dir);
  const path = join(dir, "collection.anki2"); const db = new DatabaseSync(path);
  db.exec("CREATE TABLE col(decks TEXT, models TEXT); CREATE TABLE notes(id INTEGER, mid INTEGER, flds TEXT, tags TEXT); CREATE TABLE cards(id INTEGER, nid INTEGER, did INTEGER);");
  db.prepare("INSERT INTO col VALUES (?, ?)").run(JSON.stringify({ "1": { name: "Francês" } }), JSON.stringify({ "10": { type: 0, flds: [{ name: "Front" }, { name: "Back" }] } }));
  db.prepare("INSERT INTO notes VALUES (?, ?, ?, ?)").run(1, 10, "Bonjour\u001fOlá <b>mundo</b>", " VERBOS Francês ");
  db.prepare("INSERT INTO notes VALUES (?, ?, ?, ?)").run(2, 10, "Bonjour\u001fSaudação", "TESTE");
  db.prepare("INSERT INTO cards VALUES (?, ?, ?)").run(1, 1, 1); db.prepare("INSERT INTO cards VALUES (?, ?, ?)").run(2, 2, 1); db.close();
  const sqlite = readFileSync(path);
  return zipSync({ [moderno ? "collection.anki21b" : "collection.anki2"]: new Uint8Array(moderno ? zstdCompressSync(sqlite) : sqlite) });
}
function pacoteModernoReal() {
  const dir = mkdtempSync(join(tmpdir(), "anki-fixture-")); dirs.push(dir);
  const stub = join(dir, "stub.anki2"); const legado = new DatabaseSync(stub);
  legado.exec("CREATE TABLE col(decks TEXT, models TEXT); CREATE TABLE notes(id INTEGER, mid INTEGER, flds TEXT, tags TEXT); CREATE TABLE cards(id INTEGER, nid INTEGER, did INTEGER);");
  legado.prepare("INSERT INTO col VALUES (?, ?)").run(JSON.stringify({ "1": { name: "Default" } }), JSON.stringify({ "10": { type: 0, flds: [{ name: "Front" }, { name: "Back" }] } }));
  legado.prepare("INSERT INTO notes VALUES (?, ?, ?, ?)").run(1, 10, "Atualize para a versão mais recente do Anki e importe o arquivo .colpkg/.apkg novamente.\u001f", "");
  legado.prepare("INSERT INTO cards VALUES (?, ?, ?)").run(1, 1, 1); legado.close();
  const moderno = join(dir, "moderno.anki2"); const novo = new DatabaseSync(moderno);
  novo.exec("CREATE TABLE col(decks TEXT, models TEXT); CREATE TABLE decks(id INTEGER, name TEXT); CREATE TABLE notetypes(id INTEGER, name TEXT, config BLOB); CREATE TABLE notes(id INTEGER, mid INTEGER, flds TEXT, tags TEXT); CREATE TABLE cards(id INTEGER, nid INTEGER, did INTEGER);");
  novo.prepare("INSERT INTO col VALUES (?, ?)").run("", "");
  novo.prepare("INSERT INTO decks VALUES (?, ?)").run(1785707227641, "Idiomas\u001fInglês");
  novo.prepare("INSERT INTO notetypes VALUES (?, ?, ?)").run(1785707227000, "Básico", new Uint8Array([0x1a, 0x02, 0x08, 0x01]));
  novo.prepare("INSERT INTO notetypes VALUES (?, ?, ?)").run(1785707227001, "Omissão", new Uint8Array([0x08, 0x01]));
  novo.prepare("INSERT INTO notes VALUES (?, ?, ?, ?)").run(1, 1785707227000, "savvy\u001fAstuto", "vocab");
  novo.prepare("INSERT INTO notes VALUES (?, ?, ?, ?)").run(2, 1785707227001, "{{c1::shrewd}}\u001f", "");
  novo.prepare("INSERT INTO cards VALUES (?, ?, ?)").run(1, 1, 1785707227641); novo.prepare("INSERT INTO cards VALUES (?, ?, ?)").run(2, 2, 1785707227641); novo.close();
  return zipSync({ "collection.anki2": new Uint8Array(readFileSync(stub)), "collection.anki21b": new Uint8Array(zstdCompressSync(readFileSync(moderno))) });
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("importação Anki", () => {
  it("lê notas básicas, remove HTML, normaliza tags e identifica frentes repetidas", async () => {
    const previa = await lerPacoteAnki(Buffer.from(pacote()));
    expect(previa.baralhos[0].nome).toBe("Francês");
    expect(previa.baralhos[0].cartoes).toEqual([
      { frente: "Bonjour", verso: "Olá mundo", tags: ["verbos", "francês"], estado: "adicionado" },
      { frente: "Bonjour (2)", verso: "Saudação", tags: ["teste"], estado: "modificado" },
    ]);
    expect(previa.avisos.conteudoIgnorado).toBe(1);
  });

  it("recusa pacotes que excedem o limite de upload", async () => {
    await expect(lerPacoteAnki(Buffer.alloc(LIMITE_APKG + 1))).rejects.toMatchObject({
      codigo: "anki_grande_demais",
      limite: LIMITE_APKG,
      message: "Anki file exceeds the size limit.",
    });
  });

  it("lê o formato moderno com SQLite comprimido em Zstandard", async () => {
    const previa = await lerPacoteAnki(Buffer.from(pacote(true)));
    expect(previa.baralhos[0].cartoes).toHaveLength(2);
  });

  it("recusa um ZIP inválido de forma controlada", async () => {
    await expect(lerPacoteAnki(Buffer.from("não é zip"))).rejects.toMatchObject({
      codigo: "anki_ilegivel",
      message: "Anki file could not be read.",
    });
  });

  it("distingue arquivo corrompido de ZIP sem uma coleção Anki", async () => {
    await expect(
      lerPacoteAnki(Buffer.from(zipSync({ "collection.anki21b": new Uint8Array([1, 2, 3]) }))),
    ).rejects.toMatchObject({ codigo: "anki_corrompido" });
    await expect(
      lerPacoteAnki(Buffer.from(zipSync({ "readme.txt": new Uint8Array([1, 2, 3]) }))),
    ).rejects.toMatchObject({ codigo: "anki_incompativel" });
  });

  it("importa só cartões frente-verso e ignora a mídia de som (FR-452): [sound:] fica no texto da Frente e não gera Áudio nem escrita em armazém de mídia", async () => {
    // FR-452: o Anki não cria Cartão de Áudio; o `[sound:…]` e o arquivo de mídia são ignorados.
    // Comportamento atual observado: o marcador é mantido literalmente na Frente (o `texto` só remove HTML),
    // e a nota é contada em `avisos.conteudoIgnorado`. Não há Armazém de Mídia: `lerPacoteAnki(bytes)` só lê.
    const dir = mkdtempSync(join(tmpdir(), "anki-fixture-")); dirs.push(dir);
    const path = join(dir, "collection.anki2"); const db = new DatabaseSync(path);
    db.exec("CREATE TABLE col(decks TEXT, models TEXT); CREATE TABLE notes(id INTEGER, mid INTEGER, flds TEXT, tags TEXT); CREATE TABLE cards(id INTEGER, nid INTEGER, did INTEGER);");
    db.prepare("INSERT INTO col VALUES (?, ?)").run(JSON.stringify({ "1": { name: "Inglês" } }), JSON.stringify({ "10": { type: 0, flds: [{ name: "Front" }, { name: "Back" }] } }));
    db.prepare("INSERT INTO notes VALUES (?, ?, ?, ?)").run(1, 10, "Obrigado [sound:pronuncia.mp3]\u001fThank you", "audio");
    db.prepare("INSERT INTO cards VALUES (?, ?, ?)").run(1, 1, 1); db.close();
    const bytes = zipSync({
      "collection.anki2": new Uint8Array(readFileSync(path)),
      "media": new TextEncoder().encode(JSON.stringify({ "0": "pronuncia.mp3" })),
      "0": new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]),
    });

    const previa = await lerPacoteAnki(Buffer.from(bytes));
    const cartoes = previa.baralhos.flatMap((baralho) => baralho.cartoes);
    expect(cartoes).toHaveLength(1);
    // Nenhum cartão carrega `tipo`: ausente equivale a "frente-verso" e nunca "audio".
    for (const cartao of cartoes) {
      expect(Object.keys(cartao).sort()).toEqual(["estado", "frente", "tags", "verso"]);
    }
    // Comportamento atual: o `[sound:…]` permanece no texto da Frente.
    expect(cartoes[0]).toEqual({ frente: "Obrigado [sound:pronuncia.mp3]", verso: "Thank you", tags: ["audio"], estado: "adicionado" });
    expect(previa.avisos.conteudoIgnorado).toBe(1);
    // Sem Armazém de Mídia: a assinatura aceita apenas os bytes, então nada pode ser gravado em mídia.
    expect(lerPacoteAnki.length).toBe(1);
  });

  it("lê o pacote moderno real: prefere collection.anki21b ao aviso em collection.anki2 e lê decks e notetypes do esquema novo", async () => {
    const previa = await lerPacoteAnki(Buffer.from(pacoteModernoReal()));
    expect(previa.baralhos).toEqual([{ nome: "Idiomas::Inglês", cartoes: [{ frente: "savvy", verso: "Astuto", tags: ["vocab"], estado: "adicionado" }] }]);
    expect(previa.avisos.notasIgnoradas).toBe(1);
  });
});
