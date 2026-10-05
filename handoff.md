# Handoff para revisão

## Objetivo

Revise nesta branch a implementação de “Revisar” baralhos e as mudanças relacionadas nas telas, protótipos e especificações. A branch contém a proposta da spec 024 e alterações na aplicação para:

- iniciar a revisão pelo botão “Revisar”;
- mostrar o estado do baralho como “Pendente”, “Revisado” ou “Sem cartões”;
- oferecer, para baralhos pendentes, a escolha entre revisar só pendentes ou todos os cartões; baralhos revisados iniciam todos diretamente;
- manter a seleção temporária e os fluxos de Agenda compatíveis com as regras existentes;
- mover o filtro de situação da revisão da listagem de cartões para a área de baralhos.

## Critérios de revisão

1. Compare o comportamento e a cobertura com `specs/024-revisar-baralhos/spec.md`, incluindo os critérios de aceite e as decisões registradas.
2. Verifique especialmente a definição de pendência (cartões novos ou com revisão vencida), baralhos vazios, embaralhamento, início e conclusão de sessão, atualização de agendamento e preservação dos fluxos da Agenda e do baralho temporário.
3. Confira consistência entre aplicação, testes E2E, protótipos em `design/` e documentação. Procure regressões nos filtros e nos fluxos de sessão existentes.
4. Rode as verificações aplicáveis e registre os comandos e resultados. Se encontrar problemas, corrija-os nesta branch quando forem claros e cobertos pelo escopo; caso contrário, deixe achados concretos com arquivo e linha.

## Ao concluir

Depois de terminar a revisão e registrar os resultados na branch, **apague este próprio arquivo `handoff.md` e inclua essa remoção no commit final da tarefa**. Não encerre a revisão deixando este arquivo na branch.
