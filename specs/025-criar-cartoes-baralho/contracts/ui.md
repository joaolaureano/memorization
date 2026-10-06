# Contract — Fluxos de Cartões no Baralho

## Navegação e detalhe

- A navegação principal mantém Início, Estudo, Baralhos e Perfil; Cartões deixa de ser destino de primeiro nível.
- A página de Baralho permanece em `#/baralhos/{id}` e apresenta nome, contagem, Revisar, criar Cartão, editar/excluir Baralho e a lista contextual.
- Cada linha de Cartão apresenta Frente e Verso, editar e excluir. Não existe desvincular.
- Estado vazio oferece Criar Cartão nesse Baralho. Erro de leitura distingue Baralho inexistente e indisponibilidade e oferece nova tentativa.
- Criar/editar reutiliza o formulário existente, agora sob o contexto de `baralhoId`. Sucesso volta ao detalhe; cancelamento e proteção de saída mantêm o padrão atual.

## Frente repetida

- Criação manual com Frente repetida no mesmo Baralho salva com o próximo contador livre (`Nome`, `Nome (2)`, `Nome (3)`), sem mudar o Verso, e anuncia a Frente resultante.
- Cópias de transição/salvamento usam a mesma regra em ordem estável.
- Edição que colide é recusada; o texto digitado permanece e o foco vai à Frente.
- Colisão compara texto aparado, sem distinguir caixa ou acento.

## Transição legada

- Após autenticação, se houver Cartões antigos sem Pertencimento, a navegação comum daquele Usuário aguarda a etapa de transição; nenhum Cartão fica inacessível.
- A tela lista somente Cartões que requerem escolha. Cartão avulso pede Baralho de destino; Cartão compartilhado pede qual Baralho conserva o original. Baralhos de destino vêm do acervo do Usuário.
- Confirmar aplica todas as escolhas de uma vez. Cópias exibem a Frente final com contador; o Cartão original e seu histórico permanecem no destino escolhido.
- Falha preserva escolhas e permite tentar novamente. Se não houver Baralho de destino, a pessoa precisa criar um antes de concluir.
- A tela é uma resolução de migração de uso único, não uma lista permanente de Cartões.

## Exclusão

- Excluir Cartão requer confirmação explícita e declara que o Cartão e seu Agendamento serão removidos; o Histórico já registrado permanece.
- Excluir Baralho informa a quantidade de Cartões e Agendamentos que serão removidos; cancelar preserva tudo.
- Falhas não removem itens da tela nem anunciam sucesso. Foco retorna ao acionador ou ao título se o acionador deixou de existir.

## Consistência visual e acessibilidade

Reutilizar a moldura, tokens, listas compactas, botões, tipografia e estilos de foco de `frontend/src/estilos.css`. Sem nova paleta ou componente decorativo. Ações mantêm os nomes e hierarquia do produto, alvos mínimos de 44 × 44 px, operação completa por teclado, foco visível e anúncios acessíveis. Validar 360, 390, 768 e 1440 px e zoom CSS de 200%; revisão manual de zoom nativo/leitor de tela continua necessária.