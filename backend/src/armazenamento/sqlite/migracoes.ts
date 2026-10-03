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
 * A migração 6 cria o histórico de Sessões — a feature `013`. São duas tabelas
 * novas, e nenhuma tabela existente é tocada: Cartões, Baralhos, Vínculos e
 * Usuários de uma base instalada sobrevivem intactos (FR-100).
 *
 * Em `registro_de_sessao`, `id` é `PRIMARY KEY` **global**, e não por Usuário:
 * é o identificador que o cliente gera para a Sessão (FR-163), e é essa
 * unicidade global que permite ao Adapter distinguir a reinserção do mesmo
 * `id` pelo mesmo dono — idempotente — do `id` que já pertence a outro
 * Usuário, que é recusa de domínio e não falha do armazenamento. `usuario_id`
 * traz a mesma chave estrangeira com cascata das tabelas do acervo (migração
 * 5): excluir o Usuário apaga o histórico dele.
 *
 * `baralho_id` **não** tem chave estrangeira, de propósito: o Baralho pode ser
 * excluído depois da Sessão, e o histórico precisa continuar legível. É por
 * isso que `nome_do_baralho` é copiado na conclusão, e não lido do Baralho na
 * listagem — o nome que a Sessão guarda é o do momento em que ela terminou.
 *
 * `concluida_em` é `TEXT` em ISO-8601 UTC: ordenável e comparável como texto,
 * que é exatamente o que as listagens e a janela de 31 dias usam. Os `CHECK`
 * de contagem garantem no próprio esquema que `acertos + erros = estudados` e
 * que uma Sessão tem ao menos um Item — rede de segurança contra erro de
 * programação, já que a validação primária, com mensagem útil, vive no
 * `Acervo`. O índice por `(usuario_id, concluida_em DESC)` serve à listagem
 * por dono e à ordem do mais recente ao mais antigo.
 *
 * `item_de_registro` guarda Frente e Verso **como eram na conclusão**, e não
 * como o Cartão está hoje, porque o Cartão pode mudar ou sumir. A chave
 * primária composta `(registro_id, posicao)` torna a posição única dentro do
 * Registro e preserva a ordem apresentada sem depender de coluna extra; a
 * cascata faz os Itens caírem junto com o Registro.
 */
const ESQUEMA_REGISTRO_DE_SESSAO = `
CREATE TABLE registro_de_sessao (
  id              TEXT PRIMARY KEY,
  usuario_id      TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  baralho_id      TEXT NOT NULL,
  nome_do_baralho TEXT NOT NULL,
  concluida_em    TEXT NOT NULL,
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
  frente      TEXT NOT NULL,
  verso       TEXT NOT NULL,
  resultado   TEXT NOT NULL CHECK (resultado IN ('acertou', 'errou')),
  PRIMARY KEY (registro_id, posicao)
);
`;

/**
 * A migração 7 cria as tabelas da repetição espaçada — a feature `015` — e
 * acrescenta as colunas que ela estende nas tabelas existentes. É a migração
 * da repetição espaçada, **equivalente** à do Adapter PostgreSQL: mesmas
 * tabelas e colunas, com o tipo de cada banco (aqui `estado` é `TEXT` com o
 * JSON e os instantes são texto ISO-8601 UTC).
 *
 * Ela **apenas** cria tabelas e acrescenta colunas: nenhum dado existente é
 * alterado, e Cartões, Baralhos, Vínculos, Usuários e Histórico de uma base
 * instalada sobrevivem intactos (FR-220). **Nenhum Agendamento nasce** aqui —
 * o acervo pré-015 vira Cartões novos, e os Agendamentos surgem na primeira
 * Avaliação (FR-214).
 *
 * `agendamento` tem `PK(usuario_id, cartao_id)` — um Agendamento por Cartão
 * por Usuário, nunca por Vínculo (FR-207) — e as duas chaves estrangeiras com
 * cascata fazem excluir o Usuário ou o Cartão apagar o Agendamento (FR-209). O
 * índice por `(usuario_id, proxima_revisao_em)` serve à contagem de vencidos e
 * à ordem dos vencidos (D3/D5). O `CHECK` de `ultima_avaliacao` duplica
 * FR-192 como rede de segurança contra erro de programação.
 *
 * `preferencias` tem uma linha por Usuário; a **ausência de linha** equivale
 * aos padrões (`'sm2'` e 20), então a Porta sintetiza os padrões na leitura,
 * sem gravar linha a priori (D5). O `CHECK` 0..999 duplica FR-200.
 *
 * Os `ADD COLUMN` preservam as linhas existentes: em `item_de_registro`,
 * `cartao_id` e `avaliacao` ficam `NULL`; em `registro_de_sessao`, `origem`
 * recebe o default `'baralho'`; e `cartao.criado_em` fica `NULL` nas linhas
 * anteriores à 015, que por isso vêm primeiro na ordem de criação dos Cartões
 * novos (FR-197, FR-201).
 */
const ESQUEMA_REPETICAO_ESPACADA = `
CREATE TABLE agendamento (
  usuario_id          TEXT    NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  cartao_id           TEXT    NOT NULL REFERENCES cartao(id)  ON DELETE CASCADE,
  algoritmo           TEXT    NOT NULL,
  versao_do_algoritmo INTEGER NOT NULL,
  estado              TEXT    NOT NULL,
  proxima_revisao_em  TEXT    NOT NULL,
  ultima_avaliacao    TEXT    NOT NULL CHECK (ultima_avaliacao IN ('errei','dificil','bom','facil')),
  revisado_em         TEXT    NOT NULL,
  criado_em           TEXT    NOT NULL,
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

ALTER TABLE cartao ADD COLUMN criado_em TEXT NULL;
`;

/**
 * A migração 8 cria as tabelas da **Agenda de estudo** — a feature `016` —,
 * com o **mesmo número de versão** da migração do Adapter PostgreSQL, e **só
 * cria tabelas novas**: Cartões, Baralhos, Vínculos, Usuários, Histórico,
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
 * (FR-248). `versoes` e `cartoes` guardam JSON em `TEXT`, e os instantes são
 * texto ISO-8601 UTC, como nas migrações anteriores do Adapter local.
 */
const ESQUEMA_AGENDA_DE_ESTUDO = `
CREATE TABLE rotina_de_estudo (
  id         TEXT    PRIMARY KEY,
  usuario_id TEXT    NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  baralho_id TEXT    NULL REFERENCES baralho(id) ON DELETE SET NULL,
  estado     TEXT    NOT NULL CHECK (estado IN ('ativa','pausada','excluida')),
  versao     INTEGER NOT NULL CHECK (versao >= 1),
  criada_em  TEXT    NOT NULL,
  versoes    TEXT    NOT NULL
);

CREATE INDEX indice_rotina_de_estudo_por_usuario
  ON rotina_de_estudo (usuario_id, criada_em, id);

CREATE TABLE operacao_de_rotina (
  usuario_id  TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  operacao_id TEXT NOT NULL,
  rotina_id   TEXT NOT NULL REFERENCES rotina_de_estudo(id) ON DELETE CASCADE,
  intencao    TEXT NOT NULL,
  resultado   TEXT NOT NULL,
  PRIMARY KEY (usuario_id, operacao_id)
);

CREATE TABLE compromisso_de_estudo (
  rotina_id       TEXT    NOT NULL REFERENCES rotina_de_estudo(id) ON DELETE CASCADE,
  data            TEXT    NOT NULL CHECK (length(data) = 10),
  usuario_id      TEXT    NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  estado          TEXT    NOT NULL CHECK (estado IN ('cancelado','concluido')),
  registro_id     TEXT    NULL,
  baralho_id      TEXT    NOT NULL,
  nome_do_baralho TEXT    NOT NULL,
  quantidade      INTEGER NULL CHECK (quantidade IS NULL OR quantidade BETWEEN 1 AND 999),
  PRIMARY KEY (rotina_id, data)
);

CREATE INDEX indice_compromisso_de_estudo_por_usuario_data
  ON compromisso_de_estudo (usuario_id, data);

CREATE TABLE inicio_de_compromisso (
  id              TEXT    PRIMARY KEY,
  usuario_id      TEXT    NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  rotina_id       TEXT    NOT NULL REFERENCES rotina_de_estudo(id) ON DELETE CASCADE,
  data            TEXT    NOT NULL,
  iniciado_em     TEXT    NOT NULL,
  fuso            TEXT    NOT NULL,
  baralho_id      TEXT    NOT NULL,
  nome_do_baralho TEXT    NOT NULL,
  quantidade      INTEGER NULL,
  cartoes         TEXT    NOT NULL
);

CREATE INDEX indice_inicio_de_compromisso_por_usuario_rotina_data
  ON inicio_de_compromisso (usuario_id, rotina_id, data);
`;

/**
 * A migração 9 cria a tabela do **Acesso temporário** — a feature `018` —, com
 * o **mesmo número de versão** da migração do Adapter PostgreSQL. A migração 8
 * da `016` já está aplicada nas bases instaladas, e por isso esta é a **9**
 * (D1 de `specs/018-acesso-temporario/research.md`).
 *
 * Só cria tabela nova: nada existente é alterado. `digest` é o SHA-256 do valor
 * opaco e é a chave primária — o valor em claro **nunca** é guardado (FR-297).
 * `usuario_id` usa `ON DELETE CASCADE`, de modo que excluir o Usuário remove
 * todos os Acessos dele (FR-296), e o índice por dono serve a
 * `encerrarTodosDoUsuario`. Os instantes são texto ISO-8601 UTC, ordenáveis e
 * comparáveis como string, como nas demais tabelas do Adapter local.
 */
const ESQUEMA_ACESSO_TEMPORARIO = `
CREATE TABLE acesso_temporario (
  digest         TEXT PRIMARY KEY,
  usuario_id     TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  criado_em      TEXT NOT NULL,
  expira_em      TEXT NOT NULL,
  ultima_acao_em TEXT NOT NULL
);

CREATE INDEX indice_acesso_temporario_por_usuario
  ON acesso_temporario (usuario_id);
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
  { versao: 6, sql: ESQUEMA_REGISTRO_DE_SESSAO },
  { versao: 7, sql: ESQUEMA_REPETICAO_ESPACADA },
  { versao: 8, sql: ESQUEMA_AGENDA_DE_ESTUDO },
  { versao: 9, sql: ESQUEMA_ACESSO_TEMPORARIO },
];
