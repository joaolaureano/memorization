# Feature Specification: Criar Baralho

**Feature Branch**: `002-criar-baralho`
**Created**: 2026-09-20
**Status**: Draft
**Input**: Decomposição da especificação do MVP (SESSION.md, EVT-027). Glossário normativo em `CONTEXT.md`.

**Depende de**: `001-criar-cartao` (fundação de projeto e persistência)

## Clarifications

### Session 2026-09-21

- Q: Esta feature precisa de requisitos próprios de teclado, foco, semântica, falha de gravação, idioma, responsividade e estado vazio? → A: Sim. Premissa não gera teste; a obrigação constitucional sem requisito na spec desaparece na verificação. Registrado como débito em EVT-030 e fechado aqui.
- Q: Requisitos transversais devem ser repetidos com id novo ou reutilizados? → A: Reutilizados quando o enunciado é genérico (FR-042, FR-044, FR-045, FR-046); id próprio quando o enunciado nomeia a entidade.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Organizar o estudo por assunto (Priority: P1)

O usuário cria um Baralho com um nome, para reunir Cartões de um mesmo assunto.
O Baralho aparece na lista e continua lá depois de fechar e reabrir a aplicação.

**Why this priority**: é o agrupamento que torna o estudo focado. Sem Baralho não
há o que selecionar para estudar.

**Independent Test**: criar dois Baralhos com o mesmo nome, fechar a aplicação,
reabrir e confirmar que ambos continuam listados e indicados como não elegíveis.

**Acceptance Scenarios**:

1. **Given** nenhum Baralho existe, **When** o usuário abre a lista de Baralhos,
   **Then** o estado vazio é comunicado e a primeira ação é orientada.
2. **Given** nenhum Baralho existe, **When** o usuário cria um Baralho chamado
   `Inglês`, **Then** ele passa a existir, aparece na lista e é indicado como
   **não elegível** para estudo, com a razão comunicada.
3. **Given** já existe um Baralho chamado `Inglês`, **When** o usuário cria outro
   com o mesmo nome, **Then** a criação é aceita: o nome é rótulo, não
   identificador.
4. **Given** o usuário está criando um Baralho, **When** o nome está vazio ou
   contém apenas espaços, **Then** a criação é recusada.

   E a recusa vale também quando a requisição **não parte da interface**, por ser
   verificada de forma autoritativa no servidor.
5. **Given** o usuário está criando um Baralho, **When** o nome excede 100
   caracteres, **Then** a criação é recusada, com o limite e o tamanho atual
   informados.
6. **Given** Baralhos criados, **When** o usuário fecha e reabre a aplicação,
   **Then** todos continuam existindo exatamente como estavam.
7. **Given** o usuário está digitando o nome, **When** se aproxima do limite de
   100 caracteres, **Then** o limite é comunicado antes da tentativa de salvar.
8. **Given** a tela de criação de Baralho, **When** o usuário navega apenas por
   teclado, **Then** alcança o campo e aciona a criação sem recorrer ao
   ponteiro, com o elemento focado sempre identificável sem depender de cor.
9. **Given** a criação recusada por nome vazio, **When** a mensagem é exibida,
   **Then** ela é perceptível por leitor de tela e o foco vai para o campo que
   precisa de correção.
10. **Given** o armazenamento indisponível, **When** o usuário tenta criar um
    Baralho, **Then** a operação é reportada como falha, não aparece como
    concluída, e o texto digitado permanece para nova tentativa.

### Edge Cases

- **Nenhum Baralho**: a lista comunica o estado vazio.
- **Baralho recém-criado**: existe, é listado, e **não é elegível**, com a razão
  comunicada e não apenas sinalizada por ação desabilitada.
- **Nomes repetidos**: permitidos.
- **Falha de persistência**: a criação nunca aparece como concluída.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-010**: O sistema MUST permitir criar um Baralho informando um nome.
- **FR-011**: O sistema MUST recusar a criação de um Baralho com nome vazio,
  inclusive quando composto apenas de espaços.
- **FR-012**: O sistema MUST aceitar Baralhos com nomes repetidos: o nome é
  rótulo, não identificador.
- **FR-013**: O sistema MUST expor uma lista de todos os Baralhos existentes,
  indicando quais são elegíveis para estudo.
- **FR-014**: O sistema MUST exibir, para cada Baralho, seu nome e os Cartões
  vinculados.
- **FR-018**: Um Baralho MUST NOT possuir qualquer propriedade além de nome.

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
- **FR-023**: O sistema MUST validar as regras de Baralho de forma autoritativa,
  não apenas na camada de apresentação.
- **FR-024**: O sistema MUST considerar um Baralho elegível se e somente se ele
  tem ao menos um Cartão vinculado, derivando a elegibilidade por contagem e
  **nunca** a armazenando.
- **FR-040**: O sistema MUST preservar os Baralhos entre execuções da
  aplicação.

**Específicos desta feature**, por nomearem a entidade:

- **FR-057**: O sistema MUST comunicar o estado vazio da lista de Baralhos,
  orientando a primeira ação.
- **FR-058**: O sistema MUST permitir criar um Baralho e navegar a lista de
  Baralhos inteiramente por teclado, sem recorrer ao ponteiro.
- **FR-059**: O sistema MUST manter o foco do teclado visível, com indicação que
  não dependa apenas de cor, e MUST mover o foco para o campo que precisa de
  correção quando uma operação for recusada.
- **FR-060**: As mensagens de erro e o estado vazio da lista de Baralhos MUST ser
  perceptíveis por leitor de tela, e não apenas visualmente.
- **FR-061**: O sistema MUST comunicar o limite de 100 caracteres do nome
  **durante** a digitação, e não apenas ao tentar salvar.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-018 | Baralho não tem propriedade além de nome | Teste que envia propriedade extra na criação e exige que ela seja ignorada ou recusada, e que não retorne nas leituras |

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-018 | Baralho não tem propriedade além de nome | Teste que envia propriedade extra na criação e exige que ela seja ignorada ou recusada, e que não retorne nas leituras |
| FR-044 | Operação não persistida não aparece como concluída | Teste com armazenamento indisponível |

### Key Entities

- **Baralho**: agrupamento nomeado de Cartões vinculados sobre um mesmo assunto.
  Tem apenas nome, que não precisa ser único.
- **Baralho elegível**: Baralho com ao menos um Cartão vinculado. A elegibilidade
  é **derivada**, nunca armazenada.

## Success Criteria *(mandatory)*

- **SC-003**: Cem por cento dos Baralhos criados continuam presentes e corretos
  após fechar e reabrir a aplicação.
- **SC-016**: Nenhum Baralho gravado excede 100 caracteres no nome, inclusive
  quando a requisição não parte da interface.
- **SC-011**: Com 10 Baralhos no acervo, a lista permanece navegável sem busca
  nem paginação.
- **SC-012**: Em cem por cento das falhas de gravação simuladas, nenhuma
  operação aparece como concluída e nenhum conteúdo informado é perdido.
- **SC-018**: A criação de um Baralho pode ser concluída do campo ao salvamento
  usando apenas o teclado, e o elemento focado é identificável sem percepção de
  cor em cem por cento dos passos.

## Invariantes de Domínio

1. Um Baralho tem nome não vazio, de no máximo 100 caracteres, que não precisa
   ser único.
2. Um Baralho é elegível se e somente se tem ao menos um Cartão vinculado.
3. A elegibilidade é derivada por contagem e nunca persistida como campo.
4. Toda ação oferecida pela feature é executável por teclado, e nenhum estado
   relevante é comunicado apenas por cor.

## Funcionalidades Adiadas

- Vincular Cartões ao Baralho — feature `003`.
- Renomear e excluir Baralho — features `005` e `006`.
- Subdecks e hierarquia.
- Descrição, cor, ícone ou qualquer propriedade além do nome.

## Assumptions

- As premissas de `001-criar-cartao` valem integralmente: usuário único, execução
  local, texto simples, persistência entre execuções.
- Um Baralho recém-criado é legitimamente vazio e não elegível; isso não é estado
  de erro.
- Decisões técnicas pertencem ao `plan` desta feature.
