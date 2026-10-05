# Baralho temporário — protótipo navegável da spec 023

Abra `index.html` diretamente no navegador. Não exige servidor, rede ou instalação para visualizar. O protótipo reutiliza os estilos do repositório; mantenha a estrutura das pastas ao abrir.

## Percurso completo

1. Em Baralhos, clique em **Criar baralho temporário**, botão secundário escuro ao lado de **Criar Baralho**.
2. Adicione **Inglês cotidiano** e **Viagens**. Os dois compartilham Cartões; a seleção resultante contém quatro Cartões únicos.
3. Abra **Adicionar cartões**, filtre por **Sem baralho** e adicione o Cartão disponível. A seleção passa a ter cinco Cartões.
4. Experimente buscar, filtrar, remover e limpar. Alterar os filtros não modifica a seleção existente.
5. Clique em **Estudar**. Todos os selecionados são embaralhados juntos, sem campo de quantidade ou ordenação.
6. Revele o Verso e avalie cada Cartão. Os atalhos 1–4 também funcionam após a revelação. Interromper pede confirmação; Escape cancela o descarte.
7. No Resumo, clique em **Salvar como baralho**, informe um nome e salve. **Abrir baralho** mostra os Cartões vinculados; voltar para Baralhos permite encontrar o novo item na lista.

## Galeria de revisão

Ao final da página, **Cenário de revisão → Abrir cenário** permite acessar diretamente montagem vazia, seleção preenchida, estudo, resumo, salvamento, falha ao registrar, falha ao salvar, Cartão indisponível, falha de carregamento e acervo vazio. Abrir um cenário reinicia os exemplos; esses controles pertencem à demonstração, não ao produto.

- Falha ao registrar: salvar o Baralho fica indisponível até tentar registrar novamente.
- Falha ao salvar: a primeira tentativa falha, preservando o nome e a seleção; a seguinte funciona.
- Cartão indisponível: retirar o indisponível reduz a composição a salvar, sem alterar os resultados da Sessão concluída.

## Limites da demonstração

Todos os dados vivem somente na memória da aba. Não há API, autenticação, gravação no banco ou Histórico persistente. O registro de conclusão é simulado. Datas exibidas nos botões de Avaliação e situações dos filtros são exemplos fixos, não cálculos do algoritmo.

Os fluxos existentes de criação de Baralho comum, edição, navegação fora de Baralhos e estudo de Baralho salvo apresentam um aviso de escopo. O fluxo temporário é navegável. O protótipo não comprova atomicidade, idempotência de rede, concorrência, isolamento por Usuário ou o limite de 1.000 Itens da futura implementação.

## Verificação e capturas

Com as dependências de desenvolvimento existentes:

```sh
rtk proxy node design/baralho-temporario/verificar.mjs
```

Verificado em Chromium: cinco telas em 360, 390, 768 e 1440 px, sem rolagem horizontal; percurso completo com cinco Cartões únicos; busca/filtros sem perda da seleção; confirmação e cancelamento por Escape; foco; avaliação por teclado; nome inválido; salvamento e recuperação de falhas; retirada de indisponível sem alterar o Resumo.

Também foi verificado refluxo por zoom CSS de 200%, que não substitui zoom nativo nem revisão manual com leitor de tela. Há 20 capturas em `capturas/`. As verificações são específicas do protótipo e não alteram ou validam a aplicação.
