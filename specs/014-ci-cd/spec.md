# Feature Specification: CI e publicação contínua

**Feature Branch**: `main` (decisão do Product Owner)
**Created**: 2026-10-02
**Status**: Implantado — CI e deploy automático ativos desde 2026-10-03
**Input**: "Começar a viabilizar a CI." Publicar o app a cada push na main com CI verde; infraestrutura aplicada pelo operador.

## Clarifications

### Session 2026-10-03

- A estrutura segue `001`; requisitos FR-180 a FR-186 são preservados. Procedimentos e relato do incidente ficam em `quickstart.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Verificar alterações antes da publicação (Priority: P1)

O mantenedor recebe os resultados de backend, frontend e e2e em cada push na main e em cada pull request.

**Why this priority**: a publicação depende da aprovação dos portões de qualidade.

**Independent Test**: abrir um pull request e conferir a execução dos três portões.

**Acceptance Scenarios**:

1. **Given** um pull request ou push na main, **When** a CI inicia, **Then** executa todos os portões do FR-180.
2. **Given** um portão falhando, **When** a CI termina, **Then** a publicação não inicia.

### User Story 2 - Publicar uma alteração aprovada (Priority: P1)

O mantenedor publica o app automaticamente após a aprovação da CI na main.

**Why this priority**: entrega a alteração verificada sem publicação manual do app.

**Independent Test**: acompanhar um push aprovado com deploy habilitado até a conferência de saúde.

**Acceptance Scenarios**:

1. **Given** CI verde na main e deploy habilitado, **When** o deploy executa, **Then** confirma permissões, migra, publica Lambda e SPA, invalida o cache e confere a saúde, nessa ordem.
2. **Given** deploy desabilitado, **When** a CI termina, **Then** a publicação é ignorada sem falhar.
3. **Given** permissão de publicação ausente, **When** o pré-voo executa, **Then** o deploy para antes da migração.
4. **Given** código publicado pelo CD, **When** o operador aplica a infraestrutura, **Then** o código da Lambda não é revertido.

### Edge Cases

- Falha de permissão: interromper antes de tocar no banco.
- CI de pull request aprovada: não publicar em produção.
- Deploy desabilitado: execução ignorada, sem erro.
- Falha após migração: consultar o procedimento e o incidente em `quickstart.md`; rollback automático não é prometido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-180**: Todo push na `main` e todo pull request MUST rodar os portões: backend (typecheck, lint, testes, inclusive PostgreSQL embutido), frontend (lint, testes, build) e e2e (Playwright/Chromium) — `.github/workflows/ci.yml`.
- **FR-181**: Com a CI verde na `main`, o app MUST ser publicado automaticamente, nesta ordem: migração do Neon (endpoint direto), código da Lambda (`update-function-code` + espera), SPA no S3 (`index.html` sem cache) com invalidação do CloudFront, e conferência de `/health` — `.github/workflows/deploy.yml`.
- **FR-182**: O deploy MUST usar credenciais de curta duração por OIDC, numa role com privilégio mínimo (`memorization-deploy-ci`), assumível apenas pelo environment `production` deste repositório (subject imutável). Nenhuma chave AWS é guardada no GitHub.
- **FR-183**: Depois do CD, o Tofu MUST NOT reverter o código da Lambda (`ignore_changes` em `filename`/`source_code_hash`); ele continua dono da configuração.
- **FR-184**: Segredos (URL do Neon) MUST ficar só como secret do environment `production` e MUST NOT aparecer em logs.
- **FR-185**: Enquanto a variável de repositório `DEPLOY_HABILITADO` não for `true`, o workflow de deploy MUST ser ignorado, sem falhar.

- **FR-186**: Antes de migrar, o deploy MUST confirmar as permissões de publicação (dry-run da Lambda e leitura do bucket); sem elas, MUST parar sem tocar no banco.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-182 | Nenhuma chave AWS persistente no GitHub | Inspecionar autenticação OIDC e configuração do workflow |
| FR-183 | Tofu não reverte código publicado | Conferir ignore_changes e plano após publicação |
| FR-184 | Segredos não aparecem em logs | Conferir referências a secrets e ausência de comandos que imprimem valores |
| FR-186 | Falha de permissão não toca no banco | Conferir ordem e interrupção do pré-voo antes da migração |

### Key Entities

- **Execução de CI**: verificação dos portões para uma alteração.
- **Publicação**: atualização do app em produção após CI aprovada na main.
- **Environment production**: delimita credenciais temporárias e segredos usados para publicar.

## Success Criteria *(mandatory)*

- **SC-091**: Toda execução para push na main ou pull request inclui os portões de FR-180.
- **SC-092**: Toda publicação automática depende de CI verde na main e da habilitação do deploy.
- **SC-093**: Nenhuma execução sem permissões de publicação chega à migração.
- **SC-094**: Toda publicação concluída inclui a conferência de saúde de FR-181.

## Invariantes de Domínio

1. CI aprovada na main é condição necessária para publicação automática.
2. A publicação atualiza o app; a infraestrutura permanece sob controle do operador.
3. Credenciais de publicação são temporárias e restritas ao environment production.

## Funcionalidades Adiadas

- Aplicar infraestrutura pela CI (exigiria state remoto).
- Ambientes de homologação.
- Releases por tag.

## Assumptions

- O operador configura IAM, environment, secret e variáveis conforme `quickstart.md`.
- A infraestrutura de `011` já existe e os workflows referenciados são a implementação dos requisitos.
