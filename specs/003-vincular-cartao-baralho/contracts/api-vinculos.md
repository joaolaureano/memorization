# Contract — API de Vínculos

Rotas acrescentadas e **uma alteração** em rota existente.

Base: `http://127.0.0.1:<porta>`. Escuta exclusivamente em loopback, imposto em
runtime pela feature `001`.

## `POST /baralhos/{baralhoId}/vinculos`

Cria o Vínculo entre um Cartão existente e este Baralho (FR-019).

Requisição: `{ "cartaoId": "c1" }`

- `201 Created`
- `404 Not Found` — Cartão ou Baralho inexistente
- `409 Conflict` — **o Vínculo já existe** (FR-020)

O `409` é a razão de esta rota ser `POST` e não `PUT`. `PUT` seria idempotente e
aceitaria a duplicata em silêncio, enquanto FR-020 exige **recusa explícita**.

A recusa vem da chave primária composta, não de verificação prévia. O `Acervo`
traduz a violação de restrição em `vinculo_duplicado`; **o erro do driver nunca
vaza para o usuário**.

## `DELETE /baralhos/{baralhoId}/vinculos/{cartaoId}`

Desfaz o Vínculo. Cartão e Baralho permanecem (FR-021).

- `204 No Content`
- `404 Not Found` — Vínculo inexistente

**Não há etapa de confirmação nesta rota** (FR-066): desvincular é reversível.

## `GET /baralhos/{id}`

Devolve o Baralho com seus Cartões vinculados (FR-014).

`200 OK`

```json
{
  "id": "b1",
  "nome": "Inglês",
  "elegivel": true,
  "cartoes": [ { "id": "c1", "frente": "To walk", "verso": "Caminhar" } ]
}
```

- `404 Not Found`

## `GET /cartoes` — **alteração de contrato**

A feature `001` publicou esta rota devolvendo `id`, `frente` e `verso`. A partir
desta feature cada Cartão traz também os Baralhos a que está vinculado
(FR-003).

`200 OK`

```json
[
  { "id": "c1", "frente": "To walk", "verso": "Caminhar",
    "baralhos": [ { "id": "b1", "nome": "Inglês" } ] },
  { "id": "c2", "frente": "To run", "verso": "Correr", "baralhos": [] }
]
```

Um Cartão **sem nenhum Baralho** devolve `baralhos: []`. Esse é estado legítimo,
e é o que garante SC-006: nenhum Cartão fica inacessível.

A alteração é **aditiva**: nenhum campo anterior mudou de nome, tipo ou
significado.

## `GET /baralhos` — comportamento, não contrato

O formato publicado pela feature `002` permanece idêntico. O que muda é que
`quantidadeDeCartoes` e `elegivel` **passam a variar**, em vez de serem sempre
`0` e `false`. A feature `002` publicou esse formato justamente para que esta
não precisasse alterá-lo.

## Erros

| Código | Situação | Requisito |
|---|---|---|
| `vinculo_duplicado` | 409 ao vincular par já existente | FR-020 |
| `vinculo_nao_encontrado` | 404 ao desvincular Vínculo inexistente | FR-021 |
| `nao_encontrado` | 404 quando Cartão ou Baralho não existe | — |

Formato uniforme `{ "erro": "...", "mensagem": "..." }`, com `mensagem` em
português (FR-046).
