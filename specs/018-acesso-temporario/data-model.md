# Data Model: Acesso temporário

## Entidades

### Acesso temporário

Comprovante opaco emitido ao Entrar, que permite continuar operando no mesmo Navegador sem reapresentar Nome de usuário e Senha até expirar ou ser encerrado. É um valor aleatório de pelo menos 256 bits; o servidor guarda apenas o digest SHA-256. Não revela Senha nem Nome de usuário, não pode ser adivinhado ou forjado, e é verificado pelo servidor a cada operação (FR-297). Tem validade limitada decidida pelo servidor, é próprio de cada Navegador e é encerrado por expiração, Sair ou eventos da 017 (FR-289, FR-291, FR-293, FR-296).

### Credencial

Par Nome de usuário e Senha mantido apenas na memória durante o Entrar. Quando
a pessoa desmarca a continuidade, pode autorizar operações somente enquanto a
página aberta o mantiver; é descartado ao recarregar, fechar ou Sair. Com
continuidade, o Acesso temporário autoriza as operações (FR-089 e FR-090
revisados).

### Usuário

Quem se cadastrou na 007 e Entra. É dono do acervo e pode ter vários Acessos temporários independentes, um por Navegador ou aparelho (FR-298, FR-299).

### Navegador

Contexto em que um Acesso temporário é emitido e guardado. Um novo Entrar no mesmo Navegador substitui o Acesso anterior (FR-289, FR-299).

## Tabela `acesso_temporario`

| Coluna | Tipo | Regra |
|---|---|---|
| `digest` | TEXT/BLOB | PK; digest SHA-256 do valor opaco; nunca o valor em claro |
| `usuario_id` | id do Usuário | `REFERENCES usuario(id) ON DELETE CASCADE`; índice `(usuario_id)` |
| `criado_em` | timestamp | momento da emissão |
| `expira_em` | timestamp | agora + TTL; decidido pelo servidor |
| `ultima_acao_em` | timestamp | última renovação |

A migração é nova e numerada como a próxima disponível: **9** se a migração 8 da 016 já estiver aplicada; caso contrário, **8**. A decisão é registrada no commit. O cascade garante que excluir o Usuário remove todos os Acessos (FR-296, FR-299).

## Porta `ArmazenamentoDeAcessos`

- `criar(digest, usuarioId, expiraEm)` — grava o digest e o vencimento.
- `obterValido(digest, agora)` — devolve `{ usuarioId }` quando válido; linha inexistente devolve `nao_encontrado`; linha existente e expirada devolve `expirado` e conta como não encontrado para autorização.
- `renovar(digest, novoExpiraEm)` — atualiza `expira_em` e `ultima_acao_em`.
- `encerrar(digest)` — remove uma linha.
- `encerrarTodosDoUsuario(usuarioId)` — remove todas as linhas do Usuário.
- `removerExpirados(agora)` — remove linhas com `expira_em < agora`.

Erros tipados: `indisponivel` em falha do armazenamento. A Interface esconde SQL e traduz o resultado para o hook e para as rotas.

## Regras de validade e renovação

- TTL de 5 minutos a partir da última ação (FR-291).
- No Entrar e em toda requisição autenticada, `expira_em = agora + TTL`.
- Interações sem requisição disparam `POST /acesso/renovar` por `atividade.ts`, no máximo uma vez a cada 60 s (D3).
- Sem ação por 5 minutos, o Acesso expira; a próxima operação é recusada com `401 acesso_expirado` e a pessoa vê «Seu acesso expirou. Entre novamente.» (FR-294).
- Falha de armazenamento não é expiração: devolve `503` e preserva o cookie (FR-301).
- Expiração é decidida pelo servidor; relógio do aparelho não altera (FR-297).

## Invariantes

1. A Senha nunca é guardada no navegador; o único valor de continuidade é o Acesso temporário (FR-078, FR-089, FR-297).
2. O Acesso não revela Senha nem Nome de usuário, não é adivinhável nem forjável, e é verificado pelo servidor a cada operação (FR-297, FR-306).
3. O Acesso vale só para o Navegador em que foi emitido e nunca dá acesso ao acervo de outro Usuário (FR-298).
4. Expirar, Sair, trocar Senha, alterar Nome de usuário ou excluir Usuário encerram o Acesso correspondente (FR-293, FR-294, FR-295, FR-296).
5. Nenhuma operação recusada por Acesso é apresentada como concluída; nada em andamento permanece registrado (FR-044, FR-091 revisado, FR-294).
6. Falha de armazenamento não é expiração e não descarta o Acesso (FR-301).
7. Toda ação da feature é executável por teclado; nenhum estado relevante é comunicado só por cor (FR-302, FR-303, FR-304).

## Rastreabilidade

FR-289, FR-290, FR-291, FR-292, FR-293, FR-294, FR-295, FR-296, FR-297, FR-298, FR-299, FR-300, FR-301, FR-302, FR-303, FR-304, FR-305, FR-306; SC-114, SC-115, SC-116, SC-117, SC-118, SC-119, SC-120, SC-121, SC-122, SC-123, SC-124.
