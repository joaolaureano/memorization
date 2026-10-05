# Feature Specification: Revisar Baralhos

**Created**: 2026-10-05
**Status**: Implementada e verificada (ver `research.md`, seção Verificação).
**Input**: Trocar Estudar por Revisar, iniciar a revisão sem configuração de quantidade, mover Situação da revisão de Cartões para Baralhos e apresentar uma etiqueta à esquerda dos botões de cada Baralho. Escopo confirmado: aplicação, specs e protótipos; execução com subagentes baratos.
**Depende de**: specs 004, 012, 013, 015, 021, 022 e 023.

## Clarifications

- Pendente: existe Cartão novo ou com revisão vencida. Revisado: todos os Cartões estão em dia.
- Baralho pendente: Revisar abre modal pequena para escolher entre Só pendentes e Todos os cartões; a escolha inicia a Sessão.
- Baralho revisado (também chamado de pronto na conversa): Revisar inicia todos os Cartões embaralhados, sem modal ou quantidade.
- A alteração vale para aplicação, specs e protótipos.
- Baralho vazio fica neutro, com Sem cartões e Revisar indisponível; não é classificado como Revisado.

## User Scenarios & Testing

### US1 — Encontrar Baralhos por situação (P1)

Como Usuário, quero distinguir o que tem revisão pendente e filtrar minha lista de Baralhos.

**Independent Test**: preparar um Baralho com Cartão novo, outro com revisão hoje, outro com todos no futuro e um vazio. Conferir etiquetas e filtro.

1. Um Baralho com ao menos um Cartão sem Agendamento, com revisão hoje ou anterior exibe Pendente.
2. Um Baralho não vazio com todos os Cartões agendados para dias futuros exibe Revisado.
3. Um Baralho vazio exibe Sem cartões, apenas no filtro Todos, e não permite revisar.
4. Buscar pelo nome e filtrar por situação aplica ambos os critérios; Limpar filtros restaura busca vazia e Todos.
5. Cartões mantém busca pela Frente/Verso e filtro Baralho, sem Situação da revisão.

### US2 — Revisar sem configurar quantidade (P1)

Como Usuário, quero escolher o Baralho e entrar na revisão usando todos os Cartões ou somente os pendentes.

**Independent Test**: Baralho com um Cartão novo, um vencido e um em dia: Só pendentes apresenta dois; Todos os cartões apresenta três; todos são únicos e embaralhados.

1. Revisar um Baralho pendente abre modal com Só pendentes, Todos os cartões e Cancelar. Nenhuma Sessão começa antes da escolha.
2. Só pendentes inclui novos e revisões de hoje ou anteriores; Todos os cartões inclui também os em dia. A escolha inicia imediatamente, sem campo de quantidade ou segunda confirmação.
3. Revisar um Baralho revisado inicia todos diretamente, sem modal.
4. Cancelar ou Escape fecha a modal sem registrar Sessão e retorna a uma navegação previsível; foco inicial em Cancelar e foco contido na modal.
5. Interromper não altera Agendamentos. Concluir e confirmar o registro atualiza a situação derivada; revisar novamente permanece permitido.
6. Falha ao carregar dados de revisão oferece nova tentativa, sem presumir que o Baralho está Revisado.

### US3 — Manter consistência no temporário (P1)

**Independent Test**: montar seleção usando Baralhos e Cartões individuais; filtros não alteram a seleção; Revisar inicia todos juntos sem modal adicional.

1. Na montagem temporária, Situação da revisão pertence à fonte Adicionar baralhos, não à fonte Adicionar cartões.
2. As linhas de Baralhos na montagem também exibem etiqueta antes das ações. Adicionar um Baralho inclui todos os seus Cartões; o filtro não altera sua composição.
3. Revisar a seleção temporária inicia todos os selecionados embaralhados, preservando o salvamento opcional ao final.

## Functional Requirements

- **FR-378 — Ação Revisar**: substituir rótulos de ação Estudar e Estudar novamente por Revisar e Revisar novamente nos percursos atuais de Baralho e seleção temporária. Não renomear destinos Estudo/Agenda, entidades históricas ou rotas apenas por essa mudança de linguagem.
- **FR-379 — Situação por Baralho**: derivar Pendente quando existir Cartão sem Agendamento ou com data de revisão hoje/anterior no calendário local do navegador; Revisado somente quando todos estiverem no futuro e o conjunto não for vazio. Cartão compartilhado tem o mesmo Agendamento em todos os Baralhos. Dado ilegível ou ausente inesperadamente não pode produzir Revisado.
- **FR-380 — Baralho vazio**: mostrar Sem cartões como situação neutra, preservar Editar, desabilitar Revisar e comunicar o motivo. Filtros Pendente e Revisado excluem vazios.
- **FR-381 — Filtro e etiqueta**: Situação da revisão na lista de Baralhos oferece Todos, Pendente e Revisado, com Todos como padrão; combina com busca por nome. Etiqueta textual aparece imediatamente à esquerda dos botões Revisar/Editar e antes das ações na ordem de leitura. Não depender somente de cor. Em telas estreitas pode quebrar linha antes das ações, sem truncar os rótulos ou criar rolagem horizontal.
- **FR-382 — Cartões e montagem**: remover filtro de situação da página Cartões e da fonte de Cartões individuais da montagem. Preservar busca e filtro de Baralho. Na fonte Adicionar baralhos, oferecer filtro de situação e etiquetas; adicionar continua incluindo todos os Cartões da fonte. Filtrar não modifica seleção já montada.
- **FR-383 — Escolha para pendentes**: ao solicitar revisão de Baralho pendente, abrir modal pequena com duas ações Só pendentes e Todos os cartões, com suas contagens, e Cancelar. Só pendentes inclui Cartões novos ou vencidos; cada ação inicia diretamente o conjunto correspondente embaralhado e sem duplicatas. Não oferecer configuração de quantidade.
- **FR-384 — Início direto**: Baralho Revisado inicia todos imediatamente. Um novo carregamento determina a situação atual, inclusive ao entrar diretamente pela rota de revisão. O fluxo da seleção temporária inicia todos os selecionados sem a modal, pois o conteúdo já foi escolhido. Agenda preserva a seleção prevista pelo Compromisso.
- **FR-385 — Atualização e integridade**: carregar Agendamentos antes de classificar ou iniciar. Se a leitura falhar, exibir falha e nova tentativa, sem classificação falsa. A escolha da modal usa os dados carregados para aquele início; novas revisões releem os dados. Concluir mantém Registro/Agendamentos atômicos e idempotentes; interromper mantém descarte existente. Revisar novamente aplica a mesma decisão entre modal e início direto com dados atuais.
- **FR-386 — Limites**: conjuntos com mais de 1.000 Cartões não podem iniciar silenciosamente uma Sessão que exceda o limite de registro vigente. Comunicar o limite e orientar usar um Baralho menor ou seleção temporária, sem truncar. Desabilitar apenas a opção excedente na modal. Um conjunto pendente vazio não inicia Sessão vazia.
- **FR-387 — Acessibilidade**: preservar rótulos e foco, conter foco na modal, permitir Escape/Cancelar sem iniciar, anunciar seleção e falhas. Validar 360, 390, 768 e 1440 px, zoom de 200%, alvos de 44 px e contraste das etiquetas. Aplicar estados carregando, vazio, falha e nenhum resultado existentes.

## Key Entities

- **Situação da revisão do Baralho**: classificação derivada dos Agendamentos de seus Cartões, sem marcação manual ou registro diário independente.
- **Pendente**: Baralho com ao menos um Cartão novo ou com revisão para hoje ou antes.
- **Revisado**: Baralho não vazio em que todos os Cartões têm revisão futura; não significa simplesmente que o Baralho foi aberto ou concluído hoje.
- **Revisar**: ação de iniciar a Sessão de estudo, mantendo Revelação e as quatro Avaliações existentes.

## Success Criteria

- **SC-150**: nenhuma lista de Cartões ou seletor de Cartões individuais oferece Situação da revisão; listas de Baralhos oferecem filtro e etiquetas consistentes.
- **SC-151**: classificação correta para novos, ontem, hoje, amanhã, compartilhados e vazios, sem falso Revisado em falha de leitura.
- **SC-152**: Baralho pendente permite revisar o subconjunto pendente ou todos, sem quantidade; revisado inicia todos em um clique; temporário preserva todos os selecionados.
- **SC-153**: conclusão, interrupção, nova revisão e falha preservam as garantias existentes de Registro e Agendamento.
- **SC-154**: fluxos completos funcionam por teclado, com modal acessível e etiquetas legíveis nas dimensões previstas.

## Revisão de requisitos anteriores e limites

Esta spec supersede apenas os trechos conflitantes das specs 021 (FR-340/343, rótulo Estudar), 022 (FR-352/353/356, filtro de situação nos Cartões e início anterior) e 023 (FR-362/365/368, localização dos filtros e rótulo da ação). Também supersede FR-149 da 012 e relaxa SC-079 da 012 até 600 px (até 112 px por linha de Baralho e ao menos 2 linhas inteiras na primeira tela de 390 × 844), consequência do FR-381. As decisões anteriores ficam preservadas no histórico; a regra vigente é a 024.

FR-027–FR-029 da 004 deixam de reger a configuração manual do estudo livre por Baralho na interface: o conjunto deriva da escolha pendentes/todos. Não alterar quantidades das Rotinas da Agenda, semântica das quatro Avaliações, SM-2, retenção do Histórico ou nomes de rotas. Não há novo campo persistido de situação do Baralho.
