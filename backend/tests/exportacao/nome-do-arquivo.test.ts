import { describe, expect, it } from "vitest";
import { nomeDoArquivoDaExportacao, nomeDoArquivoDeExportacao } from "../../src/exportacao/nome-do-arquivo.ts";

describe("nomeDoArquivoDeExportacao", () => {
  it("mantém o nome e extensão apkg", () => expect(nomeDoArquivoDeExportacao("Inglês")).toBe("Inglês.apkg"));
  it("troca caracteres proibidos e limita o nome", () => {
    expect(nomeDoArquivoDeExportacao('A/B:*?"<>|\\C')).toBe("A-B--------C.apkg");
    expect(nomeDoArquivoDeExportacao("x".repeat(150))).toBe(`${"x".repeat(100)}.apkg`);
  });
});

describe("nomeDoArquivoDaExportacao (FR-474)", () => {
  const agora = new Date("2026-03-10T02:30:00Z");

  it("um só baralho escolhido por id usa o nome do baralho", () => {
    expect(nomeDoArquivoDaExportacao({ nomesDosBaralhos: ["Inglês"], pedidoDeTodos: false, agora, fuso: "UTC" })).toBe("Inglês.apkg");
  });

  it("vários baralhos usam memorization-AAAA-MM-DD na data do fuso do usuário", () => {
    const pedido = { nomesDosBaralhos: ["Inglês", "Japonês"], pedidoDeTodos: false, agora };
    expect(nomeDoArquivoDaExportacao({ ...pedido, fuso: "America/Sao_Paulo" })).toBe("memorization-2026-03-09.apkg");
    expect(nomeDoArquivoDaExportacao({ ...pedido, fuso: "UTC" })).toBe("memorization-2026-03-10.apkg");
  });

  it("'todos' usa o nome genérico mesmo com um só baralho", () => {
    expect(nomeDoArquivoDaExportacao({ nomesDosBaralhos: ["Inglês"], pedidoDeTodos: true, agora, fuso: "UTC" })).toBe("memorization-2026-03-10.apkg");
  });
});
