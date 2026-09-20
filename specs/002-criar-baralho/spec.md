# Feature Specification: Criar Baralho

**Feature Branch**: `002-criar-baralho`
**Created**: 2026-09-20
**Status**: Draft
**Input**: Decomposição da especificação do MVP (SESSION.md, EVT-027). Glossário normativo em `CONTEXT.md`.

**Depende de**: `001-criar-cartao` (fundação de projeto e persistência)

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
5. **Given** o usuário está criando um Baralho, **When** o nome excede 100
   caracteres, **Then** a criação é recusada, com o limite e o tamanho atual
   informados.
6. **Given** Baralhos criados, **When** o usuário fecha e reabre a aplicação,
   **Then** todos continuam existindo exatamente como estavam.

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

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-018 | Baralho não tem propriedade além de nome | Teste que envia propriedade extra na criação e exige que ela seja ignorada ou recusada, e que não retorne nas leituras |

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

## Invariantes de Domínio

1. Um Baralho tem nome não vazio, de no máximo 100 caracteres, que não precisa
   ser único.
2. Um Baralho é elegível se e somente se tem ao menos um Cartão vinculado.
3. A elegibilidade é derivada por contagem e nunca persistida como campo.

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
