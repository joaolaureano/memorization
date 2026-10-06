# Criar Cartões dentro de Baralhos — protótipo da spec 025

Abra `index.html` diretamente no navegador. Não precisa iniciar servidor nem acessar a rede. O protótipo importa `../../frontend/src/estilos.css`; mantenha a estrutura de diretórios. Dados demonstrativos existem somente na memória da aba.

## Percursos

1. Em **Baralhos**, abra Inglês cotidiano ou Viagens. O detalhe lista Frente e Verso, com Editar e Excluir.
2. Crie um Cartão. `To walk` já existe em Inglês cotidiano; uma nova criação recebe `To walk (2)`. O anúncio confirma a Frente resultante.
3. Edite um Cartão e tente uma Frente já usada no mesmo Baralho; a edição é recusada e o texto permanece.
4. Exclua um Cartão ou Baralho. A confirmação informa o Agendamento e os Cartões afetados; Registros históricos permanecem.
5. No rodapé, escolha **Cartões legados**. A transição permite definir destino de Cartão avulso e escolher onde o original de um Cartão compartilhado permanece. As cópias são criadas nos outros Baralhos sem Agendamento/Histórico.
6. Use **Simular seleção salva** para criar Minha seleção com cópias; Frentes repetidas são numeradas e os originais permanecem.

Os controles de cenário no rodapé são ferramentas do protótipo, não destinos ou ações do produto.

## Limites

O protótipo demonstra a Interface e estados locais, não implementa API, autenticação, migração real, Agendamentos ou persistência. A exclusão e a cópia mudam somente os dados da aba. A validação de contraste com leitor de tela e zoom nativo continua manual.

## Verificação

```sh
rtk proxy node design/criar-cartoes-no-baralho/verificar.mjs
```

O verificador usa Chromium/Playwright, percorre 360, 390, 768 e 1440 px, verifica ausência de rolagem horizontal e gera capturas em `capturas/`.