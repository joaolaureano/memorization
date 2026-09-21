# Feature Specification: PostgreSQL na Nuvem

**Feature Branch**: `010-postgresql-na-nuvem`
**Created**: 2026-09-21
**Status**: Draft
**Input**: Pedido do Product Owner de usar PostgreSQL exclusivamente na nuvem,
apontado por URL de conexão; o parâmetro de construção escolhe o banco, e os
scripts de inicialização separam o início local do início da nuvem. Segunda
parte da decomposição do pedido de escolher o banco na construção do backend:
`009-porta-de-persistencia` (a Porta, a bateria compartilhada, o parâmetro de
construção e o script local) e `010-postgresql-na-nuvem` (esta). Glossário
normativo em `CONTEXT.md`.

**Depende de**: `009-porta-de-persistencia`, de onde vêm a Porta de
armazenamento, a bateria compartilhada de cenários, o parâmetro de construção
que escolhe o banco e o script de início local. Nenhum Module do acervo nem o da
identidade é alterado por esta feature.

## Clarifications

### Session 2026-09-21

- Q: Como o Adapter de PostgreSQL é verificado, sem Docker? → A: O PO delegou a
  decisão ("Não se preocupe com isso"). Decisão do Arquiteto: a bateria
  compartilhada roda contra um PostgreSQL real, iniciado pelos próprios testes
  na máquina de desenvolvimento, sem Docker e sem segredo versionado.
- Q: As migrações rodam sozinhas no início ou por comando separado? → A: Por
  comando separado de migração para a nuvem, executado uma vez por implantação.
  O início da nuvem só confere a versão do esquema e recusa iniciar se ela
  estiver desatualizada.
- Q: "Exclusivamente na nuvem" proíbe usar um PostgreSQL local? → A: Não.
  "Nuvem" é a configuração de construção e início, e não a localização física da
  base; os testes usam um PostgreSQL local. Decorre da primeira resposta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gravar na nuvem com PostgreSQL, apontado por URL de conexão (Priority: P1)

Quem opera a aplicação na nuvem a executa contra PostgreSQL, apontado por uma
URL de conexão lida do ambiente. O Adapter de PostgreSQL entra na construção pelo
mesmo parâmetro de armazenamento de `009`, e a bateria compartilhada de cenários
da Porta passa integralmente contra ele. Numa base nova e vazia, as migrações
versionadas trazem o esquema à versão corrente, e repetir a subida não reaplica o
que já foi aplicado. O conteúdo continua entre execuções, e uma queda da conexão
não derruba a próxima operação.

**Why this priority**: é a razão da feature — sem o Adapter de PostgreSQL não há
nuvem. A prova de que ele é um Adapter legítimo da Porta é a bateria
compartilhada de `009` passando inteira, e é ela que garante que PostgreSQL e o
armazenamento local não duplicam regra nem ramificam código.

**Independent Test**: construir para a nuvem, subir apontando uma URL de conexão,
executar a bateria compartilhada de cenários da Porta contra o Adapter de
PostgreSQL exigindo cem por cento de aprovação, e confirmar que o conteúdo criado
permanece depois de encerrar e subir de novo; apontar a conexão para uma base
nova e vazia e confirmar que o esquema chega à versão corrente sem reaplicar o já
aplicado.

**Acceptance Scenarios**:

1. **Given** o parâmetro de construção que escolhe o armazenamento da nuvem,
   **When** o backend é construído e a URL de conexão está no ambiente,
   **Then** a aplicação sobe contra PostgreSQL e grava na base apontada.
2. **Given** a bateria compartilhada de cenários da Porta, **When** ela roda
   contra o Adapter de PostgreSQL, **Then** cem por cento passa, e é a mesma
   bateria usada contra o Adapter do armazenamento local, sem cenário escrito
   duas vezes.
3. **Given** a aplicação em nuvem em uso, **When** o conteúdo é criado, a
   aplicação é encerrada e subida de novo, **Then** todo o conteúdo continua
   presente e correto.
4. **Given** uma base PostgreSQL nova e vazia, **When** a aplicação sobe,
   **Then** as migrações versionadas trazem o esquema à versão corrente, e
   **When** a aplicação sobe de novo sobre a base já migrada, **Then** nenhuma
   migração já aplicada é reaplicada.
5. **Given** a conexão com a base em uso, **When** a conexão cai — conexões
   ociosas encerradas pelo provedor, por exemplo —, **Then** a próxima operação
   restabelece a conexão.
6. **Given** o armazenamento indisponível, **When** uma operação é tentada,
   **Then** a falha é reportada e a operação não passa por concluída.
7. **Given** os Modules do acervo e os da identidade, **When** as dependências de
   cada Module são inspecionadas, **Then** nenhum conhece, nomeia ou importa o
   armazenamento concreto, e acrescentar o Adapter de PostgreSQL não alterou
   nenhum Module.

---

### User Story 2 - Subir local e nuvem com scripts separados, sem misturar armazenamentos (Priority: P2)

Quem constrói e sobe o backend usa dois scripts de inicialização: um para a
execução local, como hoje, e um para a nuvem. O da nuvem sobe a aplicação com
PostgreSQL; o local nunca usa PostgreSQL, e o da nuvem nunca usa o armazenamento
local. Quem constrói ou sobe a nuvem sem a URL de conexão no ambiente é recusado
com mensagem clara em português que nomeia a variável de ambiente.

**Why this priority**: é o pedido literal do Product Owner — escolher o banco na
construção e separar por script o início local do início da nuvem. Sem isso, um
engano de configuração passaria em produção em vez de ser barrado na construção e
no início.

**Independent Test**: a partir de uma cópia limpa do repositório, executar o
script de início local e confirmar que sobe com o armazenamento local e que
nenhuma conexão a PostgreSQL é tentada; executar os scripts da nuvem com a URL de
conexão no ambiente, confirmando que a aplicação sobe contra PostgreSQL, e sem
ela ou com uma URL malformada, confirmando a recusa com mensagem em português que
nomeia a variável de ambiente.

**Acceptance Scenarios**:

1. **Given** uma cópia limpa do repositório, **When** o script de início local é
   executado, **Then** a aplicação sobe com o armazenamento local e nenhuma
   conexão a PostgreSQL é tentada.
2. **Given** o script de construção e o script de início da nuvem, **When** eles
   são usados com a URL de conexão no ambiente, **Then** a aplicação sobe contra
   PostgreSQL.
3. **Given** a URL de conexão ausente no ambiente, **When** o script de
   construção ou o de início da nuvem é executado, **Then** a construção ou o
   início é recusado com mensagem clara em português que nomeie a variável de
   ambiente, e a aplicação não segue como se o armazenamento existisse.
4. **Given** a URL de conexão malformada, **When** o script de construção ou o de
   início da nuvem é executado, **Then** a recusa é a mesma do caso anterior.
5. **Given** o script de início da nuvem, **When** ele é executado, **Then** o
   armazenamento usado é o PostgreSQL, e o armazenamento local não é usado.
6. **Given** a aplicação em nuvem em uso, **When** qualquer tela é aberta,
   **Then** nenhuma tela, campo ou ação nova aparece e nenhum comportamento de
   `001` a `006` mudou.

---

### User Story 3 - Proteger a URL de conexão e cifrar a conexão (Priority: P3)

A URL de conexão contém credenciais, portanto é segredo. Ela nunca é versionada,
exibida ou registrada — nem no início, nem em mensagem de recusa, nem no registro
da aplicação; no início informa-se apenas o tipo de armazenamento em uso. A
conexão à base é cifrada e o certificado do servidor é verificado; uma conexão
que não possa ser verificada é recusada, e nenhuma operação passa por concluída.

**Why this priority**: a infraestrutura de nuvem já existente entrega a URL por
variável de ambiente, e essa URL é uma credencial. Vazá-la num registro ou numa
mensagem de erro feriria o Princípio VIII; aceitar uma conexão não verificada
exporia a credencial em trânsito. Tem esta prioridade porque só ganha valor
depois de o Adapter de PostgreSQL existir.

**Independent Test**: subir a aplicação na nuvem e inspecionar a saída e o
registro, exigindo a ausência da URL de conexão, da senha e de qualquer endereço
com credencial, e a presença do tipo de armazenamento; provocar a recusa por URL
ausente e malformada e exigir a mesma ausência; apontar a conexão a um servidor
cujo certificado não se confirma e exigir a recusa, sem nenhuma operação
apresentada como concluída.

**Acceptance Scenarios**:

1. **Given** a aplicação subindo na nuvem, **When** o início conclui, **Then** a
   saída informa apenas o tipo de armazenamento em uso.
2. **Given** a URL de conexão no ambiente, **When** a aplicação sobe e a saída e
   o registro são inspecionados, **Then** nem a URL, nem a senha, nem qualquer
   endereço com credencial aparece.
3. **Given** a URL de conexão ausente ou malformada, **When** a construção ou o
   início é recusado, **Then** a mensagem nomeia apenas a variável de ambiente e
   nada do valor informado aparece na saída nem no registro da aplicação.
4. **Given** a URL de conexão, **When** ela é procurada no que o repositório
   versiona, **Then** nenhum arquivo versionado contém o seu valor.
5. **Given** uma conexão que não possa ser verificada — certificado do servidor
   que não se confirma, por exemplo —, **When** a aplicação tenta usá-la,
   **Then** a conexão é recusada e nenhuma operação passa por concluída.
6. **Given** uma conexão cifrada com certificado verificado, **When** a aplicação
   opera, **Then** a gravação acontece sobre a conexão cifrada, sem aviso nem
   degradação.

---

### Edge Cases

- **URL de conexão ausente**: a construção e o início da nuvem são recusados com
  mensagem em português que nomeia a variável de ambiente, e a aplicação não
  segue como se o armazenamento existisse.
- **URL de conexão malformada**: mesma recusa.
- **URL de conexão com aparência de credencial**: a recusa nomeia a variável de
  ambiente sem repetir o valor informado, e nada dele aparece na saída nem no
  registro da aplicação.
- **Base PostgreSQL nova e vazia**: as migrações versionadas trazem o esquema à
  versão corrente, e repetir a subida não reaplica o que já foi aplicado.
- **Conexão que não pode ser verificada**: é recusada, e nenhuma operação passa
  por concluída.
- **Conexão ociosa encerrada pelo provedor**: a próxima operação restabelece a
  conexão.
- **Armazenamento indisponível na nuvem**: as operações falham reportadas, e
  nenhuma passa por concluída, preservando o conteúdo informado para nova
  tentativa.
- **Script de início local**: nunca usa PostgreSQL.
- **Script de início da nuvem**: nunca usa o armazenamento local.
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

**Específicos desta feature**, por tratarem do armazenamento na nuvem. Esta
feature entrega o Adapter de PostgreSQL, a URL de conexão, a proteção da conexão
e os scripts de nuvem; a Porta, a bateria compartilhada, o parâmetro de construção
e o script local pertencem à `009-porta-de-persistencia`.

- **FR-110**: O sistema MUST oferecer um Adapter de PostgreSQL da Porta,
  selecionado pelo mesmo parâmetro de construção que escolhe o armazenamento,
  para a execução da nuvem, e nenhum Module do acervo nem o da identidade MUST
  conhecer, nomear ou importar o armazenamento concreto.
- **FR-111**: A bateria compartilhada de cenários da Porta MUST rodar contra o
  Adapter de PostgreSQL no pipeline de verificação, e cem por cento dela MUST
  passar, sem cenário escrito duas vezes e sem Module alterado.
- **FR-112**: O Adapter de PostgreSQL MUST preservar os dados entre execuções da
  aplicação e MUST manter as regras já existentes de descarte e de manutenção de
  dados, sem alteração.
- **FR-113**: A URL de conexão MUST ser lida da variável de ambiente `DB_URL` no
  início da execução da nuvem — nome imposto pela infraestrutura de nuvem
  existente —, e o sistema MUST NOT versioná-la nem obtê-la de outra fonte.
- **FR-114**: O sistema MUST recusar iniciar a execução da nuvem quando a URL
  de conexão estiver ausente ou malformada, com mensagem clara em
  português que nomeie a variável de ambiente `DB_URL` e MUST NOT repetir nem
  exibir o valor informado; nessa condição, a aplicação MUST NOT seguir como se o
  armazenamento existisse. A construção para a nuvem MUST NOT exigir a URL de
  conexão: o segredo só é necessário para executar.
- **FR-115**: A conexão à base MUST ser cifrada, e o certificado do servidor MUST
  ser verificado; uma conexão que não possa ser verificada MUST ser recusada, e
  nenhuma operação sobre ela MUST passar por concluída.
- **FR-116**: O sistema MUST oferecer um comando de migração para a nuvem que,
  numa base PostgreSQL nova e vazia, traga o esquema à versão corrente; repetir
  o comando MUST NOT reaplicar o que já foi aplicado.
- **FR-117**: O sistema MUST oferecer, entre os seus scripts de inicialização, um
  de construção para a nuvem e um de início para a nuvem; o script de início
  local MUST NOT usar PostgreSQL, e o script de início da nuvem MUST NOT usar o
  armazenamento local.
- **FR-118**: O sistema MUST NOT exibir nem registrar a URL de conexão nem
  qualquer segredo de conexão — senha, cadeia de conexão ou endereço com
  credencial —, inclusive quando a URL informada for recusada, e MUST informar no
  início da execução apenas o tipo de armazenamento em uso.
- **FR-119**: Quando a conexão com a base cair, a próxima operação MUST
  restabelecê-la; enquanto o armazenamento estiver indisponível, as operações
  MUST ser reportadas como falha (FR-044) e MUST NOT passar por concluídas
  (FR-045).
- **FR-121**: O início da nuvem MUST NOT aplicar migrações. Ele MUST conferir a
  versão do esquema e MUST recusar iniciar, com mensagem clara em português,
  quando o esquema estiver desatualizado.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-118 | A URL de conexão e qualquer segredo nunca aparecem na saída, no registro nem em arquivo versionado | Teste que sobe a aplicação na nuvem e exige ausência de URL de conexão, senha e endereço com credencial na saída e no registro, com o tipo de armazenamento informado; teste que provoca a recusa por URL ausente e malformada e exige a mesma ausência; teste que procura o valor da URL no que o repositório versiona e exige que nenhum arquivo versionado o contenha |
| FR-115 | Conexão que não pode ser verificada é recusada | Teste que aponta a conexão a um servidor cujo certificado não se confirma e exige a recusa, sem nenhuma operação apresentada como concluída |
| FR-117 | O script de início local nunca usa PostgreSQL | Teste que executa o script de início local a partir de uma cópia limpa do repositório e exige que a aplicação suba com o armazenamento local e que nenhuma conexão a PostgreSQL seja tentada |
| FR-044 | Operação não persistida não aparece como concluída | Teste com o armazenamento da nuvem indisponível, que exige a falha reportada, o conteúdo informado preservado e nenhuma operação apresentada como concluída |

### Key Entities

- **Porta de armazenamento**: a Interface única por onde todo Module lê e grava
  dados persistidos, entregue por `009`. Esta feature não a altera e apenas lhe
  acrescenta um Adapter.
- **Adapter de PostgreSQL**: a implementação concreta da Porta que grava numa
  base PostgreSQL na nuvem, apontada por URL de conexão. Entra na construção pelo
  parâmetro de escolha do armazenamento e é a segunda implementação que justifica
  a Seam da Porta.
- **URL de conexão**: o endereço, com credenciais, que aponta a base PostgreSQL.
  É um segredo, lido da variável de ambiente `DB_URL` no início da execução da
  nuvem, nunca versionado, exibido ou registrado.
- **Variável de ambiente `DB_URL`**: o nome sob o qual a infraestrutura de nuvem
  existente entrega a URL de conexão. O nome é imposto por essa infraestrutura e
  é a única coisa que aparece nas mensagens sobre a URL.
- **Migrações versionadas**: a mesma noção de migração versionada da execução
  local, aplicada à base PostgreSQL; numa base nova e vazia trazem o esquema à
  versão corrente, e reexecutar não reaplica o já aplicado.
- **Scripts de construção e de início**: os dois caminhos de inicialização do
  backend — o local, mantido como hoje, e o da nuvem —, exclusivos quanto ao
  armazenamento: o local nunca usa PostgreSQL, o da nuvem nunca usa o
  armazenamento local.

## Success Criteria *(mandatory)*

- **SC-044**: Cem por cento da bateria compartilhada de cenários da Porta passa
  contra o Adapter de PostgreSQL no pipeline de verificação, e é a mesma bateria
  que o Adapter do armazenamento local usa, sem cenário escrito duas vezes e sem
  Module alterado.
- **SC-045**: Em cem por cento dos inícios da nuvem, apenas o tipo de
  armazenamento em uso é informado, e nem a URL de conexão, nem a senha, nem
  qualquer endereço com credencial aparece na saída nem no registro da aplicação.
- **SC-046**: Em cem por cento dos inícios da nuvem sem URL de conexão válida, o
  início é recusado com mensagem em português
  que nomeia a variável de ambiente, e nenhum valor da URL aparece na saída nem
  no registro da aplicação.
- **SC-047**: Em cem por cento dos usos, a conexão é cifrada e o certificado do
  servidor é verificado; uma conexão que não possa ser verificada é recusada, e
  nenhuma operação é apresentada como concluída sobre ela.
- **SC-048**: Numa base PostgreSQL nova e vazia, cem por cento das execuções do
  comando de migração resultam no esquema da versão corrente, repetir o comando
  não reaplica nenhuma migração e iniciar com esquema desatualizado é recusado.
- **SC-049**: Cem por cento das operações depois de uma queda de conexão
  restabelece a conexão, e, enquanto o armazenamento estiver indisponível,
  nenhuma operação é apresentada como concluída e o conteúdo informado é
  preservado para nova tentativa.
- **SC-050**: A partir de uma cópia limpa do repositório, cem por cento dos
  inícios pelo script local sobe a aplicação com o armazenamento local sem nunca
  usar PostgreSQL, e cem por cento dos inícios pelo script da nuvem sobe a
  aplicação com PostgreSQL sem nunca usar o armazenamento local.

## Invariantes de Domínio

1. O armazenamento da nuvem é PostgreSQL, apontado por URL de conexão; nenhum
   Module conhece, nomeia ou importa o armazenamento concreto.
2. A Porta é a mesma para todos os Modules e para todos os Adapters, e a mesma
   bateria compartilhada a verifica; nenhuma operação escolhe armazenamento.
3. A URL de conexão é lida da variável de ambiente `DB_URL` no início da execução
   da nuvem; ausência ou URL malformada impede a construção e o início.
4. A URL de conexão é segredo: nunca versionada, exibida ou registrada, nem em
   mensagem de recusa; no início informa-se apenas o tipo de armazenamento em uso.
5. Toda conexão é cifrada e o certificado do servidor é verificado; conexão que
   não possa ser verificada é recusada.
6. "Exclusivamente na nuvem": o script de início local nunca usa PostgreSQL, e o
   script de início da nuvem nunca usa o armazenamento local.
7. Operação não persistida nunca aparece como concluída (FR-044); falha por
   indisponibilidade do armazenamento é reportada e o conteúdo informado é
   preservado (FR-045).
8. Esta feature não altera nenhum Module e não acrescenta tela, campo ou ação
   para quem usa a aplicação.

## Funcionalidades Adiadas

- O modelo de hospedagem: serviço de execução, exposição de rede e segredo de
  origem.
- A migração de dados do armazenamento local para a base PostgreSQL.
- O ajuste do conjunto de conexões.
- As réplicas de leitura.
- As cópias de segurança.
- Qualquer banco de dados além de PostgreSQL, na nuvem. Um armazenamento
  separado por Module ou por Usuário, na `008-entrar`.

## Assumptions

- A forma de verificação, o comando de migração e o sentido de "nuvem" foram
  confirmados no clarify de 2026-09-21.
- A URL de conexão é entregue pela infraestrutura de nuvem existente sob o nome
  de variável de ambiente `DB_URL`. O nome é uma imposição dessa infraestrutura,
  declarado aqui como contrato de integração, e não uma decisão desta feature.
- A `009-porta-de-persistencia` já entregou a Porta, a bateria compartilhada de
  cenários, o parâmetro de construção que escolhe o armazenamento e o script de
  início local, e esta feature se apoia neles sem alterá-los.
- O modelo de hospedagem em nuvem — serviço de execução, exposição de rede,
  segredo de origem — não faz parte do escopo desta feature, que trata apenas do
  banco de dados e da configuração de execução que o aponta.
- As premissas de `001-criar-cartao` valem, e o armazenamento local continua sendo
  o de hoje; nenhum arquivo que contenha segredo de conexão é versionado
  (Princípio VIII).
- Decisões de linguagem, driver, biblioteca de acesso, formato da URL de conexão,
  nome dos scripts e forma da migração pertencem ao `plan` desta feature.
