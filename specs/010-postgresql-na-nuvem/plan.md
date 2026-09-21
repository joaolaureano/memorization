# Implementation Plan: PostgreSQL na Nuvem

**Branch**: `010-postgresql-na-nuvem` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Depende de**: `009-porta-de-persistencia`, de onde vêm a Porta
`ArmazenamentoDoAcervo`, a bateria compartilhada de cenários, o parâmetro de
construção e a raiz de composição local — todos usados **sem alteração**. Reusa a
fundação de projeto de [`001`](../001-criar-cartao/plan.md) (TypeScript estrito
sobre Node 24+, Fastify, Zod nas bordas, Vitest) e a decisão de driver daquele
plano, onde o binding nativo do SQLite foi **abandonado por não compilar no Node
26** deste ambiente e o `node:sqlite` ficou em seu lugar — o mesmo tipo de decisão
que aqui leva ao driver de JavaScript puro `pg`. É base de `007-criar-usuario` e
`008-entrar`, que passam a ter dois Adapters desde o nascimento. **Nenhuma
decisão anterior é reaberta**: esta feature apenas entrega o segundo Adapter que a
Porta de `009` já esperava, e a Porta não muda uma linha.

## Summary

Décima feature, e a segunda metade da decomposição do pedido de escolher o banco
na construção: ela **entrega o Adapter de PostgreSQL** — a segunda implementação
da Porta — e os dois caminhos da nuvem, a construção, o comando que migra a base
e o início que confere a versão do esquema antes de servir.

O escopo é operacional: **nenhuma tela, rota, campo, ação ou regra de domínio
nova**, e **nenhum Module alterado**. O que nasce é um diretório de Adapter, dois
pontos de entrada, um comando de migração e uma dependência de execução:

- o Adapter `backend/src/armazenamento/postgresql/` implementa **a mesma Porta**
  que o Adapter do armazenamento local e passa **a mesma bateria compartilhada**
  de `009`, sem editá-la e sem editar nenhum Module (FR-110, FR-111, SC-044);
- as migrações são escritas em **dialeto PostgreSQL**, com **os mesmos números de
  versão** do SQLite, e rodam **apenas pelo comando de migração** — cada uma numa
  transação guardada por `pg_advisory_xact_lock`, para que dois deployamentos
  simultâneos nunca migrem ao mesmo tempo; repetir o comando não reaplica nada
  (FR-116, SC-048), e o início da nuvem **recusa iniciar** quando o esquema está
  desatualizado (FR-121);
- a URL de conexão é lida **apenas** pelas entradas da nuvem, na variável de
  ambiente `DB_URL`, e nunca é versionada, exibida ou registrada; ausente ou
  malformada, a construção e o início da nuvem são recusados com mensagem em
  português que nomeia a variável e **não repete o valor informado** (FR-113,
  FR-114, FR-118, SC-045, SC-046);
- toda conexão é **cifrada com o certificado do servidor verificado**; uma URL que
  peça desligar a cifra é recusada, e nenhuma operação sobre uma conexão não
  verificável passa por concluída (FR-115, SC-047);
- o driver é `pg` (node-postgres), JavaScript puro, sem compilação nativa; a
  piscina tem máximo pequeno e um ouvinte de `error` que **descarta em silêncio** a
  conexão ociosa encerrada pelo provedor, de modo que a próxima operação abre
  outra e conclui (FR-119, SC-049);
- a construção ganha a entrada `postgresql`, e cada armazenamento tem o seu
  pacote: o local não contém `pg`, o da nuvem não contém o Adapter local nem
  `node:sqlite` (FR-117, SC-050).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 24+ (runtime já usado pela
aplicação; nada muda)

**Primary Dependencies**: Fastify, Zod, `node:sqlite` (Adapter do armazenamento
local) — de `001` a `009`, **não reabertas**. **Novas nesta feature**: `pg`
(node-postgres) como **dependência de execução** — JavaScript puro, sem
compilação nativa, ao contrário do binding de SQLite abandonado —, e `@types/pg`
e `embedded-postgres` como **devDependencies** (Decisões 1 e 8 de
[research.md](./research.md)). `pg-native` nunca é usado e é declarado **externo**
no empacotamento.

**Storage**: PostgreSQL na nuvem, atrás da Porta `ArmazenamentoDoAcervo` de
`009`, implementado por `backend/src/armazenamento/postgresql/`; a URL de conexão
vem de `DB_URL` e o CA opcional de `DB_CA_CERT` (FR-113). O armazenamento local
continua sendo o arquivo SQLite por `CAMINHO_DO_BANCO`, intocado. Nenhuma tabela
ou coluna de domínio nova: as migrações 1 a 3 ganham DDL por dialeto, e as 4 e 5
serão escritas por `007` e `008` nos dois dialetos.

**Testing**: Vitest para unidade e integração, já de `001`. A **bateria
compartilhada de cenários** de `009`
(`backend/tests/armazenamento/bateria-da-porta.ts`) passa a rodar **também**
contra o Adapter de PostgreSQL **dentro de `npm test`** (Princípio VI; FR-111,
SC-044), sobre um PostgreSQL **real** iniciado pelos próprios testes — sem Docker,
sem contêiner, com TLS ligado e um CA descartável gerado em tempo de execução
(Decisão 8). Se o binário não rodar na plataforma, a suíte **falha alto**; nunca é
pulada em silêncio.

**Target Platform**: PostgreSQL 16 ou superior; execução na nuvem (Neon, endpoint
agrupado) e, nos testes, o binário local baixado pela devDependency. O servidor
continua escutando **apenas** no loopback: o modelo de hospedagem — serviço de
execução, exposição de rede e segredo de origem — é assunto de feature
posterior e fica fora desta feature.

**Project Type**: Aplicação web com frontend e API separados, dois deployables; o
backend passa a ter **um pacote por armazenamento**: `dist/sqlite/servidor.mjs` e
`dist/postgresql/servidor.mjs`, mais `dist/postgresql/migrar.mjs` para o comando
de migração (FR-117, SC-050).

**Performance Goals**: nenhuma meta numérica. Cada operação da Porta é uma ida e
volta ao banco; a piscina tem máximo pequeno e **fixo** (4), porque o ajuste do
conjunto de conexões está adiado na spec e a Interface não expõe configuração de
conexão.

**Constraints**: execução local sem Docker, sem contêiner e sem servidor de banco
instalado à mão; TLS sempre verificado, nunca rebaixado; nenhum segredo
versionado, exibido ou registrado — nem em mensagem de recusa (FR-118, SC-045);
`dist/` e `*.sqlite` continuam ignorados pelo Git, e nenhum valor de `DB_URL` é
versionado (FR-113, SC-045).

**Scale/Scope**: 13 requisitos funcionais (FR-044 e FR-045 reutilizados; FR-110 a
FR-119 e FR-121 específicos), 7 critérios de sucesso (SC-044 a SC-050), 3
histórias, **nenhuma** tela, rota, tabela ou coluna nova de domínio, 1 Adapter
novo, 1 dependência de execução e 2 devDependencies novas, e **nenhum** Module
alterado.

## Constitution Check

*GATE: antes da Phase 0 e revisto após a Phase 1.*

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Deriva apenas de `spec.md` desta feature; as decisões de desenho estão em `research.md` e nos contratos. Nada de `007` ou `008` é antecipado — apenas o DDL das migrações 4 e 5 fica reservado a elas |
| II — Auditabilidade | **PASS**. Cada worker é registrado em `SESSION.md` com banner SPEC KIT. Nenhum valor de `DB_URL`, de senha ou de endereço com credencial é escrito, nem para ser removido depois: o que se registra é o código SQLSTATE e a mensagem genérica (FR-118) |
| III — Domínio antes de tecnologia | **PASS**. O código usa `Porta`, `Adapter`, `Armazenamento`, `URL de conexão`, `Migração` e as entidades do glossário; `repository`, `dao`, `store`, `driver` e `datasource` não nomeiam módulo, tipo, tabela nem rota. O diretório `postgresql` é nomeado pelo armazenamento, como manda `009`. `DB_URL` e `DB_CA_CERT` são nomes **impostos pela infraestrutura de nuvem existente**, declarados como contrato de integração, e não escolha de domínio |
| IV — Módulos profundos | **PASS**. A Seam da Porta ganha o segundo Adapter **justificado** — é ele que torna a Seam real, como `009` declarou. O Adapter esconde dialeto, conjunto de conexões, transação, verificação de certificado, conferência de versão e tradução de SQLSTATE atrás das mesmas quinze operações |
| V — Interface é a superfície de teste | **PASS**. A prova do Adapter é a bateria compartilhada de `009`, que atravessa a **mesma** Porta que os Modules atravessam e não nomeia armazenamento algum; nenhum teste passa a inspecionar tabela para afirmar comportamento de domínio. Os cenários de migração e de conexão usam o comando e a fábrica do Adapter, que são a Interface da Implementation |
| VI — Verificação sobre afirmação | **PASS**. Cem por cento da bateria contra PostgreSQL roda em `npm test`, e não por afirmação; a recusa por URL ausente, malformada ou com cifra desligada, a exclusividade dos pacotes e a reconexão depois de queda são **testes**, não promessas (SC-044 a SC-050) |
| VII — Escopo mínimo | **PASS**. Complexity Tracking justificado abaixo: uma dependência de execução e duas devDependencies exigidas por FR-111, FR-116 e FR-119 e pela decisão de verificação do clarify. Sem ORM, sem construtor de consultas, sem ajuste de conjunto de conexões, sem réplica, sem cópia de segurança e sem migração de dados entre armazenamentos |
| VIII — Segredos fora do repositório | **PASS**, e é o Princípio que a feature serve de perto. A URL de conexão é segredo: nunca versionada, nunca exibida, nunca registrada, nem em mensagem de recusa; a saída de início traz **apenas** `Armazenamento: PostgreSQL (nuvem)`. Os testes **geram** a senha por execução, e nenhum arquivo versionado contém valor de `DB_URL` (FR-113, FR-118, SC-045). Nenhuma emenda é necessária |
| IX — Rastreabilidade | **PASS condicionado**. A matriz requisito–teste é produzida em `tasks.md` |
| X — Portões de qualidade | **PASS até aqui**. Os portões passam a ser `npm test` (que inclui a bateria contra PostgreSQL), `npm run typecheck`, `npm run build:local` e `npm run build:cloud` no backend; `analyze` é executado ao final desta etapa |
| XI — Delegação de código | **PASS**. Todo código em `backend/` será escrito por workers DeepSeek, inclusive o apoio de teste que sobe o PostgreSQL |

**Processos removidos**: ADRs e Design It Twice não se aplicam, pela constituição
2.1.0. **Nenhuma emenda é necessária**: o Princípio IV é satisfeito por
acréscimo — o segundo Adapter é o que a Seam esperava —, e o Princípio VIII é
**cumprido com rigor novo**, não relaxado.

### Re-avaliação após Phase 1

**PASS, sem alteração.** O desenho confirmou as decisões:

- a Porta não muda: nenhuma operação nova, nenhum dialeto, nenhuma conexão e
  nenhuma escolha de armazenamento atravessam a Interface (FR-110);
- nenhum erro de `pg` atravessa a Porta: `23505` (unicidade) e `23503` (chave
  estrangeira) são traduzidos **dentro** do Adapter em `vinculo_duplicado` e
  `nao_encontrado`, e todo o resto é `indisponivel` — o desfecho de FR-044 e
  FR-045;
- a bateria de `009` roda contra PostgreSQL sem ser editada, o que é a medida de
  SC-044 e a prova de que nenhum Module foi ajustado para o banco novo;
- a migração ser **só por comando**, com transação e trava consultiva por
  migração, é o que faz SC-048 valer nas duas metades — aplicar na base nova e
  **não** reaplicar na base já migrada —, e é o que explica FR-121 existir: o
  início não migra, ele confere e recusa;
- a verificação sem Docker é **real**, e não emulada: PostgreSQL de verdade, TLS
  de verdade, CA privada de verdade, e nenhuma credencial versionada.

## Decisões de Codebase Design

Vocabulário conforme `.agents/skills/codebase-design/SKILL.md`, usado
literalmente.

### O Adapter de PostgreSQL — a segunda Implementation da Porta

Em `backend/src/armazenamento/postgresql/`:

| Arquivo | Papel |
|---|---|
| `armazenamento.ts` | O Adapter: `abrirArmazenamentoPostgresql(configuracao)` abre a piscina e devolve `{ armazenamento, encerrar() }`; implementa `ArmazenamentoDoAcervo` — e `ArmazenamentoDeUsuarios` quando a `007` a declarar — traduzindo SQLSTATE em desfechos tipados |
| `conexao.ts` | Lê e valida a URL de conexão (protocolo, host, base), monta a configuração do conjunto de conexões com `ssl: { rejectUnauthorized: true }` e recusa URL que peça desligar a cifra; declara `UrlDeConexaoInvalidaError`, cuja mensagem **nomeia `DB_URL` e nunca o seu valor** |
| `esquema.ts` | Lê a versão registrada em `versao_do_esquema`, confere contra a lista de migrações e aplica as pendentes — cada uma numa transação sob `pg_advisory_xact_lock` |
| `migracoes.ts` | O DDL de PostgreSQL, com os **mesmos números de versão** de `009`: 1 `cartao`, 2 `baralho`, 3 `vinculo`; as versões 4 e 5 serão acrescentadas aqui por `007` e `008` |

A fábrica devolve exatamente a forma que a bateria de `009` espera —
`{ armazenamento, encerrar() }` —, e é por isso que a bateria roda contra ela sem
uma linha de edição. `encerrar()` fecha a piscina; a Interface da Porta **não**
ganha nenhuma operação de ciclo de vida, que continua sendo do Adapter, exposta
pela sua fábrica.

**O Adapter é dono de tudo o que é do banco**: SQL, dialeto, transação,
verificação de certificado, conferência de versão, tradução de código de erro e
o conjunto de conexões. Nada disso aparece na Porta.

### Tradução de SQLSTATE — nenhum erro do driver atravessa a Porta

| SQLSTATE | Situação | Desfecho |
|---|---|---|
| `23505` | Unicidade violada: chave primária composta de `vinculo` | `{ ok: false, erro: "vinculo_duplicado" }` em `vincular` |
| `23505` | Unicidade violada: índice único de `lower(nome_de_usuario)` | `{ ok: false, erro: "nome_de_usuario_existente" }` na Porta da `007` |
| `23503` | Chave estrangeira violada ao vincular extremidade inexistente | `{ ok: false, erro: "nao_encontrado" }` |
| zero linhas afetadas ou devolvidas | Nada a ler, alterar ou excluir | `{ ok: false, erro: "nao_encontrado" }` |
| qualquer outro | Falha de conexão, de transação, de consulta ou violação de `CHECK` | `{ ok: false, erro: "indisponivel" }` |

Os dois casos de `23505` são distinguidos pelo **nome da restrição**, que é
estável porque o DDL é nosso. Nenhum desfecho carrega `message`, `detail`, `hint`,
`where` ou qualquer outro campo do erro do driver: a mensagem em português
continua sendo do Module (FR-118). Um erro que chegue fora desses casos é falha de
armazenamento e chega como `indisponivel` — a operação **não** passa por
concluída, e o conteúdo informado continua disponível para nova tentativa
(FR-044, FR-045).

### Conjunto de conexões e queda de conexão

Uma piscina por Adapter, com **máximo pequeno e fixo** (4), criada na fábrica e
fechada em `encerrar()`. Cada operação toma uma conexão da piscina e a devolve;
não há conexão global nem transação atravessando operações.

A piscina recebe um ouvinte de `error`: quando o provedor encerra uma conexão
**ociosa** — o caso que a spec nomeia —, o evento é **descartado em silêncio** (nem
a mensagem do driver, nem o endereço da base vão para a saída ou o registro), a
conexão sai da piscina, e a próxima operação abre outra e conclui. É isso que
FR-119 e SC-049 medem, e é um teste com `pg_terminate_backend` que o comprova:
encerradas as conexões do backend pelo servidor, a operação seguinte é bem
sucedida.

Enquanto a base estiver **indisponível** — servidor fora do ar, credencial
recusada, TLS não verificável —, cada operação devolve `indisponivel` dentro do
tempo do driver, a falha é reportada e nada aparece como concluído (FR-044,
FR-045, FR-119).

### Migrações em dialeto PostgreSQL, com as versões compartilhadas

A numeração da lista de migrações é a mesma do Adapter local, porque a tabela de
versão é a mesma ideia nos dois bancos: uma base migrada aqui está na **mesma
versão** que uma base migrada lá.

| Versão | SQLite (`009`) | PostgreSQL (esta feature) |
|---|---|---|
| 1 | `cartao` | `cartao`, com `TEXT` e as mesmas `CHECK` |
| 2 | `baralho` | `baralho`, idem |
| 3 | `vinculo` | `vinculo`, com chave primária composta e as duas `ON DELETE CASCADE` |
| 4 | `usuario` | `usuario`, com `BYTEA` no lugar de `BLOB` e índice único em `lower(nome_de_usuario)` — escrito pela `007` |
| 5 | Dono no acervo | recriação das três tabelas com `usuario_id` e os índices — escrito pela `008` |
| — | `versao_do_esquema` | a mesma tabela, `versao` inteiro, criada sob demanda |

Mapeamento de dialeto: `TEXT` para texto, `INTEGER` para a versão, `BYTEA` para
binário, restrições `CHECK` equivalentes — as mesmas regras de conteúdo, com
`trim` e `length` traduzidos para `btrim` e `char_length` — e, para a unicidade
sem distinção entre maiúsculas e minúsculas do Nome de usuário, um **índice único
sobre `lower(nome_de_usuario)`**. Restringir o alfabeto a ASCII, como a `007`
decidiu, é o que mantém os dois Adapters equivalentes: `COLLATE NOCASE` do SQLite
e `lower` do PostgreSQL coincidem exatamente nesse alfabeto.

Aplicação, uma migração por vez:

1. `CREATE TABLE IF NOT EXISTS versao_do_esquema (versao INTEGER NOT NULL)`;
2. `BEGIN`;
3. `SELECT pg_advisory_xact_lock(<chave fixa>)` — **dois deployamentos simultâneos
   nunca migram ao mesmo tempo**; a trava é da transação e sai no `COMMIT`;
4. releitura da versão **depois** da trava, e conferência de que a migração ainda
   está pendente;
5. DDL da migração e elevação da versão **dentro da mesma transação** — é isso que
   faz uma falha no meio não deixar estado parcial;
6. `COMMIT`.

Reexecutar o comando numa base já migrada percorre a lista, encontra todas as
versões aplicadas e **escreve nada** (FR-116, SC-048). O comando é a **única**
forma de migrar: nenhuma entrada aplica migração ao subir.

### O início da nuvem confere a versão e recusa iniciar se ela estiver atrasada

`backend/src/entradas/nuvem.ts` é a raiz de composição da nuvem: lê `DB_URL`,
valida, abre o Adapter, **lê a versão do esquema** e a compara com a última versão
conhecida. Se a base está atrasada, o início é recusado com mensagem clara em
português que nomeia as duas versões e manda executar o comando de migração
(FR-121, SC-048); se está na versão corrente — ou **adiantada**, caso que só
aparece com binário antigo contra base nova, e que é recusado do mesmo modo —, o
início informa **apenas** `Armazenamento: PostgreSQL (nuvem)` e só então começa a
escutar (FR-118, SC-045).

É o que dá sentido à separação do clarify: o início **não** migra, então uma
implantação que esqueceu a migração é recusada em vez de servir sobre um esquema
que não conhece.

### `DB_URL` — lida só pelas entradas da nuvem, e tratada como segredo

`DB_URL` é lida **apenas** em `backend/src/entradas/nuvem.ts` e
`backend/src/entradas/migrar-nuvem.ts`, no início do processo, e passada adiante já
validada. O Adapter não lê ambiente: ele recebe a configuração pronta, o que mantém
uma raiz de composição por armazenamento e torna verificável por leitura de
imports que nenhum Module e nenhum Adapter conhece a variável.

Validação (FR-113, FR-114, SC-046): a URL precisa ser **analisável**, ter
protocolo `postgres:` ou `postgresql:`, **host presente** e base nomeada. Caso
contrário — e também quando a variável está **ausente** ou vazia —, a entrada
falha com `UrlDeConexaoInvalidaError`, cuja mensagem **nomeia `DB_URL`** e
**nenhum pedaço do valor**: nem usuário, nem senha, nem host, nem caminho. A
aplicação não segue como se o armazenamento existisse, e a construção **não**
exige a variável — o segredo só é necessário para executar (FR-114).

### Cifra sempre, certificado sempre verificado

A configuração do conjunto de conexões traz `ssl: { rejectUnauthorized: true }`
**sempre**, e mais `ca` quando `DB_CA_CERT` aponta para um PEM. A diretiva
`sslmode` da própria URL é **ignorada como pedido**: o objeto `ssl` é que manda, de
modo que nenhuma URL consegue rebaixar a verificação. Uma URL que **peça** desligar
a cifra — `sslmode=disable`, `allow` ou `prefer` — é **recusada** antes de qualquer
conexão (FR-115, SC-047). `require`, `verify-ca` e `verify-full` são aceitos e, de
qualquer modo, verificados por inteiro.

`DB_CA_CERT` é a porta pela qual os testes verificam uma autoridade certificadora
**privada** gerada por eles mesmos; na nuvem, a variável fica ausente e a cadeia
**pública** do provedor é usada. Uma conexão que não possa ser verificada é
recusada pelo próprio driver, chega como `indisponivel` pela Porta e **nenhuma
operação sobre ela passa por concluída** — nem na migração, nem no início, nem no
atendimento.

### Duas entradas, dois pacotes, e um comando a mais

A tabela de entradas de `backend/scripts/construir.mjs`, entregue por `009`, ganha
uma linha:

```text
{ sqlite: "src/entradas/local.ts", postgresql: "src/entradas/nuvem.ts" }
```

`--banco=postgresql` empacota `dist/postgresql/servidor.mjs`, e o comando de
migração é empacotado como **segunda entrada do mesmo armazenamento**, em
`dist/postgresql/migrar.mjs`. Como só as entradas escolhidas entram no grafo do
empacotamento, o pacote local **não** contém `pg` e os da nuvem **não** contêm
`node:sqlite` nem o Adapter local (FR-117, SC-050): `pg-native`, que o `pg`
declara como dependência opcional, é marcado **externo** para que o
empacotamento não tente resolvê-lo.

Scripts acrescentados: `build:cloud`, `migrate:cloud` e `start:cloud`. Os de `009`
— `typecheck`, `test`, `lint`, `build`, `build:local`, `start:local` e `dev` —
ficam como estão. Detalhes, códigos de saída e mensagens em
[`contracts/scripts-da-nuvem.md`](./contracts/scripts-da-nuvem.md).

### Uma regra operacional: endpoint agrupado em execução, direto na migração

A nuvem (Neon) oferece dois endereços: o **agrupado** (pooler) e o **direto**. A
variável é uma só, `DB_URL`, definida pelo operador **por comando**: na execução,
o endpoint agrupado, que é o certo para muitas conexões curtas; no comando de
migração, o endpoint **direto**, porque DDL com trava consultiva em transação
atravessa mal o agrupador. É regra operacional documentada no
[quickstart](./quickstart.md) e nos [contratos](./contracts/scripts-da-nuvem.md),
não escolha de código: o mesmo nome de variável serve aos dois, e o valor é do
operador.

### Avaliação do desenho e da mudança

- **A Interface é menor que o que esconde?** Sim, e agora de forma mais visível: as
  mesmas quinze operações escondem **dois** dialetos, dois conjuntos de conexões,
  duas formas de migrar, verificação de certificado e tradução de código de erro.
- **Há Leverage real?** Sim: nenhum Module, rota ou componente do frontend foi
  tocado para acrescentar o banco novo — e a bateria que prova isso é a de `009`.
- **Há Locality?** Sim: trocar de provedor, de dialeto, de forma de conectar ou de
  conjunto de conexões acontece inteiro dentro de `armazenamento/postgresql/`.
- **Teste de exclusão**: sem o Adapter, `Acervo` e `Identidade` voltariam a
  importar banco, e a configuração de conexão, o TLS e a tradução de erro
  apareceriam nos Modules — a complexidade reapareceria em três lugares em vez de
  um.
- **Os testes usam a Interface?** Sim: a bateria atravessa a Porta; os testes de
  conexão e de migração usam a fábrica e o comando, que são a Interface da
  Implementation.
- **Há Seam especulativa?** Não: a Porta foi aberta em `009` com esta feature em
  vista, e esta feature é o segundo Adapter que a justifica.

## Impacto em 007 e 008

`007-criar-usuario` e `008-entrar` **não estão implementadas** — são planos —, e
nada delas é antecipado aqui. Este plano lê as duas como construídas **sobre a
Porta**, e é a ordem do clarify (`009`, `010`, `007`, `008`) que faz a segunda
Porta e as migrações 4 e 5 nascerem já em **dois** Adapters, sem reescrita:

- **A segunda Porta já tem o seu lugar, e este Adapter a implementa.** Quando a
  `007` declarar `ArmazenamentoDeUsuarios`, o Adapter de PostgreSQL acrescenta as
  duas operações no mesmo arquivo, e o Nome de usuário repetido chega como
  desfecho tipado `nome_de_usuario_existente`, traduzido do `23505` do índice
  único de `lower(nome_de_usuario)` — nunca como erro de driver. A derivação de
  Senha continua inteiramente no Module: a Porta guarda `sal` e `hash` como
  `BYTEA`, e a Senha não é armazenada em coluna alguma.
- **As migrações 4 e 5 ganham DDL aqui.** A `007` escreve a 4 (`usuario`) e a
  `008` escreve a 5 (acervo com dono), uma vez por dialeto, com os **mesmos
  números de versão** das migrações do SQLite. No Adapter de PostgreSQL, elas são
  entradas acrescentadas a `postgresql/migracoes.ts`, e os mapeamentos deste plano
  já valem para elas: `BYTEA` para binário, `CHECK` equivalentes e índice único
  sobre `lower(nome_de_usuario)` — que só coincide com `COLLATE NOCASE` do SQLite
  porque a `007` restringiu o alfabeto a ASCII.
- **O dono da `008` não pede nada novo do Adapter**: `usuario_id TEXT NOT NULL
  REFERENCES usuario(id) ON DELETE CASCADE`, com índice por tabela, é DDL comum, e
  as cascatas já se comportam como no SQLite — o PostgreSQL sempre as respeita.
- **Nenhuma entrada nova.** `nuvem.ts` e `migrar-nuvem.ts` continuam sendo as duas
  entradas da nuvem; a `007` e a `008` não acrescentam raiz de composição nem
  variável de armazenamento. A conferência de versão do início passa a cobrir as
  migrações 4 e 5 sem uma linha de mudança: ela compara a versão da base com a
  **lista** de migrações, e não com um número escrito à mão.
- **Nada além disso é tocado**: nenhuma tela, rota, regra de domínio ou coluna
  planejada por `007` e `008` é alterada por esta feature.

## Validação, Erros e Segurança

- **Forma na borda, regra no domínio**: nada disso muda. Zod continua validando a
  forma em `backend/src/http/rotas.ts`; as regras continuam nos Modules, que só
  conhecem a Porta. Esta feature não toca em nenhum dos dois.
- **Camada nova de configuração**: a URL de conexão é validada **uma vez**, na
  entrada, e a configuração pronta desce para o Adapter. Configuração inválida é
  recusa de início, não erro de domínio.
- **Sem vazamento em falha**: nenhuma mensagem — de recusa de construção, de recusa
  de início, de migração ou de operação — traz a URL, o usuário, a senha, o host ou
  texto do driver. Quando o driver falha, a entrada e o comando imprimem mensagem
  **genérica em português** acrescida do **SQLSTATE** (um código, e não um valor
  sensível), porque é o que torna a falha diagnosticável sem violar o Princípio
  VIII (FR-118, SC-045).
- **Log**: o logger do Fastify continua desabilitado, e o ouvinte de `error` da
  piscina **não escreve nada**. Nenhum caminho de código imprime conteúdo de
  `DB_URL` ou de `DB_CA_CERT`.
- **Repositório**: nenhum valor de `DB_URL` é versionado — nem em exemplo, nem em
  comentário, nem em teste. Os testes **geram** a senha por execução e o CA em
  diretório temporário; os documentos usam apenas a forma de espaço reservado.
- **Loopback**: `assegurarEscutaLocal` continua valendo sem alteração; hospedagem
  em nuvem é assunto de feature posterior.

## Estratégia de Testes

A Interface é a superfície de teste.

- **Bateria compartilhada** (`tests/armazenamento/bateria-da-porta.ts`, de `009`):
  **não é editada**. Um arquivo novo — `tests/armazenamento/postgresql/bateria.test.ts`
  — chama a **mesma** função com a fábrica de PostgreSQL, exigindo cem por cento de
  aprovação e nenhuma alteração nos Modules (FR-110, FR-111, SC-044).
- **PostgreSQL real, sem Docker** (`tests/armazenamento/postgresql/servidor-de-teste.ts`):
  o apoio de teste baixa e inicia um PostgreSQL **real** numa porta livre, com
  diretório de dados temporário; gera um **CA e um certificado de servidor**
  descartáveis com o `openssl` da máquina, sobe o servidor com `ssl=on` e conecta
  apontando `DB_CA_CERT` para o CA gerado. A senha é **gerada por execução**, nada
  é versionado, e TLS **de verdade** é exercitado — nunca desligado. Se o binário
  não rodar na plataforma ou o `openssl` faltar, a suíte **falha alto**: nada é
  pulado em silêncio (Princípio VI).
- **Base nova por cenário** (`tests/armazenamento/postgresql/base-de-teste.ts`):
  cada chamada da fábrica cria uma **base nova e vazia**, aplica as migrações pelo
  mesmo caminho do comando e devolve `{ armazenamento, encerrar() }`; encerrar
  fecha a piscina e descarta a base.
- **Migrações** (`tests/armazenamento/postgresql/migracoes.test.ts`): numa base
  nova e vazia, o comando traz o esquema à versão corrente; repetir o comando não
  reaplica nada; uma migração que falha não deixa estado parcial; e dois comandos
  disparados **ao mesmo tempo** não aplicam a mesma migração duas vezes
  (FR-116, SC-048).
- **Conferência de versão no início** (`tests/entradas/nuvem.test.ts`): com a base
  atrasada, o início é recusado com mensagem em português, e o servidor **não**
  começa a escutar (FR-121).
- **TLS** (`tests/armazenamento/postgresql/tls.test.ts`): a conexão de teste usa CA
  privado e verifica o certificado de verdade; uma URL com `sslmode=disable` (e
  `allow`, e `prefer`) é recusada **antes** de qualquer conexão; e contra um
  certificado que não se confirma, a conexão é recusada e a operação chega como
  `indisponivel`, sem passar por concluída (FR-115, SC-047).
- **Reconexão** (`tests/armazenamento/postgresql/reconexao.test.ts`): com o
  armazenamento em uso, os testes encerram as conexões do backend por
  `pg_terminate_backend` e exigem que a **próxima operação** conclua — o conteúdo
  continua correto (FR-119, SC-049); e, com o servidor parado, a operação é
  reportada como falha, não passa por concluída e o conteúdo informado continua
  disponível para nova tentativa (FR-044, FR-045).
- **Segredo fora da saída e do registro** (`tests/entradas/nuvem.test.ts`): com
  `DB_URL` presente, a saída do início traz **apenas** `Armazenamento: PostgreSQL
  (nuvem)` e nenhuma ocorrência do valor, da senha ou de endereço com credencial;
  com a variável ausente, vazia, malformada ou com protocolo errado, a recusa
  nomeia `DB_URL` e de nada do valor se encontra vestígio; e uma varredura dos
  arquivos versionados não encontra o valor informado (FR-113, FR-114, FR-118,
  SC-045, SC-046).
- **Construção** (`tests/armazenamento/construcao.test.ts`, de `009`, estendido):
  `--banco=postgresql` produz `dist/postgresql/servidor.mjs` e
  `dist/postgresql/migrar.mjs`; o pacote local **não** contém `pg`, e os da nuvem
  **não** contêm `node:sqlite` nem o Adapter local; `pg-native` não aparece como
  dependência a resolver; a construção continua sem exigir `DB_URL` (FR-117,
  SC-050).
- **Suítes de `001` a `009`**: inalteradas. Elas provam que acrescentar o Adapter
  de PostgreSQL não mudou nenhum comportamento observável — a medida de SC-050 pelo
  lado local e a garantia de que a feature foi cirúrgica.

Comandos: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build:local` e
`npm run build:cloud` em `backend/`; `npm run migrate:cloud` e `npm run
start:cloud` exigem `DB_URL` no ambiente. No frontend e no E2E, nada é tocado.

## Project Structure

Um diretório de Adapter novo, duas entradas, um comando, um apoio de teste e a
extensão da tabela do script de construção; o resto continua exatamente onde `009`
o deixou.

```text
backend/
├── package.json               # + build:cloud, migrate:cloud, start:cloud; + pg (dependência), @types/pg e embedded-postgres (devDependencies)
├── scripts/
│   └── construir.mjs          # tabela de entradas: + postgresql → src/entradas/nuvem.ts (e migrar-nuvem.ts)
├── src/
│   ├── armazenamento/
│   │   ├── porta.ts           # de 009, sem alteração
│   │   ├── sqlite/            # de 009, sem alteração
│   │   └── postgresql/        # novo Adapter da nuvem
│   │       ├── armazenamento.ts   # abrirArmazenamentoPostgresql: piscina, operações da Porta, tradução de SQLSTATE
│   │       ├── conexao.ts         # valida da URL de conexão, TLS verificado e UrlDeConexaoInvalidaError
│   │       ├── esquema.ts         # versão do esquema: ler, conferir e aplicar com trava consultiva
│   │       └── migracoes.ts       # DDL de PostgreSQL, versões 1 a 3 (4 e 5 por 007 e 008)
│   ├── acervo/                # intocado
│   ├── identidade/            # criado por 007, sobre a Porta, sem saber do banco
│   ├── http/                  # intocado
│   └── entradas/
│       ├── local.ts           # de 009, sem alteração
│       ├── nuvem.ts           # nova raiz de composição da nuvem: DB_URL, conferência de versão, início
│       └── migrar-nuvem.ts    # nova: o comando de migração da nuvem
└── tests/
    ├── armazenamento/
    │   ├── bateria-da-porta.ts  # de 009, sem edição
    │   ├── sqlite.test.ts       # de 009, sem alteração
    │   ├── construcao.test.ts   # de 009, estendido com a entrada postgresql e o conteúdo dos pacotes
    │   └── postgresql/
    │       ├── servidor-de-teste.ts  # sobe PostgreSQL real com TLS e CA descartáveis
    │       ├── base-de-teste.ts      # base nova e migrada por cenário; devolve a fábrica
    │       ├── bateria.test.ts       # a bateria compartilhada contra o Adapter
    │       ├── migracoes.test.ts     # base nova, reexecução, concorrência, falha sem estado parcial
    │       ├── tls.test.ts           # cifra obrigatória e certificado verificado
    │       └── reconexao.test.ts     # queda de conexão e próxima operação
    └── entradas/
        └── nuvem.test.ts        # DB_URL: recusa, saída sem segredo, versão atrasada

frontend/                        # intocado
e2e/                             # intocado
```

**Structure Decision**: a divisão continua por Module e Seam, e não por camada. O
diretório `armazenamento/` contém a **Porta** e os **Adapters**, um por banco, e
cada Adapter é dono do seu dialeto, das suas migrações e do seu jeito de conectar.
`entradas/` é a única raiz de composição por armazenamento, e é a única coisa que
importa um Adapter — o que a `009` transformou em propriedade verificada por
teste, e que esta feature **não** altera. Não existe pasta de `repositories`,
`models`, `services` ou `migrations`: as migrações vivem dentro do Adapter, porque
DDL é dialeto.

## Riscos, Alternativas e Custo de Reversão

| Decisão | Risco | Alternativa rejeitada | Custo de reversão |
|---|---|---|---|
| Driver `pg` em JavaScript puro | Menos desempenho que o binding nativo em cargas grandes | `pg-native`, que exigiria compilação nativa no mesmo ambiente onde o binding de SQLite já não compila (Node 26) | Baixo: a Porta não conhece o driver; trocar é trocar um arquivo de Adapter |
| Piscina com máximo pequeno e fixo, com ouvinte de `error` | O máximo pode apertar sob concorrência alta | Abrir conexão nova por operação, pagando um aperto de mão TLS por chamada; ou expor o ajuste na Interface, contra o escopo mínimo e o adiamento na spec | Baixo: um número em uma linha, e nenhuma Interface muda |
| Tradução de SQLSTATE dentro do Adapter | Um código novo pode chegar sem tradução e virar `indisponivel` | Consultar antes de inserir, que tem corrida; ou deixar o erro do driver atravessar, contra FR-110 e FR-118 | Baixo: uma tabela de tradução dentro do Adapter |
| DDL por dialeto, com as mesmas versões | Duas migrações para manter a cada mudança de esquema | Um aplicador único com SQL portável, que nenhum dos dois dialetos aceita | Baixo: a lista ordenada é compartilhada; só o DDL diverge |
| Migração só por comando, com trava consultiva | Um deploy que esqueça o comando para na conferência de versão | Migrar no início, contra o clarify e o FR-121; ou uma trava de aplicação própria, que exigiria tabela e protocolo | Baixo: o comando é uma entrada e uma função |
| TLS sempre verificado, com `DB_CA_CERT` opcional | Um provedor com CA exótica exige a variável extra | Seguir o `sslmode` da URL, que permitiria `disable` e desligaria a cifra, contra FR-115 | Baixo: uma opção na configuração da piscina |
| Erro do driver reduzido a mensagem genérica + SQLSTATE | Diagnóstico menos rico que a mensagem crua | Repassar o erro do driver, que vaza host, usuário e cadeia de conexão (Princípio VIII) | Baixo: o SQLSTATE é estável e basta para operar |
| PostgreSQL real baixado pelos testes | Uma dependência de desenvolvimento grande e um binário por plataforma | Emulação em processo, que não provaria dialeto, DDL nem TLS; contêiner, proibido pelo ambiente (Docker) | Baixo: o apoio de teste é um arquivo, e a bateria não o conhece |
| Dois pacotes, escolhidos na construção | Reconstruir para trocar de armazenamento | Entrada única com escolha em execução, que faria o pacote carregar os dois Adapters (FR-117) | Baixo |
| Endpoint agrupado na execução e direto na migração | Regra operacional que precisa ser lembrada | Usar o agrupador na migração, onde DDL com trava em transação é frágil | Nulo: é uma variável definida por comando |

## Complexity Tracking

> Nenhuma violação da constituição a justificar.

**Nenhum** Module novo, **nenhuma** rota nova, **nenhuma** tabela ou coluna de
domínio nova, **nenhuma** tela. O que a feature acrescenta é a segunda
Implementation da Porta — que é o que torna a Seam de `009` real — e três
dependências, cada uma exigida por um requisito:

| Acrescentado | Exigido por | Por que não há alternativa menor |
|---|---|---|
| `pg` (dependência de execução) | FR-110, FR-112 | É o driver de PostgreSQL em JavaScript puro; o binding nativo é justamente o que já foi abandonado neste ambiente. Acessar PostgreSQL sem driver não existe |
| `embedded-postgres` (devDependency) | FR-111, SC-044 | A bateria compartilhada precisa de um PostgreSQL **real** para valer como prova, e o ambiente não tem Docker nem servidor instalado à mão (decisão do clarify) |
| `@types/pg` (devDependency) | FR-110 | O projeto é TypeScript estrito; sem as formas do driver, o Adapter não compila sob `tsc --noEmit` |

Nada além disso é antecipado: sem ORM, sem construtor de consultas, sem ajuste do
conjunto de conexões (adiado na spec), sem réplica de leitura, sem cópia de
segurança, sem migração de dados entre armazenamentos, sem hospedagem e sem
qualquer emenda à constituição.
