import { describe, it, expect } from "vitest";
import {
  MENSAGENS_TECNICAS,
  type CodigoDeRecusa,
  recusa,
} from "../../src/http/recusas.ts";

describe("recusas", () => {
  const codigosEsperados: readonly CodigoDeRecusa[] = [
    "indisponivel",
    "nao_encontrado",
    "dados_invalidos",
    "conflito",
    "escolhas_invalidas",
    "frente_duplicada",
    "sem_acesso",
    "nome_de_usuario_invalido",
    "nome_de_usuario_existente",
    "frente_muito_longa",
    "cartoes_indisponiveis",
    "imagem_invalida",
    "expirado",
    "corpo_invalido",
    "conflito_de_versao",
    "verso_vazio",
    "verso_muito_longo",
    "tipo_imutavel",
    "senha_invalida",
    "senha_atual_incorreta",
    "nome_vazio",
    "nome_muito_longo",
    "mesma_senha",
    "imagem_ausente",
    "frente_vazia",
    "envio_invalido",
    "descricao_muito_longa",
    "credencial_invalida",
    "acesso_expirado",
    "anki_grande_demais",
    "anki_ilegivel",
    "anki_corrompido",
    "anki_incompativel",
  ];

  it("has all expected codes", () => {
    const codigosPresentes = Object.keys(MENSAGENS_TECNICAS).sort();
    const codigosEsperadosOrdenados = codigosEsperados.slice().sort();
    expect(codigosPresentes).toEqual(codigosEsperadosOrdenados);
  });

  it("all messages are ASCII-only", () => {
    const asciiRegex = /^[\x20-\x7E]+$/;
    for (const [codigo, mensagem] of Object.entries(MENSAGENS_TECNICAS)) {
      expect(mensagem, `${codigo}: "${mensagem}"`).toMatch(asciiRegex);
    }
  });

  it("no Portuguese words in messages", () => {
    const portugueseWords =
      /não|você|cartão|baralho|usuário|senha|inválid|tente|nenhum|obrigatóri|arquivo/i;
    for (const [codigo, mensagem] of Object.entries(MENSAGENS_TECNICAS)) {
      expect(
        mensagem,
        `${codigo}: "${mensagem}" contains Portuguese words`,
      ).not.toMatch(portugueseWords);
    }
  });

  it("recusa function builds correct response", () => {
    const result = recusa("frente_muito_longa", { limite: 1000 });
    expect(result).toEqual({
      erro: "frente_muito_longa",
      mensagem: "Card front is too long.",
      limite: 1000,
    });
  });

  it("recusa function with motivo", () => {
    const result = recusa("imagem_invalida", { motivo: "tamanho" });
    expect(result).toEqual({
      erro: "imagem_invalida",
      mensagem: "Image is invalid.",
      motivo: "tamanho",
    });
  });

  it("recusa function with motivo and limite", () => {
    const result = recusa("imagem_invalida", {
      motivo: "formato",
      limite: 5242880,
    });
    expect(result).toEqual({
      erro: "imagem_invalida",
      mensagem: "Image is invalid.",
      motivo: "formato",
      limite: 5242880,
    });
  });

  it("recusa function without extras", () => {
    const result = recusa("nao_encontrado");
    expect(result).toEqual({
      erro: "nao_encontrado",
      mensagem: "Not found.",
    });
  });
});
