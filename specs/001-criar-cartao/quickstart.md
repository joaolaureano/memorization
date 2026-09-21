# Quickstart — Validação da feature Criar Cartão

Como executar e comprovar que a feature funciona. Valida comportamento
observável; detalhes de implementação pertencem a `tasks.md`.


> **Portões atualizados pela `009-porta-de-persistencia`**: no backend, a
> verificação de tipos passou a ser `npm run typecheck`, e `npm run build` exige
> `--banco`; o portão local é `npm run typecheck && npm run build:local`.

## Pré-requisitos

- Node.js **24 ou superior**. A aplicação executa TypeScript nativamente, sem
  etapa de empacotamento, o que exige esse piso.
- Nenhum Docker, nenhum servidor de banco, nenhuma variável obrigatória.

## Executar

```bash
cd backend && npm install && npm run dev     # API em 127.0.0.1:3001
cd frontend && npm install && npm run dev    # interface, em outro terminal
```

## Verificações automatizadas

```bash
cd backend  && npm test && npm run typecheck && npm run build:local && npm run lint
cd frontend && npm test
npm run test:e2e
```

## Roteiro de validação manual

1. Com o acervo vazio, abrir a lista de Cartões. O estado vazio é comunicado e a
   primeira ação é orientada. → FR-043
2. Criar um Cartão com Frente `To walk` e Verso `Caminhar`. Ele aparece na
   lista, sem nenhum Baralho. → FR-001, FR-003, FR-004
3. Tentar criar com a Frente em branco. Recusado, indicando o campo que falta.
   → FR-002
4. Tentar criar com a Frente contendo apenas espaços. Recusado como vazia.
   → FR-051
5. Colar na Frente um texto acima de 1000 caracteres. Recusado, com o limite e o
   tamanho atual informados, e o conteúdo preservado. → FR-052
6. Digitar aproximando-se do limite. O aviso aparece **durante** a digitação.
   → FR-053
7. Criar dois Cartões com a mesma Frente. Ambos aceitos. → Invariante 2
8. Fechar os dois processos, reabrir, conferir que os Cartões persistem.
   → FR-040, SC-003
9. Percorrer a criação do primeiro campo ao salvamento **apenas por teclado**,
   com o foco sempre visível sem depender de cor. → FR-054, FR-055, SC-017
10. Provocar uma recusa e conferir que o foco vai ao campo a corrigir e que a
    mensagem é anunciada por leitor de tela. → FR-055, FR-056
11. Parar a API e tentar criar um Cartão. A operação é reportada como falha, não
    aparece como concluída, e o texto permanece. → FR-044, FR-045, SC-012
12. Com 50 Cartões, conferir que a lista permanece navegável sem busca nem
    paginação, e sem rolagem horizontal em largura de telefone.
    → FR-042, SC-011

## Verificação da garantia de loopback

```bash
cd backend && node src/index.ts &
lsof -nP -iTCP:3001 -sTCP:LISTEN     # deve mostrar 127.0.0.1:3001, nunca *:3001
curl -m 2 http://$(ipconfig getifaddr en0):3001/health   # deve ser recusado
```

Se alguma dessas duas falhar, a ausência de autenticação deixou de ser segura.

## Referências

- Requisitos e critérios: [spec.md](./spec.md)
- Modules, Interfaces e Seams: [plan.md](./plan.md)
- Decisões técnicas: [research.md](./research.md)
- Entidade e esquema: [data-model.md](./data-model.md)
- Rotas e erros: [contracts/api-cartoes.md](./contracts/api-cartoes.md)
