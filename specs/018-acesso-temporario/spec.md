# Feature Specification: Acesso temporário

**Feature Branch**: `018-acesso-temporario`
**Created**: 2026-10-03
**Status**: Implementada em 2026-10-03 (branch `implementacao-016-018`), a pedido do Product Owner
**Input**: O Usuário Entra e, de modo temporário, consegue ficar ainda conectado, para não precisar Entrar o tempo todo. Baseado em tempo: o acesso expira.

**Depende de**: `007-criar-usuario` (Usuário, Nome de usuário, Senha e Cadastro), `008-entrar` (Credencial, Entrar, Sair, FR-078, FR-079, FR-089, FR-090, FR-091), `012` (FR-157) e `017-gerenciar-conta-usuario` (alteração de Nome de usuário/Senha e exclusão do Usuário). Glossário normativo em `CONTEXT.md`.

## Clarifications

### Session 2026-10-03

- Q: Por quanto tempo o Acesso temporário vale, e o uso o renova? → A: Validade curta, de 5 minutos, renovada por qualquer ação da pessoa na página: toda operação, e também Revelar, Avaliar e navegar. Sem nenhuma ação por 5 minutos, o Acesso expira (FR-291).
- Q: O Acesso temporário é sempre criado ao Entrar ou só quando a pessoa escolhe? → A: Por uma opção em Entrar, "Continuar conectado neste navegador", marcada por padrão (FR-292).
- Q: Digitar num formulário conta como ação que renova o Acesso? → A: Sim. Qualquer interação da pessoa com a página (teclado, clique ou toque) renova a validade; quem escreve um Cartão longo não perde o texto por expiração (FR-291).
- Q: O que Sair encerra? → A: Só o Acesso do navegador em que Sair foi acionado; "Sair de todos os navegadores" fica adiado (FR-293).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continuar conectado após recarregar ou reabrir (Priority: P1)

O Usuário Entra e, com a opção padrão, recebe um Acesso temporário. Enquanto ele
for válido, recarregar a página, fechar e reabrir a aba ou o navegador não exige
novo Entrar: a pessoa volta direto ao acervo (Início).

**Why this priority**: é o núcleo do pedido. Sem ele, todo uso exige reapresentar
o Nome de usuário e a Senha, e a aplicação fica impraticável no dia a dia.

**Independent Test**: Entrar, fechar o navegador, reabrir 2 minutos depois e
confirmar que a pessoa volta ao Início sem Entrar; repetir recarregando a página
e fechando e reabrindo a aba. Estudar por 10 minutos seguidos, revelando e
avaliando sem pausas de 5 minutos, e confirmar que o Acesso continua válido.

**Acceptance Scenarios**:

1. **Given** a pessoa informa Nome de usuário e Senha válidos e a opção
   "Continuar conectado neste navegador" marcada, **When** Entrar é concluído,
   **Then** um Acesso temporário é emitido para aquele navegador.
2. **Given** um Acesso temporário válido, **When** a pessoa recarrega a página,
   **Then** volta direto ao Início, sem Entrar.
3. **Given** um Acesso temporário válido, **When** a pessoa fecha e reabre a aba
   ou o navegador dentro da validade, **Then** volta direto ao Início, sem
   Entrar.
4. **Given** a opção "Continuar conectado neste navegador" desmarcada, **When**
   Entrar é concluído, **Then** nenhum Acesso temporário é emitido e recarregar
   ou fechar exige Entrar de novo.
5. **Given** um Acesso temporário válido, **When** a pessoa Entra de novo
   naquele navegador, **Then** o Acesso anterior é substituído pelo novo.
6. **Given** a opção em Entrar, **When** a pessoa usa apenas o teclado, **Then**
   alcança a opção e conclui Entrar, com o elemento focado identificável sem
   depender de cor.

---

### User Story 2 - Acesso expira com o tempo (Priority: P1)

O Acesso temporário tem validade limitada. Quando expira, a próxima operação é
recusada e a pessoa volta a Entrar com a mensagem "Seu acesso expirou. Entre
novamente.". Nada em andamento é apresentado como concluído.

**Why this priority**: é o "baseado em tempo" do pedido e o limite de segurança
que impede continuidade indefinida.

**Independent Test**: Entrar, ficar 5 minutos sem nenhuma ação e confirmar que
recarregar ou reabrir leva a Entrar com a mensagem exata; tentar operar um Cartão
e confirmar recusa sem mudança.

**Acceptance Scenarios**:

1. **Given** um Acesso temporário válido, **When** a validade termina, **Then**
   a próxima operação é recusada e a pessoa volta a Entrar com "Seu acesso
   expirou. Entre novamente.".
2. **Given** um Acesso expirado, **When** a pessoa tenta recarregar a página,
   **Then** não entra no acervo e vê a mensagem.
3. **Given** um Acesso expirado, **When** a pessoa tenta criar, editar ou
   excluir Cartão ou Baralho, **Then** a operação é recusada e nada muda.
4. **Given** um Acesso expirado durante uma Sessão de estudo, **When** a Sessão
   de estudo tenta concluir, **Then** ela é descartada conforme FR-151 e FR-157 de
   `012`, sem registrar estudo parcial nem apresentar conclusão.
5. **Given** um Acesso expirado, **When** a pessoa volta a Entrar, **Then**
   recebe um novo Acesso temporário e volta ao Início.
6. **Given** a mensagem de expiração, **When** ela é exibida, **Then** é
   perceptível por leitor de tela e o foco vai para o campo de Entrar.

---

### User Story 3 - Sair encerra o acesso neste navegador (Priority: P1)

Sair descarta a Credencial e encerra o Acesso temporário daquele navegador.
Reabrir o navegador depois de Sair não dá acesso; o Acesso encerrado é recusado
mesmo que alguém o tenha copiado.

**Why this priority**: é o complemento de segurança do Acesso temporário. Sem
Sair encerrando o Acesso, o empréstimo do dispositivo não é seguro.

**Independent Test**: Entrar, Sair, fechar e reabrir o navegador e confirmar que
a aplicação exige Entrar; tentar reapresentar o Acesso encerrado e confirmar
recusa.

**Acceptance Scenarios**:

1. **Given** a pessoa que Entrou, **When** ela aciona Sair, **Then** a Credencial
   é descartada, o Acesso temporário daquele navegador é encerrado e a tela é
   "Entrar".
2. **Given** que a pessoa saiu, **When** ela fecha e reabre o navegador,
   **Then** nenhum acesso é concedido e a aplicação exige Entrar.
3. **Given** que a pessoa saiu, **When** um Acesso encerrado é reapresentado por
   qualquer meio, **Then** ele é recusado e nada é alterado.
4. **Given** que a pessoa saiu, **When** ela aciona o voltar do navegador,
   **Then** nenhum conteúdo do acervo é exibido.
5. **Given** que a pessoa saiu, **When** ela usa apenas o teclado, **Then**
   alcança Sair e conclui, com a conclusão perceptível por leitor de tela.

---

### User Story 4 - Alterações da conta encerram os acessos (Priority: P2)

Trocar a Senha, alterar o Nome de usuário ou excluir o Usuário encerra todos os
Acessos temporários daquele Usuário. O navegador que fez a alteração recebe um
novo Acesso (troca ou alteração) ou nenhum (exclusão).

**Why this priority**: integra a nova continuidade com a `017` e garante que
mudanças de segurança tenham efeito imediato.

**Independent Test**: com dois navegadores entrados, trocar a Senha em um;
confirmar que o outro é recusado na próxima operação e volta a Entrar; o
navegador da troca continua operando; repetir com alteração de Nome de usuário e
exclusão do Usuário.

**Acceptance Scenarios**:

1. **Given** dois navegadores com Acessos válidos do mesmo Usuário, **When** a
   Senha é trocada em um deles, **Then** todos os Acessos do Usuário são
   encerrados, o navegador da troca recebe um novo Acesso e o outro é recusado
   na próxima operação.
2. **Given** dois navegadores com Acessos válidos, **When** o Nome de usuário é
   alterado em um deles, **Then** todos os Acessos são encerrados, o navegador
   da alteração recebe um novo Acesso e o outro é recusado.
3. **Given** um Acesso válido em outro navegador, **When** o Usuário é excluído,
   **Then** todos os Acessos são encerrados e nenhum novo Acesso é emitido.
4. **Given** um Acesso encerrado pela `017`, **When** ele é reapresentado,
   **Then** é recusado e a operação não aparece como concluída.
5. **Given** a recusa por alteração da `017`, **When** a mensagem é exibida,
   **Then** ela explica a recusa e leva a Entrar.

---

### User Story 5 - Vários navegadores independentes (Priority: P3)

Cada Entrar em outro navegador ou aparelho cria um Acesso temporário próprio e
independente. Encerrar um não afeta os outros, exceto pelos eventos da `017`.

**Why this priority**: permite usar a aplicação em mais de um lugar sem que um
Sair derrube os demais.

**Independent Test**: Entrar em dois navegadores, Sair em um e confirmar que o
outro continua no acervo; depois trocar a Senha em um e confirmar que ambos são
encerrados.

**Acceptance Scenarios**:

1. **Given** dois navegadores, **When** a pessoa Entra em cada um, **Then** cada
   um recebe um Acesso temporário próprio.
2. **Given** dois Acessos válidos, **When** a pessoa Sair em um navegador,
   **Then** o Acesso do outro permanece válido.
3. **Given** dois Acessos válidos, **When** a pessoa troca a Senha em um
   navegador, **Then** o outro é encerrado e recusado na próxima operação.
4. **Given** um Acesso válido em um navegador, **When** a pessoa Entra novamente
   nesse mesmo navegador, **Then** o Acesso anterior é substituído.
5. **Given** um navegador em modo privado, **When** ele é fechado, **Then** o
   Acesso temporário some sem erro e a próxima abertura exige Entrar.

---

### Edge Cases

- **Relógio do aparelho errado**: a validade é decidida pelo servidor; adiantar
  ou atrasar o relógio local não estende nem encurta o Acesso temporário.
- **Acesso copiado para outro navegador antes de Sair**: depois de Sair, o
  Acesso é recusado, mesmo que tenha sido copiado.
- **Usuário excluído com Acesso válido em outro navegador**: o Acesso é
  encerrado e recusado na próxima operação.
- **Expirar no meio de uma Sessão de estudo**: a Sessão de estudo segue o
  FR-151/FR-157 de `012`; é descartada e nada é registrado como concluído.
- **Dois navegadores e troca de Senha em um**: ambos os Acessos do Usuário são
  encerrados; o navegador da troca recebe um novo Acesso e o outro volta a
  Entrar.
- **Navegador em modo privado**: o Acesso temporário some ao fechar, sem erro; a
  próxima abertura exige Entrar.
- **Entrar de novo enquanto há Acesso válido**: o novo Entrar substitui o Acesso
  anterior naquele navegador.
- **Falha de armazenamento ao verificar a validade**: a operação é recusada como
  indisponível, não como expiração, e o Acesso temporário não é descartado.
- **Formulário longo**: digitar renova o Acesso, então escrever um Cartão por
  mais de 5 minutos não perde o texto por expiração.
- **Aba aberta parada por mais de 5 minutos**: o Acesso expira; a próxima ação
  leva a Entrar com a mensagem de expiração, e nada em andamento é dado como
  concluído.
- **Requisição que não parte da interface**: as mesmas regras de validade,
  expiração e encerramento são aplicadas.

## Requirements *(mandatory)*

### Functional Requirements

**Transversais reutilizados**, com enunciado genérico e observáveis nesta
feature:

- **FR-042**: O sistema MUST apresentar suas telas de forma utilizável em telas
  pequenas.
- **FR-044**: O sistema MUST NOT apresentar como concluída qualquer operação que
  não tenha sido efetivamente persistida.
- **FR-045**: Quando uma operação falhar por indisponibilidade do armazenamento,
  o sistema MUST reportar a falha e MUST preservar o conteúdo informado,
  permitindo nova tentativa sem redigitação.
- **FR-046**: O sistema MUST apresentar toda a sua interface em português,
  empregando os termos canônicos de `CONTEXT.md` e MUST NOT empregar os sinônimos
  listados como `_Avoid_`.
- **FR-078**: O sistema MUST NOT devolver a Senha em nenhuma leitura, MUST NOT
  exibi-la de volta, MUST NOT registrá-la em log e MUST NOT gravá-la no
  navegador.
- **FR-079 (008, revisado)**: O sistema MUST ter o Acesso temporário como único
  mecanismo que permite continuar operando depois de Entrar, com validade
  limitada; nenhum outro mecanismo de continuidade é permitido.
- **FR-089 (008, revisado)**: A Credencial MUST permanecer apenas na memória
  durante o Entrar; o Acesso temporário é guardado no navegador até expirar ou
  Sair.
- **FR-090 (008, revisado)**: Toda operação sobre Cartões, Baralhos e Vínculos, e
  o carregamento dos dados de uma Sessão de estudo, MUST exigir Acesso temporário
  válido ou, somente enquanto a página aberta mantiver a Credencial em memória
  porque a opção de continuidade foi desmarcada, Credencial válida. Sem um dos
  dois, a operação MUST ser recusada e MUST NOT alterar nada.
- **FR-091 (008, revisado)**: Quando uma operação for recusada por Acesso
  temporário, a interface MUST descartar o Acesso, MUST voltar a "Entrar" com
  mensagem que explique a recusa, e MUST NOT apresentar a operação como
  concluída.
- **FR-092**: O sistema MUST tratar Cartões e Baralhos como acervo por usuário:
  cada Usuário MUST listar, criar, editar, excluir e estudar somente os seus, e
  um Cartão ou Baralho de outro Usuário MUST comportar-se como inexistente, sem
  revelar a sua existência.
- **FR-151 e FR-157 (012)**: A recusa de acesso MUST levar a Entrar com
  explicação, sem sucesso e sem diálogo que permita permanecer no acervo, e
  prevalece sobre o descarte de formulário e de Sessão de estudo; uma Sessão de
  estudo em andamento é descartada sem nada registrado como concluído. Ambos
  passam a valer também para a recusa do Acesso temporário.

**Específicos desta feature**, por tratarem do Acesso temporário:

- **FR-289**: O sistema MUST emitir um Acesso temporário para o navegador quando
  o Usuário Entrar com sucesso.
- **FR-290**: Enquanto o Acesso temporário for válido, recarregar a página,
  fechar e reabrir a aba ou o navegador MUST NOT exigir novo Entrar; a pessoa
  MUST voltar direto ao acervo (Início).
- **FR-291**: O Acesso temporário MUST valer por 5 minutos a partir da última
  ação da pessoa na página. Toda ação MUST renovar a validade por mais 5
  minutos: qualquer operação e qualquer interação da pessoa com a página —
  teclado, clique ou toque —, inclusive digitar num formulário, Revelar o
  Verso, Avaliar um Item e navegar entre telas, mesmo quando nada é gravado. Sem ação por 5 minutos
  seguidos, o Acesso MUST expirar.
- **FR-292**: O sistema MUST oferecer em
  Entrar a opção "Continuar conectado neste navegador", marcada por padrão; o
  Acesso temporário MUST ser emitido quando a opção estiver marcada e MUST NOT
  ser emitido quando ela estiver desmarcada.
- **FR-293**: Sair MUST encerrar
  somente o Acesso temporário do navegador em que Sair foi acionado; encerrar
  todos os Acessos do Usuário fica adiado.
- **FR-294**: Quando o Acesso temporário expirar, a próxima operação MUST ser
  recusada e a pessoa MUST voltar a Entrar com a mensagem "Seu acesso expirou.
  Entre novamente."; nada em andamento MUST ser apresentado como concluído
  (FR-044).
- **FR-295**: Sair MUST encerrar o Acesso temporário; depois de Sair, reabrir o
  navegador MUST NOT dar acesso, e o Acesso encerrado MUST ser recusado mesmo que
  alguém o tenha copiado.
- **FR-296**: Trocar a Senha, alterar o Nome de usuário ou excluir o Usuário MUST
  encerrar TODOS os Acessos temporários daquele Usuário; o navegador que fez a
  alteração MUST receber um novo Acesso (troca ou alteração) ou nenhum
  (exclusão).
- **FR-297**: A Senha MUST continuar NUNCA guardada no navegador (FR-078
  mantido); o navegador MUST guardar apenas o Acesso temporário, que MUST NOT
  revelar a Senha nem o Nome de usuário, MUST NOT poder ser adivinhado nem
  forjado, MUST NOT aparecer no endereço/URL nem em registros da aplicação, e
  MUST ser verificado pelo servidor a cada operação.
- **FR-298**: Um Acesso temporário de um Usuário MUST NOT dar acesso ao acervo
  de outro; conteúdo de outro Usuário MUST comportar-se como inexistente
  (FR-092).
- **FR-299**: Cada Entrar em outro navegador ou aparelho MUST criar um Acesso
  temporário próprio e independente; encerrar um MUST NOT afetar os outros,
  exceto pelos eventos da `017`.
- **FR-300**: Enquanto houver Acesso temporário válido, a pessoa MUST NOT precisar
  reapresentar o Nome de usuário e a Senha para operar. É a consequência, para a
  experiência, do FR-090 revisado; a reconfirmação da Senha atual exigida pela
  `017` para alterar ou excluir o Usuário continua valendo.
- **FR-301**: Se a validade do Acesso temporário não puder ser verificada por
  falha do armazenamento, a operação MUST ser recusada como indisponível, não
  como expiração, e o Acesso temporário MUST NOT ser descartado.
- **FR-302**: A opção "Continuar conectado neste navegador" em Entrar e as
  mensagens da feature MUST seguir a acessibilidade e a responsividade de `012`.
- **FR-303**: O sistema MUST permitir marcar ou desmarcar a opção, Entrar, Sair e
  voltar a Entrar inteiramente por teclado, mantendo o foco visível com indicação
  que não dependa apenas de cor.
- **FR-304**: A recusa por Acesso expirado, a recusa por Acesso encerrado por
  Sair ou pela `017`, e a mensagem de indisponibilidade MUST ser perceptíveis por
  leitor de tela, e não apenas visualmente.
- **FR-305**: O Acesso temporário MUST NOT ser exibido no endereço/URL nem em
  nenhum campo visível da interface, e MUST NOT ser devolvido em nenhuma leitura.
- **FR-306**: As regras de validade, expiração e encerramento do Acesso
  temporário MUST ser validadas de forma autoritativa, inclusive quando a
  operação não parte da interface.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-297 | A Senha nunca é guardada no navegador; o Acesso temporário não revela Senha nem Nome de usuário | Teste em navegador real que Entra e inspeciona o armazenamento do navegador, o endereço/URL e os registros da aplicação, exigindo ausência da Senha, do Nome de usuário e de qualquer valor derivado; teste que tenta forjar ou adivinhar o Acesso e exige recusa |
| FR-298 | Acesso de um Usuário nunca dá acesso a outro | Teste com dois Usuários que exige, para cada um, ausência do acervo do outro, mensagem igual à de item inexistente e acervo do outro inalterado após a tentativa |
| FR-295 | Acesso encerrado por Sair não pode ser reutilizado | Teste que guarda o Acesso antes de Sair, aciona Sair, tenta reapresentá-lo e exige recusa sem mudança |
| FR-294 | Operação após expirar não aparece como concluída | Teste que avança o relógio além da validade, tenta operar e exige recusa, mensagem exata e acervo inalterado |
| FR-296 | Alterações da `017` encerram todos os Acessos | Teste com dois navegadores que troca a Senha, altera o Nome de usuário e exclui o Usuário, exigindo recusa dos Acessos antigos e ausência de novo Acesso na exclusão |
| FR-301 | Falha de armazenamento não é expiração nem descarte do Acesso | Teste com armazenamento indisponível que exige recusa como indisponível, Acesso preservado e nova tentativa bem-sucedida quando o armazenamento volta |
| FR-305 | Acesso não aparece no endereço/URL nem em leitura | Teste em navegador real que percorre a interface e as leituras e exige ausência do Acesso temporário |

### Key Entities

- **Acesso temporário**: comprovante, emitido ao Entrar, que permite continuar
  operando no mesmo navegador sem reapresentar o Nome de usuário e a Senha até
  expirar ou ser encerrado. Tem validade limitada, decidida pelo servidor; não
  revela a Senha nem o Nome de usuário; é guardado pelo navegador; é próprio de
  cada navegador ou aparelho; e é encerrado por expiração, por Sair ou pelos
  eventos da `017`.
- **Credencial**: o par Nome de usuário e Senha mantido apenas na memória durante
  o Entrar; passa a ser apresentado no Entrar, não a cada operação; é descartado
  ao recarregar, fechar ou Sair.
- **Usuário**: quem se cadastrou na `007` e Entra. É o dono do acervo e pode ter
  vários Acessos temporários independentes, um por navegador ou aparelho.
- **Navegador**: o contexto em que um Acesso temporário é emitido e guardado.
  Um novo Entrar no mesmo navegador substitui o Acesso anterior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-114**: Em cem por cento das reaberturas dentro da validade, a pessoa volta
  ao acervo (Início) sem Entrar.
- **SC-115**: Em cem por cento das operações após expirar, Sair, alteração de
  Nome de usuário, troca de Senha ou exclusão do Usuário, a operação é recusada e
  nada muda.
- **SC-116**: Em cem por cento das verificações em navegador real, a Senha não
  aparece em qualquer armazenamento do navegador, no endereço/URL ou em registros
  da aplicação.
- **SC-117**: Em um teste com dois Usuários, nenhum Acesso temporário de um dá
  acesso ao acervo do outro, e o conteúdo do outro é indistinguível de
  inexistente.
- **SC-118**: Em cem por cento das reaberturas dentro da validade no ambiente
  local, o retorno ao acervo (Início) ocorre em até 2 s.
- **SC-119**: Em cem por cento das reaberturas depois de Sair, a aplicação exige
  Entrar.
- **SC-120**: Em cem por cento das alterações da `017`, todos os Acessos do
  Usuário são encerrados; o navegador da alteração continua operando por novo
  Acesso quando aplicável, e não há novo Acesso na exclusão.
- **SC-121**: A opção "Continuar conectado neste navegador", Entrar, Sair e as
  mensagens de expiração podem ser operados por teclado, com foco identificável
  sem cor, e permanecem utilizáveis em 360, 390, 768 e 1440 px e zoom de 200 %.
- **SC-122**: Em cem por cento das falhas de armazenamento ao verificar a
  validade, a operação é recusada como indisponível, não como expiração, e o
  Acesso temporário não é descartado.
- **SC-123**: Em cem por cento das expirações, a mensagem exibida é exatamente
  "Seu acesso expirou. Entre novamente.".
- **SC-124**: Em cem por cento dos testes, uma Sessão de estudo de 10 minutos,
  com ações a intervalos menores que 5 minutos, nunca perde o Acesso; e 5
  minutos sem nenhuma ação sempre levam a Entrar na ação seguinte.

## Invariantes de Domínio

1. A Senha nunca é guardada no navegador; o único valor de continuidade guardado
   é o Acesso temporário.
2. O Acesso temporário não revela a Senha nem o Nome de usuário, não pode ser
   adivinhado nem forjado, e é verificado pelo servidor a cada operação.
3. O Acesso temporário vale somente para o navegador em que foi emitido e nunca
   dá acesso ao acervo de outro Usuário.
4. Expirar, Sair, trocar a Senha, alterar o Nome de usuário ou excluir o Usuário
   encerra o Acesso temporário correspondente.
5. Nenhuma operação recusada por Acesso temporário é apresentada como concluída,
   e nada em andamento permanece registrado.
6. Falha de armazenamento ao verificar a validade não é tratada como expiração e
   não descarta o Acesso.
7. Toda ação da feature é executável por teclado, e nenhum estado relevante é
   comunicado apenas por cor.

## Funcionalidades Adiadas

- "Sair de todos os navegadores".
- Lista de navegadores conectados.
- Aviso antes de o Acesso expirar.
- Duração configurável pela pessoa ou um limite máximo absoluto de duração.
- Autenticação em dois fatores.
- Lembrar Nome de usuário.

## Compatibilidade com specs anteriores

| Tema | Mudança |
|---|---|
| FR-079 (008) | Revisado: passa a existir o Acesso temporário, com validade limitada; nenhum outro mecanismo de continuidade é permitido. |
| FR-089 (008) | Revisado: a Credencial continua apenas na memória durante o Entrar, mas o Acesso temporário é guardado no navegador até expirar ou Sair. |
| FR-078 | Mantido: a Senha continua NUNCA guardada no navegador. |
| FR-091 e FR-157 (012) | Passam a aplicar-se também à recusa por Acesso temporário, inclusive expiração, Sair e eventos da `017`. |
| FR-263 e FR-270 (017) | A substituição da Credencial em memória ao alterar Nome de usuário ou trocar Senha passa a emitir um novo Acesso temporário para o navegador da alteração. |
| CONTEXT.md | Novo termo **Acesso temporário**; a definição de **Credencial** deixa de ser "apresentada a cada operação". |

## Assumptions

- A validade de 5 minutos é contada desde a última ação, e não desde o Entrar.
  Por isso, numa Sessão de estudo, Revelar e Avaliar também renovam o Acesso,
  mesmo sem gravar nada. Sem isso, quem estuda por mais de 5 minutos perderia a
  Sessão ao concluir.
- Não há limite máximo absoluto de duração enquanto houver ação; ele fica
  adiado.
- A opção "Continuar conectado neste navegador" vem marcada por padrão, e
  "Sair de todos os navegadores" fica adiado (decisões do clarify).
- A validade é decidida pelo servidor; o relógio do aparelho não altera a
  decisão.
- Com a opção de continuidade desmarcada, a Credencial de `008` pode autorizar
  operações somente enquanto fica na memória da página aberta; ao recarregar ou
  fechar, ela é descartada e Entrar é exigido. Com Acesso temporário válido, ele
  substitui a reapresentação a cada operação.
- As regras de acervo por usuário de `008` continuam valendo.
- Arquitetura, contratos, armazenamento e estratégia de testes pertencem ao
  `plan`. Esta spec não fixa tecnologia, protocolo ou framework.
