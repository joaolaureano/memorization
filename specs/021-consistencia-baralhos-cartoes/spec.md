# Feature Specification: Consistência entre Baralhos e Cartões

> Atualização de 2026-10-05: [024 — Revisar Baralhos](../024-revisar-baralhos/spec.md) supersede o rótulo Estudar de FR-340 e FR-343: a ação passa a Revisar, precedida pela etiqueta de situação (Pendente, Revisado ou Sem cartões), e Baralho vazio mantém a ação desabilitada com motivo acessível. O restante desta especificação permanece vigente.

**Created**: 2026-10-04
**Status**: Especificada conforme plano aprovado; implementação fora desta entrega.
**Input**: Padronizar as páginas Baralhos e Cartões. Em Baralhos, manter Estudar, adicionar Editar como equivalente ao antigo clique no nome e tornar o nome somente leitura. Em Cartões, apresentar apenas o título e as ações Excluir e Editar. Criar somente a especificação.
**Depende de**: `001-criar-cartao`, `002-criar-baralho`, `004-sessao-de-estudo`, `005-editar-cartao-e-baralho`, `006-excluir-cartao-e-baralho` e `012-interface-visual-navegavel`.

## Objetivo e escopo

Padronizar a apresentação das listas de Baralhos e Cartões para que a pessoa reconheça a organização e as ações disponíveis ao alternar entre as páginas.

Esta entrega contém apenas a especificação. Não inclui implementação, alterações de testes executáveis ou publicação. A mudança descrita se restringe às duas listagens; os fluxos existentes de detalhe, criação, edição, exclusão e estudo são preservados.

## User Scenarios & Testing

### User Story 1 — Consultar e acessar Baralhos (Priority: P1)

Como Usuário, quero consultar meus Baralhos e escolher explicitamente entre estudar e editar.

**Why this priority**: torna as ações visíveis sem depender de descobrir que o nome é clicável.

**Independent Test**: consultar um Baralho com Cartões e outro vazio; verificar nome somente leitura, acesso ao detalhe por Editar e comportamento de Estudar.

**Acceptance Scenarios**:

1. **Given** um Baralho com Cartões, **When** a lista é consultada, **Then** o item apresenta nome, contagem, Estudar e Editar, nessa ordem de ações.
2. **Given** um nome na lista, **When** a pessoa clica nele, **Then** nenhuma navegação ou ação ocorre.
3. **Given** um Baralho na lista, **When** Editar é acionado, **Then** abre o detalhe correspondente, o mesmo destino anteriormente acessado pelo nome, sem abrir diretamente o formulário de renomeação.
4. **Given** um Baralho vazio, **When** seu item é apresentado, **Then** Editar permanece disponível e Estudar fica desabilitado, com motivo acessível.
5. **Given** navegação por teclado, **When** a pessoa percorre a lista, **Then** alcança as ações na ordem visual, sem parada de foco no nome ou em Estudar desabilitado.

### User Story 2 — Consultar e gerenciar Cartões (Priority: P1)

Como Usuário, quero identificar cada Cartão pelo título e acessar suas ações sem conteúdo adicional na listagem.

**Why this priority**: simplifica a leitura e aproxima a apresentação da lista de Baralhos.

**Independent Test**: consultar Cartões com e sem vínculos, editar um deles e exercitar cancelamento, sucesso e falha de exclusão.

**Acceptance Scenarios**:

1. **Given** Cartões com e sem vínculos, **When** a lista é consultada, **Then** cada item apresenta somente a Frente como título e as ações Excluir e Editar, nessa ordem; não apresenta Verso, rótulos de lados ou informações de vínculos.
2. **Given** um Cartão na lista, **When** Editar é acionado, **Then** abre o formulário existente, permitindo consultar e alterar Frente e Verso.
3. **Given** a confirmação de exclusão aberta, **When** a pessoa cancela, **Then** o Cartão permanece e o foco retorna ao acionador.
4. **Given** uma exclusão confirmada, **When** a operação conclui com sucesso, **Then** o item é removido e o resultado é comunicado conforme o fluxo existente.
5. **Given** uma exclusão que falha, **When** a resposta é apresentada, **Then** o item permanece e a mensagem correspondente é exibida, sem indicação de sucesso.

### User Story 3 — Alternar entre páginas com uma apresentação consistente (Priority: P1)

Como Usuário, quero reconhecer o mesmo padrão de lista e ações ao alternar entre Baralhos e Cartões.

**Why this priority**: reduz a necessidade de aprender organizações visuais diferentes ao longo do sistema.

**Independent Test**: comparar as duas páginas em 360, 390, 768 e 1440 px, com zoom de 200% e navegação por teclado.

**Acceptance Scenarios**:

1. **Given** as duas listas preenchidas, **When** a pessoa alterna entre elas, **Then** reconhece o mesmo padrão de tipografia, espaçamento, divisórias, alinhamento e botões, com texto à esquerda e ações à direita.
2. **Given** nomes e títulos longos, **When** as páginas são usadas nas dimensões previstas e com zoom de 200%, **Then** textos completos e ações permanecem acessíveis, sem truncamento, sobreposição ou rolagem horizontal da página.
3. **Given** itens com nomes ou títulos iguais, **When** a pessoa aciona uma ação em determinado item, **Then** a operação atua sobre o registro correspondente.

### Edge Cases

- Baralho sem Cartões mantém a contagem zero e o acesso por Editar; Estudar desabilitado comunica o motivo sem depender apenas da cor.
- Títulos longos ou com palavras sem espaços quebram linha e não ocultam ações.
- Cartões vinculados a vários Baralhos omitem vínculos somente na listagem; a confirmação de exclusão mantém as consequências reais.
- Carregamento, acervo vazio e falha permanecem distintos; falha de leitura oferece nova tentativa.
- Nomes e títulos duplicados não são usados para determinar a identidade do registro nas operações.

## Requirements

### Functional Requirements

- **FR-339 — Apresentação comum**: ambas as páginas MUST usar listas compactas, com os mesmos padrões de tipografia, espaçamento, divisórias e botões. O texto aparece à esquerda e as ações à direita.
- **FR-340 — Baralhos**: cada item MUST apresentar o nome, a quantidade de Cartões e os botões Estudar e Editar, nessa ordem de ações.
- **FR-341 — Nome somente leitura**: o nome do Baralho MUST NOT ser link, receber foco de interação ou executar ações ao ser clicado.
- **FR-342 — Editar Baralho**: o botão MUST abrir o detalhe do Baralho, exatamente como o clique no nome fazia anteriormente. MUST NOT abrir diretamente o formulário de renomeação.
- **FR-343 — Estudar**: a ação MUST preservar o fluxo existente. Para Baralhos vazios, MUST permanecer desabilitada, com motivo acessível.
- **FR-344 — Cartões**: cada item MUST apresentar somente o título e os botões Excluir e Editar, nessa ordem. O título corresponde à Frente do Cartão e é somente leitura. A listagem MUST NOT apresentar Verso, rótulos “Frente” e “Verso” ou informações de vínculos com Baralhos.
- **FR-345 — Ações do Cartão**: Editar MUST abrir a edição existente. Excluir MUST manter a confirmação, a descrição das consequências e o tratamento de sucesso ou falha existentes, incluindo anúncio do resultado e restauração de foco pertinente.
- **FR-346 — Acessibilidade e responsividade**: ações MUST ter nomes acessíveis que identifiquem o item, foco visível e alvos mínimos de 44 × 44 px. Textos longos MUST quebrar linha sem truncamento, sobreposição ou rolagem horizontal. A ordem de tabulação MUST acompanhar a ordem visual. Esses requisitos se aplicam em 360, 390, 768 e 1440 px e com zoom de 200%.
- **FR-347 — Estados das páginas**: criação, carregamento, lista vazia, falha e nova tentativa MUST ser preservados. Cabeçalhos e acessos à criação MUST seguir o mesmo padrão visual.

### Key Entities

Baralho, Cartão e Vínculo mantêm os significados e regras existentes. “Título do Cartão” é a apresentação da Frente já armazenada; não introduz atributo ou entidade. Não há alteração de APIs, contratos, armazenamento ou regras de estudo.

## Success Criteria

- **SC-134**: todos os cenários de aceite desta especificação são atendidos.
- **SC-135**: nenhum nome de Baralho na listagem funciona como link; todos os itens oferecem Editar.
- **SC-136**: nenhum item da listagem de Cartões exibe Verso ou vínculos.
- **SC-137**: ambas as páginas permitem uso completo por teclado e nas dimensões previstas, sem rolagem horizontal.

## Assumptions

- “Título do Cartão” utiliza integralmente a Frente existente, sem criar novo campo.
- A contagem de Cartões permanece nos itens da lista de Baralhos.
- A ordem das ações é Estudar → Editar em Baralhos e Excluir → Editar em Cartões, mantendo Editar na mesma posição relativa.
- O estilo visual e o idioma pt-BR vigentes são preservados.
- A simplificação se aplica às listagens principais, sem modificar a apresentação dos Cartões no detalhe de um Baralho ou durante o estudo.
- Não há migrações ou alterações de APIs, entidades, armazenamento, autenticação ou regras de estudo.

## Revisão append-only de requisitos anteriores

Esta especificação substitui, no escopo das listagens principais, as exigências anteriores de nome clicável do Baralho e de conteúdo expandido do Cartão. Em particular, revisa os trechos de FR-144 e dos cenários da spec 012 sobre o nome como link do detalhe, e as exigências de apresentação de Verso e vínculos na lista de Cartões, incluindo as referências anteriores a FR-003, FR-004 e FR-146. As regras de conteúdo e vínculos permanecem vigentes fora dessa apresentação. As especificações históricas permanecem preservadas; as demais garantias continuam aplicáveis.
