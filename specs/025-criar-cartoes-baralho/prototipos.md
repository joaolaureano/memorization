# Protótipos — Criar Cartões dentro de Baralhos

O protótipo navegável vive em [`design/criar-cartoes-no-baralho/`](../../design/criar-cartoes-no-baralho/). É HTML/CSS/JavaScript autônomo, sem API ou gravação no banco; os dados fictícios duram apenas na aba.

## Direção visual

Reutiliza `frontend/src/estilos.css`: moldura e marca do produto, paleta escura/azul, hierarquia tipográfica, listas compactas, botões, raios, foco e navegação responsiva. O protótipo mantém Baralhos como único destino de acervo e mostra Frente/Verso no detalhe. Nenhum sistema visual paralelo será criado.

## Jornadas demonstradas

- lista de Baralhos → detalhe contextual → criar/editar Cartão;
- criação com Frente repetida, contador automático e feedback acessível;
- resolução única de Cartões avulsos/compartilhados, incluindo escolha do Cartão original;
- salvar seleção como Baralho com cópias e Frentes numeradas;
- confirmação de exclusão de Cartão ou Baralho com contagem e efeito sobre Agendamentos;
- carregamento, vazio, falha e recuperação.

## Verificação e capturas

`verificar.mjs` cobre Chromium em 360, 390, 768 e 1440 px, ausência de rolagem horizontal, teclado/foco, Frente duplicada, cópia, transição e confirmação. O verificador gera capturas em `design/criar-cartoes-no-baralho/capturas/`.

As capturas validam somente o protótipo; não comprovam integração, persistência, zoom nativo ou compatibilidade com leitores de tela. O produto continua coberto por Testing Library e Playwright em `frontend/` e `e2e/`.

## Verificação local — 2026-10-05

`rtk proxy node design/criar-cartoes-no-baralho/verificar.mjs` passou. O Chromium confirmou os fluxos de criação, numeração, edição com colisão, transição, cópias e exclusões, além da ausência de rolagem horizontal e da separação entre controles do protótipo e a navegação fixa em 360, 390, 768 e 1440 px. As capturas foram geradas em `design/criar-cartoes-no-baralho/capturas/`. Não foi feita revisão manual com leitor de tela nem zoom nativo.

## Comparação com o produto — 2026-10-06

As telas reais de Baralhos, detalhe, formulário de Cartão e transição foram comparadas com os percursos e capturas do protótipo. A hierarquia visual, as ações de criar/editar/excluir, a numeração de Frente e a organização de Cartões legados seguem a direção documentada. O produto usa a moldura autenticada e apresenta contagens e confirmações a partir da API; os controles de cenário e o rodapé de demonstração existem somente no protótipo. Essas diferenças são esperadas. As capturas existentes continuam sendo a referência do protótipo e não precisam ser regeneradas para representar o produto.
