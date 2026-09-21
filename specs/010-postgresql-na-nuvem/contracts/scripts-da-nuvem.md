# Contract — Scripts da Nuvem

Os scripts do backend, a extensão da tabela de entradas do script de construção, o
comando de migração, os códigos de saída, as mensagens, o que cada pacote contém,
a linha de início e as variáveis de ambiente da execução na nuvem.

Base: `backend/package.json` e `backend/scripts/construir.mjs`, entregues por
`009`. Nada do que aquele contrato fixa é alterado: esta feature **acrescenta**
linhas e scripts. O frontend não é tocado.

## Scripts

| Script | Comando | O que é | Origem |
|---|---|---|---|
| `typecheck` | `tsc --noEmit` | Verificação de tipos | `009`, inalterado |
| `test` | `vitest run` | Suítes existentes, bateria da Porta **contra SQLite e contra PostgreSQL**, verificações estruturais e de construção | `009`, ampliado pela bateria da nuvem |
| `lint` | `eslint .` | Análise estática | `009`, inalterado |
| `build` | `node scripts/construir.mjs` | Construção por armazenamento. **Exige** `--banco=<valor>`; sem ele, recusa | `009`, com a tabela de entradas ampliada |
| `build:local` | `node scripts/construir.mjs --banco=sqlite` | Pacote da execução local | `009`, inalterado |
| `start:local` | `node dist/sqlite/servidor.mjs` | Início da execução local, a partir do pacote | `009`, inalterado |
| `dev` | `node --watch src/entradas/local.ts` | Início local sem construir | `009`, inalterado |
| `build:cloud` | `node scripts/construir.mjs --banco=postgresql` | Pacote da execução da nuvem **e** o do comando de migração | **nova** (FR-117) |
| `migrate:cloud` | `node dist/postgresql/migrar.mjs` | Comando de migração da nuvem: leva a base à versão corrente e não reaplica o já aplicado | **nova** (FR-116) |
| `start:cloud` | `node dist/postgresql/servidor.mjs` | Início da execução da nuvem, a partir do pacote, contra PostgreSQL | **nova** (FR-117) |

**Portões de qualidade** do backend: `npm test` (que inclui a bateria contra
PostgreSQL), `npm run typecheck`, `npm run build:local` e `npm run build:cloud`.

## Tabela de entradas do script de construção

| Armazenamento | Entrada empacotada | Pacote |
|---|---|---|
| `sqlite` | `src/entradas/local.ts` | `dist/sqlite/servidor.mjs` |
| `postgresql` | `src/entradas/nuvem.ts` e `src/entradas/migrar-nuvem.ts` | `dist/postgresql/servidor.mjs` e `dist/postgresql/migrar.mjs` |

Regras herdadas de `009`, sem mudança:

| Aspecto | Regra |
|---|---|
| Forma aceita do parâmetro | Exatamente `--banco=<valor>` |
| Valores aceitos | As chaves da tabela de entradas. Nesta feature: **`sqlite`** e **`postgresql`** |
| Parâmetro ausente, em forma diferente (`--banco`, `--banco sqlite`, valor vazio) ou valor não aceito | Recusa, com a **mesma** mensagem |
| Valor com aparência de credencial | Recusado como não aceito; a mensagem **não repete o valor informado** |
| Lista de aceitos | **Derivada** da tabela: acrescentar um Adapter é acrescentar uma entrada |
| `DB_URL` no momento da construção | **Não** é lida nem exigida: o segredo só é necessário para executar (FR-114) |

A mensagem de recusa passa a listar os dois valores:

```text
Construção recusada. Informe --banco=<valor>, com um dos valores aceitos: sqlite, postgresql.
```

## Códigos de saída e mensagens da construção

| Código | Quando | Saída (em português) | Artefato |
|---|---|---|---|
| `0` | Construção concluída para o armazenamento escolhido | Mensagem de conclusão nomeando o armazenamento e os arquivos produzidos | O pacote do armazenamento escolhido |
| `1` | Parâmetro ausente, em forma diferente ou não aceito | Mensagem que nomeia os valores aceitos, sem repetir o valor informado | **Nenhum**: a validação vem antes de escrever qualquer coisa |
| `1` | Falha ao empacotar | Mensagem genérica em português, sem caminho, URL ou segredo | Nenhum artefato parcial: o que tiver sido escrito é removido |

Na construção do armazenamento da nuvem, `pg` é empacotado e `pg-native` — a
dependência **opcional** que nunca é usada — é declarado **externo**, para que o
empacotamento não tente resolvê-lo.

## O que cada construção produz

| Construção | Arquivos | Não contém |
|---|---|---|
| `--banco=sqlite` | `dist/sqlite/servidor.mjs` | O Adapter de PostgreSQL nem `pg` (FR-117, SC-050) |
| `--banco=postgresql` | `dist/postgresql/servidor.mjs` e `dist/postgresql/migrar.mjs` | O Adapter do armazenamento local nem `node:sqlite` (FR-117, SC-050) |

Como só as entradas escolhidas entram no grafo do empacotamento, a exclusão é
**consequência**, e não limpeza posterior. `dist/` continua ignorado pelo Git. A
recusa não produz nada: um pacote só existe para um armazenamento aceito na
construção.

## Comando de migração

| Aspecto | Regra |
|---|---|
| Comando | `npm run migrate:cloud` → `node dist/postgresql/migrar.mjs` |
| Quando roda | Uma vez por implantação, **antes** de subir a aplicação. Nunca no início |
| O que faz | Cria `versao_do_esquema` se não existir, percorre as migrações pendentes e aplica cada uma numa transação sob `pg_advisory_xact_lock` |
| Repetição | Numa base já migrada, percorre a lista, não encontra nada pendente e **não escreve nada** (FR-116, SC-048) |
| Falha | A transação da migração desfaz: nem DDL, nem versão ficam pela metade. Código de saída `1`, mensagem genérica em português mais o SQLSTATE |
| Concorrência | Dois comandos ao mesmo tempo não aplicam a mesma migração duas vezes: a trava consultiva é da transação |
| Código de saída `0` | Mensagem em português com a versão resultante do esquema |
| Saída | Nunca traz a URL, o host, o usuário, a senha nem cadeia de conexão (FR-118) |
| Endpoint | Deve ser apontado para o **endpoint direto** do provedor, e não para o agrupado: DDL com trava consultiva em transação atravessa mal um agrupador |

## Início

| Aspecto | Regra |
|---|---|
| Comando | `npm run start:cloud` → `node dist/postgresql/servidor.mjs` |
| Ordem | Lê e valida `DB_URL` → abre o conjunto de conexões → **confere a versão do esquema** → informa o armazenamento em uso → começa a escutar |
| Linha de início | **Uma**, e apenas ela: `Armazenamento: PostgreSQL (nuvem)` (FR-118, SC-045) |
| Versão do esquema atrasada | **Recusa iniciar**, com mensagem clara em português que nomeia a versão encontrada e a corrente e manda executar o comando de migração; **nada** escuta (FR-121, SC-048) |
| `DB_URL` ausente, vazia ou malformada | Recusa iniciar com mensagem em português que nomeia a variável e nada do valor; a aplicação **não** segue como se o armazenamento existisse (FR-114, SC-046) |
| URL que peça desligar a cifra | Recusa, antes de conectar (FR-115, SC-047) |
| Queda de conexão em uso | A próxima operação abre outra conexão e conclui; com a base indisponível, a operação é reportada como falha e nada passa por concluído (FR-119, FR-044, FR-045, SC-049) |
| Endpoint | O **agrupado** (pooler) do provedor, para muitas conexões curtas |
| Escuta | Apenas no **loopback**, como em `009`; a exposição de rede é de feature posterior de hospedagem |
| Nunca na saída ou no registro | URL, host, usuário, senha, cadeia de conexão, endereço com credencial, versão do servidor, `DB_CA_CERT` |

Mensagens de recusa, em português, sem repetir o valor informado:

```text
Nuvem recusada: a variável de ambiente DB_URL não foi informada.
Nuvem recusada: a variável de ambiente DB_URL não é uma URL de conexão válida.
Nuvem recusada: a URL de DB_URL pede conexão sem verificação de certificado; a conexão cifrada com certificado verificado é obrigatória.
Início recusado: o esquema da base está na versão <encontrada> e a versão corrente é <corrente>. Execute o comando de migração da nuvem antes de iniciar.
```

O comando de migração usa as **três primeiras** mensagens com o prefixo
`Migração recusada:` no lugar de `Nuvem recusada:`, e nunca a última.

## Variáveis de ambiente em execução

| Variável | Padrão | Quem lê | Estado |
|---|---|---|---|
| `DB_URL` | — | **Apenas** `src/entradas/nuvem.ts` e `src/entradas/migrar-nuvem.ts`, no início | **Nova** nesta feature. Segredo: nunca versionada, exibida ou registrada (FR-113, FR-118). Forma: `postgresql://<usuario>:<senha>@<host>/<base>?sslmode=verify-full` — forma de espaço reservado, nunca um endereço real |
| `DB_CA_CERT` | — | A entrada da nuvem, junto de `DB_URL` | **Nova**, opcional: caminho de um PEM que entra como CA do conjunto de conexões. Ausente, a cadeia pública do provedor é usada. É como os testes verificam uma autoridade privada |
| `CAMINHO_DO_BANCO` | `memorizacao.sqlite` | A entrada local, de `009` | Inalterada; **não** é lida pela entrada da nuvem |
| `PORTA` | `3001` | As duas entradas, de `001` | Inalterada |
| `SEGREDO_DAS_SENHAS` | — | Exigida pelo plano da `007-criar-usuario`, ainda não implementada | Planejada; nunca exibida nem registrada |

Nenhuma variável carrega **escolha de armazenamento**: quem escolhe é a construção,
e cada pacote carrega um Adapter só. Um pacote da nuvem iniciado com `DB_URL`
inválida é recusado; o pacote local nunca lê `DB_URL` nem abre conexão a PostgreSQL
(FR-117, SC-050).

## Regra operacional: dois endereços, uma variável

O provedor (Neon) oferece um endereço **agrupado** (pooler) e um **direto**. A
variável é uma só, `DB_URL`, definida pelo operador **por comando**:

| Comando | Endpoint | Por quê |
|---|---|---|
| `npm run start:cloud` | Agrupado | Muitas conexões curtas; a piscina do Adapter se beneficia do agrupador |
| `npm run migrate:cloud` | Direto | DDL com trava consultiva em transação atravessa mal o agrupador |

É regra do operador, não escolha de código: o mesmo nome de variável serve aos dois,
e o valor nunca é versionado (FR-113, FR-118).

## Rastreabilidade

| Requisito | Onde é atendido |
|---|---|
| FR-110 | O Adapter da nuvem entra na construção pela entrada `postgresql`, e nenhum Module conhece o banco |
| FR-113 | `DB_URL` lida apenas pelas entradas da nuvem, no início; a construção não a exige (FR-114) |
| FR-114 | Recusa da construção e do início com mensagem em português que nomeia `DB_URL`, sem repetir o valor |
| FR-115 | Recusa de URL que peça desligar a cifra, antes de conectar |
| FR-116 | `migrate:cloud`: base nova chega à versão corrente, repetição não reaplica |
| FR-117 | `build:cloud` e `start:cloud`; o início local nunca usa PostgreSQL e o da nuvem nunca usa o armazenamento local |
| FR-118 | Saída e registro sem URL, senha ou endereço com credencial; início informa apenas o tipo de armazenamento |
| FR-119 | Queda de conexão: a próxima operação conclui |
| FR-121 | O início não migra: confere a versão e recusa iniciar se estiver atrasada |
| SC-045 | Teste que lê a saída e o registro do início e exige ausência de valor, senha e endereço com credencial |
| SC-046 | Teste de recusa com `DB_URL` ausente, vazia e malformada |
| SC-047 | Teste com CA privado, com URL que peça `sslmode=disable` e contra certificado que não se confirma |
| SC-048 | Teste de migração em base nova, de repetição, de concorrência e de início com esquema atrasado |
| SC-049 | Teste de reconexão com `pg_terminate_backend` |
| SC-050 | Teste que constrói os dois pacotes e confere o que cada um contém e o que cada início usa |
| FR-044, FR-045 | Falha reportada, nada apresentado como concluído, conteúdo informado preservado para nova tentativa |
