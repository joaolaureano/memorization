# Nota de Alteração — Contratos de `001` a `006`

Esta feature **altera** os contratos publicados por `001-criar-cartao` a
`006-excluir-cartao-e-baralho`. Nenhum campo, código de erro ou status anterior
muda de nome, tipo ou significado: o que se acrescenta é a exigência de
Credencial e o escopo por Usuário.

## O que muda

Valem para [`api-cartoes.md`](../../001-criar-cartao/contracts/api-cartoes.md),
[`api-baralhos.md`](../../002-criar-baralho/contracts/api-baralhos.md),
[`api-vinculos.md`](../../003-vincular-cartao-baralho/contracts/api-vinculos.md),
[`api-edicao.md`](../../005-editar-cartao-e-baralho/contracts/api-edicao.md) e
[`api-exclusao.md`](../../006-excluir-cartao-e-baralho/contracts/api-exclusao.md),
sem exceção:

1. **Credencial obrigatória**. Toda requisição precisa trazer
   `Authorization: Basic base64(nomeDeUsuario:senha)`. Sem cabeçalho, com
   cabeçalho malformado ou com Credencial inválida, a resposta é
   `401 { "erro": "credencial_invalida", "mensagem": "Nome de usuário ou Senha
   incorretos." }` e a rota **não executa**: nada é criado, alterado ou excluído
   (FR-090, SC-028).
2. **Escopo por dono**. Cada Usuário enxerga e opera somente os seus Cartões,
   Baralhos e Vínculos. O `id` de um Cartão ou Baralho de outro Usuário se
   comporta como inexistente: a resposta é o mesmo `404 nao_encontrado` — mesmo
   status e mesma mensagem do id que nunca existiu. **Nunca há 403**, porque 403
   revelaria a existência (FR-092, SC-030).
3. **Vínculo só do mesmo dono**. `POST /baralhos/{baralhoId}/vinculos` exige que o
   Cartão e o Baralho existam no escopo de quem pede; fora dele, `404
   nao_encontrado` (FR-093).
4. **Sessão de estudo**. Os dados que a Sessão carrega vêm das rotas acima e,
   portanto, apenas dos Baralhos do Usuário que entrou (FR-092, SC-028).
5. **Sem sessão, cookie ou token**. Nenhuma dessas rotas publica `Set-Cookie` nem
   devolve valor reutilizável; a Credencial é verificada a cada requisição
   (FR-079, SC-033).

O CORS mínimo existente ganha `authorization` em
`access-control-allow-headers`; métodos e origens continuam como estão.

## O que **não** muda

- Rotas, caminhos, métodos e formatos de sucesso: idênticos aos publicados.
- Códigos de erro de domínio e mensagens em português: idênticos.
- `GET /cartoes` continua devolvendo cada Cartão com `baralhos`, agora apenas os
  Baralhos do dono; `quantidadeDeCartoes` e `elegivel` continuam derivados na
  leitura, agora contando só os Vínculos do dono.
- Cadastro e `/health` não são alcançados por esta alteração: o primeiro é isento
  por FR-097, o segundo por ser infraestrutura.

## Efeito no acervo existente

O acervo sem dono é descartado na instalação: depois desta feature não existe
Cartão, Baralho ou Vínculo sem dono, e cada Usuário começa com acervo vazio
(FR-099, SC-037). O detalhamento do esquema e da migração 5 está em
[`../data-model.md`](../data-model.md).
