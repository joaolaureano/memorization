# Contract — API de Usuários

Rota acrescentada por esta feature. As rotas de Cartão
([`api-cartoes.md`](../../001-criar-cartao/contracts/api-cartoes.md)), Baralho
([`api-baralhos.md`](../../002-criar-baralho/contracts/api-baralhos.md)),
Vínculo, edição e exclusão **não mudam**.

Base: `http://127.0.0.1:<porta>`. A API escuta **exclusivamente em loopback**,
restrição imposta em runtime desde a feature `001`.

## `POST /usuarios`

Cria um Usuário (FR-071).

Requisição:

```json
{ "nomeDeUsuario": "Ana.Silva", "senha": "<senha escolhida>" }
```

- `201 Created`: devolve o Usuário criado.
- `400 Bad Request`: `nome_de_usuario_invalido`, `senha_invalida` ou
  `corpo_invalido`.
- `409 Conflict`: `nome_de_usuario_existente`.

Espaços ao redor de `nomeDeUsuario` são descartados antes da validação. Espaços
na `senha` são preservados, inclusive nas pontas (FR-073, FR-075).

Propriedades extras no corpo são ignoradas. A forma do corpo é validada na borda
com Zod, e apenas `nomeDeUsuario` e `senha` são lidos.

**A Confirmação da Senha não faz parte deste contrato.** O FR-072 é verificado
apenas na interface, antes do envio; a API não recebe esse campo.

`201 Created`

```json
{ "id": "u1", "nomeDeUsuario": "Ana.Silva" }
```

**Nenhuma resposta contém a Senha, qualquer transformação dela ou credencial
reutilizável** (FR-076, FR-078). **Nenhuma resposta traz `Set-Cookie`**, e não
há cabeçalho de sessão, token ou autorização (FR-079).

## Unicidade

`Ana.Silva` e `ana.silva` são o mesmo Nome de usuário: a comparação ignora
maiúsculas e minúsculas (FR-074, SC-025). A recusa **diz claramente que o Nome
de usuário já existe**. Isso é intencional num Cadastro aberto e foi confirmado
no clarify. A feature `008-entrar` não revelará nada ao recusar uma entrada.

## Erros

| Código HTTP | `erro` | Situação | Requisito |
|---|---|---|---|
| `400` | `nome_de_usuario_invalido` | Fora de 3 a 50 caracteres, ou com caractere não permitido | FR-073 |
| `400` | `senha_invalida` | Fora de 8 a 128 caracteres | FR-075 |
| `400` | `corpo_invalido` | Corpo ausente, malformado ou sem os campos exigidos | FR-071 |
| `409` | `nome_de_usuario_existente` | Nome de usuário já cadastrado, sem distinção entre maiúsculas e minúsculas | FR-074 |

O formato é uniforme, `{ "erro": "...", "mensagem": "..." }`, com `mensagem` em
português destinada ao usuário (FR-046). Nenhuma mensagem de erro repete a Senha
recebida.

Qualquer resposta que não seja de sucesso faz o cliente tratar a operação como
não concluída (FR-044) e preservar o conteúdo digitado (FR-045).

## CORS e registro

`/usuarios` entra na lista mínima de pré-voo que já existe, com os mesmos métodos
e cabeçalhos das demais rotas.

O logger do Fastify continua desabilitado: nenhum corpo de requisição, e
portanto nenhuma Senha, chega a algum log (FR-078).
