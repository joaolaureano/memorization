# Tasks: Hospedagem na AWS

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/` e
`quickstart.md`

**Depende de**: `008-entrar` **já implementada** — a Credencial apresentada em
cada requisição, que esta feature faz atravessar o CloudFront sem introduzir
sessão, cookie ou token —, de `009-porta-de-persistencia` e
`010-postgresql-na-nuvem` **já implementadas** — a Porta, o Adapter de PostgreSQL,
a validação da URL de conexão, a conferência de versão do esquema e o comando de
migração da nuvem, tudo usado **sem alteração** —, e da infraestrutura de OpenTofu
já mesclada em `backend/terraform` (CloudFront servindo o SPA de um S3 privado, a
API sob `/api/*` com o prefixo removido na borda, `/health` roteado para a API, a
Function URL pública protegida pelo segredo de origem e os segredos num parameter
store), que é o contrato de integração. Sem a `010` implementada não há Adapter a
abrir pela função, nem URL a validar, nem versão de esquema a conferir, nem
comando de migração a executar antes de publicar.

**Executor**: pelo **Princípio XI**, todo código sob `backend/`, `frontend/` e
`backend/terraform/` — isto é, as **Fases 1 a 3** — é escrito por subagentes
DeepSeek, inclusive o apoio de teste do handler. As tarefas da **Fase 4** são do
**Arquiteto**: são ações de operador, com as credenciais dele (Neon e AWS), e a
verificação automatizada **não** as exige. O `e2e/` **não** é tocado por esta
feature.

## Formato

O estado de cada tarefa é a **caixa de seleção**: `- [ ]` pendente, `- [X]`
concluída. É esse marcador que o comando `implement` lê e atualiza. Os metadados
exigidos pelo processo ficam na tabela recolhida de cada fase.

`[P]` = paralelizável: arquivos disjuntos, sem dependência mútua.

---

## Fase 1 — Função da nuvem

- [ ] T1001 A Seam `LeitorDeSegredos` lê os três segredos numa chamada, e parâmetro ausente falha nomeando o nome, nunca o valor
- [ ] T1002 Toda requisição sem o segredo de origem correto é recusada com 403 indistinguível, antes de qualquer trabalho de Credencial
- [ ] T1003 A política permissiva de outra origem é uma opção, desligada pela função e mantida como hoje na execução local
- [ ] T1004 A entrada da função monta a aplicação uma vez por contêiner, não escuta em porto algum e descarta a inicialização que falhou
- [ ] T1005 O handler responde 403, 200 e 401 por eventos sintéticos, grava no PostgreSQL real e não vaza segredo nem cabeçalho permissivo

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T1001 | A Interface `LeitorDeSegredos` devolve os três segredos — URL de conexão, segredo de origem e segredo do servidor das Senhas — numa operação; o Adapter de produção faz **uma** chamada `GetParameters` com os três nomes sob `${SSM_PREFIX}` e `WithDecryption: true`, e o Adapter de memória devolve os valores do cenário; nome ausente ou devolvido vazio é falha de inicialização com mensagem em português que **nomeia o parâmetro** e nada do valor | FR-077, FR-123 · SC-052 | 007 e 010 (implementadas) | `LeitorDeSegredos` · `SegredosDaFuncao` · `ParametroAusenteError` · `leitorDeSegredosDoSsm(prefixo)` · `leitorDeSegredosEmMemoria(valores)` | `backend/src/funcao/segredos.ts`, `backend/src/funcao/ssm.ts`, `backend/tests/funcao/segredos.test.ts`, `backend/tests/funcao/segredos-em-memoria.ts`, `backend/package.json` | `codebase-design` | `tests/funcao/segredos.test.ts`, com um cliente de SSM de mentira no lugar da Interface: **uma** chamada `GetParameters` com os três nomes sob o prefixo informado e `WithDecryption: true`; um nome ausente, ou devolvido vazio, produz `ParametroAusenteError` cuja mensagem nomeia o parâmetro (`/memorization/DB_URL`) e não contém valor algum; a mensagem do SDK **nunca** é propagada; nenhuma chamada de rede acontece; o Adapter em memória devolve os três valores ou falha do mesmo modo; `@aws-sdk/client-ssm` entra como `devDependency` e `npm run typecheck` passa com os seus tipos | O SSM é substituído pela Interface nos testes, os três segredos chegam numa leitura só, e a ausência de um deles é falha diagnosticável que não reproduz valor algum — nem na saída, nem no registro, nem na mensagem |
| T1002 | `exigirSegredoDeOrigem` é registrada como o **primeiro** `onRequest` da aplicação: lê o cabeçalho `x-origin-secret`, confere o **tamanho** e compara com `timingSafeEqual`, respondendo `403` com o mesmo corpo genérico em **todos** os casos de recusa — ausente, curto, longo ou errado —, sem `WWW-Authenticate` e sem `Set-Cookie`, inclusive em `/health` | FR-125 · SC-053 | 008 (implementada) | `exigirSegredoDeOrigem(servidor, esperado)` · `criarServidor(identidade, { segredoDeOrigem })` | `backend/src/http/origem.ts`, `backend/src/http/servidor.ts`, `backend/tests/http/origem.test.ts` | `codebase-design` | `tests/http/origem.test.ts`: sem o cabeçalho e com o cabeçalho errado, o status e o corpo são **idênticos** (`{"sucesso":false,"mensagem":"Proibido"}`) e nenhuma resposta traz `WWW-Authenticate` ou `Set-Cookie`; com o cabeçalho certo a rota responde; a rota de acervo **não** responde `401` antes do `403`, prova de que a guarda vem antes do hook da Credencial; `/health` com o segredo responde `200` e sem ele `403`; a conferência de tamanho acontece antes do `timingSafeEqual` e nada é impresso no caminho | A recusa por origem é indistinguível entre cabeçalho ausente, curto, longo e errado, e nenhuma requisição que não veio do CloudFront chega ao trabalho de verificar Senha |
| T1003 | `criarServidor` recebe a opção `politicaDeOutraOrigem` — padrão `true`, o comportamento de hoje — e, com `false`, **não** registra o pré-voo nem acrescenta `access-control-allow-origin`, de modo que nenhuma resposta da função traz cabeçalho permissivo; as entradas que escutam no loopback continuam com o padrão, sem uma linha de edição | FR-128 · SC-056 | T1002 | `criarServidor(identidade, opcoes?)` · `politicaDeOutraOrigem` | `backend/src/http/servidor.ts`, `backend/tests/http/cors.test.ts` | `codebase-design` | `tests/http/cors.test.ts`: com `politicaDeOutraOrigem: false`, respostas de sucesso **e** de recusa não trazem nenhum `access-control-*` e o pré-voo não é respondido; com o padrão, o cabeçalho permissivo continua presente e o pré-voo respondido, como hoje; nenhuma rota, hook ou tratamento de erro é duplicado, e `local.ts` e `nuvem.ts` não são editados | A ausência do cabeçalho em produção é **por construção** — uma opção na mesma construção de servidor —, e a execução local responde exatamente como antes |
| T1004 | `criarFuncao(leitor, opcoes?)` monta a aplicação **uma vez por contêiner**: a promise de inicialização vive **fora** do handler e é **descartada** na falha, de modo que a requisição seguinte inicializa de novo; o servidor é montado **sem** `listen` e com a política de outra origem desligada, e `src/entradas/lambda.ts` exporta `handler` no formato da Function URL (payload v2) por `@fastify/aws-lambda` | FR-122, FR-126, FR-127, FR-131 · SC-054, SC-055 | T1001, T1002, T1003 | `criarFuncao(leitor, opcoes?)` · `handler` exportado · `@fastify/aws-lambda` (dependência de execução) | `backend/src/funcao/funcao.ts`, `backend/src/entradas/lambda.ts`, `backend/package.json` | `codebase-design` | Exercitada por `tests/funcao/funcao.test.ts` (T1005): `listen` não aparece em nenhum caminho da função; os segredos descem prontos — a URL validada pelo `010`, o segredo das Senhas validado pela regra do `007` e o segredo de origem para a guarda; esquema atrasado recusa a inicialização e `aplicarMigracoes` **nunca** é chamado; duas invocações concorrentes compartilham a mesma promise; a falha persistente mantém o `503` e a aplicação **nunca** passa por pronta | A função monta sem porto algum, a inicialização é paga uma vez por contêiner, uma falha não é memorizada e a função nunca migra |
| T1005 | O `handler` exportado é exercitado localmente com eventos **sintéticos** de Function URL (payload v2), leitor em memória e a URL de conexão apontando a uma base nova do PostgreSQL **real** com TLS do apoio de teste do `010`: 403 sem segredo e com segredo errado, 200 em `/health` com o segredo e sem Credencial, 401 sem Credencial, a ida e volta autenticada de Cartão, Baralho e Vínculo, a inicialização que falha e é **retentada**, a recusa por esquema atrasado sem nenhuma migração, a ausência de cabeçalho permissivo e a ausência de valor de segredo na saída, no registro e nas respostas | FR-044, FR-045, FR-078, FR-079, FR-122, FR-123, FR-126, FR-127, FR-131, FR-133 · SC-051, SC-052, SC-054, SC-055, SC-058, SC-060 | T1004 | `criarFuncao` · `handler` · `LeitorDeSegredos` em memória | `backend/tests/funcao/funcao.test.ts`, `backend/tests/funcao/segredos-em-memoria.ts`, `backend/tests/armazenamento/postgresql/` | `codebase-design` | `tests/funcao/funcao.test.ts`: leitor que falha na primeira chamada e responde na segunda exige `503` na primeira requisição e sucesso na seguinte; falha persistente exige `503` em todas, sem nenhuma resposta de sucesso; banco inalcançável responde `503`, nada aparece como concluído e o conteúdo informado continua disponível para nova tentativa; base atrasada recusa a inicialização e **nenhuma** migração é aplicada; nenhuma resposta traz `Set-Cookie`, cabeçalho reutilizável ou valor de `DB_URL`, de senha, do segredo de origem ou do segredo das Senhas; os valores são gerados pelo cenário, nunca versionados | A verificação da entrega acontece **sem publicar na AWS**, com o PostgreSQL real com TLS por trás, e nenhum desfecho é afirmado sem teste |

</details>

---

## Fase 2 — Pacotes

- [ ] T1006 `npm run build:lambda` produz `dist/lambda/lambda.mjs` e `dist-lambda.zip`, com `lambda.mjs` na raiz, sem exigir segredo algum
- [ ] T1007 O pacote da função não contém o Adapter local nem `node:sqlite`, e o pacote local não contém a entrada da função
- [ ] T1008 [P] `npm run build:aws` constrói o SPA apontando a API para `/api`, e o script de publicação passa a usá-lo

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T1006 | A tabela de entradas de `construir.mjs` ganha `lambda` — `src/entradas/lambda.ts` → `dist/lambda/lambda.mjs` **e** `backend/dist-lambda.zip`, com `lambda.mjs` na **raiz** do zip, feito pela ferramenta `zip` da máquina —, com `@aws-sdk/*` e `pg-native` externos; `npm run build:lambda` existe, `scripts/build-lambda.sh` passa a ser uma **chamada fina** a ele e `dist-lambda*` entra no `.gitignore` versionado | FR-130 · SC-057 | T1004 | `construir.mjs` · scripts do `package.json` · `dist-lambda.zip` | `backend/scripts/construir.mjs`, `backend/package.json`, `backend/terraform/scripts/build-lambda.sh`, `.gitignore` | `codebase-design` | `tests/armazenamento/construcao.test.ts` e `tests/armazenamento/scripts.test.ts`: o alvo produz os dois artefatos e uma mensagem que nomeia o alvo; o zip tem `lambda.mjs` na raiz; a construção passa com o ambiente **sem** segredo algum; sem parâmetro, com forma diferente e com valor não aceito a recusa continua com código `1`, sem repetir o valor informado, sem produzir artefato, e a mensagem passa a listar `sqlite, postgresql, lambda`, derivada da tabela; falha de empacotamento remove o diretório e o zip | O pacote da função é um único empacotamento num zip no caminho que a infraestrutura espera, e empacotar continua sendo ler código — sem ler nem exigir segredo |
| T1007 | A suíte de construção é estendida e comprova o conteúdo de cada pacote nos **dois** sentidos: o da função não contém o Adapter do armazenamento local, `node:sqlite` nem o SDK da AWS — que é externo —, e o local não contém a entrada da função nem `pg`; o pacote da função construído é iniciado por `node` e responde | FR-120, FR-130 · SC-057 | T1006 | `construir.mjs` · conteúdo do pacote | `backend/tests/armazenamento/construcao.test.ts`, `backend/tests/armazenamento/`, `backend/dist/lambda/` | `codebase-design` | Depois de construir os três alvos, a inspeção do artefato exige `node:sqlite` e o Adapter do armazenamento local ausentes de `dist/lambda/`; a entrada da função ausente de `dist/sqlite/servidor.mjs`; nenhum pacote referencia o Adapter do outro lado; `pg-native` nunca aparece como dependência a resolver; o pacote da função roda sob `node` com o leitor em memória | A exclusividade de cada pacote é consequência do grafo do empacotamento e é medida por inspeção do artefato, não afirmada |
| T1008 | [P] O `package.json` do frontend ganha `build:aws` (`VITE_ENDERECO_DA_API=/api npm run build`), o SPA de produção passa a apontar o endereço da API para `/api`, e `deploy-frontend.sh` passa a chamá-lo em vez de passar a variável na linha de comando; sem a variável, o padrão do endereço local continua valendo | FR-129 · SC-057 | 001 (implementada) | scripts do `package.json` do frontend · `VITE_ENDERECO_DA_API` | `frontend/package.json`, `backend/terraform/scripts/deploy-frontend.sh` | `codebase-design` | A construção de produção é executada e o pacote gerado contém `/api` como endereço da API e **nenhuma** ocorrência de `127.0.0.1`; a construção sem a variável continua apontando o endereço local; nenhuma tela, componente ou cliente muda, e `npm run lint` passa no frontend | Existe um caminho único e nomeado para a construção de produção, e o navegador publicado chama o CloudFront na mesma origem, sem pré-voo de outra origem |

</details>

---

## Fase 3 — Infraestrutura

- [ ] T1009 [P] O segredo do servidor das Senhas existe no cofre sob o mesmo prefixo dos outros dois, e o comentário aponta para o lugar certo
- [ ] T1010 [P] A memória da função é uma variável de 1024 MB, aplicada sem número fixo
- [ ] T1011 O código de infraestrutura passa por formato e validação sem credencial AWS, e nenhum valor de segredo está versionado

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T1009 | [P] `ssm.tf` ganha `random_password.segredo_das_senhas` (`length = 64`, `special = false`) e a chave `SEGREDO_DAS_SENHAS` em `local.secrets`, ao lado de `DB_URL` e `ORIGIN_SECRET`, sob o **mesmo** prefixo; o comentário que hoje reserva o lugar do segredo de sessão passa a nomear o segredo do servidor das Senhas, e não um inventário que sai do repositório | FR-077, FR-124 · SC-052 | infraestrutura já mesclada | `local.secrets` · `aws_ssm_parameter.secret` · `random_password` | `backend/terraform/ssm.tf` | `codebase-design` | `tofu validate` (T1011) prova a referência, e o `plan` do operador (T1012) mostra **três** parâmetros sob o mesmo prefixo; a policy de leitura continua montada a partir do **mapa** de parâmetros, sem uma linha de IAM nova; a varredura do repositório e do state não encontra valor de segredo, porque os três continuam `SecureString` write-only | Os três segredos que a função lê existem no cofre sob o mesmo prefixo, e acrescentar o terceiro não pediu uma linha de permissão nova |
| T1010 | [P] A memória da função deixa de ser número fixo e passa a ser a variável `lambda_memory_mb`, com padrão **1024**, aplicada a `memory_size` | FR-132 · SC-059 | infraestrutura já mesclada | `var.lambda_memory_mb` · `memory_size` | `backend/terraform/variables.tf`, `backend/terraform/lambda.tf` | `codebase-design` | `tofu validate` (T1011) prova a referência e o valor padrão no `plan` do operador (T1012); a medição que justifica o número é de T1013; runtime, arquitetura, timeout, ausência de VPC, Function URL `NONE` e as duas permissões de invocação continuam como estão | Elevar a memória é trocar um número, e nada mais muda na função |
| T1011 | O código de infraestrutura passa por `tofu fmt -check` e por `tofu init -backend=false && tofu validate` em `backend/terraform`, **sem** credencial AWS, sem state e sem `apply`, e a varredura do que o repositório versiona não encontra URL de conexão, senha, chave privada ou CA | FR-123, FR-133 · SC-060 | T1009, T1010 | — (código de infraestrutura, sem Interface de aplicação) | `backend/terraform/`, `backend/terraform/ssm.tf`, `backend/terraform/variables.tf`, `backend/terraform/lambda.tf` | `codebase-design` | As duas conferências do OpenTofu passam cem por cento, e são portões e não suíte; a leitura do repositório não encontra valor de segredo algum; a existência dos três parâmetros e a memória de 1024 MB são conferidas pelo `plan` do operador (T1012), que é ação dele e não da verificação automatizada | O formato e a validade do código de infraestrutura são medidos por comando, e a verificação não exigiu publicar na AWS |

</details>

---

## Fase 4 — Publicação e validação (tarefas do Arquiteto)

- [ ] T1012 A migração no endpoint direto, a aplicação com o pacote e a publicação do SPA deixam a aplicação real no ar, validada pelo endereço do CloudFront
- [ ] T1013 [P] O percentil 95 das operações simples na função fica abaixo de um segundo, e o remédio é memória
- [ ] T1014 [P] O manual de operação documenta a ordem, e o inventário de pendências sai do repositório com as notas do operador no README de infraestrutura

<details><summary>Metadados das tarefas desta fase</summary>

| ID | Objetivo observável | Requisitos | Depende | Module / Interface | Áreas | Skill | Testes | Concluída quando |
|---|---|---|---|---|---|---|---|---|
| T1012 | O operador migra o esquema com `npm run migrate:cloud` apontando ao endpoint **direto** do Neon, aplica a infraestrutura com `-var lambda_package=../dist-lambda.zip -var lambda_handler=lambda.handler` — publicando a aplicação real no lugar da stub, com os **três** parâmetros no cofre e a memória de 1024 MB —, publica o SPA por `deploy-frontend.sh` e valida pelo endereço do CloudFront: o SPA é servido, `/api/*` chega à função com o prefixo removido, `/health` responde a API, entrar com a Credencial e operar Cartões, Baralhos e Vínculos grava no PostgreSQL e reaparece depois de recarregar, a URL pública da função chamada direto responde `403`, a mesma chamada sem Credencial responde `401`, e nenhuma resposta traz cabeçalho permissivo de outra origem, cookie, sessão ou token; publicar antes de migrar é recusado pelo `503` que remete ao comando | FR-044, FR-045, FR-078, FR-079, FR-122, FR-124, FR-125, FR-127, FR-128, FR-129, FR-131, FR-134 · SC-051, SC-052, SC-053, SC-055, SC-056, SC-057, SC-058, SC-061 | T1007, T1008, T1011 | `migrate:cloud` · `tofu apply` · `deploy-frontend.sh` · `handler` publicado | `backend/terraform/`, `backend/terraform/scripts/deploy-frontend.sh`, `specs/011-hospedagem-aws/quickstart.md` | `codebase-design` | A validação é a do manual, passo a passo, pelo endereço do CloudFront e com o operador autenticado; cada desfecho é observado por requisição, e a saída, o registro da função e as respostas são inspecionados exigindo a ausência de qualquer valor de segredo | A aplicação real — e não a stub — está publicada atrás do CloudFront, com a porta da função fechada, e a ordem do manual foi seguida na íntegra; a publicação efetiva **não** é exigida da verificação automatizada |
| T1013 | [P] Com a função publicada e uma conta de teste, o operador mede o percentil 95 das operações simples — a verificação da Senha em cada requisição, por exemplo uma sequência de `GET /api/cartoes` autenticados pelo endereço do CloudFront — descartando os inícios a frio pelo log da função, e confirma que fica **abaixo de 1 segundo**; acima do limite, o remédio é elevar `lambda_memory_mb` | FR-132 · SC-059 | T1012 | `lambda_memory_mb` · endereço do CloudFront | `backend/terraform/variables.tf`, `specs/011-hospedagem-aws/quickstart.md` | `codebase-design` | A medição é o teste: os tempos observados e o p95 calculado ficam registrados, com os inícios a frio separados pelo log da função; nenhum caminho de código encurta a verificação da Senha — nem cache, nem sessão, nem reaproveitamento do resultado entre requisições | O p95 está abaixo do limite declarado, medido **na função**, e o ajuste, quando houve, foi memória — nunca a derivação da Senha |
| T1014 | [P] O manual de operação em `quickstart.md` documenta, na ordem, segredos e valores, migração no endpoint direto do Neon, construção do pacote, aplicação da infraestrutura e publicação do SPA, com **formas de espaço reservado**; `aws_pendencias.md` é **removido**, e as notas que são do operador — derrubar a stack, trocar um segredo e subir a versão, o state local, o lockfile dos provedores e as restrições do usuário `robot` — passam para `backend/terraform/README.md` | FR-134 · SC-061 | T1012 | — (documentação) | `aws_pendencias.md`, `backend/terraform/README.md`, `specs/011-hospedagem-aws/quickstart.md` | `codebase-design` | A leitura do repositório ao fim da feature **não** encontra o inventário, e cada nota do operador está no README de infraestrutura ou no manual; nenhum valor real de segredo, endereço ou conexão aparece nos documentos; os dois itens obsoletos do inventário não têm substituto | Existe **uma** fonte para o operador — o manual — mais o README de infraestrutura, sem inventário paralelo, e nenhum item de código continua aberto |

</details>

---

## Dependências e Ordem

```
T1001 ─┐
T1002 ─┼→ T1004 → T1005
T1003 ─┘        └→ T1006 → T1007

T1008 [P] ────────────────┐
T1009 ─┐                  │
T1010 ─┴→ T1011 ──────────┴→ T1012 ─┬→ T1013 [P]
                                     └→ T1014 [P]
```

Execução **serial por padrão**. O paralelismo declarado é T1008 com o par
T1006–T1007, por tocar apenas o frontend e o script de publicação; T1010 com
T1009, por tocarem arquivos disjuntos (a variável de memória e o terceiro
segredo); e T1013 com T1014, por exercerem coisas disjuntas (a medição na função
e a documentação).

**T1002 e T1003 não são paralelas**: as duas questões de borda vivem na **mesma**
construção de servidor, e a guarda da origem nasce primeiro. **T1004 depende de
T1001, T1002 e T1003**: a entrada só monta quando a Seam existe, o valor esperado
da guarda já chega pronto e a política de outra origem já é uma opção. **T1005
depende de T1004**: a suíte exercita o `handler` exportado, e não um caminho
paralelo. **T1006 depende de T1004 por uma razão de ordem, não de gosto**: a
tabela de entradas é derivada, e listar `lambda` antes de o arquivo de entrada
existir transforma um parâmetro válido em falha de empacotamento. **T1007 depende
de T1006**: sem o pacote não há artefato a inspecionar. **T1011 depende de T1009 e
de T1010**: as duas conferências formatam e validam o código depois das duas
mudanças. **T1012 depende de T1007, T1008 e T1011**: o operador precisa do zip, do
script de publicação do SPA e das duas mudanças de infraestrutura já validadas.
**T1013 e T1014 dependem de T1012**: a medição exige a função publicada, e o
inventário só sai quando nada dele continua aberto.

## Matriz de Rastreabilidade Requisito ↔ Tarefa

| Requisito | Tarefa |
|---|---|
| FR-044 | T1005, T1012 |
| FR-045 | T1005, T1012 |
| FR-077 | T1001, T1009 |
| FR-078 | T1005, T1012 |
| FR-079 | T1005, T1012 |
| FR-120 | T1007 |
| FR-122 | T1004, T1005, T1012 |
| FR-123 | T1001, T1005, T1011 |
| FR-124 | T1009, T1012 |
| FR-125 | T1002, T1012 |
| FR-126 | T1004, T1005 |
| FR-127 | T1004, T1005, T1012 |
| FR-128 | T1003, T1012 |
| FR-129 | T1008, T1012 |
| FR-130 | T1006, T1007 |
| FR-131 | T1004, T1005, T1012 |
| FR-132 | T1010, T1013 |
| FR-133 | T1005, T1011 |
| FR-134 | T1012, T1014 |

| Critério | Tarefa |
|---|---|
| SC-051 | T1005, T1012 |
| SC-052 | T1001, T1005, T1009, T1012 |
| SC-053 | T1002, T1012 |
| SC-054 | T1004, T1005 |
| SC-055 | T1004, T1005, T1012 |
| SC-056 | T1003, T1012 |
| SC-057 | T1006, T1007, T1008, T1012 |
| SC-058 | T1005, T1012 |
| SC-059 | T1010, T1013 |
| SC-060 | T1005, T1011 |
| SC-061 | T1012, T1014 |

## Notas

- Nenhuma tarefa exige decisão de produto ou de arquitetura do worker.
  Ambiguidade encontrada é reportada, não resolvida.
- Nenhuma tarefa cria Module, rota, tela, tabela ou coluna de domínio nova: a
  Interface da Porta não muda uma linha, a bateria compartilhada não é editada e
  nenhum Module é tocado. Todo o trabalho acontece na pasta nova da função, na
  guarda de borda, na opção da mesma construção de servidor, na entrada da
  função, no script de construção, no `package.json` do frontend, no código de
  infraestrutura e nos testes. O `e2e/` e o contrato HTTP ficam intocados.
- Nenhum valor de URL de conexão, de senha, de chave privada ou de CA aparece em
  arquivo versionado, em teste ou nesta lista: as credenciais dos testes são
  geradas por execução, e os documentos usam apenas a forma de espaço reservado.
- As tarefas da **Fase 4** são do Arquiteto, e não de subagentes DeepSeek, porque
  dependem das credenciais dele no Neon e na AWS e porque o `apply` e a medição
  na função são ações de operador. Elas **não** são exigidas da verificação
  automatizada: o que a entrega deve provar sozinha é a Fase 1 (com o PostgreSQL
  real de teste) e a Fase 2, mais as duas conferências da Fase 3.
- **Integração obrigatória, para `main` nunca ficar com a suíte vermelha**, em
  quatro blocos:
  - **Bloco da função: T1001 a T1005 no mesmo commit.** A guarda de origem sem a
    opção de servidor não é registrada, e a entrada da função sem a Seam não
    monta; o commit seguinte só poderia vir com a suíte vermelha, porque os
    testes do handler exercitam a fábrica pronta contra o banco real.
  - **Bloco dos pacotes: T1006 a T1008 no mesmo commit.** O alvo de construção e
    o script de publicação do SPA nascem juntos com os testes de conteúdo: o
    `package.json` passa a anunciar um script que, sem eles, não produz artefato
    algum, e `deploy-frontend.sh` passa a chamar um script que precisa existir.
  - **Bloco da infraestrutura: T1009 a T1011 no mesmo commit.** O terceiro
    segredo, a memória por variável e as duas conferências do OpenTofu andam
    juntos: um `.tf` sem formato canônico reprova o portão, e o portão sem as
    mudanças não prova nada de novo.
  - **Bloco da publicação, da medição e do manual: T1012 a T1014, na ordem.** A
    documentação só sai depois da publicação, porque o inventário sai quando
    nada dele continua aberto; a medição vem antes de o manual declarar o
    número que sustenta o p95.
- **T1005 é a prova central da feature**: o `handler` real é exercitado com o
  PostgreSQL real por trás, sem publicar na AWS, e é o que mede que a
  composição, as guardas e a persistência estão ligadas de verdade.
- **T1002 e T1003 são as verificações negativas da fase**: a prova é a
  **ausência** — de distinção entre as recusas por origem e de cabeçalho
  permissivo em produção —, e nunca inspeção de estado interno.
- **T1003 é também a prova de que a execução local não mudou**: o mesmo cenário
  com o padrão exige o cabeçalho permissivo e o pré-voo respondido, e nada é
  duplicado em um segundo servidor.
- **T1007 é a verificação de exclusividade**: o que se mede é o conteúdo do
  artefato construído, e não a intenção do empacotador; um pacote que carregue o
  outro armazenamento falha por leitura do próprio zip.
- **T1011 é o único portão que não é suíte**: sem credencial AWS, sem state e sem
  `apply`, ele mede formato e validade do código de infraestrutura; a existência
  dos três parâmetros e a memória ficam com o `plan` do operador.
- Nenhuma tarefa toca em `frontend/src`, no `e2e/`, no contrato HTTP ou em regra
  de domínio; nenhuma tarefa introduz sessão, cookie, token, firewall de
  aplicação, limitação de taxa, múltiplos ambientes ou encadeamento automático de
  implantação.
