import { describe, expect, it } from "vitest";

import { en, es, pt, rotuloDoBaralhoDoRegistro } from "../src/idioma";

describe("rótulos derivados da origem do Registro", () => {
  it.each([
    [pt, "Revisão do dia", "Baralho temporário"],
    [en, "Today's review", "Temporary deck"],
    [es, "Repaso del día", "Mazo temporal"],
  ])("usa os rótulos do catálogo", (textos, revisao, temporario) => {
    expect(rotuloDoBaralhoDoRegistro({ origem: "revisao", nomeDoBaralho: "" }, textos)).toBe(revisao);
    expect(rotuloDoBaralhoDoRegistro({ origem: "temporario", nomeDoBaralho: "" }, textos)).toBe(temporario);
  });

  it("preserva o nome escrito pela pessoa, mesmo quando coincide com um rótulo", () => {
    expect(rotuloDoBaralhoDoRegistro({ origem: "baralho", nomeDoBaralho: "Revisão do dia" }, en)).toBe("Revisão do dia");
  });

  it.each([pt, en, es])("mostra o nome digitado do Baralho temporário em qualquer idioma (FR-006)", (textos) => {
    expect(rotuloDoBaralhoDoRegistro({ origem: "temporario", nomeDoBaralho: "Aula de Inglês" }, textos)).toBe("Aula de Inglês");
  });
});
