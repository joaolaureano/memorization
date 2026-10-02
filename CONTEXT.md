# Memorization

Estudo por flashcards: registrar conteúdo a memorizar, agrupá-lo por assunto e
exercitá-lo em sessões de recordação ativa com autoavaliação.

## Language

### Conteúdo

**Cartão**:
Unidade de conteúdo a memorizar, composta de uma frente e um verso. Existe por
si e pode ser vinculado a vários baralhos, ou a nenhum.
_Avoid_: card, flashcard, pergunta, item

**Frente**:
O conteúdo que o usuário tenta recordar.
_Avoid_: pergunta, enunciado, anverso, título, nome

**Verso**:
O conteúdo associado à frente, exibido após a tentativa de recordação.
_Avoid_: resposta, solução, gabarito

**Baralho**:
Agrupamento nomeado de cartões vinculados sobre um mesmo assunto.
_Avoid_: deck, coleção, pasta, categoria

**Vínculo**:
A associação entre um cartão e um baralho, criada e desfeita independentemente
da existência de ambos. Um cartão se vincula a um mesmo baralho no máximo uma vez.
_Avoid_: link, associação, relação, pertencimento, configuração

**Baralho elegível**:
Baralho que tem ao menos um cartão vinculado e por isso pode originar uma sessão
de estudo.
_Avoid_: baralho válido, baralho pronto, baralho ativo

### Estudo

**Sessão de estudo**:
Execução em que cartões de um único baralho são revisados um a um até o resumo.
Concluída, vira um registro de sessão; interrompida, é descartada sem deixar
rastro.
_Avoid_: revisão, treino, rodada, prática

**Item de estudo**:
A apresentação de um cartão dentro de uma sessão, com sua própria revelação e seu
próprio resultado.
_Avoid_: questão, pergunta, rodada, card da sessão

**Revelação**:
Ação explícita do usuário que exibe o verso de um item.
_Avoid_: virar, flip, mostrar resposta

**Resultado do item**:
Declaração do próprio usuário, acertou ou errou, sobre sua recordação de um item.
A aplicação registra a declaração; não avalia a resposta.
_Avoid_: nota, correção, avaliação, score, métrica

**Resumo da sessão**:
Consolidação final de quantos itens foram estudados, quantos acertos e quantos
erros, com a lista dos cartões acertados e dos errados. Exibido ao fim da
sessão e guardado no registro da sessão.
_Avoid_: relatório, placar

**Registro de sessão**:
Memória permanente de uma sessão concluída: quando terminou, de qual baralho e o
resultado de cada item, com a frente, o verso e o nome do baralho como eram
naquele momento. Editar ou excluir cartões e baralhos depois não o altera.
_Avoid_: log, entrada, histórico (para um único registro)

**Histórico de estudo**:
O conjunto dos registros de sessão de um usuário, do mais recente ao mais antigo.
_Avoid_: log, timeline, atividade

**Taxa de acerto**:
Acertos divididos pelos itens estudados de um conjunto de registros de sessão,
em percentual inteiro arredondado.
_Avoid_: score, nota, aproveitamento, desempenho

**Estatísticas**:
Números derivados do acervo e do histórico de estudo de um usuário, apresentados
na tela Início.
_Avoid_: métricas, dashboard, KPIs, relatório

### Acesso

**Usuário**:
Quem se cadastra na aplicação, identificado pelo nome de usuário.
_Avoid_: user, conta, perfil, account, cliente

**Nome de usuário**:
Identificador único do usuário, sem distinção entre maiúsculas e minúsculas.
_Avoid_: login, username, nick, apelido, identificação

**Senha**:
Segredo conhecido apenas pelo usuário. O sistema guarda somente uma
transformação irreversível dela, nunca a senha em si.
_Avoid_: password, palavra-passe, chave, código

**Cadastro**:
O ato de criar um usuário com nome de usuário e senha. Na interface, a ação é
rotulada "Criar conta".
_Avoid_: registro, signup, inscrição

**Credencial**:
Nome de usuário e Senha mantidos apenas na memória da página aberta,
apresentados a cada operação.
_Avoid_: token, sessão, cookie, login, crachá

**Entrar**:
O ato de apresentar a Credencial para acessar o próprio acervo.
_Avoid_: login, logar, autenticar-se, sign in

**Sair**:
Descartar a Credencial da memória.
_Avoid_: logout, deslogar, sign out
