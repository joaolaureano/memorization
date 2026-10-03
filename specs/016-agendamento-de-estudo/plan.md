# Implementation Plan: Agendamento de estudo

**Branch**: `wip/outro-agente-cartao-fixo` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)
**Input**: spec 016; escopo explicitamente limitado ao planejamento pelo Product Owner.
**Status**: Implementação autorizada pelo Product Owner em 2026-10-03 (branch `implementacao-016-018`).

## Summary

Adicionar programação semanal persistente por Baralho, calendário e resumo em
Início, gerenciamento e conclusão vinculada a Sessão autorizada. O Module Agenda
esconde projeção temporal, concorrência e comprovação de início. A conclusão usa
a mesma transação do Registro e da repetição espaçada.

## Technical Context

**Language/Version**: TypeScript, Node >=24 e React 19 existentes.
**Primary Dependencies**: Fastify, Zod, React e Vite já instalados; sem novas dependências.
**Storage**: SQLite local e PostgreSQL; migração 8 aditiva nos dois Adapters.
**Testing**: Vitest, contratos de armazenamento em SQLite/PostgreSQL embutido e Playwright/Chromium.
**Target Platform**: aplicação web e backend local/nuvem já suportados.
**Project Type**: SPA + serviço HTTP autenticado.
**Performance Goals**: SC-102, semana e resumo em até 1 s com 100 Rotinas e 2 anos anteriores.
**Constraints**: dono em todas as operações, conclusão atômica, idempotência,
nenhuma mudança de algoritmo e nenhum dado de demonstração no produto.
**Scale/Scope**: seis histórias, FR-222–FR-256, SC-095–SC-104.

## Constitution Check

- Spec/clarify: A-01–A-07 são premissas documentadas que sustentam o plano, sem confirmação individual presumida.
- Domínio: três termos em CONTEXT.md; não alterar Cartão/Vínculo.
- Depth: Agenda oferece operações de negócio; cálculos e armazenamento ficam
  escondidos. Interface testada pelos mesmos callers da aplicação.
- Seam: ArmazenamentoDoAcervo tem SQLite/PostgreSQL; ClienteDoAcervo tem HTTP/em
  memória. Nenhuma interface para Implementation única.
- Atomicidade: início autorizado, Registro e conclusão conferidos por dono.
- Auditabilidade (Constituição II, v3.0.0): decisões em research.md e notas dos artefatos; ações e verificações nas mensagens de commit, sem segredos.
- Delegação futura: se a implementação for autorizada, fontes backend/frontend/e2e
  deverão ser produzidas por workers DeepSeek. Nenhum worker de código é iniciado nesta etapa.
- Qualidade: análise sem CRITICAL e checklist revisado antes de implement;
  conclusão somente após tarefas e convergência verificadas.
- Após o desenho: os mesmos portões se mantêm; não há exceção técnica exigida.

## Project Structure

### Documentation (this feature)

spec.md, plan.md, research.md, data-model.md, contracts/api-agenda.md,
quickstart.md, tasks.md e checklists/requirements.md.

### Source Code (repository root)

- backend/src/agenda/agenda.ts e tipos.ts: regras e projeção da Agenda.
- backend/src/acervo/acervo.ts: composição e integração do Registro.
- backend/src/armazenamento/porta.ts e sqlite/postgresql/: operações e migração.
- backend/src/http/rotas.ts e servidor.ts: rotas, validação e CORS autenticado.
- backend/tests/agenda/: domínio e HTTP; suites dos dois Adapters para persistência.
- frontend/src/acervo-cliente/: tipos, HTTP, Adapter em memória e testes.
- frontend/src/ui/AgendaDeEstudo.tsx e PaginaDaAgenda.tsx: semana e gerenciamento.
- frontend/src/ui/PaginaDeEstudo.tsx: início autorizado opcional e Registro associado.
- frontend/src/ui/Aplicacao.tsx, navegacao.ts, guarda-de-credencial.ts e estilos.css.
- frontend/tests/agenda*.test.tsx e e2e/agendamento-de-estudo.spec.ts.

**Structure Decision**: estender os Modules existentes; a regra temporal fica em
Agenda, nunca duplicada na tela. Tipos de transporte do frontend são explícitos,
sem importação de código servidor para o bundle.

## Execução e validação

1. Contratos/modelo e portão de análise.
2. Backend completo com persistência, migração e conclusão atômica; testes de domínio e transporte.
3. Frontend e Adapter em memória conforme contrato; testes de UI/cliente.
4. E2E real com SQLite, isolamento e responsividade; corrigir regressões.
5. Revisão de cada diff, rastreabilidade e converge; executar typecheck/lint/test/build pertinentes.

A geração de autorização de início não equivale a Registro de sessão nem guarda
resultados parciais; Sessão interrompida continua sem Registro. Merge em main,
push e publicação dependem de pedido explícito do Product Owner.

## Complexity Tracking

Nenhuma violação justificada necessária. O histórico de versões e o snapshot de
início são exigidos por FR-238/245/254; uma configuração atual isolada não os atende.

## Refinamentos da revisão de integração

- O limite legado de 1000 Itens por Registro não pode impedir Todos os Cartões
  da Agenda. Para início autorizado, a quantidade máxima válida é o snapshot
  autorizado; manter o limite anterior nos Registros sem início da Agenda.
- Cálculo de Agendamentos na conclusão da Agenda deve usar o estado atual sob
  serialização da gravação por Usuário; não aplicar um vetor calculado antes da
  transação concorrente. A Porta pode receber uma função de domínio para
  calcular os Agendamentos a partir das leituras da mesma transação. Ela não
  expõe conexão, SQL ou driver ao Module. SQLite usa transação imediata e
  PostgreSQL bloqueio por Usuário, com reenvio idempotente antes de recalcular.
