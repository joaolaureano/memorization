# Data model — 023

## Registro de sessão (persistido, ampliado)

| Campo | Mudança |
|---|---|
| `origem` | aceita `temporario`, além de `baralho` e `revisao` (migração 11) |
| `baralhoId` | `""` quando `origem = temporario` (derivado pelo servidor) |
| `nomeDoBaralho` | `"Baralho temporário"` quando `origem = temporario` (derivado) |

Regras: de 1 a 1.000 Itens; idempotência pelo `id`; Agendamentos dos Cartões existentes do dono atualizados na mesma transação, pelas regras do estudo livre. O Registro nunca é reescrito por um salvamento posterior (FR-376).

## Baralho temporário (somente no navegador, não persistido)

| Campo | Tipo | Regra |
|---|---|---|
| `cartaoIds` | `string[]` | ordem de inclusão; sem repetição (identidade, não texto); 0 a N |

- Adicionar um Baralho acrescenta seus Cartões **atuais** ausentes. Não há vínculo vivo com a fonte.
- Adicionar um Cartão avulso acrescenta-o se ausente, com ou sem Vínculos.
- Remover tira só da seleção; Limpar esvazia.
- Pode iniciar quando há de 1 a 1.000 Cartões e todos estão disponíveis na releitura (`listarCartoes`).
- Ao iniciar, Frente e Verso são capturados da releitura e a ordem é embaralhada uma vez.
- Vive até sair do Resumo; recarregar descarta.

## Salvar como baralho (gesto)

| Campo | Regra |
|---|---|
| `id` | UUID gerado uma vez por percurso de salvar; reenviado em novas tentativas |
| `nome` | regras de Baralho: aparado não vazio, até 100 caracteres, repetição permitida |
| `cartaoIds` | os da Sessão estudada, menos os que o Usuário retirou por indisponíveis; 1 a 1.000 |

Resultado: um Baralho comum com um Vínculo por Cartão, numa transação. Os Cartões, os Vínculos anteriores e os Agendamentos permanecem intactos.
