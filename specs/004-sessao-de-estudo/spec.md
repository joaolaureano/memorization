# Feature Specification: Sessão de Estudo

**Feature Branch**: `004-sessao-de-estudo`
**Created**: 2026-09-20
**Status**: Draft
**Input**: Decomposição da especificação do MVP (SESSION.md, EVT-027). Glossário normativo em `CONTEXT.md`.

**Depende de**: `003-vincular-cartao-baralho` (exige um Baralho elegível)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exercitar a memória e ver o resultado (Priority: P1)

O usuário escolhe um Baralho elegível, informa quantos Cartões quer estudar,
recebe os Cartões em ordem randomizada vendo apenas a Frente, revela o Verso
quando tiver tentado lembrar, declara se acertou ou errou, e ao final vê o
Resumo.

**Why this priority**: é o propósito do produto. Sem esta feature, a aplicação é
apenas um cadastro.

**Independent Test**: partindo de um Baralho elegível com cinco Cartões, iniciar
uma Sessão de três, percorrer os três Itens revelando e autoavaliando cada um, e
confirmar que o Resumo apresenta três estudados com a soma correta.

**Acceptance Scenarios**:

1. **Given** um Baralho sem Cartão vinculado, **When** o usuário tenta estudá-lo,
   **Then** a Sessão não é iniciada e a razão é comunicada.
2. **Given** um Baralho elegível com dez Cartões, **When** o usuário solicita
   quatro, **Then** a Sessão começa com exatamente quatro Itens.
3. **Given** um Baralho elegível com doze Cartões, **When** o usuário solicita
   cinquenta, **Then** a Sessão começa com doze Itens e o usuário é avisado
   antes do primeiro Item.
4. **Given** o usuário define a quantidade, **When** informa zero ou negativo,
   **Then** a Sessão não é iniciada.
5. **Given** uma Sessão iniciada, **When** o primeiro Item é apresentado,
   **Then** apenas a Frente é exibida e o Verso permanece oculto.
6. **Given** um Item com o Verso oculto, **When** o usuário executa a Revelação,
   **Then** o Verso é exibido e a autoavaliação torna-se disponível.
7. **Given** um Item cujo Verso não foi revelado, **When** o usuário tenta
   registrar acertou ou errou, **Then** a autoavaliação não é aceita.
8. **Given** um Item cujo Resultado já foi registrado, **When** o usuário tenta
   alterá-lo, **Then** a alteração é recusada.
9. **Given** uma Sessão de três Itens com dois respondidos, **When** o usuário
   registra o terceiro, **Then** a Sessão termina e o Resumo é apresentado.
10. **Given** uma Sessão concluída com três Itens, dois acertos e um erro,
    **When** o Resumo é apresentado, **Then** ele informa três estudados, dois
    acertos e um erro.
11. **Given** um Baralho elegível com cinco Cartões, **When** o usuário estuda os
    cinco, **Then** cada Cartão aparece exatamente uma vez.
12. **Given** uma Sessão em andamento, **When** o usuário a interrompe por
    qualquer motivo, **Then** nenhum Resumo é produzido, nada é registrado, e ao
    voltar o usuário pode iniciar uma Sessão nova.
13. **Given** uma Sessão de dez Itens com três respondidos, **When** o usuário
    observa a tela, **Then** identifica sua posição e o total sem precisar
    contar.
14. **Given** o usuário registrou o Resultado de um Item, **When** o Item
    seguinte é apresentado, **Then** o foco do teclado é movido para o novo
    conteúdo e permanece visível sem depender de cor.
15. **Given** um Item com o Verso revelado, **When** o Resultado é registrado,
    **Then** a mudança de estado é perceptível por leitor de tela.

### Edge Cases

- **Baralho com exatamente um Cartão**: Sessão válida de um Item. Randomizar
  conjunto unitário não é caso especial.
- **Elegibilidade perdida entre a listagem e o início**: verificada no momento de
  iniciar, de forma autoritativa.
- **Cartão alterado ou excluído durante Sessão ativa**: os Itens usam o conteúdo
  capturado no início, de modo que a Sessão permanece internamente consistente.
- **Baralho excluído durante Sessão ativa**: a Sessão prossegue até o Resumo.
- **Verso revelado sem autoavaliação seguida de interrupção**: o Item fica sem
  Resultado, a Sessão é descartada e nenhum Resumo é produzido.
- **Todos os Itens respondidos como errou**: Resumo com zero acertos é resultado
  válido, não condição de erro.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-025**: O sistema MUST permitir iniciar uma Sessão apenas a partir de um
  Baralho elegível, verificando a elegibilidade no momento do início.
- **FR-027**: Os usuários MUST poder informar quantos Cartões desejam estudar.
- **FR-028**: O sistema MUST recusar quantidade menor que um.
- **FR-029**: Quando a quantidade solicitada exceder os Cartões vinculados, o
  sistema MUST iniciar a Sessão com todos os disponíveis e MUST avisar quantos
  Itens a Sessão terá.
- **FR-030**: O sistema MUST apresentar os Itens em ordem randomizada, definida
  no início da Sessão e imutável durante ela.
- **FR-031**: O sistema MUST NOT originar mais de um Item a partir do mesmo
  Cartão dentro da mesma Sessão.
- **FR-032**: O sistema MUST exibir, para cada Item, apenas a Frente até que
  ocorra a Revelação.
- **FR-033**: A Revelação MUST ocorrer somente por ação explícita do usuário.
- **FR-034**: O sistema MUST recusar o registro de um Resultado antes da
  Revelação daquele Item.
- **FR-035**: O sistema MUST aceitar exatamente um Resultado por Item, com os
  valores acertou ou errou, e MUST recusar qualquer alteração posterior.
- **FR-036**: O sistema MUST NOT avaliar, comparar ou corrigir a recordação do
  usuário: o Resultado é declaração do próprio usuário.
- **FR-037**: O sistema MUST apresentar o Resumo somente quando todos os Itens
  tiverem Resultado, informando quantidade estudada, acertos e erros, com
  acertos somados a erros igual à quantidade estudada.
- **FR-038**: O sistema MUST NOT persistir Sessões, Itens, Resultados ou Resumos.
- **FR-039**: Qualquer interrupção de uma Sessão MUST descartá-la integralmente,
  sem produzir Resumo e sem deixar registro.
- **FR-041**: O sistema MUST permitir executar as ações da Sessão — Revelação e
  registro de Resultado — inteiramente por teclado.
- **FR-047**: Durante uma Sessão, o sistema MUST informar continuamente a posição
  do Item corrente e o total de Itens.
- **FR-048**: O sistema MUST manter o foco do teclado sempre visível, com
  indicação que não dependa apenas de cor, e MUST movê-lo para o conteúdo
  recém-apresentado ao avançar de Item.
- **FR-049**: Mudanças de estado relevantes — Verso revelado, Resultado
  registrado, Sessão concluída — MUST ser perceptíveis por leitor de tela.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-031 | Nenhum Cartão origina dois Itens | Teste que estuda todos os Cartões de um Baralho e confirma unicidade |
| FR-036 | O sistema não avalia a recordação | A Interface não aceita resposta digitada, logo não há o que comparar. Teste que confirma que o registro só admite acertou e errou |
| FR-038 | Sessão não é persistida | Teste que conclui uma Sessão e verifica ausência de vestígio; inspeção do contrato, que não possui rota de Sessão |

### Key Entities

- **Sessão de estudo**: execução em que Cartões de um único Baralho são revisados
  um a um até o Resumo. Nunca persistida.
- **Item de estudo**: a apresentação de um Cartão dentro de uma Sessão. Carrega
  cópia da Frente e do Verso capturada no início.
- **Revelação**: ação explícita que exibe o Verso de um Item.
- **Resultado do item**: declaração do usuário, acertou ou errou. No máximo um
  por Item, imutável.
- **Resumo da sessão**: consolidação final de estudados, acertos e erros.
  Descartado com a Sessão.

## Success Criteria *(mandatory)*

- **SC-002**: Em cem Sessões de um Baralho com dez ou mais Cartões, nenhum Cartão
  se repete dentro da mesma Sessão, e a ordem varia entre Sessões.
- **SC-004**: Cem por cento das Sessões concluídas apresentam Resumo em que a
  soma de acertos e erros é igual à quantidade estudada.
- **SC-007**: Uma Sessão inteira pode ser percorrida do primeiro Item ao Resumo
  usando apenas o teclado.
- **SC-008**: Nenhum dado de Sessão, Item, Resultado ou Resumo sobrevive ao
  encerramento, verificável em cem por cento das interrupções.
- **SC-010**: Um usuário que solicita mais Cartões do que o Baralho possui inicia
  a Sessão mesmo assim e sabe, antes do primeiro Item, quantos estudará.
- **SC-013**: O elemento focado é identificável sem depender de percepção de cor.
- **SC-015**: O usuário sabe a qualquer momento quantos Itens já respondeu e
  quantos faltam, sem precisar contar.

## Invariantes de Domínio

1. Uma Sessão só pode ser iniciada a partir de um Baralho elegível.
2. A quantidade de Itens é `min(quantidade solicitada, Cartões vinculados)` e
   nunca menor que 1.
3. Nenhum Cartão origina mais de um Item na mesma Sessão.
4. A ordem dos Itens é definida no início e não muda durante a Sessão.
5. O Verso só é exibido após Revelação por ação explícita.
6. Um Resultado só pode ser registrado após a Revelação daquele Item.
7. Um Item admite no máximo um Resultado, imutável após registrado.
8. O Resumo só existe quando todos os Itens têm Resultado, e nele
   `acertos + erros = itens estudados`.
9. Uma Sessão nunca é persistida; qualquer interrupção a descarta sem registro.

## Funcionalidades Adiadas

- **Repetição espaçada** e qualquer agendamento de revisão. A randomização desta
  feature **não é** repetição espaçada: a primeira é ordem uniformemente
  aleatória sem memória, a segunda exige histórico de desempenho, que não é
  acumulado.
- Histórico, estatísticas ou métricas acumuladas de Sessões.
- Retomada de Sessão interrompida.
- Correção automática de respostas ou comparação de texto digitado.
- Estudar mais de um Baralho na mesma Sessão.

## Assumptions

- As premissas das features anteriores valem integralmente.
- Uma Sessão por vez, não retomável. Sair da Sessão a encerra.
- A randomização é uniforme e sem memória.
- Acessibilidade é assegurada pela navegação por teclado, foco visível e
  semântica; auditoria formal de conformidade está fora de escopo.
- Decisões técnicas pertencem ao `plan` desta feature.
