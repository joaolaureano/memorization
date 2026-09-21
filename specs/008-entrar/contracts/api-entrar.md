# Contract — API de Entrar

Rotas e regras de transporte acrescentadas por esta feature. A alteração das
rotas de `001` a `006` está em
[`alteracao-contratos-001-006.md`](./alteracao-contratos-001-006.md); o Cadastro
continua em
[`api-usuarios.md`](../../007-criar-usuario/contracts/api-usuarios.md).

Base: `http://127.0.0.1:<porta>`. A API escuta **exclusivamente em loopback**,
restrição imposta em runtime desde a feature `001`.

## A Credencial acompanha toda requisição

```text
Authorization: Basic base64(nomeDeUsuario:senha)
```

| Rota | Credencial | Requisito |
|---|---|---|
| `POST /usuarios` (Cadastro) | **isentada**: quem cria o Usuário ainda não tem Credencial | FR-097 |
| `GET /health` | **isentada**: prova de vida da infraestrutura, usada para subir os servidores nos testes | — |
| `OPTIONS` (pré-voo de CORS) | **isentado** | — |
| `POST /entrar` | exigida | FR-086 |
| Rotas de Cartões, Baralhos, Vínculos e edição/exclusão | exigida | FR-090 |

O Nome de usuário é comparado depois de descartar espaços ao redor e sem
distinção entre maiúsculas e minúsculas, com as mesmas regras do Cadastro; a
Senha é comparada exatamente, preservando espaços (FR-087, SC-036). **Não há
cookie, token ou sessão**: nenhuma resposta traz `Set-Cookie`, e nada da
Credencial é guardado no servidor entre requisições (FR-079, SC-033).

## `POST /entrar`

Verifica a Credencial antes de a interface mostrar o acervo (FR-086).

Requisição: **sem corpo**, apenas o cabeçalho `Authorization`.

- `200 OK` — `{ "id": "u1", "nomeDeUsuario": "Ana.Silva" }`
- `401 Unauthorized` — `credencial_invalida`, com a mensagem única

## `401` uniforme

Toda requisição sem cabeçalho, com cabeçalho malformado ou com Credencial
inválida é recusada **antes de o handler rodar**, e nada muda (FR-090, SC-028):

```json
{ "erro": "credencial_invalida", "mensagem": "Nome de usuário ou Senha incorretos." }
```

| Código HTTP | `erro` | Situação | Requisito |
|---|---|---|---|
| `401` | `credencial_invalida` | Cabeçalho ausente, malformado ou Credencial que não confere | FR-090 |
| `401` | `credencial_invalida` | Recusa de Entrar | FR-088 |

A recusa é **uma só**, para Nome de usuário inexistente e para Senha errada, e a
duração observável não distingue os dois casos (FR-088, SC-029).

**A resposta 401 não publica `WWW-Authenticate`.** Esse cabeçalho faria o
navegador abrir o diálogo nativo de autenticação e memorizar a Credencial, contra
FR-089 e FR-078. A ausência é parte do contrato e é verificada por teste.

O formato é uniforme, `{ "erro": "...", "mensagem": "..." }`, com `mensagem` em
português destinada ao usuário (FR-046). Nenhuma mensagem repete a Senha
recebida, e nenhuma resposta devolve a Senha ou qualquer transformação dela
(FR-078).

## Efeito no cliente

O `ClienteDoAcervo` traduz o `401` no modo de erro **`nao_autenticado`**, ao lado
de `indisponivel`. Ao recebê-lo, a interface descarta a Credencial, volta à tela
"Entrar" com mensagem explicativa e **não** apresenta a operação como concluída
(FR-091, FR-044, SC-035).

## CORS e registro

`/entrar` entra no pré-voo mínimo, e `access-control-allow-headers` passa a
incluir `authorization` — sem isso o navegador recusa o pré-voo dos `fetch` que
carregam o cabeçalho. O logger do Fastify continua desabilitado: nem a Senha nem o
cabeçalho de autorização chegam a um log (FR-078, SC-033).
