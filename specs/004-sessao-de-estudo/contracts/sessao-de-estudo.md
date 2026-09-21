# Contract — Sessão de Estudo

## Ausência deliberada de contrato HTTP

Não há rota de Sessão, Item, Resultado ou Resumo. Essa ausência é parte do
contrato: FR-038 proíbe persistir esses conceitos.

O frontend obtém Cartões e Baralhos pelas rotas existentes do
`ClienteDoAcervo`, verifica elegibilidade no começo e constrói a Sessão no
Module `SessaoDeEstudo`.

## Interface do Module

```
iniciar(baralhoId, quantidade, cartoes) -> Sessao | erro
revelar()                               -> Item
registrarResultado(acertou | errou)     -> Item | Resumo
estadoAtual()                           -> EstadoDaSessao
```

`iniciar` recusa Baralho inelegível ou quantidade menor que um.
`registrarResultado` recusa chamada antes da Revelação ou após resultado já
definido. Interrupção é descarte local, sem chamada de rede.

