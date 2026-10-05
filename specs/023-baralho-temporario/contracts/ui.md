# Contrato de UI — 023

Derivado de [`design/baralho-temporario/`](../../../design/baralho-temporario/), com os esclarecimentos de 2026-10-05: sem link de voltar, sem sobretítulos e confirmação do registro só anunciada. Os textos estão em pt-BR e são exatos.

## Baralhos (`#/baralhos`)

O cabeçalho passa a ter um grupo de ações `<div className="acoes">` com `Criar baralho` (`botao botao--primario`, link existente) seguido de `Criar baralho temporário`, um link `botao botao--secundario` para `#/baralhos/temporario`. As ações quebram linha em telas estreitas (`.cabecalho-da-pagina .acoes { flex-wrap: wrap; }`).

## Montagem (`#/baralhos/temporario`)

- Cabeçalho: `<h1 tabIndex={-1}>Criar baralho temporário</h1>` e `<p className="texto-secundario">Escolha o conteúdo para esta Sessão. Você poderá salvar o baralho ao terminar.</p>`. O foco vai ao título ao abrir.
- `<div className="montagem">` com duas colunas (`minmax(0,1.2fr) minmax(0,1fr)`), em uma coluna até 850 px:
  - **Fontes**: `<section className="fontes" aria-label="Conteúdo disponível">`
    - alternância `.alternar-fontes` com dois botões `aria-pressed`: «Adicionar baralhos» e «Adicionar cartões». Trocar de fonte limpa a busca e mantém o foco no botão escolhido;
    - filtros `.filtros-montagem`. Em Baralhos: «Buscar baralhos» (search, placeholder «Digite o nome do baralho»). Em Cartões: «Buscar cartões» (placeholder «Buscar na frente ou no verso»), «Baralho» (Todos / Sem baralho / Baralhos) e «Situação da revisão» (Todos / Novos / Revisão pendente / Em dia), com as regras de `busca-no-acervo` da 022;
    - faixa `.resultado-cabecalho` com a contagem `role="status"` («N resultado(s)») e «Limpar filtros», que limpa só os filtros da fonte;
    - lista compacta (`lista lista--compacta`, `linha-da-lista`). Baralho: nome e detalhe «N Cartões», ou «0 Cartões · Baralho vazio». Cartão: Frente. A ação de cada linha é um botão: «Adicionar» quando há Cartões ausentes da seleção; «Adicionado», desabilitado, quando todos já estão; «Sem cartões», desabilitado, em Baralho vazio. Os nomes acessíveis são «Adicionar <nome ou Frente>».
    - Estados: carregando («Carregando o acervo…», via `EstadoDaCarga`); falha («Não foi possível carregar o acervo.» com «Tentar novamente», preservando seleção e filtros); acervo vazio («Seu acervo está vazio. Crie cartões para montar um estudo.» com o link «Criar cartão»); sem resultados («Nenhum resultado encontrado. Altere a busca ou os filtros.» com «Limpar filtros»).
  - **Seleção**: `<section className="selecao" aria-labelledby="titulo-da-selecao">`
    - `.titulo-contagem`: `<h2 id="titulo-da-selecao">Seleção do estudo</h2>` e `<span>N Cartão/Cartões</span>`;
    - preenchida: `<ul className="lista-da-selecao">` com a Frente e o botão «Remover» (`aria-label="Remover <Frente>"`) por Cartão, na ordem de inclusão; depois «Limpar seleção»;
    - vazia: `.estado-vazio` com `<h3>Seu estudo começa aqui</h3>` e «Adicione baralhos ou cartões individuais. Cartões repetidos entram uma só vez.»;
    - nota `<p className="nota-selecao" id="orientacao-da-selecao">`: «Todos os cartões selecionados serão estudados em ordem aleatória.» (preenchida), «Adicione pelo menos um cartão para estudar.» (vazia) ou «Reduza a seleção para no máximo 1.000 cartões.» (acima do limite);
    - `.acoes-selecao`: «Estudar» (`botao--primario`, desabilitado quando não pode iniciar, `aria-describedby="orientacao-da-selecao"`) e «Cancelar» (volta para `#/baralhos`).
- Adicionar anuncia, numa região viva polida, «N Cartões na seleção. Cartões repetidos entram uma só vez.»
- Estudar relê os Cartões. Se algum sumiu, mostra um alerta «N Cartão não está mais disponível.» ou «N Cartões não estão mais disponíveis.», com «Retirar indisponíveis», e não inicia. A seleção é preservada.
- Com seleção preenchida, sair por navegação, Cancelar ou recarga pede a confirmação de descarte vigente: título «Descartar este percurso?», descrição «A seleção e os campos não salvos serão descartados.».

## Sessão (`#/baralhos/temporario/estudo`)

É a `PaginaDeEstudo` vigente, com `<h1>Estudar baralho temporário</h1>`, Revelação, quatro Avaliações com prévias e atalhos, e Interromper com a confirmação vigente. Recarregar sem a seleção em memória volta para Baralhos.

## Resumo (variante temporária)

- `<h1>Sessão concluída</h1>` e, logo abaixo, `<p className="texto-secundario">Estudo com baralho temporário</p>`. Depois, o `ResumoDaSessao` vigente.
- Registro: «Registrando a Sessão…» enquanto pendente; confirmação só anunciada; falha com a mensagem do cliente e «Tentar registrar novamente».
- Ações:
  - «Salvar como baralho» (`botao--primario`). Desabilitado até o registro ser confirmado, com o motivo visível «Registre a Sessão para salvar o baralho.» ligado por `aria-describedby`;
  - «Voltar para Baralhos» (`botao--secundario`), que passa pela proteção vigente se o registro estiver pendente ou tiver falhado;
  - depois de salvar: `<p className="aviso aviso--sucesso">Baralho salvo.</p>` e «Abrir baralho» (link para `#/baralhos/<id>`) no lugar de «Salvar como baralho».

## Salvar como baralho (substitui o Resumo na mesma rota)

- `<h1 tabIndex={-1}>Salvar como baralho</h1>` e `<p className="texto-secundario">Guarde esta seleção para estudar novamente.</p>`. O foco vai ao campo de nome.
- Formulário `.cartao`:
  - campo «Nome do baralho» com contador «N / 100 caracteres» e as mensagens de Baralho vigentes;
  - «N Cartões serão vinculados. Os baralhos de origem serão preservados.» (ou «1 Cartão será vinculado. …»);
  - «Salvar» (primário) e «Cancelar» (volta ao Resumo, sem criar nada).
- Nome inválido: mensagem do cliente, foco no campo e nome preservado.
- Falha: «Não foi possível salvar. Seu nome e a seleção foram preservados. Tente novamente.»; a nova tentativa reusa o mesmo id.
- Cartões indisponíveis: alerta «N Cartão não está mais disponível. Retire-o e confira a nova contagem antes de salvar.» (no plural: «N Cartões não estão mais disponíveis. Retire-os e confira a nova contagem antes de salvar.») com «Retirar indisponíveis». Retirar atualiza a contagem; sem restantes, «Não há Cartões disponíveis para salvar.» e Salvar desabilitado.
- Sucesso: volta ao Resumo com «Baralho salvo.» e «Abrir baralho», com o foco em «Abrir baralho».
- Cancelar: volta ao Resumo com o foco em «Salvar como baralho».

## CSS (`estilos.css`)

Entram as regras do protótipo para `.montagem`, `.fontes`, `.selecao`, `.alternar-fontes` (inclusive `[aria-pressed="true"]`), `.filtros-montagem`, `.lista-da-selecao`, `.titulo-contagem`, `.acoes-selecao`, `.nota-selecao`, `.estado-vazio h3`, `.cabecalho-da-pagina .acoes`, e as media queries de 850 px e 480 px aplicáveis a essas classes. Não entram as regras de `.estudo-demo`, `.avaliacoes`, `.placar`, `.segmentos` nem `.galeria`, porque a Sessão e o Resumo reutilizam os estilos vigentes.
