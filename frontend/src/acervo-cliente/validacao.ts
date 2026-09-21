/**
 * Regras de conteúdo de Cartão, de Baralho e de Cadastro para o Adapter em
 * memória (T008, T106; T607 de specs/007-criar-usuario/tasks.md).
 *
 * Réplica local dos contratos de Cartões
 * (specs/001-criar-cartao/contracts/api-cartoes.md), de Baralhos
 * (specs/002-criar-baralho/contracts/api-baralhos.md) e de Usuários
 * (specs/007-criar-usuario/contracts/api-usuarios.md), usada pelo
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
 * Código estável de erro de Vínculo, consumido pelo cliente. Exaustivo nas
 * operações de Vínculo: `vinculo_duplicado`, a recusa do par repetido imposta
 * pelo esquema; `vinculo_nao_encontrado`, a desvinculação de um Vínculo que
 * não existe; e `nao_encontrado`, Cartão ou Baralho inexistente.
 */
export const CODIGOS_DE_ERRO_DE_VINCULO = [
  "vinculo_duplicado",
  "vinculo_nao_encontrado",
  "nao_encontrado",
] as const;

export type CodigoDeErroDeVinculo =
  (typeof CODIGOS_DE_ERRO_DE_VINCULO)[number];

/**
 * Distingue um código de erro de Vínculo de qualquer outro valor que a rede
 * possa entregar. Usado pelo `ClienteHttp` para nunca deixar passar uma
 * resposta que não esteja entre os modos de erro da Interface.
 */
export function ehCodigoDeErroDeVinculo(
  valor: unknown,
): valor is CodigoDeErroDeVinculo {
  return (
    typeof valor === "string" &&
    CODIGOS_DE_ERRO_DE_VINCULO.some((codigo) => codigo === valor)
  );
}

/**
 * Código estável para entidade inexistente, compartilhado pelas operações de
 * Vínculo, edição e exclusão. O `ClienteHttp` o reconhece apenas nos status em
 * que o contrato o prevê; em qualquer outro lugar, vira `indisponivel`.
 */
export const CODIGO_DE_ERRO_NAO_ENCONTRADO = "nao_encontrado" as const;

export type CodigoDeErroDeNaoEncontrado =
  typeof CODIGO_DE_ERRO_NAO_ENCONTRADO;

/**
 * Distingue o código de entidade inexistente de qualquer outro valor que a
 * rede possa entregar.
 */
export function ehCodigoDeErroDeNaoEncontrado(
  valor: unknown,
): valor is CodigoDeErroDeNaoEncontrado {
  return valor === CODIGO_DE_ERRO_NAO_ENCONTRADO;
}

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

/** Limites de tamanho do Nome de usuário, ambos inclusivos (FR-073). */
export const LIMITE_MINIMO_DE_NOME_DE_USUARIO = 3;
export const LIMITE_MAXIMO_DE_NOME_DE_USUARIO = 50;

/**
 * Limites de tamanho da Senha, ambos inclusivos (FR-075). Fora do tamanho,
 * nenhuma regra de composição é imposta (FR-085).
 */
export const LIMITE_MINIMO_DE_SENHA = 8;
export const LIMITE_MAXIMO_DE_SENHA = 128;

/**
 * O alfabeto permitido no Nome de usuário (FR-073): letras de `A` a `Z` sem
 * acento, em qualquer caixa, dígitos, `.`, `_` e `-`.
 */
export const ALFABETO_DE_NOME_DE_USUARIO = /^[A-Za-z0-9._-]+$/;

/**
 * Código estável de erro de Cadastro, consumido pelo cliente. Exaustivo nesta
 * feature: `nome_de_usuario_invalido` cobre tamanho fora de 3 a 50 e caractere
 * não permitido; `senha_invalida`, tamanho fora de 8 a 128; e
 * `nome_de_usuario_existente`, o Nome de usuário já cadastrado, sem distinção
 * entre maiúsculas e minúsculas.
 */
export const CODIGOS_DE_ERRO_DE_CADASTRO = [
  "nome_de_usuario_invalido",
  "senha_invalida",
  "nome_de_usuario_existente",
] as const;

export type CodigoDeErroDeCadastro =
  (typeof CODIGOS_DE_ERRO_DE_CADASTRO)[number];

/**
 * Distingue um código de erro de Cadastro de qualquer outro valor que a rede
 * possa entregar. Usado pelo `ClienteHttp` para nunca deixar passar uma
 * resposta que não esteja entre os modos de erro da Interface.
 */
export function ehCodigoDeErroDeCadastro(
  valor: unknown,
): valor is CodigoDeErroDeCadastro {
  return (
    typeof valor === "string" &&
    CODIGOS_DE_ERRO_DE_CADASTRO.some((codigo) => codigo === valor)
  );
}

/**
 * Falha de regra de domínio do Cadastro. É resultado previsto da Interface,
 * não exceção.
 */
export interface FalhaDeRegraDeCadastro {
  erro: CodigoDeErroDeCadastro;
  mensagem: string;
}

/**
 * Valida o Nome de usuário **já sem os espaços das extremidades**.
 *
 * A ordem importa: o descarte dos espaços ao redor acontece antes desta
 * validação (FR-073), no Adapter; aqui o nome recebido já é o canônico. O
 * tamanho é medido em caracteres e as duas extremidades são inclusivas — 3 e
 * 50 caracteres são válidos.
 */
export function validarNomeDeUsuario(
  nomeDeUsuario: string,
): FalhaDeRegraDeCadastro | null {
  if (nomeDeUsuario.length < LIMITE_MINIMO_DE_NOME_DE_USUARIO) {
    return {
      erro: "nome_de_usuario_invalido",
      mensagem:
        `O nome de usuário deve ter pelo menos ${LIMITE_MINIMO_DE_NOME_DE_USUARIO} caracteres; ` +
        `o informado tem ${nomeDeUsuario.length}.`,
    };
  }

  if (nomeDeUsuario.length > LIMITE_MAXIMO_DE_NOME_DE_USUARIO) {
    return {
      erro: "nome_de_usuario_invalido",
      mensagem:
        `O nome de usuário deve ter no máximo ${LIMITE_MAXIMO_DE_NOME_DE_USUARIO} caracteres; ` +
        `o informado tem ${nomeDeUsuario.length}.`,
    };
  }

  if (!ALFABETO_DE_NOME_DE_USUARIO.test(nomeDeUsuario)) {
    return {
      erro: "nome_de_usuario_invalido",
      mensagem:
        "O nome de usuário aceita apenas letras de A a Z, sem acento, " +
        "dígitos, ponto, sublinhado e hífen.",
    };
  }

  return null;
}

/**
 * Valida a Senha.
 *
 * A Senha é recebida **como digitada**: nenhum espaço é descartado, nem nas
 * pontas (FR-075), e nenhuma regra de composição é imposta (FR-085) — só o
 * intervalo de 8 a 128 caracteres, ambos inclusivos. A mensagem informa o
 * intervalo e nunca repete o valor recebido (FR-078).
 */
export function validarSenha(senha: string): FalhaDeRegraDeCadastro | null {
  if (
    senha.length < LIMITE_MINIMO_DE_SENHA ||
    senha.length > LIMITE_MAXIMO_DE_SENHA
  ) {
    return {
      erro: "senha_invalida",
      mensagem:
        `A senha deve ter entre ${LIMITE_MINIMO_DE_SENHA} e ` +
        `${LIMITE_MAXIMO_DE_SENHA} caracteres; a informada tem ${senha.length}.`,
    };
  }

  return null;
}

/**
 * A recusa do Nome de usuário já cadastrado (FR-074). A mensagem diz
 * claramente que ele já existe — o que é intencional num Cadastro aberto e foi
 * confirmado no clarify da spec.
 */
export const NOME_DE_USUARIO_EXISTENTE = {
  erro: "nome_de_usuario_existente",
  mensagem: "Este nome de usuário já existe. Escolha outro.",
} as const;
