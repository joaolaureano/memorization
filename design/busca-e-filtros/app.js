/* Protótipo local da spec 022. Sem API ou persistência. */
const $ = (id) => document.getElementById(id);
const decks = [
  { id: 'ingles', nome: 'Inglês cotidiano' },
  { id: 'viagens', nome: 'Viagens' },
  { id: 'algebra', nome: 'Álgebra linear' },
  { id: 'biologia', nome: 'Biologia' },
  { id: 'historia', nome: 'História do Brasil' },
];
const examples = [
  { id: 1, frente: 'How are you?', verso: 'Como você está?', baralhos: ['ingles', 'viagens'], situacao: 'pendente' },
  { id: 2, frente: 'Where is the nearest station?', verso: 'Onde fica a estação mais próxima?', baralhos: ['ingles', 'viagens'], situacao: 'novos' },
  { id: 3, frente: 'O que é uma matriz identidade?', verso: 'Matriz quadrada com 1 na diagonal principal e 0 nas demais posições.', baralhos: ['algebra'], situacao: 'em-dia' },
  { id: 4, frente: 'Quando dois vetores são ortogonais?', verso: 'Quando seu produto interno é zero.', baralhos: ['algebra'], situacao: 'pendente' },
  { id: 5, frente: 'Qual é a função das mitocôndrias?', verso: 'Produzir ATP pela respiração celular.', baralhos: ['biologia'], situacao: 'pendente' },
  { id: 6, frente: 'O que é osmose?', verso: 'Movimento de água através de uma membrana semipermeável.', baralhos: ['biologia'], situacao: 'novos' },
  { id: 7, frente: 'O que significa aprender ativamente?', verso: 'Recuperar e aplicar o conhecimento em vez de apenas reler.', baralhos: [], situacao: 'novos' },
  { id: 8, frente: 'Qual é a diferença entre tempo e clima?', verso: 'Tempo descreve condições momentâneas; clima descreve padrões de longo prazo.', baralhos: [], situacao: 'em-dia' },
];
let cards = structuredClone(examples);
let page = 'baralhos';
let pendingDelete = null;
const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
for (const deck of decks) $('baralho').add(new Option(deck.nome, deck.id));

function clearFilters() {
  $('busca').value = '';
  $('baralho').value = 'todos';
  $('situacao').value = 'todos';
}
function renderPage() {
  page = location.hash === '#cartoes' ? 'cartoes' : 'baralhos';
  clearFilters();
  $('cenario').value = 'normal';
  const isCards = page === 'cartoes';
  $('titulo').textContent = isCards ? 'Cartões' : 'Baralhos';
  document.title = `${$('titulo').textContent} · Busca e filtros — Memorization`;
  $('descricao').textContent = isCards ? 'Perguntas e respostas para construir sua memória.' : 'Escolha o que você quer memorizar hoje.';
  $('criar').textContent = isCards ? 'Criar cartão' : 'Criar baralho';
  $('rotulo-busca').textContent = isCards ? 'Buscar cartões' : 'Buscar baralhos';
  $('busca').placeholder = isCards ? 'Buscar na frente ou no verso' : 'Digite o nome do baralho';
  $('campo-baralho').hidden = !isCards;
  $('campo-situacao').hidden = !isCards;
  document.querySelectorAll('[data-page]').forEach((link) => {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  renderResults();
}
function renderResults() {
  const scenario = $('cenario').value;
  const query = normalize($('busca').value);
  const isCards = page === 'cartoes';
  const all = scenario === 'vazio' ? [] : isCards ? cards : decks;
  const filtered = all.filter((item) => {
    if (!isCards) return normalize(item.nome).includes(query);
    const deck = $('baralho').value;
    const status = $('situacao').value;
    return (normalize(item.frente).includes(query) || normalize(item.verso).includes(query))
      && (deck === 'todos' || (deck === 'sem' ? !item.baralhos.length : item.baralhos.includes(deck)))
      && (status === 'todos' || status === item.situacao);
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
      return `<li class="linha-da-lista"><div class="linha-da-lista__texto"><p class="linha-da-lista__titulo">${name}</p>${isCards ? '' : `<p class="linha-da-lista__detalhe">${count} ${count === 1 ? 'Cartão' : 'Cartões'}</p>`}</div><div class="linha-da-lista__acoes">${isCards
        ? `<button class="botao botao--perigo" data-delete="${item.id}" aria-label="Excluir ${name}">Excluir</button>`
        : `<button class="botao botao--secundario" data-preview="Estudar ${name}" aria-label="Estudar ${name}" ${count ? '' : `disabled aria-describedby="vazio-${item.id}"`}>Estudar</button>`}
        <button class="botao botao--secundario" data-preview="Editar ${name}" aria-label="Editar ${name}">Editar</button></div>${!isCards && !count ? `<span class="visualmente-oculto" id="vazio-${item.id}">Sem Cartões para estudar.</span>` : ''}</li>`;
    }).join('')}</ul>`;
  }
}
function preview(title) {
  pendingDelete = null;
  $('dialogo-titulo').textContent = title;
  $('dialogo-texto').textContent = 'Este protótipo demonstra busca e filtros. Esta ação mantém o fluxo existente da aplicação e não é simulada aqui.';
  $('cancelar').textContent = 'Fechar';
  $('confirmar').hidden = true;
  $('dialogo').showModal();
  $('cancelar').focus();
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
$('reiniciar').onclick = () => { cards = structuredClone(examples); renderPage(); };
$('cancelar').onclick = () => $('dialogo').close();
$('confirmar').onclick = () => {
  cards = cards.filter((card) => card.id !== pendingDelete);
  $('dialogo').close();
  renderResults();
  $('contagem').textContent = `Cartão excluído. ${$('contagem').textContent}`;
  $('busca').focus();
};
document.addEventListener('click', (event) => {
  const target = event.target.closest('button, a');
  if (!target) return;
  if (target.hasAttribute('data-preview')) { event.preventDefault(); preview(target.dataset.preview); }
  if (target.hasAttribute('data-clear')) { clearFilters(); renderResults(); $('busca').focus(); }
  if (target.hasAttribute('data-retry')) { $('cenario').value = 'normal'; renderResults(); $('busca').focus(); }
  if (target.hasAttribute('data-delete')) {
    const card = cards.find((item) => item.id === Number(target.dataset.delete));
    pendingDelete = card.id;
    $('dialogo-titulo').textContent = 'Excluir Cartão';
    $('dialogo-texto').textContent = `Excluir “${card.frente}”? ${card.baralhos.length ? `O Cartão e seus vínculos com ${card.baralhos.length} baralho(s) serão removidos.` : 'Este Cartão não está vinculado a nenhum Baralho.'} Nenhum Baralho será excluído. A exclusão é apenas demonstrativa.`;
    $('cancelar').textContent = 'Cancelar';
    $('confirmar').hidden = false;
    $('dialogo').showModal();
    $('cancelar').focus();
  }
});
window.addEventListener('hashchange', renderPage);
renderPage();
