# Feature Specification: Hospedagem na AWS

**Feature Branch**: `011-hospedagem-aws`
**Created**: 2026-09-21
**Status**: Draft
**Input**: Pedido do Product Owner de reunir o que foi feito no trabalho de
infraestrutura para o projeto ganhar a capacidade de AWS
e ficar pronto para subir na nuvem com PostgreSQL. O código de infraestrutura
(OpenTofu) já está mesclado no repositório. Glossário normativo em `CONTEXT.md`.

**Depende de**: `008-entrar` (a Credencial apresentada em cada requisição),
`009-porta-de-persistencia` e `010-postgresql-na-nuvem` (a Porta, o Adapter de
PostgreSQL, a URL de conexão e o comando de migração da nuvem) e a infraestrutura
já mesclada em `backend/terraform`: o CloudFront servindo o SPA de um S3 privado
e a API sob `/api/*` com o prefixo removido na borda, `/health` roteado para a
API, uma função atrás de uma URL pública protegida por um segredo de origem
injetado pelo CloudFront, os segredos num parameter store e o banco no Neon
PostgreSQL.

## Clarifications

### Session 2026-09-21

- Q: Nesta entrega o projeto é publicado de fato na AWS ou só preparado? → A:
  Preparado **e publicado**. O Arquiteto executa a migração no Neon, a aplicação
  da infraestrutura e o deploy do SPA, e valida SC-051 e SC-058 pelo endereço do
  CloudFront.
- Q: A entrada pelo provedor Google e o cookie de sessão, pendentes da
  infraestrutura, continuam no escopo? → A: Não, são obsoletas. A autenticação
  foi entregue pela `008-entrar` com a Credencial apresentada em cada
  requisição. Esta feature apenas faz a Credencial atravessar o CloudFront até a
  função e não introduz sessão, cookie ou token (FR-079). O segredo do servidor
  das Senhas, exigido pela `007`, deixa de ser um segredo de sessão e passa a ser
  um dos três segredos lidos pela função.
- Q: A função migra o esquema ao subir? → A: Não. Quem migra é o operador, com o
  comando de migração da nuvem de `010`, antes de publicar; a função confere a
  versão do esquema e recusa servir com esquema desatualizado.
- Q: A política permissiva de outra origem usada na execução local é enviada em
  produção? → A: Não. Em produção SPA e API dividem a origem do CloudFront, e a
  política permissiva permanece apenas na execução local, sem alteração.
- Q: Como a feature é verificada sem publicar na AWS? → A: O handler da função é
  exercitado localmente com eventos sintéticos contra o PostgreSQL de teste real,
  e o código de infraestrutura passa pelas conferências de formato e de
  validação. A publicação efetiva na AWS — o `apply` — é ação do operador, com as
  credenciais dele, fora das verificações automatizadas.
- Q: Que limite de desempenho a verificação da Senha precisa manter? → A: O
  percentil 95 das operações simples na função abaixo de 1 segundo, medido na
  função, o que pode exigir elevar a memória dela para 1024 MB.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Usar a aplicação publicada na AWS, com a API contra PostgreSQL (Priority: P1)

Quem opera sobe a aplicação na AWS: o SPA é servido pelo CloudFront a partir de
um recipiente privado e a API roda como a função da nuvem atrás da mesma
distribuição, gravando no PostgreSQL. A partir do endereço do CloudFront, quem
usa entra com a Credencial e opera o acervo como sempre: a chamada do navegador
vai a `/api` na mesma origem, o prefixo é removido na borda antes de chegar à
função, e `/health` responde o estado real da API. A função não escuta em porto
algum, e a execução local continua escutando exclusivamente no loopback.

**Why this priority**: é a razão da feature — tornar a capacidade de AWS
utilizável. Sem a API rodando como a função da nuvem atrás do CloudFront, a
infraestrutura já mesclada continua servindo a stub, e a aplicação publicada não
passa de uma prova de ligação.

**Independent Test**: subir o SPA e a função atrás do CloudFront, abrir o
endereço da distribuição, entrar com uma Credencial criada no acervo e confirmar
que Cartões, Baralhos e Vínculos são criados, lidos e alterados contra o
PostgreSQL; confirmar que `/api/*` chega à função com o prefixo removido e que
`/health` responde o estado da função; confirmar que a API da nuvem não escuta em
porto algum e que a execução local continua restrita ao loopback.

**Acceptance Scenarios**:

1. **Given** a infraestrutura aplicada e o pacote da função publicado, **When** o
   endereço do CloudFront é aberto, **Then** o SPA é servido e as chamadas do
   navegador vão a `/api` na mesma origem.
2. **Given** a aplicação publicada, **When** uma pessoa entra com a Credencial e
   cria um Cartão e um Baralho, **Then** a operação é gravada no PostgreSQL e
   reaparece numa nova leitura e depois de recarregar a página.
3. **Given** uma chamada a `/api/cartoes` pelo endereço do CloudFront, **When**
   ela alcança a função, **Then** o prefixo `/api` já foi removido na borda e a
   rota `/cartoes` da aplicação responde.
4. **Given** o endereço do CloudFront, **When** `/health` é chamado, **Then** a
   função responde o estado da API, e não o SPA.
5. **Given** a API da nuvem em execução, **When** a função é inspecionada,
   **Then** nenhum porto de rede é aberto por ela.
6. **Given** a execução local, **When** a aplicação sobe, **Then** continua
   escutando exclusivamente no loopback, com a garantia de hoje inalterada.
7. **Given** a aplicação publicada em uso, **When** qualquer tela é aberta,
   **Then** nenhuma tela, campo ou ação nova aparece e nenhum comportamento de
   `001` a `008` mudou.

---

### User Story 2 - Fechar a porta da função e ler os segredos do cofre (Priority: P2)

A função da nuvem só é alcançável pelo CloudFront: quem chamar a URL pública da
função direto, sem o segredo de origem que só o CloudFront injeta, é recusado com
403 sem saber por quê, e a comparação do segredo não revela o valor esperado pelo
tempo de resposta. No início a frio, a função lê do parameter store, sob o prefixo
configurado, os seus três segredos — a URL de conexão do banco, o segredo de
origem e o segredo do servidor das Senhas —, e a infraestrutura provisiona os
três. Se a inicialização falhar, a requisição é respondida como falha e a
requisição seguinte tenta de novo: uma inicialização que falhou não fica
memorizada.

**Why this priority**: é o que impede que a API real publicada fique exposta a
quem descobrir a URL pública da função, e o que garante que os segredos venham do
cofre, e não de arquivo versionado. Só ganha valor depois de a API rodar como
função.

**Independent Test**: chamar a URL pública da função direto, sem o segredo de
origem e com um segredo errado, e exigir 403 sem revelar o motivo e sem
diferença de tempo entre os dois casos; chamar o mesmo caminho pelo CloudFront e
confirmar que chega à aplicação; subir a função sem um dos segredos no cofre e
confirmar que a requisição é respondida como falha e que a seguinte tenta a
inicialização de novo; inspecionar a saída, o registro e as respostas e exigir a
ausência de qualquer valor de segredo.

**Acceptance Scenarios**:

1. **Given** a URL pública da função, **When** ela é chamada direto, sem passar
   pelo CloudFront, **Then** a resposta é 403 e nada do motivo é revelado.
2. **Given** a URL pública da função, **When** ela é chamada direto com o segredo
   de origem errado, **Then** a recusa é idêntica à do caso sem segredo, inclusive
   no tempo de resposta.
3. **Given** o CloudFront, **When** a requisição chega à função com o segredo de
   origem injetado, **Then** a requisição alcança a aplicação.
4. **Given** o início a frio, **When** a função sobe, **Then** ela lê do parameter
   store, sob o prefixo configurado, a URL de conexão, o segredo de origem e o
   segredo do servidor das Senhas.
5. **Given** o segredo do servidor das Senhas, **When** a infraestrutura é
   provisionada, **Then** os três segredos existem no parameter store sob o mesmo
   prefixo.
6. **Given** um segredo ausente no cofre, o banco inalcançável ou o esquema
   desatualizado no início a frio, **When** a primeira requisição chega, **Then**
   ela é respondida como falha, e **When** a próxima requisição chega, **Then**
   ela tenta a inicialização de novo, sem herdar o resultado falho.
7. **Given** a função em execução, **When** a saída, o registro e as respostas são
   inspecionados, **Then** nenhum valor de segredo aparece, e nenhum arquivo
   versionado contém esses valores.

---

### User Story 3 - Implantar, migrar e verificar pela ordem do manual (Priority: P3)

Quem opera segue o manual de operação para publicar: provisiona os segredos e os
valores, migra o esquema com o comando de migração da nuvem apontando ao endpoint
direto do Neon, constrói o pacote da função — um único empacotamento num zip no
caminho que a infraestrutura espera, sem o Adapter do armazenamento local —,
aplica a infraestrutura e publica o SPA. O SPA é construído para produção
apontando o endereço da API para `/api`. Antes de publicar, a entrega é
verificada sem tocar na AWS: o handler da função é exercitado localmente com
eventos sintéticos contra o PostgreSQL de teste real, o código de infraestrutura
passa por formato e validação, e o desempenho da verificação da Senha é medido.

**Why this priority**: é o que transforma a capacidade de AWS numa implantação
repetível e verificável. Tem esta prioridade porque só ganha valor depois de a
função e a proteção existirem, e porque a publicação efetiva na AWS é ação do
operador, não da verificação automatizada.

**Independent Test**: seguir o manual numa máquina de desenvolvimento e confirmar
que a ordem está documentada e é executável — segredos e valores, migração no
endpoint direto, construção do pacote, aplicação e publicação do SPA; construir o
pacote e conferir que é um único empacotamento num zip e que não contém o Adapter
do armazenamento local; exercitar o handler localmente com eventos sintéticos
contra o PostgreSQL de teste real e confirmar os desfechos de sucesso e de
recusa; rodar as conferências de formato e de validação do código de
infraestrutura; medir o percentil 95 das operações simples na função.

**Acceptance Scenarios**:

1. **Given** o manual de operação, **When** ele é lido, **Then** a ordem de
   provisionamento está documentada: segredos e valores, migração do esquema com
   o comando de migração da nuvem no endpoint direto do Neon, construção do
   pacote, aplicação da infraestrutura e publicação do SPA.
2. **Given** o script de construção do backend, **When** ele é executado,
   **Then** produz o pacote da função — um único empacotamento num zip no caminho
   que a infraestrutura espera —, e o pacote não contém o Adapter do
   armazenamento local.
3. **Given** o script de publicação do frontend, **When** ele é executado,
   **Then** o SPA é construído para produção com o endereço da API em `/api` e é
   publicado.
4. **Given** o handler da função, **When** ele é exercitado localmente com eventos
   sintéticos contra o PostgreSQL de teste real, **Then** os desfechos de sucesso
   e de recusa são confirmados, sem publicar na AWS.
5. **Given** o código de infraestrutura, **When** as conferências de formato e de
   validação são executadas, **Then** cem por cento delas passa.
6. **Given** a função com a memória elevada, **When** o percentil 95 das
   operações simples — a verificação da Senha em cada requisição — é medido,
   **Then** ele fica abaixo de 1 segundo.
7. **Given** o operador que publica antes de migrar, **When** a função é chamada,
   **Then** ela recusa servir com o esquema desatualizado e remete ao comando de
   migração da nuvem.

---

### Edge Cases

- **Segredo do servidor das Senhas ausente do cofre**: a função recusa atender, a
  requisição é respondida como falha e a próxima tenta a inicialização de novo.
- **Banco inalcançável no início a frio**: a requisição é respondida como falha, e
  a próxima tenta de novo.
- **Esquema desatualizado**: a função recusa servir; a solução é o comando de
  migração da nuvem, do operador, antes de publicar.
- **Requisição direta à URL pública da função**: recusada com 403, sem revelar o
  motivo.
- **Segredo de origem errado**: a recusa é indistinguível da recusa por segredo
  ausente, inclusive no tempo de resposta.
- **Requisição pelo CloudFront**: chega à função com o segredo de origem injetado
  e com o prefixo `/api` já removido na borda.
- **SPA e API na mesma origem**: o navegador não faz pré-voo de outra origem, e a
  função não envia o cabeçalho permissivo.
- **Execução local**: continua escutando exclusivamente no loopback e continua com
  a política permissiva de outra origem de hoje.
- **Pacote construído com o armazenamento errado**: recusado pela construção,
  porque cada pacote carrega apenas o seu armazenamento.
- **Memória da função abaixo do necessário**: o limite do percentil 95 da
  verificação da Senha é medido e exige elevar a memória da função.
- **Segredo de conexão no ambiente de execução**: nunca aparece em arquivo
  versionado, saída, registro ou resposta (Princípio VIII).

## Requirements *(mandatory)*

### Functional Requirements

**Transversais reutilizados**, com enunciado genérico e observáveis nesta
feature:

- **FR-044**: O sistema MUST NOT apresentar como concluída qualquer operação que
  não tenha sido efetivamente persistida.
- **FR-045**: Quando uma operação falhar por indisponibilidade do armazenamento,
  o sistema MUST reportar a falha e MUST preservar o conteúdo informado,
  permitindo nova tentativa sem redigitação.
- **FR-078**: O sistema MUST NOT devolver a Senha em nenhuma leitura, MUST NOT
  exibi-la de volta, MUST NOT registrá-la em log e MUST NOT gravá-la no
  navegador.
- **FR-079**: O sistema MUST NOT criar sessão, cookie ou token.

**Específicos desta feature**, por tratarem da hospedagem na AWS. Esta feature
entrega a execução da API como função da nuvem atrás do CloudFront, a proteção
por segredo de origem, a leitura dos segredos do cofre, o empacotamento, a
publicação do SPA e o manual de operação; a Porta, o Adapter de PostgreSQL, a URL
de conexão e o comando de migração da nuvem pertencem a `009` e a `010`, e a
Credencial pertence a `008`.

- **FR-122**: O sistema MUST executar a API, na nuvem, como a função da AWS atrás
  do CloudFront, por uma entrada de função para a nuvem que grava no PostgreSQL, e
  essa execução MUST NOT escutar em porto algum; a garantia de escuta exclusiva no
  loopback da execução local MUST permanecer sem alteração.
- **FR-123**: A função MUST ler, no início a frio, os seus três segredos — a URL
  de conexão do banco, o segredo de origem e o segredo do servidor das Senhas
  (FR-077) — do parameter store sob o prefixo configurado, e MUST NOT obtê-los de
  arquivo versionado nem de outra fonte; nenhum valor de segredo MUST aparecer na
  saída, no registro ou em resposta, inclusive quando a leitura falhar.
- **FR-124**: A infraestrutura MUST provisionar o segredo do servidor das Senhas
  junto da URL de conexão e do segredo de origem, sob o mesmo prefixo, de modo que
  os três segredos lidos pela função existam no ambiente.
- **FR-125**: O sistema MUST recusar com 403, sem revelar o motivo, toda
  requisição que não trouxer o segredo de origem correto, e a comparação do
  segredo MUST ser feita em tempo constante.
- **FR-126**: Quando a inicialização falhar — segredo ausente, banco inalcançável
  ou esquema desatualizado —, a requisição que a provocou MUST ser respondida como
  falha, e a próxima requisição MUST tentar a inicialização de novo; uma
  inicialização que falhou MUST NOT ficar memorizada.
- **FR-127**: O esquema MUST ser migrado pelo operador, com o comando de migração
  da nuvem de `010`, antes de publicar; a função MUST NOT migrar, e MUST recusar
  servir com o esquema desatualizado.
- **FR-128**: Em produção, com SPA e API na mesma origem do CloudFront, a função
  MUST NOT enviar a política permissiva de outra origem usada na execução local; a
  execução local MUST manter essa política como hoje.
- **FR-129**: O SPA MUST ser construído para produção apontando o endereço da API
  para `/api`, de modo que o navegador chame o CloudFront na mesma origem.
- **FR-130**: O sistema MUST oferecer um script de backend que produza o pacote da
  função — um único empacotamento num zip no caminho que a infraestrutura espera —
  sem o Adapter do armazenamento local, e um script que publique o SPA; o pacote
  local MUST NOT conter a entrada da função, e o pacote da função MUST NOT conter
  o Adapter do armazenamento local (FR-120).
- **FR-131**: A Credencial (Nome de usuário e Senha) MUST atravessar o CloudFront
  até a função, apresentada em cada requisição, e o sistema MUST NOT introduzir
  sessão, cookie ou token (FR-079); os invariantes de `008-entrar` MUST permanecer
  válidos na nuvem.
- **FR-132**: O custo da verificação da Senha em cada requisição MUST manter o
  percentil 95 das operações simples da função abaixo do limite declarado, medido
  na função e não na execução local, o que pode exigir elevar a memória dela.
- **FR-133**: A verificação MUST ser possível sem publicar na AWS: o handler da
  função MUST ser exercitado localmente com eventos sintéticos contra o PostgreSQL
  de teste real, e o código de infraestrutura MUST passar pelas conferências de
  formato e de validação. A publicação efetiva na AWS é ação do operador e MUST
  NOT ser exigida pela verificação automatizada.
- **FR-134**: O manual de operação MUST documentar a ordem de provisionamento —
  segredos e valores, migração do esquema com o comando de migração da nuvem
  apontando ao endpoint direto do Neon, construção do pacote, aplicação da
  infraestrutura e publicação do SPA — como a ordem a ser seguida.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-123 | Nenhum valor de segredo aparece em arquivo versionado, na saída, no registro ou em resposta | Teste que sobe a função com os três segredos no cofre e inspeciona saída, registro e respostas exigindo ausência da URL de conexão, de senha, de cadeia de conexão, do segredo de origem e do segredo do servidor; teste que procura esses valores no que o repositório versiona e exige que nenhum arquivo versionado os contenha; teste que provoca segredo ausente e exige a mesma ausência |
| FR-125 | Requisição sem o segredo de origem correto nunca chega à aplicação | Teste que exercita o handler com evento desprovido de segredo de origem e com segredo errado e exige 403 sem revelar o motivo, e teste que exige tempo indistinguível entre segredo ausente e segredo errado |
| FR-128 | Nenhum cabeçalho permissivo de outra origem em produção | Teste que exercita a função em modo de produção e exige ausência do cabeçalho permissivo nas respostas, e teste que exercita a execução local e exige a presença dele como hoje |
| FR-130 | O pacote de um armazenamento não contém a entrada do outro | Teste que constrói o pacote local e exige a ausência da entrada da função e da dependência de PostgreSQL, e teste que constrói o pacote da função e exige a ausência do Adapter do armazenamento local |
| FR-079 | Não existe sessão, cookie ou token na aplicação publicada | Teste que, entrando pela aplicação publicada, exige ausência de cookie e de qualquer valor reutilizável nas respostas e no navegador |

### Key Entities

- **Função da nuvem**: a execução da API na AWS, atrás do CloudFront, que grava no
  PostgreSQL e não escuta em porto algum. Substitui a stub que a infraestrutura
  publicava, sem alterar o contrato de rotas.
- **Segredo de origem**: o valor que só o CloudFront conhece e injeta nas
  requisições à função. Toda requisição sem ele é recusada; não é credencial de
  Usuário nem substitui a Credencial.
- **Cofre de segredos**: o parameter store sob o prefixo configurado, de onde a
  função lê os três segredos no início a frio. Mantém a URL de conexão, o segredo
  de origem e o segredo do servidor das Senhas fora de arquivos versionados.
- **SPA publicado**: a interface construída para produção, servida pelo CloudFront
  a partir de um recipiente privado, com o endereço da API apontado para `/api`.
- **Pacote da função**: o único empacotamento, num zip no caminho que a
  infraestrutura espera, sem o Adapter do armazenamento local.
- **Credencial**: o par Nome de usuário e Senha de `008-entrar`, apresentado em
  cada requisição e que atravessa o CloudFront até a função. Continua existindo
  apenas na memória da página aberta.
- **Manual de operação**: a ordem documentada de provisionamento, migração,
  construção, aplicação e publicação.

## Success Criteria *(mandatory)*

- **SC-051**: Em cem por cento dos acessos pelo endereço do CloudFront, o SPA é
  servido, as chamadas a `/api/*` chegam à função com o prefixo removido e
  `/health` responde o estado da função; entrar com a Credencial e operar Cartões,
  Baralhos e Vínculos funciona contra o PostgreSQL, e a API da nuvem não escuta em
  porto algum.
- **SC-052**: Em cem por cento dos inícios a frio, os três segredos são lidos do
  parameter store sob o prefixo configurado, incluindo o segredo do servidor das
  Senhas provisionado pela infraestrutura, e nenhum valor de segredo aparece em
  arquivo versionado, na saída, no registro ou em resposta.
- **SC-053**: Em cem por cento das requisições sem o segredo de origem correto, a
  resposta é 403 sem revelar o motivo, com tempo indistinguível entre segredo
  ausente e segredo errado.
- **SC-054**: Uma inicialização que falhou nunca é memorizada: em cem por cento das
  requisições seguintes, a falha persiste enquanto durar a causa e a requisição
  seguinte tenta a inicialização de novo, sem que a aplicação passe por pronta.
- **SC-055**: Em cem por cento das implantações, a migração é feita pelo comando de
  migração da nuvem antes de publicar, a função nunca migra, e servir com esquema
  desatualizado é recusado.
- **SC-056**: Em cem por cento das respostas de produção, com SPA e API na mesma
  origem do CloudFront, o cabeçalho permissivo de outra origem não é enviado; na
  execução local, ele continua sendo enviado como hoje.
- **SC-057**: Em cem por cento das construções de produção, o SPA aponta o
  endereço da API para `/api` e o pacote da função é um único empacotamento num
  zip no caminho que a infraestrutura espera, sem o Adapter do armazenamento
  local.
- **SC-058**: Em cem por cento das operações na aplicação publicada, a Credencial
  atravessa o CloudFront até a função, e nenhuma sessão, cookie ou token é criado
  (FR-079).
- **SC-059**: O percentil 95 das operações simples — a verificação da Senha em cada
  requisição — responde em menos de 1 segundo na função de 1024 MB, medido na
  função e não na execução local.
- **SC-060**: Cem por cento das verificações do handler passam localmente, com
  eventos sintéticos contra o PostgreSQL de teste real, e cem por cento das
  conferências de formato e de validação do código de infraestrutura passam, sem
  exigir publicação na AWS.
- **SC-061**: O manual de operação documenta a ordem de provisionamento — segredos
  e valores, migração no endpoint direto do Neon, construção do pacote, aplicação
  da infraestrutura e publicação do SPA — e cem por cento das implantações a
  seguem.

## Invariantes de Domínio

1. A API na nuvem roda como a função da AWS atrás do CloudFront, sem escutar em
   porto algum; a garantia de escuta exclusiva no loopback da execução local
   permanece.
2. Os três segredos — URL de conexão, segredo de origem e segredo do servidor das
   Senhas — vivem no parameter store sob o prefixo configurado; nenhum valor de
   segredo é versionado, exibido, registrado ou devolvido.
3. Toda requisição sem o segredo de origem correto é recusada com 403, sem revelar
   o motivo, com comparação em tempo constante.
4. A função nunca migra: quem migra é o operador, com o comando de migração da
   nuvem; a função recusa servir com esquema desatualizado.
5. A falha de inicialização não é memorizada: a próxima requisição tenta de novo.
6. Em produção, SPA e API dividem a origem do CloudFront, e a política permissiva
   de outra origem vale apenas na execução local.
7. A Credencial é a única forma de acesso: não existe sessão, cookie ou token
   (FR-079).
8. Esta feature não acrescenta tela, campo ou ação para quem usa a aplicação.

## Funcionalidades Adiadas

- O domínio próprio e o certificado digital próprio.
- A firewall de aplicação e a limitação de taxa.
- O bloqueio por tentativas de Entrar.
- O encadeamento automático de construção e implantação.
- Os múltiplos ambientes, inclusive um ambiente de homologação.
- A automação da criação do projeto no Neon por linha de comando.
- O roteamento do SPA por caminho, no lugar de por `location.hash`.

## Assumptions

- A aplicação na AWS — o `apply` da infraestrutura — é feita pelo operador, com as
  credenciais AWS dele, e não pelas verificações automatizadas desta feature.
- O projeto no Neon já existe, e a URL de conexão dele é o valor entregue ao cofre
  sob o prefixo configurado.
- A região e os nomes dos recursos são os das variáveis da infraestrutura já
  mesclada, e a Credencial de `008-entrar` chega à função intacta.
- O código de infraestrutura (OpenTofu) já está mesclado no repositório, e esta
  feature o usa como a base do contrato de integração: o SPA servido pelo
  CloudFront a partir de um S3 privado, a API sob `/api/*` com o prefixo removido
  na borda, `/health` roteado para a API, a função atrás de uma URL pública
  protegida pelo segredo de origem e os segredos num parameter store.
- As premissas de `001-criar-cartao` a `010-postgresql-na-nuvem` valem: execução
  local com o armazenamento local, persistência entre execuções e nenhum segredo
  em arquivo versionado (Princípio VIII).
- A entrada pelo provedor Google e o cookie de sessão, antes pendentes da
  infraestrutura, são obsoletas: a Credencial de `008-entrar` é a única forma de
  acesso, e esta feature não introduz sessão, cookie ou token.
- A forma de verificação sem publicar na AWS, a ordem do manual de operação, a
  política de outra origem em produção e o limite de desempenho foram confirmados
  no clarify de 2026-09-21.
- Decisões de ferramenta de empacotamento, formato do evento da função, nome dos
  scripts e forma do manual pertencem ao `plan` desta feature.
