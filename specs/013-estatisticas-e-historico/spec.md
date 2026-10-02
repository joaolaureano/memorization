# Feature Specification: Estatísticas e Histórico de estudo

**Feature Branch**: `012-interface-visual-navegavel` (a 013 é construída na mesma branch, por decisão do Product Owner)

**Created**: 2026-10-02

**Status**: Draft

**Input**: "A primeira tela pode ser de estatísticas. No Resumo, acerto/erro podem ser botões que listam o que acertou/errou." Depois: "Aquilo era válido pois era um POC. Agora vamos construir algo concreto e para usuários de fato. Vamos ter mais funcionalidades, persistência, etc."

**Depende de**: `001` a `012`. Usa o visual, a navegação e os componentes da `012` e a persistência por Usuário de `008` a `010`.

## Objetivo e escopo

O Memorization deixa de ser POC. A Sessão de estudo **concluída** passa a ser lembrada como **Registro de sessão** (veja `CONTEXT.md`), e o conjunto desses registros forma o **Histórico de estudo** de cada Usuário. A partir dele:

- **Início**, a nova primeira tela depois de Entrar, apresenta as **Estatísticas**: tamanho do acervo, ritmo de estudo dos últimos 7 dias, Taxa de acerto e as últimas Sessões.
- O **Resumo da sessão** ganha os botões **Acertos** e **Erros**, que mostram quais Cartões foram acertados e quais foram errados. Isso vale tanto ao concluir uma Sessão quanto ao abrir um registro antigo.

A Sessão **interrompida** continua sendo descartada sem rastro (FR-039 mantido). O registro guarda o Resultado de cada Item, com a Frente, o Verso e o nome do Baralho como eram ao concluir. Essa decisão do Product Owner prepara funcionalidades futuras, como repetição espaçada e "Cartões que você mais erra", sem incluí-las agora.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Concluir uma Sessão e vê-la lembrada (Priority: P1)

A pessoa conclui uma Sessão de estudo. O Resumo aparece como hoje, e a Sessão fica registrada no seu Histórico, mesmo depois de Sair, recarregar ou trocar de aparelho.

**Why this priority**: sem o registro não há Estatísticas nem histórico. É a base da feature.

**Independent Test**: concluir uma Sessão de 3 Itens, Sair, Entrar de novo em outro navegador e encontrar a Sessão em Início com o percentual correto.

**Acceptance Scenarios**:

1. **Given** uma Sessão em andamento, **When** o último Resultado é declarado, **Then** o Resumo é exibido e a Sessão é registrada com data e hora de conclusão, Baralho, Itens estudados, acertos, erros e o Resultado de cada Item.
2. **Given** uma Sessão em andamento, **When** a pessoa a interrompe (confirmando), recarrega a página, Sai ou tem a Credencial recusada, **Then** nada é registrado.
3. **Given** a conclusão de uma Sessão, **When** o registro falha por indisponibilidade, **Then** o Resumo continua visível, a falha é explicada e existe "Tentar registrar novamente". Sair da tela sem registrar pede confirmação, e nada é apresentado como registrado sem ter sido.
4. **Given** dois Usuários, **When** cada um conclui Sessões, **Then** cada um vê somente o próprio Histórico.

---

### User Story 2 - Ver as Estatísticas em Início (Priority: P1)

Depois de Entrar, a pessoa chega em Início e vê, de relance, o tamanho do acervo e como tem estudado.

**Why this priority**: é a nova primeira tela pedida pelo Product Owner.

**Independent Test**: com um acervo de 16 Cartões e 3 Baralhos, e Sessões em dias distintos dos últimos 7 dias, Início mostra os números e o gráfico que correspondem aos registros.

**Acceptance Scenarios**:

1. **Given** Credencial válida, **When** Entrar conclui, **Then** a tela é Início, com saudação pelo Nome de usuário.
2. **Given** o acervo e o Histórico, **When** Início abre, **Then** mostra: quantidade de Cartões; quantidade de Baralhos; Sessões concluídas nos últimos 7 dias; Taxa de acerto dos últimos 7 dias; Itens estudados por dia nos últimos 7 dias, com hoje incluído; e as 5 Sessões mais recentes, com Baralho, data e percentual.
3. **Given** nenhuma Sessão registrada, **When** Início abre, **Then** os números do acervo aparecem, a Taxa de acerto aparece como "—" (sem dados, nunca 0%), e há um próximo passo que leva a Baralhos para estudar.
4. **Given** o gráfico de 7 dias, **When** lido por leitor de tela ou sem cor, **Then** cada dia tem rótulo e valor em texto. O gráfico nunca é a única forma de obter os números.

---

### User Story 3 - Saber o que acertou e o que errou (Priority: P2)

No Resumo, a pessoa usa os botões Acertos e Erros para ver a lista dos Cartões de cada grupo, com Frente e Verso.

**Why this priority**: torna o Resumo acionável. Pedido explícito do Product Owner.

**Independent Test**: numa Sessão de 3 Itens com 2 acertos e 1 erro, "Erros (1)" mostra a Frente e o Verso do Cartão errado, e "Acertos (2)" mostra os outros dois.

**Acceptance Scenarios**:

1. **Given** o Resumo, **When** a pessoa aciona "Erros", **Then** a lista dos Itens errados é mostrada com Frente e Verso. O botão indica o estado expandido (`aria-expanded`) e mostra a contagem no próprio rótulo.
2. **Given** uma lista aberta, **When** a pessoa aciona o mesmo botão, **Then** a lista se recolhe. Os dois botões funcionam de forma independente.
3. **Given** um grupo vazio (por exemplo, 0 erros), **When** o Resumo abre, **Then** o botão fica indisponível com a explicação "Nenhum erro nesta Sessão".
4. A seção "Itens estudados" (ladrilho de estudados) é removida do Resumo, porque o total continua dito no texto do percentual ("2 de 3 Itens"). Os ladrilhos Acertos e Erros passam a ser os botões.

---

### User Story 4 - Rever uma Sessão antiga (Priority: P2)

Em Início, a pessoa abre uma das últimas Sessões e vê o Resumo dela, com as listas de acertos e erros.

**Why this priority**: dá uso ao Histórico além dos números.

**Independent Test**: depois de editar a Frente de um Cartão e excluir o Baralho, o registro antigo ainda mostra a Frente e o nome do Baralho como eram.

**Acceptance Scenarios**:

1. **Given** Início com Sessões recentes, **When** a pessoa abre uma, **Then** vê o Resumo daquele registro: Baralho, data e hora, percentual, contagens e os botões Acertos/Erros.
2. **Given** um registro cujo Baralho ou Cartões foram editados ou excluídos depois, **When** ele é aberto, **Then** mostra os textos e o nome como eram ao concluir. Se o Baralho foi excluído, isso é indicado ("Baralho excluído").
3. **Given** o id de um registro inexistente ou de outro Usuário, **When** aberto, **Then** aparece a mensagem única de recurso não encontrado, com volta a Início (FR-156).

### Edge Cases

- **Sessão concluída à meia-noite:** conta no dia em que foi concluída, pelo fuso horário do navegador.
- **Muitas Sessões no mesmo dia:** o gráfico soma os Itens estudados. Barras e rótulos continuam legíveis em 360 px.
- **Excluir um Cartão:** o registro de Sessão fica intacto. O Cartão continua contando nos números do acervo só enquanto existir.
- **Dois navegadores concluindo ao mesmo tempo:** cada conclusão gera exatamente um registro. Reenviar o mesmo registro após falha nunca o duplica.
- **Sessão de 1 Item:** o percentual é 100% ou 0%, e uma das listas fica vazia e indisponível.
- **Conteúdo extenso:** Frentes e Versos longos nas listas quebram sem rolagem horizontal.
- **Histórico grande (centenas de registros):** Início continua respondendo, porque só os 7 dias e os 5 mais recentes são exibidos.

## Requirements *(mandatory)*

### Functional Requirements

**Registro e Histórico**

- **FR-161**: Ao ser declarado o último Resultado de uma Sessão, o sistema MUST registrar a Sessão no Histórico do Usuário. O registro contém o instante de conclusão, o Baralho (identidade e nome naquele momento), Itens estudados, acertos, erros e, para cada Item na ordem apresentada, a Frente, o Verso e o Resultado como eram naquele momento.
- **FR-162**: Sessões interrompidas, descartadas por recarga, por Sair ou por recusa de Credencial MUST NOT gerar registro. FR-039 continua vigente para elas.
- **FR-163**: Cada conclusão MUST gerar no máximo um registro, mesmo com reenvio após falha ou envio repetido. O sistema MUST aceitar o mesmo registro reenviado sem duplicá-lo.
- **FR-164**: Se o registro falhar, o Resumo MUST continuar exibido, a falha MUST ser explicada e MUST haver nova tentativa. Sair dessa tela sem registro concluído MUST pedir confirmação de descarte. O sistema MUST NOT indicar registro sem confirmação de persistência (FR-044).
- **FR-165**: Registros MUST ser imutáveis para o Usuário. Editar ou excluir Cartões e Baralhos MUST NOT alterar registros existentes.
- **FR-166**: O Histórico MUST ser isolado por Usuário, com as mesmas garantias de `008`. Registros de outro Usuário se comportam como inexistentes.
- **FR-167**: O registro MUST persistir em todos os armazenamentos suportados (SQLite local e PostgreSQL), com migração que preserva os dados existentes.

**Início e Estatísticas**

- **FR-168**: Após Entrar com sucesso, o destino MUST ser Início (substitui o destino Baralhos do FR-138). A navegação principal MUST oferecer Início, Baralhos e Cartões, nessa ordem, mais Sair. Hash desconhecido com Credencial resolve em Início.
- **FR-169**: Início MUST apresentar saudação com o Nome de usuário e: quantidade de Cartões; quantidade de Baralhos; Sessões concluídas nos últimos 7 dias; Taxa de acerto dos últimos 7 dias; Itens estudados por dia nos últimos 7 dias (hoje e os 6 dias anteriores, no fuso do navegador); e as 5 Sessões concluídas mais recentes, com nome do Baralho, data e hora e percentual.
- **FR-170**: A Taxa de acerto MUST ser calculada como soma dos acertos ÷ soma dos Itens estudados, em percentual inteiro arredondado. Sem Itens estudados no período, MUST aparecer "—" com explicação, nunca 0%.
- **FR-171**: O gráfico de 7 dias MUST ter rótulo de cada dia e valor em texto acessível. Os mesmos números MUST estar disponíveis sem depender de cor, forma ou posição (FR-158).
- **FR-172**: Sem nenhum registro, Início MUST mostrar os números do acervo e um estado vazio com próximo passo para Baralhos. Com o acervo vazio, MUST orientar a criar o primeiro Cartão.
- **FR-173**: Início MUST distinguir carregamento, falha com nova tentativa e sucesso (FR-153). Uma falha nas Estatísticas MUST NOT impedir a navegação para Baralhos e Cartões.

**Resumo detalhado**

- **FR-174**: O Resumo (da Sessão recém-concluída e de um registro aberto) MUST oferecer os botões "Acertos (n)" e "Erros (n)". Cada um expande e recolhe a lista dos Itens do grupo, com Frente e Verso, e expõe o estado por `aria-expanded`/`aria-controls`. Os botões são independentes, e ambos começam recolhidos.
- **FR-175**: Um grupo vazio MUST deixar o botão indisponível, com a explicação ("Nenhum acerto nesta Sessão" / "Nenhum erro nesta Sessão").
- **FR-176**: O Resumo MUST apresentar o percentual (FR-152) e o total no texto ("2 de 3 Itens"). O ladrilho separado "Itens estudados" MUST ser removido.

**Rever registro**

- **FR-177**: Cada Sessão recente em Início MUST levar ao Resumo daquele registro (rota própria), com Baralho, data e hora, percentual, contagens e o Resumo detalhado.
- **FR-178**: O Resumo de um registro MUST mostrar os textos guardados no registro. Se o Baralho não existe mais, MUST indicar "Baralho excluído". Se ainda existe, MUST oferecer o acesso a ele.
- **FR-179**: Registro inexistente ou de outro Usuário MUST mostrar a mensagem única de recurso não encontrado, com volta a Início (FR-156).

**Transversais reutilizados**: FR-042, FR-044, FR-045, FR-046, FR-135–FR-137, FR-153–FR-159 (`012`) valem para todas as telas novas.

### Key Entities

- **Registro de sessão**: instante de conclusão; Baralho (identidade e nome no momento); totais (estudados, acertos, erros); Itens na ordem, cada um com Frente, Verso e Resultado no momento. Pertence a um Usuário e é imutável.
- **Histórico de estudo**: os registros de um Usuário, do mais recente ao mais antigo.
- **Estatísticas**: valores derivados do acervo atual e do Histórico. Não são armazenados como verdade própria.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-071**: Em 100% das conclusões, inclusive com falha seguida de nova tentativa, o Histórico contém exatamente um registro por Sessão concluída. Nenhuma Sessão interrompida gera registro.
- **SC-072**: Os números de Início conferem com os registros em todos os cenários de teste: 0 registros; 1 registro; vários no mesmo dia; registros nos 7 dias; registros fora da janela; Sessão concluída perto da meia-noite.
- **SC-073**: Para Sessões de 1 e 3 Itens (todos acertos, todos erros, 2 de 3), as listas de Acertos e Erros contêm exatamente os Cartões de cada grupo, e as contagens dos botões somam o total.
- **SC-074**: Depois de editar e excluir Cartões e o Baralho de uma Sessão registrada, o registro aberto mostra os textos e o nome originais em 100% dos casos.
- **SC-075**: Um Usuário nunca vê, conta ou abre registros de outro (prova com dois Usuários em navegadores distintos).
- **SC-076**: As telas novas atendem SC-062/063/068 da `012`: percurso por teclado, larguras de 360 a 1440 px, zoom de 200%, alvos de 44 px e contraste.
- **SC-077**: Início abre com Estatísticas visíveis em até 1 s num Histórico de 500 registros, no ambiente local de testes.

## Compatibilidade com specs anteriores

| Tema | Mudança |
| --- | --- |
| Transitoriedade da Sessão (`004`, FR-038/FR-039, `CONTEXT.md`) | A Sessão **concluída** passa a ser registrada (FR-161). A interrompida continua descartada (FR-162). Glossário atualizado: Registro de sessão, Histórico de estudo, Taxa de acerto, Estatísticas. |
| Destino após Entrar (`012`, FR-138) | Passa a ser Início (FR-168). |
| Navegação (`012`, FR-139) | Ganha Início como primeiro destino. A disposição até 600 px continua igual, agora com 3 destinos na barra inferior. |
| Resumo (`004` FR-037, `012` FR-152) | Ganha o detalhe por grupo (FR-174). O ladrilho "Itens estudados" sai (FR-176). |
| Fora do escopo do produto (`012`) | "Estatísticas acumuladas", "histórico persistente" e "resumo detalhado por Cartão" saem do fora de escopo e entram nesta feature. |

**Fora do escopo**:
- repetição espaçada;
- "Cartões que você mais erra";
- filtros e paginação do Histórico completo;
- exportação;
- metas e lembretes;
- exclusão de registros pelo Usuário;
- retomada de Sessão interrompida.

## Assumptions

- O Product Owner decidiu guardar o Resultado por Item (e não só os totais) para habilitar funcionalidades futuras.
- O fuso horário do navegador define o "dia" no gráfico e nos "últimos 7 dias". O registro guarda o instante absoluto.
- "Últimos 7 dias" = hoje e os 6 dias anteriores, inteiros.
- A Taxa de acerto e as Sessões em Início se referem aos últimos 7 dias. Cartões e Baralhos são o total atual do acervo.
- A lista de Sessões recentes mostra 5 itens. O Histórico completo, com paginação, fica para depois.
- Registros não podem ser excluídos pelo Usuário nesta feature.
