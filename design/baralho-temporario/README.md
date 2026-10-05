# Baralho temporário — protótipo navegável das specs 023 e 024

Abra `index.html` diretamente no navegador. Não exige servidor, rede ou instalação para visualizar. O protótipo reutiliza os estilos do repositório; mantenha a estrutura das pastas ao abrir. Os rótulos de ação usam **Revisar**; o destino **Estudo** da navegação principal permanece.

## Revisar um Baralho (024)

1. Em **Baralhos**, cada linha mostra a situação derivada dos Cartões — **Pendente**, **Revisado** ou **Sem cartões** — imediatamente à esquerda dos botões **Revisar** e **Editar**. O filtro **Situação da revisão** (Todos, Pendente, Revisado) combina com a busca; Pendente e Revisado excluem Baralhos vazios.
2. **Revisar** em um Baralho pendente abre uma modal pequena com **Só pendentes**, **Todos os cartões** (com contagens) e **Cancelar**: o foco começa em Cancelar, Escape fecha sem iniciar e a escolha começa a Sessão direto, sem quantidade.
3. **Revisar** em um Baralho revisado inicia todos os Cartões embaralhados, sem modal. Em Baralho vazio, Revisar fica desabilitado, com o motivo acessível.
4. A conclusão simula o Agendamento: os Cartões avaliados ficam em dia em todos os Baralhos que os compartilham, mudando a situação exibida. Interromper não atualiza Agendamentos. A revisão comum termina com **Revisar novamente** e **Voltar para Baralhos**, sem oferecer **Salvar como baralho**.

## Percurso do baralho temporário

1. Em Baralhos, clique em **Criar baralho temporário**, botão secundário escuro ao lado de **Criar Baralho**.
2. Adicione **Inglês cotidiano** e **Viagens**. Os dois compartilham Cartões; a seleção resultante contém quatro Cartões únicos.
3. Abra **Adicionar cartões**, filtre por **Sem baralho** e adicione o Cartão disponível. A seleção passa a ter cinco Cartões.
4. Experimente buscar, filtrar por situação (na fonte de Baralhos) ou por Baralho (na fonte de Cartões), remover e limpar. Alterar os filtros não modifica a seleção existente.
5. Clique em **Revisar**. Todos os selecionados são embaralhados juntos e a Sessão começa direto, sem modal, campo de quantidade ou ordenação.
6. Revele o Verso e avalie cada Cartão. Os atalhos 1–4 também funcionam após a revelação. Interromper pede confirmação; Escape cancela o descarte.
7. No Resumo, a origem **Estudo com baralho temporário** aparece como texto secundário abaixo de **Sessão concluída**, e o registro confirmado é apenas anunciado ao leitor de tela. Clique em **Salvar como baralho**, informe um nome e salve (a lista de ids a salvar é separada dos Itens do Resumo). **Abrir baralho** mostra os Cartões vinculados e **Revisar** também funciona nesse Baralho salvo.

## Galeria de revisão

Ao final da página, **Cenário de revisão → Abrir cenário** permite acessar diretamente montagem vazia, seleção preenchida, revisão, resumo, salvamento, falha ao registrar, falha ao salvar, Cartão indisponível, falha de carregamento e acervo vazio. Abrir um cenário reinicia os exemplos; esses controles pertencem à demonstração, não ao produto.

- Falha ao registrar: salvar o Baralho fica indisponível com a falha visível até tentar registrar novamente.
- Falha ao salvar: a primeira tentativa falha, preservando o nome e a seleção; a seguinte funciona.
- Cartão indisponível: retirar o indisponível reduz a composição a salvar, sem alterar os resultados da Sessão concluída.

## Dados de exemplo

Cinco Baralhos e nove Cartões: **Inglês cotidiano**, **Viagens** e **Biologia** ficam Pendentes, **Álgebra linear** fica Revisado e **História do Brasil** fica vazio (**Sem cartões**). Há Cartões novos, vencidos, em dia e um sem Baralho. O Cartão compartilhado entre Inglês e Viagens mostra que concluir uma revisão muda a situação nos dois.

## Limites da demonstração

Todos os dados vivem somente na memória da aba. Não há API, autenticação, gravação no banco ou Histórico persistente. O registro de conclusão é simulado; as datas exibidas nos botões de Avaliação são exemplos fixos e a situação dos Cartões só muda pela conclusão simulada, não por cálculo de SM-2. O limite de 1.000 Itens não é aplicado.

Os fluxos existentes de criação de Baralho comum, edição e navegação fora de Baralhos apresentam um aviso de escopo; Revisar funciona na lista, na seleção temporária e no Baralho salvo. O protótipo não comprova atomicidade, idempotência de rede, concorrência, isolamento por Usuário ou o limite de 1.000 Itens da implementação real.

## Verificação e capturas

Com as dependências de desenvolvimento existentes:

```sh
rtk proxy node design/baralho-temporario/verificar.mjs
```

O roteiro abre cinco telas em 360, 390, 768 e 1440 px, confere a ausência de rolagem horizontal e regenera as 20 capturas de `capturas/`. Também verifica a nomenclatura **Revisar**, a situação derivada com etiquetas e filtro em Baralhos, a modal de pendentes (foco inicial, Tab e Escape), o subconjunto só pendentes, o subconjunto todos, o Baralho revisado iniciando direto, a revisão temporária direta com salvamento e recuperações, a revisão comum sem **Salvar como baralho**, a conclusão atualizando os Baralhos que compartilham Cartões, a interrupção sem atualização e o refluxo por zoom CSS de 200%.

O zoom CSS de 200% não substitui zoom nativo nem revisão manual com leitor de tela. As verificações são específicas do protótipo e não alteram ou validam a aplicação.
