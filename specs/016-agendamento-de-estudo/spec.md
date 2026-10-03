# Feature Specification: Agendamento de estudo

**Feature Branch**: `wip/outro-agente-cartao-fixo` (branch atual; diretório da feature independente da branch)
**Created**: 2026-10-03
**Status**: Planejamento para revisão — implementação não autorizada
**Input**: “O usuário seria capaz de agendar por exemplo toda segunda-feira usar o Baralho X. Assim, na tela inicial, ele tem um mini report, um pequeno calendário da semana, se tudo já foi feito no dia ou não.” Continuação: “Estruture tudo usando GithubSpecKit, use o framework para criar o Spec da maneira esperada, completa.”

**Depende de**: `002`/`003` (Baralhos e Vínculos), `004`/`012` (Sessão e interface), `008`–`010` (acervo por Usuário e persistência), `013` (Registro de sessão e Início) e `015` (Avaliação e repetição espaçada).

A feature permite programar estudos semanais por Baralho e acompanhar sua
conclusão em Início. Usa o vocabulário de `CONTEXT.md`: **Agenda de estudo**,
**Rotina de estudo** e **Compromisso de estudo**. O **Agendamento do cartão**
continua sendo a próxima revisão calculada pela repetição espaçada.

Referência visual: [protótipo](../../design/agendamento/index.html).
O protótipo ilustra a composição; os requisitos deste documento prevalecem
sobre seus dados de exemplo, limitações e interações simuladas.

## Clarifications

### Session 2026-10-03

- **Limite explícito do escopo**: o Product Owner esclareceu: “aqui é só criar o plano. NÃO deve ser implementado nada”. A entrega se limita aos artefatos de planejamento; tarefas e verificações de código descrevem trabalho futuro e não autorizam sua execução.

- **Confirmado pelo pedido**: recorrência semanal por Baralho, calendário compacto da semana em Início, acompanhamento de conclusão diária e especificação pelo GitHub Spec Kit, com `001` como referência de estrutura.
- **Delimitação**: esta entrega é a especificação da feature 016. O tamanho fixo do cartão de Sessão permanece requisito transversal de `012`, FR-150; não constitui uma segunda feature neste documento.
- **Decisões propostas**: o “OK” autoriza estruturar a proposta. Não é registrado como resposta individual às questões de conclusão, datas, duplicidade e alterações. Os padrões adotados para tornar a spec verificável estão identificados em Assumptions como **premissa a validar**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Programar um Baralho para os dias da semana (Priority: P1)

O Usuário escolhe um Baralho, os dias em que quer estudá-lo e quantos Cartões
pretende estudar. Ao salvar, vê a Rotina e seus próximos Compromissos.

**Why this priority**: estabelece a programação que o calendário acompanha.

**Independent Test**: com um Baralho elegível, criar uma Rotina para segunda e
quinta, com 20 Cartões; reabrir a aplicação e encontrar a Rotina e seus
Compromissos nos dias correspondentes, sem outros dias adicionados.

**Acceptance Scenarios**:

1. **Given** um Baralho elegível, **When** o Usuário escolhe segunda e quinta e salva 20 Cartões, **Then** vê o resumo “Inglês · segunda e quinta · 20 Cartões” e a programação semanal persiste (FR-222–FR-226, FR-250).
2. **Given** o formulário, **When** não há Baralho, não há dia selecionado ou a quantidade definida não é inteiro de 1 a 999, **Then** o salvamento é recusado, o campo é identificado e os demais valores são preservados (FR-224, FR-251).
3. **Given** uma Rotina criada numa segunda, **When** segunda está selecionada, **Then** há um Compromisso para hoje e para as próximas segundas; nenhuma segunda anterior passa a contar como não realizada (FR-225).
4. **Given** uma Rotina ativa para segunda, **When** outra Rotina do mesmo Baralho também inclui segunda, **Then** a duplicidade é explicada antes de confirmar e ambas só existem se o Usuário confirmar que deseja dois estudos independentes (FR-226).
5. **Given** falha ao salvar, **When** o Usuário tenta novamente, **Then** o formulário permanece preenchido, não há sucesso antecipado e a mesma tentativa não cria duas Rotinas (FR-249, FR-251).
6. **Given** nenhum Baralho elegível, **When** abre Agendar estudo, **Then** vê a orientação para criar um Baralho ou vincular Cartões, sem permitir uma Rotina inválida (FR-223, FR-241).

### User Story 2 - Saber o que falta estudar hoje (Priority: P1)

Em Início, o Usuário vê a contagem de estudos concluídos e previstos para hoje,
a semana e a lista do dia selecionado. A Revisão do dia mantém sua contagem própria.

**Why this priority**: responde ao objetivo principal de saber se o estudo
programado do dia já foi feito.

**Independent Test**: preparar uma semana com dias sem estudos, dias concluídos,
um dia passado incompleto, hoje com 1 de 2 concluídos e um dia futuro; conferir
contagens, textos e ações selecionando cada dia.

**Acceptance Scenarios**:

1. **Given** hoje com dois Compromissos, um concluído, **When** Início abre, **Then** mostra “1 de 2 estudos concluídos”, hoje selecionado e uma ação para o próximo pendente elegível (FR-227–FR-230).
2. **Given** os dois concluídos, **When** Início é atualizado, **Then** mostra “Agenda de hoje concluída”; revisões de Cartões pendentes continuam visíveis no bloco Revisão do dia (FR-227, FR-256).
3. **Given** sete dias com estados diferentes, **When** o Usuário seleciona cada um, **Then** vê a data, a contagem e somente os Compromissos daquele dia; a seleção não altera dados nem desloca o calendário (FR-228–FR-230).
4. **Given** dia passado incompleto, futuro ou vazio, **When** é selecionado, **Then** mostra respectivamente “Não realizado”, “Programado” ou “Sem estudos”; o dia vazio não recebe sinal de sucesso nem de falha (FR-229).
5. **Given** uma semana anterior ou seguinte, **When** usa os controles de semana ou Hoje, **Then** o intervalo e o dia selecionado seguem as regras de navegação, inclusive na virada de mês e ano (FR-228, FR-246).
6. **Given** falha no carregamento da Agenda, **When** Início abre, **Then** não mostra zero ou “Tudo concluído” como resultado, oferece Tentar novamente e mantém acesso às demais áreas (FR-240, FR-251).

### User Story 3 - Concluir o estudo programado (Priority: P1)

O Usuário inicia uma Sessão pelo Compromisso de hoje. Ao concluir e salvar o
Registro de sessão, esse Compromisso fica concluído e o resumo diário é atualizado.

**Why this priority**: conecta o calendário a estudo efetivo, com conclusão verificável.

**Independent Test**: partir de um Compromisso pendente, iniciar pelo botão
Estudar, avaliar todos os Itens e salvar; reabrir Início e encontrar uma única
conclusão vinculada ao Registro daquela Sessão.

**Acceptance Scenarios**:

1. **Given** Compromisso de hoje com 20 Cartões e Baralho com 30, **When** aciona Estudar, **Then** inicia diretamente uma Sessão de 20 Cartões distintos, com a configuração indicada no Compromisso (FR-231, FR-232).
2. **Given** quantidade 20 e apenas 8 Cartões disponíveis, **When** inicia, **Then** a Sessão usa os 8 e comunica o limite; concluir os 8 satisfaz o Compromisso (FR-232).
3. **Given** Sessão iniciada pela Agenda, **When** o último Item é avaliado e a persistência confirma, **Then** o Registro, os Agendamentos dos Cartões e a conclusão do Compromisso ficam consistentes e Início passa a contar uma conclusão (FR-233, FR-235, FR-256).
4. **Given** Sessão interrompida, recarga ou Sair antes da conclusão, **When** volta à Agenda, **Then** o Compromisso segue pendente no mesmo dia; no dia seguinte está não realizado, sem conclusão parcial ou Registro da Sessão interrompida (FR-234, FR-247).
5. **Given** falha ao registrar a conclusão, **When** o Usuário permanece no Resumo e tenta novamente, **Then** há no máximo um Registro e uma conclusão; até a confirmação a Agenda não anuncia sucesso (FR-233, FR-235, FR-251).
6. **Given** duas Rotinas do mesmo Baralho no mesmo dia, **When** conclui a Sessão iniciada por uma, **Then** somente o Compromisso escolhido é concluído (FR-226, FR-236).
7. **Given** estudo iniciado por Baralhos ou Revisão do dia, **When** a Sessão é concluída, **Then** alimenta o Histórico e a repetição espaçada conforme hoje, sem concluir automaticamente um Compromisso (FR-236, FR-256).
8. **Given** Compromisso já concluído em outra aba, **When** uma segunda Sessão legitimamente iniciada antes disso termina, **Then** seu estudo pode ser registrado, mas o calendário continua contando uma conclusão e mantém o primeiro Registro que a confirmou (FR-235).

### User Story 4 - Usar a Agenda em qualquer aparelho e com segurança (Priority: P1)

O Usuário acessa apenas a própria Agenda, inclusive ao trocar de aparelho, e
executa os fluxos com teclado, leitor de tela e telas pequenas.

**Why this priority**: isolamento, persistência e acessibilidade são critérios
transversais obrigatórios do produto.

**Independent Test**: com dois Usuários, criar uma Rotina com o primeiro, reabrir
com ele em outro navegador e depois tentar consultá-la ou alterá-la com o
segundo; percorrer a criação e a seleção de dias inteiramente por teclado.

**Acceptance Scenarios**:

1. **Given** dois Usuários, **When** um tenta consultar, alterar, excluir ou concluir recursos do outro, **Then** não obtém dados ou sucesso e o recurso se comporta como inexistente (FR-248).
2. **Given** Rotina salva e Compromisso concluído, **When** o mesmo Usuário entra em outro aparelho ou a aplicação é atualizada, **Then** encontra a programação e a conclusão preservadas (FR-250).
3. **Given** o calendário e o formulário, **When** usa somente teclado, **Then** alcança todos os controles e as áreas de texto roláveis da Sessão, com foco visível; seleção, erros e resultados são anunciados por leitor de tela (FR-252, FR-255).
4. **Given** larguras 360, 390, 768 e 1440 px ou zoom de 200%, **When** percorre as telas, **Then** conteúdo e ações continuam alcançáveis sem rolagem horizontal da página, inclusive nomes longos (FR-253).
5. **Given** Credencial recusada, **When** qualquer operação da Agenda é tentada, **Then** aplica o fluxo de Entrar existente e não apresenta a operação como concluída (FR-248, FR-251).
6. **Given** uma solicitação com quantidade inválida, Baralho alheio, data não elegível ou Registro incompatível, **When** tenta contornar a interface, **Then** a operação é recusada com as mesmas regras de integridade (FR-254).
7. **Given** Sessão da Agenda com textos curtos e de 1000 caracteres, **When** revela o Verso, recebe as prévias, avalia e avança, **Then** o cartão mantém dimensões e as ações mantêm posição; todo o texto permanece acessível por rolagem interna e teclado (FR-255).

### User Story 5 - Ajustar a rotina sem apagar o que já foi estudado (Priority: P2)

Em Gerenciar agenda, o Usuário edita dias e quantidade, pausa, retoma ou exclui
uma Rotina, com explicação de quais Compromissos serão afetados.

**Why this priority**: permite adaptar a programação à disponibilidade do Usuário.

**Independent Test**: com uma Rotina que tem Compromissos passados e um concluído
hoje, alterar os dias, pausar, retomar e excluir; conferir o efeito sobre os
Compromissos futuros e a preservação dos passados e concluídos.

**Acceptance Scenarios**:

1. **Given** Rotinas ativas e pausadas, **When** abre Gerenciar agenda, **Then** vê Baralho, dias, quantidade e situação, com editar, pausar/retomar e excluir acessíveis (FR-237).
2. **Given** uma edição confirmada hoje, **When** consulta a Agenda, **Then** Compromissos passados e concluídos preservam sua configuração; pendentes de hoje são substituídos ou cancelados conforme a mudança e os futuros seguem a nova regra (FR-238).
3. **Given** uma Rotina, **When** pausa e confirma, **Then** não gera novos Compromissos durante a pausa e pendentes de hoje ficam cancelados; retomar começa hoje se o dia estiver selecionado, sem recriar dias da pausa ou duplicar uma conclusão de hoje (FR-238, FR-239).
4. **Given** uma Rotina com Histórico, **When** exclui e confirma, **Then** a Rotina deixa a lista ativa, os compromissos passados e concluídos permanecem, e nenhum Cartão, Baralho ou Registro é excluído (FR-239).
5. **Given** edição ainda não salva ou confirmação de exclusão, **When** cancela, **Then** preserva a programação; abandonar formulário alterado exige confirmação de descarte (FR-242, FR-251).
6. **Given** a mesma Rotina alterada em outra aba, **When** tenta salvar uma versão anterior, **Then** recebe aviso de conflito e pode revisar os valores atuais sem sobrescrever silenciosamente a mudança (FR-249).

### User Story 6 - Entender indisponibilidade e mudanças de data (Priority: P2)

O Usuário consegue distinguir um estudo não feito de um Baralho indisponível,
e as datas não mudam o significado de uma conclusão já registrada.

**Why this priority**: evita contagens enganosas quando o acervo muda ou a Sessão
atravessa a meia-noite.

**Independent Test**: remover os Cartões de um Baralho programado e atravessar a
meia-noite durante outro Compromisso; conferir mensagens, datas e totais.

**Acceptance Scenarios**:

1. **Given** Baralho vazio ou excluído antes do início, **When** abre seu Compromisso, **Then** vê a causa, Estudar indisponível e uma ação de ajuste; o Compromisso não é concluído automaticamente (FR-243).
2. **Given** Baralho renomeado ou com Cartões alterados, **When** inicia uma Sessão, **Then** usa o acervo atual; sessões já iniciadas usam o conteúdo capturado e conclusões anteriores mantêm os dados históricos (FR-244, FR-245).
3. **Given** Sessão iniciada segunda às 23h58 pelo Compromisso de segunda, **When** conclui terça às 00h05, **Then** conclui o Compromisso de segunda; o Registro e as Estatísticas usam o instante de conclusão de terça (FR-247).
4. **Given** troca de fuso no navegador, **When** reabre Início, **Then** hoje segue o novo fuso, mas Compromissos e conclusões já associados a datas mantêm essas datas e não se duplicam ao revisitar a mesma data (FR-246, FR-247).
5. **Given** Rotina editada, pausada ou excluída depois de iniciar uma Sessão, **When** a Sessão termina, **Then** pode concluir o Compromisso originalmente capturado; a interface explica essa exceção antes da alteração (FR-245).
6. **Given** Compromisso passado não concluído ou futuro, **When** seleciona o dia, **Then** pode consultar seus detalhes, mas não inicia recuperação nem antecipação pela Agenda (FR-231, FR-247).

### Edge Cases

- **Sem Rotinas ou sem Baralhos**: estados vazios diferentes; primeiro orientar Agendar estudo, depois criar/vincular conteúdo quando necessário (FR-241).
- **Quantidade maior que o acervo**: usar todos os disponíveis e informar o ajuste; zero Cartões impede início (FR-232, FR-243).
- **Todos os Itens avaliados como Errei**: a Sessão concluída satisfaz o Compromisso; conclusão mede participação, não Taxa de acerto (FR-233).
- **Duas Rotinas iguais**: duplicidade deliberada exige confirmação e gera obrigações independentes; reenvio acidental nunca equivale a essa confirmação (FR-226, FR-249).
- **Dia com 1 de 3 concluídos e 1 indisponível**: permanece 1 de 3; indisponibilidade não reduz a obrigação silenciosamente (FR-229, FR-243).
- **Dia com todos os Compromissos cancelados**: Sem estudos, com cancelamentos identificáveis nos detalhes e fora do denominador (FR-229, FR-238).
- **Pausar/retomar repetidamente no mesmo dia**: reutiliza o Compromisso da mesma Rotina/data; preserva uma conclusão existente (FR-239).
- **Sessão aberta antes de uma alteração**: a conclusão usa o Compromisso capturado, inclusive após cancelamento; não conclui a versão nova ou outro Baralho (FR-245).
- **Horário de verão, fevereiro e virada de ano**: recorrência por dia da semana e data civil, sem assumir dias com duração fixa de 24 horas (FR-246).
- **Falha depois de o salvamento ter sido confirmado remotamente**: a nova tentativa recupera o mesmo resultado, sem duplicar Rotina, Registro ou conclusão (FR-235, FR-249).
- **Dois dispositivos**: reabrir ou atualizar a Agenda apresenta o estado persistido atual; atualização instantânea entre aparelhos não é prometida (FR-249).
- **Nome de Baralho no limite de 100 caracteres**: quebra em linhas sem truncar informação essencial; não sobrepõe ações (FR-253).
- **Acervo e Histórico anteriores à feature**: não geram Rotinas ou conclusões retroativas, e permanecem intactos (FR-250).

## Requirements *(mandatory)*

### Functional Requirements

**Programação semanal**

- **FR-222**: O sistema MUST permitir ao Usuário criar uma Rotina de estudo escolhendo um Baralho próprio, um ou mais dias da semana e todos os Cartões ou uma quantidade definida; MUST oferecer um resumo legível antes de salvar.
- **FR-223**: A seleção MUST listar Baralhos próprios com nome e quantidade de Cartões, identificando os vazios. Criar ou trocar o Baralho de uma Rotina MUST exigir um Baralho elegível no momento da confirmação.
- **FR-224**: A Rotina MUST conter ao menos um dia entre segunda e domingo, sem dia duplicado; a quantidade definida MUST ser inteiro de 1 a 999. O modo Todos os Cartões MUST acompanhar o acervo disponível no início de cada Sessão.
- **FR-225**: A recorrência MUST ser semanal, sem horário ou data final nesta entrega. A criação MUST valer a partir de hoje, incluindo hoje quando selecionado, e MUST NOT criar obrigações anteriores à criação.
- **FR-226**: Criar, editar ou retomar Rotinas que resultem em Rotinas ativas distintas do mesmo Baralho com dias sobrepostos MUST exigir confirmação explícita de que serão estudos independentes; cada Rotina MUST originar no máximo um Compromisso por data, independentemente de recargas ou reenvios.

**Início e calendário**

- **FR-227**: Início MUST exibir resumo de hoje com data, concluídos/previstos e a ação Continuar estudos para o primeiro Compromisso pendente elegível. Com todos concluídos e total maior que zero, MUST mostrar “Agenda de hoje concluída”; com zero, MUST mostrar “Nenhum estudo agendado para hoje”. Se só restarem indisponíveis, MUST orientar Ajustar agenda.
- **FR-228**: Início MUST exibir calendário compacto de segunda a domingo, intervalo com mês/ano quando necessário, data e contagem concluídos/previstos de cada dia. MUST iniciar em hoje; Semana anterior/seguinte seleciona o mesmo dia da semana no novo intervalo, e Hoje retorna à data atual. Dias da semana corrente permanecem consultáveis mesmo antes da criação da primeira Rotina, sem obrigações retroativas.
- **FR-229**: O estado diário MUST seguir a tabela de estados abaixo. Totais MUST contar Compromissos distintos e excluir cancelados, sem excluir indisponíveis. Ausência ou falha de dados MUST NOT ser tratada como zero confirmado, conclusão ou falta.
- **FR-230**: Selecionar um dia MUST apresentar somente seus Compromissos, com Baralho, quantidade, situação e ação aplicável; a seleção MUST NOT modificar dados. A ordem MUST ser a de criação das Rotinas, com desempate estável, e Continuar estudos MUST seguir essa ordem. A posição e a área do calendário MUST permanecer estáveis ao selecionar dias.

**Sessão e conclusão**

- **FR-231**: Estudar MUST estar disponível somente para Compromisso pendente e elegível de hoje e MUST iniciar diretamente a Sessão com a configuração anunciada. Concluídos MUST oferecer Ver Sessão; passados não concluídos e futuros MUST ser consultáveis sem ação de início pela Agenda.
- **FR-232**: A Sessão MUST selecionar Cartões distintos do Baralho conforme `004`; quantidade definida MUST usar o menor valor entre o solicitado e o disponível, com aviso quando reduzida. Todos os Cartões MUST usar a quantidade disponível no início. O conteúdo e a quantidade efetiva MUST permanecer capturados durante a Sessão.
- **FR-233**: Um Compromisso MUST ser concluído somente quando todos os Itens da Sessão iniciada por ele forem avaliados e sua conclusão persistida. Qualquer distribuição de Avaliações satisfaz o Compromisso. O sistema MUST manter Registro, Agendamentos dos Cartões e conclusão do Compromisso consistentes, sem confirmar apenas parte da operação.
- **FR-234**: Interrupção, recarga, Sair ou recusa de Credencial durante a Sessão MUST NOT registrar estudo parcial nem concluir o Compromisso. As proteções de saída de `012`/`013` MUST continuar aplicadas.
- **FR-235**: Reenviar a mesma conclusão MUST produzir no máximo um Registro e uma conclusão do Compromisso. Sessões distintas iniciadas legitimamente para o mesmo Compromisso podem gerar seus próprios Registros e Avaliações; o Compromisso MUST continuar concluído uma única vez, associado ao primeiro Registro confirmado, sem substituição desse vínculo.
- **FR-236**: Uma Sessão MUST concluir no máximo o Compromisso pelo qual foi iniciada. Estudo livre e Revisão do dia iniciados fora da Agenda MUST NOT concluir automaticamente Compromissos, mesmo com Baralho e quantidade coincidentes. O Usuário MUST NOT marcar manualmente como concluído sem uma Sessão correspondente.

**Gerenciamento e estados de interface**

- **FR-237**: Gerenciar agenda MUST ser acessível pelo bloco da Agenda em Início e apresentar Rotinas ativas e pausadas, com nome do Baralho, dias, quantidade, situação e ações Editar, Pausar/Retomar e Excluir. MUST oferecer volta a Início, Agendar estudo e Atualizar agenda.
- **FR-238**: Editar uma Rotina MUST preservar sua identidade, os Compromissos passados e as conclusões. A mudança MUST afetar Compromissos ainda não concluídos de hoje e os futuros: dias removidos cancelam o Compromisso de hoje, dias adicionados podem criá-lo e mudanças de Baralho/quantidade atualizam sua configuração pendente. O formulário MUST explicar esses efeitos antes de confirmar. Um Compromisso cancelado MUST permanecer identificável nos detalhes do dia e fora dos totais, salvo conclusão válida conforme FR-245.
- **FR-239**: Pausar e excluir MUST pedir confirmação das consequências, cancelar pendentes de hoje e impedir novos Compromissos futuros; MUST preservar os passados, os concluídos e todo o acervo e Histórico. Retomar MUST aplicar a recorrência a partir de hoje, sem gerar obrigações para a pausa. A mesma Rotina/data MUST reutilizar o Compromisso existente, preservando sua conclusão quando houver. Exclusão não oferece desfazer nesta entrega.
- **FR-240**: Início e Gerenciar agenda MUST distinguir carregamento, vazio, falha e dados carregados. Falhas MUST oferecer Tentar novamente sem impedir acesso ao acervo, à Revisão do dia ou ao Histórico. Durante atualização, dados anteriores podem permanecer visíveis apenas com indicação de atualização ou falha, sem aparência de informação atual confirmada.
- **FR-241**: Sem Rotinas, Início MUST orientar Agendar estudo; sem Compromissos hoje, MUST permitir consultar a semana e agendar. Sem Baralho elegível, o formulário MUST orientar Criar Baralho ou adicionar Cartões ao Baralho existente, com caminho de retorno.
- **FR-242**: Agendar estudo e Editar MUST oferecer Baralho, dias, modo de quantidade, quantidade quando aplicável, resumo, Salvar e Cancelar. Campos MUST ter rótulos e instruções; cancelamento MUST preservar o estado salvo. Abandonar formulário alterado MUST pedir confirmação, conforme FR-148/FR-159 de `012`.

**Acervo e passagem do tempo**

- **FR-243**: Baralho vazio ou excluído MUST tornar novos inícios indisponíveis, comunicar a causa e oferecer ajuste da Rotina. A indisponibilidade MUST NOT concluir nem cancelar automaticamente o Compromisso; ele permanece no total enquanto o Usuário não ajustar ou cancelar a programação. Cartões adicionados novamente a um Baralho existente podem torná-lo elegível; Baralho recriado com o mesmo nome MUST NOT substituir automaticamente o excluído.
- **FR-244**: Compromissos pendentes e futuros MUST refletir o nome atual do Baralho e seu conteúdo no início. Compromissos passados ou concluídos MUST preservar a configuração e identificação históricas; a exclusão do Baralho MUST ser indicada sem perder o acesso a uma Sessão registrada.
- **FR-245**: Uma Sessão legitimamente iniciada MUST conservar a Rotina, a data e a configuração do Compromisso capturadas no início. Alterar, pausar ou excluir a Rotina depois MUST NOT invalidar sua conclusão. Se o Compromisso estiver cancelado quando essa Sessão for registrada, MUST passar a concluído e voltar ao total daquele dia, preservando a configuração estudada; outra configuração pendente da mesma Rotina/data MUST NOT gerar uma segunda obrigação. O gerenciamento MUST avisar que Sessões já iniciadas ainda poderão concluir o Compromisso.
- **FR-246**: Hoje e o dia da semana MUST usar o fuso do navegador, conforme `013`/`015`. Compromissos MUST ser associados a uma data civil, e não recalculados como intervalos fixos de 24 horas. Alterar o fuso pode alterar o hoje exibido, mas MUST NOT converter datas já associadas nem duplicar o Compromisso da mesma Rotina/data. Início MUST reavaliar a data ao voltar à tela, Atualizar agenda e atravessar a meia-noite com a tela ativa; o fuso usado MUST estar disponível em texto.
- **FR-247**: O Compromisso iniciado MUST manter a data escolhida no início, mesmo que a Sessão termine após a meia-noite ou haja troca de fuso. O Registro MUST manter seu instante real de conclusão para as Estatísticas. Compromissos não concluídos MUST NOT migrar automaticamente para outro dia, acumular nas próximas ocorrências ou ser concluídos retroativamente por estudo iniciado depois de sua data.

**Integridade, persistência e acessibilidade**

- **FR-248**: Agenda, Rotinas, Compromissos e vínculos com Registros MUST pertencer a um único Usuário; consultar, alterar, excluir ou concluir recursos alheios MUST se comportar como recurso inexistente. Recusa de Credencial MUST seguir FR-157 de `012`, sem manter acesso indevido.
- **FR-249**: Criação e alterações MUST impedir reenvio equivalente durante pendência e permitir nova tentativa sem duplicação após falha. Alteração concorrente da mesma Rotina MUST ser comunicada sem sobrescrita silenciosa, preservando os valores digitados para revisão. Reabrir ou Atualizar agenda MUST recuperar o estado persistido atual; sincronização instantânea entre aparelhos não é exigida.
- **FR-250**: Rotinas, Compromissos históricos e conclusões MUST sobreviver a recarga, Sair/Entrar, troca de aparelho e atualização da aplicação em todos os armazenamentos suportados. A introdução da feature MUST preservar acervo, Histórico, Preferências e Agendamentos dos Cartões; MUST NOT gerar Rotinas ou conclusões a partir do Histórico anterior.
- **FR-251**: Operações recusadas ou falhas MUST explicar a causa, preservar conteúdo preenchido ou o Resumo disponível, permitir recuperação e MUST NOT apresentar sucesso antes da persistência. Validação MUST identificar e focar o campo que requer correção. Falha de Registro MUST oferecer a nova tentativa de `013` e manter o Compromisso sem confirmação local de conclusão.
- **FR-252**: Todos os fluxos MUST ser executáveis por teclado, com foco visível e ordem previsível. Calendário e dias da recorrência MUST comunicar seleção e nomes completos; hoje, situação e contagens MUST ter texto acessível. Erros, salvamento e conclusão MUST ser perceptíveis por leitor de tela, sem depender apenas de cor, posição ou ícone. Diálogos MUST seguir FR-159 de `012`.
- **FR-253**: As telas MUST ser utilizáveis em 360, 390, 768 e 1440 px e zoom de 200%, sem rolagem horizontal da página, sobreposição impeditiva ou truncamento do nome essencial. Controles MUST ter alvos mínimos de 44 × 44 px e contraste conforme FR-136 de `012`. Os sete dias MUST continuar na mesma linha nas larguras previstas, usando o espaço disponível antes de reduzir alvos; detalhes completos ficam abaixo do calendário.
- **FR-254**: As regras de propriedade, elegibilidade, quantidade, dias, data e correspondência entre Compromisso e Registro MUST ser validadas de forma autoritativa, inclusive quando a operação não parte da interface. Uma conclusão MUST corresponder à Sessão legitimamente iniciada para aquele Compromisso, seu Usuário, Baralho capturado e quantidade efetiva, admitindo as mudanças posteriores de FR-245.
- **FR-255**: A Sessão iniciada pela Agenda MUST cumprir FR-150 de `012`: cartão de tamanho fixo, áreas reservadas para Frente, Verso e ações, sem abertura/fechamento ou deslocamento de controles ao revelar, avaliar, carregar prévias ou avançar; texto longo com rolagem interna acessível por teclado.
- **FR-256**: Sessões da Agenda MUST participar das Estatísticas, do Histórico e do Agendamento dos Cartões pelas mesmas regras do estudo por Baralho de `013`/`015`. A programação semanal MUST NOT alterar por si só a próxima revisão dos Cartões, o algoritmo ou o limite diário de novos. A Agenda e a Revisão do dia MUST ter contagens e mensagens de conclusão distintas.

### Definição da UI

#### Início: hierarquia e navegação

1. **Hoje**: data, concluídos/previstos e ação Continuar estudos; estado vazio ou Ajustar agenda quando aplicável.
2. **Sua semana**: intervalo, Semana anterior, Hoje, Semana seguinte e Agendar estudo; sete dias selecionáveis, com data e contagem. Hoje tem contorno e nome acessível; seleção tem destaque e estado anunciado. Ao selecionar outro dia, o resumo Hoje continua se referindo a hoje.
3. **Estudos do dia selecionado**: data completa e estado do dia; lista com Baralho, quantidade e situação. Estudar para os pendentes elegíveis de hoje; Ver Sessão para os concluídos; Ajustar rotina para indisponíveis. Cancelados aparecem identificados e sem Estudar.
4. **Gerenciar agenda**: acesso a uma tela de gerenciamento; não exige novo item na navegação principal nesta entrega.
5. **Revisão do dia, Estatísticas e Histórico**: permanecem disponíveis abaixo da Agenda, com seus estados e contagens próprios.

O calendário mantém sua área ao trocar de dia. A lista pode aumentar conforme
o número de Compromissos e usa rolagem da página; a exigência de cartão fixo é
específica da Sessão. No telefone, formulário e lista usam uma coluna. Se o
espaço interno de um painel não comportar sete alvos de 44 px, o calendário
usa a largura útil da página, sem encolher os alvos. Não há conteúdo que dependa
de passar o ponteiro para ser entendido.

#### Estados do calendário

Aplicar as regras nesta ordem, depois de excluir cancelados dos totais:

| Condição | Estado do dia | Exemplo de texto |
| --- | --- | --- |
| Total igual a zero | Sem estudos | Nenhum estudo agendado |
| Total maior que zero e todos concluídos | Concluído | 2 de 2 estudos concluídos |
| Data anterior a hoje e há não concluídos | Não realizado | 1 de 3 estudos concluídos; 2 não realizados |
| Data posterior a hoje e há não concluídos | Programado | 0 de 2 estudos concluídos |
| Hoje, nenhum concluído | Pendente | 0 de 2 estudos concluídos |
| Hoje, parte concluída | Parcial | 1 de 2 estudos concluídos |

Cada Compromisso tem situação própria: Pendente hoje, Programado no futuro,
Não realizado no passado, Concluído ou Cancelado. “Baralho indisponível” é uma
condição adicional dos não concluídos, não uma conclusão nem uma dispensa.
Um dia futuro pode conter uma conclusão já registrada se o Usuário mudou de
fuso; o total real é preservado e a precedência da tabela continua válida.

#### Formulário e gerenciamento

- **Agendar estudo**: Baralho; sete seletores de dia; Todos os Cartões ou Definir quantidade; campo numérico; resumo; Salvar agendamento e Cancelar. O padrão é Todos os Cartões e nenhum dia selecionado, para não salvar um dia escolhido silenciosamente.
- **Editar rotina**: os mesmos campos preenchidos; Salvar alterações e Cancelar; explicação de efeito sobre hoje e futuro, preservação do passado e exceção para Sessões já iniciadas.
- **Gerenciar agenda**: Rotinas ativas e pausadas identificadas em texto, na ordem de criação; edição, pausa/retomada e exclusão. Exclusão pede confirmação nomeando o Baralho e explicando a preservação do Histórico.
- **Operação em andamento**: ação de envio indisponível com indicação de salvamento; a conclusão confirmada devolve foco à Rotina ou a um destino estável se ela saiu da lista.
- **Falha e cancelamento**: conteúdo preservado; confirmação inicia em Cancelar, aceita Escape e devolve o foco ao acionador ao cancelar.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
| --- | --- | --- |
| FR-225, FR-250 | Não há programação ou conclusão retroativa automática | Criar a primeira Rotina com Histórico prévio e conferir dias anteriores |
| FR-226, FR-235, FR-249 | Reenvio não duplica Rotina, Registro ou conclusão | Repetir a mesma operação após falha e conferir contagens e identidade |
| FR-229, FR-240 | Falha de carga não equivale a zero ou sucesso | Simular indisponibilidade com e sem dados anteriores |
| FR-234 | Interrupção não conclui nem registra parcialmente | Interromper, recarregar e Sair durante Sessão |
| FR-236 | Estudo externo não conclui Compromisso; conclusão não se espalha | Concluir estudos dentro e fora da Agenda com duas Rotinas do mesmo Baralho |
| FR-238, FR-239, FR-244 | Alterações não apagam passado, acervo ou Histórico | Editar, pausar e excluir com Compromissos passados e concluídos |
| FR-243 | Indisponibilidade não é conclusão e nome igual não substitui identidade | Esvaziar/excluir Baralho e criar outro com o mesmo nome |
| FR-245 | Alteração posterior não invalida Sessão iniciada | Iniciar, alterar a Rotina em outra aba e concluir |
| FR-246, FR-247 | Datas não migram e pendências não acumulam | Atravessar meia-noite, trocar fuso e avançar semana |
| FR-248, FR-254 | Usuário não opera recursos alheios nem contorna integridade | Exercitar operações com dois Usuários e entradas inválidas fora da interface |
| FR-251 | Falha não é apresentada como sucesso | Falhar gravação de Rotina e conclusão de Sessão, depois tentar novamente |
| FR-252, FR-253 | Informação não depende só de cor ou ponteiro | Percorrer fluxos por teclado, leitor de tela, ampliação e nomes longos |
| FR-255 | Interação não redimensiona cartão nem desloca ações | Comparar geometria antes/depois de revelar, avaliar e avançar com textos diferentes |
| FR-256 | Rotina não altera automaticamente a repetição espaçada | Criar/editar Rotina e conferir Agendamentos dos Cartões inalterados |

### Key Entities

- **Agenda de estudo**: visão dos Compromissos do Usuário por data; contagens e estados são derivados desses Compromissos.
- **Rotina de estudo**: pertence ao Usuário; identifica o Baralho, dias da semana, quantidade ou Todos os Cartões e situação ativa/pausada. Mudanças têm efeito temporal explícito e não reescrevem o passado.
- **Compromisso de estudo**: pertence ao Usuário e a uma Rotina em uma data civil; mantém a configuração relevante, cancelamento quando houver e vínculo com o Registro que confirmou sua conclusão. Há no máximo um por Rotina/data.
- **Registro de sessão**: mantém a memória do estudo concluído conforme `013`/`015`; pode comprovar a conclusão do Compromisso pelo qual a Sessão começou. Outros estudos continuam independentes da Agenda.
- **Baralho e Cartão**: permanecem entidades do acervo existente; a Rotina não cria cópias de conteúdo nem altera Vínculos.

## Success Criteria *(mandatory)*

- **SC-095**: Com Baralho elegível existente, o Usuário consegue criar uma Rotina de dois dias e quantidade definida em até 1 minuto, sem consultar instruções externas, em celular e desktop.
- **SC-096**: Em todos os cenários de 0, 1 e vários Compromissos por dia, concluídos, indisponíveis e cancelados, o resumo de hoje e os sete dias conferem integralmente com os Compromissos persistidos e a tabela de estados.
- **SC-097**: Em 100% dos cenários de conclusão normal, reenvio, falha seguida de nova tentativa e duas Sessões simultâneas, cada Compromisso tem no máximo uma conclusão e a associação correta com o Registro; nenhuma Sessão interrompida conclui um Compromisso.
- **SC-098**: Edição, pausa, retomada e exclusão preservam 100% dos Compromissos passados e concluídos, dos Registros e do acervo; não geram obrigações para intervalos de pausa.
- **SC-099**: Nos cenários de meia-noite, horário de verão, mudança de fuso e virada de mês/ano, não há duplicação por Rotina/data, deslocamento de conclusão existente ou transferência automática de pendências.
- **SC-100**: Nos testes com dois Usuários e dois aparelhos, cada Usuário reencontra sua Agenda e nenhuma leitura ou alteração expõe dados alheios, inclusive quando a operação não parte da interface.
- **SC-101**: Criar, editar, selecionar dias, pausar/retomar, excluir e iniciar estudo são concluídos inteiramente por teclado; em 360, 390, 768 e 1440 px e zoom de 200%, conteúdo e ações permanecem alcançáveis e os estados são compreensíveis sem percepção de cor.
- **SC-102**: Com 100 Rotinas e 2 anos de Compromissos anteriores, Início apresenta a semana e o resumo diário em até 1 segundo no ambiente local de aceite, sem exigir carregar todo o Histórico visível.
- **SC-103**: Em todos os cenários com textos curtos e de 1000 caracteres, revelar, avaliar e avançar mantêm dimensões do cartão e posições das ações da Sessão para uma mesma largura; o conteúdo completo continua acessível.
- **SC-104**: Criar ou alterar Rotinas não modifica nenhum Agendamento do cartão; concluir uma Sessão pela Agenda produz os mesmos efeitos de Avaliação, Histórico e Estatísticas de um estudo por Baralho equivalente, acrescentando somente a conclusão do Compromisso correspondente.

## Invariantes de Domínio

1. Toda Rotina, Compromisso e conclusão pertence a um único Usuário; o Baralho escolhido também pertence a ele.
2. Existe no máximo um Compromisso por Rotina e data; Rotinas distintas podem criar estudos independentes no mesmo dia.
3. Um Compromisso tem no máximo uma conclusão, comprovada pelo Registro de uma Sessão iniciada por ele; uma Sessão conclui no máximo um Compromisso.
4. Avaliação mede recordação; conclusão do Compromisso mede a realização integral do estudo e independe de acerto.
5. Interrupção não registra estudo parcial nem conclui Compromisso.
6. Compromissos passados e conclusões não são reescritos por mudanças posteriores da programação ou do acervo.
7. A data do Compromisso e o instante de conclusão da Sessão têm significados distintos e são preservados.
8. Cancelamentos não contam como estudos previstos ativos; indisponibilidade de Baralho não equivale a cancelamento ou conclusão.
9. Agendamento do cartão e Rotina de estudo são independentes; somente a Avaliação efetivamente registrada alimenta a repetição espaçada.
10. Nenhum sucesso persistente é anunciado antes da confirmação; repetição da mesma operação não duplica seus efeitos.

## Funcionalidades Adiadas

- Horários, lembretes, notificações, calendários externos e recorrências mensais ou por intervalo variável.
- Data final da Rotina, agendamento avulso, arrastar Compromissos e reagendar ocorrências individualmente.
- Antecipar estudos futuros, recuperar pendências pela Agenda e marcar conclusão manual.
- Metas de minutos, sequências de dias, pontuação e classificação de desempenho na Agenda.
- Compartilhar Rotinas entre Usuários, estudo offline e sincronização instantânea entre aparelhos.
- Escolha manual de fuso próprio da Agenda, retomada persistente de Sessão e desfazer exclusão de Rotina.
- Alterar algoritmos ou regras da repetição espaçada; exportar ou excluir o Histórico de estudo.

## Assumptions

- **A-01 — premissa a validar**: a conclusão exige iniciar a Sessão pelo Compromisso. O plano usa o padrão proposto, sem contagem automática de estudo livre; a escolha permanece uma premissa de produto a validar. Orienta FR-233–FR-236.
- **A-02 — premissa a validar**: o fuso do navegador define hoje, como em `013`/`015`; datas já associadas permanecem estáveis. A primeira versão não oferece fuso próprio da Agenda. Orienta FR-246/FR-247.
- **A-03 — premissa a validar**: mudanças valem para hoje ainda não concluído e para o futuro; passado e conclusões permanecem, e Sessões já iniciadas podem concluir seu Compromisso capturado. Orienta FR-238/FR-239/FR-245.
- **A-04 — premissa a validar**: há recorrência semanal sem horário, limite definido de 1 a 999 Cartões ou Todos os Cartões, e Rotinas sobrepostas são permitidas mediante confirmação. Orienta FR-224–FR-226.
- **A-05 — premissa a validar**: dias não realizados permanecem no passado, sem recuperação ou acúmulo automático; estudos futuros não são antecipados pela Agenda. Orienta FR-231/FR-247.
- **A-06 — premissa a validar**: Agenda aparece antes de Revisão do dia em Início e o gerenciamento é acessado pelo próprio bloco, sem novo destino principal. Orienta FR-227/FR-237 e Definição da UI.
- **A-07 — premissa a validar**: 100 Rotinas e 2 anos de Compromissos são a escala inicial de aceite; não representam um limite de cadastro. Orienta SC-102.
- Dados do protótipo são ilustrativos e não serão incluídos no acervo do Usuário. O glossário novo registra a linguagem desta proposta, não a existência de implementação.
- A instrução final limita o trabalho à criação do plano. Implementação, migrações executadas, testes de aplicação, commits de código e publicação estão fora desta entrega. As tarefas documentam uma implementação futura, dependente de nova autorização.
- Arquitetura, contratos, modelo de persistência, migração e estratégia de testes pertencem ao `plan`; a rastreabilidade requisito–teste será detalhada em `tasks`. A matriz de aceitação em `checklists/requirements.md` é uma revisão documental, não evidência de testes executados.
