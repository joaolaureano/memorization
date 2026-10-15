import { createHash } from "node:crypto";

import { zipSync } from "fflate/browser";
import initSqlJs from "sql.js/dist/sql-asm.js";

import { reconhecerAudio } from "../../midia/audio/reconhecer.ts";
import { detectarFormato } from "../../midia/imagem/formato.ts";
import { escaparCampo, frenteSemMidia, textoSimples } from "./campos.ts";

export interface ProgressoExportado {
  readonly proximaRevisaoEm: string;
  readonly repeticoes: number;
  readonly intervaloEmDias: number;
  readonly facilidade: number;
}

export interface CartaoExportado {
  readonly id: string;
  readonly tipo: "frente-verso" | "imagem" | "audio";
  readonly frente: string;
  readonly verso: string;
  readonly tags: readonly string[];
  readonly descricaoAlternativa?: string;
  readonly midiaChave?: string;
  readonly progresso: ProgressoExportado | null;
}

export interface BaralhoExportado {
  readonly id: string;
  readonly nome: string;
  readonly cartoes: readonly CartaoExportado[];
}

export interface ConteudoExportado {
  readonly baralhos: readonly BaralhoExportado[];
}

export interface ContextoDaExportacao {
  readonly idioma: "pt" | "en" | "es";
  readonly fuso: string;
  readonly agora?: Date;
  readonly lerMidia: (chave: string) => Promise<Uint8Array | null>;
}

export interface ResultadoDoPacote {
  readonly bytes: Uint8Array;
  readonly cartoesSemMidia: number;
}

const MODELO_ID = 1_700_000_000_001;
const SEGUNDOS_POR_DIA = 86_400;

function diaLocal(data: Date, fuso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(data);
  const campo = (tipo: string) => p.find((x) => x.type === tipo)!.value;
  return `${campo("year")}-${campo("month")}-${campo("day")}`;
}

function diaNumero(dia: string): number {
  const [ano, mes, data] = dia.split("-").map(Number);
  return Math.floor(Date.UTC(ano, mes - 1, data) / 86_400_000);
}

function tagsAnki(tags: readonly string[]): string {
  return tags.length ? ` ${tags.map((t) => t.trim().replace(/\s+/g, "_")).join(" ")} ` : " ";
}

function idNumerico(texto: string, salt: number): number {
  const h = createHash("sha256").update(`${salt}:${texto}`).digest();
  return h.readUIntBE(0, 6) + 1;
}

export async function exportar(
  conteudo: ConteudoExportado,
  formato: "apkg",
  contexto: ContextoDaExportacao,
): Promise<ResultadoDoPacote> {
  if (formato !== "apkg") throw new Error("Unsupported export format");
  const agora = contexto.agora ?? new Date();
  const cartoes = conteudo.baralhos.flatMap((b) => b.cartoes);
  const datas = cartoes.map((c) => c.progresso?.proximaRevisaoEm).filter((d): d is string => d !== undefined);
  const crtDia = Math.min(diaNumero(diaLocal(agora, contexto.fuso)), ...datas.map((d) => diaNumero(diaLocal(new Date(d), contexto.fuso))));
  const crt = crtDia * SEGUNDOS_POR_DIA;
  const media: Record<string, string> = {};
  const arquivos: Record<string, Uint8Array> = {};
  let cartoesSemMidia = 0;
  let proximoMedia = 0;

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  try {
    db.run(`CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text);
      CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
      CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
      CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
      CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);`);

    const decks: Record<string, { id: number; name: string; desc: string; mod: number; usn: number; dyn: number; conf: number }> = {
      "1": { id: 1, name: "Default", desc: "", mod: 0, usn: -1, dyn: 0, conf: 1 },
    };
    const fields = [{ name: "Front", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20, description: "" }, { name: "Back", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20, description: "" }];
    const models = { [MODELO_ID]: { id: MODELO_ID, name: "Memorization", type: 0, mod: 0, usn: -1, sortf: 0, did: null, tmpls: [{ name: "Card 1", ord: 0, qfmt: "{{Front}}", afmt: "{{FrontSide}}<hr id=answer>{{Back}}", bqfmt: "", bafmt: "", did: null, bfont: "Arial", bsize: 20, qnodes: [], anodes: [] }], flds: fields, css: ".card { font-family: Arial; font-size: 20px; text-align: center; color: black; background-color: white; }", latexPre: "\\documentclass[12pt]{article}\\n\\special{papersize=3in,5in}\\n\\usepackage[utf8]{inputenc}\\n\\usepackage{amsmath,amssymb}\\n\\pagestyle{empty}\\n\\setlength{\\parindent}{0in}\\begin{document}\\n", latexPost: "\\end{document}", req: [[0, "all", [0]]] } };
    db.run("INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')", [crt, Math.floor(agora.getTime() / 1000), Math.floor(agora.getTime() / 1000), JSON.stringify({ nextPos: 1, estTimes: [], activeDecks: [1], sortType: "noteFld", sortBackwards: false, timeLim: 0, curDeck: 1, newBury: true, revBury: true, dayLearnFirst: false, dueCounts: true, curModel: MODELO_ID, collapseTime: 1200, addToCur: true }), JSON.stringify(models), JSON.stringify(decks), JSON.stringify({ 1: { id: 1, mod: 0, name: "Default", usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, new: { delays: [1, 10], ints: [1, 4, 7], initialFactor: 2500, order: 1, perDay: 20 }, rev: { perDay: 200, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, bury: true, hardFactor: 1.2 }, lapse: { delays: [10], leechFails: 8, leechAction: 0, minInt: 1, mult: 0 } } })]);
    const insertNote = db.prepare("INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')");
    const insertCard = db.prepare("INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, '')");
    for (let bi = 0; bi < conteudo.baralhos.length; bi += 1) {
      const baralho = conteudo.baralhos[bi]!;
      const did = bi + 2;
      decks[String(did)] = { id: did, name: baralho.nome, desc: "", mod: 0, usn: -1, dyn: 0, conf: 1 };
      for (let ci = 0; ci < baralho.cartoes.length; ci += 1) {
        const cartao = baralho.cartoes[ci]!;
        let frente = escaparCampo(cartao.frente);
        if (cartao.tipo !== "frente-verso") {
          let nome: string | undefined;
          let midiaBytes: Uint8Array | null = null;
          if (cartao.midiaChave) midiaBytes = await contexto.lerMidia(cartao.midiaChave);
          if (midiaBytes !== null && cartao.tipo === "imagem") {
            const tipo = detectarFormato(midiaBytes);
            const extensao = tipo?.split("/")[1]?.replace("jpeg", "jpg");
            if (extensao) nome = `memorization-${cartao.id}.${extensao}`;
          }
          if (midiaBytes !== null && cartao.tipo === "audio") {
            const tipo = reconhecerAudio(midiaBytes);
            if (tipo.ok) {
              const extensoes: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/webm": "webm", "audio/wav": "wav" };
              nome = `memorization-${cartao.id}.${extensoes[tipo.formato] ?? "bin"}`;
            }
          }
          if (nome && midiaBytes) {
            const indice = String(proximoMedia++);
            media[indice] = nome;
            arquivos[indice] = midiaBytes;
            frente = cartao.tipo === "imagem"
              ? `<img src="${nome}" alt="${escaparCampo(cartao.descricaoAlternativa ?? "")}">${cartao.frente ? `<br>${escaparCampo(cartao.frente)}` : ""}`
              : `${cartao.frente ? `${escaparCampo(cartao.frente)}<br>` : ""}[sound:${nome}]`;
          } else {
            if (cartao.midiaChave) cartoesSemMidia += 1;
            frente = frenteSemMidia(cartao.tipo, cartao.frente, contexto.idioma);
          }
        }
        const nid = idNumerico(cartao.id, 1);
        const cid = idNumerico(cartao.id, 2);
        const sfld = textoSimples(frente);
        const csum = createHash("sha1").update(sfld).digest().readUInt32LE(0);
        insertNote.run([nid, cartao.id, MODELO_ID, Math.floor(agora.getTime() / 1000), tagsAnki(cartao.tags), `${frente}\x1f${escaparCampo(cartao.verso)}`, sfld, csum]);
        const p = cartao.progresso;
        const due = p ? Math.max(0, diaNumero(diaLocal(new Date(p.proximaRevisaoEm), contexto.fuso)) - crtDia) : ci;
        insertCard.run([cid, nid, did, Math.floor(agora.getTime() / 1000), p ? 2 : 0, p ? 2 : 0, due, p ? Math.max(1, p.intervaloEmDias) : 0, p ? Math.round(p.facilidade * 1000) : 0, p?.repeticoes ?? 0]);
      }
    }
    insertNote.free(); insertCard.free();
    db.run("UPDATE col SET decks = ? WHERE id = 1", [JSON.stringify(decks)]);
    const zipEntries: Record<string, Uint8Array> = { "collection.anki2": db.export(), media: new TextEncoder().encode(JSON.stringify(media)), ...arquivos };
    return { bytes: zipSync(zipEntries, { level: 0 }), cartoesSemMidia };
  } finally {
    db.close();
  }
}
