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
 * A migração 3 cria a tabela `vinculo` — a associação entre Cartão e Baralho.
 * Não tem `IF NOT EXISTS`: como a versão 3 é registrada na mesma transação
 * que cria a tabela, a migração nunca roda duas vezes, e o `CREATE TABLE`
 * simples falharia ruidosamente se uma base corrompida já tivesse a tabela
 * sem a versão.
 *
 * A chave primária composta `(cartao_id, baralho_id)` implementa FR-020 no
 * próprio esquema: a duplicata é impossível, não apenas verificada em código.
 * As duas chaves estrangeiras usam `ON DELETE CASCADE` para que a exclusão de
 * um Cartão ou de um Baralho alcance apenas os Vínculos — nunca a entidade do
 * outro lado. Como não há chave estrangeira ligando `cartao` a `baralho`, não
 * existe caminho pelo qual uma exclusão possa cascatear de uma entidade para a
 * outra. Sem `PRAGMA foreign_keys = ON`, o SQLite ignora essas cascatas em
 * silêncio; o pragma é ligado por conexão em `esquema.ts`.
 */
const ESQUEMA_VINCULO = `
CREATE TABLE vinculo (
  cartao_id  TEXT NOT NULL REFERENCES cartao(id)  ON DELETE CASCADE,
  baralho_id TEXT NOT NULL REFERENCES baralho(id) ON DELETE CASCADE,
  PRIMARY KEY (cartao_id, baralho_id)
);
`;

/**
 * A migração 4 cria a tabela `usuario` — a entidade durável da feature
 * `007-criar-usuario`, e a primeira que não pertence ao acervo. Nenhuma tabela
 * existente é tocada, de modo que Cartões, Baralhos e Vínculos de uma base já
 * instalada sobrevivem intactos (FR-040).
 *
 * O `UNIQUE COLLATE NOCASE` é o que garante a unicidade **sem distinguir
 * maiúsculas de minúsculas** (FR-074, SC-025) pelo banco, e não por uma
 * consulta prévia sujeita a corrida; a violação é traduzida pelo Adapter em
 * `nome_de_usuario_existente`. Como o `NOCASE` do SQLite só iguala maiúsculas e
 * minúsculas em ASCII, o alfabeto permitido é `A–Z`, `a–z`, dígitos, `.`, `_` e
 * `-` (Decisão 5 de `research.md`): com acentos, `É` e `é` seriam distintos
 * justamente nos nomes mais prováveis em português.
 *
 * Os dois `CHECK` repetem FR-073 de propósito, como rede de segurança contra
 * erro de programação — a validação primária, com mensagem útil, vive no
 * `Identidade`. `sal` é `BLOB` com exatamente 16 bytes (FR-076) e `parametros`
 * é o JSON da derivação, para que os parâmetros evoluam sem migração de dados.
 * **Nenhuma coluna guarda a Senha**: FR-076 vale por construção.
 */
const ESQUEMA_USUARIO = `
CREATE TABLE usuario (
  id              TEXT PRIMARY KEY,
  nome_de_usuario TEXT NOT NULL UNIQUE COLLATE NOCASE
                  CHECK (length(nome_de_usuario) BETWEEN 3 AND 50)
                  CHECK (nome_de_usuario NOT GLOB '*[^A-Za-z0-9._-]*'),
  sal             BLOB NOT NULL CHECK (length(sal) = 16),
  hash            BLOB NOT NULL,
  parametros      TEXT NOT NULL
);
`;

/**
 * A migração 5 dá **dono** ao acervo — a feature `008-entrar` transforma o
 * acervo de todos no acervo de cada Usuário (FR-092).
 *
 * O SQLite não aceita `ALTER TABLE ADD COLUMN` com `NOT NULL` e chave
 * estrangeira, e não há como dar dono a Cartões que nasceram sem dono: as três
 * tabelas são **recriadas**, com as mesmas colunas e os mesmos `CHECK` das
 * migrações 1 a 3, copiados literalmente delas, mais `usuario_id NOT NULL
 * REFERENCES usuario(id) ON DELETE CASCADE` e um índice por dono. O acervo
 * anterior é descartado — perda de dados assumida pelo Product Owner no clarify
 * e verificada por FR-099 e SC-037 —, e a tabela `usuario` **não** é tocada: os
 * Usuários da `007` sobrevivem à migração, e é o que permite a cada um voltar a
 * Entrar depois da recriação.
 *
 * `vinculo` continua sem coluna de dono, de propósito: ele herda o dono dos
 * extremos, e o escopo do `Acervo` impede ligar extremos de Usuários
 * diferentes. As cascatas são preservadas, e a chave primária composta
 * `(cartao_id, baralho_id)` continua fazendo o par ser único no esquema
 * (FR-020, FR-093). As tabelas são derrubadas na ordem que respeita as chaves
 * estrangeiras, com a conexão já com `PRAGMA foreign_keys = ON`.
 */
const ESQUEMA_DONO_NO_ACERVO = `
DROP TABLE vinculo;
DROP TABLE baralho;
DROP TABLE cartao;

CREATE TABLE cartao (
  id         TEXT PRIMARY KEY,
  frente     TEXT NOT NULL CHECK (length(trim(frente)) > 0 AND length(frente) <= 1000),
  verso      TEXT NOT NULL CHECK (length(trim(verso))  > 0 AND length(verso)  <= 1000),
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE INDEX indice_cartao_por_usuario ON cartao (usuario_id);

CREATE TABLE baralho (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL CHECK (length(trim(nome)) > 0 AND length(nome) <= 100),
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE INDEX indice_baralho_por_usuario ON baralho (usuario_id);

CREATE TABLE vinculo (
  cartao_id  TEXT NOT NULL REFERENCES cartao(id)  ON DELETE CASCADE,
  baralho_id TEXT NOT NULL REFERENCES baralho(id) ON DELETE CASCADE,
  PRIMARY KEY (cartao_id, baralho_id)
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
  { versao: 3, sql: ESQUEMA_VINCULO },
  { versao: 4, sql: ESQUEMA_USUARIO },
  { versao: 5, sql: ESQUEMA_DONO_NO_ACERVO },
];
