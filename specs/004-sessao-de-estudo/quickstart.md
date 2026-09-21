# Quickstart — Validação da Sessão de Estudo

## Pré-requisito

Crie um Baralho elegível com ao menos cinco Cartões vinculados.

## Roteiro

1. Solicitar três Cartões; conferir três Itens sem repetição e ordem definida.
2. Solicitar mais que o disponível; conferir aviso e uso de todos os Cartões.
3. Tentar quantidade zero e iniciar Baralho inelegível; ambas recusadas.
4. Em cada Item, conferir Frente inicialmente; revelar Verso; só então registrar
   `acertou` ou `errou`.
5. Concluir e conferir `acertos + erros = estudados`.
6. Interromper outra Sessão e recarregar; conferir ausência de retomada, resumo
   ou dado persistido.
7. Percorrer toda a Sessão por teclado, verificando foco, posição, anúncios e
   textos em português.
8. Repetir em largura de telefone, sem rolagem horizontal.

```bash
cd frontend && npm test
npm run test:e2e
```

