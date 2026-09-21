# Contract — Adapter de PostgreSQL

A segunda Implementation da Porta de Armazenamento de `009`. Ela não altera a
Interface: implementa `ArmazenamentoDoAcervo` — e `ArmazenamentoDeUsuarios` quando
a `007` a declarar — sobre PostgreSQL, e é verificada pela **mesma** bateria
compartilhada de cenários (FR-110, FR-111, SC-044).

Vive em `backend/src/armazenamento/postgresql/`. Nenhum Module, rota ou tela
conhece o banco: a Interface declarada em `backend/src/armazenamento/porta.ts`
continua sendo a única coisa que o domínio vê.

## Arquivos e papéis

| Arquivo | Papel |
|---|---|
| `armazenamento.ts` | A fábrica e as operações da Porta: `abrirArmazenamentoPostgresql(configuracao)` abre o conjunto de conexões e devolve `{ armazenamento, encerrar() }`; cada operação é SQL + tradução de SQLSTATE |
| `conexao.ts` | Analisa e valida a URL de conexão, monta a configuração do conjunto de conexões (`ssl` sempre verificado, `ca` opcional) e declara `UrlDeConexaoInvalidaError` |
| `esquema.ts` | Lê a versão registrada em `versao_do_esquema`, confere contra a lista de migrações e aplica as pendentes |
| `migracoes.ts` | O DDL de PostgreSQL, com os mesmos números de versão do Adapter local |

## Fábrica

```text
abrirArmazenamentoPostgresql(configuracao: ConfiguracaoDaConexao)
  -> Promise<{ armazenamento: ArmazenamentoDoAcervo, encerrar(): Promise<void> }>
```

`configuracao` é a URL já validada pela entrada mais o CA opcional. `encerrar()`
fecha o conjunto de conexões. **Nenhuma operação de ciclo de vida entra na
Porta**: abrir, migrar e fechar continuam sendo da Implementation, expostas pela
fábrica — exatamente como em `009`.

A forma devolvida é a que a bateria compartilhada de `009` espera: é por isso que
ela roda contra este Adapter **sem uma linha de edição**.

## Interface implementada

A Interface é a de `009`, sem acréscimo, sem remoção e sem mudança de assinatura —
as mesmas quinze operações do acervo (Cartão, Baralho, Vínculo e as contagens da
elegibilidade derivada), cada uma devolvendo `Promise` e desfecho tipado, e as
duas operações da Porta da identidade quando a `007` for implementada. O contrato
da Interface, dos desfechos e das invariantes está em
[`../../009-porta-de-persistencia/contracts/porta-de-armazenamento.md`](../../009-porta-de-persistencia/contracts/porta-de-armazenamento.md)
e **não** é reescrito aqui.

O que este contrato fixa é o que é de **dialeto e de conexão** — o que o Adapter
esconde atrás daquela Interface.

## Tradução de SQLSTATE — nada de driver atravessa a Porta

| SQLSTATE | Situação | Desfecho devolvido |
|---|---|---|
| `23505` na chave primária de `vinculo` | O par (Cartão, Baralho) já existe | `{ ok: false, erro: "vinculo_duplicado" }` |
| `23505` no índice único de `lower(nome_de_usuario)` | Nome de usuário já cadastrado (Porta da `007`) | `{ ok: false, erro: "nome_de_usuario_existente" }` |
| `23503` | Vínculo com extremidade inexistente | `{ ok: false, erro: "nao_encontrado" }` |
| zero linhas afetadas ou devolvidas | Nada a ler, alterar ou excluir | `{ ok: false, erro: "nao_encontrado" }` |
| qualquer outro | Servidor indisponível, credencial recusada, certificado não verificável, transação abortada, `CHECK` violada por erro de programação | `{ ok: false, erro: "indisponivel" }` |

Regras que valem para toda a tabela:

1. **Nenhum campo do erro do driver atravessa**: nem `message`, nem `detail`, nem
   `hint`, nem `where`, nem `position`. O que atravessa é o desfecho tipado, e a
   frase em português continua sendo do Module (FR-118).
2. **Os dois casos de `23505` são distinguidos pelo nome da restrição**, que é
   estável porque o DDL é nosso.
3. `indisponivel` **nunca** significa concluído: a operação não passou por
   concluída, a falha é reportada e o conteúdo informado continua disponível para
   nova tentativa (FR-044, FR-045).
4. Nenhuma operação da Porta recebe SQL, dialeto, conexão, transação ou escolha de
   armazenamento (FR-110).

## Conjunto de conexões e queda de conexão

| Aspecto | Regra |
|---|---|
| Conjunto | **Um** por Adapter, criado na fábrica, fechado em `encerrar()` |
| Máximo | Pequeno e **fixo** (4). O ajuste do conjunto de conexões está adiado na spec, e nenhuma configuração é exposta |
| Uso | Cada operação toma uma conexão e a devolve; nenhuma conexão ou transação atravessa operações |
| Conexão ociosa encerrada pelo provedor | O ouvinte de `error` **descarta o evento em silêncio** — nada do driver, nada do endereço da base vai para a saída ou o registro — e a conexão sai do conjunto |
| Próxima operação depois da queda | Abre outra conexão e conclui (FR-119, SC-049) |
| Base indisponível | Cada operação devolve `indisponivel`; nada aparece como concluído (FR-044, FR-045, FR-119) |
| Encerramento | `encerrar()` fecha o conjunto; chamado em dobro não falha |

## Configuração de conexão

A URL é lida **apenas** pelas entradas da nuvem, no início do processo
(`backend/src/entradas/nuvem.ts` e `backend/src/entradas/migrar-nuvem.ts`). O
Adapter recebe a configuração pronta e **não lê ambiente** — o que mantém a única
raiz de composição por armazenamento e torna verificável por leitura de imports
que nenhum Module conhece a variável (FR-113).

| Item | Regra | Recusa |
|---|---|---|
| `DB_URL` | Obrigatória na nuvem; analisável; protocolo `postgres:` ou `postgresql:`; host presente; base nomeada | Ausente, vazia, não analisável, protocolo errado, sem host ou sem base → `UrlDeConexaoInvalidaError` |
| Mensagem da recusa | Nomeia **`DB_URL`** e **nenhum pedaço do valor** | Valor informado nunca aparece, nem na saída, nem no registro |
| Efeito | A aplicação **não** segue como se o armazenamento existisse; nenhum servidor escuta (FR-114, SC-046) | — |
| Construção | **Não** exige `DB_URL`: o segredo só é necessário para executar (FR-114) | — |
| `DB_CA_CERT` | Opcional; caminho de um PEM; entra como `ca` no conjunto de conexões | Ausente na nuvem → cadeia **pública** do provedor |
| Diretiva `sslmode` da URL | Ignorada como pedido: o objeto `ssl` é que manda | `disable`, `allow` ou `prefer` → recusa antes de conectar |

Erro declarado:

```text
UrlDeConexaoInvalidaError
  mensagem (português): nomeia DB_URL e o motivo genérico; nunca o valor
```

## Cifra e verificação do certificado

| Aspecto | Regra |
|---|---|
| Cifra | **Sempre** ligada; não há caminho de código que a desligue (FR-115) |
| Verificação | `ssl: { rejectUnauthorized: true }` **sempre**; `sslmode=verify-ca` e `verify-full` são aceitos e, de todo modo, verificados por inteiro (SC-047) |
| CA adicional | `DB_CA_CERT` aponta para um PEM — é assim que os testes exercitam uma autoridade privada sem baixar a verificação |
| URL que peça desligar a cifra | Recusada **antes** de abrir conexão, com mensagem em português que nomeia `DB_URL` e o motivo, sem repetir o valor |
| Certificado que não se confirma | A conexão é recusada pelo driver, chega como `indisponivel` pela Porta e **nenhuma** operação sobre ela passa por concluída — nem no início, nem na migração, nem no atendimento |

## Migrações

| Aspecto | Regra |
|---|---|
| Onde vivem | `backend/src/armazenamento/postgresql/migracoes.ts`: DDL de PostgreSQL para as **mesmas versões** do Adapter local — 1 `cartao`, 2 `baralho`, 3 `vinculo`; 4 e 5 por `007` e `008` |
| Tabela de versão | `versao_do_esquema (versao INTEGER NOT NULL)`, criada sob demanda; a **mesma noção** da tabela do SQLite |
| Quando rodam | **Apenas** pelo comando de migração da nuvem. Nenhuma entrada aplica migração ao subir |
| Como | Uma transação por migração: `BEGIN` → `pg_advisory_xact_lock(<chave fixa>)` → releitura da versão → DDL → elevação da versão → `COMMIT` |
| Dois deployamentos simultâneos | A trava consultiva é da transação e sai no `COMMIT`; a segunda instância encontra a migração aplicada e não a repete |
| Reexecução | Percorre a lista, encontra tudo aplicado e **não escreve nada** (FR-116, SC-048) |
| Falha no meio | A transação desfaz; nem o DDL, nem a versão ficam pela metade |
| Início da nuvem | **Não** migra: lê a versão e **recusa iniciar** com mensagem em português que nomeia as versões quando ela não é a corrente (FR-121) |

Mapeamento de dialeto (detalhado em [`../data-model.md`](../data-model.md)):
`TEXT`, `INTEGER`, `BYTEA` no lugar de `BLOB`, `CHECK` equivalentes com `btrim` e
`char_length`, índice único sobre `lower(nome_de_usuario)` no lugar de
`UNIQUE COLLATE NOCASE`, chave primária composta e cascatas idênticas. O PostgreSQL
sempre respeita chaves estrangeiras: não há pragma equivalente ao do SQLite.

## Saída e falhas

| Momento | O que é escrito | O que nunca é escrito |
|---|---|---|
| Início da nuvem | **Uma** linha, antes de escutar: `Armazenamento: PostgreSQL (nuvem)` (FR-118, SC-045) | URL, host, usuário, senha, cadeia de conexão, endereço com credencial, caminho de arquivo |
| Comando de migração | O resultado da migração e a versão resultante | O mesmo acima |
| Recusa de início | Mensagem em português que nomeia `DB_URL` e o motivo | Nada do valor informado |
| Falha do driver | Mensagem **genérica** em português mais o **SQLSTATE** — um código, e não um valor sensível | `message`, `detail`, `hint` e `where` do driver |
| Conexão ociosa encerrada pelo provedor | Nada | Qualquer coisa |

## O que este Adapter não tem

| Não existe | Motivo |
|---|---|
| Operação nova na Porta | A Interface é a de `009`, e esta feature não a altera (FR-110) |
| Dialeto, SQL, conexão ou transação na assinatura de qualquer operação | Contra FR-110, e é o que mantém a Seam real |
| Configuração de conexão na Interface | A URL é segredo e vive na entrada; a Porta não é lugar de configuração |
| Leitura de variável de ambiente | Só as entradas da nuvem leem `DB_URL` |
| Caminho que desligue a verificação do certificado | Contra FR-115 |
| Ajuste do conjunto de conexões | Adiado na spec; o máximo é fixo e pequeno |
| ORM, construtor de consultas ou executor de SQL livre | Escopo mínimo; o Adapter é feito de operações de domínio |
| Migração no início, migração de dados entre armazenamentos, réplica, cópia de segurança | Adiados na spec |
| Hospedagem, exposição de rede ou segredo de origem | Feature posterior de hospedagem |

## Como é verificado

| Verificação | O que prova |
|---|---|
| A **bateria compartilhada** de `009` chamada com a fábrica de PostgreSQL, em `npm test` | Cem por cento dos cenários da Porta passam contra este Adapter, sem editar a bateria e sem editar nenhum Module (FR-110, FR-111, SC-044) |
| Migração numa base **nova e vazia**, reexecução, dois comandos concorrentes e falha no meio | O esquema chega à versão corrente, nada é reaplicado e nada fica pela metade (FR-116, SC-048) |
| Início com a base **atrasada** | Recusa com mensagem em português, e nada escuta (FR-121) |
| `DB_URL` ausente, vazia, malformada, com protocolo errado e com `sslmode=disable`/`allow`/`prefer` | Recusa nomeando a variável, sem vestígio do valor, e sem abrir conexão (FR-114, FR-115, SC-046, SC-047) |
| Inspeção da saída e do registro do início, com `DB_URL` presente e nos casos de recusa | Apenas o tipo de armazenamento, e nenhum valor, senha ou endereço com credencial (FR-118, SC-045) |
| `pg_terminate_backend` sobre as conexões do backend, seguido de uma operação | A próxima operação restabelece a conexão e conclui; com o servidor parado, a falha é reportada e nada passa por concluído (FR-119, FR-044, FR-045, SC-049) |
| Conexão contra um certificado que não se confirma | A conexão é recusada, sem operação apresentada como concluída (FR-115, SC-047) |
| Varredura dos arquivos versionados | Nenhum contém o valor de `DB_URL`, senha ou chave: as credenciais dos testes são geradas por execução (FR-113, SC-045) |

O PostgreSQL usado nesses testes é **real**, iniciado pelos próprios testes numa
porta livre com diretório de dados temporário, TLS ligado e um CA descartável
gerado em tempo de execução. Nada é pulado em silêncio: se o binário não rodar na
plataforma, a suíte **falha alto**.
