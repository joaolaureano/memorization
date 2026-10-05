# Tasks: Consistência entre Baralhos e Cartões

- [X] T2101 [US1] Baralhos: nome somente leitura, contagem visível, ações Estudar → Editar em frontend/src/ui/PaginaDeBaralhos.tsx; FR-340–343, FR-346.
- [X] T2102 [P] [US2] Cartões: só o título (Frente) e as ações Excluir → Editar em frontend/src/ui/PaginaDeCartoes.tsx, preservando exclusão/foco/anúncio; FR-344, FR-345.
- [X] T2103 [US3] Linha de lista comum em frontend/src/estilos.css (`linha-da-lista*`), removendo `linha-de-baralho*`; FR-339, FR-346, FR-347.
- [X] T2104 [US1/US2] Atualizar provas em frontend/tests/ (pagina-de-baralhos, leitor-de-tela-de-baralhos, teclado-e-foco-de-baralhos, pagina-de-cartoes e as que navegavam pelo nome) e cobrir os cenários da spec; FR-340–346.
- [X] T2105 Atualizar e2e/ (lista-de-baralhos, responsividade de Baralhos/Cartões e percursos que abriam o Baralho pelo nome); SC-134–137.
- [X] T2106 Verificar: vitest, tsc, build e e2e afetados; registrar em research.md (tsc/build bloqueados por erros herdados da 020).

## Rastreabilidade
FR-339/346 → T2103, T2105 · FR-340–343 → T2101, T2104 · FR-344/345 → T2102, T2104 · FR-347 → T2104 (estados existentes) · SC-134–137 → T2105.
