# Feature Specification: Início e área Estudo

**Feature Branch**: sem nova branch; documentos preparados no checkout `main`.

**Created**: 2026-10-04

**Status**: Implementada em 2026-10-04 (ver tasks.md, «Execução»).

**Input**: O Usuário solicita um Início menos carregado, com boas-vindas,
estatísticas relevantes, Revisão do dia e Agenda de hoje; uma área Estudo para
acompanhar a semana, acessar o gerenciamento de Rotinas e consultar as últimas
Sessões ao final. Esclarecimento de escopo: criar somente plano e protótipos,
utilizando obrigatoriamente GitHub Spec Kit.

Esta entrega termina no planejamento. Os requisitos abaixo especificam o
comportamento proposto para uma implementação futura, não funcionalidades já
entregues. O uso do **GitHub Spec Kit é obrigatório e irrevogável**. O
[plano](plan.md) define as etapas e os portões para qualquer continuação.

## Clarifications

### Session 2026-10-04

Respostas obtidas na conversa antes da geração dos arquivos:

- Q: Qual nível de Estatísticas no Início? → A: Resumo discreto dos últimos sete dias; gráfico e últimas Sessões em Estudo.
- Q: Ampliar os tipos de agendamento? → A: Manter as Rotinas semanais atuais, com criação, edição, pausa, retomada e exclusão.
- Q: Qual formato de protótipo? → A: Wireframes, sem exigir protótipo navegável.
- Q: Como organizar Estudo? → A: Visão geral com semana, gráfico compacto e últimas Sessões ao final; gerenciamento de Rotinas em tela própria.
- Q: Qual é a entrega desta execução? → A: Apenas protótipos e planejamento usando GitHub Spec Kit; sem implementar o aplicativo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Entender o cenário e começar o dia (Priority: P1)

Como Usuário que acabou de Entrar, quero entender meu estudo recente e iniciar
uma Revisão do dia ou um Compromisso de hoje sem atravessar um painel extenso.

**Why this priority**: é o primeiro contato após Entrar e o principal problema relatado.

**Independent Test**: inspecionar o Início com revisão disponível, três
Compromissos e Registros dos últimos sete dias, conferindo conteúdo e ações.

**Acceptance Scenarios**:

1. **Given** um Usuário entrando normalmente, **When** o acesso é confirmado, **Then** Início apresenta nome, data, resumo discreto, Revisão do dia e Agenda de hoje, sem contagens do acervo, gráfico, calendário semanal ou últimas Sessões.
2. **Given** 120 Itens estudados e 101 acertos no período, **When** o resumo aparece, **Then** informa 120 Itens e 84% de Taxa de acerto, com a janela de sete dias explícita.
3. **Given** quatro Compromissos não cancelados hoje, **When** Início abre, **Then** mostra até três na ordem definida, os totais do dia inteiro e o acesso aos demais em Estudo.
4. **Given** Agenda concluída e revisão disponível, **When** os blocos aparecem, **Then** a conclusão refere-se somente à Agenda e Revisar permanece disponível.

### User Story 2 — Planejar a semana e consultar resultados (Priority: P1)

Como Usuário, quero uma área Estudo para consultar a semana, iniciar estudos
elegíveis e acompanhar meu Histórico sem carregar o Início com esses detalhes.

**Why this priority**: fornece o destino dos recursos retirados do Início.

**Independent Test**: abrir Estudo diretamente, percorrer semanas e dias e abrir
uma das cinco Sessões recentes sem depender de iniciar uma nova Sessão.

**Acceptance Scenarios**:

1. **Given** Estudo aberto, **When** o conteúdo é carregado, **Then** a ordem é Agenda semanal, Compromissos do dia, Estatísticas dos últimos sete dias e últimas Sessões.
2. **Given** outro dia selecionado, **When** o Usuário volta para Hoje, **Then** a semana e os detalhes correspondem à data atual no fuso do navegador.
3. **Given** Registros fora da janela semanal, **When** Estudo mostra as últimas Sessões, **Then** os cinco mais recentes continuam elegíveis para a lista, mesmo anteriores à janela do gráfico.
4. **Given** um Registro acessado, inclusive de Baralho excluído, **When** o Usuário escolhe voltar, **Then** chega a Estudo; a leitura do Registro conserva as regras existentes.

### User Story 3 — Organizar Rotinas em telas próprias (Priority: P2)

Como Usuário, quero administrar minhas Rotinas sem misturar os controles de
manutenção com o resumo do dia.

**Why this priority**: melhora a descoberta de funções já existentes.

**Independent Test**: partir de Estudo, abrir Rotinas, criar ou editar uma
programação semanal e verificar o retorno e a mensagem de resultado.

**Acceptance Scenarios**:

1. **Given** Estudo, **When** o Usuário abre Gerenciar rotinas, **Then** encontra Rotinas ativas e pausadas, com dias, quantidade e ações Editar, Pausar/Retomar e Excluir.
2. **Given** cadastro ou edição, **When** salva com sucesso ou cancela, **Then** retorna a Rotinas de estudo; descartar alterações não salvas exige a proteção existente.
3. **Given** uma operação recusada, **When** a resposta chega, **Then** os valores digitados permanecem, a causa é apresentada e nenhum sucesso é anunciado.

### User Story 4 — Ter informações atuais e recuperação clara (Priority: P2)

Como Usuário, quero que a Agenda reflita mudanças confirmadas sem um botão
permanente de atualização, com mensagens claras quando a consulta falha.

**Why this priority**: retirar o botão exige preservar atualização e recuperação.

**Independent Test**: simular entrada na tela, retorno à aba, alteração
confirmada, virada do dia e falha isolada de cada bloco.

**Acceptance Scenarios**:

1. **Given** alteração de Rotina ou conclusão persistida, **When** a tela relevante volta a ser apresentada, **Then** consulta o cenário atual sem exigir Atualizar agenda.
2. **Given** falha de Agenda, **When** os demais dados carregam, **Then** revisão e Estatísticas continuam disponíveis; Agenda oferece Tentar novamente sem simular zero.
3. **Given** semana histórica selecionada em Estudo, **When** ocorre atualização automática, **Then** a seleção é preservada; se a seleção acompanhava Hoje, acompanha a nova data após a meia-noite.

### Edge Cases

- Sem Registros na janela: mostrar ausência de estudo e Taxa de acerto indefinida, nunca 0% inventado.
- Sem Cartões: orientar a criação do primeiro Cartão sem expor totais do acervo como Estatísticas de destaque.
- Sem Rotinas: oferecer Agendar estudo. Sem Compromissos hoje, mas com Rotinas: permitir consultar a semana.
- Compromisso indisponível: permanece no total, explica o impedimento e oferece ajustar sua Rotina; cancelados ficam fora dos totais e visíveis no detalhe em Estudo.
- Revisão vazia e Agenda vazia/concluída são estados independentes; nenhum deles prova que o outro esteja concluído.
- Consulta anterior retornando depois de uma nova: não pode substituir o cenário mais recente.
- Sessão interrompida, falha de registro, expiração de acesso e Baralho excluído seguem as regras vigentes; esta feature não cria conclusões locais ou recuperação de Sessão descartada.
- Nomes longos, zoom, falhas e mensagens de sucesso não podem ocultar ações ou a navegação inferior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-307**: A navegação MUST oferecer Início, Estudo, Baralhos, Cartões e Preferências nessa ordem, com Sair no cabeçalho. O login normal MUST levar a Início; destinos protegidos explicitamente solicitados mantêm o comportamento vigente.
- **FR-308**: Início MUST apresentar saudação com Nome de usuário, data local e resumo em texto dos Itens estudados e Taxa de acerto nos últimos sete dias, incluindo hoje.
- **FR-309**: Início MUST conter somente o cabeçalho/resumo, Revisão do dia e Agenda de hoje. MUST NOT apresentar totais de Cartões/Baralhos, gráfico, calendário semanal, manutenção de Rotinas ou últimas Sessões.
- **FR-310**: Revisão do dia MUST ter prioridade visual sobre Agenda, mostrar vencidos e novos disponíveis e oferecer Revisar; quando vazia, explicar e desabilitar a ação conforme a regra existente.
- **FR-311**: Agenda de hoje MUST mostrar concluídos/previstos de todo o dia e até três Compromissos não cancelados na ordem vigente. MUST oferecer Ver agenda semanal; com mais de três, o acesso MUST indicar Ver todos em Estudo. Estudar, Ver sessão e Ajustar rotina seguem a situação de cada Compromisso.
- **FR-312**: Estudo MUST apresentar, nessa ordem, cabeçalho com Agendar estudo e Gerenciar rotinas, semana e detalhes do dia, Estatísticas de sete dias e cinco últimas Sessões. MUST NOT incorporar a lista de manutenção de Rotinas nessa visão geral.
- **FR-313**: A Agenda semanal em Estudo MUST preservar seleção de dias, semana anterior/seguinte, Hoje, intervalo legível, situações e fuso disponível em texto. Semana anterior/seguinte seleciona o mesmo dia da semana; detalhes e ordem seguem a spec 016.
- **FR-314**: Estatísticas em Estudo MUST apresentar Itens estudados, Sessões concluídas, Taxa de acerto e gráfico de Itens por dia nos últimos sete dias. A Taxa MUST ser a soma de acertos dividida pela soma de Itens, arredondada; sem Itens, MUST aparecer “—” com explicação. O resumo de Início usa a mesma regra.
- **FR-315**: Últimas Sessões MUST encerrar Estudo, exibindo até cinco Registros do mais recente ao mais antigo, sem restrição à janela semanal. Cada linha MUST informar nome do Baralho ou Revisão do dia, data/hora local, Taxa de acerto e acesso ao Registro.
- **FR-316**: Rotinas de estudo MUST ser tela própria acessível de Estudo, com ações de criação, edição, pausa, retomada e exclusão e retorno para Estudo. MUST preservar confirmações, efeitos e proteção de dados da spec 016.
- **FR-317**: Criar/editar Rotina MUST preservar os campos e validações existentes, resumo antes de salvar e proteção de saída. Salvar com sucesso ou cancelar MUST retornar a Rotinas de estudo. Falha MUST preservar os valores e oferecer recuperação.
- **FR-318**: As telas de Agenda e Rotinas MUST NOT oferecer o botão permanente Atualizar agenda. MUST consultar ao entrar, voltar à aba, mudar de semana e após operações confirmadas; dados dependentes do dia MUST ser reavaliados à meia-noite. Tentar novamente MUST existir nas falhas recuperáveis.
- **FR-319**: Atualizações automáticas em Estudo MUST preservar a semana e o dia explicitamente escolhidos. Seleção acompanhando Hoje MUST avançar com a data local. Nenhuma atualização MUST sobrescrever rascunhos de formulários.
- **FR-320**: Cada bloco de Agenda, revisão e Estatísticas MUST distinguir carga, vazio, sucesso e falha. Dados anteriores podem permanecer apenas com indicação de atualização/falha. Falha ou ausência de resposta MUST NOT ser apresentada como zero ou conclusão, e respostas antigas MUST NOT substituir a leitura vigente.
- **FR-321**: Estados vazios MUST oferecer próximo passo pertinente: criar primeiro Cartão quando o acervo está vazio, Agendar estudo quando não há Rotinas e consultar Estudo quando apenas o dia está vazio. A ausência de histórico MUST NOT criar uma taxa de 0%.
- **FR-322**: Agenda e Revisão do dia MUST conservar contagens e conclusões independentes. Somente a Sessão iniciada por um Compromisso e persistida com sucesso pode concluí-lo; estudo livre e Revisão do dia não o concluem automaticamente.
- **FR-323**: Os endereços existentes MUST continuar reconhecidos. Registros, Rotinas e seus formulários MUST oferecer retorno para Estudo ou Rotinas conforme o contrato de navegação. A nova área MUST NOT colidir com as Sessões de estudo existentes.
- **FR-324**: Todas as ações MUST ser utilizáveis por teclado, com foco visível, rótulos e anúncios de estados. Situação, seleção e gráfico MUST ter equivalente textual; a informação MUST NOT depender só de cor, posição ou ícone.
- **FR-325**: As telas MUST funcionar em 360, 390, 768 e 1440 px e zoom de 200%, sem rolagem horizontal da página ou conteúdo encoberto pela navegação. Alvos MUST ter pelo menos 44 × 44 px. Os sete dias permanecem na mesma linha nas larguras nominais suportadas; em zoom, refluem quando necessário para preservar legibilidade e alvos.
- **FR-326**: A mudança MUST preservar isolamento por Usuário, validade do Acesso temporário, proteções de saída e integridade dos Registros. Atualização automática MUST NOT contar como atividade humana para prolongar acesso inativo.

### Key Entities

- **Estatísticas**: resumo derivado de Registros e acervo; esta proposta distribui sua apresentação entre Início e Estudo.
- **Agenda de estudo**: organização diária dos Compromissos, sem confundir com Agendamento do cartão.
- **Rotina de estudo**: regra semanal existente por Baralho e quantidade.
- **Compromisso de estudo**: ocorrência da Rotina em uma data, com situação e vínculo de conclusão existentes.
- **Registro de sessão**: memória persistida de uma Sessão concluída; fonte do resumo, gráfico e lista recente.

Estudo é um destino de navegação, não uma nova entidade persistida. Nenhuma
entidade, campo de domínio ou regra de recorrência é acrescentada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-125**: Início contém exatamente dois blocos de conteúdo após o cabeçalho/resumo e zero contagens totais do acervo, gráficos, calendários semanais ou listas de Histórico.
- **SC-126**: Revisar e iniciar um Compromisso elegível visível exigem uma ação a partir do Início; Estudo é acessível em uma ação pela navegação principal.
- **SC-127**: Gerenciar rotinas e Agendar estudo são acessíveis em uma ação a partir de Estudo; últimas Sessões são sua última seção.
- **SC-128**: Todos os cenários de atualização definidos em FR-318/319 exibem dados atuais sem botão permanente; falhas permanecem distinguíveis de ausência de estudo.
- **SC-129**: Todas as telas e ações propostas têm representação nos wireframes e cenário de validação, incluindo vazio, carregamento, erro e conclusão.
- **SC-130**: Os percursos definidos são verificáveis nas quatro larguras e com teclado/zoom, sem alterar as invariantes de Agenda, revisão, acesso e persistência.

Os critérios de produto serão executados após implementação futura. Nesta
entrega verifica-se sua cobertura documental, não a conformidade do app atual.

## Assumptions

- Manter idioma pt-BR, identidade visual escura e acento azul atuais.
- Manter janela fixa de sete dias, cinco Sessões recentes e Rotinas semanais; sem filtros de período, paginação, notificações, horários ou datas avulsas.
- Protótipos são wireframes documentais com dados fictícios; não executam operações nem demonstram responsividade real.
- Não modificar fontes, testes ou configuração do aplicativo nesta entrega. O ajuste do glossário de Estatísticas está descrito no plano para o incremento futuro.
- As escolhas já confirmadas são registradas em Clarifications; detalhes visuais e critérios deste documento permanecem proposta para revisão, sem atribuir aprovação inexistente ao Product Owner.

## Revisão dos requisitos anteriores

Esta proposta, quando aprovada para implementação, substitui somente os pontos
abaixo. As specs anteriores permanecem como histórico e fonte das demais regras.

| Fonte | Mudança proposta |
|---|---|
| 013 FR-168/169/172 | Acrescentar Estudo à navegação; reduzir Início; mover gráfico e recentes; preservar orientação inicial sem totais do acervo. |
| 013 FR-171/173/177–179 | Mover gráfico e recentes para Estudo, manter acessibilidade/erros e mudar retorno do Registro para Estudo. |
| 015 FR-198 e 016 definição de UI/A-06 | Colocar Revisão do dia antes de Agenda no Início; preservar a independência dos blocos. |
| 016 FR-227–230/237/240–242 | Início exibe somente hoje; semana vai para Estudo; gerenciamento recebe acesso e retorno próprios; remover Atualizar agenda. |
| 016 FR-246/249 | Substituir atualização manual permanente pelos gatilhos automáticos e Tentar novamente em falha. |
| 016 FR-253 | Preservar os sete dias em uma linha nas larguras nominais e permitir reflow sob zoom para não reduzir alvos. |
| CONTEXT.md, Estatísticas | Na implementação futura, retirar da definição a restrição de apresentação exclusivamente no Início; significado dos números não muda. |

**Nota de revisão — 2026-10-04**: escopo documental confirmado pelo Usuário.
Não há aprovação presumida de implementação, nem declaração de `analyze` ou
`converge` executados nesta entrega.
