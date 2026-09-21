# Contract — Pacotes e Operação

Os scripts, o alvo de construção da função, o zip no caminho que a infraestrutura
espera, as duas mudanças de infraestrutura, os portões de qualidade e a ordem de
provisionamento do manual. Base: `backend/package.json` e
`backend/scripts/construir.mjs` (de `009` e `010`), `frontend/package.json` e a
infraestrutura de `backend/terraform` já mesclada. Nada do que os contratos
anteriores fixam é alterado: esta feature **acrescenta** linhas, um script e duas
mudanças de infraestrutura.

## Scripts

| Script | Comando | O que é | Origem |
|---|---|---|---|
| `typecheck` | `tsc --noEmit` | Verificação de tipos | `001`, inalterado |
| `test` | `vitest run` | Suítes de `001` a `011`, incluindo o handler com eventos sintéticos e o conteúdo do pacote da função | `001`, ampliado |
| `lint` | `eslint .` | Análise estática | `001`, inalterado |
| `build` | `node scripts/construir.mjs` | Construção por armazenamento. **Exige** `--banco=<valor>`; sem ele, recusa | `009`, com a tabela de entradas ampliada |
| `build:local` | `node scripts/construir.mjs --banco=sqlite` | Pacote da execução local | `009`, inalterado |
| `start:local` | `node dist/sqlite/servidor.mjs` | Início local, a partir do pacote | `009`, inalterado |
| `dev` | `node --watch src/entradas/local.ts` | Início local sem construir | `009`, inalterado |
| `build:cloud` | `node scripts/construir.mjs --banco=postgresql` | Pacotes da execução de nuvem e do comando de migração | `010`, inalterado |
| `migrate:cloud` | `node dist/postgresql/migrar.mjs` | O comando de migração da nuvem, do operador | `010`, inalterado |
| `start:cloud` | `node dist/postgresql/servidor.mjs` | Início da nuvem a partir do pacote, contra PostgreSQL | `010`, inalterado |
| `build:lambda` | `node scripts/construir.mjs --banco=lambda` | **O pacote da função e o zip** | **nova** (FR-130) |

No frontend:

| Script | Comando | O que é | Origem |
|---|---|---|---|
| `build` | `tsc --noEmit && vite build` | Construção com o endereço da API padrão (`http://127.0.0.1:3001`) | `001`, inalterado |
| `build:aws` | `VITE_ENDERECO_DA_API=/api npm run build` | **A construção de produção**, com o endereço da API em `/api` | **nova** (FR-129) |

Na infraestrutura:

| Script | O que é | Origem |
|---|---|---|
| `scripts/deploy-frontend.sh` | Constrói o SPA com `npm run build:aws`, sincroniza no bucket privado e invalida o cache | Já existente; passa a chamar o script do pacote |
| `scripts/build-lambda.sh` | **Chamada fina** a `npm run build:lambda` em `backend/`, seguida do lembrete do comando de `apply` | De `010`; deixa de ter esbuild próprio (FR-130) |

## A tabela de entradas da construção

| Armazenamento | Entrada empacotada | Pacotes |
|---|---|---|
| `sqlite` | `src/entradas/local.ts` | `dist/sqlite/servidor.mjs` |
| `postgresql` | `src/entradas/nuvem.ts`, `src/entradas/migrar-nuvem.ts` | `dist/postgresql/servidor.mjs`, `dist/postgresql/migrar.mjs` |
| `lambda` | `src/entradas/lambda.ts` | `dist/lambda/lambda.mjs` **e** `dist-lambda.zip` |

Regras herdadas de `009`, sem mudança:

| Aspecto | Regra |
|---|---|
| Forma aceita do parâmetro | Exatamente `--banco=<valor>`, com **um** argumento |
| Valores aceitos | As chaves da tabela. Nesta feature: **`sqlite`**, **`postgresql`** e **`lambda`** |
| Parâmetro ausente, em forma diferente (`--banco`, `--banco sqlite`, valor vazio) ou valor não aceito | Recusa, com a **mesma** mensagem |
| Valor com aparência de credencial | Recusado como não aceito; a mensagem **não repete o valor informado** |
| Lista de aceitos | **Derivada** da tabela: acrescentar um alvo é acrescentar uma entrada, e nada mais |
| Segredo no momento da construção | **Nenhum** é lido nem exigido: o segredo só é necessário para executar |

A mensagem de recusa passa a listar os três valores:

```text
Construção recusada. Informe --banco=<valor>, com um dos valores aceitos: sqlite, postgresql, lambda.
```

**Por que um terceiro valor, e não um segundo parâmetro:** a alternativa
`--banco=postgresql --alvo=lambda` quebraria as três propriedades acima — a forma
exata, o número de argumentos e a lista derivada — e faria a validação ter dois
eixos e a mensagem deixar de ser consequência da tabela. O alvo da função é, na
prática, um pacote a mais de um armazenamento, e a escolha continua sendo uma só.

## Códigos de saída e mensagens da construção

| Código | Quando | Saída (em português) | Artefato |
|---|---|---|---|
| `0` | Construção concluída para o alvo escolhido | Mensagem de conclusão nomeando o alvo e os arquivos produzidos | Os pacotes do alvo |
| `1` | Parâmetro ausente, em forma diferente ou não aceito | Mensagem que nomeia os valores aceitos, sem repetir o valor informado | **Nenhum**: a validação vem antes de escrever qualquer coisa |
| `1` | Falha ao empacotar ou ao zipar | Mensagem genérica em português, sem caminho, URL ou segredo | Nenhum artefato parcial: o diretório do alvo e o zip são removidos |

## O que cada construção produz

| Construção | Arquivos | Não contém |
|---|---|---|
| `--banco=sqlite` | `dist/sqlite/servidor.mjs` | O Adapter de PostgreSQL, `pg` nem a entrada da função (FR-130) |
| `--banco=postgresql` | `dist/postgresql/servidor.mjs`, `dist/postgresql/migrar.mjs` | O Adapter do armazenamento local, `node:sqlite` nem a entrada da função |
| `--banco=lambda` | `dist/lambda/lambda.mjs` e `dist-lambda.zip` | O Adapter do armazenamento local nem `node:sqlite` (FR-130); e o SDK da AWS, que é **externo** |

Como só as entradas escolhidas entram no grafo do empacotamento, a exclusão é
**consequência**, e não limpeza posterior. `dist/` e `dist-lambda*` são ignorados
pelo Git.

## O pacote da função

| Aspecto | Regra |
|---|---|
| Arquivo | `dist/lambda/lambda.mjs` — **um único** empacotamento ESM |
| Plataforma, alvo e formato | `--platform=node --target=node24 --format=esm`, com o banner de `createRequire` (as dependências em CJS pedem `require`) |
| Externos | `node:*`, `pg-native` (a opcional do `pg` que nunca é usada) e **`@aws-sdk/*`** (o SDK v3 vem no runtime `nodejs24.x`) |
| Zip | `backend/dist-lambda.zip`, com **`lambda.mjs` na raiz**, pela ferramenta `zip` da máquina |
| Por que a raiz | O handler da infraestrutura é `lambda.handler`: ele nomeia o **arquivo** `lambda.mjs` na raiz do pacote, e isso é contrato, não conveniência |
| Runtime da infraestrutura | `nodejs24.x`, `arm64`, **1024 MB**, timeout de 30 s, sem VPC |
| Segredo | Nenhum no pacote: os três vêm do cofre, no início a frio |
| `.gitignore` | `dist-lambda*` na raiz do repositório: o que era ignore local passa a ser versionado |

## Mudanças de infraestrutura

Duas, em OpenTofu, e nada além delas.

| Arquivo | Mudança | Requisito |
|---|---|---|
| `ssm.tf` | `random_password.segredo_das_senhas` (`length = 64`, `special = false`) e a chave `SEGREDO_DAS_SENHAS` em `local.secrets`, sob o mesmo prefixo de `DB_URL` e `ORIGIN_SECRET` | FR-124 |
| `variables.tf` | Nova variável `lambda_memory_mb`, padrão **1024** | FR-132 |
| `lambda.tf` | `memory_size = var.lambda_memory_mb` no lugar do número fixo de 512 MB | FR-132 |
| `ssm.tf` (comentário) | O comentário que hoje reserva o lugar do `SESSION_SECRET` "quando houver autenticação" passa a nomear o `SEGREDO_DAS_SENHAS` da `007` | FR-124: não há sessão, e o comentário não pode apontar para um inventário que sai do repositório |

| Aspecto | Regra |
|---|---|
| Permissão de leitura | Sem mudança: a policy `lambda_read_secrets` é montada a partir do **mapa** de parâmetros, de modo que o terceiro segredo entra na permissão por consequência |
| Segredos | Continuam `SecureString` **write-only** (`value_wo` com `value_wo_version = var.secrets_version`): o valor não fica no state, e trocá-lo exige incrementar `secrets_version` |
| Segredo de origem | Continua regerado com `-replace=random_password.origin_secret` |
| O que **não** muda | Runtime, arquitetura, timeout, ausência de VPC, Function URL `NONE`, as duas permissões de invocação, o behavior de `/api/*` com o prefixo removido na borda, `/health` roteado para a função, o bucket privado, a retenção de log de 14 dias, o certificado `*.cloudfront.net` e a ausência de reescrita de 403/404 |

## Variáveis de ambiente da função

| Variável | Valor | Segredo? |
|---|---|---|
| `SSM_PREFIX` | `/memorization` | Não |
| `NODE_ENV` | `production` | Não |

**Nenhum** segredo entra no ambiente da função: variável de ambiente é legível para
quem descreva a função, e a URL de conexão carrega a senha do banco. `DB_URL`,
`DB_CA_CERT` e `SEGREDO_DAS_SENHAS` continuam valendo para as execuções que rodam
na máquina de quem opera (`start:cloud`, `migrate:cloud`, `dev`), e **não** para a
função.

## Portões de qualidade

| Portão | Comando | O que mede |
|---|---|---|
| Testes | `npm test` (em `backend/`) | As suítes de `001` a `011`, incluindo o handler com eventos sintéticos contra o PostgreSQL real de teste e o conteúdo do pacote da função |
| Tipos | `npm run typecheck` (em `backend/`) | `tsc --noEmit`, com os tipos do SDK da AWS disponíveis pela devDependency |
| Estilo | `npm run lint` (em `backend/` e `frontend/`) | Análise estática |
| Construção da função | `npm run build:lambda` (em `backend/`) | O pacote e o zip, com o conteúdo conferido |
| Construção do SPA | `npm run build:aws` (em `frontend/`) | O SPA de produção com `/api` |
| Formato da infraestrutura | `tofu fmt -check` (em `backend/terraform/`) | Formato canônico dos `.tf` |
| Validade da infraestrutura | `tofu init -backend=false && tofu validate` (em `backend/terraform/`) | Sintaxe, variáveis, recursos e referências — **sem** credencial AWS, **sem** state e **sem** `apply` |

Conferências dos comandos no manual: [`../quickstart.md`](../quickstart.md).

## Restrições do usuário `robot` (do README de infraestrutura)

O operador aplica com o perfil do usuário `robot`, que **só** opera recursos pelo
nome `memorization-*`. As restrições que o manual repete, porque condicionam a
aplicação:

| Restrição | Consequência |
|---|---|
| A policy é **inline** (`memorization-deploy`), anexada por um perfil admin a partir de `iam/robot-memorization-deploy.json`, que é a fonte da verdade | `put-user-policy` substitui o documento **inteiro**: reanexar sempre a partir do arquivo versionado, nunca de um trecho |
| As roles criadas exigem **permissions boundary** (`robot-ec2-boundary` por padrão) | Um recurso novo que crie role precisa respeitar o boundary, e a policy do robot nega `iam:AttachRolePolicy` — as permissões são **inline** |
| `PassRole` é liberado apenas para Lambda, com os nomes `memorization-*` | Nada de role fora do padrão de nome |
| A distribuição é presa à tag `Project` | As tags `default_tags` do provider são obrigatórias, e já existem |
| O state é **local**, no disco de quem aplica | Fazer backup: sem state, os recursos ficam órfãos na conta |

## Ordem de provisionamento — o manual

A ordem é a de FR-134 e SC-061, e está detalhada em
[`../quickstart.md`](../quickstart.md):

1. os **segredos e os valores** no `terraform.tfvars` (a conexão do Neon) e a
   aplicação da infraestrutura que provisiona os três parâmetros — ou o `apply`
   com `secrets_version` incrementado depois de um valor trocado;
2. a **migração** do esquema, com `npm run migrate:cloud` apontando para o
   endpoint **direto** do Neon;
3. a **construção** do pacote, com `npm run build:lambda`;
4. a **aplicação** da infraestrutura com o pacote, por
   `tofu apply -var lambda_package=../dist-lambda.zip -var lambda_handler=lambda.handler`;
5. a **publicação do SPA**, por `backend/terraform/scripts/deploy-frontend.sh`;
6. a **validação** pelo endereço do CloudFront: entrar com a Credencial e criar um
   Cartão;
7. a **derrubada**, quando for o caso.

O que **não** é exigido da verificação automatizada, porque exige credenciais AWS
ou a função publicada: `tofu plan`, `tofu apply`, o `aws s3 sync` do SPA e a
medição do percentil 95 na função — esta última descrita no manual (FR-132, SC-059).

## Rastreabilidade

| Requisito | Onde é atendido |
|---|---|
| FR-122 | O pacote da função e a infraestrutura que o publica; nenhum porto é aberto |
| FR-123 | Os três parâmetros no mapa de segredos, write-only, lidos por uma Seam |
| FR-124 | `SEGREDO_DAS_SENHAS` provisionado ao lado dos outros dois, sob o mesmo prefixo |
| FR-125 | A guarda de origem da função; o pacote não tem caminho que a desligue |
| FR-126 | A inicialização descartável da fábrica da função |
| FR-127 | `migrate:cloud` (**antes**) e a conferência de versão da função (que nunca migra) |
| FR-128 | Nenhuma resposta de produção com cabeçalho permissivo; a execução local continua com ele |
| FR-129 | `build:aws` e o script de publicação |
| FR-130 | `build:lambda`, o zip no caminho esperado, e a exclusividade de cada pacote |
| FR-131 | A Credencial atravessa o CloudFront em cada requisição; o pacote não cria sessão |
| FR-132 | `lambda_memory_mb` de 1024 e a medição documentada |
| FR-133 | Os portões de qualidade: testes locais e as duas conferências do OpenTofu |
| FR-134 | A ordem de provisionamento no manual, com espaços reservados e sem valores reais |
| FR-044, FR-045 | A indisponibilidade continua chegando como desfecho `indisponivel`, e nada passa por concluído |
| FR-078, FR-079, FR-077 | Nenhum valor de Senha ou de segredo em saída, registro ou resposta; nenhuma sessão, cookie ou token |
| FR-120 | A exclusividade de pacotes por armazenamento, medida em cada construção |
| SC-051 a SC-061 | A verificação local do handler, o conteúdo do pacote, as conferências da infraestrutura e a ordem do manual |
