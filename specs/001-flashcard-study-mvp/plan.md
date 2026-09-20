# Implementation Plan: MVP de Estudo por Flashcards

**Branch**: `001-flashcard-study-mvp` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-flashcard-study-mvp/spec.md`

## Summary

Aplicação local de flashcards com dois deployables em TypeScript: uma API que
guarda Cartões, Baralhos e Vínculos em SQLite, e uma interface que consome essa
API e executa a Sessão de estudo inteiramente no cliente.

A decisão estrutural que organiza todo o resto vem de FR-038 e FR-039: a Sessão
nunca é persistida. Isso divide o sistema em duas metades com naturezas opostas.
De um lado o **Acervo**, que é durável, autoritativo e vive no servidor. Do outro
a **Sessão de estudo**, que é efêmera, puramente computacional e vive no cliente
— o servidor sequer sabe que sessões existem. Nenhuma Seam de persistência
atravessa a Sessão, o que a torna o Module mais profundo e mais testável do
sistema.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 22 LTS, em toda a stack

**Primary Dependencies**: Fastify (servidor HTTP), better-sqlite3 (driver
SQLite síncrono), Zod (validação de entrada nas bordas), React 19 + Vite
(interface)

**Storage**: SQLite em arquivo local, sem Docker e sem servidor de banco

**Testing**: Vitest (unidade e integração, nas duas metades), Testing Library
(interação da interface), Playwright (os poucos cenários ponta a ponta que
exigem navegador real)

**Target Platform**: Máquina local do usuário; navegador moderno para a
interface

**Project Type**: Aplicação web com frontend e API separados, dois deployables
independentes

**Performance Goals**: Nenhuma meta numérica de throughput. O acervo previsto é
de ordem de 50 Cartões e 10 Baralhos (SC-011), volume em que qualquer consulta
direta é instantânea. Não há requisito que justifique índice, cache ou
paginação.

**Constraints**: Execução local, sem exposição em rede pública (Assumptions da
spec). Sem autenticação — condição segura apenas sob execução local. O desenho
não deve fechar portas para hospedagem remota futura, mas também não deve pagar
custo antecipado por ela (Princípio VII).

**Scale/Scope**: ~50 Cartões, ~10 Baralhos, um usuário, uma Sessão por vez.
Cinco telas: lista de Cartões, edição de Cartão, lista de Baralhos, edição de
Baralho, Sessão de estudo. A spec aprovada tem 53 requisitos funcionais e 16
critérios de sucesso.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Princípio I — Spec-Driven Development

**PASS**. Este plano deriva exclusivamente de `spec.md` (46 requisitos
funcionais, 12 critérios de sucesso) e das decisões registradas em `SESSION.md`.
Nenhum requisito novo foi introduzido aqui. Onde o plano precisou de uma decisão
não coberta pela spec, ela é técnica e está declarada em `research.md`.

### Princípio II — Auditabilidade Append-Only

**PASS**. A execução deste comando é registrada em `SESSION.md` com o banner
SPEC KIT obrigatório.

### Princípio III — Domínio Antes de Tecnologia

**PASS**. Todo identificador de domínio no código usa os termos canônicos de
`CONTEXT.md`: `Cartao`, `Frente`, `Verso`, `Baralho`, `Vinculo`,
`SessaoDeEstudo`, `ItemDeEstudo`, `Revelacao`, `ResultadoDoItem`,
`ResumoDaSessao`. Os sinônimos de `_Avoid_` — `deck`, `card`, `flashcard`,
`link`, `score`, `flip` — são proibidos em nomes de módulo, tipo, função,
tabela, coluna e rota. A verificação é um item de revisão de diff, não uma
convenção informal.

### Princípio IV — Módulos Profundos

**PASS, com duas Seams rejeitadas deliberadamente.** Ver a seção Decisões de
Codebase Design. Duas Seams são criadas por terem dois Adapters justificados;
duas candidatas são rejeitadas por terem apenas uma Implementation, o que o
princípio classifica como Seam hipotética e indireção.

### Princípio V — A Interface é a Superfície de Teste

**PASS**. Cada Module é testado através da sua própria Interface, asseverando
resultado observável. O Acervo é testado pela sua Interface com SQLite em
memória, nunca inspecionando tabelas. A Sessão de estudo é testada pela sua
Interface com o Adapter determinístico de aleatoriedade, nunca inspecionando seu
estado interno.

### Princípio VI — Verificação Sobre Afirmação

**PASS**. Cada tarefa derivada deste plano encerra com verificação executável, e
nenhum diff é aceito sem inspeção.

### Princípio VII — Escopo Mínimo Honesto

**PASS**. Ver Complexity Tracking: nenhuma violação a justificar. As omissões
deliberadas estão listadas em `research.md` — sem ORM, sem camada de repositório,
sem gerenciador de estado global, sem paginação, sem índices além das chaves,
sem migrações versionadas.

### Princípio VIII — Segredos Fora do Repositório

**PASS por vacuidade, verificada.** Não há autenticação, serviço externo nem
provedor de nuvem neste MVP, portanto não existe credencial a proteger. Não há
arquivo de segredo, e `.gitignore` já bloqueia `.env`, `*.pem`, `*.key` e
`credentials.json` caso isso mude. As duas variáveis de configuração — caminho
do arquivo SQLite e porta — não são sensíveis.

### Princípio IX — Rastreabilidade Requisito–Teste

**PASS condicionado.** Este plano estabelece que a Interface é a superfície de
teste e que cada invariante tem requisito identificado. A matriz explícita
requisito ↔ teste é produzida em `tasks`, e é lá que o princípio será
efetivamente verificável. Registrado como obrigação pendente daquela etapa, não
como item satisfeito aqui.

### Princípio X — Portões de Qualidade

**PASS até aqui.** O checklist de qualidade da spec está em 16 de 16, com o
histórico da reprovação registrada. `analyze` ainda não foi executado, e
`implement` permanece bloqueado até que o seja sem inconsistência CRITICAL.

### Princípio XI — Delegação Obrigatória de Código

**PASS.** Nenhuma linha de código de aplicação foi escrita neste plano. Todo
código sob `backend/`, `frontend/` e `e2e/` será criado por subagentes DeepSeek,
com o Arquiteto especificando, delegando, revisando o diff e verificando. Este
plano é artefato do Spec Kit e, pela fronteira do próprio Princípio XI, é do
Arquiteto.

### Processos removidos do projeto

A constituição 2.0.0 declara **ADRs** e **Design It Twice** inaplicáveis a este
projeto. Nenhuma ADR foi criada, e a Interface do Module `SessaoDeEstudo` foi
desenhada no fluxo normal, sob os Princípios IV e V, sem propostas alternativas
comparadas. O Prompt 4 do Product Owner solicitava ambos os processos; o
conflito foi levantado e resolvido pelo Product Owner a favor da constituição.

### Re-avaliação após Phase 1

**PASS, sem alteração.** O design de Phase 1 confirmou as decisões acima em vez
de forçar exceções:

- O esquema de `data-model.md` prova que a semântica não-cascateante não depende
  de código: ela decorre de não existir chave estrangeira entre `cartao` e
  `baralho`, e de a cascata alcançar apenas `vinculo`.
- A unicidade exigida por FR-020 virou chave primária composta, não validação
  imperativa — Locality máxima, uma regra num lugar só.
- O contrato em `contracts/api-acervo.md` **não tem rota de Sessão**, o que
  confirma na superfície visível que a Sessão não atravessa o servidor.
- Nenhuma Seam nova apareceu durante o design, e nenhuma das duas rejeitadas
  precisou ser reaberta.

## Decisões de Codebase Design

Vocabulário conforme `.agents/skills/codebase-design/SKILL.md`, usado
literalmente.

### Modules

| Module | Onde vive | O que esconde na Implementation |
|---|---|---|
| **Acervo** | API | Todas as invariantes de Cartão, Baralho e Vínculo; o esquema SQLite; a semântica não-cascateante da exclusão; o cálculo de elegibilidade |
| **SessaoDeEstudo** | Cliente | Randomização, limitação da quantidade ao disponível, progressão de Itens, controle de Revelação, imutabilidade do Resultado, agregação do Resumo |
| **Aleatoriedade** | Cliente | A fonte de ordem aleatória |
| **ClienteDoAcervo** | Cliente | O transporte até a API e a forma dos dados na rede |

### Seams reais — duas, cada uma com dois Adapters justificados

**Seam da Aleatoriedade.** Adapters: `AleatoriedadeReal` em produção e
`AleatoriedadeDeterministica` em teste. Justificada porque FR-030 exige ordem
randomizada e a invariante de ordem imutável durante a Sessão é intestável sem
controlar a fonte. Dois Adapters, Seam real.

**Seam do ClienteDoAcervo.** Adapters: `ClienteHttp` em produção e
`ClienteEmMemoria` em teste. Pela classificação de `DEEPENING.md`, a API é
dependência *remote but owned*: serviço próprio atravessando rede. A
recomendação da skill se aplica literalmente — porta na Seam, Adapter HTTP em
produção, Adapter em memória em teste, de modo que a lógica do cliente seja
testada sem servidor. Dois Adapters, Seam real.

### Seams rejeitadas — uma Implementation cada, portanto hipotéticas

**Repositório de persistência: REJEITADO.** Pela classificação de
`DEEPENING.md`, SQLite é dependência *local-substitutable*: o stand-in local
existe e é o próprio SQLite em memória. A skill é explícita para essa categoria
— *"the seam is internal; no port at the module's external interface"*. Produção
e teste usam o **mesmo driver** com destinos diferentes, o que é uma
Implementation com duas configurações, não dois Adapters. Introduzir uma
interface `RepositorioDeCartoes` seria indireção pura: sobe o custo da Interface
do Acervo sem nada variar atrás dela. A Seam de persistência é **interna** à
Implementation do Acervo.

**Adapter de apresentação entre a Sessão e a interface: REJEITADO.** Só existe
uma interface consumindo o Module de Sessão. Uma segunda Implementation seria
especulação. A Sessão é testada diretamente pela sua Interface, sem
intermediário.

### Depth

O **Acervo** é profundo: sua Interface expõe operações de domínio — vincular,
desvincular, excluir baralho — e esconde atrás delas o esquema, as transações e
toda a semântica não-cascateante. O chamador nunca vê uma linha de tabela.
Aplicando o teste da deleção: apagar o Acervo faria as invariantes
reaparecerem espalhadas por cada rota HTTP, portanto ele ganha o seu sustento.

A **SessaoDeEstudo** é o Module mais profundo do sistema. Pela classificação de
`DEEPENING.md` sua dependência é *in-process*: computação pura sobre os Cartões
já obtidos, sem I/O. Nenhum Adapter é necessário para persistência, porque nada
se persiste. A única dependência injetada é a Aleatoriedade.

**Locality**: as treze invariantes de conteúdo vivem só no Acervo; as
invariantes de sessão vivem só na SessaoDeEstudo. A interface não replica regra
nenhuma — ela só desabilita ações e exibe o que o Module respondeu. FR-023 é
satisfeito por construção: a validação autoritativa está no Acervo, no servidor,
e a interface não é a guardiã de nada.

## Interfaces dos Modules

Cada Interface é descrita pelo que um caller precisa saber para usá-la
corretamente: assinatura, invariantes, ordenação, modos de erro e
características relevantes. Conforme o Princípio IV, "Interface" aqui é mais que
a superfície de tipos.

### Interface do Module `Acervo`

Onze operações de domínio. Nenhuma expõe linha de tabela, transação, conexão ou
SQL.

```
criarCartao(frente, verso)                -> Cartao
editarCartao(id, frente?, verso?)         -> Cartao
excluirCartao(id)                         -> void
listarCartoes()                           -> Cartao[] com seus Baralhos
criarBaralho(nome)                        -> Baralho
renomearBaralho(id, nome)                 -> Baralho
excluirBaralho(id)                        -> void
listarBaralhos()                          -> Baralho[] com elegibilidade
obterBaralho(id)                          -> Baralho com seus Cartoes
vincular(cartaoId, baralhoId)             -> void
desvincular(cartaoId, baralhoId)          -> void
obterCartoesParaEstudo(baralhoId)         -> Cartao[]
```

**Invariantes garantidas pela Interface**, que o caller nunca precisa reproduzir:
Frente e Verso não vazios e com no máximo 1000 caracteres, descartados espaços
nas extremidades (FR-002, FR-051, FR-052); nome de Baralho não vazio e com no
máximo 100 caracteres, sem unicidade (FR-011, FR-012, FR-052); unicidade do par
(Cartão, Baralho) (FR-020); exclusão que remove Vínculos e **nunca** a entidade
do outro lado (FR-008, FR-017); elegibilidade derivada por contagem e nunca
persistida (FR-024).

**Ordenação**: `vincular` exige que ambas as entidades existam. `excluirCartao` e
`excluirBaralho` são idempotentes do ponto de vista do estado final, mas
reportam `nao_encontrado` quando o alvo não existe, para que a interface não
confirme ao usuário uma exclusão que não ocorreu. Nenhuma outra operação tem
pré-condição de ordem.

**Modos de erro**, exaustivos: `frente_vazia`, `verso_vazio`, `nome_vazio`,
`frente_muito_longa`, `verso_muito_longo`, `nome_muito_longo`,
`vinculo_duplicado`, `baralho_nao_elegivel`, `nao_encontrado`. Cada um carrega
mensagem em português destinada ao usuário (FR-046). O Acervo **não lança
exceção genérica** para regra de domínio: a falha de regra é resultado previsto,
não excepcional.

**Características**: toda operação de escrita é atômica. `excluirBaralho`
remove Vínculos e Baralho na mesma transação, de modo que nenhum estado
intermediário é observável. Todas as operações são síncronas.

### Interface do Module `SessaoDeEstudo`

Desenhada aqui, sob os Princípios IV e V. Quatro pontos de entrada.

```
iniciar(cartoes, quantidadeSolicitada, aleatoriedade) -> Sessao
revelar(sessao)                                       -> Sessao
responder(sessao, resultado)                          -> Sessao
estado(sessao)                                        -> EstadoDaSessao
```

`EstadoDaSessao` é o que a interface precisa para desenhar a tela inteira:
posição do Item corrente, total de Itens, Frente, Verso quando revelado, se a
Revelação já ocorreu, e o Resumo quando a Sessão termina.

**Por que esta forma**: `iniciar` esconde randomização, limitação ao disponível e
captura das cópias de Frente e Verso — três regras que, expostas, o caller teria
de orquestrar. `revelar` e `responder` são as duas únicas transições possíveis, e
recusar uma transição inválida é decisão do Module, não da tela. `estado` evita
que a interface leia campos internos: ela recebe exatamente o que exibe, o que
mantém a Locality das regras dentro do Module.

**Invariantes**: quantidade de Itens = `min(solicitada, cartões)` e nunca menor
que 1 (FR-028, FR-029); ordem definida em `iniciar` e imutável (FR-030); nenhum
Cartão origina dois Itens (FR-031); Verso ausente de `estado` antes da Revelação
(FR-032); Resumo ausente até o último Resultado (FR-037).

**Ordenação, que é a essência deste Module**: `revelar` antes de `responder`,
sempre. `responder` sem Revelação prévia é recusado (FR-034). `responder` duas
vezes no mesmo Item é recusado (FR-035). A Sessão avança sozinha ao Item
seguinte após `responder`, e nenhuma operação retrocede.

**Modos de erro**: `quantidade_invalida`, `baralho_sem_cartoes`,
`revelacao_ausente`, `resultado_ja_registrado`, `sessao_concluida`.

**Características**: sem I/O, sem relógio, sem estado global. Dada a mesma
entrada e a mesma Aleatoriedade, produz a mesma Sessão — é o que torna a
invariante de ordem verificável. Não serializa e não se persiste (FR-038).

### Interface do Module `Aleatoriedade`

```
embaralhar<T>(itens: T[]) -> T[]
```

Um ponto de entrada. **Invariante**: a saída é uma permutação da entrada, mesmo
comprimento, mesmos elementos, nenhum perdido ou duplicado — propriedade que o
teste verifica diretamente. Nenhum modo de erro. `AleatoriedadeDeterministica`
acrescenta ao seu construtor uma semente; a Interface não muda.

### Interface do Module `ClienteDoAcervo`

Espelha as operações do `Acervo` e acrescenta o que a rede introduz.

**Invariantes**: nenhuma resposta que não seja de sucesso é apresentada como
operação concluída (FR-044). **Modos de erro**: os códigos do Acervo, mais
`indisponivel` para falha de transporte. **Características**: toda operação é
assíncrona e pode falhar por indisponibilidade — a diferença essencial em
relação ao `Acervo`, e a razão de esta Seam existir.

## Avaliação dos Modules

As seis perguntas do Princípio IV, aplicadas a cada Module central.

### `Acervo`

- **Interface menor que a complexidade que esconde?** Sim. Doze operações de
  domínio escondem esquema, transações, cascatas, validação de regra e derivação
  de elegibilidade.
- **Leverage real?** Sim. O Adapter HTTP tem doze rotas finas; sem o Module,
  cada rota reimplementaria validação e semântica de exclusão.
- **Locality?** Sim. As invariantes de conteúdo vivem em um lugar só.
- **Teste de exclusão?** Apagá-lo faria as regras reaparecerem em doze rotas.
  Ganha o sustento.
- **Testes permanecem na Interface?** Sim, com SQLite em memória, asseverando
  resultado observável e nunca inspecionando tabelas.
- **Seam especulativa?** Não. A Seam de persistência é interna e foi
  explicitamente rejeitada como porta.

### `SessaoDeEstudo`

- **Interface menor?** Sim, e por larga margem: quatro pontos de entrada
  escondem randomização, limitação, máquina de estados de três estágios por Item
  e agregação do Resumo.
- **Leverage real?** Sim. A interface gráfica fica sem nenhuma regra: ela
  desenha `EstadoDaSessao` e chama duas transições.
- **Locality?** Sim. Toda regra de sessão vive aqui; a tela não replica nenhuma.
- **Teste de exclusão?** Apagá-lo espalharia a máquina de estados pelos
  componentes de tela, onde ficaria intestável sem navegador.
- **Testes permanecem na Interface?** Sim. Dependência *in-process*, Aleatoriedade
  determinística injetada, asserções sobre `estado`.
- **Seam especulativa?** O Adapter de apresentação foi avaliado e rejeitado: uma
  única Implementation consumidora.

### `Aleatoriedade`

- **Interface menor?** Sim — um ponto de entrada.
- **Leverage e Locality?** Modestos, e assumidamente. Este Module existe pela
  **Seam**, não pela Depth.
- **Teste de exclusão?** Apagá-lo tornaria a invariante de ordem imutável
  intestável. É a justificativa da sua existência.
- **Seam especulativa?** Não: dois Adapters justificados, produção e teste.

### `ClienteDoAcervo`

- **Interface menor?** Modestamente. Ele traduz, não decide.
- **Leverage real?** Sim, pela Seam: permite testar a interface gráfica inteira
  sem servidor.
- **Teste de exclusão?** Apagá-lo espalharia tratamento de falha de transporte
  por cada tela.
- **Seam especulativa?** Não: dois Adapters, HTTP e em memória, pela categoria
  *remote but owned* de `DEEPENING.md`.

## Acessibilidade e Responsividade

Requisitos FR-041, FR-042, FR-048, FR-049 e critérios SC-007 e SC-013. São
critérios de aceitação pela seção Critérios de Qualidade da constituição, não
refinamento posterior.

- **Teclado**: cada ação da Sessão tem tecla dedicada — revelar, acertou, errou.
  Nenhuma depende de ponteiro. Ordem de tabulação segue a ordem visual.
- **Foco**: indicador visível que não depende de cor, com contorno e contraste.
  Ao avançar de Item, o foco é movido programaticamente para o novo conteúdo,
  para que o teclado não se perca.
- **Semântica**: controles com rótulo textual acessível; mudanças de estado —
  Verso revelado, Resultado registrado, Sessão concluída, operação falhada —
  anunciadas por região ativa, e não apenas pintadas na tela.
- **Responsividade**: layout de coluna única com gutter mínimo, sem rolagem
  horizontal. O Cartão durante a Sessão é o elemento crítico: o limite de 1000
  caracteres (FR-052) existe justamente para que ele caiba na tela pequena.

A verificação automatizada dessas garantias fica em `e2e/`, único lugar onde
navegador real existe.

## Validação, Erros e Configuração

**Duas camadas de validação, com fronteira explícita.** Forma na borda: corpo
que não é JSON, campo ausente, tipo errado — recusados pelo Adapter HTTP antes
de alcançar o Acervo. Regra de domínio dentro do Acervo: vazio, limite de
tamanho, duplicidade, elegibilidade. A distinção importa porque regra de domínio
precisa de mensagem útil ao usuário, e forma inválida não.

**FR-023 satisfeito por construção**: o Acervo é a autoridade e valida
independentemente do que a interface permita. Desabilitar um botão é
conveniência, nunca garantia.

**Configuração**: duas variáveis, com padrão utilizável sem configurar nada —
caminho do arquivo SQLite e porta do servidor. A interface recebe o endereço da
API em tempo de build. Não há arquivo de segredo, porque não há segredo: sem
autenticação e sem serviço externo, não existe credencial a proteger
(Princípio VIII permanece válido por vacuidade, e `.gitignore` já bloqueia
`.env` caso isso mude).

**Segurança**: a superfície é mínima e deliberadamente assim. Sem autenticação,
condicional à execução local declarada nas Assumptions da spec. Consultas
parametrizadas, nunca concatenação de SQL. A API aceita conexões apenas de
`localhost`. **Expor esta aplicação em rede pública exigiria reabrir a decisão
de não haver usuários**, e o plano não contém nada que prepare essa exposição,
conforme o Princípio VII.

**Observabilidade mínima**: log de erro no console do servidor, com código de
erro e rota, sem conteúdo de Cartão. Nada além disso. Um app local de usuário
único não tem operador para observar, e logging estruturado seria infraestrutura
sem consumidor.

**Migrações**: ausentes por ora, com gatilho explícito. O esquema é criado na
primeira execução com `CREATE TABLE IF NOT EXISTS`. A primeira alteração de
esquema após existir base instalada é o momento em que migração versionada passa
a ser necessária — e não antes.

## Riscos, Alternativas e Custo de Reversão

| Decisão | Risco | Alternativa rejeitada | Custo de reversão |
|---|---|---|---|
| Frontend e API separados | Duas execuções para desenvolver; CORS; mais peças que o MVP exige | Aplicação única full-stack, recomendada pelo Arquiteto e **não** escolhida pelo Product Owner | Baixo: unificar é mais fácil que separar |
| SQLite local | Migração futura para Postgres, se a hospedagem remota ocorrer | Postgres local via Docker | Médio: esquema portável, mas driver e transações mudam |
| Sem porta de repositório | Se um segundo mecanismo de armazenamento aparecer, extrair a porta custa refatoração | Repositório desde já | Médio, e deliberadamente aceito: pagar agora seria indireção sem variação |
| Sessão só no cliente | Nenhuma métrica jamais será coletável sem redesenho | Sessão no servidor | Alto, e é decisão de produto do Product Owner, não técnica |
| Sem migrações versionadas | A primeira mudança de esquema com base instalada exigirá trabalho não planejado | Migrações desde o início | Baixo: introduzir no momento do gatilho |
| Limites de 1000 e 100 caracteres | Conteúdo legítimo mais longo é recusado | Sem limite | Baixo: afrouxar é trivial; apertar depois quebraria dados |

**AWS e deploy permanecem fora de escopo.** Nada neste plano é arquitetura
especulativa para nuvem: não há fila, cache distribuído, microserviço,
containerização nem abstração de provedor. A reversibilidade preservada é a que
vem de graça — esquema SQL portável e domínio isolado de transporte.

## Project Structure

### Documentation (this feature)

```text
specs/001-flashcard-study-mvp/
├── plan.md              # Este arquivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── api-acervo.md    # Phase 1
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2, criado por /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── acervo/            # Module Acervo: Interface + Implementation
│   │   ├── acervo.ts      # a Interface, superfície de teste
│   │   ├── invariantes.ts # regras de Cartão, Baralho e Vínculo
│   │   └── esquema.ts     # esquema SQLite, Seam interna
│   └── http/              # Adapter HTTP que expõe o Acervo
│       ├── servidor.ts
│       └── rotas.ts
└── tests/
    └── acervo/            # testes pela Interface, SQLite em memória

frontend/
├── src/
│   ├── sessao/            # Module SessaoDeEstudo (Interface pendente)
│   ├── aleatoriedade/     # Seam: AleatoriedadeReal | AleatoriedadeDeterministica
│   ├── acervo-cliente/    # Seam: ClienteHttp | ClienteEmMemoria
│   └── ui/                # telas; sem regra de domínio
└── tests/

e2e/                       # Playwright: teclado, persistência entre execuções
```

**Structure Decision**: Estrutura de aplicação web com `backend/` e `frontend/`
separados, refletindo a decisão do Product Owner por dois deployables
independentes. `e2e/` é uma terceira raiz porque seus testes atravessam ambos e
não pertencem a nenhum. O diretório `acervo/` no backend é o Module, não uma
camada: não existem pastas `models/`, `services/` ou `controllers/`, porque a
divisão do sistema aqui é por Module e Seam, não por tipo de arquivo.

## Complexity Tracking

> Nenhuma violação da constituição a justificar.

As duas Seams criadas têm dois Adapters cada, conforme o Princípio IV. As duas
Seams rejeitadas estão registradas com a razão da rejeição. Nenhuma abstração
foi antecipada: não há ORM, repositório, gerenciador de estado global, camada de
serviço, paginação, índice extra ou migração versionada. A justificativa de cada
omissão está em `research.md`.
