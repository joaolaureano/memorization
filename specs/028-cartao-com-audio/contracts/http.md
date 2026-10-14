# Contrato HTTP — Cartão com Áudio

**Feature**: `028-cartao-com-audio` | Research R2, R3, R5, R8

A base, a autenticação Basic, o isolamento por Usuário e a forma da recusa ficam como na `027`:

```text
{ erro, mensagem (inglês técnico, só ASCII), motivo?, limite? }
```

O contrato da Imagem (`026`) não muda.

## Preparar envio de Áudio (nova)

`POST /audios/envios`, sem corpo. Exige Entrar.

- `201 Created`:
  ```json
  { "audioId": "uuid",
    "envio": { "url": "https://…", "campos": { "key": "pendentes/…", "Policy": "…", "X-Amz-Signature": "…" } },
    "expiraEm": "ISO-8601", "limiteEmBytes": 10485760, "limiteEmSegundos": 300,
    "formatos": ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/wav"] }
  ```
- O cliente envia `multipart/form-data` (`campos` + `file`) para `envio.url`, sem autorização. O S3 recusa arquivos acima do limite.
- `401`: sem Entrar.

No modo local, `envio.url` aponta para a rota de envio do Adapter Disco. Ela passa a se chamar `/midia-local/envios` (antes `/imagens-locais/envios`), e o token carrega a Mídia e o limite dela.

## Criar Cartão no Baralho (alterado)

`POST /baralhos/{baralhoId}/cartoes` aceita `tipo: "audio"`:

```json
{ "tipo": "audio", "audioId": "uuid", "frente": "", "verso": "Obrigado (japonês)", "tags": [] }
```

`frente` é a Mensagem (pode ser `""`).

| Status | `erro` | `motivo` / `limite` | `mensagem` (exemplo) |
|---|---|---|---|
| `400` | `audio_ausente` | — | `Choose an audio file.` |
| `400` | `verso_vazio`, `verso_muito_longo`, `frente_muito_longa` | como hoje | como hoje |
| `422` | `audio_invalido` | `nao_encontrado` | `Audio upload was not found.` |
| `422` | `audio_invalido` | `formato` | `File is not a supported audio format.` |
| `422` | `audio_invalido` | `tamanho`, `limite: 10485760` | `Audio exceeds the size limit.` |
| `422` | `audio_invalido` | `duracao`, `limite: 300` | `Audio exceeds the duration limit.` |
| `503` | `indisponivel` | — | como hoje; nenhum Áudio fica órfão (fila) |

Também valem `404` (Baralho ausente ou de outro Usuário) e `409` (como hoje).

## Editar Cartão (alterado)

`PUT /cartoes/{id}` usa a mesma forma. `audioId` ausente mantém o Áudio, e presente substitui (o anterior vai para a fila). `409 tipo_imutavel` se `tipo` difere.

## Leitura de Cartão (alterado)

As mesmas rotas da `026` (`GET /baralhos/{id}`, `GET /cartoes`, `POST /baralhos/de-selecao`, `GET /agenda`, início de Sessão) devolvem:

```json
{ "tipo": "audio", "id": "…", "frente": "", "verso": "…", "duracaoMs": 4210,
  "audio": { "url": "https://…presigned…", "expiraEm": "ISO-8601 (≤ 15 min)" } }
```

`audio` é `null` se a assinatura falhar. O cliente mostra Áudio indisponível (FR-444). `audio.url` responde `Range` (206).

## Excluir, Cópia, Sessão, Histórico

- **Exclusões** (`DELETE /cartoes/{id}`, `/baralhos/{id}`, `/conta`): formas inalteradas. As chaves de Áudio entram em `midia_a_remover` na mesma transação (FR-449).
- **Cópia** (`025`): o Cartão `audio` recebe uma chave nova e idêntica (FR-450).
- **Sessão**:
  - `POST /sessoes`: os itens aceitam `tipo: "audio"`.
  - `GET /sessoes/{id}`: devolve `tipo`, nunca o Áudio (FR-447).

## Importação Anki

Inalterada. Só cria `frente-verso` e ignora o som dos pacotes (FR-452).

## Mensagens técnicas

`audio_ausente` e `audio_invalido` entram em `CodigoDeRecusa` e em `MENSAGENS_TECNICAS` (`backend/src/http/recusas.ts`). A prova "todo código presente, só ASCII" da `027` cobre os novos. Logs e erros nunca contêm endereço, Mensagem ou nome de arquivo (FR-455).
