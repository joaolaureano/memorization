# Pesquisa e decisões: Gerenciar conta do Usuário

## Contexto

A 017 é o CRUD da própria conta do Usuário. Ela depende de 007 (Usuário, Nome de usuário, Senha), 008 (Credencial, acervo por Usuário, recusa por Credencial), 013 (Registro de sessão), 015 (Preferências e Agendamento do cartão) e 016 (Agenda de estudo, quando existir). O escopo é a conta: consultar, alterar Nome de usuário, trocar Senha e excluir definitivamente. FR-257..FR-288; SC-105..SC-113.

## Decisões arquiteturais fixadas (D1–D7)

### D1. Identidade é dona da gestão da conta
`backend/src/identidade/identidade.ts` ganha `obterConta(usuarioId)`, `alterarNomeDeUsuario(usuarioId, { senhaAtual, novoNomeDeUsuario })`, `trocarSenha(usuarioId, { senhaAtual, novaSenha, confirmacaoDaSenha })` e `excluirConta(usuarioId, { senhaAtual })`. Reutiliza a normalização/validação de Cadastro (007) e a comparação de Senha em tempo constante de Entrar (008). Senha atual incorreta → um único código `senha_atual_incorreta` e uma única mensagem para as três ações (FR-279). Nome igual ao atual → `mesmo_nome`; Senha igual à atual → `mesma_senha`; nome ocupado → `nome_indisponivel`, o código existente de 007; validação → códigos existentes `dados_invalidos`.

### D2. Porta ArmazenamentoDeUsuarios
A Porta ganha `atualizarNomeDeUsuario(id, nome)` (violação de unicidade COLLATE NOCASE → `nome_em_uso` tipado), `atualizarSenha(id, { sal, hash, parametros })`, `excluirUsuario(id)` (um único comando em transação; todas as tabelas do dono já têm `REFERENCES usuario(id) ON DELETE CASCADE`: cartao, baralho, registro_de_sessao, agendamento, preferencias; vinculo e item_de_registro caem em cascata por cartao/baralho/registro) e `contarDadosDoUsuario(id)` → `{ cartoes, baralhos, registrosDeSessao, agenda: number | null }` (agenda é `null` enquanto as tabelas da 016 não existirem). Os dois Adapters (SQLite e PostgreSQL) implementam. A bateria compartilhada cobre cascade com dois Usuários. Nenhuma migração nova é criada pela 017; a migração da 016 MUST declarar suas tabelas com `ON DELETE CASCADE` para `usuario` (restrição entre features, ver data-model da 016).

### D3. HTTP sob a Credencial existente
Rotas registradas dentro de `registrarRotasDaAplicacao` e também na lista de pré-voo de CORS de `criarServidor` (lição do bug 9251ae0 da 013 e do bug de CORS da 015), com teste de paridade em `backend/tests/funcao/funcao.test.ts` e teste-guarda em `backend/tests/http/cors.test.ts`. Contrato:
`GET /conta` → 200 `{ nomeDeUsuario, contagens: { cartoes, baralhos, registrosDeSessao, agenda | null } }`;
`PUT /conta/nome-de-usuario` `{ senhaAtual, novoNomeDeUsuario }` → 200 `{ nomeDeUsuario }` | 400 `dados_invalidos`/`mesmo_nome` | 403 `senha_atual_incorreta` | 409 `nome_indisponivel` | 503;
`PUT /conta/senha` `{ senhaAtual, novaSenha, confirmacaoDaSenha }` → 204 | 400 | 403 | 503;
`DELETE /conta` `{ senhaAtual }` → 204 | 403 | 503.
`401` permanece reservado à Credencial recusada (FR-090/FR-091). Senha nunca em resposta ou log (FR-078).

### D4. Resultado incerto
O frontend nunca infere sucesso de resposta perdida. Após falha de rede, verifica com `POST /entrar` (existente): renomear/trocar Senha → tenta a Credencial NOVA, depois a ANTIGA; nova aceita → sucesso (substitui Credencial em memória); antiga aceita → nada mudou. Exclusão → Credencial ANTIGA recusada significa excluído. Se a verificação também falhar → «resultado desconhecido» com Tentar novamente / Ir para Entrar. As operações são naturalmente idempotentes para essa checagem: renomear de novo com a Credencial antiga é recusado por 401 e nunca aplica duas vezes; DELETE afeta só o Usuário autenticado. FR-280..FR-283.

**Nota de compatibilidade com a 018**: quando a 018 existir, a conferência por `POST /entrar` MUST enviar `continuarConectado` igual ao estado atual da página, para não criar um Acesso temporário que a pessoa não pediu (018, contrato §2.1).

### D5. Frontend
`ClienteDoAcervo` (`frontend/src/acervo-cliente/cliente.ts`, `cliente-http.ts`, `cliente-em-memoria.ts`, `frontend/src/ui/guarda-de-credencial.ts`) ganha `obterConta`, `alterarNomeDeUsuario`, `trocarSenha`, `excluirConta`, mais o Module puro `frontend/src/conta/resultado-incerto.ts` (decisão de D4, testável sem rede). UI: novo componente `frontend/src/ui/SecaoMinhaConta.tsx` renderizado dentro de `PaginaDePreferencias.tsx` (FR-257: seção «Minha conta» em Preferências, sem destino novo) com três formulários/diálogos, reutilizando `CampoDeSenha`, `DialogoDeConfirmacao` e `protecao-de-saida`. `Aplicacao.tsx` recebe callback para substituir a Credencial em memória (FR-263, FR-270) e para descartá-la e ir a Entrar com «Conta excluída» (FR-276).

### D6. Testes
Unitários: `Identidade`, bateria da Porta nos dois Adapters, contrato HTTP, paridade, guarda de CORS, Module `resultado-incerto`, telas de `SecaoMinhaConta`. E2E: `e2e/minha-conta.spec.ts` — renomear, trocar Senha com segunda janela recusada, excluir com dois Usuários provando isolamento e reuso de nome, percurso por teclado. SC-105..SC-113; SC-108 medido por teste de backend semeando 2.000 Cartões + 500 Registros.

### D7. Execução em ondas
As ondas da seção «Ondas de execução (prévia)» do plano mantêm arquivos disjuntos, workers DeepSeek delegados e revisão do Arquiteto (Princípio XI).

## Decisões de pesquisa (R1–R5)

### R1. Re-confirmar com a Senha atual mesmo com a Credencial já carregada
A Credencial já contém a Senha, mas a 017 exige a Senha atual em cada ação sensível (FR-259, FR-266, FR-273). A escolha protege uma página aberta e deixada sem supervisão: quem chega depois não renomeia, troca a Senha nem exclui a conta apenas por encontrar a aba aberta. A verificação é feita no `Identidade`, contra o hash gravado, e não apenas no frontend.

### R2. Sem sessão, cookie ou token (FR-079)
Como não há sessão, a troca de Nome de usuário ou Senha só pode ser refletida na própria página substituindo em memória a Credencial (FR-089, FR-263, FR-270). Outras páginas mantêm a Credencial antiga e são recusadas na próxima operação (FR-264, FR-270, FR-278). A exclusão descarta a Credencial e leva a Entrar (FR-276).

### R3. Hard-delete pelas cascatas existentes
A exclusão não faz deletes por tabela no Module. Ela chama `excluirUsuario(id)`, que executa uma única instrução em transação e deixa as FKs `ON DELETE CASCADE` removerem cartao, baralho, registro_de_sessao, agendamento, preferencias e, por tabelas dependentes, vinculo e item_de_registro. A 016 precisa seguir a mesma regra nas tabelas da Agenda. Isso evita lista de tabelas duplicada e reduz risco de esquecer uma tabela nova (FR-274, FR-275, SC-105, SC-108).

### R4. Contagens vêm do servidor
As contagens exibidas no diálogo de exclusão vêm de `GET /conta`, que as obtém de `contarDadosDoUsuario(id)` (FR-272, SC-113). O cliente não conta itens nem estima: uma contagem feita no navegador poderia divergir do que a exclusão remove, especialmente com Baralhos, Vínculos e dados da Agenda no servidor.

### R5. Por que 403 e não 401 para senhaAtual incorreta
`401` é reservado à Credencial apresentada e recusada; a interface, ao recebê-lo, segue FR-091 e descarta a Credencial, deslogando a pessoa. Uma Senha atual errada em `PUT /conta/...` ou `DELETE /conta` não invalida a Credencial que autentica a requisição: a pessoa continua Entrada, e a ação é recusada. Por isso a resposta é `403 senha_atual_incorreta`, e o frontend mantém a Credencial e o conteúdo digitado, exceto os campos de Senha (FR-279).

## Alternativas rejeitadas

- **Exclusão lógica ou período de carência**: a spec pede hard-delete, sem restauração (FR-274, FR-276; Funcionalidades Adiadas).
- **Token de operação ou idempotency key para exclusão**: FR-079 proíbe sessão, cookie ou token; a checagem por `POST /entrar` resolve D4 sem novo estado no servidor.
- **Contagem no cliente**: rejeitada por R4, porque não é a fonte autoritativa e pode divergir do removido (SC-113).
- **401 para Senha atual errada**: rejeitada por R5, porque dispararia o fluxo de descarte de Credencial de FR-091 e faria a pessoa sair quando apenas digitou a Senha errada.
- **Deletes explícitos por tabela no `excluirConta`**: rejeitado por R3, porque duplicaria a lista de tabelas e quebraria silenciosamente quando a 016 ou outra feature adicionasse dados do Usuário.

## Rastreabilidade de pesquisa
- D1/R1/R5 → FR-259, FR-266, FR-273, FR-279, SC-107.
- D2/R3/R4 → FR-272, FR-274, FR-275, FR-277, SC-105, SC-108, SC-111, SC-113; restrição da 016.
- D3 → FR-078, FR-090, FR-091, FR-257..FR-288.
- D4/R2 → FR-263, FR-264, FR-270, FR-276, FR-278, FR-280..FR-284, SC-106, SC-110.
- D5 → FR-257, FR-258, FR-263, FR-270, FR-276, FR-285, FR-286, SC-109.
- D6/D7 → FR-257..FR-288, SC-105..SC-113, Princípios VI e XI.

## Skills aplicadas (constituição 3.0.0, Skills Obrigatórias)

- **domain-modeling** (`.agents/skills/domain-modeling/`), aplicada no specify e no clarify porque a feature mexe na linguagem de domínio do Usuário. Ela barrou "Conta" como entidade, porque "conta" é sinônimo evitado de Usuário em `CONTEXT.md`. "Minha conta" e "Excluir conta" ficaram como rótulos de interface, como "Criar conta" na `007`, e o `CONTEXT.md` registra esses rótulos na definição de Usuário. Influenciou a spec (Key Entities, Clarifications) e o glossário.
- **codebase-design** (`.agents/skills/codebase-design/`), aplicada no plan porque define Interfaces e Seams. Ela manteve a profundidade nos Modules já existentes (`Identidade` e Porta `ArmazenamentoDeUsuarios`, que tem dois Adapters reais) em vez de criar uma Seam nova com um só Adapter. Isolou a decisão de resultado incerto num Module puro (`resultado-incerto.ts`), testável sem rede. Dividiu a seção "Minha conta" em quatro componentes com props fixas (contrato §6), para permitir execução paralela em arquivos disjuntos. Influenciou D1, D2, D4, D5 e o contrato §6.

## Análise de consistência — 2026-10-03

Revisão documental do ciclo `specify → clarify → plan → checklist → tasks →
analyze`, contra `CONTEXT.md` e a constituição 3.0.0. Foram inspecionados
`spec.md`, checklist, `plan.md`, este registro, `data-model.md`, contrato,
`quickstart.md` e `tasks.md`.

### Correções aplicadas nesta análise

- **FR-279 e código HTTP**: a formulação anterior dizia que a mensagem de
  re-confirmação não revelava a causa, enquanto o contrato publica o código
  literal `senha_atual_incorreta`. O requisito agora exige o comportamento
  verificável compatível com o contrato: uma única mensagem entre as três ações,
  sem expor Senha, derivado ou informação sobre outro Usuário. `403` continua
  distinto de `401`, preservando a Credencial válida da página (D3, R5).
- **SC-113 e `agenda`**: o campo numérico não definia quais dados da Agenda
  compunham sua contagem. O modelo, contrato e tarefas agora fixam a soma dos
  registros persistidos de Rotinas de estudo, Compromissos de estudo e Inícios
  de Compromisso do Usuário; versões guardadas dentro de Rotinas não contam
  separadamente. `null` continua representando a ausência da 016.

### Resultado do portão

- O checklist de requisitos permanece com 20 de 20 itens aprovados.
- Todos os FR-257..FR-288 e SC-105..SC-113 têm pelo menos uma tarefa na matriz
  de rastreabilidade, e o `quickstart.md` cobre os cinco fluxos e os nove SC.
- As Interfaces planejadas respeitam a Porta com dois Adapters, módulos
  existentes e testes pela Interface; nenhuma Seam hipotética foi introduzida.
- A dependência da 016 para as cascatas está declarada dos dois lados, e a
  compatibilidade futura com a 018 para a conferência de resultado incerto está
  registrada em D4.

Não há inconsistência **CRITICAL** remanescente. A spec permanece em `Draft` e
aguarda aprovação explícita do Product Owner; até essa aprovação, a constituição
impede `implement`.
