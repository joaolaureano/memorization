# Feature Specification: Excluir Cartão e Baralho

**Feature Branch**: `006-excluir-cartao-e-baralho`
**Created**: 2026-09-20
**Status**: Draft
**Input**: Decomposição da especificação do MVP (SESSION.md, EVT-027). Glossário normativo em `CONTEXT.md`.

**Depende de**: `003-vincular-cartao-baralho`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descartar o que não serve, sem perder o que serve (Priority: P2)

O usuário exclui Cartões ou Baralhos que não servem mais, sabendo exatamente o
que cada exclusão destrói. **Excluir um Cartão nunca destrói um Baralho, e
excluir um Baralho nunca destrói um Cartão**: apenas os Vínculos deixam de
existir.

**Why this priority**: sem exclusão o acervo só cresce. A assimetria entre
desvincular e excluir é a forma mais fácil de o usuário perder conteúdo achando
que estava organizando, e por isso a confirmação precisa ser honesta.

**Independent Test**: partindo de um Cartão vinculado a dois Baralhos, excluir um
Baralho e confirmar que o Cartão sobrevive; excluir o Cartão e confirmar que o
Baralho restante sobrevive.

**Acceptance Scenarios**:

1. **Given** um Cartão vinculado a dois Baralhos, **When** o usuário exclui o
   Cartão e confirma, **Then** o Cartão deixa de existir, some dos dois
   Baralhos, e **nenhum Baralho é destruído**.
2. **Given** um Baralho com Cartões vinculados, **When** o usuário solicita
   excluí-lo, **Then** é pedida confirmação explícita que informa quantos
   Cartões continuarão existindo após a exclusão.
3. **Given** um Baralho com Cartões vinculados, **When** o usuário confirma a
   exclusão, **Then** o Baralho deixa de existir, todos os seus Vínculos deixam
   de existir, e **nenhum Cartão é destruído**.
4. **Given** um Cartão que estava apenas no Baralho excluído, **When** a exclusão
   é concluída, **Then** o Cartão continua acessível pela lista de Cartões, sem
   nenhum Baralho vinculado.
5. **Given** uma solicitação de exclusão, **When** o usuário recusa a
   confirmação, **Then** nada é excluído.
6. **Given** um Baralho do qual o último Cartão foi excluído, **When** o usuário
   consulta a lista, **Then** o Baralho continua existindo e deixa de ser
   elegível.
7. **Given** uma exclusão de Cartão, **When** solicitada, **Then** também exige
   confirmação explícita.
8. **Given** uma exclusão que não parte da interface, **When** alcança o
   servidor, **Then** a semântica não-cascateante é preservada igualmente.

### Edge Cases

- **Excluir o último Cartão de um Baralho**: o Baralho sobrevive e perde a
  elegibilidade.
- **Excluir um Baralho cujos Cartões estão todos em outros Baralhos**: nenhum
  Cartão fica órfão, e a confirmação reflete isso.
- **Cartão que fica sem nenhum Baralho**: estado legítimo, alcançável pela lista
  de Cartões.
- **Baralho excluído durante Sessão ativa**: a Sessão em curso prossegue até o
  Resumo.
- **Exclusão de entidade inexistente**: recusada, e a interface não confirma ao
  usuário uma exclusão que não ocorreu.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-007**: Os usuários MUST poder excluir um Cartão mediante confirmação
  explícita.
- **FR-008**: A exclusão de um Cartão MUST remover todos os seus Vínculos e MUST
  NOT destruir nenhum Baralho.
- **FR-016**: Os usuários MUST poder excluir um Baralho mediante confirmação
  explícita que informe quantos Cartões continuarão existindo após a exclusão.
- **FR-017**: A exclusão de um Baralho MUST remover todos os seus Vínculos e MUST
  NOT destruir nenhum Cartão.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-008 | Excluir Cartão não destrói Baralho | Teste que exclui um Cartão vinculado a dois Baralhos e confirma que ambos sobrevivem |
| FR-017 | Excluir Baralho não destrói Cartão | Teste que exclui um Baralho com Cartões e confirma que todos sobrevivem e seguem alcançáveis |

### Key Entities

Sem entidade nova. Atua sobre **Cartão**, **Baralho** e **Vínculo**.

## Success Criteria *(mandatory)*

- **SC-005**: Nenhuma exclusão de Baralho destrói Cartões, e nenhuma exclusão de
  Cartão destrói Baralhos, em cem por cento das tentativas.
- **SC-006**: Nenhum Cartão fica inacessível: todo Cartão existente, inclusive os
  que ficaram sem Baralho após uma exclusão, é alcançável pela lista de Cartões.

## Invariantes de Domínio

1. Excluir um Baralho remove seus Vínculos e preserva os Cartões.
2. Excluir um Cartão remove seus Vínculos e preserva os Baralhos, que podem
   deixar de ser elegíveis.
3. Nenhuma exclusão atravessa de uma entidade para a outra.
4. Toda exclusão exige confirmação explícita, e a confirmação declara a
   consequência real.

## Funcionalidades Adiadas

- Desfazer exclusão e lixeira.
- Exclusão em lote.
- Exclusão em cascata opcional escolhida pelo usuário.

## Assumptions

- As premissas das features anteriores valem integralmente.
- Exclusões não são reversíveis; não há desfazer no MVP.
- Desvincular e excluir são operações distintas com nomes distintos na interface:
  desvincular pertence à feature `003`.
- Decisões técnicas pertencem ao `plan` desta feature.
