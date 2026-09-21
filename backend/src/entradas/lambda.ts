import { criarFuncao } from "../funcao/funcao.ts";
import { leitorDeSegredosDoSsm } from "../funcao/ssm.ts";

/**
 * Raiz de composição da Função da nuvem (FR-122).
 *
 * É a única entrada que lê `SSM_PREFIX` — o nome que a infraestrutura de nuvem
 * já define —, e nada mais do ambiente: `DB_URL`, `DB_CA_CERT` e
 * `SEGREDO_DAS_SENHAS` **não** valem aqui, porque na nuvem os três vêm do
 * cofre, sob o prefixo, e variável de ambiente é legível para quem descreva a
 * função (FR-123). O ambiente da função tem só o que não é segredo.
 *
 * A entrada publica exatamente o que a infraestrutura espera —
 * `lambda_handler = "lambda.handler"`, com o arquivo `lambda.mjs` na raiz do
 * pacote —, e **não** escuta porto algum: nada de `listen`, nada de porta, nada
 * de soquete de escuta (FR-122).
 */

/**
 * O prefixo do cofre. A infraestrutura o define em `SSM_PREFIX` — o padrão
 * abaixo é o dela, e existe apenas para que a ausência da variável produza uma
 * falha que **nomeia** o parâmetro, e não um erro de forma.
 */
const PREFIXO_DO_COFRE = process.env.SSM_PREFIX ?? "/memorization";

/**
 * O `handler` no formato da Function URL (payload v2): o leitor de segredos do
 * SSM entra na fábrica, que monta a aplicação **uma vez** por contêiner, sem
 * escutar, e descarta a inicialização que falhou (FR-122, FR-126).
 */
export const handler = criarFuncao(leitorDeSegredosDoSsm(PREFIXO_DO_COFRE), {
  prefixo: PREFIXO_DO_COFRE,
}).handler;
