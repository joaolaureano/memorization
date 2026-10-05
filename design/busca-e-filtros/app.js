/* Protótipo local das specs 022 e 024. Sem API ou persistência. */
const $ = (id) => document.getElementById(id);
const decks = [
  { id: 'ingles', nome: 'Inglês cotidiano' },
  { id: 'viagens', nome: 'Viagens' },
  { id: 'algebra', nome: 'Álgebra linear' },
  { id: 'biologia', nome: 'Biologia' },
  { id: 'historia', nome: 'História do Brasil' },
];
/* Exemplo misto: Inglês fica Pendente pelo Cartão novo e a modal de revisão
 * mostra contagens diferentes entre Só pendentes e Todos os cartões. */
const examples = [
  { id: 1, frente: 'How are you?', verso: 'Como você está?', baralhos: ['ingles', 'viagens'], situacao: 'em-dia' },
  { id: 2, frente: 'Where is the nearest station?', verso: 'Onde fica a estação mais próxima?', baralhos: ['ingles', 'viagens'], situacao: 'novos' },
  { id: 3, frente: 'O que é uma matriz identidade?', verso: 'Matriz quadrada com 1 na diagonal principal e 0 nas demais posições.', baralhos: ['algebra'], situacao: 'em-dia' },
  { id: 4, frente: 'Quando dois vetores são ortogonais?', verso: 'Quando seu produto interno é zero.', baralhos: ['algebra'], situacao: 'em-dia' },
  { id: 5, frente: 'Qual é a função das mitocôndrias?', verso: 'Produzir ATP pela respiração celular.', baralhos: ['biologia'], situacao: 'pendente' },
  { id: 6, frente: 'O que é osmose?', verso: 'Movimento de água através de uma membrana semipermeável.', baralhos: ['biologia'], situacao: 'novos' },
  { id: 7, frente: 'O que significa aprender ativamente?', verso: 'Recuperar e aplicar o conhecimento em vez de apenas reler.', baralhos: [], situacao: 'novos' },
  { id: 8, frente: 'Qual é a diferença entre tempo e clima?', verso: 'Tempo descreve condições momentâneas; clima descreve padrões de longo prazo.', baralhos: [], situacao: 'em-dia' },
];
let cards = structuredClone(examples);
let page = 'baralhos';
let pendingDelete = null;
let dialogAction = null;
let reviewRequest = null;
let sessao = null;
const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const statusInfo = {
  pendente: { classe: 'bf-etiqueta--pendente', rotulo: 'Pendente' },
  revisado: { classe: 'bf-etiqueta--revisado', rotulo: 'Revisado' },
  vazio: { classe: 'bf-etiqueta--vazio', rotulo: 'Sem cartões' },
};
const avaliacoes = ['Errei', 'Difícil', 'Bom', 'Fácil'];
const diasDasAvaliacoes = [1, 2, 4, 7];
/* Situação derivada dos Cartões vinculados, sem atributo próprio do Baralho. */
function linkedCards(deckId) { return cards.filter((card) => card.baralhos.includes(deckId)); }
function deckStatus(deckId) {
  const linked = linkedCards(deckId);
  if (!linked.length) return 'vazio';
  return linked.some((card) => card.situacao === 'novos' || card.situacao === 'pendente') ? 'pendente' : 'revisado';
}
for (const deck of decks) $('baralho').add(new Option(deck.nome, deck.id));

function clearFilters() {
  $('busca').value = '';
  $('baralho').value = 'todos';
  $('situacao').value = 'todos';
}
function applyPage(next, resetFilters = true) {
  page = next;
  if (resetFilters) {
    clearFilters();
    $('cenario').value = 'normal';
  }
  const isCards = page === 'cartoes';
  $('titulo').textContent = isCards ? 'Cartões' : 'Baralhos';
  document.title = `${$('titulo').textContent} · Busca e filtros — Memorization`;
  $('descricao').textContent = isCards ? 'Perguntas e respostas para construir sua memória.' : 'Escolha o que você quer memorizar hoje.';
  $('criar').textContent = isCards ? 'Criar cartão' : 'Criar baralho';
  $('rotulo-busca').textContent = isCards ? 'Buscar cartões' : 'Buscar baralhos';
  $('busca').placeholder = isCards ? 'Buscar na frente ou no verso' : 'Digite o nome do baralho';
  $('campo-baralho').hidden = !isCards;
  $('campo-situacao').hidden = isCards;
  document.querySelectorAll('[data-page]').forEach((link) => {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  $('visao-revisao').hidden = true;
  $('visao-lista').hidden = false;
  renderResults();
}
function renderPage() {
  /* A revisão em andamento mantém a tela da Sessão. */
  if (sessao) return;
  applyPage(location.hash === '#cartoes' ? 'cartoes' : 'baralhos');
}
function renderResults() {
  const scenario = $('cenario').value;
  const query = normalize($('busca').value);
  const isCards = page === 'cartoes';
  const all = scenario === 'vazio' ? [] : isCards ? cards : decks;
  const filtered = all.filter((item) => {
    if (!isCards) {
      const status = $('situacao').value;
      return normalize(item.nome).includes(query) && (status === 'todos' || status === deckStatus(item.id));
    }
    const deck = $('baralho').value;
    return (normalize(item.frente).includes(query) || normalize(item.verso).includes(query))
      && (deck === 'todos' || (deck === 'sem' ? !item.baralhos.length : item.baralhos.includes(deck)));
  });
  $('contagem').textContent = ['falha', 'carregando'].includes(scenario) ? '' : `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}`;
  if (scenario === 'carregando') {
    $('resultados').innerHTML = '<div class="estado-vazio"><p role="status">Carregando…</p><button data-retry>Concluir carregamento</button></div>';
  } else if (scenario === 'falha') {
    $('resultados').innerHTML = '<div class="estado-vazio"><p role="alert">Não foi possível carregar a lista. Tente novamente.</p><button data-retry>Tentar novamente</button></div>';
  } else if (!all.length) {
    $('resultados').innerHTML = `<div class="estado-vazio"><p>Ainda não há ${isCards ? 'Cartões' : 'Baralhos'}. Crie o primeiro para começar.</p><button data-preview="${isCards ? 'Criar cartão' : 'Criar baralho'}">${$('criar').textContent}</button></div>`;
  } else if (!filtered.length) {
    $('resultados').innerHTML = '<div class="estado-vazio"><h2>Nenhum resultado encontrado</h2><p>Altere a busca ou limpe os filtros para ver o acervo.</p><button data-clear>Limpar filtros</button></div>';
  } else {
    $('resultados').innerHTML = `<ul class="lista lista--compacta">${filtered.map((item) => {
      const name = escapeHtml(isCards ? item.frente : item.nome);
      const count = cards.filter((card) => card.baralhos.includes(item.id)).length;
      const status = isCards ? null : deckStatus(item.id);
      const etiqueta = status ? `<span class="bf-etiqueta ${statusInfo[status].classe}" data-status="${status}">${statusInfo[status].rotulo}</span>` : '';
      return `<li class="linha-da-lista"><div class="linha-da-lista__texto"><p class="linha-da-lista__titulo">${name}</p>${isCards ? '' : `<p class="linha-da-lista__detalhe">${count} ${count === 1 ? 'Cartão' : 'Cartões'}</p>`}</div><div class="linha-da-lista__acoes">${isCards
        ? `<button class="botao botao--perigo" data-delete="${item.id}" aria-label="Excluir ${name}">Excluir</button>`
        : `${etiqueta}<button class="botao botao--secundario" data-revisar="${item.id}" aria-label="Revisar ${name}" ${count ? '' : `disabled aria-describedby="vazio-${item.id}"`}>Revisar</button>`}
        <button class="botao botao--secundario" data-preview="Editar ${name}" aria-label="Editar ${name}">Editar</button></div>${!isCards && !count ? `<span class="visualmente-oculto" id="vazio-${item.id}">Sem Cartões para revisar.</span>` : ''}</li>`;
    }).join('')}</ul>`;
  }
}
/* Diálogo genérico do protótipo: prévias de escopo, exclusão e interrupção. */
function showDialog(title, text, options = {}) {
  dialogAction = options.action ?? null;
  $('dialogo-titulo').textContent = title;
  $('dialogo-texto').textContent = text;
  $('cancelar').textContent = options.confirmLabel ? 'Cancelar' : 'Fechar';
  $('confirmar').hidden = !options.confirmLabel;
  if (options.confirmLabel) $('confirmar').textContent = options.confirmLabel;
  $('dialogo').showModal();
  $('cancelar').focus();
}
function preview(title) {
  showDialog(title, 'Este protótipo demonstra busca, filtros, etiquetas e o início da revisão. Esta ação mantém o fluxo existente da aplicação e não é simulada aqui.');
}
$('cancelar').onclick = () => $('dialogo').close();
$('confirmar').onclick = () => { const run = dialogAction; dialogAction = null; $('dialogo').close(); run?.(); };

/* Revisão do Baralho (024, FR-383/FR-384): Baralho Pendente escolhe entre o
 * subconjunto e todos; Revisado inicia direto; vazio nem chega aqui. */
function requestReview(deckId) {
  const deck = decks.find((item) => item.id === deckId);
  if (!deck || !linkedCards(deck.id).length) return;
  if (deckStatus(deck.id) === 'pendente') {
    const linked = linkedCards(deck.id);
    const pendentes = linked.filter((card) => card.situacao !== 'em-dia').length;
    reviewRequest = deck;
    $('revisao-nome').textContent = deck.nome;
    $('contagem-pendentes').textContent = `${pendentes} ${pendentes === 1 ? 'Cartão' : 'Cartões'}`;
    $('contagem-todas').textContent = `${linked.length} ${linked.length === 1 ? 'Cartão' : 'Cartões'}`;
    $('dialogo-revisao').showModal();
    $('cancelar-revisao').focus();
    return;
  }
  startReview(deck, 'todos');
}
function chooseReview(conjunto) {
  const deck = reviewRequest;
  reviewRequest = null;
  $('dialogo-revisao').close();
  if (deck) startReview(deck, conjunto);
}
$('cancelar-revisao').onclick = () => { reviewRequest = null; $('dialogo-revisao').close(); };
$('revisar-pendentes').onclick = () => chooseReview('pendentes');
$('revisar-todas').onclick = () => chooseReview('todos');
$('dialogo-revisao').addEventListener('close', () => { reviewRequest = null; });

function startReview(deck, conjunto) {
  const linked = linkedCards(deck.id);
  const chosen = conjunto === 'pendentes' ? linked.filter((card) => card.situacao !== 'em-dia') : linked;
  if (!chosen.length) return;
  const items = chosen.map((card) => ({ ...card }));
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  sessao = { deck, items, ratings: items.map(() => null), position: 0, revealed: false };
  renderSession();
}
function renderSession() {
  const item = sessao.items[sessao.position];
  const revelado = sessao.revealed;
  document.title = `Revisar ${sessao.deck.nome} · Busca e filtros — Memorization`;
  $('visao-lista').hidden = true;
  $('visao-revisao').hidden = false;
  $('visao-revisao').innerHTML = `
    <div class="bf-sessao">
      <div class="bf-sessao__topo"><button class="botao botao--secundario" data-interromper>Interromper</button></div>
      <h1 tabindex="-1" id="titulo-revisao">Revisar ${escapeHtml(sessao.deck.nome)}</h1>
      <p class="texto-secundario" id="progresso-revisao">Cartão ${sessao.position + 1} de ${sessao.items.length}</p>
      <article class="bf-cartao" aria-label="Item ${sessao.position + 1} de ${sessao.items.length}">
        <h2 class="bf-cartao__lado">Frente</h2>
        <p class="bf-cartao__conteudo">${escapeHtml(item.frente)}</p>
        ${revelado ? `<h2 class="bf-cartao__lado" id="verso-titulo" tabindex="-1">Verso</h2><p class="bf-cartao__conteudo">${escapeHtml(item.verso)}</p><div class="bf-avaliacoes">${avaliacoes.map((nivel, indice) => `<button class="botao botao--secundario" data-avaliar="${indice}" aria-label="${nivel}, próxima revisão em ${diasDasAvaliacoes[indice]} ${indice === 0 ? 'dia' : 'dias'}">${nivel}<small>${diasDasAvaliacoes[indice]} ${indice === 0 ? 'dia' : 'dias'}</small></button>`).join('')}</div>` : '<div class="bf-cartao__acoes"><button class="botao botao--primario" data-revelar>Revelar verso</button></div>'}
      </article>
    </div>`;
  window.scrollTo(0, 0);
  if (revelado) $('verso-titulo').focus();
  else $('titulo-revisao').focus();
}
function reveal() {
  if (!sessao || sessao.revealed) return;
  sessao.revealed = true;
  renderSession();
}
function rate(level) {
  if (!sessao || !sessao.revealed) return;
  sessao.ratings[sessao.position] = level;
  if (sessao.position + 1 === sessao.items.length) { applySchedule(); renderSummary(); return; }
  sessao.position += 1;
  sessao.revealed = false;
  renderSession();
}
/* Concluir simula o Agendamento: os Cartões avaliados ficam em dia em todos os
 * Baralhos que os compartilham. Interromper não passa por aqui. */
function applySchedule() {
  for (const item of sessao.items) {
    const card = cards.find((candidate) => candidate.id === item.id);
    if (card) card.situacao = 'em-dia';
  }
}
function renderSummary() {
  const total = sessao.items.length;
  const counts = avaliacoes.map((_, indice) => sessao.ratings.filter((nota) => nota === indice).length);
  const acertos = total - counts[0];
  document.title = 'Sessão concluída · Busca e filtros — Memorization';
  $('visao-revisao').innerHTML = `
    <div class="bf-resumo">
      <h1 tabindex="-1">Sessão concluída</h1>
      <p class="texto-secundario">${escapeHtml(sessao.deck.nome)} · ${total} ${total === 1 ? 'Cartão' : 'Cartões'} avaliados ficam em dia nos Baralhos que os compartilham.</p>
      <p class="bf-placar">${Math.round((acertos / total) * 100)}%</p>
      <p>${acertos} de ${total} Cartões</p>
      <div class="bf-legenda">${avaliacoes.map((nivel, indice) => `<span>${nivel}: ${counts[indice]}</span>`).join('')}</div>
      <p role="status" class="visualmente-oculto">Sessão concluída e registrada. Os Cartões avaliados estão em dia.</p>
      <div class="bf-resumo__acoes"><button class="botao botao--primario" data-voltar-baralhos>Voltar para Baralhos</button></div>
    </div>`;
  window.scrollTo(0, 0);
  $('visao-revisao').querySelector('h1').focus();
}
function requestInterrupt() {
  if (!sessao) return;
  showDialog('Interromper revisão?', 'A Sessão será interrompida e não será registrada. Os Agendamentos permanecem como estão.', {
    confirmLabel: 'Interromper',
    action: () => { sessao = null; showDecks(); },
  });
}
/* Volta para a lista preservando os filtros quando o hash já aponta Baralhos. */
function showDecks() {
  sessao = null;
  if (location.hash !== '#baralhos') { location.hash = '#baralhos'; return; }
  applyPage('baralhos', false);
  $('titulo').focus();
}
function requestDelete(cardId) {
  const card = cards.find((item) => item.id === Number(cardId));
  if (!card) return;
  pendingDelete = card.id;
  showDialog('Excluir Cartão', `Excluir “${card.frente}”? ${card.baralhos.length ? `O Cartão e seus vínculos com ${card.baralhos.length} baralho(s) serão removidos.` : 'Este Cartão não está vinculado a nenhum Baralho.'} Nenhum Baralho será excluído. A exclusão é apenas demonstrativa.`, {
    confirmLabel: 'Excluir cartão',
    action: () => {
      cards = cards.filter((item) => item.id !== pendingDelete);
      pendingDelete = null;
      renderResults();
      $('contagem').textContent = `Cartão excluído. ${$('contagem').textContent}`;
      $('busca').focus();
    },
  });
}
$('busca').addEventListener('input', renderResults);
$('baralho').addEventListener('change', renderResults);
$('situacao').addEventListener('change', renderResults);
$('limpar').onclick = () => { clearFilters(); renderResults(); $('busca').focus(); };
$('criar').onclick = () => preview($('criar').textContent);
$('cenario').onchange = () => {
  if ($('cenario').value === 'sem-resultados') $('busca').value = 'termo inexistente';
  else if ($('busca').value === 'termo inexistente') $('busca').value = '';
  renderResults();
};
$('reiniciar').onclick = () => {
  if ($('dialogo').open) $('dialogo').close();
  if ($('dialogo-revisao').open) $('dialogo-revisao').close();
  sessao = null;
  cards = structuredClone(examples);
  renderPage();
};
document.addEventListener('click', (event) => {
  const target = event.target.closest('button, a');
  if (!target) return;
  if (target.hasAttribute('data-preview')) { event.preventDefault(); preview(target.dataset.preview); }
  else if (target.hasAttribute('data-clear')) { clearFilters(); renderResults(); $('busca').focus(); }
  else if (target.hasAttribute('data-retry')) { $('cenario').value = 'normal'; renderResults(); $('busca').focus(); }
  else if (target.hasAttribute('data-delete')) requestDelete(target.dataset.delete);
  else if (target.hasAttribute('data-revisar')) requestReview(target.dataset.revisar);
  else if (target.hasAttribute('data-revelar')) reveal();
  else if (target.hasAttribute('data-avaliar')) rate(Number(target.dataset.avaliar));
  else if (target.hasAttribute('data-interromper')) requestInterrupt();
  else if (target.hasAttribute('data-voltar-baralhos')) showDecks();
});
window.addEventListener('hashchange', renderPage);
renderPage();
