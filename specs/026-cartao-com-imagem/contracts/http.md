# Contract — Cartão com Imagem (HTTP)

Base, autenticação Basic, formato uniforme de erro (`{ codigo, mensagem }`) e isolamento por Usuário permanecem conforme os contratos vigentes. Rotas novas exigem Entrar.

## Preparar envio de Imagem (nova)

`POST /imagens/envios` — sem corpo.

- `201 Created`:
  ```json
  { "imagemId": "uuid", "envio": { "url": "https://…", "campos": { "key": "pendentes/…", "Policy": "…", "X-Amz-Signature": "…" } },
    "expiraEm": "ISO-8601", "limiteEmBytes": 5242880, "formatos": ["image/jpeg","image/png","image/webp","image/gif"] }
  ```
- O cliente envia `multipart/form-data` com os `campos` seguidos de `file` para `envio.url`, sem cabeçalho de autorização. O S3 recusa (`400 EntityTooLarge`) arquivos acima do limite.
- `401`: sem Entrar.

No modo local, `envio.url` aponta para `POST /imagens-locais/envios/{token}` do próprio backend (rota registrada só por `entradas/local.ts`), com a mesma forma de campos.

## Criar Cartão no Baralho (alterado)

`POST /baralhos/{baralhoId}/cartoes`

Request — união discriminada por `tipo`, **obrigatório**. Corpo sem `tipo` → `400 corpo_invalido`. O padrão Frente-Verso é responsabilidade do seletor da tela (FR-405):

```json
{ "tipo": "frente-verso", "frente": "To walk", "verso": "Caminhar", "tags": [] }
{ "tipo": "imagem", "imagemId": "uuid", "frente": "", "verso": "Pernambuco", "textoAlternativo": "Mapa com um estado destacado", "tags": [] }
```

- `201 Created`: Cartão na forma de leitura (abaixo).
- `400 corpo_invalido`: forma inválida. `400 imagem_ausente`: `tipo = imagem` sem `imagemId`. `400` de texto conforme regras vigentes (`frente_vazia`, `verso_vazio`, `limite_excedido`, `descricao_excedida`).
- `422 imagem_invalida` com `motivo`: `nao_encontrada` (envio não feito, expirado ou de outro Usuário), `formato` ou `tamanho`. O pendente é apagado.
- `404`: Baralho ausente ou de outro Usuário. `409`: colisão concorrente não resolvida, como hoje.
- `503 armazenamento_indisponivel`: falha do banco ou do armazém; nenhuma Imagem fica órfã (a chave confirmada vai para a fila de remoção).

## Editar Cartão (alterado)

`PUT /cartoes/{id}` — mesma união. `imagemId` ausente mantém a Imagem atual; presente substitui (a antiga vai para a fila de remoção).

- `409 tipo_imutavel`: `tipo` difere do tipo atual.
- Demais códigos iguais à criação.

## Leitura de Cartão (alterado)

`GET /baralhos/{id}`, `GET /cartoes`, `POST /baralhos/de-selecao`, `GET /agenda` e o início de Sessão devolvem cada Cartão com `tipo`. Cartões `imagem` trazem:

```json
{ "tipo": "imagem", "id": "…", "frente": "", "verso": "…", "textoAlternativo": "…",
  "imagem": { "url": "https://…presigned…", "expiraEm": "ISO-8601 (≤ 15 min)" } }
```

`imagem.url` só é emitido para o dono autenticado. Em falha de assinatura, `imagem` vem `null` e o cliente mostra Imagem indisponível (FR-418).

## Excluir Cartão / Baralho / Conta (comportamento)

`DELETE /cartoes/{id}`, `DELETE /baralhos/{id}`, `DELETE /conta`: formas inalteradas. As chaves das Imagens afetadas entram em `imagem_a_remover` na mesma transação e são removidas do armazém após o commit (FR-421).

## Sessão e Histórico (alterado)

`POST /sessoes`: cada item aceita `tipo` (padrão `frente-verso`). `GET /sessoes/{id}`: cada item devolve `tipo`; nunca devolve Imagem (FR-419a).

## Importação Anki

Inalterada: cria só Cartões `frente-verso` e ignora mídia.
