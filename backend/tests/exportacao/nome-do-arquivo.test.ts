import { describe, expect, it } from "vitest";
import { nomeDoArquivoDeExportacao } from "../../src/exportacao/nome-do-arquivo.ts";

describe("nomeDoArquivoDeExportacao", () => {
  it("mantém o nome e extensão apkg", () => expect(nomeDoArquivoDeExportacao("Inglês")).toBe("Inglês.apkg"));
  it("troca caracteres proibidos e limita o nome", () => {
    expect(nomeDoArquivoDeExportacao('A/B:*?"<>|\\C')).toBe("A-B--------C.apkg");
    expect(nomeDoArquivoDeExportacao("x".repeat(150))).toBe(`${"x".repeat(100)}.apkg`);
  });
});
