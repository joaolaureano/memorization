# Contract — Edição

## PUT /cartoes/{id}

Recebe frente e verso; devolve o Cartão atualizado com 200, os mesmos erros de
conteúdo da criação com 400, ou 404 se ausente.

## PUT /baralhos/{id}

Recebe nome; devolve o Baralho atualizado com 200, erro de nome inválido com
400, ou 404 se ausente.

As mensagens são em português. Nenhuma rota altera Vínculos. Falha de transporte
é traduzida pelo ClienteDoAcervo em indisponibilidade, sem confirmar sucesso.

