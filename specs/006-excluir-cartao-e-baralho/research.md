# Phase 0 — Research: Excluir Cartão e Baralho

## Decisão — exclusão não atravessa entidades

A migração 3 já estabelece cascata apenas entre cada entidade e suas linhas de
Vínculo. Excluir Cartão ou Baralho remove seus Vínculos, nunca a entidade oposta.
A feature materializa essa garantia na Interface e nas rotas.

## Decisão — confirmação descreve consequência

Ambas exclusões exigem diálogo. Para Baralho, a mensagem informa quantos Cartões
sobreviverão; para Cartão, informa a remoção definitiva. Cancelar não chama o
Acervo. Falha de persistência não fecha o diálogo como sucesso.

## Omissões deliberadas

Sem lixeira, desfazer, lote, opção de cascata ou migração nova.

