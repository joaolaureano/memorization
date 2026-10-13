# Feature Specification: Cartão com Imagem

**Feature Branch**: `026-cartao-com-imagem`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Vamos criar um novo tipo de cartão, com Imagens. Devemos fazer uso de S3. A tela de criação de cards é único, onde vamos selecionar através de um dropdown, o qual modifica a tela para se adaptar ao tipo escolhido. O padrão sempre será Frente-Verso, com essa nova possibilidade de escolha."

**Depende de**: `001-criar-cartao`, `004-sessao-de-estudo`, `005-editar-cartao-e-baralho`, `006-excluir-cartao-e-baralho`, `017-gerenciar-conta-usuario` e `025-criar-cartoes-baralho`.

## Objetivo e escopo

Introduzir o Tipo de cartão. O tipo existente passa a se chamar **Frente-Verso** e continua sendo o padrão. O novo tipo, **Imagem**, permite que o Cartão carregue uma Imagem enviada pelo Usuário, além de texto. A criação de Cartão continua sendo uma única tela no detalhe do Baralho (`025`). Nela, um seletor de tipo, que começa sempre em Frente-Verso, adapta os campos ao tipo escolhido.

Estão no escopo a criação, a apresentação no Baralho e na Sessão de estudo, a edição do conteúdo e a exclusão de Cartões do tipo Imagem, incluindo a remoção das Imagens. Ficam fora: importar Imagens de pacotes Anki, editar a Imagem dentro da aplicação (recortar, girar, anotar), qualquer outro tipo de cartão, cota ou limite de envios por Usuário (risco de custo aceito para o volume atual) e limite de dimensões em pixels (o limite de 5 MB basta e a Imagem só é aberta pelo próprio dono).

## Clarifications

### Session 2026-10-13

- Q: Em que lado do Cartão do tipo Imagem a Imagem deve ficar? → A: Só na Frente, com Texto da frente opcional; o Verso é só texto.
- Q: Quais formatos de arquivo e qual tamanho máximo a Imagem pode ter? → A: JPEG, PNG, WebP e GIF, com até 5 MB.
- Q: Um Cartão do tipo Imagem sem texto na Frente pode ficar em um Baralho onde já existe outro Cartão do tipo Imagem sem texto na Frente? → A: Sim. Cada Tipo de cartão define as próprias regras (campos, validação, unicidade, apresentação), no estilo de um template por tipo. No tipo Imagem, a unicidade vale só para o Texto da frente informado; sem texto, o Cartão fica fora da regra.
- Q: A importação de Baralhos do Anki deve trazer as Imagens dos pacotes como Cartões do tipo Imagem nesta feature? → A: Não, fica fora do escopo. A importação continua gerando só Cartões Frente-Verso e ignora as Imagens.
- Q: Quando a Imagem de um Cartão for trocada ou excluída, o Histórico de estudo deve continuar mostrando a Imagem que foi estudada nas Sessões passadas? → A: Não. O Histórico guarda só o texto e a indicação de que o Cartão era do tipo Imagem; a Imagem antiga deixa de existir.
- Q (checklist): Sair ou a expiração do acesso revogam na hora os endereços de exibição já emitidos? → A: Não; eles expiram em até 15 minutos.
- Q (checklist): O que fazer com os metadados embutidos nas fotos (GPS e outros)? → A: Remover ao aceitar a Imagem, preservando a orientação.
- Q (checklist): Como tratar GIF animado para quem pede movimento reduzido? → A: Exibir parado no primeiro quadro.
- Q (checklist): Depois de salvar com o formulário aberto para o próximo Cartão, o tipo volta para Frente-Verso? → A: Não; mantém o tipo usado. Cada nova abertura começa em Frente-Verso.
- Q (plan): Imagens enviadas sem Cartão salvo podem ser apagadas em até 48 horas, em vez de 24? → A: Sim, até 48 horas. Imagens de Cartões salvos ficam guardadas enquanto o Cartão existir.
- Q (plan): Como a Imagem deve ser exibida? → A: Diretamente no Cartão, sem link ou ação extra para vê-la. O endereço técnico usado para carregar a Imagem nunca é mostrado ao Usuário.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Criar um Cartão com Imagem (Priority: P1)

Como Usuário, quero escolher o tipo Imagem na tela de criação de Cartão e enviar uma Imagem, para memorizar conteúdos visuais como mapas, diagramas, obras ou rostos.

**Why this priority**: é o valor central da feature. Sem criar Cartões com Imagem, nada mais nela faz sentido.

**Independent Test**: no detalhe de um Baralho, escolher o tipo Imagem, enviar uma Imagem válida, preencher o Verso, salvar e confirmar que o Cartão aparece no Baralho com a Imagem e continua lá depois de reabrir a aplicação.

**Acceptance Scenarios**:

1. **Given** o detalhe de um Baralho, **When** o Usuário abre a criação de Cartão, **Then** o seletor de tipo mostra Frente-Verso selecionado e os campos são exatamente os de hoje.
2. **Given** a criação de Cartão aberta, **When** o Usuário escolhe o tipo Imagem, **Then** a tela passa a mostrar os campos do tipo Imagem, sem recarregar a página nem sair do Baralho.
3. **Given** o tipo Imagem selecionado, **When** o Usuário envia uma Imagem válida, preenche o texto obrigatório e salva, **Then** o estado "Enviando imagem…" é anunciado a leitores de tela, o Cartão é criado no Baralho de origem com sua Imagem e o resultado é comunicado.
4. **Given** uma Imagem escolhida e ainda não salva, **When** o Usuário a escolhe, **Then** vê uma pré-visualização e pode trocá-la ou removê-la antes de salvar.
5. **Given** o tipo Imagem selecionado, **When** o Usuário tenta salvar sem Imagem, **Then** a criação é recusada e a mensagem diz que falta a Imagem.
6. **Given** um arquivo com extensão não aceita ou acima do tamanho máximo, **When** o Usuário o escolhe, **Then** ele é recusado na hora, a mensagem informa os formatos aceitos ou o limite, e os demais campos preenchidos permanecem. **Given** um arquivo cujo conteúdo não é uma Imagem aceita, mesmo com extensão de Imagem, **When** o Usuário salva, **Then** a criação é recusada com o motivo e os demais campos permanecem.
7. **Given** o envio da Imagem falha ou o armazenamento está indisponível, **When** o Usuário salva, **Then** a falha é comunicada, o Cartão não aparece como criado, nenhuma Imagem fica órfã e o conteúdo preenchido permanece para nova tentativa.
8. **Given** o Usuário preencheu campos em um tipo, **When** troca para outro tipo, **Then** os textos já digitados que existam nos dois tipos são mantidos. Se uma Imagem escolhida for descartada pela troca, o Usuário é avisado antes.
9. **Given** o Usuário navega apenas por teclado, **When** escolhe o tipo, seleciona a Imagem e salva, **Then** completa tudo sem ponteiro, com foco visível. A troca de campos é anunciada a leitor de tela.
10. **Given** o tipo Imagem, **When** o Usuário envia a Imagem, **Then** pode informar uma descrição alternativa da Imagem, usada por leitores de tela.

---

### User Story 2 - Estudar Cartões com Imagem (Priority: P1)

Como Usuário, quero que os Cartões com Imagem apareçam na Sessão de estudo e no Baralho com a Imagem visível, para revisar o conteúdo visual da mesma forma que revejo os Cartões de texto.

**Why this priority**: um Cartão que não pode ser estudado não cumpre o propósito do produto. Esta história é inseparável da primeira para entregar valor.

**Independent Test**: criar um Cartão com Imagem em um Baralho, iniciar uma Sessão de estudo com ele e confirmar que a Imagem aparece no lado correto, que revelar a resposta funciona e que a avaliação alimenta a repetição espaçada como em qualquer Cartão.

**Acceptance Scenarios**:

1. **Given** um Baralho com Cartões dos dois tipos, **When** o Usuário abre seu detalhe, **Then** cada Cartão aparece uma vez, o tipo é perceptível sem depender só de cor ou ícone e os Cartões do tipo Imagem mostram uma miniatura.
2. **Given** um Cartão com Imagem em uma Sessão de estudo, **When** ele é apresentado, **Then** a Imagem aparece no lado definido pelo tipo e o outro lado só aparece ao revelar a resposta, como nos Cartões Frente-Verso.
3. **Given** um Cartão com Imagem avaliado na Sessão, **When** a avaliação é registrada, **Then** o Agendamento e o Histórico são atualizados pelas mesmas regras dos Cartões Frente-Verso.
4. **Given** a Imagem não pode ser carregada no momento, **When** o Cartão é apresentado, **Then** o Usuário vê um aviso de Imagem indisponível com a descrição alternativa, se houver, e a Sessão continua.
5. **Given** uma Imagem maior que a área disponível, **When** é exibida em tela pequena ou grande, **Then** aparece inteira, sem distorção e sem rolagem horizontal da página.
6. **Given** os filtros e a busca existentes no Baralho, **When** o Usuário pesquisa por texto, **Then** os Cartões com Imagem são encontrados pelos seus textos.

---

### User Story 3 - Editar e excluir Cartões com Imagem (Priority: P2)

Como Usuário, quero corrigir o texto, trocar a Imagem ou excluir um Cartão com Imagem, para manter o acervo correto sem guardar arquivos que não uso mais.

**Why this priority**: a manutenção do conteúdo importa, mas a criação e o estudo já entregam valor sem ela.

**Independent Test**: editar um Cartão com Imagem trocando a Imagem e o texto, confirmar a mudança no Baralho e na Sessão. Depois excluí-lo e confirmar que a Imagem deixou de ser acessível.

**Acceptance Scenarios**:

1. **Given** um Cartão com Imagem, **When** o Usuário abre a edição, **Then** vê os campos do tipo Imagem preenchidos, com a Imagem atual pré-visualizada. O tipo é mostrado, mas não pode ser alterado.
2. **Given** a edição de um Cartão com Imagem, **When** o Usuário troca a Imagem e salva, **Then** a nova Imagem passa a valer em todo lugar e a anterior deixa de ser acessível.
3. **Given** a edição, **When** o Usuário remove a Imagem e tenta salvar sem enviar outra, **Then** o salvamento é recusado, porque o tipo Imagem exige uma.
4. **Given** um Cartão com Imagem, **When** o Usuário o exclui e confirma, **Then** o Cartão some do Baralho e sua Imagem deixa de ser acessível.
5. **Given** um Baralho com Cartões com Imagem, **When** o Baralho é excluído, ou o Usuário exclui a própria conta, **Then** todas as Imagens desses Cartões deixam de ser acessíveis.
6. **Given** a Cópia de um Cartão com Imagem para outro Baralho (`025`), **When** a Cópia é criada, **Then** ela mantém o tipo e mostra a mesma Imagem. Excluir um dos dois não remove a Imagem do outro.

---

### Edge Cases

- **Tipo padrão**: toda abertura da criação de Cartão começa em Frente-Verso, mesmo que o último Cartão criado tenha sido do tipo Imagem. Se o formulário continua aberto depois de um salvamento para criar o próximo Cartão, ele mantém o tipo usado.
- **Envio interrompido**: fechar a tela durante o envio aciona a proteção de saída vigente. Se o Usuário insistir, nada é salvo e o envio parcial é descartado em até 48 horas.
- **Edição simultânea**: se o mesmo Cartão do tipo Imagem for editado em dois aparelhos, vale o último salvamento, e a Imagem substituída vai para remoção.
- **Cancelar o descarte**: cancelar o aviso de descarte (FR-406) mantém o tipo e a Imagem escolhida.
- **Cartões existentes**: todos os Cartões criados antes desta feature passam a ser do tipo Frente-Verso, sem mudança de conteúdo, Agendamento ou Histórico.
- **Arquivo que parece Imagem mas não é**: um arquivo com extensão de Imagem e conteúdo de outro tipo é recusado. Quem decide é o servidor, não o navegador.
- **Imagem duplicada**: o Usuário pode enviar o mesmo arquivo em Cartões diferentes. Cada envio vira uma Imagem própria, e a aplicação não julga conteúdo.
- **Abandono da criação**: se o Usuário escolheu uma Imagem e fecha o formulário sem salvar, nenhum Cartão é criado e a Imagem não fica guardada indefinidamente.
- **Acesso por terceiros**: a Imagem de um Usuário nunca é exibida a outro Usuário nem a quem não tenha Entrado, mesmo que conheça o endereço permanente da Imagem.
- **Frente repetida no Baralho**: no tipo Imagem, a unicidade de Frente da `025` vale para o Texto da frente. Uma repetição recebe o mesmo sufixo numérico já usado nos Cartões Frente-Verso.
- **Sessão iniciada antes da edição**: se a Imagem for trocada enquanto uma Sessão estiver aberta em outro aparelho, a Sessão pode mostrar a Imagem anterior até o próximo Cartão.
- **Histórico de Cartão com Imagem**: o Snapshot do Histórico registra os textos e o Tipo de cartão, nunca a Imagem. Quando o Histórico é consultado depois que a Imagem foi trocada ou excluída, ele mostra que o Cartão era do tipo Imagem, sem exibi-la.

## Requirements *(mandatory)*

### Functional Requirements

**Tipo de cartão e tela de criação**

- **FR-403**: O sistema MUST atribuir a todo Cartão exatamente um Tipo de cartão, entre Frente-Verso e Imagem.
- **FR-403a**: Cada Tipo de cartão MUST definir as próprias regras: campos, validação, unicidade dentro do Baralho, apresentação no Baralho e apresentação na Sessão. Criação, edição, listagem e estudo MUST aplicar as regras do tipo do Cartão, e um novo tipo MUST poder ser acrescentado sem alterar as regras dos tipos existentes.
- **FR-404**: A criação de Cartão MUST ser uma única tela no detalhe do Baralho, com um seletor de tipo que adapta os campos exibidos ao tipo escolhido, sem navegar para outra tela.
- **FR-405**: O seletor de tipo MUST começar em Frente-Verso sempre que a criação de Cartão é aberta. Depois de um salvamento com o formulário ainda aberto para o próximo Cartão, o seletor MUST manter o tipo usado.
- **FR-406**: Ao trocar de tipo durante a criação, o sistema MUST preservar os textos de campos comuns aos dois tipos: Verso, Tags e Frente ↔ Texto da frente. Se a troca descartar uma Imagem já escolhida, MUST avisar o Usuário antes.
- **FR-407**: Os Cartões existentes antes desta feature MUST passar a ser do tipo Frente-Verso, com conteúdo, Baralho, Agendamento e Histórico inalterados.

**Conteúdo do Cartão com Imagem**

- **FR-408**: Um Cartão do tipo Imagem MUST ter uma Imagem na Frente, um Texto da frente opcional e um Verso de texto obrigatório. Os textos seguem as regras de conteúdo não vazio e o limite já vigentes.
- **FR-409**: O sistema MUST recusar a criação ou edição de Cartão do tipo Imagem sem Imagem, informando o motivo.
- **FR-410**: O sistema MUST aceitar Imagens nos formatos JPEG, PNG, WebP e GIF, com até 5 MB por arquivo, e recusar qualquer outro arquivo informando os formatos aceitos ou o limite.
- **FR-411**: A validação de formato e tamanho MUST ser autoritativa no servidor, conferindo o conteúdo real do arquivo e não apenas o nome ou a declaração do navegador.
- **FR-412**: O Usuário MUST poder informar, opcionalmente, uma descrição alternativa da Imagem, com até 250 caracteres.
- **FR-413**: Antes de salvar, o sistema MUST mostrar uma pré-visualização da Imagem escolhida e permitir trocá-la ou removê-la.
- **FR-414**: No tipo Imagem, a unicidade de Frente dentro do Baralho (`025`) MUST se aplicar ao Texto da frente quando ele for informado. Cartões do tipo Imagem sem Texto da frente não entram na regra de unicidade.

**Apresentação e estudo**

- **FR-415**: A Imagem MUST aparecer diretamente no Cartão, sem link, botão ou passo extra para vê-la. O detalhe do Baralho MUST identificar o tipo de cada Cartão por texto ou rótulo acessível e mostrar uma miniatura da Imagem, com até 96 px no lado maior, nos Cartões do tipo Imagem.
- **FR-416**: Na Sessão de estudo, um Cartão do tipo Imagem MUST mostrar a Imagem, e o Texto da frente se houver, antes da revelação, e o Verso depois dela. Avaliação, Agendamento e Histórico seguem as regras vigentes.
- **FR-417**: A Imagem MUST ser exibida inteira, sem distorção e sem causar rolagem horizontal da página, nas larguras de 360 a 1440 px e com zoom de 200%, inclusive na pré-visualização do formulário.
- **FR-418**: Quando a Imagem não puder ser carregada, o sistema MUST mostrar um aviso de Imagem indisponível com a descrição alternativa, se houver, sem interromper a Sessão. O mesmo vale para a miniatura no detalhe do Baralho.
- **FR-419**: A busca e os filtros do Baralho MUST considerar o Texto da frente e o Verso dos Cartões do tipo Imagem.

**Edição, exclusão e ciclo de vida da Imagem**

- **FR-419a**: O Snapshot de cada Cartão estudado no Histórico MUST registrar o Tipo de cartão e os textos, e MUST NOT reter a Imagem.
- **FR-420**: O Usuário MUST poder editar os textos, a descrição alternativa e a Imagem de um Cartão do tipo Imagem. O Tipo de cartão MUST NOT ser alterado depois da criação.
- **FR-421**: Ao trocar a Imagem de um Cartão ou excluir o Cartão, seu Baralho ou o Usuário, o sistema MUST tornar inacessível, em até 15 minutos, a Imagem desse Cartão (ou de cada Cartão removido).
- **FR-422**: A Cópia de um Cartão do tipo Imagem MUST manter o tipo e receber uma Imagem própria e idêntica. Remover um dos dois MUST NOT afetar a Imagem do outro.
- **FR-423**: Uma criação ou edição que falhe MUST NOT deixar Cartão parcialmente salvo, e Imagens enviadas sem Cartão salvo MUST deixar de ser guardadas em até 48 horas.

**Privacidade e acessibilidade**

- **FR-424**: Uma Imagem MUST ser entregue apenas ao Usuário dono do Cartão, com Entrar válido. O endereço permanente da Imagem MUST NOT dar acesso a ela; o endereço técnico usado para exibi-la é emitido só ao dono, nunca é mostrado na tela e expira em até 15 minutos. Sair ou a expiração do Acesso temporário não revogam endereços já emitidos, que expiram nesse mesmo prazo. Uma Imagem enviada só pode ser usada em Cartões do Usuário que a enviou.
- **FR-425**: Seletor de tipo, escolha de Imagem, pré-visualização, remoção e o aviso de descarte MUST ser operáveis por teclado, com foco visível. No aviso de descarte, o foco inicial fica no botão de cancelar e volta ao seletor ao fechar. A mudança de campos ao trocar de tipo MUST ser anunciada a leitores de tela. Depois de salvar, o foco segue o comportamento vigente da `025`. Quando o servidor recusa a Imagem, o foco vai para o campo Imagem, com a mensagem. O campo Descrição alternativa MUST ter o texto de ajuda "Descreva a imagem sem revelar a resposta."
- **FR-426**: A Imagem exibida MUST ter como texto alternativo a descrição alternativa informada ou, na falta dela, o Texto da frente ou o texto "Imagem do Cartão".
- **FR-427**: Ao aceitar uma Imagem, o servidor MUST remover os metadados embutidos no arquivo (localização, aparelho, data, comentários e similares), preservando a orientação de exibição da foto. A Imagem guardada e exibida nunca contém esses metadados.
- **FR-428**: Endereços de exibição e de envio de Imagem, Descrição alternativa e Texto da frente MUST NOT aparecer em logs nem em mensagens de erro.
- **FR-429**: Quando o sistema do Usuário pede movimento reduzido, um GIF animado MUST ser exibido parado no primeiro quadro, no Baralho, na Sessão e na pré-visualização.

### Key Entities *(include if feature involves data)*

- **Tipo de cartão**: categoria fixa de um Cartão que define as próprias regras: quais conteúdos ele tem, como são validados, como a unicidade no Baralho é decidida e como é apresentado. Valores: **Frente-Verso**, o padrão, com Frente e Verso de texto, e **Imagem**. Escolhido na criação e imutável depois.
- **Cartão**: mantém o significado da `025` (pertence a exatamente um Baralho) e passa a ter um Tipo de cartão. A Frente de um Cartão do tipo Imagem é composta pela Imagem e por um Texto da frente opcional.
- **Imagem**: arquivo visual enviado pelo Usuário e exibido na Frente de um Cartão do tipo Imagem. Pertence ao Usuário dono do Cartão e só ele a vê. Cada Cartão do tipo Imagem tem a sua própria Imagem; a Cópia recebe uma Imagem própria e idêntica. A Imagem deixa de ser guardada quando o seu Cartão deixa de existir ou a troca. É guardada sem metadados embutidos (FR-427).
- **Endereço permanente**: identificador fixo de uma Imagem no armazenamento. Sozinho, nunca dá acesso a ela (FR-424).
- **Texto da frente**: texto opcional que acompanha a Imagem na Frente de um Cartão do tipo Imagem. Quando informado, identifica o conceito para a regra de unicidade do Baralho.
- **Descrição alternativa**: texto curto e opcional que descreve a Imagem para quem não pode vê-la. Não faz parte da resposta do Cartão.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-167**: A partir do detalhe de um Baralho, criar um Cartão do tipo Imagem exige no máximo 6 interações além de digitar os textos.
- **SC-168**: Em 100% das aberturas da criação de Cartão, o tipo inicial é Frente-Verso, e a criação de Cartão Frente-Verso continua exigindo os mesmos passos de antes.
- **SC-169**: Em 100% das tentativas com arquivo fora dos formatos aceitos ou acima de 5 MB, nenhum Cartão é criado e o Usuário recebe a razão da recusa.
- **SC-170**: Em 100% das tentativas de obter a Imagem de outro Usuário, ou sem Entrar, nenhum endereço de exibição é emitido, e o endereço permanente é negado.
- **SC-171**: Depois de excluir ou trocar a Imagem de um Cartão, nenhum novo endereço de exibição é emitido para ela em 100% dos casos, e ela fica inacessível em até 15 minutos; nenhuma Imagem sem Cartão permanece guardada por mais de 48 horas.
- **SC-172**: A Imagem de um Cartão aparece na Sessão de estudo em até 2 segundos em conexão de 50 Mbps com 20 ms de latência, em 95% das apresentações.
- **SC-173**: Todos os Cartões existentes antes da feature continuam disponíveis como Frente-Verso, sem alteração de conteúdo, Agendamento ou Histórico.

## Assumptions

- **Armazenamento das Imagens**: por decisão do Product Owner, os arquivos de Imagem ficam em armazenamento de objetos Amazon S3, na infraestrutura AWS que o projeto já usa (`011`). O texto dos Cartões continua no armazenamento atual. O desenho detalhado fica para o `plan`.
- **Lado da Imagem**: a Imagem fica só na Frente (pergunta) e a resposta é o Verso de texto, confirmado em clarify (2026-10-13). Imagem no Verso fica fora do escopo.
- **Uma Imagem por Cartão**: o tipo Imagem tem exatamente uma Imagem. Várias Imagens por Cartão ficam fora do escopo.
- **Limites**: formatos JPEG, PNG, WebP e GIF e tamanho máximo de 5 MB são padrões de mercado para fotos e diagramas. GIF animado é exibido animado, exceto quando o sistema pede movimento reduzido (FR-429). Confirmado em clarify (2026-10-13).
- **Tipo imutável**: converter um Cartão entre tipos exigiria regras de migração de conteúdo e Agendamento sem pedido explícito. Para mudar de tipo, o Usuário cria outro Cartão.
- **Histórico**: os Snapshots de Sessões registradas guardam o texto do Cartão e o Tipo de cartão, nunca a Imagem. Confirmado em clarify (2026-10-13).
- **Importação Anki**: a importação existente continua criando apenas Cartões Frente-Verso. Importar Imagens de pacotes Anki fica fora do escopo, confirmado em clarify (2026-10-13). Elas são ignoradas sem aviso.
- **Ambiente local**: o modo de execução local, sem nuvem, usa um substituto de armazenamento de Imagens para desenvolvimento e testes, com os mesmos limites, recusas e regras de privacidade da nuvem.
- **Criptografia**: as Imagens guardadas usam a criptografia em repouso padrão do provedor de armazenamento.
