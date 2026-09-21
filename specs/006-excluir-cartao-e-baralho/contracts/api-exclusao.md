# Contract — Exclusão

## DELETE /cartoes/{id}

Retorna 204 sem conteúdo, ou 404 se Cartão inexistente. Remove somente Cartão e
Vínculos associados.

## DELETE /baralhos/{id}

Retorna 204 sem conteúdo, ou 404 se Baralho inexistente. Remove somente Baralho
e Vínculos associados.

A confirmação é exclusivamente da UI; as rotas não aceitam parâmetro que escolha
cascata. Mensagens de 404 seguem em português e o ClienteDoAcervo traduz falha
de transporte sem declarar sucesso.

