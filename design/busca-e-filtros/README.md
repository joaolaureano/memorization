# Busca e filtros — protótipo das specs 022 e 024

Abra `index.html` diretamente no navegador. Use Baralhos e Cartões na navegação para alternar entre as duas telas. Não requer servidor, rede ou instalação de dependências para visualizar.

## Percurso sugerido

1. Em Baralhos, busque `algebra`: “Álgebra linear” aparece com a etiqueta Revisado.
2. Em Cartões, busque `ATP`: aparece o Cartão sobre mitocôndrias, pela correspondência no Verso.
3. Na mesma tela, limpe os filtros e escolha o Baralho Inglês cotidiano: aparecem os dois Cartões, embora também pertençam a Viagens.
4. Em Baralhos, alterne a Situação entre Pendente e Revisado. As etiquetas são derivadas dos Cartões vinculados; o Baralho sem Cartões aparece só em Todos, como Sem cartões.
5. Em Baralhos, use Revisar em um Baralho Pendente: a modal mostra o nome, as contagens e as opções Só pendentes e Todos os cartões. Cancelar ou Escape fecha sem iniciar e preserva a busca e o filtro aplicados.
6. A revisão tem Frente, Revelar verso, as quatro Avaliações e o Resumo com Voltar para Baralhos; interromper pede confirmação e não altera a situação. Concluir simula em dia os Cartões avaliados nos Baralhos que os compartilham.
7. Em um Baralho Revisado, Revisar começa todos embaralhados direto, sem modal.
8. Em Cartões, experimente Sem baralho e a busca pelo Verso.
9. Use a galeria ao final da página para conferir busca sem resultados, acervo vazio, carregamento e falha. Tentar novamente preserva os critérios.
10. Exclua um resultado para conferir confirmação, atualização da contagem e preservação dos filtros. Reiniciar exemplos restaura os dados.

## Limites

Dados fictícios somente na memória da aba. A Situação de cada Baralho é derivada dos Cartões de exemplo (Pendente se algum estiver pendente ou novo; Revisado se todos estiverem em dia); não há cálculo de Agendamento, de SM-2 nem ligação à aplicação. Concluir uma revisão apenas simula os Cartões avaliados como em dia em todos os Baralhos que os compartilham; interromper não altera a situação e nenhum Histórico é registrado. Ações fora da busca, dos filtros, da exclusão e da revisão demonstrativas abrem um aviso de escopo. A galeria pertence ao protótipo, não ao produto.

O protótipo reutiliza `../../frontend/src/estilos.css` sem modificá-lo. Preserve essa estrutura ao abrir o arquivo. Os ajustes locais são o painel de filtros, controles da galeria, espaçamento dos rótulos de navegação móvel para evitar quebra de palavras, as etiquetas de situação e as telas da revisão (classes `.bf-etiqueta`, `.bf-escolhas`, `.bf-cartao` e `.bf-resumo`, com prefixo próprio, para não afetar outros protótipos que importam este CSS).

## Verificação

Com as dependências de desenvolvimento do repositório disponíveis:

```sh
rtk proxy node design/busca-e-filtros/verificar.mjs
```

O verificador cobre, em Chromium: as duas telas em 360, 390, 768 e 1440 px, ausência de rolagem horizontal, busca normalizada e pelo Verso, etiquetas de situação derivadas dos Cartões, filtro de situação em Baralhos e ausência dele em Cartões, modal de revisão com nome do Baralho, contagens, foco inicial em Cancelar e Escape, Só pendentes e Todos os cartões, início direto em Baralho Revisado, conclusão que simula em dia e atualiza etiquetas de Baralhos que compartilham Cartões, interrupção que não altera a situação, preservação dos filtros, exclusão, foco, estados vazios e o fluxo de revisão em 390 px. Cobre também refluxo com zoom CSS de 200%; isso não substitui zoom nativo nem revisão manual com leitor de tela.

As doze capturas ficam em `capturas/`, incluindo `modal-revisao-390.png` e `modal-revisao-1440.png`. Esses testes verificam somente o protótipo, não a implementação da feature no produto.
