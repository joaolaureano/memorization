/**
 * Sequência ordenada de migrações do esquema PostgreSQL do `Acervo` — a Seam
 * interna da Implementation do Adapter da nuvem.
 *
 * A **numeração é compartilhada** com o Adapter do armazenamento local: os
 * mesmos números de versão, a partir de 1, na mesma ordem. Só o DDL é de
 * dialeto, e é por isso que uma base migrada por um Adapter está na mesma
 * versão para o outro (FR-112, FR-116). A transação, a trava consultiva e a
 * elevação de versão são responsabilidade do aplicador em `esquema.ts`; aqui
 * vive apenas o DDL.
 *
 * Mapeamento de dialeto: `TEXT` para texto, `char_length` no lugar de `length`
 * e `btrim` no lugar de `trim` — a mesma regra de conteúdo, contando caracteres
 * e descartando espaços nas extremidades. O PostgreSQL sempre respeita chaves
 * estrangeiras, de modo que não há aqui o equivalente ao
 * `PRAGMA foreign_keys = ON` do SQLite: as cascatas valem por si.
 *
 * Nenhuma migração tem `IF NOT EXISTS`, nem a 1: não existe base anterior a
 * esta feature em PostgreSQL — o Adapter local mantém o `IF NOT EXISTS` da
 * migração 1 apenas para adotar arquivos legados da feature `001`. Como a
 * versão é registrada na mesma transação do DDL, uma migração nunca roda duas
 * vezes, e um `CREATE TABLE` simples falharia ruidosamente se uma base
 * corrompida já tivesse a tabela sem a versão.
 */

export interface Migracao {
  /** Versão que a base passa a registrar depois que esta migração é aplicada. */
  versao: number;
  /**
   * DDL da migração, sem `BEGIN`/`COMMIT`: a transação é aberta e fechada pelo
   * aplicador, que eleva a versão dentro dela.
   */
  sql: string;
}

/**
 * As restrições `CHECK` duplicam FR-002, FR-051 e FR-052 de propósito. A
 * validação primária vive no `Acervo`, com mensagem útil ao usuário; aqui fica
 * a rede de segurança que impede estado inválido mesmo diante de um erro de
 * programação. `btrim` descarta espaços nas extremidades, de modo que conteúdo
 * só de espaços conta como vazio; `char_length` conta caracteres, e o limite de
 * 1000 é inclusivo. A ausência de `UNIQUE` sobre `frente` é o que torna dois
 * Cartões de mesma Frente legítimos: a Frente não é identificador.
 */
const ESQUEMA_CARTAO = `
CREATE TABLE cartao (
  id     TEXT PRIMARY KEY,
  frente TEXT NOT NULL CHECK (char_length(btrim(frente)) > 0 AND char_length(frente) <= 1000),
  verso  TEXT NOT NULL CHECK (char_length(btrim(verso))  > 0 AND char_length(verso)  <= 1000)
);
`;

/**
 * A migração 2 cria a tabela `baralho` — a única entidade durável nova da
 * feature `002`, com a mesma `CHECK` do Adapter local: `btrim` para que nome só
 * de espaços conte como vazio, `char_length` para contar caracteres e o limite
 * de 100 inclusivo. A ausência de `UNIQUE` sobre `nome` é o que torna dois
 * Baralhos de mesmo nome legítimos (FR-012): o nome é rótulo, não
 * identificador — e a ausência de qualquer outra coluna é o que garante que
 * Baralho não tem propriedade além de nome (FR-018).
 */
const ESQUEMA_BARALHO = `
CREATE TABLE baralho (
  id   TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (char_length(btrim(nome)) > 0 AND char_length(nome) <= 100)
);
`;

/**
 * A migração 3 cria a tabela `vinculo` — a associação entre Cartão e Baralho.
 *
 * A chave primária composta `(cartao_id, baralho_id)` implementa FR-020 no
 * próprio esquema: a duplicata é impossível, não apenas verificada em código, e
 * a violação chega ao Adapter como SQLSTATE `23505`. Ela é nomeada
 * explicitamente porque é **por esse nome** que o Adapter distingue o Vínculo
 * repetido — que é resultado de domínio — de qualquer outra unicidade violada,
 * que é falha do armazenamento.
 *
 * As duas chaves estrangeiras usam `ON DELETE CASCADE` para que a exclusão de
 * um Cartão ou de um Baralho alcance apenas os Vínculos — nunca a entidade do
 * outro lado. Como não há chave estrangeira ligando `cartao` a `baralho`, não
 * existe caminho pelo qual uma exclusão possa cascatear de uma entidade para a
 * outra. Um Vínculo com extremidade inexistente chega ao Adapter como SQLSTATE
 * `23503`, que é ausência de linha — e não falha do armazenamento.
 */
const ESQUEMA_VINCULO = `
CREATE TABLE vinculo (
  cartao_id  TEXT NOT NULL REFERENCES cartao(id)  ON DELETE CASCADE,
  baralho_id TEXT NOT NULL REFERENCES baralho(id) ON DELETE CASCADE,
  CONSTRAINT vinculo_pkey PRIMARY KEY (cartao_id, baralho_id)
);
`;

/**
 * A migração 4 cria a tabela `usuario` — a entidade durável da feature
 * `007-criar-usuario`, com o mesmo número de versão da migração do Adapter
 * local. Nenhuma tabela existente é tocada: Cartões, Baralhos e Vínculos de uma
 * base instalada sobrevivem intactos.
 *
 * O dialeto é o mesmo mapeamento das migrações anteriores — `char_length` para
 * contar caracteres —, acrescido de `octet_length` para contar os bytes do
 * `sal` e de uma expressão regular equivalente ao `GLOB` do Adapter local:
 * `~ '^[A-Za-z0-9._-]+$'` aceita exatamente o mesmo alfabeto, de modo que as
 * duas `CHECK` recusam os mesmos Nomes de usuário.
 *
 * A unicidade sem distinção entre maiúsculas e minúsculas (FR-074, SC-025) é um
 * **índice único sobre `lower(nome_de_usuario)`**, e não uma coluna `citext` nem
 * uma consulta prévia sujeita a corrida: é a mesma promessa do
 * `COLLATE NOCASE` do Adapter local, e as duas valem para o mesmo alfabeto
 * ASCII. O índice é **nomeado** porque é por esse nome que o Adapter distingue
 * o Nome de usuário repetido — resultado de domínio — de qualquer outra
 * unicidade violada, que é falha do armazenamento.
 *
 * `sal` é `BYTEA` com exatamente 16 bytes (FR-076) e `parametros` é o JSON da
 * derivação, para que os parâmetros evoluam sem migração de dados. **Nenhuma
 * coluna guarda a Senha**: FR-076 vale por construção.
 */
const ESQUEMA_USUARIO = `
CREATE TABLE usuario (
  id              TEXT PRIMARY KEY,
  nome_de_usuario TEXT NOT NULL
                  CHECK (char_length(nome_de_usuario) BETWEEN 3 AND 50)
                  CHECK (nome_de_usuario ~ '^[A-Za-z0-9._-]+$'),
  sal             BYTEA NOT NULL CHECK (octet_length(sal) = 16),
  hash            BYTEA NOT NULL,
  parametros      TEXT NOT NULL
);

CREATE UNIQUE INDEX usuario_nome_de_usuario_unico
    ON usuario (lower(nome_de_usuario));
`;

/**
 * As migrações disponíveis, em ordem. Mudar o esquema significa acrescentar uma
 * entrada aqui — nunca editar uma migração já aplicada, que bases instaladas já
 * executaram. A versão 5 (Dono no acervo) será acrescentada aqui pela feature
 * `008-entrar`, com o mesmo número de versão da migração do Adapter local.
 */
export const MIGRACOES: readonly Migracao[] = [
  { versao: 1, sql: ESQUEMA_CARTAO },
  { versao: 2, sql: ESQUEMA_BARALHO },
  { versao: 3, sql: ESQUEMA_VINCULO },
  { versao: 4, sql: ESQUEMA_USUARIO },
];
