# Contrato HTTP — 023

Todas as rotas exigem Credencial (`401` sem ela), como as demais.

## `POST /sessoes` (ampliado)

`origem` passa a aceitar `"temporario"`, além de `"baralho"` e `"revisao"`.

```json
{
  "id": "9b0f…",
  "origem": "temporario",
  "itens": [
    { "frente": "How are you?", "verso": "Como você está?", "cartaoId": "c1", "avaliacao": "bom" }
  ]
}
```

- Em `temporario`, `baralhoId` e `nomeDoBaralho` são **derivados** pelo servidor como `""` e `"Baralho temporário"`; valores enviados pelo cliente são ignorados.
- Itens: de 1 a 1.000, com as regras vigentes de Frente, Verso, `cartaoId` e `avaliacao`.
- Resposta, idempotência pelo `id`, Estatísticas e aplicação das Avaliações aos Agendamentos seguem exatamente o contrato vigente do estudo livre. Cartão inexistente ou alheio não ganha Agendamento.
- `GET /sessoes/:id` e as listas de Estatísticas devolvem `origem: "temporario"`, `baralhoId: ""` e `nomeDoBaralho: "Baralho temporário"`.

## `POST /baralhos/de-selecao` (novo)

Cria, num gesto único, um Baralho com Vínculos para os Cartões informados.

Corpo:

```json
{ "id": "3f2c…", "nome": "Inglês para a próxima viagem", "cartaoIds": ["c1", "c2", "c4"] }
```

- `id`: UUID gerado pelo cliente uma vez por tentativa de salvar; reenviado em novas tentativas.
- `nome`: regras vigentes de Baralho, não vazio após aparar e até 100 caracteres; nomes repetidos são permitidos.
- `cartaoIds`: de 1 a 1.000 strings não vazias e sem repetição.

Respostas:

| Status | Corpo | Quando |
|---|---|---|
| `201` | `{ "id", "nome" }` | Baralho criado agora com todos os Vínculos. |
| `200` | `{ "id", "nome" }` | O mesmo `id` já foi criado por este Usuário (reenvio idempotente). Nada é gravado de novo. |
| `400` | `{ "erro": "nome_vazio" \| "nome_muito_longo", "mensagem" }` | Nome inválido, com as mensagens de Baralho vigentes. |
| `400` | `{ "erro": "dados_invalidos", "mensagem": "Os dados da seleção são inválidos." }` | Corpo sem a forma, id que não é UUID, `cartaoIds` vazio, repetido ou com mais de 1.000. |
| `409` | `{ "erro": "cartoes_indisponiveis", "mensagem": "Alguns cartões não estão mais disponíveis.", "cartaoIds": ["c2"] }` | Algum Cartão não existe ou não é do Usuário. Nada é gravado. A lista contém apenas os ids enviados pelo próprio cliente, sem revelar dados alheios. |
| `409` | `{ "erro": "conflito", "mensagem": "Não foi possível salvar o baralho. Tente novamente." }` | O `id` pertence a outro Usuário (colisão improvável). |
| `503` | resposta de indisponibilidade vigente | Falha do armazenamento. Nada é gravado parcialmente. |

Garantias:

- Baralho e Vínculos são gravados numa única transação: ou tudo, ou nada.
- Cartões, Vínculos anteriores e Agendamentos não são alterados.
- O pré-voo de CORS e o cabeçalho permissivo valem para a rota.
