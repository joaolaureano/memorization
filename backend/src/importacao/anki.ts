import { zstdDecompressSync } from "node:zlib";
import { unzipSync } from "fflate/browser";
import initSqlJs from "sql.js/dist/sql-asm.js";

export const LIMITE_APKG = 4 * 1024 * 1024;
export interface CartaoImportado { frente: string; verso: string; tags: string[]; estado: "adicionado" | "modificado"; }
export interface BaralhoImportado { nome: string; cartoes: CartaoImportado[]; }
export interface PreviaImportacao { baralhos: BaralhoImportado[]; avisos: { notasIgnoradas: number; conteudoIgnorado: number }; }

const texto = (html: string) => html.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

// Notetype.Config do Anki moderno (protobuf): o campo 1 é `kind` (0 = básico, 1 = cloze).
function tipoDoNotetype(config: Uint8Array): number {
  let i = 0;
  const varint = () => { let valor = 0, deslocamento = 0, byte: number; do { byte = config[i++] ?? 0; valor += (byte & 0x7f) * 2 ** deslocamento; deslocamento += 7; } while (byte & 0x80 && i < config.length); return valor; };
  while (i < config.length) {
    const chave = varint(), campo = Math.floor(chave / 8), tipo = chave % 8;
    if (tipo === 0) { const valor = varint(); if (campo === 1) return valor; }
    else if (tipo === 2) i += varint();
    else if (tipo === 1) i += 8;
    else if (tipo === 5) i += 4;
    else break;
  }
  return 0;
}

export async function lerPacoteAnki(bytes: Buffer): Promise<PreviaImportacao> {
  if (bytes.length > LIMITE_APKG) throw new Error("O arquivo deve ter no máximo 4 MiB.");
  let zip: ReturnType<typeof unzipSync>;
  try {
    zip = unzipSync(bytes, {
      filter: (file) =>
        ["collection.anki2", "collection.anki21", "collection.anki21b"].includes(file.name) &&
        file.originalSize <= 16 * 1024 * 1024,
    });
  }
  catch { throw new Error("Não foi possível ler este arquivo Anki."); }
  let dbBytes: Uint8Array | undefined;
  if (zip["collection.anki21b"]) {
    try { dbBytes = new Uint8Array(zstdDecompressSync(zip["collection.anki21b"], { maxOutputLength: 16 * 1024 * 1024 })); }
    catch { throw new Error("O arquivo Anki moderno está corrompido ou excede o limite de expansão."); }
  }
  dbBytes ??= zip["collection.anki21"] ?? zip["collection.anki2"];
  if (!dbBytes || dbBytes.length > 16 * 1024 * 1024) throw new Error("O arquivo não contém uma coleção Anki compatível.");
  try {
    const sql = await initSqlJs();
    const db = new sql.Database(dbBytes);
    try {
      const moderno = db.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'notetypes'").length > 0;
      let decks: Record<string, { name: string }>;
      let models: Record<string, { type: number }>;
      if (moderno) {
        decks = Object.fromEntries((db.exec("SELECT id, name FROM decks")[0]?.values ?? []).map(([id, name]) => [String(id), { name: String(name).split("\u001f").join("::") }]));
        models = Object.fromEntries((db.exec("SELECT id, config FROM notetypes")[0]?.values ?? []).map(([id, config]) => [String(id), { type: tipoDoNotetype(config instanceof Uint8Array ? config : new Uint8Array()) }]));
      } else {
        const colunas = db.exec("SELECT decks, models FROM col LIMIT 1")[0];
        if (!colunas) throw new Error("Coleção Anki inválida.");
        decks = JSON.parse(String(colunas.values[0][0])) as Record<string, { name: string }>;
        models = JSON.parse(String(colunas.values[0][1])) as Record<string, { type: number }>;
      }
      const notasSql = db.exec("SELECT id, mid, flds, tags FROM notes ORDER BY id")[0];
      const cartoesSql = db.exec("SELECT nid, did FROM cards ORDER BY id")[0];
      const notes = (notasSql?.values ?? []).map(([id, mid, flds, tags]) => ({ id: Number(id), mid: Number(mid), flds: String(flds), tags: String(tags) }));
      const cards = (cartoesSql?.values ?? []).map(([nid, did]) => ({ nid: Number(nid), did: Number(did) }));
      const notesById = new Map(notes.map((note) => [note.id, note]));
      const result = new Map<string, BaralhoImportado>();
      let notasIgnoradas = 0, conteudoIgnorado = 0;
      for (const card of cards) {
        const note = notesById.get(card.nid);
        if (!note) continue;
        const model = models[String(note.mid)];
        if (!model || model.type !== 0) { notasIgnoradas++; continue; }
        const deck = decks[String(card.did)];
        if (!deck) continue;
        const fields = note.flds.split("\u001f");
        if (fields.length < 2) { notasIgnoradas++; continue; }
        const front = texto(fields[0]), back = texto(fields[1]);
        if (/<[^>]+>|\[sound:|<img\b|\[latex:/i.test(fields[0] + fields[1])) conteudoIgnorado++;
        if (!front || !back) { notasIgnoradas++; continue; }
        const group = result.get(deck.name) ?? { nome: deck.name, cartoes: [] };
        const tags = [...new Set(note.tags.trim().split(/\s+/).filter(Boolean).map((tag) => tag.toLowerCase()))];
        const key = front.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
        const duplicate = group.cartoes.some((item) => item.frente.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === key);
        let finalFront = front;
        if (duplicate) {
          let suffix = 2;
          while (group.cartoes.some((item) => item.frente.toLowerCase() === `${front} (${suffix})`.toLowerCase())) suffix++;
          finalFront = `${front} (${suffix})`;
        }
        group.cartoes.push({ frente: finalFront, verso: back, tags, estado: duplicate ? "modificado" : "adicionado" });
        result.set(deck.name, group);
      }
      if (result.size === 0) throw new Error("Nenhum cartão básico válido foi encontrado.");
      const previa = { baralhos: [...result.values()], avisos: { notasIgnoradas, conteudoIgnorado } };
      if (Buffer.byteLength(JSON.stringify(previa)) > LIMITE_APKG) throw new Error("A prévia gerada excede o limite de 4 MiB.");
      return previa;
    } finally { db.close(); }
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("O arquivo") || error.message.startsWith("A prévia") || error.message.startsWith("Pacotes") || error.message.startsWith("Coleção") || error.message.startsWith("Nenhum cartão"))) throw error;
    throw new Error("Não foi possível ler este arquivo Anki.");
  }
}
