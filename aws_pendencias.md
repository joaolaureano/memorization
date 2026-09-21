# Pendências de AWS

Estado verificado em **2026-09-21**.

A infraestrutura de `backend/terraform/` (OpenTofu) provisiona CloudFront, S3
privado, SSM Parameter Store e uma **Lambda stub** que responde só `/health`. O
app ainda não está pronto para a nuvem: usa SQLite, escuta só no loopback e não
tem handler de Lambda nem autenticação.

A seção 0 é o que precisa ser conferido **antes de mesclar** a
infraestrutura. Os itens 1 a 10 são insumo para futuras features do Spec Kit
(spec, plan, tasks). É inventário de trabalho, não registro de decisão — o
histórico decisório continua em `SESSION.md`.

---

## 0. Conferir antes de mesclar

A branch toca só `aws_pendencias.md` e `backend/terraform/` — nada em
`backend/src`, `frontend/src` ou configuração compartilhada. Ainda assim:

| # | Conferir | Por quê | Como |
|---|---|---|---|
| 0.1 | **Stack destruída — feito** | aplicada em 2026-09-21 só para validação e destruída no mesmo dia (18 recursos; Lambda, bucket, SSM e distribuição conferidos como inexistentes). A policy inline `memorization-deploy` do robot continua anexada | para subir de novo: `tofu apply`; para remover a permissão: `aws iam delete-user-policy --user-name robot --policy-name memorization-deploy` (perfil admin) |
| 0.2 | **Teste com o backend real não foi feito** | o `tofu apply` com um pacote de teste (Fastify atual + SQLite em `/tmp` + `select` no Neon) foi bloqueado pelo classificador de permissões do Claude Code. Validado só com a stub | aplicar um pacote de teste e exercitar criar/listar cartão, 404 da API e conexão Neon via CloudFront |
| 0.3 | **Terraform agora versionado** | a decisão inicial era "igual ao cineclube" (fora do git); foi revista para o merge levar a infra. State e tfvars continuam fora (`backend/terraform/.gitignore`) | confirmar a decisão; `git check-ignore backend/terraform/terraform.tfvars` deve casar |
| 0.4 | **State local** | `terraform.tfstate` existe só na máquina do operador; outro clone não enxerga a stack | decidir backend remoto (S3 + lockfile) ou manter um único operador |
| 0.5 | **Credencial do Neon exposta** | a connection string com senha (`neondb_owner`) foi colada na conversa de trabalho | rotacionar a senha no Neon e reaplicar com `-var secrets_version=2` |
| 0.6 | **Policy do robot** | `backend/terraform/iam/robot-memorization-deploy.json` é a fonte da verdade, anexada inline como `memorization-deploy`. A primeira versão anexada divergia do arquivo (faltava `cloudfront:CreateFunction`) | reanexar com `put-user-policy` a partir do arquivo; revisar escopo (nomes `memorization-*`, boundary obrigatório, `PassRole` só para Lambda, distribuição presa à tag `Project`) |
| 0.7 | **`backend/package-lock.json` fora do git** | o `.gitignore_global` do desenvolvedor ignora `package-lock.json`; só o do frontend foi forçado. Sem ele não há `npm ci` reprodutível no build da Lambda | versionar com `git add -f backend/package-lock.json` (decisão do agente de código) |
| 0.8 | **`dist-lambda/` e `dist-lambda.zip`** | gerados por `scripts/build-lambda.sh` em `backend/`, ignorados só localmente (`.git/info/exclude`) | acrescentar ao `.gitignore` versionado quando o script migrar para `backend/` |
| 0.9 | **Provider AWS `~> 6.0`** | o 5.x (usado no cineclube) não aceita `nodejs24.x` | `tofu init` usa o `.terraform.lock.hcl` versionado (aws 6.65.0) |
| 0.10 | **Sem fallback 403/404 → `index.html`** | diferente do cineclube, de propósito: o SPA roteia por hash e o fallback reescreveria os 404 da API | ver item 9 se o roteamento mudar |
| 0.11 | **`channel_binding=require` na connection string** | o endpoint informado é o `-pooler` com channel binding; o driver escolhido no item 2 precisa suportar SCRAM-SHA-256-PLUS | testar a conexão com o driver antes de trocar o SQLite |

### Validado em 2026-09-21

| Verificação | Resultado |
|---|---|
| `tofu validate` / `tofu plan` | ok, 18 recursos, nenhum segredo em texto no plano |
| `tofu apply` com o user `robot` | ok, após anexar a policy `memorization-deploy` |
| `GET /health` via CloudFront | 200 `{"status":"ok"}` — CloudFront → Function URL → Lambda → SSM |
| Function URL direta, sem `x-origin-secret` | 403 `Proibido` |
| `GET /api/cartoes` via CloudFront | 503 da stub — prefixo `/api` removido na borda |
| `scripts/deploy-frontend.sh` | SPA servida em HTTPS; bundle sem `127.0.0.1`, chamadas em `/api/...` |
| Backend real + Neon | **não executado** (0.2) |

---

## 1. Autenticação — bloqueante

**Contexto.** A aplicação não autentica ninguém; é por isso que
`assegurarEscutaLocal` (`backend/src/http/servidor.ts`) aborta fora do
loopback. Atrás do CloudFront, qualquer um com a URL leria, editaria e
excluiria todos os cartões e baralhos.

**O que falta.** Escolher e especificar o mecanismo:

- Google Identity Services → backend verifica o `id_token` no JWKS do Google →
  emite sessão própria HS256 em cookie `HttpOnly; Secure; SameSite=Lax`
  (referência: `~/Coding/cineclube`, seção "Autenticação de verdade" do README);
- ou, como paliativo, basic auth numa CloudFront Function — só infra, sem
  identidade por usuário.

**Contrato com a infra.** `SESSION_SECRET` como SecureString em
`/memorization/SESSION_SECRET` (ver item 10). Com Google, o header
`Cross-Origin-Opener-Policy: same-origin-allow-popups` volta a ser necessário
no CloudFront, como no cineclube.

**A API real não deve ser publicada antes deste item.**

---

## 2. Persistência em Postgres (Neon)

**Contexto.** O backend usa `node:sqlite` com a API síncrona `DatabaseSync`
(`backend/src/acervo/esquema.ts`, `acervo.ts`) e grava num arquivo local. Na
Lambda o disco é efêmero, então o dado precisa ir para o Neon.

**O que falta.**

- trocar `node:sqlite` por um driver Postgres (`pg`); a Interface do `Acervo`
  passa a ser assíncrona;
- migrações de `backend/src/acervo/migracoes.ts` no dialeto Postgres;
- ler a connection string de `DB_URL`, com TLS e certificado verificado
  (o do Neon encadeia numa CA pública);
- decidir endpoint direto ou `-pooler` em runtime; migrations (DDL) pelo direto;
- reconexão em container morno: o pooler do Neon fecha conexões ociosas
  (referência: `ensureDatabase` em `~/Coding/cineclube/backend/src/lambda.ts`).

**Contrato com a infra.** `DB_URL` em `/memorization/DB_URL` (SecureString).
Valor vem de `db_conn_string` no `terraform.tfvars`.

---

## 3. Handler Lambda

**Contexto.** A infra roda `backend/terraform/stub/index.mjs` no lugar da API.

**O que falta.** Criar `backend/src/lambda.ts`:

- Fastify via `@fastify/aws-lambda`, app montado **fora** do handler para
  reaproveitar containers mornos;
- no cold start, ler do SSM (`GetParameters`, `WithDecryption`) os nomes
  `${SSM_PREFIX}/DB_URL` e `${SSM_PREFIX}/ORIGIN_SECRET` **antes** de importar
  módulos que capturam `process.env`;
- recusar com 403 quem chegar sem `x-origin-secret` correto
  (`timingSafeEqual`, conferindo tamanho antes);
- descartar a promise de inicialização em cache quando ela falhar.

**Contrato com a infra.** Export `handler` em `lambda.mjs`
(`lambda_handler = "lambda.handler"`). Evento no formato Function URL
(payload v2). A stub já implementa o mesmo protocolo de segredo de origem.

---

## 4. Escuta fora do loopback

**Contexto.** `iniciarServidor` chama `listen` e `assegurarEscutaLocal`; isso é
do modo local.

**O que falta.** O caminho Lambda usa `criarServidor` + `registrarRotasDe*` sem
`listen`. A garantia de loopback continua valendo para `src/index.ts`.

**Contrato com a infra.** Nenhum porto é aberto; a Function URL entrega o
evento ao handler.

---

## 5. Build e empacotamento

**Contexto.** O backend roda `.ts` direto no Node 24; o runtime da Lambda não.

**O que falta.** Bundle esbuild (`--platform=node --target=node24
--format=esm`, `@aws-sdk/*` externo) num único `lambda.mjs`. O esqueleto
existe em `backend/terraform/scripts/build-lambda.sh` e deve migrar para
`backend/` versionado quando o handler existir.

**Contrato com a infra.** Zip em `backend/dist-lambda.zip`, aplicado com
`tofu apply -var lambda_package=../dist-lambda.zip`. Runtime `nodejs24.x`,
`arm64` — dependências nativas precisam de build para arm64.

---

## 6. CORS

**Contexto.** As rotas respondem `access-control-allow-origin: *` porque o
frontend local roda em outra origem.

**O que falta.** Em produção SPA e API dividem o domínio do CloudFront; o CORS
aberto deixa de ser necessário e, com sessão em cookie, deve ser restrito ou
removido fora do modo local.

**Contrato com a infra.** Mesma origem: `https://<distribuição>.cloudfront.net`.

---

## 7. Setup do projeto Neon via CLI — não executado

**Contexto.** Passos pedidos pelo Product Owner, registrados aqui para
execução futura. Criam arquivos na raiz do repositório (`neon.ts`,
configuração do link), então precisam ser coordenados com o trabalho de
código em andamento.

**O que falta.**

```bash
npm i -g neon@latest && neon login
neon skills -y
neon mcp -y
neon link --project-id winter-credit-44370372 --branch production -y
neon config init
```

Atualizar `neon.ts`:

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({});
```

```bash
neon deploy
```

**Contrato com a infra.** A connection string da branch `production` desse
projeto é o valor de `db_conn_string` em `backend/terraform/terraform.tfvars`.

---

## 8. Contrato com a infra (resumo)

| Tema | Valor |
|---|---|
| Rotas da API | servidas em `/api/*`; o prefixo é removido na borda (CloudFront Function), o backend mantém `/cartoes`, `/baralhos` |
| Health check | `/health`, na raiz, vai direto à Lambda |
| Frontend | build com `VITE_ENDERECO_DA_API=/api` (`scripts/deploy-frontend.sh`) |
| Roteamento do SPA | por `location.hash`; não há fallback 403/404 → `index.html`, então 404 da API chega intacto |
| Ambiente da Lambda | `SSM_PREFIX=/memorization`, `NODE_ENV=production` |
| Segredos (SecureString) | `/memorization/DB_URL`, `/memorization/ORIGIN_SECRET` |
| Runtime | `nodejs24.x`, `arm64`, 512 MB, timeout 30 s, sem VPC |
| Pacote | `lambda_package` + `lambda_handler` (padrão `lambda.handler`) |

---

## 9. Roteamento por caminho no SPA

**Contexto.** Hoje não há fallback de SPA porque a navegação usa hash. O
cineclube reescreve 403/404 para `index.html` via `custom_error_response`, mas
isso vale para todas as origens e transformaria os 404 da API em 200.

**O que falta.** Se o frontend passar a rotear por caminho (History API), a
infra precisa de uma CloudFront Function só no behavior padrão, reescrevendo
caminhos sem extensão para `/index.html` — nunca `custom_error_response`.

---

## 10. `SESSION_SECRET`

**Contexto.** Depende do item 1.

**O que falta.** Acrescentar `SESSION_SECRET` (um `random_password` de 64) ao
`local.secrets` em `backend/terraform/ssm.tf` e aplicar com `secrets_version`
incrementado.

---

## Estado da infra

Destruída em 2026-09-21 após a validação — nenhum recurso `memorization-*` na
conta, state vazio. Continua existindo fora do Terraform apenas a policy inline
`memorization-deploy` do user `robot` (0.6).

| Recurso | Nome | Estado |
|---|---|---|
| CloudFront distribution + Function | `memorization-app`, `memorization-api-prefix` | destruído |
| S3 bucket | `memorization-site-019593222321` | destruído |
| Lambda + Function URL + role + log group | `memorization-api` | destruído |
| SSM | `/memorization/DB_URL`, `/memorization/ORIGIN_SECRET` | destruído |
| Policy inline do robot | `memorization-deploy` | anexada (fora do Terraform) |
