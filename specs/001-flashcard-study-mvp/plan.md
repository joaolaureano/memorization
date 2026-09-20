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
Baralho, Sessão de estudo.

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

### Interface do Module SessaoDeEstudo

A forma final desta Interface não é fixada neste plano, mas **não é mais uma
pendência bloqueante**: por decisão do Product Owner, o processo `Design It
Twice` foi removido do projeto e a constituição 2.0.0 o declara inaplicável.

A Interface será desenhada pelo Arquiteto no fluxo normal, sob os Princípios IV
e V, quando a tarefa correspondente for elaborada. Este plano já fixa o que a
constrange: responsabilidades do Module, dependência *in-process* pela
classificação de `DEEPENING.md`, ausência de qualquer Seam de persistência, e a
Aleatoriedade como única dependência injetada.

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
