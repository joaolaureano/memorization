# Feature Specification: Porta de Persistência

**Feature Branch**: `009-porta-de-persistencia`
**Created**: 2026-09-21
**Status**: Draft
**Input**: Pedido do Product Owner de poder escolher o banco na construção do
backend, decomposto em duas features: `009-porta-de-persistencia` (esta) e
`010-postgresql-na-nuvem`. Glossário normativo em `CONTEXT.md`.

**Depende de**: `001-criar-cartao` a `006-excluir-cartao-e-baralho`, cujo acervo
passa a persistir pela Porta, sem mudança de comportamento. É base para
`007-criar-usuario` e `008-entrar`.

## Clarifications

### Session 2026-09-21

- Q: O que o parâmetro de build deve produzir? → A: Um pacote executável por
  banco. O build local contém só o Adapter do armazenamento local, e o build da
  nuvem só o de PostgreSQL. O início local e o da nuvem executam o pacote
  correspondente.
- Q: A 009 deve ser implementada antes da 007 e da 008? → A: Sim. A ordem de
  implementação é 009, 010, 007 e 008, e as features 007 e 008 são construídas
  diretamente sobre a Porta.
- Q: O servidor continua escutando só na própria máquina, inclusive com
  PostgreSQL? → A: Sim. A hospedagem em nuvem é tratada
  depois de concluídas as features, e não faz parte da 009 nem da 010.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Construir o backend escolhendo o armazenamento (Priority: P1)

Quem constrói o backend informa qual armazenamento será usado. Com o
armazenamento local a aplicação sobe e grava em arquivo local; sem esse
parâmetro, ou com um valor não aceito, a construção é recusada com mensagem
clara em português e nenhum artefato executável é produzido. Ao iniciar, a
aplicação informa qual armazenamento está em uso, sem revelar segredo algum.

**Why this priority**: é o pedido literal do Product Owner — poder passar
parâmetros na construção para dizer qual banco será usado. Sem isso, escolher
entre a execução local e a nuvem dependeria de editar código, e um engano
apareceria em produção em vez de na construção.

**Independent Test**: construir e iniciar com o armazenamento local e confirmar
que a aplicação sobe, informa o armazenamento em uso e grava em arquivo local;
construir sem o parâmetro e com um valor não aceito, confirmando a recusa, a
mensagem em português que nomeia os valores aceitos e a ausência de artefato
executável.

**Acceptance Scenarios**:

1. **Given** o parâmetro que escolhe o armazenamento local, **When** o backend é
   construído e iniciado, **Then** a aplicação sobe, grava em arquivo local e
   informa na saída qual armazenamento está em uso.
2. **Given** nenhum parâmetro de armazenamento, **When** o backend é construído,
   **Then** a construção é recusada com mensagem clara em português que nomeie
   os valores aceitos, e nenhum artefato executável é produzido.
3. **Given** um valor não aceito no parâmetro de armazenamento, **When** o
   backend é construído, **Then** a recusa é a mesma do caso anterior.
4. **Given** um valor que nomeia um armazenamento que esta feature não entrega,
   **When** o backend é construído, **Then** o valor é recusado como não aceito,
   com a mesma mensagem do caso anterior.
5. **Given** um valor de parâmetro com aparência de credencial — um endereço de
   conexão com senha, por exemplo —, **When** a construção é recusada, **Then**
   a mensagem nomeia os valores aceitos sem repetir o valor informado, e nada
   dele aparece na saída nem no registro da aplicação.
6. **Given** o arquivo local indisponível — em diretório somente leitura, por
   exemplo —, **When** a aplicação é iniciada, **Then** a falha é reportada e a
   aplicação não segue como se o armazenamento existisse.

---

### User Story 2 - Continuar rodando localmente como hoje (Priority: P2)

Quem usa a aplicação continua a executá-la localmente como sempre: Cartões,
Baralhos, Vínculos e Sessões de estudo funcionam igual, o conteúdo permanece
entre execuções e as migrações versionadas continuam sendo aplicadas. A
persistência passou a atravessar a Porta, e nada disso é visível para quem usa.

**Why this priority**: é o que torna a mudança segura. Uma Porta que alterasse
um comportamento de `001` a `006` seria uma troca de arquitetura paga com
regressão, e é exatamente o que o Product Owner não pediu.

**Independent Test**: executar a bateria de verificação existente de `001` a
`006`, sem alteração de significado, e confirmar que passa integralmente; subir
a aplicação por um único comando a partir de uma cópia limpa do repositório,
criar conteúdo, encerrar, subir de novo e confirmar que o conteúdo permanece;
confirmar que nenhuma tela, campo ou ação nova aparece.

**Acceptance Scenarios**:

1. **Given** a bateria de verificação existente de `001` a `006`, **When** a
   aplicação roda com o armazenamento local, **Then** cem por cento dela passa
   sem alteração de significado.
2. **Given** a aplicação iniciada localmente, **When** o conteúdo é criado, a
   aplicação é encerrada e iniciada de novo, **Then** todo o conteúdo continua
   presente e correto.
3. **Given** uma base criada por uma versão anterior, **When** a aplicação
   inicia com o armazenamento local, **Then** as migrações versionadas são
   aplicadas como antes, preservando os dados que as regras atuais mantêm e
   descartando apenas o que elas já mandavam descartar.
4. **Given** uma cópia limpa do repositório, **When** o comando de inicialização
   local é executado, **Then** a aplicação sobe sem nenhuma configuração prévia,
   usando o arquivo local no caminho padrão.
5. **Given** o caminho do arquivo local configurado, **When** a aplicação
   inicia, **Then** o arquivo usado é o informado, e o caminho padrão continua
   valendo quando nada é configurado.
6. **Given** a aplicação em uso, **When** qualquer tela é aberta, **Then**
   nenhuma tela, campo ou ação nova aparece e nenhum comportamento de `001` a
   `006` mudou.

---

### User Story 3 - Trocar o armazenamento concreto sem tocar nos Modules (Priority: P3)

Quem mantém o código acrescenta um segundo armazenamento concreto — o da `010`
— como um Adapter da Porta, e nenhum Module do acervo, nem o da identidade, é
alterado. A prova da troca é uma bateria única de cenários da Porta, que todo
Adapter precisa passar.

**Why this priority**: é o que faz a aplicação rodar localmente com SQLite e na
nuvem com PostgreSQL sem duplicar regra nem ramificar código. Tem esta
prioridade porque só ganha valor depois de a Porta e o armazenamento local
existirem.

**Independent Test**: inspecionar as dependências de cada Module e confirmar que
nenhum conhece armazenamento concreto; executar a bateria compartilhada contra o
Adapter do armazenamento local, exigindo cem por cento de aprovação; apontar a
mesma bateria para um segundo Adapter e confirmar que ela não muda e que nenhum
Module foi alterado.

**Acceptance Scenarios**:

1. **Given** os Modules do acervo e os da identidade, **When** as dependências de
   cada Module são inspecionadas, **Then** nenhum conhece, nomeia ou importa
   armazenamento concreto.
2. **Given** a bateria compartilhada de cenários da Porta, **When** ela roda
   contra o Adapter do armazenamento local, **Then** cem por cento passa.
3. **Given** a bateria compartilhada, **When** um segundo Adapter é
   acrescentado, **Then** é a mesma bateria que o exercita, sem cenário escrito
   duas vezes e sem Module alterado.
4. **Given** um Module que precisa ler ou gravar, **When** ele opera, **Then**
   usa a Porta, e nenhuma operação recebe escolha de armazenamento.
5. **Given** o armazenamento indisponível, **When** uma operação é tentada,
   **Then** a Porta reporta a falha ao chamador e a operação não passa por
   concluída.

---

### Edge Cases

- **Parâmetro de armazenamento ausente**: a construção é recusada com mensagem
  em português que nomeia os valores aceitos.
- **Valor não aceito no parâmetro**: mesma recusa, e nenhum artefato executável é
  produzido.
- **Valor com aparência de credencial**: a recusa não repete o valor informado,
  e nada dele aparece na saída nem no registro da aplicação.
- **Arquivo local inexistente**: é criado, e o esquema é aplicado como hoje.
- **Arquivo local indisponível**: o início falha com a falha reportada, e a
  aplicação não segue como se o armazenamento existisse.
- **Base em versão anterior de migração**: as migrações versionadas continuam
  sendo aplicadas, sem perder o que as regras atuais mantêm.
- **Um segundo Adapter acrescentado**: a bateria compartilhada é a única prova
  exigida da Porta, e nenhum Module muda.
- **Cópia limpa do repositório**: o comando de inicialização local funciona sem
  configuração prévia, usando o caminho padrão do arquivo local.
- **Segredo de conexão no ambiente de execução**: nunca aparece em mensagem,
  saída ou registro, e nunca é versionado (Princípio VIII).

## Requirements *(mandatory)*

### Functional Requirements

**Transversais reutilizados**, com enunciado genérico e observáveis nesta
feature:

- **FR-044**: O sistema MUST NOT apresentar como concluída qualquer operação que
  não tenha sido efetivamente persistida.
- **FR-045**: Quando uma operação falhar por indisponibilidade do armazenamento,
  o sistema MUST reportar a falha e MUST preservar o conteúdo informado,
  permitindo nova tentativa sem redigitação.

**Específicos desta feature**, por tratarem do armazenamento. Esta feature
entrega a Porta, o Adapter do armazenamento local, a escolha por parâmetro e a
bateria compartilhada; o Adapter de PostgreSQL, a URL de conexão, a proteção da
conexão e os scripts de nuvem pertencem à `010-postgresql-na-nuvem`.

- **FR-100**: O sistema MUST concentrar todo acesso a dados persistidos numa
  única Porta de armazenamento, e nenhum Module MUST conhecer, nomear ou
  importar o armazenamento concreto: o armazenamento entra na construção do
  backend por um Adapter da Porta.
- **FR-101**: O sistema MUST permitir escolher o armazenamento na construção do
  backend, por um parâmetro informado a quem constrói, e MUST oferecer o
  armazenamento local — SQLite, em arquivo local — como a escolha da execução
  local.
- **FR-102**: O sistema MUST recusar construir e iniciar quando o parâmetro de
  armazenamento estiver ausente ou não for um valor aceito, com mensagem clara
  em português que nomeie os valores aceitos, e MUST NOT produzir artefato
  executável nessa condição.
- **FR-103**: O Adapter do armazenamento local MUST gravar em arquivo local, com
  o caminho do arquivo configurável e o padrão de hoje preservado, e MUST ser o
  Adapter usado na execução local.
- **FR-104**: O Adapter do armazenamento local MUST preservar os dados entre
  execuções da aplicação e MUST manter as migrações versionadas e as regras já
  existentes de descarte e de manutenção de dados, sem alteração.
- **FR-105**: Com o Adapter do armazenamento local, todos os comportamentos
  entregues por `001` a `006` MUST permanecer idênticos, e esta feature MUST NOT
  acrescentar tela, campo ou ação para quem usa a aplicação.
- **FR-106**: A Porta MUST ser verificada por uma única bateria compartilhada de
  cenários, aplicável a qualquer Adapter, e cem por cento dela MUST passar
  contra o Adapter do armazenamento local; a mesma bateria MUST ser reutilizada
  pelo Adapter de PostgreSQL da `010-postgresql-na-nuvem`.
- **FR-107**: A Porta MUST reportar ao chamador a falha do armazenamento e MUST
  NOT deixar a operação passar por concluída quando nada foi persistido.
- **FR-108**: O sistema MUST informar no início da execução qual armazenamento
  está em uso e MUST NOT exibir nem registrar qualquer segredo de conexão —
  senha, cadeia de conexão ou endereço com credencial —, inclusive quando o
  parâmetro informado for recusado.
- **FR-109**: A aplicação MUST oferecer, entre os seus scripts de inicialização,
  um que sobe a aplicação com o Adapter do armazenamento local, iniciável por um
  único comando a partir de uma cópia limpa do repositório. O caminho de
  inicialização da nuvem é apenas declarado nesta feature e é entregue pela
  `010-postgresql-na-nuvem`.
- **FR-120**: O pacote construído para um armazenamento MUST NOT conter o
  Adapter do outro armazenamento.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-100 | Nenhum Module conhece o armazenamento concreto | Teste que inspeciona as dependências de cada Module do acervo e da identidade e exige que nenhum importe armazenamento concreto, e teste que executa a bateria compartilhada contra um Adapter substituído sem alterar Module algum |
| FR-102 | Construção sem parâmetro de armazenamento válido não produz artefato executável | Teste que constrói e inicia sem o parâmetro e com valor não aceito, exigindo recusa, mensagem em português que nomeie os valores aceitos e nenhum artefato executável produzido |
| FR-108 | Nenhum segredo de conexão aparece na saída nem no registro | Teste que informa um parâmetro de armazenamento com aparência de credencial e exige a recusa com mensagem que nomeie os valores aceitos sem repetir o valor informado, e teste que sobe a aplicação e exige ausência de senha, cadeia de conexão e endereço com credencial na saída e no registro |
| FR-044 | Operação não persistida não aparece como concluída | Teste com o armazenamento indisponível, que exige a falha reportada, a aplicação não funcionando como se o armazenamento existisse e nenhuma operação apresentada como concluída |
| FR-120 | O pacote de um armazenamento não contém o Adapter do outro | Teste que constrói o pacote local e exige a ausência do Adapter de PostgreSQL e de sua dependência, e vice-versa quando a `010` existir |

### Key Entities

- **Porta de armazenamento**: a Interface única por onde todo Module lê e grava
  dados persistidos. Esconde o armazenamento concreto e é a única coisa que os
  Modules conhecem.
- **Adapter**: a implementação concreta da Porta. Nesta feature, o Adapter do
  armazenamento local, que grava em arquivo local; a `010` acrescenta o Adapter
  de PostgreSQL, apontado por URL de conexão.
- **Armazenamento**: o banco de dados em uso, escolhido por parâmetro na
  construção do backend. Nesta feature, o arquivo local, no caminho padrão de
  hoje e configurável.
- **Parâmetro de escolha do armazenamento**: o valor informado na construção que
  determina qual Adapter será usado. O valor em uso é visível no início da
  execução; nenhum segredo de conexão acompanha.
- **Módulos do acervo e da identidade**: quem persiste. Dependem apenas da Porta
  e permanecem idênticos em comportamento a `001` a `006`.

## Success Criteria *(mandatory)*

- **SC-038**: Cem por cento da bateria de verificação já existente de `001` a
  `006` passa, sem alteração de significado, com o Adapter do armazenamento
  local, e nenhuma tela, campo ou ação nova é oferecida a quem usa a aplicação.
- **SC-039**: A bateria compartilhada de cenários da Porta passa em cem por
  cento contra o Adapter do armazenamento local, e é a mesma bateria que o
  Adapter de PostgreSQL da `010-postgresql-na-nuvem` reutiliza.
- **SC-040**: Em cem por cento das construções com o parâmetro de armazenamento
  ausente ou com valor não aceito, a construção é recusada com mensagem em
  português que nomeia os valores aceitos, e nenhum artefato executável é
  produzido.
- **SC-041**: A partir de uma cópia limpa do repositório, um único comando sobe
  a aplicação com o armazenamento local, e cem por cento do conteúdo criado
  continua presente e correto depois de encerrar e iniciar de novo.
- **SC-042**: Em cem por cento dos inícios, o armazenamento em uso é informado
  sem revelar senha, cadeia de conexão ou endereço com credencial, e nenhum
  desses valores aparece na saída nem no registro da aplicação, inclusive quando
  o parâmetro informado é recusado.
- **SC-043**: Em cem por cento dos Modules, nenhuma dependência com
  armazenamento concreto é encontrada, e acrescentar um segundo Adapter não
  exige alterar nenhum Module.

## Invariantes de Domínio

1. Todo acesso a dados persistidos atravessa a Porta; nenhum Module conhece,
   nomeia ou importa o armazenamento concreto.
2. A Porta é a mesma para todos os Modules e para todos os Adapters, e nenhuma
   operação escolhe armazenamento.
3. O armazenamento é escolhido por parâmetro na construção do backend; a
   ausência do parâmetro ou um valor não aceito impede a construção e o início.
4. Com o Adapter do armazenamento local, a persistência entre execuções, as
   migrações versionadas e as regras de descarte e de manutenção de dados são as
   que `001` a `006` já têm.
5. Nenhum segredo de conexão é exibido, registrado ou versionado, nem em
   mensagem de recusa.
6. Esta feature não acrescenta tela, campo ou ação para quem usa a aplicação.

## Funcionalidades Adiadas

- O Adapter de PostgreSQL, a URL de conexão, a proteção da conexão e os scripts
  de nuvem — feature `010-postgresql-na-nuvem`.
- A migração de dados entre o arquivo local e a base em nuvem.
- Qualquer banco de dados além de SQLite, na execução local, e PostgreSQL, na
  nuvem.
- A hospedagem em nuvem: servidor, rede, container e orquestração.
- A escolha do armazenamento em tempo de execução, por requisição ou por quem
  usa a aplicação.
- Um armazenamento separado por Module, ou por Usuário, na `008-entrar`.

## Assumptions

- A escolha no build, a ordem de implementação e a permanência do servidor na
  máquina local foram confirmadas no clarify de 2026-09-21.
- O Product Owner nomeou os dois armazenamentos: SQLite, na execução local, e
  PostgreSQL, na nuvem, apontado por URL de conexão. Esta feature entrega apenas
  o primeiro, e a URL de conexão é assunto da `010`.
- O armazenamento local continua sendo SQLite em arquivo, com o caminho padrão
  de hoje, e o arquivo não é versionado.
- As premissas de `001-criar-cartao` valem: execução local, texto simples,
  persistência entre execuções.
- Decisões de linguagem, driver, formato do parâmetro de armazenamento e forma
  dos scripts pertencem ao `plan` desta feature.
