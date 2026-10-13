---
description: "Task list for Cartão com Imagem"
---

# Tasks: Cartão com Imagem

**Input**: Design documents from `specs/026-cartao-com-imagem/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/http.md`, `contracts/ui.md`, `quickstart.md`

**Tests**: Required by the constitution (Principles V and IX). Write each story's tests first and confirm they fail before implementing. Every FR maps to at least one test task (see Traceability).

**Execution note**: The architect reviews every diff and runs the gates (Principle VI). Workers never commit, never delete or weaken tests, and edit existing files instead of overwriting them. Do not run parallel workers on the same file, shared test files included.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, infrastructure and prototype that every story needs.

- [X] T001 Add production dependencies `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post` and `@aws-sdk/s3-request-presigner` to `backend/package.json` (update `backend/package-lock.json` via `npm install`). Confirm with the existing `backend/tests/armazenamento/dependencias.test.ts` that they are allowed, updating its allowlist if one exists.
- [X] T002 [P] Create `backend/terraform/s3-imagens.tf` per research R10:
  - bucket `memorization-imagens-${account_id}`;
  - `aws_s3_bucket_public_access_block` with all four flags true;
  - ownership `BucketOwnerEnforced`;
  - SSE-S3;
  - lifecycle rule expiring prefix `pendentes/` after 1 day;
  - CORS allowing `POST` only from the CloudFront distribution domain;
  - inline policy on the Lambda role with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::memorization-imagens-*/*` and no `s3:ListBucket`.

  Also add env var `NOME_DO_BUCKET_DE_IMAGENS` to the Lambda in `backend/terraform/lambda.tf` and an output in `backend/terraform/outputs.tf`. No secret values.
- [X] T003 [P] Add `imagens-locais/` to `.gitignore`. Add a MinIO service container to the backend job in `.github/workflows/ci.yml` and export `S3_DE_TESTE_ENDERECO` and the MinIO test credentials from GitHub Actions variables/secrets, never as literals in the file.
- [X] T004 [P] Build the standalone prototype `design/cartao-com-imagem/` (`index.html`, `app.js`, `style.css`, `README.md`, `verificar.mjs`) reusing `../../frontend/src/estilos.css`, following `contracts/ui.md`:
  - type selector defaulting to Frente-Verso;
  - announced field swap;
  - preview with Trocar/Remover;
  - format/size refusal;
  - list item with type label and thumbnail;
  - study face with fallback.

  `verificar.mjs` checks these flows in Chromium at 360, 390, 768 and 1440 px with no horizontal scroll.

**Checkpoint**: `tofu validate` passes (OpenTofu); `rtk proxy node design/cartao-com-imagem/verificar.mjs` passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Card types, schema v17 and the image store Seam. All stories depend on this phase.

### Tests first

- [X] T005 [P] Add SQLite migration-17 assertions to `backend/tests/acervo/migracoes.test.ts`:
  - **On a v16 database with Cartões, Pertencimentos and Histórico**: every `cartao` becomes `tipo = 'frente-verso'` with unchanged `frente`/`verso`; every `item_de_registro.tipo = 'frente-verso'`; `pertencimento` keeps all rows and cascades.
  - **Checks after migration**:
    - `pertencimento.frente_chave` accepts multiple `NULL` in the same Baralho;
    - CHECK `tipo IN ('frente-verso','imagem')`;
    - CHECK `(tipo = 'imagem') = (imagem_chave IS NOT NULL)`;
    - CHECK `tipo = 'imagem' OR texto_alternativo IS NULL`;
    - `texto_alternativo` length ≤ 250;
    - table `imagem_a_remover (chave TEXT PRIMARY KEY, registrada_em NOT NULL)` exists with no foreign key.

  Covers FR-403, FR-407, SC-173.
- [X] T006 [P] Add the same migration-17 assertions for PostgreSQL to `backend/tests/armazenamento/postgresql/migracoes.test.ts`, plus version parity with SQLite.
- [X] T007 [P] Create the shared contract battery `backend/tests/imagens/bateria-do-armazem.ts` and runners `backend/tests/imagens/armazem-em-disco.test.ts` (always) and `backend/tests/imagens/armazem-s3.test.ts` (skipped unless `S3_DE_TESTE_ENDERECO` is set). Battery cases:
  - `prepararEnvio` returns `imagemId`, `envio.url`, `envio.campos` and `expiraEm` ≤ 5 min;
  - uploads of 1 B and 5,242,880 B are accepted and 5,242,881 B is refused;
  - `confirmar` accepts JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, `GIF87a`, `GIF89a` and `RIFF????WEBP`;
  - `confirmar` refuses a text file renamed `.png` (`formato`), a missing upload (`nao_encontrada`) and another user's upload (`nao_encontrada`);
  - a refused pending object is deleted;
  - a pending key is never readable;
  - `enderecoDeLeitura` returns a URL that serves the bytes with the detected `Content-Type` and expires;
  - `copiar` yields an independent key;
  - `remover` is idempotent;
  - a confirmed JPEG with EXIF GPS/device tags is served without them and keeps its Orientation value; PNG `eXIf`/`tEXt`/`iTXt`/`zTXt` and WebP `EXIF`/`XMP ` chunks are removed (FR-427).

  If MinIO does not enforce `content-length-range`, mark that single case `skip` with the reason and cover it in the post-deploy check (T045).

  Covers FR-410, FR-411, FR-424.
- [X] T008 [P] Create `backend/tests/acervo/tipos-de-cartao.test.ts` through the `Acervo` Interface, showing that Frente-Verso behaviour is unchanged after the registry refactor: same validation messages, the 1,000-character limit, the ` (n)` numbering, search text and snapshot. Covers FR-403a for the existing type.

### Implementation

- [X] T009 Add SQLite migration 17 to `backend/src/armazenamento/sqlite/migracoes.ts` and `backend/src/armazenamento/sqlite/esquema.ts` exactly as in `data-model.md`. Rebuilding `pertencimento` to make `frente_chave TEXT NULL` must preserve `cartao_id TEXT PRIMARY KEY REFERENCES cartao(id) ON DELETE CASCADE`, `baralho_id … ON DELETE CASCADE` and `UNIQUE (baralho_id, frente_chave)`.
- [X] T010 [P] Add the equivalent PostgreSQL migration 17 to `backend/src/armazenamento/postgresql/migracoes.ts` and `backend/src/armazenamento/postgresql/esquema.ts`. Make `entradas/nuvem.ts` and `funcao/funcao.ts` require schema version 17.
- [X] T011 Extend `backend/src/armazenamento/porta.ts`:
  - `Cartao` becomes a union discriminated by `tipo` (`"frente-verso" | "imagem"`), with `imagemChave` and `textoAlternativo` on `imagem`;
  - `ItemRegistrado` gets `tipo`;
  - add `listarImagensARemover(limite)` and `esquecerImagensRemovidas(chaves)`.

  Implement these in both adapters (`sqlite/armazenamento.ts`, `postgresql/armazenamento.ts`) and add the cases to `backend/tests/armazenamento/bateria-da-porta.ts`, including a null `frente_chave` for `imagem` with empty front.
- [X] T012 Create `backend/src/acervo/tipos-de-cartao.ts`: `Record<TipoDeCartao, RegrasDoTipo>` with `validar`, `chaveDaFrente`, `numerar`, `textoPesquisavel` and `paraSnapshot`. Fill only `frente-verso` by moving the existing rules out of `backend/src/acervo/invariantes.ts`/`acervo.ts`. Refactor `Acervo` to consult the registry instead of branching. T008 must pass.
- [X] T013 Create the Interface `backend/src/imagens/armazem.ts` with `ArmazemDeImagens { prepararEnvio, confirmar, copiar, enderecoDeLeitura, remover }`, result types with refusal reasons `nao_encontrada | formato | tamanho`, and the shared `detectarFormato(bytes16)` signature check. Constants: `LIMITE_DE_BYTES_DA_IMAGEM = 5_242_880`, `VALIDADE_DO_ENVIO = 5 min`, `VALIDADE_DA_LEITURA = 15 min`. Pending key `pendentes/{usuarioId}/{imagemId}`; final key `imagens/{usuarioId}/{imagemId}`.
- [X] T049 Create `backend/src/imagens/metadados.ts` with a pure `removerMetadados(bytes, formato)`:
  - JPEG: drop APP1 (EXIF/XMP), APP13 and COM segments, then re-insert a minimal EXIF APP1 holding only the original Orientation tag when it was not 1;
  - PNG: drop the `eXIf`, `tEXt`, `iTXt`, `zTXt` and `tIME` chunks;
  - WebP: drop the `EXIF` and `XMP ` chunks and clear the matching VP8X flags;
  - GIF: drop comment extensions and application extensions other than `NETSCAPE2.0`.

  `confirmar` in both Adapters reads the pending object (≤ 5,242,880 B), applies it and writes the final key. Its tests go through the T007 battery. Covers FR-427.
- [X] T014 Implement `backend/src/imagens/armazem-em-disco.ts`, the Disco Adapter. Files go under `CAMINHO_DAS_IMAGENS`. Envio and leitura URLs point to `/imagens-locais/envios/{token}` and `/imagens-locais/{token}`, where tokens are HMAC-signed with expiry. Register those routes only from `backend/src/entradas/local.ts`. Enforce the 5 MB limit on upload. T007 must pass for Disco.
- [X] T015 Implement `backend/src/imagens/armazem-s3.ts`, the S3 Adapter, per research R4–R6:
  - presigned POST with `content-length-range` 1..5,242,880 and fixed key;
  - `confirmar` = `HeadObject` + `GetObject` of the whole pending object (≤ 5,242,880 B) → `detectarFormato` → `removerMetadados` (T049) → `PutObject` to the final key with the detected `ContentType` and `ContentDisposition: inline`, then delete the pending object;
  - presigned GET of 15 min.

  T007 must pass against MinIO in CI.
- [X] T016 Wire `ArmazemDeImagens` into `Acervo` and `Identidade` from `backend/src/entradas/local.ts` (Disco, `CAMINHO_DAS_IMAGENS` default `./imagens-locais`), `backend/src/entradas/nuvem.ts` and `backend/src/funcao/funcao.ts` (S3, bucket from `NOME_DO_BUCKET_DE_IMAGENS`). Env vars are read only in entrypoints. Extend `backend/tests/entradas/nuvem.test.ts` and `backend/tests/funcao/funcao.test.ts` for a missing bucket name.
- [X] T017 Create the frontend registry `frontend/src/acervo-cliente/tipos-de-cartao.ts` (validation and searchable text) and `frontend/src/ui/tipos-de-cartao/` (`Campos`, `Resumo` and `FaceDePergunta` per type), with only `frente-verso`. Refactor `PaginaDoFormularioDeCartao.tsx`, `PaginaDoBaralho.tsx`, `PaginaDeEstudo.tsx` and `busca-no-acervo` to consult it. The existing `frontend/tests/formulario-de-cartao.test.tsx`, `teclado-e-foco.test.tsx` and `pagina-de-baralhos.test.tsx` must pass unchanged.
- [X] T018 Change `ClienteDoAcervo` in `frontend/src/acervo-cliente/cliente.ts`:
  - `Cartao` and `DadosDeCartao` become a union discriminated by `tipo`;
  - `editarCartao(id, dados: DadosDeCartao)` replaces the positional signature;
  - add `enviarImagem(arquivo: File): Promise<{ ok: true; imagemId: string } | { ok: false; erro: "formato" | "tamanho" | "falha" }>`.

  Update `cliente-http.ts`, `cliente-em-memoria.ts` and all callers. In `frontend/tests/acervo-cliente/cliente.test.ts`, add cases for both Adapters showing that the in-memory client refuses non-image types and > 5,242,880 B.

**Checkpoint**: all existing suites green; schema 17 in both adapters; image store battery green on Disco (and MinIO in CI); Frente-Verso behaviour unchanged.

---

## Phase 3: User Story 1 - Criar um Cartão com Imagem (Priority: P1) 🎯 MVP

**Goal**: The create form has a type selector that always starts at Frente-Verso; choosing Imagem lets the User upload, preview and save an Image card in the current Baralho.

**Independent Test**: In a Baralho, choose Imagem, pick a valid PNG, fill Verso, save, reload: the card is still there with its Image (quickstart 1–5).

### Tests for User Story 1

- [X] T019 [P] [US1] Add `backend/tests/acervo/cartao-com-imagem.test.ts` (SQLite + Disco) through `Acervo.criarCartao`:
  - `imagem` without `imagemId` → `imagem_ausente`;
  - valid upload → card with `tipo: "imagem"`, empty front allowed, `textoAlternativo` ≤ 250 (251 refused with `descricao_excedida`);
  - Verso empty/whitespace/> 1,000 refused;
  - two empty-front Image cards in the same Baralho both accepted; equal non-empty Texto da frente numbered ` (2)`;
  - invalid upload → `imagem_invalida` with `motivo`;
  - storage failure after `confirmar` leaves no card and puts the key in `imagem_a_remover`;
  - another user's `imagemId` → `nao_encontrada`.

  Covers FR-408, FR-409, FR-412, FR-414, FR-423.
- [X] T020 [P] [US1] Add `backend/tests/http/cartao-com-imagem.test.ts`:
  - `POST /imagens/envios` requires Entrar (401) and returns the `contracts/http.md` shape;
  - `POST /baralhos/{id}/cartoes` with `tipo` absent ⇒ `400 corpo_invalido`;
  - `tipo: "imagem"` happy path 201;
  - `400 imagem_ausente`;
  - `422 imagem_invalida` (`formato`/`tamanho`/`nao_encontrada`);
  - `503` without orphan;
  - with Fastify's logger captured, no log line contains an envio/leitura URL, the `textoAlternativo` or the front text (FR-428).

  Covers FR-405, FR-409, FR-411.
- [X] T021 [P] [US1] Add `frontend/tests/formulario-de-cartao-com-imagem.test.tsx` with `ClienteEmMemoria`:
  - each opening starts at "Frente-Verso", even after creating an Image card; after a save with the form still open for the next card, the selector keeps the type used;
  - the Descrição field shows the help text "Descreva a imagem sem revelar a resposta.";
  - the discard dialog opens with focus on cancel, returns focus to the selector, and cancelling keeps the type and the Image;
  - a server Image refusal moves focus to the Imagem field;
  - with `prefers-reduced-motion: reduce`, a GIF preview shows only its first frame;
  - switching to Imagem shows the fields from `contracts/ui.md` in order and announces "Campos do tipo Imagem" in `aria-live`;
  - Verso/Tags/front text are preserved across switches;
  - switching back with an Image chosen opens the confirmation dialog;
  - preview with Trocar/Remover;
  - a file with a non-accepted extension or > 5,242,880 B is refused when chosen, at the field with `aria-invalid` and focus, keeping other values;
  - a `.txt` renamed to `.png` passes the field and is refused on save with `imagem_invalida`, keeping all values;
  - saving without an Image shows "Escolha uma imagem";
  - a server `imagem_invalida` keeps all values;
  - a successful save is announced and listed.

  Covers FR-404, FR-405, FR-406, FR-410, FR-413, US1-1..8.
- [X] T022 [P] [US1] Extend `frontend/tests/teclado-e-foco.test.tsx`: the whole Image creation flow is done by keyboard only (selector, file input, Trocar, Remover, save) with visible focus. Covers FR-425, US1-9.

### Implementation for User Story 1

- [X] T023 [US1] Add the `imagem` entry to `backend/src/acervo/tipos-de-cartao.ts`:
  - Imagem required;
  - Texto da frente optional (≤ 1,000 when present);
  - Verso required (≤ 1,000);
  - `textoAlternativo` optional ≤ 250;
  - `chaveDaFrente` = normalized front, or `null` when empty;
  - snapshot `{ tipo, frente, verso }` without the Image.
- [X] T024 [US1] Extend `Acervo.criarCartao` in `backend/src/acervo/acervo.ts`: validate text by type → `armazem.confirmar` → persist. On persistence failure after confirmation, enqueue the key in `imagem_a_remover` and return the storage failure. Attach `imagem: { url, expiraEm }` via `enderecoDeLeitura` to every Image card returned; on signing failure return `imagem: null`.
- [X] T025 [US1] In `backend/src/http/rotas.ts`:
  - add `POST /imagens/envios`;
  - change the Zod body of `POST /baralhos/:baralhoId/cartoes` to the discriminated union (`tipo` required); update existing callers and e2e fixtures that create cards through the API to send `tipo: "frente-verso"`;
  - map the new codes `imagem_ausente` (400), `descricao_excedida` (400), `imagem_invalida` + `motivo` (422) and `armazenamento_indisponivel` (503);
  - serialize the read shape from `contracts/http.md`.
- [X] T026 [US1] Implement `enviarImagem` in `frontend/src/acervo-cliente/cliente-http.ts`: `POST /imagens/envios`, then `fetch(envio.url, { method: "POST", body: FormData(campos…, file) })` with no Authorization header. Map S3 `EntityTooLarge` to `tamanho`. Send the discriminated union on create.
- [X] T027 [US1] Add the `imagem` entry to `frontend/src/ui/tipos-de-cartao/` (`Campos`: file input with `accept="image/jpeg,image/png,image/webp,image/gif"`, help text "JPEG, PNG, WebP ou GIF, até 5 MB", preview through `URL.createObjectURL` revoked on change/unmount, Trocar/Remover, Descrição counter 250, Texto da frente counter 1,000, Verso counter 1,000) and to `frontend/src/acervo-cliente/tipos-de-cartao.ts`.
- [X] T028 [US1] Update `frontend/src/ui/PaginaDoFormularioDeCartao.tsx` in create mode:
  - a native `<select>` labelled "Tipo de cartão" as the first field, reset to `frente-verso` on every open;
  - an `aria-live="polite"` field-swap announcement;
  - the discard-Image confirmation through `DialogoDeConfirmacao`;
  - on save, upload only then (`enviarImagem` → `criarCartao`) with an announced "Enviando imagem…" state;
  - the existing exit protection while saving.
- [X] T029 [P] [US1] Add styles for the selector, file field and preview (`object-fit: contain`, `max-width: 100%`) to `frontend/src/estilos.css`, keeping the existing palette, focus outline and spacing.

**Checkpoint**: US1 tests green; quickstart scenarios 1–5 pass locally with the Disco Adapter.

---

## Phase 4: User Story 2 - Estudar Cartões com Imagem (Priority: P1)

**Goal**: Image cards appear directly on the card in the Baralho list, in the Sessão and in Histórico, and work with spaced repetition.

**Independent Test**: Study a Baralho containing an Image card: Image before reveal, Verso after; evaluation updates Agendamento; Histórico shows the type without the Image (quickstart 6).

### Tests for User Story 2

- [X] T030 [P] [US2] Extend `backend/tests/acervo/cartao-com-imagem.test.ts`:
  - `registrarSessao` stores `tipo` in each item and never an Image key;
  - Agendamento is updated by the same rules as Frente-Verso;
  - `obterRegistroDeSessao` returns `tipo`.

  Covers FR-416, FR-419a.
- [X] T031 [P] [US2] Extend `backend/tests/http/cartao-com-imagem.test.ts`:
  - `GET /baralhos/{id}`, `GET /cartoes` and the session-start routes return `tipo` and `imagem.url` only for the owner;
  - another User gets 404;
  - fetching the permanent object key without a signature is denied (Disco Adapter);
  - `GET /sessoes/{id}` items carry `tipo` and no image.

  Covers FR-424, SC-170.
- [X] T032 [P] [US2] Add `frontend/tests/estudo-com-imagem.test.tsx` (also covers FR-429: with `prefers-reduced-motion: reduce`, GIFs in the list and the Sessão show only the first frame; the thumbnail is at most 96 px on its longer side; the list thumbnail shows "Imagem indisponível" on load failure):
  - the deck list shows a textual type label ("Imagem"/"Frente-Verso") and a thumbnail with `alt` = description → front text → "Imagem do Cartão";
  - the Image appears directly with no link or button to open it;
  - search finds Image cards by front text and Verso;
  - the Sessão shows the Image + front text before reveal and the Verso after;
  - on an `<img>` error the deck data is re-requested once, then "Imagem indisponível" + description is shown and evaluation still works;
  - Histórico shows "Cartão do tipo Imagem" without an `<img>`.

  Covers FR-415, FR-416, FR-418, FR-419, FR-426.

### Implementation for User Story 2

- [X] T033 [US2] Ensure every read path in `backend/src/acervo/acervo.ts` (deck detail, card list, selection, agenda, session start) attaches `imagem` through `enderecoDeLeitura`. `registrarSessao` uses `RegrasDoTipo.paraSnapshot`. Expose `tipo` in session items in `backend/src/http/rotas.ts`.
- [X] T034 [US2] Implement `Resumo` (thumbnail ≤ 96 px on the longer side) and `FaceDePergunta` for `imagem` in `frontend/src/ui/tipos-de-cartao/`, plus a shared `ImagemDoCartao` that, under `prefers-reduced-motion: reduce`, draws a GIF's first frame to a `<canvas>` with the same `alt` semantics (`role="img"` + `aria-label`). It is also used by the form preview (T027). (inline `<img>` with `object-fit: contain`, `max-width: 100%`, max height ~60vh, the `alt` fallback chain, a one-time refetch callback on error, then the "Imagem indisponível" box). Add the searchable text in `frontend/src/acervo-cliente/tipos-de-cartao.ts`.
- [X] T035 [US2] Wire the type label, thumbnail and refetch-on-error into `frontend/src/ui/PaginaDoBaralho.tsx` and the study face into `frontend/src/ui/PaginaDeEstudo.tsx`. Render the Histórico label in `frontend/src/ui/PaginaDoRegistro.tsx`.
- [X] T036 [P] [US2] Add list thumbnail and study-image styles to `frontend/src/estilos.css`, with no horizontal scroll at 360 px and at 200% zoom (FR-417).

**Checkpoint**: US2 tests green; quickstart scenarios 6–7 pass.

---

## Phase 5: User Story 3 - Editar e excluir Cartões com Imagem (Priority: P2)

**Goal**: Edit text, description or Image without changing the type; deleting a Cartão, Baralho or account removes its Images; Cópias keep their own Image.

**Independent Test**: Swap an Image and its text, check the Baralho and Sessão, then delete the card and confirm the file is gone (quickstart 8–10).

### Tests for User Story 3

- [X] T037 [P] [US3] Extend `backend/tests/acervo/cartao-com-imagem.test.ts`:
  - `editarCartao` with a different `tipo` → `tipo_imutavel` with nothing changed;
  - editing texts without `imagemId` keeps the Image;
  - a new `imagemId` replaces it, and the old key is enqueued and removed after commit;
  - `excluirCartao`, `excluirBaralho` and `Identidade.excluirConta` remove every affected key from the store;
  - when `remover` fails, keys stay in `imagem_a_remover` and are removed on the next removal and on startup;
  - `salvarSelecaoComoBaralho` copies the Image to a new key, and deleting the original leaves the copy readable;
  - a transaction failure after `copiar` enqueues the copies;
  - `editarCartao` with a new `imagemId` whose persistence fails after `confirmar` leaves the card unchanged (old Image still served) and enqueues the new key.

  Covers FR-420, FR-421, FR-422, FR-423, SC-171.
- [X] T038 [P] [US3] Extend `backend/tests/http/cartao-com-imagem.test.ts`:
  - `PUT /cartoes/{id}` returns `409 tipo_imutavel` when the type changes;
  - an Image swap returns 200 with the new URL, and the old URL no longer serves (Disco);
  - `DELETE /baralhos/{id}` and `DELETE /conta` leave no object under `imagens/{usuarioId}/` for the removed cards.
- [X] T039 [P] [US3] Extend `frontend/tests/formulario-de-cartao-com-imagem.test.tsx`:
  - edit mode shows "Tipo: Imagem" as text and no selector;
  - the current Image is previewed;
  - Trocar uploads on save;
  - Remover followed by save is refused with "Escolha uma imagem";
  - the existing delete confirmation is unchanged for Image cards.

  Covers FR-420, US3-1..4.

### Implementation for User Story 3

- [X] T040 [US3] In `backend/src/acervo/acervo.ts`:
  - `editarCartao` refuses a type change (`tipo_imutavel`) and confirms a new upload before persisting;
  - `atualizarCartao` enqueues the replaced key;
  - add an internal `processarFilaDeRemocao()` called after `excluirCartao`, `excluirBaralho`, Image swap and at startup;
  - `salvarSelecaoComoBaralho` calls `armazem.copiar` before the transaction and enqueues the copies on failure;
  - on persistence failure after confirming a new upload in `editarCartao`, enqueue the new key and return the storage failure.
- [X] T041 [US3] Make `excluirCartao`, `excluirBaralho` and `excluirUsuario` in both storage adapters (`sqlite/armazenamento.ts`, `postgresql/armazenamento.ts`) insert the affected `imagem_chave` values into `imagem_a_remover` in the same transaction. Add the cases to `backend/tests/armazenamento/bateria-da-porta.ts`.
- [X] T042 [US3] Call the removal routine after a successful account deletion in `backend/src/identidade/identidade.ts`. Map `tipo_imutavel` (409) and the edit union in `backend/src/http/rotas.ts` for `PUT /cartoes/:id`.
- [X] T043 [US3] Update edit mode in `frontend/src/ui/PaginaDoFormularioDeCartao.tsx` (read-only type text, current Image preview from `imagem.url`, Trocar/Remover, upload on save) and `editarCartao` in `frontend/src/acervo-cliente/cliente-http.ts` and `cliente-em-memoria.ts`.

**Checkpoint**: US3 tests green; quickstart scenarios 8–10 pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T044 [P] Add `e2e/cartao-com-imagem.spec.ts` (local Disco Adapter):
  - create an Image card, reload, study it, swap the Image, delete the card;
  - keyboard only;
  - 360, 390, 768 and 1440 px and 200% CSS zoom with no horizontal scroll.

  Store fixtures (a small PNG, a renamed `.txt` and a 6 MB file generated at runtime) in `e2e/fixtures/`. Covers FR-417, FR-425, SC-167, SC-168.
- [X] T045 [P] Add a migration-17 check to the cloud migration script tests (`backend/tests/armazenamento/scripts.test.ts`). Document the deploy order (tofu apply → Neon migration 18 → Lambda deploy) and the post-deploy upload-limit check in `backend/terraform/README.md`.
- [X] T046 Update user-facing documentation that describes card creation (the "Cards" row of the feature table in the root `README.md`, citing spec 026) in the same increment (constitution: Documentação).
- [X] T048 Add a measurement to `e2e/cartao-com-imagem.spec.ts` (after T044, same file): with a 5 MB PNG and Playwright network throttled to 50 Mbps/20 ms, the time from showing the study card to the `<img>` `load` event is ≤ 2 s in ≥ 19 of 20 runs. Covers SC-172.
- [X] T047 Run `npm run verificar:ci` at the repository root. Run the `ArmazemDeImagens` battery against MinIO through colima (quickstart). Record the commands and results in the commit message, and append any decision changed during implementation to `specs/026-cartao-com-imagem/research.md`.

---

## Dependencies & Execution Order

- **Setup (T001–T004)**: T001 blocks T015. T002–T004 are independent.
- **Foundational (T005–T018)**:
  - tests T005–T008 come first;
  - T009 → T011; T010 ∥ T009;
  - T012 after T011;
  - T013 → T049 → T014, T015 → T016;
  - T017 → T018 (same files); both may run in parallel with backend tasks.
- **US1 (Phase 3)** depends on the whole of Phase 2. MVP.
- **US2 (Phase 4)** depends on Phase 2 and needs at least one Image card, so it runs after T023–T025. Its frontend tasks can start once T027 exists.
- **US3 (Phase 5)** depends on Phase 2 and US1 (create flow); it is independent of US2.
- **Polish** comes last. T044 needs US1–US3.

```text
Setup ─▶ Foundational ─▶ US1 ─┬─▶ US2 ─┐
                              └─▶ US3 ─┴─▶ Polish
```

## Parallel Examples

- **Phase 2 tests**: T005, T006, T007 and T008 run together, since they touch different files.
- **US1 tests**: T019 (backend acervo), T020 (backend http), T021 (frontend form) and T022 (frontend keyboard).
- **US2**: T030, T031 and T032; then T034 and T036 alongside backend T033.
- **US3**: T037, T038 and T039. T040 and T041 stay sequential because they touch the same persistence flow.
- Never run two workers on `backend/tests/acervo/cartao-com-imagem.test.ts`, `backend/tests/http/cartao-com-imagem.test.ts` or `frontend/src/estilos.css` at the same time.

## Implementation Strategy

1. **MVP**: Setup, Foundational and US1. The User can create Image cards; the app runs locally with Disco and in the cloud with S3.
2. **Then US2**: Image cards become studyable and visible across the app. With US2 the feature delivers its core value.
3. **Then US3**: maintenance and the full Image lifecycle.
4. **Polish**: e2e, docs and the full gate.

After each phase: review the diffs, run the focused gates (quickstart), then commit with Conventional Commits that reference the task IDs.

## Traceability (FR → tasks)

| FR | Tests | Impl |
|---|---|---|
| FR-403, FR-407 | T005, T006 | T009, T010, T011 |
| FR-403a | T008, T021 | T012, T017, T023, T027 |
| FR-404, FR-405, FR-406 | T020, T021 | T025, T028 |
| FR-408, FR-409 | T019, T020 | T023, T024, T025 |
| FR-410, FR-411 | T007, T019, T020, T021 | T013–T015, T026, T027 |
| FR-412 | T019 | T023, T027 |
| FR-413 | T021 | T027, T028 |
| FR-414 | T019 | T023 |
| FR-415, FR-426 | T032 | T034, T035 |
| FR-416, FR-419a | T030, T032 | T033, T034, T035 |
| FR-417 | T032, T044 | T029, T036 |
| FR-418 | T032 | T034 |
| FR-419 | T032 | T034 |
| FR-420 | T037, T038, T039 | T040, T042, T043 |
| FR-421, FR-422 | T037, T038 | T040, T041, T042 |
| FR-423 | T019, T037, T007 | T002 (lifecycle), T024, T040 |
| SC-172 | T048 | T034, T036 |
| FR-424 | T007, T031 | T013–T015, T024, T033 |
| FR-425 | T021, T022, T044 | T028 |
| FR-427 | T007 | T049, T014, T015 |
| FR-428 | T020 | T025 |
| FR-429 | T021, T032 | T034, T027 |
