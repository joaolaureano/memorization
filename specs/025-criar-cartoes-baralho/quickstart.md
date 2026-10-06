# Quickstart — Criar Cartões dentro de Baralhos

## Protótipo

Abra `design/criar-cartoes-no-baralho/index.html` diretamente no navegador. O protótipo não requer servidor, rede ou instalação e mantém os dados apenas na memória da aba.

Execute o verificador Playwright da raiz:

```sh
rtk proxy node design/criar-cartoes-no-baralho/verificar.mjs
```

Resultado esperado: criação contextual, contador de Frente, transição legada, cópia de seleção, confirmação de exclusões, teclado e telas de 360, 390, 768 e 1440 px sem rolagem horizontal.

## Produto — gates focados

Backend:

```sh
cd backend
rtk npm test
rtk npm run typecheck
rtk npm run lint
```

Frontend:

```sh
cd frontend
rtk npm test
rtk npm run build
rtk npm run lint
```

Fluxo integrado e persistência:

```sh
rtk npm run test:e2e
```

## Cenários de aceitação

1. Entrar, abrir um Baralho, criar `To walk` e confirmar que aparece somente nele após recarregar.
2. Criar outra Frente equivalente no mesmo Baralho; confirmar contador automático, Verso preservado e anúncio do resultado.
3. Editar um Cartão para uma Frente já existente no mesmo Baralho; confirmar recusa sem perda do digitado.
4. Salvar uma seleção com Frentes repetidas; confirmar cópias numeradas, originais e Agendamentos inalterados, e cópias sem Agendamento/Histórico.
5. Migrar Cartão avulso e compartilhado de dois Usuários; concluir um Usuário sem bloquear o outro, manter original/histórico no destino escolhido e copiar para destinos restantes.
6. Excluir Cartão e Baralho; confirmar Agendamento removido, snapshots históricos preservados e rollback integral em falha.
7. Com PostgreSQL na versão 13 e um Usuário pendente, confirmar que cloud/Lambda iniciam e encaminham somente esse Usuário para transição; versão 12 continua recusada. Após a última transição, reaplicar a migração cloud e verificar a versão 14 sem `vinculo`.