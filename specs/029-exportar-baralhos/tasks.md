---
description: "Task list for Exportar Baralhos"
---

# Tasks: Exportar Baralhos

**Input**: Design documents from `specs/029-exportar-baralhos/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/http.md`, `contracts/apkg.md`, `contracts/ui.md`, `quickstart.md`

**Tests**: Required by the constitution (Principles V and IX). Write each story's tests first and confirm they fail before implementing. Every FR maps to at least one test task (see Traceability).

**Execution note**: The architect reviews every diff and runs the gates (Principle VI). Workers:
- never commit;
- never delete or weaken tests;
- edit existing files instead of overwriting them;
- never run in parallel on the same file, shared test files included.

All new product text goes to the three typed catalogs `frontend/src/idioma/{pt,en,es}.ts` (the 027 test `idioma-sem-texto-solto` forbids loose text). All new server messages are English ASCII. No new dependency: `sql.js` and `fflate` are already in `backend/package.json` (research R1).

**Gate before implement**: `checklists/anki-seguranca-e-limites.md` must be reviewed, and a new `/speckit-analyze` must show no CRITICAL issue (Principle X). The first analyze's decisions are in research R14.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Infrastructure and prototype, with no product behavior.

- [ ] T001 [P] Add an S3 lifecycle rule to `backend/terraform/s3-imagens.tf` that expires the prefix `exportacoes/` after 1 day, next to the existing `pendentes/` rule. Update the header comment to say the bucket also holds ephemeral export files (research R10). Do not change IAM: the Lambda role already has `s3:GetObject`/`s3:PutObject` on `/*`. Gate: `tofu -chdir=backend/terraform validate`.
- [x] T002 [P] Build the standalone prototype `design/exportar-baralhos/` (`index.html`, `app.js`, `style.css`, `README.md`, `verificar.mjs`), reusing `../../frontend/src/estilos.css` and following `contracts/ui.md`. It shows:
  - the page in its two entries (one Deck, list with "Todos os Baralhos");
  - the format fieldset with the only option "Pacote Anki (.apkg)" preselected and the Anki help text;
  - the live summary (Decks, Cards, "N com Imagem, M com Áudio", approximate size);
  - the states: Gerando, Concluída (with "Baixar de novo" and "cards without media"), Recusa, Falha;
  - a PT/EN/ES toggle.

  `verificar.mjs` checks these in Chromium at 360, 390, 768 and 1440 px and at 200% zoom, with no horizontal scroll and everything operable by keyboard.

**Checkpoint**: `tofu validate` green; the prototype verifier passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The operations every story needs: Progresso de estudo, consistent read of the collection, the store operations, the refusal codes and the client Seam. All stories depend on this phase.

### Tests first

- [x] T003 [P] Add tests for `descreverProgresso` to `backend/tests/repeticao/` (new file `descrever-progresso.test.ts`), through the `AlgoritmoDeRepeticao` Interface (`algoritmoPorId("sm2")`):
  - `null` state → `{ repeticoes: 0, intervaloEmDias: 0, facilidade: 2.5 }`;
  - states produced by `sm2.avaliar` along the 015 reference sequence → the same `repeticoes`, `intervaloEmDias` and `facilidade`;
  - a state of another algorithm or version → the same as `null` (tolerant read, FR-191).
- [x] T004 [P] Extend the Port battery `backend/tests/armazenamento/bateria-da-porta.ts` with `lerAcervoParaExportacao(usuarioId, baralhoIds | "todos")` (research R7). It runs on SQLite and PostgreSQL:
  - `"todos"` returns every Deck of the User with its Cards in creation order, each with `tipo`, `frente`, `verso`, `tags`, `descricaoAlternativa`, the media key (`imagem_chave` or `audio_chave`) and its Agendamento or `null`;
  - a list returns only those Decks;
  - an id of another User's Deck, or a nonexistent id → `nao_encontrado`, with no partial data (FR-480);
  - another User's Cards and Agendamentos never appear.
- [x] T005 [P] Extend the store battery `backend/tests/midia/bateria-do-armazem.ts` (Disk always; S3 through the local emulator when configured) with:
  - `ler(chave)` → the exact bytes of an active Imagem and Áudio; `null` for a missing key; on the S3 Adapter, an error other than "not found" is thrown, not turned into `null` (research R15);
  - `medir(chaves)` → the sum of the sizes; missing keys count 0; an empty list is 0;
  - `guardarExportacao(usuarioId, bytes, nomeDoArquivo, tipoDeConteudo)` → an `EnderecoDeLeitura` that serves the same bytes with `Content-Disposition: attachment` and the UTF-8 file name (`filename*=UTF-8''…`); the key is exactly `exportacoes/{usuarioId}`, and a second call for the same User overwrites it (research R14); the address expires in at most 900 s (FR-481).
- [x] T006 [P] Add refusal tests to `backend/tests/mensagens/recusas.test.ts`: the codes `exportacao_vazia`, `exportacao_grande_demais` and `exportacao_indisponivel` exist with the English ASCII messages from `contracts/http.md` (FR-486).

### Implementation

- [x] T007 Add `descreverProgresso(estado: EstadoDoAgendamento | null): { repeticoes: number; intervaloEmDias: number; facilidade: number }` to the Interface `AlgoritmoDeRepeticao` in `backend/src/repeticao/algoritmo.ts`, and implement it in `backend/src/repeticao/sm2.ts` with the existing `lerDados` (research R8). The export Module never reads `estado.dados`. Makes T003 pass.
- [x] T008 Add `lerAcervoParaExportacao` to the Port in `backend/src/armazenamento/porta.ts`, with the type `ConteudoArmazenado` from `data-model.md`. Implement it in the SQLite and PostgreSQL Adapters in one read transaction (`REPEATABLE READ` in PostgreSQL). Makes T004 pass. Depends on nothing in Phase 2.
- [x] T009 Add `ler`, `medir` and `guardarExportacao` to the Interface `ArmazemDeMidia` in `backend/src/midia/armazem.ts`, and implement them in `armazem-s3.ts` and `armazem-em-disco.ts` (research R6, R10):
  - S3: `GetObject`; `HeadObject` with concurrency 32; `PutObject` to `exportacoes/{usuarioId}` (overwrite), then a presigned `GetObject` of 900 s with `ResponseContentDisposition`;
  - Disk: file read, `stat`, and a file under `exportacoes/`. Extend `backend/src/http/midia-local.ts` so the prefix `exportacoes/` is served with `Content-Disposition: attachment`.

  Makes T005 pass.
- [x] T010 [P] Add the three codes to `backend/src/http/recusas.ts`, with the messages from `contracts/http.md`. Makes T006 pass.
- [x] T011 [P] Add the export types and the two operations `previaDaExportacao(pedido)` and `exportar(pedido)` to the Seam `ClienteDoAcervo` in `frontend/src/acervo-cliente/cliente.ts`. Implement them in `cliente-http.ts` (`POST /exportacoes/previa`, `POST /exportacoes`, with refusals mapped to `Recusa` by code, as in 027) and in `cliente-em-memoria.ts`. The in-memory Adapter computes the summary from its own collection and returns a `blob:` URL of an empty file with the right name. Add the new codes to `frontend/src/idioma/recusas.ts` and their texts to `frontend/src/idioma/{tipos,pt,en,es}.ts`, section `recusas` (FR-485, FR-486).

**Checkpoint**: `cd backend && rtk npm test && rtk npm run typecheck && rtk npm run lint` green, including PostgreSQL; `cd frontend && rtk npm test && rtk npm run build` green.

---

## Phase 3: User Story 1 — Exportar um Baralho para o Anki (Priority: P1) 🎯 MVP

**Goal**: from a Deck's detail, download an `.apkg` that opens in Anki with the same Deck, Fronts, Backs, Tags and study progress.

**Independent Test**: quickstart scenarios 1, 5, 6, 8, 9 and 12. Export "Inglês", open it in Anki desktop and check name, Cards, texts, Tags and revision dates.

### Tests first

- [x] T012 [P] [US1] Create `backend/tests/exportacao/apkg.test.ts`. It calls `exportar(conteudo, "apkg", contexto)` and reads the result as a zip and as SQLite with `sql.js` (`contracts/apkg.md`):
  - the zip has `collection.anki2` and `media` (`{}` without media);
  - `col.ver = 11`; one Anki Deck per Deck, with the same `name` (including a name with `::` and accents);
  - one note per Card: `guid` = the Card id; `flds` = `Front\x1fBack`; Tags `" a b "`, and a Tag with an inner space becomes `_` (FR-466, FR-467);
  - escaping: `<b>`, `&` and `"` become entities, and `\n` becomes `<br>` (FR-466);
  - Progress (FR-469, research R8): a Card without Agendamento → `type = queue = 0`, `due` = position; a Card with Agendamento → `type = queue = 2`, `ivl = max(1, intervaloEmDias)`, `factor = round(facilidade × 1000)`, `reps = repeticoes`, and `crt + due` days = the next revision date in the given `fuso` (test with `America/Sao_Paulo` near midnight UTC); an overdue revision makes `crt` the overdue day, and `due` is never negative;
  - `revlog` is empty (FR-471);
  - the package contains neither the User's username nor the User id (search every table and `media`) (FR-480, research R15);
  - the note type id is the same constant across two exports (research R15);
  - round trip (SC-184, US1 scenario 4, FR-470): `lerPacoteAnki(bytes)` returns the same Deck names; Fronts and Backs equal to the originals with whitespace normalized as the current import does (multi-line texts included); Tags with inner spaces as `_`; and the resulting Cards carry no Agendamento;
  - Cards of type Image and Audio without media in this phase (I3, research R14): the Front is the front text or Message, or `[Imagem]`/`[Áudio]` in the requested `idioma` (pt, en, es) when there is none; the Back is the Back. No Card is left out (SC-185).
- [x] T013 [P] [US1] Create `backend/tests/exportacao/nome-do-arquivo.test.ts` (research R11): one Deck → `{nome}.apkg`, with `/\:*?"<>|` and control characters replaced by `-` and the name cut at 100 characters (FR-474).
- [x] T014 [P] [US1] Create `backend/tests/acervo/exportacao.test.ts` through the `Acervo` Interface with the Disk store:
  - `previaDaExportacao({ formato: "apkg", baralhos: [id] })` returns `{ formato, extensao, baralhos: 1, cartoes, cartoesComImagem: 0, cartoesComAudio: 0, bytesEstimados }`;
  - `exportar` returns `{ url, nomeDoArquivo, expiraEm, baralhos, cartoes, cartoesSemMidia: 0 }`, and the stored bytes are the same as `exportar` produces;
  - a Deck without Cards → `exportacao_vazia`; an unknown format → invalid input; another User's Deck → `nao_encontrado` (FR-480);
  - more than 10,000 Cards → `exportacao_grande_demais` with `motivo: "cartoes"` and `limite: 10000`, refused before any read of media (FR-478);
  - a store failure in `guardarExportacao` → `exportacao_indisponivel`, with no URL (FR-476);
  - a Card edited after the read starts does not change the file (FR-473: inject a Port read that resolves before the edit).
- [x] T015 [P] [US1] Add HTTP tests to `backend/tests/http/` (new file `exportacao.test.ts`):
  - `POST /exportacoes/previa` and `POST /exportacoes`: `401` without Entrar; `400` for a body outside `contracts/http.md` (missing `formato`, empty `baralhos`, repeated ids, invalid `fuso`, `idioma` outside `pt|en|es`);
  - status and body of each refusal;
  - logs never contain Deck names, Card content or the `url` (FR-482): capture the logger output.
- [x] T016 [P] [US1] Create `frontend/tests/pagina-de-exportacao.test.tsx` (Testing Library, in-memory client), for the entry `?baralho={id}`:
  - shows only that Deck's name, the format fieldset with "Pacote Anki (.apkg)" checked, the Anki help text and the summary (FR-461, FR-472);
  - "Exportar arquivo" → `role="status"` "Gerando arquivo…", button disabled, a second click does not call `exportar` twice (FR-475);
  - success → "Arquivo pronto: {nome}" and "Baixar de novo"; navigation to the `url` (spy on the navigation function);
  - a Deck without Cards → button disabled with the reason (US1 scenario 5);
  - a refusal or failure → the text in the interface language, focus on it, and "Tentar de novo" (FR-476);
  - the same in English and Spanish (FR-485).
- [x] T017 [P] [US1] Add to `frontend/tests/navegacao.test.tsx` the route `#/baralhos/exportar?baralho={id}`, and to the Deck detail test (`frontend/tests/pagina-do-baralho.test.tsx`) the "Exportar" button leading to it.

### Implementation

- [x] T018 [US1] Create the Module `backend/src/exportacao/` (research R2, `contracts/apkg.md`):
  - `exportar.ts`: the Interface `exportar(conteudo, formato, contexto: { agora, fuso, idioma, lerMidia })` → `{ bytes, nomeDoArquivo, tipoDeConteudo, cartoesSemMidia }`;
  - `formatos.ts`: `FORMATOS_DE_EXPORTACAO` with the only entry `apkg` (`extensao: "apkg"`, `tipoDeConteudo: "application/octet-stream"`) and `ehFormatoDeExportacao`;
  - `nome-do-arquivo.ts` (research R11);
  - `apkg/colecao.ts`: schema 11 in `sql.js` (`col`, `notes`, `cards`, `revlog`, `graves`), the note type "Memorization" (`Front`, `Back`, `qfmt = {{Front}}`, `afmt = {{FrontSide}}<hr id=answer>{{Back}}`), Deck "Default" (id 1) and one Deck per exported Deck; `sfld` and `csum` as Anki computes them;
  - `apkg/campos.ts`: escaping, Front-Verso fields, and the text-only Front of Image and Audio Cards with the `[Imagem]`/`[Áudio]` fallback from `backend/src/exportacao/textos.ts` (pt, en, es; research R9, R14);
  - `apkg/agendamento.ts`: the R8 table, `crt` and `due` in the given `fuso` (use the date functions of `backend/src/agenda/datas.ts`);
  - `apkg/pacote.ts`: zip with `fflate` (`zipSync`, level 0 for media).

  Note and card ids are increasing millisecond integers from `agora`. Makes T012 and T013 pass.
- [x] T019 [US1] Add `previaDaExportacao(pedido)` and `exportar(pedido)` to the `Acervo` in `backend/src/acervo/acervo.ts`. They read with `lerAcervoParaExportacao` and turn each Agendamento into Progresso through `algoritmoPorId(algoritmo).descreverProgresso(estado)`. They apply `LIMITE_DE_CARTOES_DA_EXPORTACAO = 10_000` before any media read, call `exportar`, store with `guardarExportacao` and map store failures to `exportacao_indisponivel`. The `Acervo` receives the store as it already does for media. Makes T014 pass.
- [x] T020 [US1] Add the routes `POST /exportacoes/previa` and `POST /exportacoes` to `backend/src/http/rotas.ts`, with Zod: `formato` string; `baralhos` = `"todos"` or a non-empty array of distinct UUIDs; `fuso` validated with `ehFusoValido`; `idioma` in `pt|en|es`. Map results with the codes from T010. Do not log body, names or `url`. Makes T015 pass.
- [x] T021 [US1] Create `frontend/src/ui/PaginaDeExportacao.tsx` following `contracts/ui.md` for the entry `?baralho={id}`: title, Deck name, format `<fieldset>`/`<legend>` with one checked radio, the help text, the `aria-live` summary, the "Exportar arquivo" button and the states. Send `fuso` from `Intl.DateTimeFormat().resolvedOptions().timeZone` and `idioma` from the language provider. Download by `window.location.assign(url)` behind a small injectable function so tests can spy on it. Add the section `exportacao` to `frontend/src/idioma/{tipos,pt,en,es}.ts`, and the page styles to `frontend/src/estilos.css` (44 × 44 px targets, no horizontal scroll from 360 px). Makes T016 pass.
- [x] T022 [US1] Add the route `{ nome: "exportar-baralhos"; baralhoId?: string; todos?: boolean }` to `frontend/src/ui/navegacao.ts` (`#/baralhos/exportar`, before the `:id` match) and render it in `frontend/src/ui/Aplicacao.tsx`. Add the "Exportar" button to `frontend/src/ui/PaginaDoBaralho.tsx`, linking to `?baralho={id}`. Makes T017 pass.

**Checkpoint**: one Deck exports end to end in local mode; the file opens in Anki (quickstart 1, 8, 9).

---

## Phase 4: User Story 2 — Exportar vários Baralhos ou o acervo inteiro (Priority: P1)

**Goal**: one file with several Decks or all of them, from the Deck list, and an offer to export before deleting the account.

**Independent Test**: quickstart scenarios 2, 3, 4, 7 and 11.

### Tests first

- [x] T023 [P] [US2] Extend `backend/tests/exportacao/apkg.test.ts` and `nome-do-arquivo.test.ts`: three Decks → three Anki Decks with their own Cards, and no Card in the wrong Deck (SC-185); a chosen Deck without Cards becomes an empty Anki Deck (FR-465); several or all Decks → `memorization-AAAA-MM-DD.apkg`, with the date in the given `fuso` (FR-474).
- [x] T024 [P] [US2] Extend `backend/tests/acervo/exportacao.test.ts`: `baralhos: "todos"` covers every Deck of the User, and Decks without Cards are included in the package, empty, and not refused while some chosen Deck has Cards (FR-465); `"todos"` with no Cards at all → `exportacao_vazia`; a list mixing own and foreign ids → `nao_encontrado`.
- [x] T025 [P] [US2] Extend `frontend/tests/pagina-de-exportacao.test.tsx` for the list entry: a checkbox per Deck with name and Card count; "Todos os Baralhos" checks and unchecks all; the summary updates on each change; nothing checked → button disabled with "Marque ao menos um Baralho" (US2 scenario 4); `?todos=1` opens with all checked.
- [x] T026 [P] [US2] Extend `frontend/tests/pagina-de-baralhos.test.tsx` (the "Exportar" button next to "Importar do Anki") and the account-deletion test (`frontend/tests/secao-minha-conta.test.tsx`, which covers the deletion dialog): the link "Exportar meu acervo antes" leads to `?todos=1`, and deletion stays possible without exporting (FR-479).

### Implementation

- [x] T027 [US2] Support several Decks in `backend/src/exportacao/` (Deck ids and the date-based file name) and in `Acervo.exportar`/`previaDaExportacao` (`"todos"`, empty Decks included, `exportacao_vazia` only when no chosen Deck has Cards). Makes T023 and T024 pass.
- [x] T028 [US2] Add the list mode to `frontend/src/ui/PaginaDeExportacao.tsx` (`contracts/ui.md`, steps 2 and 4), with the summary recomputed through `previaDaExportacao` on each change (debounced, latest response wins). Makes T025 pass.
- [x] T029 [US2] Add the "Exportar" button to `frontend/src/ui/PaginaDeBaralhos.tsx` and the link to `frontend/src/ui/DialogoDeExclusaoDeConta.tsx`, with texts in the three catalogs. Makes T026 pass.

- [x] T041 [P] [US2] Extend the account-deletion section of the Port battery `backend/tests/armazenamento/bateria-da-porta.ts` (SQLite and PostgreSQL; next to "libera o Nome de usuário da conta excluída"): after `excluirUsuario(id)`, `listarMidiaARemover` contains `exportacoes/{id}` along with the User's media keys, in the same transaction (a failure rolls back both). Extend `backend/tests/acervo/exportacao.test.ts`, following the deletion flow already used in `backend/tests/acervo/cartao-com-imagem.test.ts` (excluirUsuario, then processing the queue): account deletion with the Disk store removes the file `exportacoes/{id}`, and a store failure keeps the key queued for the next run (FR-479, research R14).
- [x] T042 [US2] In both Port Adapters (`backend/src/armazenamento/{sqlite,postgresql}/`), make `excluirUsuario` enqueue `exportacoes/{usuarioId}` in `midia_a_remover` in the same transaction that already enqueues the media keys. Confirm `remover` in `armazem-s3.ts` and `armazem-em-disco.ts` accepts a key outside `imagens/`/`audios/`, and that no CHECK on the queue rejects it. Makes T041 pass.

**Checkpoint**: export all Decks from the list and from account deletion; the file opens in Anki and AnkiDroid (quickstart 3, 7, 11).

---

## Phase 5: User Story 3 — Exportar Cartões com Imagem e Áudio (Priority: P2)

**Goal**: Image and Audio Cards go into the package with their media, the summary shows media counts and size, and missing media becomes a warning, and a store outage fails the export (FR-477).

**Independent Test**: quickstart scenarios 2 and 10.

### Tests first

- [x] T030 [P] [US3] Extend `backend/tests/exportacao/apkg.test.ts` with media (use the samples in `backend/tests/midia/amostras.ts` and `amostras-de-audio/`):
  - Image Card → Front `<img src="memorization-{id}.{ext}" alt="{alt escapado}">`, plus `<br>` and the front text when present; the file is in the zip under its number and in `media`; the extension comes from the bytes (JPEG, PNG, WebP, GIF);
  - Audio Card → the escaped Message when present, plus `[sound:memorization-{id}.{ext}]`; MP3, M4A, OGG, WebM and WAV extensions from the bytes;
  - `lerMidia` returning `null` → the Card keeps the US1 text-only Front (T012) and `cartoesSemMidia` counts it (FR-477);
  - `lerMidia` throwing → `exportar` rejects, and no bytes are produced (FR-477).
- [x] T031 [P] [US3] Extend `backend/tests/acervo/exportacao.test.ts`: the preview counts `cartoesComImagem` and `cartoesComAudio` and returns `bytesEstimados` ≥ the sum of `medir` (FR-472); media above `LIMITE_DE_BYTES_DE_MIDIA_DA_EXPORTACAO = 104_857_600` → `exportacao_grande_demais` with `motivo: "midia"` (FR-478); a media key removed from the store between the read and the generation → `cartoesSemMidia: 1`, not a failure; a store whose `ler` throws → `exportacao_indisponivel` and no URL (FR-477, research R15); for a fixture with Image and Audio Cards, `bytesEstimados` is within ±20% of the size of the stored file (FR-472).
- [x] T032 [P] [US3] Extend `frontend/tests/pagina-de-exportacao.test.tsx`: the summary shows "N com Imagem, M com Áudio" and the size formatted with `Intl.NumberFormat` in the three languages; a result with `cartoesSemMidia > 0` announces "{n} cartões foram exportados sem a mídia".

### Implementation

- [x] T033 [US3] Add media to `backend/src/exportacao/apkg/campos.ts` and `pacote.ts`: Image and Audio Fronts, the `media` JSON and the numbered files. Detect the format with `detectarFormato` (`backend/src/midia/imagem/formato.ts`) and `reconhecerAudio` (`backend/src/midia/audio/reconhecer.ts`). Reuse the US1 text-only Front when `lerMidia` returns `null`, and let a thrown error propagate. Makes T030 pass.
- [x] T034 [US3] In `Acervo.previaDaExportacao`/`exportar`, measure media with `medir`, apply the media limit, read media with concurrency 16 into `lerMidia`, and map a thrown store error to `exportacao_indisponivel`. Calibrate the per-Card estimate so the ±20% bound holds. Makes T031 pass.
- [x] T035 [US3] Show media counts, size and the "without media" result in `frontend/src/ui/PaginaDeExportacao.tsx`, with texts in the three catalogs. Makes T032 pass.

**Checkpoint**: a Deck with Image and Audio opens in Anki with the image shown and the audio playing (quickstart 10).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T036 [P] Create `e2e/exportar-baralhos.spec.ts` (Playwright, local mode):
  - export a Deck from its detail and capture the download: name `{Deck}.apkg` and zip signature `PK\x03\x04`;
  - export all from the list;
  - the whole flow by keyboard;
  - no horizontal scroll at 360, 390, 768 and 1440 px and at 200% zoom (apply the zoom before rendering, as in `a8bc7ce`) (FR-483, FR-484, SC-183).
- [x] T037 [P] Update `README.md` and `README.pt-BR.md`: a table row "Export" (Exportar) linking to spec 029, with the format, the limits (10,000 Cards, 100 MiB of media) and the Anki "import learning progress" tip; and the deploy note: run `tofu apply` (with `-var lambda_package` and `-var lambda_handler`) for the `exportacoes/` lifecycle rule.
- [x] T038 Run the full gate `npm run verificar:ci` at the root (gitleaks, backend + PostgreSQL, frontend + build, e2e). Then run quickstart scenarios 1–7 and 13–15 locally.
- [ ] T039 Manual validation in real apps (quickstart 8–12): Anki desktop, AnkiDroid and AnkiMobile (FR-463). Record in the Notes below the stable version of each app on the validation date and whether "Import learning progress" comes checked by default (research R8, `premissa a validar`). Any failure becomes a new failing test in T012/T030 before the fix.
- [ ] T040 After deploy, run quickstart scenario 16 (SC-186, and SC-191: the limit in under 25 s). If the limit does not fit, lower `LIMITE_DE_BYTES_DE_MIDIA_DA_EXPORTACAO` with a research entry, never raise the timeout.

---

## Dependencies & Execution Order

- **Setup (T001–T002)**: independent of each other and of everything else.
- **Foundational (T003–T011)**: the tests T003–T006 run in parallel. T007, T008 and T009 depend on their tests and touch different files. T010 and T011 can run in parallel with them. **Blocks all stories.**
- **US1 (T012–T022)**: the tests T012–T017 run in parallel. Then T018 → T019 → T020 (backend chain), and T021 → T022 (frontend), which can run in parallel with the backend chain once T011 is done.
- **US2 (T023–T029, T041–T042)**: depends on US1 (same Module and page). T027 and T042 are backend (different files); T028 and T029 are frontend. T041/T042 depend only on Phase 2.
- **US3 (T030–T035)**: depends on US1. It can run in parallel with US2 only on different files: T033 (apkg) and T034 (Acervo) conflict with T027, so run them after it.
- **Polish (T036–T040)**: after the desired stories. T038 before any commit of integration; T039 and T040 need the Product Owner and the deploy.

### Parallel examples

- Phase 2 tests: T003, T004, T005, T006 at once (four different files).
- US1 tests: T012, T013, T014, T015, T016, T017 at once.
- US1 implementation: the backend chain T018 → T019 → T020 alongside the frontend chain T021 → T022.

## Implementation Strategy

1. **MVP = Phase 1 + Phase 2 + US1**: one Deck, text Cards, with progress. Validate with quickstart 1, 8 and 9 and stop for review.
2. **US2**: several Decks, all of them and the account-deletion offer. This completes the backup use.
3. **US3**: media. Until it lands, Image and Audio Cards export with their text-only Front from US1 (T012/T018), so no Card is ever silently dropped (SC-185).
4. **Polish**: e2e, README, gates and manual validation.

## Traceability (FR/SC → tasks)

| Requirement | Tests | Implementation |
|---|---|---|
| FR-461 format step | T016 | T021 |
| FR-462 format rules, extensible | T012 | T018 |
| FR-463 opens in Anki apps and in the app | T012 (round trip), T039 | T018 |
| FR-464 one, several or all Decks | T014, T024, T025 | T019, T027, T028 |
| FR-465 Deck → Anki Deck, empty included | T012, T023, T024 | T018, T027 |
| FR-466 texts, Tags, line breaks, escaping | T012 | T018 |
| FR-467 stable identifier | T012, T039 | T018 |
| FR-468 Image and Audio with media | T030 | T033 |
| FR-469 progress | T003, T012 | T007, T018, T019 |
| FR-470 app import ignores progress | T012 (round trip without Agendamento) | — (import unchanged) |
| FR-471 no Routines, stats or History | T012 (`revlog` empty) | T018 |
| FR-472 summary before confirming | T014, T016, T031, T032 | T019, T021, T034, T035 |
| FR-473 consistent snapshot | T004, T014 | T008, T019 |
| FR-474 file name | T013, T023, T036 | T018, T027 |
| FR-475 generating state, no double submit | T016 | T021 |
| FR-476 failure without partial file | T014, T016 | T019, T021 |
| FR-477 missing media; store down fails | T005, T030, T031, T032 | T009, T033, T034, T035 |
| FR-478 limits | T014, T031 | T019, T034 |
| FR-479 offer before account deletion; deletion removes exports | T026, T041 | T029, T042 |
| FR-480 only own collection, Entrar required, no user identity in file | T004, T012, T014, T015 | T008, T018, T019, T020 |
| FR-481 address ≤ 15 min, file gone ≤ 48 h | T005 | T001, T009 |
| FR-482 no names, content or URLs in logs | T015 | T020 |
| FR-483 keyboard and screen reader | T016, T036 | T021 |
| FR-484 360–1440 px and 200% zoom | T036, T002 | T021 |
| FR-485 three languages | T011, T016, T030, T032 | T011, T021, T033, T035 |
| FR-486 stable codes, English messages | T006, T015 | T010, T020 |
| SC-183 ≤ 3 interactions | T036 | T022 |
| SC-184 Anki texts; app round trip | T012, T039 | T018 |
| SC-185 every Card once, right Deck | T012, T023 | T018, T027 |
| SC-186 1,000 Cards ≤ 10 s | T040 | T019 |
| SC-187 no file without Entrar or for others | T014, T015 | T019, T020 |
| SC-188 three languages, English technical | T006, T016 | T010, T011, T021 |
| SC-189 Anki media and dates | T012, T030, T039 | T018, T033 |
| SC-191 limit in ≤ 25 s | T040 | T019, T034 |
| SC-190 new format without changing scenarios | T012 (`FORMATOS_DE_EXPORTACAO`) | T018 |

## Notes

- T001: a regra de lifecycle está implementada, mas `tofu validate` não concluiu porque o provider AWS v6.65.0 para Darwin arm64 falhou durante o handshake do plugin; nenhuma aplicação foi feita.
- T038: gate completa executada em 2026-10-15 com sucesso: gitleaks, backend (1.202 testes), PostgreSQL (286), frontend (1.058) e E2E (111). Os cenários cobertos pelo fluxo local foram exercitados na suíte.
- T039 e T040: pendentes por exigirem aplicativos Anki instalados e deploy, respectivamente.

- A worker that finds an architectural ambiguity stops and reports it. It does not decide.
- The first `/speckit-analyze` decisions (research R14) are already reflected: full SC-184 equivalence, empty Decks included, text-only Front in US1, and export removal on account deletion (T041, T042). T041 and T042 were added after the analyze and keep their IDs to avoid renumbering.
