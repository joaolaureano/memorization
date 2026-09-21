# Quickstart — Validação da feature Vincular Cartão a Baralho


> **Portões atualizados pela `009-porta-de-persistencia`**: no backend, a
> verificação de tipos passou a ser `npm run typecheck`, e `npm run build` exige
> `--banco`; o portão local é `npm run typecheck && npm run build:local`.

## Pré-requisitos

Os mesmos de [`001`](../001-criar-cartao/quickstart.md). Esta feature altera o
esquema: valide também o caminho de migração.

## Executar e verificar

```bash
cd backend && npm install && npm test && npm run typecheck && npm run build:local && npm run lint
cd frontend && npm install && npm test
npm run test:e2e
```

## Roteiro de validação manual

Prepare um Cartão e um Baralho, pelas features `001` e `002`.

1. Vincular o Cartão ao Baralho. O Cartão passa a constar entre os Cartões do
   Baralho, o Baralho entre os Baralhos do Cartão, e o Baralho **torna-se
   elegível**. → FR-019, FR-024
2. Tentar vincular o mesmo par de novo. **Recusado.** → FR-020
3. Repetir a tentativa **fora da interface**, direto na API. Também recusada,
   com `409`. → FR-023, SC-009
4. Desvincular. Cartão e Baralho continuam existindo, e **nenhuma confirmação é
   pedida**. → FR-021, FR-066
5. Desvincular o último Cartão de um Baralho. Ele deixa de ser elegível e
   continua existindo. → FR-024
6. Vincular um Cartão a 20 Baralhos, e um Baralho a 60 Cartões. Todos aceitos.
   → FR-022
7. Abrir a lista de Cartões. Um Cartão sem nenhum Baralho aparece com a lista de
   Baralhos vazia, e continua alcançável. → FR-003, SC-006
8. Com nenhum Cartão criado, abrir a tela de Vínculos. O estado vazio **explica
   que é preciso criar um Cartão antes**. → FR-062
9. Com nenhum Baralho criado, abrir a tela de Vínculos. O estado vazio explica
   que é preciso criar um Baralho antes. → FR-062
10. Com todos os Cartões já vinculados ao Baralho, abrir a tela. A situação é
   comunicada e **distinguida** do caso anterior. → FR-062
11. Vincular e desvincular **apenas por teclado**. O foco permanece em posição
   previsível após cada operação, e não volta ao início da lista.
    → FR-063, FR-064, SC-019
12. Com leitor de tela, conferir que vincular, desvincular e a mudança de
   elegibilidade são anunciados. → FR-065
13. Parar a API e tentar vincular e desvincular. Ambas as falhas são reportadas,
   sem exibir um Vínculo inexistente nem ocultar um Vínculo que continua
   existente. → FR-044, FR-045, SC-012
14. Fechar os dois processos, reabrir, conferir que os Vínculos persistem.
    → FR-040, SC-003
15. Conferir que a tela de Vínculos é utilizável em largura de telefone.
    → FR-042

## Roteiro de validação da cascata

Esta é a garantia mais importante da feature, e ela precisa ser exercida antes
de a feature `006` existir.

1. Vincular um Cartão a dois Baralhos.
2. Excluir o Cartão **direto no banco**, com `DELETE FROM cartao WHERE id = ?`.
3. Conferir que os dois Baralhos **sobrevivem** e que as linhas de `vinculo`
   sumiram.
4. Repetir no sentido inverso: excluir um Baralho e conferir que os Cartões
   sobrevivem.
5. Conferir que `PRAGMA foreign_keys` está **ligado**. Se estiver desligado, o
   SQLite ignora as cascatas em silêncio e os passos 3 e 4 passam por engano,
   deixando linhas órfãs.

## Roteiro de validação da migração

1. Partir de um arquivo SQLite da feature `002`, com Cartões e Baralhos reais.
2. Subir esta feature sobre ele e conferir que a tabela `vinculo` passou a
   existir, **sem perder nenhum Cartão nem Baralho**.
3. Subir de novo e conferir que a migração não roda uma segunda vez.

## Referências

- [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md)
- [data-model.md](./data-model.md) · [contracts/api-vinculos.md](./contracts/api-vinculos.md)
