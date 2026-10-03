# Feature Specification: Repetição espaçada

**Feature Branch**: `main` (a 015 é construída na branch main, por decisão do Product Owner)

**Created**: 2026-10-02

**Status**: Draft

**Input**: "Repetição espaçada, com o algoritmo plugável para que outros algoritmos possam ser usados depois." Decisões do Product Owner: só o SM-2 nesta entrega; Avaliação em 4 níveis; algoritmo escolhido pelo Usuário; "N Cartões para revisar hoje" em Início com limite diário de Cartões novos; estudo livre por Baralho também alimenta o Agendamento; Agendamento por Cartão e por Usuário.

**Depende de**: `001` a `013`. Usa o Registro de sessão e o Histórico de estudo da `013`, a Sessão de estudo de `004`/`012` e a persistência por Usuário de `008` a `010`.

## Objetivo e escopo

O Memorization passa a agendar quando cada Cartão deve ser revisto. O **Agendamento do Cartão** é calculado por um **Algoritmo de repetição espaçada** escolhido pelo Usuário em **Preferências**; nesta entrega há apenas o SM-2, e outros (FSRS, Leitner) entram depois sem alterar telas nem dados guardados. A **Avaliação** de um Item passa a ter quatro níveis — Errei, Difícil, Bom e Fácil — e substitui os botões Acertei/Errei em toda Sessão, sempre após a Revelação.

Início ganha a **Revisão do dia**: quantos Cartões estão vencidos, quantos Cartões novos entram hoje e o botão "Revisar", que conduz uma Sessão de estudo reunindo Cartões de vários Baralhos. O estudo livre por Baralho continua existindo e também alimenta o Agendamento. Ao concluir uma Sessão, o Registro de sessão e os Agendamentos são atualizados de forma atômica e idempotente. Cartões estudados antes da 015 começam como Cartões novos; o Histórico anterior fica intacto.

## Clarifications

### Session 2026-10-02

- Q: Quais algoritmos entram nesta entrega e como outros entram depois? → A: Só o SM-2, atrás de uma interface plugável. FSRS, Leitner e outros entram depois como novos algoritmos, sem mudar telas, Histórico nem Agendamentos existentes (FR-187–FR-191).
- Q: Qual é a escala da Avaliação e como ela se relaciona com Acertei/Errei? → A: Quatro níveis comuns a todos os algoritmos: Errei, Difícil, Bom e Fácil. Errei = errou; Difícil, Bom e Fácil = acertou no Histórico da 013 (FR-192–FR-197).
- Q: Quem escolhe o algoritmo? → A: O Usuário, em Preferências. Hoje a lista tem só o SM-2, e trocar de algoritmo não perde o Histórico (FR-212, FR-213).
- Q: Como fica o uso diário? → A: Início mostra "N Cartões para revisar hoje" (vencidos de todos os Baralhos) com o botão Revisar e um limite diário de Cartões novos. O estudo por Baralho continua como estudo livre e também alimenta o Agendamento (FR-198–FR-206).
- Q: O Agendamento pertence ao Vínculo ou ao Cartão? → A: Ao Cartão e ao Usuário, nunca ao Vínculo (FR-207).
- Q: Qual o limite padrão de Cartões novos por dia? → A: 20, ajustável em Preferências de 0 a 999 (FR-200).
- Q: Como a Revisão do dia apresenta muitos Cartões vencidos? → A: Em lotes de no máximo 20 Itens. Cada lote concluído registra e reagenda (FR-203).
- Q: O que acontece com os Cartões estudados antes da 015? → A: Todos começam como Cartões novos. Os Registros antigos, sem Avaliação, não geram Agendamento, mas continuam no Histórico e nas Estatísticas (FR-214).
- Q: Os botões de Avaliação mostram quando o Cartão voltará? → A: Sim. Cada botão mostra a próxima revisão que resultaria dele, por exemplo "Bom · 3 dias" (FR-221).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Revisar os Cartões do dia a partir de Início (Priority: P1)

Depois de Entrar, a pessoa vê em Início quantos Cartões precisa revisar hoje e inicia a Revisão do dia com um toque.

**Why this priority**: é a porta de entrada do uso diário e o motivo de a repetição espaçada existir.

**Independent Test**: com 2 Cartões vencidos ontem, 1 vencido há 3 dias e limite de novos 20, Início mostra "3 Cartões para revisar hoje"; "Revisar" abre uma Sessão de estudo com os 3, começando pelo vencido há mais tempo.

**Acceptance Scenarios**:

1. **Given** Início com Cartões vencidos, **When** a tela abre, **Then** mostra a contagem e o botão "Revisar" disponível.
2. **Given** o botão "Revisar", **When** a pessoa o aciona, **Then** a Revisão do dia reúne primeiro os vencidos (os vencidos há mais tempo primeiro) e depois os novos até o limite restante do dia.
3. **Given** Cartões de vários Baralhos e Cartões sem Vínculo, **When** a Revisão do dia reúne, **Then** ela inclui os Cartões de todos os Baralhos do Usuário e os sem Vínculo.
4. **Given** nenhum vencido e nenhum novo disponível, **When** Início abre, **Then** mostra "Nada para revisar hoje" e o botão fica indisponível com a explicação.

---

### User Story 2 - Avaliar em 4 níveis em qualquer Sessão (Priority: P1)

Após revelar o Verso, a pessoa escolhe Errei, Difícil, Bom ou Fácil, e isso define a próxima revisão do Cartão.

**Why this priority**: a Avaliação é a entrada do Algoritmo de repetição espaçada. Sem ela não há agendamento.

**Independent Test**: num Item com o Verso revelado, os quatro botões aparecem; acionar "Bom" grava a Avaliação e o Resumo mostra a contagem por nível.

**Acceptance Scenarios**:

1. **Given** um Item com o Verso exibido após a Revelação, **When** a Sessão pede o Resultado, **Then** aparecem quatro botões — Errei, Difícil, Bom e Fácil — e nenhum antes da Revelação.
2. **Given** a Avaliação declarada, **When** a Sessão segue, **Then** o próximo Item é apresentado e a Avaliação é guardada para o Agendamento.
3. **Given** a conclusão da Sessão, **When** o Resumo abre, **Then** mostra a contagem por nível de Avaliação, além do percentual (FR-152) e do total no texto.
4. **Given** uma Avaliação Errei, **When** o Histórico e as Estatísticas contam, **Then** ela conta como erro; Difícil, Bom e Fácil contam como acerto.
5. **Given** o Verso revelado, **When** os botões aparecem, **Then** cada um mostra a próxima revisão que resultaria dele (ex.: "Bom · 3 dias").

---

### User Story 3 - Estudo livre por Baralho alimenta o Agendamento (Priority: P2)

Estudar livremente um Baralho continua possível e também faz o Cartão progredir no agendamento.

**Why this priority**: preserva o estudo exploratório sem que o esforço seja perdido para a repetição espaçada.

**Independent Test**: estudar livremente um Cartão novo num Baralho e concluir; o Cartão deixa de ser novo, conta no limite de novos do dia e passa a ter próxima revisão.

**Acceptance Scenarios**:

1. **Given** estudo livre por Baralho, **When** a Sessão é concluída, **Then** cada Avaliação atualiza o Agendamento do Cartão, mesmo que ele não estivesse vencido.
2. **Given** um Cartão novo estudado no estudo livre, **When** a Sessão é concluída, **Then** ele deixa de ser novo e conta no limite de novos do dia.
3. **Given** um Cartão vinculado a vários Baralhos, **When** estudado livremente por um deles, **Then** o Agendamento do Cartão é único e atualizado uma única vez.

---

### User Story 4 - Preferências: escolher o algoritmo e o limite de novos (Priority: P2)

Em Preferências, a pessoa escolhe o Algoritmo de repetição espaçada e o limite diário de Cartões novos.

**Why this priority**: o Product Owner exige o algoritmo plugável e o limite de novos configurável.

**Independent Test**: em Preferências, escolher SM-2 (já selecionado por padrão), ajustar o limite de novos para 0 e salvar; Início passa a informar que nenhum Cartão novo entra hoje.

**Acceptance Scenarios**:

1. **Given** Preferências aberta, **When** a pessoa escolhe o Algoritmo de repetição espaçada e o limite diário de Cartões novos, **Then** pode salvar explicitamente.
2. **Given** uma alteração não salva, **When** a pessoa sai, **Then** a confirmação de descarte é pedida (FR-148).
3. **Given** falha ao salvar, **When** ocorre, **Then** é explicada e há nova tentativa (FR-155), sem perder o que estava escolhido.
4. **Given** troca de algoritmo, **When** ela é salva, **Then** o novo algoritmo reconstrói o Agendamento de cada Cartão a partir das Avaliações do Histórico, e nenhum registro do Histórico é perdido.

---

### User Story 5 - O acervo existente entra na repetição espaçada como Cartões novos (Priority: P3)

Quem já estudava antes da 015 vê o acervo inteiro como Cartões novos, introduzidos aos poucos pelo limite diário. O Histórico antigo continua intacto.

**Why this priority**: torna a entrada da 015 previsível e sem cálculo retroativo. O limite de novos evita uma avalanche no primeiro dia.

**Independent Test**: com 30 Cartões, dos quais 10 estudados antes da 015, e o limite padrão, Início mostra 0 Cartões para revisar e 20 novos hoje. O Histórico e as Estatísticas anteriores continuam iguais.

**Acceptance Scenarios**:

1. **Given** a primeira ativação da 015, **When** Início abre, **Then** todos os Cartões do Usuário são Cartões novos, inclusive os já estudados.
2. **Given** Registros de sessão anteriores à 015, **When** o Histórico, as Estatísticas e os Resumos antigos são abertos, **Then** aparecem exatamente como antes.
3. **Given** Registros sem Avaliação, **When** um algoritmo reconstrói Agendamentos (FR-213), **Then** esses Itens são ignorados no cálculo.

---

### Edge Cases

- **Cartão vencido há muitos dias:** aparece entre os vencidos e é revisto no lote, do vencido há mais tempo para o mais recente.
- **Muitos vencidos (centenas):** a Revisão do dia é apresentada em lotes, e Início volta a mostrar o N restante.
- **Cartão excluído entre a abertura de Início e o fim do lote:** o Item segue na Sessão com o conteúdo capturado (FR-150) e entra no Registro de sessão, mas nenhum Agendamento é criado ou recriado para o Cartão excluído.
- **Cartão editado durante a Revisão:** o conteúdo é capturado no início da Sessão (FR-150) e a Avaliação vale para o Cartão.
- **Dois navegadores revisando o mesmo Cartão:** a última conclusão prevalece no Agendamento e cada Avaliação é aplicada uma única vez.
- **Lote vazio ao abrir a Revisão:** se outro navegador já revisou os Cartões, a tela mostra "Nada para revisar hoje" e oferece "Voltar a Início", sem iniciar Sessão.
- **Troca de algoritmo com Sessão em andamento:** a conclusão usa o algoritmo vigente no instante da conclusão. A prévia já exibida pode diferir, e vale o cálculo da conclusão (FR-210).
- **Virada da meia-noite durante a Sessão:** o limite de novos zera; o lote em andamento segue e a próxima abertura de Início reflete o novo dia.
- **Limite de novos reduzido para abaixo do já estudado hoje:** nenhum novo é introduzido até o próximo dia.
- **Usuário sem Cartões:** Início orienta a criar o primeiro Cartão.
- **Cartão sem Vínculo:** participa da Revisão do dia normalmente.
- **Mudança de fuso:** "hoje" e "vencido" seguem o fuso do navegador.
- **Algoritmo removido ou desconhecido:** cai para o SM-2, reconstruindo o Agendamento pelo Histórico.
- **Prévia da próxima revisão:** os quatro botões mostram a próxima revisão calculada para aquele Cartão no momento da Revelação. Se o Agendamento mudar em outro navegador antes da conclusão, vale o cálculo feito na conclusão (FR-210).

## Requirements *(mandatory)*

### Functional Requirements

**Agendamento e algoritmo**

- **FR-187**: O Agendamento MUST ser calculado por um Algoritmo de repetição espaçada. Cada algoritmo recebe o estado atual do Agendamento do Cartão, a Avaliação e o instante, e devolve o novo estado, incluindo a próxima data de revisão.
- **FR-188**: O estado MUST ser próprio de cada algoritmo, identificado pelo algoritmo e pela versão dele.
- **FR-189**: O restante do produto MUST apenas ler a próxima data de revisão e o Cartão e o Usuário a que o Agendamento pertence.
- **FR-190**: A primeira entrega MUST ter apenas o SM-2, já selecionado por padrão.
- **FR-191**: Incluir um segundo algoritmo MUST NOT exigir alterar telas, Histórico nem Agendamentos de outros algoritmos; basta registrá-lo na lista.

**Avaliação**

- **FR-192**: A Avaliação MUST ter quatro níveis: Errei, Difícil, Bom e Fácil.
- **FR-193**: A Avaliação MUST ocorrer somente após a Revelação (FR-150 mantido).
- **FR-194**: A Avaliação MUST substituir os botões Acertei/Errei em toda Sessão, inclusive no estudo livre por Baralho e na Revisão do dia.
- **FR-195**: Para o Histórico e as Estatísticas da 013, Errei MUST contar como erro; Difícil, Bom e Fácil MUST contar como acerto.
- **FR-196**: O Registro de sessão MUST guardar a Avaliação de cada Item, além do que já guarda (FR-161).
- **FR-197**: Registros antigos, com apenas acertou/errou, MUST continuar válidos e exibidos como antes.

**Revisão do dia e Início**

- **FR-198**: Início MUST mostrar "N Cartões para revisar hoje", com N igual ao número de Cartões vencidos do Usuário, de todos os Baralhos (no singular, "1 Cartão para revisar hoje"), e MUST oferecer o botão "Revisar".
- **FR-199**: Início MUST informar quantos Cartões novos entram hoje, respeitado o limite diário.
- **FR-200**: O limite diário de Cartões novos MUST ser configurável em Preferências: inteiro de 0 a 999, padrão 20, com 0 significando não introduzir novos.
- **FR-201**: A Revisão do dia MUST ser uma Sessão de estudo que reúne Cartões de vários Baralhos e Cartões sem Vínculo, primeiro os vencidos (os vencidos há mais tempo primeiro), depois os novos até o limite restante do dia, na ordem em que foram criados (os mais antigos primeiro). Vencidos com a mesma próxima revisão seguem a ordem de criação do Cartão. Cada Cartão aparece no máximo uma vez por lote.
- **FR-202**: Sem vencidos e sem novos disponíveis, Início MUST mostrar "Nada para revisar hoje" e o botão MUST ficar indisponível com a explicação.
- **FR-203**: Para não perder trabalho em revisões longas, a Revisão do dia MUST ser apresentada em lotes de no máximo 20 Itens; concluir um lote registra e reagenda, e Início volta a mostrar o N restante.
- **FR-204**: "Hoje" e "vencido" MUST usar o fuso horário do navegador, como na 013; um Cartão é vencido se a próxima data de revisão é hoje ou anterior, e o limite de novos zera à meia-noite local.

**Estudo livre**

- **FR-205**: O estudo por Baralho MUST continuar como estudo livre e TAMBÉM MUST atualizar o Agendamento do Cartão a cada Avaliação, mesmo que o Cartão não estivesse vencido.
- **FR-206**: Um Cartão novo estudado no estudo livre MUST deixar de ser novo e MUST contar no limite de novos do dia.

**Agendamento e o acervo**

- **FR-207**: O Agendamento MUST ser por Cartão e por Usuário, NÃO por Vínculo. Vincular ou desvincular MUST NOT alterar o Agendamento.
- **FR-208**: Editar a Frente ou o Verso MUST NOT alterar o Agendamento.
- **FR-209**: Excluir o Cartão MUST excluir o Agendamento dele, sem alterar Registros de sessão (FR-165).

**Atomicidade e descarte**

- **FR-210**: Ao concluir a Sessão, o Registro de sessão e a atualização dos Agendamentos MUST ocorrer de forma atômica e idempotente; reenviar após falha MUST NOT aplicar a Avaliação duas vezes (coerente com FR-163).
- **FR-211**: Sessão interrompida MUST continuar sem rastro e MUST NOT alterar Agendamentos (FR-039/FR-162 mantidos).

**Preferências e reconstrução do Agendamento**

- **FR-212**: O Usuário MUST escolher o Algoritmo de repetição espaçada e o limite diário de Cartões novos numa tela Preferências, com salvar explícito, confirmação de descarte (FR-148) e falha com nova tentativa (FR-155).
- **FR-213**: Trocar de algoritmo MUST NOT perder o Histórico. O novo algoritmo MUST reconstruir o Agendamento de cada Cartão a partir das Avaliações registradas no Histórico, em ordem cronológica (replay). Itens de Registros sem Avaliação (anteriores à 015) MUST ser ignorados na reconstrução.
- **FR-214**: Na primeira ativação da 015, todos os Cartões existentes MUST ser Cartões novos, inclusive os estudados antes, e entram pelo limite diário (FR-200). Os Registros de sessão anteriores MUST permanecer intactos no Histórico e nas Estatísticas.

**Resumo, Histórico e acessibilidade**

- **FR-215**: O Resumo da Revisão do dia MUST ser o mesmo Resumo detalhado da 013, com "Revisão do dia" no lugar do nome do Baralho, tanto ao concluir quanto no Histórico e em Início. No lugar de "Estudar novamente" e "Voltar ao Baralho", o Resumo da Revisão do dia MUST oferecer "Continuar revisão" (próximo lote, quando ainda houver Cartões para hoje) e "Voltar a Início".
- **FR-216**: O Resumo MUST mostrar a contagem por nível de Avaliação.
- **FR-217**: Início MUST distinguir carregamento, falha com nova tentativa e sucesso no bloco de revisão (FR-153); uma falha nele MUST NOT impedir o restante de Início.
- **FR-218**: Os quatro botões de Avaliação MUST ser acessíveis por teclado, com nomes acessíveis, alvos de 44 px e sem depender de cor (FR-158). Atalhos opcionais 1–4 MUST funcionar apenas após a Revelação.
- **FR-221**: Cada botão de Avaliação MUST mostrar, junto do nível, a próxima revisão que resultaria dele, calculada pelo algoritmo do Usuário para aquele Cartão (por exemplo, "Bom · 3 dias", "Errei · amanhã"). A prévia MUST estar no nome acessível do botão e MUST NOT depender de cor. O rótulo é contado em dias locais do navegador: "hoje" (mesma data), "amanhã" (data seguinte) ou "N dias" (diferença de datas). Se a prévia não puder ser obtida, os botões MUST aparecer só com o nível, a falha MUST ser anunciada, e o estudo MUST continuar possível.

**Isolamento e persistência**

- **FR-219**: Agendamentos e Preferências MUST ser isolados por Usuário, com as mesmas garantias de `008` e da 013. Dados de outro Usuário se comportam como inexistentes.
- **FR-220**: Agendamentos e Preferências MUST persistir em todos os armazenamentos suportados (SQLite local e PostgreSQL), com migração que preserva os dados existentes (FR-167).

**Transversais reutilizados**: FR-148, FR-150, FR-152, FR-153–FR-159, FR-161–FR-179 da `012` e da `013` valem para todas as telas e fluxos novos.

### Key Entities

- **Agendamento do Cartão**: relação entre um Usuário e um Cartão. Guarda o algoritmo e a versão, o estado próprio do algoritmo, a próxima data de revisão, a última Avaliação e o instante da última revisão.
- **Avaliação**: declaração do Usuário em quatro níveis — Errei, Difícil, Bom, Fácil — sobre um Item, após a Revelação.
- **Algoritmo de repetição espaçada**: identidade e versão; recebe o estado atual, a Avaliação e o instante, e devolve o novo estado. Nesta entrega, apenas o SM-2.
- **Preferências do Usuário**: Algoritmo de repetição espaçada escolhido e limite diário de Cartões novos.
- **Revisão do dia**: Sessão de estudo que reúne Cartões de vários Baralhos e Cartões sem Vínculo.
- **Registro de sessão** (ampliado): ganha a origem ("Baralho" ou "Revisão do dia") e a Avaliação de cada Item.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-080**: Em 100% das aberturas de Início, "N Cartões para revisar hoje" é igual ao número de Cartões vencidos do Usuário.
- **SC-081**: Nunca entram mais Cartões novos do que o limite diário, em todos os cenários de teste (limite 0, 1 e 20).
- **SC-082**: Para uma sequência fixa de Avaliações, o SM-2 produz as datas de referência documentadas nos casos de teste tabelados do plano.
- **SC-083**: Trocar de algoritmo e voltar preserva 100% do Histórico e resulta em Agendamentos idênticos aos anteriores (reconstrução determinística pelas Avaliações registradas).
- **SC-090**: Em 100% dos casos de teste do SM-2, a prévia mostrada em cada botão coincide com a próxima revisão gravada ao concluir com aquela Avaliação, sem mudança concorrente.
- **SC-084**: Registros de sessão guardam a Avaliação de cada Item; Errei conta como erro e Difícil/Bom/Fácil contam como acerto em 100% dos casos.
- **SC-085**: Reenviar a conclusão de uma Sessão após falha nunca duplica Registros nem aplica a Avaliação duas vezes (SC-071 mantido e estendido).
- **SC-086**: Um Usuário nunca vê nem altera Agendamentos ou Preferências de outro (prova com dois Usuários em navegadores distintos).
- **SC-087**: Início abre com o bloco de revisão visível em até 1 s com 2.000 Cartões e 500 registros, no ambiente local de testes.
- **SC-088**: As telas novas atendem SC-062/063/068 da `012`: percurso por teclado, larguras de 360 a 1440 px, zoom de 200%, alvos de 44 px e contraste.
- **SC-089**: Concluir um lote de 20 Itens em revisões longas produz Registros e Agendamentos corretos, e Início reflete o N restante.

## Compatibilidade com specs anteriores

| Tema | Mudança |
| --- | --- |
| Avaliação (`004` FR-037, `012` FR-150) | Os botões Acertei/Errei passam a quatro níveis — Errei, Difícil, Bom, Fácil — sempre após a Revelação. |
| Resumo (`004`, `012` FR-152) | Ganha a contagem por nível; acertos e erros passam a ser derivados das Avaliações. |
| Registro de sessão (`013` FR-161) | Passa a guardar também a Avaliação de cada Item e a origem ("Baralho" ou "Revisão do dia"). |
| Início (`013` FR-168/FR-169) | Ganha o bloco de revisão: N Cartões para revisar hoje, Cartões novos do dia e o botão "Revisar". |
| Navegação (`012` FR-139, `013` FR-168) | Ganha Preferências. |
| Sessão de estudo (`004`, `CONTEXT.md`) | "de um único baralho" passa a admitir também a Revisão do dia. |
| `013` "Fora do escopo" | "repetição espaçada" sai do fora do escopo e entra nesta feature. |

## Fora do escopo

- FSRS, Leitner e outros algoritmos (apenas a porta e o SM-2);
- ajuste fino de parâmetros do algoritmo pelo Usuário;
- lembretes e notificações;
- metas;
- "Cartões que você mais erra";
- suspender ou enterrar Cartões;
- revisão antecipada dedicada;
- estatísticas de retenção;
- importação de Agendamentos de outros aplicativos.

## Assumptions

- Preferências fica na navegação principal, acessível de qualquer tela com Credencial válida, por ser uma configuração de uso contínuo e não específica do momento de estudo.
- A Revisão do dia é apresentada em lotes de no máximo 20 Itens para limitar a perda de trabalho em revisões longas.
- O limite diário de Cartões novos tem padrão 20, aceita inteiro de 0 a 999 e trata 0 como "não introduzir novos".
- "Hoje" e "vencido" usam o fuso horário do navegador; o limite de novos zera à meia-noite local.
- A ordem da Revisão do dia é: vencidos (os vencidos há mais tempo primeiro) e, depois, novos até o limite restante do dia.
- Cartões nunca estudados são Cartões novos.
- O estudo livre por Baralho reagenda normalmente pelo algoritmo, mesmo quando o Cartão não está vencido.
- Cartões estudados antes da 015 começam como Cartões novos (decisão do Product Owner). Itens de Registros sem Avaliação são ignorados na reconstrução por troca de algoritmo.
- Trocar de algoritmo reconstrói os Agendamentos pelo replay do Histórico, em ordem cronológica.
- A primeira entrega tem apenas o SM-2; FSRS, Leitner e outros entram depois apenas como novos algoritmos registrados na lista.
- Registros de sessão permanecem imutáveis (FR-165).
- Como as anteriores, a migração só avança. Reverter a 015 não está no escopo, e a migração só cria tabelas e acrescenta colunas, sem alterar dados existentes (FR-220).
- A Avaliação de um Item, uma vez declarada, não pode ser alterada na Sessão (FR-150, como o Resultado).
