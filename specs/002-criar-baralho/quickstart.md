# Quickstart — Validação da feature Criar Baralho

## Pré-requisitos

Os mesmos de [`001`](../001-criar-cartao/quickstart.md): Node 24+, sem Docker,
sem servidor de banco.

**Atenção**: esta feature altera o esquema. Se você já usou a feature `001`,
existe base instalada — valide também o caminho de migração, no roteiro abaixo.

## Executar e verificar

```bash
cd backend && npm install && npm test && npm run build && npm run lint
cd frontend && npm install && npm test
npm run test:e2e
```

## Roteiro de validação manual

1. Sem nenhum Baralho, abrir a lista. O estado vazio é comunicado e a primeira
   ação é orientada. → FR-057
2. Criar um Baralho chamado `Inglês`. Ele aparece na lista e é indicado como
   **não elegível**, com a razão comunicada. → FR-010, FR-013, FR-026
3. Criar um segundo Baralho também chamado `Inglês`. **Aceito.** → FR-012
4. Tentar criar com nome vazio, e depois com nome só de espaços. Ambos
   recusados. → FR-011
5. Tentar criar com nome acima de 100 caracteres. Recusado, com o limite e o
   tamanho atual informados. → FR-061
6. Digitar aproximando-se do limite. O aviso aparece **durante** a digitação.
   → FR-061
7. Fechar os dois processos, reabrir, conferir que os Baralhos persistem.
   → SC-003
8. Percorrer a criação do campo ao salvamento **apenas por teclado**, com o foco
   sempre visível sem depender de cor. → FR-058, FR-059, SC-018
9. Provocar uma recusa e conferir que o foco vai ao campo a corrigir e que a
   mensagem é anunciada por leitor de tela. → FR-059, FR-060
10. Parar a API e tentar criar um Baralho. Reportado como falha, não aparece
    como concluído, e o texto permanece. → FR-044, FR-045, SC-012
11. Com 10 Baralhos, conferir que a lista permanece navegável sem busca nem
    paginação, e sem rolagem horizontal em largura de telefone.
    → FR-042, SC-011

## Roteiro de validação da migração

Este é o ponto mais arriscado da feature e não pode ser validado só por teste
unitário.

1. Partir de um arquivo SQLite produzido pela feature `001`, **com Cartões
   reais dentro**.
2. Subir a API desta feature sobre esse arquivo.
3. Conferir que a tabela `baralho` passou a existir.
4. **Conferir que nenhum Cartão foi perdido nem alterado.**
5. Subir a API de novo sobre o mesmo arquivo e conferir que a migração **não**
   roda uma segunda vez.
6. Partir de um arquivo inexistente e conferir que as duas migrações são
   aplicadas em ordem, resultando no mesmo esquema.

## Referências

- [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md)
- [data-model.md](./data-model.md) · [contracts/api-baralhos.md](./contracts/api-baralhos.md)
