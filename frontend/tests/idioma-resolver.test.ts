import { describe, expect, it } from "vitest";

import { resolverIdiomaInicial } from "../src/idioma/resolver";

describe("resolverIdiomaInicial", () => {
  it("prefere a escolha guardada válida", () => {
    expect(resolverIdiomaInicial("es", ["en-US"])).toBe("es");
  });

  it.each([
    ["pt-PT", "pt"],
    ["en-GB", "en"],
    ["es-MX", "es"],
    ["en", "en"],
    ["fr-FR", "pt"],
  ])("resolve o primeiro idioma %s para %s", (preferido, esperado) => {
    expect(resolverIdiomaInicial(null, [preferido])).toBe(esperado);
  });

  it("ignora uma escolha guardada inválida", () => {
    expect(resolverIdiomaInicial("fr", ["fr-FR"])).toBe("pt");
  });

  it("usa somente o idioma preferido, ainda que o próximo seja compatível", () => {
    expect(resolverIdiomaInicial(null, ["fr-FR", "es-AR"])).toBe("pt");
  });

  it("usa Português quando a lista de preferências está vazia", () => {
    expect(resolverIdiomaInicial(null, [])).toBe("pt");
  });
});
