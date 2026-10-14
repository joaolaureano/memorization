# Contrato HTTP — Exportar Baralhos

**Feature**: `029-exportar-baralhos` | Research R1, R5, R6, R8, R10, R11

A base, a autenticação Basic, o isolamento por Usuário e a forma da recusa ficam como na `027`:

```text
{ erro, mensagem (inglês técnico, só ASCII), motivo?, limite? }
```

Nenhuma rota existente muda.

## Corpo comum

```json
{ "formato": "apkg", "baralhos": ["uuid", "…"] | "todos" }
```

- `formato`: identificador registrado em `FORMATOS_DE_EXPORTACAO`. Hoje só `apkg`.
- `baralhos`: lista não vazia de ids de Baralhos do Usuário, sem repetição, ou `"todos"`.

## Prévia da Exportação (nova)

`POST /exportacoes/previa`. Exige Entrar.

- `200 OK`:
  ```json
  { "formato": "apkg", "extensao": "apkg",
    "baralhos": 3, "cartoes": 412,
    "cartoesComImagem": 20, "cartoesComAudio": 7,
    "bytesEstimados": 18350000 }
  ```
- `400 entrada_invalida`: corpo fora da forma acima, inclusive formato desconhecido.
- `404 nao_encontrado`: algum id não é Baralho do Usuário (inclui Baralhos de outro Usuário, FR-480).
- `422 exportacao_vazia`: nenhum dos Baralhos escolhidos tem Cartões (FR-465, FR-486). Baralhos vazios entre outros com Cartões entram no pacote.
- `422 exportacao_grande_demais`, com `motivo: "cartoes" | "midia"` e `limite` (10000 Cartões ou 104857600 bytes de mídia) (FR-478).
- `401`: sem Entrar.

## Gerar a Exportação (nova)

`POST /exportacoes`. Exige Entrar.

```json
{ "formato": "apkg", "baralhos": [...] | "todos",
  "fuso": "America/Sao_Paulo", "idioma": "pt" | "en" | "es" }
```

- `fuso`: nome IANA, validado com `ehFusoValido`. Define as datas de revisão e a data do nome do arquivo (R8, R11).
- `idioma`: só para a indicação textual de mídia ilegível dentro do arquivo (R9).
- `201 Created`:
  ```json
  { "url": "https://…", "nomeDoArquivo": "Inglês.apkg", "expiraEm": "ISO-8601",
    "baralhos": 1, "cartoes": 120, "cartoesSemMidia": 0 }
  ```
  - `url` aponta para o armazém (S3 assinado ou `/midia-local/exportacoes/…` no modo local), vale 15 minutos e responde com `Content-Disposition: attachment; filename*=UTF-8''…`.
  - O conteúdo do arquivo reflete o acervo no início da geração (FR-473).
- As recusas são as mesmas da prévia, com as mesmas regras, verificadas de novo (o acervo pode ter mudado).
- `503 exportacao_indisponivel`: o armazém ou a geração falhou, inclusive quando a mídia não pôde ser lida por indisponibilidade do armazém. Nenhum arquivo é entregue (FR-476, FR-477).

## Códigos novos (`http/recusas.ts`)

| Código | `mensagem` (inglês, ASCII) |
|---|---|
| `exportacao_vazia` | `Nothing to export.` |
| `exportacao_grande_demais` | `Export exceeds the size limit.` |
| `exportacao_indisponivel` | `Export is unavailable.` |

## Privacidade (FR-480 a FR-482)

- Os ids de Baralho e o Usuário vêm sempre da Credencial. Nada vem de outro Usuário.
- `url`, nomes de Baralho e conteúdo não vão para logs nem para `mensagem`.
- O objeto fica em `exportacoes/{usuarioId}`, uma chave por Usuário, e cada Exportação sobrescreve a anterior. Ele expira por ciclo de vida em até 48 h, e o endereço expira em 15 minutos.
- Excluir a conta põe essa chave na fila de remoção, na mesma transação (research R14).
