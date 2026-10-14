import { describe, expect, it } from "vitest";

import { pt } from "../src/idioma/pt";
import { en } from "../src/idioma/en";
import { es } from "../src/idioma/es";

describe("Catálogos de idioma", () => {
  const catalogos = { pt, en, es } as const;

  it("tem as mesmas chaves em todos os idiomas (recursivamente)", () => {
    const chavesDoPt = extrairChaves(pt);
    const chavasDoEn = extrairChaves(en);
    const chavasDoEs = extrairChaves(es);

    expect(chavasDoEn).toEqual(chavesDoPt);
    expect(chavasDoEs).toEqual(chavesDoPt);
  });

  it("nunca tem valores vazios após trim()", () => {
    for (const idioma of Object.values(catalogos)) {
      verificarValoresVazios(idioma);
    }
  });

  it("as funções devolvem valores não-vazios", () => {
    const argumentosDeTeste = [0, 1, 2, 5];

    for (const idioma of Object.values(catalogos)) {
      verificarFuncoes(idioma, argumentosDeTeste);
    }
  });
});

function extrairChaves(obj: unknown, prefixo = ""): Set<string> {
  const chaves = new Set<string>();

  if (obj === null || typeof obj !== "object") {
    return chaves;
  }

  for (const [chave, valor] of Object.entries(obj)) {
    const caminhoCompleto = prefixo ? `${prefixo}.${chave}` : chave;

    if (typeof valor === "function") {
      chaves.add(caminhoCompleto);
    } else if (typeof valor === "string") {
      chaves.add(caminhoCompleto);
    } else if (valor !== null && typeof valor === "object") {
      const subChaves = extrairChaves(valor, caminhoCompleto);
      for (const subChave of subChaves) {
        chaves.add(subChave);
      }
    }
  }

  return chaves;
}

function verificarValoresVazios(obj: unknown, caminho = ""): void {
  if (obj === null || typeof obj !== "object") {
    return;
  }

  for (const [chave, valor] of Object.entries(obj)) {
    const caminhoCompleto = caminho ? `${caminho}.${chave}` : chave;

    if (typeof valor === "string") {
      expect(
        valor.trim().length > 0,
        `${caminhoCompleto} é uma string vazia após trim()`,
      ).toBe(true);
    } else if (valor !== null && typeof valor === "object" && typeof valor !== "function") {
      verificarValoresVazios(valor, caminhoCompleto);
    }
  }
}

function verificarFuncoes(obj: unknown, argumentos: number[], caminho = ""): void {
  if (obj === null || typeof obj !== "object") {
    return;
  }

  for (const [chave, valor] of Object.entries(obj)) {
    const caminhoCompleto = caminho ? `${caminho}.${chave}` : chave;

    if (typeof valor === "function") {
      for (const arg of argumentos) {
        const resultado = valor(arg);
        expect(
          typeof resultado === "string" && resultado.trim().length > 0,
          `${caminhoCompleto}(${arg}) deveria devolver uma string não-vazia`,
        ).toBe(true);
      }
    } else if (valor !== null && typeof valor === "object") {
      verificarFuncoes(valor, argumentos, caminhoCompleto);
    }
  }
}
