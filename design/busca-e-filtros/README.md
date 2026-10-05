# Busca e filtros — protótipo da spec 022

Abra `index.html` diretamente no navegador. Use Baralhos e Cartões na navegação para alternar entre as duas telas. Não requer servidor, rede ou instalação de dependências para visualizar.

## Percurso sugerido

1. Em Baralhos, busque `algebra`: “Álgebra linear” aparece.
2. Em Cartões, busque `ATP`: aparece o Cartão sobre mitocôndrias, pela correspondência no Verso.
3. Limpe os filtros, escolha Inglês cotidiano e Revisão pendente: aparece “How are you?” uma única vez, embora também pertença a Viagens.
4. Experimente Sem baralho e Novos.
5. Use a galeria ao final da página para conferir busca sem resultados, acervo vazio, carregamento e falha. Tentar novamente preserva os critérios.
6. Exclua um resultado para conferir confirmação, atualização da contagem e preservação dos filtros. Reiniciar exemplos restaura os dados.

## Limites

Dados fictícios somente na memória da aba. Situações de revisão são exemplos fixos para comparação visual; não há cálculo de Agendamento nem ligação à aplicação. Ações fora da busca, filtros e exclusão demonstrativa abrem um aviso de escopo. A galeria pertence ao protótipo, não ao produto.

O protótipo reutiliza `../../frontend/src/estilos.css` sem modificá-lo. Preserve essa estrutura ao abrir o arquivo. Os ajustes locais são o painel de filtros, controles da galeria e espaçamento dos rótulos de navegação móvel para evitar quebra de palavras.

## Verificação

Com as dependências de desenvolvimento do repositório disponíveis:

```sh
rtk proxy node design/busca-e-filtros/verificar.mjs
```

Validado em Chromium: as duas telas em 360, 390, 768 e 1440 px, ausência de rolagem horizontal, busca normalizada e pelo Verso, combinação de filtros, cartões sem Baralho, recuperação, confirmação e cancelamento por Escape, foco, exclusão e estados vazios. Verificado também refluxo com zoom CSS de 200%; isso não substitui zoom nativo nem revisão manual com leitor de tela.

As dez capturas ficam em `capturas/`. Esses testes verificam somente o protótipo, não a implementação da feature no produto.
