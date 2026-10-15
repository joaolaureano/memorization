# Feature Specification: Usuário de Teste

**Feature Branch**: `030-usuario-de-teste`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "Vamos criar agora o usuário de teste, para apenas testar a aplicação. Eu imagino o seguinte, será um usuário que sempre terá os mesmos dados. Então, se 2 pessoas ao mesmo tempo usarem, na verdade elas terão um usuário que será diferente. Mas o startup deles é o mesmo. Podemos imaginar um usuário com um deck de Inglês, um deck de Bandeiras de países, e outro relacionado com som. Pensei em som de pássaros, e ele precisa saber qual que é. Ele pode usar normalmente, criar deck, editar, etc. Ele não pode deletar, nem modificar a conta de algum modo. Mas 2 pessoas aleatórias terão duas contas distintas. Se ele sair, seja por sessão, seja por que saiu de fato, tudo é perdido. Mas ele pode \"recriar\" o usuário, entrando de novo como Teste"

**Depende de**: `007-criar-usuario`, `008-entrar`, `017-gerenciar-conta-usuario`, `018-acesso-temporario`, `025-criar-cartoes-baralho`, `026-cartao-com-imagem`, `027-idioma-da-interface` e `028-cartao-com-audio`.

## Objetivo e escopo

Permitir que qualquer pessoa experimente a aplicação sem se cadastrar. Na tela de Entrar, a opção **"Entrar como Teste"** cria na hora uma **Conta de teste** própria daquela pessoa, já preenchida com o **Acervo de demonstração**: o mesmo conteúdo inicial para todos, com três Baralhos.

- **Inglês**: Cartões Frente-Verso de vocabulário.
- **Bandeiras**: Cartões de Imagem com a bandeira de um país na Frente e o nome do país no Verso.
- **Cantos de pássaros**: Cartões de Áudio com o canto de um pássaro na Frente e o nome do pássaro no Verso.

A pessoa usa a aplicação normalmente: estuda, cria e edita Baralhos e Cartões. Ela não pode alterar nem excluir a conta. Duas pessoas que entram como Teste ao mesmo tempo recebem contas diferentes e nunca veem o que a outra fez.

A Conta de teste é descartável. Quando a pessoa Sai, ou quando o Acesso dela expira, a conta e tudo o que foi feito nela são excluídos. Entrar como Teste de novo cria outra conta, com o Acervo de demonstração no estado inicial.

Fora do escopo:
- transformar uma Conta de teste em conta permanente;
- conteúdo de demonstração diferente por idioma ou por pessoa;
- limitar o que se estuda ou mostrar anúncios na Conta de teste.

## Clarifications

### Session 2026-10-15

- Q: "Não pode deletar" se refere só à conta ou também a Baralhos e Cartões? → A: Só à conta. A pessoa não pode alterar nem excluir a conta, mas pode excluir Baralhos e Cartões normalmente.
- Q: O Acervo de demonstração vem com histórico de estudo e Rotina de exemplo? → A: Sim. Vem com Sessões de estudo dos últimos 7 dias, Cartões com revisão marcada e uma Rotina de exemplo na Agenda, com datas relativas ao dia em que a conta é criada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Experimentar sem cadastro (Priority: P1)

Como visitante, quero entrar na aplicação com um clique e encontrar conteúdo pronto para estudar, para avaliar o produto sem criar conta.

**Why this priority**: é o valor central. Sem isso, quem visita precisa se cadastrar e criar Cartões antes de ver o produto funcionar.

**Independent Test**: na tela de Entrar, escolher "Entrar como Teste" e confirmar que a pessoa entra em até 5 segundos, com os três Baralhos de demonstração, e consegue estudar um Cartão de cada Baralho, vendo a bandeira e ouvindo o canto.

**Acceptance Scenarios**:

1. **Given** a tela de Entrar, **When** a pessoa escolhe "Entrar como Teste", **Then** entra sem informar Nome de usuário nem Senha e chega ao Início de uma Conta de teste nova.
2. **Given** uma Conta de teste nova, **When** a pessoa abre Baralhos, **Then** vê exatamente os Baralhos Inglês, Bandeiras e Cantos de pássaros, com o conteúdo do Acervo de demonstração.
3. **Given** o Baralho Bandeiras, **When** a pessoa o estuda, **Then** vê a bandeira na Frente e, ao revelar, o nome do país.
4. **Given** o Baralho Cantos de pássaros, **When** a pessoa o estuda, **Then** pode tocar o canto na Frente e, ao revelar, vê o nome do pássaro.
5. **Given** uma Conta de teste, **When** a pessoa olha o cabeçalho ou o Perfil, **Then** fica claro, no Idioma da interface, que é uma Conta de teste e que tudo será apagado ao Sair.
6. **Given** o Idioma da interface em Inglês ou Espanhol, **When** a pessoa entra como Teste, **Then** os textos da interface seguem o idioma. O conteúdo do Acervo de demonstração é o mesmo em qualquer idioma.

---

### User Story 2 - Contas isoladas por pessoa (Priority: P1)

Como visitante, quero que o que eu faço na Conta de teste seja só meu, para experimentar à vontade sem interferir em outras pessoas nem ser afetado por elas.

**Why this priority**: sem isolamento, uma conta compartilhada fica bagunçada pelo primeiro visitante, e quem chega depois encontra um produto quebrado.

**Independent Test**: em dois navegadores, entrar como Teste nos dois, excluir um Cartão e criar um Baralho no primeiro, e confirmar que o segundo continua com o Acervo de demonstração intacto.

**Acceptance Scenarios**:

1. **Given** duas pessoas que entram como Teste ao mesmo tempo, **When** cada uma altera seu acervo, **Then** nenhuma vê as mudanças da outra.
2. **Given** qualquer Conta de teste nova, **When** é criada, **Then** começa com o mesmo Acervo de demonstração, independentemente do que outras Contas de teste fizeram.
3. **Given** uma Conta de teste, **When** a pessoa estuda, cria, edita ou exclui Baralhos e Cartões, ou importa e exporta, **Then** tudo funciona como numa conta comum.

---

### User Story 3 - Conta descartável (Priority: P1)

Como visitante, quero que a Conta de teste desapareça quando eu sair, e poder começar de novo do zero quando quiser.

**Why this priority**: garante que nada de um visitante fique guardado e que cada nova visita comece do estado inicial.

**Independent Test**: entrar como Teste, criar um Cartão e Sair. Depois entrar como Teste de novo e confirmar que o Cartão não existe e o Acervo de demonstração está no estado inicial.

**Acceptance Scenarios**:

1. **Given** uma Conta de teste, **When** a pessoa Sai, **Then** é avisada antes de que tudo será apagado e, ao confirmar, a conta e todo o seu conteúdo são excluídos.
2. **Given** uma Conta de teste, **When** o Acesso dela expira (`018`), **Then** a conta fica encerrada e não pode mais ser usada: a próxima ação leva à tela de Entrar com o aviso de que a Conta de teste terminou, e o conteúdo é excluído em até 1 hora (FR-498).
3. **Given** uma Conta de teste encerrada, **When** a pessoa escolhe "Entrar como Teste" de novo, **Then** recebe uma conta nova, com o Acervo de demonstração no estado inicial.
4. **Given** uma Conta de teste, **When** a pessoa recarrega a página ou reabre a aba antes de o Acesso expirar, **Then** continua na mesma Conta de teste, com o que tinha feito.

---

### User Story 4 - Conta protegida (Priority: P2)

Como dono do produto, quero que a Conta de teste não possa ser alterada nem excluída pela pessoa, para que a demonstração não vire porta para mudar credenciais ou dados de conta.

**Why this priority**: protege a demonstração, mas o valor principal já está nas histórias anteriores.

**Independent Test**: numa Conta de teste, abrir o Perfil e confirmar que trocar Nome de usuário, trocar Senha e excluir a conta não estão disponíveis, e que a recusa também vale para pedidos feitos fora da interface.

**Acceptance Scenarios**:

1. **Given** uma Conta de teste, **When** a pessoa abre o Perfil, **Then** as ações de alterar Nome de usuário, alterar Senha e excluir a conta não aparecem, e uma explicação diz por quê.
2. **Given** uma Conta de teste, **When** alguém pede essas alterações diretamente ao servidor, **Then** o pedido é recusado com código estável.
3. **Given** uma Conta de teste, **When** a pessoa muda as preferências de estudo ou o Idioma da interface, **Then** as mudanças valem até a conta ser encerrada.

---

### Edge Cases

- **Muitos visitantes simultâneos**: cada um recebe a própria Conta de teste. A criação não depende de nenhuma outra Conta de teste existir ou não.
- **Outro navegador**: a Conta de teste existe só no navegador em que foi criada, porque não tem Senha.
- **Segunda aba depois de Sair**: se uma aba Sai e apaga a conta, a próxima ação na outra aba leva à tela de Entrar com o aviso de conta encerrada.
- **Fechar a aba sem Sair**: a conta continua até o Acesso expirar (5 minutos sem uso, `018`) e então é excluída. Reabrir antes disso continua na mesma conta.
- **Expiração com conteúdo não salvo**: vale a regra do `018`: a interação renova o Acesso, e um formulário em edição não expira enquanto a pessoa digita.
- **Conta de teste abandonada sem expiração detectada**: contas cujo Acesso já expirou são excluídas por uma limpeza periódica, mesmo que ninguém tente usá-las de novo.
- **Nome de usuário**: a Conta de teste tem um Nome de usuário gerado, que nunca colide com contas reais e não pode ser usado para Entrar com Senha.
- **Entrar como Teste estando numa conta real**: a opção só aparece na tela de Entrar. Quem já está numa conta real precisa Sair antes.
- **Exportação na Conta de teste**: permitida. O arquivo exportado pertence a quem baixou. O arquivo guardado para download é excluído com a conta.
- **Mídia enviada pela pessoa**: Imagens e Áudios enviados numa Conta de teste são excluídos com a conta. A mídia do Acervo de demonstração continua disponível para as próximas contas.
- **Falha ao criar a conta**: a pessoa vê uma mensagem no Idioma da interface e pode tentar de novo. Nenhuma conta parcial fica guardada, e a criação que falhou não conta no limite por origem (FR-502).
- **Estatísticas e Agenda**: começam com o histórico de exemplo do Acervo de demonstração (FR-504) e, a partir daí, somam o que a pessoa faz na própria Conta de teste.
- **Fuso e datas do histórico**: as datas do histórico de exemplo são calculadas a partir do dia de criação da conta, no fuso da pessoa, como em `013`/`015`/`016`.

## Requirements *(mandatory)*

### Functional Requirements

**Entrar como Teste**

- **FR-487**: A tela de Entrar MUST oferecer a ação "Entrar como Teste", que não pede Nome de usuário nem Senha.
- **FR-488**: Cada uso de "Entrar como Teste" MUST criar uma Conta de teste nova e exclusiva e deixar a pessoa conectada a ela por um Acesso temporário (`018`).
- **FR-489**: Duas Contas de teste MUST NOT compartilhar dados. O que uma pessoa faz numa Conta de teste MUST NOT aparecer em nenhuma outra conta.
- **FR-490**: A Conta de teste MUST ser identificada como tal na interface (cabeçalho e Perfil), com o aviso de que tudo será apagado ao Sair ou quando o Acesso expirar.

**Acervo de demonstração**

- **FR-491**: Toda Conta de teste nova MUST começar com o mesmo Acervo de demonstração, idêntico para todas e independente do que outras Contas de teste fizeram.
- **FR-492**: O Acervo de demonstração MUST ter três Baralhos:
  - "Inglês", com Cartões Frente-Verso de vocabulário;
  - "Bandeiras", com Cartões de Imagem: a bandeira de um país na Frente, com descrição alternativa, e o nome do país no Verso;
  - "Cantos de pássaros", com Cartões de Áudio: o canto de um pássaro na Frente e o nome do pássaro no Verso.

  A mídia segue os formatos, tamanhos e durações aceitos pela `026` e pela `028`.
- **FR-493**: Cada Baralho do Acervo de demonstração MUST ter entre 8 e 15 Cartões.
- **FR-494**: Toda mídia do Acervo de demonstração MUST estar em domínio público ou sob CC0, CC BY ou CC BY-SA. Licenças com restrição não comercial (NC) ou sem derivações (ND) MUST NOT ser usadas. A atribuição exigida pela licença MUST estar acessível na aplicação.
- **FR-504**: O Acervo de demonstração MUST incluir um histórico de estudo de exemplo com datas relativas ao dia de criação da conta, para que Início, Estatísticas e Agenda não comecem vazios:
  - Sessões de estudo registradas em ao menos 4 dos últimos 7 dias, com acertos e erros;
  - Cartões com Agendamento: ao menos 3 com revisão para hoje ou antes e ao menos 3 para dias futuros;
  - uma Rotina de exemplo na Agenda, com o Compromisso de hoje ainda não concluído.

  As Sessões de exemplo aparecem no Histórico de Sessões como Sessões normais, com detalhe.

**Uso**

- **FR-495a**: A soma das Imagens e dos Áudios mantidos nos Cartões de uma Conta de teste MUST ficar em até 20 MB; excluir um Cartão libera espaço. Uma Conta de teste MUST preparar no máximo 30 envios de mídia, contando os que não chegaram a ser salvos num Cartão. Acima de qualquer um dos limites, o pedido é recusado com código estável e mensagem no Idioma da interface. A mídia do Acervo de demonstração não conta.
- **FR-495**: Na Conta de teste, a pessoa MUST poder usar todas as funções de acervo e estudo de uma conta comum: estudar, criar, editar e excluir Baralhos e Cartões, importar, exportar, preferências de estudo, Agenda e Idioma da interface.
- **FR-496**: Na Conta de teste, alterar Nome de usuário, alterar Senha e excluir a conta (`017`) MUST NOT estar disponíveis na interface, e o servidor MUST recusar esses pedidos com código estável. Excluir Baralhos e Cartões continua permitido (FR-495).

**Encerramento**

- **FR-497**: Ao Sair de uma Conta de teste, a pessoa MUST ser avisada de que tudo será apagado. Ao confirmar, a conta e todo o seu conteúdo MUST ser excluídos, inclusive a mídia enviada e os arquivos de Exportação. Se a exclusão falhar, a pessoa MUST ser desconectada mesmo assim. A conta fica encerrada e é excluída pela limpeza de FR-498.
- **FR-498**: Quando o Acesso de uma Conta de teste expira, a conta e todo o seu conteúdo MUST ser excluídos. Contas de teste com Acesso expirado MUST ser excluídas em até 1 hora, mesmo que ninguém tente usá-las.
- **FR-499**: Uma Conta de teste MUST NOT poder ser retomada depois de encerrada. "Entrar como Teste" sempre cria uma conta nova.
- **FR-500**: A mídia do Acervo de demonstração MUST continuar disponível para novas Contas de teste depois que qualquer Conta de teste for excluída. Por exceção à regra da `026`/`028` de que cada Cartão tem a própria mídia, os Cartões do Acervo de demonstração compartilham a mesma mídia entre todas as Contas de teste. A Cópia de um desses Cartões (`025`) recebe mídia própria, como hoje.

**Segurança e limites**

- **FR-501**: A Conta de teste MUST NOT ter Senha conhecida por ninguém, e seu Nome de usuário MUST NOT servir para Entrar por nenhum meio, nem pela tela de Entrar nem por requisição direta com credencial.
- **FR-502**: A criação de Contas de teste MUST ter limites contra criação em massa:
  - até 10 por hora por endereço de rede do visitante;
  - até 300 Contas de teste ativas ao mesmo tempo (ativa = não encerrada, isto é, com Acesso válido).

  Acima de um limite, o pedido é recusado com código estável e mensagem no Idioma da interface: limite atingido, ou indisponibilidade temporária. O endereço do visitante MUST NOT ser guardado em claro.

**Idioma da interface**

- **FR-503**: Todo Texto do produto novo desta feature MUST existir em Português, Inglês e Espanhol (`027`). O conteúdo do Acervo de demonstração é Conteúdo do Usuário e não muda com o Idioma da interface.

### Key Entities *(include if feature involves data)*

- **Conta de teste**: Usuário temporário criado por "Entrar como Teste", exclusivo de uma pessoa e de uma visita. Não tem Senha conhecida e não pode ser alterada nem excluída pela pessoa. Deixa de existir ao Sair ou quando o Acesso expira.
- **Acervo de demonstração**: conteúdo inicial fixo, com os Baralhos Inglês, Bandeiras e Cantos de pássaros, seus Cartões e mídias e o histórico de estudo de exemplo (Sessões, Agendamentos e uma Rotina), copiado para cada Conta de teste nova.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-192**: Da tela de Entrar ao Início de uma Conta de teste pronta, com o Acervo de demonstração, leva no máximo 5 segundos e exige 1 interação, inclusive na primeira entrada depois de 15 minutos sem uso do serviço.
- **SC-193**: Em 100% das Contas de teste novas, o acervo é idêntico ao Acervo de demonstração (mesmos Baralhos, Cartões, textos e mídias).
- **SC-194**: Em 100% dos testes com duas Contas de teste simultâneas, nenhuma alteração de uma aparece na outra.
- **SC-195**: Depois de Sair, nenhum dado da Conta de teste permanece: Usuário, acervo, histórico, Agenda, mídia enviada, arquivo de Exportação e Acesso. Depois da expiração do Acesso, nada disso permanece passada 1 hora.
- **SC-196**: Em 100% das tentativas, alterar Nome de usuário, alterar Senha ou excluir uma Conta de teste é recusado.
- **SC-197**: 100% das mídias do Acervo de demonstração têm licença de uso público registrada, com atribuição acessível na aplicação.
- **SC-198**: Em 100% das Contas de teste novas, o Início mostra Cartões para revisar hoje e o Compromisso de hoje, e as Estatísticas mostram estudo em ao menos 4 dos últimos 7 dias.

## Assumptions

- **Duração**: a Conta de teste vive enquanto o Acesso temporário (`018`) estiver válido: 5 minutos sem uso, renovados por qualquer interação. Isso cumpre o "se sair por sessão, tudo é perdido".
- **Conteúdo**: os textos do Acervo de demonstração ficam em português, como Conteúdo do Usuário. "Inglês" traz palavras em inglês com a tradução em português.
- **Mídia**: as bandeiras vêm de fontes em domínio público, e os cantos de pássaros de acervos com licença Creative Commons que permita uso público, com atribuição. A escolha das espécies e dos países fica para o plan.
- **Limite de criação**: o número exato por origem de acesso fica para o plan, com um valor que um visitante real nunca alcance.
- **Limpeza periódica**: a exclusão de contas abandonadas depende de uma rotina periódica de infraestrutura, cuja permissão o Product Owner aplica antes do deploy.
- **Premissas a validar**: o Arquiteto valida no primeiro deploy (quickstart, cenário 14) o tempo de criação com o serviço ocioso e a leitura do endereço do visitante.
- **Custo**: cada Conta de teste reaproveita a mídia do Acervo de demonstração em vez de duplicá-la, e por isso criar contas não multiplica o armazenamento.
