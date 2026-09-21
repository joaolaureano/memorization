# Feature Specification: Entrar

**Feature Branch**: `008-entrar`
**Created**: 2026-09-21
**Status**: Draft
**Input**: Pedido do Product Owner de autenticação com Usuário e Senha,
decomposto em duas features: `007-criar-usuario` e `008-entrar` (esta).
Glossário normativo em `CONTEXT.md`.

**Depende de**: `007-criar-usuario` (Usuário e Senha) e `001-criar-cartao` a
`006-excluir-cartao-e-baralho` (o acervo, que passa a ser por usuário).

## Clarifications

### Session 2026-09-21

- Q: O que acontece depois de Entrar, sem sessão, cookie ou token? → A: A
  Credencial (Nome de usuário e Senha) fica apenas na memória da página aberta e
  acompanha toda operação; o sistema a verifica a cada operação. Fechar ou
  recarregar a página exige Entrar de novo.
- Q: Os Cartões e Baralhos passam a pertencer a cada Usuário? → A: Sim, acervo
  por usuário: cada Usuário vê e altera só os seus Cartões, Baralhos e Vínculos.
  Substitui a premissa anterior "usuário único".
- Q: Qual é a primeira tela? → A: A tela inicial "Entrar", com acesso a "Criar
  conta".
- Q: A recusa de Entrar revela o motivo? → A: Não. Mensagem única, sem dizer se
  o Nome de usuário existe ou se a Senha está errada (decidido no clarify da
  `007`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar e acessar o próprio acervo (Priority: P1)

Uma pessoa abre a aplicação, vê a tela "Entrar" e informa o Nome de usuário e a
Senha do Usuário que criou. A partir daí passa a ver e a operar os seus Cartões,
Baralhos e Vínculos, e nenhum conteúdo de outro Usuário lhe aparece.

**Why this priority**: é o que transforma os Cartões e Baralhos em acervo de
alguém. Sem Entrar, todo Usuário veria o mesmo acervo e a aplicação não
distinguiria pessoas.

**Independent Test**: criar dois Usuários, entrar com o primeiro, cadastrar um
Cartão e um Baralho, sair, entrar com o segundo e confirmar que o acervo dele
está vazio e que nada do primeiro lhe aparece; recarregar a página e confirmar
que a aplicação exige Entrar de novo.

**Acceptance Scenarios**:

1. **Given** nenhuma Credencial mantida, **When** a pessoa abre a aplicação,
   **Then** a única tela apresentada é "Entrar", com os campos Nome de usuário e
   Senha e o acesso a "Criar conta".
2. **Given** um Usuário `ana.silva` cadastrado, **When** a pessoa informa
   `ana.silva` e a Senha correta, **Then** a aplicação a deixa Entrar e passa a
   oferecer a navegação principal para Cartões e Baralhos.
3. **Given** um Usuário `Ana.Silva` cadastrado, **When** a pessoa informa
   ` ana.silva ` com a Senha correta, **Then** a aplicação a deixa Entrar,
   descartando os espaços ao redor e a diferença entre maiúsculas e minúsculas.
4. **Given** um Nome de usuário inexistente, **When** a pessoa tenta Entrar,
   **Then** Entrar é recusado com a mensagem única "Nome de usuário ou Senha
   incorretos.".
5. **Given** um Nome de usuário existente e uma Senha errada, **When** a pessoa
   tenta Entrar, **Then** a pessoa recebe exatamente a mesma mensagem do caso
   anterior, sem qualquer indicação de que o Nome de usuário existe.
6. **Given** a pessoa digitando, **When** ela tenta Entrar apenas com o teclado,
   **Then** alcança todos os campos, conclui Entrar e o elemento focado é
   identificável sem depender de cor.
7. **Given** Entrar recusado, **When** a mensagem é exibida, **Then** ela é
   perceptível por leitor de tela e o foco vai para o campo que precisa de
   correção, permanecendo o que foi digitado.
8. **Given** nenhuma Credencial mantida, **When** a pessoa tenta qualquer
   operação sobre Cartões, Baralhos, Vínculos ou dados de uma Sessão de estudo,
   **Then** a operação é recusada e nada muda.
9. **Given** a pessoa que entrou, **When** ela usa apenas o teclado para
   recarregar a página, **Then** a aplicação exige Entrar de novo.
10. **Given** a pessoa que entrou, **When** ela termina de operar o seu acervo,
    **Then** encontra "Sair" em toda tela alcançável e, por Sair, volta a
    "Entrar".

---

### User Story 2 - Manter o acervo separado por Usuário (Priority: P2)

Cada Usuário opera somente os seus Cartões, Baralhos e Vínculos. Conteúdo de
outro Usuário não aparece, não pode ser alterado, nem mesmo mencionado.

**Why this priority**: é o efeito prático de Entrar. Sem a separação, Entrar
seria apenas uma cerimônia sobre um acervo comum.

**Independent Test**: com dois Usuários cadastrados, cada um com um Cartão e um
Baralho, confirmar que cada Usuário lista e estuda apenas o que é seu, que o
Cartão de um não pode ser vinculado ao Baralho do outro, e que o Cartão do
vizinho não muda mesmo quando exibido na lista de outro Usuário.

**Acceptance Scenarios**:

1. **Given** dois Usuários com Cartões e Baralhos próprios, **When** um Usuário
   lista o seu acervo, **Then** só aparecem os Cartões e Baralhos dele.
2. **Given** um Usuário com acervo vazio, **When** ele lista Cartões ou
   Baralhos, **Then** vê o estado vazio já existente na aplicação.
3. **Given** um Cartão de outro Usuário, **When** um Usuário tenta exibi-lo,
   editá-lo ou excluí-lo pelo seu próprio acesso, **Then** o Cartão se comporta
   como inexistente, sem revelar que existe.
4. **Given** um Cartão de um Usuário e um Baralho de outro, **When** um Usuário
   tenta vinculá-los, **Then** o Vínculo é recusado e nada muda.
5. **Given** um Usuário que entrou, **When** ele inicia uma Sessão de estudo,
   **Then** a Sessão é carregada apenas com Cartões dos seus Baralhos.
6. **Given** uma operação recusada por a Credencial já não valer — por exemplo,
   por o Usuário ter deixado de existir —, **When** a recusa é comunicada,
   **Then** a Credencial é descartada, a aplicação volta a "Entrar" com mensagem
   explicativa e a operação não aparece como concluída.

---

### User Story 3 - Sair e deixar a aplicação pronta para outro Usuário (Priority: P3)

A pessoa que entrou encerra o uso por "Sair". A Credencial é descartada, o
acervo deixa de ser exibido e a aplicação volta à tela "Entrar".

**Why this priority**: é o complemento de Entrar e o que torna o empréstimo do
dispositivo seguro, mas só tem valor depois de Entrar existir.

**Independent Test**: entrar, operar o acervo, sair e confirmar que a aplicação
exige Entrar de novo, que nenhum conteúdo do acervo aparece e que voltar pela
navegação do navegador não o traz de volta.

**Acceptance Scenarios**:

1. **Given** a pessoa que entrou, **When** ela aciona "Sair", **Then** a
   Credencial é descartada e a aplicação apresenta a tela "Entrar".
2. **Given** que a pessoa saiu, **When** ela aciona o voltar do navegador,
   **Then** nenhum conteúdo do acervo é exibido e a aplicação exige Entrar.
3. **Given** que a pessoa saiu, **When** ela usa apenas o teclado, **Then**
   alcança "Sair" quando entrou e conclui Sair, com a conclusão perceptível por
   leitor de tela.
4. **Given** que a pessoa saiu, **When** ela volta a Entrar com a mesma
   Credencial, **Then** volta a ver o seu acervo como antes.

---

### Edge Cases

- **Página recarregada ou fechada**: exige Entrar de novo. Recarregar não é
  Entrar.
- **Duas abas abertas**: são independentes. Cada aba Entra separadamente, e Sair
  em uma não descarta a Credencial da outra.
- **Usuário com acervo vazio**: vê os estados vazios já existentes em `001` e
  `002`, com a orientação para a primeira ação.
- **Nenhum Usuário cadastrado**: a tela "Entrar" oferece "Criar conta" como
  caminho, e não há como Entrar.
- **Segredo do servidor alterado**: todo Entrar é recusado, regra operacional da
  `007`. Não se distingue esse caso de uma Senha errada.
- **Espaços no Nome de usuário e na Senha**: os do Nome de usuário são
  descartados; os da Senha são preservados, inclusive nas pontas.
- **Nome de usuário com maiúsculas e minúsculas diferentes do Cadastro**: é
  aceito.
- **Requisição que não parte da interface**: as mesmas regras são aplicadas.

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
  empregando os termos canônicos de `CONTEXT.md` e MUST NOT empregar os
  sinônimos listados como `_Avoid_`.
- **FR-078**: O sistema MUST NOT devolver a Senha em nenhuma leitura, MUST NOT
  exibi-la de volta, MUST NOT registrá-la em log e MUST NOT gravá-la no
  navegador.
- **FR-079**: O sistema MUST NOT criar sessão, cookie ou token.

**Específicos desta feature**, por tratarem de Entrar, de Sair e do acervo por
usuário:

- **FR-086**: O sistema MUST permitir Entrar informando Nome de usuário e Senha.
- **FR-087**: Ao Entrar, o sistema MUST descartar os espaços ao redor do Nome de
  usuário e MUST compará-lo sem distinção entre maiúsculas e minúsculas, com as
  mesmas regras do Cadastro, e MUST comparar a Senha exatamente, preservando os
  espaços dela.
- **FR-088**: O sistema MUST recusar Entrar com uma única mensagem, "Nome de
  usuário ou Senha incorretos.", que MUST NOT revelar se o Nome de usuário
  existe ou se a Senha está errada, e a recusa MUST levar tempo indistinguível
  entre os dois casos.
- **FR-089**: A Credencial MUST permanecer apenas na memória da página aberta e
  MUST acompanhar cada operação; fechar ou recarregar a página MUST exigir novo
  Entrar, e cada aba aberta MUST manter a sua própria Credencial.
- **FR-090**: Toda operação sobre Cartões, Baralhos e Vínculos, e o carregamento
  dos dados de uma Sessão de estudo, MUST exigir Credencial válida; sem
  Credencial ou com Credencial inválida, a operação MUST ser recusada e MUST NOT
  alterar nada.
- **FR-091**: Quando uma operação for recusada por Credencial, a interface MUST
  descartar a Credencial e MUST voltar a "Entrar" com mensagem que explique a
  recusa, e MUST NOT apresentar a operação como concluída.
- **FR-092**: O sistema MUST tratar Cartões e Baralhos como acervo por usuário:
  cada Usuário MUST listar, criar, editar, excluir e estudar somente os seus, e
  um Cartão ou Baralho de outro Usuário MUST comportar-se como inexistente, sem
  revelar a sua existência.
- **FR-093**: O sistema MUST recusar um Vínculo entre Cartão e Baralho de
  Usuários diferentes: um Vínculo MUST unir somente um Cartão e um Baralho do
  mesmo Usuário.
- **FR-094**: O sistema MUST oferecer "Sair" em toda tela alcançável depois de
  Entrar; Sair MUST descartar a Credencial e MUST voltar a "Entrar", e, depois de
  Sair, voltar pela navegação do navegador MUST NOT exibir conteúdo do acervo.
- **FR-095**: O sistema MUST permitir Entrar e Sair inteiramente por teclado,
  mantendo o foco visível com indicação que não dependa apenas de cor, e MUST
  mover o foco para o campo que precisa de correção quando Entrar for recusado.
- **FR-096**: A recusa de Entrar e a conclusão de Sair MUST ser perceptíveis por
  leitor de tela, e não apenas visualmente.
- **FR-097**: Enquanto nenhuma Credencial for mantida, a primeira e única tela
  alcançável MUST ser "Entrar", que MUST oferecer o acesso a "Criar conta"; a
  tela de Cadastro MUST oferecer a volta a "Entrar" e, concluído o Cadastro,
  MUST oferecer Entrar em seguida.
- **FR-098**: A navegação principal para Cartões e Baralhos MUST aparecer somente
  depois de Entrar, e o link "Criar conta" oferecido pela `007` na navegação
  principal MUST passar a ser oferecido na tela "Entrar".

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-078 | A Credencial não é persistida no navegador | Teste em navegador real que Entra e inspeciona o armazenamento do navegador, o endereço/URL e o registro da aplicação, exigindo ausência do Nome de usuário, da Senha e de qualquer valor derivado deles |
| FR-079 | Não existe sessão, cookie ou token | Teste em navegador real que, com uma pessoa que entrou, exige ausência de cookie e de qualquer valor reutilizável, e teste que exige que nenhuma resposta da aplicação contenha credencial reutilizável |
| FR-088 | A recusa não revela qual parte da Credencial falhou | Teste que compara as duas recusas — Nome de usuário inexistente e Senha errada — e exige mensagem idêntica, e teste que exige duração indistinguível entre os dois casos |
| FR-090 | Operação sem Credencial ou com Credencial inválida é recusada sem mudança | Teste que tenta cada operação de Cartão, Baralho, Vínculo e Sessão de estudo sem Credencial e com Credencial inválida, exigindo recusa e acervo inalterado |
| FR-092 | Conteúdo de outro Usuário é indistinguível de inexistente | Teste com dois Usuários que exige, para cada um, ausência do acervo do outro, mensagem igual à de item inexistente e acervo do outro inalterado após a tentativa |
| FR-044 | Operação recusada não aparece como concluída | Teste de operação recusada por Credencial, que exige que o acervo permaneça inalterado, que a interface volte a "Entrar" com mensagem explicativa e que nada seja apresentado como concluído |

### Key Entities

- **Credencial**: o par Nome de usuário e Senha informado ao Entrar. Existe
  somente na memória da página aberta, acompanha cada operação e é descartada ao
  recarregar, fechar ou Sair.
- **Usuário**: quem se cadastrou na `007` e agora Entra. É o dono do acervo.
- **Cartão** e **Baralho**: passam a pertencer a exatamente um Usuário, que os
  lista, cria, edita, exclui e estuda. Conteúdo de outro Usuário não é
  distinguível de conteúdo inexistente.
- **Vínculo**: associação entre um Cartão e um Baralho, apenas do mesmo Usuário.
- **Sessão de estudo**: execução que carrega dados somente dos Baralhos do
  Usuário que entrou e continua a não sobreviver ao seu encerramento.

## Success Criteria *(mandatory)*

- **SC-027**: Em cem por cento das aberturas sem Credencial, a primeira e única
  tela apresentada é "Entrar", com o acesso a "Criar conta", e a navegação para
  Cartões e Baralhos não é oferecida.
- **SC-028**: Em cem por cento das tentativas de operar Cartões, Baralhos,
  Vínculos e dados de uma Sessão de estudo sem Credencial válida, a operação é
  recusada e o acervo permanece inalterado.
- **SC-029**: Em cem por cento das recusas de Entrar, a mensagem é idêntica,
  exista ou não o Nome de usuário, e a duração observável não distingue os dois
  casos.
- **SC-030**: Em um teste com dois Usuários, nenhum dos dois vê ou altera
  qualquer Cartão ou Baralho do outro, e o conteúdo do outro é indistinguível de
  inexistente.
- **SC-031**: Cem por cento das recargas e reaberturas depois de Entrar exigem
  Entrar de novo.
- **SC-032**: Entrar e Sair podem ser concluídos usando apenas o teclado, e o
  elemento focado é identificável sem percepção de cor em cem por cento dos
  passos.
- **SC-033**: Em cem por cento das vezes em que alguém entra, nem a Senha nem a
  Credencial aparecem no armazenamento do navegador, no cookie, no endereço/URL
  ou no registro da aplicação.
- **SC-034**: Depois de Sair, nenhum conteúdo do acervo é exibido, inclusive
  quando o voltar do navegador é acionado, em cem por cento das tentativas.
- **SC-035**: Em cem por cento das operações recusadas por Credencial, a
  aplicação descarta a Credencial, volta a "Entrar" com mensagem explicativa e
  não apresenta a operação como concluída.
- **SC-036**: Em cem por cento das tentativas de Entrar em que o Nome de usuário
  difere do cadastrado apenas em maiúsculas e minúsculas ou em espaços ao redor,
  Entrar é aceito.

## Invariantes de Domínio

1. Nenhuma operação sobre Cartões, Baralhos, Vínculos ou dados de uma Sessão de
   estudo é executada sem Credencial válida.
2. A Credencial existe somente na memória da página aberta e não sobrevive a
   recarregar, fechar ou Sair.
3. Nenhuma recusa de Entrar revela qual parte da Credencial falhou.
4. Todo Cartão e todo Baralho pertencem a exatamente um Usuário, e um Vínculo
   une somente um Cartão e um Baralho do mesmo Usuário.
5. Conteúdo de outro Usuário é indistinguível de conteúdo inexistente.
6. Não existe sessão, cookie ou token.
7. Toda ação da feature é executável por teclado, e nenhum estado relevante é
   comunicado apenas por cor.

## Funcionalidades Adiadas

- Recuperação e troca de Senha.
- Bloqueio por tentativas.
- "Lembrar de mim".
- Compartilhar Baralho entre Usuários.
- Exclusão de Usuário.

## Assumptions

- Cartões, Baralhos e Vínculos existentes antes desta feature, criados sem dono,
  são adotados pelo primeiro Usuário cadastrado — **a confirmar no clarify**.
- Não há bloqueio por tentativas, porque a aplicação só escuta na própria
  máquina — **a confirmar no clarify**. Vale também como funcionalidade adiada.
- A mensagem única de recusa foi confirmada no clarify de 2026-09-21, junto da
  revelação de Nome de usuário repetido no Cadastro: num Cadastro aberto a
  revelação é inevitável, e no Entrar não há revelação alguma.
- As premissas de `001-criar-cartao` valem: execução local, texto simples,
  persistência entre execuções.
- O segredo do servidor, exigido pela `007`, continua fornecido pelo ambiente de
  execução e nunca por arquivo versionado (Princípio VIII). Alterá-lo torna todo
  Entrar recusado.
- A premissa "usuário único" das features `001` a `006` deixa de valer: o acervo
  passa a ser por usuário.
