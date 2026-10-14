---
description: "Task list for CI e publicação contínua"
---

# Tasks: CI e publicação contínua

**Input**: Design documents from `specs/014-ci-cd/`  
**Status**: Implantado desde 2026-10-03 (conforme `spec.md`). Este registro recompõe a rastreabilidade documental; não representa trabalho de implementação novo.

## Verificação e publicação

- [X] T001 Conferir os portões de backend, frontend e e2e em `.github/workflows/ci.yml` (FR-180, SC-091); evidência: execução verde da CI descrita no estado implantado.
- [X] T002 Conferir que o deploy depende de CI verde na `main`, publica na ordem exigida e verifica saúde (`.github/workflows/deploy.yml`) (FR-181, SC-092, SC-094); evidência: fluxo implantado conforme `quickstart.md`.
- [X] T003 Conferir autenticação OIDC, restrição ao environment `production` e ausência de chaves persistentes (FR-182); evidência: inspeção da configuração do workflow e da role.
- [X] T004 Conferir que Tofu não reverte o pacote publicado da Lambda (FR-183); evidência: `ignore_changes` na configuração Terraform.
- [X] T005 Conferir que a URL do Neon vem somente de secret e não é impressa nos logs (FR-184); evidência: inspeção do workflow.
- [X] T006 Conferir que deploy desabilitado é ignorado sem falhar (FR-185); evidência: condição do job de deploy.
- [X] T007 Conferir pré-voo de permissões antes da migração e interrupção em caso de falha (FR-186, SC-093); evidência: ordem e condições do workflow, com procedimento/incidente em `quickstart.md`.
