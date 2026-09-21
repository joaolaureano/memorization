# Phase 1 — Data Model: PostgreSQL na Nuvem

Modelo derivado da spec e do glossário canônico de `CONTEXT.md`.

## Escopo desta feature

Esta feature **não acrescenta entidade de domínio**: nenhuma tabela nova, nenhuma
coluna nova, nenhum campo novo de tela. O que ela acrescenta é o **modelo do
armazenamento da nuvem** — as mesmas entidades duráveis de `009`, escritas em
dialeto PostgreSQL, a **configuração de conexão** que as aponta e a **versão de
esquema** que o início confere.

As entidades são as que já existem. O que muda é onde elas são criadas: uma
segunda lista de DDL, com os **mesmos números de versão** e as mesmas regras de
conteúdo (FR-112, FR-116).

## Entidades duráveis — as mesmas de `009`, em dialeto PostgreSQL

| Entidade | Colunas | Restrições |
|---|---|---|
| **Cartão** | `id TEXT PRIMARY KEY`, `frente TEXT`, `verso TEXT` | `frente` e `verso` obrigatórios; `CHECK (char_length(btrim(frente)) > 0 AND char_length(frente) <= 1000)`, e o mesmo sobre `verso`. Frente não é identificador: sem `UNIQUE` |
| **Baralho** | `id TEXT PRIMARY KEY`, `nome TEXT` | `nome` obrigatório; `CHECK (char_length(btrim(nome)) > 0 AND char_length(nome) <= 100)`; sem `UNIQUE` sobre `nome` (é rótulo) e sem outra coluna |
| **Vínculo** | `cartao_id TEXT`, `baralho_id TEXT` | `PRIMARY KEY (cartao_id, baralho_id)` — o par é único **no esquema** — e as duas chaves estrangeiras com `ON DELETE CASCADE` |
| **`versao_do_esquema`** | `versao INTEGER NOT NULL` | Criada sob demanda (`CREATE TABLE IF NOT EXISTS`), uma linha por base; **a mesma noção** da tabela do Adapter local, e é o que faz a versão da base ser comparável entre os dois |
| **Usuário** (migração 4, escrita pela `007`) | `id TEXT PRIMARY KEY`, `nome_de_usuario TEXT`, `sal BYTEA`, `hash BYTEA`, `parametros TEXT` | `nome_de_usuario` único **sem distinção entre maiúsculas e minúsculas** por **índice único sobre `lower(nome_de_usuario)`**; `CHECK (char_length(nome_de_usuario) BETWEEN 3 AND 50)`; `CHECK (nome_de_usuario ~ '^[A-Za-z0-9._-]+$')`; `CHECK (octet_length(sal) = 16)` |
| **Dono** (migração 5, escrita pela `008`) | `usuario_id TEXT` em `cartao` e em `baralho` | Obrigatório, referenciando `usuario(id)` com `ON DELETE CASCADE`, com um índice por tabela. Vínculo continua sem coluna de dono: herda o dono dos extremos |

**Nenhuma coluna guarda a Senha**, e a migração 5 não toca em `usuario`: as
entidades e as regras de descarte e de manutenção de dados continuam as das
features anteriores, sem alteração (FR-112).

Em caso de divergência entre este documento e o DDL do Adapter local, **vale o DDL
do Adapter local**: é ele que define a regra, e o DDL de PostgreSQL existe para
produzir o mesmo efeito.

## Mapeamento de dialeto

| No SQLite (`009`) | Em PostgreSQL (esta feature) | Observação |
|---|---|---|
| `TEXT` | `TEXT` | Mesmo tipo; o texto é guardado como veio |
| `INTEGER` | `INTEGER` | Só a versão do esquema |
| `BLOB` | `BYTEA` | `sal` e `hash` da migração 4 |
| `length(x)` | `char_length(x)` | Contagem de caracteres, como no SQLite |
| `trim(x)` | `btrim(x)` | Espaços nas extremidades; conteúdo só de espaços conta como vazio |
| `UNIQUE ... COLLATE NOCASE` | índice único sobre `lower(nome_de_usuario)` | Equivalência exata **porque** o alfabeto é restrito a ASCII (`A–Z`, `a–z`, dígitos, `.`, `_`, `-`): `COLLATE NOCASE` do SQLite só iguala maiúsculas e minúsculas em ASCII |
| `NOT GLOB '*[^A-Za-z0-9._-]*'` | `~ '^[A-Za-z0-9._-]+$'` | O mesmo alfabeto, escrito no dialeto do PostgreSQL |
| `PRIMARY KEY (a, b)` | `PRIMARY KEY (a, b)` | A unicidade do par de Vínculo é do esquema, e a violação chega como SQLSTATE `23505` |
| `REFERENCES ... ON DELETE CASCADE` | idem | Cascatas idênticas; chave estrangeira violada chega como SQLSTATE `23503` |
| `PRAGMA foreign_keys = ON` por conexão | — | O PostgreSQL **sempre** respeita chaves estrangeiras: aqui não há pragma nem risco de ser ignorado em silêncio |

Os nomes das restrições são estáveis e são do DDL: a chave primária de `vinculo`
tem nome conhecido, e o índice único do Nome de usuário também. É por isso que o
Adapter consegue distinguir os dois casos de `23505`.

## Migrações e esquema

Cada Adapter é dono do DDL do seu dialeto; a **ordem e os números de versão são os
mesmos** para todos:

| Versão | O que faz | Onde vive, no PostgreSQL |
|---|---|---|
| 1 | `cartao`, com as `CHECK` de Frente e Verso | `backend/src/armazenamento/postgresql/migracoes.ts` |
| 2 | `baralho`, com a `CHECK` do nome | idem |
| 3 | `vinculo`, com chave primária composta e as duas cascatas | idem |
| 4 | `usuario` | Será escrita pela `007`, ao lado desta, com a **mesma versão** e o **mesmo efeito** da migração do SQLite |
| 5 | Dono no acervo | Será escrita pela `008`, idem |

O aplicador é do Adapter e roda **apenas pelo comando de migração**: para cada
migração pendente, uma transação que começa com a **trava consultiva**
(`pg_advisory_xact_lock` sobre uma chave fixa), relê a versão depois da trava,
aplica o DDL e eleva a versão **dentro da mesma transação**. Repetir o comando numa
base já migrada não escreve nada (FR-116).

O início da nuvem **não** aplica migração: lê `versao_do_esquema` e compara com a
última versão conhecida pelo binário. Diferente disso, recusa iniciar com mensagem
clara em português que nomeia as duas versões (FR-121).

## Modelo da configuração de conexão

Não é entidade durável: é o que a entrada da nuvem lê do ambiente, valida **uma
vez** e entrega ao Adapter já pronto. O único lugar do programa que vê a URL é a
entrada.

| Peça | Origem | Regra |
|---|---|---|
| URL de conexão | variável de ambiente `DB_URL` | Obrigatória na nuvem; nunca versionada, exibida ou registrada (FR-113, FR-118) |
| Protocolo | a própria URL | Precisa ser `postgres:` ou `postgresql:` |
| Host | a própria URL | Precisa estar presente e não vazio |
| Base | a própria URL | Precisa estar nomeada no caminho |
| Usuário e senha | a própria URL | Usados só para conectar; **nunca** aparecem em mensagem, saída ou registro |
| Cifra e verificação | do Adapter, sempre | `ssl: { rejectUnauthorized: true }`; `sslmode=disable`, `allow` ou `prefer` na URL fazem a entrada **recusar** antes de conectar (FR-115) |
| CA adicional | variável de ambiente `DB_CA_CERT` (opcional, caminho de um PEM) | Presente, entra como `ca` no conjunto de conexões — é como os testes verificam uma autoridade privada; ausente, a cadeia pública do provedor é usada |
| Conjunto de conexões | do Adapter | Máximo pequeno e fixo (4); nenhuma configuração é exposta (o ajuste está adiado na spec) |

Recusa: variável ausente, vazia, não analisável, com protocolo diferente de
`postgres:`/`postgresql:`, sem host, sem base, ou pedindo cifra desligada →
`UrlDeConexaoInvalidaError`, cuja mensagem **nomeia `DB_URL`** e **nenhum pedaço do
valor**. A aplicação não segue como se o armazenamento existisse, e a **construção**
não exige a variável: o segredo só é necessário para executar (FR-114).

## Desfechos — os mesmos da Porta, obtidos de SQLSTATE

A Porta não muda: os desfechos continuam sendo
`{ ok: true, valor }`, `nao_encontrado`, `vinculo_duplicado` (e
`nome_de_usuario_existente`, na Porta da `007`) e `indisponivel`. O que esta
feature acrescenta é **de onde** cada um vem em PostgreSQL:

| O que aconteceu na base | SQLSTATE / sinal | Desfecho |
|---|---|---|
| Vínculo do par repetido | `23505` na chave primária de `vinculo` | `{ ok: false, erro: "vinculo_duplicado" }` |
| Nome de usuário repetido (na `007`) | `23505` no índice único de `lower(nome_de_usuario)` | `{ ok: false, erro: "nome_de_usuario_existente" }` |
| Vínculo com extremidade inexistente | `23503` na chave estrangeira | `{ ok: false, erro: "nao_encontrado" }` |
| Nenhuma linha afetada ou devolvida | contagem zero | `{ ok: false, erro: "nao_encontrado" }` |
| Servidor fora do ar, credencial recusada, certificado não verificável, transação abortada, `CHECK` violada por erro de programação | qualquer outro código | `{ ok: false, erro: "indisponivel" }` |

Nenhum desfecho carrega texto do driver, host, usuário, senha, cadeia de conexão
ou endereço com credencial — o que é a garantia de que nada disso alcança a saída,
o registro ou a resposta (FR-118). `indisponivel` **nunca** significa concluído: a
operação não passou, e o conteúdo informado continua disponível para nova tentativa
(FR-044, FR-045).

## Correspondência com as invariantes da spec

| Invariante da spec | Onde é garantida |
|---|---|
| O armazenamento da nuvem é PostgreSQL, e nenhum Module conhece o concreto | Adapter em `backend/src/armazenamento/postgresql/`, importado **apenas** pela entrada da nuvem; a Porta de `009` não muda e a bateria de `009` roda inteira (FR-110, FR-111, SC-044) |
| A Porta é a mesma para todos os Adapters, e nenhuma operação escolhe armazenamento | A Interface de `009` é implementada sem acrescentar operação; a fábrica devolve a mesma forma que a bateria espera |
| A URL de conexão é lida de `DB_URL` no início da nuvem; ausência ou URL malformada recusa | Leitura só nas entradas; validação antes de qualquer conexão; `UrlDeConexaoInvalidaError` nomeia a variável (FR-113, FR-114, SC-046) |
| A URL é segredo: nunca versionada, exibida ou registrada, nem em recusa | Linha de início só com o tipo de armazenamento; mensagens genéricas com SQLSTATE; testes geram a senha por execução (FR-118, SC-045) |
| Toda conexão é cifrada com certificado verificado | `ssl: { rejectUnauthorized: true }` sempre; URL que peça desligar é recusada (FR-115, SC-047) |
| Exclusividade dos caminhos: o local nunca usa PostgreSQL, a nuvem nunca usa o local | Um pacote por armazenamento, escolhido na construção; o pacote da nuvem não contém `node:sqlite` (FR-117, SC-050) |
| Operação não persistida nunca aparece como concluída; falha reportada preserva o conteúdo | Todo erro de armazenamento chega como `indisponivel`, e o Module o reporta em português (FR-044, FR-045) |
| Migração versionada traz a base nova à versão corrente e não reaplica | Comando de migração com transação e trava consultiva por migração; início confere a versão e recusa se atrasada (FR-116, FR-121, SC-048) |
| Queda de conexão não derruba a próxima operação | Piscina com ouvinte de `error` que descarta em silêncio; a operação seguinte abre outra conexão (FR-119, SC-049) |

## O que este modelo deliberadamente não tem

- Tabela, coluna ou arquivo que registre **qual armazenamento** está em uso: a
  escolha é da construção, e não é dado persistido.
- Tabela ou coluna com URL de conexão, senha, usuário, host ou `DB_CA_CERT`:
  configuração de execução não é dado guardado (Princípio VIII).
- Tabela de controle de migração além de `versao_do_esquema`: as migrações
  aplicadas continuam sendo identificadas pela versão registrada, como em `009`.
- Tabela de trava de migração: a trava é consultiva e da própria transação.
- Coluna de total, contador ou marca de elegibilidade de Baralho: a elegibilidade
  continua derivada por contagem a cada leitura, nunca armazenada.
- Coluna, tabela ou cache de **sessão, token ou cookie**: fora da spec.
- Coluna derivada da Senha, ou de troca, força ou data: fora da spec.
- Forma livre de dados, chave e valor, ou executor de consulta livre: a Porta é
  feita de operações de domínio.
- Qualquer coisa de hospedagem — serviço, rede, segredo de origem: adiada para uma
  feature posterior.
- Migração de dados entre o arquivo local e a base em nuvem: adiada na spec; os
  dois armazenamentos não se falam.
