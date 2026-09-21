# Phase 1 — Data Model: Hospedagem na AWS

Modelo derivado da spec e do glossário canônico de `CONTEXT.md`.

## Escopo desta feature

Esta feature **não acrescenta entidade de domínio**: nenhuma tabela nova, nenhuma
coluna nova, nenhum campo novo de tela, nenhuma migração nova. O esquema da base
continua sendo o de `009` a `008` — Cartão, Baralho, Vínculo, Usuário e Dono —, e
quem o migra continua sendo o comando de migração da nuvem de `010`, pelo
operador.

O que esta feature tem de **modelo** são duas coisas, e nenhuma delas é dado de
domínio:

- os **três segredos** que a função da nuvem lê no início a frio, onde cada um
  vive e qual é a regra que o mantém fora do repositório (FR-123, FR-124);
- o **estado da inicialização** de um contêiner da função, que é memória de
  processo e não linha de tabela — e cuja regra central é que a falha **não** é
  memorizada (FR-126).

## O "dado" desta feature: os três segredos e os seus lugares

Os segredos não são do domínio e **não** entram na base: eles vivem no parameter
store, sob o prefixo configurado em `SSM_PREFIX` (a infraestrutura usa
`/memorization`), como `SecureString` write-only. É o mesmo modelo de `010` para a
URL de conexão, estendido ao terceiro segredo e ao segredo de origem.

| Segredo | Nome no cofre | Origem do valor | Quem lê | Regra |
|---|---|---|---|---|
| URL de conexão do banco | `${SSM_PREFIX}/DB_URL` | `db_conn_string` do `terraform.tfvars`, do projeto no Neon | A função, no início a frio, e o comando de migração de `010`, pelo ambiente | Nunca versionada, exibida, registrada ou devolvida; validada por `010` antes de qualquer conexão |
| Segredo de origem | `${SSM_PREFIX}/ORIGIN_SECRET` | `random_password` da infraestrutura (48 caracteres) | A função, no início a frio | Só o CloudFront o conhece e o injeta; nunca sai em resposta, registro ou saída; comparação em tempo constante |
| Segredo do servidor das Senhas | `${SSM_PREFIX}/SEGREDO_DAS_SENHAS` | **Novo** em `011`: `random_password` de 64 caracteres, `special = false` | A função, no início a frio | Alimenta o `Identidade` da `007`; nunca versionado, exibido, registrado ou devolvido; trocá-lo torna inverificáveis os hashes já gravados |

Propriedades comuns aos três, e que são o modelo:

| Propriedade | Regra |
|---|---|
| Tipo no cofre | `SecureString`, sempre |
| Escrita | **Write-only** (`value_wo` no OpenTofu, com `value_wo_version = var.secrets_version`): o valor é enviado à AWS e **não** fica no `terraform.tfstate`, que é texto plano no disco de quem aplica |
| Troca | Incrementar `secrets_version` e aplicar; para o segredo de origem, também `-replace=random_password.origin_secret` |
| Acesso | A policy da função é montada a partir do **mapa** de parâmetros (`[for p in aws_ssm_parameter.secret : p.arn]`), de modo que o terceiro segredo entra na permissão sem uma linha de IAM nova (FR-124) |
| Leitura | **Uma** chamada `GetParameters` com os três nomes e `WithDecryption: true`, no início a frio (FR-123) |
| Ausência | Nome ausente, ou devolvido vazio, é **falha de inicialização** com mensagem em português que **nomeia o parâmetro** e **nenhum valor** |
| Nunca | Em arquivo versionado, em variável de ambiente da função, na saída, no registro ou em resposta — inclusive quando a leitura falhar (FR-123, FR-078) |

Em variável de ambiente da função ficam **apenas** valores que não são segredo:

| Variável | Valor | Quem a define |
|---|---|---|
| `SSM_PREFIX` | `/memorization` | A infraestrutura (já existente) |
| `NODE_ENV` | `production` | A infraestrutura (já existente) |

`DB_URL`, `DB_CA_CERT` e `SEGREDO_DAS_SENHAS` **não** aparecem no ambiente da
função: na nuvem os três vêm do cofre, e a cadeia pública do provedor dispensa o
CA. A execução local e a da nuvem por linha de comando continuam lendo
`SEGREDO_DAS_SENHAS` e `DB_URL` do ambiente, como em `007` e `010`.

## O estado da inicialização de um contêiner

Não é entidade durável: é o estado em memória de **um** contêiner da função, e a
regra que o governa é a de FR-126.

| Estado | Como se chega | O que uma requisição recebe | O que acontece na requisição seguinte |
|---|---|---|---|
| **Não iniciado** | Primeira invocação no contêiner | A inicialização é executada; se concluir, a requisição é atendida | — |
| **Em curso** | Duas invocações concorrentes no mesmo contêiner | As duas **compartilham** a mesma promise: nada é inicializado duas vezes | — |
| **Pronto** | Inicialização concluída | A aplicação já montada é reaproveitada; nenhum SSM e nenhum TLS de novo | Continua pronto enquanto o contêiner viver |
| **Falhou** | Qualquer etapa recusada (segredo ausente, banco inalcançável, esquema atrasado) | `503` com corpo genérico em português; o motivo não é revelado, e a mensagem que nomeia o parâmetro fica no registro | A promise é **descartada**: a inicialização é tentada **de novo** |

O que o estado **nunca** é: uma falha memorizada. Enquanto a causa durar, todas as
requisições falham; corrigida a causa — o parâmetro publicado, o banco de volta, a
migração aplicada — a requisição seguinte inicializa e atende, sem que o contêiner
precise ser reciclado (FR-126, SC-054).

## Entidades do domínio — as mesmas, sem uma coluna nova

| Entidade | Estado nesta feature |
|---|---|
| **Cartão**, **Baralho**, **Vínculo** | Sem alteração: as mesmas tabelas, as mesmas regras de conteúdo e as mesmas cascatas de `009` e `010` |
| **Usuário** | Sem alteração: `nome_de_usuario`, `sal`, `hash` e `parametros`, com o índice único de `lower(nome_de_usuario)` de `010` |
| **Dono** | Sem alteração: `usuario_id` em `cartao` e em `baralho`, com cascata |
| **Senha** | Continua **não** sendo guardada: só o resultado do scrypt com os parâmetros. O que esta feature acrescenta é que a **verificação** acontece na função, uma vez por requisição (FR-132) |
| **Credencial** | Continua existindo apenas na memória da página aberta e atravessa o CloudFront em cada requisição; **nenhuma** tabela, coluna, cabeçalho de retorno ou cookie a guarda (FR-079, FR-131) |

Migração do esquema: **nenhuma** nova. A versão corrente continua sendo a lista de
migrações conhecida pelo binário, e a função apenas **confere** — esquema atrasado
é recusa de inicialização (FR-127).

## Correspondência com as invariantes da spec

| Invariante da spec | Onde é garantida |
|---|---|
| A API roda como função da nuvem, sem escutar porto algum, e o loopback da execução local permanece | A fábrica monta o servidor **sem** `listen`; `assegurarEscutaLocal` continua valendo nas entradas que escutam (FR-122) |
| Os três segredos vivem no cofre sob o prefixo; nenhum valor é versionado, exibido, registrado ou devolvido | `SecureString` write-only no parameter store; leitura por uma Seam; mensagens que nomeiam o parâmetro e nunca o valor; testes com valores gerados por execução (FR-123, FR-124, SC-052) |
| Toda requisição sem o segredo de origem correto é recusada com 403, sem motivo, em tempo constante | A guarda de origem é o primeiro `onRequest`, com conferência de tamanho e `timingSafeEqual` (FR-125, SC-053) |
| A função nunca migra; o operador migra e a função recusa esquema desatrasado | A fábrica usa a conferência de versão de `010` e nunca `aplicarMigracoes` (FR-127, SC-055) |
| A falha de inicialização não é memorizada | A promise é guardada fora do handler e **descartada** no `catch` (FR-126, SC-054) |
| Em produção a política permissiva de outra origem não é enviada; na execução local ela continua | Opção de `criarServidor`, desligada apenas pela entrada da função (FR-128, SC-056) |
| A Credencial é a única forma de acesso: sem sessão, cookie ou token | Nenhuma entidade de sessão, nenhum `Set-Cookie`, nenhum valor reutilizável entre requisições (FR-079, FR-131, SC-058) |
| Nenhuma tela, campo ou ação nova para quem usa | Nenhuma alteração em `frontend/src`, exceto a configuração de construção (SC-057) |
| Operação não persistida nunca aparece como concluída; falha reportada preserva o conteúdo | Os desfechos da Porta de `010` não mudam; a indisponibilidade continua chegando como `indisponivel` (FR-044, FR-045) |

## O que este modelo deliberadamente não tem

- Tabela, coluna ou arquivo que guarde **qualquer valor de segredo**: o cofre é o
  único lugar, e os valores são write-only (FR-123).
- Entidade, tabela, coluna ou cabeçalho de **sessão, cookie ou token**: fora da
  spec, por FR-079 e FR-131.
- Tabela de migração além de `versao_do_esquema`, e nenhuma migração nova: a
  função não migra (FR-127).
- Coluna, cache ou registro do **resultado da verificação da Senha**: guardá-lo
  seria sessão — o custo por requisição é o preço de não ter sessão (FR-132).
- Registro de **qual contêiner** inicializou, quando, ou quantas vezes: o estado
  é memória de processo, e o registro de invocação é do serviço de nuvem.
- Tabela, coluna ou campo para o **segredo de origem**: ele não é dado, é
  configuração de borda, e só o CloudFront o conhece.
- Tabela de auditoria de acesso, de tentativas de Entrar ou de recusas por
  origem: adiadas na spec, e o registro do serviço de nuvem já as mostra.
- Múltiplos ambientes, homologação, réplica de leitura ou cópia de segurança:
  adiados na spec.
- Migração de dados entre o arquivo local e a base em nuvem: adiada na spec; os
  dois armazenamentos não se falam.
