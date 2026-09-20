# Feature Specification: MVP de Estudo por Flashcards

**Feature Branch**: `001-flashcard-study-mvp`

**Created**: 2026-09-20

**Status**: Draft

**Input**: Visão do produto consolidada na fase de descoberta (SESSION.md, EVT-001 a EVT-011). Glossário normativo em CONTEXT.md.

## Clarifications

### Session 2026-09-20

- Q: A aplicação vai rodar apenas na máquina do usuário, ou ficar hospedada numa URL que outras pessoas conseguem abrir? → A: Local no MVP. Hospedagem remota (AWS) é direção futura declarada, fora do escopo desta feature.
- Q: Quantos cartões e baralhos a aplicação precisa exibir confortavelmente numa lista antes que a falta de paginação ou busca comece a atrapalhar? → A: Até ~50 cartões e ~10 baralhos (uso experimental, bem pequeno).
- Q: O que o usuário deve ver se uma operação de gravar, editar ou excluir falhar? → A: A operação é reportada como falha, a tela não finge sucesso, e o conteúdo informado é preservado para nova tentativa.
- Q: Em que idioma a interface deve falar com o usuário? → A: Português, usando os termos canônicos do CONTEXT.md.
- Q: Frente, Verso e nome do Baralho devem ter limite de tamanho? → A: Sim, limite generoso — Frente e Verso até 1000 caracteres, nome do Baralho até 100.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar conteúdo e torná-lo estudável (Priority: P1)

O usuário cria cartões avulsos com o que precisa memorizar, cria um baralho para
um assunto, e vincula cartões a esse baralho até que ele se torne um baralho
elegível. Ao fechar e reabrir a aplicação, tudo continua lá.

**Why this priority**: É a única história que, sozinha, produz um baralho
elegível. Sem ela nenhuma sessão de estudo pode existir. Criar cartão e criar
baralho são atos independentes, portanto nenhum dos dois isolado entrega valor —
o vínculo é o que fecha o ciclo.

**Independent Test**: Criar dois cartões, criar um baralho, vincular ambos,
fechar a aplicação, reabrir e confirmar que o baralho aparece como elegível com
seus dois cartões.

**Acceptance Scenarios**:

1. **Given** nenhum cartão existe, **When** o usuário cria um cartão com frente e
   verso preenchidos, **Then** o cartão passa a existir e aparece na lista de
   cartões, vinculado a nenhum baralho.
2. **Given** o usuário está criando um cartão, **When** a frente ou o verso está
   vazio, **Then** a criação é recusada e o usuário é informado de qual campo
   falta.
3. **Given** nenhum baralho existe, **When** o usuário cria um baralho com nome
   preenchido, **Then** o baralho passa a existir, aparece na lista de baralhos e
   é indicado como não elegível para estudo.
4. **Given** já existe um baralho chamado "Inglês", **When** o usuário cria outro
   baralho chamado "Inglês", **Then** a criação é aceita: nomes de baralho não
   precisam ser únicos.
5. **Given** um cartão e um baralho existem sem vínculo entre si, **When** o
   usuário vincula o cartão ao baralho, **Then** o cartão passa a constar entre
   os cartões do baralho, o baralho passa a constar entre os baralhos do cartão,
   e o baralho torna-se elegível.
6. **Given** um cartão já está vinculado a um baralho, **When** o usuário tenta
   vincular o mesmo cartão ao mesmo baralho novamente, **Then** a operação é
   recusada e nenhum vínculo duplicado é criado.
7. **Given** um cartão está vinculado a três baralhos, **When** o usuário abre a
   lista de cartões, **Then** o cartão aparece uma única vez, indicando os três
   baralhos a que está vinculado.
8. **Given** cartões, baralhos e vínculos foram criados, **When** o usuário fecha
   e reabre a aplicação, **Then** todos os cartões, baralhos e vínculos continuam
   existindo exatamente como estavam.
9. **Given** o usuário está criando um cartão, **When** cola na Frente um texto
   com mais de 1000 caracteres, **Then** a aplicação recusa, informa o limite e o
   tamanho atual, e o conteúdo permanece na tela para correção.
10. **Given** o usuário está digitando a Frente, **When** se aproxima do limite,
    **Then** a aplicação comunica o limite antes da tentativa de salvar.

---

### User Story 2 - Estudar um baralho e ver o resultado (Priority: P1)

O usuário escolhe um baralho elegível, informa quantos cartões quer estudar,
recebe os cartões em ordem randomizada vendo apenas a frente, revela o verso
quando tiver tentado lembrar, declara se acertou ou errou, e ao final vê o
resumo da sessão.

**Why this priority**: É o propósito do produto. As histórias 1 e 2 juntas
constituem o MVP mínimo viável; sem a 2, a aplicação é apenas um cadastro.

**Independent Test**: Partindo de um baralho elegível com cinco cartões, iniciar
uma sessão de três cartões, percorrer os três itens revelando e autoavaliando
cada um, e confirmar que o resumo apresenta três estudados com a soma correta de
acertos e erros.

**Acceptance Scenarios**:

1. **Given** um baralho sem nenhum cartão vinculado, **When** o usuário consulta
   a lista de baralhos, **Then** o baralho é apresentado como não elegível e a
   razão é comunicada.
2. **Given** um baralho elegível com dez cartões, **When** o usuário solicita
   estudar quatro cartões, **Then** a sessão começa com exatamente quatro itens.
3. **Given** um baralho elegível com doze cartões, **When** o usuário solicita
   estudar cinquenta cartões, **Then** a sessão começa com doze itens e o usuário
   é avisado de que o baralho tem doze cartões.
4. **Given** o usuário está definindo a quantidade, **When** informa zero ou um
   número negativo, **Then** a sessão não é iniciada e o usuário é informado de
   que a quantidade deve ser de ao menos um cartão.
5. **Given** uma sessão iniciada, **When** o primeiro item é apresentado,
   **Then** apenas a frente do cartão é exibida e o verso permanece oculto.
6. **Given** um item apresentado com o verso oculto, **When** o usuário executa a
   ação de revelação, **Then** o verso é exibido e as opções de autoavaliação
   tornam-se disponíveis.
7. **Given** um item cujo verso ainda não foi revelado, **When** o usuário tenta
   registrar acertou ou errou, **Then** a autoavaliação não é aceita.
8. **Given** um item cujo resultado já foi registrado, **When** o usuário tenta
   alterá-lo, **Then** a alteração é recusada: o resultado é imutável.
9. **Given** uma sessão de três itens com dois itens já respondidos, **When** o
   usuário registra o resultado do terceiro, **Then** a sessão termina e o resumo
   é apresentado.
10. **Given** uma sessão concluída com três itens, dois acertos e um erro,
    **When** o resumo é apresentado, **Then** ele informa três estudados, dois
    acertos e um erro.
11. **Given** um baralho elegível com cinco cartões, **When** o usuário estuda os
    cinco em uma sessão, **Then** cada um dos cinco cartões aparece exatamente
    uma vez.
12. **Given** uma sessão em andamento, **When** o usuário a interrompe por
    qualquer motivo, **Then** nenhum resumo é produzido, nada é registrado, e ao
    voltar o usuário pode iniciar uma sessão nova.
13. **Given** uma sessão de 10 itens com 3 já respondidos, **When** o usuário
    observa a tela, **Then** ele identifica sua posição e o total sem precisar
    contar.
14. **Given** o usuário registrou o resultado de um item, **When** o item
    seguinte é apresentado, **Then** o foco do teclado é movido para o novo
    conteúdo e permanece visível sem depender de cor.
15. **Given** um item com o verso revelado, **When** o resultado é registrado,
    **Then** a mudança de estado é perceptível por leitor de tela, e não apenas
    visualmente.

---

### User Story 3 - Corrigir e descartar conteúdo (Priority: P2)

O usuário corrige o texto de um cartão, renomeia um baralho, desvincula um cartão
de um baralho, e exclui cartões ou baralhos que não servem mais — sabendo
exatamente o que cada ação destrói.

**Why this priority**: Sem ela um erro de digitação torna o cartão lixo
permanente e o acervo só cresce. Não é necessária para a primeira sessão de
estudo funcionar, por isso vem depois de P1.

**Independent Test**: Partindo de um cartão vinculado a dois baralhos, editar o
cartão e confirmar a alteração nos dois; desvincular de um e confirmar que o
cartão sobrevive; excluir o baralho restante e confirmar que o cartão continua
existindo.

**Acceptance Scenarios**:

1. **Given** um cartão existente, **When** o usuário altera sua frente ou seu
   verso, **Then** a alteração vale em todos os baralhos a que ele está
   vinculado.
2. **Given** um cartão vinculado a três baralhos, **When** o usuário abre sua
   edição, **Then** é informado de que o cartão está em três baralhos antes de
   confirmar a alteração.
3. **Given** um baralho existente, **When** o usuário altera seu nome, **Then** o
   novo nome é exibido em todos os lugares onde o baralho aparece, e seus
   vínculos permanecem intactos.
4. **Given** um cartão vinculado a um baralho, **When** o usuário desvincula o
   cartão do baralho, **Then** o cartão e o baralho continuam existindo e apenas
   o vínculo deixa de existir.
5. **Given** um baralho com um único cartão vinculado, **When** o usuário
   desvincula esse cartão, **Then** o baralho deixa de ser elegível e continua
   existindo.
6. **Given** um cartão vinculado a dois baralhos, **When** o usuário exclui o
   cartão e confirma, **Then** o cartão deixa de existir, some dos dois baralhos,
   e nenhum baralho é destruído.
7. **Given** um baralho com cartões vinculados, **When** o usuário solicita
   excluí-lo, **Then** é pedida confirmação explícita que informa quantos cartões
   continuarão existindo após a exclusão.
8. **Given** um baralho com cartões vinculados, **When** o usuário confirma a
   exclusão, **Then** o baralho deixa de existir, todos os seus vínculos deixam
   de existir, e nenhum cartão é destruído.
9. **Given** um cartão que estava apenas no baralho excluído, **When** a exclusão
   é concluída, **Then** o cartão continua acessível pela lista de cartões, sem
   nenhum baralho vinculado.
10. **Given** uma solicitação de exclusão, **When** o usuário recusa a
    confirmação, **Then** nada é excluído.
11. **Given** uma edição de cartão com alterações não salvas, **When** o usuário
    tenta sair da tela, **Then** é pedida confirmação explícita antes de
    descartar as alterações.
12. **Given** o pedido de confirmação por alterações não salvas, **When** o
    usuário recusa, **Then** a edição permanece aberta com o conteúdo digitado
    intacto.

---

### Edge Cases

- **Baralho vazio**: existe, é listado, mas não é elegível. A razão da
  inelegibilidade é comunicada, não apenas sinalizada por ação desabilitada.
- **Elegibilidade perdida entre a listagem e o início da sessão**: se o último
  cartão for desvinculado ou excluído enquanto o usuário olha a lista, a
  elegibilidade é verificada novamente ao iniciar a sessão, não apenas ao
  renderizar a lista.
- **Baralho com exatamente um cartão**: sessão válida de um item. Randomizar um
  conjunto unitário não é caso especial.
- **Cartão sem nenhum baralho**: estado legítimo e alcançável pela lista de
  cartões, onde pode ser editado, vinculado ou excluído. Nenhum cartão pode ficar
  inacessível.
- **Cartão alterado ou excluído durante uma sessão ativa**: os itens da sessão
  usam o conteúdo capturado no início dela, de modo que a sessão permanece
  internamente consistente até o resumo.
- **Baralho excluído durante uma sessão ativa**: a sessão em curso prossegue até
  o resumo; o baralho já não existe ao retornar.
- **Verso revelado sem autoavaliação seguida de interrupção**: o item fica sem
  resultado, a sessão é descartada e nenhum resumo é produzido.
- **Todos os itens respondidos como errou**: resumo com zero acertos é resultado
  válido, não condição de erro.
- **Frente e verso com conteúdo idêntico**: permitido; a aplicação não julga
  conteúdo.
- **Dois cartões com a mesma frente no mesmo baralho**: permitido; a frente não é
  identificador.
- **Acervo vazio**: com nenhum cartão e nenhum baralho, as listas comunicam o
  estado vazio e orientam a primeira ação.
- **Edição abandonada com alterações**: sair da edição de um Cartão ou Baralho
  sem salvar exige confirmação; recusada a confirmação, a edição permanece
  aberta com o conteúdo digitado intacto.
- **Conteúdo só de espaços**: uma Frente contendo apenas espaços é recusada como
  vazia, e não aceita como conteúdo válido.
- **Conteúdo excedendo o limite**: texto colado acima do limite é recusado com
  indicação do limite e do tamanho atual, e o conteúdo digitado permanece
  disponível para correção.
- **Falha de persistência**: se o armazenamento estiver indisponível no momento
  de criar, editar, excluir ou vincular, a operação é reportada como falha, a
  interface não a exibe como concluída, e o conteúdo informado permanece
  disponível para nova tentativa.

## Requirements *(mandatory)*

### Functional Requirements

**Cartões**

- **FR-001**: O sistema MUST permitir criar um Cartão informando Frente e Verso,
  sem exigir a escolha de um Baralho.
- **FR-002**: O sistema MUST recusar a criação ou edição de um Cartão cuja Frente
  ou Verso esteja vazio, informando qual campo falta.
- **FR-003**: O sistema MUST expor uma lista de todos os Cartões existentes,
  independentemente de estarem vinculados a algum Baralho.
- **FR-004**: O sistema MUST exibir, para cada Cartão, sua Frente, seu Verso e os
  Baralhos a que está vinculado.
- **FR-005**: Os usuários MUST poder editar a Frente e o Verso de um Cartão, e a
  alteração MUST valer em todos os Baralhos a que ele está vinculado.
- **FR-006**: O sistema MUST informar, ao editar um Cartão, em quantos Baralhos
  ele está vinculado.
- **FR-007**: Os usuários MUST poder excluir um Cartão mediante confirmação
  explícita.
- **FR-008**: A exclusão de um Cartão MUST remover todos os seus Vínculos e MUST
  NOT destruir nenhum Baralho.
- **FR-009**: Um Cartão MUST NOT possuir qualquer propriedade além de Frente e
  Verso.

**Baralhos**

- **FR-010**: O sistema MUST permitir criar um Baralho informando um nome.
- **FR-011**: O sistema MUST recusar a criação ou edição de um Baralho com nome
  vazio.
- **FR-012**: O sistema MUST aceitar Baralhos com nomes repetidos: o nome é
  rótulo, não identificador.
- **FR-013**: O sistema MUST expor uma lista de todos os Baralhos existentes,
  indicando quais são elegíveis para estudo.
- **FR-014**: O sistema MUST exibir, para cada Baralho, seu nome e os Cartões
  vinculados.
- **FR-015**: Os usuários MUST poder renomear um Baralho sem afetar seus
  Vínculos.
- **FR-016**: Os usuários MUST poder excluir um Baralho mediante confirmação
  explícita que informe quantos Cartões continuarão existindo após a exclusão.
- **FR-017**: A exclusão de um Baralho MUST remover todos os seus Vínculos e MUST
  NOT destruir nenhum Cartão.
- **FR-018**: Um Baralho MUST NOT possuir qualquer propriedade além de nome.

**Vínculos**

- **FR-019**: Os usuários MUST poder vincular um Cartão existente a um Baralho
  existente, em operação distinta da criação de ambos.
- **FR-020**: O sistema MUST recusar a criação de um Vínculo duplicado: um Cartão
  se vincula a um mesmo Baralho no máximo uma vez.
- **FR-021**: Os usuários MUST poder desvincular um Cartão de um Baralho,
  preservando ambos.
- **FR-022**: O sistema MUST permitir que um Cartão esteja vinculado a zero ou
  mais Baralhos, sem limite superior de Baralhos por Cartão nem de Cartões por
  Baralho.
- **FR-023**: O sistema MUST validar as regras de Vínculo de forma autoritativa,
  não apenas na camada de apresentação.

**Elegibilidade e sessão**

- **FR-024**: O sistema MUST considerar um Baralho elegível se e somente se ele
  tem ao menos um Cartão vinculado.
- **FR-025**: O sistema MUST permitir iniciar uma Sessão de estudo apenas a
  partir de um Baralho elegível, verificando a elegibilidade no momento do
  início.
- **FR-026**: O sistema MUST comunicar, para um Baralho não elegível, a razão de
  não poder ser estudado.
- **FR-027**: Os usuários MUST poder informar quantos Cartões desejam estudar na
  Sessão.
- **FR-028**: O sistema MUST recusar quantidade menor que um.
- **FR-029**: Quando a quantidade solicitada exceder os Cartões vinculados ao
  Baralho, o sistema MUST iniciar a Sessão com todos os Cartões disponíveis e
  MUST avisar o usuário de quantos Itens a Sessão terá.
- **FR-030**: O sistema MUST apresentar os Itens de estudo em ordem randomizada,
  definida no início da Sessão e imutável durante ela.
- **FR-031**: O sistema MUST NOT originar mais de um Item de estudo a partir do
  mesmo Cartão dentro da mesma Sessão.
- **FR-032**: O sistema MUST exibir, para cada Item, apenas a Frente até que
  ocorra a Revelação.
- **FR-033**: A Revelação MUST ocorrer somente por ação explícita do usuário.
- **FR-034**: O sistema MUST recusar o registro de um Resultado do item antes da
  Revelação daquele Item.
- **FR-035**: O sistema MUST aceitar exatamente um Resultado do item por Item,
  com os valores acertou ou errou, e MUST recusar qualquer alteração posterior.
- **FR-036**: O sistema MUST NOT avaliar, comparar ou corrigir a recordação do
  usuário: o Resultado do item é declaração do próprio usuário.
- **FR-037**: O sistema MUST apresentar o Resumo da sessão somente quando todos
  os Itens tiverem Resultado, informando quantidade estudada, acertos e erros,
  com acertos somados a erros igual à quantidade estudada.
- **FR-038**: O sistema MUST NOT persistir Sessões, Itens, Resultados ou Resumos.
- **FR-039**: Qualquer interrupção de uma Sessão MUST descartá-la integralmente,
  sem produzir Resumo e sem deixar registro, permitindo iniciar uma Sessão nova
  na entrada seguinte.

**Persistência e uso**

- **FR-040**: O sistema MUST preservar Cartões, Baralhos e Vínculos entre
  execuções da aplicação.
- **FR-041**: O sistema MUST permitir executar as ações da Sessão — Revelação e
  registro de Resultado — inteiramente por teclado.
- **FR-042**: O sistema MUST apresentar suas telas de forma utilizável em telas
  pequenas.
- **FR-043**: O sistema MUST comunicar o estado vazio das listas de Cartões e de
  Baralhos, orientando a primeira ação.
- **FR-044**: O sistema MUST NOT apresentar como concluída qualquer operação de
  criação, edição, exclusão ou Vínculo que não tenha sido efetivamente
  persistida.
- **FR-045**: Quando uma operação falhar por indisponibilidade do armazenamento,
  o sistema MUST reportar a falha ao usuário e MUST preservar o conteúdo por ele
  informado, permitindo nova tentativa sem redigitação.
- **FR-046**: O sistema MUST apresentar toda a sua interface em português,
  empregando os termos canônicos de `CONTEXT.md` — Cartão, Frente, Verso,
  Baralho, Vínculo, Sessão de estudo, Resumo da sessão — e MUST NOT empregar os
  sinônimos listados como `_Avoid_` naquele glossário.
- **FR-047**: Durante uma Sessão de estudo, o sistema MUST informar
  continuamente a posição do Item corrente e o total de Itens da Sessão, de modo
  que o usuário saiba quanto falta antes de chegar ao Resumo.
- **FR-048**: O sistema MUST manter o foco do teclado sempre visível, com
  indicação que não dependa apenas de cor, e MUST mover o foco para o conteúdo
  recém-apresentado ao avançar de Item.
- **FR-049**: Os controles do sistema MUST possuir rótulo textual acessível, e
  mudanças de estado relevantes — Verso revelado, Resultado registrado, Sessão
  concluída, operação falhada — MUST ser perceptíveis por leitor de tela e não
  apenas visualmente.
- **FR-050**: Ao sair de uma edição de Cartão ou de Baralho com alterações não
  salvas, o sistema MUST pedir confirmação explícita antes de descartá-las.
- **FR-051**: O sistema MUST tratar conteúdo composto apenas de espaços como
  vazio, tanto na Frente e no Verso quanto no nome do Baralho.
- **FR-052**: O sistema MUST recusar Frente ou Verso com mais de 1000
  caracteres, e nome de Baralho com mais de 100 caracteres, informando o limite
  e o tamanho atual.
- **FR-053**: O sistema MUST comunicar o limite ao usuário **durante** a
  digitação, e não apenas ao tentar salvar.

### Verificação dos Requisitos Negativos

Alguns requisitos afirmam o que o sistema **não** faz. Um cenário
Given/When/Then não os alcança naturalmente, e por isso cada um declara aqui seu
meio de verificação, para que nenhum deles seja aceito por inspeção informal.

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-009 | Cartão não tem propriedade além de Frente e Verso | Teste que envia propriedade extra na criação e exige que ela seja ignorada ou recusada, e que não retorne nas leituras |
| FR-018 | Baralho não tem propriedade além de nome | Idem, para Baralho |
| FR-022 | Não há limite superior de Vínculos por Cartão nem por Baralho | Teste que cria um Cartão vinculado a 20 Baralhos e um Baralho com 60 Cartões, ambos aceitos |
| FR-036 | O sistema não avalia a recordação do usuário | Ausência verificada por inspeção da Interface do Module `SessaoDeEstudo`: ela não aceita resposta digitada, logo não há o que comparar. Teste que confirma que `responder` só admite os valores `acertou` e `errou` |
| FR-038 | Sessão, Itens, Resultados e Resumo não são persistidos | Teste que conclui uma Sessão e verifica que nenhuma consulta de leitura do Acervo devolve vestígio dela; e inspeção do contrato, que não possui rota de Sessão |
| FR-044 | Operação não persistida não aparece como concluída | Teste com armazenamento indisponível, verificando que a interface reporta falha |

### Key Entities

- **Cartão**: unidade de conteúdo a memorizar, composta de Frente e Verso.
  Existe por si, independentemente de Baralhos. Nenhuma outra propriedade.
- **Frente**: o conteúdo que o usuário tenta recordar. Obrigatório e não vazio.
- **Verso**: o conteúdo associado à Frente, exibido após a Revelação.
  Obrigatório e não vazio.
- **Baralho**: agrupamento nomeado de Cartões vinculados sobre um assunto. Tem
  apenas nome, que não precisa ser único.
- **Vínculo**: a associação entre um Cartão e um Baralho. Único por par, criado e
  desfeito independentemente da existência de ambos.
- **Baralho elegível**: Baralho com ao menos um Cartão vinculado; condição para
  originar uma Sessão de estudo.
- **Sessão de estudo**: execução em que Cartões de um único Baralho são revisados
  um a um até o Resumo. Nunca persistida; não sobrevive ao encerramento.
- **Item de estudo**: a apresentação de um Cartão dentro de uma Sessão, com sua
  própria Revelação e seu próprio Resultado.
- **Resultado do item**: declaração do usuário, acertou ou errou, sobre sua
  recordação de um Item. No máximo um por Item, imutável.
- **Resumo da sessão**: consolidação final de itens estudados, acertos e erros.
  Exibido ao fim da Sessão e descartado com ela.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A partir de uma aplicação vazia, um usuário consegue criar um
  cartão, criar um baralho, vinculá-los e iniciar sua primeira sessão de estudo
  em menos de dois minutos, sem consultar instruções.
- **SC-002**: Em cem sessões de um baralho com dez ou mais cartões, nenhum cartão
  se repete dentro da mesma sessão, e a ordem dos cartões varia entre sessões.
- **SC-003**: Cem por cento dos cartões, baralhos e vínculos criados continuam
  presentes e corretos após fechar e reabrir a aplicação.
- **SC-004**: Cem por cento das sessões concluídas apresentam um resumo em que a
  soma de acertos e erros é igual à quantidade de cartões estudados.
- **SC-005**: Nenhuma exclusão de baralho destrói cartões, e nenhuma exclusão de
  cartão destrói baralhos, em cem por cento das tentativas.
- **SC-006**: Nenhum cartão fica inacessível: todo cartão existente, inclusive os
  sem baralho, é alcançável pela lista de cartões em cem por cento dos casos.
- **SC-007**: Uma sessão inteira pode ser percorrida do primeiro item ao resumo
  usando apenas o teclado, sem recorrer ao ponteiro.
- **SC-008**: Nenhum dado de sessão, item, resultado ou resumo sobrevive ao
  encerramento da sessão, verificável em cem por cento das interrupções.
- **SC-009**: Toda tentativa de criar vínculo duplicado é recusada, mesmo quando
  a solicitação não parte da interface.
- **SC-010**: Um usuário que solicita mais cartões do que o baralho possui inicia
  a sessão mesmo assim e sabe, antes do primeiro item, quantos cartões estudará.
- **SC-011**: Com 50 Cartões e 10 Baralhos no acervo, as listas permanecem
  navegáveis e o usuário localiza visualmente um item conhecido sem recorrer a
  busca ou paginação.
- **SC-012**: Em cem por cento das falhas de gravação simuladas, nenhuma operação
  aparece como concluída na interface e nenhum conteúdo informado pelo usuário é
  perdido.
- **SC-013**: Em qualquer ponto da aplicação alcançável por teclado, o elemento
  focado é identificável sem depender de percepção de cor.
- **SC-014**: Nenhuma alteração digitada e não salva é descartada sem
  confirmação explícita do usuário, em cem por cento das tentativas de sair da
  edição.
- **SC-015**: Durante uma Sessão, o usuário sabe a qualquer momento quantos
  Itens já respondeu e quantos faltam, sem precisar contar.
- **SC-016**: Nenhum Cartão gravado excede 1000 caracteres na Frente ou no
  Verso, e nenhum Baralho excede 100 caracteres no nome, em cem por cento das
  tentativas, inclusive quando a requisição não parte da interface.

## Invariantes de Domínio

Regras que valem sempre, independentemente de tela, fluxo ou ordem das ações.
Cada uma é verificável e tem requisito correspondente.

1. Um Cartão tem Frente e Verso não vazios, cada um com no máximo 1000
   caracteres.
2. Um Baralho tem nome não vazio, de no máximo 100 caracteres, que não precisa
   ser único.
3. Um Cartão existe por si e está vinculado a zero ou mais Baralhos.
4. O par (Cartão, Baralho) é único: um Cartão se vincula a um mesmo Baralho no
   máximo uma vez.
5. Um Baralho é elegível se e somente se tem ao menos um Cartão vinculado.
6. Uma Sessão só pode ser iniciada a partir de um Baralho elegível.
7. A quantidade de Itens de uma Sessão é `min(quantidade solicitada, Cartões
   vinculados)` e nunca menor que 1.
8. Nenhum Cartão origina mais de um Item na mesma Sessão.
9. A ordem dos Itens é definida no início da Sessão e não muda durante ela.
10. O Verso de um Item só é exibido após Revelação por ação explícita.
11. Um Resultado do item só pode ser registrado após a Revelação daquele Item.
12. Um Item admite no máximo um Resultado, imutável após registrado.
13. O Resumo só existe quando todos os Itens têm Resultado, e nele
    `acertos + erros = itens estudados`.
14. Excluir um Baralho remove seus Vínculos e preserva os Cartões.
15. Excluir um Cartão remove seus Vínculos e preserva os Baralhos, que podem
    deixar de ser elegíveis.
16. Uma Sessão nunca é persistida; qualquer interrupção a descarta sem deixar
    registro.

## Funcionalidades Adiadas

Explicitamente fora do MVP. Não são omissões: são decisões de não construir
agora, cada uma reversível em incremento futuro sem invalidar o que existe.

- **Repetição espaçada** e qualquer agendamento de revisão. A randomização
  aprovada **não é** repetição espaçada e não deve ser confundida com ela: a
  primeira é ordem uniformemente aleatória sem memória; a segunda exige
  histórico de desempenho, que o MVP não acumula.
- Histórico, estatísticas ou métricas acumuladas de Sessões.
- Múltiplos usuários, contas, autenticação ou compartilhamento.
- Imagens, áudio, Markdown ou qualquer formatação de conteúdo.
- Importação e exportação de acervo.
- Tags, busca, filtro, paginação e subdecks.
- Qualquer propriedade de Cartão além de Frente e Verso, ou de Baralho além de
  nome.
- Correção automática de respostas ou comparação de texto digitado.
- Retomada de Sessão interrompida.
- Desfazer exclusão.
- Internacionalização e troca de idioma.
- Hospedagem remota.

## Assumptions

- O produto é de usuário único e sem autenticação; nenhuma entidade tem dono e
  não há noção de conta, login ou compartilhamento.
- Todo o conteúdo é texto simples. Markdown, formatação, imagens e áudio estão
  fora de escopo.
- A randomização é uniforme e sem memória. Repetição espaçada e qualquer
  agendamento de revisão estão fora de escopo e não devem ser confundidos com
  randomização.
- Não há histórico, estatística ou métrica acumulada de sessões. O Resumo da
  sessão é calculado no encerramento e descartado junto com a sessão.
- Não existe limite de cartões por baralho nem de baralhos por cartão.
- Frente e Verso admitem até 1000 caracteres e o nome do Baralho até 100. Os
  limites existem para que um Cartão caiba na tela durante a Sessão e para
  impedir colagem acidental de documento inteiro, não para restringir conteúdo
  legítimo.
- O acervo esperado no MVP é de ordem de 50 Cartões e 10 Baralhos. A exclusão de
  busca, filtro e paginação se sustenta nessa escala e precisaria ser reavaliada
  em acervos significativamente maiores.
- Criar um cartão e vinculá-lo a um baralho são dois atos distintos; o produto
  não oferece um gesto único que faça ambos.
- Uma sessão por vez, não retomável. Sair da sessão a encerra.
- Exclusões não são reversíveis; não há desfazer no MVP.
- Acessibilidade é assegurada pela navegação por teclado nas ações da sessão;
  auditoria formal de conformidade está fora de escopo.
- A interface é monolíngue em português. Não há troca de idioma, nem
  internacionalização, no MVP.
- A aplicação é executada localmente, na máquina do usuário, e não é exposta em
  rede pública. A ausência de autenticação é segura sob essa condição, e apenas
  sob ela.
- Hospedagem remota é direção futura declarada pelo Product Owner e está fora do
  escopo desta feature. Expor a aplicação publicamente exigiria reabrir a decisão
  de não haver usuários e autenticação, por transformar o acervo único em acervo
  compartilhado e editável por qualquer visitante.
- Decisões de linguagem, framework, armazenamento, protocolo e ferramenta não
  pertencem a esta especificação e serão tomadas em `plan`.
