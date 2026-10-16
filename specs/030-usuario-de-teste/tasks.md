---
description: "Task list for Usuário de Teste"
---

# Tasks: Usuário de Teste

**Input**: Design documents from `specs/030-usuario-de-teste/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/http.md`, `contracts/ui.md`, `contracts/acervo-de-demonstracao.md`, `quickstart.md`

**Tests**: Required by the constitution (Principles V and IX). Write each story's tests first and confirm they fail before implementing. Every FR maps to at least one test task (see Traceability).

**Execution note**: Workers (Haiku 5.5):
- use Edit only, never Write;
- never delete or weaken tests;
- never commit;
- report `it(` counts before and after;
- never run in parallel on the same file, shared batteries included.

The architect creates every new file **with a one-line comment** before a worker edits it (Edit cannot fill an empty file), reviews every diff and runs the gates (Principle VI). New product text goes to `frontend/src/idioma/{pt,en,es}.ts`. New server messages are English ASCII.

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 (Architect, not product code) Prepare the demo media and credits (research R8, `contracts/acervo-de-demonstracao.md`):
  - 10 flag PNGs, at most 640 px wide, from public-domain "Flag of …" pages on Wikimedia Commons, in `backend/demonstracao/midia/bandeiras/{pais}.png`;
  - 10 bird recordings under CC0, CC BY or CC BY-SA (never NC/ND), trimmed to at most 20 s, mono MP3 or OGG with no embedded metadata, in `backend/demonstracao/midia/passaros/{nome}.{ext}`;
  - `backend/demonstracao/creditos.json`: one entry per file with `baralho`, `cartao`, `titulo`, `autor`, `licenca` (SPDX) and `fonte` (URL).

  If a listed species has no permitted recording, swap it for another common Brazilian bird and record the swap in research.
- [X] T002 [P] Build the standalone prototype `design/conta-de-teste/` (`index.html`, `app.js`, `style.css`, `README.md`, `verificar.mjs`), reusing `../../frontend/src/estilos.css` and following `contracts/ui.md`:
  - "Entrar como Teste" on the sign-in screen, with the preparing state and the limit message;
  - the header badge;
  - the Início/Perfil notice with the credits link and the credits dialog;
  - the Perfil without account actions;
  - the Sair confirmation;
  - the "Sua Conta de teste terminou" notice;
  - a PT/EN/ES toggle.

  `verificar.mjs` checks 360/390/768/1440 px and 200% zoom, no horizontal scroll, and keyboard operation.
- [X] T003 [P] Infrastructure (research R4):
  - `backend/terraform/agendamento.tf` with `aws_cloudwatch_event_rule` `rate(15 minutes)`, an `aws_cloudwatch_event_target` pointing to `aws_lambda_function.api`, and an `aws_lambda_permission` for `events.amazonaws.com`;
  - `backend/terraform/iam/robot-agendamento.json` with the deploy-user permissions on that rule (`events:PutRule`, `PutTargets`, `DescribeRule`, `DeleteRule`, `RemoveTargets`, `ListTagsForResource`, `TagResource`, `ListTargetsByRule`) and on the function (`lambda:AddPermission`, `RemovePermission`, `GetPolicy`);
  - a section in `backend/terraform/README.md` with the `aws iam put-user-policy` command for the PO.

  Gate: `tofu -chdir=backend/terraform validate`.
- [X] T004 [P] Include `backend/demonstracao/` (media and `creditos.json`) in the Lambda package and the local bundle in `backend/scripts/construir.mjs`. Extend `backend/tests/armazenamento/construcao.test.ts` (or the build test that already inspects the zip) to assert that the zip contains `demonstracao/creditos.json` and the 20 media files.

**Checkpoint**: media and credits committed; the prototype verifier passes; `tofu validate` green; the package contains the demo files.

---

## Phase 2: Foundational (Blocking Prerequisites)

### Tests first

- [X] T005 [P] Migration 22 tests in `backend/tests/acervo/migracao-conta-de-teste.test.ts` (new) and in the PostgreSQL migration suite:
  - on a v21 database with users, decks and history, v22 adds `usuario.conta_de_teste_em` (`TIMESTAMPTZ NULL`; SQLite `TEXT NULL`) as NULL for every existing user;
  - it creates the partial index;
  - it creates the table `criacao_de_conta_de_teste (origem_hmac TEXT NOT NULL, criado_em TIMESTAMPTZ NOT NULL)` with an index on `(origem_hmac, criado_em)`;
  - it adds `usuario.envios_de_teste INTEGER NOT NULL DEFAULT 0`, 0 for every existing user;
  - no existing data changes.
- [X] T006 [P] Port battery tests in `backend/tests/armazenamento/bateria-da-porta.ts`, new section "Conta de teste", on SQLite and PostgreSQL:
  - `criarContaDeTeste(conta)` inserts the user, Decks, Cards, Registros, Agendamentos, Rotina and Preferências in one transaction; a failure injected by a duplicate id rolls back everything, with no user and no decks;
  - `listarContasDeTesteEncerradas(agora, limite)` returns test accounts created more than 2 min ago with no `acesso_temporario` whose `expira_em > agora`, oldest first; it never returns real accounts or test accounts with a valid Acesso;
  - `registrarCriacaoDeContaDeTeste`, `contarCriacoes(origem, desde)`, `contarContasDeTesteAtivas(agora)` (not ended, with a valid Acesso) and `esquecerCriacoesAntigas(antesDe)`;
  - `registrarEnvioDeTeste(usuarioId, 30)` accepts 30 calls and refuses the 31st without incrementing; with two concurrent calls at 29, exactly one is accepted (atomic conditional increment);
  - `excluirUsuario` of a user whose Cards point to `demonstracao/…` keys does **not** enqueue those keys, but does enqueue the user's own media and `exportacoes/{id}`.
- [X] T007 [P] Store battery in `backend/tests/midia/bateria-do-armazem.ts` (Disk always; S3 with the emulator): `gravarArquivoFixo("demonstracao/x.png", bytes, "image/png")` stores the bytes, readable by `ler` and `enderecoDeLeitura`; any key outside `demonstracao/` is refused. In `backend/tests/acervo/cartao-com-imagem.test.ts` (where `processarFilaDeMidia` is exercised): a queued `demonstracao/…` key is never removed.
- [X] T008 [P] Module tests in `backend/tests/demonstracao/conteudo.test.ts` (new), through the `demonstracao` Interface:
  - the content matches `contracts/acervo-de-demonstracao.md`: Inglês 12, Bandeiras 10, Cantos de pássaros 10, each between 8 and 15 Cards (FR-493); types; alt texts "Bandeira de {país}"; Message "Que pássaro é este?";
  - every media file exists, is recognized by `detectarFormato`/`reconhecerAudio`, comes out identical after metadata removal, and respects the 026/028 limits (FR-492);
  - every media file has a complete credit with a license in {public domain, CC0-1.0, CC-BY-*, CC-BY-SA-*} and none with NC/ND (FR-494, SC-197).
- [X] T009 [P] Tests in `backend/tests/demonstracao/conta.test.ts` (new) for `montarContaDeTeste({ agora, fuso, gerarId, credencialAleatoria })`:
  - two builds differ only in ids, password material and dates (FR-491, SC-193);
  - Nome de usuário `teste-` + 16 `[a-z0-9]`;
  - every media key starts with `demonstracao/`;
  - history: 5 Sessions on days −6, −5, −3, −2, −1 in the given `fuso`, with mixed Avaliações;
  - Agendamentos from `aplicarAvaliacoes` with at least 3 due today or earlier and at least 3 in the future (FR-504), for `fuso` "Pacific/Kiritimati", "America/Sao_Paulo" and "Pacific/Pago_Pago", at 00:05 and 23:55 local;
  - Rotina "Inglês", days 1..7, `quantidade: null`; default Preferências.
- [X] T010 [P] Refusal tests in `backend/tests/mensagens/recusas.test.ts`: the codes `conta_de_teste`, `contas_de_teste_esgotadas_na_origem`, `contas_de_teste_indisponiveis` and `limite_de_midia_da_conta_de_teste`, with English ASCII messages from `contracts/http.md`.

### Implementation

- [X] T011 Migration 22 in `backend/src/armazenamento/sqlite/migracoes.ts` and `backend/src/armazenamento/postgresql/migracoes.ts`, exactly as `data-model.md`, including `usuario.envios_de_teste INTEGER NOT NULL DEFAULT 0`. Makes T005 pass.
- [X] T012 Port operations in `backend/src/armazenamento/porta.ts` and both Adapters (`backend/src/armazenamento/{sqlite,postgresql}/armazenamento.ts`):
  - `criarContaDeTeste`, `listarContasDeTesteEncerradas`, `registrarCriacaoDeContaDeTeste`, `contarCriacoes`, `contarContasDeTesteAtivas` (not ended, with a valid Acesso), `esquecerCriacoesAntigas` and `registrarEnvioDeTeste(usuarioId, limite)`;
  - `excluirUsuario` skips keys with prefix `demonstracao/` when enqueueing;
  - `obterUsuarioPorId`/`obterUsuarioPorNomeDeUsuario` return `contaDeTesteEm`.

  Makes T006 pass.
- [X] T013 Add `gravarArquivoFixo(chave, bytes, tipoDeConteudo)` to the Interface `ArmazemDeMidia` in `backend/src/midia/armazem.ts`, implemented in `armazem-s3.ts` (PutObject) and `armazem-em-disco.ts`, refusing keys outside `demonstracao/`. Make `processarFilaDeMidia` in `backend/src/acervo/acervo.ts` skip keys of `ehMidiaDeDemonstracao`. Makes T007 pass.
- [X] T014 Create the Module `backend/src/demonstracao/`:
  - `acervo.ts`: content from the contract;
  - `historico.ts`: Sessions and their replay through `aplicarAvaliacoes` (`backend/src/repeticao/revisao.ts`);
  - `creditos.ts`: reads `backend/demonstracao/creditos.json`;
  - `midia.ts`: `ARQUIVOS_DE_DEMONSTRACAO`, `ehMidiaDeDemonstracao`, `PREFIXO_DE_DEMONSTRACAO`, and `garantirMidiaDeDemonstracao(armazem)` (measure each key; `gravarArquivoFixo` the missing ones; memoized per instance);
  - `conta.ts`: `montarContaDeTeste`.

  Makes T008 and T009 pass.
- [X] T015 [P] Add the four codes to `backend/src/http/recusas.ts`. Makes T010 pass.
- [X] T016 [P] Frontend Seam: add `entrarComoTeste({ fuso, idioma })` and `obterCreditos()` to the client in `frontend/src/acervo-cliente/cliente.ts`, `cliente-http.ts` and `cliente-em-memoria.ts`, plus the `contaDeTeste` field on the account read and the new codes in `frontend/src/idioma/recusas.ts`. Add the section `contaDeTeste` to `frontend/src/idioma/{tipos,pt,en,es}.ts` with all texts of `contracts/ui.md` (FR-503).

**Checkpoint**: `cd backend && rtk npm test && rtk npm run typecheck && rtk npm run lint` green, including PostgreSQL; frontend `npm test && npm run build` green.

---

## Phase 3: User Story 1 — Experimentar sem cadastro (Priority: P1) 🎯 MVP

**Goal**: one click on sign-in creates an isolated test account with the demo collection, flags shown and bird songs playing.

**Independent Test**: quickstart 1–4 and 8.

### Tests first

- [X] T017 [P] [US1] Identity tests in `backend/tests/identidade/conta-de-teste.test.ts` (new):
  - `criarContaDeTeste({ fuso, idioma, origem })` creates a user with `contaDeTesteEm`, calls `garantirMidiaDeDemonstracao` and stores the built account;
  - `obterUsuario` returns `contaDeTeste: true`;
  - a failure while storing leaves no user (FR-488, FR-491).
- [X] T018 [P] [US1] HTTP tests in `backend/tests/http/conta-de-teste.test.ts` (new):
  - `POST /contas-de-teste` without authentication → `201 { nomeDeUsuario, contaDeTeste: true }` with `Set-Cookie` of the Acesso, and a previous Acesso of this browser is revoked;
  - `400 corpo_invalido` for an invalid `fuso`/`idioma`;
  - with the cookie, `GET /baralhos` lists the three decks and `GET /conta` has `contaDeTeste: true`;
  - an Image card of the demo returns a 15-minute read address for its `demonstracao/` key;
  - `GET /demonstracao/creditos` is public and lists 20 entries (FR-487, FR-488, FR-490, FR-492, FR-494).
- [X] T019 [P] [US1] Frontend tests:
  - `frontend/tests/pagina-de-entrada.test.tsx`: the "Entrar como Teste" button and phrase; a `role="status"` preparing state with the button disabled; success leads to Início; a 429/503 message gets focus;
  - `frontend/tests/moldura.test.tsx`: the "Conta de teste" badge only for test accounts;
  - `frontend/tests/pagina-de-inicio.test.tsx`: the notice and the credits link; the credits dialog lists author, license and source, closes with Esc and returns focus;
  - three languages (FR-487, FR-490, FR-494, FR-503).

### Implementation

- [X] T020 [US1] In `backend/src/identidade/identidade.ts`: `criarContaDeTeste({ fuso, idioma, origem })` (limits come in T037; leave a single call point for them); `obterUsuario` returns `contaDeTeste`. Wire `garantirMidiaDeDemonstracao` with the media store in `backend/src/entradas/{local,nuvem}.ts`. Makes T017 pass.
- [X] T021 [US1] In `backend/src/http/rotas.ts` and `servidor.ts`:
  - `POST /contas-de-teste`, which revokes the browser's Acesso, issues one with `acessos.emitir` and sets the cookie;
  - `GET /demonstracao/creditos`;
  - both exempt from the Credencial hook, like `/usuarios`;
  - `GET /conta` gets the `contaDeTeste` field.

  Read the visitor origin from `CloudFront-Viewer-Address`, else the last `X-Forwarded-For` entry, else the socket address, and pass only `HMAC-SHA256(subchave, ip)` onward, where `subchave = HMAC-SHA256(SEGREDO_DAS_SENHAS, "origem-de-conta-de-teste")` (research R5). Makes T018 pass.
- [X] T022 [US1] Frontend:
  - `frontend/src/ui/PaginaDeEntrada.tsx`: button, phrase and states; send `fuso` (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and `idioma`; then use the Acesso as after "Continuar conectado";
  - `Moldura.tsx`: the badge;
  - `PaginaDeInicio.tsx`: the notice;
  - new `CreditosDaDemonstracao.tsx`, a dialog;
  - styles in `frontend/src/estilos.css` (44 px targets, 360 px).

  Makes T019 pass.

**Checkpoint**: quickstart 1–4 and 8 locally.

---

## Phase 4: User Story 2 — Contas isoladas por pessoa (Priority: P1)

**Goal**: two simultaneous visitors never see each other's changes, and everything works as in a regular account.

**Independent Test**: quickstart 5–6.

- [X] T023 [P] [US2] Tests in `backend/tests/http/conta-de-teste.test.ts`, in a new describe after T018:
  - two test accounts created in parallel get different users and the same initial content;
  - creating a deck, editing and deleting a demo card, importing and exporting in one account change nothing in the other (FR-489, FR-495, SC-193, SC-194);
  - deleting a demo card keeps its `demonstracao/` file;
  - copying a demo card to another deck creates an own media key (FR-500).
- [X] T024 [US2] Fix any product failure found by T023 (verified by `backend/tests/http/conta-de-teste.test.ts`) in the file that owns the behavior. Expected: none, since a test account is a regular Usuário (R1). If T023 passes as written, mark this task done with that note. **Found and fixed:** saving a demo media card as a selection failed because `copiar` accepted only active keys; both Disk and S3 adapters now copy demo media into an owned key. HTTP test confirms the copied media remains readable after deleting the demo card.

---

## Phase 5: User Story 3 — Conta descartável (Priority: P1)

**Goal**: leaving or expiring ends the account; the content is deleted (immediately on Sair, within 1 hour on expiry); entering again starts fresh.

**Independent Test**: quickstart 9–12.

### Tests first

- [X] T025 [P] [US3] HTTP tests in `backend/tests/http/conta-de-teste.test.ts`, after T023:
  - `POST /sair` on a test account deletes the user, the own media and the export file, keeps the demo media and clears the cookie;
  - if the deletion fails (store unavailable), the cookie is still cleared and the account is ended, and a later cleanup removes it (FR-497, FR-499, FR-500, SC-195).
- [X] T026 [P] [US3] Cleanup tests in `backend/tests/identidade/conta-de-teste.test.ts`, after T017: `limparContasDeTesteEncerradas(agora)` deletes test accounts with no valid Acesso and created more than 2 min ago, processes the media queue, and forgets creation records older than 1 hour; it never touches real accounts or test accounts with a valid Acesso (FR-498, SC-195).
- [X] T027 [P] [US3] Function test in `backend/tests/funcao/funcao.test.ts`: the event `{ "acao": "limpar-contas-de-teste" }` (the rule's constant input, research R16) runs the cleanup and does not go through Fastify; an HTTP event still works (FR-498).
- [X] T028 [P] [US3] Frontend tests:
  - `frontend/tests/sair-com-acesso.test.tsx`: on a test account, Sair opens the confirmation "Sair apaga a Conta de teste…"; "Cancelar" keeps the account; "Sair e apagar" calls Sair;
  - `frontend/tests/pagina-de-entrada.test.tsx`: after a 401 on a test account, the notice "Sua Conta de teste terminou…" appears;
  - a second tab after Sair leads to Entrar with the same notice (FR-497, US3/AC2).

### Implementation

- [X] T029 [US3] In `backend/src/identidade/identidade.ts`, add `encerrarContaDeTeste(usuarioId)`, which reuses the 017 deletion and the media queue, and `limparContasDeTesteEncerradas(agora)`. In `backend/src/http/rotas.ts`, `POST /sair` on a test account calls `encerrarContaDeTeste` and always clears the cookie, even on failure. Makes T025 and T026 pass.
- [X] T030 [US3] In `backend/src/funcao/funcao.ts`, handle the scheduled event with `limparContasDeTesteEncerradas`. In `backend/src/entradas/local.ts`, run the cleanup every 5 minutes. Also run it, limited to 20 accounts, on every test-account creation. Makes T027 pass.
- [X] T031 [US3] Frontend: the Sair confirmation for test accounts (`frontend/src/ui/Aplicacao.tsx` or the component that owns Sair), and the ended-account notice on `PaginaDeEntrada.tsx` driven by a 401 while `contaDeTeste` was true. Makes T028 pass.

---

## Phase 6: User Story 4 — Conta protegida (Priority: P2)

**Goal**: the account cannot be changed or deleted, the username cannot be used to sign in, and abuse is limited (creation per origin, global cap, 20 MB of own media).

**Independent Test**: quickstart 7 and 13.

### Tests first

- [X] T032 [P] [US4] Identity/HTTP tests in `backend/tests/http/conta-de-teste.test.ts`, after T025:
  - `PUT /conta/senha` and `DELETE /conta` on a test account → `403 conta_de_teste`;
  - `POST /entrar` with the test username, and Basic auth with any password → the uniform `401` (FR-496, FR-501, SC-196).
- [X] T033 [P] [US4] Limit tests in `backend/tests/identidade/conta-de-teste.test.ts`, after T026:
  - the 11th creation from the same origin within one hour → `contas_de_teste_esgotadas_na_origem` with `limite: 10`;
  - another origin is unaffected;
  - with 300 active test accounts → `contas_de_teste_indisponiveis`;
  - a creation that fails does not count;
  - the origin is stored only as an HMAC, so the raw IP never appears in `criacao_de_conta_de_teste` (FR-502).
- [X] T034 [P] [US4] Media limit test in `backend/tests/acervo/conta-de-teste-midia.test.ts` (new): on a test account, creating Image/Audio cards is accepted up to 20,971,520 bytes of own media, and the next one → `limite_de_midia_da_conta_de_teste` with `limite`; demo media does not count; deleting a card frees space; real accounts are unaffected. Also: the 31st `POST /imagens/envios` or `POST /audios/envios` on a test account → `limite_de_midia_da_conta_de_teste` (FR-495a, research R15). **Verified:** test covers exact 20 MiB, over-limit refusal, deletion freeing space, demo media excluded, and real account exempt; HTTP test covers the shared 30-send cap for image/audio.
- [X] T035 [P] [US4] Frontend test in `frontend/tests/secao-minha-conta.test.tsx`: on a test account, "Alterar senha" and "Excluir conta" are absent and the explanation is shown; the notice "Esta é uma Conta de teste…" and the credits link appear in the Perfil; Preferências and Idioma are still available (FR-490, FR-496, US4/AC3).

### Implementation

- [X] T036 [US4] In `backend/src/identidade/identidade.ts`, `autenticar` refuses users with `contaDeTesteEm` using the uniform refusal, and `alterarSenha`/`excluirConta` refuse with `conta_de_teste`. Map them in `backend/src/http/rotas.ts`. Makes T032 pass.
- [X] T037 [US4] Limits in `criarContaDeTeste`: `contarCriacoes` against 10 per hour per origin, `contarContasDeTesteAtivas` against 300, and `registrarCriacaoDeContaDeTeste` only after success. Map `429`/`503` in `rotas.ts`. Makes T033 pass.
- [X] T038 [US4] In `backend/src/acervo/acervo.ts`, when creating or editing an Image/Audio card on a test account, sum the confirmed `bytes` of the media kept in the account's own cards and refuse above `LIMITE_DE_MIDIA_DA_CONTA_DE_TESTE = 20_971_520`. In `backend/src/http/rotas.ts`, in both `POST /imagens/envios` and `POST /audios/envios` (before `prepararEnvio`), for a test account call one shared function that uses the Port's `registrarEnvioDeTeste(usuarioId, 30)` (atomic conditional increment of `usuario.envios_de_teste`, added to migration 22 in T011 and to the Port in T012) and refuse when it returns false. Map `413` in `rotas.ts`. Makes T034 pass.
- [X] T039 [US4] In `frontend/src/ui/SecaoMinhaConta.tsx`, hide the account actions and show the explanation, the test-account notice and the credits link for test accounts. Makes T035 pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T040 [P] Create `e2e/conta-de-teste.spec.ts`:
  - "Entrar como Teste" in under 5 s locally; study one flag (image visible) and one bird (audio plays);
  - two browser contexts are isolated;
  - Sair then enter again restores the initial state;
  - 360/390/768/1440 px and 200% zoom applied before rendering with `aplicarZoomDeProva`;
  - keyboard only (FR-487 to FR-500, SC-192 to SC-194).
- [X] T041 [P] Update `README.md` and `README.pt-BR.md`: a "Try it" (Experimentar) row describing "Entrar como Teste", the demo decks, the credits and the deletion on exit; the deploy note covering the IAM policy (`iam/robot-agendamento.json`), `tofu apply` for the schedule, and migration 22.
- [X] T042 Run `npm run verificar:ci` and the same pipeline in Linux via colima. Then run quickstart 1–13 locally. **Verified:** host `npm run verificar:ci` passed, including gitleaks and 112 E2E. The Linux snapshot passed typecheck, lint, all 1,352 backend general tests, all 303 PostgreSQL tests, all 1,094 frontend tests, build and 112 E2E; gitleaks was run in the host gate because the Linux image does not include that executable. Quickstart behaviors 1–13 are covered by `e2e/conta-de-teste.spec.ts` and the focused HTTP, identity and frontend suites.
- [X] T043 After the PO applies `iam/robot-agendamento.json` and the architect runs `tofu apply` and deploys: run quickstart 14 in production. Cold create ≤ 5 s (SC-192); measure the visitor origin header (research R5). Record the results in Notes.

---

## Dependencies & Execution Order

- **Setup**: T001 (architect) before T004 and T008. T002 and T003 are independent.
- **Foundational**: tests T005–T010 in parallel (different files), then T011 → T012 (Porta needs the schema). T013, T014 and T015 run in parallel with T012 (different files). T016 is frontend. **Blocks all stories.**
- **US1**: T017–T019 in parallel → T020 → T021 (backend); T022 (frontend) after T016.
- **US2**: after US1. T023 → T024.
- **US3**: after US1. T025/T026/T027/T028 in parallel, but `conta-de-teste.test.ts` files are shared, so run T025 after T023 and T026 after T017. Then T029 → T030; T031 frontend.
- **US4**: after US1. Shared test files follow order (T032 after T025; T033 after T026). T036 → T037 → T038 touch `identidade.ts`/`rotas.ts`/`acervo.ts` sequentially; T039 frontend.
- **Polish**: after the stories. T043 needs the PO's IAM step and the deploy.

## Implementation Strategy

1. **MVP = Setup + Foundational + US1**: a visitor enters as Teste and studies the demo collection. Validate quickstart 1–4 and 8.
2. **US2**: isolation proven.
3. **US3**: disposable account. Required before publishing, otherwise test accounts pile up.
4. **US4**: protection and limits. Also required before publishing to production.
5. **Polish**: e2e, README, gates, production measurement.

## Traceability (FR/SC → tasks)

| Requirement | Tests | Implementation |
|---|---|---|
| FR-487 Entrar como Teste | T018, T019, T040 | T021, T022 |
| FR-488 new isolated account with Acesso | T017, T018 | T020, T021 |
| FR-489 no shared data | T023, T040 | T012, T020 |
| FR-490 identified as test | T018, T019, T035 | T021, T022, T039 |
| FR-491 same initial collection | T009, T017 | T014 |
| FR-492 three decks, media within 026/028 limits | T008, T018 | T001, T014 |
| FR-493 8–15 cards per deck | T008 | T014 |
| FR-494 licenses and credits | T008, T018, T019 | T001, T014, T021, T022 |
| FR-504 example history | T009 | T014 |
| FR-495 normal use | T023 | — (regular Usuário, R1) |
| FR-495a 20 MB own media | T034 | T038 |
| FR-496 account protected | T032, T035 | T036, T039 |
| FR-497 Sair deletes; failure still disconnects | T025, T028 | T029, T031 |
| FR-498 expiry ends; cleanup within 1 h | T026, T027 | T029, T030, T003 |
| FR-499 not resumable | T025 | T029 |
| FR-500 demo media kept; copy gets own media | T006, T007, T023, T025 | T012, T013 |
| FR-501 no sign-in by any means | T032 | T036 |
| FR-502 limits; origin never in clear | T033 | T021, T037 |
| FR-503 three languages | T016, T019 | T016, T022 |
| SC-192 ≤ 5 s, 1 interaction | T040, T043 | T020–T022 |
| SC-193 identical initial collection | T009, T023 | T014 |
| SC-194 isolation | T023, T040 | T012 |
| SC-195 nothing remains | T025, T026 | T029, T030 |
| SC-196 changes refused | T032 | T036 |
| SC-197 licensed media with credits | T008 | T001 |
| SC-198 Início and stats not empty | T009, T040 | T014 |

## Notes

- A worker that finds an architectural ambiguity stops and reports it. It does not decide.
- **Produção, 2026-10-15 (antes da T043)**: "Entrar como Teste" respondia 503. O log mostrava `42P01` (tabela inexistente) na etapa `limite-por-origem`. O Neon estava na **v20**: 3 Cartões sem Pertencimento (transição da `025` pendente) adiavam as migrações 21 e 22 (precondição, research R18). Com autorização do PO:
  - o Cartão de `karol`, ligado pelo Vínculo legado ao Baralho "Matéria", passou a pertencer a ele (o caso simples que a própria transição resolve);
  - as contas automáticas `navegador7c7d60` e `validacao166a4a`, sem mídia, foram excluídas;
  - tudo numa transação com conferências.

  O deploy reexecutado migrou o Neon para a v22. Verificação em produção:
  - criar a conta: `201` em 2,63 s, com 3 Baralhos (12/10/10) e `contaDeTeste: true`;
  - créditos: 20;
  - mídia: os 20 objetos `demonstracao/` gravados no bucket;
  - Sair: `204`; depois disso, `/conta` responde `401`, e nenhuma Conta de teste fica no banco.

  Ainda pendente para a T043: aplicar `iam/robot-agendamento.json`, rodar `tofu apply` (a regra agendada não existe na AWS) e medir a criação com a Lambda fria.
- **T043 (2026-10-15)**:
  - Política IAM do PO confirmada: `events:DescribeRule` responde `ResourceNotFound` (e não `AccessDenied`), e `lambda:GetPolicy` responde.
  - O `tofu apply` criou só a regra, o target e a permissão; a regra está `ENABLED`, `rate(15 minutes)`, com a entrada `{"acao":"limpar-contas-de-teste"}`.
  - A conta abandonada às 20:10, sem Sair, foi excluída sozinha até 20:33 (FR-498).
  - Criação com a Lambda fria (primeira chamada depois de um deploy): 2,63 s, dentro dos 5 s (SC-192).
  - O limite por origem recusou a 11ª criação na mesma hora, com a mensagem localizada (FR-502).
  - Depois de T044, o Neon chegou à v23.
- **Limpeza diária (2026-10-16, research R22)**: o PO trocou o prazo do FR-498/SC-195 de 1 hora para 24 horas; a regra passou a `rate(1 day)`.

## Phase 8: Correções pós-publicação (2026-10-15)

- [X] T044 Remove the precondition from migration 22 and add a migration 23 that repeats the finalization of migration 21 (`DROP TABLE IF EXISTS vinculo` plus the 21 schema step, made idempotent) under the precondition `PODE_REMOVER_VINCULO`, in `backend/src/armazenamento/{sqlite,postgresql}/migracoes.ts`. Tests on SQLite and PostgreSQL:
  - a v20 database with a pending transition migrates to v22, so the Conta de teste tables exist, and stays below 23;
  - after the transition completes, it reaches v23 with `vinculo` gone;
  - a v22 database with the transition done reaches v23 with no data change.

  Update pinned version expectations (22 → 23). Per research R21, FR-488.
- [X] T045 Fix the Deck list action buttons ("Importar", "Exportar", "Criar baralho", "Criar baralho temporário") so they never break a word mid-letters at 360/390 px (`frontend/src/estilos.css`), with an e2e layout assertion in `e2e/lista-de-baralhos.spec.ts`: each button's text has no break inside a word at 360, 390, 768 and 1440 px and at 200% zoom. Per FR-157 (012).
