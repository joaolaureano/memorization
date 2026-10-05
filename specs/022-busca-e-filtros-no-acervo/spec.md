# Feature Specification: Busca e filtros no acervo

**Created**: 2026-10-05
**Status**: Em implementação (2026-10-05), seguindo os protótipos de `design/busca-e-filtros/`.
**Input**: Busca nas listas de Baralhos e Cartões, com filtros de Cartões por Baralho e situação da revisão. Estudar permanece livre; revisão pendente é um filtro opcional. Criar somente a documentação.
**Depende de**: `001-criar-cartao`, `002-criar-baralho`, `003-vincular-cartao-baralho`, `006-excluir-cartao-e-baralho`, `012-interface-visual-navegavel`, `015-repeticao-espacada` e `021-consistencia-baralhos-cartoes`.

## Objetivo e escopo

Permitir que o Usuário encontre Baralhos e Cartões nas listagens principais e consulte Cartões por Baralho e situação da revisão.

O estudo permanece livre: a situação da revisão não impede estudar qualquer Cartão novamente. Baralho temporário, seleção conjunta de conteúdo e alterações na configuração das Sessões ficam para uma especificação futura.

A entrega inicial continha somente spec, checklist e registro das decisões. Em 2026-10-05 o Usuário autorizou a implementação integral, seguindo os protótipos navegáveis (ver `research.md` e `prototipos.md`).

## User Scenarios & Testing

### User Story 1 — Encontrar Baralhos (Priority: P1)

Como Usuário, quero buscar um Baralho pelo nome para encontrar suas ações sem percorrer todo o acervo.

**Independent Test**: consultar uma lista com “Álgebra linear”, buscar `algebra` e verificar o resultado e suas ações.

**Acceptance Scenarios**:

1. **Given** um Baralho chamado “Álgebra linear”, **When** o Usuário busca `algebra`, **Then** o Baralho aparece, ignorando diferenças de acentuação e capitalização.
2. **Given** resultados de busca, **When** Estudar ou Editar é acionado, **Then** segue o percurso existente do Baralho correspondente.
3. **Given** uma consulta sem correspondências, **When** a lista é apresentada, **Then** informa a ausência de resultados e oferece Limpar filtros; limpar restaura a lista completa.

### User Story 2 — Encontrar Cartões combinando critérios (Priority: P1)

Como Usuário, quero buscar conteúdo e restringir os resultados por Baralho e situação da revisão.

**Independent Test**: preparar Cartões com diferentes conteúdos, vínculos e Agendamentos; combinar os três critérios e conferir os resultados.

**Acceptance Scenarios**:

1. **Given** um termo presente apenas no Verso, **When** o Usuário busca esse termo, **Then** o Cartão aparece e mantém a Frente como título, sem exibir o Verso na linha.
2. **Given** texto, um Baralho e Revisão pendente selecionados, **When** os resultados são apresentados, **Then** aparecem somente Cartões que satisfazem os três critérios.
3. **Given** um Cartão vinculado a dois Baralhos, **When** qualquer um deles é selecionado, **Then** o Cartão aparece uma única vez.
4. **Given** Cartões com e sem Vínculos, **When** Sem baralho é selecionado, **Then** aparecem exclusivamente os Cartões sem Vínculos.
5. **Given** Cartões sem Agendamento e com revisão ontem, hoje e amanhã no calendário local, **When** a situação é filtrada, **Then** são classificados, respectivamente, como Novos, Revisão pendente, Revisão pendente e Em dia.
6. **Given** filtros ativos, **When** Limpar filtros é acionado, **Then** a busca fica vazia e ambos os seletores voltam a Todos.

### User Story 3 — Consultar resultados com recuperação e acessibilidade (Priority: P1)

Como Usuário, quero distinguir resultados, ausência de correspondências e falhas, sem perder meus critérios durante as operações da página.

**Independent Test**: exercitar falha e nova tentativa, exclusão de resultado e uso por teclado nas dimensões previstas.

**Acceptance Scenarios**:

1. **Given** critérios preenchidos e falha de leitura, **When** o Usuário tenta novamente, **Then** os critérios são preservados e a falha não é apresentada como ausência de resultados.
2. **Given** resultados filtrados, **When** um Cartão é excluído com sucesso, **Then** os filtros permanecem, a contagem é atualizada e o tratamento acessível de foco é preservado.
3. **Given** foco na busca, **When** os resultados mudam, **Then** a contagem é anunciada sem deslocar o foco.
4. **Given** uso por teclado, em 360, 390, 768 e 1440 px e com zoom de 200%, **When** o Usuário busca, filtra e limpa, **Then** consegue operar todos os controles sem sobreposição impeditiva ou rolagem horizontal da página.

### Edge Cases

- Consulta vazia ou composta somente por espaços não restringe os resultados.
- Ausência de correspondências não equivale a acervo vazio nem a falha de leitura.
- Cartões novos não pertencem a Revisão pendente; datas de hoje pertencem, mesmo quando o horário agendado ainda não chegou.
- Nomes e Frentes iguais não tornam registros distintos um único resultado.
- Baralho vazio preserva a ação Estudar desabilitada e o motivo acessível existente.
- Nenhum resultado ou opção de Baralho pode revelar dados de outro Usuário.

## Requirements

### Functional Requirements

- **FR-348 — Buscar Baralhos**: a listagem de Baralhos MUST oferecer busca por trecho do nome.
- **FR-349 — Buscar Cartões**: a listagem de Cartões MUST oferecer busca por trecho da Frente ou do Verso. Correspondência em qualquer lado inclui o Cartão; a apresentação MUST continuar mostrando somente a Frente e as ações existentes.
- **FR-350 — Correspondência textual**: as buscas MUST ignorar diferenças de maiúsculas, minúsculas e acentuação, desconsiderando espaços nas extremidades da consulta. Consulta vazia MUST NOT restringir os resultados. A correspondência usa trecho contínuo, sem busca aproximada ou operadores especiais.
- **FR-351 — Filtrar por Baralho**: a listagem de Cartões MUST permitir escolher Todos, Sem baralho ou um Baralho do Usuário, um por vez. Cartões vinculados a vários Baralhos MUST aparecer uma única vez.
- **FR-352 — Filtrar por situação**: a listagem de Cartões MUST oferecer Todos, Novos, Revisão pendente e Em dia, conforme as definições abaixo. Todos MUST ser o padrão.
- **FR-353 — Combinar critérios**: busca, Baralho e situação MUST ser aplicados simultaneamente. Um Cartão aparece somente quando satisfaz todos os critérios ativos.
- **FR-354 — Atualização e limpeza**: os resultados MUST acompanhar alterações dos controles, sem botão de envio. Limpar filtros MUST apagar a busca e restaurar Todos nos seletores existentes na página.
- **FR-355 — Resultados**: a página MUST informar a quantidade de resultados e distinguir ausência de correspondências, acervo vazio, carregamento e falha de leitura. Ausência de correspondências MUST oferecer Limpar filtros.
- **FR-356 — Preservar ações**: filtrar MUST NOT alterar registros, Vínculos, ordenação relativa nem as ações existentes. Estudar um Baralho MUST manter o percurso atual e MUST NOT ser restringido pelos filtros da listagem de Cartões.
- **FR-357 — Recuperação**: falhas e novas tentativas de carregamento MUST preservar os critérios digitados. Após excluir um Cartão, os critérios MUST continuar aplicados e a contagem MUST ser atualizada.
- **FR-358 — Acessibilidade**: controles MUST ter rótulos acessíveis, operação por teclado e foco visível. A atualização da contagem MUST ser anunciada sem deslocar o foco da busca. A apresentação MUST funcionar nas dimensões e no zoom previstos pela spec 021, preservando alvos mínimos de 44 × 44 px.
- **FR-359 — Privacidade**: resultados e opções de Baralho MUST conter exclusivamente dados do Usuário autenticado.

### Key Entities

Cartão, Baralho, Vínculo e Agendamento mantêm seus significados existentes. A **situação da revisão** é uma classificação derivada do Agendamento, não um novo estado escolhido pelo Usuário:

| Situação | Definição |
|---|---|
| Novos | Cartões sem Agendamento de revisão. |
| Revisão pendente | Cartões cuja próxima revisão corresponde a hoje ou a um dia anterior. |
| Em dia | Cartões cuja próxima revisão corresponde a um dia futuro. |

“Hoje” segue o calendário e o fuso do navegador. Novos não são incluídos em Revisão pendente. As classificações não modificam o Agendamento.

## Success Criteria

- **SC-138**: todos os cenários de aceite desta especificação são atendidos, incluindo busca por conteúdo presente somente no Verso.
- **SC-139**: combinar critérios retorna exatamente os registros que satisfazem todos eles, sem duplicar Cartões e sem revelar dados de outro Usuário.
- **SC-140**: Novos, Revisão pendente e Em dia classificam corretamente os cenários de ausência de Agendamento, ontem, hoje e amanhã no calendário local.
- **SC-141**: limpar restaura a listagem completa; falha e nova tentativa preservam os critérios; excluir atualiza a contagem mantendo os filtros.
- **SC-142**: as duas páginas permitem busca e uso dos filtros disponíveis por teclado e nas dimensões previstas, com anúncio da contagem e sem deslocamento de foco ao digitar.

## Assumptions

- Um único Baralho é selecionado por vez; Todos é o padrão do seletor.
- Critérios permanecem enquanto a página estiver aberta, inclusive em recargas dos dados e exclusões. Uma nova entrada na página começa com busca vazia e Todos.
- A consulta usa trecho contínuo, sem busca aproximada ou operadores especiais.
- Não entram filtros por dificuldade, novas ordenações ou alterações nas listas internas de um Baralho e na tela de adicionar Cartões.
- O estilo visual e o idioma pt-BR vigentes são preservados.
- Contratos técnicos e formato de transporte são definidos em `plan.md` e `contracts/`.

## Relação com requisitos anteriores

Esta especificação acrescenta controles às listagens principais da spec 021. Mantém FR-339–FR-347, incluindo conteúdo compacto, ordem das ações e apresentação de vínculos e Verso fora da listagem. Buscar no Verso não exige exibi-lo nos resultados. O novo estado de ausência de correspondências complementa os estados existentes de FR-347.

As regras de Agendamento da spec 015 são reutilizadas apenas para classificar os Cartões nesta consulta. Não se reintroduz a Revisão do dia, não se altera o algoritmo e não se modifica a liberdade de escolher conteúdo ou repetir estudos. As especificações históricas permanecem preservadas.
