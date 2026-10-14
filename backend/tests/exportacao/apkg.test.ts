import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import initSqlJs from "sql.js/dist/sql-asm.js";

import { exportar } from "../../src/exportacao/apkg/pacote.ts";
import { lerPacoteAnki } from "../../src/importacao/anki.ts";
import { pngComMetadados } from "../midia/amostras.ts";
import { amostraWav } from "../midia/amostras-de-audio/wav.ts";

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
});
