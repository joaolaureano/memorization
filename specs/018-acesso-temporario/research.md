# Research: Acesso temporário

## Contexto

A feature 018 responde ao pedido de continuar conectado após Entrar, com validade limitada e decidida pelo servidor. A spec fixa FR-289..FR-306 e SC-114..SC-124, além de revisar FR-079/FR-089/FR-090/FR-091. Este documento registra as decisões D1–D9, as alternativas rejeitadas e as skills aplicadas, conforme o Princípio II da constituição 3.0.0. O `SESSION.md` não é usado; ele existe apenas na tag `v1.0.0`. As ações e verificações ficam nas mensagens de commit.

## Decisões

### D1 — Representação e armazenamento

O Acesso temporário é um valor opaco aleatório de pelo menos 256 bits, gerado no servidor ao Entrar. O servidor guarda apenas o digest SHA-256. Uma migração nova cria `acesso_temporario(digest PK, usuario_id REFERENCES usuario(id) ON DELETE CASCADE, criado_em, expira_em, ultima_acao_em)` com índice `(usuario_id)`, nos dois Adapters. Número da migração: **9** se a migração 8 da 016 já estiver aplicada; caso contrário, **8**. A escolha é registrada explicitamente no commit da migração. Uma nova Porta `ArmazenamentoDeAcessos` é criada em `porta.ts`, com `criar`, `obterValido`, `renovar`, `encerrar`, `encerrarTodosDoUsuario` e `removerExpirados`; a alternativa de estender `ArmazenamentoDeUsuarios` foi rejeitada porque o ciclo de vida é diferente e a nova Porta tem dois Adapters reais (SQLite e PostgreSQL), justificando a Seam pelo Princípio IV. FR-289, FR-297, FR-301; SC-115, SC-116, SC-122.

### D2 — Transporte

O navegador guarda o Acesso em cookie definido pelo servidor com `HttpOnly`, `Secure` na nuvem, `SameSite=Strict`, `Path=/` e `Max-Age` longo. A validade é decidida apenas por `expira_em` no servidor (FR-297), então o relógio do aparelho não altera a decisão. Scripts da página não leem o cookie; o Acesso nunca aparece em URL, corpos de resposta ou logs (FR-297, FR-305). Em produção, SPA e `/api` são same-origin no CloudFront, sem CORS. No local, Vite e API usam portas diferentes; a política de CORS local deixa de ser `*` e passa a usar a origem configurada do frontend com `Access-Control-Allow-Credentials: true`, testada. O cliente usa `fetch` com `credentials: include`. Com «Continuar conectado neste navegador» desmarcada, nenhum Acesso é emitido e a Credencial em memória continua sendo enviada como Basic a cada operação. O hook de Credencial aceita Acesso válido OU Basic válida (FR-090 revisado). FR-089, FR-090, FR-292, FR-297, FR-305; SC-116, SC-121.

### D3 — Validade e renovação

TTL de 5 minutos a partir da última ação (FR-291). O servidor define `expira_em = agora + TTL` no Entrar e em toda requisição autenticada (renovação). Interações que não fazem requisição — digitar, Revelar, Avaliar, navegar — são reportadas por `POST /acesso/renovar`, enviado pelo Module puro `frontend/src/acesso/atividade.ts`, que faz throttle para no máximo uma renovação a cada 60 s enquanto houver interação (teclado, clique, toque). Assim, pessoa ativa não chega a 5 minutos ociosos. O TTL é configurável apenas por ambiente para testes, `ACESSO_VALIDADE_SEGUNDOS`, padrão 300, nunca pela pessoa. FR-291, FR-294; SC-123, SC-124.

### D4 — Rotas

Todas as rotas abaixo entram em `registrarRotasDaAplicacao` e na lista de pré-voo de CORS, com teste de paridade em `backend/tests/funcao/funcao.test.ts` e guarda em `backend/tests/http/cors.test.ts`:

- `POST /entrar` estendido com `continuarConectado: boolean` (padrão `true`); no sucesso define o cookie apenas quando `true` e devolve `{ nomeDeUsuario }`, nunca o Acesso no corpo.
- `GET /acesso`: `200 { nomeDeUsuario }` quando válido (usado na carga para pular Entrar, FR-290); `401 { erro: 'acesso_expirado' }` quando a linha existe e está expirada; `401 { erro: 'sem_acesso' }` nos demais; `503` quando o armazenamento está indisponível e o cookie não é limpo (FR-301).
- `POST /acesso/renovar`: `204`, `401` ou `503`.
- `POST /sair`: `204`, remove a linha e limpa o cookie (FR-293, FR-295).

O hook de Credencial: Acesso válido renova e prossegue; Acesso expirado devolve `401 acesso_expirado`; falha de armazenamento devolve `503` sem limpar o cookie. FR-090, FR-091, FR-290, FR-293, FR-294, FR-295, FR-301, FR-306; SC-115, SC-119, SC-122, SC-123.

### D5 — Integração com 017

Troca de Senha e alteração de Nome de usuário chamam `encerrarTodosDoUsuario` e emitem um NOVO Acesso para a requisição atual via `Set-Cookie` quando a requisição foi autenticada por Acesso (FR-296). Exclusão de conta remove os Acessos por cascade e limpa o cookie. O contrato §3 da 017 permanece; acrescenta-se o comportamento de `Set-Cookie`. FR-296; SC-120.

### D6 — Frontend

`Aplicacao.tsx`, na carga, chama `GET /acesso`: válido → Início sem Entrar (FR-290, SC-118 ≤ 2 s); `acesso_expirado` → Entrar com «Seu acesso expirou. Entre novamente.» (FR-294, SC-123); `sem_acesso` → Entrar. `PaginaDeEntrada.tsx` ganha a caixa «Continuar conectado neste navegador», marcada por padrão, acessível (FR-292, FR-302, FR-303). Sair chama `POST /sair`. Qualquer `401 acesso_expirado` durante o uso leva a Entrar com a mensagem de expiração, sem sucesso (FR-091 revisado, FR-294); Sessão de estudo em andamento é descartada conforme FR-151/FR-157 de 012. FR-289..FR-295, FR-302..FR-304; SC-114, SC-118, SC-119, SC-121, SC-123.

### D7 — Expirados

Linhas expiradas são removidas preguiçosamente, na validação e no Entrar via `removerExpirados`; não há job em background. FR-301; SC-122.

### D8 — Testes

Bateria da Porta nos dois Adapters (só digest guardado, cascade ao excluir Usuário, expiração, renovação, `encerrarTodosDoUsuario`); contrato HTTP (flags do cookie `HttpOnly`/`SameSite`/`Secure` na nuvem, Acesso ausente do corpo, códigos `401`, `503` mantém cookie); hook de Credencial com Acesso e com Basic; throttle de `atividade.ts`; telas (caixa de Entrar, fluxo de carga, mensagem de expiração); e2e em navegador real com `ACESSO_VALIDADE_SEGUNDOS` pequeno (por exemplo, 5): recarregar permanece conectado, ociosidade além do TTL leva a Entrar com mensagem, Sair e reabrir leva a Entrar, dois contextos e troca de Senha da 017, inspeção de armazenamento provando ausência de Senha (SC-116), Sessão de estudo maior que o TTL com interações mantém o Acesso (SC-124). FR-289..FR-306; SC-114..SC-124.

### D9 — Ondas de execução

1) Porta + migração + dois Adapters + bateria; 2) hook + rotas + CORS com credenciais + paridade + integração 017; 3) cliente frontend (`credentials: include`) + `atividade.ts`; 4) caixa em Entrar, carga/expiração em `Aplicacao`, Sair; 5) e2e; 6) convergência. FR-289..FR-306; SC-114..SC-124.

## Alternativas rejeitadas

- **Guardar o Acesso em `localStorage` e enviar via `Authorization`**: legível por scripts da página, contraria a proteção contra injeção e FR-297; rejeitada.
- **JWT ou valor assinado autocontido**: não pode ser revogado em Sair ou em eventos da 017 sem lista no servidor; a tabela de digest é mais simples e revogável; rejeitada.
- **Guardar a Senha no navegador**: proibido por FR-078; rejeitada.
- **Validade fixa desde o Entrar**: rejeitada pelo Product Owner no clarify; a validade é deslizante e renovada por ação (FR-291).
- **Estender `ArmazenamentoDeUsuarios` em vez de nova Porta**: misturaria ciclos de vida e esconderia a Seam; rejeitada em favor de `ArmazenamentoDeAcessos`, que tem dois Adapters reais.

## Migração

A tabela nova exige migração nova. O número é o próximo disponível no momento da implementação: **9** se a migração 8 da 016 já estiver no repositório; caso contrário, **8**. A decisão é registrada no commit da migração e em `data-model.md`.

## CORS local

Produção é same-origin. No local, a política `*` não serve com credenciais; a origem do frontend é configurada e o pré-voo responde com `Access-Control-Allow-Credentials: true`. O teste de CORS cobre as rotas novas e a credencial.

## Skills aplicadas

### domain-modeling

Aplicada porque a feature mexe na linguagem do domínio e em cenários-limite: o termo escolhido é **Acesso temporário**, porque «token», «sessão», «cookie» e «login» são `_Avoid_` em `CONTEXT.md`; **Credencial**, **Entrar**, **Sair**, **Usuário** e **Navegador** permanecem canônicos. A skill orientou a distinção entre Credencial (memória) e Acesso temporário (guardado no navegador), as invariantes de expiração/encerramento e os cenários de relógio do aparelho, cópia do Acesso, Sessão de estudo e falha de armazenamento.

### codebase-design

Aplicada porque a feature cria uma Porta nova, altera um hook e adiciona um Module puro. A skill orientou: `ArmazenamentoDeAcessos` com dois Adapters reais e Interface pequena; hook de Credencial como ponto único que aceita Acesso ou Basic; `atividade.ts` como Module puro, sem I/O, testável pela Interface; e a manutenção da Seam do `ClienteDoAcervo` no frontend. Nenhuma ADR é criada, conforme a constituição; as decisões ficam neste `research.md`.

## Rastreabilidade

D1: FR-289, FR-297, FR-301; SC-115, SC-122. D2: FR-089, FR-090, FR-297, FR-305; SC-116. D3: FR-291, FR-294; SC-123, SC-124. D4: FR-290..FR-295, FR-301, FR-306; SC-115, SC-119, SC-122, SC-123. D5: FR-296; SC-120. D6: FR-289..FR-295, FR-302..FR-304; SC-114, SC-118, SC-121. D7: FR-301; SC-122. D8: FR-289..FR-306; SC-114..SC-124. D9: idem ondas.

## Portão de análise (2026-10-03)

Análise cruzada de `spec.md`, checklist, plan, research, data-model, contratos,
quickstart e tasks contra a constituição 3.0.0 e `CONTEXT.md`. Não há item
CRITICAL restante; o checklist de requisitos permanece aprovado. Quatro achados
de consistência foram resolvidos antes de qualquer implementação:

- **A1 — FR-090 e continuidade desmarcada**: FR-090 exigia Acesso temporário
  para toda operação, enquanto D2 e as tasks mantinham a Credencial Basic em
  memória se a continuidade fosse desmarcada. O requisito passou a autorizar
  explicitamente essa Credencial somente na página aberta; a recarga ou o
  fechamento a descarta.
- **A2 — Substituição e desmarcação**: US1 exige que um novo Entrar substitua o
  Acesso do mesmo Navegador, e FR-292 exige que a opção desmarcada não deixe
  continuidade. O contrato agora revoga o Acesso do cookie atual antes de emitir
  outro e o revoga e limpa quando a opção é desmarcada; T1808 e T1811 verificam
  os dois percursos.
- **A3 — Descarte de cookie `HttpOnly`**: o frontend não consegue apagar o
  cookie por script. Nos `401 acesso_expirado` e `401 sem_acesso`, `GET
  /acesso` e `POST /acesso/renovar` agora retornam `Set-Cookie` de limpeza; em
  `503`, o cookie é preservado conforme FR-301.
- **A4 — Module puro de atividade**: os documentos chamavam `atividade.ts` de
  puro e, ao mesmo tempo, atribuíam a ele observação de eventos e HTTP. A sua
  Interface agora recebe instantes e decide renovar/aguardar; `Aplicacao.tsx`
  observa eventos e usa `ClienteDoAcervo` para o I/O. Isso mantém a Interface
  como superfície de teste, com Leverage e Locality.

Cobertura de rastreabilidade conferida: FR-079, FR-089..FR-091, FR-289..FR-306
e SC-114..SC-124 têm ao menos uma tarefa. A implementação continua bloqueada
até a aprovação do Product Owner, conforme `tasks.md`.
