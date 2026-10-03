# Feature Specification: Interface visual e navegável do Memorization

**Feature Branch**: `012-interface-visual-navegavel` (identificador da feature; esta etapa não cria nem troca branch)

**Created**: 2026-10-02

**Status**: Clarified — premissas confirmadas pelo Product Owner em 2026-10-02

**Input**: “Agora crie uma Spec usando o framework GitHub Spec Kit, sem codificar, apenas planejamento criando a spec”, em continuidade ao protótipo navegável de `design/prototipo-visual`.

**Depende de**: `001-criar-cartao` a `008-entrar`. As garantias de persistência e operação de `009` a `011` continuam vigentes.

## Objetivo e escopo

Adotar no aplicativo a experiência visual e os percursos do protótipo: tema escuro com destaque azul, navegação responsiva, formulários em páginas próprias, estados compreensíveis e proteção contra descarte involuntário. Quem usa deve conseguir Entrar, organizar o próprio acervo e concluir uma Sessão de estudo com continuidade entre telas.

A referência visual é [o protótipo](../../design/prototipo-visual/index.html), acompanhado de [seu guia](../../design/prototipo-visual/README.md) e [capturas](../../design/prototipo-visual/capturas/). A intenção expressa nesta spec e as regras vigentes prevalecem sobre comportamentos incidentais da demonstração. Não se exige reprodução pixel a pixel das capturas.

Esta feature trata da apresentação e da interação das capacidades existentes. O acervo do aplicativo continua persistente e separado por Usuário. As operações continuam sujeitas às regras de validação, acesso e integridade já especificadas. Não se introduzem alterações nos contratos de integração, no armazenamento ou na publicação do aplicativo.

Esta entrega contém somente especificação e revisão de qualidade dos requisitos. Arquitetura, tarefas, código, testes executáveis e publicação não fazem parte desta etapa.

## Clarifications

### Session 2026-10-02

- Q (revisão do Product Owner): qual o formato de cada Baralho na lista? → A: linha única e fina — nome (link para o detalhe) e quantidade à esquerda, Estudar à direita; saem o rótulo "Baralho", a linha de status e o botão "Ver baralho" (FR-144 revisado, SC-079).

- Q (revisão do Product Owner): onde ficam as ações sobre o Baralho no seu detalhe? → A: todas no topo, antes da lista de Cartões — Estudar, Adicionar cartões existentes, Renomear e Excluir —, para não obrigar a rolar a lista (FR-145 revisado, SC-078). Remover deste baralho permanece em cada Cartão.

- Q: Abaixo de qual largura vale a disposição móvel (marca e Sair no cabeçalho, destinos na navegação inferior)? → A: até 600 px, inclusive; acima disso a navegação fica no cabeçalho, tablets incluídos (FR-139).
- Q: Como o Resumo apresenta o percentual de acertos? → A: inteiro arredondado ao mais próximo, sem casas decimais; 2 de 3 = 67% (FR-152, SC-067).
- Q: Quais formulários pedem confirmação de descarte? → A: Cadastro, criar/editar Cartão, criar/renomear Baralho e configuração de estudo alterada; Entrar não pede (FR-148).
- Escopo confirmado pelo Product Owner: a 012 permanece como especificada. Tela de estatísticas e listas de acertos/erros no Resumo ficam para feature futura.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar e encontrar os próprios Baralhos (Priority: P1)

A pessoa encontra uma tela de Entrar clara e, quando necessário, acessa Criar conta. Após Entrar, encontra Baralhos como destino principal e pode alternar entre Baralhos e Cartões ou Sair.

**Why this priority**: torna o acervo acessível e estabelece a navegação usada pelos demais percursos.

**Independent Test**: com um Usuário existente, Entrar e conferir Baralhos; Sair e cadastrar outro Usuário; Entrar com ele e conferir o acervo vazio, sem conteúdo do primeiro.

**Acceptance Scenarios**:

1. **Given** nenhuma Credencial mantida, **When** a aplicação é aberta ou recarregada, **Then** apresenta Entrar, campos vazios e acesso a Criar conta, sem navegação para o acervo nem dados da demonstração.
2. **Given** Nome de usuário e Senha válidos, **When** Entrar conclui, **Then** Baralhos é a tela apresentada, com navegação para Cartões e ação Sair.
3. **Given** Credencial incorreta ou indisponibilidade, **When** Entrar falha, **Then** a mensagem distingue indisponibilidade da recusa única “Nome de usuário ou Senha incorretos.”, preserva o preenchimento para nova tentativa e permite corrigir o campo pertinente.
4. **Given** o Cadastro aberto, **When** Nome de usuário, Senha ou Confirmação da Senha são inválidos, **Then** a orientação explica a recusa e o foco chega ao campo a corrigir; quando o Cadastro conclui, apresenta sucesso e acesso a Entrar, sem entrar automaticamente.
5. **Given** uma Senha digitada no formulário atual, **When** a pessoa aciona Mostrar senha e depois Ocultar senha, **Then** o mesmo conteúdo alterna entre visível e mascarado, sem perda de caracteres nem alteração da Senha.
6. **Given** a pessoa entrou, **When** aciona Sair sem alterações ou estudo em andamento, **Then** a Credencial é descartada; voltar pelo navegador não reapresenta o acervo protegido.
7. **Given** um segundo Usuário cadastrado, **When** ele entra, **Then** somente seu próprio acervo é exibido, inclusive quando está vazio.

### User Story 2 - Organizar Cartões e Baralhos sem perder conteúdo (Priority: P1)

A pessoa cria um Baralho, cria Cartões em uma página própria e os vincula pelo detalhe do Baralho. Ela reconhece quais Baralhos utilizam cada Cartão e entende a diferença entre editar, remover um Vínculo e excluir conteúdo.

**Why this priority**: permite preparar o conteúdo que será estudado e evita exclusões com consequências inesperadas.

**Independent Test**: criar Cartão e Baralho; vincular o mesmo Cartão a dois Baralhos; editar e conferir ambos; remover um Vínculo; excluir um Baralho e conferir que o Cartão continua no acervo.

**Acceptance Scenarios**:

1. **Given** a lista de Baralhos, **When** a pessoa escolhe Criar baralho, **Then** abre uma página própria com nome, orientações, salvar e voltar/cancelar; a lista apresenta, uma linha por Baralho, o nome (que abre o detalhe), a quantidade de Cartões e a ação textual Estudar.
2. **Given** a lista de Cartões, **When** a pessoa cria ou edita um Cartão, **Then** encontra Frente e Verso com limites e validação em página própria; após salvar, o conteúdo é atualizado no acervo.
3. **Given** um Baralho existente, **When** seu detalhe é aberto, **Then** Estudar este Baralho, Adicionar cartões existentes, Renomear e Excluir Baralho aparecem juntos no topo, antes da lista de Cartões vinculados.
3a. **Given** um Baralho com 40 Cartões vinculados, em 360 px, **When** o detalhe é aberto, **Then** as quatro ações do Baralho ficam visíveis sem rolagem, e o primeiro Tab depois do título chega a elas antes de qualquer Cartão.
4. **Given** um Cartão já vinculado ao Baralho, **When** a tela de adicionar é aberta, **Then** não oferece criar o mesmo Vínculo novamente; quando não há opções, explica se faltam Cartões no acervo ou se todos já estão vinculados.
5. **Given** um Cartão em dois Baralhos, **When** a edição é aberta, **Then** informa os Baralhos e que editar afeta todos eles; salvar altera o conteúdo visto nos dois.
6. **Given** um Cartão vinculado, **When** Remover deste baralho conclui, **Then** somente esse Vínculo é removido, sem pedir confirmação, preservando o Cartão e seus demais Vínculos.
7. **Given** a exclusão de um Cartão ou Baralho, **When** a confirmação é aberta, **Then** informa o alvo e as consequências: Cartão excluído perde todos os Vínculos e preserva os Baralhos; Baralho excluído preserva seus Cartões. Cancelar não altera o acervo.
8. **Given** formulário de criação ou edição com alterações, **When** a pessoa tenta voltar, cancelar, trocar de destino ou Sair, **Then** pede confirmação de descarte; cancelar conserva o preenchimento e confirmar descarta apenas o que não foi salvo.
9. **Given** um formulário sem alterações, inclusive após restaurar os valores originais, **When** a pessoa sai dele, **Then** não há confirmação de descarte.
10. **Given** acervo vazio, **When** a lista é aberta, **Then** orienta a criação do primeiro Cartão ou Baralho; nenhuma criação é iniciada automaticamente.

### User Story 3 - Estudar com progresso e encerramento claros (Priority: P1)

A pessoa inicia uma Sessão de estudo por um Baralho, define a quantidade, vê somente a Frente, revela o Verso e declara o Resultado do item. Ao concluir, encontra as contagens e o percentual de acertos.

**Why this priority**: é o objetivo principal do produto e precisa continuar utilizável durante a mudança visual.

**Independent Test**: preparar um Baralho com três Cartões, estudar três Itens com dois acertos e um erro e verificar o Resumo; iniciar outra Sessão e verificar cancelamento e confirmação de interrupção.

**Acceptance Scenarios**:

1. **Given** um Baralho vazio, **When** Estudar é acionado, **Then** explica a ausência de Cartões e oferece adicioná-los, sem iniciar Sessão.
2. **Given** três Cartões disponíveis, **When** a pessoa pede cinco, **Then** sabe antes do primeiro Item que estudará três; zero, negativo, vazio e quantidade fracionária são recusados.
3. **Given** Sessão iniciada, **When** cada Item é apresentado, **Then** apenas a Frente está visível, há indicação da posição e total, e o Resultado só pode ser declarado após Revelar verso.
4. **Given** Verso revelado, **When** a pessoa escolhe Acertei ou Errei, **Then** registra um único Resultado e avança para o próximo conteúdo; nenhum Cartão se repete nessa Sessão.
5. **Given** Sessão em andamento, **When** a pessoa tenta interromper, navegar para outro destino ou Sair, **Then** a confirmação explica o descarte integral sem Resumo; cancelar mantém o Item, a Revelação e os Resultados já declarados, e confirmar descarta a Sessão.
6. **Given** três Itens concluídos com dois acertos, **When** o Resumo aparece, **Then** mostra três estudados, dois acertos, um erro e 67% de acertos, com ações para estudar novamente ou voltar ao Baralho.
7. **Given** Sessão em andamento, **When** um Item avança ou a Sessão conclui, **Then** o novo conteúdo recebe foco visível e a mudança é perceptível por leitor de tela.

### User Story 4 - Entender estados e recuperar operações (Priority: P2)

A pessoa distingue carregamento, envio, sucesso, acervo vazio, falha e recurso indisponível. Pode corrigir e tentar novamente sem redigitar todo o conteúdo ou provocar operações duplicadas.

**Why this priority**: impede falsas confirmações e preserva o trabalho quando uma operação falha.

**Independent Test**: provocar uma falha de carregamento e uma de salvamento; repetir ambas; enviar duas vezes enquanto a operação está pendente; abrir um recurso inexistente.

**Acceptance Scenarios**:

1. **Given** uma leitura ainda pendente, **When** a tela abre, **Then** informa carregamento, sem afirmar que o acervo está vazio; se falhar, oferece nova tentativa.
2. **Given** criação, edição, exclusão ou Vínculo pendente, **When** a pessoa repete o acionamento, **Then** identifica o estado em andamento e a interface não inicia uma segunda operação equivalente.
3. **Given** falha ao salvar, excluir ou alterar Vínculo, **When** a falha é apresentada, **Then** não mostra sucesso, preserva o preenchimento ou conteúdo exibido e permite repetir; a atualização confirmada aparece de forma coerente nas telas afetadas.
4. **Given** recurso inexistente, removido ou pertencente a outro Usuário, **When** seu destino é acessado, **Then** a mensagem é a mesma de recurso não encontrado e oferece voltar ao acervo, sem revelar dados de outro Usuário.
5. **Given** Credencial recusada em uma operação, **When** a recusa é recebida, **Then** descarta a Credencial e exige Entrar novamente, sem confirmação que mantenha acesso indevido nem apresentação de sucesso.
6. **Given** aviso de uma operação anterior, **When** outra tela é apresentada, **Then** esse aviso não é apresentado como resultado de uma operação da nova tela.

### User Story 5 - Usar a mesma experiência em celular e por teclado (Priority: P2)

A pessoa usa os mesmos fluxos com toque, teclado, ampliação e leitor de tela. Os controles mantêm nomes, hierarquia e aparência consistentes entre áreas.

**Why this priority**: garante acesso aos fluxos completos nos tamanhos e modos de interação previstos.

**Independent Test**: percorrer Entrar → criar Baralho → criar Cartão → vincular → estudar → concluir usando apenas teclado; repetir a inspeção visual nas quatro larguras de referência e com zoom de 200%.

**Acceptance Scenarios**:

1. **Given** tela de celular até 600 px, **When** a pessoa entrou, **Then** marca e Sair aparecem no cabeçalho e Cartões/Baralhos na navegação inferior; em larguras maiores, os destinos estão no cabeçalho, com indicação do destino atual.
2. **Given** qualquer tela, **When** inspecionada em 360, 390, 768 e 1440 px e com zoom de 200%, **Then** conteúdo e controles permanecem alcançáveis, sem cortes, sobreposição impeditiva ou rolagem horizontal da página.
3. **Given** diálogo aberto por teclado, **When** Tab, Shift+Tab e Escape são usados, **Then** o foco fica no diálogo; Escape equivale a cancelar; fechar sem confirmar devolve o foco ao acionador, e confirmar leva ao conteúdo resultante.
4. **Given** conteúdo no limite permitido, palavras longas ou acervo de 60 Cartões e 20 Baralhos, **When** a pessoa percorre as telas, **Then** consegue ler os textos completos e alcançar todas as ações.
5. **Given** campos, ações e mensagens, **When** usados por teclado ou leitor de tela, **Then** possuem nomes e relações compreensíveis e comunicam erro, sucesso e progresso sem depender apenas de cor.

### Edge Cases

- **Um Cartão ou todos os Resultados iguais**: Sessão e Resumo válidos; percentual pode ser 0% ou 100%.
- **Baralho perde o último Vínculo**: passa a não elegível; Estudar explica a causa e não inicia Sessão.
- **Cartão alterado ou entidade excluída durante uma Sessão iniciada**: preserva o conteúdo capturado no início, conforme `004`; esta feature não introduz sincronização ao vivo.
- **Saída sem alteração efetiva**: não pede descarte. Em Entrar, sair do formulário não recebe confirmação de edição; a proteção de formulário cobre Cadastro, criação e edição do acervo e configuração modificada de estudo.
- **Recarregar ou fechar a aba**: solicita confirmação nativa quando o navegador permitir; se a saída ocorrer, descarta Credencial e Sessão. Não promete texto personalizado, retomada ou bloqueio infalível do fechamento.
- **Operação pendente e saída**: mantém a pessoa na tela até a operação terminar, informa o motivo e não sugere que sair cancela uma gravação já enviada. Falha permite corrigir, repetir ou sair com a proteção cabível.
- **Recurso some antes de salvar ou excluir**: comunica indisponibilidade, não inventa sucesso e mantém o texto digitado enquanto houver acesso autorizado à tela.
- **Falha de acesso**: a segurança do acervo prevalece sobre preservação de preenchimento; não impede o retorno obrigatório a Entrar.
- **Somente espaços e caracteres especiais**: mantém os limites, normalização e validações das features originais; texto de Cartão é conteúdo literal, nunca ação executável.

## Requirements *(mandatory)*

### Functional Requirements

**Requisitos vigentes reutilizados**:

- **FR-042**: O sistema MUST apresentar suas telas de forma utilizável em telas pequenas.
- **FR-044**: O sistema MUST NOT apresentar como concluída qualquer operação que não tenha sido efetivamente persistida.
- **FR-045**: Quando uma operação falhar por indisponibilidade do armazenamento, o sistema MUST reportar a falha e MUST preservar o estado da tela, permitindo nova tentativa.
- **FR-046**: O sistema MUST apresentar toda a sua interface em português, empregando os termos canônicos de `CONTEXT.md` e MUST NOT empregar os sinônimos listados como `_Avoid_`.

FR-044 aplica-se às operações persistentes; Resultados e Resumos de Sessão continuam transitórios. FR-045 não permite manter acesso ao acervo quando a Credencial é recusada. Os demais requisitos de `001` a `008` continuam vigentes; abaixo se especificam os acréscimos de apresentação e interação.

**Específicos desta feature** — numeração continua após FR-134 de `011`:

- **FR-135**: O sistema MUST usar tema escuro com destaque azul e apresentação consistente de títulos, campos, ações, mensagens, Cartões e diálogos em todas as telas do escopo.
- **FR-136**: O texto principal MUST ter tamanho base mínimo de 16 px; controles interativos MUST oferecer área de acionamento mínima de 44 × 44 px; texto comum MUST ter contraste mínimo de 4,5:1, texto grande de 3:1, e limites necessários para identificar controles e indicadores de foco de 3:1 contra a cor adjacente. Texto grande significa ao menos 24 px regular ou 18,66 px em negrito.
- **FR-137**: A interface MUST manter todos os percursos utilizáveis nas larguras 360, 390, 768 e 1440 px e com zoom nativo do navegador de 200%, sem perda de conteúdo, sobreposição impeditiva ou rolagem horizontal da página.
- **FR-138**: Sem Credencial, o sistema MUST apresentar Entrar com acesso a Criar conta; após Entrar com sucesso, MUST apresentar Baralhos. MUST preservar as regras de recusa, isolamento e Sair de `008`.
- **FR-139**: Depois de Entrar, a navegação MUST oferecer Cartões, Baralhos e Sair em todas as telas. Até 600 px, marca e Sair MUST estar no cabeçalho e os destinos na navegação inferior; acima disso, MUST estar no cabeçalho. O destino atual MUST ser identificável.
- **FR-140**: Criar e editar Cartão, criar e renomear Baralho e realizar Cadastro MUST ocorrer em páginas próprias com voltar/cancelar explícitos; formulários de criação MUST abrir somente por ação da pessoa.
- **FR-141**: Campos MUST apresentar nomes, orientações e limites pertinentes. Validação recusada MUST explicar o problema e levar o foco ao campo pertinente, mantendo as regras de `001`, `002`, `007` e `008`.
- **FR-142**: Campos de Senha e Confirmação da Senha MUST iniciar mascarados e permitir mostrar/ocultar apenas o conteúdo digitado no formulário atual. MUST NOT recuperar Senhas armazenadas, preencher Credencial de exemplo, persistir a Senha no navegador ou exibi-la em mensagens e resumos.
- **FR-143**: Cadastro concluído MUST apresentar confirmação e acesso a Entrar, sem acesso automático ao acervo; Cadastro recusado MUST preservar o preenchimento para correção ou nova tentativa enquanto a página estiver aberta.
- **FR-144**: As listas MUST apresentar estados vazios com próximo passo. Cartões MUST mostrar Frente, Verso e Baralhos em que estão vinculados, inclusive ausência de Vínculos. Baralhos MUST ser apresentados em **lista compacta, uma linha por Baralho**: o nome, que é o próprio link para o detalhe, com a quantidade de Cartões logo abaixo, e a ação textual Estudar alinhada à direita. A linha MUST NOT ter rótulo de tipo, linha de status nem botão separado de detalhe. Sem Cartões, Estudar MUST ficar indisponível com o motivo exposto de forma acessível (descrição associada), sem depender de cor. Nomes longos quebram linha sem rolagem horizontal; nome e Estudar mantêm alvo de 44 × 44 px. *(Revisado em 2026-10-02 a pedido do Product Owner: o cartão alto mostrava poucos Baralhos por tela.)*
- **FR-145**: O detalhe do Baralho MUST reunir no topo da página, logo abaixo do título e **antes** da lista de Cartões, todas as ações sobre o Baralho: Estudar este Baralho (ação principal), Adicionar cartões existentes, Renomear e Excluir Baralho. Essas ações MUST estar alcançáveis sem rolar a lista, qualquer que seja a quantidade de Cartões, nas larguras de 360 a 1440 px, e MUST vir antes dos Cartões na ordem de leitura e de Tab. Excluir Baralho mantém a aparência de ação perigosa e a confirmação (FR-147). Remover deste baralho continua junto de cada Cartão, por agir sobre um Vínculo e não sobre o Baralho. A seleção de existentes MUST excluir os já vinculados e explicar ausência de opções. *(Revisado em 2026-10-02 a pedido do Product Owner: as ações ficavam no fim da página e exigiam rolar a lista inteira.)*
- **FR-146**: Editar Cartão MUST informar quais e quantos Baralhos o utilizam e que a alteração afeta todos eles; as telas afetadas MUST refletir a alteração confirmada, preservando as regras de Sessão já iniciada.
- **FR-147**: Remover deste baralho MUST desfazer somente o Vínculo e MUST NOT exigir confirmação, conforme FR-066. Excluir Cartão e excluir Baralho MUST exigir confirmação com alvo e consequências explícitas; cancelar MUST preservar o acervo.
- **FR-148**: Sair de Cadastro, criação ou edição de acervo ou configuração de estudo com alterações efetivas não salvas MUST pedir confirmação. Cancelar MUST preservar os campos; confirmar MUST descartar o preenchimento não salvo. Restaurar os valores originais MUST eliminar a confirmação. Recusa de Credencial segue FR-157.
- **FR-149**: A configuração de estudo MUST permitir quantidade inteira positiva, recusar valores inválidos, explicar Baralho vazio e, para quantidade superior à disponível, avisar antes do primeiro Item que todos os disponíveis serão usados, conforme FR-029.
- **FR-150**: A Sessão MUST manter Frente visível e Verso oculto até Revelar verso; MUST mostrar posição e total, permitir Acertei/Errei somente após Revelação e avançar uma única vez por Resultado, preservando seleção aleatória sem repetição e conteúdo capturado no início.
- **FR-151**: Navegar para fora de uma Sessão em andamento, interrompê-la ou Sair MUST pedir confirmação de descarte integral sem Resumo. Cancelar MUST manter o estado exato da Sessão; confirmar MUST descartá-la. Para fechar/recarregar, MUST solicitar a proteção nativa disponível, sem persistir a Sessão ou garantir impedir a saída.
- **FR-152**: Somente ao concluir todos os Itens, o Resumo MUST informar estudados, acertos, erros e percentual de acertos arredondado ao inteiro mais próximo, calculado como acertos divididos por estudados × 100; MUST oferecer estudar novamente e voltar ao Baralho, sem persistir resultados.
- **FR-153**: A interface MUST distinguir carregamento, vazio, erro, operação pendente e sucesso. Falha de carregamento MUST oferecer nova tentativa; nenhum aviso de operação anterior MUST ser confundido com resultado da tela atual.
- **FR-154**: Enquanto uma operação estiver pendente, a interface MUST informar andamento, impedir reenvio equivalente e impedir navegação interna que abandone a operação, explicando o motivo; MUST liberar as ações quando houver conclusão ou falha. Não se promete impedir fechamento forçado do navegador.
- **FR-155**: Falhas em operações persistentes MUST preservar preenchimento ou conteúdo exibido, permitir nova tentativa e MUST NOT antecipar sucesso. Operação confirmada MUST atualizar contagens, Vínculos e elegibilidade nas telas pertinentes.
- **FR-156**: Recurso inexistente, excluído ou de outro Usuário MUST apresentar a mesma mensagem de recurso não encontrado, sem revelar informação protegida, com acesso de volta ao acervo autorizado.
- **FR-157**: Recusa de Credencial MUST descartar a Credencial e voltar a Entrar com explicação, sem sucesso e sem diálogo que permita permanecer no acervo. Essa regra prevalece sobre descarte de formulário e de Sessão.
- **FR-158**: Todas as ações MUST ser executáveis por teclado, com foco visível e nomes acessíveis; mensagens, erros e progresso MUST ser perceptíveis por leitor de tela e MUST NOT depender apenas de cor. Navegação e avanço de Item MUST levar o foco ao novo conteúdo pertinente.
- **FR-159**: Diálogos MUST ter título e descrição das consequências, iniciar com foco em Cancelar, conter a navegação por Tab/Shift+Tab, tratar Escape como cancelamento e devolver o foco ao acionador ao cancelar. Após confirmar, MUST levar o foco ao resultado ou a um destino estável se o acionador deixou de existir.
- **FR-160**: A experiência de produção MUST usar o acervo real do Usuário e MUST NOT incorporar dados de exemplo, atrasos/erros artificiais, galeria de revisão, reinício da demonstração, seletor de cor ou Explorações futuras. Esses artefatos MUST permanecer preservados e identificados na área de design.

### Key Entities

Não há novas entidades nem alteração do glossário:

- **Usuário e Credencial**: identificam quem acessa o próprio acervo, conforme `007` e `008`.
- **Cartão, Frente e Verso**: conteúdo independente de seus Vínculos com Baralhos.
- **Baralho e Vínculo**: agrupamento e ligação entre Cartão e Baralho; remover Vínculo não exclui nenhuma das entidades.
- **Sessão de estudo, Item de estudo, Revelação, Resultado do item e Resumo da sessão**: permanecem transitórios, conforme `004`.

Formulário alterado, carregamento e diálogo são estados de interação, não novos conceitos do domínio ou dados persistidos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

Numeração continua após SC-061 de `011`.

- **SC-062**: O percurso Entrar → criar Baralho → criar Cartão → vincular → estudar → concluir pode ser completado nas quatro larguras previstas e inteiramente por teclado, sem ação inacessível ou erro que impeça conclusão.
- **SC-063**: Em todas as telas do inventário, nas quatro larguras e em zoom nativo de 200%, todo conteúdo e ação permanece alcançável, sem rolagem horizontal da página ou sobreposição impeditiva, inclusive com texto no limite e acervo de 60 Cartões e 20 Baralhos.
- **SC-064**: Em 100% dos cenários de descarte e interrupção, cancelar mantém campos/progresso; confirmar descarta somente o conteúdo transitório previsto, sem modificar acervo persistido.
- **SC-065**: Em 100% dos cenários de falha e reenvio, não há falso sucesso nem segundo envio equivalente durante pendência; o preenchimento é preservado quando o acesso continua autorizado e a nova tentativa conclui quando a falha cessa.
- **SC-066**: Nos cenários de Cartão em dois Baralhos, edição aparece em ambos; remoção de Vínculo preserva o Cartão e o outro Vínculo; exclusão de Baralho preserva todos os Cartões; exclusão de Cartão preserva todos os Baralhos.
- **SC-067**: Para Sessões de 1 e 3 Itens, incluindo todos os acertos, todos os erros e dois acertos em três, as contagens sempre somam o total e os percentuais são 100% para todos os acertos, 0% para todos os erros e 67% para dois acertos em três; interrupção nunca apresenta Resumo.
- **SC-068**: Todos os campos, ações, mensagens e diálogos atendem aos requisitos de teclado, foco, nome acessível e anúncio; a inspeção visual confirma os mínimos de tamanho e contraste do FR-136 em todas as telas.
- **SC-069**: Após Entrar, o destino é Baralhos em todos os casos de sucesso. Depois de Sair, recarregar ou recusar Credencial, nenhum percurso de voltar permite acessar o acervo sem novo Entrar; Usuários distintos nunca veem o acervo um do outro.
- **SC-079**: Em 360 a 1440 px, cada linha da lista de Baralhos cujo nome cabe numa linha mede no máximo 72 px de altura; um nome longo (por exemplo, 40 caracteres em 360 px) quebra em até duas linhas, com a linha medindo no máximo 96 px, sem truncar o nome e sem rolagem horizontal. Em 390 × 844, ao menos 6 Baralhos aparecem inteiros no primeiro viewport.
- **SC-078**: Em 100% das larguras de aceite (360, 390, 768 e 1440 px) e com 0, 1 e 40 Cartões vinculados, as ações Estudar, Adicionar cartões existentes, Renomear e Excluir Baralho do detalhe ficam no primeiro viewport, sem rolagem, e precedem os Cartões na ordem de Tab.
- **SC-070**: Nenhuma tela do aplicativo oferece controles ou dados de demonstração ou Explorações futuras. Os artefatos de design continuam disponíveis para revisão separados do uso real.

## Inventário de telas e estados para aceite

| Área | Cobertura exigida |
| --- | --- |
| Entrar | Inicial, Senha mascarada/visível, preenchimento inválido, Credencial recusada, indisponibilidade, envio pendente, nova tentativa |
| Cadastro | Inicial, orientações, validação, envio, falha, sucesso, voltar a Entrar, descarte |
| Baralhos | Lista, vazio, carregamento/falha, criação, detalhe, renomear, adicionar existentes, sem opções, exclusão |
| Cartões | Lista, vazio, criação, edição compartilhada, validação, falha, pendência, descarte, exclusão |
| Estudo | Configuração, quantidade inválida/excedente, Baralho vazio, Frente sem Verso, Verso revelado, Resultado, avanço, interrupção e Resumo |
| Transversais | Recurso ausente, acesso recusado, diálogo cancelado/confirmado, teclado/foco, conteúdo extenso, ampliação |

## Compatibilidade, decisões e limites

| Tema | Relação com a referência e as specs anteriores |
| --- | --- |
| Destino após Entrar | FR-138 fixa Baralhos. `008` exige os destinos Cartões/Baralhos, sem fixar a tela inicial no cenário de aceite. |
| Linguagem | FR-046 prevalece sobre rótulos incidentais do protótipo: usar Frente, Verso e Revelar verso; Acertei/Errei exprimem a declaração do Resultado. Criar conta é o rótulo já autorizado pelo glossário. |
| Senha visível | FR-142 explicita uma exceção de apresentação à leitura ampla de “MUST NOT exibi-la de volta” do FR-078: somente conteúdo digitado no campo atual pode ser mostrado por ação da pessoa; nenhuma leitura recupera Senha armazenada. A adoção deste refinamento integra a revisão desta spec. |
| Descarte | FR-148 amplia a proteção de edição do FR-050 para Cadastro, criação do acervo e configuração modificada. |
| Interrupção | FR-151 acrescenta confirmação antes da interrupção voluntária; FR-039 continua exigindo descarte integral quando a interrupção efetivamente acontece. |
| Resumo | FR-152 acrescenta percentual ao Resumo básico do FR-037; detalhamento por Cartão e histórico continuam fora do produto. |
| Persistência | O reinício dos exemplos do protótipo não é comportamento do aplicativo. Usuários e acervo persistem; Credencial e Sessão de estudo continuam transitórias. |
| Verde, galeria e explorações | Permanecem referências de design, sem novos destinos ou preferências no aplicativo. |

**Fora do escopo**: histórico persistente, estatísticas acumuladas, repetição espaçada, resumo detalhado por Cartão, retomada de Sessão, correção automática, novos métodos de acesso, recuperação de Senha, compartilhamento entre Usuários, alteração dos contratos existentes e publicação em produção.

## Assumptions

- O pedido se refere a especificar a adoção da experiência no aplicativo real, dando continuidade ao protótipo já entregue; esta etapa não autoriza codificação.
- Os fluxos e a identidade do plano anterior são a referência de intenção; detalhes visuais podem ser ajustados para atender ao glossário e à acessibilidade.
- **Confirmado no clarify (2026-10-02)**: o limite de 600 px distingue a disposição móvel e a de telas maiores, como na referência, sem limitar o uso de tablets.
- **Confirmado no clarify (2026-10-02)**: o percentual é arredondado ao inteiro mais próximo, sem casas decimais.
- **Confirmado no clarify (2026-10-02)**: a confirmação de descarte cobre Cadastro e configuração modificada de estudo; Entrar não pede confirmação ao abandonar o preenchimento.
- Não se altera `CONTEXT.md`: nenhum novo conceito ou sinônimo canônico foi aprovado. Não se reescrevem requisitos históricos; os refinamentos propostos estão identificados acima.
- Os limites de conteúdo, regras de validação, isolamento, integridade e persistência das features anteriores são dependências obrigatórias. A aparência nova não é justificativa para relaxá-los.
- O planejamento técnico e a rastreabilidade requisito–teste em tarefas pertencem às etapas seguintes do Spec Kit, após revisão desta especificação.
