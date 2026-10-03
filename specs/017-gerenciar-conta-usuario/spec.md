# Feature Specification: Gerenciar conta do Usuário

**Feature Branch**: `017-gerenciar-conta-usuario`
**Created**: 2026-10-03
**Status**: Implementada em 2026-10-03 (branch `implementacao-016-018`), a pedido do Product Owner
**Input**: Completar a interação do Usuário com os próprios dados (CRUD): consultar, atualizar dados e excluir definitivamente (hard-delete).

**Depende de**: `007-criar-usuario` (Usuário, Nome de usuário, Senha e regras de validação), `008-entrar` (Credencial, acervo por usuário, recusa por Credencial e Sair), `013` (Registro de sessão e Histórico de estudo), `015` (Preferências e Agendamento do cartão) e `016-agendamento-de-estudo` (Agenda de estudo, quando existir). Glossário normativo em `CONTEXT.md`.

## Clarifications

### Session 2026-10-03

- Q: O CRUD é dos dados do próprio Usuário ou de todos os recursos? → A: Dos dados do próprio Usuário: consultar e alterar Nome de usuário e Senha e excluir o próprio Usuário com todos os seus dados. Cartões e Baralhos já têm edição e exclusão desde `005`/`006`; esta feature não os redefine.
- Q: Onde a pessoa acessa "Minha conta"? → A: Numa seção "Minha conta" dentro da tela Preferências (`015`), alcançada pela navegação principal como hoje; a navegação continua com quatro destinos e tudo o que é da própria pessoa fica num só lugar (FR-257).
- Q: A exclusão é lógica ou definitiva? → A: Definitiva (hard-delete), sem recuperação. O diálogo de confirmação precisa deixar isso explícito antes de a pessoa confirmar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar "Minha conta" (Priority: P1)

A pessoa que Entrou abre Preferências pela navegação principal e, na seção
"Minha conta", vê o seu Nome de usuário e as três ações disponíveis: Alterar Nome de usuário, Trocar
Senha e "Excluir conta". Nenhum caminho da tela revela a Senha nem permite
recuperá-la.

**Why this priority**: é a superfície única e mínima a partir da qual as três
ações do CRUD do próprio Usuário existem. Sem ela, nenhuma das demais ações tem onde
acontecer.

**Independent Test**: entrar, abrir Preferências pela navegação principal,
confirmar o Nome de usuário correto, a presença das três ações e a ausência de
qualquer exibição da Senha ou de leitura que a devolva.

**Acceptance Scenarios**:

1. **Given** a pessoa que Entrou, **When** ela abre Preferências pela navegação
   principal, **Then** vê, na seção "Minha conta", o Nome de usuário atual e as ações Alterar Nome de
   usuário, Trocar Senha e "Excluir conta".
2. **Given** a seção "Minha conta" aberta, **When** ela inspeciona todos os
   campos e leituras, **Then** nenhum exibe a Senha atual, a Senha anterior ou
   qualquer derivado, e nenhum caminho oferece recuperá-la (FR-078).
3. **Given** nenhuma Credencial mantida, **When** a pessoa tenta chegar a
   Preferências, **Then** a única tela disponível é Entrar, e "Minha conta" não
   é alcançável (FR-097 de `008`).

---

### User Story 2 - Excluir o próprio Usuário definitivamente (Priority: P1)

A pessoa que Entrou exclui o próprio Usuário por uma ação perigosa com diálogo de
confirmação. O diálogo informa as consequências irreversíveis e as contagens do
que será removido (Cartões, Baralhos, Registros de sessão e dados da Agenda
quando existirem) e exige a Senha atual. Ao confirmar, o Usuário e todos os dados
do Usuário desaparecem; os demais Usuários não são afetados; o Nome de usuário
fica livre para um futuro Cadastro.

**Why this priority**: a exclusão é o direito mínimo de retirada de dados e a
operação de maior risco da feature. Sem uma exclusão definitiva e completa, a
conta não tem CRUD.

**Independent Test**: com dois Usuários cadastrados, cada um com Cartões,
Baralhos, Vínculos e ao menos um Registro de sessão, excluir a conta do
primeiro e confirmar que nada dele permanece, que o acervo e o Histórico do
segundo não mudam, que a Credencial do primeiro é recusada em outra página
aberta e que o Nome de usuário dele pode ser reutilizado num novo Cadastro sem
trazer dados antigos.

**Acceptance Scenarios**:

1. **Given** a pessoa que Entrou e tem acervo, **When** ela aciona Excluir
   conta, **Then** vê um diálogo de confirmação que anuncia a irreversibilidade
   e apresenta as contagens de Cartões, Baralhos, Registros de sessão e dados
   da Agenda de estudo quando a feature `016` existir (FR-272, FR-159 de `012`).
2. **Given** o diálogo aberto, **When** a pessoa digita a Senha atual correta e
   confirma, **Then** a conta é excluída, a Credencial é descartada e a
   aplicação volta a "Entrar" com a mensagem "Conta excluída".
3. **Given** a exclusão concluída, **When** a mesma pessoa usa o Nome de
   usuário excluído num novo Cadastro, **Then** o Cadastro é aceito como
   qualquer Nome de usuário livre e nenhum dado do Usuário anterior aparece.
4. **Given** dois Usuários com acervo, **When** um deles exclui a própria
   conta, **Then** o outro Usuário, seus Cartões, Baralhos, Vínculos, Registros
   de sessão, Preferências e Agendamentos do cartão permanecem exatamente como
   estavam.
5. **Given** uma segunda página ou navegador com a Credencial do Usuário
   excluído, **When** ela tenta qualquer operação, **Then** a Credencial é
   recusada, a página volta a "Entrar" com mensagem explicativa e nada é
   alterado (FR-091, FR-278).
6. **Given** a pessoa que Entrou, **When** ela aciona "Excluir conta" e digita
   Senha atual errada, **Then** a exclusão é recusada com a mensagem única de
   re-confirmação, nada muda e o formulário preserva o que foi digitado, exceto
   os campos de Senha (FR-279).
7. **Given** acervo grande (por exemplo 2.000 Cartões e 500 Registros de
   sessão), **When** a exclusão é confirmada, **Then** ela é aplicada como um
   todo ou não é aplicada, sem deixar parte dos dados órfã (FR-274, FR-275).

---

### User Story 3 - Trocar a Senha (Priority: P2)

A pessoa que Entrou troca a própria Senha na seção "Minha conta". A troca exige a
Senha atual, aceita uma nova Senha e sua Confirmação, segue as regras de Senha
de `007` e, ao concluir, substitui em memória a Credencial da própria página sem
exigir novo Entrar. Outras páginas com a Credencial antiga são recusadas na
próxima operação.

**Why this priority**: manter a Senha sob controle é a ação mais comum depois
de existir o CRUD do próprio Usuário, mas depende de "Minha conta" e do diálogo de
re-confirmação já estabelecidos.

**Independent Test**: entrar, trocar a Senha informando a Senha atual correta, a
nova Senha e a Confirmação igual; confirmar que a pessoa continua na sessão
aberta, que uma segunda página com a Credencial antiga é recusada e volta a
Entrar, e que Entrar com a nova Senha funciona.

**Acceptance Scenarios**:

1. **Given** a seção "Minha conta", **When** a pessoa informa a Senha atual
   correta, uma nova Senha válida e a Confirmação igual, **Then** a Senha é
   trocada e a pessoa continua operando a aplicação sem Entrar de novo.
2. **Given** a troca concluída, **When** outra página ou navegador tenta
   qualquer operação com a Credencial antiga, **Then** é recusado, volta a
   "Entrar" com mensagem explicativa e nada é alterado (FR-091, FR-157 de
   `012`).
3. **Given** a nova Senha igual à atual, **When** a pessoa confirma, **Then** a
   troca é recusada com explicação e nada muda.
4. **Given** a nova Senha e sua Confirmação diferentes, **When** a pessoa
   tenta concluir, **Then** a troca é recusada sem ser enviada e o foco vai
   para a Confirmação (FR-072 de `007`).
5. **Given** a nova Senha com menos de 8 ou mais de 128 caracteres, **When** a
   pessoa tenta concluir, **Then** a troca é recusada com a regra de
   `007` e o campo é identificado.
6. **Given** a tela de troca de Senha, **When** a pessoa usa apenas o teclado,
   **Then** alcança todos os campos, alterna mostrar/ocultar cada Senha e
   conclui ou cancela com o elemento focado sempre identificável sem depender
   de cor (FR-142, FR-285).

---

### User Story 4 - Alterar o Nome de usuário (Priority: P2)

A pessoa que Entrou altera o próprio Nome de usuário na seção "Minha conta". A
alteração exige a Senha atual, aplica integralmente as regras de Nome de
usuário de `007` e, ao concluir, substitui em memória a Credencial da própria
página. O Nome de usuário anterior fica livre para um futuro Cadastro. Outras
páginas com a Credencial antiga são recusadas na próxima operação.

**Why this priority**: completar o CRUD do próprio Usuário exige o Nome de usuário
alterável, mas o valor está abaixo das ações de segurança (trocar Senha) e de
retirada (excluir conta).

**Independent Test**: entrar, alterar o Nome de usuário informando a Senha atual
correta e um nome livre; confirmar que a pessoa continua na sessão aberta, que
outra página com o nome antigo é recusada, que o nome anterior pode ser
reutilizado num novo Cadastro e que Entrar com o novo Nome de usuário e a mesma
Senha funciona.

**Acceptance Scenarios**:

1. **Given** a seção "Minha conta", **When** a pessoa informa a Senha atual
   correta e um Nome de usuário válido e livre, **Then** o nome é alterado e a
   Credencial da página é substituída pelo novo Nome de usuário com a mesma
   Senha, sem exigir novo Entrar.
2. **Given** a alteração concluída, **When** outra página ou navegador tenta
   qualquer operação com o nome antigo, **Then** é recusada, volta a "Entrar"
   com mensagem explicativa e nada é alterado (FR-091, FR-157 de `012`).
3. **Given** o novo Nome de usuário igual ao atual, **When** a pessoa conclui,
   **Then** a alteração é recusada com explicação e nada muda.
4. **Given** um Nome de usuário já existente para outro Usuário, mesmo
   diferindo apenas em maiúsculas e minúsculas, **When** a pessoa tenta
   concluir, **Then** a alteração é recusada com a mensagem clara de `007`
   (FR-074).
5. **Given** o novo Nome de usuário com menos de 3 ou mais de 50 caracteres,
   ou com caractere não permitido, **When** a pessoa tenta concluir, **Then** a
   alteração é recusada com a regra violada identificada (FR-073 de `007`).
6. **Given** a alteração concluída, **When** outra pessoa tenta Cadastrar o
   Nome de usuário anterior, **Then** o Cadastro é aceito como qualquer nome
   livre (FR-265, FR-277).

---

### User Story 5 - Resultado incerto por falha de conexão (Priority: P3)

Quando a conexão cai durante uma alteração ou uma exclusão, a interface não
anuncia sucesso nem falha antes de conhecer o estado real. Ela determina o
resultado checando qual Credencial é aceita agora — a nova ou a antiga — ou, na
exclusão, se a Credencial antiga ainda vale. Se nem isso for possível, comunica
que o resultado é desconhecido e oferece tentar novamente ou ir a "Entrar".

**Why this priority**: preserva a integridade do que foi dito à pessoa em
situações de rede incerta. Sem essa regra, o CRUD do próprio Usuário poderia anunciar
conclusões ou falhas que não correspondem ao estado real.

**Independent Test**: simular uma falha de conexão no instante em que o
resultado não pode ser confirmado, primeiro com a operação aplicada e depois com
a operação não aplicada; conferir que a interface reporta exatamente o estado
real, que tentar novamente nunca aplica a mudança duas vezes e que a exclusão
nunca remove outra conta.

**Acceptance Scenarios**:

1. **Given** uma alteração ou exclusão cujo resultado não pôde ser confirmado,
   **When** a interface retoma, **Then** ela não apresenta sucesso nem falha e
   determina o resultado antes de informar (FR-044, FR-280, FR-281).
2. **Given** a operação efetivamente aplicada no momento da falha, **When** a
   interface verifica qual Credencial é aceita, **Then** reporta que a operação
   foi aplicada — o novo Nome de usuário ou a nova Senha aceitos, ou a conta
   excluída — e, quando aplicável, substitui a Credencial em memória.
3. **Given** a operação não aplicada, **When** a interface verifica,
   **Then** reporta que nada mudou e oferece tentar novamente sem reapresentar
   a mudança como feita.
4. **Given** que nem a verificação foi possível, **When** a interface informa,
   **Then** diz que o resultado é desconhecido e oferece Tentar novamente e ir
   a "Entrar".
5. **Given** uma nova tentativa após resultado incerto, **When** a pessoa
   confirma novamente, **Then** a mudança nunca é aplicada duas vezes e nenhuma
   outra conta é excluída (FR-283).

---

### Edge Cases

- **Senha atual errada em qualquer das três ações**: mensagem única de recusa,
  sem expor a Senha, qualquer derivado ou informação sobre outro Usuário, sem
  mudança alguma e sem descartar o que foi digitado, exceto os campos de Senha.
- **Novo Nome de usuário igual ao atual**: recusado com explicação; nada muda.
- **Novo Nome de usuário ocupado por outro Usuário**, mesmo diferindo só em
  maiúsculas e minúsculas ou em espaços ao redor: recusado com a mensagem clara
  de `007`; nada muda.
- **Nome de usuário liberado após exclusão e reutilizado em novo Cadastro**:
  o Cadastro é aceito e nenhum dado do Usuário anterior aparece na nova conta.
- **Duas abas ou navegadores com a mesma Credencial**: quando uma página
  conclui uma alteração ou exclusão, a outra é recusada por Credencial na
  próxima operação, volta a "Entrar" com mensagem explicativa e nada é
  alterado.
- **Exclusão de conta com acervo grande** (por exemplo 2.000 Cartões e 500
  Registros de sessão): é aplicada como um todo ou não é aplicada, sem deixar
  dados parciais de Cartões, Baralhos, Vínculos, Registros de sessão,
  Preferências ou Agendamentos do cartão.
- **Conexão perdida depois de o servidor ter aplicado a mudança**: a interface
  determina o resultado antes de informar, conforme User Story 5.
- **Exclusão da conta enquanto uma Sessão de estudo está aberta em outra
  página**: a Sessão em curso, ao concluir, encontra a Credencial recusada e
  segue o fluxo de `008`/`012`, sem registrar estudo parcial nem deixar dado
  órfão do Usuário excluído.
- **Feature `016` (Agenda de estudo) ausente**: as contagens do diálogo e a
  remoção não incluem Agenda; os demais dados continuam sendo removidos por
  inteiro.
- **Feature `016` presente**: as contagens do diálogo incluem os dados da
  Agenda e a exclusão remove Rotinas de estudo, Compromissos de estudo e
  vínculos com Registros de sessão do Usuário excluído.
- **Requisição que não parte da interface**: as mesmas regras de Nome de
  usuário, Senha e exclusão são aplicadas de forma autoritativa.

## Requirements *(mandatory)*

### Functional Requirements

**Transversais reutilizados**, com enunciado genérico e observáveis nesta
feature:

- **FR-042**: O sistema MUST apresentar suas telas de forma utilizável em telas
  pequenas.
- **FR-044**: O sistema MUST NOT apresentar como concluída qualquer operação
  que não tenha sido efetivamente persistida.
- **FR-045**: Quando uma operação falhar por indisponibilidade do
  armazenamento, o sistema MUST reportar a falha e MUST preservar o conteúdo
  informado, permitindo nova tentativa sem redigitação.
- **FR-046**: O sistema MUST apresentar toda a sua interface em português,
  empregando os termos canônicos de `CONTEXT.md` e MUST NOT empregar os
  sinônimos listados como `_Avoid_`.
- **FR-078**: O sistema MUST NOT devolver a Senha em nenhuma leitura, MUST NOT
  exibi-la de volta, MUST NOT registrá-la em log e MUST NOT gravá-la no
  navegador.
- **FR-079**: O sistema MUST NOT criar sessão, cookie ou token.
- **FR-089**: A Credencial MUST permanecer apenas na memória da página aberta e
  MUST acompanhar cada operação; fechar ou recarregar a página MUST exigir novo
  Entrar, e cada aba aberta MUST manter a sua própria Credencial.
- **FR-090**: Toda operação da feature MUST exigir Credencial válida; sem
  Credencial ou com Credencial inválida, a operação MUST ser recusada e MUST NOT
  alterar nada.
- **FR-091**: Quando uma operação for recusada por Credencial, a interface MUST
  descartar a Credencial e MUST voltar a "Entrar" com mensagem que explique a
  recusa, e MUST NOT apresentar a operação como concluída.

**Seção Minha conta (em Preferências)**

- **FR-257**: O sistema MUST oferecer, para a pessoa que Entrou, a seção "Minha
  conta" dentro da tela Preferências (`015`, FR-212), alcançada pela navegação
  principal, exibindo o Nome de usuário atual e as ações Alterar Nome de
  usuário, Trocar Senha e "Excluir conta". A navegação principal MUST NOT ganhar
  destino novo.
- **FR-258**: A seção "Minha conta" MUST NOT exibir, devolver ou oferecer
  qualquer caminho de recuperação da Senha atual ou anterior, observando
  FR-078.

**Alterar Nome de usuário**

- **FR-259**: O sistema MUST exigir a Senha atual para alterar o Nome de
  usuário.
- **FR-260**: O novo Nome de usuário MUST seguir todas as regras de `007`:
  espaços ao redor descartados, de 3 a 50 caracteres, apenas letras de A a Z
  sem acento, dígitos, `.`, `_` e `-`, e único sem distinção entre maiúsculas e
  minúsculas (FR-073, FR-074).
- **FR-261**: O sistema MUST recusar o novo Nome de usuário igual ao atual, com
  explicação, sem aplicar mudança.
- **FR-262**: O sistema MUST recusar o novo Nome de usuário já existente para
  outro Usuário, mesmo diferindo apenas em maiúsculas e minúsculas, com a
  mensagem clara de `007`.
- **FR-263**: Concluída a alteração, o sistema MUST substituir, na memória da
  página aberta, a Credencial atual pelo novo Nome de usuário acompanhado da
  mesma Senha, permitindo que a pessoa siga usando a aplicação sem Entrar de
  novo.
- **FR-264**: Qualquer outra página ou navegador com a Credencial antiga MUST
  ser recusado na próxima operação, MUST voltar a "Entrar" com mensagem
  explicativa e MUST NOT alterar nada (FR-091, FR-157 de `012`).
- **FR-265**: Após a alteração, o Nome de usuário anterior MUST ficar livre
  para um futuro Cadastro.

**Trocar Senha**

- **FR-266**: O sistema MUST exigir a Senha atual, uma nova Senha e a
  Confirmação da Senha para trocar a Senha.
- **FR-267**: A nova Senha MUST seguir todas as regras de `007`: de 8 a 128
  caracteres, qualquer caractere, espaços preservados, sem regras de composição
  (FR-075).
- **FR-268**: O sistema MUST recusar a nova Senha igual à atual, com
  explicação, sem aplicar mudança.
- **FR-269**: O sistema MUST recusar quando a nova Senha e sua Confirmação
  forem diferentes, sem enviar (FR-072).
- **FR-270**: Concluída a troca, o sistema MUST substituir, na memória da
  página aberta, a Credencial atual pela nova Senha acompanhada do mesmo Nome
  de usuário, e MUST aplicar às demais páginas o mesmo efeito de FR-264.
- **FR-271**: Os campos de Senha da feature MUST ser mascarados, com recurso de
  mostrar/ocultar conforme FR-142 de `012`.

**"Excluir conta"**

- **FR-272**: O sistema MUST oferecer "Excluir conta" como ação perigosa com
  diálogo de confirmação, conforme FR-159 de `012`, que anuncia a
  irreversibilidade e apresenta as contagens do que será removido: Cartões,
  Baralhos, Registros de sessão e, quando a feature `016` existir, dados da
  Agenda de estudo.
- **FR-273**: O diálogo de exclusão MUST exigir a digitação da Senha atual.
- **FR-274**: A exclusão MUST ser definitiva e MUST remover o Usuário e todos
  os seus dados: Cartões, Baralhos, Vínculos, Registros de sessão e Histórico
  de estudo, Preferências, Agendamentos do cartão e, quando a feature `016`
  existir, Rotinas de estudo, Compromissos de estudo e vínculos com Registros
  de sessão.
- **FR-275**: Após a exclusão, nada do Usuário removido MUST permanecer
  acessível, e os demais Usuários e os dados deles MUST permanecer exatamente
  como estavam.
- **FR-276**: Concluída a exclusão, a Credencial MUST ser descartada e a tela
  MUST ir para "Entrar" com a mensagem "Conta excluída".
- **FR-277**: Após a exclusão, o Nome de usuário MUST ficar livre para um novo
  Cadastro, e nenhum dado do Usuário anterior MUST aparecer nessa nova conta.
- **FR-278**: Qualquer outra página ou navegador com a Credencial do Usuário
  excluído MUST ser recusado na próxima operação, MUST voltar a "Entrar" com
  mensagem explicativa e MUST NOT alterar nada (FR-091).

**Re-confirmação, resultado incerto e concorrência**

- **FR-279**: Senha atual incorreta em qualquer das três ações MUST produzir
  uma única mensagem de recusa, sem expor a Senha, qualquer derivado ou
  informação sobre outro Usuário, sem alterar nada e sem descartar o que foi
  digitado, exceto os campos de Senha.
- **FR-280**: Quando o resultado de uma alteração ou de uma exclusão não puder
  ser confirmado, a interface MUST NOT apresentar sucesso nem falha e MUST
  determinar o resultado real antes de informar (FR-044).
- **FR-281**: A determinação do resultado MUST consistir em verificar qual
  Credencial é aceita agora — a nova ou a antiga — e, no caso de exclusão, se a
  Credencial antiga ainda é aceita, reportando o resultado real.
- **FR-282**: Se a determinação for também impossível, a interface MUST
  informar que o resultado é desconhecido e MUST oferecer Tentar novamente e ir
  a "Entrar".
- **FR-283**: Uma nova tentativa após resultado incerto MUST NOT aplicar a
  mudança duas vezes nem excluir outra conta.
- **FR-284**: Duas páginas alterando o mesmo Usuário em paralelo: a primeira
  mudança confirmada vence; a outra MUST ser recusada por Credencial na próxima
  operação, seguindo FR-264 ou FR-278.

**Acessibilidade, integridade e escopo**

- **FR-285**: Todas as telas da feature MUST seguir `012` — teclado, foco,
  leitor de tela, larguras de 360 a 1440 px, zoom de 200 % e alvos de 44 px.
- **FR-286**: Alterações não salvas MUST exigir confirmação de descarte ao
  sair, conforme FR-148 de `012`.
- **FR-287**: O sistema MUST NOT oferecer administrador nem qualquer forma de
  consultar ou operar a conta de outro Usuário.
- **FR-288**: As regras de Nome de usuário, de Senha e de exclusão MUST ser
  validadas de forma autoritativa, inclusive quando a operação não parte da
  interface.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-258 | A Senha nunca é exibida ou recuperada na seção "Minha conta" | Teste que inspeciona todos os campos e leituras da tela e exige ausência da Senha e de qualquer derivado, e que exige ausência de qualquer caminho de recuperação |
| FR-275 | Nada da conta excluída permanece, e outras contas não mudam | Teste com dois Usuários que exclui um deles e exige ausência total de qualquer dado dele em todas as leituras, e integridade total do outro, incluindo Cartões, Baralhos, Vínculos, Registros de sessão, Preferências e Agendamentos |
| FR-259, FR-266, FR-273 | Toda alteração e a exclusão exigem a Senha atual | Teste que tenta cada ação sem Senha atual ou com Senha atual errada e exige recusa sem qualquer mudança |
| FR-279 | Senha atual errada usa mensagem única sem expor dados | Teste que compara a recusa de cada ação com Senha errada, exige mensagem única entre as ações e ausência de Senha, derivado ou informação sobre outro Usuário |
| FR-280 | Nunca há sucesso ou falha anunciados sem confirmação | Teste com falha de conexão que exige ausência de qualquer anúncio antes da verificação de estado |
| FR-283 | Nova tentativa não duplica efeito | Teste que repete a mesma alteração e a mesma exclusão após resultado incerto e confere contagens, identidade e ausência de exclusão de outra conta |
| FR-287 | Não existe administrador nem acesso a contas alheias | Teste que percorre toda a interface e as leituras e exige ausência de qualquer operação sobre outro Usuário, e teste de requisição fora da interface que exige recusa |

### Key Entities

- **Usuário**: quem se cadastrou na `007` e Entra. É identificado pelo Nome de
  usuário único e tem a Senha guardada apenas como transformação irreversível
  (FR-076). É o dono do acervo, do Histórico de estudo, das Preferências e do
  Agendamento do cartão.
- **Rótulos "Minha conta" e "Excluir conta"**: são apenas rótulos de interface
  para o Usuário e tudo o que lhe pertence — Cartões, Baralhos, Vínculos,
  Registros de sessão e Histórico de estudo, Preferências, Agendamentos do
  cartão e, quando existir, Agenda de estudo —, como "Criar conta" rotula o
  Cadastro em `007`. O termo de domínio continua sendo Usuário (`CONTEXT.md`).
- **Credencial**: o par Nome de usuário e Senha mantido apenas na memória da
  página aberta (FR-089). É substituída ao alterar Nome de usuário ou Senha,
  descartada ao Sair, ao recarregar e ao excluir o Usuário, e recusada assim que
  uma alteração ou exclusão em outra página a torna inválida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-105**: Em cem por cento das exclusões, nenhum dado do Usuário removido
  permanece em nenhuma leitura e nenhum dado de outro Usuário é alterado,
  verificado com dois Usuários com acervo, Vínculos e Registros de sessão.
- **SC-106**: Depois de qualquer alteração de Nome de usuário ou de Senha, a
  Credencial antiga é recusada em cem por cento das tentativas em outras páginas
  e a nova é aceita em cem por cento das tentativas, sem novo Entrar na página
  que fez a alteração.
- **SC-107**: Senha atual errada em qualquer das três ações não altera o Nome
  de usuário, a Senha ou a existência do Usuário em cem por cento das tentativas,
  e as mensagens de recusa das três ações são idênticas.
- **SC-108**: A exclusão de um Usuário com 2.000 Cartões e 500 Registros de
  sessão é confirmada em menos de cinco segundos no ambiente local de aceite,
  ou não é aplicada em absoluto, sem estado parcial.
- **SC-109**: Todos os fluxos da feature podem ser concluídos apenas por
  teclado, com o elemento focado identificável sem percepção de cor em cem por
  cento dos passos, e permanecem utilizáveis em 360, 390, 768 e 1440 px e zoom
  de 200 %.
- **SC-110**: Nenhum fluxo da feature apresenta sucesso ou falha antes de o
  estado real ter sido confirmado, em cem por cento dos cenários de resultado
  incerto.
- **SC-111**: Em cem por cento das exclusões, o Nome de usuário fica livre para
  um novo Cadastro e nenhum dado do Usuário anterior aparece na nova conta.
- **SC-112**: Nome de usuário novo igual ao atual ou já existente para outro
  Usuário, mesmo diferindo só em maiúsculas e minúsculas ou em espaços ao
  redor, é recusado em cem por cento das tentativas, com as mensagens de `007`.
- **SC-113**: As contagens exibidas no diálogo de exclusão conferem
  integralmente com o que é removido, em cem por cento dos cenários,
  considerando as features `016` ausente e presente.

## Invariantes de Domínio

1. O Nome de usuário é único sem distinção entre maiúsculas e minúsculas e
   segue as regras de `007`; alterá-lo nunca cria dois Usuários com o mesmo
   nome.
2. A Senha nunca é legível, nem no armazenamento, nem em leitura, nem exibida
   na tela, nem recuperável por qualquer caminho da interface.
3. Uma conta excluída não deixa rastro: nenhum dado do Usuário removido
   permanece acessível, e nenhum outro Usuário é afetado.
4. Toda operação da feature é executada apenas sobre a própria conta; não há
   administrador nem acesso a outro Usuário.
5. A Credencial é substituída em memória quando o Nome de usuário ou a Senha
   muda, e é descartada na exclusão; nenhuma outra página continua a valer.
6. Nenhum sucesso persistente é anunciado antes da confirmação; resultado
   incerto é verificado antes de ser informado e uma nova tentativa nunca
   aplica a mudança duas vezes.
7. Toda ação da feature é executável por teclado, e nenhum estado relevante é
   comunicado apenas por cor.

## Funcionalidades Adiadas

- Recuperação de Senha esquecida.
- Exportação dos dados do Usuário antes de excluir.
- Período de carência, desfazer exclusão e restauração de conta excluída.
- Administrador ou qualquer forma de acessar outro Usuário.
- Limite de tentativas de Senha e bloqueio temporário.
- E-mail e verificação em duas etapas.
- Auditoria das ações sobre o Usuário e notificação à pessoa sobre alterações.
- Troca de Nome de usuário ou Senha sem a Senha atual.

## Assumptions

- A re-confirmação por Senha atual foi a escolha do Arquiteto para as três
  ações. Não existe caminho alternativo de confirmação nesta entrega.
- A Credencial da própria página que alterou Nome de usuário ou Senha é
  substituída em memória, sem exigir novo Entrar. A substituição é o que
  mantém a pessoa usando a aplicação de forma contínua, ao custo de outras
  páginas com a Credencial antiga serem recusadas, como em `008`.
- As contagens do diálogo de exclusão existem para dar dimensão do que será
  removido. Números exatos dependem do acervo e do Histórico no momento da
  exclusão.
- Não existe administrador nem qualquer forma de operar a conta de outro
  Usuário. As regras de `008` sobre acervo por usuário continuam valendo.
- As regras de Nome de usuário e de Senha de `007` são aplicadas integralmente
  nesta feature, sem afrouxamento nem exceção, inclusive na alteração de Nome
  de usuário e na troca de Senha.
- Arquitetura, contratos, modelo de persistência e estratégia de testes
  pertencem ao `plan`. Esta spec não fixa tecnologia, protocolo ou framework.
