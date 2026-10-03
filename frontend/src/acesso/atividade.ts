/**
 * Atividade da pessoa na página — o Module puro que decide **quando renovar** o
 * Acesso temporário (018; D3, FR-291, SC-124).
 *
 * O servidor renova o Acesso em toda requisição autenticada, mas muita coisa
 * que a pessoa faz não faz requisição: digitar num formulário, Revelar o Verso,
 * Avaliar um Item, navegar entre telas. Sem isso, quem estuda por mais de 5
 * minutos sem tocar na rede perderia o Acesso no meio da Sessão. A casca
 * observa teclado, clique e toque e **informa o instante** de cada interação a
 * este Module, que responde se uma renovação é devida — no máximo uma por
 * intervalo de 60 s, para não transformar cada tecla numa requisição.
 *
 * O Module não tem I/O, relógio, estado nem conhecimento de evento algum: recebe
 * instantes e devolve uma decisão. Quem observa os eventos e chama
 * `POST /acesso/renovar` é a `Aplicacao`.
 */

/** O intervalo mínimo entre duas renovações enquanto houver interação (D3). */
export const INTERVALO_DE_RENOVACAO_EM_MS = 60_000;

/** O que fazer com uma interação: pedir a renovação ou aguardar. */
export type DecisaoDeRenovacao = "renovar" | "aguardar";

/**
 * Decide a renovação a partir de dois instantes, em milissegundos:
 *
 * - `interacaoEm`: o instante da interação da pessoa, ou `null` quando não
 *   houve nenhuma — sem interação **nunca** se renova, de modo que a pessoa
 *   ociosa deixa o Acesso expirar (FR-291, FR-294);
 * - `ultimaRenovacaoEm`: o instante da última vez em que o servidor foi tocado
 *   — o Entrar, a carga da aplicação ou a renovação anterior — ou `null` quando
 *   nenhuma é conhecida.
 *
 * A primeira interação sem renovação conhecida renova; depois, só quando passou
 * o intervalo de 60 s. Um relógio que anda para trás (`interacaoEm` anterior à
 * última renovação) não renova: aguarda, em vez de disparar renovações.
 */
export function decidirRenovacao(
  interacaoEm: number | null,
  ultimaRenovacaoEm: number | null,
): DecisaoDeRenovacao {
  if (interacaoEm === null) {
    return "aguardar";
  }

  if (ultimaRenovacaoEm === null) {
    return "renovar";
  }

  return interacaoEm - ultimaRenovacaoEm >= INTERVALO_DE_RENOVACAO_EM_MS
    ? "renovar"
    : "aguardar";
}
