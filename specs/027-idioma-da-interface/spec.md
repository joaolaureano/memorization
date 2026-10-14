# Feature Specification: Idioma da Interface

**Feature Branch**: `027-idioma-da-interface`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Vamos fazer uma funcionalidade de i18n. Vamos fazer Português/Inglês/Espanhol. Só muda as funcionalidades de código, não vai mudar nada nas coisas criadas pelo Usuário, baralhos/cartões/tags, etc. O ícone pode ser um pequeno globo, com a sigla da lingua ao lado {icone} EN, {icone} PT, {icone} ES por exemplo"

**Depende de**: `012-interface-visual-navegavel`, `020-refinamento-ui` e de todas as features que publicam textos na interface (`001` a `026`).

## Objetivo e escopo

Permitir que quem usa o Memorization escolha o **Idioma da interface** entre Português, Inglês e Espanhol. O Idioma da interface muda todo texto escrito pelo produto: rótulos, botões, títulos, avisos, mensagens de validação e de erro, anúncios para leitores de tela, textos de ajuda e formatos de data e número. Ele nunca muda o **Conteúdo do Usuário**: Baralhos, Cartões (Frente, Verso, Texto da frente, descrição alternativa da Imagem), Tags, Nome de usuário e qualquer outro texto digitado ou importado pelo Usuário aparecem exatamente como foram escritos.

O **Seletor de idioma** é um pequeno globo acompanhado da sigla do idioma atual (🌐 PT, 🌐 EN, 🌐 ES). Ele fica disponível em todas as telas, inclusive antes de Entrar.

Fica fora do escopo: traduzir Conteúdo do Usuário, tradução automática de qualquer tipo, outros idiomas além dos três, idiomas da direita para a esquerda, variantes regionais selecionáveis (por exemplo, português de Portugal ou espanhol da Espanha), tradução do README e da documentação do repositório e guardar o idioma na conta do Usuário para sincronizar entre dispositivos.

## Clarifications

### Session 2026-10-13

- Q: Onde a escolha de idioma deve ficar guardada? → A: Só no navegador; vale antes e depois de Entrar e não sincroniza entre dispositivos.
- Q: As mensagens de recusa vindas do servidor também devem aparecer no idioma escolhido? → A: Toda mensagem técnica (respostas do servidor, registros, erros internos) é em inglês; mensagem técnica em português já é um defeito. O que a pessoa vê é sempre Texto do produto apresentado pela interface no Idioma da interface, a partir da recusa identificada pelo servidor.
- Q: O nome padrão "Baralho temporário" (`023`), usado quando o Baralho temporário fica sem nome, deve seguir o Idioma da interface? → A: Sim. A falta de nome é guardada como falta de nome, e a interface mostra o rótulo padrão no Idioma da interface, inclusive no Histórico de Sessões antigas. Ao salvar como Baralho, o nome preenchido naquele momento vira Conteúdo do Usuário e não muda mais.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trocar o idioma da interface (Priority: P1)

Como pessoa que usa o Memorization, quero trocar o idioma da interface entre Português, Inglês e Espanhol, para usar o produto no idioma que leio melhor.

**Why this priority**: é o valor central da feature. Sem a troca, nenhum outro comportamento faz sentido.

**Independent Test**: em qualquer tela, abrir o Seletor de idioma, escolher Inglês e confirmar que todos os textos do produto naquela tela passam para inglês, sem recarregar a página e sem perder o que estava preenchido. Repetir com Espanhol e Português.

**Acceptance Scenarios**:

1. **Given** qualquer tela, **When** a pessoa olha o cabeçalho, **Then** vê o Seletor de idioma com um globo e a sigla do idioma atual (PT, EN ou ES).
2. **Given** o Seletor de idioma, **When** a pessoa o abre, **Then** vê as três opções, cada uma com a sigla e o nome do idioma escrito no próprio idioma (Português, English, Español), com o idioma atual indicado por texto e não apenas por cor ou ícone.
3. **Given** uma tela em Português, **When** a pessoa escolhe English, **Then** todos os textos do produto visíveis na tela passam para inglês imediatamente, a sigla muda para EN e a troca é anunciada a leitores de tela no novo idioma.
4. **Given** um formulário parcialmente preenchido, uma Sessão de estudo em andamento ou um filtro aplicado, **When** a pessoa troca o idioma, **Then** nada do que foi preenchido, do progresso ou da navegação se perde.
5. **Given** a tela de Entrar ou de Criar conta, **When** a pessoa ainda não Entrou, **Then** o Seletor de idioma está disponível e funciona da mesma forma.
6. **Given** a navegação apenas por teclado, **When** a pessoa abre o Seletor, escolhe um idioma e fecha, **Then** completa tudo sem ponteiro, com foco visível, e o foco volta ao Seletor depois da escolha.

---

### User Story 2 - Conteúdo do Usuário permanece intacto (Priority: P1)

Como Usuário, quero que meus Baralhos, Cartões e Tags continuem exatamente como os escrevi, qualquer que seja o idioma da interface, para não perder nem distorcer o que estou memorizando.

**Why this priority**: é a fronteira explícita pedida. Uma troca de idioma que altere conteúdo destruiria a confiança no acervo.

**Independent Test**: com Baralhos, Cartões (Frente-Verso e Imagem) e Tags escritos em português, trocar o idioma para Inglês e Espanhol e confirmar que todo esse conteúdo aparece byte a byte igual, no acervo, na busca, na Sessão de estudo, nas estatísticas e no Histórico.

**Acceptance Scenarios**:

1. **Given** um Baralho chamado "Verbos irregulares" com Cartões e Tags em português, **When** o idioma muda para English, **Then** o nome do Baralho, a Frente, o Verso, as Tags e as descrições alternativas aparecem idênticos, e apenas os rótulos ao redor mudam.
2. **Given** um Baralho importado do Anki, **When** o idioma muda, **Then** nenhum texto importado é alterado.
3. **Given** a busca e os filtros do acervo, **When** o idioma muda, **Then** a busca encontra os mesmos Cartões que encontrava antes, pelos mesmos termos digitados.
4. **Given** o Nome de usuário, **When** o idioma muda, **Then** ele aparece como foi cadastrado.

---

### User Story 3 - O idioma escolhido é lembrado e há um idioma inicial sensato (Priority: P2)

Como pessoa que usa o Memorization, quero que o idioma escolhido continue valendo quando eu voltar, e que na primeira visita o produto já abra no idioma do meu navegador quando ele for um dos três.

**Why this priority**: sem memória da escolha, a troca teria de ser repetida a cada visita; mas a troca em si (US1) já entrega valor sem isto.

**Independent Test**: escolher Español, fechar e reabrir a aplicação no mesmo navegador e confirmar que ela abre em espanhol, antes e depois de Entrar. Em um navegador limpo configurado em inglês, confirmar que a primeira abertura é em inglês.

**Acceptance Scenarios**:

1. **Given** a pessoa escolheu um idioma, **When** reabre a aplicação no mesmo navegador, **Then** ela abre no idioma escolhido, inclusive nas telas antes de Entrar.
2. **Given** a pessoa escolheu um idioma, **When** Entra, Sai, ou o acesso temporário expira, **Then** o idioma continua o mesmo.
3. **Given** a primeira visita, sem escolha anterior, **When** o idioma preferido do navegador é português, inglês ou espanhol (de qualquer região), **Then** a aplicação abre nesse idioma.
4. **Given** a primeira visita, **When** o idioma preferido do navegador não é nenhum dos três, **Then** a aplicação abre em Português.
5. **Given** a escolha guardada não pode ser lida (por exemplo, dados do site apagados ou navegação privada), **When** a aplicação abre, **Then** ela segue as regras da primeira visita, sem erro.

---

### User Story 4 - Mensagens, datas e números no idioma escolhido (Priority: P2)

Como pessoa que usa o Memorization, quero que avisos, mensagens de erro e recusas, inclusive as que vêm do servidor, e as datas e números apareçam no idioma escolhido, para entender o que aconteceu sem trocar de idioma.

**Why this priority**: completa a experiência; sem isto a interface fica misturada, mas a navegação principal já funciona com US1.

**Independent Test**: em English, provocar uma recusa do servidor (por exemplo, Cartão com Frente repetida no Baralho, credencial inválida, arquivo de Imagem recusado) e confirmar que a mensagem aparece em inglês; abrir a Agenda e as estatísticas e confirmar datas e números no formato do idioma.

**Acceptance Scenarios**:

1. **Given** o idioma English ou Español, **When** o servidor recusa uma operação, **Then** a mensagem mostrada à pessoa está no idioma escolhido, apresentada pela interface a partir da recusa identificada pelo servidor.
2. **Given** qualquer Idioma da interface, **When** o servidor responde a qualquer operação, **Then** toda mensagem técnica da resposta está em inglês, nunca em português ou espanhol.
3. **Given** o idioma Español, **When** uma validação local recusa um campo, **Then** a mensagem está em espanhol.
4. **Given** qualquer idioma, **When** a Agenda, o Histórico, as estatísticas ou o Agendamento do cartão mostram datas, dias da semana, meses, quantidades ou percentuais, **Then** eles seguem as convenções do idioma escolhido (por exemplo, nomes de meses e dias, separador decimal).
5. **Given** qualquer idioma, **When** o texto depende de quantidade (por exemplo, "1 cartão" e "2 cartões"), **Then** a forma singular ou plural correta do idioma é usada.
6. **Given** qualquer idioma, **When** a página é lida por um leitor de tela, **Then** ela declara o idioma escolhido, para que a pronúncia seja a correta.

---

### Edge Cases

- Troca de idioma durante uma operação em andamento (envio de Imagem, importação Anki, salvamento): a operação continua; a mensagem de resultado aparece no idioma vigente quando ela chega.
- Mensagem já mostrada na tela (aviso ou erro) quando o idioma muda: passa a aparecer no novo idioma, ou some; nunca fica um aviso em idioma antigo misturado com a tela nova.
- Texto do produto sem tradução em algum idioma (lacuna): aparece em Português, nunca como identificador técnico ou campo vazio. A verificação da entrega impede que lacunas cheguem ao Usuário (SC-002).
- Rótulos mais longos em inglês ou espanhol: a interface continua legível sem cortes nem sobreposições em telas de celular (largura de 360 px) e de computador.
- Baralho temporário sem nome: o Histórico mostra o rótulo padrão no Idioma da interface vigente, inclusive para Sessões antigas; um Baralho temporário com nome digitado mostra sempre esse nome.
- Conteúdo do Usuário que coincide com um texto do produto (por exemplo, uma Tag chamada "Novo"): permanece como foi escrita; só o rótulo do produto é traduzido.
- Nomes dos níveis de Avaliação (Errei, Difícil, Bom, Fácil), do Tipo de cartão (Frente-Verso, Imagem) e do Algoritmo de repetição espaçada: são textos do produto e são traduzidos; o SM-2 mantém o nome próprio.
- Duas abas abertas com idiomas diferentes: cada aba mostra o idioma escolhido nela; a próxima abertura usa a última escolha feita.
- Datas digitadas pela pessoa: hoje não há campo de entrada de data na interface. Toda data mostrada segue o FR-008, e o valor guardado não depende do idioma.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O produto MUST oferecer exatamente três Idiomas da interface: Português (PT), Inglês (EN) e Espanhol (ES).
- **FR-002**: O produto MUST mostrar o Seletor de idioma em todas as telas, inclusive antes de Entrar, como um globo acompanhado da sigla do idioma atual (PT, EN ou ES).
- **FR-003**: O Seletor de idioma MUST listar cada opção com a sigla e o nome do idioma escrito no próprio idioma (Português, English, Español) e indicar o idioma atual por texto ou estado acessível, não apenas por cor ou ícone.
- **FR-004**: A troca de idioma MUST aplicar-se imediatamente a todos os textos do produto da tela atual e das seguintes, sem recarregar a página e sem perder campos preenchidos, Sessão de estudo em andamento, filtros ou posição de navegação.
- **FR-005**: Todo texto escrito pelo produto MUST ser apresentado no Idioma da interface: rótulos, botões, títulos, menus, avisos, diálogos de confirmação, mensagens de validação, de erro e de recusa (locais ou vindas do servidor), estados vazios, textos de ajuda, anúncios para leitores de tela, textos alternativos de ícones e nomes acessíveis. O título da aba do navegador é o nome do produto e é igual nos três idiomas.
- **FR-006**: O produto MUST NOT alterar, traduzir ou reformatar Conteúdo do Usuário em nenhum idioma: nomes e descrições de Baralhos, Frente, Verso, Texto da frente, descrição alternativa da Imagem, Tags, Nome de usuário e qualquer texto importado.
- **FR-007**: A troca de idioma MUST NOT alterar dados guardados, resultados de busca e filtros, Agendamentos do cartão, Histórico de estudo nem estatísticas; apenas a apresentação muda.
- **FR-008**: Datas, dias da semana, meses, horas, quantidades e percentuais MUST seguir as convenções do Idioma da interface, e textos que dependem de quantidade MUST usar a forma singular ou plural correta do idioma.
- **FR-009**: A página MUST declarar o Idioma da interface vigente para tecnologias assistivas, e a troca de idioma MUST ser anunciada a leitores de tela no novo idioma.
- **FR-010**: O Seletor de idioma MUST ser operável apenas por teclado, com foco visível, e devolver o foco ao Seletor após a escolha.
- **FR-011**: O produto MUST lembrar o idioma escolhido no mesmo navegador entre visitas, independentemente de Entrar, Sair ou expiração do acesso. A escolha MUST ficar apenas no navegador e MUST NOT ser guardada na conta do Usuário.
- **FR-012**: Sem escolha lembrada, o produto MUST abrir no idioma preferido do navegador quando ele for português, inglês ou espanhol de qualquer região, e em Português nos demais casos, inclusive quando a escolha guardada não puder ser lida.
- **FR-013**: Quando faltar a tradução de um texto do produto em um idioma, o produto MUST mostrá-lo em Português, nunca como identificador técnico ou vazio.
- **FR-014**: A verificação da entrega MUST falhar se algum texto do produto não tiver tradução nos três idiomas.
- **FR-015**: Avisos e mensagens já visíveis no momento da troca MUST passar ao novo idioma ou deixar de ser exibidos; a tela não mistura idiomas em textos do produto.
- **FR-016**: Operações em andamento no momento da troca MUST concluir normalmente, e sua mensagem de resultado MUST aparecer no idioma vigente quando chegar.
- **FR-017**: A interface MUST permanecer legível, sem cortes nem sobreposições de texto, nos três idiomas, em larguras de 360 px até telas de computador.
- **FR-018**: Toda mensagem técnica — respostas de recusa do servidor, registros de operação e erros internos — MUST estar em inglês, independentemente do Idioma da interface; mensagem técnica em português ou espanhol é defeito.
- **FR-019**: Cada recusa do servidor MUST ser identificável sem depender do texto da mensagem, para que a interface apresente à pessoa o Texto do produto correspondente no Idioma da interface; a pessoa nunca vê a mensagem técnica crua.
- **FR-020**: Quando um Baralho temporário não tem nome, o produto MUST guardar a falta de nome, sem gravar o rótulo padrão, e MUST apresentar o rótulo padrão ("Baralho temporário", "Temporary deck", "Mazo temporal") no Idioma da interface na Sessão, no Resumo e no Histórico, inclusive de Sessões registradas antes desta feature. Ao salvar a seleção como Baralho, o nome preenchido no formulário naquele momento MUST ser guardado como Conteúdo do Usuário e não muda mais com o idioma.
- **FR-021**: O rótulo "Revisão do dia", mostrado no lugar do nome do Baralho nas Sessões da Revisão do dia, MUST ser apresentado no Idioma da interface em todo lugar, inclusive no Histórico de Sessões antigas, e MUST NOT ser tratado como Conteúdo do Usuário.

### Key Entities

- **Idioma da interface**: o idioma em que o produto apresenta os próprios textos e formatos de data e número. Um entre Português (PT), Inglês (EN) e Espanhol (ES). Pertence ao navegador de quem usa o Memorization, não ao Usuário: existe antes de Entrar e não é uma das Preferências do Usuário (`015`).
- **Seletor de idioma**: o controle, presente em todas as telas, que mostra um globo com a sigla do Idioma da interface atual e permite escolher outro.
- **Texto do produto**: todo texto escrito pela própria aplicação (rótulos, mensagens, avisos, nomes de níveis de Avaliação, de Tipos de cartão etc.). É o único texto afetado pelo Idioma da interface.
- **Conteúdo do Usuário**: todo texto digitado ou importado pelo Usuário — Baralhos, Cartões, Tags, Nome de usuário, descrições alternativas. Nunca é afetado pelo Idioma da interface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em cada um dos três idiomas, 100% das telas do produto (antes e depois de Entrar) exibem todos os textos do produto no idioma escolhido, verificado por percorrer todas as telas.
- **SC-002**: 0 textos do produto sem tradução em qualquer um dos três idiomas no momento da entrega.
- **SC-003**: 0 alterações em Conteúdo do Usuário após trocar o idioma em qualquer ordem entre os três, comparando o acervo antes e depois.
- **SC-004**: A troca de idioma reflete na tela em menos de 1 segundo e não perde nenhum campo preenchido nem o progresso de uma Sessão de estudo.
- **SC-005**: Uma pessoa encontra e troca o idioma em até 2 interações a partir de qualquer tela, inclusive somente por teclado.
- **SC-006**: Em 100% das reaberturas no mesmo navegador, a aplicação abre no último idioma escolhido.
- **SC-007**: Em todas as telas, nos três idiomas, nenhum texto aparece cortado ou sobreposto nas larguras de 360 px e 1280 px.
- **SC-008**: 0 mensagens técnicas em português ou espanhol em respostas do servidor, registros ou erros internos.

## Assumptions

- Português significa português do Brasil, Inglês é o inglês dos Estados Unidos e Espanhol é um espanhol neutro (latino-americano). As traduções em inglês e espanhol são produzidas e revisadas como parte da entrega.
- O Idioma da interface fica guardado apenas no navegador, nunca na conta (Clarifications 2026-10-13): ele precisa existir antes de Entrar e não há requisito de sincronizar entre dispositivos (Princípio VII). Em outro dispositivo, vale a regra da primeira visita (FR-012).
- O servidor não conhece o Idioma da interface: responde sempre com mensagens técnicas em inglês e recusas identificáveis; a tradução para a pessoa é responsabilidade da interface (FR-018, FR-019). Regras de validação não mudam.
- Rótulos padrão usados na falta de um nome ("Baralho temporário" da `023` e "Revisão do dia") são Texto do produto: a falta de nome é guardada como tal e o rótulo é apresentado no Idioma da interface (FR-020). Um texto padrão que o Usuário salva como nome passa a ser Conteúdo do Usuário. O rótulo "Revisão do dia" (`019`/`024`), mostrado no lugar do nome do Baralho nas Sessões da Revisão do dia, segue a mesma regra. Corrigido no implement (research R12): o nome digitado de uma Sessão temporária sempre foi gravado e continua sendo Conteúdo do Usuário. Só o rótulo padrão gravado deixa de ser guardado.
- O nome do produto, "Memorization", não é traduzido.
- A sigla exibida no Seletor é a do idioma (PT, EN, ES), sem bandeira, para não associar idioma a país.
