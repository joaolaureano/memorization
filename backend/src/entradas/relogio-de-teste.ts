/**
 * O relógio **só de teste** da execução local.
 *
 * Com `AGORA_DE_TESTE` (um instante ISO-8601), o servidor local parte desse
 * instante e segue andando em tempo real a partir dele. Isso fixa o dia e a
 * semana de «hoje» para as provas de ponta a ponta, sem congelar o tempo — a
 * ordem entre gravações seguidas continua valendo. A variável é de ambiente de
 * teste e nunca da pessoa: só a entrada local a lê (a nuvem e a função não),
 * como acontece com `ORIGENS_LOCAIS_DE_TESTE`.
 */

export const VARIAVEL_DO_RELOGIO_DE_TESTE = "AGORA_DE_TESTE";

/**
 * O relógio injetável derivado do ambiente, ou `undefined` quando a variável não
 * existe — e então vale o relógio real. Um valor que não é um instante falha
 * alto, em vez de deixar a prova rodar com o dia errado.
 */
export function relogioDeTeste(
  ambiente: Record<string, string | undefined>,
  agoraReal: () => number = () => Date.now(),
): (() => Date) | undefined {
  const valor = ambiente[VARIAVEL_DO_RELOGIO_DE_TESTE];

  if (valor === undefined || valor === "") {
    return undefined;
  }

  const inicio = Date.parse(valor);

  if (Number.isNaN(inicio)) {
    throw new Error(
      `${VARIAVEL_DO_RELOGIO_DE_TESTE} deve ser um instante ISO-8601.`,
    );
  }

  const arranque = agoraReal();

  return () => new Date(inicio + (agoraReal() - arranque));
}
