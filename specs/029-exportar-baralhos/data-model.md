# Data Model: Exportar Baralhos

**Feature**: `029-exportar-baralhos` | Research R2, R7, R8, R10

**Nenhuma migração.** A Exportação não é guardada no banco. O esquema continua na v21.

## Pedido de Exportação (efêmero)

| Campo | Regra |
|---|---|
| `formato` | identificador registrado em `FORMATOS_DE_EXPORTACAO` (hoje `apkg`) |
| `baralhos` | `"todos"` ou lista não vazia, sem repetição, de ids de Baralhos do Usuário |
| `fuso` | nome IANA válido. Só na geração |
| `idioma` | `pt`, `en` ou `es`. Só na geração |

O Usuário vem sempre da Credencial.

## Conteúdo exportado (lido em uma transação, R7)

A Porta devolve `ConteudoArmazenado` (linhas com o Agendamento cru). O `Acervo` o transforma em `ConteudoExportado`, trocando o Agendamento por `progresso`, e só este chega ao Module `exportacao`.

```text
ConteudoExportado
└── baralhos[]: { id, nome, criadoEm }
    └── cartoes[]: { id, tipo: frente-verso | imagem | audio,
                     frente, verso, tags[], descricaoAlternativa?,
                     midiaChave?,                       # imagem_chave ou audio_chave
                     progresso: Progresso | null }      # null = sem Agendamento
```

- Os Cartões vêm na ordem de criação do Baralho, que dá o `due` dos Cartões novos no Anki.
- `Progresso = { proximaRevisaoEm, repeticoes, intervaloEmDias, facilidade }`. Ele vem do Agendamento por `algoritmoPorId(algoritmo).descreverProgresso(estado)` (R8). O Module `exportacao` não lê `estado.dados`.

## Prévia

`{ formato, extensao, baralhos, cartoes, cartoesComImagem, cartoesComAudio, bytesEstimados }`. `bytesEstimados` é `medir(chaves das mídias)` mais uma estimativa fixa por Cartão (R6).

## Resultado da geração

`{ url, nomeDoArquivo, expiraEm, baralhos, cartoes, cartoesSemMidia }`.

## Limites (R5)

| Constante | Valor |
|---|---|
| `LIMITE_DE_CARTOES_DA_EXPORTACAO` | 10.000 |
| `LIMITE_DE_BYTES_DE_MIDIA_DA_EXPORTACAO` | 104.857.600 (100 MiB) |
| `VALIDADE_DA_LEITURA_EM_SEGUNDOS` | 900, a mesma das Mídias |

## Arquivo no armazém (R10)

`exportacoes/{usuarioId}`: uma chave fixa por Usuário, e cada Exportação sobrescreve a anterior (research R14). Nunca é listado nem relido pela aplicação. Expira por ciclo de vida em até 48 h. O endereço de leitura vale 15 minutos. `excluirUsuario` põe a chave na fila `midia_a_remover` na mesma transação (FR-479).

## Mudanças nas Interfaces existentes

| Module | Acréscimo |
|---|---|
| `AlgoritmoDeRepeticao` | `descreverProgresso(estado): { repeticoes, intervaloEmDias, facilidade }` |
| `Porta` (SQLite e PostgreSQL) | `lerAcervoParaExportacao(usuarioId, baralhoIds \| "todos"): Promise<Desfecho<ConteudoArmazenado>>`; `excluirUsuario` também enfileira `exportacoes/{usuarioId}` |
| `ArmazemDeMidia` (S3 e Disco) | `ler(chave)`, `medir(chaves)` e `guardarExportacao(usuarioId, bytes, nomeDoArquivo, tipoDeConteudo)` |
| `Acervo` | `previaDaExportacao(pedido)` e `exportar(pedido)` |
| `ClienteDoAcervo` (HTTP e memória) | `previaDaExportacao(pedido)` e `exportar(pedido)` |
