# Data model — 022

Nenhuma entidade persistida nova. Cartão, Baralho, Vínculo e Agendamento mantêm seus significados (spec, Key Entities).

## Cartão listado (leitura)

| Campo | Tipo | Origem |
|---|---|---|
| `id`, `frente`, `verso` | string | Cartão |
| `baralhos` | `{ id, nome }[]` | Vínculos do Cartão |
| `proximaRevisaoEm` | `string \| null` | Agendamento do Cartão; `null` sem Agendamento |

## Situação da revisão (derivada)

`situacaoDaRevisao(proximaRevisaoEm, agora)`:

| Entrada | Resultado |
|---|---|
| `null` | `novos` |
| dia local de `proximaRevisaoEm` ≤ dia local de `agora` | `revisao-pendente` (inclui hoje com horário ainda não alcançado) |
| dia local de `proximaRevisaoEm` > dia local de `agora` | `em-dia` |

O dia local é obtido pelos componentes locais de `Date` (ano, mês, dia) no fuso do navegador. A classificação não altera o Agendamento.

## Critérios da consulta (estado da página, não persistido)

| Campo | Valores | Padrão |
|---|---|---|
| `consulta` | texto livre | `""` |
| `baralho` (Cartões) | `todos` · `sem-baralho` · id de Baralho | `todos` |
| `situacao` (Cartões) | `todos` · `novos` · `revisao-pendente` · `em-dia` | `todos` |

Regras:

- Normalização do texto: NFD, remoção das marcas diacríticas (`̀–ͯ`), minúsculas; a consulta é aparada. Consulta vazia após aparar não restringe.
- Correspondência por trecho contínuo (`includes`), no nome do Baralho ou na Frente ou no Verso do Cartão.
- `sem-baralho`: Cartões com `baralhos` vazio. Um id: Cartões que têm esse Baralho entre os Vínculos, cada um uma única vez.
- Os critérios se combinam por interseção, e a ordem recebida é preservada.
- Os critérios vivem enquanto a página está montada e sobrevivem a recargas dos dados e exclusões; nova entrada começa no padrão.
- Se o Baralho selecionado deixar de existir numa recarga, o seletor volta a `todos` (premissa a validar; não há cenário na spec).
