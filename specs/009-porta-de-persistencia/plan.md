# Implementation Plan: Porta de Persistência

**Branch**: `009-porta-de-persistencia` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Depende de**: `001-criar-cartao` a `006-excluir-cartao-e-baralho`, cujo acervo
passa a persistir pela Porta **sem mudança de comportamento**, e é base de
`007-criar-usuario`, `008-entrar` e `010-postgresql-na-nuvem`. Reusa a fundação
de projeto de [`001`](../001-criar-cartao/plan.md) (TypeScript estrito sobre Node
24+, Fastify, `node:sqlite`, Zod nas bordas, Vitest, Testing Library, Playwright),
a Seam `ClienteDoAcervo` e a lista ordenada de migrações de
[`002`](../002-criar-baralho/plan.md). Nenhuma dessas decisões é reaberta —
**uma é revertida, e de forma explícita**: a Seam de persistência que `001`
rejeitou como hipotética passa a existir, porque agora há **dois Adapters
justificados** (SQLite nesta feature, PostgreSQL na `010`).

## Summary

Nona feature, e a única que não muda nada para quem usa a aplicação: ela
**reenquadra** a persistência já entregue por `001` a `006` atrás de uma Porta no
domínio, entrega o Adapter do armazenamento local como primeira implementação
dela, permite escolher o armazenamento **na construção** do backend e cria a
bateria compartilhada de cenários que todo Adapter precisa passar.

O escopo é operacional e estreito: nenhuma tela, campo, ação, rota ou regra nova.
O que muda é onde o conhecimento do banco mora:

- a Interface do Module `Acervo` passa a ser **assíncrona**, porque os drivers de
  PostgreSQL são assíncronos e a Porta precisa servir aos dois; as rotas passam a
  aguardar e **o contrato HTTP não muda**, então o frontend não é tocado
  (FR-105, SC-038);
- a Porta `ArmazenamentoDoAcervo` é declarada no **domínio**, com operações de
  armazenamento nomeadas pelo domínio (Cartões, Baralhos, Vínculos e as contagens
  da elegibilidade) e com desfechos **tipados** — nunca erro de driver (FR-100,
  FR-107);
- o Adapter `backend/src/armazenamento/sqlite/` passa a ser o **dono do esquema
  SQLite e das migrações versionadas**, que se mudam de `backend/src/acervo/`
  sem alterar uma linha de conteúdo nem os números de versão, para que bases
  locais já instaladas continuem servindo (FR-103, FR-104);
- uma **raiz de composição por armazenamento** é o único lugar que importa um
  Adapter: `backend/src/entradas/local.ts` hoje, `backend/src/entradas/nuvem.ts`
  na `010` (FR-100, SC-043);
- a construção passa a receber o parâmetro que escolhe o armazenamento, e recusa
  construir sem ele ou com um valor não aceito, **sem produzir artefato** e sem
  repetir o valor informado (FR-102, FR-108, SC-040); o pacote de um
  armazenamento não contém o Adapter do outro (FR-120);
- o início informa, numa linha, qual armazenamento está em uso — sem caminho,
  sem URL e sem segredo (FR-108, SC-042).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 24+ (runtime já usado pela
aplicação; nada muda)

**Primary Dependencies**: Fastify (servidor HTTP), `node:sqlite` (módulo SQLite
embutido no runtime), Zod (forma na borda), React 19 + Vite (interface) — todas
de `001` e da `007`, **não reabertas**. **Nova nesta feature**: `esbuild` como
devDependency do backend, para empacotar uma entrada escolhida num pacote
executável (Decisão 7).

**Storage**: SQLite em arquivo local, agora atrás da Porta `ArmazenamentoDoAcervo`
e implementado pelo Adapter `backend/src/armazenamento/sqlite/`; caminho
configurável por `CAMINHO_DO_BANCO`, com o padrão `memorizacao.sqlite` de hoje
(FR-103). A `010` acrescenta o Adapter de PostgreSQL, apontado por URL de
conexão — mencionado aqui apenas para deixar lugar, sem desenhar seus internos.

**Testing**: Vitest para unidade e integração, Testing Library para interação de
tela, Playwright para navegador real — de `001`, não reabertos. **Novo**: a
bateria compartilhada `backend/tests/armazenamento/bateria-da-porta.ts`, que
recebe uma fábrica de Adapter e registra os cenários da Porta (FR-106, SC-039).

**Target Platform**: Máquina local do usuário; navegador moderno; servidor
escuta **apenas** no loopback, garantia de runtime que continua valendo sem
alteração

**Project Type**: Aplicação web com frontend e API separados, dois deployables;
o backend passa a ter **um pacote por armazenamento** (FR-120)

**Performance Goals**: nenhuma meta numérica. A Interface assíncrona acrescenta
um `Promise` por operação; com `node:sqlite` o custo é de microssegundos, e o
acervo previsto é de ordem de 50 Cartões.

**Constraints**: execução local, sem Docker e sem servidor de banco; nenhum
segredo é exibido ou registrado, nem em mensagem de recusa (FR-108); `dist/` e
`*.sqlite` permanecem ignorados pelo Git.

**Scale/Scope**: 13 requisitos funcionais (FR-044 e FR-045 reutilizados; FR-100 a
FR-109 e FR-120 específicos), 6 critérios de sucesso (SC-038 a SC-043), 3
histórias, **nenhuma** tela, rota, tabela ou coluna nova, 1 devDependency nova, 1
Seam nova com dois Adapters justificados e 1 Module realocado (a raiz de
composição).

## Constitution Check

*GATE: antes da Phase 0 e revisto após a Phase 1.*

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Deriva apenas de `spec.md` desta feature |
| II — Auditabilidade | **PASS**. Registrado em `SESSION.md` com banner SPEC KIT. Nenhum valor sensível é escrito, nem em mensagem de recusa |
| III — Domínio antes de tecnologia | **PASS**. Identificadores usam `Porta`, `Adapter`, `Armazenamento`, `Cartão`, `Baralho`, `Vínculo` e `contagem`; `repository`, `dao`, `store`, `driver` e `datasource` não nomeiam módulo, tipo, função, tabela nem rota. Os dois diretórios de Adapter são nomeados pelo armazenamento que o Product Owner nomeou — `sqlite` e, na `010`, `postgresql` —, e nenhum Module os conhece (FR-100) |
| IV — Módulos profundos | **PASS**, com a reversão declarada da decisão de `001`. A Porta passa a ser uma Seam **real**: dois Adapters justificados — o do armazenamento local, nesta feature, e o de PostgreSQL, na `010`. A Interface segue pequena para o que esconde: um verbo por operação esconde esquema, transação, dialeto e tradução de erro |
| V — Interface é a superfície de teste | **PASS**. A Porta é exercitada pela bateria compartilhada, que é a mesma Seam que os Modules atravessam; a Interface assíncrona do `Acervo` continua testada com um Adapter real em memória. Nenhum teste passa a inspecionar tabela |
| VI — Verificação sobre afirmação | **PASS**. Todo diff de worker é inspecionado. A ausência de dependência de armazenamento nos Modules (SC-043) e a ausência do Adapter alheio no pacote (FR-120) são comprovadas por teste, não afirmadas |
| VII — Escopo mínimo | **PASS**. Complexity Tracking vazio. Uma devDependency nova, exigida por FR-102 e FR-120; nenhuma configuração em tempo de execução, nenhum ORM, nenhum conjunto de conexões, nenhuma migração de dados entre armazenamentos |
| VIII — Segredos fora do repositório | **PASS**. Nenhum segredo novo nesta feature: a linha de início nomeia o **tipo** de armazenamento, nunca o caminho nem uma URL, e a recusa da construção não repete o valor informado (FR-108, SC-042). `*.sqlite` e `dist/` continuam no `.gitignore` |
| IX — Rastreabilidade | **PASS condicionado**. A matriz requisito–teste é produzida em `tasks.md` |
| X — Portões de qualidade | **PASS até aqui**. Os portões passam a ser `npm run typecheck` e `npm run build:local` no backend; `analyze` é executado ao final desta etapa |
| XI — Delegação de código | **PASS**. Todo código em `backend/`, `frontend/` e `e2e/` será escrito por workers DeepSeek |

**Processos removidos**: ADRs e Design It Twice não se aplicam, pela constituição
2.1.0. **Nenhuma emenda é necessária**: o Princípio IV não está sendo relaxado —
está sendo cumprido. Em `001` havia um Adapter só e a Seam era hipotética; agora
o segundo Adapter é pedido (FR-106, FR-120 e a `010`), e é ele que torna a Seam
real.

### Re-avaliação após Phase 1

**PASS, sem alteração.** O desenho confirmou as decisões:

- a Porta só carrega operações de armazenamento do domínio, e nenhuma delas
  recebe SQL, dialeto, conexão ou escolha de armazenamento (FR-100);
- nenhum erro de driver atravessa a Porta: unicidade de Vínculo, ausência de
  entidade e indisponibilidade chegam como **desfechos tipados**, e as mensagens
  em português continuam sendo dos Modules (FR-107);
- a Interface assíncrona do `Acervo` não muda o contrato HTTP — a única novidade
  é o status de indisponibilidade, que o Adapter do cliente já traduz em
  `indisponivel` —, então o frontend fica intocado (FR-105, SC-038);
- a bateria compartilhada recebe uma fábrica de Adapter e é a única prova
  exigida da Porta; a `010` a aponta para PostgreSQL sem editá-la (FR-106,
  SC-039);
- as migrações mudam de pasta com **conteúdo e versões idênticos** — a prova de
  FR-103 e FR-104 é o arquivo local existente continuar abrindo na versão que já
  registra.

## Decisões de Codebase Design

Vocabulário conforme `.agents/skills/codebase-design/SKILL.md`, usado
literalmente.

### Reversão declarada — a Seam de persistência de `001`

`001` registrou, no seu plano: *"Repositório de persistência: REJEITADO. […]
SQLite é dependência local-substitutable: o stand-in local é o próprio SQLite em
memória. […] Produção e teste usam o mesmo driver com destinos diferentes, o que
é uma Implementation com duas configurações, não dois Adapters."* A decisão
estava **certa para o que existia então**: um Adapter só seria uma Seam
hipotética, e o custo de extrair depois foi aceito como médio.

O que mudou não é a classificação do SQLite, e sim a existência de um **segundo
armazenamento real**, pedido pelo Product Owner e verificado pela bateria
compartilhada: PostgreSQL, na `010`, com driver assíncrono, outro dialeto e outra
forma de aplicar migrações. Com dois Adapters, a Seam deixa de ser hipotética e
passa a ser a única forma de FR-100 valer — nenhum Module conhece, nomeia ou
importa armazenamento concreto — e de FR-106 valer — uma bateria só, reusada, sem
cenário escrito duas vezes. A reversão é registrada aqui, e não escondida: o
Princípio IV passa a ser satisfeito por acréscimo, não por exceção.

### Module `Acervo` — a Interface passa a ser assíncrona, e nada mais muda

`criarAcervo` deixa de receber um banco e passa a receber a Porta:

```
criarAcervo(armazenamento: ArmazenamentoDoAcervo) -> Acervo

Acervo.criarCartao(dados)      -> Promise<ResultadoDeCriacaoDeCartao>
Acervo.listarCartoes()         -> Promise<CartaoListado[]>
Acervo.criarBaralho(dados)     -> Promise<ResultadoDeCriacaoDeBaralho>
Acervo.listarBaralhos()        -> Promise<BaralhoListado[]>
Acervo.obterBaralho(id)        -> Promise<ResultadoDeObterBaralho>
Acervo.vincular(…)             -> Promise<ResultadoDeVinculacao>
Acervo.desvincular(…)          -> Promise<ResultadoDeDesvinculacao>
Acervo.editarCartao(…)         -> Promise<ResultadoDeEdicaoDeCartao>
Acervo.renomearBaralho(…)      -> Promise<ResultadoDeEdicaoDeBaralho>
Acervo.excluirCartao(id)       -> Promise<ResultadoDeExclusaoDeCartao>
Acervo.excluirBaralho(id)      -> Promise<ResultadoDeExclusaoDeBaralho>
```

**Invariantes continuam idênticas**, e é isso que SC-038 mede: as mesmas regras
de conteúdo, os mesmos modos de erro estáveis com mensagem em português, a
Frente que não é identificador, o nome de Baralho que é rótulo, o par
(Cartão, Baralho) único, a elegibilidade derivada por contagem. O que sai da
Interface é apenas a sincronia: **todo verbo devolve `Promise`**, porque a Porta
é assíncrona (drivers de PostgreSQL não têm caminho síncrono) e porque manter um
caminho síncrono e outro assíncrono seriam duas Interfaces.

Também saem do Module as formas que atravessam a Seam: `Cartao` e `Baralho`
(identificador, Frente, Verso; identificador e nome) são declarados pela **Porta**,
que é quem troca esses dados com o armazenamento, e a Interface do `Acervo` os
re-exporta, de modo que nenhum caller muda. As formas derivadas na leitura —
`CartaoListado` com seus Baralhos, `BaralhoListado` com contagem e elegibilidade
— continuam sendo **do Module**: a contagem vem da Porta, a regra de elegibilidade
não.

### Porta `ArmazenamentoDoAcervo` — no domínio, e não um executor de SQL

Declarada em `backend/src/armazenamento/porta.ts`, ao lado de nenhum Adapter. É a
Interface que os Modules conhecem e a única coisa que eles conhecem sobre
armazenamento (FR-100). As operações são de **armazenamento do domínio**:

```
ArmazenamentoDoAcervo
  inserirCartao(cartao)               listarCartoes()
  obterCartao(id)                     atualizarCartao(cartao)      excluirCartao(id)
  inserirBaralho(baralho)             listarBaralhos()
  obterBaralho(id)                    atualizarBaralho(baralho)    excluirBaralho(id)
  vincular(cartaoId, baralhoId)       desvincular(cartaoId, baralhoId)
  listarBaralhosDoCartao(cartaoId)    listarCartoesDoBaralho(baralhoId)
  contarCartoesPorBaralho()           -> contagens, para a elegibilidade derivada
```

Toda operação devolve `Promise`, e todo desfecho é **tipado**:

```
Desfecho<T> = { ok: true; valor: T }
            | { ok: false; erro: "nao_encontrado" }
            | { ok: false; erro: "vinculo_duplicado" }   // só em `vincular`
            | { ok: false; erro: "indisponivel" }        // falha do armazenamento
```

**O que a Interface garante ao caller** (FR-100, FR-107):

- nenhuma operação recebe SQL, dialeto, conexão, transação ou **escolha de
  armazenamento** — a escolha é da construção, e a Porta não a vê;
- nenhum erro do driver atravessa: o erro de chave repetida vira
  `vinculo_duplicado`, ausência de linha vira `nao_encontrado`, falha de conexão
  ou de arquivo vira `indisponivel`. Nada disso é exceção, e nada disso traz
  texto do driver — o que também impede que uma mensagem de driver carregue
  caminho, cadeia de conexão ou credencial (FR-108);
- **a Porta não tem texto em português**: as mensagens de domínio continuam sendo
  dos Modules `Acervo` e `Identidade`, que traduzem o código estável para a frase
  que o usuário lê. A Porta é vocabulário de armazenamento; a frase é regra de
  domínio;
- `indisponivel` é o desfecho de FR-044 e FR-045: a operação **não** passou por
  concluída, e o caller pode tentar de novo sem redigitar nada.

Os detalhes das operações e dos desfechos estão em
[`contracts/porta-de-armazenamento.md`](./contracts/porta-de-armazenamento.md).

### Adapter do armazenamento local — e dono do esquema

Em `backend/src/armazenamento/sqlite/`:

| Arquivo | Papel |
|---|---|
| `armazenamento.ts` | O Adapter: implementa `ArmazenamentoDoAcervo` sobre `node:sqlite`; expõe `abrirArmazenamentoSqlite(caminho)`, que abre o arquivo, aplica as migrações e devolve a Porta mais o encerramento da conexão |
| `esquema.ts` | **movido** de `backend/src/acervo/esquema.ts`, conteúdo inalterado: `PRAGMA foreign_keys`, tabela de versão e aplicador com transação por migração |
| `migracoes.ts` | **movido** de `backend/src/acervo/migracoes.ts`, conteúdo e **números de versão** inalterados: 1 `cartao`, 2 `baralho`, 3 `vinculo` |

Cada Adapter é **dono do seu dialeto**: a `010` terá
`backend/src/armazenamento/postgresql/migracoes.ts` com o DDL de PostgreSQL para
as mesmas versões. A numeração é compartilhada — a lista ordenada de versões é a
mesma para todos os Adapters —, e o que difere é o DDL de cada um. `Acervo`
deixa de importar qualquer dos dois arquivos: nenhum SQL atravessa o domínio.

Mover, e não reescrever, é o que cumpre FR-103 e FR-104: o arquivo local já
existente continua sendo aberto, a versão registrada continua a mesma e as
migrações pendentes continuam sendo aplicadas como antes, com as mesmas regras de
descarte.

### Bateria compartilhada — a única prova exigida da Porta

`backend/tests/armazenamento/bateria-da-porta.ts` exporta uma função que recebe
uma **fábrica de Adapter** e registra os cenários da Porta:

```
bateriaDaPorta(criarArmazenamento, rotulo)
  criarArmazenamento(): Promise<{ armazenamento, encerrar() }>
```

Os cenários cobrem inserir, listar, obter, atualizar e excluir de Cartão e de
Baralho, vincular e desvincular — inclusive o par repetido e o Vínculo entre
extremidades inexistentes —, as contagens da elegibilidade derivada, os
desfechos `nao_encontrado` e `indisponivel`, e a persistência entre duas aberturas
do mesmo armazenamento. Nenhum cenário nomeia SQLite, arquivo, tabela ou
dialeto: o cenário é da Porta (FR-106).

- `backend/tests/armazenamento/sqlite.test.ts` chama a bateria com a fábrica do
  Adapter local — cem por cento dela passa (SC-039);
- a `010` acrescenta `backend/tests/armazenamento/postgresql.test.ts` chamando a
  **mesma** função, sem editar a bateria e sem editar nenhum Module (FR-106,
  SC-039);
- a suíte existente do `Acervo` continua sendo a verificação das regras de
  domínio, agora com o Adapter local por baixo: **as asserções não mudam**, muda
  a criação do Adapter e o `await` de cada chamada (SC-038).

### Raízes de composição — uma por armazenamento

`backend/src/entradas/local.ts` é a raiz de composição da execução local: lê
`CAMINHO_DO_BANCO` (padrão `memorizacao.sqlite`), abre o Adapter local, monta o
`Acervo` sobre a Porta, informa o armazenamento em uso e inicia o servidor.
`backend/src/index.ts` deixa de existir; a `010` acrescenta
`backend/src/entradas/nuvem.ts`, e nada mais.

**Só a entrada importa um Adapter.** Isso não é disciplina, é verificável: um
teste inspeciona os arquivos de `backend/src/acervo/`, `backend/src/identidade/`
e `backend/src/http/` e exige que nenhum importe `node:sqlite`, um driver de
PostgreSQL ou `backend/src/armazenamento/<adapter>` — o único import permitido é
`backend/src/armazenamento/porta.ts` (FR-100, SC-043). Os testes, que não são
Modules, importam o Adapter livremente: é assim que a bateria roda.

### Construção por armazenamento — um pacote por banco

`backend/scripts/construir.mjs`, executado por `npm run build`, recebe
`--banco=<valor>` e:

1. confere o parâmetro contra a **tabela de entradas do script** — hoje
   `{ sqlite: "src/entradas/local.ts" }`, na `010` com `postgresql` a mais. Valor
   ausente, em forma diferente de `--banco=<valor>`, desconhecido ou conhecido mas
   **ainda não entregue** (é o caso de `postgresql` nesta feature): recusa com
   mensagem em português que **lista apenas os valores aceitos**, sem repetir o
   valor informado, sai com código 1 e **não escreve nada** em `dist/`
   (FR-102, FR-108, SC-040);
2. empacota **a entrada escolhida** com `esbuild` — `bundle`, `platform: node`,
   `format: esm`, `target: node24`, módulos embutidos do Node externos — em
   `dist/<banco>/servidor.mjs`.

Como só a entrada escolhida entra no grafo do empacotamento, o Adapter do outro
armazenamento **não existe no pacote** (FR-120), e a prova é um teste que constrói
e inspeciona o resultado. `dist/` continua ignorado pelo Git. Os scripts, os
códigos de saída, as mensagens e a linha de início estão em
[`contracts/scripts-e-construcao.md`](./contracts/scripts-e-construcao.md).

### Relatório de início e falhas

- **Início**: uma única linha, antes de escutar — `Armazenamento: SQLite (arquivo
  local)`. Nomeia o **tipo** de armazenamento em uso e nunca o caminho do arquivo
  nem uma URL; na `010` a mesma linha dirá `Armazenamento: PostgreSQL (nuvem)`
  (FR-108, SC-042).
- **Falha do armazenamento**: o Adapter devolve `indisponivel`; o Module reporta
  a falha com mensagem própria em português; a rota responde 503 com o código
  estável e a mensagem, **sem detalhe do driver, sem caminho e sem URL**; e a
  operação não aparece como concluída (FR-044, FR-045, FR-107). O Adapter do
  cliente já traduz qualquer status fora do contrato em `indisponivel` e preserva
  o que foi digitado, então a interface não muda.
- **Recusa da construção**: a mensagem é do script, em português, e nada do valor
  informado — em particular um valor com aparência de credencial — aparece na
  saída nem em registro algum (FR-108, SC-042).

### Avaliação da Porta e da mudança

- **A Interface é menor que o que esconde?** Sim: quinze operações de
  armazenamento e quatro desfechos escondem esquema, dialeto, transação, tradução
  de erro do driver e o próprio fato de haver banco.
- **Há Leverage real?** Sim: as rotas e os dois Modules ficam finos; nenhum
  caller reimplementa validação, contagem ou tradução de erro — e acrescentar o
  Adapter de PostgreSQL não toca em nenhum deles.
- **Há Locality?** Sim: mudança de esquema, de dialeto ou de migração acontece
  inteira dentro de um diretório de Adapter.
- **Teste de exclusão**: sem a Porta, `Acervo` e `Identidade` voltariam a
  importar `node:sqlite`, e a `010` obrigaria a ramificar por driver dentro dos
  Modules — a complexidade reapareceria em três lugares em vez de um.
- **Os testes usam a Interface?** Sim: a bateria atravessa a Porta, e as suítes
  existentes atravessam a Interface do `Acervo` com um Adapter real.
- **Há Seam especulativa?** Não. A única Seam nova tem dois Adapters
  justificados, e a bateria que os verifica é exigida por FR-106.

## Impacto em 007 e 008

`007-criar-usuario` e `008-entrar` **não estão implementadas** — são planos. Este
plano as lê como construídas **sobre a Porta assíncrona**, e não sobre um banco
concreto:

- **`Identidade` depende de `ArmazenamentoDeUsuarios`**, a segunda Porta,
  declarada no mesmo `backend/src/armazenamento/porta.ts` com duas operações:
  `inserirUsuario` e `obterUsuarioPorNomeDeUsuario`. Nome de usuário já existente
  chega como desfecho tipado — `nome_de_usuario_existente` —, nunca como erro de
  `UNIQUE` do driver, e a derivação de Senha continua inteiramente no Module: ele
  decide o que derivar, e a Porta guarda `sal`, `hash` e `parametros` como
  quaisquer outros campos — nunca a Senha, e nunca em texto de mensagem.
- **Migrações 4 e 5 passam a ser escritas por Adapter**: a 4 (`usuario`) e a 5
  (acervo com dono) ganham um DDL para o Adapter local e, na `010`, um DDL para
  PostgreSQL, com os **mesmos números de versão**. A ordem 009 → 010 → 007 → 008,
  definida no clarify, é o que permite que a segunda Porta e as duas migrações
  nasçam já em dois Adapters, sem reescrita.
- **`criarAcervo` recebe a Porta**; a `008` acrescenta o dono no construtor
  (`criarAcervo(armazenamento, usuarioId)`) sem mudar a forma das operações, e as
  rotas continuam aguardando o `Acervo` — o contrato HTTP de `008` (o hook
  `onRequest`, o 401 uniforme, o escopo por dono) permanece como está planejado.
- **A entrada muda de lugar** (`src/index.ts` → `src/entradas/local.ts`), então o
  apoio de E2E de `007` e `008` (`e2e/servidores-locais.ts`) e a `010` passam a
  apontar para o novo caminho, sem mudança de comportamento.
- **Nada mais muda**: nenhuma tela, rota, regra de domínio ou coluna planejada
  por `007` e `008` é tocada por esta feature.

## Validação, Erros e Segurança

- **Duas camadas, como antes**: a **forma** continua validada na borda, com Zod,
  em `backend/src/http/rotas.ts`; as **regras de domínio** continuam nos Modules
  `Acervo` e `Identidade`, que agora dependem **apenas** da Porta (FR-100). A
  fronteira é a mesma; só o que havia atrás dela mudou de lugar.
- **Desfechos, nunca exceções**: as recusas de domínio continuam sendo resultados
  previstos com código estável e mensagem em português; as recusas do
  armazenamento chegam pela Porta como código tipado. Exceção fica reservada ao
  que é erro de programação.
- **Contrato HTTP inalterado**: 201, 200, 204, 400, 404 e 409 continuam exatamente
  como `001` a `006` os definiram; o único acréscimo é o 503 de
  `indisponivel`, que não é um contrato novo — é a falha de armazenamento que
  FR-044 e FR-107 exigem reportar —, e o Adapter do cliente já o trata como
  `indisponivel`. Nenhuma tela, campo ou ação nova (FR-105, SC-038).
- **Sem vazamento em falha**: a resposta de falha traz o código e a mensagem do
  Module, nunca texto do driver, caminho de arquivo, cadeia de conexão ou
  endereço com credencial (FR-108).
- **Log**: o logger do Fastify continua desabilitado; nada do parâmetro de
  construção, do caminho do arquivo ou de qualquer valor sensível é registrado.
- **Segredo**: esta feature não introduz segredo. Ela **prepara** o tratamento —
  a recusa nunca repete o valor informado, e o início nomeia apenas o tipo —, o
  que é o que a `010` precisará para a URL de conexão (FR-108, SC-042).
- **Loopback**: `assegurarEscutaLocal` continua valendo sem alteração; hospedagem
  em nuvem é assunto posterior a estas features.

## Estratégia de Testes

A Interface é a superfície de teste.

- **Bateria da Porta** (`tests/armazenamento/bateria-da-porta.ts`): os cenários da
  Porta contra a fábrica de Adapter recebida, sem nomear armazenamento algum.
- **Adapter do armazenamento local** (`tests/armazenamento/sqlite.test.ts`): a
  bateria inteira, em memória e em arquivo temporário, exigindo cem por cento de
  aprovação (FR-106, SC-039); e a persistência entre duas aberturas do mesmo
  arquivo, com o mesmo conteúdo (FR-104, SC-041).
- **Suíte existente de `001` a `006`**: adaptada **mecanicamente** — o Adapter
  local em memória no lugar do banco aberto à mão, e `await` em cada chamada —,
  com as asserções intactas, o que é a medida de SC-038 e FR-105.
- **Migrações**: as suítes atuais continuam provando ordem, não reaplicação,
  falha sem estado parcial e adoção de arquivo legado; um caso novo abre um
  arquivo criado **antes** desta feature e exige que ele continue na mesma versão
  e com os mesmos dados (FR-103, FR-104).
- **Dependências dos Modules** (`tests/armazenamento/dependencias.test.ts`): lê os
  fontes de `src/acervo/`, `src/identidade/` e `src/http/` e exige que nenhum
  importe `node:sqlite`, driver de PostgreSQL ou diretório de Adapter (FR-100,
  SC-043).
- **Construção** (`tests/armazenamento/construcao.test.ts`): executa
  `scripts/construir.mjs` e exige que a construção sem parâmetro, com valor não
  aceito e com valor com aparência de credencial saia com código 1, com mensagem
  em português que nomeie os valores aceitos, **sem repetir o valor informado** e
  **sem produzir artefato**; e que a construção com o armazenamento local produza
  `dist/sqlite/servidor.mjs` **sem** o Adapter do outro armazenamento nem o seu
  driver (FR-102, FR-108, FR-120, SC-040).
- **Início**: subir a entrada e ler a primeira linha, exigindo o tipo de
  armazenamento e a ausência de caminho, URL, senha e cadeia de conexão
  (FR-108, SC-042); com o arquivo indisponível — diretório somente leitura —, o
  início falha reportado e a aplicação não segue (FR-044, FR-045).
- **Contrato HTTP e frontend**: as suítes de contrato e as suítes do frontend não
  mudam de significado; o frontend não é tocado (FR-105, SC-038). E2E continua
  contra servidores reais, com `e2e/servidores-locais.ts` apontando para
  `src/entradas/local.ts`.

Comandos: `npm test`, `npm run typecheck` e `npm run lint` em `backend/`;
`npm run build:local` no backend; `npm test`, `npm run build` e `npm run lint` no
`frontend/` — inalterados; `npm run test:e2e` na raiz.

## Project Structure

Um diretório novo no backend, um pacote de Adapter, um script de construção e a
raiz de composição; o resto é movido ou cresce dentro do que existe.

```text
backend/
├── package.json               # typecheck, build (--banco), build:local, start:local, dev
├── scripts/
│   └── construir.mjs          # novo: escolhe a entrada e empacota dist/<banco>/servidor.mjs
├── src/
│   ├── armazenamento/
│   │   ├── porta.ts           # nova: ArmazenamentoDoAcervo, desfechos tipados e as formas armazenadas
│   │   └── sqlite/            # novo Adapter do armazenamento local
│   │       ├── armazenamento.ts   # abrirArmazenamentoSqlite + as operações da Porta
│   │       ├── esquema.ts         # movido de src/acervo/esquema.ts, conteúdo inalterado
│   │       └── migracoes.ts       # movido de src/acervo/migracoes.ts, versões inalteradas
│   ├── acervo/                # Interface assíncrona e regras; nenhum SQL, nenhum import de driver
│   │   ├── acervo.ts
│   │   └── invariantes.ts
│   ├── identidade/            # criado por 007-criar-usuario; já sujeito ao mesmo teste de dependências
│   ├── http/                  # rotas e servidor: `await` no Acervo, forma inalterada
│   │   ├── rotas.ts
│   │   └── servidor.ts
│   └── entradas/
│       └── local.ts           # nova raiz de composição (substitui src/index.ts)
└── tests/
    ├── armazenamento/
    │   ├── bateria-da-porta.ts    # nova: cenários da Porta, parametrizados pela fábrica de Adapter
    │   ├── sqlite.test.ts         # nova: a bateria contra o Adapter local
    │   ├── dependencias.test.ts   # nova: nenhum Module importa armazenamento concreto
    │   └── construcao.test.ts     # nova: parâmetro de construção e conteúdo do pacote
    ├── acervo/                    # existentes: Adapter local + `await`, mesmas asserções
    └── http/                      # existentes: `await`, mesmas respostas

e2e/                             # passa a apontar para src/entradas/local.ts
frontend/                        # intocado
```

**Structure Decision**: a divisão continua por Module e Seam, e não por camada: o
diretório `armazenamento/` contém a **Porta** e os **Adapters**, e não existe
pasta de `repositories`, `models` ou `services`. O domínio (`acervo/`,
`identidade/`) permanece ao lado do HTTP, e a única costura entre os dois é a
Porta.

## Riscos, Alternativas e Custo de Reversão

| Decisão | Risco | Alternativa rejeitada | Custo de reversão |
|---|---|---|---|
| Porta com operações de domínio | Alguém pode querer acrescentar uma consulta livre ao longo do tempo | Executor genérico (`executar(sql)`), que faria SQL atravessar o domínio e manteria o dialeto nos Modules (FR-100) | Baixo: a Interface é a superfície única, e a bateria a fixa |
| Interface do `Acervo` assíncrona | Todo chamador passa a aguardar, e as suítes existentes mudam mecanicamente | Manter síncrono com `node:sqlite`, o que exigiria dois caminhos de código para o driver assíncrono de PostgreSQL | Médio: a Interface muda em todos os callers, mas o contrato HTTP não (FR-105) |
| Reversão da decisão de `001` | Uma indireção a mais no acervo | Manter a Seam interna e ramificar por driver na `010` | Baixo: com um Adapter só, a Porta volta a ser um detalhe interno do `Acervo` |
| Adapter dono do esquema e das migrações | Duplicação de DDL por dialeto | Aplicador único de migrações com SQL portável, que nenhum dos dois dialetos aceita | Baixo: a lista ordenada é a mesma; só o DDL difere |
| Uma bateria parametrizada pela fábrica de Adapter | O cenário precisa caber nos dois bancos, sem truque de dialeto | Uma bateria por Adapter, que duplicaria cenário e deixaria a Porta provada duas vezes | Baixo: os cenários são de Interface |
| `esbuild` como devDependency nova | Mais um artefato de build no repositório | `tsc` emitindo um pacote único, que não escolhe a entrada nem exclui o Adapter alheio do pacote (FR-120) | Baixo: um script e uma devDependency |
| Pacote por banco, escolhido na construção | Construir para o outro armazenamento exige nova construção | Escolher em tempo de execução, o que faria o pacote carregar os dois Adapters e violaria FR-120 | Baixo |
| Linha de início com apenas o tipo de armazenamento | Menos informação em caso de dúvida operacional | Exibir o caminho do arquivo ou a URL, que numa nuvem é credencial (FR-108) | Baixo: uma linha de saída |

## Complexity Tracking

> Nenhuma violação da constituição a justificar.

**Nenhum** Module novo, **nenhuma** rota nova, **nenhuma** tabela ou coluna nova.
A Seam nova — a Porta — tem **dois Adapters justificados** (o local, nesta
feature, e o de PostgreSQL, na `010`) e é exigida por FR-100, FR-106 e FR-120; não
é indireção antecipada. A devDependency nova é exigida por FR-102 e FR-120: um
pacote que escolhe a entrada e exclui a outra não sai de `tsc` com um arquivo de
saída só. Nada além disso é antecipado: sem ORM, sem construtor de consultas, sem
conjunto de conexões, sem escolha de armazenamento em tempo de execução, sem
migração de dados entre armazenamentos e sem alteração de tela.
