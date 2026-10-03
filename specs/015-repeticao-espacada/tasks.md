---
description: "Lista de tarefas da feature 015 — Repetição espaçada"
---

# Tasks: Repetição espaçada

**Executor**: workers DeepSeek via Aider, em cópias isoladas (`paralelo.sh`). Dentro de cada onda, os arquivos são disjuntos. Portões ao fim de cada onda — backend: `npm test`, `npm run typecheck`, `npm run lint`; frontend: `npm test`, `npm run build`, `npm run lint`; nas ondas finais, também os e2e. O Arquiteto revisa cada diff (constitution VI) e roda `graphify update .` ao fim.

**Input**: Design documents from `/specs/015-repeticao-espacada/`

**Prerequisites**: [plan.md](./plan.md) (obrigatório), [spec.md](./spec.md) (obrigatório para as histórias), [research.md](./research.md) (D1–D8, R9–R12), [data-model.md](./data-model.md) e [contracts/contratos.md](./contracts/contratos.md).

**Tests**: presentes em cada tarefa. Pela constitution (I e IX), os testes da tabela de referência SM-2, da prévia e da bateria da Porta são escritos ANTES da implementação correspondente e ficam vermelhos até ela existir.

**Organization**: Agrupamento por história (US1–US5) e pelas ondas fixas de execução. Arquivos disjuntos por onda permitem paralelismo real via `paralelo.sh`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo com as outras tarefas da mesma onda (arquivos disjuntos)
- **[Story]**: a que história do spec.md a tarefa pertence (US1–US5)
- Cada tarefa cita a seção do contrato (`contracts/contratos.md` §n), os FR/SC que cobre e os arquivos exatos
- Restrições de campo do `data-model.md` (CHECK, NOT NULL, DEFAULT, faixa 0..999, 4 níveis, `''` e `'Revisão do dia'`) são citadas literalmente na tarefa

## Path Conventions

- **Web app**: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/`

---

## Fase 1 — Setup

**Purpose**: Linha de base antes de qualquer código novo.

- [X] T1501 Linha de base: na branch `main`, rodar os portões de backend (`npm test`, `npm run typecheck`, `npm run lint`) e de frontend (`npm test`, `npm run build`, `npm run lint`) antes de começar; registrar o resultado bruto no relatório da feature.
  - Sem código. Se algum portão já estiver vermelho, parar e reportar ao Arquiteto antes de iniciar a Onda 1 (constitution VI e X).

**Checkpoint**: Base verde; Onda 1 liberada.

---

## Fase 2 — Foundational (pré-requisito bloqueante de todas as histórias)

**Purpose**: Porta, algoritmo, cliente e Module do dia prontos antes de qualquer tela.

**⚠️ CRÍTICO**: nenhuma história começa antes do fim da Fase 2.

### Onda 1 (paralelo)

- [X] T1502 [P] Porta de armazenamento: tipos e Interface (§2, §2.1, §2.2, §2.3) — `backend/src/armazenamento/porta.ts`.
  - Acrescentar `Agendamento`, `Preferencias` e `ItemAvaliado` (§2.1); estender `ItemRegistrado` com `cartaoId?: string | null` e `avaliacao?: Avaliacao | null`; estender `RegistroDeSessao` com `origem: "baralho" | "revisao"` (§2.2). `RegistroResumido = Omit<RegistroDeSessao, "itens">` passa a carregar `origem`.
  - Acrescentar as cinco assinaturas de §2.3 (`obterPreferencias`, `salvarPreferencias`, `listarAgendamentos`, `inserirRegistroEAgendamentos`, `substituirAgendamentos`, `listarItensAvaliados`), mantendo `Desfecho` e `CodigoDeFalhaDeArmazenamento` existentes.
  - Sem implementação: só tipos e Interface (FR-188, FR-196).
  - Testes: nenhum nesta tarefa (a cobertura vem pela bateria da Porta em T1509); typecheck do backend precisa passar.

- [X] T1503 [P] Algoritmo plugável e SM-2 (§1.1, §1.2) — `backend/src/repeticao/algoritmo.ts`, `backend/src/repeticao/sm2.ts`, `backend/tests/repeticao/sm2.test.ts`, `backend/tests/repeticao/previa.test.ts`.
  - Em `algoritmo.ts`: `Avaliacao = "errei" | "dificil" | "bom" | "facil"`, `EstadoDoAgendamento`, `AlgoritmoDeRepeticao`, `ALGORITMOS`, `ALGORITMO_PADRAO = "sm2"`, `algoritmoPorId` (desconhecido → SM-2) e `previa` (4 chaves).
  - Em `sm2.ts`: `id = "sm2"`, `versao = 1`, `rotulo = "SM-2"`; estado `{ repeticoes, facilidade, intervaloEmDias }` com inicial `n = 0`, `EF = 2.5`, `I = 0`; `q: errei=2, dificil=3, bom=4, facil=5`; `EF' = max(1.3, arred2(EF + (0.1 − (5−q)·(0.08 + (5−q)·0.02)))` sempre atualizado; `q < 3 → n = 0, I = 1`; senão `I = 1` se `n = 0`, `I = 6` se `n = 1`, senão `I = Math.round(I · EF')`, e `n = n + 1`; `proximaRevisaoEm = agora + I × 24 h`. Puro: sem relógio, sem I/O; recebe `agora`.
  - Testes (escritos primeiro): tabela R12/SC-082 (`bom×4` → 1,6,15,38; `facil×3` → 1,6,17 e EF 2.6/2.7/2.8; `bom,bom,errei,bom,bom` → 1,6,1,1,6 e EF 2.5→2.18; `dificil×4` → 1,6,12,23; `errei×5` → 1 sempre com piso EF 1.3) e `previa` cobrindo SC-090.
  - FR-187, FR-190, FR-191, FR-192; SC-082, SC-090.

- [X] T1504 [P] Module puro do dia (§6) — `frontend/src/revisao/dia.ts`, `frontend/tests/revisao-dia.test.ts`.
  - `limitesDoDia(agora)`: 00:00 e 24:00 locais em ISO-8601 (FR-204).
  - `rotuloDaPrevia(agora, iso)`: `"hoje" | "amanhã" | "N dias"` por datas locais do navegador (FR-221).
  - Testes: fronteira de meia-noite local, virada de mês/ano e diferença em dias.
  - FR-204, FR-221.

- [X] T1505 [P] Cliente do frontend (§5, §5.1, §5.2) — `frontend/src/acervo-cliente/cliente.ts`, `frontend/src/acervo-cliente/cliente-http.ts`, `frontend/src/acervo-cliente/cliente-em-memoria.ts`, `frontend/src/ui/guarda-de-credencial.ts`, `frontend/tests/acervo-cliente/cliente.test.ts`.
  - Tipos novos/alterados de §5.1 (`Avaliacao`, `Previa`, `ResumoDaRevisao`, `ItemDoLoteDeRevisao`, `OpcaoDeAlgoritmo`, `Preferencias` e os `Resultado*`), `DadosDeRegistro` com `origem`, `RegistroResumido` com `origem`.
  - Métodos de §5.2 nos dois clientes (HTTP e em memória); o em memória é idempotente pelo `id` e usa prévia fixa simples e documentada (D7).
  - `registrarSessao` estendido e guardado em `guarda-de-credencial.ts`.
  - Testes: HTTP (parsing/erros) e em memória (idempotência pelo `id`); sem reimplementar o SM-2 no frontend.
  - FR-196, FR-219; §5.

**Checkpoint Onda 1**: portões de backend e frontend verdes; variáveis de contrato publicadas para as ondas 2 e 4.

### Onda 2 (paralelo; depende da Onda 1)

- [X] T1506 [P] Module puro `revisao.ts` (§1.3) — `backend/src/repeticao/revisao.ts`, `backend/tests/repeticao/revisao.test.ts`.
  - Plugabilidade provada só nos testes: um algoritmo falso (por exemplo, "intervalo fixo de N dias"), definido no arquivo de teste e nunca em `ALGORITMOS`, mostra que `reconstruir` e `aplicarAvaliacoes` funcionam com qualquer `AlgoritmoDeRepeticao` e que ir e voltar entre dois algoritmos dá Agendamentos idênticos (FR-191, SC-083).
  - `resumoDaRevisao`: `vencidos = Agendamentos com proximaRevisaoEm < fimDoDia`; `novosHoje = min(Cartões sem Agendamento, max(0, limite − introduzidosHoje))`; `introduzidosHoje = Agendamentos com criadoEm ∈ [inicioDoDia, fimDoDia)`.
  - `loteDeRevisao`: vencidos por `proximaRevisaoEm` asc (desempate pela ordem de criação do Cartão), depois novos pela ordem de criação; **máx. 20 Itens** e cada Cartão no máximo uma vez (FR-201, FR-203).
  - `aplicarAvaliacoes`: na ordem dos Itens, upsert por `cartaoId`, `criadoEm` preservado (FR-205, FR-210).
  - `reconstruir`: replay `(concluidaEm, posicao)` sobre Cartões existentes; ignora Itens sem `avaliacao`/`cartaoId` (FR-213).
  - Testes cobrindo SC-080 (contagem de vencidos), SC-081 (limite 0, 1, 20) e SC-083 (replay determinístico).
  - FR-198, FR-199, FR-201, FR-203, FR-205, FR-210, FR-213; SC-080, SC-081, SC-083.

- [X] T1507 [P] Adapter SQLite: migração 7 + 5 métodos da Porta (§2.3) — `backend/src/armazenamento/sqlite/migracoes.ts`, `backend/src/armazenamento/sqlite/armazenamento.ts`, `backend/tests/acervo/migracoes.test.ts`.
  - Migração 7 conforme data-model §7.1, **literal**: `agendamento` com `PK(usuario_id, cartao_id)`, `CHECK (ultima_avaliacao IN ('errei','dificil','bom','facil'))` e ambas FKs `ON DELETE CASCADE`; `preferencias` com `algoritmo TEXT NOT NULL DEFAULT 'sm2'` e `limite_de_novos_por_dia INTEGER NOT NULL DEFAULT 20 CHECK (limite_de_novos_por_dia BETWEEN 0 AND 999)`; `ALTER TABLE item_de_registro ADD COLUMN cartao_id TEXT NULL` e `ADD COLUMN avaliacao TEXT NULL CHECK (avaliacao IS NULL OR avaliacao IN ('errei','dificil','bom','facil'))`; `ALTER TABLE registro_de_sessao ADD COLUMN origem TEXT NOT NULL DEFAULT 'baralho' CHECK (origem IN ('baralho','revisao'))`.
  - Métodos `obterPreferencias`, `salvarPreferencias`, `listarAgendamentos`, `inserirRegistroEAgendamentos` (transação única; idempotência; conflito de outro Usuário; Cartão inexistente descartado em silêncio), `substituirAgendamentos` (transação única: salva Preferências, apaga TODOS os Agendamentos do Usuário, grava os novos) e `listarItensAvaliados`.
  - Teste de migração: base da 013 preservada integralmente; nenhum Agendamento criado; colunas antigas preenchidas com `NULL` / `'baralho'` (FR-214, FR-220).
  - FR-208, FR-209, FR-214, FR-220.

- [X] T1508 [P] Adapter PostgreSQL: migração 7 + 5 métodos da Porta (§2.3) — `backend/src/armazenamento/postgresql/migracoes.ts`, `backend/src/armazenamento/postgresql/armazenamento.ts`, `backend/tests/armazenamento/postgresql/migracoes.test.ts`.
  - Migração 7 equivalente à SQLite (data-model §7.2): `estado JSONB`, `proxima_revisao_em TIMESTAMPTZ`, demais CHECK/DEFAULT idênticos aos citados em T1507.
  - Adapter traduz `TIMESTAMPTZ` ↔ ISO-8601 UTC na leitura/escrita, como na 013; `estado` trafega como objeto JSON.
  - Métodos equivalentes aos de T1507 e teste de migração sobre base da 013.
  - FR-209, FR-220.

- [X] T1509 [P] Bateria compartilhada da Porta (§2; D5) — `backend/tests/armazenamento/bateria-da-porta.ts` (roda em `backend/tests/armazenamento/sqlite.test.ts` e em `backend/tests/armazenamento/postgresql/bateria.test.ts`).
  - Preferências: ausência de linha → padrões `('sm2', 20)`; validação 0..999.
  - Agendamentos: `listarAgendamentos` por Usuário; `inserirRegistroEAgendamentos` com `novo:true` na 1ª vez e `novo:false` no reenvio (sem regravar Agendamento), `conflito` quando `id` é de outro Usuário, Cartão inexistente descartado em silêncio, atomicidade em falha (FR-210).
  - `substituirAgendamentos` apaga e regrava em transação única; `listarItensAvaliados` filtra Itens sem `avaliacao`/`cartaoId` e ordena por `(concluidaEm, posicao)`.
  - Isolamento por Usuário (SC-086) e imutabilidade dos Registros antigos.
  - FR-208, FR-209, FR-210, FR-219; SC-086.

**Checkpoint Onda 2**: portões verdes e bateria verde nos dois Adapters.

### Onda 3 (paralelo; depende da Onda 2)

- [X] T1510 [P] Acervo (§3; D4, D5) — `backend/src/acervo/acervo.ts`, `backend/tests/acervo/repeticao.test.ts`, `backend/tests/acervo/preferencias.test.ts`.
  - `obterRegistroDeSessao` (013): para `origem = "revisao"`, MUST NOT procurar Baralho (o `baralhoId` é `''`) e devolve `baralhoExiste: false`; quem decide a apresentação é a `origem` (FR-215).
  - Troca de algoritmo testada de ponta a ponta no Acervo com um segundo algoritmo falso, injetado só no teste, sem entrar em `ALGORITMOS` (FR-213, SC-083).
  - `registrarSessao` estendido (DadosDeRegistro §3.1 e invariantes §3.3): `id` UUID; `origem ∈ { "baralho", "revisao" }`; `itens` ≥ 1; `cartaoId` string não vazia; `avaliacao` ∈ 4 níveis; `resultado` derivado (`errei` → `errou`; `dificil|bom|facil` → `acertou`); origem `revisao` deriva `baralhoId = ''` e `nomeDoBaralho = 'Revisão do dia'`; origem `baralho` exige `baralhoId` não vazio e `nomeDoBaralho` 1..100; aplica Avaliações na MESMA transação só quando o Registro é novo; Cartão inexistente → Item entra, Agendamento não.
  - `obterResumoDaRevisao`, `obterLoteDeRevisao` (≤ 20 com prévia), `obterPrevias` (≤ 200 `cartaoIds`), `obterPreferencias`, `salvarPreferencias` com reconstrução por replay quando o algoritmo muda (usa `ALGORITMOS`; desconhecido → SM-2).
  - Testes: FR-205–FR-214 com foco em SC-085 (reenvio não duplica e não reaplica), `preferencias.test.ts` cobrindo 0..999 e padrão 20 (FR-200, FR-212) e reconstrução determinística (SC-083).
  - FR-196, FR-205, FR-206, FR-210, FR-211, FR-212, FR-213, FR-219; SC-083, SC-085.

- [X] T1511 [P] Sessão de estudo (§8.1; D7) — `frontend/src/sessao-de-estudo/sessao-de-estudo.ts`, `frontend/tests/sessao-de-estudo/sessao-de-estudo.test.ts`.
  - `Resultado` (Acertei/Errei) → `Avaliacao` (4 níveis); `resultado` derivado (`errei` → `errou`; `dificil|bom|facil` → `acertou`).
  - Item em estudo guarda `cartaoId`; `origem: "baralho"` no estudo livre.
  - Sessão do estudo livre mantém seleção aleatória; Sessão da Revisão parte da lista do lote **sem embaralhar** (FR-201).
  - Testes: níveis válidos, derivação de `resultado`, dois modos de criação.
  - FR-192, FR-194, FR-195, FR-205.

- [X] T1512 [P] Resumo da Sessão (§8.2) — `frontend/src/ui/ResumoDaSessao.tsx`, `frontend/tests/resumo-da-sessao.test.tsx`.
  - Contagem por nível (Errei, Difícil, Bom, Fácil) além de percentual e total (FR-152, FR-216).
  - `origem === "revisao"` mostra `"Revisão do dia"` no lugar do nome do Baralho.
  - Registros antigos, sem `avaliacao`, aparecem exatamente como antes (FR-197, FR-214).
  - Mantém `children` para ações; sem `h1`.
  - FR-197, FR-215, FR-216.

- [X] T1513 [P] Rotas da interface e Moldura (§7) — `frontend/src/ui/navegacao.ts`, `frontend/src/ui/Moldura.tsx`, `frontend/tests/navegacao.test.tsx`, `frontend/tests/moldura.test.tsx`.
  - `Rota` ganha `{ nome: "revisao" }` (`#/revisao`) e `{ nome: "preferencias" }` (`#/preferencias`).
  - `destinoAtivo` devolve `"inicio" | "cartoes" | "baralhos" | "preferencias" | null`; `revisao → "inicio"`, `preferencias → "preferencias"`.
  - Moldura: links Início, Baralhos, Cartões, **Preferências**, Sair.
  - Testes de navegação e da Moldura com o novo link.

**Checkpoint Onda 3**: portões verdes; módulos usados pelas telas prontos.

### Onda 4 (depende da Onda 3)

- [X] T1514 HTTP (§4; D4, D6) — `backend/src/http/rotas.ts`, `backend/src/http/servidor.ts`, `backend/tests/http/revisao.test.ts`, `backend/tests/http/preferencias.test.ts`, `backend/tests/http/sessoes.test.ts`.
  - Handlers das rotas `GET /revisao`, `GET /revisao/lote`, `POST /previas`, `GET /preferencias`, `PUT /preferencias` e `POST /sessoes` estendido, com `200/201/400/409/503` conforme a tabela de §4.
  - `POST /sessoes` mantém a idempotência da 013 (`201` criado; `200` reenvio com o mesmo corpo) e agora aplica as Avaliações só quando o Registro é novo (FR-210).
  - `PUT /preferencias` com algoritmo diferente dispara a reconstrução (FR-213) e devolve o mesmo corpo de `GET` em `200`.
  - TODAS as rotas registradas em `registrarRotasDaAplicacao` de `servidor.ts` (lista única usada por local e nuvem).
  - Isolamento por Usuário em cada rota (FR-219).
  - FR-196, FR-210, FR-212, FR-219; SC-085.

- [X] T1515 [P] Paridade local/nuvem (§4; D6) — `backend/tests/funcao/funcao.test.ts`.
  - Cada rota nova precisa ser chamada pela função da nuvem (`backend/src/funcao/funcao.ts`), lição do bug `9251ae0` da 013: `GET /revisao`, `GET /revisao/lote`, `POST /previas`, `GET /preferencias`, `PUT /preferencias` e `POST /sessoes`.
  - Teste deve falhar se uma rota nova não estiver em `registrarRotasDaAplicacao`.
  - FR-219.

**Checkpoint Onda 4**: portões de backend verdes; rotas disponíveis em local e nuvem.

---

## Fase 3 — US2 Avaliar em 4 níveis em qualquer Sessão (Priority: P1) 🎯

**Goal**: Após a Revelação, quatro botões — Errei, Difícil, Bom, Fácil — com a prévia da próxima revisão em cada um.

**Independent Test**: com um Item revelado, os quatro botões aparecem com a prévia; acionar "Bom" grava a Avaliação; o Resumo mostra a contagem por nível.

**Onda 5 (paralelo com T1517, T1518, T1519, T1520, T1521):**

- [X] T1516 [P] [US2] PaginaDeEstudo (§8.1; D7) — `frontend/src/ui/PaginaDeEstudo.tsx`, `frontend/tests/pagina-de-estudo.test.tsx`, `frontend/tests/teclado-e-foco-de-estudo.test.tsx`, `frontend/tests/leitor-de-tela-de-estudo.test.tsx`.
  - Quatro botões — Errei, Difícil, Bom, Fácil — habilitados **somente após a Revelação** (FR-193); atalhos 1–4 só após a Revelação (FR-218).
  - Cada botão mostra a prévia via `rotuloDaPrevia` ("Bom · 3 dias", "Errei · amanhã"); a prévia entra no **nome acessível** do botão (FR-221).
  - Estudo livre: obter prévias com `obterPrevias(cartaoIds)` ao iniciar a Sessão, **em blocos de até 200 `cartaoIds`** (limite de `POST /previas`), para Sessões de qualquer tamanho; falha em qualquer bloco → os botões dos Cartões afetados aparecem só com o nível, a falha é anunciada e o estudo continua (FR-221).
  - Envia `origem: "baralho"`; alvos de 44 px; sem depender de cor (FR-218).
  - FR-192, FR-193, FR-194, FR-218, FR-221.

**Checkpoint**: US2 testável isoladamente em `frontend/tests/pagina-de-estudo.test.tsx`.

---

## Fase 4 — US1 Revisar os Cartões do dia a partir de Início (Priority: P1) 🎯

**Goal**: Início conduz a Revisão do dia em lotes, com resumo de revisão próprio.

**Independent Test**: com Cartões vencidos e Cartões novos, Início mostra "N Cartões para revisar hoje"; "Revisar" abre uma Sessão com vencidos primeiro, depois novos.

**Onda 5 (paralelo com T1516, T1519, T1520, T1521):**

- [X] T1517 [P] [US1] PaginaDeInicio — `frontend/src/ui/PaginaDeInicio.tsx`, `frontend/tests/pagina-de-inicio.test.tsx`.
  - Bloco "N Cartões para revisar hoje" (singular em 1) com o botão "Revisar" (FR-198).
  - Informa quantos Cartões novos entram hoje, respeitado o limite (FR-199).
  - Sem vencidos e sem novos: "Nada para revisar hoje" e botão indisponível com explicação (FR-202).
  - Estados próprios de carregamento/falha com nova tentativa/sucesso no bloco, sem impedir o resto de Início (FR-217).
  - FR-198, FR-199, FR-202, FR-217.

- [X] T1518 [P] [US1] PaginaDaRevisao — `frontend/src/ui/PaginaDaRevisao.tsx`, `frontend/tests/pagina-da-revisao.test.tsx`.
  - Carrega o lote (`obterLoteDeRevisao`); se o lote vier vazio (outro navegador já revisou), mostra "Nada para revisar hoje" e "Voltar a Início", sem iniciar Sessão.
  - Conduz a Sessão sem embaralhar, na ordem do lote; ao concluir, registra com origem `"revisao"` com nova tentativa (FR-164).
  - Resumo com "Revisão do dia" no lugar do nome do Baralho, "Continuar revisão" (próximo lote, se ainda houver Cartões para hoje) e "Voltar a Início" (FR-215).
  - FR-201, FR-203, FR-215.

- [X] T1518b [P] [US1] Rever registro da Revisão do dia — `frontend/src/ui/PaginaDoRegistro.tsx`, `frontend/tests/pagina-do-registro.test.tsx`.
  - Registro com `origem = "revisao"`: título "Revisão do dia", **sem** o selo "Baralho excluído" e sem link para Baralho; passa `origem` ao `ResumoDaSessao` (contagem por nível).
  - Registro com `origem = "baralho"` e registros anteriores à 015: comportamento da 013 inalterado (FR-178, FR-197).
  - FR-197, FR-215.

**Checkpoint**: US1 testável isoladamente em `frontend/tests/pagina-da-revisao.test.tsx` e `frontend/tests/pagina-do-registro.test.tsx`.

---

## Fase 5 — US3 Estudo livre por Baralho alimenta o Agendamento (Priority: P2)

**Goal**: Estudar livremente também reagenda; Cartões novos deixam de ser novos.

**Independent Test**: estudar um Cartão novo livremente; ao concluir, ele conta no limite de novos do dia e ganha próxima revisão.

**Onda 5 (paralelo; [P] com T1516–T1518, T1520, T1521):**

- [X] T1519 [P] [US3] Estudo livre alimenta o Agendamento — `backend/tests/acervo/estudo-livre.test.ts`.
  - Estudar livremente um Cartão novo: conta no limite de novos do dia e cria Agendamento (`criadoEm` = agora) — FR-206.
  - Estudar Cartão não vencido: reagenda normalmente pelo algoritmo (FR-205).
  - Cartão vinculado a vários Baralhos: um único Agendamento do Cartão, atualizado uma única vez (FR-207).
  - FR-205, FR-206, FR-207.

**Checkpoint**: US3 testável isoladamente no backend.

---

## Fase 6 — US4 Preferências: algoritmo e limite de novos (Priority: P2)

**Goal**: Tela de Preferências com salvar explícito, descarte confirmado e falha com nova tentativa.

**Independent Test**: em Preferências, ajustar o limite para 0 e salvar; Início passa a informar que nenhum Cartão novo entra hoje.

**Onda 5 (paralelo; [P] com T1516–T1521):**

- [X] T1520 [P] [US4] PaginaDePreferencias — `frontend/src/ui/PaginaDePreferencias.tsx`, `frontend/tests/pagina-de-preferencias.test.tsx`.
  - Lista de algoritmos (hoje só SM-2), já selecionado por padrão; `limiteDeNovosPorDia` inteiro **0..999**, padrão **20**, com 0 significando "não introduzir novos" (FR-200).
  - Salvar explícito; confirmação de descarte ao sair com alteração não salva (FR-148); falha explicada com nova tentativa (FR-155) sem perder o que estava escolhido (FR-212).
  - FR-200, FR-212.

**Checkpoint**: US4 testável isoladamente.

---

## Fase 7 — US5 O acervo existente entra como Cartões novos (Priority: P3)

**Goal**: Após a 015, o acervo anterior começa como Cartões novos; Histórico intacto.

**Independent Test**: base da 013 migrada → todos os Cartões são novos; Histórico, Estatísticas e Resumos antigos idênticos.

**Onda 5 (paralelo; [P] com T1516–T1520):**

- [X] T1521 [P] [US5] Base da 013 migrada — `backend/tests/acervo/migracao-repeticao.test.ts`.
  - Todos os Cartões existentes são Cartões novos; entram pelo limite diário (FR-214). Nenhum Agendamento criado pela migração.
  - Registros de sessão anteriores aparecem exatamente como antes no Histórico, nas Estatísticas e nos Resumos (FR-197).
  - Itens sem `avaliacao`/`cartaoId` são ignorados em `reconstruir` (FR-213).
  - FR-197, FR-213, FR-214.

**Checkpoint**: US5 testável isoladamente no backend.

---

## Fase 8 — Polish & integração

**Purpose**: Ligar as telas na aplicação, cobrir o percurso por e2e e medir desempenho.

### Onda 6

- [X] T1522 Aplicacao: rotas `revisao` e `preferencias` ligadas às páginas — `frontend/src/ui/Aplicacao.tsx`, `frontend/tests/navegacao-de-estudo.test.tsx`.
  - Integra US1 e US4 na navegação; mantém `ROTA_PADRAO` = Início.
  - Testes: transitar entre `#/revisao`, `#/preferencias` e as demais rotas.

### Onda 7 (paralelo)

- [X] T1523 [P] e2e novo da repetição espaçada — `e2e/repeticao-espacada.spec.ts`.
  - Percurso com API real: Início → Revisar → 4 níveis → "Continuar revisão" → Início com N restante.
  - Estudo livre alimenta o Agendamento; dois Usuários isolados em navegadores distintos.
  - Mede o tempo até o bloco de revisão de Início ficar visível, com a base semeada de 2.000 Cartões e 500 Registros, e o compara com o limite de 1 s (SC-087, junto da T1526).
  - SC-080, SC-081, SC-084, SC-086, SC-087, SC-089.

- [X] T1524 [P] e2e de Preferências — `e2e/preferencias.spec.ts`.
  - Limite 0, 1 e 20: nunca entram mais Cartões novos do que o limite no dia; trocar algoritmo e voltar preserva o Histórico.
  - SC-081.

- [X] T1525 [P] e2e existentes passam a 4 níveis; telas novas em teclado e contraste — `e2e/sessao-de-estudo.spec.ts`, `e2e/estatisticas-e-historico.spec.ts`, `e2e/percurso-por-teclado.spec.ts`, `e2e/visual-e-contraste.spec.ts`, `e2e/sessao-de-estudo-responsividade.spec.ts`.
  - Atualizar Acertei/Errei para os 4 níveis; cobrir Início, Revisão do dia e Preferências em teclado, larguras 360–1440 px, zoom 200%, alvos 44 px e contraste.
  - SC-088.

### Onda 8

- [X] T1526 Desempenho SC-087 — `backend/tests/acervo/desempenho-revisao.test.ts`.
  - 2.000 Cartões e 500 registros; bloco de revisão do Início visível em até 1 s no ambiente local de testes.
  - SC-087.

- [X] T1527 Converge — capturas, revisão de cada diff, `graphify update .`, quickstart ([quickstart.md](./quickstart.md)) percorrido de ponta a ponta e relatório ao PO.
  - Sem commit sem pedido explícito; portões completos (backend, frontend e e2e).

**Checkpoint final**: feature pronta para revisão do Arquiteto e aceite do PO.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Fase 1 (Setup)**: começa imediatamente; sem código.
- **Fase 2 (Foundational)**: depende da Fase 1; **bloqueia** todas as histórias. Divide-se nas ondas 1–4, em série entre si.
- **Fases 3–7 (US1–US5)**: dependem da Fase 2. As histórias são independentes entre si depois disso, exceto que a integração final (T1522) liga US1 e US4.
- **Fase 8 (Polish)**: depende de todas as histórias desejadas; ondas 6–8 em série.

### User Story Dependencies

- **US2 (P1)**: pode começar logo após a Fase 2; não depende de US1.
- **US1 (P1)**: pode começar logo após a Fase 2; integra com US2 apenas nas telas finais.
- **US3 (P2)**: independente; exercita o backend.
- **US4 (P2)**: independente; a integração final (T1522) liga em Aplicacao.
- **US5 (P3)**: independente; exercita migração e reconstrução.

### Within Each User Story

- Testes primeiro (constitution I e IX), depois a implementação.
- Tipos antes de Interface; Interface antes de Adapters; Adapters antes de Acervo; Acervo antes de HTTP; HTTP antes de telas.
- Cada tarefa fecha com os portões da onda verde.

### Parallel Opportunities

- Todas as tarefas [P] da mesma onda rodam em paralelo (arquivos disjuntos).
- Cada história roda em paralelo com as outras depois da Fase 2, exceto pela integração T1522.

### Tabela das Ondas

| Onda | Tarefas | Portão |
| --- | --- | --- |
| 1 | T1502, T1503, T1504, T1505 | backend: `npm test`, `npm run typecheck`, `npm run lint`; frontend: `npm test`, `npm run build`, `npm run lint` |
| 2 | T1506, T1507, T1508, T1509 | idem + bateria da Porta verde nos dois Adapters |
| 3 | T1510, T1511, T1512, T1513 | idem |
| 4 | T1514, T1515 | idem |
| 5 | T1516, T1517, T1518, T1518b, T1519, T1520, T1521 | idem |
| 6 | T1522 | idem |
| 7 | T1523, T1524, T1525 | idem + e2e |
| 8 | T1526, T1527 | portões completos + `graphify update .` |

---

## Parallel Example: Onda 1

```bash
# Lançar toda a Onda 1 em paralelo (arquivos disjuntos):
bash paralelo.sh t1502 t1503 t1504 t1505
```

Depois da Onda 1, a Onda 2 em paralelo:

```bash
bash paralelo.sh t1506 t1507 t1508 t1509
```

## Rastreabilidade Requisito–Teste

| Requisito | Tarefa(s) |
| --- | --- |
| FR-187 | T1503, T1506 |
| FR-188 | T1502, T1503 |
| FR-189 | T1503, T1506 |
| FR-190 | T1503 |
| FR-191 | T1503 |
| FR-192 | T1503, T1511, T1516 |
| FR-193 | T1516 |
| FR-194 | T1511, T1516 |
| FR-195 | T1511, T1516 |
| FR-196 | T1502, T1510, T1514 |
| FR-197 | T1512, T1521 |
| FR-198 | T1506, T1517 |
| FR-199 | T1506, T1517 |
| FR-200 | T1510, T1520 |
| FR-201 | T1506, T1518 |
| FR-202 | T1517 |
| FR-203 | T1506, T1518 |
| FR-204 | T1504 |
| FR-205 | T1510, T1511, T1519 |
| FR-206 | T1510, T1519 |
| FR-207 | T1502, T1519 |
| FR-208 | T1507, T1509 |
| FR-209 | T1507, T1508, T1509 |
| FR-210 | T1506, T1509, T1510, T1514 |
| FR-211 | T1510 |
| FR-212 | T1510, T1514, T1520 |
| FR-213 | T1506, T1510, T1521 |
| FR-214 | T1507, T1521 |
| FR-215 | T1510, T1512, T1518, T1518b |
| FR-216 | T1512 |
| FR-217 | T1517 |
| FR-218 | T1516 |
| FR-219 | T1505, T1509, T1514, T1515 |
| FR-220 | T1507, T1508 |
| FR-221 | T1504, T1516 |
| SC-080 | T1506, T1517, T1523 |
| SC-081 | T1506, T1520, T1524 |
| SC-082 | T1503 |
| SC-083 | T1506, T1510 |
| SC-084 | T1511, T1523 |
| SC-085 | T1509, T1510, T1514 |
| SC-086 | T1509, T1523 |
| SC-087 | T1526 |
| SC-088 | T1525 |
| SC-089 | T1518, T1523 |
| SC-090 | T1503, T1516 |

---

## Implementation Strategy

### MVP First (Fase 2 + US2 + US1)

1. Fase 1 (Setup) → linha de base verde.
2. Fase 2 (Foundational) completa: ondas 1–4 verdes nos dois Adapters.
3. Fase 3 (US2 — Avaliar em 4 níveis) e Fase 4 (US1 — Revisar os Cartões do dia).
4. **PARAR e VALIDAR**: percorrer Início → Revisar → 4 níveis → "Continuar revisão" → Início com N restante; usar `quickstart.md`.
5. Demonstração pronta para o PO.

### Incremental Delivery

1. Fase 2 + US2 + US1 → demonstração (MVP).
2. + US3 (estudo livre alimenta o Agendamento) → demonstração.
3. + US4 (Preferências) → demonstração.
4. + US5 (acervo existente como Cartões novos) → demonstração.
5. Fase 8 (integração, e2e e desempenho) → entrega.

### Parallel Team Strategy

Com workers DeepSeek via `paralelo.sh`:

1. Onda 1 em paralelo (T1502–T1505).
2. Onda 2 em paralelo (T1506–T1509); portão da bateria da Porta nos dois Adapters.
3. Onda 3 em paralelo (T1510–T1513).
4. Onda 4 (T1514–T1515); o Arquiteto confere a paridade local/nuvem.
5. Onda 5 em paralelo (T1516–T1521).
6. Ondas 6–8 em série (T1522–T1527).

---

## Notes

- [P] = arquivos disjuntos dentro da mesma onda.
- Testes fazem parte de cada tarefa; o Arquiteto revisa cada diff e roda `graphify update .` ao fim (constitution VI e XI).
- Restrições do `data-model.md` (`CHECK`, `NOT NULL`, `DEFAULT`, 0..999, 4 níveis, `''` e `'Revisão do dia'`) são reproduzidas literalmente nas tarefas que as implementam.
- Sem novos arquivos fora do esqueleto. Sem alterar assinaturas dos contratos (constitution I).

## Registro de execução (implement)

- T1505: os testes novos do cliente ficaram em `frontend/tests/acervo-cliente/repeticao.test.ts`, e não em `cliente.test.ts` (3.180 linhas), seguindo o modelo de `historico.test.ts`.
- Lacuna de desenho achada na Onda 2: o Cartão não guardava instante de criação, e a ordem de criação do FR-201 era impossível. A migração 7 ganhou `cartao.criado_em` e, no PostgreSQL, `cartao.ordem_de_insercao` (desempate de instantes iguais; o `rowid` faz esse papel no SQLite). `listarCartoes` passou a devolver em ordem de criação (data-model §7, contrato §2.3).
- Correções entre ondas, todas por workers: c1 (fixtures do frontend e import ausente no cliente em memória), c2 (listas de esquema e tipo `novo` no SQLite), c3 (desempate por ordem de inserção e testes de esquema do PostgreSQL), c4 (expectativa da prévia no teste de SC-085), c5 (teste de Preferências sem `user-event`, que não está instalado), c6 (duas premissas erradas em testes).
- O Aider gravou T1519 e T1521 com o prefixo duplicado (`tests/acervo/backend/tests/acervo/`); os arquivos foram movidos para `backend/tests/acervo/`.
- c7: teste de navegação esperava um `h1` que a página troca entre estados; passou a esperar o estado estável.
- c8 (defeito real, achado no e2e): o CORS do `criarServidor` mantinha uma **segunda lista de caminhos** (pré-voo e `access-control-allow-origin`) sem as rotas novas, e no navegador `/revisao`, `/revisao/lote`, `/previas` e `/preferencias` falhavam. É o mesmo tipo do bug 9251ae0 da 013. As rotas entraram na lista, e `tests/http/cors.test.ts` ganhou uma guarda: toda rota registrada precisa ter pré-voo.
- c9a (defeito real): em Início, o "Revisar" indisponível era um `<span aria-disabled>` e virou `<button disabled>` com a descrição associada, no padrão do "Estudar" (FR-202).
- c10a (defeito real): o Resumo da Revisão do dia não mostrava "Revisão do dia" (FR-215).
- c9b, c10b e c11: seletores e sincronização dos e2e novos alinhados à interface real (esperar o registro concluir antes de sair).
- Portões finais: backend com 72 arquivos e 836 testes, typecheck, lint, `build:local` e `build:lambda`; frontend com 41 arquivos e 565 testes, build e lint; e2e com 49 de 49. `frontend/tests/editar-cartao.test.tsx` (fora da 015) falhou uma vez e passou em 3 de 3 rodadas isoladas e na suíte seguinte: instabilidade preexistente.

## Phase 9: Convergence

- [X] T1528 Restringir os atalhos 1–4 da Revisão do dia ao contêiner da Sessão e ignorá-los em campos de texto e com diálogo aberto, como na PaginaDeEstudo, em `frontend/src/ui/PaginaDaRevisao.tsx` e `frontend/tests/pagina-da-revisao.test.tsx`, per FR-218 (partial)
