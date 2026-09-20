# Feature Specification: Vincular Cartão a Baralho

**Feature Branch**: `003-vincular-cartao-baralho`
**Created**: 2026-09-20
**Status**: Draft
**Input**: Decomposição da especificação do MVP (SESSION.md, EVT-027). Glossário normativo em `CONTEXT.md`.

**Depende de**: `001-criar-cartao`, `002-criar-baralho`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tornar um baralho estudável (Priority: P1)

O usuário vincula um Cartão existente a um Baralho existente, em ato distinto da
criação de ambos. O Baralho torna-se elegível para estudo. O usuário também pode
desfazer o Vínculo, preservando Cartão e Baralho.

**Why this priority**: é o ato que fecha o ciclo. Criar Cartão e criar Baralho,
isolados, não produzem nada estudável.

**Independent Test**: criar um Cartão e um Baralho, vincular, confirmar que o
Baralho ficou elegível, desvincular e confirmar que ambos continuam existindo e
que o Baralho voltou a não ser elegível.

**Acceptance Scenarios**:

1. **Given** um Cartão e um Baralho sem Vínculo entre si, **When** o usuário
   vincula, **Then** o Cartão passa a constar entre os Cartões do Baralho, o
   Baralho passa a constar entre os Baralhos do Cartão, e o Baralho torna-se
   elegível.
2. **Given** um Cartão já vinculado a um Baralho, **When** o usuário tenta
   vincular o mesmo Cartão ao mesmo Baralho novamente, **Then** a operação é
   recusada e nenhum Vínculo duplicado é criado.
3. **Given** um Cartão vinculado a três Baralhos, **When** o usuário abre a lista
   de Cartões, **Then** o Cartão aparece uma única vez, indicando os três
   Baralhos.
4. **Given** um Cartão vinculado a um Baralho, **When** o usuário desvincula,
   **Then** o Cartão e o Baralho continuam existindo e apenas o Vínculo deixa de
   existir.
5. **Given** um Baralho com um único Cartão vinculado, **When** o usuário
   desvincula esse Cartão, **Then** o Baralho deixa de ser elegível e continua
   existindo.
6. **Given** um Cartão, **When** é vinculado a 20 Baralhos, **Then** todos os
   Vínculos são aceitos: não há limite superior.
7. **Given** um Baralho, **When** recebe 60 Cartões, **Then** todos os Vínculos
   são aceitos.
8. **Given** uma tentativa de Vínculo que não parte da interface, **When** o
   Vínculo já existe, **Then** a operação é recusada pelo servidor.
9. **Given** Vínculos criados, **When** o usuário fecha e reabre a aplicação,
   **Then** todos continuam existindo.

### Edge Cases

- **Cartão sem nenhum Baralho**: estado legítimo e alcançável pela lista de
  Cartões. Nenhum Cartão pode ficar inacessível.
- **Baralho sem nenhum Cartão**: não elegível, com a razão comunicada.
- **Elegibilidade perdida entre a listagem e o início do estudo**: a
  elegibilidade é reavaliada no momento de iniciar, não apenas ao renderizar a
  lista.
- **Vínculo inexistente**: desvincular o que não está vinculado é recusado.

## Requirements *(mandatory)*

### Functional Requirements

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
- **FR-024**: O sistema MUST considerar um Baralho elegível se e somente se ele
  tem ao menos um Cartão vinculado.
- **FR-026**: O sistema MUST comunicar, para um Baralho não elegível, a razão de
  não poder ser estudado.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-022 | Não há limite superior de Vínculos | Teste que cria um Cartão vinculado a 20 Baralhos e um Baralho com 60 Cartões, ambos aceitos |

### Key Entities

- **Vínculo**: a associação entre um Cartão e um Baralho, criada e desfeita
  independentemente da existência de ambos. Único por par.

## Success Criteria *(mandatory)*

- **SC-006**: Nenhum Cartão fica inacessível: todo Cartão existente, inclusive os
  sem Baralho, é alcançável pela lista de Cartões em cem por cento dos casos.
- **SC-009**: Toda tentativa de criar Vínculo duplicado é recusada, mesmo quando
  a solicitação não parte da interface.

## Invariantes de Domínio

1. Um Cartão está vinculado a zero ou mais Baralhos.
2. O par (Cartão, Baralho) é único.
3. Um Baralho é elegível se e somente se tem ao menos um Cartão vinculado.
4. Desvincular preserva Cartão e Baralho.

## Funcionalidades Adiadas

- Estudar um Baralho elegível — feature `004`.
- Editar e excluir Cartão e Baralho — features `005` e `006`.
- Mover Cartões em lote entre Baralhos.

## Assumptions

- As premissas de `001-criar-cartao` e `002-criar-baralho` valem integralmente.
- Criar um Cartão e vinculá-lo a um Baralho são dois atos distintos; não há gesto
  único que faça ambos.
- Decisões técnicas pertencem ao `plan` desta feature.
