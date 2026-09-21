import {
  exigirValorDoParametro,
  nomeDoParametro,
  NOMES_DOS_PARAMETROS,
  type LeitorDeSegredos,
  type SegredosDaFuncao,
} from "../../src/funcao/segredos.ts";

/**
 * O Adapter **em memória** da Seam `LeitorDeSegredos` — a Implementation que os
 * cenários usam no lugar do cofre (FR-133, SC-060).
 *
 * É por ele que o `handler` real é exercitado localmente, contra o PostgreSQL
 * real de teste, **sem publicar na AWS** e sem credencial alguma. Ele devolve os
 * valores do cenário — todos **gerados por execução**, e nunca versionados — e
 * falha exatamente como o Adapter de SSM quando um deles falta: nomeando o
 * parâmetro, sob o prefixo, e sem repetir valor algum (FR-123, SC-052).
 */

/**
 * O prefixo do cofre usado pelos cenários: o **mesmo** que a infraestrutura
 * define em `SSM_PREFIX`. Não é segredo, e é o que aparece nas mensagens de
 * falha.
 */
export const PREFIXO_DE_TESTE = "/memorization";

/**
 * Um leitor que devolve os valores informados. Valor ausente ou vazio é falha
 * de inicialização que nomeia o parâmetro — a mesma regra do Adapter de SSM,
 * porque a regra é da Seam, e não de um Adapter.
 */
export function leitorDeSegredosEmMemoria(
  valores: Partial<SegredosDaFuncao>,
  prefixo: string = PREFIXO_DE_TESTE,
): LeitorDeSegredos {
  const nome = (chave: keyof typeof NOMES_DOS_PARAMETROS): string =>
    nomeDoParametro(prefixo, NOMES_DOS_PARAMETROS[chave]);

  return {
    async ler(): Promise<SegredosDaFuncao> {
      return {
        urlDeConexao: exigirValorDoParametro(
          valores.urlDeConexao,
          nome("urlDeConexao"),
        ),
        segredoDeOrigem: exigirValorDoParametro(
          valores.segredoDeOrigem,
          nome("segredoDeOrigem"),
        ),
        segredoDasSenhas: exigirValorDoParametro(
          valores.segredoDasSenhas,
          nome("segredoDasSenhas"),
        ),
      };
    },
  };
}
