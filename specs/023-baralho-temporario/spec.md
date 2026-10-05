# Feature Specification: Baralho temporário para um estudo

**Created**: 2026-10-05
**Status**: Implementada (2026-10-05), seguindo os protótipos de `design/baralho-temporario/` com os esclarecimentos da sessão de 2026-10-05.
**Input**: Permitir reunir vários Baralhos e Cartões individuais para um estudo e, ao final, salvar a seleção como um Baralho, se o Usuário desejar. Estudar é o fluxo único de exercício e revisão; o Usuário escolhe o conteúdo e pode estudá-lo novamente quando quiser.
**Depende de**: `002-criar-baralho`, `003-vincular-cartao-baralho`, `004-sessao-de-estudo`, `012-interface-visual-navegavel`, `013-estatisticas-e-historico`, `015-repeticao-espacada`, `021-consistencia-baralhos-cartoes` e `022-busca-e-filtros-no-acervo`.

## Objetivo e escopo

Permitir estudar uma combinação escolhida explicitamente pelo Usuário sem exigir a criação prévia de um Baralho permanente. Ao concluir a Sessão, o Usuário pode transformar essa seleção em um novo Baralho com um nome.

A entrega inicial continha apenas especificação, registro de decisões, checklist e representação das telas. Em 2026-10-05 o Usuário autorizou a implementação integral, seguindo os protótipos navegáveis (ver `research.md` e `prototipos.md`).

O fluxo não escolhe assuntos automaticamente. A situação da revisão serve como filtro opcional para encontrar conteúdo; não impede estudar Cartões novos, pendentes ou em dia. O estudo existente por Baralho continua disponível.

## Clarifications

### Decisões confirmadas na conversa

- O Usuário pode combinar vários Baralhos e Cartões individuais para um estudo.
- Ao final, salvar o Baralho é opcional.
- O Usuário escolhe o conteúdo e pode estudá-lo quantas vezes quiser.
- Revisão pendente é filtro opcional, sem seleção automática global.
- **Quantidade**: estudar todos os Cartões selecionados, sem campo para quantidade.
- **Ordem**: todos os Cartões são embaralhados juntos, sem agrupamento por Baralho de origem.
- **Entrada**: botão Criar baralho temporário na tela Baralhos, ao lado de Criar Baralho, no estilo secundário escuro existente.

### Session 2026-10-05

- Q: A montagem deve ter o link «← Voltar para Baralhos» do protótipo? → A: Não. Segue o padrão vigente da interface, sem links de voltar; sai-se pela navegação principal ou por Cancelar, com a confirmação de descarte.
- Q: Como o Resumo apresenta a origem «Estudo com baralho temporário»? → A: Como texto secundário logo abaixo de «Sessão concluída», sem estilo de sobretítulo, como o nome do Baralho no Registro.
- Q: A confirmação «Sessão registrada no histórico.» fica visível no Resumo temporário? → A: Não. É só anunciada ao leitor de tela, como no Resumo vigente; enquanto o registro está pendente, Salvar como baralho fica indisponível com o motivo visível, e a falha mostra a mensagem com Tentar registrar novamente.

## User Scenarios & Testing

### User Story 1 — Montar um estudo com conteúdo escolhido (Priority: P1)

Como Usuário, quero reunir Baralhos e Cartões específicos e conferir o conjunto antes de estudar.

**Independent Test**: adicionar dois Baralhos que compartilham um Cartão, acrescentar um Cartão sem Baralho e conferir a seleção única resultante.

**Acceptance Scenarios**:

1. **Given** a página Baralhos, **When** o Usuário aciona Criar baralho temporário ao lado de Criar Baralho, **Then** abre uma seleção vazia, sem criar um Baralho no acervo; o novo botão usa o estilo secundário escuro existente.
2. **Given** um Baralho A com C1/C2 e um Baralho B com C2/C3, **When** ambos são adicionados, **Then** a seleção contém C1, C2 e C3 uma única vez.
3. **Given** uma seleção com Baralhos, **When** o Usuário adiciona um Cartão individual sem Vínculos, **Then** ele participa da seleção normalmente.
4. **Given** um Cartão individual já vinculado a algum Baralho, **When** o Usuário o adiciona, **Then** ele também pode participar; “individual” não restringe a Cartões sem Baralho.
5. **Given** filtros ou busca ativos, **When** os critérios são alterados ou limpos, **Then** o conjunto já selecionado não muda.
6. **Given** uma seleção preenchida, **When** o Usuário remove um Cartão, **Then** ele deixa somente a seleção, sem exclusão ou alteração de Vínculos no acervo.
7. **Given** seleção vazia, **When** o Usuário tenta iniciar, **Then** o início é impedido com orientação para adicionar conteúdo.

### User Story 2 — Estudar a seleção e registrar o resultado (Priority: P1)

Como Usuário, quero estudar o conjunto que conferi, usando a mesma Revelação e Avaliação das demais Sessões.

**Independent Test**: estudar uma seleção de três Cartões, avaliar todos e verificar um único Registro de sessão, Estatísticas e Agendamentos correspondentes.

**Acceptance Scenarios**:

1. **Given** três Cartões selecionados e disponíveis, **When** Estudar é acionado, **Then** os três participam uma única vez, sem solicitar uma quantidade.
2. **Given** Cartões de dois Baralhos e Cartões individuais, **When** o estudo começa, **Then** todos são embaralhados juntos, sem blocos por origem, e a ordem permanece fixa durante a Sessão.
3. **Given** um Item com Verso oculto, **When** o Usuário revela, **Then** pode avaliar com Errei, Difícil, Bom ou Fácil e consultar as prévias existentes da próxima revisão.
4. **Given** uma Sessão concluída, **When** seu registro é confirmado, **Then** aparece no Histórico como Estudo com baralho temporário e participa das Estatísticas e dos Agendamentos, mesmo sem salvar um Baralho.
5. **Given** falha ao registrar a conclusão, **When** o Usuário tenta novamente, **Then** o Resumo permanece disponível e não há Registro ou Avaliação duplicados.
6. **Given** uma Sessão interrompida, **When** o descarte é confirmado, **Then** não se cria Registro, não se atualizam Agendamentos e não se cria Baralho.

### User Story 3 — Salvar a seleção depois de estudar (Priority: P1)

Como Usuário, quero salvar uma seleção de que gostei para estudá-la novamente como um Baralho comum.

**Independent Test**: concluir a Sessão, salvar com nome válido e verificar um novo Baralho com os mesmos Cartões, sem duplicar Cartões ou modificar os Baralhos de origem.

**Acceptance Scenarios**:

1. **Given** uma Sessão concluída e registrada, **When** Salvar como baralho é acionado, **Then** o Usuário informa um nome e vê quantos Cartões serão vinculados.
2. **Given** nome válido e Cartões existentes, **When** o salvamento é confirmado, **Then** um único novo Baralho aparece no acervo com os Cartões da seleção estudada, preservando seus Vínculos anteriores e Agendamentos.
3. **Given** nome vazio ou acima de 100 caracteres, **When** o Usuário tenta salvar, **Then** a operação é recusada, o conteúdo digitado permanece e o campo a corrigir recebe foco.
4. **Given** um nome já utilizado, **When** o Usuário salva, **Then** um novo Baralho é criado, sem substituir ou mesclar o existente.
5. **Given** falha ou resposta perdida durante o salvamento, **When** o Usuário tenta novamente, **Then** a mesma tentativa não cria Baralhos duplicados nem deixa um Baralho parcialmente preenchido.
6. **Given** um Resumo registrado, **When** o Usuário sai sem salvar o Baralho, **Then** o Histórico permanece e nenhum Baralho temporário aparece na lista de Baralhos.
7. **Given** salvamento bem-sucedido, **When** o Usuário aciona Abrir baralho, **Then** chega ao novo Baralho e pode estudá-lo pelo fluxo existente.

### Edge Cases

- É permitido montar o estudo somente com Cartões individuais, mesmo sem nenhum Baralho no acervo.
- Baralhos vazios comunicam a ausência de Cartões e não acrescentam conteúdo.
- Cartões com a mesma Frente e identidades distintas permanecem distintos.
- Remover ou filtrar conteúdo na montagem não altera o acervo original.
- Mudanças de conteúdo após iniciar não alteram os textos capturados para a Sessão em andamento.
- Cartão excluído antes do início exige correção da seleção, sem iniciar uma Sessão diferente silenciosamente.
- Cartão excluído antes de salvar não é recriado a partir do Histórico: o Usuário deve revisar o conjunto restante.
- Baralho de origem excluído após adicionar seus Cartões não invalida a seleção se os Cartões ainda existem.
- O limite vigente do Registro de sessão é 1.000 Itens; esta versão não inicia uma Sessão que não poderá registrar.

## Requirements

### Functional Requirements

- **FR-360 — Entrada**: a página Baralhos MUST oferecer o botão Criar baralho temporário ao lado de Criar Baralho, com o estilo secundário escuro existente; Criar Baralho mantém o destaque primário. No desktop, a ordem visual e de teclado MUST ser Criar Baralho → Criar baralho temporário. Em telas estreitas, as ações podem quebrar linha, mantendo a ordem e os textos completos. A nova montagem MUST iniciar vazia e MUST NOT criar um Baralho permanente. As ações existentes da listagem permanecem.
- **FR-361 — Fontes**: a montagem MUST permitir adicionar todos os Cartões atuais de um Baralho e adicionar Cartões individualmente, vinculados ou não. Apenas conteúdo do próprio Usuário pode ser consultado, selecionado, estudado ou salvo.
- **FR-362 — Busca e filtros**: a montagem MUST oferecer busca por nome na seleção de Baralhos e por Frente/Verso na seleção individual, reutilizando as regras textuais e os filtros por Baralho e situação da 022. Filtros afetam somente a lista disponível para adicionar; MUST NOT remover ou adicionar automaticamente itens na seleção já montada.
- **FR-363 — Seleção explícita**: a montagem MUST apresentar os Cartões selecionados e a contagem única, permitir removê-los individualmente e limpar a seleção. Adicionar um Baralho copia a composição daquele momento para a seleção; não cria acompanhamento automático dos seus Vínculos. Repetir uma adição acrescenta apenas Cartões ausentes.
- **FR-364 — Unicidade**: o mesmo Cartão MUST ocorrer no máximo uma vez na seleção e na Sessão, independentemente de quantos Baralhos o contenham. O critério é identidade, não conteúdo textual. Nenhuma seleção ou remoção MUST alterar o acervo.
- **FR-365 — Quantidade**: Estudar MUST usar todos os Cartões da seleção conferida, sem campo para escolher quantidade. A seleção MUST conter de 1 a 1.000 Cartões para iniciar; acima do limite, a montagem MUST informar a necessidade de reduzir a seleção, sem truncar silenciosamente. O Usuário pode ajustar a seleção antes de iniciar.
- **FR-366 — Ordem**: todos os Cartões únicos selecionados MUST ser embaralhados juntos, independentemente da origem, em ordem aleatória definida no início e imutável durante a Sessão. A Sessão MUST NOT separar Cartões em blocos por Baralho nem oferecer escolha de ordenação nesta versão.
- **FR-367 — Validação antes do início**: existência e propriedade dos Cartões MUST ser verificadas de forma autoritativa. Caso algum Cartão não esteja mais disponível, o início MUST ser recusado, a seleção preservada e os indisponíveis indicados sem revelar conteúdo alheio. O Usuário revisa a seleção e inicia novamente.
- **FR-368 — Estudo livre**: Cartões novos, pendentes e em dia MUST ser estudáveis. Datas e limite diário de novos MUST NOT bloquear esta Sessão. Revelação, quatro níveis de Avaliação, prévias e acessibilidade da Sessão existente MUST ser preservados. Os textos dos Itens são capturados no início.
- **FR-369 — Conclusão**: a Sessão concluída MUST produzir um único Registro com origem identificável como Estudo com baralho temporário, sem depender de Baralho permanente. MUST participar das Estatísticas e atualizar os Agendamentos dos Cartões existentes pelas regras do estudo livre da 015. Reenvios MUST ser idempotentes e o Registro e os Agendamentos MUST ser gravados juntos.
- **FR-370 — Resumo e recuperação**: o Resumo MUST preservar a apresentação vigente e oferecer Salvar como baralho e Voltar para Baralhos. Salvar MUST ficar indisponível, com motivo acessível, enquanto o Registro não estiver confirmado. Falha de registro MUST preservar o Resumo, permitir nova tentativa e aplicar a proteção de saída existente.
- **FR-371 — Salvamento opcional**: somente uma ação explícita após concluir e registrar MUST permitir salvar a seleção estudada como novo Baralho. O nome MUST obedecer às regras vigentes: não vazio, até 100 caracteres, nomes repetidos permitidos. Cancelar o formulário MUST retornar ao Resumo sem criar Baralho.
- **FR-372 — Preservação do acervo**: salvar MUST criar Vínculos com os Cartões existentes, sem duplicá-los, alterar seus conteúdos, Vínculos anteriores ou Agendamentos. O novo Baralho MUST ser independente dos Baralhos de origem: mudanças futuras de composição nas fontes não propagam para ele. A ordem da Sessão temporária não se torna propriedade do Baralho salvo.
- **FR-373 — Integridade do salvamento**: criar o Baralho e todos os seus Vínculos MUST constituir um único resultado completo. Falha MUST preservar nome e seleção; nova tentativa, duplo acionamento ou resposta perdida MUST NOT duplicar o Baralho. Sucesso confirmado MUST substituir a ação de salvar por Abrir baralho.
- **FR-374 — Cartões removidos antes de salvar**: indisponibilidade de algum Cartão MUST bloquear o salvamento e exigir revisão explícita. O Usuário pode retirar os indisponíveis e confirmar novamente a contagem, sem alterar o Registro já gravado. Sem Cartões restantes, salvar MUST ficar indisponível. Cartões excluídos MUST NOT ser recriados a partir dos textos da Sessão.
- **FR-375 — Ciclo de vida**: a montagem e a opção de salvar MUST valer somente no percurso atual até sair do Resumo. Não se exige retomada após recarga ou em outro aparelho. Sair da montagem preenchida ou interromper a Sessão MUST solicitar confirmação de descarte. Sessão interrompida MUST NOT gerar Registro, Agendamentos ou Baralho. Após conclusão registrada, sair sem salvar descarta apenas a seleção temporária.
- **FR-376 — Histórico preservado**: salvar um Baralho posteriormente MUST NOT renomear, reclassificar ou reagendar a Sessão já registrada. Seu Histórico MUST continuar identificando estudo temporário e MUST NOT apresentar Baralho excluído somente por não ter havido Baralho permanente. Registros anteriores permanecem válidos.
- **FR-377 — Estados e acessibilidade**: montagem e salvamento MUST distinguir carregamento, falha com nova tentativa, acervo vazio, seleção vazia e ausência de resultados. MUST preservar seleção e campos em falhas recuperáveis; toda ação MUST funcionar por teclado, com foco visível, anúncio das mudanças e alvos de ao menos 44 × 44 px, em 360, 390, 768 e 1440 px e zoom de 200%.

### Key Entities

- **Baralho temporário**: seleção de Cartões do Usuário preparada para uma única Sessão, sem integrar o acervo de Baralhos permanentes. Pode reunir Cartões de vários Baralhos e Cartões escolhidos individualmente. Não exige nome antes do estudo.
- **Cartão avulso na seleção**: Cartão adicionado individualmente à montagem. Pode ter Vínculos no acervo; avulso descreve a forma de inclusão, não a ausência de Baralho.
- **Salvar como baralho**: criar, após a Sessão, um Baralho permanente com nome e Vínculos aos Cartões da seleção estudada ainda disponíveis, mediante confirmação.
- **Sessão de estudo**: mantém Revelação, Avaliação e Resumo, passando a admitir como fonte um Baralho temporário além dos percursos existentes.

## Success Criteria

- **SC-143**: a união de A={C1,C2}, B={C2,C3} e Cartão individual C4 permite estudar quatro Cartões distintos, sem criar Baralho permanente antes da opção de salvar.
- **SC-144**: alterar filtros e remover itens da montagem não altera conteúdos nem Vínculos existentes.
- **SC-145**: concluir gera exatamente um Registro e uma aplicação das Avaliações, mesmo após reenvios; interromper não gera esses efeitos.
- **SC-146**: salvar uma seleção válida cria exatamente um Baralho com todos os Vínculos esperados e nenhum Cartão novo; falha não produz resultado parcial.
- **SC-147**: sair sem salvar mantém o Histórico confirmado e não deixa Baralho temporário no acervo.
- **SC-148**: os percursos de montagem, estudo e salvamento são executáveis por teclado e nas dimensões previstas, com mensagens e foco acessíveis.
- **SC-149**: Cartão indisponível antes do início ou salvamento impede alteração silenciosa do conjunto e nunca provoca recriação ou exposição de dados de outro Usuário.

## Assumptions e limites da proposta

- Quantidade e ordem foram confirmadas: todos os selecionados, embaralhados juntos.
- A entrada Criar baralho temporário fica em Baralhos, ao lado de Criar Baralho, sem novo destino na navegação principal.
- O salvamento usa a seleção estudada, não uma referência dinâmica aos Baralhos de origem. Não inclui salvar somente acertos ou erros.
- O filtro Revisão pendente no seletor individual ajuda a localizar conteúdo; adicionar um Baralho inclui todos os seus Cartões atuais. Antes de iniciar, a seleção completa é conferível e ajustável.
- Uma Sessão temporária não conclui Compromissos da Agenda automaticamente.
- Não há retomada, compartilhamento, exportação, edição em lote, criação de Cartões no montador, salvamento antes do estudo ou salvamento posterior a partir do Histórico.
- O limite de 1.000 Itens preserva a capacidade vigente de registro; seu aumento não pertence a esta especificação.
- APIs, tipos, persistência e migrações são definidos em `plan.md` e `contracts/`.

## Revisão append-only de requisitos anteriores

Esta spec amplia FR-025 e a definição de Sessão da 004 para admitir a seleção temporária sem Baralho permanente. FR-030 permanece aplicável: todos os Cartões são embaralhados juntos e a ordem é fixada no início. FR-027 não se aplica à Sessão temporária: nela, estudam-se todos os selecionados, sem escolher quantidade; o estudo comum por Baralho preserva sua configuração existente.

O limite de fonte única deixa de se aplicar à Sessão temporária. As garantias de unicidade, Revelação e interrupção da 004, de Histórico da 013 e de Avaliação/Agendamento da 015 continuam vigentes, com a origem temporária definida aqui. O novo salvamento reúne criação e Vínculos num gesto explícito; amplia apenas nesse percurso a separação de operações descrita na 003.

A spec 022 permanece restrita às listas principais; esta spec reutiliza suas regras de busca em uma nova montagem. Nenhum requisito reintroduz a mistura automática global de conteúdo. As especificações anteriores permanecem intactas.
