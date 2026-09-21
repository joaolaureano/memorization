# Implementation Plan: Hospedagem na AWS

**Branch**: `011-hospedagem-aws` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Depende de**: `008-entrar` (a Credencial apresentada em cada requisição), de
`009-porta-de-persistencia` (a Porta, a bateria compartilhada, o parâmetro de
construção e a raiz de composição local) e de `010-postgresql-na-nuvem` (o
Adapter de PostgreSQL, a validação da URL de conexão, o comando de migração e a
conferência de versão do início) — tudo usado **sem alteração** —, e da
infraestrutura de OpenTofu já mesclada em `backend/terraform` (CloudFront, S3
privado, SSM Parameter Store, Function URL pública atrás do segredo de origem),
que é o **contrato de integração** desta feature. Nenhuma decisão anterior é
reaberta: esta feature **acrescenta a terceira raiz de composição** — a da função
da nuvem — e a liga à infraestrutura que já existe.

## Summary

Décima primeira feature, e a que transforma a capacidade de AWS já mesclada numa
aplicação **publicada**: a API deixa de ser a stub e passa a rodar como a função
da AWS atrás do CloudFront, gravando no PostgreSQL, com os segredos vindos do
cofre e a porta fechada por um segredo de origem.

O escopo é operacional: **nenhuma tela, rota, campo, ação ou regra de domínio
nova**, e **nenhum Module alterado**. O que nasce é uma raiz de composição, uma
Seam, uma guarda de borda, um alvo de empacotamento, um script de frontend, duas
mudanças de infraestrutura e um manual:

- a entrada `backend/src/entradas/lambda.ts` exporta `handler` — payload v2 /
  function URL — e monta a aplicação **uma vez por contêiner**, com a promise de
  inicialização guardada **fora** do handler e **descartada na falha**: a
  requisição seguinte tenta de novo (FR-122, FR-126, SC-051, SC-054). Ela
  **nunca** chama `listen`, e a garantia de escuta exclusiva no loopback da
  execução local permanece intacta (FR-122);
- a Seam `LeitorDeSegredos` tem dois Adapters reais — o do SSM
  (`GetParameters`, `WithDecryption`, sob `${SSM_PREFIX}`) e o de memória, usado
  pelos testes —, e é ela que torna a inicialização verificável **sem publicar na
  AWS**: parâmetro ausente vira falha de inicialização com mensagem em português
  que **nomeia o parâmetro** e nunca o valor, e nenhum valor de segredo aparece
  na saída, no registro ou em resposta (FR-123, FR-133, SC-052, SC-060);
- a guarda do segredo de origem é o **primeiro** `onRequest` da aplicação da
  função: cabeçalho `x-origin-secret` conferido com `timingSafeEqual` depois da
  conferência de tamanho, e recusa **403 genérica** — indistinguível entre
  ausente e errado — antes do hook da Credencial, inclusive em `/health`
  (FR-125, SC-053);
- a função **reusa** a validação da URL de conexão, o Adapter de PostgreSQL com
  certificado verificado e a conferência de versão de `010` — e **não migra**:
  esquema atrasado é recusa de inicialização (FR-127, SC-055);
- em produção o CORS permissivo **não** é enviado, porque SPA e API dividem a
  origem do CloudFront; a execução local continua com ele como hoje (FR-128,
  SC-056);
- a construção ganha o alvo `--banco=lambda`, que produz `dist/lambda/lambda.mjs`
  e o zip `backend/dist-lambda.zip` — um único empacotamento, no caminho que a
  infraestrutura espera, **sem** o Adapter do armazenamento local —, e o frontend
  ganha `build:aws`, que aponta o endereço da API para `/api` (FR-129, FR-130,
  SC-057);
- a infraestrutura ganha o terceiro segredo (`SEGREDO_DAS_SENHAS`, com
  `random_password` de 64 caracteres) no mesmo prefixo, e a memória da função
  sobe para 1024 MB por variável, porque o scrypt roda em **cada** requisição: o
  custo da Credencial é o custo da feature (FR-124, FR-131, FR-132, SC-059);
- o manual de operação — segredos e valores, migração no endpoint **direto**,
  construção do pacote, aplicação e publicação do SPA — fica em
  [`quickstart.md`](./quickstart.md), e é a ordem que as implantações seguem
  (FR-134, SC-061).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 24+ — nada muda no
desenvolvimento. Na nuvem, o código roda empacotado no runtime **`nodejs24.x`**
(arm64), que é o mesmo major da máquina de desenvolvimento e o que traz o SDK da
AWS v3 embutido.

**Primary Dependencies**: Fastify, Zod, `pg` e o `node:crypto` de `001` a `010`,
**não reabertos**. **Novas nesta feature**: `@fastify/aws-lambda` como
**dependência de execução** — é o Adapter que traduz o evento da Function URL
(payload v2) em requisição e a resposta em payload, e vai **dentro** do pacote —
e `@aws-sdk/client-ssm` como **devDependency**, porque o SDK é fornecido pelo
runtime e por isso é **externo** no empacotamento: só os tipos e os testes de
desenvolvimento precisam dele (Decisões 1, 3 e 9 de
[research.md](./research.md)).

**Storage**: PostgreSQL no Neon, atrás da Porta `ArmazenamentoDoAcervo` de `009`,
pelo Adapter de `010` — **nenhuma tabela, coluna ou migração nova**. Os segredos
são o "dado" desta feature, e vivem no parameter store sob `${SSM_PREFIX}`
([`data-model.md`](./data-model.md)). O armazenamento local continua intocado, e a
migração do esquema continua sendo feita **apenas** pelo comando da nuvem de
`010`, pelo operador.

**Testing**: Vitest, já de `001`. O `handler` exportado é exercitado **localmente
com eventos sintéticos** de Function URL (payload v2) contra o **PostgreSQL real
com TLS** do apoio de teste de `010` e com o Adapter de segredos **em memória**
(FR-133, SC-060): 403 sem o segredo de origem, 200 em `/health` com ele, 401 sem
Credencial, uma ida e volta de acervo autenticada, inicialização que falha e é
**retentada**, ausência de cabeçalho de CORS e ausência de valor de segredo na
saída e nas respostas. As conferências da infraestrutura são `tofu fmt -check` e
`tofu validate` (depois de `tofu init -backend=false`) — sem `apply`.

**Target Platform**: AWS — CloudFront servindo o SPA de um S3 privado e a API sob
`/api/*` com o prefixo removido na borda, `/health` roteado para a API, função com
Function URL pública protegida pelo segredo de origem, runtime `nodejs24.x`,
`arm64`, **1024 MB** e timeout de 30 s, sem VPC. Banco no Neon PostgreSQL. A
execução local continua escutando **apenas** no loopback.

**Project Type**: Aplicação web com frontend e API separados, dois deployables; o
backend passa a ter **um pacote por armazenamento**, mais o da função:
`dist/sqlite/servidor.mjs`, `dist/postgresql/servidor.mjs` +
`dist/postgresql/migrar.mjs` e `dist/lambda/lambda.mjs` — este último publicado
como o zip `backend/dist-lambda.zip`.

**Performance Goals**: **SC-059** — percentil 95 das operações simples (a
verificação da Senha em cada requisição, com scrypt de `N=32768`, `r=8`, `p=1`)
**abaixo de 1 segundo**, medido **na função** e não na execução local. A meta é
medida depois da publicação, pelo endereço do CloudFront, e o remédio documentado
é elevar a memória da função — nunca enfraquecer o hash (FR-132).

**Constraints**: nenhum segredo versionado, exibido, registrado ou devolvido — nem
em resposta de recusa, nem quando a leitura do cofre falhar; a função **não**
escuta porto algum e **não** migra o esquema; em produção **nenhum** cabeçalho
permissivo de outra origem; **nenhuma** sessão, cookie ou token (FR-079); a
verificação é local e **não** exige publicar na AWS — o `apply` é ação do operador
(FR-133).

**Scale/Scope**: 17 requisitos funcionais (FR-044, FR-045, FR-078 e FR-079
reutilizados; FR-122 a FR-134 específicos), 11 critérios de sucesso (SC-051 a
SC-061), 3 histórias, **nenhuma** tela, rota, tabela ou coluna nova, 1 entrada de
composição, 1 Seam com 2 Implementations, 1 guarda de borda, 1 alvo de
empacotamento, 1 script de frontend, 1 segredo e 1 variável de infraestrutura
novos, e **nenhum** Module alterado.

## Constitution Check

*GATE: antes da Phase 0 e revisto após a Phase 1.*

| Princípio | Veredito |
|---|---|
| I — Spec-Driven | **PASS**. Deriva apenas de `spec.md` desta feature; as decisões de desenho estão em `research.md` e nos contratos. Nada de `012` em diante é antecipado — as funcionalidades adiadas (domínio próprio, certificado, firewall, bloqueio por tentativas, encadeamento automático, múltiplos ambientes) ficam de fora, e a automação do projeto no Neon não é retomada |
| II — Auditabilidade | **PASS**. Cada worker é registrado em `SESSION.md` com banner SPEC KIT. O que se registra de falha de nuvem é a **mensagem em português que nomeia o parâmetro** — o nome, nunca o valor —, e a inicialização recusada nunca imprime valor de segredo (FR-123) |
| III — Domínio antes de tecnologia | **PASS**. O vocabulário é o de `CONTEXT.md` e o da spec: Função da nuvem, Segredo de origem, Cofre de segredos, SPA publicado, Pacote da função, Credencial, Senha, Manual de operação. `handler`, `lambda`, `SSM`, `CloudFront` e `zip` nomeiam **contrato de integração** da infraestrutura já mesclada, e não entidades do domínio — nenhum deles nomeia Module, Porta ou regra |
| IV — Módulos profundos | **PASS**. Nenhum Module novo e nenhum alterado. A Seam `LeitorDeSegredos` é aberta com **duas** Implementations reais (SSM e memória) e esconde a leitura, os nomes, a decifragem e o tratamento de parâmetro ausente atrás de uma operação |
| V — Interface é a superfície de teste | **PASS**. O que os testes exercitam é a Interface: `criarFuncao(leitor).handler` com eventos sintéticos, `criarServidor(identidade, opções)` com e sem a política permissiva, o `LeitorDeSegredos`, e o script de construção **executado** — nunca um detalhe interno |
| VI — Verificação sobre afirmação | **PASS**. Os 403, o 200 de `/health`, o 401, a ida e volta autenticada, a inicialização retentada, a ausência de CORS e a ausência de segredo são **testes**, contra o PostgreSQL real com TLS do apoio de `010`, e não promessas (FR-133, SC-060) |
| VII — Escopo mínimo | **PASS**. Complexity Tracking justificado abaixo: duas dependências e duas mudanças de infraestrutura, cada uma exigida por um requisito. Sem sessão, sem cookie, sem token, sem firewall de aplicação, sem limitação de taxa, sem múltiplos ambientes, sem encadeamento automático de implantação |
| VIII — Segredos fora do repositório | **PASS**, e é o Princípio que a feature serve de perto. Os três segredos vivem no parameter store (`SecureString`, write-only), e **nenhum valor** aparece em arquivo versionado, na saída, no registro ou em resposta; a função os lê no início a frio e nunca os coloca em variável de ambiente. Os testes **geram** os valores por execução, e os manuais usam apenas a forma de espaço reservado (FR-123, SC-052) |
| IX — Rastreabilidade | **PASS condicionado**. A matriz requisito–teste é produzida em `tasks.md` |
| X — Portões de qualidade | **PASS até aqui**. Os portões passam a ser `npm test` (que inclui o handler com eventos sintéticos e o conteúdo do pacote da função), `npm run typecheck`, `npm run lint` e `npm run build:lambda` no backend; `npm run build:aws` no frontend; `tofu fmt -check` e `tofu validate` em `backend/terraform`; `analyze` é executado ao final desta etapa |
| XI — Delegação de código | **PASS**. Todo código em `backend/`, `frontend/` e `backend/terraform/` será escrito por workers DeepSeek, inclusive o apoio de teste do handler |

**Processos removidos**: ADRs e Design It Twice não se aplicam, pela constituição
2.1.0. **Nenhuma emenda é necessária**: o Princípio VIII é cumprido com rigor novo
— três segredos num cofre, lidos por uma Seam —, e nenhum princípio é relaxado
para acomodar a nuvem.

### Re-avaliação após Phase 1

**PASS, sem alteração.** O desenho confirmou as decisões:

- a função é uma **terceira raiz de composição**, ao lado da local e da da nuvem:
  é ela que importa o Adapter de `010`, e nenhum Module passa a conhecer SSM,
  CloudFront, Lambda ou o segredo de origem;
- a inicialização memorizada **e descartada na falha** é o que faz FR-126 e SC-054
  valerem: guardar a promise fora do handler é o caminho barato (o custo de
  `GetParameters` e do aperto de mão TLS é pago uma vez por contêiner), e
  descartá-la na falha é o que impede um contêiner envenenado de herdar o erro
  para sempre;
- a guarda do segredo de origem ser o **primeiro** `onRequest` é o que dá sentido
  a FR-125: a requisição que não veio do CloudFront é recusada antes de qualquer
  trabalho de Credencial, e a recusa é indistinguível entre segredo ausente e
  segredo errado (SC-053);
- a política permissiva de outra origem ser uma **opção** de `criarServidor` — e
  não um caminho de código novo — mantém a execução local exatamente como hoje e
  não cria dois servidores (FR-128, SC-056);
- o alvo `--banco=lambda` **preserva o contrato de construção de `009`**: um
  único argumento, uma lista de valores derivada da tabela e a exclusividade por
  grafo — o pacote da função não contém o Adapter do armazenamento local nem
  `node:sqlite`, e o pacote local não contém a entrada da função (FR-130);
- a memória de 1024 MB é **consequência medida** de a Credencial ser verificada em
  cada requisição, e é uma variável — elevar de novo é trocar um número, e
  enfraquecer o hash **não** é remédio (FR-132).

## Decisões de Codebase Design

Vocabulário conforme `.agents/skills/codebase-design/SKILL.md`, usado
literalmente.

### A entrada da função — a terceira raiz de composição

`backend/src/entradas/lambda.ts` é a raiz de composição da nuvem **serverless**,
ao lado de `local.ts` (`009`) e `nuvem.ts` (`010`). Ela é a única coisa da
aplicação que:

- lê o cofre de segredos, pelo Adapter de SSM da Seam `LeitorDeSegredos`;
- monta a aplicação **sem** `iniciarServidor`: `criarServidor` mais as rotas, sem
  `listen` em nenhum caminho (FR-122);
- liga a guarda do segredo de origem e desliga a política permissiva de outra
  origem (FR-125, FR-128);
- exporta o `handler` que a infraestrutura invoca (`lambda_handler =
  "lambda.handler"`, payload v2 / function URL).

| Entrada | Armazenamento | Onde escuta | Onde roda | Segredos |
|---|---|---|---|---|
| `src/entradas/local.ts` (`009`) | SQLite por arquivo | Loopback, com `assegurarEscutaLocal` | Máquina de quem desenvolve | `SEGREDO_DAS_SENHAS` do ambiente |
| `src/entradas/nuvem.ts` (`010`) | PostgreSQL (Neon) | Loopback, com `assegurarEscutaLocal` | Execução operacional de nuvem | `SEGREDO_DAS_SENHAS` e `DB_URL` do ambiente |
| `src/entradas/lambda.ts` (**esta feature**) | PostgreSQL (Neon) | **Nenhum porto** | Função da AWS atrás do CloudFront | Os três, do parameter store |

A entrada é **fina**: ela monta o `LeitorDeSegredos` a partir de `SSM_PREFIX` e
entrega a Seam à fábrica da função. Toda a regra — ordem da inicialização, cache
descartável, guarda de borda, composição do servidor — vive em
`backend/src/funcao/`, que é a Interface que os testes exercitam. É o mesmo
desenho de `009` e `010`: a entrada é o processo, e a Implementation testável fica
ao lado.

```text
backend/src/funcao/funcao.ts    criarFuncao(leitor, opcoes?) -> { handler }
backend/src/funcao/segredos.ts  a Seam LeitorDeSegredos, SegredosDaFuncao, ParametroAusenteError
backend/src/funcao/ssm.ts       o Adapter de SSM: GetParameters, WithDecryption, sob ${SSM_PREFIX}
backend/src/http/origem.ts      a guarda do segredo de origem: 403 genérico, tempo constante
backend/src/entradas/lambda.ts  a entrada: SSM + criarFuncao; exporta handler
```

### A inicialização memorizada e descartável

O custo do início a frio — `GetParameters` mais o aperto de mão TLS com o Neon —
é pago **uma vez por contêiner**, e não a cada requisição. A fábrica guarda uma
**promise** de inicialização fora do handler:

```text
pronto == null  →  pronto = inicializar().catch(erro => { pronto = null; throw erro })
pronto != null  →  a aplicação já montada é reaproveitada
```

O `catch` é o coração de FR-126 e de SC-054: quando a inicialização falha — por
segredo ausente, parâmetro ilegível, banco inalcançável ou esquema atrasado —, a
requisição que a provocou é respondida como falha (`503`, corpo genérico em
português, sem motivo, sem nome de parâmetro e sem texto de driver) e a promise é
**descartada**. A requisição seguinte tenta a inicialização **de novo**, sem
herdar o resultado falho: uma falha persistente falha em todas as requisições
enquanto durar a causa, e a aplicação **nunca** passa por pronta. O padrão é o
mesmo que a stub da infraestrutura já usa para o segredo de origem, e é o que a
infraestrutura validou em campo.

Ordem da inicialização, com o desfecho de cada etapa:

| # | Etapa | Falha |
|---|---|---|
| 1 | `leitor.ler()`: os três segredos do cofre (FR-123) | `503` genérico; a mensagem de inicialização nomeia o **parâmetro** e nunca o valor |
| 2 | `segredoConfigurado` de `007`, com o valor vindo do cofre | `503` genérico; a mensagem nomeia a variável e a regra (FR-077) |
| 3 | `configuracaoDaConexao` de `010` sobre a URL do cofre | `503` genérico; recusa nomeia `DB_URL` e nada do valor |
| 4 | Conferência de versão do esquema, **sem migrar** (FR-127) | `503` genérico; a mensagem nomeia as duas versões e manda migrar |
| 5 | `abrirArmazenamentoPostgresql` de `010` | `503` genérico; mensagem genérica mais o SQLSTATE quando houver |
| 6 | `criarServidor` com a guarda e sem CORS, rotas registradas, `servidor.ready()` | `503` genérico |

O passo 4 usa a lista de migrações conhecida pelo binário como versão corrente —
exatamente como `nuvem.ts` —, de modo que a conferência continua valendo quando o
esquema evoluir. A função **nunca** chama `aplicarMigracoes`: quem migra é o
operador, com `npm run migrate:cloud` (`010`), e é isso que FR-127 e SC-055
medem.

### `LeitorDeSegredos` — a Seam dos segredos, com dois Adapters reais

```text
interface SegredosDaFuncao {
  readonly urlDeConexao: string;
  readonly segredoDeOrigem: string;
  readonly segredoSenhas: string;
}

interface LeitorDeSegredos {
  ler(): Promise<SegredosDaFuncao>;
}
```

Duas Implementations, e as duas são reais:

| Implementation | Onde vive | O que faz |
|---|---|---|
| `leitorDeSegredosDoSsm(prefixo, cliente?)` | `src/funcao/ssm.ts` | Uma chamada `GetParameters` com os **três** nomes e `WithDecryption: true`: `${SSM_PREFIX}/DB_URL`, `${SSM_PREFIX}/ORIGIN_SECRET`, `${SSM_PREFIX}/SEGREDO_DAS_SENHAS` |
| `leitorDeSegredosEmMemoria(segredos)` | `tests/funcao/segredos-em-memoria.ts` | Devolve os valores informados pelo cenário, ou falha com `ParametroAusenteError` nomeando o parâmetro |

Uma chamada só, com os três nomes, é uma ida ao SSM por contêiner, e não três —
o que importa no início a frio. Qualquer nome que não venha, ou que venha vazio,
vira `ParametroAusenteError` com mensagem em português que **nomeia o parâmetro**
(e nada do valor); a mensagem do SDK **nunca** é propagada, porque ela pode
carregar detalhes que não são nossos.

A Seam existe porque é ela que torna FR-126 e SC-060 verificáveis **sem publicar
na AWS**: o teste troca SSM por memória, aponta a URL para o PostgreSQL real do
apoio de teste e exerce o handler de verdade. A `SSMClient` entra por parâmetro,
com padrão `new SSMClient({})` — o mesmo padrão da stub —, de modo que o Adapter
de SSM também é exercitado com um cliente de mentira, conferindo os nomes, a
decifragem e o desfecho de parâmetro ausente.

**Nunca em variável de ambiente da função**: a URL de conexão carrega a senha do
banco, e variável de ambiente de função é legível por quem descreva a função. Os
únicos valores em ambiente são `SSM_PREFIX` e `NODE_ENV`, que a infraestrutura já
define.

### O segredo de origem — a guarda registrada antes da Credencial

`backend/src/http/origem.ts` declara `exigirSegredoDeOrigem(servidor, esperado)`,
e `criarServidor` a registra **antes** de `exigirCredencial` quando a opção
`segredoDeOrigem` é informada. É o **primeiro** `onRequest` da aplicação da
função:

1. o cabeçalho `x-origin-secret` é lido (as chaves chegam em minúsculas pela
   Function URL; valor que não seja texto — cabeçalho repetido — conta como
   ausente, e nada lança);
2. o **tamanho** é conferido antes do conteúdo, porque `timingSafeEqual` lança com
   buffers de tamanhos diferentes;
3. a comparação é feita com `timingSafeEqual`, em tempo constante;
4. qualquer desfecho que não seja igualdade exata — ausente, curto, longo, errado
   — responde **`403`** com o **mesmo** corpo genérico, sem motivo, sem
   `WWW-Authenticate` e sem `Set-Cookie`.

O corpo é o mesmo que a stub já devolve — `{"sucesso":false,"mensagem":"Proibido"}`
—, de modo que o comportamento validado em campo não muda. A recusa é
**indistinguível** entre segredo ausente e segredo errado, inclusive no tempo de
resposta (FR-125, SC-053), e `/health` também a exige: tudo chega pelo CloudFront,
inclusive a prova de vida.

A guarda **não** substitui a Credencial e não é Credencial: ela responde "de onde
veio", e não "quem é". Quem chama a Function URL direto é recusado antes de
qualquer verificação de Senha — o que também mantém o caminho barato fora do
alcance do público.

Mensagem e contrato completos em
[`contracts/funcao-da-nuvem.md`](./contracts/funcao-da-nuvem.md).

### CORS: uma opção em `criarServidor`, dois veredictos

`criarServidor` ganha um segundo parâmetro, opcional:

```text
criarServidor(identidade, {
  politicaDeOutraOrigem?: boolean,   // padrão: true — a execução local de hoje
  segredoDeOrigem?: string,          // ausente: sem guarda de origem
})
```

Com `politicaDeOutraOrigem: false`, o servidor **não** registra o pré-voo de CORS
e o hook de `onSend` **não** acrescenta `access-control-allow-origin`: nenhuma
resposta de produção traz cabeçalho permissivo, e não há caminho de código que o
acrescente depois (FR-128, SC-056). O padrão preserva a execução local
**sem uma linha de edição** nas entradas de `009` e `010`, que continuam
permissivas — e continuam corretas, porque escutam apenas no loopback.

A função é a **única** entrada que desliga a política: é ela que responde na
mesma origem do CloudFront, onde o navegador não faz pré-voo. `nuvem.ts` continua
permissiva porque não é origem do CloudFront — ela escuta apenas no loopback, como
`local.ts` —, e o pré-voo de outra origem continua sendo o que faz o frontend de
desenvolvimento funcionar.

### A guarda de origem pertence ao Adapter HTTP, e não ao domínio

Ela é uma Implementation do Adapter HTTP (`src/http/origem.ts`), e as três
alternativas foram rejeitadas em [research.md](./research.md) (Decisão 4): registrar
a guarda **depois** de `criarServidor` inverteria a ordem e faria a recusa por
Credencial vir antes da recusa por origem; inspecionar o evento antes de entregá-lo
ao Adapter do evento criaria uma **segunda** leitura da carga, fora do contrato da
Function URL; e confiar apenas no CloudFront deixaria a URL pública da função
aberta, que é exatamente o que a stub provou ser preciso fechar.

### Empacotamento: `--banco=lambda`, o zip no caminho que a infraestrutura espera

A tabela de entradas de `backend/scripts/construir.mjs` (de `009`) ganha uma
terceira linha:

| Armazenamento | Entradas empacotadas | Pacotes |
|---|---|---|
| `sqlite` | `src/entradas/local.ts` | `dist/sqlite/servidor.mjs` |
| `postgresql` | `src/entradas/nuvem.ts`, `src/entradas/migrar-nuvem.ts` | `dist/postgresql/servidor.mjs`, `dist/postgresql/migrar.mjs` |
| `lambda` | `src/entradas/lambda.ts` | `dist/lambda/lambda.mjs` **e** `dist-lambda.zip` |

**O parâmetro continua sendo um só**: `--banco=lambda`. A alternativa
`--banco=postgresql --alvo=lambda` foi rejeitada porque quebraria o contrato de
`009` em três pontos ao mesmo tempo — a forma aceita é *exatamente* `--banco=<valor>`,
o número de argumentos é *exatamente* um, e a lista de aceitos é **derivada** da
tabela. Com um segundo parâmetro, a validação passaria a ter dois eixos, a recusa
antes de qualquer escrita deixaria de ser uma leitura simples, e a mensagem
`... com um dos valores aceitos: sqlite, postgresql` deixaria de ser derivada. Com
o terceiro valor, a lista passa a `sqlite, postgresql, lambda` por consequência, e
a exclusividade por grafo — que é o que FR-130 mede — continua sendo **consequência**
do empacotamento, e não limpeza posterior: o pacote local não contém a entrada da
função; o da função não contém o Adapter do armazenamento local nem `node:sqlite`.

Detalhes do empacotamento da função:

| Aspecto | Regra |
|---|---|
| Saída | `dist/lambda/lambda.mjs` — um único arquivo ESM |
| Plataforma e alvo | `--platform=node --target=node24 --format=esm`, com o banner de `createRequire` de `009` (as dependências em CJS pedem `require`) |
| Externos | `node:*`, `pg-native` (a opcional do `pg` que nunca é usada) e **`@aws-sdk/*`** — o SDK v3 é fornecido pelo runtime `nodejs24.x` |
| Zip | `backend/dist-lambda.zip`, com `lambda.mjs` na **raiz** do arquivo, feito pela ferramenta `zip` da máquina (o handler da infraestrutura é `lambda.handler`, que exige o arquivo `lambda.mjs` na raiz) |
| Falha | Código de saída `1`, mensagem genérica em português, e **nenhum** artefato parcial: o diretório `dist/lambda` e o zip são removidos |
| Segredo | A construção **não** lê nem exige segredo algum: empacotar é ler código |

Scripts:

| Script | Comando | O que é |
|---|---|---|
| `build:lambda` (backend) | `node scripts/construir.mjs --banco=lambda` | O pacote da função e o zip |
| `build:aws` (frontend) | `VITE_ENDERECO_DA_API=/api npm run build` | O SPA de produção apontando a API para `/api` |
| `scripts/build-lambda.sh` (infra) | uma **chamada fina** a `npm run build:lambda` em `backend/` | O caminho que a infraestrutura já documenta; deixa de ter esbuild próprio, e passa a existir só para quem lê o README de infraestrutura |

`dist-lambda*` entra no `.gitignore` **versionado** da raiz: o item `0.8` de
[`aws_pendencias.md`](../../aws_pendencias.md), que era ignorado só localmente,
deixa de ser pendência. Contrato completo em
[`contracts/pacotes-e-operacao.md`](./contracts/pacotes-e-operacao.md).

### A infraestrutura: o terceiro segredo e a memória de 1024 MB

Duas mudanças, e nada além delas:

| Onde | Mudança | Por quê |
|---|---|---|
| `ssm.tf` | `random_password.segredo_das_senhas` (`length = 64`, `special = false`) e a chave `SEGREDO_DAS_SENHAS` em `local.secrets`, ao lado de `DB_URL` e `ORIGIN_SECRET` | FR-124: os **três** segredos que a função lê existem no cofre, sob o mesmo prefixo. O acesso já está resolvido: a policy `lambda_read_secrets` é montada a partir do mapa de parâmetros (`[for p in aws_ssm_parameter.secret : p.arn]`), de modo que o terceiro parâmetro entra na política **sem** uma linha de IAM nova |
| `variables.tf` + `lambda.tf` | variável `lambda_memory_mb`, padrão **1024**, aplicada a `memory_size` | FR-132: o scrypt roda em **cada** requisição autenticada (a Credencial é apresentada sempre — não há sessão, FR-079, FR-131), e a Lambda troca memória por CPU |

O resto fica como está: runtime `nodejs24.x`, `arm64`, timeout de 30 s, sem VPC,
Function URL `NONE` com o segredo de origem como porta, `/api/*` com o prefixo
removido na borda, `/health` roteado para a função, S3 privado, retenção de log de
14 dias. Os segredos continuam **write-only** (`value_wo`): trocar um valor exige
incrementar `secrets_version`, como o README de infraestrutura já documenta, e
`ORIGIN_SECRET` continua sendo regerado com
`-replace=random_password.origin_secret`.

Conferências da infraestrutura (FR-133, SC-060), sem `apply` e sem credenciais AWS:

```bash
cd backend/terraform && tofu fmt -check
cd backend/terraform && tofu init -backend=false && tofu validate
```

### Desempenho: o que a Credencial custa em cada requisição

Não há sessão, cookie nem token (FR-079): **toda** requisição autenticada
apresenta a Credencial, e toda verificação de Senha passa por `HMAC-SHA256` mais
`scrypt` com `N=32768`, `r=8`, `p=1` e `maxmem` de 64 MiB — os parâmetros de
`007`, gravados junto do hash e **não** reabertos. Numa função de 512 MB o
percentil 95 das operações simples fica em risco, e é por isso que a memória é
1024 MB (FR-132).

| Aspecto | Regra |
|---|---|
| Meta | **SC-059**: p95 das operações simples **abaixo de 1 s**, medido **na função**, pelo endereço do CloudFront |
| Como medir | Depois da publicação: uma sequência de requisições autenticadas simples (por exemplo `GET /api/cartoes`) pelo endereço da distribuição, com o p95 calculado sobre os tempos observados — e o `--since` do log da função para descartar os inícios a frio que distorcem a amostra |
| Remédio documentado | **Elevar a memória da função** (`lambda_memory_mb`), e nada mais |
| O que **não** é remédio | Enfraquecer o scrypt, guardar a Credencial verificada entre requisições (seria sessão, contra FR-079 e FR-131), ou reaproveitar o resultado da verificação num cabeçalho ou cookie |

### A verificação sem publicar na AWS

A publicação na AWS é ação do **operador** (FR-133), e a verificação automatizada
é local: o `handler` exportado é exercitado com eventos sintéticos de Function URL
(payload v2) contra o PostgreSQL **real** com TLS do apoio de teste de `010`, com
o `LeitorDeSegredos` em memória e o segredo de origem conhecido pelo cenário.

| Verificação | O que prova |
|---|---|
| Evento v2 sem `x-origin-secret` e evento v2 com segredo **errado** | `403` com o mesmo corpo, sem revelar o motivo (FR-125, SC-053) |
| `GET /health` com o segredo de origem | `200` com o estado da API, e **sem** credencial — a prova de vida atravessa o CloudFront (FR-122, SC-051) |
| `GET /cartoes` com o segredo e **sem** Credencial | `401` — a guarda de origem não substitui a Credencial (FR-131, SC-058) |
| Cadastro, entrada e ida e volta de Cartão, Baralho e Vínculo com a Credencial | A aplicação real grava no PostgreSQL e lê de volta, atrás da guarda (SC-051) |
| Resposta de qualquer cenário em modo de produção | **Nenhum** `access-control-*` (FR-128, SC-056); e o mesmo cenário com `criarServidor` padrão comprova que a execução local continua permissiva |
| Leitor que falha na primeira chamada e funciona na segunda | A primeira requisição responde `503`, a seguinte é atendida — inicialização que falhou **não** fica memorizada (FR-126, SC-054) |
| Leitor sem um dos parâmetros e com o esquema atrasado | A inicialização é recusada, a mensagem nomeia o parâmetro (nunca o valor) e a requisição responde `503`; a função **não** migra (FR-123, FR-127, SC-055) |
| Varredura da saída, do registro e das respostas, com os valores gerados pelo cenário | Nenhum valor de `DB_URL`, de senha, do segredo de origem ou do segredo das Senhas aparece (FR-123, FR-078, SC-052) |
| `npm run build:lambda` | `dist/lambda/lambda.mjs` e `dist-lambda.zip` existem, o zip tem `lambda.mjs` na raiz, o pacote **não** contém o Adapter do armazenamento local nem `node:sqlite`, e o SDK da AWS **não** está dentro do pacote (FR-130, SC-057) |
| `tofu fmt -check` e `tofu validate` | O código de infraestrutura passa por formato e validação (FR-133, SC-060) |

O que **não** é exigido da verificação automática: `tofu plan`, `tofu apply`, o
`aws s3 sync` do SPA e a medição do percentil 95 — os três primeiros exigem
credenciais AWS do operador, e a medição exige a função publicada (SC-059).

### O manual de operação

[`quickstart.md`](./quickstart.md) é o manual: a ordem de provisionamento que
FR-134 exige — segredos e valores, migração no endpoint **direto** do Neon,
construção do pacote, aplicação da infraestrutura e publicação do SPA —, seguida
da validação pelo endereço do CloudFront e das instruções de derrubada. Os
valores, quando aparecem, são sempre **formas de espaço reservado**: nenhum
endereço, senha ou conexão real em documento versionado.

### O fim de `aws_pendencias.md`

O inventário de pendências cumpriu o papel: ele foi o insumo das features `007` a
`011`, e quando esta feature terminar **nada** dele continua aberto como
pendência de código. O plano é **removê-lo** ao fim de `011`, movendo para o
manual de operação e para o README de infraestrutura apenas as notas que são do
operador e não de uma feature — derrubar a stack, trocar um segredo, o state local
e as restrições do usuário `robot`.

| Item de `aws_pendencias.md` | Desfecho |
|---|---|
| `0.1`, `0.3`, `0.4`, `0.7`, `0.8`, `0.9`, `0.10`, `0.11` | Conferências e decisões de infraestrutura: seguem valendo, e o que é operacional (destruir, state, lockfile) migra para o README de infraestrutura e para o manual |
| `0.2` (teste com o backend real) | Resolvido: o `apply` publicado passa a servir a aplicação real, e o handler é exercitado localmente contra o PostgreSQL real (FR-133) |
| `0.5` (credencial do Neon exposta) | Ação do operador, e continua no manual: rotacionar a senha no Neon e reaplicar com `secrets_version` incrementado |
| `0.6` (policy do robot) | Continua no manual: a policy inline é a fonte da verdade, e o `robot` só cria roles com a **permissions boundary** |
| `1` (autenticação pelo Google e cookie de sessão) | **Obsoleto**: a `008-entrar` entregou a Credencial apresentada em cada requisição, e não há sessão, cookie ou token (FR-079, FR-131) |
| `2` (PostgreSQL no Neon) | Resolvido por `009` e `010`: Porta, Adapter, migrações, `DB_URL` com TLS verificado, endpoint agrupado em execução e direto na migração |
| `3` (handler da Lambda) | **Resolvido por esta feature**: `handler` exportado, `@fastify/aws-lambda`, segredos antes da montagem, guarda do segredo de origem e cache descartável |
| `4` (escuta fora do loopback) | Resolvido: a função monta sem `listen`; a garantia de loopback fica só nas entradas que escutam (FR-122) |
| `5` (build e empacotamento) | **Resolvido por esta feature**: `--banco=lambda`, `lambda.mjs`, `dist-lambda.zip`, `@aws-sdk/*` e `pg-native` externos, `arm64` e `nodejs24.x` |
| `6` (CORS) | **Resolvido por esta feature**: a função não envia cabeçalho permissivo, e a execução local continua enviando (FR-128) |
| `7` (projeto no Neon pela CLI) | Adiado na spec: a automação da criação do projeto no Neon não é retomada aqui |
| `9` (roteamento por caminho no SPA) | Adiado na spec: o SPA continua roteando por `location.hash` |
| `10` (`SESSION_SECRET`) | **Obsoleto**: não há sessão; o terceiro segredo do cofre é o `SEGREDO_DAS_SENHAS` da `007`, provisionado por esta feature (FR-124) |

### Avaliação do desenho e da mudança

- **A Interface é menor que o que esconde?** Sim: `criarFuncao(leitor).handler` e
  `criarServidor(identidade, opções)` escondem a leitura do cofre, a ordem da
  inicialização, o cache descartável, a guarda de origem, a ausência de escuta e a
  ausência de CORS. Quem chama passa um leitor e recebe um handler.
- **Há Leverage real?** Sim: nenhum Module, rota ou tela foi tocado para colocar a
  aplicação atrás do CloudFront — a Credencial de `008`, a Porta de `009` e o
  Adapter de `010` atravessaram a mudança de lugar sem uma linha de alteração.
- **Há Locality?** Sim: trocar o provedor de segredos, o formato do evento, a
  origem do SPA ou a memória da função acontece inteiro em `src/funcao/`,
  `src/http/origem.ts` e `backend/terraform/`.
- **Teste de exclusão**: sem a fábrica, o teste do handler teria de subir SSM, AWS
  e um contêiner para verificar 403, 401, inicialização retentada e ausência de
  CORS — a complexidade reapareceria em cada cenário, e a verificação deixaria de
  ser local (FR-133).
- **Os testes usam a Interface?** Sim: `criarFuncao` com o leitor em memória, o
  `handler` com eventos sintéticos, `criarServidor` com e sem a opção, e o script
  de construção **executado**.
- **Há Seam especulativa?** Não: `LeitorDeSegredos` nasce com **duas**
  Implementations de verdade — o SSM, que roda em produção, e a memória, que roda
  nos testes —, e é o que permite verificar FR-126 e FR-123 sem publicar.

## Validação, Erros e Segurança

- **Forma na borda, regra no domínio**: nada disso muda. Zod continua validando a
  forma em `backend/src/http/rotas.ts`; as regras continuam nos Modules, que só
  conhecem a Porta. Esta feature não toca em nenhum dos dois.
- **Camada nova de configuração**: os três segredos entram **uma vez**, na
  inicialização, e descem prontos — a URL validada para o Adapter de `010`, o
  segredo das Senhas validado para o `Identidade`, o segredo de origem para a
  guarda de borda. Segredo ausente ou inválido é **recusa de inicialização**, e
  não erro de domínio (FR-123, FR-126).
- **Sem vazamento em falha**: nenhuma mensagem — de recusa de inicialização, de
  resposta de erro, de parâmetro ausente ou de falha do banco — traz valor de
  segredo, senha, URL com credencial ou texto do driver. Quando o banco falha, a
  resposta é genérica em português e a mensagem de processo acrescenta o **SQLSTATE**
  de `010` — um código, e não um valor.
- **403 indistinguível**: a recusa por segredo de origem não revela se o cabeçalho
  veio ausente, curto ou errado — mesmo corpo, mesmo código, comparação em tempo
  constante (FR-125, SC-053).
- **Resposta de inicialização falha**: `503` com corpo genérico; a mensagem que
  nomeia o parâmetro fica no **registro** de processo (o nome do parâmetro não é
  segredo), e a causa persistente continua falhando enquanto durar (FR-126).
- **Log**: o logger do Fastify continua desabilitado, e nenhum caminho de código
  imprime valor de segredo. A função não registra a Credencial nem a Senha
  (FR-078).
- **Repositório**: nenhum valor de segredo é versionado — nem em exemplo, nem em
  comentário, nem em teste. Os documentos usam apenas a **forma** de espaço
  reservado; os testes geram os valores por execução e conferem a ausência deles
  na saída e nas respostas.
- **Loopback**: `assegurarEscutaLocal` continua valendo sem alteração nas entradas
  que escutam; a função simplesmente não escuta (FR-122).

## Estratégia de Testes

A Interface é a superfície de teste.

- **A fábrica e o handler** (`tests/funcao/funcao.test.ts`): `criarFuncao` é
  chamada com o `LeitorDeSegredos` **em memória** — os três valores gerados pelo
  cenário, nunca versionados — e a URL de conexão apontada para uma base nova do
  apoio de teste de `010`, com o CA privado do servidor de teste. Os eventos são
  **sintéticos**, no formato da Function URL (payload v2): `rawPath`, `headers`
  (com `authorization` quando houver) e `requestContext.http.method`. Os cenários
  cobrem 403 (sem segredo e com segredo errado, com corpo idêntico), 200 em
  `/health` com o segredo e sem Credencial, 401 sem Credencial, a ida e volta
  autenticada de Cartão, Baralho e Vínculo contra o PostgreSQL real, a ausência de
  cabeçalho permissivo de outra origem, a inicialização que falha e é retentada, e
  a ausência de valor de segredo na saída e nas respostas (FR-122, FR-125, FR-126,
  FR-127, FR-128, FR-131, FR-078; SC-051 a SC-058, SC-060).
- **A guarda de origem e a opção do servidor** (`tests/http/origem.test.ts`): com
  `criarServidor(identidade, { segredoDeOrigem })`, a requisição sem o cabeçalho e
  a requisição com o cabeçalho errado recebem a mesma resposta; com o cabeçalho
  certo, a rota responde; e a resposta de recusa **não** carrega
  `access-control-allow-origin`. Em paralelo, `criarServidor` sem a opção continua
  enviando o cabeçalho permissivo e respondendo ao pré-voo — a prova de que a
  execução local não mudou (FR-125, FR-128, SC-053, SC-056).
- **A Seam** (`tests/funcao/segredos.test.ts`): o Adapter de SSM é exercitado com
  um cliente de mentira e exige **uma** chamada `GetParameters` com os três nomes
  sob o prefixo informado e `WithDecryption: true`; um nome ausente, ou devolvido
  vazio, produz `ParametroAusenteError` cuja mensagem **nomeia o parâmetro** e não
  contém valor algum; e o Adapter em memória devolve os três valores ou falha do
  mesmo modo. Nenhuma chamada de rede acontece: o SDK é substituído pela Interface
  (FR-123, SC-052).
- **A construção** (`tests/armazenamento/construcao.test.ts`, de `009`,
  estendido): `--banco=lambda` produz `dist/lambda/lambda.mjs` e
  `dist-lambda.zip`; o zip contém `lambda.mjs` na raiz e **não** contém o Adapter
  do armazenamento local nem `node:sqlite`; o SDK da AWS **não** está embutido
  (é externo); o pacote local **não** contém a entrada da função; e a lista de
  valores aceitos, na mensagem de recusa, passa a ser `sqlite, postgresql, lambda`
  — derivada da tabela, sem texto próprio (FR-130, SC-057).
- **A infraestrutura** (portões, não suíte): `tofu fmt -check` e `tofu validate`
  depois de `tofu init -backend=false`, executados em `backend/terraform`, provam
  o formato e a validade do código sem credenciais AWS e sem `apply` (FR-133,
  SC-060). A existência dos **três** parâmetros é conferida pelo `plan` do
  operador, que o manual descreve.
- **Suítes de `001` a `010`**: inalteradas. Elas provam que acrescentar a função,
  a guarda de origem e o alvo de construção não mudou nenhum comportamento
  observável — a medida de que a feature foi cirúrgica.

Comandos: `npm test`, `npm run typecheck`, `npm run lint` e `npm run build:lambda`
em `backend/`; `npm run build:aws` em `frontend/`; `tofu fmt -check` e
`tofu validate` em `backend/terraform/`. O E2E não é tocado.

## Project Structure

Uma pasta nova de Implementation (`funcao/`), um arquivo novo no Adapter HTTP
(`origem.ts`), uma opção em `criarServidor`, uma entrada, um alvo de construção,
uma linha na construção, um script de frontend, duas mudanças de infraestrutura e
uma linha de `.gitignore`; o resto continua exatamente onde `009` e `010` o
deixaram.

```text
backend/
├── package.json               # + build:lambda; + @fastify/aws-lambda (dependência), @aws-sdk/client-ssm (devDependency)
├── scripts/
│   └── construir.mjs          # tabela de entradas: + lambda → src/entradas/lambda.ts, com @aws-sdk/* e pg-native externos, e o zip em dist-lambda.zip
├── dist/lambda/lambda.mjs     # gerado, ignorado pelo Git
├── dist-lambda.zip            # gerado, ignorado pelo Git — o caminho que a infraestrutura espera
├── src/
│   ├── funcao/                # novo: a Função da nuvem
│   │   ├── funcao.ts          # criarFuncao(leitor, opcoes?): a inicialização memorizada-e-descartável e o handler
│   │   ├── segredos.ts        # a Seam LeitorDeSegredos, SegredosDaFuncao e ParametroAusenteError
│   │   └── ssm.ts             # o Adapter de SSM: GetParameters, WithDecryption, sob ${SSM_PREFIX}
│   ├── http/
│   │   ├── origem.ts          # novo: a guarda do segredo de origem (403 genérico, tempo constante)
│   │   ├── servidor.ts        # criarServidor ganha a opção (guarda e política de outra origem); o resto intocado
│   │   ├── credencial.ts      # de 008, sem alteração
│   │   └── rotas.ts           # de 001 a 008, sem alteração
│   ├── acervo/                # intocado
│   ├── identidade/            # intocado
│   ├── armazenamento/         # de 009 e 010, sem alteração
│   └── entradas/
│       ├── local.ts           # de 009, sem alteração
│       ├── nuvem.ts           # de 010, sem alteração
│       ├── migrar-nuvem.ts    # de 010, sem alteração
│       └── lambda.ts          # nova raiz de composição: SSM + criarFuncao; exporta handler
└── tests/
    ├── funcao/
    │   ├── funcao.test.ts        # eventos v2 sintéticos contra o PostgreSQL de teste real
    │   ├── segredos.test.ts      # a Seam: nomes, decifragem, parâmetro ausente
    │   └── segredos-em-memoria.ts  # o Adapter em memória, usado pelos cenários
    ├── http/origem.test.ts       # a guarda de origem e a ausência do cabeçalho permissivo
    └── armazenamento/construcao.test.ts  # de 009, estendido: --banco=lambda, o zip e o conteúdo do pacote

backend/terraform/
├── ssm.tf                     # + SEGREDO_DAS_SENHAS: random_password de 64 caracteres, special = false
├── variables.tf               # + lambda_memory_mb (padrão 1024)
├── lambda.tf                  # memory_size = var.lambda_memory_mb; o resto igual
├── scripts/build-lambda.sh    # passa a ser uma chamada fina a npm run build:lambda
└── README.md                  # notas do operador (segredos, memória, robot, derrubar)

frontend/
└── package.json               # + build:aws (VITE_ENDERECO_DA_API=/api)

.gitignore                     # + dist-lambda* (deixa de ser ignore local)
aws_pendencias.md              # removido ao fim desta feature; as notas do operador migram para o manual e para o README de infraestrutura

e2e/                           # intocado
```

**Structure Decision**: a divisão continua por Module e Seam, e não por camada. O
diretório `funcao/` é a Implementation da Função da nuvem — inicialização,
segredos e composição —, e `entradas/` continua sendo a única raiz de composição
por caminho de execução: local, nuvem e função. A guarda do segredo de origem
mora no Adapter HTTP porque é lá que ela precisa ser o primeiro hook, e a política
de outra origem é uma opção da **mesma** construção de servidor, e não um segundo
servidor. Não existe pasta de `handlers`, `middlewares`, `services` ou `infra` no
código: o que é de nuvem está na entrada e na pasta da função, e o que é de
infraestrutura está em `backend/terraform/`.

## Riscos, Alternativas e Custo de Reversão

| Decisão | Risco | Alternativa rejeitada | Custo de reversão |
|---|---|---|---|
| `@fastify/aws-lambda` como Adapter do evento | Uma dependência de execução a mais e o risco de o adaptador não cobrir algum recurso do payload v2 | Escrever o adaptador à mão, que exigiria tratar cabeçalhos, consulta, corpo, base64 e resposta — Implementation relevante sem Leverage; `serverless-http`, alheio ao Fastify | Baixo: a fábrica isola o adaptador numa função |
| Inicialização memorizada, descartada na falha | Guardar entre requisições é justamente o que uma inicialização mal feita pode envenenar | Guardar a promise **sem** descartar na falha (contêiner que nunca mais sobe, contra FR-126); inicializar a cada requisição (`GetParameters` e TLS por requisição, contra SC-059) | Baixo: a fábrica é um arquivo, e nenhuma Interface muda |
| `GetParameters` com os três nomes numa chamada | Se o cofre tiver um nome errado, a falha é de todos os três — e é isso que deve acontecer | Três `GetParameter` separados, que triplicam a ida ao SSM no início a frio | Baixo: dois nomes numa linha |
| A Seam `LeitorDeSegredos` | Uma Interface nova para uma leitura só | Ler o SSM direto no handler: a verificação de FR-126 e de FR-123 deixaria de ser local e passaria a exigir AWS (contra FR-133) | Baixo: a Interface é uma operação |
| Guarda de origem como primeiro `onRequest` do Adapter HTTP | Uma obrigação de borda dentro do Adapter HTTP | Guarda fora do Fastify, que duplicaria a leitura do payload v2; guarda depois do hook da Credencial, que inverteria a ordem e faria o 401 vir antes do 403 | Baixo: um arquivo e uma opção |
| CORS por opção de `criarServidor` | Duas políticas num adaptador | Dois servidores (duplicaria rotas e hooks), ou `@fastify/cors` (dependência a mais para o que já existe) | Baixo: um booleano com padrão |
| `--banco=lambda` como terceiro valor | Um valor a mais na lista, que a mensagem de recusa passa a citar | `--alvo=lambda`, que quebraria o contrato de `009` (um argumento, uma forma, lista derivada) | Baixo: uma linha na tabela |
| Zip em `backend/dist-lambda.zip` feito pela ferramenta `zip` | Depende do `zip` da máquina | `archive_file` do OpenTofu, que ataria a construção do código à infraestrutura e não atenderia FR-130 (um script de backend) | Baixo: o caminho e o nome estão na infraestrutura, e não mudam |
| SDK da AWS **externo** no pacote | Divergência entre o SDK do runtime e o dos tipos do desenvolvimento | Empacotar o SDK, que engorda o zip e duplica o que o runtime já traz | Baixo: uma entrada na lista de externos |
| Memória de 1024 MB | Custo por milissegundo mais alto que 512 MB | Manter 512 MB (p95 de risco, contra SC-059); enfraquecer o scrypt, que trocaria segurança por latência, contra o espírito de FR-132 | Nulo: é o valor de uma variável |
| Terceiro segredo no mesmo prefixo, write-only | Como o Terraform não vê o valor gravado, acrescentar a chave exige subir `secrets_version` | Ler o segredo das Senhas de variável de ambiente da função, que ficaria legível para quem descreve a função | Baixo: uma chave no mapa de segredos |
| Verificação local do handler e da infraestrutura | O que só acontece na AWS — o `apply`, o SPA no S3 e o p95 real — não é coberto automaticamente | Publicar na verificação automática, contra o clarify e FR-133 | Baixo |
| Manual de operação como documento versionado | Um manual que envelhece | Confiar na memória de quem opera, ou deixar o inventário `aws_pendencias.md` no lugar do manual | Baixo: o manual é um arquivo, e a ordem é a mesma dos comandos |
| Remover `aws_pendencias.md` ao fim da feature | Perder o registro de um item ainda aberto | Manter um inventário ao lado de um manual que já diz a mesma coisa — duas fontes que divergem | Baixo: o histórico decisório está em `SESSION.md` |

## Complexity Tracking

> Nenhuma violação da constituição a justificar.

**Nenhum** Module novo, **nenhuma** rota nova, **nenhuma** tabela ou coluna, e
**nenhuma** tela. O que a feature acrescenta é a Implementation que liga a
aplicação à infraestrutura já mesclada, e duas dependências, cada uma exigida por
um requisito:

| Acrescentado | Exigido por | Por que não há alternativa menor |
|---|---|---|
| `@fastify/aws-lambda` (dependência de execução) | FR-122 | É o Adapter entre o evento da Function URL (payload v2) e o Fastify. Sem ele, a tradução de evento, cabeçalhos, consulta, corpo e resposta seria escrita à mão — Implementation relevante, e o caminho onde erros de borda nascem |
| `@aws-sdk/client-ssm` (devDependency, **externa** no pacote) | FR-123 | O SDK v3 é fornecido pelo runtime `nodejs24.x`; sem a dependência de desenvolvimento não há tipos sob `tsc --noEmit` nem como exercitar o Adapter de SSM nos testes |
| Uma opção em `criarServidor` (`politicaDeOutraOrigem`, `segredoDeOrigem`) | FR-125, FR-128 | Duas questões de borda na mesma construção de servidor; a alternativa seria um segundo servidor, que duplicaria rotas e hooks, ou a ordem da guarda ficaria errada |
| Um segredo e uma variável em `backend/terraform` | FR-124, FR-132 | O terceiro segredo é o que a função lê, e a memória é o que sustenta o p95; os dois são valores, e não código |

Nada além disso é antecipado: sem sessão, cookie ou token; sem firewall de
aplicação nem limitação de taxa; sem bloqueio por tentativas; sem múltiplos
ambientes; sem encadeamento automático de construção e implantação; sem domínio
próprio nem certificado próprio; sem roteamento do SPA por caminho; sem emenda à
constituição.
