# Contratos: Acesso temporário

Este documento descreve a Porta `ArmazenamentoDeAcessos`, o contrato HTTP, o hook de Credencial, a integração com a 017 e o contrato do frontend para FR-289..FR-306 e SC-114..SC-124. Nada aqui é implementação; é o contrato que as ondas de execução devem respeitar.

## 1. Porta `ArmazenamentoDeAcessos` (`backend/src/armazenamento/porta.ts`)

### 1.1 `criar(digest, usuarioId, expiraEm)`

- Entrada: digest SHA-256 e Usuário.
- Saída: void em sucesso; `indisponivel` em falha.

### 1.2 `obterValido(digest, agora)`

- Saída: `{ usuarioId }` quando a linha existe e `expira_em > agora`.
- `nao_encontrado` quando a linha não existe.
- `expirado` quando a linha existe e `expira_em <= agora`; para autorização, expirado conta como não encontrado, mas o código permite a resposta `401 acesso_expirado`.
- `indisponivel` em falha do armazenamento (FR-301).

### 1.3 `renovar(digest, novoExpiraEm)`

- Atualiza `expira_em` e `ultima_acao_em`.
- Saída: void; `nao_encontrado`; `indisponivel`.

### 1.4 `encerrar(digest)`

- Remove a linha. Saída: void; `indisponivel`.

### 1.5 `encerrarTodosDoUsuario(usuarioId)`

- Remove todas as linhas do Usuário. Saída: void; `indisponivel` (FR-296).

### 1.6 `removerExpirados(agora)`

- Remove linhas com `expira_em < agora`. Saída: número de removidas; `indisponivel`.

A bateria compartilhada cobre as operações nos dois Adapters, inclusive cascade ao excluir Usuário e ausência do valor em claro (D1, D8; FR-297, FR-301; SC-115, SC-116, SC-122).

## 2. HTTP

Todas as rotas entram em `registrarRotasDaAplicacao` e na lista de pré-voo de `criarServidor`. O Acesso nunca aparece em URL, corpo de resposta ou log (FR-297, FR-305).

### 2.1 `POST /entrar`

- Requisição: `{ nomeDeUsuario, senha, continuarConectado?: boolean }`, padrão `true`.
- Sucesso: `200 { nomeDeUsuario }`; se `continuarConectado` for `true`, revoga o Acesso indicado pelo cookie presente, se houver, antes de criar um novo e definir o cookie `HttpOnly`, `Secure` na nuvem, `SameSite=Strict`, `Path=/`, `Max-Age` longo. Nunca devolve o Acesso no corpo (FR-289, FR-292, FR-297).
- Se `continuarConectado` for `false`, revoga o Acesso indicado pelo cookie presente, se houver, limpa esse cookie e não emite outro. A Credencial em memória continua como Basic apenas até a página ser recarregada ou fechada (FR-090, FR-292).
- A conferência de resultado incerto da 017 (D4) também usa `POST /entrar`. Ela MUST enviar `continuarConectado` igual ao estado atual da página: `true` se a página opera por Acesso, `false` se opera por Credencial em memória. Assim, a conferência nunca cria um Acesso que a pessoa não pediu.
- `401` para Credencial recusada; `503` para armazenamento indisponível.

### 2.2 `GET /acesso`

- Sem corpo; lê o cookie.
- `200 { nomeDeUsuario }` quando válido (FR-290).
- `401 { erro: 'acesso_expirado' }` quando a linha existe e expirou (FR-294).
- `401 { erro: 'sem_acesso' }` quando não há linha ou cookie.
- Nos dois `401`, limpa o cookie com `Set-Cookie`; em `503`, nunca o limpa (FR-091, FR-301).
- `503` quando o armazenamento falha; o cookie NÃO é limpo (FR-301).

### 2.3 `POST /acesso/renovar`

- `204` quando renova; `401 { erro: 'acesso_expirado' }` quando expirado; `401 { erro: 'sem_acesso' }` quando ausente ou encerrado; `503` quando indisponível. Nos dois `401`, limpa o cookie com `Set-Cookie`; em `503`, nunca o limpa. Usado pela Aplicação conforme a decisão de `atividade.ts` (FR-291, FR-294, FR-301).

### 2.4 `POST /sair`

- `204`; remove a linha do Acesso e limpa o cookie (FR-293, FR-295).
- `503` quando o armazenamento falha, sem apresentar sucesso.

## 3. Hook de Credencial (`backend/src/http/credencial.ts`)

O hook aceita EITHER um Acesso temporário válido no cookie OR uma Credencial Basic válida (FR-090 revisado).

- Acesso válido: renova `expira_em` e prossegue, decorando `usuarioQueEntrou`.
- Acesso expirado: `401 { erro: 'acesso_expirado' }` e limpeza do cookie com `Set-Cookie` (FR-091, FR-294).
- Acesso inexistente: segue para Basic; se Basic também faltar, `401 credencial_invalida`.
- Falha de armazenamento ao verificar Acesso: `503`, sem limpar o cookie (FR-301).
- Basic válido: prossegue como hoje; usado quando «Continuar conectado neste navegador» foi desmarcada.

## 4. CORS

Em produção, SPA e `/api` são same-origin; não há CORS. No local cross-port, a política deixa de ser `*` e usa a origem do frontend, lida da variável `ORIGEM_DO_FRONTEND` (padrão `http://127.0.0.1:5173`; o e2e passa a origem do Vite do teste), com `Access-Control-Allow-Credentials: true`; `*` com credenciais é inválido e é rejeitado. As rotas novas entram na lista de pré-voo e no `onSend`. `backend/tests/http/cors.test.ts` percorre as rotas registradas e falha se alguma estiver sem pré-voo; `backend/tests/funcao/funcao.test.ts` verifica paridade entre local e nuvem (D4, D8; FR-090, FR-301).

## 4.1 Function URL (nuvem)

No evento da Function URL, os cookies chegam no campo `cookies`, e o `Set-Cookie` sai no campo `cookies` da resposta. A `@fastify/aws-lambda` faz a tradução, e `RespostaDaFuncao` declara `cookies?: string[]`. A paridade (`backend/tests/funcao/funcao.test.ts`) prova o percurso do cookie pela nuvem.

## 5. Integração com a 017

O contrato §3 da 017 permanece. Trocar Senha e alterar Nome de usuário chamam `encerrarTodosDoUsuario` e emitem um NOVO Acesso para a requisição atual via `Set-Cookie` quando ela foi autenticada por Acesso (FR-296). Excluir Usuário remove os Acessos por cascade e limpa o cookie. Dois Navegadores: o outro é recusado na próxima operação; o navegador da alteração continua com novo Acesso (SC-120).

## 6. Frontend

- `ClienteDoAcervo` usa `fetch` com `credentials: 'include'` (D2).
- `Aplicacao.tsx` chama `GET /acesso` na carga: válido → Início; `acesso_expirado` → Entrar com «Seu acesso expirou. Entre novamente.»; `sem_acesso` → Entrar (FR-290, FR-294; SC-118, SC-123).
- `PaginaDeEntrada.tsx` exibe «Continuar conectado neste navegador», marcada por padrão, acessível por teclado (FR-292, FR-302, FR-303).
- `POST /sair` encerra o Acesso e leva a Entrar (FR-293, FR-295).
- Qualquer `401 acesso_expirado` durante o uso leva a Entrar com a mensagem, sem sucesso; Sessão de estudo em andamento é descartada conforme FR-151/FR-157 (FR-091 revisado, FR-294).
- `frontend/src/acesso/atividade.ts` é Module puro: recebe o instante de teclado, clique ou toque e decide se a renovação é devida. `Aplicacao.tsx` observa esses eventos e, quando a decisão mandar, chama `POST /acesso/renovar`, no máximo uma vez a cada 60 s (D3; FR-291; SC-124).

## 7. Rastreabilidade

- Porta: FR-289, FR-297, FR-301; SC-115, SC-116, SC-122.
- HTTP: FR-289..FR-301, FR-305, FR-306; SC-114..SC-124.
- Hook: FR-079, FR-089, FR-090, FR-091, FR-294, FR-301; SC-115, SC-119, SC-122.
- CORS: FR-090, FR-301; D2, D4.
- 017: FR-296; SC-120.
- Frontend: FR-290, FR-291, FR-292, FR-293, FR-294, FR-295, FR-302, FR-303, FR-304; SC-114, SC-118, SC-119, SC-121, SC-123, SC-124.
