# Contract — API de Cartões

Contrato HTTP exposto pelo `backend` nesta feature. É o limite autoritativo
exigido por FR-023: toda regra de domínio é verificada aqui, independentemente
do que a interface permita ou impeça.

**Duas rotas.** Baralhos, Vínculos e Sessão pertencem a outras features e não
têm rota aqui.

Base: `http://127.0.0.1:<porta>`, padrão 3001. Corpo em JSON. Identificadores são
textos opacos.

> A API escuta **exclusivamente em loopback**, e isso é imposto em runtime:
> após o `listen`, o endereço efetivo é conferido e a inicialização aborta se
> não for `127.0.0.1`. A ausência de autenticação é condicional a essa garantia.

## `POST /cartoes`

Cria um Cartão avulso, sem Baralho (FR-001).

Requisição:

```json
{ "frente": "To walk", "verso": "Caminhar" }
```

- `201 Created` — devolve o Cartão criado, com `id`, `frente` e `verso`
- `400 Bad Request` — regra de domínio violada

Propriedade extra enviada no corpo é **ignorada e não retorna nas leituras**,
o que constitui a verificação de FR-009.

## `GET /cartoes`

Lista todos os Cartões existentes (FR-003, FR-004).

`200 OK`

```json
[
  { "id": "c1", "frente": "To walk", "verso": "Caminhar" },
  { "id": "c2", "frente": "To walk", "verso": "Andar" }
]
```

Dois Cartões com a mesma Frente são legítimos: a Frente não é identificador.

## Erros

Formato uniforme:

```json
{ "erro": "frente_vazia", "mensagem": "A frente do cartão não pode ficar vazia." }
```

| Código | Situação | Requisito |
|---|---|---|
| `frente_vazia` | Frente vazia ou composta só de espaços | FR-002, FR-051 |
| `verso_vazio` | Verso vazio ou composto só de espaços | FR-002, FR-051 |
| `frente_muito_longa` | Frente acima de 1000 caracteres | FR-052 |
| `verso_muito_longo` | Verso acima de 1000 caracteres | FR-052 |

`mensagem` é texto em português destinado ao usuário (FR-046); `erro` é o código
estável consumido pelo cliente. A interface exibe `mensagem` e **nunca inventa
texto próprio** para uma falha do domínio.

Qualquer resposta que não seja de sucesso faz o cliente tratar a operação como
**não concluída** (FR-044) e preservar o conteúdo digitado para nova tentativa
(FR-045).

## Fora deste contrato

`GET /health` existe como prova de vida da infraestrutura e **não é rota de
domínio**: não aparece na interface, não tem requisito associado e pode
desaparecer sem afetar a spec.
