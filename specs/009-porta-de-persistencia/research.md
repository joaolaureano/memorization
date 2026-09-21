# Phase 0 — Research: Porta de Persistência

As decisões de stack, runtime, driver, build e testes estão em
[`../001`](../001-criar-cartao/research.md), e as de Senha, segredo do servidor e
migração 4, em [`../007`](../007-criar-usuario/research.md). Nenhuma é reaberta —
exceto a que decidiu **não** haver uma Seam de persistência, revisitada e
revertida com a justificativa na Decisão 3. Aqui fica apenas o que é novo nesta
feature.

## Decisão 1 — Portas no domínio, uma por conceito, e não um executor de SQL

**Decisão**: a Porta é `ArmazenamentoDoAcervo`, declarada em
`backend/src/armazenamento/porta.ts`, com operações nomeadas pelo domínio:
inserir, listar, obter, atualizar e excluir Cartão e Baralho, vincular e
desvincular Vínculo, listar os extremos de um Vínculo e devolver as contagens que
a elegibilidade deriva. Quando a `007` for implementada, uma segunda Porta,
`ArmazenamentoDeUsuarios`, é declarada ao lado dela, com `inserirUsuario` e
`obterUsuarioPorNomeDeUsuario`.

**Rationale**: FR-100 exige que **todo** acesso a dados persistidos esteja numa
única Porta e que nenhum Module conheça o armazenamento concreto. Um executor
genérico — `executar(sql, parametros)` — cumpriria a letra e destruiria o
objetivo: SQL atravessaria o domínio, cada Module precisaria conhecer o dialeto,
e trocar de banco deixaria de ser escrever um Adapter para ser reescrever as
consultas dos Modules. Com operações de domínio, o Adapter é quem decide como
perguntar, e o Module decide apenas **o que** perguntar. É também o que dá
Locality: mudança de esquema fica dentro de um diretório.

**Alternativas rejeitadas**: executor genérico de SQL; uma Porta por Module com
operações específicas de cada um (o acervo e a identidade leriam o mesmo banco por
duas Interfaces sem necessidade); Porta com tipos do driver nas assinaturas.

## Decisão 2 — Porta assíncrona, com desfechos tipados

**Decisão**: toda operação da Porta devolve `Promise`, e todo desfecho é tipado:
`{ ok: true, valor }`, `{ ok: false, erro: "nao_encontrado" }`,
`{ ok: false, erro: "vinculo_duplicado" }` ou
`{ ok: false, erro: "indisponivel" }`. Nenhum texto de driver atravessa a Porta, e
a Porta não tem mensagem em português: as frases de domínio continuam nos Modules.

**Rationale**: os drivers de PostgreSQL só oferecem caminho assíncrono; uma Porta
síncrona obrigaria a `010` a ter uma segunda Interface, ou a bloquear o laço de
eventos. O Adapter do armazenamento local simplesmente envolve a API síncrona do
`node:sqlite` numa `Promise`, o que não custa nada mensurável. Desfechos tipados
são exigidos por FR-107: o Vínculo repetido é a chave primária composta do
esquema, a unicidade de Nome de usuário é o `UNIQUE` da tabela, e a ausência de
linha é um resultado previsível — todos eles são resultado de domínio, e não
exceção do driver. Sem o tipo, cada Module voltaria a capturar código de erro do
banco, que é exatamente o acoplamento que FR-100 proíbe. E o desfecho
`indisponivel` é o que faz FR-044 e FR-045 valerem: a operação não passou por
concluída e o caller pode tentar de novo.

**Alternativas rejeitadas**: deixar o erro do driver chegar ao Module; devolver
`null`/`undefined` em vez de desfecho tipado, que não distingue "não existe" de
"não deu para perguntar"; exceções para o caso previsto; mensagem em português
dentro da Porta, que poria texto de domínio na Interface de armazenamento e
faria o Module perder a autoridade sobre a frase que o usuário lê.

## Decisão 3 — Reversão explícita da decisão de `001` sobre a Seam de persistência

**Decisão**: a decisão de `001` — *"Repositório de persistência: REJEITADO […]
Produção e teste usam o mesmo driver com destinos diferentes, o que é uma
Implementation com duas configurações, não dois Adapters"* — é **revertida**, e a
reversão fica registrada no plano desta feature.

**Rationale**: a decisão de `001` estava correta para o que existia então:
`DEEPENING.md` diz que *"one adapter means a hypothetical seam"*, e um port com um
Adapter só seria indireção — o custo de extrair depois foi aceito na tabela de
riscos daquele plano. O que muda agora é a contagem de Adapters: o Product Owner
pediu PostgreSQL na nuvem, a bateria compartilhada exige os dois (FR-106) e o
pacote de cada armazenamento não pode conter o outro (FR-120). Com dois Adapters
justificados — o local, que esta feature entrega, e o de PostgreSQL, da `010` — a
Seam deixa de ser hipotética e passa a ser a única forma de FR-100 e SC-043
valerem. Manter a Seam interna obrigaria os Modules a ramificar por driver,
duplicando regra, que é o que a feature existe para evitar.

**Prova**: o teste que inspeciona os fontes dos Modules e exige que nenhum importe
`node:sqlite`, driver de PostgreSQL ou diretório de Adapter (SC-043), e a bateria
da Porta rodando contra os dois Adapters sem alterar nenhum Module (SC-039).

**Alternativas rejeitadas**: manter a Seam interna e ramificar por driver na
`010`; esperar a `010` para extrair a Porta, o que faria a `010` nascer com
SQLite espalhado pelo `Acervo`; esconder a reversão, deixando dois planos em
contradição — a contradição é declarada e justificada, como manda o Princípio I.

## Decisão 4 — Interface do `Acervo` assíncrona, contrato HTTP inalterado

**Decisão**: `criarAcervo(armazenamento)` recebe a Porta; **todos** os verbos do
`Acervo` passam a devolver `Promise`, com as mesmas entradas, as mesmas recusas e
as mesmas mensagens; as rotas aguardam; e o contrato HTTP não muda.

**Rationale**: com a Porta assíncrona, manter o `Acervo` síncrono é impossível —
ele não pode devolver o resultado de uma `Promise` sem bloquear. Como o contrato
HTTP é a fronteira que o frontend conhece, e ele permanece idêntico (mesmos
status, mesmos corpos de sucesso, mesmas recusas de domínio), o frontend não é
tocado: é o que FR-105 e SC-038 exigem. O único acréscimo é o status de falha de
armazenamento, e para ele o Adapter do cliente já tem o modo `indisponivel`, que
preserva o que foi digitado. As suítes existentes do backend são adaptadas
mecanicamente — `await` nas chamadas e um Adapter real em memória no lugar do
banco aberto à mão —, com as asserções intactas.

**Alternativas rejeitadas**: manter um `Acervo` síncrono para o SQLite e um
assíncrono para PostgreSQL, que seriam duas Interfaces para o mesmo Module;
mudar o contrato HTTP para sinalizar a assincronia, sem requisito e com custo no
frontend; adaptar as suítes mudando asserções, o que invalidaria SC-038.

## Decisão 5 — O Adapter é dono do esquema e das migrações, e as versões são compartilhadas

**Decisão**: `backend/src/acervo/esquema.ts` e `backend/src/acervo/migracoes.ts`
são **movidos**, com conteúdo e números de versão inalterados, para
`backend/src/armazenamento/sqlite/`. Cada Adapter tem o seu DDL por dialeto
(`postgresql/migracoes.ts` na `010`), e a **numeração é a mesma** para todos: uma
base migrada por um Adapter está na mesma versão para o outro.

**Rationale**: FR-103 e FR-104 exigem que o Adapter local preserve o arquivo, as
migrações versionadas e as regras de descarte e manutenção exatamente como estão.
Mover sem editar é o que garante que um arquivo `memorizacao.sqlite` existente
continue abrindo na mesma versão, com os mesmos dados e as mesmas migrações
pendentes. E as migrações pertencem ao Adapter, não ao domínio: DDL é dialeto, e
deixá-lo no `Acervo` faria o Module conhecer o banco — a violação direta de
FR-100. Compartilhar a numeração é o que permite escrever as migrações 4 e 5, já
planejadas por `007` e `008`, uma vez por dialeto e na mesma ordem.

**Prova**: a suíte de migrações continua provando ordem, não reaplicação e falha
sem estado parcial; um caso novo abre um arquivo criado antes desta feature e
exige a mesma versão de esquema e os mesmos dados (FR-103, FR-104).

**Alternativas rejeitadas**: um aplicador único de migrações com SQL portável,
que nenhum dos dois dialetos aceita; migrações no domínio, parametrizadas por
dialeto; renumerar as migrações na mudança, que faria bases instaladas
reaplicarem DDL já aplicado.

## Decisão 6 — Uma bateria compartilhada, parametrizada pela fábrica de Adapter

**Decisão**: `backend/tests/armazenamento/bateria-da-porta.ts` exporta uma função
que recebe uma **fábrica** de Adapter — algo que devolve a Porta e o encerramento
— e registra os cenários da Porta. A suíte do Adapter local a chama; a `010`
chama a **mesma** função com a fábrica de PostgreSQL.

**Rationale**: FR-106 exige uma única bateria, aplicável a qualquer Adapter, cem
por cento aprovada contra o local e reutilizada pela `010`; SC-039 mede
exatamente isso. A fábrica é o que torna a parametrização honesta: cada cenário
pede um armazenamento limpo, sem conhecer caminho, conexão, dialeto ou limpeza —
os cenários são de Interface, e por isso sobrevivem a qualquer Implementation
(Princípio V). Os cenários não nomeiam SQLite nem arquivo: se nomeassem, a
bateria deixaria de ser da Porta e passaria a ser da Implementation.

**Alternativas rejeitadas**: uma bateria por Adapter, que duplicaria cenário e
deixaria a Porta provada duas vezes, contra FR-106; bateria que recebe um banco
já aberto, que forçaria o cenário a conhecer o driver.

## Decisão 7 — Raízes de composição por armazenamento; só a entrada importa Adapter

**Decisão**: `backend/src/entradas/local.ts` compõe o Adapter local, o `Acervo` e
o servidor, lendo `CAMINHO_DO_BANCO` (padrão `memorizacao.sqlite`). A `010`
acrescenta `backend/src/entradas/nuvem.ts`. `src/index.ts` deixa de existir. Um
teste lê os fontes de `src/acervo/`, `src/identidade/` e `src/http/` e exige que
nenhum importe um Adapter ou um driver.

**Rationale**: FR-100 e SC-043 pedem que nenhuma dependência de armazenamento
concreto seja encontrada nos Modules. Com uma raiz de composição por
armazenamento, a escolha é feita **uma vez**, no início do processo, e o resto do
programa só conhece a Porta. É o padrão *accept dependencies, don't create them*:
o `Acervo` recebe a Porta, nunca a constrói. E é verificável por leitura de
imports, o que transforma uma convenção em propriedade — nenhuma rota nova pode
"esquecer" e importar o banco.

**Alternativas rejeitadas**: escolher o Adapter dentro do próprio `Acervo`, o que
poria a decisão de armazenamento no domínio; um
registro global de Adapter, que seria escolha em tempo de execução, adiada na
spec; deixar o `index.ts` como está e ramificar dentro dele por variável de
ambiente, que faria o pacote carregar os dois Adapters — proibido por FR-120.

## Decisão 8 — Um pacote por armazenamento, escolhido por parâmetro na construção

**Decisão**: `backend/scripts/construir.mjs` recebe `--banco=<valor>` e valida o
valor contra a **tabela de entradas de Adapter do script** — hoje só `sqlite`; sem
parâmetro, com valor desconhecido ou com um valor conhecido mas ainda não
entregue, recusa com mensagem em português que lista os valores aceitos, sem
repetir o valor informado, sai com código 1 e não escreve nada em `dist/`. Com
valor aceito, empacota **a entrada escolhida** com `esbuild`
(`bundle`, `platform: node`, `format: esm`, `target: node24`, módulos embutidos do
Node externos) em `dist/<banco>/servidor.mjs`. Os scripts passam a ser
`typecheck` (`tsc --noEmit`, o antigo `build`), `build` (`construir.mjs`),
`build:local`, `start:local` e `dev`; a `010` acrescenta os scripts da nuvem.

**Rationale**: FR-102 pede recusa clara em construção e **nenhum artefato
executável** na condição inválida — validar antes de empacotar é o que garante
que nada é produzido, e listar apenas os valores da tabela é o que faz um valor
não entregue, como `postgresql` nesta feature, ser recusado como não aceito.
FR-120 pede que o pacote de um armazenamento não contenha o Adapter do outro: com
um empacotamento por entrada, o outro Adapter nem entra no grafo — a exclusão é
consequência, não limpeza posterior. FR-109 pede um script de início local, e
SC-040 mede a recusa. A escolha na construção, e não em tempo de execução, é o
que foi confirmado no clarify e o que evita pacote com os dois bancos.
`esbuild` é devDependency nova porque `tsc` não escolhe entrada nem empacota
grafo; é a alternativa mínima a um construtor de pacote completo.

**Prova**: um teste executa o script sem parâmetro, com valor não aceito e com
valor com aparência de credencial e exige código 1, a mensagem que nomeia os
valores aceitos, a ausência do valor informado e a ausência de artefato; e
executa com o armazenamento local e inspeciona o pacote, exigindo que o Adapter
do outro armazenamento e o seu driver **não** estejam presentes (FR-102, FR-108,
FR-120, SC-040).

**Alternativas rejeitadas**: escolher o banco em tempo de execução por variável de
ambiente, que faria o pacote conter os dois Adapters (FR-120); empacotar com
`tsc` e escolher a entrada depois, que produziria artefato mesmo na recusa;
empacotar as duas entradas sempre e remover a não usada, que deixaria a exclusão
por conta de um passo a mais; ler o valor do parâmetro sem validar, deixando o
erro aparecer só ao executar.

## Decisão 9 — Início informa o tipo de armazenamento; falha não vaza nada

**Decisão**: a entrada imprime uma única linha — `Armazenamento: SQLite (arquivo
local)`, e `Armazenamento: PostgreSQL (nuvem)` na `010` — e nenhuma outra
informação sobre o armazenamento, nunca o caminho do arquivo nem uma URL. A falha
do armazenamento chega pela Porta como `indisponivel`, o Module a reporta com
mensagem própria e a rota responde 503 sem detalhe do driver; a operação não
aparece como concluída.

**Rationale**: FR-108 exige informar no início qual armazenamento está em uso e
proibir a exibição de segredo de conexão — inclusive quando o valor informado for
recusado, e inclusive no registro. Nomear o **tipo** cumpre a primeira parte sem
arriscar a segunda: um caminho ou uma URL de conexão é o que pode carregar
credencial, e é justamente o que a linha não traz. O desfecho `indisponivel` sem
texto do driver é o que garante que uma mensagem de driver — que pode conter
cadeia de conexão — nunca chegue à saída nem à resposta (FR-044, FR-045, FR-107).

**Prova**: um teste sobe a entrada e exige o tipo de armazenamento na primeira
linha e a ausência de caminho, URL, senha e cadeia de conexão; com o arquivo em
diretório somente leitura, exige a falha reportada e nada apresentado como
concluído (FR-044, FR-108, SC-042).

**Alternativas rejeitadas**: imprimir o caminho do arquivo, que numa configuração
de nuvem seria um endereço com credencial; imprimir a URL de conexão na `010`,
proibido por Princípio VIII; deixar o texto do driver na resposta, que vazaria
detalhe do armazenamento.

## Decisão 10 — Lugar para a segunda Porta, sem desenhá-la

**Decisão**: esta feature fixa o **lugar** da segunda Porta: `ArmazenamentoDeUsuarios`
será declarada em `backend/src/armazenamento/porta.ts`, ao lado da do acervo, com
duas operações — `inserirUsuario` e `obterUsuarioPorNomeDeUsuario` —, e será
implementada pelos mesmos Adapters. A declaração e a implementação são entregues
pela `007-criar-usuario`, junto do Module `Identidade`.

**Rationale**: FR-100 fala de **todo** acesso a dados persistidos numa única
Porta, e o cadastro de Usuário é acesso a dados persistidos; fixar o lugar agora
evita que a `007` nasça com uma segunda Seam ou com o `Identidade` falando
com o banco direto. Nada além do lugar é decidido aqui: as colunas, a derivação de
Senha e a migração 4 continuam sendo assunto do plano da `007`, e o desenho do
Adapter de PostgreSQL continua sendo assunto da `010`.

**Alternativas rejeitadas**: uma Porta única e genérica para todas as entidades,
que ficaria maior que os dois conceitos somados e perderia Locality; decidir o
desenho completo da segunda Porta agora, invadindo o plano da `007`.

## Omissões deliberadas

| Omitido | Motivo |
|---|---|
| Adapter de PostgreSQL, URL de conexão e scripts de nuvem | Feature `010-postgresql-na-nuvem`; aqui fica apenas o lugar |
| Comando de migração para a nuvem e conferência de versão no início | Da `010`, conforme o clarify daquela feature |
| Migração de dados entre o arquivo local e a base em nuvem | Adiada na spec: as duas bases não se falam |
| Escolha do armazenamento em tempo de execução | Adiada na spec; escolher em execução faria o pacote conter os dois Adapters |
| Um armazenamento separado por Module ou por Usuário | Adiado; a Porta é uma só para todos os Modules |
| Hospedagem em nuvem (serviço, rede, contêiner) | Posterior a estas features |
| Migrações 4 e 5 | Planos de `007` e `008`, ainda não implementados; esta feature apenas deixa o lugar, uma por dialeto |
| Emenda à constituição | O Princípio IV passa a ser satisfeito por dois Adapters reais; nada a relaxar |

Nenhum marcador `NEEDS CLARIFICATION` permanece.
