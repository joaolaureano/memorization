// Limite de mídia própria de Conta de teste (030, T034).

import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { criarAcervo, LIMITE_DE_MIDIA_DA_CONTA_DE_TESTE } from "../../src/acervo/acervo.ts";
import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarIdentidade } from "../../src/identidade/identidade.ts";
import type { ArmazemDeMidia } from "../../src/midia/armazem.ts";
import { criarDonoDeTeste, segredoGerado } from "../armazenamento/usuarios-de-teste.ts";

describe("limite de mídia própria da Conta de teste (FR-495a)", () => {
  it("ignora mídia de demonstração, recusa acima de 20 MiB, libera ao excluir e não limita conta real", async () => {
    const aberto = await abrirArmazenamentoSqlite(":memory:");
    const tamanhos = new Map<string, number>();
    let sequencia = 0;
    const imagens = {
      async medir(chaves: readonly string[]) {
        return chaves.reduce((total, chave) => total + (chave.startsWith("demonstracao/") ? 50_000_000 : tamanhos.get(chave) ?? 0), 0);
      },
      async ler() { return null; },
      async gravarArquivoFixo() {},
      async confirmar(usuarioId: string, _envioId: string, midia: "imagem" | "audio") {
        const chave = `${midia === "imagem" ? "imagens" : "audios"}/${usuarioId}/${randomUUID()}.${++sequencia}`;
        tamanhos.set(chave, 5_242_880);
        return { ok: true as const, chave, formato: midia === "imagem" ? "image/png" as const : "audio/mpeg" as const, bytes: 5_242_880, ...(midia === "audio" ? { duracaoMs: 1_000 } : {}) };
      },
      async enderecoDeLeitura(chave: string) { return { url: chave, expiraEm: new Date().toISOString() }; },
      async remover(chaves: readonly string[]) { for (const chave of chaves) tamanhos.delete(chave); return [...chaves]; },
      async guardarExportacao() { return { url: "", expiraEm: "" }; },
      async prepararEnvio() { return { envioId: "envio", envio: { url: "", campos: {} }, expiraEm: "" }; },
      async copiar(chave: string) { return chave; },
    } as unknown as ArmazemDeMidia;

    try {
      const identidade = criarIdentidade(aberto.usuarios, segredoGerado(), {
        midia: imagens,
        contasDeTeste: aberto.armazenamento,
      });
      const teste = await identidade.criarContaDeTeste({
        fuso: "America/Sao_Paulo", idioma: "pt", origem: "origem-de-prova",
      });
      if (!teste.ok) throw new Error(`não criou a conta de teste: ${teste.erro}`);
      const baralho = (await aberto.armazenamento.listarBaralhos(teste.usuario.id))[0]!;
      const acervoTeste = criarAcervo(aberto.armazenamento, teste.usuario.id, { imagens, contaDeTeste: true });
      const criarImagem = (alvo: typeof acervoTeste, envioId: string) => alvo.criarCartao(baralho.id, {
        tipo: "imagem", imagemId: envioId, frente: "", verso: "Bandeira",
      });
      const criarAudio = (envioId: string) => acervoTeste.criarCartao(baralho.id, {
        tipo: "audio", audioId: envioId, frente: "", verso: "Sabiá",
      });

      const criadas = [];
      for (let i = 0; i < 3; i += 1) {
        const criada = await criarImagem(acervoTeste, `envio-${i}`);
        expect(criada.ok).toBe(true);
        if (criada.ok) criadas.push(criada.cartao);
      }
      const audio = await criarAudio("audio-no-limite");
      expect(audio.ok).toBe(true);
      expect(LIMITE_DE_MIDIA_DA_CONTA_DE_TESTE).toBe(20_971_520);
      expect((await criarImagem(acervoTeste, "envio-limite")).ok).toBe(false);

      expect((await acervoTeste.excluirCartao(criadas[0]!.id)).ok).toBe(true);
      expect((await criarImagem(acervoTeste, "envio-liberado")).ok).toBe(true);

      const idReal = await criarDonoDeTeste(aberto.usuarios, randomUUID(), "conta.real");
      const acervoReal = criarAcervo(aberto.armazenamento, idReal, { imagens });
      const baralhoReal = await acervoReal.criarBaralho({ nome: "Mídia" });
      if (!baralhoReal.ok) throw new Error("não criou o Baralho real");
      for (let i = 0; i < 5; i += 1) {
        expect((await acervoReal.criarCartao(baralhoReal.baralho.id, {
          tipo: "imagem", imagemId: `real-${i}`, frente: "", verso: "Bandeira",
        })).ok).toBe(true);
      }
    } finally {
      await aberto.encerrar();
    }
  });
});
