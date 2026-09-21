# Feature Specification: Criar Usuário

**Feature Branch**: `007-criar-usuario`
**Created**: 2026-09-21
**Status**: Draft
**Input**: Pedido do Product Owner de autenticação com Usuário e Senha, decomposto
em duas features: `007-criar-usuario` (esta) e `008-entrar`. Glossário normativo
em `CONTEXT.md`.

**Depende de**: nenhuma feature. É independente de `001` a `006`.

## Clarifications

### Session 2026-09-21

- Q: Como a Senha deve ser guardada? → A: Nunca de forma recuperável. É
  transformada com um sal aleatório único por Usuário e um segredo do servidor
  mantido fora do repositório, para que um vazamento dos dados não permita
  capturá-la.
- Q: Existe sessão, cookie ou token? → A: Não. Nenhum desses mecanismos existe na
  aplicação.
- Q: Como um Usuário passa a existir? → A: Por uma tela de interface, rotulada
  "Criar conta".
- Q: Esta feature inclui entrar, sair ou acervo por usuário? → A: Não. Esses
  pertencem a `008-entrar`. Nesta feature, o restante da aplicação continua como
  está.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Criar o próprio Usuário (Priority: P1)

Uma pessoa cria seu Usuário informando Nome de usuário e Senha, repetindo a
Senha para confirmação, na tela "Criar conta". Ao concluir, a aplicação confirma
o Cadastro. O Usuário continua existindo depois que a aplicação é fechada e
reaberta.

**Why this priority**: é o primeiro passo do controle de acesso. Sem Usuário, a
feature `008-entrar` não tem quem autenticar.

**Independent Test**: cadastrar dois Usuários com Nomes de usuário distintos,
fechar e reabrir a aplicação, e confirmar que ambos continuam existindo, que
nenhuma leitura devolve a Senha e que nenhuma sessão, cookie ou token foi criado.

**Acceptance Scenarios**:

1. **Given** a tela "Criar conta", **When** ela é aberta, **Then** exibe os
   campos Nome de usuário, Senha e Confirmação da Senha, com os limites de cada
   um comunicados.
2. **Given** Nome de usuário válido e Senha válida, com Confirmação igual,
   **When** a pessoa conclui, **Then** o Usuário é criado e a tela confirma o
   Cadastro.
3. **Given** um Nome de usuário com menos de 3 ou mais de 50 caracteres, ou com
   caractere não permitido, **When** a pessoa tenta concluir, **Then** o
   Cadastro é recusado com mensagem que indica a regra violada.
4. **Given** uma Senha com menos de 8 ou mais de 128 caracteres, **When** a
   pessoa tenta concluir, **Then** o Cadastro é recusado com mensagem que indica
   o intervalo permitido.
5. **Given** Senha e Confirmação diferentes, **When** a pessoa tenta concluir,
   **Then** o Cadastro é recusado sem ser enviado, e o foco vai para a
   Confirmação.
6. **Given** um Usuário `Ana.Silva` existente, **When** a pessoa tenta cadastrar
   `ana.silva`, **Then** o Cadastro é recusado com mensagem clara de que o Nome
   de usuário já existe.
7. **Given** a pessoa digitando, **When** ela se aproxima do limite de algum
   campo ou o ultrapassa, **Then** o limite é comunicado durante a digitação, e
   não apenas ao tentar concluir.
8. **Given** a tela "Criar conta", **When** a pessoa usa apenas o teclado,
   **Then** alcança todos os campos e conclui o Cadastro, com o elemento focado
   sempre identificável sem depender de cor.
9. **Given** uma recusa, **When** a mensagem é exibida, **Then** ela é
   perceptível por leitor de tela e o foco vai para o campo que precisa de
   correção.
10. **Given** o armazenamento indisponível, **When** a pessoa tenta concluir,
    **Then** a falha é reportada, o Cadastro não aparece como concluído e o
    conteúdo digitado permanece para nova tentativa.
11. **Given** Usuários cadastrados, **When** a aplicação é fechada e reaberta,
    **Then** todos continuam existindo.
12. **Given** um Cadastro concluído, **When** qualquer leitura de Usuário é
    feita, **Then** nenhum retorno contém a Senha.

### Edge Cases

- **Espaços ao redor do Nome de usuário**: são descartados antes da validação.
  ` ana ` vira `ana`.
- **Espaços na Senha**: são permitidos e preservados, inclusive nas pontas.
- **Dois Usuários com a mesma Senha**: é permitido, e os dados armazenados não
  revelam que as Senhas coincidem.
- **Segredo do servidor ausente**: a aplicação recusa iniciar.
- **Requisição que não parte da interface**: as mesmas regras são aplicadas.

## Requirements *(mandatory)*

### Functional Requirements

**Transversais reutilizados**, com enunciado genérico e observáveis nesta
feature:

- **FR-040**: O sistema MUST preservar os Usuários entre execuções da
  aplicação.
- **FR-042**: O sistema MUST apresentar suas telas de forma utilizável em telas
  pequenas.
- **FR-044**: O sistema MUST NOT apresentar como concluída qualquer operação que
  não tenha sido efetivamente persistida.
- **FR-045**: Quando uma operação falhar por indisponibilidade do armazenamento,
  o sistema MUST reportar a falha e MUST preservar o conteúdo informado,
  permitindo nova tentativa sem redigitação.
- **FR-046**: O sistema MUST apresentar toda a sua interface em português,
  empregando os termos canônicos de `CONTEXT.md` e MUST NOT empregar os
  sinônimos listados como `_Avoid_`.

**Específicos desta feature**, por nomearem a entidade:

- **FR-070**: O sistema MUST validar as regras de Usuário de forma autoritativa,
  não apenas na camada de apresentação.
- **FR-071**: O sistema MUST permitir cadastrar um Usuário informando Nome de
  usuário e Senha, com a Senha repetida para confirmação.
- **FR-072**: O sistema MUST recusar o Cadastro quando a Senha e sua
  Confirmação forem diferentes, sem enviá-lo.
- **FR-073**: O sistema MUST descartar os espaços ao redor do Nome de usuário e
  MUST aceitar somente Nome de usuário de 3 a 50 caracteres, composto de letras,
  dígitos, `.`, `_` e `-`.
- **FR-074**: O sistema MUST recusar Nome de usuário já existente,
  desconsiderando a diferença entre maiúsculas e minúsculas, com mensagem clara
  de que ele já existe.
- **FR-075**: O sistema MUST aceitar somente Senha de 8 a 128 caracteres,
  admitindo qualquer caractere, e MUST NOT descartar espaços da Senha.
- **FR-076**: O sistema MUST armazenar a Senha apenas transformada de forma
  irreversível, com um sal aleatório único por Usuário e um segredo do servidor
  mantido fora do repositório. Os dados armazenados MUST NOT permitir recuperar
  a Senha nem revelar que dois Usuários têm a mesma Senha.
- **FR-077**: O sistema MUST recusar iniciar sem o segredo do servidor,
  informando claramente o que falta e MUST NOT exibir o valor do segredo.
- **FR-078**: O sistema MUST NOT devolver a Senha em nenhuma leitura, MUST NOT
  exibi-la de volta, MUST NOT registrá-la em log e MUST NOT gravá-la no
  navegador.
- **FR-079**: O sistema MUST NOT criar sessão, cookie ou token.
- **FR-080**: O sistema MUST comunicar os limites do Nome de usuário e da Senha
  **durante** a digitação, e não apenas ao tentar concluir.
- **FR-081**: O sistema MUST permitir concluir o Cadastro inteiramente por
  teclado, mantendo o foco visível com indicação que não dependa apenas de cor,
  e MUST mover o foco para o campo que precisa de correção quando o Cadastro for
  recusado.
- **FR-082**: As mensagens de recusa e de confirmação do Cadastro MUST ser
  perceptíveis por leitor de tela, e não apenas visualmente.
- **FR-083**: O sistema MUST confirmar a conclusão do Cadastro de forma
  explícita.

### Verificação dos Requisitos Negativos

| Requisito | Afirmação | Como é verificado |
|---|---|---|
| FR-076 | A Senha não é recuperável a partir dos dados armazenados | Após o Cadastro, teste que inspeciona os dados armazenados e exige que a Senha não apareça, e que dois Usuários com a mesma Senha tenham valores armazenados diferentes |
| FR-078 | A Senha nunca sai por leitura nem fica no navegador | Teste que executa todas as leituras de Usuário e exige ausência da Senha, e teste em navegador real que inspeciona o armazenamento do navegador após o Cadastro |
| FR-079 | Não existe sessão, cookie ou token | Teste em navegador real que, após o Cadastro, exige ausência de cookie e de qualquer valor gravado pelo navegador, e teste que exige que a resposta do Cadastro não contenha credencial reutilizável |
| FR-044 | Cadastro não persistido não aparece como concluído | Teste com armazenamento indisponível |

### Key Entities

- **Usuário**: quem se cadastra na aplicação. Nesta feature, apenas existe, é
  identificado pelo Nome de usuário e é preservado entre execuções.
- **Nome de usuário**: identificador único do Usuário, sem distinção entre
  maiúsculas e minúsculas.
- **Senha**: segredo conhecido apenas pelo Usuário. O sistema guarda apenas uma
  transformação irreversível dela.

## Success Criteria *(mandatory)*

- **SC-012**: Em cem por cento das falhas de gravação simuladas, nenhuma
  operação aparece como concluída e nenhum conteúdo informado é perdido.
- **SC-020**: O Cadastro pode ser concluído do primeiro campo à confirmação
  usando apenas o teclado, e o elemento focado é identificável sem percepção de
  cor em cem por cento dos passos.
- **SC-021**: Em cem por cento dos Usuários cadastrados, a Senha não aparece nos
  dados armazenados.
- **SC-022**: Para quaisquer dois Usuários com a mesma Senha, os valores
  armazenados são sempre diferentes.
- **SC-023**: Cem por cento dos Usuários cadastrados continuam presentes após
  fechar e reabrir a aplicação.
- **SC-024**: Em cem por cento das tentativas de iniciar sem o segredo do
  servidor, a aplicação recusa iniciar e informa o que falta.
- **SC-025**: Cem por cento das tentativas de cadastrar Nome de usuário já
  existente são recusadas, inclusive quando só diferem em maiúsculas e
  minúsculas.
- **SC-026**: Nenhum Usuário gravado viola as regras de Nome de usuário e
  Senha, inclusive quando a requisição não parte da interface.

## Invariantes de Domínio

1. O Nome de usuário é único sem distinção entre maiúsculas e minúsculas, tem de
   3 a 50 caracteres e usa apenas letras, dígitos, `.`, `_` e `-`.
2. A Senha tem de 8 a 128 caracteres e é guardada apenas transformada de forma
   irreversível.
3. Os dados armazenados não revelam a Senha nem a coincidência de Senhas.
4. Não existe sessão, cookie ou token.
5. Toda ação da feature é executável por teclado, e nenhum estado relevante é
   comunicado apenas por cor.

## Funcionalidades Adiadas

- Entrar, Sair, acervo por usuário e credencial em toda requisição — feature
  `008-entrar`.
- Recuperação e troca de Senha.
- Exclusão de Usuário.
- Bloqueio por tentativas.
- E-mail e verificação em duas etapas.

## Assumptions

- **A confirmar no clarify**: os limites do Nome de usuário (3 a 50 caracteres,
  letras, dígitos, `.`, `_`, `-`) e da Senha (8 a 128 caracteres), e o fato de a
  recusa de Nome de usuário duplicado revelar que ele existe. A revelação é
  inevitável num Cadastro aberto e é aceita nesta proposta.
- O segredo do servidor é fornecido pelo ambiente de execução, nunca por arquivo
  versionado (Princípio VIII).
- As premissas de `001-criar-cartao` valem: execução local, texto simples,
  persistência entre execuções.
- Esta feature não altera o comportamento de `001` a `006`.
