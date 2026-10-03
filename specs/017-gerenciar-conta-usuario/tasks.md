---
description: "Lista de tarefas da feature 017 — Gerenciar conta do Usuário"
---

# Tasks: Gerenciar conta do Usuário

**Somente planejamento: nenhuma tarefa é executada sem aprovação do Product Owner.**

**Executor**: workers DeepSeek via a ferramenta `delegate`, em cópias isoladas. Dentro de cada onda, os arquivos são disjuntos. Portões ao fim de cada onda — backend: `npm test`, `npm run typecheck`, `npm run lint`; frontend: `npm test`, `npm run build`, `npm run lint`; nas ondas finais, também os e2e. O Arquiteto revisa cada diff (constitution VI) e roda `graphify update .` ao fim.

**Input**: Design documents from `/specs/017-gerenciar-conta-usuario/`

**Prerequisites**: [plan.md](./plan.md) (obrigatório), [spec.md](./spec.md) (obrigatório para as histórias), [research.md](./research.md) (D1–D7, R1–R5), [data-model.md](./data-model.md) e [contracts/contratos.md](./contracts/contratos.md).

**Tests**: presentes em cada tarefa. Pela constitution (I e IX), os testes da bateria da Porta, do Module `Identidade`, do Module puro `resultado-incerto.ts` e do contrato HTTP são escritos ANTES da implementação correspondente e ficam vermelhos até ela existir.

**Organization**: Agrupamento por história (US1–US5) e pelas ondas fixas de execução. Arquivos disjuntos por onda permitem paralelismo real via `delegate`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo com as outras tarefas da mesma onda (arquivos disjuntos)
- **[Story]**: a que história do spec.md a tarefa pertence (US1–US5); só nas fases de história
- Cada tarefa cita a seção do contrato (`contracts/contratos.md` §n), os FR/SC que cobre e os arquivos exatos
- Restrições literais do `data-model.md` (`agenda: null` sem 016, `ON DELETE CASCADE` em `usuario`, unicidade `COLLATE NOCASE`) são citadas na tarefa que as implementa

## Path Conventions

- **Web app**: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/`

---

## Fase 1 — Setup

**Purpose**: Linha de base antes de qualquer código novo.

- [ ] T1701 Linha de base: rodar os portões de backend (`npm test`, `npm run typecheck`, `npm run lint`) e de frontend (`npm test`, `npm run build`, `npm run lint`) antes de começar; registrar o resultado bruto no relatório da feature.
  - **Sem código.** Se algum portão já estiver vermelho, parar e reportar ao Arquiteto antes de iniciar a Onda 1 (constitution VI e X).

**Checkpoint**: Base verde; Onda 1 liberada.

---

## Fase 2 — Foundational (pré-requisito bloqueante de todas as histórias)

**Purpose**: Porta, Adapters, Module `Identidade` e HTTP prontos antes de qualquer tela.

**⚠️ CRÍTICO**: nenhuma história começa antes do fim da Fase 2.

### Onda 1 (paralelo)

- [ ] T1702 [P] Porta de armazenamento: operações da conta e tipo `ContagensDaConta` (§1) — `backend/src/armazenamento/porta.ts`.
  - Acrescentar à Interface de `ArmazenamentoDeUsuarios`: `atualizarNomeDeUsuario(id, nome)`, `atualizarSenha(id, { sal, hash, parametros })`, `excluirUsuario(id)` e `contarDadosDoUsuario(id)`; manter `Desfecho` e `CodigoDeFalhaDeArmazenamento` existentes (§1).
  - Tipos novos: `ContagensDaConta = { cartoes: number; baralhos: number; registrosDeSessao: number; agenda: number | null }`; **`agenda: null` enquanto as tabelas da feature `016` não existirem**; existindo, soma os registros persistidos de Rotinas de estudo, Compromissos de estudo e Inícios de Compromisso do Usuário; versões dentro de Rotinas não contam separadamente (§1.4; FR-272, SC-113).
  - Erro tipado `nome_em_uso`: nasce da violação da unicidade `COLLATE NOCASE`; será traduzido pelo `Identidade` para `nome_indisponivel` (§1.1; FR-262, SC-112).
  - A Senha em texto claro NÃO entra na Porta: `atualizarSenha` recebe `sal`, `hash` e `parametros` já derivados (§1.2; FR-078, FR-267).
  - `excluirUsuario` é um único comando em transação; as FKs **`ON DELETE CASCADE` de `usuario`** removem `cartao`, `baralho`, `registro_de_sessao`, `agendamento`, `preferencias` e, por cascata, `vinculo` e `item_de_registro` (§1.3; FR-274, FR-275, SC-105).
  - Sem implementação: só tipos e Interface. Testes: nenhum nesta tarefa (a cobertura vem pela bateria da Porta em T1707). O typecheck dos dois Adapters falha até a Onda 2 (T1705, T1706), que implementa os métodos novos; isso é esperado e não bloqueia o portão da Onda 1.
  - FR-262, FR-267, FR-272, FR-274, FR-275; SC-105, SC-108, SC-112, SC-113; §1.

- [ ] T1703 [P] Cliente do frontend: tipos e métodos da conta (§4) — `frontend/src/acervo-cliente/cliente.ts`, `frontend/src/acervo-cliente/cliente-http.ts`, `frontend/src/acervo-cliente/cliente-em-memoria.ts`, `frontend/src/ui/guarda-de-credencial.ts`, `frontend/tests/acervo-cliente/conta.test.ts`.
  - `ClienteDoAcervo` ganha `obterConta(): Promise<ResultadoDeObterConta>` (com `DadosDaConta`, §4), `alterarNomeDeUsuario(dados)`, `trocarSenha(dados)` e `excluirConta(dados)`; as duas implementações (`cliente-http.ts` e `cliente-em-memoria.ts`) mantêm a mesma Interface (§4).
  - `guarda-de-credencial.ts` passa a permitir **substituir a Credencial em memória** após renomear/trocar Senha e **descartá-la** após excluir (§4; FR-263, FR-270, FR-276).
  - Regra de guarda literal: **`403 senha_atual_incorreta` NÃO descarta a Credencial**; **`401` (Credencial recusada)** descarta e segue o fluxo de Entrar (FR-091, FR-279).
  - Testes em `frontend/tests/acervo-cliente/conta.test.ts`: parsing e erros de cada método nos dois clientes; `403` preserva a Credencial; `401` descarta.
  - FR-263, FR-264, FR-270, FR-276, FR-278; SC-106; §4.

- [ ] T1704 [P] Module puro do resultado incerto (§4) — `frontend/src/conta/resultado-incerto.ts`, `frontend/tests/resultado-incerto.test.ts`.
  - Função pura que recebe o resultado de uma verificação por `POST /entrar` e decide: **Credencial nova aceita → operação aplicada**; **Credencial antiga aceita → nada mudou**; **Credencial antiga recusada após exclusão → conta excluída**; **verificação falhou → resultado desconhecido** com «Tentar novamente» e «Ir para Entrar» (§4).
  - Sem I/O: só decide a partir do que recebe; os componentes é que chamam a rede (FR-280..FR-283).
  - Testes: tabela de decisão cobrindo cada ramo, inclusive o resultado desconhecido (SC-110).
  - FR-280, FR-281, FR-282, FR-283; SC-110; §4.

**Checkpoint Onda 1**: portões de backend e frontend verdes; variáveis de contrato publicadas para as ondas 2 e 4.

### Onda 2 (paralelo; depende da Onda 1)

- [ ] T1705 [P] Adapter SQLite das quatro operações (§1; D2) — `backend/src/armazenamento/sqlite/armazenamento.ts`.
  - `atualizarNomeDeUsuario`: `UPDATE` no Usuário; violação de `UNIQUE ... COLLATE NOCASE` → erro tipado `nome_em_uso` (§1.1; FR-262, SC-112).
  - `atualizarSenha`: substitui `sal`, `hash` e `parametros`; não devolve derivacao (§1.2; FR-078, FR-267).
  - `excluirUsuario`: um único `DELETE FROM usuario WHERE id = ?` em transação; as FKs **`ON DELETE CASCADE`** de `cartao`, `baralho`, `registro_de_sessao`, `agendamento`, `preferencias` e, por cascata, `vinculo` e `item_de_registro` removem o resto (§1.3; FR-274, FR-275).
  - `contarDadosDoUsuario`: `SELECT COUNT(*)` em `cartao`, `baralho`, `registro_de_sessao`; **`agenda: null` enquanto as tabelas da `016` não existirem**; existindo, soma os registros persistidos de Rotinas, Compromissos e Inícios da Agenda do Usuário (§1.4; FR-272, SC-113).
  - Testes pela bateria compartilhada (T1707), rodada em `backend/tests/armazenamento/sqlite.test.ts`.
  - FR-262, FR-272, FR-274, FR-275; SC-105, SC-108, SC-112, SC-113; §1.

- [ ] T1706 [P] Adapter PostgreSQL das quatro operações (§1; D2) — `backend/src/armazenamento/postgresql/armazenamento.ts`.
  - Equivalentes aos de T1705, com tradução `TIMESTAMPTZ` ↔ ISO-8601 UTC como nas features anteriores.
  - As FKs `ON DELETE CASCADE` para `usuario` (`cartao`, `baralho`, `registro_de_sessao`, `agendamento`, `preferencias`) já existem; **a migração da `016` MUST declarar `ON DELETE CASCADE` para `usuario` nas tabelas da Agenda** (RotinaDeEstudo, CompromissoDeEstudo, InicioDeCompromisso) — a `017` não cria migração própria (data-model; FR-274, FR-275).
  - `contarDadosDoUsuario` devolve **`agenda: null` enquanto a `016` não existir**; existindo, soma os registros persistidos de Rotinas, Compromissos e Inícios da Agenda do Usuário (§1.4; SC-113).
  - Testes pela bateria compartilhada (T1707), rodada em `backend/tests/armazenamento/postgresql/bateria.test.ts`.
  - FR-262, FR-272, FR-274, FR-275; SC-105, SC-108, SC-112, SC-113; §1.

- [ ] T1707 [P] Bateria compartilhada da Porta (§1; D2, D6) — `backend/tests/armazenamento/bateria-da-porta.ts`.
  - Cenário de **cascata com DOIS Usuários**, cada um com `cartao`, `baralho`, `vinculo`, `registro_de_sessao`, `item_de_registro`, `agendamento` e `preferencias`: excluir um **NÃO** pode tocar no outro (FR-274, FR-275, SC-105).
  - `atualizarNomeDeUsuario`: nome já existente para outro Usuário, mesmo diferindo só em maiúsculas/minúsculas ou em espaços ao redor, devolve `nome_em_uso` (FR-262, SC-112).
  - `contarDadosDoUsuario`: contagens conferem integralmente com o que é removido; **`agenda: null` enquanto a `016` não existir** e, quando existir, igual à soma de Rotinas, Compromissos e Inícios persistidos da Agenda removidos (FR-272, SC-113).
  - A bateria roda nos dois Adapters (SQLite e PostgreSQL) com o mesmo arquivo.
  - FR-262, FR-272, FR-274, FR-275; SC-105, SC-112, SC-113; §1.

- [ ] T1708 [P] Module `Identidade`: `obterConta`, `alterarNomeDeUsuario`, `trocarSenha`, `excluirConta` (§2; D1) — `backend/src/identidade/identidade.ts`, `backend/tests/identidade/conta.test.ts`.
  - `obterConta(usuarioId)`: devolve Nome de usuário e contagens; **jamais devolve Senha, `sal`, `hash`, `parametros` ou derivado** (FR-258).
  - `alterarNomeDeUsuario(usuarioId, { senhaAtual, novoNomeDeUsuario })`: exige `senhaAtual` (FR-259); normaliza como em `007` — espaços ao redor descartados, 3 a 50 caracteres, letras A–Z sem acento, dígitos, `.`, `_` e `-` (FR-260); `mesmo_nome` quando igual ao atual (FR-261); `nome_indisponivel` quando já existente, mesmo diferindo só em maiúsculas/minúsculas (FR-262, SC-112); `senha_atual_incorreta` quando a Senha atual falha (FR-279); sucesso devolve `{ nomeDeUsuario }` (FR-263).
  - `trocarSenha(usuarioId, { senhaAtual, novaSenha, confirmacaoDaSenha })`: exige `senhaAtual` (FR-266); nova Senha segue `007` — 8 a 128 caracteres, qualquer caractere, espaços preservados, sem regra de composição (FR-267); `mesma_senha` quando a nova igual à atual (FR-268); `dados_invalidos` quando nova e Confirmação diferem (FR-269); sucesso = 204 e Credencial substituída (FR-270).
  - `excluirConta(usuarioId, { senhaAtual })`: exige `senhaAtual` (FR-273); `senha_atual_incorreta` na falha (FR-279); sucesso remove Usuário e todos os dados (via `ON DELETE CASCADE`), descarta Credencial e leva a Entrar com «Conta excluída» (FR-274, FR-276); não toca em outro Usuário (FR-275, FR-287).
  - Códigos e mensagens (§2.5): **`senha_atual_incorreta`** — uma única mensagem para as três ações, sem expor a Senha, derivado ou informação sobre outro Usuário (FR-279, SC-107); **`mesmo_nome`** (FR-261); **`mesma_senha`** (FR-268); **`nome_indisponivel`** — código existente de `007` (FR-262, SC-112); **`dados_invalidos`** — regra violada identificada (FR-260, FR-267); **`indisponivel`** — falha de armazenamento, sem falso sucesso (FR-044, FR-045).
  - Testes: cada verbo com sucesso, cada código de recusa e a uniformidade da mensagem de `senha_atual_incorreta` entre as três ações (SC-107).
  - FR-257..FR-279; SC-105, SC-106, SC-107, SC-111, SC-112; §2.

**Checkpoint Onda 2**: portões verdes; bateria da Porta verde nos dois Adapters; Module `Identidade` verde.

### Onda 3 (depende da Onda 2)

- [ ] T1709 HTTP: `GET /conta`, `PUT /conta/nome-de-usuario`, `PUT /conta/senha`, `DELETE /conta` em `registrarRotasDaAplicacao` **E** no pré-voo de CORS de `criarServidor` (§3; D3) — `backend/src/http/rotas.ts`, `backend/src/http/servidor.ts`, `backend/tests/http/conta.test.ts`, `backend/tests/http/cors.test.ts`.
  - Todas as rotas exigem Credencial válida pelo hook `onRequest` existente (FR-090). **`401` permanece reservado à Credencial recusada** (FR-090/FR-091). **`senha_atual_incorreta` responde `403`, e não `401`**, para não disparar o logout de FR-091 (§3; D3, R5). Senha nunca aparece em resposta ou log (FR-078).
  - §3.1 `GET /conta`: `200 { nomeDeUsuario, contagens: { cartoes, baralhos, registrosDeSessao, agenda: number | null } }`; `401`; `503`; nunca devolve Senha nem derivado (FR-258, FR-078).
  - §3.2 `PUT /conta/nome-de-usuario`: corpo `{ senhaAtual, novoNomeDeUsuario }`; **`200 { nomeDeUsuario }`**; **`400`** `dados_invalidos` ou `mesmo_nome`; **`403 senha_atual_incorreta`**; **`409 nome_indisponivel`**; **`401`**; **`503`** (FR-259..FR-265, SC-112).
  - §3.3 `PUT /conta/senha`: corpo `{ senhaAtual, novaSenha, confirmacaoDaSenha }`; **`204`**; **`400`** `dados_invalidos` ou `mesma_senha`; **`403 senha_atual_incorreta`**; **`401`**; **`503`** (FR-266..FR-271).
  - §3.4 `DELETE /conta`: corpo `{ senhaAtual }`; **`204`**; **`403 senha_atual_incorreta`**; **`401`**; **`503`** (FR-272..FR-278, SC-105, SC-111).
  - §3.5: registrar as quatro rotas **em `registrarRotasDaAplicacao` de `servidor.ts`** (lista única usada por local e nuvem) **E na lista de pré-voo de CORS de `criarServidor`**, com os métodos e cabeçalhos já usados (`content-type`, `authorization`).
  - `backend/tests/http/cors.test.ts` ganha a guarda: **toda rota registrada precisa de pré-voo**; falha se alguma estiver sem (§3.5; lição do bug `9251ae0` da `013` e do bug de CORS da `015`).
  - `backend/tests/http/conta.test.ts`: contrato HTTP das quatro rotas com os status e códigos literais de §3 — `200/204/400/403/409/401/503` —, e o isolamento com dois Usuários: `/conta` só lê, altera ou exclui o Usuário da Credencial apresentada; o outro permanece idêntico (FR-287, FR-275).
  - FR-078, FR-090, FR-091, FR-257..FR-288; §3.

- [ ] T1710 [P] Paridade local/nuvem para as quatro rotas (§3.5; D3) — `backend/tests/funcao/funcao.test.ts`.
  - Cada rota nova precisa ser chamada pela função da nuvem (`backend/src/funcao/funcao.ts`): `GET /conta`, `PUT /conta/nome-de-usuario`, `PUT /conta/senha` e `DELETE /conta`.
  - O teste deve **falhar se uma rota nova não estiver em `registrarRotasDaAplicacao`** (lição do bug `9251ae0` da `013`).
  - FR-090; §3.5.

- [ ] T1711 [P] SC-108: exclusão com 2.000 Cartões e 500 Registros em menos de 5 s ou nada — `backend/tests/http/conta-sc108.test.ts`.
  - Semear 2.000 Cartões e 500 Registros de sessão; confirmar a exclusão e medir o tempo no ambiente local de aceite; aceitar **menos de 5 s ou nada aplicado**, sem estado parcial (SC-108, FR-274, FR-275).
  - Verifica atomicidade: se falhar, nenhum dado foi removido (FR-274, FR-275).
  - SC-108; §3.5.

**Checkpoint Onda 3**: portões de backend verdes; quatro rotas disponíveis em local e nuvem; guarda de CORS verde.

---

## Fase 3 — US1 Consultar Minha conta (Priority: P1) 🎯 MVP

**Goal**: Seção «Minha conta» dentro de Preferências com o Nome de usuário atual e as três ações.

**Independent Test**: entrar, abrir Preferências pela navegação principal, confirmar o Nome de usuário correto, a presença das três ações e a ausência de qualquer exibição da Senha.

**Onda 4 (paralelo com T1713, T1714, T1715, T1716):**

- [ ] T1712 [P] [US1] `SecaoMinhaConta.tsx` (§6) + integração em `PaginaDePreferencias.tsx` — `frontend/src/ui/SecaoMinhaConta.tsx`, `frontend/src/ui/PaginaDePreferencias.tsx`, `frontend/tests/secao-minha-conta.test.tsx`, `frontend/tests/pagina-de-preferencias.test.tsx`.
  - Props fixas de §6: `{ cliente, aoSubstituirCredencial, aoExcluirConta }`. Carrega `obterConta`; mostra o Nome de usuário atual e as três ações — «Alterar Nome de usuário», «Trocar Senha» e «Excluir conta» (FR-257).
  - **Nenhum campo exibe a Senha atual, a anterior ou qualquer derivado**, e nenhum caminho oferece recuperá-la (FR-258).
  - **A navegação principal NÃO ganha destino novo**: a seção é renderizada dentro de Preferências (FR-257).
  - A seção **RENDERIZA os três componentes** (`FormularioDeNomeDeUsuario`, `FormularioDeTrocaDeSenha`, `DialogoDeExclusaoDeConta`) — dependência de integração com US2/US3/US4 (ver Dependencies).
  - `pagina-de-preferencias.test.tsx` cobre a seção integrada; `secao-minha-conta.test.tsx` cobre a seção isolada com um cliente falso.
  - FR-257, FR-258; SC-109; §6.

**Checkpoint**: US1 testável isoladamente em `frontend/tests/secao-minha-conta.test.tsx`.

---

## Fase 4 — US2 Excluir a própria conta (Priority: P1)

**Goal**: Diálogo de exclusão com contagens, exigência de Senha atual e descarte de Credencial com «Conta excluída».

**Independent Test**: com dois Usuários cadastrados, excluir a conta do primeiro e confirmar que nada dele permanece e que o segundo não mudou.

**Onda 4 (paralelo com T1712, T1715, T1716):**

- [ ] T1713 [P] [US2] `DialogoDeExclusaoDeConta.tsx` (§6) — `frontend/src/ui/DialogoDeExclusaoDeConta.tsx`, `frontend/tests/dialogo-de-exclusao-de-conta.test.tsx`.
  - Props fixas de §6: `{ cliente, contagens, aoExcluir, aoCancelar }`. **Anuncia a irreversibilidade** e apresenta as contagens de Cartões, Baralhos, Registros de sessão e **dados da Agenda quando a feature `016` existir** (FR-272).
  - Exige a digitação da Senha atual (FR-273); **`403 senha_atual_incorreta` mostra a mensagem única** sem descartar o digitado, exceto os campos de Senha (FR-279, SC-107).
  - Reutiliza `DialogoDeConfirmacao` e a proteção de saída da `012` (FR-159, FR-286).
  - Testes: teclado e foco (FR-159), contagens literais e **`agenda: null` quando a `016` está ausente** (SC-113). Larguras e zoom ficam no e2e (T1719).
  - FR-272..FR-279; SC-105, SC-107, SC-109, SC-111, SC-113; §6.

- [ ] T1714 [P] [US2] `Aplicacao.tsx`: substituir a Credencial em memória e descartá-la com «Conta excluída» em Entrar — `frontend/src/ui/Aplicacao.tsx`, `frontend/tests/navegacao.test.tsx`.
  - **Callback de substituição em memória** após renomear/trocar Senha (FR-263, FR-270) e **de descarte** após excluir, com a mensagem **«Conta excluída»** na tela Entrar (FR-276).
  - A Credencial vive apenas na memória da página aberta (FR-089); ao descartar, a aplicação segue o fluxo de Entrar com mensagem explicativa (FR-091).
  - Testes: transição de Preferências para Entrar com «Conta excluída»; navegação continua com quatro destinos.
  - FR-263, FR-270, FR-276; SC-105, SC-106, SC-111; §6.

**Checkpoint**: US2 testável isoladamente em `frontend/tests/dialogo-de-exclusao-de-conta.test.tsx` e `frontend/tests/navegacao.test.tsx`.

---

## Fase 5 — US3 Trocar a Senha (Priority: P2)

**Goal**: Formulário de troca de Senha com Senha atual, nova Senha e Confirmação.

**Independent Test**: entrar, trocar a Senha e confirmar que a pessoa continua na sessão aberta e que a Credencial antiga é recusada.

**Onda 4 (paralelo com T1712, T1713, T1714, T1716):**

- [ ] T1715 [P] [US3] `FormularioDeTrocaDeSenha.tsx` (§6) — `frontend/src/ui/FormularioDeTrocaDeSenha.tsx`, `frontend/tests/formulario-de-troca-de-senha.test.tsx`.
  - Props fixas de §6: `{ cliente, nomeDeUsuario, aoConcluir, aoCancelar }`. Campos de Senha mascarados, com recurso de mostrar/ocultar (FR-271; FR-142 de `012`).
  - Exige Senha atual, nova Senha e Confirmação (FR-266); recusa **`mesma_senha`** (FR-268); recusa **`dados_invalidos`** quando nova e Confirmação diferem, com o foco indo para a Confirmação (FR-269); **`403 senha_atual_incorreta` mostra a mensagem única** (FR-279).
  - Ao concluir, `aoConcluir(novaCredencial)` **substitui em memória a Credencial** (FR-270).
  - Testes: teclado (foco identificável sem cor), mostrar/ocultar cada Senha, `1..7`/`129` caracteres recusados, foco em Confirmação divergente (SC-109).
  - FR-266..FR-271; SC-106, SC-107, SC-109; §6.

**Checkpoint**: US3 testável isoladamente em `frontend/tests/formulario-de-troca-de-senha.test.tsx`.

---

## Fase 6 — US4 Alterar o Nome de usuário (Priority: P2)

**Goal**: Formulário para alterar o Nome de usuário com Senha atual e regras de `007`.

**Independent Test**: entrar, alterar o Nome de usuário e confirmar que o anterior fica livre e que a Credencial antiga é recusada.

**Onda 4 (paralelo com T1712, T1713, T1714, T1715):**

- [ ] T1716 [P] [US4] `FormularioDeNomeDeUsuario.tsx` (§6) — `frontend/src/ui/FormularioDeNomeDeUsuario.tsx`, `frontend/tests/formulario-de-nome-de-usuario.test.tsx`.
  - Props fixas de §6: `{ cliente, nomeAtual, aoConcluir, aoCancelar }`.
  - Exige a Senha atual (FR-259); aplica as regras de Nome de usuário de `007` — **3 a 50 caracteres**, letras **A–Z sem acento**, dígitos, `.`, `_` e `-`, espaços ao redor descartados (FR-260).
  - **`mesmo_nome`** quando o novo igual ao atual (FR-261); **`nome_indisponivel`** quando já existente, mesmo diferindo só em maiúsculas/minúsculas ou em espaços ao redor (FR-262, SC-112); **`senha_atual_incorreta` mostra a mensagem única** (FR-279); **`dados_invalidos`** identifica a regra violada (FR-260).
  - Ao concluir, `aoConcluir(novaCredencial)` **substitui em memória a Credencial** (FR-263).
  - Testes: teclado, comprimentos inválidos, caractere inválido, diferença de maiúsculas, reuso do nome antigo após renomear (SC-112, SC-109).
  - FR-259..FR-265; SC-106, SC-107, SC-109, SC-112; §6.

**Checkpoint**: US4 testável isoladamente em `frontend/tests/formulario-de-nome-de-usuario.test.tsx`.

---

## Fase 7 — US5 Resultado incerto (Priority: P3)

**Goal**: As telas reportam o estado real quando o resultado de uma alteração ou exclusão não pôde ser confirmado.

**Independent Test**: simular falha de conexão com a operação aplicada e não aplicada; conferir que a interface reporta o estado real e que a nova tentativa nunca aplica duas vezes.

**Onda 5 (paralelo com T1718, T1719):**

- [ ] T1717 [P] [US5] Testes de tela do resultado incerto nos três componentes de ação — `frontend/tests/minha-conta-resultado-incerto.test.tsx`.
  - Cobrir `FormularioDeNomeDeUsuario`, `FormularioDeTrocaDeSenha` e `DialogoDeExclusaoDeConta` com resposta perdida: a interface **NÃO anuncia sucesso nem falha antes de saber o estado real** (FR-280).
  - Determinação: verifica **qual Credencial é aceita agora — a nova ou a antiga** — e, na exclusão, se a antiga ainda vale (FR-281).
  - Se a determinação for impossível: informa **resultado desconhecido** e oferece «Tentar novamente» e «Ir para Entrar» (FR-282).
  - Nova tentativa após resultado incerto **NÃO aplica a mudança duas vezes nem exclui outra conta** (FR-283).
  - Duas páginas em paralelo: a primeira mudança confirmada vence; a outra é recusada por Credencial na próxima operação (FR-284).
  - Testes usam `frontend/src/conta/resultado-incerto.ts` e um cliente falso que simula a falha de rede.
  - FR-280..FR-284; SC-110; §4 e §6.

**Checkpoint**: US5 testável isoladamente em `frontend/tests/minha-conta-resultado-incerto.test.tsx`.

---

## Fase 8 — Polish & integração

**Purpose**: e2e novo, e2e existentes e convergência.

### Onda 5 (paralelo)

- [ ] T1718 [P] e2e novo `e2e/minha-conta.spec.ts`: renomear, trocar Senha com segundo contexto recusado, excluir com dois Usuários provando isolamento e reuso do nome.
  - Renomear com um segundo contexto (navegador) aberto: **a Credencial antiga é recusada na próxima operação do segundo contexto** e a nova é aceita no primeiro, sem novo Entrar (SC-106, FR-263, FR-264).
  - Trocar Senha com segundo contexto recusado: o segundo contexto volta a Entrar com mensagem explicativa (SC-106, FR-270).
  - Excluir com dois Usuários provando isolamento: **nada do excluído permanece** e o outro permanece idêntico (SC-105, FR-274, FR-275).
  - **Reuso do nome**: novo Cadastro com o Nome de usuário excluído é aceito e nenhum dado anterior aparece (SC-111, FR-277).
  - SC-105, SC-106, SC-111.

- [ ] T1719 [P] e2e existentes: «Minha conta» no percurso por teclado e no contraste — `e2e/percurso-por-teclado.spec.ts`, `e2e/visual-e-contraste.spec.ts`.
  - Percorrer a seção «Minha conta» inteiramente por teclado, com o **elemento focado identificável sem depender de cor** (SC-109, FR-285).
  - Cobrir contraste e responsividade: **`360`, `390`, `768` e `1440` px, zoom de 200 %, alvos de 44 px** (SC-109, FR-285).
  - SC-109.

### Onda 6

- [ ] T1720 Converge — portões completos, `graphify update .`, quickstart ([quickstart.md](./quickstart.md)) percorrido de ponta a ponta, relatório ao PO.
  - Portões completos: backend (`npm test`, `npm run typecheck`, `npm run lint`), frontend (`npm test`, `npm run build`, `npm run lint`) e e2e.
  - `graphify update .` ao fim, revisão de cada diff (constitution VI) e relatório ao Product Owner.
  - **Sem commit sem pedido explícito.**

**Checkpoint final**: feature pronta para revisão do Arquiteto e aceite do PO.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Fase 1 (Setup)**: começa imediatamente; sem código.
- **Fase 2 (Foundational)**: depende da Fase 1; **bloqueia** todas as histórias. Divide-se nas ondas 1–3, em série entre si.
- **Fases 3–7 (US1–US5)**: dependem da Fase 2. As histórias são independentes entre si depois disso, com duas ressalvas de integração: **T1712 (US1) renderiza os três componentes** de US2/US3/US4 (`DialogoDeExclusaoDeConta`, `FormularioDeTrocaDeSenha`, `FormularioDeNomeDeUsuario`), e **T1714 (US2) é a integração de casca** em `Aplicacao.tsx` que liga os callbacks de substituição e descarte de Credencial.
- **Fase 8 (Polish)**: depende de todas as histórias desejadas; ondas 5–6 em série.

### User Story Dependencies

- **US1 (P1)**: pode começar logo após a Fase 2; renderiza os três componentes de US2/US3/US4.
- **US2 (P1)**: pode começar logo após a Fase 2; a integração de casca (T1714) é pré-requisito do fluxo completo.
- **US3 (P2)**: independente; integra-se em T1712 e T1714.
- **US4 (P2)**: independente; integra-se em T1712 e T1714.
- **US5 (P3)**: independente; exercita os três componentes com resposta perdida.

### Within Each User Story

- Testes primeiro (constitution I e IX), depois a implementação.
- Tipos antes de Interface; Interface antes de Adapters; Adapters antes de Module; Module antes de HTTP; HTTP antes de telas.
- Cada tarefa fecha com os portões da onda verde.

### Parallel Opportunities

- Todas as tarefas **[P]** da mesma onda rodam em paralelo (arquivos disjuntos).
- **Onda 1**: `T1702`, `T1703`, `T1704` em paralelo.
- **Onda 2**: `T1705`, `T1706`, `T1707`, `T1708` em paralelo.
- **Onda 3**: `T1710` e `T1711` em paralelo com `T1709` (arquivos disjuntos); `T1709` fecha a onda.
- **Onda 4**: `T1712`, `T1713`, `T1714`, `T1715`, `T1716` em paralelo.
- **Onda 5**: `T1717`, `T1718`, `T1719` em paralelo.

### Tabela das Ondas

| Onda | Tarefas | Portão |
| --- | --- | --- |
| 1 | T1702, T1703, T1704 | backend: `npm test`, `npm run typecheck`, `npm run lint`; frontend: `npm test`, `npm run build`, `npm run lint` |
| 2 | T1705, T1706, T1707, T1708 | idem + bateria da Porta verde nos dois Adapters |
| 3 | T1709, T1710, T1711 | idem |
| 4 | T1712, T1713, T1714, T1715, T1716 | idem |
| 5 | T1717, T1718, T1719 | idem + e2e |
| 6 | T1720 | portões completos + `graphify update .` |

---

## Parallel Example: Onda 1

O Arquiteto faz, na mesma mensagem, três chamadas à ferramenta `delegate` (`task: "write"`), uma por tarefa: T1702, T1703 e T1704. Cada chamada leva os arquivos de leitura e de escrita da tarefa e o contrato fixo. Os resultados voltam como edições, que o Arquiteto revisa e aplica; só então roda o portão da onda. As Ondas 2 e 4 seguem o mesmo padrão, com quatro e cinco chamadas paralelas.

---

## Rastreabilidade Requisito–Teste

| Requisito | Tarefa(s) |
| --- | --- |
| FR-257 | T1708, T1709, T1712 |
| FR-258 | T1708, T1709, T1712 |
| FR-259 | T1708, T1709, T1716 |
| FR-260 | T1702, T1708, T1709, T1716 |
| FR-261 | T1708, T1709, T1716 |
| FR-262 | T1702, T1705, T1706, T1707, T1708, T1709, T1716 |
| FR-263 | T1703, T1708, T1714, T1716 |
| FR-264 | T1703, T1708, T1714, T1716 |
| FR-265 | T1708, T1716 |
| FR-266 | T1708, T1709, T1715 |
| FR-267 | T1702, T1708, T1709, T1715 |
| FR-268 | T1708, T1709, T1715 |
| FR-269 | T1708, T1709, T1715 |
| FR-270 | T1703, T1708, T1714, T1715 |
| FR-271 | T1715 |
| FR-272 | T1702, T1708, T1709, T1713 |
| FR-273 | T1708, T1709, T1713 |
| FR-274 | T1702, T1705, T1706, T1707, T1708, T1709, T1711, T1713 |
| FR-275 | T1705, T1706, T1707, T1708, T1711, T1713 |
| FR-276 | T1703, T1708, T1709, T1713, T1714 |
| FR-277 | T1708, T1713, T1718 |
| FR-278 | T1703, T1708, T1713 |
| FR-279 | T1708, T1709, T1713, T1715, T1716 |
| FR-280 | T1703, T1704, T1713, T1714, T1715, T1716, T1717 |
| FR-281 | T1704, T1717 |
| FR-282 | T1704, T1717 |
| FR-283 | T1704, T1717 |
| FR-284 | T1717 |
| FR-285 | T1712, T1713, T1715, T1716, T1719 |
| FR-286 | T1712, T1713, T1715, T1716 |
| FR-287 | T1708, T1709 |
| FR-288 | T1708, T1709, T1711 |
| SC-105 | T1705, T1706, T1707, T1708, T1709, T1711, T1713, T1718 |
| SC-106 | T1703, T1708, T1714, T1715, T1716, T1718 |
| SC-107 | T1708, T1709, T1713, T1715, T1716 |
| SC-108 | T1702, T1705, T1706, T1711 |
| SC-109 | T1712, T1713, T1715, T1716, T1719 |
| SC-110 | T1703, T1704, T1717 |
| SC-111 | T1708, T1713, T1714, T1718 |
| SC-112 | T1702, T1707, T1708, T1709, T1716 |
| SC-113 | T1702, T1705, T1706, T1707, T1708, T1709, T1713 |

---

## Implementation Strategy

### MVP First (Fase 2 + US1 + US2)

1. Fase 1 (Setup) → linha de base verde.
2. Fase 2 (Foundational) completa: ondas 1–3 verdes nos dois Adapters, no Module `Identidade` e no HTTP.
3. Fase 3 (US1 — Consultar Minha conta) e Fase 4 (US2 — Excluir a própria conta).
4. **PARAR e VALIDAR**: consultar Minha conta em Preferências; excluir uma conta de teste com dois Usuários e conferir isolamento; percorrer o `quickstart.md`.
5. Demonstração pronta para o PO.

### Incremental Delivery

1. Fase 2 + US1 + US2 → demonstração (MVP).
2. + US3 (Trocar a Senha) → demonstração.
3. + US4 (Alterar o Nome de usuário) → demonstração.
4. + US5 (Resultado incerto) → demonstração.
5. Fase 8 (e2e e convergência) → entrega.

### Parallel Team Strategy

Com workers DeepSeek via `delegate`:

1. Onda 1 em paralelo (`T1702`–`T1704`).
2. Onda 2 em paralelo (`T1705`–`T1708`); portão da bateria da Porta nos dois Adapters.
3. Onda 3 com `T1709` e `T1710`/`T1711` em paralelo; o Arquiteto confere a paridade local/nuvem e a guarda de CORS.
4. Onda 4 em paralelo (`T1712`–`T1716`).
5. Onda 5 em paralelo (`T1717`–`T1719`).
6. Onda 6 (`T1720`) em série.

---

## Notes

- **[P]** = arquivos disjuntos dentro da mesma onda.
- **[USn]** só nas fases de história; Setup, Foundational e Polish não levam rótulo de história.
- Testes fazem parte de cada tarefa; o Arquiteto revisa cada diff e roda `graphify update .` ao fim (constitution VI e XI).
- Restrições literais do `data-model.md` (`agenda: null` sem 016, `ON DELETE CASCADE` em `usuario`, unicidade `COLLATE NOCASE`) são reproduzidas nas tarefas que as implementam.
- Códigos literais do contrato: `senha_atual_incorreta`, `mesmo_nome`, `mesma_senha`, `nome_indisponivel`, `dados_invalidos`, `indisponivel`.
- Statuses literais do contrato HTTP: `200`, `204`, `400`, `403`, `409`, `401`, `503`.
- HTTP em `registrarRotasDaAplicacao` **E** no pré-voo de CORS de `criarServidor` (§3.5; lição dos bugs da `013` e da `015`).
- Sem novos arquivos fora do esqueleto. Sem alterar assinaturas dos contratos (constitution I).
- A `017` não cria migração própria: depende das cascatas já existentes e da regra registrada para a `016` (data-model).
