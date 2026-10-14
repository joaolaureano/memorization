/**
 * Technical refusal messages in English (FR-018, FR-019).
 *
 * Each code maps to a concise, ASCII-only English message for debugging.
 * Never shown to users — the client translates codes to product text (FR-015, FR-016).
 * Anki codes are not included here (task T039).
 */

import {
  MENSAGEM_DA_RECUSA_DO_AUDIO,
  type MotivoDeRecusaDoAudio,
} from "../acervo/invariantes.ts";

export type CodigoDeRecusa =
  | "indisponivel"
  | "nao_encontrado"
  | "dados_invalidos"
  | "conflito"
  | "escolhas_invalidas"
  | "frente_duplicada"
  | "sem_acesso"
  | "nome_de_usuario_invalido"
  | "nome_de_usuario_existente"
  | "frente_muito_longa"
  | "cartoes_indisponiveis"
  | "imagem_invalida"
  | "expirado"
  | "corpo_invalido"
  | "conflito_de_versao"
  | "verso_vazio"
  | "verso_muito_longo"
  | "tipo_imutavel"
  | "senha_invalida"
  | "senha_atual_incorreta"
  | "nome_vazio"
  | "nome_muito_longo"
  | "mesma_senha"
  | "imagem_ausente"
  | "frente_vazia"
  | "envio_invalido"
  | "descricao_muito_longa"
  | "credencial_invalida"
  | "acesso_expirado"
  | "anki_grande_demais"
  | "anki_ilegivel"
  | "anki_corrompido"
  | "anki_incompativel"
  | "audio_ausente"
  | "audio_invalido";

export const MENSAGENS_TECNICAS: Record<CodigoDeRecusa, string> = {
  indisponivel: "Storage is unavailable. Try again.",
  nao_encontrado: "Not found.",
  dados_invalidos: "Invalid data.",
  conflito: "Conflict. Try again.",
  escolhas_invalidas: "Choices must be a valid list.",
  frente_duplicada: "A card with this front already exists in this deck.",
  sem_acesso: "Access denied.",
  nome_de_usuario_invalido: "Username is invalid.",
  nome_de_usuario_existente: "This username already exists. Choose another.",
  frente_muito_longa: "Card front is too long.",
  cartoes_indisponiveis: "Some cards are no longer available.",
  imagem_invalida: "Image is invalid.",
  expirado: "Expired.",
  corpo_invalido: "Request body is invalid.",
  conflito_de_versao: "Version conflict.",
  verso_vazio: "Card back cannot be empty.",
  verso_muito_longo: "Card back is too long.",
  tipo_imutavel: "Card type cannot be changed after creation.",
  senha_invalida: "Password is invalid.",
  senha_atual_incorreta: "Current password is incorrect.",
  nome_vazio: "Name cannot be empty.",
  nome_muito_longo: "Name is too long.",
  mesma_senha: "New password must be different from the current password.",
  imagem_ausente: "Choose an image.",
  frente_vazia: "Card front cannot be empty.",
  envio_invalido: "Upload is invalid.",
  descricao_muito_longa: "Description is too long.",
  credencial_invalida: "Username or password is incorrect.",
  acesso_expirado: "Session expired.",
  anki_grande_demais: "Anki file exceeds the size limit.",
  anki_ilegivel: "Anki file could not be read.",
  anki_corrompido: "Anki file is corrupted or exceeds the expansion limit.",
  anki_incompativel: "File does not contain a compatible Anki collection.",
  audio_ausente: "Choose an audio file.",
  audio_invalido: "Audio is invalid.",
};

export interface RecusaBody<C extends CodigoDeRecusa = CodigoDeRecusa> {
  erro: C;
  mensagem: string;
  motivo?: string;
  limite?: number;
}

export function recusa<C extends CodigoDeRecusa>(
  codigo: C,
  extras?: { motivo?: string; limite?: number },
): RecusaBody<C> {
  return {
    erro: codigo,
    mensagem: MENSAGENS_TECNICAS[codigo],
    ...(extras?.motivo && { motivo: extras.motivo }),
    ...(extras?.limite !== undefined && { limite: extras.limite }),
  };
}

/**
 * Body for an `audio_invalido` refusal (FR-459, specs/028-cartao-com-audio
 * contracts/http.md). The generic `recusa()` builder uses one message per code,
 * so per-motivo messages and limits are built here. Limits are in bytes for
 * "tamanho" and in seconds for "duracao".
 */
export function recusaDeAudioInvalido(
  motivo: MotivoDeRecusaDoAudio,
): RecusaBody<"audio_invalido"> {
  switch (motivo) {
    case "tamanho":
      return {
        erro: "audio_invalido",
        mensagem: MENSAGEM_DA_RECUSA_DO_AUDIO.tamanho,
        motivo,
        limite: 10485760,
      };
    case "duracao":
      return {
        erro: "audio_invalido",
        mensagem: MENSAGEM_DA_RECUSA_DO_AUDIO.duracao,
        motivo,
        limite: 300,
      };
    case "formato":
      return {
        erro: "audio_invalido",
        mensagem: MENSAGEM_DA_RECUSA_DO_AUDIO.formato,
        motivo,
      };
    case "nao_encontrado":
      return {
        erro: "audio_invalido",
        mensagem: MENSAGEM_DA_RECUSA_DO_AUDIO.nao_encontrado,
        motivo,
      };
  }
}
