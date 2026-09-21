/**
 * Regras de conteúdo de Cartão e de Baralho para o Adapter em memória (T008,
 * T106).
 *
 * Réplica local dos contratos de Cartões
 * (specs/001-criar-cartao/contracts/api-cartoes.md) e de Baralhos
 * (specs/002-criar-baralho/contracts/api-baralhos.md), usada pelo
 * `ClienteEmMemoria` — o stand-in da API nos testes do cliente. A autoridade
 * permanece na API: esta réplica existe para que a bateria compartilhada
 * produza resultados idênticos contra os dois Adapters da Seam, nunca para
 * substituir a validação do servidor.
 */

/** Limite de caracteres de Frente e Verso (FR-052). */
export const LIMITE_DE_CARACTERES_DE_CARTAO = 1000;

/**
 * Código estável de erro de regra de Cartão, consumido pelo cliente.
 * Exaustivo nesta feature: não há outro modo de falha de domínio.
 */
export const CODIGOS_DE_ERRO_DE_CARTAO = [
  "frente_vazia",
  "verso_vazio",
  "frente_muito_longa",
  "verso_muito_longo",
] as const;

export type CodigoDeErroDeCartao =
  (typeof CODIGOS_DE_ERRO_DE_CARTAO)[number];

/**
 * Distingue um código de erro de regra de Cartão de qualquer outro valor que
 * a rede possa entregar. Usado pelo `ClienteHttp` para nunca deixar passar
 * uma resposta que não esteja entre os modos de erro da Interface.
 */
export function ehCodigoDeErroDeCartao(
  valor: unknown,
): valor is CodigoDeErroDeCartao {
  return (
    typeof valor === "string" &&
    CODIGOS_DE_ERRO_DE_CARTAO.some((codigo) => codigo === valor)
  );
}

/**
 * Falha de regra de domínio. É resultado previsto da Interface, não exceção.
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
 * medido sobre o texto como recebido — o mesmo comportamento da API.
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
export const CODIGOS_DE_ERRO_DE_BARALHO = [
  "nome_vazio",
  "nome_muito_longo",
] as const;

export type CodigoDeErroDeBaralho =
  (typeof CODIGOS_DE_ERRO_DE_BARALHO)[number];

/**
 * Distingue um código de erro de regra de Baralho de qualquer outro valor que
 * a rede possa entregar. Usado pelo `ClienteHttp` para nunca deixar passar
 * uma resposta que não esteja entre os modos de erro da Interface.
 */
export function ehCodigoDeErroDeBaralho(
  valor: unknown,
): valor is CodigoDeErroDeBaralho {
  return (
    typeof valor === "string" &&
    CODIGOS_DE_ERRO_DE_BARALHO.some((codigo) => codigo === valor)
  );
}

/**
 * Falha de regra de domínio. É resultado previsto da Interface, não exceção.
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
 * medido sobre o texto como recebido — o mesmo comportamento da API.
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
