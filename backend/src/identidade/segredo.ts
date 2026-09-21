/**
 * O segredo do servidor das Senhas — a chave que entra no HMAC antes do scrypt
 * e que **nunca** é versionada (Princípio VIII, FR-076).
 *
 * A leitura do ambiente acontece no início do processo, pelas entradas que
 * sobem a API, e não a cada requisição: assim a aplicação **recusa iniciar**
 * quando o segredo falta (FR-077, SC-024), em vez de falhar só no primeiro
 * Cadastro. Nenhum Module conhece `process.env`: o `Identidade` recebe o
 * segredo pronto pela sua Interface.
 *
 * O segredo é fornecido pelo ambiente de execução e precisa ser **o mesmo para
 * uma mesma base**: trocá-lo torna inverificáveis os hashes já gravados. A
 * regra operacional está no quickstart.
 */

/** A variável de ambiente que carrega o segredo. */
export const VARIAVEL_DO_SEGREDO = "SEGREDO_DAS_SENHAS";

/** Comprimento mínimo do segredo exigido para iniciar. */
export const COMPRIMENTO_MINIMO_DO_SEGREDO = 32;

/**
 * Erro lançado quando o segredo do servidor não está configurado.
 *
 * A mensagem nomeia a **variável** e a **regra**, e nunca o valor informado —
 * mesmo padrão de `PortaInvalidaError` em `servidor.ts` (FR-077, FR-078).
 */
export class SegredoAusenteError extends Error {}

/**
 * Devolve o segredo do servidor, ou recusa com `SegredoAusenteError`.
 *
 * Recebe o ambiente por parâmetro, em vez de ler `process.env` direto, para que
 * o início possa ser exercitado sem mexer no ambiente do processo de teste. A
 * ausência e o comprimento curto têm mensagens distintas — e ambas nomeiam a
 * variável e a regra, sem repetir valor algum.
 */
export function segredoConfigurado(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const segredo = env[VARIAVEL_DO_SEGREDO];

  if (segredo === undefined || segredo.length === 0) {
    throw new SegredoAusenteError(
      `A variável de ambiente ${VARIAVEL_DO_SEGREDO} não foi informada. ` +
        `Informe um segredo com pelo menos ${COMPRIMENTO_MINIMO_DO_SEGREDO} caracteres.`,
    );
  }

  if (segredo.length < COMPRIMENTO_MINIMO_DO_SEGREDO) {
    throw new SegredoAusenteError(
      `A variável de ambiente ${VARIAVEL_DO_SEGREDO} tem menos de ` +
        `${COMPRIMENTO_MINIMO_DO_SEGREDO} caracteres. ` +
        `Informe um segredo com pelo menos ${COMPRIMENTO_MINIMO_DO_SEGREDO} caracteres.`,
    );
  }

  return segredo;
}
