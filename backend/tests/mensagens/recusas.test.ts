import { describe, it, expect } from "vitest";
import {
  MENSAGENS_TECNICAS,
  type CodigoDeRecusa,
  recusa,
  recusaDeAudioInvalido,
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
    "audio_ausente",
    "audio_invalido",
    "exportacao_vazia",
    "exportacao_grande_demais",
    "exportacao_indisponivel",
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

  it("audio_ausente and audio_invalido have the exact English messages", () => {
    expect(MENSAGENS_TECNICAS.audio_ausente).toBe("Choose an audio file.");
    expect(MENSAGENS_TECNICAS.audio_invalido).toBe("Audio is invalid.");
  });

  it("export refusals have stable English ASCII messages", () => {
    expect(MENSAGENS_TECNICAS.exportacao_vazia).toBe("Nothing to export.");
    expect(MENSAGENS_TECNICAS.exportacao_grande_demais).toBe("Export exceeds the size limit.");
    expect(MENSAGENS_TECNICAS.exportacao_indisponivel).toBe("Export is unavailable.");
  });

  it("recusaDeAudioInvalido builds size refusal with limit", () => {
    expect(recusaDeAudioInvalido("tamanho")).toEqual({
      erro: "audio_invalido",
      mensagem: "Audio exceeds the size limit.",
      motivo: "tamanho",
      limite: 10485760,
    });
  });

  it("recusaDeAudioInvalido builds duration refusal with limit", () => {
    expect(recusaDeAudioInvalido("duracao")).toEqual({
      erro: "audio_invalido",
      mensagem: "Audio exceeds the duration limit.",
      motivo: "duracao",
      limite: 300,
    });
  });

  it("recusaDeAudioInvalido builds format refusal without limit", () => {
    expect(recusaDeAudioInvalido("formato")).toEqual({
      erro: "audio_invalido",
      mensagem: "File is not a supported audio format.",
      motivo: "formato",
    });
  });

  it("recusaDeAudioInvalido builds not-found refusal without limit", () => {
    expect(recusaDeAudioInvalido("nao_encontrado")).toEqual({
      erro: "audio_invalido",
      mensagem: "Audio upload was not found.",
      motivo: "nao_encontrado",
    });
  });
});
