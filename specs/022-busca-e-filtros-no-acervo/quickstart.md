# Quickstart — validação da 022

## Verificação automatizada

Na raiz do repositório:

```sh
npm run verificar:ci
```

Executa Gitleaks, os portões de backend e frontend (lint, typecheck, testes, build) e a suíte Playwright. As provas desta feature estão listadas em [tasks.md](tasks.md), com a rastreabilidade FR → teste.

## Percurso manual

Com a API e o frontend locais (`npm run dev` em `backend/` e em `frontend/`):

1. Crie os Baralhos «Álgebra linear» e «Inglês cotidiano» e os Cartões do roteiro de [`design/busca-e-filtros/README.md`](../../design/busca-e-filtros/README.md). Vincule um Cartão a dois Baralhos e deixe outro sem Baralho.
2. Em Baralhos, busque `algebra`: aparece «Álgebra linear», e Estudar e Editar seguem os percursos existentes.
3. Em Cartões, busque um termo presente só no Verso: o Cartão aparece com a Frente como título.
4. Estude um Cartão com «Bom»: ele passa a «Em dia». Um Cartão nunca estudado é «Novos».
5. Combine busca, Baralho e situação; selecione «Sem baralho»; use Limpar filtros e confira o foco na busca.
6. Busque um termo inexistente: «Nenhum resultado encontrado» com Limpar filtros.
7. Com filtros ativos, exclua um Cartão: a contagem cai e os filtros permanecem.
8. Confira 360, 390, 768 e 1440 px e o zoom de 200%, por teclado, sem rolagem horizontal.

Resultado esperado: todos os cenários de aceite da spec atendidos (SC-138 a SC-142).
