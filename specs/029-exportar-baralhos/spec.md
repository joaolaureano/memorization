# Feature Specification: Exportar Baralhos

**Feature Branch**: `029-exportar-baralhos`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Vamos especificar Exportação. Vamos suportar apenas .apkg por ora, com abertura para novos formatos."

**Depende de**: `015-repeticao-espacada`, `017-gerenciar-conta-usuario`, `023-baralho-temporario`, `025-criar-cartoes-baralho`, `026-cartao-com-imagem`, `027-idioma-da-interface`, `028-cartao-com-audio` e a importação de pacotes Anki já existente (`#/baralhos/importar`).

## Objetivo e escopo

Permitir que o Usuário leve o próprio acervo para fora da aplicação, num arquivo que ele guarda como cópia de segurança ou abre em outro aplicativo de estudo. Hoje o acervo entra (importação do Anki), mas não sai. A pessoa que investe meses nos Cartões precisa saber que eles não ficam presos ao produto.

Esta feature oferece um único **Formato de exportação**, o **pacote Anki (.apkg)**, que abre no Anki para computador, no AnkiDroid e no AnkiMobile. A escolha de formato é um passo explícito da exportação, para que formatos novos entrem depois como mais uma opção, sem mudar o fluxo nem as regras desta spec.

Estão no escopo: escolher o que exportar, escolher o formato, gerar e baixar o arquivo, e a correspondência de cada Tipo de cartão (Frente-Verso, Imagem, Áudio) com o pacote Anki.

Ficam fora do escopo:
- outros formatos (CSV, JSON, PDF, impressão);
- exportação agendada, automática ou enviada por e-mail;
- compartilhar Baralhos com outros Usuários ou por link público;
- sincronização contínua com o Anki ou outro aplicativo;
- exportar Rotinas de estudo (`016`), estatísticas e o Histórico de Sessões;
- alterar a importação do Anki.

## Clarifications

### Session 2026-10-14

- Q: A unidade de exportação é por Baralho, ou também por Cartões avulsos (busca, filtro, Baralho temporário)? → A: Só Baralhos: um, vários ou todos.
- Q: A Imagem e o Áudio entram no pacote como mídia, ou só os textos? → A: Entram como mídia: no Anki, a Imagem aparece e o Áudio toca.
- Q: O progresso de estudo vai no pacote, ou os Cartões chegam ao Anki como novos? → A: Vai no pacote: o Anki continua de onde o Usuário parou.
- Q (analyze): O endereço de download pode funcionar para quem o tiver durante a validade? → A: Sim. O endereço vale até 15 minutos; depois de baixado, o arquivo é do Usuário e pode ser importado quando ele quiser.
- Q (analyze): Baralhos sem Cartões numa exportação de vários ou de todos? → A: Entram no pacote, vazios.
- Q (analyze): O que acontece com os arquivos de Exportação quando o Usuário exclui a conta? → A: São excluídos com todo o resto. Nada do Usuário fica guardado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exportar um Baralho para o Anki (Priority: P1)

Como Usuário, quero exportar um Baralho como pacote Anki, para estudá-lo no Anki ou guardar uma cópia fora da aplicação.

**Why this priority**: é o valor central da feature. Com um Baralho exportável, o Usuário já tem saída para os próprios dados.

**Independent Test**: no detalhe de um Baralho com Cartões Frente-Verso, exportar como pacote Anki, abrir o arquivo no Anki para computador e confirmar que o Baralho aparece com o mesmo nome e os mesmos Cartões, Frentes, Versos e Tags.

**Acceptance Scenarios**:

1. **Given** o detalhe de um Baralho com Cartões, **When** o Usuário escolhe "Exportar", **Then** vê a escolha de formato com "Pacote Anki (.apkg)" como única opção, já selecionada, e o resumo do que será exportado (nome do Baralho e número de Cartões).
2. **Given** a exportação aberta, **When** o Usuário confirma, **Then** o estado "Gerando arquivo…" é anunciado a leitores de tela e, ao final, o navegador baixa um arquivo `.apkg` cujo nome é derivado do nome do Baralho.
3. **Given** o arquivo baixado, **When** é aberto no Anki para computador, **Then** cria um Baralho com o mesmo nome, contendo um Cartão Anki por Cartão do Baralho, com Frente, Verso e Tags idênticos (os espaços internos das Tags viram `_`, FR-466).
4. **Given** o arquivo baixado, **When** é importado de volta nesta aplicação pela importação do Anki, **Then** os Cartões Frente-Verso voltam com Frente, Verso e Tags equivalentes segundo as regras da importação vigente (espaços em branco normalizados e Tags com `_` no lugar de espaço), para pacotes dentro do limite da importação.
5. **Given** um Baralho sem Cartões, **When** o Usuário abre a exportação, **Then** a confirmação fica indisponível e a mensagem diz que não há Cartões para exportar.
6. **Given** a geração falha ou o serviço está indisponível, **When** o Usuário confirma, **Then** a falha é comunicada no Idioma da interface, nenhum arquivo parcial é baixado e o Usuário pode tentar de novo.
7. **Given** o Usuário navega apenas por teclado, **When** abre a exportação, escolhe o formato e confirma, **Then** completa tudo sem ponteiro e com foco visível.
8. **Given** o Idioma da interface em Inglês ou Espanhol, **When** o Usuário exporta, **Then** rótulos, resumo, anúncios e recusas aparecem nesse idioma. Nomes de Baralhos, Frentes, Versos e Tags vão para o arquivo exatamente como foram escritos.

---

### User Story 2 - Exportar vários Baralhos ou o acervo inteiro (Priority: P1)

Como Usuário, quero exportar vários Baralhos de uma vez, ou todo o meu acervo, num único arquivo, para ter uma cópia de segurança completa sem repetir a exportação Baralho por Baralho.

**Why this priority**: a cópia de segurança completa é o motivo mais comum para exportar, e é o que dá confiança para investir no acervo. Também é o passo natural antes de excluir a conta (`017`).

**Independent Test**: na lista de Baralhos, exportar todos, abrir o arquivo no Anki e confirmar que cada Baralho aparece com seus Cartões.

**Acceptance Scenarios**:

1. **Given** a lista de Baralhos, **When** o Usuário escolhe "Exportar", **Then** pode marcar um ou mais Baralhos ou "Todos os Baralhos", e o resumo mostra quantos Baralhos e Cartões serão exportados.
2. **Given** vários Baralhos marcados, **When** o Usuário confirma, **Then** um único arquivo é baixado e, aberto no Anki, cria um Baralho Anki por Baralho exportado, com os mesmos nomes.
3. **Given** a exclusão de conta no Perfil (`017`), **When** o Usuário a abre, **Then** a tela oferece exportar o acervo antes de excluir, sem obrigar a exportação.
4. **Given** nenhum Baralho marcado, **When** o Usuário tenta confirmar, **Then** a confirmação é recusada e a mensagem pede que marque ao menos um Baralho.

---

### User Story 3 - Exportar Cartões com Imagem e Áudio (Priority: P2)

Como Usuário, quero que meus Cartões com Imagem e com Áudio também sejam exportados, para não perder parte do acervo ao levá-lo para o Anki.

**Why this priority**: os Cartões Frente-Verso já entregam a maior parte do valor, mas uma cópia que perde silenciosamente Cartões de mídia não é confiável.

**Independent Test**: exportar um Baralho com um Cartão de cada tipo, abri-lo no Anki e confirmar que cada Cartão aparece, que a Imagem é exibida e que o Áudio toca.

**Acceptance Scenarios**:

1. **Given** um Baralho com Cartões do tipo Imagem, **When** é exportado, **Then** cada um vira um Cartão Anki com o Texto da frente na Frente e o Verso no Verso, e a Imagem aparece na Frente.
2. **Given** um Baralho com Cartões do tipo Áudio, **When** é exportado, **Then** cada um vira um Cartão Anki com a Mensagem na Frente e o Verso no Verso, e o Áudio pode ser tocado na Frente.
3. **Given** uma exportação com Cartões de mídia, **When** o resumo é mostrado antes de confirmar, **Then** ele informa quantos Cartões têm Imagem ou Áudio e o tamanho aproximado do arquivo.

---

### Edge Cases

- **Nomes repetidos ou com caracteres especiais**: Baralhos com nomes que o Anki trata como hierarquia (`::`) ou caracteres inválidos em nome de arquivo são exportados com o nome intacto dentro do pacote; o Anki mostra um nome com `::` como Baralho aninhado. Só o nome do arquivo baixado é ajustado.
- **Texto com marcação**: Frentes e Versos que contêm `<`, `>` ou `&` aparecem no Anki como texto literal, nunca interpretados como formatação.
- **Quebras de linha**: quebras de linha da Frente e do Verso são preservadas no Anki.
- **Cartões sem Frente textual**: Cartões do tipo Imagem sem Texto da frente e do tipo Áudio sem Mensagem continuam exportados. A Frente Anki tem só a Imagem ou o Áudio. Se a mídia não existir mais no armazenamento (FR-477), a Frente recebe uma indicação textual do tipo no Idioma da interface (por exemplo "[Imagem]").
- **Acervo grande**: a exportação conclui para até 10.000 Cartões e até 100 MB de Imagens e Áudios somados (FR-478). Acima disso, a exportação é recusada antes de gerar, com o limite, e o Usuário pode exportar Baralhos em partes.
- **Baralho vazio entre os escolhidos**: numa exportação de vários ou de todos, um Baralho sem Cartões entra no pacote, vazio. A exportação só é recusada quando nenhum dos Baralhos escolhidos tem Cartões.
- **Exclusão de conta**: os arquivos de Exportação do Usuário ainda guardados são excluídos junto com a conta, e os endereços de download deixam de funcionar.
- **Mídia ausente**: se uma Imagem ou Áudio não existir mais durante a geração, o Cartão é exportado sem ela e o resultado informa quantos Cartões ficaram sem mídia.
- **Armazenamento de mídia fora do ar**: a exportação falha com a opção de tentar de novo (FR-476, FR-477). Uma cópia de segurança sem mídia nunca é entregue como sucesso.
- **Edição durante a exportação**: o arquivo reflete o acervo no momento em que a geração começou.
- **Acervo alterado entre a prévia e a geração**: a prévia é indicativa. Vale o conteúdo lido na geração, e o resultado informa os números finais.
- **Duas exportações simultâneas do mesmo Usuário**: vale a última. Um endereço emitido antes pode baixar o arquivo mais novo, que também é só do Usuário.
- **Baralho renomeado entre duas exportações**: ao reimportar no Anki, os Cartões são atualizados pelo identificador estável e vão para o Baralho com o nome novo, pela regra do próprio Anki.
- **Reimportação no Anki**: importar o mesmo arquivo duas vezes no Anki atualiza os Cartões em vez de duplicá-los, porque cada Cartão leva um identificador estável.
- **Reimportação nesta aplicação**: a importação do Anki vigente traz só Frente-Verso, sem mídia e sem progresso. Cartões de Imagem e Áudio voltam como Frente-Verso com os textos.
- **Progresso atrasado**: um Cartão com revisão já vencida chega ao Anki vencido, com a mesma data, e aparece para revisão no mesmo dia.
- **Cartão estudado só em Sessão de Baralho temporário**: sem Agendamento próprio (`023`), chega ao Anki como novo.
- **Pacote com muita mídia**: o resumo mostra o tamanho aproximado antes de confirmar. Acima do limite de geração (FR-478), a exportação é recusada com a razão e o Usuário pode exportar em partes.
- **Sessão expirada durante a geração**: o arquivo não é entregue e o Usuário volta a Entrar (`018`).
- **Troca de idioma durante a geração**: não interrompe a exportação. Os rótulos mudam de idioma e o conteúdo do arquivo não muda.

## Requirements *(mandatory)*

### Functional Requirements

**Formato de exportação**

- **FR-461**: A exportação MUST oferecer a escolha do Formato de exportação como passo próprio, com "Pacote Anki (.apkg)" como única opção desta feature, já selecionada.
- **FR-462**: Cada Formato de exportação MUST ter nome, extensão de arquivo e as próprias regras de correspondência dos Tipos de cartão. Acrescentar um formato MUST NOT mudar o fluxo de escolha do conteúdo nem as regras dos formatos existentes.
- **FR-463**: O pacote Anki gerado MUST abrir sem erro na versão estável do Anki para computador, do AnkiDroid e do AnkiMobile na data da validação (registrada nas notas do implement), e na importação do Anki desta aplicação.

**Conteúdo exportado**

- **FR-464**: O Usuário MUST poder exportar um Baralho a partir do seu detalhe, e um ou mais Baralhos, ou todos, a partir da lista de Baralhos. A exportação MUST NOT partir de Cartões avulsos, do resultado de uma busca ou filtro, nem do Baralho temporário.
- **FR-465**: Cada Baralho escolhido MUST virar um Baralho no pacote Anki, com o mesmo nome, mesmo sem Cartões. A exportação MUST ser recusada só quando nenhum dos Baralhos escolhidos tem Cartões. Cada Cartão MUST virar exatamente um Cartão Anki no Baralho correspondente.
- **FR-466**: Frente, Verso e Tags de cada Cartão MUST ser exportados exatamente como foram escritos, exceto os espaços internos de cada Tag, trocados por `_` porque o Anki separa tags por espaço, com quebras de linha preservadas e qualquer marcação tratada como texto literal.
- **FR-467**: O pacote MUST trazer, para cada Cartão, um identificador estável, de modo que exportar de novo e reimportar no Anki atualize os Cartões em vez de duplicá-los.
- **FR-468**: Cartões do tipo Imagem e Áudio MUST ser exportados com seus textos (Texto da frente ou Mensagem na Frente, Verso no Verso) e com a mídia dentro do pacote: no Anki, a Imagem aparece na Frente, com a descrição alternativa preservada, e o Áudio pode ser tocado na Frente. Cada Imagem e cada Áudio MUST entrar no pacote uma única vez por Cartão, sem metadados embutidos.
- **FR-469**: O pacote MUST levar o progresso de estudo de cada Cartão, para o Anki continuar de onde o Usuário parou. Um Cartão nunca estudado MUST chegar ao Anki como novo. Um Cartão já estudado MUST chegar como em revisão, com a mesma data da próxima revisão, no fuso horário do Usuário, o mesmo intervalo e a facilidade correspondente da repetição espaçada (`015`).
- **FR-470**: A importação do Anki desta aplicação continua ignorando o progresso. Reimportar aqui um pacote exportado traz os Cartões sem Agendamento, como hoje.
- **FR-471**: A exportação MUST NOT incluir Rotinas de estudo, estatísticas nem o Histórico de Sessões.
- **FR-472**: Antes de confirmar, a exportação MUST mostrar o resumo: formato, número de Baralhos, número de Cartões, quantos têm Imagem ou Áudio e o tamanho aproximado do arquivo quando houver mídia, com erro de no máximo 20% em relação ao arquivo gerado a partir do mesmo acervo.
- **FR-473**: O arquivo MUST refletir o acervo no início da geração. Edições feitas durante a geração MUST NOT deixar o arquivo inconsistente.

**Geração e download**

- **FR-474**: O arquivo MUST ser baixado pelo navegador com a extensão do formato e um nome derivado do Baralho (exportação de um só) ou do produto e da data (vários ou todos), sem caracteres inválidos em nome de arquivo.
- **FR-475**: Durante a geração, a interface MUST mostrar e anunciar o estado "Gerando arquivo…" e impedir uma segunda confirmação simultânea.
- **FR-476**: Uma geração que falhe MUST NOT entregar arquivo parcial, e MUST comunicar a falha com a opção de tentar de novo.
- **FR-477**: Se uma Imagem ou um Áudio não existir mais no armazenamento durante a geração, o Cartão MUST ser exportado sem a mídia, e o resultado MUST informar quantos Cartões ficaram sem ela. Se o armazenamento estiver indisponível, a exportação MUST falhar (FR-476), e nenhum arquivo sem mídia é entregue como sucesso.
- **FR-478**: A exportação MUST concluir para até 10.000 Cartões e até 100 MB (104.857.600 bytes) de Imagens e Áudios somados. Acima de qualquer um dos dois, MUST recusar antes de gerar, informando qual limite foi excedido e sugerindo exportar em partes.
- **FR-479**: A exclusão de conta (`017`) MUST oferecer exportar o acervo antes de excluir, sem tornar a exportação obrigatória. Excluir a conta MUST excluir também, na mesma operação, os arquivos de Exportação do Usuário ainda guardados: nenhum conteúdo do Usuário permanece.

**Privacidade e segurança**

- **FR-480**: A exportação MUST conter apenas o acervo do Usuário que Entrou, e MUST exigir Entrar válido (`018`). O arquivo MUST NOT conter o Nome de usuário nem o identificador do Usuário. Os identificadores dos Cartões entram no arquivo, porque deles depende o FR-467.
- **FR-481**: O arquivo gerado MUST ser entregue só ao Usuário que o pediu, por um endereço de download que não pode ser adivinhado e deixa de funcionar em até 15 minutos. A aplicação MUST deixar de guardar o arquivo em até 48 horas. Depois de baixado, o arquivo é do Usuário, que o importa quando quiser.
- **FR-482**: Nomes de Baralhos, conteúdo dos Cartões e endereços de download MUST NOT aparecer em logs nem em mensagens de erro.

**Acessibilidade e layout**

- **FR-483**: Abrir a exportação, marcar Baralhos, escolher o formato e confirmar MUST ser operáveis por teclado, com foco visível, nomes acessíveis e alvo de toque de pelo menos 44 × 44 px. O resultado (concluída, falhou, Cartões sem mídia) MUST ser anunciado a leitores de tela.
- **FR-484**: A tela de exportação MUST caber nas larguras de 360 a 1440 px e com zoom de 200%, sem rolagem horizontal da página.

**Idioma da interface**

- **FR-485**: Todo Texto do produto novo desta feature MUST existir em Português, Inglês e Espanhol e seguir o Idioma da interface (`027`), incluindo o nome do formato, o resumo, os anúncios, as recusas e as indicações textuais de tipo colocadas no arquivo.
- **FR-486**: As recusas novas do servidor (nada para exportar, acervo grande demais, falha de geração) MUST ser identificadas por código estável, com mensagem técnica em inglês, e a interface MUST apresentar o texto para a pessoa no Idioma da interface (`027`, FR-018 e FR-019).

### Key Entities *(include if feature involves data)*

- **Exportação**: pedido do Usuário para gerar um arquivo com parte ou todo o seu acervo. Tem o conteúdo escolhido (um, vários ou todos os Baralhos), o Formato de exportação e o resumo. Não é guardada depois de entregue.
- **Formato de exportação**: maneira de representar o acervo num arquivo. Tem nome, extensão e as regras de correspondência de cada Tipo de cartão. Nesta feature existe só o **Pacote Anki (.apkg)**.
- **Pacote Anki**: arquivo `.apkg` com um Baralho Anki por Baralho exportado, um Cartão Anki por Cartão (cada um com identificador estável e o progresso de estudo) e a mídia dos Cartões de Imagem e Áudio.
- **Progresso de estudo**: estado da repetição espaçada de um Cartão (novo ou em revisão, próxima revisão, intervalo e facilidade), derivado do Agendamento (`015`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-183**: A partir do detalhe de um Baralho, exportar exige no máximo 3 interações até o download começar.
- **SC-184**: 100% dos Cartões Frente-Verso exportados abrem no Anki para computador com Frente, Verso e Tags idênticos, exceto pela troca de espaços por `_` nas Tags. Reimportá-los nesta aplicação devolve textos equivalentes segundo as regras da importação vigente (espaços em branco normalizados), para pacotes dentro do limite dela.
- **SC-185**: 100% dos Cartões dos Baralhos escolhidos estão no arquivo, cada um uma única vez e no Baralho correspondente, inclusive os de Imagem e Áudio.
- **SC-186**: Um acervo de 1.000 Cartões sem mídia é exportado em até 10 segundos, do pedido ao início do download, em conexão de 50 Mbps.
- **SC-187**: Em 100% das tentativas sem Entrar, ou de obter o acervo de outro Usuário, nenhum arquivo é entregue.
- **SC-188**: 100% dos Textos do produto novos aparecem nos três idiomas, e nenhuma mensagem técnica nova está fora do inglês.
- **SC-189**: Em 100% dos Cartões exportados, abertos no Anki para computador, as Imagens aparecem e os Áudios tocam, e a data da próxima revisão é a mesma da aplicação, no fuso horário do Usuário (Cartões nunca estudados chegam como novos).
- **SC-190**: Um formato novo pode ser acrescentado sem alterar nenhum cenário de aceitação desta spec, apenas acrescentando os do formato novo.
- **SC-191**: Um acervo no limite (10.000 Cartões e 100 MB de mídia) é exportado em até 25 segundos, do pedido ao início do download.

## Assumptions

- **Formato inicial**: o pacote Anki é o formato de troca mais difundido entre aplicativos de flashcards, e a aplicação já o importa. Por isso é o primeiro formato. CSV e JSON ficam para quando houver pedido.
- **Tipo de nota no Anki**: os Cartões vão para um tipo de nota próprio com campos Frente e Verso. O nome é fixo e não segue o Idioma da interface, porque fica no acervo Anki do Usuário depois da importação. O tipo de nota tem identificador fixo do produto, e por isso o Anki o distingue de um tipo de nota do Usuário com o mesmo nome.
- **Tags**: as Tags do Cartão viram tags do Anki. Espaços dentro de uma Tag são trocados por `_`, porque o Anki separa tags por espaço. Validada no plan (research R4): o produto aceita espaço dentro de uma Tag.
- **Download direto**: o arquivo é gerado sob demanda e baixado na hora. Não há lista de exportações anteriores.
- **Limites**: 10.000 Cartões cobrem com folga o acervo de um estudante, e 100 MB de mídia cabem no tempo de geração disponível. Validada em produção em 2026-10-15: o limite exportou em 7,2 s (SC-191, T040).
- **Importação**: a importação do Anki vigente não muda nesta feature. Por isso, reimportar nesta aplicação traz os Cartões como Frente-Verso, sem mídia e sem progresso, com espaços em branco normalizados e só para pacotes dentro do limite dela.
- **Endereço de download**: quem tiver o endereço durante os 15 minutos consegue baixar o arquivo, como já acontece com Imagens e Áudios (`026`, FR-424). O endereço contém o nome do arquivo, e portanto o nome do Baralho, e pode ficar no histórico do navegador. Os dois riscos são aceitos.
- **Progresso no Anki**: o Anki só aplica o progresso se a opção de importar o progresso de estudo estiver marcada na importação. A tela de Exportação orienta marcá-la. `premissa a validar` pelo Product Owner na validação manual (T039): se a opção vem marcada por padrão.
- **Edições feitas no Anki**: ao reimportar no Anki uma nota já editada lá, vale a regra de atualização do próprio Anki. A aplicação não a controla.
- **Frequência**: não há limite de Exportações por Usuário nesta feature. Os limites de tamanho (FR-478) bastam para o custo de cada geração.
