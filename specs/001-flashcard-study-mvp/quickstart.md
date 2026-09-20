# Quickstart — Validação do MVP de Estudo por Flashcards

Como executar a aplicação e comprovar que a feature funciona. Este guia valida
comportamento observável; detalhes de implementação pertencem a `tasks.md`.

## Pré-requisitos

- Node.js 22 LTS ou superior
- Nenhum Docker, nenhum servidor de banco, nenhuma variável de ambiente
  obrigatória

## Executar

```bash
# API — cria o arquivo SQLite na primeira execução
cd backend && npm install && npm run dev

# Interface, em outro terminal
cd frontend && npm install && npm run dev
```

A interface abre no navegador e conversa com a API local. Por serem dois
deployables, as duas execuções são necessárias.

## Verificações automatizadas

```bash
cd backend  && npm test    # Acervo pela sua Interface, SQLite em memória
cd frontend && npm test    # SessaoDeEstudo e telas
npm run test:e2e           # Playwright: teclado e persistência entre execuções
```

## Roteiro de validação manual

Segue as três histórias de usuário da spec, em ordem. Cada passo declara o que
comprova.

### História 1 — Registrar conteúdo e torná-lo estudável

1. Com o acervo vazio, abrir a lista de Cartões. Deve comunicar o estado vazio e
   orientar a primeira ação. → FR-043
2. Criar um Cartão com Frente `To walk` e Verso `Caminhar`. Ele aparece na lista
   **sem nenhum Baralho**. → FR-001, FR-003
3. Tentar criar um Cartão com a Frente em branco. A criação é recusada e a
   mensagem diz qual campo falta. → FR-002
4. Criar um Baralho chamado `Inglês`. Ele aparece como **não elegível**, e a
   razão é comunicada. → FR-010, FR-026
5. Criar um segundo Baralho também chamado `Inglês`. É aceito. → FR-012
6. Vincular o Cartão ao primeiro Baralho. O Baralho torna-se elegível, e o
   Cartão passa a exibir o Baralho. → FR-019, FR-024
7. Tentar vincular o mesmo Cartão ao mesmo Baralho de novo. Recusado. → FR-020
8. Fechar ambos os processos, reabrir e conferir que Cartão, Baralhos e Vínculo
   continuam lá. → FR-040, SC-003

### História 2 — Estudar um baralho e ver o resultado

Prepare um Baralho elegível com 5 Cartões.

1. Solicitar estudar `0` cartões. Recusado. → FR-028
2. Solicitar estudar `50`. A Sessão começa com 5 Itens e avisa a quantidade real
   antes do primeiro Item. → FR-029, SC-010
3. Iniciar com 3. Apenas a Frente do primeiro Item é exibida. → FR-032
4. Tentar registrar `acertou` sem revelar. Recusado. → FR-034
5. Revelar o Verso e registrar `acertou`. Tentar alterar para `errou`. Recusado.
   → FR-033, FR-035
6. Concluir os 3 Itens. O Resumo aparece com 3 estudados e a soma de acertos e
   erros igual a 3. → FR-037, SC-004
7. Repetir a Sessão com os 5 Cartões várias vezes: nenhum Cartão se repete
   dentro de uma Sessão, e a ordem varia entre Sessões. → FR-030, FR-031, SC-002
8. Iniciar uma Sessão e fechar o navegador no meio. Ao reabrir, **nenhum
   resumo, nenhum histórico, nenhuma sessão pendente** — apenas a opção de
   iniciar uma nova. → FR-038, FR-039, SC-008
9. Percorrer uma Sessão inteira, do primeiro Item ao Resumo, **usando apenas o
   teclado**. → FR-041, SC-007

### História 3 — Corrigir e descartar conteúdo

Prepare um Cartão vinculado a dois Baralhos.

1. Editar o Cartão. A tela informa que ele está em 2 Baralhos. Confirmar a
   alteração e conferir que vale nos dois. → FR-005, FR-006
2. Renomear um Baralho. Os Vínculos permanecem. → FR-015
3. Desvincular o Cartão de um Baralho. **Ambos continuam existindo.** → FR-021
4. Desvincular o último Cartão de um Baralho. Ele deixa de ser elegível e
   continua existindo. → FR-024
5. Excluir o Baralho restante. A confirmação informa quantos Cartões
   continuarão existindo. Após confirmar, **o Cartão continua na lista de
   Cartões**, agora sem nenhum Baralho. → FR-016, FR-017, SC-005, SC-006
6. Excluir um Cartão vinculado a Baralhos. **Nenhum Baralho é destruído.**
   → FR-008, SC-005
7. Solicitar uma exclusão e recusar a confirmação. Nada é excluído.

### Falha de persistência

1. Tornar o arquivo SQLite inacessível ou parar a API.
2. Tentar criar um Cartão. A operação é **reportada como falha**, a interface
   não a exibe como concluída, e o texto digitado permanece na tela para nova
   tentativa. → FR-044, FR-045, SC-012

### Escala

Com 50 Cartões e 10 Baralhos, as listas permanecem navegáveis e um item
conhecido é localizável visualmente, sem busca nem paginação. → SC-011

## Referências

- Requisitos e critérios: [spec.md](./spec.md)
- Modules, Seams e decisões estruturais: [plan.md](./plan.md)
- Entidades e esquema: [data-model.md](./data-model.md)
- Rotas e erros: [contracts/api-acervo.md](./contracts/api-acervo.md)
