---
description: "Task list for Criar Cartões dentro de Baralhos"
---

# Tasks: Criar Cartões dentro de Baralhos

**Input**: Design documents from `specs/025-criar-cartoes-baralho/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required by the constitution. Write each story's tests first and confirm they fail before implementation; every FR maps to a test task below.

**Execution note**: Future code under `backend/`, `frontend/` and `e2e/` must be delegated to DeepSeek workers. The architect owns review, verification and Spec Kit updates.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the existing project for implementation.

No setup tasks are required: Node/React/Fastify, SQLite/PostgreSQL, Vitest, Testing Library, Playwright and the functional prototype already exist. No dependency or project scaffold is added.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Introduce exclusive ownership storage before implementing user stories.

- [X] T001 [P] Add SQLite migration assertions to `backend/tests/acervo/migracoes.test.ts`: version 13 creates an empty `pertencimento` table and preserves every legacy `vinculo`; version 14 stays deferred while any Card lacks ownership and removes `vinculo` only after global completion.
- [X] T002 [P] Add matching PostgreSQL assertions to `backend/tests/armazenamento/postgresql/migracoes.test.ts` for the empty v13 ownership table, preserved legacy rows, pending multi-User deferral, version parity, and final cleanup only after global completion.
- [X] T003 Add SQLite migration 13 to `backend/src/armazenamento/sqlite/migracoes.ts` and `backend/src/armazenamento/sqlite/esquema.ts`; create the empty ownership structure and preserve all legacy `vinculo` rows. Auto-assign singleton links during the per-User transition, not in this DDL migration.
- [X] T004 [P] Add equivalent PostgreSQL migration 13 and conditional version-14 gate to `backend/src/armazenamento/postgresql/migracoes.ts` and `backend/src/armazenamento/postgresql/esquema.ts`.
- [X] T005 [P] Add `Pertencimento` storage types and ownership operation signatures to `backend/src/armazenamento/porta.ts`; keep `Cartao` content limited to `id`, `frente` and `verso`.

**Checkpoint**: both adapters represent no more than one owner per Cartão, while legacy Vínculos remain readable for transition.

---

## Phase 3: User Story 3 - Preservar Cartões existentes na transição (Priority: P1)

**Goal**: Let each User resolve orphaned/shared legacy Cartões without blocking migrated Users or duplicating Agendamentos/Histórico.

**Independent Test**: Resolve one orphaned and one shared Cartão; confirm destination/original choices, copies in prior Baralhos, preserved original history, and no partial changes on failure.

### Tests for User Story 3

- [X] T006 [P] [US3] Test SQLite transition cases in `backend/tests/acervo/migracao-pertencimento.test.ts`: one legacy owner is automatic; an orphan requires a destination; a shared Cartão retains the chosen original and copies to other old Baralhos; copies have no Agendamento/Histórico; duplicate Frentes are numbered; failure rolls back; one pending User prevents global cleanup.
- [X] T007 [P] [US3] Test PostgreSQL transition parity in `backend/tests/armazenamento/postgresql/migracao-pertencimento.test.ts`, including per-User isolation, atomic copy/cleanup, and deferred migration while any User remains pending.
- [X] T008 [P] [US3] Test `Acervo` transition decisions in `backend/tests/acervo/acervo.test.ts`: require one choice per ambiguous Cartão, reject another User's Baralho as absent, preserve original review data, and make retries idempotent.
- [X] T009 [P] [US3] Test authenticated `GET/POST /acervo/transicao-cartoes` in `backend/tests/http/transicao-cartoes.test.ts` for owner scoping, incomplete/foreign choices, conflict and storage failure.
- [X] T010 [P] [US3] Test transitional startup in `backend/tests/entradas/nuvem.test.ts` and `backend/tests/funcao/funcao.test.ts`, plus accessible migration choices in `frontend/tests/transicao-de-cartoes.test.tsx`: v13 serves Users while pending Users are gated to transition; v12 remains rejected; completed Users continue; failures preserve choices and focus.

### Implementation for User Story 3

- [X] T011 [US3] Add per-User legacy-card inspection, automatic singleton-link assignment, choice application and pending-state operations to `ArmazenamentoDoAcervo` in `backend/src/armazenamento/porta.ts`.
- [X] T012 [US3] Implement SQLite per-User transition in `backend/src/armazenamento/sqlite/armazenamento.ts`; apply mappings, copies, Frente counters and legacy-row cleanup in one transaction.
- [X] T013 [US3] Implement equivalent PostgreSQL transition in `backend/src/armazenamento/postgresql/armazenamento.ts`, preserving ownership, rollback and User isolation.
- [X] T014 [US3] Orchestrate transition validation, original selection and copies in `backend/src/acervo/acervo.ts`; expose stable domain errors from `backend/src/acervo/invariantes.ts`.
- [X] T015 [US3] Add `GET/POST /acervo/transicao-cartoes` schemas, authenticated handlers and response mapping in `backend/src/http/rotas.ts`.
- [X] T016 [US3] Add and gate migration 14 in `backend/src/armazenamento/sqlite/migracoes.ts`, `backend/src/armazenamento/sqlite/esquema.ts`, `backend/src/armazenamento/postgresql/migracoes.ts`, `backend/src/armazenamento/postgresql/esquema.ts` and `backend/src/entradas/migrar-nuvem.ts`; keep recorded version 13 and preserve `vinculo` while any User has a Cartão without Pertencimento, report deferral clearly, then apply/drop only after global completion as asserted by T001/T002.
- [X] T017 [US3] Add transition results to `ClienteDoAcervo` and implement them in `frontend/src/acervo-cliente/cliente.ts`, `frontend/src/acervo-cliente/cliente-http.ts`, `frontend/src/acervo-cliente/cliente-em-memoria.ts` and `frontend/src/ui/guarda-de-credencial.ts`.
- [X] T018 [US3] Allow schema v13 transitional startup in `backend/src/entradas/nuvem.ts` and `backend/src/funcao/funcao.ts`, then add `PaginaDaTransicaoDeCartoes` and post-authentication per-User gating in `frontend/src/ui/PaginaDaTransicaoDeCartoes.tsx`, `frontend/src/ui/Aplicacao.tsx` and `frontend/src/ui/navegacao.ts`; keep v12 and older startup rejected and show only Cards requiring choices.
- [X] T019 [US3] Add multi-User migration and recovery coverage to `e2e/transicao-de-cartoes.spec.ts`: one User continues on the new model while another has pending choices; the pending User retains the legacy source and can retry; completion does not expose a partial transition.

**Checkpoint**: every legacy Cartão for the active User has one owner before ordinary acervo actions are exposed; `vinculo` is removed only after global completion.

---

## Phase 4: User Story 1 - Criar Cartões no Baralho escolhido (Priority: P1)

**Goal**: Create and persist Cartões in exactly the Baralho whose detail initiated creation, automatically numbering a colliding Frente.

**Independent Test**: Create in one of two Baralhos, reload, verify ownership, content and automatic numbering; reject invalid content/storage failure without losing the form.

### Tests for User Story 1

- [X] T020 [P] [US1] Test creation and edit invariants through the `Acervo` Interface in `backend/tests/acervo/acervo.test.ts` and `backend/tests/acervo/editar-cartao.test.ts`: owner is mandatory; Frentes compare without case/accent/outer spaces; creation selects next free `(2+)`; suffix over 1,000 characters is rejected; editing a same-Baralho collision is refused without changing persisted Frente/Verso; identical Frentes in different Baralhos are accepted.
- [X] T021 [P] [US1] Test `POST /baralhos/{baralhoId}/cartoes` in `backend/tests/http/criar-cartoes.test.ts` and `PUT /cartoes/{id}` in `backend/tests/http/editar-cartoes.test.ts`: owner/content validation, final numbered Frente, `409 frente_duplicada`, unchanged persisted content and identical Frentes allowed across Baralhos.
- [X] T022 [P] [US1] Test create/edit form behavior in `frontend/tests/formulario-de-cartao.test.tsx` and `frontend/tests/pagina-do-baralho.test.tsx`: invalid content, counted duplicate success, edit collision preserves typed/persisted values, accessible announcement, keyboard focus and retry-preserved values.

### Implementation for User Story 1

- [X] T023 [US1] Implement contextual `criarCartao(baralhoId, dados)` and authoritative `editarCartao(id, frente, verso)` collision validation in `backend/src/acervo/acervo.ts`; normalize Frente keys, number only on create, reject edit conflicts without changing stored values, and return stable `frente_duplicada`.
- [X] T024 [US1] Implement SQLite Cartão+Pertencimento insertion and `frente_chave` update in `backend/src/armazenamento/sqlite/armazenamento.ts`; map same-Baralho unique conflicts to `frente_duplicada`, allow the same Frente in another Baralho, and keep writes atomic.
- [X] T025 [P] [US1] Implement equivalent PostgreSQL insertion/key update and unique-conflict translation in `backend/src/armazenamento/postgresql/armazenamento.ts`; cover edit collisions and cross-Baralho duplicate acceptance in `backend/tests/armazenamento/postgresql/bateria.test.ts`.
- [X] T026 [US1] Add nested create route and request validation plus `409 frente_duplicada` mapping for `PUT /cartoes/{id}` in `backend/src/http/rotas.ts`; remove standalone `POST /cartoes` creation while retaining internal `GET /cartoes` reads.
- [X] T027 [US1] Update `ClienteDoAcervo` create/edit result types, including `frente_duplicada`, in `frontend/src/acervo-cliente/cliente.ts`, `frontend/src/acervo-cliente/cliente-http.ts`, `frontend/src/acervo-cliente/cliente-em-memoria.ts` and `frontend/src/ui/guarda-de-credencial.ts`.
- [X] T028 [US1] Integrate the create form with the owning Baralho and display Frente/Verso in `frontend/src/ui/PaginaDoBaralho.tsx` and `frontend/src/ui/PaginaDoFormularioDeCartao.tsx`; return to detail after success.
- [X] T029 [US1] Extend `e2e/persistencia-de-cartoes.spec.ts` to create in one Baralho, assert absence from another, reload, and verify content and final numbered Frente.

**Checkpoint**: new Cartões are never avulsos, and creation is independently testable on a fresh or transitioned User.

---

## Phase 5: User Story 2 - Consultar e gerenciar Cartões pelo Baralho (Priority: P1)

**Goal**: Make Baralho detail the only main card-list context and preserve edit/delete with the clarified destructive ownership semantics.

**Independent Test**: Open multiple Baralhos, verify contextual Frente/Verso and no global Cartões destination; delete a Cartão/Baralho and check Agendamento removal plus intact history snapshots.

### Tests for User Story 2

- [X] T030 [P] [US2] Test deleting a sole-owner Cartão and non-empty Baralho in `backend/tests/acervo/excluir-cartao.test.ts` and `backend/tests/acervo/excluir-baralho.test.ts`; assert Agendamentos cascade, snapshots remain and failures roll back all records.
- [X] T031 [P] [US2] Test delete authorization/results in `backend/tests/http/excluir-cartoes.test.ts` and `backend/tests/http/excluir-baralhos.test.ts`, including counts and owner isolation.
- [X] T032 [P] [US2] Test contextual management and removed navigation in `frontend/tests/pagina-do-baralho.test.tsx`, `frontend/tests/moldura.test.tsx` and `frontend/tests/navegacao.test.ts`; internal card-list client data remains available.

### Implementation for User Story 2

- [X] T033 [US2] Make SQLite and PostgreSQL `excluirBaralho` transactions delete owned Cartões/Pertencimentos/Agendamentos before the Baralho in `backend/src/armazenamento/sqlite/armazenamento.ts` and `backend/src/armazenamento/postgresql/armazenamento.ts`.
- [X] T034 [US2] Update `Acervo.excluirCartao` and `Acervo.excluirBaralho` in `backend/src/acervo/acervo.ts` to report only committed outcomes and preserve History snapshots.
- [X] T035 [US2] Remove the first-level Cartões destination and standalone route from `frontend/src/ui/Moldura.tsx`, `frontend/src/ui/navegacao.ts` and `frontend/src/ui/Aplicacao.tsx`; remove `frontend/src/ui/PaginaDeCartoes.tsx` while retaining API reads used by temporary-study sources.
- [X] T036 [US2] Replace unlink controls with confirmed Cartão deletion and show Cartão/Agendamento counts in the Baralho deletion dialog in `frontend/src/ui/PaginaDoBaralho.tsx`; preserve focus, failure state and history messaging.
- [X] T037 [US2] Extend `e2e/excluir-cartao-e-baralho.spec.ts` and `e2e/navegacao.spec.ts` to verify cascade deletion, history survival, keyboard confirmation and absence of a global Cartões screen.

**Checkpoint**: every visible Cartão has one owner; no UI action can leave an orphan.

---

## Phase 6: User Story 4 - Salvar uma seleção temporária como Baralho (Priority: P1)

**Goal**: Preserve temporary-study save by copying Cartões into the new Baralho rather than reusing their ownership.

**Independent Test**: Save a selection containing repeated normalized Frentes; originals and Agendamentos remain unchanged, copies are unique and unscheduled, and retry does not duplicate data.

### Tests for User Story 4

- [X] T038 [P] [US4] Test copy planning, numbering, source preservation, no copied Agendamento/Histórico, atomic failure and idempotent retry in `backend/tests/acervo/salvar-selecao.test.ts`.
- [X] T039 [P] [US4] Test `POST /baralhos/de-selecao` copies and retry responses in `backend/tests/http/salvar-selecao.test.ts` and `frontend/tests/acervo-cliente/salvar-selecao.test.ts`.
- [X] T040 [P] [US4] Test temporary save form result in `frontend/tests/salvar-selecao-como-baralho.test.tsx`, including final numbered Frente and retry state.

### Implementation for User Story 4

- [X] T041 [US4] Change `Acervo.salvarSelecaoComoBaralho` in `backend/src/acervo/acervo.ts` to create new Cartão identities in stable selection order, number collisions, retain source data and omit Agendamentos/Histórico on copies.
- [X] T042 [US4] Replace link insertion with atomic copy insertion in `backend/src/armazenamento/porta.ts`, `backend/src/armazenamento/sqlite/armazenamento.ts` and `backend/src/armazenamento/postgresql/armazenamento.ts`; preserve same-ID idempotence.
- [X] T043 [US4] Update save response/error handling in `backend/src/http/rotas.ts`, `frontend/src/acervo-cliente/cliente.ts`, `frontend/src/acervo-cliente/cliente-http.ts`, `frontend/src/acervo-cliente/cliente-em-memoria.ts` and `frontend/src/ui/SalvarSelecaoComoBaralho.tsx`.
- [X] T044 [US4] Extend `e2e/baralho-temporario.spec.ts` to save duplicate-Front selections, verify source Baralhos remain unchanged, and verify retries create one Baralho and one copy per selected identity.

**Checkpoint**: all supported creation/save paths preserve single ownership and unique Frontes.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Close documentation, prototype alignment and repository quality gates.

- [X] T045 [P] Review `README.md` and `README.pt-BR.md`; update statements that describe a standalone Cartões destination or avulso/shared ownership.
- [X] T046 [P] Compare the implementation with `design/criar-cartoes-no-baralho/README.md` and `specs/025-criar-cartoes-baralho/prototipos.md`; refresh `design/criar-cartoes-no-baralho/capturas/` only for accepted visual differences.
- [X] T047 [P] Add product responsive/zoom coverage to `e2e/baralhos-responsividade.spec.ts`: verify contextual Cartão list, create/edit/delete and keyboard flows at 360, 390, 768 and 1440 px, CSS zoom 200%, and no horizontal overflow or control overlap.
- [X] T048 Run `rtk npm run verificar:ci` using `scripts/verificar-ci.mjs`, then append actual results and unverified accessibility checks to `specs/025-criar-cartoes-baralho/research.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no changes; existing dependencies and scripts are reused.
- **Foundational (Phase 2)**: migrations 13 and ownership Interface block all user stories.
- **User stories (Phases 3–6)**: all depend on Foundation. US3 is scheduled first among equal-P1 stories because legacy Users must be reconciled before rollout of the new ownership API.
- **Polish (Phase 7)**: depends on all stories and the visual implementation review.

### User Story Dependencies

- **US3 (P1)**: after Foundation; completes the per-User transition and prevents orphaned legacy data.
- **US1 (P1)**: after Foundation; can be developed alongside US3, but cannot be enabled for pending Users until its migration gate is complete.
- **US2 (P1)**: after Foundation; UI work shares `PaginaDoBaralho.tsx` with US1 and should integrate after that work.
- **US4 (P1)**: after ownership creation from US1 and the new relation storage from Foundation; required before release because the current save path otherwise creates a second owner.

### Requirements-to-Test Traceability

| Requirement | Test tasks |
|---|---|
| FR-388 | T020–T029 |
| FR-389 | T001–T005, T020–T029 |
| FR-390 | T008–T009, T020–T027 |
| FR-391–FR-392 | T022, T028–T029 |
| FR-393–FR-394 | T032, T035–T037 |
| FR-395 | T021–T022, T029 |
| FR-396 | T010, T022, T032, T036–T037, T047 |
| FR-397 | T006–T019 |
| FR-398 | T006–T008, T020–T029, T038–T044 |
| FR-399 | T020–T028 |
| FR-400 | T038–T044 |
| FR-401–FR-402 | T030–T037 |

### Parallel Opportunities

- **Foundation**: T001/T002 migration tests and T003/T004 DDL are independent across SQLite/PostgreSQL; T005 only depends on the Interface design.
- **US3**: T006–T010 tests use separate files; after T011, T012 and T013 adapters can proceed in parallel.
- **US1**: T020–T022 tests can run in parallel; SQLite and PostgreSQL adapters can be delegated separately after the Acervo Interface is settled.
- **US2**: T030–T032 tests can run in parallel; SQLite/PostgreSQL deletion adapters can be delegated separately.
- **US4**: T038–T040 tests can run in parallel; storage adapters can be implemented separately after the Porta contract.
- **Responsividade**: T047 can run independently after the contextual screen is integrated; T048 remains the final repository gate.
- Do not parallelize tasks touching the same `PaginaDoBaralho.tsx`, shared route file or `ArmazenamentoDoAcervo` signature before the preceding Interface task is reviewed.

## Parallel Examples

```text
US3 test batch: T006 + T007 + T008 + T009 + T010
US3 adapters after T011: T012 + T013
US1 test batch: T020 + T021 + T022
US2 test batch: T030 + T031 + T032
US4 test batch: T038 + T039 + T040
```

## Implementation Strategy

### Safe MVP

All four stories are P1 and required for a safe release: US3 protects existing acervos, US1 creates owned Cartões, US2 removes orphan-producing UI operations and updates destructive semantics, and US4 prevents temporary save from creating multiple owners. US1 alone can be demonstrated against a fresh database, but is not a safe production release without US3/US2/US4.

### Incremental Delivery

1. Complete Foundation and test the ownership schema in both adapters.
2. Complete US3; verify legacy choices, per-User isolation and the v14 cleanup condition.
3. Complete US1, then US2; each story must pass its independent tests before proceeding.
4. Complete US4 before enabling temporary save with the new model.
5. Run quickstart scenarios, prototype visual comparison and the repository CI gate.

### Execution Constraints

- Write tests first and verify they fail before implementation.
- Delegate application code in `backend/`, `frontend/` and `e2e/` to DeepSeek workers; review every resulting diff and test claim.
- Each task changes only its listed files; workers do not choose requirements, change architecture or commit.
- `[P]` tasks are parallel only when their files and prerequisites do not overlap.
