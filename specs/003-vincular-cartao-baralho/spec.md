# Feature Specification: Vincular Cartão a Baralho

**Feature Branch**: `003-vincular-cartao-baralho`
**Created**: 2026-09-20
**Status**: Draft
**Input**: Decomposição da especificação do MVP (SESSION.md, EVT-027). Glossário normativo em `CONTEXT.md`.

**Depende de**: `001-criar-cartao`, `002-criar-baralho`

## Clarifications

### Session 2026-09-21

- Q: Esta feature precisa de requisitos próprios de teclado, foco, semântica, falha de gravação, idioma, responsividade e estado vazio? → A: Sim. Premissa não gera teste. Débito de EVT-030 fechado aqui.
- Q: Como o usuário descobre que não há o que vincular? → A: Estado vazio próprio, distinguindo três casos: não há Cartão, não há Baralho, ou ambos existem mas já estão todos vinculados.
- Q: Desvincular exige confirmação? → A: Não. Desvincular é reversível e não destrói nada; exigir confirmação em ato reversível treina o usuário a ignorar confirmações, enfraquecendo as da exclusão, que é irreversível.

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
10. **Given** nenhum Cartão existe, **When** o usuário abre a tela de Vínculos,
    **Then** o estado vazio explica que é preciso criar um Cartão antes, e não
    apenas desabilita a ação.
11. **Given** nenhum Baralho existe, **When** o usuário abre a tela de Vínculos,
    **Then** o estado vazio explica que é preciso criar um Baralho antes, e não
    apenas desabilita a ação.
12. **Given** todos os Cartões já estão vinculados ao Baralho, **When** o usuário
    abre a tela de Vínculos daquele Baralho, **Then** a situação é comunicada e
    distinguida do caso em que não há Cartão algum.
13. **Given** a tela de Vínculos, **When** o usuário navega apenas por teclado,
    **Then** consegue vincular e desvincular sem recorrer ao ponteiro, com o
    elemento focado sempre identificável sem depender de cor.
14. **Given** um Vínculo criado ou desfeito, **When** a operação conclui,
    **Then** a mudança é perceptível por leitor de tela, e não apenas
    visualmente.
15. **Given** o armazenamento indisponível, **When** o usuário tenta vincular ou
    desvincular,
    **Then** a operação é reportada como falha, não aparece como concluída, e o
    estado exibido continua consistente com o armazenamento.

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

**Transversais reutilizados**, com enunciado genérico e observáveis nesta
feature:

- **FR-040**: O sistema MUST preservar os Vínculos entre execuções da aplicação.
- **FR-042**: O sistema MUST apresentar suas telas de forma utilizável em telas
  pequenas.
- **FR-044**: O sistema MUST NOT apresentar como concluída qualquer operação que
  não tenha sido efetivamente persistida.
- **FR-045**: Quando uma operação falhar por indisponibilidade do armazenamento,
  o sistema MUST reportar a falha e MUST preservar o estado da tela, permitindo
  nova tentativa.
- **FR-046**: O sistema MUST apresentar toda a sua interface em português,
  empregando os termos canônicos de `CONTEXT.md` e MUST NOT empregar os
  sinônimos listados como `_Avoid_`.
- **FR-003**: O sistema MUST expor uma lista de todos os Cartões existentes,
  **indicando, para cada um, os Baralhos a que está vinculado**, e incluindo os
  Cartões sem nenhum Baralho.
- **FR-004**: O sistema MUST exibir, para cada Cartão, sua Frente, seu Verso e
  seus Baralhos.
- **FR-013**: O sistema MUST expor uma lista de todos os Baralhos, indicando
  quais são elegíveis, **com a elegibilidade agora variando** conforme os
  Vínculos.
- **FR-014**: O sistema MUST exibir, para cada Baralho, seu nome e os Cartões
  vinculados.

**Específicos desta feature**, por nomearem a operação ou a entidade:

- **FR-062**: O sistema MUST comunicar o estado vazio da tela de Vínculos,
  distinguindo os casos de **não haver Cartão**, **não haver Baralho** e **todos
  os Cartões já estarem vinculados**.
- **FR-063**: O sistema MUST permitir vincular e desvincular inteiramente por
  teclado, sem recorrer ao ponteiro.
- **FR-064**: O sistema MUST manter o foco do teclado visível, com indicação que
  não dependa apenas de cor, e MUST preservar a posição do foco após vincular ou
  desvincular, para que o usuário não perca o lugar na lista.
- **FR-065**: A criação e a remoção de um Vínculo, e a mudança de elegibilidade
  dela decorrente, MUST ser perceptíveis por leitor de tela.
- **FR-066**: O sistema MUST NOT exigir confirmação para desvincular, por ser
  operação reversível que não destrói Cartão nem Baralho.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-022 | Não há limite superior de Vínculos | Teste que cria um Cartão vinculado a 20 Baralhos e um Baralho com 60 Cartões, ambos aceitos |
| FR-044 | Operação não persistida não aparece como concluída | Teste com armazenamento indisponível |
| FR-066 | Desvincular não pede confirmação | Teste que desvincula e assevera que nenhum diálogo é apresentado |

### Key Entities

- **Vínculo**: a associação entre um Cartão e um Baralho, criada e desfeita
  independentemente da existência de ambos. Único por par.

## Success Criteria *(mandatory)*

- **SC-006**: Nenhum Cartão fica inacessível: todo Cartão existente, inclusive os
  sem Baralho, é alcançável pela lista de Cartões em cem por cento dos casos.
- **SC-009**: Toda tentativa de criar Vínculo duplicado é recusada, mesmo quando
  a solicitação não parte da interface.
- **SC-003**: Cem por cento dos Vínculos criados continuam presentes e corretos
  após fechar e reabrir a aplicação.
- **SC-012**: Em cem por cento das falhas de gravação simuladas, nenhuma
  operação aparece como concluída e nenhum Vínculo inexistente é exibido.
- **SC-019**: Vincular e desvincular podem ser concluídos apenas pelo teclado, e
  o foco permanece em posição previsível após cada operação, em cem por cento
  dos casos.

## Invariantes de Domínio

1. Um Cartão está vinculado a zero ou mais Baralhos.
2. O par (Cartão, Baralho) é único.
3. Um Baralho é elegível se e somente se tem ao menos um Cartão vinculado.
4. Desvincular preserva Cartão e Baralho.
5. Toda ação oferecida pela feature é executável por teclado, e nenhum estado
   relevante é comunicado apenas por cor.
6. Desvincular é reversível e não exige confirmação.

## Funcionalidades Adiadas

- Estudar um Baralho elegível — feature `004`.
- Editar e excluir Cartão e Baralho — features `005` e `006`.
- Mover Cartões em lote entre Baralhos.

## Assumptions

- As premissas de `001-criar-cartao` e `002-criar-baralho` valem integralmente.
- Criar um Cartão e vinculá-lo a um Baralho são dois atos distintos; não há gesto
  único que faça ambos.
- Decisões técnicas pertencem ao `plan` desta feature.
