import { removerMetadados } from "./metadados.ts";

/**
 * `ArmazemDeImagens` — a Seam onde moram os arquivos de Imagem dos Cartões
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

/** Formatos aceitos, como `Content-Type` (FR-410). */
export type FormatoDeImagem =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

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
  imagemId: string;
  /** `url` pode ser relativa à API (Adapter Disco) ou absoluta (S3). */
  envio: { url: string; campos: Record<string, string> };
  expiraEm: string;
}

/** Endereço de leitura de curta duração, nunca mostrado ao Usuário (FR-424). */
export interface EnderecoDeLeitura {
  url: string;
  expiraEm: string;
}

/** Motivo da recusa de uma Imagem enviada (contracts/http.md). */
export type MotivoDeRecusaDaImagem = "nao_encontrada" | "formato" | "tamanho";

export type ResultadoDaConfirmacao =
  | { ok: true; chave: string; formato: FormatoDeImagem; bytes: number }
  | { ok: false; motivo: MotivoDeRecusaDaImagem };

export interface ArmazemDeImagens {
  /** Prepara o envio de uma Imagem nova do Usuário, válido por 5 minutos. */
  prepararEnvio(usuarioId: string): Promise<EnvioPreparado>;

  /**
   * Confere o envio pendente `imagemId` do Usuário pelo conteúdo real,
   * remove os metadados e o promove a ativo. Envio ausente, expirado ou de
   * outro Usuário é `nao_encontrada`; conteúdo recusado apaga o pendente.
   */
  confirmar(
    usuarioId: string,
    imagemId: string,
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
 * Diz se o identificador é um UUID: nenhum outro texto vira parte de uma
 * chave, o que impede que o cliente aponte para fora do prefixo do Usuário.
 */
export function ehIdentificadorDeImagem(valor: unknown): valor is string {
  return typeof valor === "string" && IDENTIFICADOR_UNICO_UNIVERSAL.test(valor);
}

/** Chave do envio pendente; nunca legível. */
export function chavePendente(usuarioId: string, imagemId: string): string {
  return `pendentes/${usuarioId}/${imagemId}`;
}

/** Chave da Imagem ativa, com o dono no prefixo. */
export function chaveAtiva(usuarioId: string, imagemId: string): string {
  return `imagens/${usuarioId}/${imagemId}`;
}

/**
 * Reconhece o formato pela assinatura dos primeiros bytes, nunca pelo nome ou
 * pela declaração do navegador (FR-411, research R5).
 */
export function detectarFormato(bytes: Uint8Array): FormatoDeImagem | null {
  const comeca = (assinatura: readonly number[], desde = 0): boolean =>
    assinatura.every((byte, i) => bytes[desde + i] === byte);
  const ascii = (texto: string, desde = 0): boolean =>
    comeca([...texto].map((c) => c.charCodeAt(0)), desde);

  if (comeca([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii("GIF87a") || ascii("GIF89a")) return "image/gif";
  if (ascii("RIFF") && ascii("WEBP", 8)) return "image/webp";
  return null;
}

/**
 * A regra comum de `confirmar`: confere tamanho e formato reais e devolve o
 * arquivo já sem metadados, pronto para ser gravado como ativo.
 */
export function prepararImagemConfirmada(
  bytes: Uint8Array,
):
  | { ok: true; formato: FormatoDeImagem; bytes: Uint8Array }
  | { ok: false; motivo: "formato" | "tamanho" } {
  if (bytes.length === 0 || bytes.length > LIMITE_DE_BYTES_DA_IMAGEM) {
    return { ok: false, motivo: "tamanho" };
  }

  const formato = detectarFormato(bytes);

  if (formato === null) {
    return { ok: false, motivo: "formato" };
  }

  const limpo = removerMetadados(bytes, formato);

  return limpo === null
    ? { ok: false, motivo: "formato" }
    : { ok: true, formato, bytes: limpo };
}
