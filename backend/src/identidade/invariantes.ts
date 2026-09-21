/**
 * Regras de Nome de usuário e de Senha — o núcleo do Module `Identidade`.
 *
 * Esta é a validação primária (FR-073, FR-074, FR-075, FR-085), com mensagem
 * útil em português destinada ao usuário (FR-046). As restrições `CHECK` do
 * esquema repetem as mesmas regras apenas como rede de segurança contra erro de
 * programação, nunca como primeira linha de recusa.
 *
 * O espelho que o frontend mantém serve apenas ao aviso **durante a digitação**
 * (FR-080); a autoridade é daqui (FR-070, SC-026), e nenhuma requisição escapa
 * a estas regras, venha ela ou não da interface.
 */

/** Limites de tamanho do Nome de usuário, ambos inclusivos (FR-073). */
export const LIMITE_MINIMO_DE_NOME_DE_USUARIO = 3;
export const LIMITE_MAXIMO_DE_NOME_DE_USUARIO = 50;

/** Limites de tamanho da Senha, ambos inclusivos (FR-075). */
export const LIMITE_MINIMO_DE_SENHA = 8;
export const LIMITE_MAXIMO_DE_SENHA = 128;

/**
 * O alfabeto permitido no Nome de usuário: letras de `A` a `Z` sem acento, em
 * qualquer caixa, dígitos, `.`, `_` e `-` (FR-073).
 *
 * A restrição a letras sem acento é deliberada (`research.md`, Decisão 5): o
 * `COLLATE NOCASE` do Adapter local e o índice sobre `lower(...)` do Adapter da
 * nuvem só igualam maiúsculas e minúsculas em ASCII, e com acentos a unicidade
 * sem distinção entre maiúsculas e minúsculas prometida por FR-074 falharia
 * justamente nos nomes mais prováveis em português.
 */
export const ALFABETO_DE_NOME_DE_USUARIO = /^[A-Za-z0-9._-]+$/;

/**
 * Código estável de erro de regra de Cadastro, consumido pelo cliente. Exaustivo
 * nesta feature: `nome_de_usuario_invalido` cobre tamanho fora de 3 a 50 e
 * caractere não permitido; `senha_invalida`, tamanho fora de 8 a 128; e
 * `nome_de_usuario_existente`, o Nome de usuário já cadastrado, sem distinção
 * entre maiúsculas e minúsculas.
 */
export type CodigoDeErroDeCadastro =
  | "nome_de_usuario_invalido"
  | "senha_invalida"
  | "nome_de_usuario_existente";

/**
 * Falha de regra de domínio. É resultado previsto da Interface, não exceção: o
 * caller decide o que fazer com `erro` e `mensagem` sem capturar exceção.
 */
export interface FalhaDeRegraDeCadastro {
  erro: CodigoDeErroDeCadastro;
  mensagem: string;
}

/**
 * Valida o Nome de usuário **já sem os espaços das extremidades**.
 *
 * A ordem importa: o descarte dos espaços ao redor acontece antes desta
 * validação (FR-073), no Module; aqui o nome recebido já é o canônico. O
 * tamanho é medido em caracteres, como a `CHECK` do esquema, e as duas
 * extremidades são inclusivas — 3 e 50 caracteres são válidos.
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
 * intervalo, e nunca repete o valor recebido (FR-078).
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
 * A recusa do Nome de usuário já cadastrado. A mensagem diz claramente que ele
 * já existe — o que é intencional num Cadastro aberto e foi confirmado no
 * clarify da spec (FR-074).
 */
export const NOME_DE_USUARIO_EXISTENTE = {
  erro: "nome_de_usuario_existente",
  mensagem: "Este nome de usuário já existe. Escolha outro.",
} as const;
