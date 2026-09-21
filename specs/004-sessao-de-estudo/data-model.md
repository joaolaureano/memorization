# Phase 1 — Data Model: Sessão de Estudo

Não há entidade durável, tabela ou migração nesta feature.

| Conceito | Conteúdo | Vida útil |
|---|---|---|
| Sessão de estudo | Baralho de origem, ordem dos Itens e posição corrente | Do início ao Resumo ou interrupção |
| Item de estudo | Cópia de id, Frente, Verso, Revelação e Resultado opcional | Somente dentro da Sessão |
| Resultado do item | `acertou` ou `errou`, no máximo um por Item | Somente dentro da Sessão |
| Resumo da sessão | estudados, acertos e erros | Apresentação final; descartado ao sair |

Frente e Verso são copiados no início. Editar ou excluir depois não muda Itens
da Sessão ativa.

- quantidade é `min(solicitada, disponíveis)` e ao menos um;
- cada Cartão ocorre uma única vez;
- Resultado só existe após Revelação e não muda;
- Resumo só existe quando todos os Itens têm Resultado;
- nenhuma estrutura acima é gravada no SQLite.

