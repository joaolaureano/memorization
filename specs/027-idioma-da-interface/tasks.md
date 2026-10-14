---
description: "Task list for Idioma da Interface"
---

# Tasks: Idioma da Interface

**Input**: Design documents from `specs/027-idioma-da-interface/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/http.md`, `contracts/ui.md`, `quickstart.md`

**Tests**: Required by the constitution (Principles V and IX). Write each story's tests first and confirm they fail before implementing. Every FR maps to at least one test task (see Traceability).

**Execution note**: The architect reviews every diff and runs the gates (Principle VI). Workers never commit, never delete or weaken tests, and edit existing files instead of overwriting them. Do not run parallel workers on the same file. This includes the catalogs `frontend/src/idioma/pt.ts`, `en.ts` and `es.ts`, which many tasks touch: each text-extraction task adds its **own top-level section** to the three catalogs, and those tasks run sequentially.

**Translation rules for every task that adds catalog entries**:

- `pt` keeps the current Portuguese text **byte-for-byte**, so existing tests keep passing unchanged.
- `en` is en-US and `es` is es-419. Use the glossary at the top of `en.ts`/`es.ts` (research R9): Cartão → Card / Tarjeta, Baralho → Deck / Mazo, Sessão → Session / Sesión, Revisão do dia → Today's review / Repaso del día, Errei/Difícil/Bom/Fácil → Again/Hard/Good/Easy and Otra vez/Difícil/Bien/Fácil, Frente/Verso → Front/Back and Anverso/Reverso, Tag → Tag / Etiqueta. "SM-2" and "memorization" are never translated.
- User Content (deck names, card text, tags, user name, alt text) is only ever a function argument, interpolated unchanged (FR-006).

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pin test locales so existing suites stay in Portuguese once language detection exists (research R7).

- [X] T001 [P] In `frontend/vitest.setup.ts`, add to the existing `beforeEach`:
  - `Object.defineProperty(navigator, "languages", { value: ["pt-BR"], configurable: true })`;
  - the same for `navigator.language` with `"pt-BR"`;
  - `try { localStorage.removeItem("memorization.idioma") } catch {}`.

  Add a short comment that cites research R7.
- [X] T002 [P] In `e2e/playwright.config.ts`, add `locale: 'pt-BR'` to the top-level `use` (next to `timezoneId`).

**Checkpoint**: `npm test --prefix frontend` and the Playwright suite pass unchanged.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `idioma` Module that every story uses (plan "Module `idioma`", research R2/R3).

### Tests first

- [X] T003 [P] Create `frontend/tests/idioma-catalogos.test.ts`. It imports `pt`, `en` and `es` from `frontend/src/idioma/` and checks the following:
  - It walks the trees recursively and asserts identical key sets.
  - Every string leaf is non-empty after `trim()`.
  - Every function leaf, called with representative arguments (`0`, `1`, `2`, `5` for counts; a sample `Recusa`), returns a non-empty string.

  Covers FR-014 and SC-002.
- [X] T004 [P] Create `frontend/tests/idioma-provedor.test.tsx`. It renders a probe component inside `ProvedorDeIdioma` that shows `textos.seletor.nomeDoIdioma` and calls `escolher`, and asserts:
  - the initial language is `pt`;
  - `escolher("en")` re-renders with the English text, with no remount: a controlled `<input>` value typed beforehand is preserved (FR-004);
  - `document.documentElement.lang` becomes `en-US`, `es-419` or `pt-BR` (FR-009);
  - `formatarNumero(1234.5)` gives `1.234,5` in pt, `1,234.5` in en and `1234,5` or `1.234,5` per `es-419` `Intl` output (assert against `new Intl.NumberFormat("es-419").format`, not a literal);
  - a catalog leaf forced to `""` in a test catalog falls back to the `pt` text (FR-013). Expose the fallback through an internal helper `resolverTexto` exported only for tests, or test it via a provider prop `catalogos` used only in tests. Choose the prop and document it.

### Implementation

- [X] T005 Create `frontend/src/idioma/tipos.ts`:
  - `export type Idioma = "pt" | "en" | "es"`;
  - `export const IDIOMAS: readonly Idioma[] = ["pt", "en", "es"]`;
  - `export const LOCALE: Record<Idioma, string> = { pt: "pt-BR", en: "en-US", es: "es-419" }`;
  - `export const SIGLA: Record<Idioma, string> = { pt: "PT", en: "EN", es: "ES" }`;
  - `export const NOME_NATIVO: Record<Idioma, string> = { pt: "Português", en: "English", es: "Español" }` (FR-003; these names never change with the interface language).
- [X] T006 Create `frontend/src/idioma/pt.ts` exporting `export const pt = { seletor: {...}, comum: {...} } ` and `export type Catalogo = typeof pt`. Then create `en.ts` and `es.ts` exporting `en: Catalogo` and `es: Catalogo`, each starting with the glossary comment (research R9). Initial sections:
  - `seletor`: `rotulo(idioma)`, giving "Idioma: Português" / "Language: English" / "Idioma: Español" using `NOME_NATIVO`, and `anuncio(idioma)`, giving "Idioma alterado para Português" / "Language changed to English" / "Idioma cambiado a Español" (contracts/ui.md);
  - `comum`: shared words that already repeat across screens (e.g., "Cancelar", "Salvar", "Voltar", "Tentar novamente"), each verified to exist verbatim in the current UI.

  Use plain object literals. Function leaves take a single typed argument.
- [X] T007 Create `frontend/src/idioma/ProvedorDeIdioma.tsx` with:
  - a context;
  - `ProvedorDeIdioma({ children, idiomaInicial = "pt", catalogos? })`;
  - `useIdioma(): { idioma, textos, escolher, formatarData(data: Date, opcoes: Intl.DateTimeFormatOptions), formatarNumero(n: number, opcoes?: Intl.NumberFormatOptions), plural(n, formas: { one: string; other: string }) }`.

  `textos` is the catalog for the language, wrapped so that empty string leaves resolve to `pt` (FR-013). A `useEffect` sets `document.documentElement.lang = LOCALE[idioma]`. A visually hidden `aria-live="polite"` region renders `textos.seletor.anuncio(idioma)` only after a user-initiated change, not on first render (FR-009). Export everything public from `frontend/src/idioma/index.ts`. Make T003 and T004 pass.
- [X] T008 Make `Aplicacao` (`frontend/src/ui/Aplicacao.tsx`) render its own `<ProvedorDeIdioma>` around its content when `useContext(ContextoDeIdioma)` is `null`. `frontend/src/main.tsx` stays unchanged. This keeps every existing test that renders `Aplicacao` untouched. For components rendered alone in tests, add `renderizarComIdioma(ui, idioma = "pt")` to `frontend/tests/apoio-de-prova.ts`. Export `ContextoDeIdioma` from `idioma/index.ts` for this check only.

**Checkpoint**: `npm test --prefix frontend` and `npm run build --prefix frontend` pass. The UI still looks identical.

---

## Phase 3: User Story 1 — Trocar o idioma da interface (Priority: P1) 🎯 MVP

**Goal**: The Seletor de idioma is in every header, and every product text on every screen switches immediately between PT, EN and ES without losing state.

**Independent Test**: On any screen, choose English in the selector. Every product text switches to English with no reload, and typed fields, an in-progress Sessão and active filters are kept. Repeat with Español and Português, keyboard only.

### Tests first

- [X] T009 [P] [US1] Create `frontend/tests/seletor-de-idioma.test.tsx` per contracts/ui.md. It asserts:
  - the button shows the globe and `PT`, has accessible name "Idioma: Português", `aria-haspopup="menu"` and `aria-expanded`;
  - when opened, it shows a `menu` with three `menuitemradio` in the order `PT Português`, `EN English`, `ES Español`, with the current one `aria-checked="true"` (FR-002, FR-003);
  - Enter/Space/↓ open the menu and focus the current item; ↑/↓/Home/End move focus; Enter selects; Esc closes without change; focus returns to the button in every case; clicking outside closes (FR-010);
  - after choosing EN, the button shows `EN` and the live region says "Language changed to English" (FR-009).

  Use `fireEvent.keyDown`/`fireEvent.click`; `@testing-library/user-event` is not a dependency, so do not add it.
- [X] T010 [P] [US1] Create `frontend/tests/idioma-na-aplicacao.test.tsx`, which renders `Aplicacao` with `ClienteEmMemoria`:
  - **Without credential** (Entrar screen): the selector exists and switching to EN translates the Entrar heading and button (FR-002, US1-AS5).
  - **With credential**: the selector is inside the `Moldura` header between the nav and "Sair". Switching to ES translates the nav labels Início/Estudo/Baralhos/Perfil and "Sair".
  - **Preserved state** (FR-004, US1-AS4):
    - a partly typed Cartão form keeps its Frente text after the switch;
    - a Sessão de estudo started and advanced one card stays on the same card position after the switch;
    - a filter applied on a Baralho detail stays applied.
- [X] T011 [P] [US1] Create `frontend/tests/idioma-sem-texto-solto.test.ts` (research R8). It reads every `frontend/src/**/*.{ts,tsx}` except `frontend/src/idioma/**`, with `node:fs` (types already exist in `frontend/tests/node-fs.d.ts`). It ignores comment lines (starting with `*`, `/*` or `//`) and literals used only as keys (`case "…"` and `snake_case`/`kebab-case` codes). It fails, with file and line, on any of:
  - JSX text nodes containing a letter;
  - string literals assigned to `aria-label`, `placeholder`, `title`, `alt`, `label` props;
  - any other string or template literal containing a Portuguese accented letter (`[áàâãéêíóôõúç]`).

  Exceptions are explicit and minimal: the brand `memorization` and the `menuitemradio` native names from `NOME_NATIVO` (which must come from the constant, not a literal). Keep a regex-based scan and document that it is a heuristic. Covers SC-001 and FR-005. This test is expected to fail until T013–T025 are done (research R10).
- [X] T012 [P] [US1] Create `e2e/idioma-da-interface.spec.ts` with `test.describe('troca de idioma')`:
  - On the Entrar screen, keyboard only: Tab to the selector, Enter, ArrowDown to Español, Enter. Assert `html[lang="es-419"]`, the heading in Spanish, and focus back on the selector.
  - Enter with a test user (reuse the existing fixtures in `e2e/fixtures/`), open Baralhos, switch to EN and assert nav labels in English.
  - Timing (SC-004): on the Baralho detail, measure with `page.evaluate` + `performance.now()` from the click on a language item until a known label shows the new text (a `MutationObserver` resolving the promise). Assert < 1000 ms.
  - Layout pass (FR-017, SC-007): with viewports 360×800 and 1280×800, in `en` and `es`, visit every route in `frontend/src/ui/navegacao.ts`: Entrar, Criar conta, Início, Estudo, Baralhos, Novo baralho, a Baralho detail, the Cartão form (new and edit), a Sessão and its Resumo, the Seleção temporária, the Transição de cartões, Agenda, the Rotina form, a Registro, Perfil and Importar Anki. Assert `document.documentElement.scrollWidth <= clientWidth` and that no `.moldura` child overflows (`scrollWidth <= clientWidth`), following the existing `*-responsividade.spec.ts` helpers.

### Implementation

- [X] T013 [US1] Create `frontend/src/idioma/SeletorDeIdioma.tsx` per contracts/ui.md:
  - inline globe SVG `aria-hidden`, followed by `SIGLA[idioma]`;
  - menu-button pattern with three `menuitemradio`;
  - minimum 44×44 px hit target;
  - a visible check mark next to the current item, plus `aria-checked`.

  Add styles to `frontend/src/estilos.css` under a `.seletor-de-idioma` block, reusing existing tokens. At ≤600 px it stays in the top header (it must not go to the bottom nav). Export it from `idioma/index.ts`. Makes T009 pass.
- [X] T014 [US1] Insert `<SeletorDeIdioma />` in `frontend/src/ui/Moldura.tsx` between `</nav>` and the Sair button, and in the credential-less header in `frontend/src/ui/Aplicacao.tsx` (around line 614) after the brand. Move `Moldura` texts (nav labels, "Sair", `aria-label="Principal"`) into a `moldura` catalog section in `pt`/`en`/`es`.
- [X] T015 [US1] Extract texts for **Entrar and Criar conta** into an `acesso` section: `frontend/src/ui/PaginaDeEntrada.tsx`, `PaginaDeCadastro.tsx`, `CampoDeSenha.tsx`, plus any texts in `Aplicacao.tsx` shown before entering (transition, exit failure). Add `pt`/`en`/`es`.
- [X] T016 [US1] Extract texts for **Início and the study hub** into an `inicio` section: `PaginaDeInicio.tsx`, `PaginaDaCentralDeEstudo.tsx`, `EstadoDaCarga.tsx`.
- [X] T017 [US1] Extract texts for **Baralhos** into a `baralhos` section: `PaginaDeBaralhos.tsx`, `PaginaDoBaralho.tsx` (including filters and review-status labels), `PaginaDoFormularioDeBaralho.tsx`, `DialogoDeConfirmacao.tsx`, `protecao-de-saida.tsx`.
- [X] T018 [US1] Extract texts for **Cartão** into a `cartao` section: `PaginaDoFormularioDeCartao.tsx`, `CampoDeTags.tsx`, `aviso-de-cartao.ts`, `frontend/src/ui/tipos-de-cartao/*.tsx`. Include the type names Frente-Verso and Imagem and the "Enviando imagem…" announcement.
- [X] T019 [US1] Extract texts for the **Sessão de estudo** into a `sessao` section: `PaginaDeEstudo.tsx`, `ResumoDaSessao.tsx`. Include the evaluation levels Errei/Difícil/Bom/Fácil (FR edge case; SM-2 untranslated), the Revelação action and all screen-reader announcements.
- [X] T020 [US1] Extract texts for **temporary selection and card transition** into a `selecao` section: `PaginaDaSelecaoTemporaria.tsx`, `FontesDaSelecao.tsx`, `SalvarSelecaoComoBaralho.tsx`, `PaginaDaTransicaoDeCartoes.tsx`.
- [X] T021 [US1] Extract texts for **Agenda and routines** into an `agenda` section: `AgendaDeEstudo.tsx`, `PaginaDaAgenda.tsx`, `PaginaDoFormularioDeRotina.tsx`, `aviso-da-agenda.ts`. Weekday and month names are **not** catalog entries: T047 handles them through `Intl` in `agenda/datas.ts`. Leave them in place.
- [X] T022 [US1] Extract texts for **Estatísticas, Histórico and Registro** into an `estatisticas` section: `EstatisticasDoEstudo.tsx`, `PaginaDoRegistro.tsx`.
- [X] T023 [US1] Extract texts for **Perfil and account** into a `conta` section: `PaginaDePreferencias.tsx` (algorithm and daily-limit labels), `SecaoMinhaConta.tsx`, `FormularioDeTrocaDeSenha.tsx`, `DialogoDeExclusaoDeConta.tsx`, `guarda-de-credencial.ts`.
- [X] T024 [US1] Extract texts for **Importar Anki** into an `importacao` section: `PaginaDeImportacaoAnki.tsx`. Also sweep `navegacao.ts` and any remaining `frontend/src/ui` file reported by T011. T011 must pass after this task.
- [X] T025 [US1] Move user-visible text out of non-UI modules (research R10). Each module returns codes or data, and the UI translates through the catalog:
  - `frontend/src/sessao-de-estudo/sessao-de-estudo.ts`: delete the `MENSAGEM_DE_*` constants (lines ~76–90). Refusals carry only the existing `CodigoDeErroDeSessao`, and a `sessao.recusas` catalog entry covers each of `baralho_inelegivel`, `quantidade_invalida`, `revisao_vazia`, `avaliacao_invalida`, `revelacao_ausente`, `sessao_concluida`. `pt` keeps today's texts verbatim.
  - `frontend/src/agenda/estado-do-dia.ts`: move `textoDaContagem` and `rotuloDoEstadoDoDia` to the catalog as `agenda.contagem(resumo)` (plural through `Intl.PluralRules`) and `agenda.estadoDoDia[estado]`, and update the callers.
  - `frontend/src/estatisticas/estatisticas.ts`: delete `ROTULOS_DA_SEMANA` and `ROTULO_DE_HOJE`. The day carries its date and an `ehHoje: boolean`, and `EstatisticasDoEstudo.tsx` renders `textos.estatisticas.hoje` or `formatarData(data, { weekday: "short" })`.
  - `frontend/src/acervo-cliente/busca-no-acervo.ts`: move `rotuloDaSituacaoDoBaralho` to `baralhos.situacao[situacao]`. Keep any filter or search logic that compares situations by code, never by label.
  - `frontend/src/acervo-cliente/tipos-de-cartao.ts`: `MENSAGEM_DE_IMAGEM_GRANDE` and `MENSAGEM_DE_FORMATO_DE_IMAGEM` become the codes `imagem_grande` and `imagem_formato`. The fallback alt text `"Imagem do Cartão"` (~line 140) becomes `cartao.imagemSemDescricao`; a user-provided alt text or Frente is still returned unchanged.
  - `frontend/src/sessao-de-estudo/aleatoriedade.ts:43`: translate the technical error to English (FR-018).

  Update the existing tests that import the deleted constants so they assert the code (or the rendered `pt` text, which is unchanged); no assertion is removed. Run T011 at the end: it must pass.

**Checkpoint**: T009–T012 pass. All existing frontend tests and the e2e suite pass unchanged in Portuguese. Some refusal messages still arrive as Portuguese text from the client until US4.

---

## Phase 4: User Story 2 — Conteúdo do Usuário permanece intacto (Priority: P1)

**Goal**: User Content is never altered by the language, and the derived labels "Revisão do dia"/"Baralho temporário" are product text shown in the current language (FR-006, FR-007, FR-020, FR-021).

**Independent Test**: With Portuguese decks, cards, tags and user name, switching to EN and ES shows all of them byte-for-byte equal everywhere. Old history entries for daily review and temporary sessions show the label in the current language.

### Tests first

- [X] T026 [P] [US2] Create `frontend/tests/idioma-conteudo-intacto.test.tsx` using `ClienteEmMemoria`, seeded with:
  - Baralho "Verbos irregulares";
  - a Frente-Verso Cartão "Novo" / "Sair" (texts that collide with UI labels);
  - an Imagem Cartão with Texto da frente and alt text "Mapa do Brasil";
  - Tags "Novo" and "Bom";
  - user name "joão";
  - a Baralho created through `confirmarImportacaoAnki` with a card "Hoje" / "Concluído" (US2-AS2).

  Assert:
  - in `pt`, `en` and `es`, the Baralho list, the Baralho detail, search results for "Novo", the Sessão question and answer faces and the Histórico show these strings exactly (`toHaveTextContent` with exact match on the specific element) (FR-006, SC-003, US2-AS1/3/4);
  - the search returns the same card set in all three languages (FR-007).
- [X] T027 [P] [US2] Create `frontend/tests/rotulos-derivados.test.tsx`:
  - Histórico and `PaginaDoRegistro` with records `{ origem: "revisao", nomeDoBaralho: "" }` and `{ origem: "temporario", nomeDoBaralho: "" }` show "Revisão do dia"/"Baralho temporário" in pt, "Today's review"/"Temporary deck" in en and "Repaso del día"/"Mazo temporal" in es;
  - a record with `origem: "baralho"` and `nomeDoBaralho: "Revisão do dia"` (User Content that collides) shows "Revisão do dia" in en;
  - `SalvarSelecaoComoBaralho` opened in en is prefilled with "Temporary deck", and switching to pt after opening does **not** change the field (contracts/ui.md).

  Covers FR-020 and FR-021.
- [X] T028 [P] [US2] Backend `backend/tests/acervo/migracao-nome-derivado.test.ts`. On a v18 SQLite database with `registro_de_sessao` rows `origem='revisao', nome_do_baralho='Revisão do dia'`, `origem='temporario', nome_do_baralho='Baralho temporário'` and `origem='baralho', nome_do_baralho='Revisão do dia'`, migration 19 must:
  - set the first two to `''`;
  - keep the third unchanged;
  - be idempotent when run twice.

  Add the same assertions for PostgreSQL in the existing PostgreSQL battery (follow how `migracao-origem-temporaria.test.ts` is run under `vitest.postgresql.config.ts`).
- [X] T029 [P] [US2] In `backend/tests/acervo/historico.test.ts`, add tests that registering a Sessão with `origem: "revisao"` or `"temporario"` stores and returns `nomeDoBaralho: ""`, even when the client sent a name. Update the existing assertions that expect "Revisão do dia"/"Baralho temporário" to expect `""`; this is the contract change of data-model.md, not a weakening. Do the same in `backend/tests/http/sessoes.test.ts` and `frontend/tests/acervo-cliente/historico.test.ts` if they assert those strings.

### Implementation

- [X] T030 [US2] In `backend/src/acervo/acervo.ts`, change `interpretarRegistro` (~line 978) so that the `revisao` and `temporario` origins derive `nomeDoBaralho = ""`. Remove `NOME_DO_BARALHO_TEMPORARIO` (~line 853) and the "Revisão do dia" literal, and update the doc comments. Make T029 pass.
- [X] T031 [US2] Add **migration 19** to `backend/src/armazenamento/sqlite/migracoes.ts` and `backend/src/armazenamento/postgresql/migracoes.ts`: `UPDATE registro_de_sessao SET nome_do_baralho = '' WHERE origem IN ('revisao','temporario')`, data only and no schema change, following the existing entry format (`{ versao: 19, sql: … }`). Bump any "current schema version" constant or test (`backend/tests/acervo/esquema.test.ts`, `migracoes.test.ts`) from 18 to 19. Make T028 pass.
- [X] T032 [US2] Create `frontend/src/idioma/rotulo-do-baralho.ts` exporting `rotuloDoBaralhoDoRegistro(registro: { origem; nomeDoBaralho }, textos: Catalogo): string`. It returns `textos.sessao.revisaoDoDia` for `revisao`, `textos.sessao.baralhoTemporario` for `temporario` and `nomeDoBaralho` otherwise. Use it in `EstatisticasDoEstudo.tsx`, `PaginaDoRegistro.tsx` (~line 165), `ResumoDaSessao.tsx` and `PaginaDeEstudo.tsx`. In `PaginaDeEstudo.tsx`, replace the hard-coded `nome: "baralho temporário"` (~line 311) with the catalog label, and remove the `|| "Baralho temporário"` fallback in the `registrarSessao` call (~line 778): send `nomeDoBaralhoTemporario ?? ""` (the server ignores it, research R10). In `SalvarSelecaoComoBaralho.tsx`, prefill from the catalog once, when it opens. Make T026 and T027 pass.

**Checkpoint**: T026–T029 pass. The backend suite passes on SQLite and PostgreSQL.

---

## Phase 5: User Story 3 — Idioma lembrado e idioma inicial (Priority: P2)

**Goal**: The choice persists in the browser, and the first visit follows the browser language, with Portuguese as the fallback (FR-011, FR-012).

**Independent Test**: Choose Español, reload, and it opens in Spanish before and after Entrar. A clean browser in English opens in English, and one in French opens in Portuguese.

### Tests first

- [X] T033 [P] [US3] Create `frontend/tests/idioma-resolver.test.ts` for the pure `resolverIdiomaInicial(guardado: string | null, preferidos: readonly string[]): Idioma`:
  - `"es"` stored wins over `["en-US"]`;
  - an invalid stored value such as `"fr"` or `"xx"` is ignored;
  - `["pt-PT"]` gives `pt`, `["en-GB"]` gives `en`, `["es-MX"]` gives `es`;
  - `["fr-FR", "es-AR"]` gives `pt` (only the first, preferred item counts: FR-012, research R10);
  - `["en"]` gives `en` (prefix with no region);
  - `["fr-FR"]` gives `pt`;
  - `[]` gives `pt`.
- [X] T034 [P] [US3] Create `frontend/tests/idioma-persistencia.test.tsx`:
  - after `escolher("en")`, `localStorage.getItem("memorization.idioma") === "en"`;
  - a new render of `Aplicacao` opens in English;
  - with `localStorage.getItem`/`setItem` replaced by functions that throw, the app renders in the detected language with no error (FR-012, US3-AS5);
  - after Sair and after access expiry (reuse the helpers from `frontend/tests/expiracao-do-acesso.test.tsx`), the language is unchanged (US3-AS2);
  - no request made by `ClienteEmMemoria` or the `ClienteHttp` test double carries the language (FR-011).
- [X] T035 [P] [US3] In `e2e/idioma-da-interface.spec.ts`, add `test.describe('idioma inicial e persistência')` with `test.use({ locale: 'en-US' })`: a fresh context opens Entrar in English, and after choosing ES and reloading it is Spanish. A second describe uses `locale: 'fr-FR'` and expects Portuguese.

### Implementation

- [X] T036 [US3] Create `frontend/src/idioma/resolver.ts` with `resolverIdiomaInicial` (research R5 as corrected by R10: only the first item of `navigator.languages` counts). Then, in `ProvedorDeIdioma.tsx`:
  - when no `idiomaInicial` prop is given, read `localStorage["memorization.idioma"]` in `try/catch` and `navigator.languages ?? [navigator.language]`;
  - in `escolher`, write the key in `try/catch` and ignore failures;
  - add no `storage` event listener (spec edge case: tabs are independent).

  Make T033–T035 pass.

**Checkpoint**: T033–T035 pass. Existing suites still open in Portuguese thanks to T001 and T002.

---

## Phase 6: User Story 4 — Mensagens, datas e números no idioma escolhido (Priority: P2)

**Goal**: Every refusal, local or from the server, is shown in the interface language, and every technical message is in English. Dates, numbers and plurals follow the language (FR-008, FR-015, FR-016, FR-018, FR-019).

**Independent Test**: In English, trigger a duplicate Frente, a wrong credential and an invalid image. The messages are in English, and the server response body has an English `mensagem`. Agenda and statistics show localized dates and numbers.

### Tests first

- [X] T037 [P] [US4] Create `backend/tests/mensagens/recusas.test.ts`. It asserts:
  - `MENSAGENS_TECNICAS` from `backend/src/http/recusas.ts` has an entry for every code listed in contracts/http.md (existing and the new `anki_*`);
  - every value matches `/^[\x20-\x7E]+$/`;
  - no value contains any of `não|você|cartão|baralho|usuário|senha|inválid|tente|nenhum|obrigatóri|arquivo` (case-insensitive).

  Covers FR-018 and SC-008.
- [X] T038 [P] [US4] Update the backend HTTP tests that assert Portuguese `mensagem` values so they assert the `erro` code plus the new English `mensagem` from `MENSAGENS_TECNICAS`: `backend/tests/http/*.test.ts`, `backend/tests/acervo/*.test.ts` and `backend/tests/identidade/*.test.ts` (find them with `grep -rn "mensagem" backend/tests`). This follows the contract change in contracts/http.md, and no assertion is removed. Add assertions that `limite` is present for `nome_muito_longo`, `frente_muito_longa`, `verso_muito_longo` and `descricao_muito_longa`.
- [X] T039 [P] [US4] In `backend/tests/acervo/importacao-anki.test.ts` and `backend/tests/http/importacao-anki.test.ts`, add one case per new code: an oversized file gives `anki_grande_demais` with `limite`, unreadable bytes give `anki_ilegivel`, an expansion bomb or corrupt modern file gives `anki_corrompido`, and a zip without a collection gives `anki_incompativel`. Each response is 422 with an English `mensagem`.
- [X] T040 [P] [US4] In `frontend/tests/acervo-cliente/cliente.test.ts` (and `conta.test.ts`, `acesso.test.ts`, `imagens.test.ts`, `pertencimento.test.ts`, `salvar-selecao.test.ts`, `agenda.test.ts`, `historico.test.ts` as applicable), replace assertions on `mensagem` text with assertions on `recusa: { codigo, motivo?, limite? }`, for **both** Adapters (`ClienteHttp` against the test server and `ClienteEmMemoria`). Add a case where the server returns an unknown `erro`, which must give `{ codigo: "indisponivel" }`.
- [X] T041 [P] [US4] Create `frontend/tests/idioma-recusas-e-formatos.test.tsx`:
  - In en, a duplicate-Frente refusal shows the English catalog text. Switching to es while it is visible changes it to Spanish (FR-015).
  - A save started in pt whose `ClienteEmMemoria` response is delayed (controlled promise), with the language switched to en before it resolves, shows the result in English (FR-016).
  - A local validation (empty Verso) in es shows Spanish (US4-AS3).
  - Wrong credential in en shows the English text, and the technical `mensagem` never appears in the DOM (FR-019).
  - Statistics and Registro dates in en use English month names, and in es Spanish ones (compare with `Intl.DateTimeFormat(LOCALE[idioma], sameOptions)`). The `LIMITE_DA_SELECAO` message uses the locale number format, and "1 cartão"/"2 cartões" use the correct plural in each language. `descreverDias([1, 4], locale)` gives "segunda e quinta" in pt, "Monday and Thursday" in en and "lunes y jueves" in es (FR-008).

### Implementation

- [X] T042 [US4] Create `backend/src/http/recusas.ts`:
  - `export type CodigoDeRecusa` as the union of all codes in contracts/http.md;
  - `export const MENSAGENS_TECNICAS: Record<CodigoDeRecusa, string>` in English;
  - `export function recusa(codigo, extras?: { motivo?: string; limite?: number })` returning the `{ erro, mensagem, motivo?, limite? }` body.

  Replace every Portuguese `mensagem` in `backend/src/http/rotas.ts`, `http/credencial.ts`, `http/origem.ts` (`"Proibido"` becomes `"Forbidden"`), `acervo/acervo.ts`, `acervo/invariantes.ts` and `identidade/invariantes.ts` with codes resolved through `recusas.ts`. Domain modules return `{ erro, limite? }` and must not hold message text. Extend `responderRecusa` (`rotas.ts` ~line 72) to pass `limite`. Make T037 and T038 pass.
- [X] T043 [US4] In `backend/src/importacao/anki.ts`, replace each `throw new Error("…")` with a typed error carrying an `anki_*` code (and `limite` for size) plus an English message. Map it in the import route of `backend/src/http/rotas.ts` to 422 via `recusa()`. Translate to English every remaining `throw new Error(`/`console.*` text in `backend/src/funcao/funcao.ts`, `entradas/local.ts`, `entradas/nuvem.ts`, `entradas/migrar-nuvem.ts`, `imagens/metadados.ts` and any other non-test file found with `grep -rnE "(Error\(|console\.[a-z]+\()\s*[\"\`]" backend/src`. Make T039 pass.
- [X] T044 [US4] In `frontend/src/acervo-cliente/cliente.ts`:
  - add `export type CodigoDeRecusa` (backend codes + `indisponivel` + `nao_autenticado` + the local codes listed verbatim in data-model.md "Códigos locais") and `export interface Recusa { codigo: CodigoDeRecusa; motivo?: string; limite?: number }`;
  - replace `mensagem: string` with `recusa: Recusa` in every refusal result type of `ClienteDoAcervo`;
  - delete the `MENSAGEM_DE_*` constants.

  In `cliente-http.ts`, build `Recusa` from `erro`, `motivo` and `limite`, and map unknown codes and transport failures to `indisponivel`. In `cliente-em-memoria.ts`, return the same `Recusa` objects. In `validacao.ts`, return codes instead of text. Make T040 pass.
- [X] T045 [US4] Add a `recusas` section to `pt`/`en`/`es`: `Record<CodigoDeRecusa, (r: Recusa) => string>`, where `pt` reproduces today's Portuguese messages verbatim (taken from the deleted `MENSAGEM_DE_*` constants and the old backend messages) and `motivo`/`limite` are used where the old text had them. Context-specific variants (e.g., `indisponivel` for Cartões vs Baralhos vs Usuários, which used to be three constants) become a second argument `contexto: "cartoes" | "baralhos" | "usuarios"`, typed.
- [X] T046 [US4] Update every UI file that stored or displayed a refusal message (`grep -rn "mensagem" frontend/src/ui`) so that state holds the `Recusa` (never text) and rendering calls `textos.recusas[recusa.codigo](recusa, …)`. This makes visible notices switch language (FR-015) and late results render in the current language (FR-016). Make T041's refusal cases pass, and keep every existing test green: Portuguese output is unchanged.
- [X] T047 [US4] Localize dates and numbers: replace `toLocaleString("pt-BR", …)` in `EstatisticasDoEstudo.tsx:428`, `PaginaDoRegistro.tsx:181` and `PaginaDeEstudo.tsx:1377` with `formatarData`/`formatarNumero` from `useIdioma`. Turn every count-dependent text into a catalog function using `Intl.PluralRules`. In `frontend/src/agenda/datas.ts` (research R10), `nomeDoDia`, `descreverDias`, `dataCurta` and `dataPorExtenso` gain a `locale: string` parameter and use `Intl.DateTimeFormat(locale, { …, timeZone: "UTC" })` (`weekday: "long"`, `day` + `month: "short"`, full date) and `Intl.ListFormat(locale, { type: "conjunction" })`. Delete `NOMES_DOS_DIAS`, `NOMES_DOS_MESES` and `ABREVIACOES_DOS_MESES`. Date arithmetic and timezone functions are unchanged. Callers pass `LOCALE[idioma]`. In `pt` the output must stay byte-for-byte what `frontend/tests/agenda-datas.test.ts` expects today: where `Intl` differs (e.g., `"out."` vs `"out"`, capitalization), normalize inside the function and add the case to that test. Make T041's format cases pass.
- [X] T048 [US4] In `e2e/idioma-da-interface.spec.ts`, add `test.describe('recusas e formatos')` in `en-US`: Entrar with a wrong password shows the English text, and `page.waitForResponse` shows a body whose `mensagem` matches `/^[\x20-\x7E]+$/`. Create a duplicate Frente and expect English. Open Estudo › Histórico with a seeded daily-review session and expect "Today's review". Import an invalid `.apkg` and expect English text (quickstart steps 4, 7, 9, 13).

**Checkpoint**: T037–T041 and T048 pass. The full backend suite passes on SQLite and PostgreSQL.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T049 [P] Review `en.ts` and `es.ts` for glossary consistency (research R9): one translation per domain term, no Portuguese left, natural phrasing, and lengths compatible with the 360 px layout. Fix strings, not layout, when T012's layout pass fails, unless the layout itself is wrong.
- [X] T050 [P] Update `README.md` and `README.pt-BR.md` with a short "Language / Idioma" note (selector, three languages, stored per browser, technical messages in English), so documentation changes in the same logical increment (Quality Criteria: Documentation).
- [X] T051 Run the quickstart manual script (`specs/027-idioma-da-interface/quickstart.md`, steps 1–13) and record the results in the commit message.
- [X] T052 Run `npm run verificar:ci` at the repo root and fix any failure at its root cause (no timeout increases, no skipped tests).

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T008)** → user stories.
- **US1 (T009–T025)** depends on Foundational. T013 comes before T014. T014–T025 are **sequential**, because they all edit `pt.ts`/`en.ts`/`es.ts`. T025 must finish before T044 (both touch the refusal constants).
- **US2 (T026–T032)** depends on US1 T019–T022 (the `sessao` and `estatisticas` catalog sections exist). Its backend tasks T028–T031 can start right after Foundational.
- **US3 (T033–T036)** depends only on Foundational and can run in parallel with US1 (it touches `ProvedorDeIdioma.tsx` and `resolver.ts`, not the catalogs).
- **US4**: the backend part (T037–T039, T042, T043) depends only on Setup and can run in parallel with US1. The frontend part (T040, T041, T044–T047) depends on US1, because the screens must already read `textos`.
- **Polish** last.

### Parallel opportunities

- T001 ∥ T002; T003 ∥ T004.
- T009 ∥ T010 ∥ T011 ∥ T012 (distinct new test files).
- Backend track (T028–T031, T037–T039, T042–T043) ∥ frontend US1 track, with different files. T030 and T042 both edit `acervo.ts`, so run them sequentially.
- T033–T036 (US3) ∥ US1 extraction.
- T049 ∥ T050.

### Example: US1 tests in parallel

```text
Worker A: T009 frontend/tests/seletor-de-idioma.test.tsx
Worker B: T010 frontend/tests/idioma-na-aplicacao.test.tsx
Worker C: T011 frontend/tests/idioma-sem-texto-solto.test.ts
Worker D: T012 e2e/idioma-da-interface.spec.ts
```

## Implementation Strategy

1. **MVP = Setup + Foundational + US1**: the selector works everywhere and every screen is translated. Deliverable, but some refusal texts are still Portuguese.
2. **+ US2**: guarantees the content boundary and the derived labels (P1, completes the P1 scope).
3. **+ US3**: memory and initial language.
4. **+ US4**: English technical messages, translated refusals, dates, numbers and plurals.
5. Run `verificar:ci` at every increment before integrating (Principle X).

## Traceability (FR → tasks)

| FR / SC | Tests | Impl |
|---|---|---|
| FR-001 | T009, T003 | T005, T006 |
| FR-002 | T009, T010, T012 | T013, T014 |
| FR-003 | T009 | T005, T013 |
| FR-004, SC-004 | T004, T010, T012 | T007, T014–T025 |
| FR-005, SC-001 | T010, T011, T012 | T014–T025 |
| FR-006, SC-003 | T026 | T006 (rule), T014–T024 |
| FR-007 | T026, T029 | T030 |
| FR-008 | T004, T041 | T007, T047 |
| FR-009 | T004, T009, T012 | T007, T013 |
| FR-010, SC-005 | T009, T012 | T013 |
| FR-011, SC-006 | T034, T035 | T036 |
| FR-012 | T033, T034, T035 | T036 |
| FR-013 | T004 | T007 |
| FR-014, SC-002 | T003 | T006 (types), T049 |
| FR-015 | T041 | T045, T046 |
| FR-016 | T041 | T046 |
| FR-017, SC-007 | T012 | T013, T049 |
| FR-018, SC-008 | T037, T038, T048 | T042, T043 |
| FR-019 | T040, T041, T048 | T042, T044, T046 |
| FR-020 | T027, T028, T029 | T030, T031, T032 |
| FR-021 | T027, T028, T029 | T030, T031, T032 |

## Notas do implement (2026-10-13)

- **T040, T044, T045, T046**: atendidas pelo desenho de research R13/R14, e não pela troca da Seam para `Recusa`.
  - O cliente HTTP troca a mensagem técnica pelo texto do catálogo (`idioma/recusas.ts`).
  - As mensagens locais vêm de `idioma/mensagens.ts`.
  - As telas mostram avisos por `TextoDoProduto`, que os reapresenta no idioma vigente (memória de tradução).
  - Provas: `tests/idioma-recusas.test.tsx`, `tests/idioma-transversal.test.tsx` e `tests/acervo-cliente/imagens.test.ts` (asserção atualizada pelo FR-019).
- **T011**: `tests/idioma-sem-texto-solto.test.ts` varre `src/**` (exceto `src/idioma/`) e passa sem achados. As exceções são explícitas: a marca e os rótulos de dado do SM-2.
- **T026/T041**: cobertas por `tests/idioma-transversal.test.tsx`, junto com `tests/rotulos-derivados.test.tsx`.
- **T037**: a prova da tabela de mensagens fica em `backend/tests/mensagens/recusas.test.ts`. A bateria de `tests/http/` exige provas de contrato pelo Adapter.
- **T051**: o roteiro manual do quickstart não foi executado à mão. Os passos 1–8 e 10–12 estão cobertos pelo e2e `e2e/idioma-da-interface.spec.ts` e pelas provas de unidade. O passo 9 (Histórico com rótulos derivados) está coberto por `tests/rotulos-derivados.test.tsx` e pelas provas de backend da migração 19. O passo 13 (`.apkg` inválido) está coberto pelas provas `anki_*` do backend e pelo texto do catálogo.
- **T052**: `npm run verificar:ci` passou por inteiro: Gitleaks sem vazamentos, backend 1019 + 267, frontend 989 + build, e2e 101/101.
- **Correções feitas no implement**: R11 (migração 19 e transição de Pertencimento), R12 (o nome digitado do temporário é preservado), R13 e R14 (recusas e avisos).
