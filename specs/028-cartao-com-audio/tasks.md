---
description: "Task list for Cartão com Áudio"
---

# Tasks: Cartão com Áudio

**Input**: Design documents from `specs/028-cartao-com-audio/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/http.md`, `contracts/ui.md`, `quickstart.md`

**Tests**: Required by the constitution (Principles V and IX). Write each story's tests first and confirm they fail before implementing. Every FR maps to at least one test task (see Traceability).

**Execution note**: The architect reviews every diff and runs the gates (Principle VI). Workers:
- never commit;
- never delete or weaken tests;
- edit existing files instead of overwriting them;
- never run in parallel on the same file, shared test files included.

All new product text goes to the three typed catalogs `frontend/src/idioma/{pt,en,es}.ts` (027 test T011 forbids loose text). All new server messages are English ASCII.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Rename the file-store Seam to Mídia, with no behavior change, and build the prototype.

- [X] T001 Rename the Module `backend/src/imagens/` to `backend/src/midia/` with `git mv` (research R2). No behavior change.
  - Move `armazem.ts`, `armazem-s3.ts`, `armazem-em-disco.ts` and `configuracao.ts`.
  - Move the image rules `detectarFormato`, `prepararImagemConfirmada` and `metadados.ts` to `backend/src/midia/imagem/{formato,metadados}.ts`.
  - Rename the Interface `ArmazemDeImagens` to `ArmazemDeMidia` and `processarFilaDeImagens` to `processarFilaDeMidia`.
  - Update every import in `backend/src` and `backend/tests` (13 files, 27 references in total, including `acervo/acervo.ts`, `identidade/identidade.ts`, `http/rotas.ts`, `entradas/{local,nuvem}.ts` and `funcao/funcao.ts`).
  - Move `backend/tests/imagens/` to `backend/tests/midia/` and update its imports.
  - Keep the bucket name, `NOME_DO_BUCKET_DE_IMAGENS`, `CAMINHO_DAS_IMAGENS` and the folder `imagens-locais/`.
  - Gate: `cd backend && rtk npm test && rtk npm run typecheck && rtk npm run lint` green, with test counts unchanged.
- [X] T002 Rename the Adapter Disco routes from `/imagens-locais/*` to `/midia-local/*` (research R2):
  - `CAMINHO_DO_ENVIO_LOCAL` and `CAMINHO_DA_LEITURA_LOCAL` in `backend/src/midia/armazem-em-disco.ts`;
  - the credential exemption prefix in `backend/src/http/credencial.ts:89` and `backend/src/http/servidor.ts:397`;
  - rename `backend/src/http/imagens-locais.ts` to `backend/src/http/midia-local.ts` (`registrarRotasDeMidiaLocal`) and update `backend/src/entradas/local.ts`;
  - update the tests that cite the old prefix.

  Same gate as T001, plus `rtk npx playwright test --config e2e/playwright.config.ts cartao-com-imagem` green.
- [X] T003 [P] Update only the comments of `backend/terraform/s3-imagens.tf` to describe Mídia: Imagens in `imagens/` up to 5 MB, Áudios in `audios/` up to 10 MB, the same lifecycle, IAM and CORS (research R10). Gate: `tofu validate`.
- [X] T004 [P] Build the standalone prototype `design/cartao-com-audio/` (`index.html`, `app.js`, `style.css`, `README.md`, `verificar.mjs`), reusing `../../frontend/src/estilos.css` and following `contracts/ui.md`. It shows:
  - the selector with Frente-Verso, Imagem and Áudio, announced field swap;
  - the file field with the help text;
  - pre-listen with Trocar/Remover;
  - the player (Tocar/Pausar, position range, time `m:ss / m:ss`, live status);
  - a list item with type label and duration;
  - the study face before and after reveal;
  - "Áudio indisponível";
  - a PT/EN/ES toggle.

  `verificar.mjs` checks these in Chromium at 360, 390, 768 and 1440 px and at 200% zoom, with no horizontal scroll and the player operable by keyboard.

**Checkpoint**: backend gates green after the rename; the prototype verifier passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema v20/v21, the type union, audio recognition and the Mídia-aware store. All stories depend on this phase.

### Tests first

- [X] T005 [P] Create `backend/tests/acervo/migracao-tipo-audio.test.ts` (SQLite).
  - **v19 base with Frente-Verso and Imagem Cartões, Pertencimentos, Agendamentos and Histórico**: after opening, the version is 21 and every row is unchanged (SC-182).
  - **Checks**:
    - `tipo IN ('frente-verso','imagem','audio')`;
    - `(tipo = 'audio') = (audio_chave IS NOT NULL)`;
    - `(audio_chave IS NULL) = (audio_duracao_ms IS NULL)`;
    - `audio_duracao_ms BETWEEN 1 AND 300000`;
    - an `audio` with empty `frente` is accepted;
    - a `frente-verso` with empty `frente` is still refused;
    - `item_de_registro.tipo` accepts `'audio'`;
    - `midia_a_remover` exists with the rows of `imagem_a_remover`, and `imagem_a_remover` is gone;
    - `PRAGMA foreign_key_check` is empty, and the cascades from `cartao` to `pertencimento` and agendamento still work.
  - **v17 base with a Cartão without Pertencimento** (research R6): opening reaches v20 with `vinculo` still present. Then create the Pertencimento and reopen: v21, `vinculo` gone, and the default labels of `registro_de_sessao` are `''`, as in migration 19.
- [X] T006 [P] Create `backend/tests/armazenamento/postgresql/migracao-tipo-audio.test.ts` with the same assertions for PostgreSQL. Add to `backend/tests/armazenamento/postgresql/migracoes.test.ts` the version parity with SQLite (21) and `versaoAceitaNoInicio(20) === true` while only 21 is pending.
- [X] T007 [P] Create the in-code audio samples `backend/tests/midia/amostras-de-audio.ts` (no binaries, no ffmpeg; research R11). Builders take a duration and optional metadata:
  - `mp3({ quadros, id3v2?, id3v1?, ape? })`: silent MPEG-1 Layer III frames, 44.1 kHz;
  - `m4a({ duracaoMs, udta?, meta?, video? })`: `ftyp`, then `moov` with `mvhd`, a `soun` `trak` (`mdhd`, `stsd` with `mp4a`), optional `udta`/`meta` with `©nam`/`©ART`/`©xyz`, then `mdat`;
  - `ogg({ codec: "vorbis" | "opus", granulo, comentarios?, capa? })`: valid page CRCs;
  - `webm({ duracao?: number, clusters, tags?, anexos?, titulo?, video? })`: an `A_OPUS` track;
  - `wav({ segundos, taxa, canais, bits, list? })`: PCM.
- [X] T008 [P] Create `backend/tests/midia/audio.test.ts` through `reconhecerAudio(bytes)` only (FR-436, FR-437, FR-454; research R3, R4).
  - **Acceptance**: each format is accepted with the right `formato` and `duracaoMs`, within ±1 frame for MP3 and exact for WAV, M4A, OGG and WebM-with-Duration. WebM without `Duration` is measured from the clusters.
  - **Duration**: 300,000 ms is accepted; 300,001 ms is `duracao`; zero duration is `formato`.
  - **Size**: 10,485,761 B is `tamanho`; 0 B is `tamanho`.
  - **Wrong content** (`formato`): text renamed `.mp3`; a PNG; a truncated file of each format; M4A with a `vide` track; WebM with a video track; OGG FLAC; WAV with format tag 2 (ADPCM).
  - **Metadata**: after cleaning, none of the strings "Titulo Secreto", "Artista Secreto", "GPS -23.5" or the cover bytes remain in the bytes. Recognizing the cleaned bytes again gives the same `formato` and `duracaoMs`. MP3 output is shorter (ID3 removed); M4A, OGG, WebM and WAV keep the same length.
  - **Robustness**: declared sizes larger than the file, a zero-size box or element, and self-referencing sizes all end within 100 ms with `formato`.
- [X] T009 [P] Parametrize the contract battery `backend/tests/midia/bateria-do-armazem.ts` by Mídia, keeping every existing image case.
  - **Audio cases**:
    - `prepararEnvio(u, "audio")` limit 10,485,760 B;
    - an upload of 10,485,760 B is accepted and 10,485,761 B is refused;
    - `confirmar(u, id, "audio")` returns `duracaoMs` and a key under `audios/{u}/`;
    - `confirmar(u, id, "imagem")` on an audio upload is `formato`;
    - `confirmar(u, id, "audio")` on an image upload is `formato`;
    - the read URL serves the audio `Content-Type`.
  - **Adapter Disco Range**: `Range: bytes=0-99` gives `206`, `Content-Range` and 100 bytes; no Range gives `200` with `Accept-Ranges: bytes`.

  Runners stay `backend/tests/midia/armazem-em-disco.test.ts` (always) and `armazem-s3.test.ts` (MinIO when `S3_DE_TESTE_ENDERECO` is set).
- [X] T010 [P] Extend `backend/tests/mensagens/recusas.test.ts` so `audio_ausente` and `audio_invalido` exist in `MENSAGENS_TECNICAS`, are ASCII-only English, and the HTTP body of `audio_invalido` carries `motivo` ∈ `nao_encontrado | formato | tamanho | duracao` and `limite` (FR-459).

### Implementation

- [X] T011 Add `"audio"` to `TipoDeCartao` in `backend/src/armazenamento/porta.ts`. Add `audioChave?: string` and `audioDuracaoMs?: number` to the stored Cartão, and `"audio"` to the snapshot item `tipo`. Rename the queue operations from image to Mídia in the Port: table `midia_a_remover`, same signatures.
- [X] T012 Add migrations 20 and 21 to `backend/src/armazenamento/sqlite/migracoes.ts`, per data-model.md, with comments in the style of 17 and 19.
  - **Migration 20** (`semChavesEstrangeiras: true`, no precondition) rebuilds `cartao` with:
    - `tipo IN ('frente-verso','imagem','audio')`;
    - `audio_chave TEXT NULL`, `audio_duracao_ms INTEGER NULL`;
    - `CHECK ((tipo = 'audio') = (audio_chave IS NOT NULL))`;
    - `CHECK ((audio_chave IS NULL) = (audio_duracao_ms IS NULL))`;
    - `CHECK (audio_duracao_ms IS NULL OR audio_duracao_ms BETWEEN 1 AND 300000)`;
    - `CHECK (tipo IN ('imagem','audio') OR length(trim(frente)) > 0)`;
    - the Imagem checks unchanged;
    - the index recreated.

    It also rebuilds `item_de_registro` with `tipo IN ('frente-verso','imagem','audio')` (all columns, indexes and FKs preserved) and runs `ALTER TABLE imagem_a_remover RENAME TO midia_a_remover`.
  - **Migration 21** (`precondicao: PODE_REMOVER_VINCULO`): `DROP TABLE IF EXISTS vinculo;` plus the exact `UPDATE registro_de_sessao …` of 19.

  Makes T005 pass.
- [X] T013 Add migrations 20 and 21 to `backend/src/armazenamento/postgresql/migracoes.ts` with `DROP/ADD CONSTRAINT` and `ADD COLUMN` (no rebuild). Check that `versaoAceitaNoInicio` in `backend/src/armazenamento/postgresql/esquema.ts` accepts 20. Makes T006 pass.
- [X] T014 [P] Persist and read `audio_chave` and `audio_duracao_ms`, and use `midia_a_remover`, in the SQLite Adapter `backend/src/armazenamento/sqlite/`. Extend `backend/tests/armazenamento/bateria-da-porta.ts` with: an audio Cartão round-trip, the queue filled in the same transaction as card, deck and user deletion, and an audio snapshot `tipo`.
- [X] T015 [P] Same as T014 for the PostgreSQL Adapter `backend/src/armazenamento/postgresql/armazenamento.ts`. Keep the 027 `CASE versao >= 19` insert.
- [X] T016 [P] Implement `backend/src/midia/audio/mp3.ts`:
  - skip ID3v2;
  - require ≥ 3 consecutive valid Layer III headers;
  - sum the duration over all frames;
  - clean by removing ID3v2, ID3v1, APEv2 and Lyrics3.

  Returns `{ formato: "audio/mpeg", duracaoMs, limpar }` or `null`. Bounded loops, never trusting a declared size beyond the buffer.
- [X] T017 [P] Implement `backend/src/midia/audio/mp4.ts`:
  - walk the boxes with bounds checks;
  - require a `soun` track with `mp4a` and no `vide` track;
  - take the duration from `mdhd`, refusing a fragmented file with zero duration;
  - clean by renaming `udta`, `meta` and top-level `uuid` to `free` and zeroing the payload, at the same size.
- [X] T018 [P] Implement `backend/src/midia/audio/ogg.ts`:
  - check page CRCs;
  - require the first packet to be `\x01vorbis` or `OpusHead`;
  - take the duration from the last granule (Vorbis ÷ rate; Opus (− pre-skip) ÷ 48000);
  - clean by overwriting each comment with `X=` plus spaces at the same length (`METADATA_BLOCK_PICTURE` included), keeping the vendor, and recomputing the CRC of the changed pages.
- [X] T019 [P] Implement `backend/src/midia/audio/webm.ts`:
  - read EBML VINTs with bounds;
  - require `DocType` `webm`, an `A_OPUS` audio track and no video track;
  - take the duration from `Info/Duration × TimecodeScale`, otherwise from the last Cluster timecode plus the last block;
  - clean by turning `Tags`, `Attachments` and `Info/Title` into `Void` (`0xEC`) of the same total size with zeroed payload.
- [X] T020 [P] Implement `backend/src/midia/audio/wav.ts`:
  - require `RIFF/WAVE` with `fmt ` and `data`;
  - accept format 1, format 3, or `WAVE_FORMAT_EXTENSIBLE` with those subformats;
  - duration = data size ÷ byteRate;
  - clean by renaming `LIST`, `id3 `, `ID3 `, `bext`, `iXML` and `_PMX` to `JUNK` with zeroed payload.
- [X] T021 Implement `backend/src/midia/audio/reconhecer.ts`. `reconhecerAudio(bytes)`:
  - checks size 1…10,485,760;
  - tries the five recognizers;
  - checks the duration (> 0 and ≤ 300,000 ms);
  - returns `{ ok: true, formato, duracaoMs, bytes: limpos }` or `{ ok: false, motivo: "formato" | "tamanho" | "duracao" }`.

  Makes T008 pass.
- [X] T022 Generalize the store in `backend/src/midia/armazem.ts` and add `backend/src/midia/regras.ts` (research R2).
  - Types: `type Midia = "imagem" | "audio"` and `REGRAS_DA_MIDIA` (limit in bytes, formats, active-key prefix `imagens/` or `audios/`, and `confirmar(bytes)` using `prepararImagemConfirmada` or `reconhecerAudio`).
  - New Interface signatures: `prepararEnvio(usuarioId, midia)` and `confirmar(usuarioId, envioId, midia)`, which returns `duracaoMs` for audio.
  - Rename `MotivoDeRecusaDaImagem` to `MotivoDeRecusaDaMidia = "nao_encontrada" | "formato" | "tamanho" | "duracao"`.
- [X] T023 Update `backend/src/midia/armazem-em-disco.ts` and `backend/src/http/midia-local.ts`:
  - the token carries the Mídia;
  - the upload limit comes from it, and the multipart `bodyLimit` uses the largest limit plus margin;
  - `lerParaEntrega` serves the `imagens/` and `audios/` prefixes with the `Content-Type` of the recognized format;
  - the route answers `Range` with `206`/`Content-Range` and `Accept-Ranges: bytes`.

  Makes the Disco runner of T009 pass.
- [X] T024 Update `backend/src/midia/armazem-s3.ts`: `content-length-range` from `REGRAS_DA_MIDIA[midia]`, `confirmar` per Mídia with the active key under the right prefix and `Content-Type`. The MinIO runner of T009 passes when configured.
- [X] T025 [P] Add `audio_ausente` ("Choose an audio file.") and `audio_invalido` ("Audio is invalid.") to `CodigoDeRecusa` and `MENSAGENS_TECNICAS` in `backend/src/http/recusas.ts`. Map the store `motivo` to `nao_encontrado`, `formato`, `tamanho` (`limite: 10485760`) or `duracao` (`limite: 300`) per contracts/http.md. Makes T010 pass.
- [X] T026 [P] Frontend foundation:
  - add `"audio"` to `TipoDeCartao` and `audio?: { url; expiraEm } | null` and `duracaoMs?: number` to `Cartao` in `frontend/src/acervo-cliente/cliente.ts`;
  - add the matching fields to `ApresentacaoDoTipo` in `frontend/src/sessao-de-estudo/sessao-de-estudo.ts`;
  - in `frontend/src/idioma/{tipos,pt,en,es}.ts`, add `cartao.nomeDoTipo.audio` and all keys of contracts/ui.md, using the R8 glossary (Áudio / Audio / Audio, Mensagem / Message / Mensaje, Tocar / Play / Reproducir, Pausar / Pause / Pausar …).

  `rtk npm run build` (tsc) proves all three catalogs are complete.
- [X] T027 [P] Create `frontend/src/idioma/duracao.ts`:
  - `formatarDuracao(ms, locale)` gives `m:ss` with `Intl.NumberFormat` digits;
  - `duracaoFalada(ms, locale)` uses `Intl.NumberFormat` `style: "unit"` (`minute`/`second`, `unitDisplay: "long"`) joined by `Intl.ListFormat`.

  Write `frontend/tests/idioma-duracao.test.ts`: 0, 5 s, 64 s and 300 s in pt-BR, en-US and es-419, e.g. "1 minuto e 4 segundos", "1 minute and 4 seconds", "1 minuto y 4 segundos". Write the test first.

**Checkpoint**: backend and frontend gates green; schema at v21; `reconhecerAudio` proven; the store accepts audio.

---

## Phase 3: User Story 1 — Criar um Cartão com Áudio (Priority: P1) 🎯 MVP

**Goal**: choose Áudio, upload, pre-listen and save a Cartão do tipo Áudio in the Baralho, in the three languages.

**Independent Test**: in a Baralho, choose Áudio, pick a valid file, listen, fill the Verso, save. The Cartão is listed and persists after reload.

### Tests first

- [X] T028 [P] [US1] Create `backend/tests/acervo/cartao-com-audio.test.ts` (SQLite and Disco) through the `Acervo` Interface:
  - create `audio` with `audioId` and empty `frente`: stored with `audio_chave` under `audios/{u}/` and `audio_duracao_ms`;
  - missing `audioId` is `audio_ausente`;
  - empty or > 1000 Verso, and > 1000 Mensagem, are refused with the existing codes (FR-434, FR-435);
  - two audio Cartões without Mensagem in one Baralho are both accepted; equal Mensagem gets ` (2)` (FR-439);
  - an invalid upload is `audio_invalido` with `motivo`, and the pending file is deleted;
  - a write failure after `confirmar` leaves the key in `midia_a_remover`, then removed, so nothing is orphaned (FR-451);
  - another user's `audioId` is `nao_encontrado` (FR-453).
- [X] T029 [P] [US1] Create `backend/tests/http/cartao-com-audio.test.ts`:
  - `POST /audios/envios` without Entrar is `401`; with Entrar it is `201` with `audioId`, `envio`, `expiraEm`, `limiteEmBytes: 10485760`, `limiteEmSegundos: 300` and the five `formatos`;
  - create with `tipo: "audio"` is `201` with `duracaoMs` and `audio.url`;
  - `400 audio_ausente`;
  - `422 audio_invalido` with each `motivo` and `limite`;
  - error bodies and server logs contain neither the URL, the Mensagem nor the file name (FR-455).
- [X] T030 [P] [US1] Create `frontend/tests/formulario-de-cartao-com-audio.test.tsx` (Testing Library, `ClienteEmMemoria`):
  - the selector lists Frente-Verso, Imagem and Áudio in that order and starts at Frente-Verso on every opening (FR-432);
  - choosing Áudio announces "Campos do tipo Áudio" and shows Áudio, Mensagem (with the FR-457 help) and Verso;
  - switching keeps Verso, Tags and Frente ↔ Mensagem ↔ Texto da frente (FR-433);
  - switching away with an audio picked opens the discard dialog with focus on Cancelar, and Cancelar keeps the type and file;
  - pre-listen shows the player, the file name verbatim, and Trocar/Remover (FR-438);
  - wrong type, > 10 MB or > 5 min (duration read from a mocked `loadedmetadata`) is refused at the field with `aria-invalid` and focus, keeping other values;
  - saving announces "Enviando áudio…";
  - a server refusal goes to the Áudio field with focus;
  - the whole flow works by keyboard (FR-456);
  - after saving with the form still open, the Áudio type is kept (FR-432);
  - the same flow renders in EN and ES with the catalog texts, and the user content stays verbatim (FR-458, FR-460);
  - `navigator.mediaDevices.getUserMedia` is never called (FR-440).
- [X] T031 [P] [US1] Create `frontend/tests/tocador-de-audio.test.tsx` for `AudioDoCartao` (mock `HTMLMediaElement.play/pause`):
  - never autoplays (`autoplay` absent, `preload="metadata"`);
  - the button's accessible name switches between "Tocar áudio" and "Pausar áudio" (localized), with no `aria-pressed`, so the state is not announced twice;
  - the range has a label and `aria-valuetext` from `duracaoFalada`;
  - arrows move ±5 s, Home goes to the start and End to the end;
  - time text uses `formatarDuracao`;
  - the live status says Tocando, Pausado and Fim do áudio;
  - starting a second player pauses the first (FR-443);
  - unmounting pauses;
  - an `error` calls `renovar` once, then shows "Áudio indisponível" (FR-444);
  - switching the language mid-play keeps playing and relabels (FR-458);
  - targets are ≥ 44 px (FR-456).
- [X] T032 [P] [US1] Extend `frontend/tests/acervo-cliente/` (the Seam battery that runs on both Adapters) with `enviarAudio(arquivo)` (research R13: sibling of `enviarImagem`): success returns `audioId`; format, size and duration refusals; `enviarImagem` unchanged.

### Implementation

- [X] T033 [US1] Add the `audio` entry to `backend/src/acervo/tipos-de-cartao.ts`:
  - `validar` checks the Mensagem limit, then Verso, then `temAudio`, returning `audio_ausente`;
  - `chaveDaFrente` is `null` when the text is empty;
  - `ehTipoDeCartao` accepts `"audio"`;
  - `DadosDoTipo.audioId?`.
- [X] T034 [US1] Update `criarCartao` and `editarCartao` (audio path) in `backend/src/acervo/acervo.ts`: `confirmar(…, "audio")`, store the key and `duracaoMs`, put the key on the queue after a failure, and attach `audio` (15-min address) and `duracaoMs` on read. Makes T028 pass.
- [X] T035 [US1] In `backend/src/http/rotas.ts`:
  - add `POST /audios/envios` (requires Entrar; body per contracts/http.md);
  - extend the Zod schema with `tipo: "audio"` and `audioId`;
  - map `audio_invalido` to `422` with `motivo`/`limite`.

  Wire the store in `backend/src/entradas/{local,nuvem}.ts` and `backend/src/funcao/funcao.ts` if signatures changed. Makes T029 pass.
- [X] T036 [US1] Add `enviarAudio(arquivo)` next to `enviarImagem` (research R13) in `frontend/src/acervo-cliente/cliente.ts`, `cliente-http.ts` (`POST /imagens/envios` or `/audios/envios`) and `cliente-em-memoria.ts` (simulated format, size and duration refusals). Update the image callers. Makes T032 pass.
- [X] T037 [US1] Add the `audio` entry to `frontend/src/acervo-cliente/tipos-de-cartao.ts`:
  - `validar` checks the Verso, the Mensagem limit and `temAudio`;
  - `textosPesquisaveis` is `[frente, verso]`;
  - `conferirArquivoDeAudio` checks type or extension `.mp3/.m4a/.ogg/.opus/.webm/.wav` and the 10,485,760 B limit;
  - `ORDEM_DOS_TIPOS = ["frente-verso","imagem","audio"]`;
  - `camposDoTipo` sends `tipo: "audio"` and `audioId`.

  Add the client refusal texts to `frontend/src/idioma/recusas.ts` and `frontend/src/idioma/mensagens.ts`, with translation-memory entries.
- [X] T038 [US1] Create `frontend/src/ui/tipos-de-cartao/tocador-ativo.ts` (the coordinator that pauses the previous player) and `frontend/src/ui/tipos-de-cartao/AudioDoCartao.tsx` per contracts/ui.md, variants `compacto` and `face`. All text comes from `useIdioma()`. Makes T031 pass.
- [X] T039 [US1] Update `frontend/src/ui/PaginaDoFormularioDeCartao.tsx`:
  - the Áudio option;
  - the Áudio field with `accept` per contracts/ui.md and help text;
  - pre-listen with `URL.createObjectURL` (revoked on change and unmount);
  - duration read locally from `loadedmetadata`;
  - Trocar/Remover;
  - the Mensagem label and help (FR-457);
  - the discard dialog covering audio;
  - the "Enviando áudio…" announcement;
  - the refusal-to-field mapping `audio_ausente`/`audio_invalido` → `"audio"`.

  Makes T030 pass.
- [X] T040 [US1] Add player and audio-field styles to `frontend/src/estilos.css`: 44 px targets, no horizontal overflow from 360 px, at 200% zoom, no progress animation under `prefers-reduced-motion`.
- [X] T041 [US1] Create `e2e/cartao-com-audio.spec.ts` (create part). Build a WAV in the test:
  - choose Áudio, pick the WAV, pre-listen with keyboard play and pause, fill the Verso, save;
  - the list shows "Áudio" and the duration;
  - reload persists;
  - a `.txt` renamed `.mp3` is refused after upload with fields kept;
  - the creation takes at most 6 interactions besides typing, counting clicks, key presses on controls and file choices (SC-175).

**Checkpoint**: US1 independently demonstrable (MVP).

---

## Phase 4: User Story 2 — Estudar Cartões com Áudio (Priority: P1)

**Goal**: list, filter, search and study audio Cartões; Histórico without the audio.

**Independent Test**: create an audio Cartão, study it (play, reveal, rate) and confirm Agendamento and Histórico.

### Tests first

- [X] T042 [P] [US2] Extend `backend/tests/acervo/cartao-com-audio.test.ts`:
  - reading a Baralho, `GET /cartoes`, the agenda and the session start return `tipo: "audio"`, `duracaoMs` and `audio.url` only to the owner;
  - a signing failure gives `audio: null`;
  - the session snapshot stores `tipo: "audio"`, `frente` and `verso` and never the key (FR-447);
  - rating updates the Agendamento as for other types.
- [X] T043 [P] [US2] Create `frontend/tests/estudo-com-audio.test.tsx`:
  - the detail list shows the "Áudio" label, the compact player and the duration with the spoken accessible name (FR-441);
  - the Tipo filter offers Áudio and filters (FR-445);
  - search finds by Mensagem and Verso;
  - in the Session, the Mensagem and player show before reveal and the Verso after;
  - playing then revealing does not pause; moving to the next item pauses (FR-442), even when the next item is the same Cartão again (consecutive repetition);
  - "Áudio indisponível" keeps the Mensagem and does not block rating (FR-444);
  - the Histórico (`PaginaDoRegistro`) shows "Cartão do tipo Áudio", the Mensagem or "sem mensagem", and no player;
  - all of it in PT, EN and ES.

### Implementation

- [X] T044 [US2] Make sure every read path in `backend/src/acervo/acervo.ts` (listing, agenda, session start, `salvarSelecaoComoBaralho` result) attaches `audio` and `duracaoMs`, and `registrarSessao` snapshots `tipo: "audio"`. Makes T042 pass.
- [X] T045 [US2] Update `frontend/src/ui/tipos-de-cartao/ResumoDoCartao.tsx` (label, compact player, duration, Mensagem only when not empty) and `rotuloDoCartao` (Mensagem, otherwise the localized "Áudio do Cartão").
- [X] T046 [US2] Update `frontend/src/ui/tipos-de-cartao/FaceDaPergunta.tsx` and `frontend/src/ui/PaginaDeEstudo.tsx`: the audio face keyed by the item's position in the Session (not only `cartaoId`), so every next item unmounts and pauses, even when the same Cartão repeats; `renovar` reused for audio.
- [X] T047 [US2] Update `frontend/src/ui/PaginaDoRegistro.tsx` (Histórico label for `audio`) and the Tipo filter in `frontend/src/acervo-cliente/busca-no-acervo.ts` and `frontend/src/ui/PaginaDoBaralho.tsx`, with the option text from the catalogs. Makes T043 pass.
- [X] T048 [US2] Extend `e2e/cartao-com-audio.spec.ts` (study part):
  - study the Baralho, play by keyboard, reveal (still playing), rate, move on (paused);
  - the Histórico shows "Cartão do tipo Áudio";
  - the Tipo filter shows only audio Cartões;
  - two players in the list: starting the second pauses the first;
  - with a 1 MB audio served by the Adapter Disco, the time from the Tocar press to the first `playing` event is ≤ 2 s (SC-180, local proxy; the production check is quickstart scenario 15).

**Checkpoint**: US1 and US2 work together.

---

## Phase 5: User Story 3 — Editar, copiar e excluir (Priority: P2)

**Goal**: edit texts and audio, copy, delete, with files removed.

**Independent Test**: edit an audio Cartão swapping the audio, then delete it. The old and the deleted audio are no longer accessible.

### Tests first

- [X] T049 [P] [US3] Extend `backend/tests/acervo/cartao-com-audio.test.ts`:
  - editing with a new `audioId` replaces the key and queues the old one;
  - editing without `audioId` keeps the audio;
  - a `tipo` change is `tipo_imutavel` (FR-448);
  - the Cópia via `salvarSelecaoComoBaralho` gets its own key, and deleting the original keeps the copy's audio (FR-450);
  - deleting the Cartão, the Baralho and the account empties the audio keys through the queue;
  - a store failure keeps them in `midia_a_remover` until the next pass (FR-449).
- [X] T050 [P] [US3] Extend `backend/tests/http/cartao-com-audio.test.ts` with `PUT /cartoes/{id}`: replace audio, keep audio, and `409 tipo_imutavel`.
- [X] T051 [P] [US3] Create `frontend/tests/editar-cartao-com-audio.test.tsx`:
  - the type shows as "Tipo: Áudio" with no selector;
  - the current audio has a player;
  - Trocar áudio works;
  - Remover áudio then saving is refused with "Escolha um áudio." and focus on the field;
  - when the current audio fails to load, the edit shows "Áudio indisponível" after one renewal, and the texts stay editable (FR-444);
  - in PT, EN and ES.

### Implementation

- [X] T052 [US3] Complete the edit, copy and delete paths for audio in `backend/src/acervo/acervo.ts` (queue in the same transaction, `copiar` before the transaction, queued on failure) and `backend/src/identidade/identidade.ts` (account deletion uses `midia_a_remover`). Makes T049 and T050 pass.
- [X] T053 [US3] Update the edit mode of `frontend/src/ui/PaginaDoFormularioDeCartao.tsx`: current-audio player, Trocar/Remover, the required-audio refusal. Makes T051 pass.
- [X] T054 [US3] Extend `e2e/cartao-com-audio.spec.ts` (maintenance part):
  - edit swapping the audio; the new one plays;
  - delete the Cartão; the file is gone from the local folder `imagens-locais/audios/…`.

**Checkpoint**: all stories complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T055 [P] Prove in `backend/tests/acervo/importacao-anki.test.ts` that an Anki package with `[sound:…]` media still creates only `frente-verso` Cartões and ignores the sound (FR-452).
- [X] T056 [P] Extend `e2e/idioma-da-interface.spec.ts` (or `e2e/cartao-com-audio.spec.ts`): with an audio loaded, switching PT → EN → ES relabels the selector, the player, the duration and the refusals, keeps playing, and leaves the Mensagem, Verso and file name unchanged (FR-458 to FR-460, SC-181).
- [X] T057 [P] Add audio layouts to `e2e/cartao-com-audio.spec.ts`: form, list and study at 360, 390, 768 and 1440 px and 200% zoom, with no horizontal scroll and player targets ≥ 44 px (FR-446). Validate on Linux with colima, the Playwright image and `fonts-dejavu-core`.
- [X] T058 Run `frontend/tests/idioma-sem-texto-solto.test.ts` and `frontend/tests/idioma-catalogos.test.ts` unchanged. They must pass, with no new loose text or empty catalog value. Fix the product, never the test.
- [X] T059 Update the documentation of the changed behavior **in the same commit as the behavior it describes** (constitution, Documentação and Fluxo de Trabalho). If T001/T002 ship as a separate refactor commit, their doc changes go with it. Documentation: the `README.md` section on card types (Áudio, formats, limits, `audios/` prefix, `/midia-local/` routes) and the deploy note (migrate Neon to v21 before the Lambda).
- [X] T060 Run the full gate `npm run verificar:ci` at the root (gitleaks, backend + PostgreSQL, frontend + build, e2e). Then run the quickstart scenarios 1–13 locally.
- [ ] T061 Manual validation with real files (quickstart scenario 14): an iPhone M4A, an Android OGG/Opus and an MP3 with cover art. Accepted, duration matches, metadata gone. Record the result in the Notes below. Any failure becomes a new failing test in T008 before the fix.

---

## Dependencies & Execution Order

- **Setup (T001–T004)**: T001 → T002, sequential (same files). T003 and T004 in parallel with them.
- **Foundational (T005–T027)**: depends on T001 and T002.
  - Tests T005–T010 in parallel.
  - T011 → T012/T013 → T014/T015.
  - T016–T020 in parallel → T021 → T022 → T023/T024.
  - T025, T026 and T027 are independent.
- **US1 (T028–T041)**: depends on Foundational. Tests in parallel. Then T033 → T034 → T035 on the backend; T036 → T037 → T038 → T039 → T040 on the frontend; T041 last.
- **US2 (T042–T048)**: depends on US1 (it needs created audio Cartões). T045, T046 and T047 touch different files and can run in parallel.
- **US3 (T049–T054)**: depends on US1. It can run in parallel with US2, except for shared files (`acervo.ts`, `PaginaDoFormularioDeCartao.tsx`, `e2e/cartao-com-audio.spec.ts`), which must be sequenced.
- **Polish (T055–T061)**: after all stories.

### Parallel examples

- Foundational: T016, T017, T018, T019 and T020 (one container each), plus T005, T006, T007, T009, T010 and T027.
- US1 tests: T028, T029, T030, T031 and T032 together.
- US2: T045, T046 and T047 together, after T044.

## Implementation Strategy

1. **MVP**: Setup, Foundational and US1. Audio Cartões can be created and listed in three languages. Stop and validate with quickstart scenarios 1–5.
2. US2 makes them studiable (quickstart 6–7).
3. US3 adds maintenance and file lifecycle (quickstart 8–9).
4. Polish: Anki, i18n end to end, layouts, docs, full gate, real files.

## Traceability (FR/SC → tasks)

| Requirement | Tests | Impl |
|---|---|---|
| FR-431 | T005, T006 | T011–T015, T026 |
| FR-432 | T030 | T037, T039 |
| FR-433 | T030 | T039 |
| FR-434, FR-435 | T028, T029, T030 | T033, T037 |
| FR-436, FR-437 | T008, T009, T029 | T016–T024, T035 |
| FR-438 | T030 | T039 |
| FR-439 | T028 | T033 |
| FR-440 (no recording) | T030 (no microphone request) | T039 |
| FR-441 | T031, T043 | T038, T045 |
| FR-442 | T043, T048 | T046 |
| FR-443 | T031, T048 | T038 |
| FR-444 | T031, T043, T051 | T038, T046 |
| FR-445 | T043, T048 | T037, T047 |
| FR-446 | T057, T004 | T040 |
| FR-447 | T042, T043 | T044, T047 |
| FR-448 | T049, T050, T051 | T052, T053 |
| FR-449 | T049, T005 | T012–T015, T052 |
| FR-450 | T049 | T052 |
| FR-451 | T028 | T034 |
| FR-452 | T055 | — (unchanged) |
| FR-453 | T028, T029, T042 | T034, T035 |
| FR-454 | T008 | T016–T021 |
| FR-455 | T029 | T034, T035 |
| FR-456 | T030, T031, T041 | T038, T039, T040 |
| FR-457 | T030 | T026, T039 |
| FR-458 | T027, T030, T031, T043, T056, T058 | T026, T027, T037, T038 |
| FR-459 | T010, T029 | T025, T037 |
| FR-460 | T030, T056 | T039 |
| SC-175 | T041 | T039 |
| SC-176 | T030 | T037 |
| SC-177 | T008, T009, T029 | T021–T025 |
| SC-178 | T028, T029 | T034, T035 |
| SC-179 | T049 | T052 |
| SC-180 | T048, T060 (quickstart 15) | T023, T024, T038 (`preload="metadata"`, Range) |
| SC-181 | T056, T058 | T026 |
| SC-182 | T005, T006 | T012, T013 |

## Notes

- FR-440 is satisfied by absence: no task requests microphone access. T030 asserts that `getUserMedia` is never called.
- A worker that finds an architectural ambiguity stops and reports it. It does not decide.

## Notas do implement (2026-10-14)

- **Workers**: o DeepSeek estava sem saldo, e o Product Owner escolheu subagentes Haiku (só Edit em arquivos existentes, nunca apagar teste nem commitar). O Arquiteto revisou cada entrega e rodou os portões.
- **Desvio R13**: o cliente ganhou `enviarAudio` ao lado de `enviarImagem`, em vez de `enviarMidia(midia, arquivo)` (research R13).
- **Defeitos achados pelo e2e (T041–T057) e corrigidos no produto**, cada um com prova unitária que falhava antes:
  - o cliente HTTP perdia `tipo: "audio"` na leitura, não resolvia `audio.url` na origem da API e não enviava `tipo` nos itens da Sessão (o mesmo valia para a Imagem);
  - a recusa do servidor não aparecia junto ao campo Áudio;
  - o campo de arquivo oculto media 360 px e causava rolagem horizontal;
  - "Todos" estava fixo em português no filtro de Tipo.
- **Asserções de versão atualizadas por desenho** (research R6): bases com a transição de Pertencimento pendente abrem na v20, e bases completas chegam à v21. O e2e `transicao-de-cartoes` passou a simular a v17 com a fila no nome antigo. No PostgreSQL, `versaoAceitaNoInicio(17|18|19)` passou a ser falso: a nuvem precisa migrar antes do deploy (README).
- **Verificação**:
  - `npm run verificar:ci` verde: gitleaks sem vazamentos; backend 1179 e PostgreSQL 284; frontend 1055 e build; e2e 110/110.
  - O Adapter S3 passou na bateria contra o SeaweedFS local (17/17).
  - Os e2e de layout passaram no Linux (colima, imagem do Playwright e `fonts-dejavu-core`): 27/27.
- **Pendente (T061)**: validação manual com arquivos reais de celular (quickstart, cenário 14), que precisa do Product Owner, e o cenário 15 depois do deploy.
- **Achados fora do escopo, de features anteriores** (não corrigidos):
  - o aviso "Cartão criado: …" fica no idioma em que foi gerado ao trocar o idioma (`aviso-de-cartao.ts` guarda o texto pronto; 025/027, FR-015);
  - a prova `idioma-sem-texto-solto` ignora palavras isoladas com inicial maiúscula (`tipoIsolado`), e por isso não pegou o "Todos".

### Correções posteriores — 2026-10-14

- O aviso de criação passou a guardar a Frente e a montar a mensagem a partir do catálogo no detalhe do Baralho; a prova de formulário confirma a troca para inglês com o aviso visível (027, FR-015).
- `idioma-sem-texto-solto` deixou de isentar identificadores PascalCase genéricos, então palavras soltas como "Todos" são detectadas.

