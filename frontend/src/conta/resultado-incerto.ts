/**
 * Resultado incerto de uma ação da conta (017; FR-280..FR-283, SC-110).
 *
 * Quando a resposta de alterar o Nome de usuário, trocar a Senha ou excluir a
 * conta se perde, a interface não sabe se a mudança foi aplicada: anunciar
 * sucesso ou falha seria chute. Ela então **verifica** o estado real, apresentando
 * ao Entrar a Credencial nova e a antiga, e este Module decide, sem rede e sem
 * estado, o que as verificações significam:
 *
 * - Credencial nova aceita → a ação foi aplicada;
 * - Credencial antiga aceita → nada mudou, e tentar de novo não aplica duas vezes;
 * - exclusão e Credencial antiga recusada → a conta foi excluída;
 * - qualquer outra combinação, ou verificação que falhou → resultado
 *   desconhecido, com «Tentar novamente» e «Ir para Entrar» (FR-282).
 *
 * Quem chama a rede são os componentes (`verificar-resultado.ts`); aqui só se
 * decide a partir do que chegou.
 */

/** A ação cuja resposta se perdeu. */
export type AcaoDeConta = "alterar-nome" | "trocar-senha" | "excluir";

/** Desfecho de apresentar uma Credencial ao Entrar para verificar o estado real. */
export type Verificacao = "aceita" | "recusada" | "falhou";

/** O que já se sabe: a Credencial nova só existe para renomear e trocar a Senha. */
export interface Verificacoes {
  nova?: Verificacao;
  antiga?: Verificacao;
}

/** O que a interface deve concluir (FR-280..FR-283). */
export type DecisaoDoResultadoIncerto =
  | "aplicada"
  | "nao_aplicada"
  | "excluida"
  | "desconhecido";

/**
 * Diz qual Credencial verificar em seguida, ou `null` quando já há decisão. A
 * Credencial nova vem primeiro — se ela vale, a antiga nem precisa ser
 * consultada —, e a exclusão só consulta a antiga.
 */
export function proximaVerificacao(
  acao: AcaoDeConta,
  verificacoes: Verificacoes,
): "nova" | "antiga" | null {
  if (decidirResultadoIncerto(acao, verificacoes) !== null) {
    return null;
  }

  if (acao !== "excluir" && verificacoes.nova === undefined) {
    return "nova";
  }

  return "antiga";
}

/**
 * Decide o resultado a partir das verificações feitas. Devolve `null` enquanto
 * falta verificar alguma Credencial necessária.
 */
export function decidirResultadoIncerto(
  acao: AcaoDeConta,
  verificacoes: Verificacoes,
): DecisaoDoResultadoIncerto | null {
  if (acao === "excluir") {
    switch (verificacoes.antiga) {
      case undefined:
        return null;
      case "aceita":
        return "nao_aplicada";
      case "recusada":
        return "excluida";
      case "falhou":
        return "desconhecido";
    }
  }

  if (verificacoes.nova === "aceita") {
    return "aplicada";
  }

  if (verificacoes.nova === undefined) {
    return null;
  }

  switch (verificacoes.antiga) {
    case undefined:
      return null;
    case "aceita":
      return "nao_aplicada";
    case "recusada":
    case "falhou":
      return "desconhecido";
  }
}
