# Implementation Plan: Criar Cartão

**Branch**: `001-criar-cartao` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-criar-cartao/spec.md`

## Summary

Primeira feature do produto. Entrega criar e listar Cartão, e por ser a primeira
carrega a fundação técnica sobre a qual as cinco features seguintes se apoiam:
esqueleto dos dois deployables, esquema inicial e o caminho completo da
interface até o armazenamento.

O escopo de domínio é deliberadamente estreito — **apenas Cartão**. Não há
Baralho, não há Vínculo, não há Sessão. Isso não é simplificação provisória: é o
recorte da feature, e nada neste plano antecipa as demais.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 22 LTS, nos dois lados

**Primary Dependencies**: Fastify (servidor HTTP), **`node:sqlite`** — o módulo
SQLite embutido no runtime, síncrono e sem build nativo —, Zod (validação de
forma na borda), React 19 + Vite (interface)

> **Decisão revista em T001.** O plano previa `better-sqlite3`. Ele **não
> compila** no Node 26 deste ambiente: não há prebuild e o `node-gyp` falha.
> `node:sqlite` foi verificado em execução — restrições `CHECK` aplicadas, API
> síncrona, `PRAGMA` aceito — e substitui o driver **eliminando uma dependência
> e o build nativo**, o que reforça o Princípio VII. A decisão do Product Owner
> permanece intacta: SQLite local, em arquivo, sem Docker.

**Storage**: SQLite em arquivo local, sem Docker e sem servidor de banco

**Testing**: Vitest para unidade e integração; Testing Library para interação de
tela; Playwright para os dois cenários que exigem navegador real

**Target Platform**: Máquina local do usuário; navegador moderno

**Project Type**: Aplicação web com frontend e API separados, dois deployables

**Performance Goals**: Nenhuma meta numérica. O acervo previsto é de ordem de 50
Cartões (SC-011), volume em que qualquer consulta direta é instantânea.

**Constraints**: Execução local, sem exposição em rede pública. Sem
autenticação — segura apenas sob essa condição.

**Scale/Scope**: 17 requisitos funcionais, 6 critérios de sucesso, 1 história.
Duas telas: lista de Cartões e criação de Cartão.

As decisões de stack foram tomadas pelo Product Owner e estão registradas em
`SESSION.md`, EVT-017. Não são reabertas aqui.

## Constitution Check

*GATE: antes da Phase 0 e revisto após a Phase 1.*

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Este plano deriva apenas de `spec.md` desta feature. Nenhum requisito novo introduzido. |
| II — Auditabilidade | **PASS**. Execução registrada em `SESSION.md` com banner SPEC KIT. |
| III — Domínio antes de tecnologia | **PASS**. Identificadores usam `Cartao`, `Frente`, `Verso`. Os sinônimos `card`, `flashcard` são proibidos em nome de módulo, tipo, função, tabela, coluna e rota. |
| IV — Módulos profundos | **PASS**. Um Module, uma Seam real, uma Seam rejeitada. Detalhado abaixo. |
| V — Interface é a superfície de teste | **PASS**. O `Acervo` é testado pela sua Interface com SQLite em memória, nunca inspecionando tabelas. |
| VI — Verificação sobre afirmação | **PASS**. Todo diff de worker é inspecionado e as verificações executadas pelo Arquiteto. |
| VII — Escopo mínimo | **PASS**. Ver Complexity Tracking: vazio. |
| VIII — Segredos fora do repositório | **PASS por vacuidade verificada**. Sem autenticação e sem serviço externo, não há credencial. `.gitignore` já bloqueia `.env`, `*.pem`, `*.key` e `*.sqlite`. |
| IX — Rastreabilidade requisito–teste | **PASS condicionado**. A matriz é produzida em `tasks.md`. Registrado como obrigação daquela etapa, não como satisfeito aqui. |
| X — Portões de qualidade | **PASS até aqui**. `checklist` e `analyze` desta feature ainda não executados; `implement` permanece bloqueado até que o sejam. |
| XI — Delegação obrigatória de código | **PASS**. Nenhuma linha de código neste plano. Todo código sob `backend/`, `frontend/` e `e2e/` será criado por subagentes DeepSeek. |

**Processos removidos**: a constituição 2.0.0 declara ADRs e Design It Twice
inaplicáveis. Nenhuma ADR criada; nenhuma proposta alternativa de Interface
comparada.

## Decisões de Codebase Design

Vocabulário conforme `.agents/skills/codebase-design/SKILL.md`, usado
literalmente.

### Modules desta feature

| Module | Onde | O que esconde na Implementation |
|---|---|---|
| **Acervo** | API | Esquema, transações, validação das regras de Cartão |
| **ClienteDoAcervo** | Cliente | Transporte até a API e forma dos dados na rede |

### Interface do Module `Acervo`

Dois pontos de entrada nesta feature. Crescerá nas features seguintes; aqui
expõe só o que 001 exige.

```
criarCartao(frente, verso) -> Cartao
listarCartoes()            -> Cartao[]
```

**Invariantes garantidas pela Interface**, que o caller nunca reproduz: Frente e
Verso não vazios após descartar espaços nas extremidades (FR-002, FR-051); no
máximo 1000 caracteres cada (FR-052); nenhuma propriedade além de Frente e Verso
(FR-009). A Frente **não** é identificador: dois Cartões podem ter a mesma.

**Ordenação**: nenhuma pré-condição. As duas operações são independentes.

**Modos de erro**, exaustivos nesta feature: `frente_vazia`, `verso_vazio`,
`frente_muito_longa`, `verso_muito_longo`. Cada um carrega mensagem em português
destinada ao usuário (FR-046). Falha de regra de domínio é resultado previsto, e
**não** exceção genérica.

**Características**: escrita atômica; operações síncronas.

### Interface do Module `ClienteDoAcervo`

Espelha as duas operações e acrescenta o que a rede introduz.

**Invariantes**: nenhuma resposta que não seja de sucesso é apresentada como
operação concluída (FR-044). **Modos de erro**: os do `Acervo`, mais
`indisponivel` para falha de transporte. **Características**: assíncrona e
sujeita a indisponibilidade — a diferença essencial em relação ao `Acervo`, e a
razão de esta Seam existir.

### Seam real — uma, com dois Adapters justificados

**Seam do `ClienteDoAcervo`**. Adapters: `ClienteHttp` em produção e
`ClienteEmMemoria` em teste. Pela classificação de `DEEPENING.md`, a API é
dependência *remote but owned*: serviço próprio atravessando rede. A
recomendação da skill se aplica literalmente, e a Seam permite testar a interface
gráfica inteira sem servidor.

### Seam rejeitada — uma Implementation, portanto hipotética

**Repositório de persistência: REJEITADO.** Pela classificação de
`DEEPENING.md`, SQLite é dependência *local-substitutable*: o stand-in local é o
próprio SQLite em memória. A skill é explícita para essa categoria — *"the seam
is internal; no port at the module's external interface"*. Produção e teste usam
o **mesmo driver** com destinos diferentes, o que é uma Implementation com duas
configurações, não dois Adapters. A Seam de persistência é **interna** à
Implementation do `Acervo`.

### Classificação das dependências

| Dependência | Categoria | Consequência |
|---|---|---|
| SQLite | *local-substitutable* | Seam interna, sem porta |
| API, vista do cliente | *remote but owned* | Porta na Seam, dois Adapters |
| Nenhuma | *true external* | Não há serviço de terceiro nesta feature |

### Avaliação do Module `Acervo`

- **Interface menor que a complexidade que esconde?** Sim. Duas operações
  escondem esquema, transação e as quatro regras de conteúdo.
- **Leverage real?** Sim. As duas rotas HTTP ficam finas; sem o Module, cada uma
  reimplementaria validação.
- **Locality?** Sim. As regras de Cartão vivem em um lugar só.
- **Teste de exclusão?** Apagá-lo faria as regras reaparecerem nas rotas e na
  tela. Ganha o sustento.
- **Testes permanecem na Interface?** Sim, com SQLite em memória.
- **Seam especulativa?** Não. A única criada tem dois Adapters; a rejeitada está
  registrada com a razão.

## Contrato HTTP

Duas rotas. Base `http://localhost:<porta>`, corpo em JSON.

### `POST /cartoes`

Requisição: `{ "frente": "To walk", "verso": "Caminhar" }`

- `201 Created` — devolve o Cartão criado
- `400 Bad Request` — `{ "erro": "frente_vazia", "mensagem": "..." }`

Códigos: `frente_vazia`, `verso_vazio`, `frente_muito_longa`,
`verso_muito_longo`. `mensagem` é texto em português para o usuário; `erro` é o
código estável consumido pelo cliente.

### `GET /cartoes`

`200 OK` — `[ { "id": "c1", "frente": "To walk", "verso": "Caminhar" } ]`

Propriedade extra enviada na criação é **ignorada e não retorna nas leituras**,
o que é a verificação de FR-009.

## Modelo de Dados

Uma tabela nesta feature. `baralho` e `vinculo` pertencem às features `002` e
`003` e **não** são criadas aqui.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cartao (
  id     TEXT PRIMARY KEY,
  frente TEXT NOT NULL CHECK (length(trim(frente)) > 0 AND length(frente) <= 1000),
  verso  TEXT NOT NULL CHECK (length(trim(verso))  > 0 AND length(verso)  <= 1000)
);
```

As restrições `CHECK` duplicam FR-002, FR-051 e FR-052 de propósito: a validação
primária vive no `Acervo`, com mensagem útil; a restrição no banco é a rede de
segurança contra erro de programação.

`PRAGMA foreign_keys = ON` é ativado já aqui, embora não haja chave estrangeira
nesta feature, para que a feature `003` não dependa de lembrar de ligá-lo.

**Migrações: ausentes, com gatilho declarado.** O esquema é criado na primeira
execução. A feature `002` acrescentará a tabela `baralho` — **esse é o momento
em que migração versionada passa a ser necessária**, por haver base instalada.
Registrado aqui para que a decisão não seja tomada por omissão.

## Validação, Erros, Configuração e Segurança

**Duas camadas, fronteira explícita.** Forma na borda: corpo que não é JSON,
campo ausente, tipo errado — recusados pelo Adapter HTTP antes de alcançar o
`Acervo`. Regra de domínio dentro do `Acervo`: vazio, só espaços, limite de
tamanho. Regra de domínio precisa de mensagem útil; forma inválida não.

**Configuração**: duas variáveis com padrão utilizável sem configurar nada —
caminho do arquivo SQLite e porta. A interface recebe o endereço da API em tempo
de build. Não há arquivo de segredo porque não há segredo.

**Segurança**: consultas parametrizadas, nunca concatenação de SQL. A API aceita
conexões apenas de `localhost`. Expor a aplicação em rede pública exigiria
reabrir a decisão de não haver usuários, e nada neste plano prepara essa
exposição.

**Observabilidade mínima**: log de erro no console do servidor, com código de
erro e rota, **sem conteúdo de Cartão**. Nada além disso.

## Acessibilidade e Responsividade

Requisitos FR-042, FR-054, FR-055, FR-056 e critério SC-017. São critérios de
aceitação pela seção Critérios de Qualidade da constituição.

- **Teclado**: os campos e a ação de criar são alcançáveis e acionáveis por
  teclado; a ordem de tabulação segue a ordem visual.
- **Foco**: indicador visível que não depende de cor. Numa recusa, o foco vai
  para o campo que precisa de correção.
- **Semântica**: mensagens de erro e estado vazio anunciados por região ativa.
- **Responsividade**: coluna única, sem rolagem horizontal em largura de
  telefone.

## Estratégia de Testes

A Interface é a superfície. `Acervo` testado com SQLite em memória, asseverando
resultado observável. `ClienteDoAcervo` testado com a mesma bateria contra os
dois Adapters. Tela testada com Testing Library, incluindo as asserções de
teclado e foco. `e2e/` reservado ao que só o navegador prova: persistência entre
execuções (SC-003) e responsividade.

Comandos de verificação: `npm test` em `backend/` e em `frontend/`,
`npm run test:e2e` na raiz. No backend, `npm run build` é **verificação de
tipos** (`tsc --noEmit`), não empacotamento: o Node 26 executa TypeScript
diretamente, e nenhum artefato de build é necessário. Os imports relativos usam
extensão `.ts`, porque o runtime — diferentemente do Vitest — não reescreve
`.js` para `.ts`.

## Project Structure

```text
backend/
├── src/
│   ├── acervo/            # Module Acervo: Interface + Implementation
│   │   ├── acervo.ts      # a Interface, superfície de teste
│   │   ├── invariantes.ts # regras de Cartão
│   │   └── esquema.ts     # esquema SQLite, Seam interna
│   └── http/              # Adapter HTTP
│       ├── servidor.ts
│       └── rotas.ts
└── tests/acervo/

frontend/
├── src/
│   ├── acervo-cliente/    # Seam: ClienteHttp | ClienteEmMemoria
│   └── ui/                # telas; sem regra de domínio
└── tests/

e2e/
```

**Structure Decision**: `backend/` e `frontend/` separados, refletindo a decisão
do Product Owner por dois deployables. `e2e/` é terceira raiz por atravessar
ambos. O diretório `acervo/` é o Module, **não uma camada**: não existem pastas
`models/`, `services/` ou `controllers/`, porque a divisão é por Module e Seam.

## Riscos, Alternativas e Custo de Reversão

| Decisão | Risco | Alternativa rejeitada | Custo de reversão |
|---|---|---|---|
| Frontend e API separados | Duas execuções; CORS; mais peças que a feature exige | Aplicação única full-stack, recomendada pelo Arquiteto e não escolhida pelo PO | Baixo |
| SQLite local | Migração futura se houver hospedagem remota | Postgres via Docker | Médio |
| Sem porta de repositório | Extrair depois custa refatoração | Repositório desde já | Médio, deliberadamente aceito |
| Sem migrações agora | A feature `002` terá de introduzi-las | Migrações desde o início | Baixo, com gatilho declarado |

## Complexity Tracking

> Nenhuma violação da constituição a justificar.

Uma Seam criada, com dois Adapters; uma rejeitada, com a razão registrada.
Nenhuma abstração antecipada: sem ORM, sem repositório, sem gerenciador de
estado global, sem paginação, sem migração, sem tabela de outra feature.
