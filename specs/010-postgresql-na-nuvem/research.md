# Phase 0 — Research: PostgreSQL na Nuvem

As decisões de stack, runtime, build e testes estão em
[`../001`](../001-criar-cartao/research.md), as de Senha, segredo do servidor e
migração 4, em [`../007`](../007-criar-usuario/research.md), e as da Porta, da
bateria compartilhada, do parâmetro de construção e do Adapter do armazenamento
local, em [`../009`](../009-porta-de-persistencia/research.md). Nenhuma é
reaberta. Aqui fica apenas o que é novo nesta feature: o Adapter de PostgreSQL, a
URL de conexão, a proteção da conexão, a migração da base em nuvem e os scripts
da nuvem.

## Decisão 1 — Driver `pg` (node-postgres), em JavaScript puro

**Decisão**: o Adapter de PostgreSQL usa `pg` (node-postgres) como dependência de
execução. `pg-native` **nunca** é usado, mesmo sendo uma dependência opcional do
pacote, e é declarado **externo** no empacotamento para que o construtor não tente
resolvê-lo.

**Rationale**: `001` já registrou que o binding nativo de SQLite **não compila** no
Node 26 deste ambiente — não há prebuild e o `node-gyp` falha —, e é por isso que
o armazenamento local usa o módulo embutido do runtime. A mesma restrição vale
para o PostgreSQL: `pg` é JavaScript puro, instala sem compilar, funciona no
empacotamento de um arquivo só e não acrescenta etapa de build nativa. A
alternativa nativa repetiria exatamente o problema que `001` já resolveu
abandonando o binding de SQLite.

**Prova**: `npm install` sem compilação; o pacote da nuvem construído por
`--banco=postgresql` executa sem `pg-native`; e a bateria compartilhada roda
contra um PostgreSQL real por meio desse driver.

**Alternativas rejeitadas**: `pg-native`, por exigir compilação nativa;
`postgres` (porsager), também em JavaScript puro, mas com outra forma de piscina e
menos tempo de uso no ecossistema do que o node-postgres — a diferença não é
requisito, e a escolha do driver mais difundido reduz risco sem custo; driver
escrito à mão sobre o protocolo, que seria Implementation relevante sem Leverage.

## Decisão 2 — Piscina pequena e fixa, com o ouvinte de `error` que descarta em silêncio

**Decisão**: o Adapter mantém **um** conjunto de conexões por instância, com
máximo pequeno e fixo (4), criado na sua fábrica e fechado em `encerrar()`; cada
operação toma uma conexão e a devolve. A piscina recebe um ouvinte de `error` que
**não escreve nada**: descarta o evento, deixa a conexão sair, e a próxima
operação abre outra.

**Rationale**: um provedor de nuvem encerra conexões ociosas. Sem o ouvinte, o
evento de erro de uma conexão ociosa derruba o processo — o Node trata `error` de
fluxo sem ouvinte como exceção não capturada. Com o ouvinte, a queda de uma
conexão ociosa é o que ela é: uma conexão a menos na piscina, e a operação seguinte
conclui. Não escrever nada é o que mantém FR-118 e SC-045 intactos: a mensagem do
driver de uma conexão ociosa pode carregar host, usuário e endereço de base, e
nada disso pode aparecer na saída nem no registro. O máximo pequeno e fixo é o
mínimo honesto: o ajuste do conjunto de conexões está adiado na spec, e a Interface
não expõe configuração de conexão.

**Prova**: um teste encerra as conexões do backend por `pg_terminate_backend` e
exige que a **próxima** operação conclua (FR-119, SC-049); outro dispara o evento
de erro de conexão ociosa e exige que o processo continue servindo e que nada de
sensível tenha sido impresso.

**Alternativas rejeitadas**: abrir conexão nova por operação, que paga um aperto de
mão TLS por chamada e não protege melhor; repassar o erro da conexão ociosa para a
saída, que vazaria dado da cadeia de conexão; expor o ajuste da piscina como
variável de ambiente, que é antecipação (o ajuste está adiado); deixar o evento sem
ouvinte, que faz o processo cair.

## Decisão 3 — `DB_URL` lida só pelas entradas da nuvem, e validada antes de tudo

**Decisão**: a variável de ambiente `DB_URL` é lida **apenas** em
`backend/src/entradas/nuvem.ts` e `backend/src/entradas/migrar-nuvem.ts`, no início
do processo. A URL precisa ser **analisável**, ter protocolo `postgres:` ou
`postgresql:`, **host presente** e base nomeada; caso contrário — incluindo
ausente ou vazia —, a entrada falha com `UrlDeConexaoInvalidaError`, cuja mensagem
**nomeia `DB_URL`** e **nenhum pedaço do valor**. O Adapter recebe a configuração
já validada e nunca lê ambiente.

**Rationale**: FR-113 impõe o nome da variável — é contrato da infraestrutura de
nuvem existente — e FR-114 exige recusa com mensagem em português que nomeie a
variável sem repetir o valor. Manter a leitura **só** nas entradas é o que
conserva o desenho de `009` — uma raiz de composição por armazenamento, a única
que importa Adapter — e torna verificável por leitura de imports que nenhum Module
e nenhum Adapter conhece a variável. Validar antes de abrir qualquer conexão é o
que faz a recusa acontecer sem tentativa de rede e sem que a aplicação siga como
se o armazenamento existisse.

**Prova**: testes com `DB_URL` ausente, vazia, malformada, com protocolo errado e
sem host exigem a recusa, o nome da variável na mensagem, a ausência de vestígio
do valor na saída e no registro, e nenhum servidor escutando (FR-114, FR-118,
SC-046).

**Alternativas rejeitadas**: ler a variável dentro do Adapter, que faria o Adapter
depender do ambiente de execução e tiraria a escolha da raiz de composição; ler no
carregamento do módulo, no topo do arquivo, que faria a construção — que não tem a
variável e não deve exigir segredo — falhar; usar o próprio erro do analisador de
URL, cuja mensagem em inglês pode repetir parte do valor informado.

## Decisão 4 — Cifra sempre, certificado sempre verificado, e URL que peça desligar é recusada

**Decisão**: a configuração do conjunto de conexões traz
`ssl: { rejectUnauthorized: true }` **sempre**, e mais `ca` quando `DB_CA_CERT`
aponta para um arquivo PEM. Uma URL cuja consulta peça `sslmode=disable`,
`sslmode=allow` ou `sslmode=prefer` é **recusada** antes de qualquer conexão.
`require`, `verify-ca` e `verify-full` são aceitos e, de todo modo, verificados por
inteiro: o objeto `ssl` é que manda, nunca a diretiva da URL.

**Rationale**: FR-115 exige conexão cifrada **e** certificado verificado, e uma
conexão que não possa ser verificada deve ser recusada sem nenhuma operação
apresentada como concluída. Deixar a diretiva da URL decidir reintroduziria, num
parâmetro de texto, o poder de rebaixar a verificação — exatamente o que a
exigência proíbe. Recusar antes de conectar é mais forte que aceitar e degradar:
uma URL mal configurada vira falha visível de início, e não gravação silenciosa
sobre canal não verificado. `DB_CA_CERT` existe para que os testes exercitem TLS de
verdade contra uma autoridade certificadora própria, sem baixar a verificação; na
nuvem a variável fica ausente e a cadeia pública do provedor é usada.

**Prova**: com CA privado, a conexão é verificada e a bateria roda (SC-047); com
`sslmode=disable` (e `allow`, e `prefer`), a entrada recusa **antes** de abrir
conexão; e contra um servidor cujo certificado não se confirma, a conexão é
recusada e nenhuma operação passa por concluída.

**Alternativas rejeitadas**: `rejectUnauthorized: false`, que desligaria a
verificação; seguir o `sslmode` da URL, que permitiria desligar a cifra;
`ssl: true` sozinho, que em algumas versões do driver aceita certificado não
confiável; aceitar `sslmode=disable` e conectar assim mesmo, contra FR-115.

## Decisão 5 — Tradução de SQLSTATE dentro do Adapter

**Decisão**: o Adapter traduz o código do driver em desfecho tipado:
`23505` (unicidade violada) vira `vinculo_duplicado` na chave primária composta de
`vinculo` e `nome_de_usuario_existente` no índice único de `lower(nome_de_usuario)`
— distinguidos pelo **nome da restrição** —; `23503` (chave estrangeira violada ao
vincular extremidade inexistente) vira `nao_encontrado`; zero linhas afetadas ou
devolvidas vira `nao_encontrado`; e qualquer outra falha vira `indisponivel`.
Nenhum campo da mensagem do driver atravessa a Porta.

**Rationale**: FR-110 mantém a regra de `009` — a Porta não muda e nenhum Module
conhece o banco —, e FR-118 proíbe que qualquer segredo saia numa mensagem. O
SQLSTATE é a única coisa estável e **não sensível** de um erro do driver: é um
código de cinco caracteres, definido pelo padrão SQL, e não carrega host, usuário,
senha nem endereço. Traduzir por código, e não por texto, é o que faz a recusa de
Vínculo repetido continuar sendo **resultado de domínio** — o mesmo desfecho que o
Adapter local produz a partir da chave primária composta do SQLite. Distinguir os
dois casos de `23505` pelo nome da restrição é possível porque o DDL é nosso.

**Prova**: a bateria compartilhada de `009` roda inteira contra o Adapter — o
Vínculo repetido e a ausência de entidade chegam como desfecho tipado, com as
mesmas asserções que o Adapter local satisfaz (FR-111, SC-044) —, e os testes de
entrada exigem que nenhuma mensagem de driver chegue à saída.

**Alternativas rejeitadas**: consultar antes de inserir para saber se o Vínculo
existe, que introduz corrida entre a consulta e a inserção; deixar o erro do driver
atravessar, contra FR-110 e FR-118; capturar por texto de mensagem, que é instável
entre versões e localidades do servidor; traduzir na entrada ou no Module, que
devolveria o conhecimento do banco para fora do Adapter.

## Decisão 6 — Migrações em dialeto PostgreSQL, com os mesmos números de versão

**Decisão**: `backend/src/armazenamento/postgresql/migracoes.ts` traz o DDL de
PostgreSQL para as **mesmas versões** do Adapter local: 1 `cartao`, 2 `baralho`,
3 `vinculo`, com a tabela `versao_do_esquema` compartilhando a mesma noção. O
mapeamento é `TEXT` para texto, `INTEGER` para a versão, `BYTEA` para binário,
`CHECK` equivalentes (`btrim` e `char_length` no lugar de `trim` e `length`) e, na
migração 4, um **índice único sobre `lower(nome_de_usuario)`** na ausência do
`COLLATE NOCASE` do SQLite.

**Rationale**: FR-112 exige as mesmas regras de conteúdo de antes, e `009` fixou
que a **numeração é compartilhada** e só o DDL difere: é o que permite escrever as
migrações 4 e 5 uma vez por dialeto, na mesma ordem, e o que faz uma base migrada
por um Adapter estar na mesma versão para o outro. Duplicar a numeração faria
bases instaladas reaplicarem DDL já aplicado. As `CHECK` continuam sendo a rede de
segurança contra erro de programação, com a validação primária no Module, como nas
migrações 1 a 3. O índice sobre `lower(...)` é o equivalente funcional exato do
`UNIQUE COLLATE NOCASE` da `007` — e é a decisão daquela feature de restringir o
alfabeto a ASCII que garante que os dois coincidem, porque `COLLATE NOCASE` do
SQLite só iguala maiúsculas e minúsculas em ASCII.

**Prova**: a bateria roda contra uma base migrada por esse DDL (SC-044), e o teste
de migrações exige a versão corrente numa base nova e nenhuma reaplicação numa base
já migrada (FR-116, SC-048).

**Alternativas rejeitadas**: um aplicador único com SQL portável, que nenhum dos
dois dialetos aceita; converter o DDL do SQLite em tempo de execução, que seria um
tradutor de dialetos dentro do Adapter; usar `citext` para o Nome de usuário, que
exigiria extensão instalada no servidor e uma dependência a mais; `UNIQUE` comum
sobre `lower(...)` como coluna gerada, que guardaria dado derivado sem necessidade.

## Decisão 7 — Migração só por comando, uma transação por migração, sob trava consultiva; o início confere e recusa

**Decisão**: as migrações rodam **apenas** pelo comando da nuvem
(`backend/src/entradas/migrar-nuvem.ts`), nunca no início. Cada migração roda numa
transação que começa com `SELECT pg_advisory_xact_lock(<chave fixa>)`, relê a
versão **depois** da trava, aplica o DDL e eleva a versão **dentro da mesma
transação**. O início da nuvem lê a versão do esquema e **recusa iniciar**, com
mensagem clara em português, quando ela não é a corrente.

**Rationale**: a decisão vem do clarify, e o FR-121 saiu dela: o início não migra,
ele confere. Migrar no início faria um deploy aplicar DDL em produção sem que
ninguém tivesse pedido, e dois deployamentos simultâneos tentariam migrar ao mesmo
tempo — a corrida que a trava consultiva elimina. A trava `pg_advisory_xact_lock`
é a da própria transação, então não há o que liberar em caso de falha, e não há
tabela de trava para manter. Reler a versão depois da trava é o que faz a segunda
instância enxergar a migração já aplicada pela primeira. Elevar a versão na mesma
transação do DDL é o que faz uma falha no meio **não** deixar estado parcial — a
mesma garantia do aplicador de `009`.

**Prova**: numa base nova e vazia, o comando chega à versão corrente; repetir o
comando não reaplica nada; dois comandos concorrentes não aplicam a mesma migração
duas vezes; uma migração que falha não eleva a versão nem deixa tabela pela
metade; e, com a base atrasada, o início é recusado e nada escuta (FR-116,
FR-121, SC-048).

**Alternativas rejeitadas**: migrar no início, contra o clarify e FR-121; migrar
sem trava e confiar no "um deploy por vez", que é o que produz o incidente;
`SELECT ... FOR UPDATE` sobre a linha de versão, que não funciona quando a linha
ainda não existe; trava de aplicação própria, que exigiria tabela, protocolo e
tratamento de trava órfã.

**Regra operacional que acompanha**: a execução usa o **endpoint agrupado** do
provedor (Neon), e o **comando de migração** deve ser apontado para o **endpoint
direto**, porque DDL com trava consultiva em transação atravessa mal um agrupador.
A variável é uma só, `DB_URL`, definida pelo operador **por comando**.

## Decisão 8 — Verificação sem Docker: PostgreSQL real, baixado pelos próprios testes, com TLS e CA descartável

**Decisão**: uma devDependency (`embedded-postgres`) baixa e executa um binário
**real** de PostgreSQL. O apoio de teste
(`backend/tests/armazenamento/postgresql/servidor-de-teste.ts`) inicia o servidor
numa **porta livre**, com **diretório de dados temporário**, gera em tempo de
execução um **CA e um certificado de servidor** descartáveis com o `openssl` da
máquina, sobe o servidor com `ssl=on` e conecta apontando `DB_CA_CERT` para o CA
gerado. A senha é **gerada por execução**. Cada cenário recebe uma **base nova e
vazia**, migrada pelo mesmo caminho do comando. Se o binário não rodar na
plataforma, a suíte **falha alto** — nunca é pulada em silêncio.

**Rationale**: o clarify deixou a decisão com o Arquiteto, e o ambiente não tem
Docker nem servidor de banco instalado à mão. Uma emulação em processo não
provaria o que precisa ser provado: dialeto, `CHECK`, `BYTEA`, chave primária
composta, `ON DELETE CASCADE`, tradução de SQLSTATE, trava consultiva e — o mais
importante — **verificação de certificado**, que só se exerce contra um servidor
TLS de verdade. Baixar o binário pela devDependency atende ao mesmo tempo a
premissa de não depender de Docker e o Princípio VI: a bateria compartilhada roda
dentro de `npm test`, e não sob promessa. Falhar alto quando o binário não roda é
a escolha correta contra o Princípio X: uma suíte que se pula sozinha aprova o que
não testou. Nenhuma credencial é versionada: senha e CA nascem a cada execução.

**Prova**: `npm test` inclui a bateria inteira contra PostgreSQL (SC-044), o teste
de TLS recusa uma conexão cujo certificado não se confirma (SC-047) e nenhum
arquivo versionado contém senha, chave privada ou CA (SC-045).

**Alternativas rejeitadas**: contêiner, proibido pela premissa de ambiente;
emulação em processo, que não provaria dialeto nem TLS; servidor instalado à mão
pelo desenvolvedor, que transformaria a verificação em procedimento local e
frágil; pular a suíte quando o binário não roda, que aprovaria sem verificar;
usar uma instância de nuvem compartilhada nos testes, que exigiria segredo
versionado ou variável de ambiente em CI (Princípio VIII).

## Decisão 9 — Dois pacotes, escolhidos na construção, e o comando de migração empacotado

**Decisão**: a tabela de entradas de `backend/scripts/construir.mjs` ganha
`postgresql → src/entradas/nuvem.ts`, e o comando de migração é empacotado como
segunda entrada do mesmo armazenamento, em `dist/postgresql/migrar.mjs`. O
`package.json` ganha `build:cloud`, `migrate:cloud` e `start:cloud`; os scripts de
`009` não são tocados. `pg-native` é marcado **externo**. A construção **não**
exige `DB_URL`.

**Rationale**: FR-117 exige um script de construção e um de início para a nuvem, e
o desenho de `009` — um pacote por armazenamento, escolhido na construção — é o
que garante que o pacote local não contenha `pg` e que os da nuvem não contenham o
Adapter local nem `node:sqlite`. A exclusão é **consequência** do grafo, não
limpeza posterior. FR-114 exige explicitamente que a construção não precise do
segredo: empacotar é ler código, e a URL só é necessária para executar. Marcar
`pg-native` externo é o que impede o empacotamento de falhar ao encontrar uma
dependência opcional que nunca é usada.

**Prova**: um teste executa `--banco=postgresql` e inspeciona os dois artefatos,
exigindo a presença do Adapter de PostgreSQL e a **ausência** de `node:sqlite` e do
diretório `sqlite/`; constrói o pacote local e exige a ausência de `pg`; e confirma
que a construção passa sem `DB_URL` no ambiente (SC-050).

**Alternativas rejeitadas**: escolher o banco em tempo de execução, que faria o
pacote conter os dois Adapters; usar `tsc` para emitir os dois pontos de entrada,
que não empacota grafo nem remove o Adapter alheio; deixar o comando de migração
fora do pacote, rodando por `ts-node`, que faria o mesmo código ter duas formas de
execução.

## Decisão 10 — Saída e mensagens sem segredo: só o tipo de armazenamento, e o SQLSTATE como diagnóstico

**Decisão**: o início imprime **uma** linha, antes de escutar:
`Armazenamento: PostgreSQL (nuvem)`, e nada mais sobre o armazenamento. O comando
de migração imprime o resultado da migração e a versão resultante, nunca a URL.
Toda falha de driver é reduzida a **mensagem genérica em português** mais o
**SQLSTATE** — e a construção e o início recusados **não repetem o valor
informado**.

**Rationale**: FR-118 exige que a URL e qualquer segredo de conexão não apareçam na
saída nem no registro, inclusive quando a URL for recusada, e que no início se
informe apenas o tipo de armazenamento. O SQLSTATE é código de erro padronizado,
não valor sensível, e é o que mantém a falha diagnosticável — o que é critério de
qualidade (manutenibilidade) sem custo para o Princípio VIII. Não repetir o valor
informado numa recusa é a mesma regra que `009` já aplicou ao parâmetro de
construção.

**Prova**: o teste de entrada exige a linha exata no início e nenhuma ocorrência do
valor de `DB_URL`, da senha ou de endereço com credencial na saída e no registro,
também nos casos de recusa (FR-118, SC-045, SC-046).

**Alternativas rejeitadas**: exibir o host para facilitar a operação, que é parte
do endereço com credencial; repassar `err.message` do driver, que normalmente traz
host, usuário e base; registrar tudo em arquivo de log, que a premissa de execução
não pede e que criaria um arquivo com segredo; imprimir a URL truncada, que ainda
revela usuário e host.

## Decisão 11 — A hospedagem fica fora, e o loopback continua

**Decisão**: o modelo de hospedagem — serviço de execução, exposição de rede,
segredo de origem e handler serverless, se houver — **não** é desenhado aqui; é
assunto posterior a estas features. O servidor
continua escutando **apenas** no loopback, como `001` garantiu.

**Rationale**: a spec declara a hospedagem entre as funcionalidades adiadas, e a
premissa de `009` diz o mesmo. Misturar aqui a exposição de rede faria esta feature
responder por uma decisão de infraestrutura que não é dela, e o loopback é garantia
de runtime que nenhuma exigência desta feature pede para rever. O que esta feature
entrega é o **banco** e a configuração de execução que o aponta.

**Alternativas rejeitadas**: escolher agora o serviço de execução e o handler, que
seria antecipação contra o Princípio VII; deixar o servidor acessível de fora para
"já preparar a nuvem", que contrariaria a garantia de loopback sem requisito.

## Omissões deliberadas

| Omitido | Motivo |
|---|---|
| Modelo de hospedagem, handler serverless, rede e segredo de origem | Adiado na spec; posterior a estas features |
| Migração de dados do arquivo local para a base PostgreSQL | Adiada na spec: os dois armazenamentos não se falam |
| Ajuste do conjunto de conexões | Adiado na spec; a piscina tem máximo pequeno e fixo |
| Réplicas de leitura e cópias de segurança | Adiadas na spec |
| Qualquer banco além de PostgreSQL na nuvem | Adiado na spec, e a Porta não precisa dele |
| DDL das migrações 4 e 5 | Planos de `007` e `008`; aqui fica apenas o mapeamento de dialeto e o lugar |
| Autenticação de Usuário na conexão além de usuário e senha da URL | Sem requisito; certificado de cliente, IAM e afins não são pedidos |
| Emenda à constituição | O Princípio IV é satisfeito por acréscimo, e o Princípio VIII é cumprido com rigor, não relaxado |

Nenhum marcador `NEEDS CLARIFICATION` permanece: a forma de verificação, o comando
de migração e o sentido de "nuvem" foram resolvidos no clarify de 2026-09-21.

## Referência rápida: onde cada requisito desta feature é decidido

| Requisito | Decisão |
|---|---|
| FR-110, FR-111 | 1, 5, 8, 9 |
| FR-112 | 5, 6 |
| FR-113, FR-114 | 3, 9, 10 |
| FR-115 | 4, 8 |
| FR-116 | 6, 7 |
| FR-117 | 9, 11 |
| FR-118 | 2, 3, 5, 10 |
| FR-119 | 2 |
| FR-121 | 7 |
| FR-044, FR-045 | 2, 5, 7 |
| SC-044 a SC-050 | 1 a 10 |
