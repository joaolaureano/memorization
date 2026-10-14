# Data Model: Cartão com Áudio

**Feature**: `028-cartao-com-audio` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## Tipo de cartão

`TipoDeCartao = "frente-verso" | "imagem" | "audio"`, igual no backend (`armazenamento/porta.ts`) e no frontend (`acervo-cliente/cliente.ts`). Na leitura, `tipo` ausente continua valendo `frente-verso` (`026`, R14).

## Cartão do tipo Áudio

| Campo (domínio) | Coluna | Regra |
|---|---|---|
| Mensagem | `cartao.frente` | Opcional: pode ser vazia. Até 1000 caracteres (limite vigente). Quando não vazia, entra na unicidade (`frente_chave`); vazia, `frente_chave = NULL` (FR-439). |
| Verso | `cartao.verso` | Obrigatório, não vazio, até 1000 caracteres (FR-434, FR-435). |
| Áudio | `cartao.audio_chave` | `audios/{usuarioId}/{uuid}`. Presente se e somente se `tipo = 'audio'` (FR-435). |
| Duração | `cartao.audio_duracao_ms` | Inteiro de 1 a 300 000, medido pelo servidor (R3). Presente se e somente se há `audio_chave`. |
| Tags | `cartao.tags_json` | Como hoje. |

- Imutável: `tipo` (FR-448).
- Não se aplicam ao Áudio: `imagem_chave` e `texto_alternativo` (continuam exclusivas do tipo `imagem`).

## Áudio (arquivo, no `ArmazemDeMidia`)

| Atributo | Valores |
|---|---|
| Formato | `audio/mpeg`, `audio/mp4`, `audio/ogg`, `audio/webm`, `audio/wav`, reconhecido pelos bytes (R3) |
| Tamanho | 1 … 10 485 760 bytes |
| Duração | > 0 e ≤ 300 000 ms |
| Metadados | Removidos ou neutralizados ao confirmar (R4) |

**Ciclo** (igual à Imagem, `026`, R7):

```text
(envio preparado) → pendente ──confirmar ok──→ ativo ──troca/exclusão──→ na fila → removido
                          └──recusa ou 48 h──→ apagado
```

Pendente nunca é legível. Ativo só é legível por endereço de 15 minutos emitido ao dono.

## Mídia

`Midia = "imagem" | "audio"`: a espécie de arquivo de um Cartão. Ela define formatos, limite de bytes, reconhecimento, limpeza de metadados e o prefixo da chave ativa (`imagens/` ou `audios/`). É usada pelo `ArmazemDeMidia`, pela fila e pelo envio (R2).

## Snapshot no Histórico

`item_de_registro.tipo` aceita `audio`. O snapshot guarda `frente` (a Mensagem) e `verso`, nunca o Áudio (FR-447).

## Fila de remoção

`midia_a_remover (chave PK, registrada_em)`, antes `imagem_a_remover`. Guarda chaves de Imagem e de Áudio e é preenchida na mesma transação que exclui ou troca (FR-449).

## Migrações (paridade SQLite / PostgreSQL)

**20 — Tipo Áudio** (sem precondição; no SQLite, `semChavesEstrangeiras`):

- `cartao`:
  - `tipo IN ('frente-verso','imagem','audio')`;
  - colunas `audio_chave TEXT NULL` e `audio_duracao_ms INTEGER NULL`;
  - `CHECK ((tipo = 'audio') = (audio_chave IS NOT NULL))`;
  - `CHECK ((audio_chave IS NULL) = (audio_duracao_ms IS NULL))`;
  - `CHECK (audio_duracao_ms IS NULL OR audio_duracao_ms BETWEEN 1 AND 300000)`;
  - Frente não vazia, exceto em `imagem` e `audio`;
  - as restrições da Imagem ficam iguais.
- `item_de_registro.tipo IN ('frente-verso','imagem','audio')`.
- `ALTER TABLE imagem_a_remover RENAME TO midia_a_remover`.
- SQLite: reconstrução de `cartao` e de `item_de_registro` (os `CHECK` são de coluna), preservando dados, índices e chaves estrangeiras. `PRAGMA foreign_key_check` vazio ao final.
- PostgreSQL: `DROP CONSTRAINT`/`ADD CONSTRAINT` e `ADD COLUMN`, sem reconstrução.

**21 — Repetição da finalização** (precondição `PODE_REMOVER_VINCULO`):

- `DROP TABLE IF EXISTS vinculo;`
- o mesmo `UPDATE registro_de_sessao …` da 19 (idempotente).

Existe porque a 20, sem precondição, eleva a versão além de 18 e 19 adiadas (research R6).

Nenhuma outra entidade muda. Cartões Frente-Verso e Imagem, Agendamentos e Histórico ficam intactos (SC-182).
