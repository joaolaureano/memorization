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
 * A migração 5 dá **dono** ao acervo — a feature `008-entrar` transforma o
 * acervo de todos no acervo de cada Usuário (FR-092), com o **mesmo número de
 * versão** da migração do Adapter local.
 *
 * Sem adotar o acervo anterior — que não tem dono, e é descartado por decisão
 * do Product Owner (FR-099, SC-037) —, as três tabelas são **recriadas** com as
 * mesmas colunas e os mesmos `CHECK` das migrações 1 a 3, copiados literalmente
 * delas, mais `usuario_id NOT NULL REFERENCES usuario(id) ON DELETE CASCADE` e
 * um índice por dono. A tabela `usuario` **não** é tocada: os Usuários da `007`
 * sobrevivem à migração.
 *
 * `vinculo` continua sem coluna de dono, de propósito: ele herda o dono dos
 * extremos, e o escopo do `Acervo` impede ligar extremos de Usuários
 * diferentes. A chave primária composta recebe **de novo** o nome estável
 * `vinculo_pkey`, porque é por esse nome que o Adapter distingue o Vínculo
 * repetido — resultado de domínio — de qualquer outra unicidade violada. As
 * tabelas são derrubadas na ordem que respeita as chaves estrangeiras.
 */
const ESQUEMA_DONO_NO_ACERVO = `
DROP TABLE vinculo;
DROP TABLE baralho;
DROP TABLE cartao;

CREATE TABLE cartao (
  id         TEXT PRIMARY KEY,
  frente     TEXT NOT NULL CHECK (char_length(btrim(frente)) > 0 AND char_length(frente) <= 1000),
  verso      TEXT NOT NULL CHECK (char_length(btrim(verso))  > 0 AND char_length(verso)  <= 1000),
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE INDEX indice_cartao_por_usuario ON cartao (usuario_id);

CREATE TABLE baralho (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL CHECK (char_length(btrim(nome)) > 0 AND char_length(nome) <= 100),
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE INDEX indice_baralho_por_usuario ON baralho (usuario_id);

CREATE TABLE vinculo (
  cartao_id  TEXT NOT NULL REFERENCES cartao(id)  ON DELETE CASCADE,
  baralho_id TEXT NOT NULL REFERENCES baralho(id) ON DELETE CASCADE,
  CONSTRAINT vinculo_pkey PRIMARY KEY (cartao_id, baralho_id)
);
`;

/**
 * A migração 6 dá ao acervo o **histórico de Sessões** — a feature
 * `013-estatisticas-e-historico` (FR-161 a FR-179) —, com o **mesmo número de
 * versão** da migração do Adapter local. Nenhuma tabela existente é tocada:
 * Cartões, Baralhos, Vínculos e Usuários de uma base instalada sobrevivem
 * intactos.
 *
 * `registro_de_sessao` guarda o resumo concluído, e `item_de_registro` guarda
 * os Itens na **ordem apresentada** (`posicao`), que a listagem do histórico não
 * carrega: o resumo é o que a listagem lê, e os Itens só na abertura de uma
 * Sessão. `id` é a chave primária porque o `id` chega do cliente e é ele que
 * torna a inserção idempotente (FR-163); a ausência de `UNIQUE` sobre qualquer
 * outro campo é o que permite duas Sessões do mesmo Baralho no mesmo instante.
 *
 * `baralho_id` **não** tem chave estrangeira, de propósito: o Baralho pode ser
 * excluído depois, e o histórico não pode cair junto nem impedir a exclusão —
 * `nome_do_baralho` guarda o rótulo do momento da conclusão (FR-164), e é por
 * isso que ele também é copiado, em vez de lido de `baralho`. `usuario_id`, ao
 * contrário, tem a chave estrangeira com cascata das demais tabelas: o histórico
 * é do Usuário, e excluir o Usuário exclui o histórico dele (FR-092).
 *
 * `concluida_em` é `TIMESTAMPTZ`, e não texto: é o instante da conclusão,
 * definido pelo servidor na primeira inserção, e o driver o lê de volta como
 * instante — o Adapter o converte para a cadeia ISO-8601 UTC que a Porta
 * promete. As `CHECK` de `estudados`, `acertos`, `erros` e da soma duplicam,
 * como nas migrações anteriores, os invariantes do `Acervo`: a validação
 * primária vive lá, e aqui fica a rede de segurança contra estado inválido. As
 * `CHECK` de `frente` e `verso` são as mesmas de `cartao`, com `btrim` e
 * `char_length`, e a de `resultado` restringe o vocabulário a
 * `('acertou','errou')`.
 *
 * O índice `registro_de_sessao_usuario_concluida` serve as três leituras da
 * Porta de uma vez: o escopo do Usuário e a ordem do mais recente ao mais antigo
 * (FR-165, FR-169). Os Itens são lidos pela chave primária composta
 * `(registro_id, posicao)`, que já os devolve na ordem apresentada e impede
 * posição repetida.
 */
const ESQUEMA_REGISTRO_DE_SESSAO = `
CREATE TABLE registro_de_sessao (
  id              TEXT PRIMARY KEY,
  usuario_id      TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  baralho_id      TEXT NOT NULL,
  nome_do_baralho TEXT NOT NULL CHECK (char_length(btrim(nome_do_baralho)) > 0 AND char_length(nome_do_baralho) <= 100),
  concluida_em    TIMESTAMPTZ NOT NULL,
  estudados       INTEGER NOT NULL CHECK (estudados >= 1),
  acertos         INTEGER NOT NULL CHECK (acertos >= 0),
  erros           INTEGER NOT NULL CHECK (erros >= 0),
  CHECK (acertos + erros = estudados)
);

CREATE INDEX registro_de_sessao_usuario_concluida
    ON registro_de_sessao (usuario_id, concluida_em DESC);

CREATE TABLE item_de_registro (
  registro_id TEXT NOT NULL REFERENCES registro_de_sessao(id) ON DELETE CASCADE,
  posicao     INTEGER NOT NULL,
  frente      TEXT NOT NULL CHECK (char_length(btrim(frente)) > 0 AND char_length(frente) <= 1000),
  verso       TEXT NOT NULL CHECK (char_length(btrim(verso))  > 0 AND char_length(verso)  <= 1000),
  resultado   TEXT NOT NULL CHECK (resultado IN ('acertou','errou')),
  PRIMARY KEY (registro_id, posicao)
);
`;

/**
 * A migração 7 acrescenta a **repetição espaçada** — a feature
 * `015-repeticao-espacada` (FR-187 a FR-221) —, com o **mesmo número de versão**
 * da migração do Adapter local, e **só acrescenta**: Cartões, Baralhos,
 * Vínculos, Usuários e Histórico de uma base instalada sobrevivem intactos
 * (FR-220).
 *
 * `agendamento` tem `PK(usuario_id, cartao_id)` — um Agendamento por Cartão por
 * Usuário (FR-207) — e as duas chaves estrangeiras usam `ON DELETE CASCADE`:
 * excluir o Usuário ou o Cartão apaga o Agendamento (FR-209). O índice por
 * `(usuario_id, proxima_revisao_em)` serve à contagem de vencidos e à ordem dos
 * vencidos (D3/D5). `estado` é `JSONB`, e não texto: ele guarda o `dados`
 * **opaco** do Algoritmo de repetição espaçada (FR-188), que o Adapter lê de
 * volta como objeto.
 *
 * `preferencias` tem uma linha por Usuário, e a **ausência de linha** equivale
 * aos padrões (`'sm2'`, 20): a Porta sintetiza os padrões na leitura e nunca
 * grava linha a priori (D5). O `CHECK` de 0 a 999 duplica FR-200 como rede de
 * segurança.
 *
 * Os `ADD COLUMN` preservam as linhas existentes: `cartao_id` e `avaliacao` de
 * `item_de_registro` ficam `NULL` e `origem` de `registro_de_sessao` recebe o
 * default `'baralho'` — é o que mantém os Registros anteriores válidos e
 * exibíveis (FR-197, FR-214). `cartao.criado_em` fica `NULL` nas linhas
 * anteriores à 015, que vêm primeiro na ordem de criação exigida pelo FR-201; e
 * `cartao.ordem_de_insercao`, gerada por identidade, desempata os Cartões de
 * mesmo instante — o `id` não serve, por ser um UUID aleatório. **Nenhum
 * Agendamento é criado** na migração: o acervo pré-015 vira Cartões novos, e os
 * Agendamentos nascem na primeira Avaliação (FR-214).
 */
const ESQUEMA_REPETICAO_ESPACADA = `
CREATE TABLE agendamento (
  usuario_id          TEXT        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  cartao_id           TEXT        NOT NULL REFERENCES cartao(id)  ON DELETE CASCADE,
  algoritmo           TEXT        NOT NULL,
  versao_do_algoritmo INTEGER     NOT NULL,
  estado              JSONB       NOT NULL,
  proxima_revisao_em  TIMESTAMPTZ NOT NULL,
  ultima_avaliacao    TEXT        NOT NULL CHECK (ultima_avaliacao IN ('errei','dificil','bom','facil')),
  revisado_em         TIMESTAMPTZ NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (usuario_id, cartao_id)
);

CREATE INDEX indice_agendamento_por_usuario_vencimento
    ON agendamento (usuario_id, proxima_revisao_em);

CREATE TABLE preferencias (
  usuario_id              TEXT    PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  algoritmo               TEXT    NOT NULL DEFAULT 'sm2',
  limite_de_novos_por_dia INTEGER NOT NULL DEFAULT 20
                          CHECK (limite_de_novos_por_dia BETWEEN 0 AND 999)
);

ALTER TABLE item_de_registro ADD COLUMN cartao_id TEXT NULL;
ALTER TABLE item_de_registro ADD COLUMN avaliacao TEXT NULL
    CHECK (avaliacao IS NULL OR avaliacao IN ('errei','dificil','bom','facil'));

ALTER TABLE registro_de_sessao ADD COLUMN origem TEXT NOT NULL DEFAULT 'baralho'
    CHECK (origem IN ('baralho','revisao'));

ALTER TABLE cartao ADD COLUMN criado_em TIMESTAMPTZ NULL;
ALTER TABLE cartao ADD COLUMN ordem_de_insercao BIGINT GENERATED BY DEFAULT AS IDENTITY;
`;

/**
 * A migração 8 cria as tabelas da **Agenda de estudo** — a feature `016` —,
 * com o **mesmo número de versão** da migração do Adapter local, e **só cria
 * tabelas novas**: Cartões, Baralhos, Vínculos, Usuários, Histórico,
 * Agendamentos e Preferências de uma base instalada sobrevivem intactos
 * (FR-220). Nenhum dado existente é alterado.
 *
 * `rotina_de_estudo.baralho_id` usa `ON DELETE SET NULL`, e não cascata: a
 * exclusão do Baralho não apaga a programação da Rotina (FR-248); a Rotina
 * fica indisponível no Module, mas o histórico de versões e os compromissos
 * permanecem. As demais chaves estrangeiras usam `ON DELETE CASCADE` para que
 * excluir o Usuário apague as Rotinas, os Compromissos e os Inícios dele, e
 * excluir a Rotina apague as operações, os compromissos e os inícios ligados
 * a ela. `compromisso_de_estudo.registro_id` e `baralho_id` ficam sem chave
 * estrangeira de propósito: o Registro e o Baralho podem sumir depois, e o
 * compromisso precisa continuar legível com a configuração capturada.
 *
 * A unicidade `PRIMARY KEY (rotina_id, data)` em `compromisso_de_estudo`
 * garante um único compromisso por Rotina e data (FR-250), base da projeção
 * de ocorrências; em `operacao_de_rotina`, a chave composta
 * `(usuario_id, operacao_id)` é a idempotência da gravação de Rotina
 * (FR-248). `versoes`, `resultado` e `cartoes` são `JSONB`, e os instantes são
 * `TIMESTAMPTZ`, como a migração 7 faz.
 */
const ESQUEMA_AGENDA_DE_ESTUDO = `
CREATE TABLE rotina_de_estudo (
  id         TEXT        PRIMARY KEY,
  usuario_id TEXT        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  baralho_id TEXT        NULL REFERENCES baralho(id) ON DELETE SET NULL,
  estado     TEXT        NOT NULL CHECK (estado IN ('ativa','pausada','excluida')),
  versao     INTEGER     NOT NULL CHECK (versao >= 1),
  criada_em  TIMESTAMPTZ NOT NULL,
  versoes    JSONB       NOT NULL
);

CREATE INDEX indice_rotina_de_estudo_por_usuario
  ON rotina_de_estudo (usuario_id, criada_em, id);

CREATE TABLE operacao_de_rotina (
  usuario_id  TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  operacao_id TEXT NOT NULL,
  rotina_id   TEXT NOT NULL REFERENCES rotina_de_estudo(id) ON DELETE CASCADE,
  intencao    TEXT NOT NULL,
  resultado   JSONB NOT NULL,
  PRIMARY KEY (usuario_id, operacao_id)
);

CREATE TABLE compromisso_de_estudo (
  rotina_id       TEXT        NOT NULL REFERENCES rotina_de_estudo(id) ON DELETE CASCADE,
  data            TEXT        NOT NULL CHECK (char_length(data) = 10),
  usuario_id      TEXT        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  estado          TEXT        NOT NULL CHECK (estado IN ('cancelado','concluido')),
  registro_id     TEXT        NULL,
  baralho_id      TEXT        NOT NULL,
  nome_do_baralho TEXT        NOT NULL,
  quantidade      INTEGER     NULL CHECK (quantidade IS NULL OR quantidade BETWEEN 1 AND 999),
  PRIMARY KEY (rotina_id, data)
);

CREATE INDEX indice_compromisso_de_estudo_por_usuario_data
  ON compromisso_de_estudo (usuario_id, data);

CREATE TABLE inicio_de_compromisso (
  id              TEXT        PRIMARY KEY,
  usuario_id      TEXT        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  rotina_id       TEXT        NOT NULL REFERENCES rotina_de_estudo(id) ON DELETE CASCADE,
  data            TEXT        NOT NULL,
  iniciado_em     TIMESTAMPTZ NOT NULL,
  fuso            TEXT        NOT NULL,
  baralho_id      TEXT        NOT NULL,
  nome_do_baralho TEXT        NOT NULL,
  quantidade      INTEGER     NULL,
  cartoes         JSONB       NOT NULL
);

CREATE INDEX indice_inicio_de_compromisso_por_usuario_rotina_data
  ON inicio_de_compromisso (usuario_id, rotina_id, data);
`;

/**
 * As migrações disponíveis, em ordem. Mudar o esquema significa acrescentar uma
 * entrada aqui — nunca editar uma migração já aplicada, que bases instaladas já
 * executaram.
 */
export const MIGRACOES: readonly Migracao[] = [
  { versao: 1, sql: ESQUEMA_CARTAO },
  { versao: 2, sql: ESQUEMA_BARALHO },
  { versao: 3, sql: ESQUEMA_VINCULO },
  { versao: 4, sql: ESQUEMA_USUARIO },
  { versao: 5, sql: ESQUEMA_DONO_NO_ACERVO },
  { versao: 6, sql: ESQUEMA_REGISTRO_DE_SESSAO },
  { versao: 7, sql: ESQUEMA_REPETICAO_ESPACADA },
  { versao: 8, sql: ESQUEMA_AGENDA_DE_ESTUDO },
];
