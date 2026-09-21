/**
 * Sequência ordenada de migrações do esquema SQLite do `Acervo` — a Seam
 * interna da sua Implementation.
 *
 * A partir da feature `002` há base instalada, e o esquema passa a mudar por
 * migração versionada: cada entrada recebe um número de versão único e
 * crescente, a partir de 1, e a ordem da lista é a ordem de aplicação. Uma
 * base nova recebe todas; uma base já migrada recebe apenas as posteriores à
 * sua versão. A transação e a elevação de versão são responsabilidade do
 * aplicador em `esquema.ts`; aqui vive apenas o DDL.
 *
 * A migração 1 reproduz o esquema criado pela feature `001` na primeira
 * execução e mantém `IF NOT EXISTS` de propósito: arquivos legados daquela
 * feature já têm `cartao` sem ter `versao_do_esquema`, e a migração 1 adota a
 * tabela existente em vez de recriá-la — os Cartões guardados sobrevivem.
 */

export interface Migracao {
  /** Versão que a base passa a registrar depois que esta migração é aplicada. */
  versao: number;
  /**
   * DDL da migração, sem `BEGIN`/`COMMIT`: a transação é aberta e fechada
   * pelo aplicador, que eleva a versão dentro dela.
   */
  sql: string;
}

/**
 * As restrições `CHECK` duplicam FR-002, FR-051 e FR-052 de propósito. A
 * validação primária vive no `Acervo`, com mensagem útil ao usuário; aqui fica
 * a rede de segurança que impede estado inválido mesmo diante de um erro de
 * programação. `trim` descarta espaços nas extremidades, de modo que conteúdo
 * só de espaços conta como vazio; `length` conta caracteres, e o limite de
 * 1000 é inclusivo. A ausência de `UNIQUE` sobre `frente` é o que torna dois
 * Cartões de mesma Frente legítimos: a Frente não é identificador.
 */
const ESQUEMA_CARTAO = `
CREATE TABLE IF NOT EXISTS cartao (
  id     TEXT PRIMARY KEY,
  frente TEXT NOT NULL CHECK (length(trim(frente)) > 0 AND length(frente) <= 1000),
  verso  TEXT NOT NULL CHECK (length(trim(verso))  > 0 AND length(verso)  <= 1000)
);
`;

/**
 * A migração 2 cria a tabela `baralho` — a única entidade durável nova da
 * feature `002`. Não tem `IF NOT EXISTS`: como a versão 2 é registrada na
 * mesma transação que cria a tabela, a migração nunca roda duas vezes, e o
 * `CREATE TABLE` simples falharia ruidosamente se uma base corrompida já
 * tivesse a tabela sem a versão.
 *
 * A `CHECK` duplica FR-011 e o limite de 100 de propósito: a validação
 * primária viverá no `Acervo`, com mensagem útil ao usuário; aqui fica a rede
 * de segurança contra erro de programação. `trim` descarta espaços nas
 * extremidades, de modo que nome só de espaços conta como vazio; `length`
 * conta caracteres, e o limite de 100 é inclusivo. A ausência de `UNIQUE`
 * sobre `nome` é o que torna dois Baralhos de mesmo nome legítimos (FR-012):
 * o nome é rótulo, não identificador — e a ausência de qualquer outra coluna
 * é o que garante que Baralho não tem propriedade além de nome (FR-018).
 */
const ESQUEMA_BARALHO = `
CREATE TABLE baralho (
  id   TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0 AND length(nome) <= 100)
);
`;

/**
 * As migrações disponíveis, em ordem. Mudar o esquema significa acrescentar
 * uma entrada aqui — nunca editar uma migração já aplicada, que bases
 * instaladas já executaram.
 */
export const MIGRACOES: readonly Migracao[] = [
  { versao: 1, sql: ESQUEMA_CARTAO },
  { versao: 2, sql: ESQUEMA_BARALHO },
];
