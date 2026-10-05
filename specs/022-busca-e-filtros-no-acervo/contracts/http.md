# Contrato HTTP — 022

## `GET /cartoes` (alterado)

Exige Credencial, como antes. Cada item da lista ganha um campo:

```json
[
  {
    "id": "c1",
    "frente": "How are you?",
    "verso": "Como você está?",
    "baralhos": [{ "id": "b1", "nome": "Inglês cotidiano" }],
    "proximaRevisaoEm": "2026-10-04T15:00:00.000Z"
  },
  {
    "id": "c2",
    "frente": "O que é osmose?",
    "verso": "Movimento de água…",
    "baralhos": [],
    "proximaRevisaoEm": null
  }
]
```

- `proximaRevisaoEm`: `string` ISO-8601 UTC com a próxima revisão do Agendamento do Cartão, ou `null` quando o Cartão não tem Agendamento.
- O campo é sempre presente. Um cliente que receba item sem o campo, ou com outro tipo, trata a resposta como fora do contrato (`indisponivel`), como já faz com os demais campos.
- Os Agendamentos considerados são exclusivamente os do Usuário autenticado (FR-359).
- Ordem, demais campos e códigos de resposta não mudam.

Nenhuma outra rota muda. A classificação em Novos, Revisão pendente e Em dia é feita no navegador, no calendário local (spec, Key Entities).
