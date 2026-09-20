# Feature Specification: Criar Cartão

**Feature Branch**: `001-criar-cartao`
**Created**: 2026-09-20
**Status**: Draft
**Input**: Decomposição da especificação do MVP (SESSION.md, EVT-027). Glossário normativo em `CONTEXT.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar o que precisa ser memorizado (Priority: P1)

O usuário cria um Cartão avulso, com uma Frente e um Verso, sem precisar escolher
um Baralho. O Cartão aparece na lista de Cartões e continua lá depois de fechar e
reabrir a aplicação.

**Why this priority**: é a unidade de conteúdo do produto. Sem Cartão não há o
que organizar nem o que estudar.

**Independent Test**: criar dois Cartões, fechar a aplicação, reabrir e confirmar
que ambos continuam listados com Frente e Verso corretos.

**Acceptance Scenarios**:

1. **Given** o acervo vazio, **When** o usuário abre a lista de Cartões, **Then**
   o estado vazio é comunicado e a primeira ação é orientada.
2. **Given** o acervo vazio, **When** o usuário cria um Cartão com Frente
   `To walk` e Verso `Caminhar`, **Then** o Cartão passa a existir e aparece na
   lista, sem nenhum Baralho.
3. **Given** o usuário está criando um Cartão, **When** a Frente está vazia,
   **Then** a criação é recusada e a mensagem diz qual campo falta.
4. **Given** o usuário está criando um Cartão, **When** a Frente contém apenas
   espaços, **Then** ela é tratada como vazia e recusada.
5. **Given** o usuário está criando um Cartão, **When** cola na Frente um texto
   com mais de 1000 caracteres, **Then** a criação é recusada, o limite e o
   tamanho atual são informados, e o conteúdo permanece na tela para correção.
6. **Given** o usuário está digitando, **When** se aproxima do limite, **Then** o
   limite é comunicado antes da tentativa de salvar.
7. **Given** dois Cartões com a mesma Frente, **When** ambos são criados,
   **Then** ambos são aceitos: a Frente não é identificador.
8. **Given** Cartões criados, **When** o usuário fecha e reabre a aplicação,
   **Then** todos continuam existindo exatamente como estavam.
9. **Given** o armazenamento indisponível, **When** o usuário tenta criar um
   Cartão, **Then** a operação é reportada como falha, não aparece como
   concluída, e o texto digitado permanece para nova tentativa.

### Edge Cases

- **Acervo vazio**: a lista comunica o estado vazio e orienta a primeira ação.
- **Frente e Verso idênticos**: permitido; a aplicação não julga conteúdo.
- **Conteúdo só de espaços**: recusado como vazio.
- **Conteúdo excedendo o limite**: recusado com indicação do limite e do tamanho
  atual, preservando o que foi digitado.
- **Falha de persistência**: a operação nunca é exibida como concluída.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir criar um Cartão informando Frente e Verso,
  sem exigir a escolha de um Baralho.
- **FR-002**: O sistema MUST recusar a criação de um Cartão cuja Frente ou Verso
  esteja vazio, informando qual campo falta.
- **FR-003**: O sistema MUST expor uma lista de todos os Cartões existentes,
  independentemente de estarem vinculados a algum Baralho.
- **FR-004**: O sistema MUST exibir, para cada Cartão, sua Frente e seu Verso.
- **FR-009**: Um Cartão MUST NOT possuir qualquer propriedade além de Frente e
  Verso.
- **FR-040**: O sistema MUST preservar os Cartões entre execuções da aplicação.
- **FR-042**: O sistema MUST apresentar suas telas de forma utilizável em telas
  pequenas.
- **FR-043**: O sistema MUST comunicar o estado vazio da lista de Cartões,
  orientando a primeira ação.
- **FR-044**: O sistema MUST NOT apresentar como concluída qualquer operação que
  não tenha sido efetivamente persistida.
- **FR-045**: Quando uma operação falhar por indisponibilidade do armazenamento,
  o sistema MUST reportar a falha e MUST preservar o conteúdo informado,
  permitindo nova tentativa sem redigitação.
- **FR-046**: O sistema MUST apresentar toda a sua interface em português,
  empregando os termos canônicos de `CONTEXT.md` e MUST NOT empregar os sinônimos
  listados como `_Avoid_`.
- **FR-051**: O sistema MUST tratar conteúdo composto apenas de espaços como
  vazio.
- **FR-052**: O sistema MUST recusar Frente ou Verso com mais de 1000 caracteres,
  informando o limite e o tamanho atual.
- **FR-053**: O sistema MUST comunicar o limite durante a digitação, e não apenas
  ao tentar salvar.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-009 | Cartão não tem propriedade além de Frente e Verso | Teste que envia propriedade extra na criação e exige que ela seja ignorada ou recusada, e que não retorne nas leituras |
| FR-044 | Operação não persistida não aparece como concluída | Teste com armazenamento indisponível |

### Key Entities

- **Cartão**: unidade de conteúdo a memorizar, composta de Frente e Verso.
  Existe por si, independentemente de Baralhos. Nenhuma outra propriedade.
- **Frente**: o conteúdo que o usuário tenta recordar. Obrigatório, não vazio, no
  máximo 1000 caracteres.
- **Verso**: o conteúdo associado à Frente. Obrigatório, não vazio, no máximo
  1000 caracteres.

## Success Criteria *(mandatory)*

- **SC-001**: A partir de uma aplicação vazia, o usuário cria seu primeiro Cartão
  em menos de um minuto, sem consultar instruções.
- **SC-003**: Cem por cento dos Cartões criados continuam presentes e corretos
  após fechar e reabrir a aplicação.
- **SC-012**: Em cem por cento das falhas de gravação simuladas, nenhuma operação
  aparece como concluída e nenhum conteúdo informado é perdido.
- **SC-016**: Nenhum Cartão gravado excede 1000 caracteres na Frente ou no Verso,
  inclusive quando a requisição não parte da interface.
- **SC-011**: Com 50 Cartões no acervo, a lista permanece navegável e o usuário
  localiza visualmente um Cartão conhecido sem recorrer a busca ou paginação.

## Invariantes de Domínio

1. Um Cartão tem Frente e Verso não vazios, cada um com no máximo 1000
   caracteres.
2. A Frente não é identificador: dois Cartões podem ter a mesma Frente.
3. Um Cartão existe por si, sem depender de Baralho.

## Funcionalidades Adiadas

- Editar e excluir Cartão — features `005` e `006`.
- Vincular Cartão a Baralho — feature `003`.
- Imagens, áudio, Markdown ou qualquer formatação.
- Tags, busca, filtro e paginação.
- Importação e exportação.
- Qualquer propriedade de Cartão além de Frente e Verso.

## Assumptions

- Usuário único, sem autenticação. A aplicação executa localmente e não é exposta
  em rede pública; a ausência de autenticação é segura apenas sob essa condição.
- Todo o conteúdo é texto simples.
- Limite de 1000 caracteres existe para que o Cartão caiba na tela durante o
  estudo e para impedir colagem acidental de documento inteiro.
- O acervo esperado é de ordem de 50 Cartões, escala em que busca e paginação são
  desnecessárias.
- Decisões de linguagem, framework, armazenamento e protocolo pertencem ao
  `plan` desta feature.
