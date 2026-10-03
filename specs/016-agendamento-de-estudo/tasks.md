# Tasks: Agendamento de estudo

**Status**: Backlog de implementação futura. Todas as tarefas permanecem pendentes; nenhuma deve ser executada nesta etapa de planejamento.

**Input**: spec.md, plan.md, research.md, data-model.md e contracts/api-agenda.md.
**Tests**: obrigatórios pela constituição e critérios da spec; cada tarefa de código inclui teste observável.
**Organization**: fases por história, com requisitos explicitamente rastreados.

## Phase 1: Setup

- [ ] T1601 Conferir contratos e portão de análise em specs/016-agendamento-de-estudo/plan.md e contracts/api-agenda.md. Requisitos: FR-222–FR-256.

## Phase 2: Foundational

- [ ] T1602 Adicionar tipos/Porta e migração 8 em backend/src/armazenamento/porta.ts e sqlite/postgresql/migracoes.ts; testar upgrade preservando dados. Requisitos: FR-248, FR-250.
  - Restrição da 017 (data-model, seção "Restrição vinda da 017"): toda tabela da Agenda com dados de um Usuário MUST ter `REFERENCES usuario(id) ON DELETE CASCADE`, direto ou pela cadeia de chaves estrangeiras, nos dois Adapters; o teste prova que excluir um Usuário remove a Agenda dele e preserva a de outro.
- [ ] T1603 Adicionar Module Agenda em backend/src/agenda/agenda.ts e tipos.ts, composição Acervo e tipos de cliente em frontend/src/acervo-cliente/cliente.ts. Requisitos: FR-222–FR-256.

## Phase 3: User Story 1 — Programar estudo

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [ ] T1604 [US1] Testar criação, quantidade, dias, overlap e reenvio em backend/tests/agenda/agenda.test.ts. Requisitos: FR-222–FR-226, FR-249, FR-251, SC-095.
- [ ] T1605 [US1] Implementar operações de Rotina e HTTP em backend/src/agenda/agenda.ts e backend/src/http/rotas.ts. Requisitos: FR-222–FR-226.
- [ ] T1606 [US1] Implementar formulário em frontend/src/ui/PaginaDaAgenda.tsx e testes frontend/tests/agenda.test.tsx. Requisitos: FR-222–FR-226, FR-241, FR-242, SC-095.

## Phase 4: User Story 2 — Acompanhar semana

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [ ] T1607 [US2] Testar projeção/estados/totais e janela em backend/tests/agenda/agenda.test.ts. Requisitos: FR-227–FR-230, FR-240, FR-241, SC-096.
- [ ] T1608 [US2] Implementar projeção semanal e rota GET em backend/src/agenda/agenda.ts e backend/src/http/rotas.ts. Requisitos: FR-227–FR-230, FR-240.
- [ ] T1609 [US2] Implementar bloco/calendário em frontend/src/ui/AgendaDeEstudo.tsx, PaginaDeInicio.tsx e estilos.css; testar navegação e falha em frontend/tests/agenda.test.tsx. Requisitos: FR-227–FR-230, FR-240, FR-241, SC-096.

## Phase 5: User Story 3 — Concluir Compromisso

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [ ] T1610 [US3] Testar início, snapshot, reenvio, concorrência e rollback em backend/tests/agenda/conclusao.test.ts e testes dos Adapters. Requisitos: FR-231–FR-236, FR-254, FR-256, SC-097, SC-104.
- [ ] T1611 [US3] Implementar autorização e conclusão atômica em backend/src/agenda/agenda.ts, backend/src/acervo/acervo.ts e ambos armazenamento.ts. Requisitos: FR-231–FR-236, FR-254, FR-256.
- [ ] T1612 [US3] Integrar início autorizado em frontend/src/ui/PaginaDeEstudo.tsx e Aplicacao.tsx; registrar inicioAgendaId e testar em frontend/tests/agenda.test.tsx. Requisitos: FR-231–FR-236, FR-255, FR-256.

## Phase 6: User Story 4 — Segurança e acesso

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [ ] T1613 [US4] Testar isolamento/entrada inválida/CORS/migração em backend/tests/agenda/http.test.ts e suites armazenamento existentes. Requisitos: FR-248, FR-250, FR-254, SC-100.
- [ ] T1614 [US4] Implementar validação HTTP/credencial em backend/src/http/rotas.ts e servidor.ts; Adapters e guarda em frontend/src/acervo-cliente/ e frontend/src/ui/guarda-de-credencial.ts. Requisitos: FR-248–FR-254.
- [ ] T1615 [US4] Testar teclado/foco, geometria e 360/390/768/1440px em e2e/agendamento-de-estudo.spec.ts e frontend/tests/agenda.test.tsx. Requisitos: FR-252, FR-253, FR-255, SC-101, SC-103.

## Phase 7: User Story 5 — Gerenciar Rotinas

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [ ] T1616 [US5] Testar editar/pausar/retomar/excluir/conflito em backend/tests/agenda/agenda.test.ts. Requisitos: FR-237–FR-239, FR-242, FR-249, SC-098.
- [ ] T1617 [US5] Implementar versões/CAS/tombstone nos dois Adapters e backend/src/agenda/agenda.ts. Requisitos: FR-237–FR-239, FR-249.
- [ ] T1618 [US5] Implementar gerenciamento e confirmações em frontend/src/ui/PaginaDaAgenda.tsx, navegacao.ts, Aplicacao.tsx; testar descarte/conflito em frontend/tests/agenda.test.tsx. Requisitos: FR-237–FR-239, FR-242, FR-249, FR-251.

## Phase 8: User Story 6 — Acervo e datas

**Independent Test**: executar a história correspondente de spec.md com dados preparados pela Interface pública; não depende de concluir outras histórias pela UI.

- [ ] T1619 [US6] Testar indisponibilidade, snapshot, meia-noite/fuso/DST e mudança concorrente em backend/tests/agenda/agenda.test.ts e conclusao.test.ts. Requisitos: FR-243–FR-247, SC-099.
- [ ] T1620 [US6] Implementar datas civis, atualização de nomes históricos e configuração capturada em backend/src/agenda/agenda.ts e backend/src/acervo/acervo.ts. Requisitos: FR-243–FR-247.
- [ ] T1621 [US6] Implementar revalidação de hoje e mensagens de indisponibilidade em frontend/src/ui/AgendaDeEstudo.tsx; testar em frontend/tests/agenda.test.tsx. Requisitos: FR-243–FR-247.

## Phase 9: Polish and validation

- [ ] T1622 Testar 100 Rotinas e 2 anos sem leitura de Histórico completo em backend/tests/agenda/desempenho.test.ts. Requisitos: SC-102.
- [ ] T1623 Executar E2E real de criação até conclusão/reabertura em e2e/agendamento-de-estudo.spec.ts. Requisitos: FR-222–FR-256, SC-095–SC-104.
- [ ] T1624 Executar portões backend/frontend/e2e e revisar diff; registrar evidências em specs/016-agendamento-de-estudo/quickstart.md e SESSION.md. Requisitos: Constituição V, VI, IX, X.
- [ ] T1625 Executar converge e registrar cobertura final em specs/016-agendamento-de-estudo/tasks.md e SESSION.md. Requisitos: FR-222–FR-256, SC-095–SC-104.

## Dependencies & Execution Order

Setup → Foundational → histórias P1 → gerenciamento/datas → validação → converge.
Contratos documentais liberam trabalho independente do backend e frontend em
pastas distintas; integração E2E depende dos dois. Não há escrita concorrente
nos mesmos arquivos. Testes de cada história precedem sua implementação.

## Parallel Examples

- US1: testes de domínio backend e formulário frontend após contrato fixado.
- US2: projeção backend e desenho do calendário frontend após tipos fixados.
- US3: conclusão transacional backend e consumo do início frontend.
- US4: testes HTTP de isolamento e teclado frontend.
- US5: CAS/persistência backend e diálogos frontend.
- US6: datas/fuso backend e mensagens/atualização frontend.

## Implementation Strategy

Somente após nova autorização de implementação, workers DeepSeek receberão
um pacote coeso de tarefas e caminhos permitidos;
nenhum worker altera requisitos, faz commit ou declara revisão final. O Arquiteto
só marca tarefa após conferir diff e testes. Começar pelo cadastro/consulta,
acrescentar conclusão e gerenciamento e executar o percurso completo. Não
publicar automaticamente esta branch de trabalho.
