# Phase 0 — Research: Hospedagem na AWS

As decisões de stack, runtime, build e testes estão em
[`../001`](../001-criar-cartao/research.md), as de Senha, segredo do servidor e
parâmetros do scrypt, em [`../007`](../007-criar-usuario/research.md), as da
Porta, da bateria compartilhada e do parâmetro de construção, em
[`../009`](../009-porta-de-persistencia/research.md), e as do Adapter de
PostgreSQL, da URL de conexão, do TLS e da migração, em
[`../010`](../010-postgresql-na-nuvem/research.md). Nenhuma é reaberta. Aqui fica
apenas o que é novo nesta feature: o Adaptador do evento da função, a Seam dos
segredos, a guarda do segredo de origem, a política de outra origem em produção,
o empacotamento da função, a memória da função e a verificação sem publicar na
AWS.

## Decisão 1 — `@fastify/aws-lambda` como Adaptador do evento da função

**Decisão**: a fábrica da função usa `@fastify/aws-lambda` como **dependência de
execução**, empacotada dentro de `lambda.mjs`. Ela recebe o Fastify já montado e
devolve a função que a infraestrutura invoca, no formato da **Function URL**
(payload v2).

**Rationale**: a infraestrutura invoca a função por uma Function URL, e é isso que
define o formato do evento: `version: "2.0"`, `rawPath`, `rawQueryString`,
`headers`, `body`, `isBase64Encoded` e `requestContext.http.method`. Traduzir isso
à mão — para um objeto que o Fastify consuma — é Implementation relevante: o
Fastify tem a sua própria noção de requisição e resposta, e a tradução de volta
precisa lidar com corpo binário, `set-cookie` múltiplo e o `statusCode` da
resposta. A biblioteca é do próprio time do Fastify, trata payload v2 e Function
URL, e é o caminho pelo qual a aparição do evento deixa de ser problema nosso. O
adaptador é também o que mantém a fábrica simples: `criarFuncao` monta o servidor
e o entrega.

**Prova**: os testes exercitam o `handler` exportado com eventos sintéticos de
Function URL, contra o PostgreSQL real do apoio de teste — 403 sem segredo de
origem, 200 em `/health` com ele, 401 sem Credencial e a ida e volta autenticada
do acervo —, e o pacote construído é iniciado por `node`, cobrindo o caminho do
pacote publicado (FR-122, FR-133, SC-051, SC-060).

**Alternativas rejeitadas**: escrever o adaptador à mão, que duplicaria trabalho
já feito e é o lugar onde nascem os erros de borda; `serverless-http`, também
mantido, mas alheio ao ciclo de vida do Fastify; o Lambda Web Adapter, que faria a
aplicação escutar num porto — contra FR-122; o proxy de API Gateway no lugar da
Function URL, que mudaria o contrato de integração que a infraestrutura já
validou.

## Decisão 2 — A inicialização é memorizada **e descartável**

**Decisão**: a promise de inicialização vive **fora** do handler, no módulo da
fábrica. Na primeira invocação do contêiner ela é criada; nas seguintes, é
reaproveitada. Quando a inicialização falha, a requisição que a provocou é
respondida como falha — `503`, corpo genérico em português — e a promise é
**descartada**, de modo que a requisição seguinte tenta a inicialização de novo.
A aplicação **nunca** passa por pronta por causa de uma falha memorizada.

**Rationale**: o início a frio custa uma chamada ao parameter store e um aperto de
mão TLS com o banco; pagar isso em cada requisição derrubaria o percentil 95
(SC-059) sem nenhum ganho. Guardar, porém, guarda o resultado — e uma falha
guardada é um contêiner envenenado: toda invocação seguinte herdaria o erro mesmo
depois de o parâmetro ser corrigido ou o banco voltar. O padrão de descartar na
falha é o que a stub da infraestrutura já usa para o segredo de origem, e é o que
o FR-126 e o SC-054 exigem palavra por palavra: a requisição que provocou a falha
é respondida como falha, e a próxima tenta de novo.

**Prova**: um cenário com leitor que falha na primeira chamada e responde na
segunda exige `503` na primeira requisição e sucesso na seguinte, com a aplicação
montada uma única vez; e um cenário com falha persistente exige `503` em todas as
requisições, sem nenhuma resposta de sucesso (FR-126, SC-054).

**Alternativas rejeitadas**: inicializar no carregamento do módulo, no topo do
arquivo, que faria um erro de configuração sair como falha de importação — sem
resposta HTTP controlada e sem nova tentativa; inicializar a cada requisição, que
paga o custo inteiro por requisição; guardar a falha em cache, que é exatamente o
que FR-126 proíbe; usar `provisioned concurrency` para esconder o problema, que é
custo a mais e não resolve a falha memorizada.

## Decisão 3 — Os três segredos por uma Seam, lidos numa chamada só

**Decisão**: a Interface `LeitorDeSegredos` devolve os três segredos — a URL de
conexão, o segredo de origem e o segredo do servidor das Senhas — numa operação.
O Adapter de produção faz **uma** chamada `GetParameters` com os três nomes sob
`${SSM_PREFIX}` — `DB_URL`, `ORIGIN_SECRET` e `SEGREDO_DAS_SENHAS` — e
`WithDecryption: true`; o Adapter de memória, usado pelos testes, devolve os
valores do cenário. Um nome ausente, ou devolvido vazio, é falha de inicialização
com mensagem em português que **nomeia o parâmetro** e nada do valor.

**Rationale**: FR-123 exige os três segredos vindos do parameter store, sob o
prefixo configurado, e proíbe obtê-los de qualquer outra fonte — em particular de
variável de ambiente da função, que é legível para quem descreva a função, o que
seria um rebaixamento do Princípio VIII. Ler os três numa chamada é o mínimo de
latência no início a frio. A **Seam** é o que torna a inicialização verificável
**sem publicar na AWS** (FR-133, SC-060): com o Adapter de memória, o handler real
é exercitado contra o PostgreSQL real de teste, e a falha por parâmetro ausente é
provocada por cenário, sem AWS e sem credencial. Duas Implementations de verdade —
a de produção e a dos testes — justificam a Interface.

Nunca imprimir o valor é regra de todas as Implementations: o que a mensagem de
falha carrega é o **nome** do parâmetro (`/memorization/DB_URL`), que não é
segredo, e a mensagem do SDK jamais é propagada — ela pode trazer detalhes que não
são nossos.

**Prova**: os testes do Adapter de SSM exigem uma chamada com os três nomes
corretos, sob o prefixo informado, e `WithDecryption` ligado; um nome ausente
produz falha cuja mensagem nomeia o parâmetro e não contém nenhum valor; e os
cenários do handler exigem que nenhum valor de segredo apareça na saída, no
registro ou nas respostas, inclusive na falha da leitura (FR-123, SC-052).

**Alternativas rejeitadas**: importar `@aws-sdk/client-ssm` direto no handler, sem
Interface, que faria a verificação exigir AWS; ler cada segredo com um
`GetParameter` próprio, que triplica a ida ao cofre no início a frio; ler os
segredos de variáveis de ambiente da função, que os expõe a quem descreva a
função; ler `DB_CA_CERT` no cofre, que na nuvem não existe — a cadeia do provedor
é pública, e o CA privado é assunto do apoio de teste de `010`.

## Decisão 4 — A guarda do segredo de origem é o **primeiro** `onRequest`, no Adapter HTTP

**Decisão**: `src/http/origem.ts` declara `exigirSegredoDeOrigem(servidor,
esperado)`, e `criarServidor` a registra **antes** de `exigirCredencial` quando a
opção traz o segredo. A guarda lê o cabeçalho `x-origin-secret`, confere o
**tamanho** e depois compara com `timingSafeEqual`, e responde **`403`** com um
corpo genérico e idêntico em todos os casos de recusa — ausente, curto, longo ou
errado. `/health` também passa por ela.

**Rationale**: FR-125 exige a recusa com `403`, sem revelar o motivo, com
comparação em tempo constante, e SC-053 exige o tempo **indistinguível** entre
segredo ausente e segredo errado. Três detalhes fazem isso valer: a guarda vir
**antes** do hook da Credencial, de modo que a requisição que não veio do
CloudFront não chegue nem ao trabalho de verificar Senha; a conferência de tamanho
antes do `timingSafeEqual`, que lança com buffers de tamanhos diferentes; e um
corpo único, sem `WWW-Authenticate` e sem `Set-Cookie`, que não distingue os
motivos. `/health` exige o segredo porque tudo chega pelo CloudFront — a prova de
vida não é exceção, e a URL pública da função não deve responder nem isso.

A guarda mora no Adapter HTTP porque é **lá** que ela precisa ser o primeiro hook,
e porque a política de outra origem — a outra questão de borda — já é do mesmo
lugar. Ela não é Credencial: responde "de onde veio", e não "quem é", e por isso
`/health` passa por ela e não pela Credencial.

**Prova**: eventos sintéticos sem o cabeçalho e com o cabeçalho errado exigem o
mesmo `403` com o mesmo corpo, e um cabeçalho certo alcança a aplicação; um
cenário compara o corpo e o código das duas recusas, e outro exige que a rota de
acervo **não** responda `401` antes do `403` — a prova da ordem dos hooks
(FR-125, SC-053).

**Alternativas rejeitadas**: registrar a guarda **depois** de `criarServidor`, o
que inverteria a ordem dos hooks e faria a recusa por Credencial vir antes da
recusa por origem; inspecionar o evento da Function URL na entrada, antes de
entregá-lo ao Adaptador, o que criaria uma **segunda** leitura da carga, fora do
contrato do payload v2 e duplicando o tratamento de cabeçalhos; confiar apenas no
CloudFront, que deixaria a URL pública da função aberta a quem a descobrisse — o
que a stub já provou ser preciso fechar; `scmp` ou comparação de strings, que não
é de tempo constante.

## Decisão 5 — A política permissiva de outra origem é uma opção, e a função a desliga

**Decisão**: `criarServidor` recebe um segundo parâmetro opcional com
`politicaDeOutraOrigem` — padrão `true`, o comportamento de hoje — e
`segredoDeOrigem`. Com `politicaDeOutraOrigem: false`, o servidor **não** registra
o pré-voo de CORS e o hook de `onSend` **não** acrescenta
`access-control-allow-origin`: nenhuma resposta da função traz cabeçalho
permissivo. As entradas que escutam no loopback (`local.ts` e `nuvem.ts`)
continuam com o padrão, sem uma linha de edição.

**Rationale**: FR-128 exige que, em produção, o cabeçalho permissivo **não** seja
enviado, porque SPA e API dividem a origem do CloudFront e o navegador não faz
pré-voo de outra origem; e exige que a execução local continue como hoje. Uma
opção com padrão preservador é o que faz as duas coisas conviverem na **mesma**
construção de servidor: nenhuma rota, hook ou resposta é duplicado, e a diferença
entre ambientes é uma linha na raiz de composição — exatamente o lugar onde a
diferença pertence. A execução local continua correta sendo permissiva porque
escuta **apenas** no loopback, onde não há rede a expor.

**Prova**: um cenário em modo de produção exige a **ausência** de
`access-control-allow-origin` em respostas de sucesso e de recusa, e um cenário
com o padrão exige a **presença** do cabeçalho e a resposta ao pré-voo, como hoje
(FR-128, SC-056).

**Alternativas rejeitadas**: um segundo `criarServidor` para produção, que
duplicaria rotas, hooks e o tratamento de erro — dois servidores que divergem; a
dependência `@fastify/cors`, que é peso para um comportamento que já existe em
trinta linhas; filtrar o cabeçalho no Adaptador do evento, depois da resposta
formada, que é limpeza posterior em vez de ausência por construção; remover o CORS
de todas as execuções, que quebraria o frontend de desenvolvimento.

## Decisão 6 — Reuso integral de `010` e de `007`: a função confere, não migra

**Decisão**: a fábrica da função **reusa**, sem reimplementar: `configuracaoDaConexao`
de `010` (validação da URL, recusa de `sslmode=disable`/`allow`/`prefer`, CA
opcional) sobre o valor vindo do cofre; `criarPiscina` e `abrirArmazenamentoPostgresql`,
com `ssl: { rejectUnauthorized: true }` e a cadeia **pública** do provedor;
`lerVersaoDoEsquema` e `versaoCorrenteConhecida` para conferir a versão do esquema;
e `segredoConfigurado` de `007` para validar o segredo do servidor das Senhas, com
o valor vindo do cofre em vez do ambiente. A função **nunca** chama
`aplicarMigracoes`: esquema atrasado é recusa de inicialização, com mensagem em
português que nomeia as duas versões e manda executar o comando de migração.

**Rationale**: FR-127 é explícito — quem migra é o operador, com o comando de
`010`, **antes** de publicar; a função não migra e recusa servir com esquema
desatrasado. Reusar as peças de `010` é o que mantém **uma** validação de URL e
**uma** definição de versão corrente: duas implementações divergiriam, e a
divergência apareceria justamente na nuvem, onde o diagnóstico é mais caro. A
chamada de `segredoConfigurado` com o valor do cofre preserva a regra da `007`
(comprimento mínimo, mensagem que nomeia a variável) sem que o Module passe a
conhecer SSM.

**Prova**: um cenário com a base atrasada exige a recusa de inicialização e a
mensagem que nomeia as duas versões, e exige que **nenhuma** migração tenha sido
aplicada; um cenário com o esquema corrente exige que a aplicação monte e atenda
(FR-127, SC-055). A ida e volta autenticada contra o PostgreSQL real prova o resto
(SC-051).

**Alternativas rejeitadas**: migrar no início a frio, contra o clarify e FR-127,
com risco de dois contêineres migrando ao mesmo tempo; reimplementar a validação
da URL na fábrica, que criaria duas regras para o mesmo segredo; ler o segredo das
Senhas de `process.env` na função, contra FR-123; ignorar a conferência de versão
e deixar o erro aparecer como falha de consulta, que trocaria um diagnóstico claro
por um 503 opaco.

## Decisão 7 — `--banco=lambda`: um terceiro valor na tabela, e não um segundo parâmetro

**Decisão**: a tabela de entradas de `backend/scripts/construir.mjs` ganha a
chave `lambda`, apontando para `src/entradas/lambda.ts`, com os externos
`pg-native` e `@aws-sdk/*`. A forma aceita continua sendo **exatamente**
`--banco=<valor>`, com **um** argumento, e a lista de valores aceitos continua
derivada da tabela — agora `sqlite, postgresql, lambda`.

**Rationale**: o contrato de `009` tem três propriedades que valem preservar: a
forma é exatamente `--banco=<valor>`; o número de argumentos é exatamente um; e a
lista de aceitos é **derivada** da tabela, de modo que acrescentar um alvo não
pede texto novo nem mensagem nova. `--banco=postgresql --alvo=lambda` quebraria as
três: passariam a existir dois eixos de validação, a recusa antes de qualquer
escrita deixaria de ser uma conferência simples, e a mensagem deixaria de ser
derivada. Como o alvo da função é, na prática, um **pacote a mais de um
armazenamento** — a função grava no PostgreSQL —, e como o contrato chama o
parâmetro de escolha de construção, um terceiro valor é a extensão natural: o
pacote local não contém a entrada da função, e o da função não contém o Adapter do
armazenamento local nem `node:sqlite`, por **consequência** do grafo.

**Prova**: o teste de construção executa `--banco=lambda`, confere os dois
artefatos e o conteúdo do pacote; executa `--banco=sqlite` e exige que o pacote
local **não** contenha a entrada da função; e executa o script sem parâmetro, com
forma diferente e com valor desconhecido, exigindo a recusa com os três valores na
mensagem e nenhum artefato produzido (FR-130, SC-057).

**Alternativas rejeitadas**: `--alvo=lambda`, pelos três motivos acima; dois
scripts de construção separados, que duplicariam a validação, a lista de aceitos e
o tratamento de falha; um script de construção próprio para a função,
`construir-lambda.mjs`, que seria uma segunda construção a manter em sincronia
com a primeira; esbuild chamado direto por um script de shell, que jogaria a
validação e a mensagem em português para fora do contrato de `009` — e é
exatamente o que o `scripts/build-lambda.sh` de hoje faz, e que esta feature
substitui por uma chamada fina.

## Decisão 8 — O zip em `backend/dist-lambda.zip`, com `lambda.mjs` na raiz

**Decisão**: além de `dist/lambda/lambda.mjs`, a construção do alvo `lambda`
produz o zip `backend/dist-lambda.zip`, com `lambda.mjs` na **raiz** do arquivo,
usando a ferramenta `zip` da máquina. Falha de empacotamento remove o diretório e
o zip — nenhum artefato parcial —, e `dist-lambda*` entra no `.gitignore`
versionado da raiz.

**Rationale**: FR-130 exige "um único empacotamento num zip no caminho que a
infraestrutura espera", e a infraestrutura espera `backend/dist-lambda.zip`
aplicado com `-var lambda_package=../dist-lambda.zip -var
lambda_handler=lambda.handler`: o handler `lambda.handler` nomeia o **arquivo**
`lambda.mjs` na raiz do pacote, de modo que a estrutura do zip é contrato, e não
conveniência. A ferramenta `zip` é a mesma que o script de hoje já usa, é estável
e não acrescenta dependência de JavaScript. O `.gitignore` versionado resolve o
item `0.8` do inventário de pendências, que era ignorado só localmente.

**Prova**: o teste de construção executa o alvo e exige os dois artefatos, o zip
com a entrada `lambda.mjs` na raiz, a ausência do Adapter do armazenamento local e
de `node:sqlite` no conteúdo, e a ausência do SDK da AWS — que é externo (FR-130,
SC-057).

**Alternativas rejeitadas**: deixar a infraestrutura zipar com `archive_file` do
OpenTofu, que ataria a construção do código à infraestrutura e não atenderia
FR-130; empacotar com um `node_modules` ao lado, que engordaria o zip com código
que o empacotador já resolve; nomear o arquivo de outra forma
(`dist-lambda/index.mjs`), que exigiria mudar `lambda_handler` na infraestrutura
já validada; escolher o nome do zip pelo `terraform.tfvars`, que faria o caminho
deixar de ser único.

## Decisão 9 — O SDK da AWS é **externo**; `@aws-sdk/client-ssm` é devDependency

**Decisão**: o empacotamento da função marca `@aws-sdk/*` como **externo**, e
`@aws-sdk/client-ssm` entra apenas nas dependências de desenvolvimento, para tipos
e para os testes. O pacote contém o Fastify, o `pg`, o `@fastify/aws-lambda` e o
código da aplicação — e nada do SDK.

**Rationale**: o runtime `nodejs24.x` traz o SDK v3 embutido; empacotá-lo
duplicaria dezenas de megabytes dentro do zip, aumentando o início a frio sem
nenhum ganho. Declarar o SDK externo é o que o script de hoje já faz para
`@aws-sdk/*`, e é o que mantém o pacote pequeno. Como o runtime fornece a versão,
o desenvolvimento precisa dos **tipos** para `tsc --noEmit` e das Implementations
para os testes — daí a devDependency, que não entra no pacote.

**Prova**: o teste de construção exige que o SDK **não** esteja dentro do pacote,
e o pacote construído é executado por `node` com um cliente de SSM de mentira nos
testes (FR-130, SC-057).

**Alternativas rejeitadas**: empacotar o SDK, que engorda o zip e duplica o
runtime; usar o SDK v2 (`aws-sdk`), que está congelado e é maior; fazer as
chamadas ao SSM por `fetch` e assinatura própria, que é Implementation de
criptografia de borda sem nenhum Leverage.

## Decisão 10 — A memória da função é 1024 MB, por variável, e o remédio é subir memória

**Decisão**: a memória da função passa a ser uma variável de infraestrutura
(`lambda_memory_mb`), com padrão **1024**, aplicada a `memory_size` no lugar dos
512 MB de hoje. A meta é o p95 das operações simples **abaixo de 1 segundo**,
medido **na função** depois de publicar. Se o p95 exceder, o remédio documentado é
**elevar a memória**, e nada mais.

**Rationale**: FR-132 fecha a conta. Não existe sessão, cookie nem token (FR-079):
a Credencial é apresentada em **cada** requisição, e cada apresentação passa por
`HMAC-SHA256` mais `scrypt` com `N=32768`, `r=8`, `p=1` e `maxmem` de 64 MiB —
parâmetros da `007`, gravados junto do hash. A Lambda troca memória por CPU de
forma proporcional: é por isso que 1024 MB não é "mais folga", e sim o
dimensionamento honesto de um caminho quente que faz derivação de chave por
requisição. A meta é medida na função, e não na execução local, porque é lá que o
dimensionamento vale; e medir depois de publicar é o que o clarify determinou,
porque o `apply` é ação do operador.

**Prova**: a medição é documentada passo a passo no manual, com uma sequência de
requisições autenticadas simples pelo endereço do CloudFront e o p95 sobre os
tempos observados, descartando os inícios a frio pelo log da função (SC-059).

**Alternativas rejeitadas**: manter 512 MB e aceitar o risco no p95, contra
SC-059; baixar o `N` do scrypt, que trocaria segurança por latência e reabriria
uma decisão da `007` — e não é o que FR-132 pede; guardar a Credencial verificada
entre requisições, que seria sessão, contra FR-079 e FR-131; aceitar a latência
numa primeira requisição e servir as seguintes de graça, que é o mesmo que criar
sessão; aumentar o timeout, que não reduz latência; usar memória de
`provisioned concurrency`, que é custo fixo e pertence ao encadeamento automático
adiado na spec.

## Decisão 11 — O SPA de produção por `npm run build:aws`, e o script de publicação usando-o

**Decisão**: o `package.json` do frontend ganha `build:aws`
(`VITE_ENDERECO_DA_API=/api npm run build`), e o script de publicação da
infraestrutura passa a chamá-lo, em vez de passar a variável na linha de comando.
O padrão do endereço da API (`http://127.0.0.1:3001`) continua valendo quando a
variável não é informada.

**Rationale**: FR-129 exige que o SPA seja construído para produção apontando o
endereço da API para `/api`, de modo que o navegador chame o CloudFront na mesma
origem; e SC-057 mede isso em cem por cento das construções de produção. O código
do frontend já lê `VITE_ENDERECO_DA_API` com padrão local, de modo que a mudança é
**só** de configuração de construção: nenhuma tela, componente ou cliente muda. Um
script nomeado no pacote é o que dá ao `npm` — e a quem opera — um caminho único
para a construção de produção, em vez de uma variável solta na linha de comando
de um script de shell.

**Prova**: um cenário executa a construção de produção e exige que o pacote
gerado contenha `/api` como endereço da API e **nenhuma** ocorrência de
`127.0.0.1`; e a construção local, sem a variável, continua apontando o endereço
local (FR-129, SC-057).

**Alternativas rejeitadas**: deixar a variável só no script de shell, sem script
no pacote, que faria a construção de produção existir apenas dentro da
infraestrutura; trocar o padrão do código para `/api`, que quebraria o
desenvolvimento local; criar um modo de produção no cliente com outra base de
URL, que seria código novo sem requisito.

## Decisão 12 — A verificação é local: eventos sintéticos, PostgreSQL real e as conferências do OpenTofu

**Decisão**: a verificação automatizada desta feature acontece **sem publicar na
AWS**: o `handler` exportado é exercitado com eventos **sintéticos** de Function
URL (payload v2), com o `LeitorDeSegredos` em memória e a URL de conexão apontada
para o PostgreSQL **real** com TLS do apoio de teste de `010`; o conteúdo do
pacote é conferido executando a construção; e o código de infraestrutura passa por
`tofu fmt -check` e por `tofu validate` depois de `tofu init -backend=false`. O
`apply`, a publicação do SPA e a medição do p95 na função são ações do operador,
com as credenciais dele.

**Rationale**: FR-133 diz exatamente isso — a verificação deve ser possível sem
publicar na AWS, e a publicação efetiva não pode ser exigida dela —, e o clarify
confirmou. Eventos sintéticos com o banco de verdade cobrem o que interessa:
roteamento do payload, guarda de origem, hook da Credencial, composição do
servidor, ausência de CORS, ida e volta de persistência e o comportamento da
inicialização. `fmt` e `validate` são conferências que não precisam de credencial
nem de state, e por isso fecham a verificação da infraestrutura. O que **não** é
verificado automaticamente é declarado como tal: o `apply`, o SPA no S3 e o p95.

**Prova**: os cenários do handler e a execução da construção são a prova de
FR-122 a FR-128 e de FR-130; as duas conferências do OpenTofu são a prova do
formato e da validade do código de infraestrutura; e o manual descreve a parte
operacional (SC-051, SC-053 a SC-057, SC-060, SC-061).

**Alternativas rejeitadas**: publicar na verificação automática, contra o clarify
e FR-133, e com credenciais que não são da verificação; usar a stub como base da
verificação, que não exercitaria a aplicação real; emular a AWS com bibliotecas de
dublê de Lambda e SSM, que provaria o dublê e não o pacote; deixar a verificação
da infraestrutura para o `plan` do operador, que não é uma conferência de formato
nem de validade.

## Decisão 13 — O inventário `aws_pendencias.md` sai do repositório ao fim da feature

**Decisão**: quando `011` terminar, `aws_pendencias.md` é **removido**, e as notas
que são do **operador** — e não de uma feature — migram para o manual de operação
([`quickstart.md`](./quickstart.md)) e para o README de infraestrutura: derrubar a
stack, trocar um segredo e subir a versão, o state local, o lockfile dos
providers, o `package-lock.json` versionado e as restrições do usuário `robot`.

**Rationale**: o arquivo é "inventário de trabalho, não registro de decisão" — foi
o insumo das features `007` a `011`, e ao fim desta não sobra item aberto de
código. Manter um inventário ao lado de um manual que diz a mesma coisa produz
duas fontes que divergem, e a que fica desatualizada é justamente a que ninguém
lembra de ler. O que é decisão continua em `SESSION.md`, que é o registro
append-only do Princípio II; o que é operação continua no manual e no README de
infraestrutura, que são os lugares onde quem opera procura.

O mapeamento item a item está em [`plan.md`](./plan.md), na seção "O fim de
`aws_pendencias.md`". Os dois itens que a spec declara **obsoletos** — a entrada
pelo provedor Google com cookie de sessão e o `SESSION_SECRET` — não têm
substituto: a Credencial de `008-entrar` é a única forma de acesso, e o terceiro
segredo do cofre é o `SEGREDO_DAS_SENHAS` da `007`, provisionado por FR-124.

**Prova**: a remoção é verificada por leitura do repositório ao fim da feature, e
as notas que sobrevivem estão no manual e no README de infraestrutura (FR-124,
FR-134, SC-061).

**Alternativas rejeitadas**: manter o arquivo como histórico, que duplicaria o
manual; reescrevê-lo como "pendências de `012` em diante", que seria antecipar as
funcionalidades adiadas; apagá-lo sem mover as notas do operador, que perderia o
que ninguém mais registra.

## Omissões deliberadas

| Omitido | Motivo |
|---|---|
| Sessão, cookie ou token de qualquer espécie | FR-079 e FR-131: a Credencial é apresentada em cada requisição |
| Firewall de aplicação, limitação de taxa e bloqueio por tentativas de Entrar | Adiados na spec |
| Domínio próprio e certificado digital próprio | Adiados na spec: o CloudFront continua com o certificado `*.cloudfront.net` |
| Múltiplos ambientes, inclusive homologação | Adiados na spec: uma stack, um banco, um operador |
| Encadeamento automático de construção e implantação | Adiado na spec: a construção e o `apply` são passos do manual |
| Automação da criação do projeto no Neon pela linha de comando | Adiada na spec |
| Roteamento do SPA por caminho, com reescrita na borda | Adiado na spec: o SPA continua roteando por `location.hash`, e não há `custom_error_response` |
| Migração de dados entre o arquivo local e a base em nuvem | Adiada na spec; os dois armazenamentos não se falam |
| Ajuste do conjunto de conexões do Adapter | Adiado na spec; a piscina tem máximo pequeno e fixo (4) |
| Tabela, coluna ou tela nova | Nenhum requisito desta feature pede: ela muda **onde** a aplicação roda |
| Enfraquecer os parâmetros do scrypt | FR-132 pede desempenho, não menos segurança: o remédio é memória |
| Emenda à constituição | O Princípio VIII é cumprido com rigor novo — três segredos num cofre, lidos por uma Seam —, e nenhum princípio é relaxado |

Nenhum marcador `NEEDS CLARIFICATION` permanece: a forma de verificação, a ordem
do manual, a política de outra origem em produção e o limite de desempenho foram
resolvidos no clarify de 2026-09-21.

## Referência rápida: onde cada requisito desta feature é decidido

| Requisito | Decisão |
|---|---|
| FR-122 | 1, 2, 6 |
| FR-123 | 3, 9 |
| FR-124 | 7, 13 |
| FR-125 | 4 |
| FR-126 | 2, 6 |
| FR-127 | 6 |
| FR-128 | 5 |
| FR-129 | 11 |
| FR-130 | 7, 8, 9 |
| FR-131 | 4, 10 |
| FR-132 | 10 |
| FR-133 | 3, 12 |
| FR-134 | 13 |
| FR-044, FR-045 | 2, 6, 12 |
| FR-078, FR-079, FR-077 | 3, 4, 5, 10 |
| FR-120 | 7, 8 |
| SC-051 a SC-055 | 1 a 4, 6, 12 |
| SC-056, SC-057 | 5, 7, 8, 9, 11 |
| SC-058 a SC-061 | 10, 12, 13 |
| SC-052 | 3 |
