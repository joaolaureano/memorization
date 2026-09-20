# Contract — API de Baralhos

Rotas acrescentadas por esta feature. As rotas de Cartão estão em
[`../001-criar-cartao/contracts/api-cartoes.md`](../001-criar-cartao/contracts/api-cartoes.md)
e não mudam.

Base: `http://127.0.0.1:<porta>`. A API escuta **exclusivamente em loopback**,
imposto em runtime pela feature `001`.

## `POST /baralhos`

Cria um Baralho (FR-010).

Requisição:

```json
{ "nome": "Inglês" }
```

- `201 Created` — devolve o Baralho criado
- `400 Bad Request` — `nome_vazio` ou `nome_muito_longo`

Nome repetido é **aceito** (FR-012): não há `409` para nome duplicado, e a
ausência desse código é intencional.

Propriedade extra no corpo é ignorada e não retorna nas leituras, o que
constitui a verificação de FR-018.

## `GET /baralhos`

Lista todos os Baralhos, com elegibilidade derivada (FR-013).

`200 OK`

```json
[
  { "id": "b1", "nome": "Inglês", "quantidadeDeCartoes": 0, "elegivel": false },
  { "id": "b2", "nome": "Inglês", "quantidadeDeCartoes": 0, "elegivel": false }
]
```

Dois Baralhos com o mesmo nome são legítimos.

`elegivel` é derivado de `quantidadeDeCartoes > 0`, calculado na leitura e
**nunca armazenado** (FR-024). Nesta feature ambos os campos são sempre `0` e
`false`, porque o Vínculo só existe a partir da feature `003`. O formato já
contempla a variação para que a `003` **não precise alterar este contrato**.

## Erros

| Código | Situação | Requisito |
|---|---|---|
| `nome_vazio` | Nome vazio ou composto só de espaços | FR-011 |
| `nome_muito_longo` | Nome acima de 100 caracteres | FR-061 |

Formato uniforme `{ "erro": "...", "mensagem": "..." }`, com `mensagem` em
português destinada ao usuário (FR-046). Qualquer resposta que não seja de
sucesso faz o cliente tratar a operação como não concluída (FR-044) e preservar
o conteúdo digitado (FR-045).
