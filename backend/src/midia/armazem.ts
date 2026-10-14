/**
 * `ArmazemDeMidia` — a Seam onde moram os arquivos de Imagem dos Cartões
 * (`026`, research R3).
 *
 * Dois Adapters justificam a Seam: o S3, na nuvem, e o Disco, no modo local e
 * nos testes. As regras que não dependem de onde o arquivo mora — formatos,
 * limite de tamanho, chaves e remoção de metadados — vivem aqui e são as
 * mesmas nos dois.
 *
 * O ciclo de uma Imagem: o navegador recebe um envio preparado
 * (`prepararEnvio`) e grava o arquivo como **pendente**; ao salvar o Cartão,
 * `confirmar` confere o conteúdo real (FR-411), remove os metadados (FR-427) e
 * promove o arquivo a **ativo**. Pendente nunca é legível. A leitura é sempre
 * por endereço de curta duração (FR-424), e a remoção é idempotente.
 */

import type { FormatoDeAudio } from "./audio/tipos.ts";

/** As Mídias que o armazém guarda: a Imagem (`026`) e o Áudio (`028`). */
export type Midia = "imagem" | "audio";

/** Os prefixos das chaves ativas, um por Mídia (research R2). */
export const PREFIXO_DA_MIDIA: Readonly<Record<Midia, "imagens" | "audios">> = {
  imagem: "imagens",
  audio: "audios",
};

/** Formatos aceitos, como `Content-Type` (FR-410). */
export type FormatoDeImagem =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

/** Formatos de Áudio reconhecidos, como `Content-Type` (FR-436). */
export type { FormatoDeAudio };

/** Limite de tamanho da Imagem: 5 MB (FR-410). */
export const LIMITE_DE_BYTES_DA_IMAGEM = 5_242_880;

/** Validade do envio preparado: 5 minutos (research R4). */
export const VALIDADE_DO_ENVIO_EM_SEGUNDOS = 5 * 60;

/** Validade do endereço de leitura: 15 minutos (FR-424). */
export const VALIDADE_DA_LEITURA_EM_SEGUNDOS = 15 * 60;

/** Os formatos aceitos, na ordem em que o cliente os anuncia. */
export const FORMATOS_ACEITOS: readonly FormatoDeImagem[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/** O envio que o navegador faz direto ao armazém, sem passar pela API. */
export interface EnvioPreparado {
  /** O identificador do envio pendente; o mesmo para qualquer Mídia. */
  envioId: string;
  /** `url` pode ser relativa à API (Adapter Disco) ou absoluta (S3). */
  envio: { url: string; campos: Record<string, string> };
  expiraEm: string;
}

/** Endereço de leitura de curta duração, nunca mostrado ao Usuário (FR-424). */
export interface EnderecoDeLeitura {
  url: string;
  expiraEm: string;
}

/** Motivo da recusa de uma Mídia enviada (contracts/http.md). */
export type MotivoDeRecusaDaMidia =
  | "nao_encontrada"
  | "formato"
  | "tamanho"
  | "duracao";

/**
 * Resultado de `confirmar`. `bytes` é o tamanho do arquivo já sem metadados;
 * `duracaoMs` existe só para o Áudio.
 */
export type ResultadoDaConfirmacao =
  | {
      ok: true;
      chave: string;
      formato: FormatoDeImagem | FormatoDeAudio;
      bytes: number;
      duracaoMs?: number;
    }
  | { ok: false; motivo: MotivoDeRecusaDaMidia };

export interface ArmazemDeMidia {
  /** Prepara o envio de uma Mídia nova do Usuário, válido por 5 minutos. */
  prepararEnvio(usuarioId: string, midia: Midia): Promise<EnvioPreparado>;

  /**
   * Confere o envio pendente `envioId` do Usuário pelo conteúdo real, na regra
   * da `midia` pedida, remove os metadados e o promove a ativo. Envio ausente,
   * expirado ou de outro Usuário é `nao_encontrada`; conteúdo recusado apaga o
   * pendente.
   */
  confirmar(
    usuarioId: string,
    envioId: string,
    midia: Midia,
  ): Promise<ResultadoDaConfirmacao>;

  /** Copia uma Imagem ativa para uma chave nova do mesmo Usuário (FR-422). */
  copiar(chave: string, usuarioId: string): Promise<string>;

  /** Endereço de leitura da Imagem ativa, válido por 15 minutos (FR-424). */
  enderecoDeLeitura(chave: string): Promise<EnderecoDeLeitura>;

  /** Remove as Imagens; devolve as chaves removidas (ou já ausentes). */
  remover(chaves: readonly string[]): Promise<string[]>;
}

const IDENTIFICADOR_UNICO_UNIVERSAL =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Diz se o identificador de envio é um UUID: nenhum outro texto vira parte de
 * uma chave, o que impede que o cliente aponte para fora do prefixo do Usuário.
 */
export function ehIdentificadorDeEnvio(valor: unknown): valor is string {
  return typeof valor === "string" && IDENTIFICADOR_UNICO_UNIVERSAL.test(valor);
}

/** Chave do envio pendente; nunca legível. */
export function chavePendente(usuarioId: string, envioId: string): string {
  return `pendentes/${usuarioId}/${envioId}`;
}

/**
 * A Mídia de uma chave ativa, pelo prefixo; `null` para qualquer outra chave.
 * Usada onde só a chave é conhecida, como na cópia de um Cartão (FR-422).
 */
export function midiaDaChave(chave: string): Midia | null {
  return (
    (Object.keys(PREFIXO_DA_MIDIA) as Midia[]).find((midia) =>
      chave.startsWith(`${PREFIXO_DA_MIDIA[midia]}/`),
    ) ?? null
  );
}

/** Chave da Mídia ativa, com o dono e o prefixo da Mídia. */
export function chaveAtiva(
  usuarioId: string,
  envioId: string,
  midia: Midia,
): string {
  return `${PREFIXO_DA_MIDIA[midia]}/${usuarioId}/${envioId}`;
}
