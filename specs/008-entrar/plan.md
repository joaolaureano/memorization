# Implementation Plan: Entrar

**Branch**: `008-entrar` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Depende de**: `007-criar-usuario`, de quem reusa o Module `Identidade`, o
segredo do servidor e a migração 4, e de `001` a `006`, cujo acervo passa a ser
**por usuário**. Reusa a fundação de projeto de
[`001`](../001-criar-cartao/plan.md) (TypeScript estrito sobre Node 24+, Fastify,
`node:sqlite`, Zod nas bordas, Vitest, Testing Library, Playwright), a Seam
`ClienteDoAcervo` e a lista ordenada de migrações de `002`. Nenhuma dessas
decisões é reaberta. A premissa "usuário único" de `001` a `006` **deixa de
valer**.

## Summary

Oitava feature, e a que transforma o acervo em acervo **de alguém**: a pessoa vê
a tela "Entrar", informa Nome de usuário e Senha e passa a operar só os seus
Cartões, Baralhos e Vínculos; Sair a devolve à tela "Entrar". O escopo é estreito
— **Entrar, Sair e o acervo por usuário** — e recuperação de Senha, bloqueio por
tentativas, "Lembrar de mim" e exclusão de Usuário seguem adiados na spec.

O que a feature traz de estruturalmente novo: `autenticar` no Module `Identidade`
da `007`, com a mesma Interface pequena escondendo Implementation relevante
(Depth); um ponto único de verificação da Credencial no servidor — o hook
`onRequest` — de onde o dono do acervo sai para a rota (FR-090); o transporte da
Credencial por `Authorization: Basic`, sem sessão, cookie ou token (FR-079); o
acervo com dono, na migração 5, que **recria** `cartao`, `baralho` e `vinculo`
com `usuario_id` (FR-099, SC-037); o modo de erro `nao_autenticado` na Seam do
cliente, que descarta a Credencial e volta a "Entrar" (FR-091, SC-035); e a tela
`PaginaDeEntrada`, em `#/entrar`, com a guarda de rota que a torna a única tela
alcançável enquanto não houver Credencial (FR-097, SC-027).

## Technical Context

Stack, runtime, driver, build e testes vêm de `001` e da `007` e **não são
reabertos**: ver [`../001`](../001-criar-cartao/research.md) e
[`../007`](../007-criar-usuario/research.md). **Novo nesta feature**: transporte
por `Authorization: Basic` e hook `onRequest`; `autenticar` no `Identidade`, com
derivação uniforme para Nome de usuário inexistente (FR-088);
`criarAcervo(banco, usuarioId)` com escopo por `usuario_id` em toda consulta;
migração 5; `nao_autenticado` nos dois Adapters; a guarda de rota e a tela
`PaginaDeEntrada`. **Custo aceito**: uma derivação scrypt por requisição (50 a
150 ms), registrada na tabela de riscos. **Nenhuma dependência nova.**

**Scale/Scope**: 20 requisitos funcionais (FR-042, FR-044, FR-045, FR-046, FR-078
e FR-079 reutilizados; FR-086 a FR-099 específicos), 11 critérios de sucesso
(SC-027 a SC-037), 3 histórias, 1 tela e 1 rota novas.

## Constitution Check

*GATE: antes da Phase 0 e revisto após a Phase 1.*

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Deriva apenas de `spec.md` desta feature |
| II — Auditabilidade | **PASS**. Registrado em `SESSION.md` com banner SPEC KIT. Nenhum valor sensível é escrito |
| III — Domínio antes de tecnologia | **PASS**. Identificadores usam `Usuário`, `Nome de usuário`, `Senha`, `Credencial`, `Entrar` e `Sair` (FR-046). `login`, `logout`, `session`, `token` e `cookie` **não** nomeiam módulo, tipo, função, coluna ou rota |
| IV — Módulos profundos | **PASS**. Nenhum Module novo: `autenticar` entra no `Identidade`, cuja Locality a `007` já justificou. A Seam `ClienteDoAcervo` ganha um verbo e um modo de erro, sem Adapter novo; o hook `onRequest` é Implementation do servidor, não Seam |
| V — Interface é a superfície de teste | **PASS**. `autenticar` é testado pela Interface, com SQLite em memória; a uniformidade da recusa (FR-088) é observável pela Interface, sem inspeção de estado interno |
| VI — Verificação sobre afirmação | **PASS**. Todo diff de worker é inspecionado; a ausência da Credencial no navegador (SC-033) é comprovada por teste, não afirmada |
| VII — Escopo mínimo | **PASS**. Complexity Tracking vazio. Nenhuma dependência nova, nenhum bloqueio por tentativas, nenhum cache de Credencial verificada |
| VIII — Segredos fora do repositório | **PASS**. A Senha viaja em cabeçalho, nunca em URL, e não é registrada: o logger do Fastify continua desabilitado (FR-078). Testes usam segredo e Senhas **gerados** a cada execução, nunca literais que pareçam reais |
| IX — Rastreabilidade | **PASS condicionado**. A matriz requisito–teste é produzida em `tasks.md` |
| X — Portões de qualidade | **PASS até aqui**. `analyze` é executado ao final desta etapa |
| XI — Delegação de código | **PASS**. Todo código em `backend/`, `frontend/` e `e2e/` será escrito por workers DeepSeek |

**Processos removidos**: ADRs e Design It Twice não se aplicam, pela constituição
2.1.0. **Nenhuma emenda é necessária**: o Princípio VIII é a regra que governa
esta feature, e a Credencial é tratada como qualquer outro valor sensível.

### Re-avaliação após Phase 1

**PASS, sem alteração.** Nenhuma coluna, tabela ou estado capaz de guardar ou
reutilizar a Credencial (FR-079, SC-033); a recusa é indistinguível entre os dois
casos por construção, e não por disciplina de mensagem (FR-088, SC-029); outro
Usuário é indistinguível de inexistente porque o escopo está na consulta e o
código de recusa é o `nao_encontrado` que já existia (FR-092, SC-030).

## Decisões de Codebase Design

### Module reusado — `Identidade` ganha `autenticar`

Continua em `backend/src/identidade/`, sem Module novo e sem juntá-lo ao `Acervo`:
identidade e acervo são conceitos distintos, e o que os liga é apenas o
`usuarioId` decorado na requisição.

```
Identidade.autenticar({ nomeDeUsuario, senha })
  -> { ok: true,  usuario: { id, nomeDeUsuario } }
  |  { ok: false, erro: "credencial_invalida",
                  mensagem: "Nome de usuário ou Senha incorretos." }
```

**Invariantes garantidas pela Interface**: espaços ao redor do Nome de usuário são
descartados e a comparação ignora maiúsculas e minúsculas, com as mesmas regras do
Cadastro, enquanto a Senha é comparada exatamente, preservando espaços (FR-087,
SC-036); a Senha é verificada **reconstruindo** a derivação com o `sal` e os
`parametros` gravados e comparando com `timingSafeEqual`, sem gravar nada
(FR-089); Nome de usuário inexistente executa a **mesma** derivação, contra um
`sal` e um `hash` descartáveis gerados uma única vez na criação do Module, de modo
que o tempo de recusa não revele existência (FR-088, SC-029); a recusa é uma só,
com uma só mensagem, nos dois casos, e **a Senha nunca aparece em nenhum retorno**
(FR-088, FR-078).

### Seams — nenhuma nova

A persistência continua Seam interna, com a postura da `007`. A Seam
`ClienteDoAcervo` **não é duplicada**: ganha `entrar` e o modo de erro
`nao_autenticado` nos **dois** Adapters existentes, `ClienteHttp` e
`ClienteEmMemoria` — uma terceira indireção seria Seam hipotética (Princípio IV).
O hook `onRequest` **não é Seam**: é Implementation do servidor, com um único
Adapter, o transporte HTTP, e é o ponto único onde a Credencial é verificada, o
que dá Leverage a todas as rotas — nenhuma delas reproduz a verificação. As
migrações continuam numa lista única e ordenada, em
`backend/src/acervo/migracoes.ts`.

### Acervo por usuário — escopo na Interface do `Acervo`

`criarAcervo(banco, usuarioId)` recebe o dono na criação e **as operações da
Interface não mudam**: muda a Implementation, em que toda consulta é restrita a
`usuario_id`. A rota constrói o `Acervo` **por requisição**, a partir do
`usuarioId` decorado pelo hook — a Credencial nunca entra no Module. Cartão ou
Baralho de outro Usuário é indistinguível de inexistente: a recusa é o
`nao_encontrado` que já existia, nunca um código novo e nunca 403 (FR-092,
SC-030). Vincular exige Cartão e Baralho **no mesmo escopo**; fora dele, 404
(FR-093). E a Sessão de estudo carrega somente Cartões dos Baralhos do Usuário que
entrou (FR-092, SC-028).

### Avaliação do Module e da mudança

- **Interface menor que o que esconde?** Sim: um verbo esconde a reconstrução da
  derivação, a comparação em tempo constante e a derivação descartável de FR-088;
  o `Acervo` esconde o escopo por dono sem que nenhum caller reproduza um
  `WHERE usuario_id`.
- **Leverage e Locality?** Sim: `POST /entrar` e o hook ficam finos, a recusa
  uniforme vive num só lugar e o escopo, num só construtor.
- **Teste de exclusão**: sem o `usuarioId` na criação do `Acervo`, o dono teria de
  ser passado em cada operação, e cada rota poderia esquecer um `WHERE` — o
  vazamento entre Usuários dependeria de disciplina.
- **Os testes usam a Interface?** Sim, com SQLite em memória, segredo e Senhas
  gerados. **Seam especulativa:** nenhuma foi criada.

## Acessibilidade e Responsividade

Atende FR-042, FR-095, FR-096 e SC-032, segundo a seção *Critérios de Qualidade*
da constituição. Nome de usuário, Senha e as ações Entrar, Criar conta e Sair são
alcançáveis por teclado, com indicador de foco que não depende de cor (FR-095,
SC-032). Numa recusa, o foco vai para o campo a corrigir e o digitado permanece; a
Senha é apagada depois de cada tentativa, o Nome de usuário não (FR-095). A recusa
e a conclusão de Sair são anunciadas por região ativa, e não apenas visualmente
(FR-096). O campo Senha usa `type="password"` e
`autocomplete="current-password"`, o que também impede o navegador de oferecê-la
como valor de formulário de Cadastro. O layout é de coluna única, sem rolagem
horizontal em largura de telefone (FR-042), e Sair aparece em toda tela alcançável
depois de Entrar (FR-094).

## Validação, Erros e Segurança

- **Credencial**: `Authorization: Basic base64(nomeDeUsuario:senha)` em **toda**
  requisição, exceto `POST /usuarios` (Cadastro), `GET /health` e o pré-voo
  `OPTIONS`. O hook `onRequest` decodifica, chama `Identidade.autenticar` e, no
  sucesso, decora a requisição com o `usuarioId`; sem cabeçalho, malformado ou
  inválido, a rota **não roda** e a resposta é
  `401 { erro: "credencial_invalida", mensagem }` (FR-090, SC-028).
- **O 401 não traz `WWW-Authenticate`**: esse cabeçalho dispararia o diálogo
  nativo do navegador e permitiria a ele guardar a Credencial, violando FR-089 e
  FR-078.
- **Nenhum estado no servidor**: sem cookie, sem token, sem cache de Credencial
  verificada — um cache seria uma sessão de fato (FR-079, SC-033) —, e o logger do
  Fastify continua desabilitado, então nem a Senha nem o cabeçalho de autorização
  chegam a um log (FR-078, SC-033, Princípio VIII).
- **Borda e CORS**: o CORS ganha `authorization` em
  `access-control-allow-headers`, e a forma do corpo de `POST /usuarios` continua
  validada com Zod, com a autoridade das regras de Nome de usuário e Senha no
  `Identidade` (FR-046).
- **Interface**: a Credencial vive apenas no estado React de `Aplicacao`; nunca em
  `localStorage`, `sessionStorage`, cookie ou URL. Recarregar ou fechar exige
  Entrar de novo, e cada aba tem a sua Credencial (FR-089, SC-031). Sem
  Credencial, toda rota resolve em Entrar, exceto `#/criar-conta`; com Credencial,
  `#/entrar` resolve em Cartões; a navegação principal e "Sair" só aparecem com
  Credencial (FR-097, FR-098, FR-094), o link "Criar conta" passa da navegação
  para a tela Entrar, e o Cadastro ganha a volta a Entrar e, após o sucesso, a
  oferta de Entrar (FR-097).

## Estratégia de Testes

A Interface é a superfície de teste.

- **`Identidade.autenticar`**: SQLite em memória, segredo e Senhas gerados a cada
  execução. Cobre o acerto, a comparação sem distinção de maiúsculas e sem espaços
  ao redor do Nome de usuário (SC-036), a Senha exata com espaços e as duas
  recusas — Nome de usuário inexistente e Senha errada — com mensagem idêntica
  (FR-088, SC-029). Um teste mede as duas recusas repetidas vezes e exige ordens
  de grandeza comparáveis, sem afirmar igualdade de relógio.
- **Escopo por dono**: dois Usuários com acervo próprio; cada um lista só o seu
  (FR-092, SC-030), o id do outro responde `nao_encontrado` e o acervo do outro
  permanece inalterado.
- **Contrato HTTP**: cada rota de acervo sem cabeçalho e com Credencial inválida
  responde 401 e o acervo não muda (FR-090, SC-028); `POST /entrar` responde 200
  com `{ id, nomeDeUsuario }` ou o mesmo 401; nenhuma resposta traz
  `WWW-Authenticate`, `Set-Cookie` ou valor reutilizável (FR-079).
- **Migração 5**: base na versão 4, com Usuários e acervo legado, migra para 5 com
  os Usuários intactos e **zero** Cartões, Baralhos e Vínculos (FR-099, SC-037).
- **Frontend**: bateria compartilhada contra os dois Adapters da Seam, incluindo
  `nao_autenticado` (FR-091, SC-035); testes de teclado, de leitor de tela e da
  guarda de rota (FR-097, SC-027).
- **E2E**: contra servidores reais. `e2e/servidores-locais.ts` passa um
  `SEGREDO_DAS_SENHAS` gerado ao processo da API e ganha auxiliares de Cadastro e
  de credencial Basic; **toda** prova de `001` a `007` passa a Entrar antes.
  Provas novas: isolamento entre dois Usuários, recarga exigindo Entrar (SC-031),
  Sair seguido do voltar do navegador (SC-034) e ausência da Credencial em
  armazenamento, cookie e URL (SC-033).

Comandos: `npm test`, `npm run build` e `npm run lint` em `backend/` e
`frontend/`; `npm run test:e2e` na raiz.

## Project Structure

Nenhum diretório novo no backend; o resto cresce dentro do que existe:

```text
backend/src/identidade/       # + autenticar na Interface existente
backend/src/acervo/           # + migração 5 (recria cartao, baralho e vinculo),
                              #   + usuarioId em criarAcervo, + escopo em toda consulta
backend/src/http/             # + hook onRequest, + rota POST /entrar, + CORS com
                              #   authorization, + Acervo por requisição nas rotas
frontend/src/acervo-cliente/  # + entrar na Seam, + nao_autenticado, + Credencial na
                              #   construção do ClienteHttp, + Usuários no ClienteEmMemoria
frontend/src/ui/              # + PaginaDeEntrada, + rota #/entrar, + guarda de rota,
                              #   + "Sair" na navegação principal
e2e/                          # + auxiliares de Cadastro e credencial Basic,
                              #   + provas de isolamento, recarga e Sair
```

## Riscos, Alternativas e Custo de Reversão

| Decisão | Risco | Alternativa rejeitada | Custo de reversão |
|---|---|---|---|
| Basic com scrypt a cada requisição | 50 a 150 ms por operação | Cache de Credencial verificada, que seria uma sessão de fato (FR-079) | Baixo: o cabeçalho fica num único ponto do cliente |
| 401 sem `WWW-Authenticate` | Cliente HTTP genérico não sabe pedir Credencial | Publicá-lo, o que dispara o diálogo nativo e permite ao navegador guardar a Senha | Baixo: um cabeçalho a mais na recusa |
| Recriar as três tabelas na migração 5 | Perda do acervo sem dono, assumida pelo PO | `ALTER TABLE ADD COLUMN`, que o SQLite recusa com `NOT NULL` e chave estrangeira | Baixo: os dados descartados já não têm dono (FR-099) |
| Escopo por `usuario_id` no construtor do `Acervo` | Um `WHERE` esquecido vazaria conteúdo entre Usuários | Passar o dono em cada operação | Médio: a Interface não muda, mas a Implementation inteira é revisitada |
| Credencial só no estado React | Recarregar exige Entrar de novo, por desenho | `sessionStorage`, para sobreviver à recarga | Baixo: nenhum dado é migrado |
| Sem bloqueio por tentativas | Ataque local ilimitado | Bloqueio temporário, adiado na spec | Baixo: nenhum estado novo a remover |

## Complexity Tracking

> Nenhuma violação da constituição a justificar.

**Nenhum** Module novo, **nenhuma** Seam nova e **nenhuma** dependência nova. A
migração 5 é exigida por bases já instaladas, e recriar as tabelas é a única forma
de acrescentar `usuario_id` como `NOT NULL` no SQLite. Nenhum dos dois é
antecipação.
