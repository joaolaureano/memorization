# Quickstart: verificar Gerenciar conta do Usuário

Este roteiro é manual e de aceite. Ele não implementa nada; verifica FR-257..FR-288 e SC-105..SC-113 na aplicação local.

## Pré-requisitos

- Backend local com SQLite e frontend Vite em execução.
- Dois Usuários cadastrados: `ana` e `bruno`, cada um com pelo menos um Baralho, Cartões, um Vínculo e um Registro de sessão.
- Para SC-108, semear 2.000 Cartões e 500 Registros de sessão para um dos Usuários no ambiente de teste.
- Opcional: feature 016 presente para conferir contagens e remoção da Agenda; ausente para conferir `agenda: null`.

## 1. Consultar Minha conta (FR-257, FR-258; SC-109)

1. Entrar como `ana`.
2. Abrir Preferências pela navegação principal.
3. Conferir a seção «Minha conta» com o Nome de usuário `ana` e as ações Alterar Nome de usuário, Trocar Senha e Excluir conta.
4. Inspecionar todos os campos e leituras: nenhum mostra Senha atual, anterior ou derivado; nenhum caminho oferece recuperação.
5. Sem Credencial, tentar abrir Minha conta: a operação é recusada e a aplicação segue FR-091.

## 2. Alterar Nome de usuário (FR-259..FR-265; SC-106, SC-112)

1. Com `ana` Entrada, abrir Alterar Nome de usuário.
2. Informar Senha atual errada: recusa com a mensagem única; nada muda; o formulário preserva o digitado, exceto Senha (FR-279, SC-107).
3. Informar Senha atual correta e o mesmo nome `ana`: recusa `mesmo_nome`; nada muda.
4. Informar `bruno`: recusa `nome_indisponivel`, inclusive se digitado `BRUNO` ou ` bruno ` (FR-262, SC-112).
5. Informar `ana-nova`: sucesso; a pessoa continua Entrada sem novo Entrar; a Credencial em memória passa a `ana-nova` (FR-263, SC-106).
6. Em outra janela com a Credencial `ana`, tentar qualquer operação: recusa por Credencial, volta a Entrar com mensagem e nada muda (FR-264, SC-106).
7. Cadastrar `ana` como novo Usuário: aceito como nome livre, sem dados antigos (FR-265, SC-111).

## 3. Trocar Senha (FR-266..FR-271; SC-106, SC-107)

1. Entrar como `ana-nova`.
2. Abrir Trocar Senha.
3. Informar Senha atual errada: recusa única; nada muda (FR-279, SC-107).
4. Informar nova Senha igual à atual: recusa `mesma_senha` (FR-268).
5. Informar nova Senha e Confirmação diferentes: recusa sem enviar; o foco vai para a Confirmação (FR-269).
6. Informar nova Senha com menos de 8 ou mais de 128 caracteres: recusa com a regra de 007 e campo identificado (FR-267).
7. Informar Senha atual correta, nova Senha válida e Confirmação igual: sucesso; a pessoa continua sem novo Entrar; a Credencial em memória é substituída (FR-270, SC-106).
8. Em outra janela com a Senha antiga, tentar operação: recusa por Credencial e volta a Entrar (FR-270, SC-106).
9. Entrar com a nova Senha: funciona. Com a antiga: falha (SC-106).

## 4. Excluir conta (FR-272..FR-278; SC-105, SC-108, SC-111, SC-113)

1. Entrar como `ana-nova`, que tem acervo, Vínculos e ao menos um Registro de sessão.
2. Acionar Excluir conta: o diálogo anuncia irreversibilidade e mostra contagens de Cartões, Baralhos, Registros de sessão e Agenda (ou `null`/ausente se 016 não existir) (FR-272, SC-113).
3. Informar Senha atual errada: recusa única; nada muda; o formulário preserva o digitado, exceto Senha (FR-279, SC-107).
4. Confirmar com Senha atual correta: a conta é excluída, a Credencial é descartada e a tela vai a Entrar com «Conta excluída» (FR-276).
5. Verificar que nada de `ana-nova` permanece em nenhuma leitura e que `bruno`, seus Cartões, Baralhos, Vínculos, Registros, Preferências e Agendamentos estão exatamente como estavam (FR-275, SC-105).
6. Cadastrar `ana-nova` de novo: aceito, sem dados da conta anterior (FR-277, SC-111).
7. Em outra página com a Credencial antiga, tentar operação: recusa por Credencial, volta a Entrar com mensagem e nada muda (FR-278, SC-106).
8. Para SC-108, repetir com o Usuário que tem 2.000 Cartões e 500 Registros: a exclusão é confirmada em menos de 5 s no ambiente local, ou não é aplicada em absoluto, sem estado parcial.

## 5. Resultado incerto (FR-280..FR-283; SC-110)

1. Simular perda de conexão imediatamente após enviar Alterar Nome de usuário, Trocar Senha ou Excluir conta.
2. A interface não anuncia sucesso nem falha antes da verificação.
3. Ela verifica com `POST /entrar`: tenta a Credencial nova e depois a antiga, ou, na exclusão, confere se a antiga ainda é aceita.
4. Se a operação foi aplicada, reporta aplicada e substitui a Credencial em memória quando for o caso.
5. Se não foi aplicada, reporta que nada mudou e oferece Tentar novamente.
6. Se a verificação falhar, reporta «resultado desconhecido» com Tentar novamente e Ir para Entrar.
7. Repetir a operação após resultado incerto: nunca aplicar duas vezes e nunca excluir outra conta (FR-283).

## 6. Acessibilidade e responsividade (FR-285, FR-286; SC-109)

- Concluir todos os fluxos apenas por teclado, com foco identificável sem depender de cor.
- Alternar mostrar/ocultar cada campo de Senha pelo teclado (FR-271).
- Verificar 360, 390, 768 e 1440 px e zoom de 200 %.
- Ao sair com alterações não salvas, exigir confirmação de descarte (FR-286).

## 7. Critérios de aceite cobertos

- SC-105: exclusão sem rastro e outro Usuário intacto.
- SC-106: Credencial antiga recusada, nova aceita, sem novo Entrar na página que alterou.
- SC-107: Senha atual errada não muda nada e mensagens idênticas nas três ações.
- SC-108: exclusão de 2.000 Cartões + 500 Registros em menos de 5 s ou nada.
- SC-109: teclado, foco identificável, 360/390/768/1440 px e zoom 200 %.
- SC-110: nenhum anúncio antes da confirmação do estado real.
- SC-111: Nome de usuário livre após exclusão e sem dados antigos.
- SC-112: nome igual/ocupado recusado com mensagens de 007.
- SC-113: contagens do diálogo conferem com o removido, com 016 ausente ou presente.
