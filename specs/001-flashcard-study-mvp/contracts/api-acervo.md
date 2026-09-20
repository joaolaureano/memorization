# Contract — API do Acervo

Contrato HTTP exposto pelo `backend`. É o limite autoritativo exigido por
FR-023: toda regra de domínio é verificada aqui, independentemente do que a
interface permita ou impeça.

**Não existe rota de Sessão de estudo.** Isso não é omissão: é FR-038. O
servidor não sabe que sessões existem, não as cria, não as armazena e não as
consulta. Uma rota de sessão nesta API seria violação direta da spec.

Base: `http://localhost:<porta>`. Corpo em JSON. Identificadores são textos
opacos.

## Cartões

### `GET /cartoes`

Lista todos os Cartões, inclusive os sem nenhum Vínculo (FR-003). É a rota que
torna impossível um Cartão ficar inacessível, satisfazendo SC-006.

`200 OK`

```json
[
  { "id": "c1", "frente": "To walk", "verso": "Caminhar",
    "baralhos": [ { "id": "b1", "nome": "Inglês" } ] },
  { "id": "c2", "frente": "To run", "verso": "Correr", "baralhos": [] }
]
```

### `POST /cartoes`

Cria um Cartão avulso, sem Baralho (FR-001).

Requisição: `{ "frente": "To walk", "verso": "Caminhar" }`

- `201 Created` — devolve o Cartão criado
- `400 Bad Request` — Frente ou Verso vazia (FR-002), indicando qual campo falta

### `PATCH /cartoes/{id}`

Edita Frente e/ou Verso. A alteração vale em todos os Baralhos vinculados
(FR-005) por consequência do modelo: existe um único Cartão.

- `200 OK` — devolve o Cartão atualizado
- `400 Bad Request` — campo resultante vazio
- `404 Not Found`

### `DELETE /cartoes/{id}`

Exclui o Cartão e seus Vínculos. **Nenhum Baralho é destruído** (FR-008).

- `204 No Content`
- `404 Not Found`

## Baralhos

### `GET /baralhos`

Lista todos os Baralhos com elegibilidade e contagem de Cartões (FR-013).

`200 OK`

```json
[
  { "id": "b1", "nome": "Inglês", "quantidadeDeCartoes": 12, "elegivel": true },
  { "id": "b2", "nome": "Inglês", "quantidadeDeCartoes": 0,  "elegivel": false }
]
```

Dois Baralhos com o mesmo nome são legítimos (FR-012). `elegivel` é derivado de
`quantidadeDeCartoes > 0`, calculado na leitura e nunca armazenado (FR-024).

### `GET /baralhos/{id}`

Devolve o Baralho e seus Cartões vinculados (FR-014).

- `200 OK` — `{ "id", "nome", "elegivel", "cartoes": [ { "id", "frente", "verso" } ] }`
- `404 Not Found`

### `POST /baralhos`

Requisição: `{ "nome": "Inglês" }`

- `201 Created`
- `400 Bad Request` — nome vazio (FR-011)

### `PATCH /baralhos/{id}`

Renomeia sem afetar Vínculos (FR-015).

- `200 OK` · `400 Bad Request` · `404 Not Found`

### `DELETE /baralhos/{id}`

Exclui o Baralho e seus Vínculos. **Nenhum Cartão é destruído** (FR-017).

- `204 No Content`
- `404 Not Found`

A confirmação exigida por FR-016 é responsabilidade da interface, que antes de
chamar esta rota informa quantos Cartões continuarão existindo — informação
disponível em `GET /baralhos/{id}`.

## Vínculos

### `POST /baralhos/{baralhoId}/vinculos`

Cria o Vínculo entre um Cartão existente e este Baralho (FR-019).

Requisição: `{ "cartaoId": "c1" }`

- `201 Created`
- `404 Not Found` — Cartão ou Baralho inexistente
- `409 Conflict` — **o Vínculo já existe** (FR-020)

O `409` é a razão de esta rota ser `POST` e não `PUT`. `PUT` seria idempotente e
aceitaria silenciosamente a duplicata, enquanto FR-020 exige recusa explícita.

### `DELETE /baralhos/{baralhoId}/vinculos/{cartaoId}`

Desfaz o Vínculo. Cartão e Baralho permanecem (FR-021).

- `204 No Content`
- `404 Not Found` — Vínculo inexistente

## Estudo

### `GET /baralhos/{id}/cartoes-para-estudo`

Devolve os Cartões vinculados, para que o cliente construa a Sessão.

- `200 OK` — `{ "cartoes": [ { "id", "frente", "verso" } ] }`
- `404 Not Found`
- `409 Conflict` — Baralho **não elegível**, isto é, sem nenhum Cartão vinculado

O `409` implementa FR-025: a elegibilidade é verificada **no momento de iniciar
a Sessão**, no servidor, e não apenas quando a lista foi renderizada. É o que
cobre o caso-limite de o último Cartão ser desvinculado enquanto o usuário olha
a tela.

Esta rota **não** recebe a quantidade solicitada nem devolve ordem randomizada.
Limitar ao disponível (FR-029) e randomizar (FR-030) são responsabilidades do
Module `SessaoDeEstudo`, no cliente. O servidor entrega o conjunto; a Sessão
decide a sequência.

## Erros

Formato uniforme:

```json
{ "erro": "frente_vazia", "mensagem": "A frente do cartão não pode ficar vazia." }
```

| Código | Situação | Requisito |
|---|---|---|
| `frente_vazia` / `verso_vazio` | 400 na criação ou edição de Cartão | FR-002 |
| `nome_vazio` | 400 na criação ou edição de Baralho | FR-011 |
| `vinculo_duplicado` | 409 | FR-020 |
| `baralho_nao_elegivel` | 409 | FR-025 |
| `nao_encontrado` | 404 | — |

`mensagem` é texto em português destinado ao usuário (FR-046); `erro` é o código
estável consumido pelo cliente. A interface exibe `mensagem` e nunca inventa
texto próprio para uma falha do domínio.

Qualquer resposta que não seja de sucesso faz o cliente tratar a operação como
**não concluída**, satisfazendo FR-044, e preservar o conteúdo digitado pelo
usuário para nova tentativa, satisfazendo FR-045.
