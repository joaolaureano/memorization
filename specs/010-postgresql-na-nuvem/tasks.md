# Tasks: PostgreSQL na Nuvem

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`

**Depende de**: `009-porta-de-persistencia` **já implementada** — de onde vêm a
Porta `ArmazenamentoDoAcervo`, a bateria compartilhada de cenários, o parâmetro de
construção que escolhe o banco e o script de início local —, e de `001-criar-cartao`
a `008-entrar`, cujas suítes provam que acrescentar o Adapter de PostgreSQL não
mudou nenhum comportamento. Sem a `009` implementada não há Porta a implementar,
bateria a passar, parâmetro de construção a estender nem tabela de entradas a
ampliar.

**Executor**: pelo **Princípio XI**, todo código sob `backend/` é escrito por
subagentes DeepSeek, inclusive o apoio de teste que sobe o PostgreSQL real. O
`frontend/` e o `e2e/` **não** são tocados por esta feature.

## Formato

O estado de cada tarefa é a **caixa de seleção**: `- [ ]` pendente, `- [X]`
concluída. É esse marcador que o comando `implement` lê e atualiza. Os metadados
exigidos pelo processo ficam na tabela recolhida de cada fase.

`[P]` = paralelizável: arquivos disjuntos, sem dependência mútua.

---

## Fase 1 — Verificação real

- [X] T901 A suíte sobe um PostgreSQL real com TLS ligado, senha gerada por execução e CA descartável, e falha alto se não conseguir
- [X] T902 Cada cenário recebe uma base PostgreSQL nova e vazia, migrada pelo mesmo caminho do comando

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T901 | Um PostgreSQL **real** sobe numa porta livre, com diretório de dados temporário, senha gerada a cada execução e `ssl=on` com um CA e um certificado de servidor gerados em tempo de execução pelo `openssl` da máquina; quando isso não é possível, a suíte **falha alto** em vez de ser pulada | FR-111, FR-115 · SC-044, SC-047 | 009 (implementada) | — (apoio de teste, sem Interface de produção) | `backend/package.json`, `backend/tests/armazenamento/postgresql/` | `codebase-design` | O apoio é exercitado pela bateria contra PostgreSQL e pelo teste de TLS: o servidor aceita conexão cifrada com `DB_CA_CERT` apontando para o CA gerado, uma conexão sem esse CA é recusada, e a senha do usuário da base é diferente a cada execução; nenhum arquivo versionado contém senha, chave privada ou CA; binário que não roda na plataforma ou `openssl` ausente **falham alto**, nunca são pulados em silêncio | A bateria e o teste de TLS conectam a um PostgreSQL real e cifrado na máquina de desenvolvimento, sem Docker, sem contêiner e sem instalação manual, e nenhuma credencial é versionada |
| T902 | Cada chamada da fábrica de teste cria uma **base nova e vazia**, aplica as migrações pelo mesmo caminho do comando da nuvem e devolve `{ armazenamento, encerrar() }` na forma que a bateria de `009` espera; encerrar fecha o conjunto de conexões e descarta a base | FR-111, FR-116 · SC-044, SC-048 | T901 | `abrirArmazenamentoPostgresql` · fábrica da bateria | `backend/tests/armazenamento/postgresql/` | `codebase-design` | Duas chamadas seguidas da fábrica produzem bases distintas e independentes: o que uma grava não aparece na outra; a base entregue já responde na versão corrente do esquema; `encerrar()` em dobro não falha; nenhum cenário da bateria conhece porta, senha, base ou TLS | A bateria de `009` recebe uma fábrica pronta para PostgreSQL, sem saber que há um banco por trás |

</details>

---

## Fase 2 — Adapter de PostgreSQL

- [X] T903 O Adapter traz o DDL de PostgreSQL das migrações 1 a 3 e o aplicador com trava consultiva
- [X] T904 A bateria compartilhada de `009` roda contra o Adapter de PostgreSQL e passa cem por cento
- [X] T905 Conexão ociosa encerrada pelo provedor não derruba a próxima operação, e a base indisponível é reportada como falha

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T903 | `pg` entra como dependência de execução, e `migracoes.ts` com `esquema.ts` criam o esquema de PostgreSQL nas versões 1 a 3 — `cartao`, `baralho` e `vinculo` — com as mesmas regras de conteúdo do Adapter local, cada migração numa transação sob `pg_advisory_xact_lock` | FR-112, FR-116 · SC-048 | T901 | `migracoes.ts`, `esquema.ts` | `backend/package.json`, `backend/src/armazenamento/postgresql/` | `codebase-design` | Numa base nova e vazia, o aplicador chega à versão corrente e as três tabelas existem com as `CHECK` de Frente, Verso e nome (`btrim` e `char_length`), a chave primária composta de `vinculo` e as duas `ON DELETE CASCADE`; as regras de descarte continuam as de antes — excluir Cartão ou Baralho leva os Vínculos —; dois aplicadores disparados ao mesmo tempo não aplicam a mesma migração duas vezes; uma migração que falha não eleva a versão nem deixa tabela pela metade; `npm install` não compila nada nativo e `pg-native` nunca é carregado | Uma base PostgreSQL nova chega à versão corrente pelas mesmas versões do SQLite, sem reaplicação, sem estado parcial e sem dois aplicadores simultâneos |
| T904 | `abrirArmazenamentoPostgresql` implementa a Porta de `009` — as mesmas quinze operações, cada uma devolvendo `Promise` e desfecho tipado — e a bateria compartilhada roda contra ele **sem uma linha de edição**, cem por cento aprovada | FR-110, FR-111, FR-112 · SC-044 | T902, T903 | `ArmazenamentoDoAcervo` (Porta de 009) · `abrirArmazenamentoPostgresql` | `backend/src/armazenamento/postgresql/`, `backend/tests/armazenamento/postgresql/` | `codebase-design` | `tests/armazenamento/postgresql/bateria.test.ts` chama a **mesma** `bateriaDaPorta` de `009`, com a fábrica de T902, exigindo cem por cento de aprovação; o Vínculo repetido chega como `vinculo_duplicado` (`23505` na chave primária composta), a extremidade inexistente como `nao_encontrado` (`23503`), zero linhas afetadas como `nao_encontrado` e qualquer outra falha como `indisponivel`, distinguidos pelo nome da restrição, sem nenhum campo do erro do driver atravessar; a persistência entre duas aberturas do mesmo armazenamento continua valendo; a bateria de `009` não é editada, nenhuma operação recebe SQL, dialeto, conexão ou transação, e as suítes de `001` a `008` continuam verdes com os mesmos comportamentos | A bateria de `009` passa inteira contra PostgreSQL sem uma edição nela e sem edição em nenhum Module, e nenhum erro de driver cruza a Porta |
| T905 | O conjunto de conexões tem máximo pequeno e fixo e um ouvinte de `error` que descarta o evento em silêncio: encerradas as conexões do backend por `pg_terminate_backend`, a **próxima** operação abre outra e conclui; com a base indisponível, a operação é reportada como falha e nada aparece como concluído | FR-119, FR-118, FR-044, FR-045 · SC-049 | T904 | `abrirArmazenamentoPostgresql` · `encerrar()` | `backend/src/armazenamento/postgresql/`, `backend/tests/armazenamento/postgresql/` | `codebase-design` | Com o armazenamento em uso, os testes encerram as conexões do backend pelo servidor e exigem que a próxima operação conclua e que o conteúdo continue correto; com o servidor parado, cada operação devolve `indisponivel`, a falha é reportada, nenhuma operação aparece como concluída e o conteúdo informado continua disponível para nova tentativa; a saída e o registro do processo não recebem nada do evento de erro da conexão ociosa; `encerrar()` fecha o conjunto e chamá-lo em dobro não falha | A queda de uma conexão ociosa custa uma conexão do conjunto e nada mais, e a base indisponível nunca produz operação apresentada como concluída |

</details>

---

## Fase 3 — Configuração e segurança

- [X] T906 `DB_URL` ausente, vazia ou malformada recusa o início nomeando a variável e sem repetir o valor
- [X] T907 [P] A conexão é cifrada com certificado verificado, e uma URL que peça desligar a cifra é recusada
- [X] T908 O início informa apenas o tipo de armazenamento, e nenhuma falha reproduz a URL de conexão
- [X] T909 O início recusa iniciar com o esquema atrasado e não aplica migração

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T906 | As duas entradas da nuvem leem `DB_URL` no início do processo e a validam — analisável, protocolo `postgres:` ou `postgresql:`, host presente e base nomeada —, recusando com `UrlDeConexaoInvalidaError`, cuja mensagem em português nomeia a variável e nenhum pedaço do valor; o Adapter recebe a configuração pronta e nunca lê ambiente | FR-113, FR-114, FR-118 · SC-045, SC-046 | 009 (implementada) | `conexao.ts` · `UrlDeConexaoInvalidaError` | `backend/src/armazenamento/postgresql/`, `backend/src/entradas/`, `backend/tests/entradas/` | `codebase-design` | `DB_URL` ausente, vazia, não analisável, com protocolo `mysql:`, sem host e sem base fazem a entrada parar com mensagem em português que nomeia `DB_URL` e não repete o valor — nem usuário, nem senha, nem host, nem caminho —, e nenhum servidor começa a escutar; a varredura dos arquivos versionados não encontra o valor informado; a leitura de ambiente aparece **apenas** nas entradas da nuvem, e nenhum Module conhece a variável | Sem URL válida a nuvem não sobe nem segue como se o armazenamento existisse, e a mensagem entrega apenas o nome da variável |
| T907 | [P] Toda conexão é cifrada com `ssl: { rejectUnauthorized: true }`, com o CA de `DB_CA_CERT` quando a variável aponta um PEM, e uma URL que peça `sslmode=disable`, `allow` ou `prefer` é recusada **antes** de qualquer conexão; certificado que não se confirma recusa a conexão e nenhuma operação passa por concluída | FR-115, FR-044 · SC-047 | T906 | `conexao.ts` · configuração do conjunto de conexões | `backend/src/armazenamento/postgresql/`, `backend/tests/armazenamento/postgresql/` | `codebase-design` | `tests/armazenamento/postgresql/tls.test.ts`: com o CA privado gerado pelo apoio de teste, a conexão é verificada e a bateria roda; `sslmode=disable`, `allow` e `prefer` são recusados antes de abrir conexão, com mensagem que nomeia `DB_URL` e o motivo, sem repetir o valor; contra um certificado que não se confirma, a conexão é recusada, a operação chega como `indisponivel` e nenhuma operação aparece como concluída; `require`, `verify-ca` e `verify-full` são aceitos e verificados por inteiro | Não existe caminho de código que desligue a cifra nem a verificação do certificado, e a verificação é exercitada contra um servidor real com CA privado |
| T908 | [P] O início da nuvem imprime uma única linha — `Armazenamento: PostgreSQL (nuvem)` — antes de escutar, e toda falha de driver é reduzida a mensagem genérica em português mais o SQLSTATE, sem que a URL, a senha ou um endereço com credencial apareçam na saída ou no registro | FR-118, FR-113 · SC-045 | T906 | `nuvem.ts` | `backend/src/entradas/`, `backend/tests/entradas/` | `codebase-design` | `tests/entradas/nuvem.test.ts`: com `DB_URL` presente e válida, a saída do início traz apenas a linha do tipo de armazenamento e nenhuma ocorrência do valor, da senha ou de endereço com credencial; nos casos de recusa, a saída e o registro também não trazem vestígio do valor; o comando de migração imprime o resultado e a versão resultante, nunca a URL; a varredura dos arquivos versionados não encontra valor de `DB_URL`, senha ou chave; a falha de driver traz o SQLSTATE e nenhum `message`, `detail`, `hint` ou `where` | O único dado de armazenamento que a operação vê é o tipo em uso, e o diagnóstico de falha é um código SQLSTATE, nunca uma cadeia de conexão |
| T909 | O início da nuvem **não** aplica migração: lê a versão registrada, compara com a lista de migrações conhecida pelo binário e recusa iniciar, com mensagem em português que nomeia as duas versões, quando a base está atrasada; só na versão corrente o servidor começa a escutar | FR-121, FR-114 · SC-046, SC-048 | T906 | `nuvem.ts` | `backend/src/entradas/`, `backend/tests/entradas/` | `codebase-design` | `tests/entradas/nuvem.test.ts`: com a base recém-criada e sem migração, o início é recusado com mensagem em português que nomeia a versão encontrada e a corrente e manda executar o comando de migração, e **nada** escuta, nem no loopback; com a base migrada, o início sobe e a linha de início aparece; depois de uma recusa por esquema atrasado a base continua exatamente como estava, sem tabela criada por ter subido; `DB_URL` inválida recusa pelo mesmo caminho de T906 e nada escuta | Uma implantação que esqueceu o comando de migração é recusada em vez de servir sobre um esquema que não conhece |

</details>

---

## Fase 4 — Construção e scripts

- [X] T910 `migrate:cloud` leva a base à versão corrente e a repetição não reaplica nada
- [X] T911 `--banco=postgresql` produz `servidor.mjs` e `migrar.mjs`, e a construção passa sem `DB_URL`
- [X] T912 [P] O pacote local não contém `pg`, e os da nuvem não contêm o Adapter local nem `node:sqlite`
- [X] T913 O início local nunca toca em PostgreSQL, e o da nuvem nunca usa o armazenamento local

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T910 | `migrate:cloud` executa o comando de migração da nuvem: lê e valida `DB_URL`, aplica as migrações pendentes pelo aplicador do Adapter e informa a versão resultante; numa base já migrada a repetição não escreve nada, e dois comandos simultâneos não aplicam a mesma migração duas vezes | FR-116, FR-113 · SC-048 | T903, T906 | `migrar-nuvem.ts` | `backend/src/entradas/`, `backend/tests/armazenamento/postgresql/` | `codebase-design` | `tests/armazenamento/postgresql/migracoes.test.ts`: numa base nova e vazia o comando chega à versão corrente e informa a versão; repetir o comando não reaplica nada e a versão continua a mesma; dois comandos disparados ao mesmo tempo deixam o esquema correto e aplicam cada migração uma única vez; uma migração que falha sai com código `1`, deixa a versão de antes e nenhuma tabela pela metade; a saída nunca traz a URL, o host, o usuário nem a senha; `DB_URL` ausente ou malformada recusa com o prefixo `Migração recusada:` nomeando a variável | Migrar a base é um comando separado, uma vez por implantação, que não reaplica o já aplicado e não deixa estado parcial |
| T911 | `construir.mjs` ganha a entrada `postgresql` na sua tabela — empacotando `src/entradas/nuvem.ts` e `src/entradas/migrar-nuvem.ts` em `dist/postgresql/servidor.mjs` e `dist/postgresql/migrar.mjs` —, marca `pg-native` como externo e constrói **sem** `DB_URL`; os scripts `build:cloud`, `migrate:cloud` e `start:cloud` existem, e os de `009` não mudam | FR-117, FR-114 · SC-050 | T909, T910 | `construir.mjs` · scripts do `package.json` | `backend/scripts/`, `backend/package.json` | `codebase-design` | `npm run build:cloud` produz os dois arquivos da nuvem e uma mensagem que nomeia o armazenamento; a construção passa com o ambiente **sem** `DB_URL`; `npm run build` sem parâmetro, com valor não aceito e com valor com aparência de credencial continua recusando com código `1`, sem repetir o valor e sem produzir artefato, e a mensagem passa a listar `sqlite, postgresql`; `npm run build:local` continua produzindo só `dist/sqlite/servidor.mjs`; `pg-native` não aparece como dependência a resolver | Cada armazenamento tem o seu pacote, escolhido na construção, e a construção nunca exige o segredo de execução |
| T912 | [P] A suíte de construção de `009` é estendida e comprova o conteúdo de cada pacote nos **dois** sentidos: o local não contém `pg` nem o Adapter da nuvem, e os da nuvem não contêm `node:sqlite` nem o Adapter local | FR-117, FR-110, FR-114 · SC-050 | T911 | `construir.mjs` · conteúdo do pacote | `backend/tests/armazenamento/` | `codebase-design` | Depois de construir os dois pacotes, a inspeção do artefato exige `pg` e o Adapter de PostgreSQL ausentes de `dist/sqlite/servidor.mjs`, e `node:sqlite` e o Adapter local ausentes de `dist/postgresql/`; nenhum dos pacotes referencia o Adapter do outro lado; `pg-native` não aparece como dependência a resolver; a construção passa sem `DB_URL` no ambiente; nenhum Module passou a importar armazenamento concreto | A exclusividade de cada pacote é consequência do grafo do empacotamento e é medida por inspeção do artefato, não afirmada |
| T913 | A partir de uma cópia limpa, o início local sobe com o armazenamento local e **nenhuma** conexão a PostgreSQL é tentada, enquanto o início da nuvem usa PostgreSQL sem usar o armazenamento local; as suítes de `001` a `008` continuam verdes, sem asserção enfraquecida | FR-117, FR-114 · SC-050 | T911, T912 | `local.ts`, `nuvem.ts` · `start:local`, `start:cloud` | `backend/tests/entradas/`, `backend/tests/armazenamento/` | `codebase-design` | Sem `DB_URL`, `npm run start:local` e `npm run dev` sobem a aplicação, a linha de início nomeia o armazenamento local e nenhuma conexão a PostgreSQL é tentada — o pacote local nem contém o driver; com `DB_URL` válida, `npm run start:cloud` sobe contra PostgreSQL e não usa o armazenamento local, sem criar `*.sqlite`; as suítes de `001` a `008` passam sem nenhuma asserção enfraquecida | Os dois caminhos de início são exclusivos quanto ao armazenamento, e a execução local continua idêntica à de antes |

</details>

---

## Dependências e Ordem

```
T901 → T902 ─┐
             ├→ T904 → T905
T903 ────────┘

T906 → T907
T906 → T908
T906 → T909 ─┐
T903 ─────────┴→ T910 → T911 → T912 → T913
```

Execução **serial por padrão**. O paralelismo declarado é T907 com o par
T908–T909, por tocarem arquivos disjuntos (a configuração de cifra da conexão e a
saída da entrada da nuvem), e T912 com T913, por exercerem asserções disjuntas (o
conteúdo dos pacotes e o início de cada armazenamento).

**T903 e T904 não são paralelas**: a bateria precisa do DDL e do aplicador.
**T904 e T905 não são paralelas**: a prova de reconexão usa o Adapter pronto e o
ouvinte de `error` do conjunto de conexões. **T906 e T907 não são paralelas**: a
cifra é montada sobre a URL já validada. **T906 e T909 não são paralelas**: a
conferência de versão acontece depois da validação da URL, na mesma entrada.
**T910 depende de T903 e de T906**: o comando usa o aplicador do Adapter e a
mesma validação de `DB_URL`. **T911 depende de T909 e de T910**: a tabela de
entradas só pode ganhar `postgresql` quando as duas entradas empacotadas já
existem — antes disso a construção falharia por arquivo ausente. **T912 e T913
dependem de T911**: sem os pacotes não há artefato a inspecionar nem aplicação a
iniciar.

## Matriz de Rastreabilidade Requisito ↔ Tarefa

| Requisito | Tarefa |
|---|---|
| FR-044 | T905, T907 |
| FR-045 | T905 |
| FR-110 | T904, T912 |
| FR-111 | T901, T902, T904 |
| FR-112 | T903, T904 |
| FR-113 | T906, T908, T910 |
| FR-114 | T906, T909, T911, T912, T913 |
| FR-115 | T901, T907 |
| FR-116 | T902, T903, T910 |
| FR-117 | T911, T912, T913 |
| FR-118 | T905, T906, T908 |
| FR-119 | T905 |
| FR-121 | T909 |

| Critério | Tarefa |
|---|---|
| SC-044 | T901, T902, T904 |
| SC-045 | T906, T908 |
| SC-046 | T906, T909 |
| SC-047 | T901, T907 |
| SC-048 | T902, T903, T909, T910 |
| SC-049 | T905 |
| SC-050 | T911, T912, T913 |

## Notas

- Nenhuma tarefa exige decisão de produto ou de arquitetura do worker.
  Ambiguidade encontrada é reportada, não resolvida.
- Nenhuma tarefa cria Module, rota, tela, tabela ou coluna de domínio nova: a
  Interface da Porta de `009` não muda uma linha, nenhum Module é tocado e a
  bateria compartilhada não é editada. Todo o trabalho acontece dentro do
  diretório do Adapter, das duas entradas da nuvem, do script de construção e dos
  testes.
- Nenhum valor de URL de conexão, de senha, de chave privada ou de CA aparece em
  arquivo versionado, em teste ou nesta lista: as credenciais dos testes são
  geradas por execução e os documentos usam apenas a forma de espaço reservado.
- **Integração obrigatória, para `main` nunca ficar com a suíte vermelha**, em
  três blocos:
  - **Bloco da verificação real: T901 e T902 no mesmo commit.** São apoio de
    teste e não alteram código de produção; nenhuma suíte existente depende deles
    antes de T904.
  - **Bloco do Adapter: T903, T904 e T905 no mesmo commit.** O DDL sem o Adapter
    deixa a bateria contra PostgreSQL vermelha, o Adapter sem o ouvinte de
    `error` do conjunto de conexões derruba o processo na queda de uma conexão
    ociosa, e a prova de reconexão só faz sentido com o Adapter pronto.
  - **Bloco da configuração e da nuvem: T906 a T911 no mesmo commit.** As duas
    entradas da nuvem nascem juntas com a validação da variável de ambiente, a
    cifra verificada, a saída sem segredo, a conferência de versão e o comando de
    migração; a tabela de entradas do script de construção só passa a aceitar
    `postgresql` quando os dois pontos de entrada que ela empacota já existem —
    sem isso, `npm run build --banco=postgresql` quebraria por arquivo ausente
    antes mesmo dos testes. T912 e T913 entram no mesmo commit seguinte, para
    que a suíte de construção e a de início voltem a ficar verdes de uma vez.
- **T901 é a tarefa de maior risco operacional**: baixa um binário real de
  PostgreSQL e depende do `openssl` da máquina. A escolha é explícita — falhar
  alto em vez de pular em silêncio —, porque uma suíte que se pula sozinha aprova
  o que não verificou.
- **T904 é a prova central da feature**: a bateria de `009` roda inteira contra
  um segundo Adapter, sem uma edição nela e sem edição em nenhum Module. É o que
  mede que a Seam da Porta é real e que PostgreSQL e o armazenamento local não
  duplicam regra.
- **T905 é a verificação difícil de declarar concluída sem evidência**: exige
  encerrar conexões pelo lado do servidor e observar a **próxima** operação
  concluir, e exige que nada sensível tenha sido impresso no caminho.
- **T908 e T913 são as verificações negativas da feature**: a prova é a ausência
  — de URL, senha e endereço com credencial na saída e no registro, e de conexão
  a PostgreSQL no caminho local —, e nunca inspeção de estado interno.
- **T911 depende de T909 e de T910 por uma razão de ordem, não de gosto**: a
  tabela de entradas é derivada, e listar `postgresql` antes de os arquivos de
  entrada existirem transforma um parâmetro válido em falha de empacotamento.
- Nenhuma tarefa toca em `frontend/`, em `e2e/`, no contrato HTTP ou em qualquer
  regra de domínio; nenhuma tarefa introduz ORM, construtor de consultas, ajuste
  do conjunto de conexões, réplica ou cópia de segurança.
