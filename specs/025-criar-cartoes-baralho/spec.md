# Feature Specification: Criar Cartões dentro de Baralhos

**Feature Branch**: `025-criar-cartoes-baralho`
**Created**: 2026-10-05
**Status**: Draft
**Input**: Criar Cartões dentro de cada Baralho, com um vínculo único em que um Baralho pode conter vários Cartões e cada Cartão pertence a somente um Baralho. Remover o menu e a tela dedicados a Cartões; criar Cartões a partir da tela do Baralho correspondente.
**Depende de**: `001-criar-cartao`, `002-criar-baralho`, `003-vincular-cartao-baralho`, `005-editar-cartao-e-baralho`, `006-excluir-cartao-e-baralho`, `021-consistencia-baralhos-cartoes`, `022-busca-e-filtros-no-acervo` e `023-baralho-temporario`.

## Objetivo e escopo

Fazer do detalhe de um Baralho o lugar para consultar e criar seus Cartões. Cada Cartão pertence a exatamente um Baralho, e um Baralho pode conter vários Cartões. Dentro de um Baralho, cada Frente identifica um conceito distinto; quando uma cópia ou criação repetir uma Frente, o sistema acrescenta um contador à Frente. A lista e o menu dedicados a Cartões deixam de existir; a navegação começa pela lista de Baralhos.

Esta especificação trata da criação, da apresentação dos Cartões no Baralho e da retirada da superfície global de Cartões. As ações existentes de edição e exclusão continuam acessíveis no contexto do Baralho, sem alterar suas regras. A transição dos dados existentes preserva as associações por meio de cópias, conforme os cenários abaixo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Criar Cartões no Baralho escolhido (Priority: P1)

Como Usuário, quero criar um Cartão dentro do Baralho em que vou usá-lo, para que ele já pertença ao único Baralho correto e esteja pronto para revisão.

**Why this priority**: a criação contextual estabelece a relação exclusiva e elimina a etapa independente de vincular Cartões a Baralhos.

**Independent Test**: abrir um Baralho, criar Cartões com Frente e Verso, confirmar que aparecem nesse Baralho após salvar e continuam lá ao reabrir a aplicação.

**Acceptance Scenarios**:

1. **Given** o detalhe de um Baralho, **When** o Usuário inicia a criação de Cartão, informa Frente e Verso válidos e salva, **Then** o Cartão é criado e aparece na lista daquele Baralho.
2. **Given** dois Baralhos existentes, **When** o Usuário cria um Cartão a partir do detalhe de um deles, **Then** o Cartão pertence somente ao Baralho de origem e não aparece no outro.
3. **Given** a criação com Frente ou Verso vazio, composto apenas por espaços ou acima do limite vigente, **When** o Usuário tenta salvar, **Then** a criação é recusada conforme as regras existentes de Cartão e os valores permanecem disponíveis para correção.
4. **Given** a Frente informada já existe naquele Baralho, **When** o Usuário salva, **Then** o Cartão é criado com o próximo sufixo numérico livre na Frente e o resultado é comunicado.
5. **Given** um Cartão criado, **When** o Usuário fecha e reabre a aplicação e retorna ao Baralho, **Then** o Cartão permanece listado somente nesse Baralho.
6. **Given** o armazenamento indisponível durante a criação, **When** o Usuário salva, **Then** a falha é comunicada, o Cartão não é apresentado como criado e o conteúdo digitado permanece para nova tentativa.
7. **Given** o Usuário navega por teclado no detalhe do Baralho e no formulário, **When** cria um Cartão, **Then** consegue completar a ação sem ponteiro, com foco visível e resultado perceptível por leitor de tela.

### User Story 2 - Consultar e gerenciar Cartões pelo Baralho (Priority: P1)

Como Usuário, quero encontrar os Cartões ao abrir seu Baralho, sem uma lista global que os separe do contexto a que pertencem.

**Why this priority**: a navegação pelo Baralho torna visível a nova relação e preserva o acesso ao conteúdo e às ações existentes.

**Independent Test**: abrir Baralhos diferentes e confirmar que cada detalhe mostra apenas seus Cartões, sem item de navegação ou tela global de Cartões.

**Acceptance Scenarios**:

1. **Given** um Baralho com Cartões, **When** o Usuário abre seu detalhe, **Then** cada Cartão pertencente a ele é apresentado uma vez, com Frente e Verso.
2. **Given** um Baralho sem Cartões, **When** o Usuário abre seu detalhe, **Then** um estado vazio informa que ainda não há Cartões e oferece a criação nesse Baralho.
3. **Given** a navegação principal, **When** o Usuário a consulta, **Then** não existe item de menu Cartões nem uma tela global dedicada que liste todos os Cartões.
4. **Given** um Cartão no detalhe de seu Baralho, **When** o Usuário aciona editar ou excluir, **Then** ambas as ações permanecem disponíveis; exclusão exige a confirmação existente e remove o Cartão do acervo.
5. **Given** Cartões com Frentes iguais em Baralhos diferentes, **When** são consultados, **Then** continuam distintos e cada um mantém sua Frente nesse Baralho.

### User Story 3 - Preservar Cartões existentes na transição (Priority: P1)

Como Usuário, quero que Cartões existentes continuem acessíveis quando cada Cartão passar a pertencer a um único Baralho.

**Why this priority**: tornar o vínculo exclusivo sem uma regra de transição deixaria conteúdo ou histórico sem um destino definido.

**Independent Test**: preparar um Cartão sem Baralho e outro compartilhado entre dois Baralhos; concluir a transição e verificar conteúdo, destino, cópias e histórico.

**Acceptance Scenarios**:

1. **Given** um Cartão sem Baralho e ao menos um Baralho existente, **When** o Usuário escolhe seu destino na transição, **Then** o Cartão original passa a pertencer somente ao Baralho escolhido.
2. **Given** um Cartão associado a mais de um Baralho, **When** o Usuário escolhe qual Baralho mantém o Cartão original, **Then** cada Baralho anteriormente associado mantém um Cartão com o mesmo Verso e com a Frente original, acrescida de contador somente quando houver colisão no destino.
3. **Given** a transição de um Cartão compartilhado, **When** as cópias são criadas, **Then** o Cartão original conserva seu agendamento e histórico no Baralho escolhido, e as cópias nos demais Baralhos começam sem agendamento nem histórico.
4. **Given** Cartões sem Baralho ainda sem destino definido, **When** a transição é concluída, **Then** ela não deixa esses Cartões órfãos; cada um precisa de um Baralho escolhido pelo Usuário.

### User Story 4 - Salvar uma seleção temporária como Baralho (Priority: P1)

Como Usuário, quero guardar uma seleção temporária em um novo Baralho sem remover os Cartões que já pertencem aos Baralhos de origem.

**Why this priority**: mantém o fluxo de salvamento existente compatível com a regra de que cada Cartão pertence a um único Baralho.

**Independent Test**: selecionar Cartões de Baralhos diferentes, incluindo Frentes iguais, salvar a seleção e conferir que os originais permanecem intactos e o novo Baralho contém cópias com Frentes únicas.

**Acceptance Scenarios**:

1. **Given** uma Sessão temporária concluída e registrada, **When** o Usuário salva a seleção como Baralho, **Then** um novo Baralho recebe Cartões distintos com os mesmos Versos e as mesmas Frentes, exceto quando um contador é necessário para tornar uma Frente única.
2. **Given** dois Cartões selecionados com a mesma Frente, **When** as cópias são criadas no novo Baralho, **Then** a primeira mantém a Frente e as seguintes recebem o próximo sufixo numérico livre, como `To Walk (2)`.
3. **Given** Cartões da seleção já pertencentes a outros Baralhos, **When** a cópia para o novo Baralho é concluída, **Then** os Cartões de origem, seus conteúdos, Agendamentos e Vínculos permanecem inalterados; as cópias começam sem Agendamento ou Histórico.
4. **Given** falha ao salvar a seleção, **When** o Usuário tenta novamente, **Then** nenhum Baralho ou cópia parcial é apresentado e a mesma tentativa não duplica Baralho nem Cartões.

### Edge Cases

- Um Baralho sem Cartões continua válido e oferece criação contextual.
- Conteúdo inválido ou acima dos limites atuais segue as validações de criação já estabelecidas, sem apagar o que o Usuário digitou.
- Uma falha de gravação não cria um Cartão órfão nem altera a lista apresentada.
- Se o Baralho deixar de existir enquanto um formulário de criação estiver aberto, o Cartão não pode ser salvo sem um Baralho.
- Excluir um Cartão no detalhe remove seu Agendamento e mantém os registros históricos já gravados como snapshots.
- Excluir um Baralho não vazio exige confirmação explícita, apaga seus Cartões e Agendamentos, e mantém registros históricos como snapshots.
- Se a exclusão do Baralho não puder ser persistida, Cartões, Agendamentos e Baralho permanecem disponíveis.
- Cartões preexistentes sem Baralho são atribuídos a um Baralho escolhido pelo Usuário; Cartões compartilhados são copiados para cada Baralho anterior, com o Cartão original e seu histórico mantidos em um Baralho escolhido pelo Usuário.
- As cópias de Cartões compartilhados nos demais Baralhos começam sem agendamento nem histórico; registros de revisão não são replicados. Frentes repetidas em um Baralho de destino recebem sufixo numérico.
- Ao salvar uma seleção temporária, são criadas cópias dos Cartões no novo Baralho. Frentes repetidas no resultado recebem sufixo numérico; Cartões de origem e seus Agendamentos permanecem inalterados.
- A busca e os filtros globais de Cartões pertencem à tela retirada; esta feature não introduz busca global substituta.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-388 — Criação contextual**: O sistema MUST permitir iniciar e concluir a criação de um Cartão a partir do detalhe do Baralho ao qual ele pertencerá.
- **FR-389 — Vínculo exclusivo**: Todo Cartão criado MUST pertencer a exatamente um Baralho; um Baralho MUST poder conter zero ou mais Cartões. Um Cartão MUST NOT ser criado avulso nem pertencer simultaneamente a mais de um Baralho.
- **FR-390 — Integridade**: O sistema MUST garantir de forma autoritativa que um Cartão não seja criado sem Baralho ou associado a Baralho diferente daquele em cujo contexto foi criado.
- **FR-391 — Lista contextual**: O detalhe de cada Baralho MUST apresentar cada Cartão que lhe pertence uma única vez, incluindo Frente e Verso, e MUST NOT apresentar Cartões pertencentes somente a outros Baralhos.
- **FR-392 — Estado vazio**: O detalhe de um Baralho sem Cartões MUST comunicar esse estado e oferecer uma ação para criar um Cartão no próprio Baralho.
- **FR-393 — Remoção da lista global**: O sistema MUST remover o item Cartões da navegação principal e MUST NOT oferecer uma tela dedicada que liste Cartões sem contexto de Baralho.
- **FR-394 — Ações no detalhe**: As ações de edição e exclusão de Cartões MUST continuar acessíveis no detalhe do Baralho. A edição MUST preservar as garantias compatíveis da feature 005 e respeitar a unicidade definida em FR-399. A exclusão MUST seguir FR-401 e FR-402, incluindo confirmação explícita, remoção de Agendamentos e preservação dos snapshots históricos.
- **FR-395 — Persistência e falha**: Cartões criados MUST permanecer associados ao mesmo Baralho entre execuções. Uma falha ao salvar MUST ser comunicada sem apresentar o Cartão como criado e MUST preservar o conteúdo digitado para nova tentativa.
- **FR-396 — Acessibilidade e responsividade**: A criação e a consulta de Cartões no detalhe MUST ser completas por teclado, manter foco visível e comunicar estados e resultados a leitores de tela. O conteúdo MUST permanecer utilizável em telas pequenas e com zoom de 200%, sem sobreposição impeditiva ou rolagem horizontal da página.
- **FR-397 — Dados preexistentes**: Na transição, o Usuário MUST escolher um Baralho para cada Cartão sem Baralho e para cada Cartão atualmente compartilhado. O Cartão original MUST permanecer no Baralho escolhido; um Cartão compartilhado MUST gerar uma cópia com o mesmo Verso e a Frente original — acrescida de contador somente em caso de colisão — em cada um dos outros Baralhos a que já pertencia. Cada cópia MUST ser um Cartão distinto, sem agendamento ou histórico de revisão; o Cartão original MUST conservar os seus.
- **FR-398 — Frente única por Baralho**: O sistema MUST manter Frentes únicas dentro de cada Baralho, comparando-as sem distinção de maiúsculas, minúsculas ou acentos e ignorando espaços nas extremidades. A mesma Frente MUST continuar permitida em Baralhos diferentes. Ao criar um Cartão cuja Frente colida no Baralho escolhido, o sistema MUST acrescentar o menor sufixo numérico livre a partir de `(2)`, preservando o Verso e comunicando a Frente resultante. Se o sufixo ultrapassar o limite vigente de caracteres, a criação MUST ser recusada sem perder o conteúdo digitado.
- **FR-399 — Edição sem colisão**: Ao editar um Cartão, se a nova Frente colidir com outro Cartão do mesmo Baralho, o sistema MUST recusar a edição, preservar a Frente e o Verso anteriores, manter o valor digitado para correção e identificar a colisão.
- **FR-400 — Salvar seleção como Baralho**: O salvamento de seleção temporária MUST criar Cartões distintos no novo Baralho, em vez de associar Cartões existentes a outro Baralho. MUST preservar os Cartões de origem e seus Vínculos, conteúdos, Agendamentos e Históricos. As cópias MUST começar sem Agendamento ou Histórico; Frentes repetidas no novo Baralho MUST receber sufixos numéricos únicos, em ordem estável de apresentação da seleção. A criação do Baralho e de todas as cópias MUST ser atômica e idempotente para a mesma tentativa.
- **FR-401 — Remover do Baralho**: A ação no detalhe do Baralho MUST ser apresentada como exclusão do Cartão, não como desvinculação. MUST exigir confirmação explícita, excluir o Cartão e seu Agendamento, e preservar os registros históricos já gravados como snapshots. MUST NOT deixar o Cartão sem Baralho.
- **FR-402 — Excluir Baralho com Cartões**: Excluir um Baralho MUST exigir confirmação explícita que informe quantos Cartões e Agendamentos serão removidos. A confirmação MUST excluir o Baralho, todos os Cartões que lhe pertencem e seus Agendamentos atomicamente; MUST preservar registros históricos como snapshots. Falha MUST preservar Baralho, Cartões e Agendamentos.

### Key Entities *(include if feature involves data)*

- **Cartão**: unidade de conteúdo composta por Frente e Verso. Pertence a exatamente um Baralho. Dentro dele, a Frente identifica um conceito e é única; pode repetir em Baralhos diferentes. Excluir o Cartão remove seu Agendamento, mas não apaga snapshots de Sessões já registradas.
- **Baralho**: conjunto nomeado de Cartões; pode existir sem Cartões e conter vários deles. Excluir um Baralho também exclui seus Cartões e Agendamentos; snapshots do Histórico permanecem.
- **Pertencimento**: relação exclusiva entre um Cartão e seu único Baralho; não é uma associação que o Usuário cria ou remove separadamente.
- **Cópia**: Cartão distinto criado em outro Baralho a partir de um Cartão existente. Mantém o Verso e recebe Frente única no destino; não recebe o Agendamento nem o Histórico do original.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-155**: Em 100% das criações válidas realizadas em um Baralho, o Cartão aparece nesse Baralho e em nenhum outro.
- **SC-156**: Em 100% das tentativas de criação sem Baralho ou com conteúdo inválido, nenhum Cartão é criado nem fica sem Baralho.
- **SC-157**: O Usuário consegue criar um Cartão válido em menos de um minuto a partir do detalhe de um Baralho, sem consultar instruções.
- **SC-158**: Em 100% dos Baralhos consultados, o detalhe apresenta somente Cartões que pertencem àquele Baralho, sem duplicidade.
- **SC-159**: A navegação principal não oferece menu Cartões e nenhuma tela global dedicada permite listar Cartões fora do contexto de um Baralho.
- **SC-160**: A criação e as ações de gerenciamento disponíveis no detalhe podem ser concluídas por teclado, e estados e resultados são percebidos por leitor de tela.
- **SC-161**: Em 100% das transições, cada Cartão anterior termina em exatamente um Baralho escolhido pelo Usuário; cada associação anterior de um Cartão compartilhado continua representada por um Cartão com o mesmo Verso e Frente original, salvo contador exigido por colisão no destino.
- **SC-162**: Em 100% das transições de Cartões compartilhados, o Cartão original mantém seu agendamento e histórico uma única vez, e as cópias não recebem registros de revisão.
- **SC-163**: Nenhum Baralho contém duas Frentes iguais segundo a comparação definida; criações e cópias com colisão recebem o próximo sufixo livre sem alterar Cartões de origem.
- **SC-164**: Em 100% dos salvamentos de seleção temporária, o novo Baralho contém cópias únicas, nenhum Cartão de origem muda de Baralho e falhas não deixam criação parcial.
- **SC-165**: Em 100% das exclusões confirmadas de Baralho, todos os Cartões e Agendamentos próprios são removidos, e os Registros históricos permanecem legíveis; em falhas, nenhum desses dados é removido parcialmente.
- **SC-166**: Em 100% das remoções de Cartão pelo detalhe, a ação é confirmada como exclusão, nenhum Cartão órfão é criado e o Histórico registrado permanece legível.

## Assumptions

- As regras atuais de conteúdo do Cartão continuam vigentes: Frente e Verso obrigatórios, texto simples e limite existente de caracteres.
- Frentes repetidas são permitidas em Baralhos diferentes, mas não no mesmo Baralho. Criação e cópia acrescentam contador à Frente em colisão; edição com colisão é recusada.
- Edição e exclusão permanecem acessíveis no detalhe do Baralho. Excluir um Cartão remove também seu Agendamento; excluir um Baralho remove seus Cartões e Agendamentos. O Histórico anterior permanece como snapshot, e ambas as exclusões preservam a confirmação explícita.
- A busca e os filtros da lista global de Cartões deixam de estar disponíveis com a remoção dessa tela; criar busca por Baralho não faz parte desta feature.
- Cartões anteriores sem Baralho são atribuídos a um Baralho escolhido pelo Usuário. Para Cartões compartilhados, o Cartão original e seu agendamento/histórico permanecem no Baralho escolhido; os demais Baralhos recebem Cartões distintos com o mesmo conteúdo, sem agendamento ou histórico.
- Ao salvar uma seleção temporária, cópias são criadas no novo Baralho; originais e seus Agendamentos permanecem nos Baralhos de origem. Cópias não herdam Agendamento ou Histórico. Em caso de Frente repetida no destino, o contador é acrescentado à Frente da cópia ou do novo Cartão.
- A aplicação continua usando os usuários e as regras de acesso já existentes, sem mudança de escopo nessa área.

## Relação com requisitos anteriores

Esta especificação supersede os trechos conflitantes de `001-criar-cartao` que permitem Cartões avulsos e Frentes repetidas no mesmo Baralho; de `003-vincular-cartao-baralho` que permitem Vínculos independentes, Cartões associados a zero ou mais Baralhos, desvinculação sem exclusão e lista global de Cartões; de `006-excluir-cartao-e-baralho` que preservam Cartões ao excluir um Baralho; de `021-consistencia-baralhos-cartoes` que define uma página principal de Cartões; de `022-busca-e-filtros-no-acervo` relativos à busca, filtros e ações na lista global; e de `023-baralho-temporario` relativos a salvar Vínculos em vez de cópias e preservar Agendamentos nas cópias. As especificações anteriores permanecem como histórico; as demais regras de conteúdo, estudo, revisão, edição e exclusão continuam vigentes quando compatíveis com esta relação exclusiva.