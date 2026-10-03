---
description: "Lista de tarefas da feature 018 — Acesso temporário"
---

# Tasks: Acesso temporário

**Somente planejamento: nenhuma tarefa é executada sem aprovação do Product Owner.**

**Executor**: workers DeepSeek via a ferramenta `delegate`, em cópias isoladas. Dentro de cada onda, os arquivos são disjuntos. Portões ao fim de cada onda — backend: `npm test`, `npm run typecheck`, `npm run lint`; frontend: `npm test`, `npm run build`, `npm run lint`; nas ondas finais, também os e2e. O Arquiteto revisa cada diff (constitution VI) e roda `graphify update .` ao fim.

**Input**: Design documents from `/specs/018-acesso-temporario/`

**Prerequisites**: [plan.md](./plan.md) (obrigatório), [spec.md](./spec.md) (obrigatório para as histórias), [research.md](./research.md) (D1–D9), [data-model.md](./data-model.md) e [contracts/contratos.md](./contracts/contratos.md).

**Tests**: presentes em cada tarefa. Pela constitution (I e IX), os testes da bateria da Porta, do hook de Credencial, das rotas HTTP, do Module puro `atividade.ts` e do cliente do frontend são escritos ANTES da implementação correspondente e ficam vermelhos até ela existir.

**Organization**: Agrupamento por história (US1–US5) e pelas ondas fixas de execução. Arquivos disjuntos por onda permitem paralelismo real via `delegate`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo com as outras tarefas da mesma onda (arquivos disjuntos)
- **[Story]**: a que história do spec.md a tarefa pertence (US1–US5); só nas fases de história
- Cada tarefa cita a seção do contrato (`contracts/contratos.md` §n), os FR/SC que cobre e os arquivos exatos
- Restrições literais do `plan.md`/`contracts` (cookie `HttpOnly`, `SameSite=Strict`, `Secure` na nuvem, `Path=/`; digest SHA-256; TTL via `ACESSO_VALIDADE_SEGUNDOS`; códigos `acesso_expirado` e `sem_acesso`; status `200/204/401/503`; throttle de 60 s; CORS local com origem configurada e `Access-Control-Allow-Credentials: true`; migração 8 ou 9 decidida na implementação) são citadas na tarefa que as implementa

## Path Conventions

- **Web app**: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/`

---

## Fase 1 — Setup

**Purpose**: Linha de base antes de qualquer código novo.

- [ ] T1801 Linha de base: rodar os portões de backend (`npm test`, `npm run typecheck`, `npm run lint`) e de frontend (`npm test`, `npm run build`, `npm run lint`) antes de começar; registrar o resultado bruto no relatório da feature.
  - **Sem código.** Se algum portão já estiver vermelho, parar e reportar ao Arquiteto antes de iniciar a Onda 1 (constitution VI e X).

**Checkpoint**: Base verde; Onda 1 liberada.

---

## Fase 2 — Foundational (pré-requisito bloqueante de todas as histórias)

**Purpose**: Porta, Adapters, bateria, cliente do frontend, hook HTTP e integração com a 017 prontos antes de qualquer tela.

**⚠️ CRÍTICO**: nenhuma história começa antes do fim da Fase 2.

### Onda 1 (paralelo)

- [ ] T1802 [P] Porta `ArmazenamentoDeAcessos` (§1) — `backend/src/armazenamento/porta.ts`.
  - Definir a nova Interface `ArmazenamentoDeAcessos` com `criar(digest, usuarioId, expiraEm)`, `obterValido(digest, agora)`, `renovar(digest, novoExpiraEm)`, `encerrar(digest)`, `encerrarTodosDoUsuario(usuarioId)` e `removerExpirados(agora)` (§1).
  - Tipos de saída: `{ usuarioId }` em sucesso; `nao_encontrado`, `expirado`, `indisponivel` (§1.2); `void`, `nao_encontrado`, `indisponivel` (§1.3); `void`, `indisponivel` (§1.4/§1.5); número de removidas, `indisponivel` (§1.6).
  - O valor em claro NUNCA entra na Porta: só o digest SHA-256 é persistido (§1; FR-297, SC-116).
  - Sem implementação: só tipos e Interface. Testes: nenhum nesta tarefa (a cobertura vem pela bateria em T1806). O typecheck dos dois Adapters falha até a Onda 2 (T1804, T1805), que implementa os métodos novos; isso é esperado e não bloqueia o portão da Onda 1.
  - FR-289, FR-297, FR-301; SC-115, SC-116, SC-122; §1.

- [ ] T1803 [P] Module puro `atividade.ts` (§6) — `frontend/src/acesso/atividade.ts`, `frontend/tests/atividade.test.ts`.
  - Module puro, sem I/O: recebe o instante de uma interação e o instante da última renovação e devolve a decisão de renovar ou aguardar. `Aplicacao.tsx` observa teclado, clique e toque e chama `POST /acesso/renovar` somente quando receber a decisão de renovar, no máximo uma vez a cada 60 s (§6; FR-291; SC-124).
  - A Aplicação deve fornecer ao Module cada interação da pessoa com a página — teclado, clique ou toque —, inclusive digitar num formulário, Revelar o Verso, Avaliar um Item e navegar entre telas, mesmo quando nada é gravado (§6; FR-291).
  - Testes: decisão na primeira interação; throttle de 60 s; nenhuma decisão de renovar sem interação. O vínculo dos eventos reais fica em T1813 (FR-291, SC-124).
  - FR-291; SC-124; §6.

**Checkpoint Onda 1**: portões de backend e frontend verdes; variáveis de contrato publicadas para as ondas 2 e 3.

### Onda 2 (paralelo; depende da Onda 1)

- [ ] T1804 [P] Adapter SQLite da nova Porta e migração nova — `backend/src/armazenamento/sqlite/armazenamento.ts`, `backend/src/armazenamento/sqlite/migracoes.ts`.
  - Implementar `criar`, `obterValido`, `renovar`, `encerrar`, `encerrarTodosDoUsuario`, `removerExpirados` (§1; FR-289, FR-297, FR-301).
  - Nova tabela `acesso_temporario(digest PK, usuario_id REFERENCES usuario(id) ON DELETE CASCADE, criado_em, expira_em, ultima_acao_em)`, com índice `(usuario_id)`; o banco guarda apenas o digest SHA-256, nunca o valor em claro (§1; FR-297, SC-116).
  - Migração nova: número **8 ou 9**, decidido na implementação conforme D1 (9 se a migração 8 da 016 já estiver aplicada; caso contrário, 8) — registrar a decisão no relatório.
  - `obterValido` devolve `{ usuarioId }` quando `expira_em > agora`; `expirado` quando existe e `expira_em <= agora`; `nao_encontrado` quando não existe; `indisponivel` em falha (§1.2; FR-294, FR-301).
  - Testes pela bateria compartilhada (T1806), rodada em `backend/tests/armazenamento/sqlite.test.ts`.
  - FR-289, FR-297, FR-301; SC-115, SC-116, SC-122; §1.

- [ ] T1805 [P] Adapter PostgreSQL da nova Porta e migração nova — `backend/src/armazenamento/postgresql/armazenamento.ts`, `backend/src/armazenamento/postgresql/migracoes.ts`.
  - Equivalentes aos de T1804, com tradução `TIMESTAMPTZ` ↔ ISO-8601 UTC como nas features anteriores.
  - A tabela `acesso_temporario` e o índice `(usuario_id)` seguem o mesmo contrato; a FK `usuario_id REFERENCES usuario(id) ON DELETE CASCADE` remove os Acessos ao excluir o Usuário (§1; FR-296).
  - Migração nova: número **8 ou 9**, decidido na implementação conforme D1 — registrar a decisão.
  - Testes pela bateria compartilhada (T1806), rodada em `backend/tests/armazenamento/postgresql/bateria.test.ts`.
  - FR-289, FR-296, FR-297, FR-301; SC-115, SC-116, SC-120, SC-122; §1.

- [ ] T1806 [P] Bateria compartilhada da nova Porta (§1) — `backend/tests/armazenamento/bateria-da-porta.ts`.
  - Cenário de **só digest guardado**: após `criar`, a linha contém apenas o digest SHA-256; o valor em claro não aparece no banco (FR-297, SC-116).
  - **Cascata ao excluir Usuário**: com dois Usuários, excluir um remove todos os Acessos dele e não toca no outro (FR-296, FR-299; SC-120).
  - **Expiração**: `obterValido` devolve `expirado` quando `expira_em <= agora`, e `nao_encontrado` quando a linha não existe (§1.2; FR-294).
  - **Renovação**: `renovar` atualiza `expira_em` e `ultima_acao_em`; o Acesso continua válido por mais 5 minutos (§1.3; FR-291).
  - **`encerrarTodosDoUsuario`**: remove todas as linhas do Usuário; `encerrar` remove só a linha indicada (§1.4/§1.5; FR-293, FR-296).
  - **Dois Usuários**: um Acesso de um Usuário não autoriza o acervo do outro (FR-298, SC-117).
  - A bateria roda nos dois Adapters (SQLite e PostgreSQL) com o mesmo arquivo.
  - FR-289, FR-291, FR-293, FR-294, FR-296, FR-297, FR-298, FR-299, FR-301; SC-115, SC-116, SC-117, SC-120, SC-122; §1.

- [ ] T1807 [P] Cliente do frontend: Acesso temporário (§6) — `frontend/src/acervo-cliente/cliente.ts`, `frontend/src/acervo-cliente/cliente-http.ts`, `frontend/src/acervo-cliente/cliente-em-memoria.ts`, `frontend/src/ui/guarda-de-credencial.ts`, `frontend/tests/acervo-cliente/acesso.test.ts`.
  - `ClienteDoAcervo` ganha `obterAcesso(): Promise<ResultadoDeObterAcesso>`, `renovarAcesso(): Promise<ResultadoDeRenovarAcesso>`, `sair(): Promise<ResultadoDeSair>` e `entrar(dados)` com `continuarConectado?: boolean` (§6; FR-289, FR-290, FR-292, FR-293, FR-294, FR-295).
  - `cliente-http.ts` usa `fetch` com **`credentials: "include"`** em todas as chamadas, para o navegador enviar e receber o cookie do Acesso (§6; FR-297, FR-305).
  - `guarda-de-credencial.ts` passa a **descartar a Credencial** quando o Acesso for recusado por expiração, Sair ou eventos da 017, e a **manter a Credencial apenas em memória** quando a continuidade estiver desmarcada (FR-089 e FR-091 revisados).
  - Regra literal: `401 acesso_expirado` recebe `Set-Cookie` que descarta o Acesso e leva a Entrar com a mensagem; `401 sem_acesso` também recebe limpeza do cookie e leva a Entrar; `503` **NÃO** descarta o Acesso temporário (FR-091, FR-294, FR-301, FR-304).
  - Testes em `frontend/tests/acervo-cliente/acesso.test.ts`: parsing e erros de cada método nos dois clientes; `credentials: "include"`; `401 acesso_expirado` descarta; `401 sem_acesso` leva a Entrar; `503` preserva o Acesso.
  - FR-079 revisado, FR-089 revisado, FR-090 revisado, FR-091 revisado, FR-289, FR-290, FR-292, FR-293, FR-294, FR-295, FR-297, FR-301; SC-115, SC-116, SC-119, SC-122; §6.

**Checkpoint Onda 2**: portões verdes; bateria da Porta verde nos dois Adapters; cliente do frontend com Acesso temporário verde.

### Onda 3 (depende da Onda 2)

- [ ] T1808 Hook e rotas do Acesso temporário (§2, §3, §4) — `backend/src/http/credencial.ts`, `backend/src/http/rotas.ts`, `backend/src/http/servidor.ts`, `backend/src/entradas/local.ts`, `e2e/servidores-locais.ts`, `backend/tests/http/acesso.test.ts`, `backend/tests/http/credencial.test.ts`, `backend/tests/http/cors.test.ts`.
  - **Origem do frontend no ambiente local (obrigatório)**: com `credentials: "include"`, o navegador recusa `Access-Control-Allow-Origin: *`. A entrada local lê a variável `ORIGEM_DO_FRONTEND` (padrão `http://127.0.0.1:5173`, a origem do `npm run dev`) e a usa no CORS com `Access-Control-Allow-Credentials: true`. Em `e2e/servidores-locais.ts`, `iniciarApi` passa à API a origem do Vite do teste. Sem isso, toda chamada do navegador local falha e a suíte e2e inteira quebra (§4).
  - Hook de Credencial aceita **EITHER** um Acesso temporário válido no cookie **OR** uma Credencial Basic válida (FR-090 revisado; §3).
  - Acesso válido: renova `expira_em` e prossegue, decorando `usuarioQueEntrou` (§3; FR-291).
  - Acesso expirado: `401 { erro: 'acesso_expirado' }` (FR-294); Acesso inexistente segue para Basic; se Basic também faltar, `401 credencial_invalida` (§3).
  - Falha de armazenamento ao verificar Acesso: `503`, **sem limpar o cookie** (FR-301; §3).
  - `POST /entrar` estendido: corpo `{ nomeDeUsuario, senha, continuarConectado?: boolean }`, padrão `true`; sucesso `200 { nomeDeUsuario }`; se `continuarConectado` for `true`, revoga o Acesso do cookie atual antes de criar e definir outro com **`HttpOnly`**, **`Secure` na nuvem**, **`SameSite=Strict`**, **`Path=/`**, `Max-Age` longo; nunca devolve o Acesso no corpo (FR-289, FR-292, FR-297; §2.1).
  - Se `continuarConectado` for `false`, revoga e limpa o Acesso do cookie atual, se houver; não emite outro e mantém a Credencial como Basic apenas na página aberta (§2.1; FR-090, FR-292).
  - `GET /acesso`: `200 { nomeDeUsuario }` quando válido; `401 { erro: 'acesso_expirado' }` quando expirou; `401 { erro: 'sem_acesso' }` quando não há linha ou cookie. Ambos os `401` limpam o cookie com `Set-Cookie`; `503` por armazenamento falho **não o limpa** (FR-091, FR-290, FR-294, FR-301; §2.2).
  - `POST /acesso/renovar`: `204` quando renova; `401 { erro: 'acesso_expirado' }` quando expirado; `401 { erro: 'sem_acesso' }` quando ausente ou encerrado. Ambos os `401` limpam o cookie; `503` não o limpa (FR-291, FR-294, FR-301; §2.3).
  - `POST /sair`: `204`; remove a linha do Acesso e limpa o cookie; `503` quando armazenamento falha, sem apresentar sucesso (FR-293, FR-295; §2.4).
  - Todas as rotas entram em `registrarRotasDaAplicacao` **E** na lista de pré-voo de CORS de `criarServidor`; o Acesso nunca aparece em URL, corpo de resposta ou log (FR-297, FR-305; §2).
  - CORS local deixa de ser `*` e usa a origem configurada do frontend com **`Access-Control-Allow-Credentials: true`**; `*` com credenciais é inválido e é rejeitado (§4; FR-090, FR-301).
  - `backend/tests/http/cors.test.ts` ganha a guarda: toda rota registrada precisa de pré-voo; falha se alguma estiver sem (§4; lição do bug `9251ae0` da 013 e do bug de CORS da 015).
  - `backend/tests/http/acesso.test.ts`: contrato HTTP com os status e códigos literais — `200/204/401/503`, `acesso_expirado`, `sem_acesso` —, cookie com `HttpOnly`, `Secure` na nuvem, `SameSite=Strict`, `Path=/`, e nunca Acesso no corpo ou URL. Cobre substituição do Acesso ao Entrar de novo, limpeza quando a continuidade é desmarcada e limpeza em ambos os `401`, preservando o cookie em `503` (FR-289..FR-301, FR-305, FR-306; SC-114, SC-115, SC-116, SC-118, SC-119, SC-121, SC-122, SC-123).
  - `backend/tests/http/credencial.test.ts`: hook aceita Acesso OU Basic; `401` por Acesso expirado; `401` por Basic ausente; `503` por falha de armazenamento sem limpar cookie (FR-079 revisado, FR-090 revisado, FR-091 revisado, FR-294, FR-301).
  - FR-079 revisado, FR-089 revisado, FR-090 revisado, FR-091 revisado, FR-289, FR-290, FR-291, FR-292, FR-293, FR-294, FR-295, FR-297, FR-301, FR-305, FR-306; SC-114..SC-124; §2, §3, §4.

- [ ] T1809 [P] Paridade local/nuvem das rotas novas (§2; D4) — `backend/tests/funcao/funcao.test.ts`, `backend/src/funcao/funcao.ts` (só o tipo).
  - **Cookies na Function URL**: no evento da nuvem, os cookies chegam no campo `cookies` (e não no cabeçalho `cookie`), e o `Set-Cookie` sai no campo `cookies` da resposta. O evento sintético do teste traz `cookies` e confere que `POST /entrar` devolve `cookies` com o Acesso e que `GET /acesso` reconhece o Acesso recebido assim. O tipo `RespostaDaFuncao` ganha `cookies?: string[]`, sem mudar comportamento (a `@fastify/aws-lambda` já faz a tradução).
  - Cada rota nova precisa ser chamada pela função da nuvem (`backend/src/funcao/funcao.ts`): `GET /acesso`, `POST /acesso/renovar`, `POST /sair` e o `POST /entrar` estendido.
  - O teste deve **falhar se uma rota nova não estiver em `registrarRotasDaAplicacao`** (lição do bug `9251ae0` da 013).
  - FR-090 revisado, FR-301; §2.

- [ ] T1810 [P] Integração com a 017 (§5) — `backend/src/identidade/identidade.ts`, `backend/tests/identidade/acesso-e-conta.test.ts`.
  - Trocar Senha e alterar Nome de usuário chamam `encerrarTodosDoUsuario` e emitem um **NOVO** Acesso para a requisição atual via `Set-Cookie` quando ela foi autenticada por Acesso (FR-296; §5).
  - Excluir Usuário remove os Acessos por cascade e limpa o cookie; nenhum novo Acesso é emitido nesse caso (FR-296; SC-120).
  - Dois Navegadores: o outro é recusado na próxima operação; o navegador da alteração continua com novo Acesso (SC-120; §5).
  - O contrato §3 da 017 permanece; a substituição da Credencial em memória ao alterar Nome de usuário ou trocar Senha passa a emitir um novo Acesso temporário para o navegador da alteração (FR-263 e FR-270 da 017; §5).
  - Testes: `acesso-e-conta.test.ts` cobre troca de Senha, alteração de Nome e exclusão, com dois Usuários/Navegadores, exigindo recusa dos Acessos antigos e ausência de novo Acesso na exclusão.
  - FR-296; SC-120; §5.

**Checkpoint Onda 3**: portões de backend verdes; rotas do Acesso disponíveis em local e nuvem; guarda de CORS verde; integração com a 017 verde.

---

## Fase 3 — US1 Continuar conectado após recarregar ou reabrir (Priority: P1) 🎯 MVP

**Goal**: Entrar com a opção «Continuar conectado neste navegador» marcada por padrão e carga da aplicação com `GET /acesso`, voltando ao Início sem novo Entrar.

**Independent Test**: Entrar, fechar o navegador, reabrir 2 minutos depois e confirmar que a pessoa volta ao Início sem Entrar; repetir recarregando a página e fechando e reabrindo a aba.

**Onda 4 (paralelo):**

- [ ] T1811 [P] [US1] `PaginaDeEntrada.tsx`: opção «Continuar conectado neste navegador» (§6) — `frontend/src/ui/PaginaDeEntrada.tsx`, `frontend/tests/pagina-de-entrada.test.tsx`.
  - A opção MUST vir **marcada por padrão** e MUST ser acessível por teclado, com foco visível que não dependa apenas de cor (FR-292, FR-302, FR-303; SC-121).
  - Ao concluir Entrar, enviar `continuarConectado` ao cliente; quando desmarcada, nenhum Acesso temporário é emitido e recarregar/fechar exige Entrar de novo (FR-292).
  - Testes: marcação padrão; alternar por teclado; Entrar com a opção marcada e desmarcada, inclusive desmarcar depois de uma entrada anterior com Acesso e confirmar que a recarga exige Entrar (FR-292, FR-302, FR-303). Larguras de 360 a 1440 px e zoom de 200 % ficam no e2e T1817 (`visual-e-contraste.spec.ts`; SC-121).
  - FR-292, FR-302, FR-303; SC-121; §6.

- [ ] T1812 [P] [US1] `Aplicacao.tsx`: carga com `GET /acesso` (§6) — `frontend/src/ui/Aplicacao.tsx`, `frontend/tests/aplicacao-acesso.test.tsx`.
  - Na carga, chamar `GET /acesso`: válido → Início sem Entrar; `401 acesso_expirado` → Entrar com a mensagem **«Seu acesso expirou. Entre novamente.»**; `401 sem_acesso` → Entrar (FR-290, FR-294; SC-118, SC-123).
  - A reabertura dentro da validade no ambiente local volta ao Início em até 2 s (SC-118).
  - O Acesso temporário nunca aparece no endereço/URL nem em campo visível da interface (FR-305).
  - Testes: carga com Acesso válido; `acesso_expirado` com a mensagem exata; `sem_acesso`; ausência do Acesso na URL e na tela (FR-305). O tempo de retorno ≤ 2 s (SC-118) é medido no navegador real, no e2e T1816.
  - FR-290, FR-294, FR-305; SC-114, SC-118, SC-123; §6.

**Checkpoint**: US1 testável isoladamente em `frontend/tests/pagina-de-entrada.test.tsx` e `frontend/tests/aplicacao-acesso.test.tsx`.

---

## Fase 4 — US2 Acesso expira com o tempo (Priority: P1)

**Goal**: Quando o Acesso expira, a próxima operação é recusada e a pessoa volta a Entrar com a mensagem exata; nada em andamento é apresentado como concluído.

**Independent Test**: Entrar, ficar 5 minutos sem nenhuma ação e confirmar que recarregar ou reabrir leva a Entrar com a mensagem exata; tentar operar um Cartão e confirmar recusa sem mudança.

**Onda 5:**

- [ ] T1813 [US2] Expiração durante o uso (§6) — `frontend/src/ui/Aplicacao.tsx`, `frontend/tests/expiracao-do-acesso.test.tsx`.
  - Qualquer `401 acesso_expirado` durante o uso leva a Entrar com a mensagem **«Seu acesso expirou. Entre novamente.»**, sem apresentar a operação como concluída (FR-294, FR-091 revisado; SC-115, SC-123).
  - Sessão de estudo em andamento é descartada conforme FR-151/FR-157 de `012`, sem registrar estudo parcial nem apresentar conclusão (FR-151, FR-157; SC-124).
  - A renovação é ligada a `frontend/src/acesso/atividade.ts` na aplicação, para que teclado, clique e toque renovem o Acesso no máximo a cada 60 s (FR-291; SC-124).
  - Testes: teclado, clique e toque vinculados a `atividade.ts` disparam a renovação quando a decisão for renovar; `401 acesso_expirado` em operação de Cartão/Baralho/Vínculo; recusa sem mudança; Sessão de estudo descartada; mensagem exata e foco no campo de Entrar perceptível por leitor de tela (FR-304; SC-123).
  - Depende de T1812 e compartilha `frontend/src/ui/Aplicacao.tsx`; **NÃO é [P]** com T1812 — executa depois, em série.
  - FR-091 revisado, FR-151, FR-157, FR-291, FR-294, FR-304; SC-115, SC-123, SC-124; §6.

**Checkpoint**: US2 testável isoladamente em `frontend/tests/expiracao-do-acesso.test.tsx`.

---

## Fase 5 — US3 Sair encerra o acesso neste navegador (Priority: P1)

**Goal**: Sair chama `POST /sair`, descarta a Credencial, encerra o Acesso daquele navegador e leva a Entrar.

**Independent Test**: Entrar, Sair, fechar e reabrir o navegador e confirmar que a aplicação exige Entrar; tentar reapresentar o Acesso encerrado e confirmar recusa.

**Onda 5 (paralelo com T1813 e T1815):**

- [ ] T1814 [P] [US3] Sair com Acesso (§6) — `frontend/src/ui/Moldura.tsx`, `frontend/tests/sair-com-acesso.test.tsx`.
  - Sair chama `POST /sair`; em `204`, descarta a Credencial e vai a Entrar (FR-293, FR-295).
  - Depois de Sair, reabrir o navegador não dá acesso, e o Acesso encerrado é recusado mesmo que copiado (FR-295; SC-119).
  - O Acesso encerrado por Sair não pode ser reutilizado; a operação não aparece como concluída (FR-295, FR-044).
  - Testes: `204` leva a Entrar; reabertura exige Entrar; Acesso guardado antes de Sair é recusado; o foco vai para o campo de Entrar, perceptível por leitor de tela (FR-304; SC-119).
  - FR-293, FR-295, FR-304; SC-119; §6.

**Checkpoint**: US3 testável isoladamente em `frontend/tests/sair-com-acesso.test.tsx`.

---

## Fase 6 — US4 Alterações da conta encerram os acessos (Priority: P2)

**Goal**: Trocar a Senha, alterar o Nome de usuário ou excluir o Usuário encerra todos os Acessos; o navegador da alteração recebe um novo Acesso quando aplicável.

**Independent Test**: com dois navegadores entrados, trocar a Senha em um; confirmar que o outro é recusado na próxima operação e volta a Entrar; o navegador da troca continua operando; repetir com alteração de Nome de usuário e exclusão do Usuário.

**Onda 5 (paralelo com T1813 e T1814):**

- [ ] T1815 [P] [US4] Tela: após troca/alteração da 017 a página segue com o novo Acesso; outra aba é recusada (§5, §6) — `frontend/tests/acesso-e-minha-conta.test.tsx`.
  - Após troca de Senha ou alteração de Nome de usuário, o navegador da alteração continua operando com o novo Acesso, sem novo Entrar (FR-296; SC-120).
  - Outra aba ou outro navegador com o Acesso antigo é recusado na próxima operação e volta a Entrar com mensagem explicativa (FR-296, FR-091 revisado; SC-120).
  - Exclusão do Usuário encerra todos os Acessos e não emite nenhum novo; a tela leva a Entrar (FR-296; SC-120).
  - A cobertura de backend já está em T1810; esta tarefa cobre a tela e a outra aba (SC-120).
  - Testes: troca de Senha com outra aba recusada; alteração de Nome com outra aba recusada; exclusão sem novo Acesso; mensagem explicativa leva a Entrar (FR-304; SC-120).
  - FR-091 revisado, FR-296, FR-304; SC-120; §5, §6.

**Checkpoint**: US4 coberta em `frontend/tests/acesso-e-minha-conta.test.tsx` e no e2e T1816.

---

## Fase 7 — US5 Vários navegadores independentes (Priority: P3)

**Goal**: Cada Entrar em outro navegador ou aparelho cria um Acesso temporário próprio e independente; encerrar um não afeta os outros, exceto pelos eventos da 017.

**Independent Test**: Entrar em dois navegadores, Sair em um e confirmar que o outro continua no acervo; depois trocar a Senha em um e confirmar que ambos são encerrados.

**Cobertura**: sem tarefa própria; coberta pelo e2e T1816 (dois contextos de navegador) e pela bateria T1806 (dois Usuários). Não há arquivo novo nesta fase.

**Checkpoint**: cenário de dois contextos coberto no e2e T1816.

---

## Fase 8 — Polish & integração

**Purpose**: e2e novo, e2e existentes e convergência.

### Onda 6 (paralelo)

- [ ] T1816 [P] e2e novo `e2e/acesso-temporario.spec.ts` com `ACESSO_VALIDADE_SEGUNDOS=5` — `e2e/acesso-temporario.spec.ts`.
  - O e2e MUST usar `ACESSO_VALIDADE_SEGUNDOS=5` para tornar a validade observável; a variável é de teste e não é exposta à pessoa (plan.md; FR-291).
  - Cenários: recarregar dentro do TTL (SC-114, SC-118); ociosidade além do TTL leva a Entrar com a mensagem exata (FR-294, SC-123); Sair e reabrir exige Entrar (FR-295, SC-119); dois contextos de navegador (US5, FR-299); troca de Senha pela 017 encerra o outro contexto (FR-296, SC-120); inspeção do armazenamento do navegador sem Senha (SC-116, FR-297); Sessão de estudo maior que o TTL com interações (SC-124, FR-291).
  - O Acesso temporário nunca aparece no endereço/URL nem em registros da aplicação (FR-297, FR-305; SC-116).
  - `e2e/servidores-locais.ts` já recebe a origem do frontend na T1808; aqui só se passa `ACESSO_VALIDADE_SEGUNDOS=5` à API do teste, se ainda faltar.
  - FR-291, FR-294, FR-295, FR-296, FR-297, FR-299, FR-305; SC-114, SC-116, SC-118, SC-119, SC-120, SC-123, SC-124.

- [ ] T1817 [P] e2e existentes que dependem de Entrar a cada recarga passam a considerar o Acesso — `e2e/*.spec.ts` afetados.
  - Candidatos a revisão: `entrar-e-acervo-por-usuario.spec.ts`, `navegacao.spec.ts`, `percurso-por-teclado.spec.ts`, `visual-e-contraste.spec.ts` (Entrar com a caixa marcada, conforme o novo fluxo).
  - Onde o teste recarrega esperando Entrar, deve passar a considerar que, com a opção «Continuar conectado neste navegador» marcada por padrão, o Acesso temporário pode manter a pessoa no Início (FR-290, FR-292).
  - A revisão não pode enfraquecer a cobertura já existente de Entrar/Sair; quando o cenário exigir Entrar de novo, desmarcar a caixa ou Sair primeiro (FR-292).
  - Listar no relatório cada arquivo alterado e a justificativa.
  - FR-290, FR-292; SC-114, SC-118.

### Onda 7

- [ ] T1818 Converge — portões completos, `graphify update .`, quickstart ([quickstart.md](./quickstart.md)) percorrido de ponta a ponta, relatório ao PO.
  - Portões completos: backend (`npm test`, `npm run typecheck`, `npm run lint`), frontend (`npm test`, `npm run build`, `npm run lint`) e e2e.
  - `graphify update .` ao fim, revisão de cada diff (constitution VI) e relatório ao Product Owner.
  - **Sem commit sem pedido explícito.**

**Checkpoint final**: feature pronta para revisão do Arquiteto e aceite do PO.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Fase 1 (Setup)**: começa imediatamente; sem código.
- **Fase 2 (Foundational)**: depende da Fase 1; **bloqueia** todas as histórias. Divide-se nas ondas 1–3, em série entre si.
- **Fases 3–6 (US1–US4)**: dependem da Fase 2. As histórias são independentes entre si depois disso, com duas ressalvas de integração: **T1812 (US1) e T1813 (US2)** compartilham `frontend/src/ui/Aplicacao.tsx` e são sequenciais; **T1815 (US4)** depende de T1810 (backend) e do e2e T1816 para a cobertura completa.
- **Fase 7 (US5)**: depende de T1806 e T1816; não tem tarefa própria.
- **Fase 8 (Polish)**: depende de todas as histórias desejadas; ondas 6–7 em série.
- **Ordem entre features**: a 018 é implementada **depois** da 017, sobre ela já integrada. As duas alteram `frontend/src/ui/Aplicacao.tsx` e o fluxo de Credencial (017 T1714; 018 T1812, T1813), e a T1810 depende das operações da 017 em `identidade.ts`. Se a 017 ainda não estiver implementada, a T1810 e a T1815 esperam por ela.

### User Story Dependencies

- **US1 (P1)**: pode começar logo após a Fase 2; T1812 depende de T1807 e T1803.
- **US2 (P1)**: depende de T1812; T1813 compartilha `Aplicacao.tsx` e roda em série.
- **US3 (P1)**: independente; usa T1807 e T1808.
- **US4 (P2)**: T1815 cobre a tela; a integração de backend é T1810; o e2e é T1816.
- **US5 (P3)**: coberta por T1806 (dois Usuários) e T1816 (dois contextos).

### Within Each User Story

- Testes primeiro (constitution I e IX), depois a implementação.
- Tipos antes de Interface; Interface antes de Adapters; Adapters antes de Module; Module antes de HTTP; HTTP antes de telas.
- Cada tarefa fecha com os portões da onda verde.

### Parallel Opportunities

- Todas as tarefas **[P]** da mesma onda rodam em paralelo (arquivos disjuntos).
- **Onda 1**: `T1802`, `T1803` em paralelo.
- **Onda 2**: `T1804`, `T1805`, `T1806`, `T1807` em paralelo.
- **Onda 3**: `T1809` e `T1810` em paralelo com `T1808` (arquivos disjuntos); `T1808` fecha a onda.
- **Onda 4**: `T1811`, `T1812` em paralelo.
- **Onda 5**: `T1813`, `T1814`, `T1815` em paralelo (T1813 não é [P] com T1812, que é da Onda 4).
- **Onda 6**: `T1816`, `T1817` em paralelo.

### Tabela das Ondas

| Onda | Tarefas | Portão |
| --- | --- | --- |
| 1 | T1802, T1803 | backend: `npm test`, `npm run typecheck`, `npm run lint`; frontend: `npm test`, `npm run build`, `npm run lint` |
| 2 | T1804, T1805, T1806, T1807 | idem + bateria da Porta verde nos dois Adapters |
| 3 | T1808, T1809, T1810 | idem |
| 4 | T1811, T1812 | idem |
| 5 | T1813, T1814, T1815 | idem |
| 6 | T1816, T1817 | idem + e2e |
| 7 | T1818 | portões completos + `graphify update .` |

---

## Parallel Example: Onda 2

O Arquiteto faz, na mesma mensagem, quatro chamadas à ferramenta `delegate` (`task: "write"`), uma por tarefa: T1804, T1805, T1806 e T1807. Cada chamada leva os arquivos de leitura e de escrita da tarefa e o contrato fixo. Os resultados voltam como edições, que o Arquiteto revisa e aplica; só então roda o portão da onda. As Ondas 1, 3, 4, 5 e 6 seguem o mesmo padrão, com duas, três, duas, três e duas chamadas paralelas, respectivamente. A Onda 3 tem T1808 como tarefa que fecha o portão, e T1809 e T1810 em paralelo com ele.

---

## Rastreabilidade Requisito–Teste

| Requisito | Tarefa(s) |
| --- | --- |
| FR-079 (008, revisado) | T1807, T1808, T1812 |
| FR-089 (008, revisado) | T1807, T1808, T1812 |
| FR-090 (008, revisado) | T1808, T1809, T1813 |
| FR-091 (008, revisado) | T1807, T1808, T1813, T1815 |
| FR-289 | T1802, T1804, T1805, T1807, T1808, T1811 |
| FR-290 | T1807, T1808, T1812, T1817 |
| FR-291 | T1802, T1803, T1804, T1805, T1806, T1807, T1808, T1813, T1816 |
| FR-292 | T1807, T1808, T1811, T1817 |
| FR-293 | T1806, T1807, T1808, T1814 |
| FR-294 | T1802, T1804, T1805, T1806, T1807, T1808, T1812, T1813 |
| FR-295 | T1806, T1807, T1808, T1814 |
| FR-296 | T1804, T1805, T1806, T1808, T1810, T1815, T1816 |
| FR-297 | T1802, T1804, T1805, T1806, T1807, T1808, T1809, T1816 |
| FR-298 | T1806, T1808 |
| FR-299 | T1806, T1808, T1816 |
| FR-300 | T1807, T1808, T1812 |
| FR-301 | T1802, T1804, T1805, T1806, T1807, T1808 |
| FR-302 | T1811, T1813, T1814 |
| FR-303 | T1811, T1814 |
| FR-304 | T1807, T1813, T1814, T1815 |
| FR-305 | T1807, T1808, T1812, T1816 |
| FR-306 | T1802, T1804, T1805, T1806, T1808, T1809 |
| SC-114 | T1808, T1812, T1816, T1817 |
| SC-115 | T1806, T1807, T1808, T1810, T1813, T1815, T1816 |
| SC-116 | T1802, T1804, T1805, T1806, T1807, T1808, T1816 |
| SC-117 | T1806, T1808 |
| SC-118 | T1812, T1816, T1817 |
| SC-119 | T1807, T1808, T1814, T1816 |
| SC-120 | T1804, T1805, T1806, T1808, T1810, T1815, T1816 |
| SC-121 | T1811, T1814, T1817 |
| SC-122 | T1802, T1804, T1805, T1806, T1807, T1808 |
| SC-123 | T1808, T1812, T1813, T1816 |
| SC-124 | T1803, T1806, T1813, T1816 |

---

## Implementation Strategy

### MVP First (Fase 2 + US1 + US2)

1. Fase 1 (Setup) → linha de base verde.
2. Fase 2 (Foundational) completa: ondas 1–3 verdes nos dois Adapters, no hook HTTP e na integração com a 017.
3. Fase 3 (US1 — Continuar conectado) e Fase 4 (US2 — Expira com o tempo).
4. **PARAR e VALIDAR**: Entrar, fechar e reabrir o navegador; expirar o Acesso com `ACESSO_VALIDADE_SEGUNDOS=5`; percorrer o `quickstart.md`.
5. Demonstração pronta para o PO.

### Incremental Delivery

1. Fase 2 + US1 + US2 → demonstração (MVP).
2. + US3 (Sair encerra) → demonstração.
3. + US4 (Alterações da 017 encerram) → demonstração.
4. + US5 (Vários navegadores) → demonstração via e2e.
5. Fase 8 (e2e e convergência) → entrega.

### Parallel Team Strategy

Com workers DeepSeek via `delegate`:

1. Onda 1 em paralelo (`T1802`, `T1803`).
2. Onda 2 em paralelo (`T1804`–`T1807`); portão da bateria da Porta nos dois Adapters.
3. Onda 3 com `T1808` e `T1809`/`T1810` em paralelo; o Arquiteto confere paridade local/nuvem e guarda de CORS.
4. Onda 4 em paralelo (`T1811`, `T1812`).
5. Onda 5 em paralelo (`T1813`, `T1814`, `T1815`), respeitando a serialização de `Aplicacao.tsx` com a Onda 4.
6. Onda 6 em paralelo (`T1816`, `T1817`); Onda 7 (`T1818`) em série.

---

## Notes

- **[P]** = arquivos disjuntos dentro da mesma onda.
- **[USn]** só nas fases de história; Setup, Foundational e Polish não levam rótulo de história.
- Testes fazem parte de cada tarefa; o Arquiteto revisa cada diff e roda `graphify update .` ao fim (constitution VI e XI).
- Restrições literais do `plan.md`/`contracts`: cookie `HttpOnly`, `SameSite=Strict`, `Secure` na nuvem, `Path=/`; digest SHA-256; TTL via `ACESSO_VALIDADE_SEGUNDOS` (padrão 300, testes com 5 s); códigos `acesso_expirado` e `sem_acesso`; status `200/204/401/503`; mensagem «Seu acesso expirou. Entre novamente.»; throttle de 60 s; CORS local com origem configurada e `Access-Control-Allow-Credentials: true`; migração 8 ou 9 decidida na implementação.
- Códigos literais do contrato: `acesso_expirado`, `sem_acesso`.
- Statuses literais do contrato HTTP: `200`, `204`, `401`, `503`.
- HTTP em `registrarRotasDaAplicacao` **E** no pré-voo de CORS de `criarServidor` (§2; lição dos bugs da 013 e da 015).
- Sem novos arquivos fora do esqueleto. Sem alterar assinaturas dos contratos (constitution I).
- A migração nova é obrigatória pela tabela `acesso_temporario`; o número 8 ou 9 é decidido no momento da implementação, conforme D1.
- O Acesso temporário nunca aparece em URL, corpo de resposta ou log; a Senha nunca é guardada no navegador (FR-078, FR-297, FR-305).
