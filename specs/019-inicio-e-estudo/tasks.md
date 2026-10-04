# Tasks: Início e área Estudo

**Status**: Implementação autorizada pelo Product Owner em 2026-10-04 («Implemente o spec novo. Use subagentes deepseek»), no checkout `main`.

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/ui.md, quickstart.md e prototipos.md.
**Tests**: obrigatórios pela constituição (Princípio VI); cada tarefa de código inclui teste observável.
**Authorship**: todo código sob `frontend/` e `e2e/` é escrito por workers DeepSeek (Princípio XI); o Arquiteto revisa o diff e executa as verificações.
**Organization**: fases por história, com requisitos e cenários do quickstart (V01–V12) rastreados.

## Phase 1: Setup

- [X] T1901 Conferir o portão de análise e a matriz V01–V12 em specs/019-inicio-e-estudo/quickstart.md. Sem código. Requisitos: FR-307–FR-326.

## Phase 2: Foundational

- [X] T1902 Adicionar a rota `central-de-estudo` (`#/estudo`) em frontend/src/ui/navegacao.ts e testes em frontend/tests/navegacao.test.tsx. Requisitos: FR-307, FR-323. Cenário: V01.
  - `interpretarCaminho`: um segmento `estudo` → `{ nome: "central-de-estudo" }`. A variante `estudo` (Sessão livre, `#/baralhos/<id>/estudo`) e `estudo-da-agenda` (`#/agenda/estudo`) continuam iguais; `hashDaRota({nome:"central-de-estudo"})` = `#/estudo`, ida e volta testada.
  - `destinoAtivo` passa a devolver `"inicio" | "estudo" | "baralhos" | "cartoes" | "preferencias" | null`: `inicio` e `revisao` → `inicio`; `central-de-estudo`, `agenda`, `nova-rotina`, `editar-rotina`, `estudo-da-agenda` e `registro` → `estudo`. Atualizar o comentário do mapa.
  - Hash desconhecido continua resolvendo em Início; sem Credencial, `#/estudo` resolve em Entrar e o hash é preservado.
- [X] T1903 Extrair o painel estatístico de frontend/src/ui/PaginaDeInicio.tsx para o Module de apresentação frontend/src/ui/EstatisticasDoEstudo.tsx, com testes em frontend/tests/estatisticas-do-estudo.test.tsx. Requisitos: FR-308, FR-314, FR-315, FR-320, FR-321. Cenários: V05, V07, V08, V09.
  - Hook `useEstatisticasDoEstudo(cliente)`: lê `obterEstatisticas(inicioDaJanela(agora).toISOString())` com **um único `agora`** guardado junto da resposta; mantém `{ dados: {estatisticas, agora} | null, carregando, falha }` (dados anteriores sobrevivem a atualização/falha); descarta resposta obsoleta por número de leitura e após desmontagem; exceção do transporte vira falha, nunca zero. Revalida ao montar, em `visibilitychange` para `visible` e ao atravessar a meia-noite local (temporizador rearmado). Expõe `tentarNovamente`.
  - Componentes puros sobre dados carregados (Interface: `estatisticas` + `agora`): `ResumoDeSeteDias` (linha de texto «Últimos 7 dias: N Itens estudados · T% de acerto»; sem Itens: «Nenhum Item estudado nos últimos 7 dias», sem taxa 0%); `PainelDaSemana` (Itens estudados, Sessões concluídas, Taxa de acerto — «—» + explicação textual sem Itens — e o gráfico `grafico-semanal` atual com lista textual oculta); `UltimasSessoes` (até 5 de `recentes`, sem filtrar pela janela, do mais recente ao mais antigo, cada linha com nome do Baralho ou «Revisão do dia» conforme o campo existente do Registro, data/hora local, taxa própria e link `#/sessoes/<id>` codificado). Reutilizar `inicioDaJanela`, `itensPorDia`, `taxaDeAcerto`; não criar aritmética nova.
  - Teste: 120 Itens/101 acertos → 84%; oito Registros na janela → 8 Sessões e sete colunas somando 120; recentes anteriores à janela continuam listados; resposta antiga resolvida depois da nova não prevalece.
- [X] T1904 Acrescentar à Interface de frontend/src/ui/AgendaDeEstudo.tsx a prop `modo: "hoje" | "semana"` (obrigatória), mantendo `cliente` e `aoIniciarEstudo`; leitura, proteção contra respostas antigas e regras de ação compartilhadas. Remover o botão «Atualizar agenda» e os links de cabeçalho «Agendar estudo»/«Gerenciar agenda» do bloco. Testes em frontend/tests/agenda.test.tsx. Requisitos: FR-311, FR-313, FR-318, FR-319, FR-320, FR-322. Cenários: V03, V04, V07, V08.
  - Estado de seleção: `acompanhaHoje` (true na montagem e após «Hoje»; false após escolher dia ou mudar semana). Revalidação por `visibilitychange` relê a semana/dia **selecionados** (não volta a Hoje). Temporizador da meia-noite: se `acompanhaHoje`, relê `null` (nova semana/dia de hoje); senão, relê a semana selecionada preservando a seleção; o temporizador é rearmado.
  - `modo="hoje"` (Início): `section` com título «Agenda de hoje», data por extenso, `textoDaContagem` do dia inteiro (sem cancelados; indisponíveis contam), «Agenda de hoje concluída» quando todos concluídos com total > 0, até **três** Compromissos não cancelados de hoje na ordem recebida (não reordenar), cada um com `AcaoDoCompromisso` (Estudar / Ver Sessão / Ajustar rotina; indisponível mostra o motivo). Sem Compromissos hoje: «Nenhum estudo agendado para hoje»; se a semana carregada não tiver nenhum Compromisso, acrescentar o link «Agendar estudo» (`#/agenda/nova`). Rodapé com **um** link para `#/estudo`: «Ver agenda semanal» com até três não cancelados, «Ver todos em Estudo» com mais. Sem calendário, sem «Continuar estudos», sem fuso redundante além de uma linha de texto.
  - `modo="semana"` (Estudo): título «Agenda semanal», intervalo, Semana anterior / Hoje / Semana seguinte, sete dias (`aria-pressed`, nome acessível completo), detalhe do dia selecionado (inclui cancelados identificados) e fuso em texto. Sem o resumo de hoje. Semana anterior/seguinte mantém o dia da semana. Somente pendente elegível de hoje oferece Estudar.
  - Falha: sem dados → `EstadoDaCarga` com Tentar novamente; com dados → aviso de possível desatualização + Tentar novamente; «Atualizando…» em `role="status"`. Nunca zero ou conclusão inferidos.
  - Atualizar os usos e testes existentes que procuram «Atualizar agenda», «Gerenciar agenda» e «Continuar estudos».

## Phase 3: User Story 1 — Entender o cenário e começar o dia (P1)

**Independent Test**: Início com revisão disponível, quatro Compromissos e Registros dos últimos sete dias; conferir conteúdo e ações.

- [X] T1905 [US1] Reescrever frontend/src/ui/PaginaDeInicio.tsx e frontend/tests/pagina-de-inicio.test.tsx. Requisitos: FR-308, FR-309, FR-310, FR-311, FR-321, FR-322; SC-125, SC-126. Cenários: V02, V03, V09, V10.
  - Ordem: cabeçalho (`h1` «Olá, Nome», data local por extenso, `ResumoDeSeteDias` ou seu estado de carga/falha com Tentar novamente no mesmo espaço) → contêiner `inicio__blocos` com `BlocoDaRevisaoDoDia` **primeiro** e `<AgendaDeEstudo modo="hoje">` depois. Nada mais: sem contagens de Cartões/Baralhos, gráfico, calendário ou últimas Sessões.
  - Revisão do dia: preservar textos/regras atuais (Revisar desabilitado com explicação quando total 0; disponível só com novos); revalidar ao voltar à aba e na meia-noite, com descarte de resposta obsoleta.
  - Acervo vazio (`estatisticas.cartoes === 0` em leitura bem-sucedida): orientação «Criar o primeiro Cartão» (`#/cartoes/novo`) junto do resumo; falha estatística não infere acervo vazio.
  - Testes: ausência de «Cartões»/«Baralhos» como indicadores, de `grafico-semanal`, de «Sua semana» e de «Últimas Sessões»; 120/101 → 84%; ordem DOM revisão antes da Agenda; quatro Compromissos → três visíveis, «0 de 4» e «Ver todos em Estudo»; falha de Agenda mantém revisão e resumo.
- [X] T1906 [US1] Acrescentar Estudo à navegação em frontend/src/ui/Moldura.tsx (ordem Início, Estudo, Baralhos, Cartões, Preferências; `aria-current` por `destinoAtivo`) e a tela em frontend/src/ui/Aplicacao.tsx (`case "central-de-estudo"`, repassando `cliente` e `aoIniciarEstudoDaAgenda`). Testes em frontend/tests/navegacao.test.tsx. Requisitos: FR-307, FR-323; SC-126. Cenário: V01.

## Phase 4: User Story 2 — Planejar a semana e consultar resultados (P1)

**Independent Test**: abrir `#/estudo` diretamente, percorrer semanas e dias e abrir uma Sessão recente.

- [X] T1907 [US2] Criar frontend/src/ui/PaginaDaCentralDeEstudo.tsx e frontend/tests/pagina-da-central-de-estudo.test.tsx. Requisitos: FR-312, FR-313, FR-314, FR-315, FR-319, FR-320; SC-127. Cenários: V04, V05, V08.
  - Ordem: cabeçalho (`sobretitulo` opcional, `h1` «Estudo», texto breve, links «Agendar estudo» `#/agenda/nova` e «Gerenciar rotinas» `#/agenda`) → `<AgendaDeEstudo modo="semana">` → seção «Seu estudo nos últimos 7 dias» com `PainelDaSemana` → seção «Últimas sessões» com `UltimasSessoes` como **última** seção. Sem lista de manutenção de Rotinas, sem «Ver todas».
  - Estatísticas e recentes vêm da mesma leitura (`useEstatisticasDoEstudo`), com estados de carga/falha por bloco; a falha estatística não esconde a Agenda e vice-versa.
  - Testes: ordem das seções; recentes anteriores à janela listados; «—» sem Itens; seleção de outro dia + Hoje; mudança de semana mantém o dia da semana; visibilidade preserva seleção explícita.
- [X] T1908 [US2] Mudar o retorno do Registro para Estudo em frontend/src/ui/PaginaDoRegistro.tsx («← Voltar para Estudo» → `#/estudo`, também no estado de Registro inexistente) e frontend/tests/pagina-do-registro.test.tsx. Requisitos: FR-315, FR-323. Cenário: V06.

## Phase 5: User Story 3 — Organizar Rotinas em telas próprias (P2)

**Independent Test**: de Estudo, abrir Rotinas, criar/editar e conferir retorno e mensagem.

- [X] T1909 [US3] Ajustar frontend/src/ui/PaginaDaAgenda.tsx e frontend/tests/agenda.test.tsx. Requisitos: FR-316, FR-318, FR-323. Cenário: V06.
  - `h1` «Rotinas de estudo» (sobretítulo «Estudo»); retorno «← Voltar para Estudo» → `#/estudo`; manter «Agendar estudo»; remover «Atualizar agenda»; revalidar a lista ao voltar à aba (`visibilitychange`) sem tocar confirmações abertas nem operações em curso; Tentar novamente nas falhas. Confirmações, foco de retorno e efeitos da 016 inalterados.
- [X] T1910 [US3] Ajustar frontend/src/ui/PaginaDoFormularioDeRotina.tsx e testes existentes do formulário. Requisitos: FR-317, FR-323. Cenário: V06.
  - Retorno e Cancelar levam sempre a `#/agenda`, rótulo «Voltar para Rotinas de estudo», tanto em cadastro quanto em edição; Salvar com sucesso continua em `#/agenda` com aviso. Proteção de saída, rascunho em falha, conflito e sobreposição inalterados. «Ajustar rotina» continua abrindo `#/agenda/<id>/editar`.

## Phase 6: User Story 4 — Informações atuais e recuperação clara (P2)

**Independent Test**: simular entrada, retorno à aba, mutação confirmada, virada do dia e falha isolada de cada bloco.

- [X] T1911 [US4] Testes de atualização e independência em frontend/tests/agenda.test.tsx, frontend/tests/pagina-de-inicio.test.tsx e frontend/tests/pagina-da-central-de-estudo.test.tsx. Requisitos: FR-318, FR-319, FR-320, FR-322, FR-326; SC-128. Cenários: V07, V08, V10, V12.
  - Sem «Atualizar agenda» em Início, Estudo e Rotinas; `visibilitychange` relê; meia-noite (fake timers) avança quem acompanha Hoje e preserva seleção explícita; respostas em ordem inversa; falha isolada de Agenda/revisão/Estatísticas; desmontagem antes da resposta não atualiza estado. Atualização automática não chama `renovarAcesso` (nenhum evento de teclado/clique sintético).

## Phase 7: Polish & Cross-Cutting

- [X] T1912 Layout e acessibilidade em frontend/src/estilos.css. Requisitos: FR-324, FR-325; SC-130. Cenário: V11.
  - `.inicio__blocos`: coluna única; `@media (min-width: 1024px)` duas colunas iguais. Barra inferior ≤600 px com cinco áreas de mesma largura (`flex: 1 1 0`, rótulo pode quebrar, alvo ≥44 px) e reserva de altura + `safe-area-inset-bottom` no conteúdo. Lista compacta da Agenda de hoje; calendário com sete alvos de 44 px em 360 px. Remover do índice do cabeçalho classes que deixarem de existir; manter tokens.
- [X] T1913 Atualizar E2E em e2e/navegacao.spec.ts, e2e/estatisticas-e-historico.spec.ts, e2e/agendamento-de-estudo.spec.ts e e2e/visual-e-contraste.spec.ts para a nova distribuição (gráfico e recentes em Estudo, semana em Estudo, Rotinas com novos títulos/retornos, cinco destinos). Requisitos: FR-307–FR-326. Cenários: V01–V11. Não apagar invariantes; apenas mudar a tela onde são verificadas.
- [X] T1914 Atualizar CONTEXT.md (Estatísticas sem restrição de tela) e research.md com a execução. Documentação do Arquiteto.
- [X] T1915 Verificação: em frontend/ `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`; E2E direcionados; `npm run verificar:ci` antes de qualquer push.

## Dependencies & Execution Order

- T1902 → T1906; T1903 → T1905, T1907; T1904 → T1905, T1907, T1909 (testes de agenda compartilhados).
- US1 (T1905–T1906) e US2 (T1907–T1908) dependem só da fundação; US3 (T1909–T1910) independe de US1/US2; US4 (T1911) depois de US1–US3.
- T1912–T1913 depois das histórias; T1915 por último.

## Parallel Opportunities

- [P] T1902, T1903 (arquivos distintos). T1904 em seguida (mexe em testes de agenda).
- [P] T1908, T1910 (arquivos distintos) junto de T1905/T1907.

## Implementation Strategy

MVP = Fundação + US1 + US2 (Início compacto e Estudo navegável). US3 ajusta títulos/retornos; US4 consolida testes de atualização; Polish fecha layout, E2E e verificação.

## Execução — 2026-10-04

Gerado por `speckit-tasks` e executado em sequência no mesmo pedido do Product
Owner. A análise de consistência foi feita pelo Arquiteto antes do código:
FR-307–FR-326 têm tarefa (T1902–T1913) e cenário V01–V12; não houve CRITICAL.

- **Autoria**: código e testes de `frontend/` e `e2e/` gerados por workers
  `deepseek-v4-flash` pela ferramenta `delegate`; o Arquiteto aplicou os
  blocos, revisou os diffs e reenviou correções ao worker (SEARCH antigos,
  ordem Revisão→Agenda, `baralhoId` em literal, consultas por `region`,
  `h3` do resumo da revisão, token `--altura-da-barra-inferior`).
- **Desvio corrigido na revisão**: o worker de E2E trocou o retorno pós-Sessão
  da Agenda para «Voltar para Estudo»; o contrato preserva a saída para Início
  e o bloco foi revertido ao texto original.
- **Decisão**: sem campo de Rotinas na resposta da Agenda, «Agendar estudo»
  no Início aparece quando a semana carregada não tem nenhum Compromisso.
- **Verificação**: frontend `tsc --noEmit`, `eslint .`, `vite build` limpos;
  `vitest` 811/811; E2E afetados 100%; `npm run verificar:ci` concluído com
  sucesso (backend 923, 235, frontend 811 e 74 E2E). Em execuções isoladas
  sob carga, dois testes antigos com prazo de 4–5 s oscilaram uma vez cada e
  passaram nas execuções seguintes.
