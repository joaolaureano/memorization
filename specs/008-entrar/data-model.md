# Phase 1 — Data Model: Entrar

Modelo derivado da spec e do glossário canônico de `CONTEXT.md`.

## Escopo desta feature

Esta feature **não acrescenta tabela**: acrescenta a coluna `usuario_id` a
`cartao` e a `baralho` — recriando as três tabelas do acervo na migração 5 — e
mantém `usuario` como a `007` a criou. Nenhuma entidade durável guarda Credencial,
sessão, token ou cookie (FR-079).

## Entidades duráveis

### Usuário — inalterado desde a `007`

`id` (texto, chave primária), `nome_de_usuario` (único sem distinção entre
maiúsculas e minúsculas, com as regras do Cadastro) e `sal`, `hash` e
`parametros` (derivação irreversível da Senha). **Nenhuma coluna guarda a Senha**
(FR-078). A migração 5 **não toca** esta tabela: os Usuários sobrevivem a ela, e
é isso que permite a cada um voltar a Entrar depois da recriação do acervo.

### Cartão e Baralho — ganham dono

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | texto | Chave primária; identificador opaco |
| `frente`, `verso` / `nome` | texto | As mesmas colunas e os mesmos `CHECK`s de antes |
| `usuario_id` | texto | **Obrigatório**; referencia `usuario(id)` com `ON DELETE CASCADE`; indexado (FR-092) |

`usuario_id` obrigatório é o que cumpre FR-099: não existe Cartão nem Baralho sem
dono. A cascata só terá efeito quando existir exclusão de Usuário, que a spec
adia — é a restrição correta, não antecipação de comportamento.

### Vínculo — desenho inalterado, escopado pelos extremos

`cartao_id` e `baralho_id`, cada um referenciando seu lado com `ON DELETE
CASCADE`, e a chave primária composta `(cartao_id, baralho_id)`, que faz o par ser
único no esquema. Não há coluna de dono, de propósito: o Vínculo herda o dono dos
extremos e o escopo do `Acervo` impede ligar extremos de Usuários diferentes;
duplicar o dono abriria a possibilidade de divergência entre a coluna e os
extremos (FR-093).

## Esquema e migração 5

```sql
DROP TABLE vinculo;   -- ordem que respeita as chaves estrangeiras
DROP TABLE baralho;
DROP TABLE cartao;

CREATE TABLE cartao (
  id         TEXT PRIMARY KEY,
  frente     TEXT NOT NULL CHECK (length(trim(frente)) > 0 AND length(frente) <= 1000),
  verso      TEXT NOT NULL CHECK (length(trim(verso))  > 0 AND length(verso)  <= 1000),
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE
);
CREATE INDEX indice_cartao_por_usuario ON cartao (usuario_id);

CREATE TABLE baralho (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL CHECK (length(trim(nome)) > 0 AND length(nome) <= 100),
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE
);
CREATE INDEX indice_baralho_por_usuario ON baralho (usuario_id);

CREATE TABLE vinculo (
  cartao_id  TEXT NOT NULL REFERENCES cartao(id)  ON DELETE CASCADE,
  baralho_id TEXT NOT NULL REFERENCES baralho(id) ON DELETE CASCADE,
  PRIMARY KEY (cartao_id, baralho_id)
);
```

As restrições de conteúdo de `cartao` e `baralho` (`CHECK` de Frente, Verso e
nome) são **copiadas literalmente** das migrações 1 e 2 em
`backend/src/acervo/migracoes.ts`. O SQL acima as reproduz apenas para
ilustrar; em caso de diferença, vale o código das migrações anteriores. A
migração 5 acrescenta somente `usuario_id`, os índices e a recriação de
`vinculo`.


Os `CHECK`s são repetidos **de propósito**, como nas migrações 1 a 3: a validação
primária continua no `Acervo`, com mensagem útil, e o esquema é a rede de
segurança contra erro de programação. O conteúdo descartado não é preservado —
decisão do PO, verificada por FR-099 e SC-037 — e todo o bloco roda na mesma
transação que eleva a versão para 5.

## Entidade de interface, não durável

**Credencial**: o par Nome de usuário e Senha, mantido **apenas na memória da
página aberta** (FR-089). Não tem tabela, coluna, arquivo nem campo de
armazenamento do navegador (FR-078, SC-033); viaja em cada requisição no cabeçalho
`Authorization`, é verificada a cada operação e não deixa estado no servidor
(FR-079); recarregar, fechar ou Sair a descarta (SC-031, SC-034). Ao lado dela a
interface guarda apenas `{ id, nomeDeUsuario }` — o que `POST /entrar` devolve —,
para exibir quem entrou.

## Correspondência com as invariantes da spec

| Invariante | Onde é garantida |
|---|---|
| Toda operação exige Credencial válida (FR-090) | Hook `onRequest`, antes de qualquer rota de acervo |
| Cartão e Baralho pertencem a exatamente um Usuário (FR-092) | `usuario_id NOT NULL` e escopo em toda consulta |
| Vínculo une somente Cartão e Baralho do mesmo Usuário (FR-093) | Escopo do `Acervo`: fora dele, `nao_encontrado` |
| Conteúdo de outro Usuário é indistinguível de inexistente (SC-030) | Escopo na consulta; a recusa é o `nao_encontrado` já existente |
| Não existe Cartão, Baralho ou Vínculo sem dono (FR-099) | Recriação das tabelas na migração 5, sem adoção do acervo antigo |
| Não existe sessão, cookie ou token (FR-079) | Nenhuma tabela, coluna ou cache de Credencial verificada |
| A Credencial não é persistida no navegador (FR-078) | Estado React apenas; nenhum armazenamento do navegador |
| A recusa não revela qual parte da Credencial falhou (FR-088) | Derivação uniforme no `Identidade`, com sal descartável |

## O que este modelo deliberadamente não tem

- Tabela, coluna ou cache de sessão, token, cookie ou Credencial verificada.
- Coluna de dono em `vinculo`, que poderia divergir dos extremos.
- Coluna de Senha, em qualquer forma, nem coluna derivada dela.
- Tabela de tentativas ou de bloqueio, adiada na spec.
- Adoção do acervo legado por qualquer Usuário: a perda é decisão do PO.
