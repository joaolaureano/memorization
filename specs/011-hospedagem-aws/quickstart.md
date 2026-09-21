# Quickstart — Manual de Operação da Hospedagem na AWS

Este é o **manual de operação** de FR-134 e SC-061: a ordem em que quem opera
provisiona os segredos e os valores, migra o esquema, constrói o pacote da função,
aplica a infraestrutura e publica o SPA — e depois valida e, quando for o caso,
derruba. Ele é escrito para ser seguido **de cima para baixo**.

Nenhum valor real aparece aqui: tudo o que é segredo, endereço ou identificador
está na **forma de espaço reservado** (`<usuario>`, `<senha>`, `<host>`,
`<distribuição>`). Os valores de verdade vivem no `terraform.tfvars` (não
versionado), no ambiente de quem opera e no parameter store
(Princípio VIII, FR-123).

## Pré-requisitos

| O quê | Para quê |
|---|---|
| Node.js 24+ e `npm` | Construir o pacote e o SPA, rodar a verificação local |
| OpenTofu (`tofu`) >= 1.11 | Aplicar a infraestrutura |
| AWS CLI v2 e o perfil do usuário `robot` (`export AWS_PROFILE=robot-account`, se não for o default) | Publicar o SPA e operar a stack |
| A ferramenta `zip` da máquina | A construção do pacote da função |
| Um projeto no **Neon PostgreSQL** que já existe, com a URL de conexão em mãos | O valor de `db_conn_string` |
| `openssl` | **Só** para a verificação local (`npm test`), que gera um CA descartável para o PostgreSQL de teste |

As permissões do usuário `robot` são as do README de infraestrutura, e as
restrições que condicionam o trabalho estão listadas ao fim deste manual.

## Ordem de provisionamento

### 1. Segredos e valores no `terraform.tfvars`

```bash
cd backend/terraform
cp terraform.tfvars.example terraform.tfvars
```

Preencha o `tfvars` (que o `.gitignore` deste diretório mantém fora do
repositório) com a URL de conexão do projeto no Neon, na **forma**:

```hcl
db_conn_string = "postgresql://<usuario>:<senha>@<host>/<base>?sslmode=require"
```

A infraestrutura provisiona **os três** segredos sob o prefixo `SSM_PREFIX`
(`/memorization`), como `SecureString` write-only:

| Parâmetro | De onde vem o valor |
|---|---|
| `/memorization/DB_URL` | O `db_conn_string` do `tfvars` |
| `/memorization/ORIGIN_SECRET` | `random_password` da infraestrutura |
| `/memorization/SEGREDO_DAS_SENHAS` | `random_password` de 64 caracteres, sem caracteres especiais |

O segredo de origem é o que só o CloudFront conhece e injeta nas requisições à
função; o segredo das Senhas é o que o `Identidade` usa para derivar o `hash` — e
ele precisa ser **o mesmo** para uma mesma base, porque trocá-lo torna
inverificáveis os hashes já gravados.

Se algum valor mudou, os segredos só são reescritos quando a **versão** muda, e o
Tofu não percebe sozinho:

```bash
tofu apply -var secrets_version=2                       # um valor de tfvars trocado
tofu apply -replace=random_password.origin_secret -var secrets_version=3   # regerar o segredo de origem
```

### 2. Migrar o esquema, pelo endpoint **direto**

A migração é feita **pelo operador**, antes de publicar, e **nunca** pela função:
a função confere a versão e recusa servir com o esquema atrasado (FR-127,
SC-055). O comando é o de `010`.

```bash
cd backend
export DB_URL='postgresql://<usuario>:<senha>@<host-direto>/<base>?sslmode=require'
npm run migrate:cloud
```

**Endpoints do Neon:** use o **direto** (sem `-pooler`) aqui, porque DDL com trava
consultiva em transação atravessa mal o agrupador. Na execução de nuvem por linha
de comando (`start:cloud`) vale o **agrupado**. O mesmo nome de variável serve aos
dois: o **valor** é que muda, por comando.

A saída informa a versão resultante do esquema, e **nunca** a URL, o host, o
usuário ou a senha. Repetir o comando numa base já migrada não reescreve nada.

### 3. Construir o pacote da função

```bash
cd backend
npm ci
npm run build:lambda
ls -l dist/lambda/lambda.mjs dist-lambda.zip
```

A construção não lê nem exige segredo algum: ela empacota código. O pacote é um
**único** arquivo (`lambda.mjs`), e o zip — no caminho que a infraestrutura
espera, com `lambda.mjs` na **raiz** — é o que o `apply` publica.

Para publicar o SPA de produção mais tarde com o mesmo resultado, o script do
pacote do frontend é `build:aws`:

```bash
cd frontend && npm run build:aws   # VITE_ENDERECO_DA_API=/api
```

### 4. Aplicar a infraestrutura com o pacote

```bash
tofu -chdir=backend/terraform init
tofu -chdir=backend/terraform plan
tofu -chdir=backend/terraform apply \
  -var lambda_package=../dist-lambda.zip \
  -var lambda_handler=lambda.handler
```

Sem `-var lambda_package`, o `apply` volta a publicar a **stub** de
`backend/terraform/stub/index.mjs` — que responde apenas `/health` e devolve `503`
para o resto. O caminho do pacote é relativo ao diretório do `tofu`, e é por isso
que ele aparece como `../dist-lambda.zip`: o arquivo está em `backend/`.

A memória da função é a variável `lambda_memory_mb`, com padrão **1024 MB**. Não é
folga: a Credencial é verificada em **cada** requisição (não há sessão, FR-079), e
a Lambda troca memória por CPU. Se o percentil 95 medido no passo 6 estiver acima
de 1 segundo, o remédio é **elevar a memória** — nunca enfraquecer a derivação da
Senha:

```bash
tofu -chdir=backend/terraform apply -var lambda_package=../dist-lambda.zip \
  -var lambda_handler=lambda.handler -var lambda_memory_mb=1536
```

### 5. Publicar o SPA

```bash
backend/terraform/scripts/deploy-frontend.sh
```

O script constrói o SPA com o endereço da API em `/api` (mesma origem, atrás do
CloudFront), sincroniza no bucket privado, aplica `no-cache` apenas ao
`index.html` e invalida o cache da distribuição. Ele imprime o endereço de
publicação ao final.

### 6. Validar pelo endereço do CloudFront

```bash
tofu -chdir=backend/terraform output -raw app_url          # o endereço do SPA
tofu -chdir=backend/terraform output -raw health_url       # .../health
tofu -chdir=backend/terraform output -raw function_url     # a URL pública da função
```

| Verificação | O que se espera |
|---|---|
| Abrir o endereço do SPA | A interface é servida por HTTPS, e as chamadas do navegador vão para `/api` na **mesma origem** |
| Criar uma conta, Entrar e criar um Cartão e um Baralho | As operações gravam no PostgreSQL e reaparecem depois de recarregar a página (SC-051) |
| `curl -s "$(tofu -chdir=backend/terraform output -raw health_url)"` | `{"status":"ok"}` — a prova de vida responde a API, e não o SPA |
| Chamar a `function_url` **direto**, sem passar pelo CloudFront | `403` com corpo genérico, sem revelar o motivo (SC-053) |
| Chamar `"$(tofu ... output -raw api_url)/cartoes"` sem Credencial | `401` — a guarda de origem não substitui a Credencial |
| Inspecionar as respostas de produção no navegador | **Nenhum** cabeçalho `access-control-*`, e **nenhum** cookie |
| Publicar antes de migrar, numa base atrasada | A função responde `503` genérico e remete ao comando de migração; ela **não** migra (SC-055) |
| `aws logs tail /aws/lambda/memorization-api --since 10m` | Nenhum valor de segredo; falhas de inicialização nomeiam o **parâmetro**, nunca o valor |

**Desempenho (SC-059)**: com a função publicada e uma conta de teste, meça o
percentil 95 das operações simples — por exemplo uma sequência de `GET
/api/cartoes` autenticadas pelo endereço do CloudFront — e confira que ele fica
**abaixo de 1 segundo**. Descarte os primeiros tempos (inícios a frio) e use o log
da função para separar a primeira invocação de cada contêiner. Acima do limite, o
remédio é `lambda_memory_mb`, e não o contrário.

### 7. Derrubar

```bash
aws s3 rm "s3://$(tofu -chdir=backend/terraform output -raw site_bucket)" --recursive
tofu -chdir=backend/terraform destroy
```

O `destroy` leva a distribuição, a função, a Function URL, o bucket, o grupo de
log e os três parâmetros do cofre. O que **não** é removido por ele: a policy
inline do usuário `robot`, que continua anexada e é removida por um perfil admin,
quando for o caso.

## Verificar antes de publicar — sem tocar na AWS

A publicação na AWS é ação do operador; a verificação da entrega é **local**
(FR-133, SC-060).

```bash
cd backend && npm ci && npm test && npm run typecheck && npm run lint
cd backend && npm run build:lambda
cd frontend && npm run build:aws
cd backend/terraform && tofu fmt -check
cd backend/terraform && tofu init -backend=false && tofu validate
```

O que cada uma prova:

| Comando | O que prova |
|---|---|
| `npm test` | O `handler` exportado, exercitado com **eventos sintéticos** de Function URL (payload v2) contra o PostgreSQL **real** com TLS do apoio de teste: 403 sem o segredo de origem e com segredo errado, 200 em `/health` com o segredo, 401 sem Credencial, a ida e volta autenticada de Cartão, Baralho e Vínculo, a inicialização que falha e é **retentada**, a ausência de cabeçalho permissivo de outra origem e a ausência de qualquer valor de segredo na saída e nas respostas |
| `npm run build:lambda` | O pacote é um único empacotamento, o zip tem `lambda.mjs` na raiz, e **não** contém o Adapter do armazenamento local, `node:sqlite` nem o SDK da AWS |
| `npm run build:aws` | O SPA de produção aponta a API para `/api`, e o pacote não contém `127.0.0.1` |
| `tofu fmt -check` e `tofu validate` | O código de infraestrutura passa por formato e validação, sem credenciais AWS, sem state e sem `apply` |

Conferências rápidas do conteúdo, se quiser ver com os próprios olhos:

```bash
cd backend
grep -ri "node:sqlite" dist/lambda/ | wc -l            # esperado: 0
grep -ri "armazenamento/sqlite" dist/lambda/ | wc -l   # esperado: 0
unzip -l dist-lambda.zip                               # esperado: lambda.mjs na raiz
cd frontend && grep -r "127.0.0.1" dist/ | wc -l       # esperado: 0
grep -r "VITE_ENDERECO_DA_API" dist/assets/*.js | head # o endereço é "/api"
```

E a mesma regra de sempre: **nada de segredo versionado**.

```bash
git grep -n "postgresql://" -- . | grep -v "specs/" || echo "nenhum valor versionado"
```

## Restrições do usuário `robot`

O operador aplica com o usuário `robot`, que só opera recursos pelo nome
`memorization-*`. As restrições do README de infraestrutura, repetidas aqui
porque condicionam cada `apply`:

| Restrição | O que fazer |
|---|---|
| A policy é **inline** (`memorization-deploy`), e a fonte da verdade é `backend/terraform/iam/robot-memorization-deploy.json` | Reanexar **sempre** a partir do arquivo versionado (por um perfil admin): `aws iam put-user-policy --profile root --user-name robot --policy-name memorization-deploy --policy-document file://iam/robot-memorization-deploy.json` — `put-user-policy` substitui o documento inteiro |
| As roles criadas exigem **permissions boundary** (`robot-ec2-boundary` por padrão) | Não remova `permissions_boundary` do recurso de role, e lembre que a policy nega `iam:AttachRolePolicy` — as permissões são inline |
| `PassRole` só é liberado para Lambda, com os nomes `memorization-*` | Nada de nome fora do padrão |
| A distribuição é presa à tag `Project` | As `default_tags` do provider são obrigatórias e já existem |
| O state é **local**, no disco de quem aplica | Faça backup do `terraform.tfstate`: perder o state deixa os recursos órfãos na conta |

## Rotação do segredo de conexão do Neon

Se a senha do banco foi exposta em algum momento, ela é rotacionada **no Neon** e
o valor novo entra no `tfvars`, seguido de um `apply` com a versão dos segredos
incrementada — sempre sem colar o valor em documento, terminal compartilhado ou
histórico de conversa:

```bash
# rotacione a senha no console do Neon, atualize db_conn_string no terraform.tfvars
tofu -chdir=backend/terraform apply -var secrets_version=4
# e, para a aplicação em execução, force uma nova inicialização a frio
```

A função lê o cofre no início a frio: um segredo trocado chega à prática na
próxima inicialização.

## Do inventário ao manual

O inventário `aws_pendencias.md` foi o insumo das features `007` a `011` e é
**removido** ao fim desta feature: o que era pendência de código está resolvido, e
o que era nota de operação — derrubar a stack, trocar um segredo, o state local, o
lockfile dos providers e as restrições do usuário `robot` — está **aqui** e no
`backend/terraform/README.md`. Os dois itens que a spec declara obsoletos não têm
substituto: a entrada pelo provedor Google com cookie de sessão e o
`SESSION_SECRET` — a Credencial apresentada em cada requisição é a única forma de
acesso, e o terceiro segredo do cofre é o `SEGREDO_DAS_SENHAS`.

## Referências

- [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/funcao-da-nuvem.md](./contracts/funcao-da-nuvem.md)
- [contracts/pacotes-e-operacao.md](./contracts/pacotes-e-operacao.md)
- [README da infraestrutura](../../backend/terraform/README.md) · [variáveis de exemplo](../../backend/terraform/terraform.tfvars.example)
- [Manual de `010-postgresql-na-nuvem`](../010-postgresql-na-nuvem/quickstart.md), onde está o comando de migração e a conferência do esquema
