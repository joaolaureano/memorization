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

/**
 * Código estável de erro de regra de Cartão, consumido pelo cliente. Exaustivo
 * nesta feature: não há outro modo de falha de domínio.
 */
export type CodigoDeErroDeCartao =
  | "frente_vazia"
  | "verso_vazio"
  | "frente_muito_longa"
  | "verso_muito_longo";

/**
 * Falha de regra de domínio. É resultado previsto da Interface, não exceção:
 * o caller decide o que fazer com `erro` e `mensagem` sem capturar exceção.
 */
export interface FalhaDeRegraDeCartao {
  erro: CodigoDeErroDeCartao;
  mensagem: string;
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
      mensagem: "A frente do cartão não pode ficar vazia.",
    };
  }

  if (frente.length > LIMITE_DE_CARACTERES_DE_CARTAO) {
    return {
      erro: "frente_muito_longa",
      mensagem:
        `A frente do cartão deve ter no máximo ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres; ` +
        `a informada tem ${frente.length}.`,
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
      mensagem: "O verso do cartão não pode ficar vazio.",
    };
  }

  if (verso.length > LIMITE_DE_CARACTERES_DE_CARTAO) {
    return {
      erro: "verso_muito_longo",
      mensagem:
        `O verso do cartão deve ter no máximo ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres; ` +
        `o informado tem ${verso.length}.`,
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
      mensagem: "O nome do baralho não pode ficar vazio.",
    };
  }

  if (nome.length > LIMITE_DE_CARACTERES_DE_BARALHO) {
    return {
      erro: "nome_muito_longo",
      mensagem:
        `O nome do baralho deve ter no máximo ${LIMITE_DE_CARACTERES_DE_BARALHO} caracteres; ` +
        `o informado tem ${nome.length}.`,
    };
  }

  return null;
}
