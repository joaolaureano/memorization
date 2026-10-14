/**
 * Regras de conteúdo de Cartão e de Baralho — o núcleo do Module `Acervo`.
 *
 * Esta é a validação primária (FR-002, FR-011, FR-051, FR-052, FR-061), com
 * mensagem útil em português destinada ao usuário (FR-046). As restrições
 * `CHECK` do esquema repetem as mesmas regras apenas como rede de segurança
 * contra erro de programação, nunca como primeira linha de recusa.
 */

/** Limite de caracteres de Frente e Verso (FR-052). */
export const LIMITE_DE_CARACTERES_DE_CARTAO = 1000;

/** Chave de comparação para Frentes únicas dentro de um Baralho (FR-398). */
export function normalizarFrente(frente: string): string {
  return frente
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** Normaliza as tags como listas sem espaços externos, vazios ou duplicatas. */
export function normalizarTags(tags: readonly string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Código estável de erro de regra de Cartão, consumido pelo cliente. Exaustivo
 * nesta feature: não há outro modo de falha de domínio.
 */
export type CodigoDeErroDeCartao =
  | "frente_vazia"
  | "verso_vazio"
  | "frente_muito_longa"
  | "verso_muito_longo"
  | "frente_duplicada"
  | "descricao_muito_longa"
  | "imagem_ausente"
  | "audio_ausente";

/**
 * Falha de regra de domínio. É resultado previsto da Interface, não exceção:
 * o caller decide o que fazer com `erro` e `mensagem` sem capturar exceção.
 * O `limite` é incluído quando a validação tem um limite numérico.
 */
export interface FalhaDeRegraDeCartao {
  erro: CodigoDeErroDeCartao;
  mensagem: string;
  limite?: number;
}

/**
 * Valida a Frente.
 *
 * A ordem importa: conteúdo composto só de espaços é tratado como vazio
 * (FR-051) antes de medir tamanho, e o limite de 1000 caracteres (FR-052) é
 * medido sobre o texto como recebido, igual à `CHECK` do esquema — assim o
 * `Acervo` nunca produz um valor que a rede de segurança do banco recusaria.
 * O `trim` de JavaScript descarta mais caracteres que o `trim` do SQLite
 * (tabs, quebras de linha), portanto a validação aqui é no mínimo tão estrita
 * quanto a da `CHECK`, nunca mais permissiva.
 */
export function validarFrente(frente: string): FalhaDeRegraDeCartao | null {
  if (frente.trim().length === 0) {
    return {
      erro: "frente_vazia",
      mensagem: "Card front cannot be empty.",
    };
  }

  if (frente.length > LIMITE_DE_CARACTERES_DE_CARTAO) {
    return {
      erro: "frente_muito_longa",
      mensagem:
        `Card front is too long. Maximum ${LIMITE_DE_CARACTERES_DE_CARTAO} characters; ` +
        `provided has ${frente.length}.`,
      limite: LIMITE_DE_CARACTERES_DE_CARTAO,
    };
  }

  return null;
}

/**
 * Valida o Verso, com as mesmas regras da Frente.
 */
export function validarVerso(verso: string): FalhaDeRegraDeCartao | null {
  if (verso.trim().length === 0) {
    return {
      erro: "verso_vazio",
      mensagem: "Card back cannot be empty.",
    };
  }

  if (verso.length > LIMITE_DE_CARACTERES_DE_CARTAO) {
    return {
      erro: "verso_muito_longo",
      mensagem:
        `Card back is too long. Maximum ${LIMITE_DE_CARACTERES_DE_CARTAO} characters; ` +
        `provided has ${verso.length}.`,
      limite: LIMITE_DE_CARACTERES_DE_CARTAO,
    };
  }

  return null;
}

/** Limite de caracteres do nome de Baralho (FR-061). */
export const LIMITE_DE_CARACTERES_DE_BARALHO = 100;

/**
 * Código estável de erro de regra de Baralho, consumido pelo cliente.
 * Exaustivo nesta feature: não há outro modo de falha de domínio.
 */
export type CodigoDeErroDeBaralho =
  | "nome_vazio"
  | "nome_muito_longo";

/**
 * Falha de regra de domínio. É resultado previsto da Interface, não exceção:
 * o caller decide o que fazer com `erro` e `mensagem` sem capturar exceção.
 */
export interface FalhaDeRegraDeBaralho {
  erro: CodigoDeErroDeBaralho;
  mensagem: string;
  /** O limite em caracteres, quando a recusa é por tamanho (027, contracts/http.md). */
  limite?: number;
}

/**
 * Valida o nome do Baralho.
 *
 * A ordem importa: conteúdo composto só de espaços é tratado como vazio
 * (FR-011) antes de medir tamanho, e o limite de 100 caracteres (FR-061) é
 * medido sobre o texto como recebido, igual à `CHECK` do esquema — assim o
 * `Acervo` nunca produz um valor que a rede de segurança do banco recusaria.
 * O `trim` de JavaScript descarta mais caracteres que o `trim` do SQLite
 * (tabs, quebras de linha), portanto a validação aqui é no mínimo tão estrita
 * quanto a da `CHECK`, nunca mais permissiva.
 */
export function validarNomeDeBaralho(
  nome: string,
): FalhaDeRegraDeBaralho | null {
  if (nome.trim().length === 0) {
    return {
      erro: "nome_vazio",
      mensagem: "Deck name cannot be empty.",
    };
  }

  if (nome.length > LIMITE_DE_CARACTERES_DE_BARALHO) {
    return {
      erro: "nome_muito_longo",
      mensagem:
        `Deck name is too long. Maximum ${LIMITE_DE_CARACTERES_DE_BARALHO} characters; ` +
        `provided has ${nome.length}.`,
      limite: LIMITE_DE_CARACTERES_DE_BARALHO,
    };
  }

  return null;
}

/**
 * Enumera a Frente para evitar colisão no Baralho (FR-398).
 *
 * Se a Frente normalizada não está no conjunto, devolve a Frente inalterada.
 * Senão, devolve `` `${frente.trim()} (${n})` `` com o menor n >= 2 cuja
 * chave normalizada esteja livre.
 *
 * FR-398.
 */
export function numerarFrente(
  frente: string,
  chavesOcupadas: ReadonlySet<string>,
): string {
  const chave = normalizarFrente(frente);
  const aparada = frente.trim();

  if (!chavesOcupadas.has(chave)) {
    return frente;
  }

  for (let n = 2; ; n++) {
    const candidata = `${aparada} (${n})`;
    const chaveCandidata = normalizarFrente(candidata);

    if (!chavesOcupadas.has(chaveCandidata)) {
      return candidata;
    }
  }
}

/**
 * Código estável de erro de Vínculo, consumido pelo cliente. Exaustivo nesta
 * feature: `nao_encontrado` cobre Cartão ou Baralho inexistente;
 * `vinculo_duplicado`, a recusa do par repetido imposta pelo esquema; e
 * `vinculo_nao_encontrado`, a desvinculação de um Vínculo que não existe.
 */
export type CodigoDeErroDeVinculo =
  | "vinculo_duplicado"
  | "vinculo_nao_encontrado"
  | "nao_encontrado";

/** Motivo da recusa do Áudio enviado (contracts/http.md, `028`). */
export type MotivoDeRecusaDoAudio =
  | "nao_encontrado"
  | "formato"
  | "tamanho"
  | "duracao";

/**
 * As mensagens técnicas da recusa do Áudio, por motivo (`028`, FR-459). Fonte
 * única: o `Acervo` e o Adapter HTTP (`recusaDeAudioInvalido`) leem daqui.
 */
export const MENSAGEM_DA_RECUSA_DO_AUDIO: Readonly<Record<MotivoDeRecusaDoAudio, string>> = {
  formato: "File is not a supported audio format.",
  tamanho: "Audio exceeds the size limit.",
  nao_encontrado: "Audio upload was not found.",
  duracao: "Audio exceeds the duration limit.",
};
