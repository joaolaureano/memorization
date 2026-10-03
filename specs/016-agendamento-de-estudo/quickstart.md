# Quickstart: Agenda

Guia de validação da implementação autorizada em 2026-10-03.

## Pré-requisitos

Node >=24, dependências já instaladas nos pacotes raiz/backend/frontend e
Chromium do Playwright. O teste PostgreSQL usa o harness embutido existente.

## Verificações

```sh
rtk proxy npm run typecheck --prefix backend
rtk proxy npm run lint --prefix backend
rtk npm test --prefix backend
rtk proxy npm run lint --prefix frontend
rtk npm test --prefix frontend
rtk proxy npm run build --prefix frontend
rtk proxy npx playwright test --config=e2e/playwright.config.ts e2e/agendamento-de-estudo.spec.ts
```

## Percurso de aceite

1. Entrar; criar Baralho com três Cartões; em Início abrir Agendar estudo.
2. Selecionar hoje e outro dia, quantidade 2; salvar e confirmar 0 de 1 hoje.
3. Estudar pelo Compromisso, revelar e avaliar os dois Cartões; voltar a Início
   e conferir 1 de 1, Ver Sessão e Histórico atualizado.
4. Reabrir em outro navegador com o mesmo Usuário: dados persistem. Com outro
   Usuário, a Agenda não expõe a Rotina ou o Registro.
5. Editar dias/quantidade, pausar/retomar, excluir; conferir passado preservado.
6. Simular falha/reenvio e duas abas: nenhum sucesso parcial ou duplicação.
7. Conferir datas próximas de meia-noite, fuso e semana anterior/seguinte no
   harness com relógio controlado; consultar contrato para os dados.
8. Repetir criação/estudo por teclado e em 360/390/768/1440 px; nomes longos,
   texto de 1000 caracteres e zoom 200% permanecem utilizáveis.

Esperados completos em spec.md, matriz em checklists/requirements.md.
