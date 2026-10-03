# Operação da CI e publicação contínua

## Verificação local antes de integrar

Depois de instalar as dependências da raiz, do backend e do frontend, instale
o Gitleaks e execute:

```bash
npm run verificar:ci
```

O comando executa os mesmos portões da CI: Gitleaks, backend, frontend e
Playwright. O `prepare` configura `.githooks/pre-push` neste clone para repetir
a verificação antes de cada push. A execução local não substitui a CI remota.

## Incidente de 2026-10-02 (primeiro deploy)

A role com a boundary `robot-ec2-boundary` migrou o Neon (esquema 6), mas foi barrada em `lambda:UpdateFunctionCode`; a função antiga recusou o esquema novo e a produção ficou em 503 por alguns minutos. Restaurado publicando o código pelo operador (`robot`). Ações: FR-186 (pré-voo) e role da CI reaplicada sem boundary por perfil admin.

## Configuração única do operador

1. `tofu -chdir=backend/terraform apply` (cria a role; toca IAM, então é o operador quem roda). Se a boundary `robot-ec2-boundary` barrar o deploy: aplicar com perfil admin e `-var ci_permissions_boundary_name=""`.
2. GitHub → environment `production` restrito à `main`; secret `DB_URL` (endpoint direto do Neon); variáveis `AWS_ROLE_ARN` (output `ci_role_arn`), `SITE_BUCKET`, `DISTRIBUTION_ID`, `HEALTH_URL` (outputs do Tofu).
