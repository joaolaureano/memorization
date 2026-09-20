# Feature Specification: Editar Cartão e Baralho

**Feature Branch**: `005-editar-cartao-e-baralho`
**Created**: 2026-09-20
**Status**: Draft
**Input**: Decomposição da especificação do MVP (SESSION.md, EVT-027). Glossário normativo em `CONTEXT.md`.

**Depende de**: `003-vincular-cartao-baralho`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Corrigir conteúdo sem perdê-lo (Priority: P2)

O usuário corrige a Frente ou o Verso de um Cartão, ou renomeia um Baralho,
sabendo o alcance da alteração. Sair de uma edição com alterações não salvas
exige confirmação.

**Why this priority**: sem edição, um erro de digitação torna o Cartão lixo
permanente. Não é necessária para a primeira Sessão funcionar, por isso vem
depois das P1.

**Independent Test**: partindo de um Cartão vinculado a dois Baralhos, editar o
Cartão e confirmar a alteração nos dois; começar outra edição, alterar e tentar
sair, confirmando que a saída é barrada.

**Acceptance Scenarios**:

1. **Given** um Cartão existente, **When** o usuário altera sua Frente ou seu
   Verso, **Then** a alteração vale em todos os Baralhos a que ele está
   vinculado.
2. **Given** um Cartão vinculado a três Baralhos, **When** o usuário abre sua
   edição, **Then** é informado de que o Cartão está em três Baralhos antes de
   confirmar.
3. **Given** um Cartão em edição, **When** a Frente resultante fica vazia ou
   excede 1000 caracteres, **Then** a alteração é recusada.
4. **Given** um Baralho existente, **When** o usuário altera seu nome, **Then** o
   novo nome é exibido em todos os lugares, e seus Vínculos permanecem intactos.
5. **Given** um Baralho em edição, **When** o nome resultante fica vazio ou
   excede 100 caracteres, **Then** a alteração é recusada.
6. **Given** uma edição com alterações não salvas, **When** o usuário tenta sair
   da tela, **Then** é pedida confirmação explícita antes de descartá-las.
7. **Given** o pedido de confirmação por alterações não salvas, **When** o
   usuário recusa, **Then** a edição permanece aberta com o conteúdo digitado
   intacto.
8. **Given** o armazenamento indisponível, **When** o usuário salva uma edição,
   **Then** a operação é reportada como falha e o conteúdo digitado permanece.

### Edge Cases

- **Edição abandonada com alterações**: a saída exige confirmação; recusada, a
  edição segue aberta com o conteúdo intacto.
- **Edição que esvazia um campo**: recusada, como na criação.
- **Cartão editado durante Sessão ativa**: a Sessão usa o conteúdo capturado no
  seu início e permanece internamente consistente.
- **Renomear Baralho**: não afeta Vínculos nem elegibilidade.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-005**: Os usuários MUST poder editar a Frente e o Verso de um Cartão, e a
  alteração MUST valer em todos os Baralhos a que ele está vinculado.
- **FR-006**: O sistema MUST informar, ao editar um Cartão, em quantos Baralhos
  ele está vinculado.
- **FR-015**: Os usuários MUST poder renomear um Baralho sem afetar seus
  Vínculos.
- **FR-050**: Ao sair de uma edição de Cartão ou de Baralho com alterações não
  salvas, o sistema MUST pedir confirmação explícita antes de descartá-las.

### Key Entities

Sem entidade nova. Atua sobre **Cartão**, **Baralho** e **Vínculo**, definidos
nas features `001`, `002` e `003`.

## Success Criteria *(mandatory)*

- **SC-014**: Nenhuma alteração digitada e não salva é descartada sem confirmação
  explícita do usuário, em cem por cento das tentativas de sair da edição.

## Invariantes de Domínio

1. Editar um Cartão altera o Cartão, não cópias: a alteração vale em todos os
   Baralhos a que ele está vinculado.
2. As regras de conteúdo não vazio e de limite de tamanho valem na edição
   exatamente como valem na criação.
3. Renomear um Baralho preserva todos os seus Vínculos.

## Funcionalidades Adiadas

- Excluir Cartão e Baralho — feature `006`.
- Histórico de alterações e desfazer.
- Edição em lote.

## Assumptions

- As premissas das features anteriores valem integralmente.
- A edição não permite alterar Vínculos: isso pertence à feature `003`.
- Decisões técnicas pertencem ao `plan` desta feature.
