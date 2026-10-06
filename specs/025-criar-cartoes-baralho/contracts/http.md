# Contract — Cartões pertencentes a Baralhos

Base, autenticação, formato uniforme de erro e isolamento por Usuário permanecem conforme os contratos vigentes. Todos os exemplos abaixo são escopados ao Usuário autenticado.

## Criar Cartão no Baralho

`POST /baralhos/{baralhoId}/cartoes`

Request: `{ "frente": "To walk", "verso": "Caminhar" }`.

- `201 Created`: Cartão e Pertencimento persistidos atomicamente; resposta contém `id`, Frente final (inclusive eventual contador) e Verso.
- `400 Bad Request`: Frente/Verso inválidos ou Frente resultante excede 1.000 caracteres.
- `404 Not Found`: Baralho ausente ou de outro Usuário.
- `409 Conflict`: somente para colisão concorrente não resolvida pelo retry interno.

A requisição não recebe `baralhoId` no corpo. O Baralho do caminho é a única origem de Pertencimento.

## Consultar Baralho

`GET /baralhos/{id}` mantém a forma vigente: `id`, `nome`, elegibilidade derivada e `cartoes` com `id`, `frente` e `verso`. A lista contém apenas Cartões do Baralho, uma vez cada.

## Listar Cartões para fontes internas

`GET /cartoes` permanece para fluxos como montagem temporária e consultas internas, sem tela principal dedicada. Cada item passa a devolver um único `baralho` (ou `baralhoId`) em vez da coleção `baralhos`; uma resposta normal nunca contém Cartão sem dono.

## Editar Cartão

`PUT /cartoes/{id}` mantém o corpo Frente/Verso. Uma colisão normalizada com outro Cartão no mesmo Baralho retorna `409 Conflict`, código `frente_duplicada`; nenhum conteúdo é alterado. Cartões em Baralhos diferentes podem manter a mesma Frente.

## Excluir Cartão e Baralho

- `DELETE /cartoes/{id}` exclui o Cartão e seu Agendamento. Registros históricos permanecem como snapshots. A confirmação é requisito de UI.
- `DELETE /baralhos/{id}` exclui Baralho, Cartões próprios e Agendamentos atomicamente. Registros históricos permanecem. A resposta de sucesso só ocorre depois de a transação confirmar.

Não há rota de desvincular. A operação anterior `DELETE /baralhos/{baralhoId}/vinculos/{cartaoId}` é retirada; o caminho de remover agora exclui o Cartão.

## Transição legada

`GET /acervo/transicao-cartoes` retorna apenas para o Usuário autenticado os Cartões legados sem destino único, com Frente, Verso e os Baralhos anteriores. Cartões automaticamente resolvidos não aparecem.

`POST /acervo/transicao-cartoes`

Request:

```json
{
  "escolhas": [
    { "cartaoId": "c1", "baralhoId": "b1" },
    { "cartaoId": "c2", "baralhoId": "b2" }
  ]
}
```

Para Cartão avulso, `baralhoId` é o destino. Para Cartão compartilhado, indica o Baralho que conserva o original; cópias são criadas nos outros destinos antigos. O conjunto completo do Usuário, incluindo renumeração de Frentes e limpeza dos Vínculos legados desse Usuário, é atômico e idempotente.

- `204 No Content`: transição concluída.
- `400 Bad Request`: escolha incompleta, Baralho inválido ou fora do acervo do Usuário.
- `409 Conflict`: versão/estado mudou e escolhas precisam ser recarregadas.
- `indisponivel`: nada da transição é aplicado parcialmente.

## Salvar seleção temporária

`POST /baralhos/de-selecao` mantém `id`, `nome` e `cartaoIds`, mas cria Cartões cópia no novo Baralho. A seleção e as cópias são inseridas na mesma transação; o mesmo `id` torna o reenvio idempotente. Cópias recebem Frente única por contador e não recebem Agendamento/Histórico. Cartões de origem não mudam.