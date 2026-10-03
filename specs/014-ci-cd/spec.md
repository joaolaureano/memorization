# Feature Specification: CI e publicação contínua

**Created**: 2026-10-02 | **Status**: Implantado — CI e deploy automático ativos desde 2026-10-03

**Input**: "Começar a viabilizar a CI." Decisões do PO: deploy automático a cada push na `main` com CI verde; o deploy publica **só o app** (a infraestrutura continua aplicada à mão); a CI entra direto na `main`.

## Requisitos

- **FR-180**: Todo push na `main` e todo pull request MUST rodar os portões: backend (typecheck, lint, testes, inclusive PostgreSQL embutido), frontend (lint, testes, build) e e2e (Playwright/Chromium) — `.github/workflows/ci.yml`.
- **FR-181**: Com a CI verde na `main`, o app MUST ser publicado automaticamente, nesta ordem: migração do Neon (endpoint direto), código da Lambda (`update-function-code` + espera), SPA no S3 (`index.html` sem cache) com invalidação do CloudFront, e conferência de `/health` — `.github/workflows/deploy.yml`.
- **FR-182**: O deploy MUST usar credenciais de curta duração por OIDC, numa role com privilégio mínimo (`memorization-deploy-ci`), assumível apenas pelo environment `production` deste repositório (subject imutável). Nenhuma chave AWS é guardada no GitHub.
- **FR-183**: Depois do CD, o Tofu MUST NOT reverter o código da Lambda (`ignore_changes` em `filename`/`source_code_hash`); ele continua dono da configuração.
- **FR-184**: Segredos (URL do Neon) MUST ficar só como secret do environment `production` e MUST NOT aparecer em logs.
- **FR-185**: Enquanto a variável de repositório `DEPLOY_HABILITADO` não for `true`, o workflow de deploy MUST ser ignorado, sem falhar.

- **FR-186**: Antes de migrar, o deploy MUST confirmar as permissões de publicação (dry-run da Lambda e leitura do bucket); sem elas, MUST parar sem tocar no banco.

## Incidente de 2026-10-02 (primeiro deploy)

A role com a boundary `robot-ec2-boundary` migrou o Neon (esquema 6), mas foi barrada em `lambda:UpdateFunctionCode`; a função antiga recusou o esquema novo e a produção ficou em 503 por alguns minutos. Restaurado publicando o código pelo operador (`robot`). Ações: FR-186 (pré-voo) e role da CI reaplicada sem boundary por perfil admin.

## Configuração única do operador

1. `tofu -chdir=backend/terraform apply` (cria a role; toca IAM, então é o operador quem roda). Se a boundary `robot-ec2-boundary` barrar o deploy: aplicar com perfil admin e `-var ci_permissions_boundary_name=""`.
2. GitHub → environment `production` restrito à `main`; secret `DB_URL` (endpoint direto do Neon); variáveis `AWS_ROLE_ARN` (output `ci_role_arn`), `SITE_BUCKET`, `DISTRIBUTION_ID`, `HEALTH_URL` (outputs do Tofu).

## Fora do escopo

Aplicar infraestrutura pela CI (exigiria state remoto), ambientes de homologação, releases por tag.
