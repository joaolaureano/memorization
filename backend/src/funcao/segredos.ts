/**
 * A Seam `LeitorDeSegredos` — de onde a Função da nuvem tira os seus três
 * segredos, no início a frio (FR-123).
 *
 * A Interface tem **uma** operação e devolve os três valores juntos: a URL de
 * conexão do banco, o segredo de origem que só o CloudFront injeta e o segredo
 * do servidor das Senhas da `007`. As duas Implementations são de verdade — o
 * Adapter de SSM, que roda na nuvem, e o de memória, que roda nos testes —, e é
 * a Seam que torna a inicialização verificável **sem publicar na AWS**
 * (FR-133, SC-060): com o Adapter de memória o `handler` real é exercitado
 * contra o PostgreSQL real de teste, e a falha por parâmetro ausente é
 * provocada por cenário, sem AWS e sem credencial.
 *
 * Duas regras valem para toda Implementation, e são a razão de a Interface
 * existir:
 *
 * - parâmetro ausente, ou devolvido vazio, é falha que **nomeia o parâmetro**
 *   (o nome completo, sob o prefixo, como o cofre o conhece) e **nunca** o
 *   valor — o nome não é segredo, e é ele que torna a falha diagnosticável;
 * - nenhum valor de segredo aparece na saída, no registro ou em resposta,
 *   inclusive quando a leitura falhar (FR-123, FR-078, SC-052).
 */

/**
 * Os três segredos da Função da nuvem, já lidos — e nada mais. A validação de
 * cada um é de quem o consome: a URL pela `010`, o segredo das Senhas pela
 * `007` e o segredo de origem pela guarda de borda.
 */
export interface SegredosDaFuncao {
  /** A URL de conexão do banco de dados. */
  urlDeConexao: string;
  /** O segredo de origem que só o CloudFront injeta (FR-125). */
  segredoDeOrigem: string;
  /** O segredo do servidor das Senhas, exigido pela `007` (FR-077). */
  segredoDasSenhas: string;
}

/**
 * Os nomes dos três parâmetros, no cofre, sob o prefixo configurado em
 * `SSM_PREFIX`. São os nomes que a infraestrutura já provisiona — `DB_URL`,
 * `ORIGIN_SECRET` e `SEGREDO_DAS_SENHAS` —, e nenhum deles é segredo.
 */
export const NOMES_DOS_PARAMETROS = {
  urlDeConexao: "DB_URL",
  segredoDeOrigem: "ORIGIN_SECRET",
  segredoDasSenhas: "SEGREDO_DAS_SENHAS",
} as const;

/**
 * A Interface da Seam: uma operação, os três segredos. Ela esconde a leitura,
 * os nomes, a decifragem e o tratamento de parâmetro ausente — quem chama
 * recebe os três valores prontos, ou uma falha que nomeia o parâmetro.
 */
export interface LeitorDeSegredos {
  /**
   * Lê os três segredos no cofre. Recusa com `ParametroAusenteError` quando um
   * deles não existe ou é devolvido vazio, e com `FalhaNaLeituraDoCofreError`
   * quando a leitura inteira falha; em nenhuma das duas a mensagem carrega
   * valor de segredo.
   */
  ler(): Promise<SegredosDaFuncao>;
}

/**
 * Falha de inicialização por parâmetro ausente no cofre.
 *
 * A mensagem **nomeia o parâmetro** — o nome completo, sob o prefixo — e nada
 * do valor: é com esse nome que quem opera corrige o provisionamento (FR-123,
 * SC-052).
 */
export class ParametroAusenteError extends Error {}

/**
 * Falha ao ler o cofre: o parâmetro pode existir, e a leitura não chegou a
 * acontecer. A mensagem nomeia o prefixo, e **nunca** reproduz a mensagem do
 * SDK — ela pode trazer detalhes que não são nossos (FR-123).
 */
export class FalhaNaLeituraDoCofreError extends Error {}

/**
 * O nome completo de um parâmetro no cofre, sob o prefixo informado. O prefixo
 * da infraestrutura é `/memorization`, e uma barra final informada a mais não
 * produz `//` no nome.
 */
export function nomeDoParametro(prefixo: string, nome: string): string {
  const limpo = prefixo.replace(/\/+$/, "");

  return limpo === "" ? nome : `${limpo}/${nome}`;
}

/**
 * Devolve o valor do parâmetro, ou falha nomeando-o.
 *
 * Ausente e vazio — só espaços incluídos — são a mesma falha: um parâmetro
 * provisionado em branco não serve para nada, e o diagnóstico é o mesmo. O
 * valor, quando há um, é devolvido **como veio**: quem o consome aplica as suas
 * próprias regras.
 */
export function exigirValorDoParametro(
  valor: string | undefined,
  nomeCompleto: string,
): string {
  if (valor === undefined || valor.trim() === "") {
    throw new ParametroAusenteError(
      `Parâmetro ausente no cofre: ${nomeCompleto}. ` +
        "Provisione o parâmetro sob o prefixo configurado e tente de novo.",
    );
  }

  return valor;
}
