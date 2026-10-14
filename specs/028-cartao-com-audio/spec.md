# Feature Specification: Cartão com Áudio

**Feature Branch**: `028-cartao-com-audio`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Vamos criar agora um terceiro tipo de card, um card para áudio. Vamos ter o áudio, uma mensagem opcional e o verso obrigatório. Lembre-se de considerar as traduções também."

**Depende de**: `004-sessao-de-estudo`, `005-editar-cartao-e-baralho`, `006-excluir-cartao-e-baralho`, `017-gerenciar-conta-usuario`, `025-criar-cartoes-baralho`, `026-cartao-com-imagem` e `027-idioma-da-interface`.

## Objetivo e escopo

Acrescentar o terceiro Tipo de cartão, **Áudio**, ao lado de Frente-Verso (o padrão) e Imagem (`026`). Na Frente, o Cartão do tipo Áudio tem um Áudio enviado pelo Usuário e uma **Mensagem** opcional. O Verso é um texto obrigatório. Ele serve para memorizar pronúncia, vocabulário ouvido, trechos musicais, sons e ditados.

O tipo segue o modelo de template por tipo da `026` (FR-403a): ele define os próprios campos, validação, unicidade, apresentação no Baralho e apresentação na Sessão, sem alterar as regras de Frente-Verso e Imagem. Todo Texto do produto novo existe em Português, Inglês e Espanhol e segue o Idioma da interface (`027`). Toda mensagem técnica é em inglês.

Estão no escopo: criação, apresentação no Baralho e na Sessão de estudo, edição do conteúdo, exclusão, Cópia, filtro por Tipo e remoção dos Áudios.

Ficam fora do escopo:
- gravar Áudio pelo microfone dentro da aplicação;
- importar Áudios de pacotes Anki;
- editar o Áudio dentro da aplicação (cortar, normalizar volume, mudar velocidade de gravação);
- transcrição automática;
- mais de um Áudio por Cartão e Áudio no Verso;
- converter Cartões entre tipos;
- cota de envios por Usuário.

## Clarifications

### Session 2026-10-14

- Q: Além de enviar um arquivo, o Usuário deve poder gravar o Áudio pelo microfone dentro da aplicação? → A: Não. Só envio de arquivo. Para gravar, o Usuário usa o gravador do aparelho e envia o arquivo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Criar um Cartão com Áudio (Priority: P1)

Como Usuário, quero escolher o tipo Áudio na tela de criação de Cartão e enviar um Áudio, para memorizar o que preciso reconhecer pelo som.

**Why this priority**: é o valor central da feature. Sem criar Cartões com Áudio, nada mais nela faz sentido.

**Independent Test**: no detalhe de um Baralho, escolher o tipo Áudio, enviar um Áudio válido, ouvi-lo na pré-escuta, preencher o Verso, salvar e confirmar que o Cartão aparece no Baralho e continua lá depois de reabrir a aplicação.

**Acceptance Scenarios**:

1. **Given** o detalhe de um Baralho, **When** o Usuário abre o seletor de tipo, **Then** vê as opções Frente-Verso, Imagem e Áudio, com Frente-Verso selecionado.
2. **Given** a criação de Cartão aberta, **When** o Usuário escolhe Áudio, **Then** a tela passa a mostrar os campos Áudio, Mensagem (opcional) e Verso (obrigatório), sem recarregar a página nem sair do Baralho.
3. **Given** o tipo Áudio, **When** o Usuário escolhe um Áudio válido, **Then** pode ouvi-lo antes de salvar e pode trocá-lo ou removê-lo.
4. **Given** um Áudio escolhido e o Verso preenchido, **When** o Usuário salva, **Then** o estado "Enviando áudio…" é anunciado a leitores de tela, o Cartão é criado no Baralho de origem e o resultado é comunicado.
5. **Given** o tipo Áudio, **When** o Usuário tenta salvar sem Áudio ou sem Verso, **Then** a criação é recusada e a mensagem diz o que falta.
6. **Given** um arquivo com extensão não aceita ou acima do tamanho máximo, **When** o Usuário o escolhe, **Then** ele é recusado na hora, a mensagem informa os formatos aceitos ou o limite, e os demais campos permanecem. **Given** um arquivo cujo conteúdo não é um Áudio aceito, mesmo com extensão de Áudio, **When** o Usuário salva, **Then** a criação é recusada com o motivo e os demais campos permanecem.
7. **Given** o envio falha ou o armazenamento está indisponível, **When** o Usuário salva, **Then** a falha é comunicada, o Cartão não aparece como criado, nenhum Áudio fica guardado indefinidamente e o conteúdo preenchido permanece para nova tentativa.
8. **Given** campos preenchidos em um tipo, **When** o Usuário troca para outro tipo, **Then** os textos comuns são mantidos (Verso, Tags e Frente ↔ Texto da frente ↔ Mensagem). Se a troca descartar um Áudio ou uma Imagem já escolhidos, o Usuário é avisado antes.
9. **Given** o Usuário navega apenas por teclado, **When** escolhe o tipo, seleciona o Áudio, o ouve e salva, **Then** completa tudo sem ponteiro e com foco visível.
10. **Given** o Idioma da interface em Inglês ou Espanhol, **When** o Usuário cria um Cartão com Áudio, **Then** o nome do tipo, os rótulos, as ajudas, os anúncios e as recusas aparecem nesse idioma. O nome do arquivo, a Mensagem e o Verso aparecem como foram escritos.

---

### User Story 2 - Estudar Cartões com Áudio (Priority: P1)

Como Usuário, quero ouvir o Áudio na Sessão de estudo e revelar a resposta como nos demais Cartões, para revisar conteúdo sonoro com a mesma repetição espaçada.

**Why this priority**: um Cartão que não pode ser estudado não cumpre o propósito do produto. Esta história é inseparável da primeira para entregar valor.

**Independent Test**: criar um Cartão com Áudio, iniciar uma Sessão de estudo com ele, tocar o Áudio, revelar a resposta, avaliar e confirmar que Agendamento e Histórico foram atualizados.

**Acceptance Scenarios**:

1. **Given** um Baralho com Cartões dos três tipos, **When** o Usuário abre seu detalhe, **Then** cada Cartão aparece uma vez, o tipo é perceptível por texto ou rótulo acessível e os Cartões do tipo Áudio oferecem um controle para ouvir o Áudio e mostram sua duração.
2. **Given** um Cartão com Áudio em uma Sessão, **When** ele é apresentado, **Then** a Mensagem (se houver) e o controle de reprodução aparecem antes da revelação, e o Verso só aparece depois dela.
3. **Given** um Cartão com Áudio na Sessão, **When** o Usuário toca o Áudio, **Then** pode pausar, retomar e ouvir de novo quantas vezes quiser, antes e depois da revelação.
4. **Given** um Áudio tocando, **When** o Usuário revela a resposta, avalia ou passa ao próximo Cartão, **Then** a revelação não interrompe o Áudio, e passar ao próximo Cartão o interrompe.
5. **Given** um Cartão com Áudio avaliado na Sessão, **When** a avaliação é registrada, **Then** Agendamento e Histórico são atualizados pelas mesmas regras dos demais tipos.
6. **Given** o Áudio não pode ser carregado no momento, **When** o Cartão é apresentado, **Then** o Usuário vê um aviso de Áudio indisponível, a Mensagem continua visível e a Sessão continua.
7. **Given** o filtro por Tipo do detalhe do Baralho (`025`, FR-430), **When** o Usuário o abre, **Then** a opção Áudio aparece e mostra só os Cartões desse tipo.
8. **Given** a busca do Baralho, **When** o Usuário pesquisa por texto, **Then** os Cartões com Áudio são encontrados pela Mensagem e pelo Verso.

---

### User Story 3 - Editar, copiar e excluir Cartões com Áudio (Priority: P2)

Como Usuário, quero corrigir os textos, trocar o Áudio, copiar ou excluir um Cartão com Áudio, para manter o acervo correto sem guardar arquivos que não uso mais.

**Why this priority**: a manutenção do conteúdo importa, mas criar e estudar já entregam valor sem ela.

**Independent Test**: editar um Cartão com Áudio trocando o Áudio e o Verso e confirmar a mudança no Baralho e na Sessão. Depois excluí-lo e confirmar que o Áudio deixou de ser acessível.

**Acceptance Scenarios**:

1. **Given** um Cartão com Áudio, **When** o Usuário abre a edição, **Then** vê os campos do tipo Áudio preenchidos e pode ouvir o Áudio atual. O tipo é mostrado, mas não pode ser alterado.
2. **Given** a edição, **When** o Usuário troca o Áudio e salva, **Then** o novo Áudio passa a valer em todo lugar e o anterior deixa de ser acessível.
3. **Given** a edição, **When** o Usuário remove o Áudio e tenta salvar sem enviar outro, **Then** o salvamento é recusado, porque o tipo Áudio exige um.
4. **Given** um Cartão com Áudio, **When** o Usuário o exclui, exclui seu Baralho ou exclui a própria conta, **Then** os Áudios desses Cartões deixam de ser acessíveis.
5. **Given** a Cópia de um Cartão com Áudio para outro Baralho (`025`), **When** a Cópia é criada, **Then** ela mantém o tipo e toca o mesmo Áudio. Excluir um dos dois não remove o Áudio do outro.

---

### Edge Cases

- **Tipo padrão**: toda abertura da criação começa em Frente-Verso. Depois de um salvamento com o formulário aberto para o próximo Cartão, ele mantém o tipo usado, como na `026`.
- **Áudio muito curto ou silencioso**: a aplicação não julga o conteúdo. Qualquer arquivo de Áudio válido dentro dos limites é aceito.
- **Áudio duplicado**: o mesmo arquivo em Cartões diferentes vira um Áudio próprio para cada Cartão.
- **Mensagem repetida no Baralho**: a unicidade de Frente da `025` vale para a Mensagem informada, com o mesmo sufixo numérico dos demais tipos. Cartões do tipo Áudio sem Mensagem ficam fora da regra.
- **Envio interrompido ou abandono**: fechar a tela durante o envio aciona a proteção de saída vigente. Se o Usuário insistir, ou fechar o formulário sem salvar, nenhum Cartão é criado e o Áudio enviado deixa de ser guardado em até 48 horas.
- **Edição simultânea**: vale o último salvamento, e o Áudio substituído vai para remoção.
- **Sessão iniciada antes da edição**: se o Áudio for trocado com uma Sessão aberta em outro aparelho, a Sessão pode tocar o Áudio anterior até o próximo Cartão.
- **Sem saída de som ou som desligado**: a aplicação não detecta o volume. A Mensagem, o aviso de duração e a revelação continuam funcionando.
- **Navegador que não toca o formato**: se o navegador não conseguir reproduzir um Áudio aceito, o Usuário vê o aviso de Áudio indisponível, e a Sessão continua.
- **Troca de idioma com o Áudio tocando**: trocar o Idioma da interface não interrompe o Áudio e não muda a Mensagem nem o Verso.
- **Histórico**: o Snapshot registra os textos e o Tipo de cartão, nunca o Áudio. Depois que o Áudio for trocado ou excluído, o Histórico mostra que o Cartão era do tipo Áudio, sem tocá-lo.
- **Acesso por terceiros**: o Áudio de um Usuário nunca é entregue a outro Usuário nem a quem não tenha Entrado, mesmo que conheça o endereço permanente dele.

## Requirements *(mandatory)*

### Functional Requirements

**Tipo de cartão e tela de criação**

- **FR-431**: O sistema MUST acrescentar Áudio aos Tipos de cartão (FR-403). Todo Cartão continua com exatamente um tipo, entre Frente-Verso, Imagem e Áudio. Os Cartões existentes mantêm o tipo, o conteúdo, o Agendamento e o Histórico.
- **FR-432**: O seletor de tipo da criação (FR-404, FR-405) MUST oferecer Áudio como terceira opção, nesta ordem: Frente-Verso, Imagem, Áudio. As regras de tipo inicial e de manutenção do tipo depois de salvar continuam valendo.
- **FR-433**: Ao trocar de tipo durante a criação, o sistema MUST preservar Verso, Tags e o texto da Frente entre Frente (Frente-Verso), Texto da frente (Imagem) e Mensagem (Áudio). Se a troca descartar um Áudio ou uma Imagem já escolhidos, MUST avisar o Usuário antes, e cancelar o aviso mantém o tipo e o arquivo.

**Conteúdo do Cartão com Áudio**

- **FR-434**: Um Cartão do tipo Áudio MUST ter um Áudio e uma Mensagem opcional na Frente, e um Verso de texto obrigatório. Mensagem e Verso seguem as regras de conteúdo não vazio e o limite de tamanho já vigentes para Texto da frente e Verso.
- **FR-435**: O sistema MUST recusar a criação ou edição de Cartão do tipo Áudio sem Áudio ou sem Verso, informando o que falta.
- **FR-436**: O sistema MUST aceitar Áudios nos formatos MP3, M4A (AAC), OGG (Vorbis ou Opus), WebM (Opus) e WAV, com até 10 MB e até 5 minutos de duração por arquivo, e recusar qualquer outro arquivo informando os formatos aceitos ou o limite excedido.
- **FR-437**: A validação de formato, tamanho e duração MUST ser autoritativa no servidor, conferindo o conteúdo real do arquivo e não apenas o nome ou a declaração do navegador.
- **FR-438**: Antes de salvar, o sistema MUST permitir ouvir o Áudio escolhido e trocá-lo ou removê-lo.
- **FR-439**: No tipo Áudio, a unicidade de Frente dentro do Baralho (`025`) MUST valer para a Mensagem quando ela for informada. Cartões do tipo Áudio sem Mensagem ficam fora da regra.
- **FR-440**: O Áudio MUST entrar só por envio de arquivo. A aplicação MUST NOT pedir acesso ao microfone nem gravar Áudio.

**Apresentação e estudo**

- **FR-441**: O Áudio MUST ser tocado diretamente no Cartão por um controle de reprodução com tocar, pausar e posição. Ele MUST NOT tocar sozinho: só começa por ação do Usuário. O detalhe do Baralho MUST identificar o tipo Áudio por texto ou rótulo acessível e mostrar a duração do Áudio.
- **FR-442**: Na Sessão de estudo, um Cartão do tipo Áudio MUST mostrar a Mensagem, se houver, e o controle de reprodução antes da revelação, e o Verso depois dela. O Áudio MUST poder ser ouvido de novo antes e depois da revelação. Passar ao próximo Cartão ou encerrar a Sessão MUST interromper o Áudio. Avaliação, Agendamento e Histórico seguem as regras vigentes.
- **FR-443**: Só um Áudio MUST tocar de cada vez. Começar outro Áudio na mesma tela interrompe o anterior.
- **FR-444**: Quando o Áudio não puder ser carregado ou reproduzido, o sistema MUST mostrar um aviso de Áudio indisponível sem interromper a Sessão, mantendo a Mensagem visível. O mesmo vale no detalhe do Baralho e na edição.
- **FR-445**: O filtro por Tipo do detalhe do Baralho (FR-430) MUST incluir Áudio. A busca e os filtros MUST considerar a Mensagem e o Verso dos Cartões do tipo Áudio.
- **FR-446**: O controle de reprodução e o Cartão do tipo Áudio MUST caber nas larguras de 360 a 1440 px e com zoom de 200%, sem rolagem horizontal da página.

**Edição, exclusão e ciclo de vida do Áudio**

- **FR-447**: O Snapshot de cada Cartão estudado no Histórico MUST registrar o Tipo de cartão e os textos, e MUST NOT reter o Áudio.
- **FR-448**: O Usuário MUST poder editar a Mensagem, o Verso, as Tags e o Áudio de um Cartão do tipo Áudio. O Tipo de cartão MUST NOT ser alterado depois da criação.
- **FR-449**: Ao trocar o Áudio de um Cartão ou excluir o Cartão, seu Baralho ou o Usuário, o sistema MUST tornar inacessível, em até 15 minutos, o Áudio desse Cartão (ou de cada Cartão removido).
- **FR-450**: A Cópia de um Cartão do tipo Áudio MUST manter o tipo e receber um Áudio próprio e idêntico. Remover um dos dois MUST NOT afetar o Áudio do outro.
- **FR-451**: Uma criação ou edição que falhe MUST NOT deixar Cartão parcialmente salvo. Áudios enviados sem Cartão salvo MUST deixar de ser guardados em até 48 horas.
- **FR-452**: A importação do Anki MUST continuar criando apenas Cartões Frente-Verso e ignorar os Áudios dos pacotes.

**Privacidade e segurança**

- **FR-453**: Um Áudio MUST ser entregue apenas ao Usuário dono do Cartão, com Entrar válido, pelas mesmas regras da Imagem (FR-424). O endereço permanente nunca dá acesso. O endereço técnico de reprodução é emitido só ao dono, nunca aparece na tela e expira em até 15 minutos. Um Áudio enviado só pode ser usado em Cartões do Usuário que o enviou.
- **FR-454**: Ao aceitar um Áudio, o servidor MUST remover os metadados embutidos no arquivo (título, artista, comentários, localização, aparelho, capa e similares) sem alterar o som. O Áudio guardado e tocado nunca contém esses metadados.
- **FR-455**: Endereços de reprodução e de envio de Áudio, a Mensagem e o nome do arquivo MUST NOT aparecer em logs nem em mensagens de erro.

**Acessibilidade**

- **FR-456**: Seletor de tipo, escolha do Áudio, pré-escuta, remoção, aviso de descarte e controle de reprodução MUST ser operáveis por teclado, com foco visível e alvo de toque de pelo menos 44 × 44 px. Os controles MUST ter nome acessível, e o estado (tocando, pausado, terminado) MUST ser exposto a leitores de tela. A mudança de campos ao trocar de tipo MUST ser anunciada. Quando o servidor recusa o Áudio, o foco vai para o campo Áudio, com a mensagem.
- **FR-457**: O campo Mensagem MUST ter o texto de ajuda "Contexto ou pergunta para o áudio, sem revelar a resposta." no Idioma da interface.

**Idioma da interface**

- **FR-458**: Todo Texto do produto novo desta feature MUST existir em Português, Inglês e Espanhol e seguir o Idioma da interface (`027`). Isso inclui o nome do tipo (Áudio / Audio / Audio), rótulos, ajudas, nomes acessíveis dos controles, anúncios, avisos, recusas, a duração e o filtro por Tipo. A duração MUST ser formatada pelas convenções do Idioma da interface.
- **FR-459**: As recusas novas do servidor (falta de Áudio, formato, tamanho, duração e conteúdo inválido) MUST ser identificadas por código estável, com mensagem técnica em inglês, e a interface MUST apresentar o texto para a pessoa no Idioma da interface (`027`, FR-018 e FR-019).
- **FR-460**: A Mensagem, o Verso, as Tags e o nome do arquivo escolhido são Conteúdo do Usuário e MUST aparecer exatamente como foram escritos, em qualquer Idioma da interface.

### Key Entities *(include if feature involves data)*

- **Tipo de cartão**: passa a ter três valores: **Frente-Verso** (padrão), **Imagem** e **Áudio**. Escolhido na criação e imutável depois. Cada tipo define as próprias regras.
- **Cartão do tipo Áudio**: pertence a exatamente um Baralho (`025`). A Frente tem um Áudio e uma Mensagem opcional, e o Verso é texto obrigatório.
- **Áudio**: arquivo de som enviado pelo Usuário e tocado na Frente de um Cartão do tipo Áudio. Pertence ao Usuário dono do Cartão e só ele o ouve. Tem duração conhecida. Cada Cartão tem o próprio Áudio, e a Cópia recebe um idêntico. Ele deixa de ser guardado quando o Cartão deixa de existir ou o troca. É guardado sem metadados embutidos.
- **Mensagem**: texto opcional que acompanha o Áudio na Frente, como contexto ou pergunta. Quando informada, identifica o conceito para a regra de unicidade do Baralho.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-175**: A partir do detalhe de um Baralho, criar um Cartão do tipo Áudio exige no máximo 6 interações além de digitar os textos.
- **SC-176**: Em 100% das aberturas da criação de Cartão, o tipo inicial continua sendo Frente-Verso, e criar Cartões Frente-Verso e Imagem continua exigindo os mesmos passos de antes.
- **SC-177**: Em 100% das tentativas com arquivo fora dos formatos aceitos, acima de 10 MB ou acima de 5 minutos, nenhum Cartão é criado e o Usuário recebe a razão da recusa no Idioma da interface.
- **SC-178**: Em 100% das tentativas de obter o Áudio de outro Usuário, ou sem Entrar, nenhum endereço de reprodução é emitido, e o endereço permanente é negado.
- **SC-179**: Depois de excluir ou trocar o Áudio de um Cartão, ele fica inacessível em até 15 minutos em 100% dos casos. Nenhum Áudio sem Cartão permanece guardado por mais de 48 horas.
- **SC-180**: Em 95% das apresentações na Sessão de estudo, um Áudio de até 1 MB começa a tocar em até 2 segundos depois do pedido do Usuário, em conexão de 50 Mbps com 20 ms de latência.
- **SC-181**: 100% dos Textos do produto novos aparecem nos três idiomas, sem texto de outro idioma na tela, e nenhuma mensagem técnica nova está fora do inglês.
- **SC-182**: Todos os Cartões existentes antes da feature continuam com o mesmo tipo, conteúdo, Agendamento e Histórico.

## Assumptions

- **Armazenamento**: os Áudios usam o mesmo armazenamento de objetos e as mesmas regras de privacidade, expiração de endereços, remoção e limpeza de envios órfãos das Imagens (`026`). O modo local, sem nuvem, usa o mesmo substituto da `026`, com os mesmos limites e recusas.
- **Limites**: MP3, M4A (AAC), OGG, WebM e WAV cobrem o que celulares e computadores gravam e exportam. 10 MB e 5 minutos bastam para palavras, frases e trechos, e evitam arquivos longos que não cabem num Cartão. O plan pode ajustar os números com justificativa.
- **Sem reprodução automática**: o Áudio só toca quando o Usuário pede, para respeitar ambientes silenciosos, leitores de tela e as diretrizes de acessibilidade.
- **Lado do Áudio**: o Áudio fica só na Frente (pergunta) e a resposta é o Verso de texto, como pedido. Áudio no Verso fica fora do escopo.
- **Velocidade de reprodução**: o controle oferece só tocar, pausar e posição. Mudar a velocidade fica fora do escopo.
- **Tipo imutável e Histórico**: seguem a `026`. Para mudar de tipo, o Usuário cria outro Cartão, e o Histórico nunca guarda o Áudio.
- **Traduções**: os nomes do tipo são "Áudio" (PT), "Audio" (EN) e "Audio" (ES). Os demais textos são escritos nos três catálogos da `027`, e a prova de completude dos catálogos cobre os novos.
- **Criptografia**: os Áudios guardados usam a criptografia em repouso padrão do provedor de armazenamento.
