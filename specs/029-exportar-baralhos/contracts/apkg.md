# Contrato do arquivo — Pacote Anki (.apkg)

**Feature**: `029-exportar-baralhos` | Research R4, R8, R9

O pacote é o `.apkg` legado (esquema 11), o mesmo que o `genanki` produz. O formato é público, e o contrato abaixo é o que os testes conferem no arquivo gerado.

## Zip

| Entrada | Conteúdo |
|---|---|
| `collection.anki2` | banco SQLite, esquema 11 |
| `media` | JSON `{ "0": "memorization-{cartaoId}.jpg", "1": "…" }`, ou `{}` sem mídia |
| `0`, `1`, … | bytes de cada mídia, sem compressão (nível 0) |

## `col` (uma linha)

- `ver = 11`.
- `crt`: início do dia (segundos) da data mais antiga entre hoje e a primeira próxima revisão, no fuso pedido.
- `models`: um tipo de nota "Memorization" (`type = 0`, padrão), com `id` constante do produto (o mesmo em toda exportação, research R15), os campos `Front` e `Back`, um modelo com `qfmt = {{Front}}` e `afmt = {{FrontSide}}<hr id=answer>{{Back}}`.
- `decks`: "Default" (id 1) e um Baralho Anki por Baralho exportado, com `name` igual ao nome do Baralho.
- `dconf`, `conf` e `tags`: os valores padrão do esquema 11.

## `notes` (uma por Cartão)

- `guid` = id do Cartão (FR-467).
- `mid` = o tipo "Memorization".
- `tags` = ` tag1 tag2 `, com espaços internos de cada Tag trocados por `_`.
- `flds` = `Front` + `\x1f` + `Back`.
- `sfld` e `csum` calculados sobre o `Front` sem HTML, como o Anki faz.

### Campo `Front` por Tipo de cartão

| Tipo | `Front` |
|---|---|
| Frente-Verso | `escapar(frente)` |
| Imagem | `<img src="{arquivo}" alt="{escapar(descrição alternativa)}">`, mais `<br>` e `escapar(texto da frente)` quando houver |
| Áudio | `escapar(mensagem)` quando houver, mais `[sound:{arquivo}]` |
| Mídia ilegível (FR-477) | o texto do Cartão, ou `[Imagem]`/`[Áudio]` no idioma pedido quando não houver texto |

`escapar` troca `&`, `<`, `>` e `"` por entidades, e `\n` por `<br>` (FR-466). O `Back` é `escapar(verso)`.

## `cards` (um por nota)

- `did` = o Baralho Anki do Baralho de origem, `ord = 0`.
- Os campos de agendamento seguem a tabela do research R8: novo (`type = queue = 0`) ou revisão (`type = queue = 2`, `due` em dias desde `crt`, `ivl`, `factor`, `reps`). Sempre `lapses = 0` e `left = 0`.

## `revlog`

Vazio (FR-471).
