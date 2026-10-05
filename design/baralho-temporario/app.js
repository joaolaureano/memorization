/* Demonstração isolada. Nenhuma operação de rede ou escrita persistente. */
const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const initialDecks = [
  { id: 'ingles', nome: 'Inglês cotidiano', ids: [1, 2, 3] },
  { id: 'viagens', nome: 'Viagens', ids: [1, 3, 4] },
  { id: 'biologia', nome: 'Biologia', ids: [5, 6] },
  { id: 'historia', nome: 'História do Brasil', ids: [] },
];
const initialCards = [
  { id: 1, frente: 'How are you?', verso: 'Como você está?', situacao: 'pendente' },
  { id: 2, frente: 'O que significa “take your time”?', verso: 'Não tenha pressa.', situacao: 'novos' },
  { id: 3, frente: 'Where is the nearest station?', verso: 'Onde fica a estação mais próxima?', situacao: 'em-dia' },
  { id: 4, frente: 'Como pedir a conta em inglês?', verso: 'Could I have the bill, please?', situacao: 'pendente' },
  { id: 5, frente: 'Qual é a função das mitocôndrias?', verso: 'Produzir ATP pela respiração celular.', situacao: 'pendente' },
  { id: 6, frente: 'O que é osmose?', verso: 'Movimento de água através de uma membrana semipermeável.', situacao: 'novos' },
  { id: 7, frente: 'O que significa aprender ativamente?', verso: 'Recuperar e aplicar o conhecimento em vez de apenas reler.', situacao: 'novos' },
];
const levels = ['Errei', 'Difícil', 'Bom', 'Fácil'];
const colors = ['var(--danger)', 'var(--warning)', 'var(--accent)', 'var(--success)'];
let decks, cards, selected, screen, source, query, deckFilter, statusFilter, items, position, revealed, recorded, savedId, saveName, saveError, failSave, missing, loadError, emptyDemo;
let confirmAction;
let saveIds = [];
function reset() {
  decks = structuredClone(initialDecks); cards = structuredClone(initialCards);
  selected = new Set(); screen = 'baralhos'; source = 'baralhos'; query = '';
  deckFilter = 'todos'; statusFilter = 'todos'; items = []; position = 0; revealed = false;
  recorded = false; savedId = null; saveName = ''; saveError = ''; failSave = false; saveIds = [];
  missing = false; loadError = false; emptyDemo = false;
}
function announce(text) { $('anuncio').textContent = text; }
function button(label, action, attrs = '', primary = false) {
  return `<button class="botao ${primary ? 'botao--primario' : 'botao--secundario'}" data-action="${action}" ${attrs}>${label}</button>`;
}
function header(title, text = '', actions = '') {
  return `<header class="cabecalho-da-pagina"><div><h1 tabindex="-1">${title}</h1>${text ? `<p class="texto-secundario">${text}</p>` : ''}</div>${actions ? `<div class="acoes">${actions}</div>` : ''}</header>`;
}
function go(next, focus = true) {
  screen = next; render();
  if (focus) $('tela').querySelector('h1')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
function requestExit() {
  if (screen === 'montagem' && selected.size || screen === 'sessao' || screen === 'resumo' && !recorded || screen === 'salvar' && saveName) {
    dialog('Descartar este percurso?', screen === 'sessao' ? 'A Sessão será interrompida e não será registrada.' : 'A seleção e os campos não salvos serão descartados. Uma Sessão já registrada permanece no Histórico.', () => { selected.clear(); go('baralhos'); });
  } else { selected.clear(); go('baralhos'); }
}
function dialog(title, text, action = null) {
  confirmAction = action;
  $('dialogo-titulo').textContent = title; $('dialogo-texto').textContent = text;
  $('dialogo-cancelar').textContent = action ? 'Cancelar' : 'Fechar';
  $('dialogo-confirmar').hidden = !action;
  $('dialogo').showModal(); $('dialogo-cancelar').focus();
}
function render() {
  document.title = `${screen === 'baralhos' ? 'Baralhos' : 'Baralho temporário'} — Protótipo`;
  if (screen === 'baralhos') {
    $('tela').innerHTML = header('Baralhos', 'Escolha o que você quer memorizar hoje.', button('Criar Baralho', 'fora', '', true) + button('Criar baralho temporário', 'montar'))
      + '<div class="campo"><label class="rotulo" for="busca-baralhos">Buscar baralhos</label><input id="busca-baralhos" type="search" placeholder="Digite o nome do baralho"></div><p id="contagem-baralhos" class="texto-secundario" role="status"></p><div id="lista-baralhos"></div>';
    renderDecks('');
    $('busca-baralhos').oninput = event => renderDecks(event.target.value);
  } else if (screen === 'montagem') {
    $('tela').innerHTML = `<p class="voltar"><a href="#baralhos" data-action="voltar">← Voltar para Baralhos</a></p>`
      + header('Criar baralho temporário', 'Escolha o conteúdo para esta Sessão. Você poderá salvar o baralho ao terminar.')
      + `<div class="montagem"><section class="fontes" aria-label="Conteúdo disponível"><div class="alternar-fontes">${button('Adicionar baralhos', 'fonte-baralhos', `aria-pressed="${source === 'baralhos'}"`)}${button('Adicionar cartões', 'fonte-cartoes', `aria-pressed="${source === 'cartoes'}"`)}</div><div id="filtros-fontes"></div><p class="texto-secundario" id="quantidade-fontes" role="status"></p><div id="lista-fontes"></div></section><section class="selecao" aria-label="Seleção do estudo" id="selecao"></section></div>`;
    renderFilters(); renderSources(); renderSelection();
  } else if (screen === 'sessao') {
    const item = items[position];
    $('tela').innerHTML = `<div class="estudo-demo"><div class="acoes">${button('Interromper', 'voltar')}</div><p class="texto-secundario">Baralho temporário</p><h1 tabindex="-1">Estudar</h1><article class="cartao-de-estudo" aria-label="Item ${position + 1} de ${items.length}"><h2>Frente</h2><p class="conteudo-do-cartao">${esc(item.frente)}</p>${revealed ? `<hr><h2 id="verso-titulo" tabindex="-1">Verso</h2><p class="conteudo-do-cartao">${esc(item.verso)}</p><div class="avaliacoes">${levels.map((level, i) => button(`${level}<small>${[1, 2, 4, 7][i]} ${i ? 'dias' : 'dia'}</small>`, 'avaliar', `data-level="${i}" aria-label="${level}, próxima revisão em ${[1, 2, 4, 7][i]} ${i ? 'dias' : 'dia'}" aria-keyshortcuts="${i + 1}"`)).join('')}</div>` : button('Revelar verso', 'revelar', '', true)}</article></div>`;
  } else if (screen === 'resumo') renderSummary();
  else if (screen === 'salvar') renderSave();
  else if (screen === 'salvo') {
    const deck = decks.find(d => d.id === savedId);
    $('tela').innerHTML = header(esc(deck.nome), `${deck.ids.length} Cartões vinculados.`, button('Estudar', 'estudar-salvo', '', true))
      + '<p class="aviso aviso--sucesso">Baralho salvo. Os cartões e baralhos de origem foram preservados.</p>'
      + `<ul class="lista lista--compacta">${deck.ids.map(id => `<li class="linha-da-lista"><p class="linha-da-lista__titulo">${esc(cards.find(c => c.id === id).frente)}</p></li>`).join('')}</ul><div class="acoes">${button('Voltar para Baralhos', 'voltar')}</div>`;
  }
}
function renderDecks(text) {
  const found = decks.filter(d => norm(d.nome).includes(norm(text)));
  $('contagem-baralhos').textContent = `${found.length} ${found.length === 1 ? 'resultado' : 'resultados'}`;
  $('lista-baralhos').innerHTML = found.length ? `<ul class="lista lista--compacta">${found.map(d => `<li class="linha-da-lista"><div class="linha-da-lista__texto"><p class="linha-da-lista__titulo">${esc(d.nome)}</p><p class="linha-da-lista__detalhe">${d.ids.length} Cartões</p></div><div class="linha-da-lista__acoes">${button('Estudar', 'fora', `${d.ids.length ? '' : 'disabled'} aria-label="Estudar ${esc(d.nome)}"`)}${button('Editar', d.id === savedId ? 'abrir-salvo' : 'fora', `aria-label="Editar ${esc(d.nome)}"`)}</div></li>`).join('')}</ul>` : '<p class="estado-vazio">Nenhum baralho encontrado.</p>';
}
function renderFilters() {
  const isCards = source === 'cartoes';
  $('filtros-fontes').innerHTML = `<div class="filtros-montagem"><div class="campo"><label class="rotulo" for="busca-fonte">${isCards ? 'Buscar cartões' : 'Buscar baralhos'}</label><input id="busca-fonte" type="search" value="${esc(query)}" placeholder="${isCards ? 'Buscar na frente ou no verso' : 'Digite o nome do baralho'}"></div>${isCards ? `<div class="campo"><label class="rotulo" for="baralho-filtro">Baralho</label><select id="baralho-filtro"><option value="todos">Todos</option><option value="sem">Sem baralho</option>${decks.map(d => `<option value="${d.id}">${esc(d.nome)}</option>`).join('')}</select></div><div class="campo"><label class="rotulo" for="situacao-filtro">Situação da revisão</label><select id="situacao-filtro"><option value="todos">Todos</option><option value="novos">Novos</option><option value="pendente">Revisão pendente</option><option value="em-dia">Em dia</option></select></div>` : ''}</div>${button('Limpar filtros', 'limpar-filtros')}`;
  $('busca-fonte').oninput = event => { query = event.target.value; renderSources(); };
  if (isCards) {
    $('baralho-filtro').value = deckFilter; $('situacao-filtro').value = statusFilter;
    $('baralho-filtro').onchange = event => { deckFilter = event.target.value; renderSources(); };
    $('situacao-filtro').onchange = event => { statusFilter = event.target.value; renderSources(); };
  }
}
function renderSources() {
  if (loadError) { $('quantidade-fontes').textContent = ''; $('lista-fontes').innerHTML = `<div class="estado-vazio"><p role="alert">Não foi possível carregar o acervo.</p>${button('Tentar novamente', 'recarregar')}</div>`; return; }
  let found = [];
  if (!emptyDemo) found = source === 'baralhos' ? decks.filter(d => norm(d.nome).includes(norm(query))) : cards.filter(c => {
    const memberships = decks.filter(d => d.ids.includes(c.id));
    return (norm(c.frente).includes(norm(query)) || norm(c.verso).includes(norm(query))) && (statusFilter === 'todos' || c.situacao === statusFilter) && (deckFilter === 'todos' || (deckFilter === 'sem' ? !memberships.length : memberships.some(d => d.id === deckFilter)));
  });
  $('quantidade-fontes').textContent = `${found.length} ${found.length === 1 ? 'resultado' : 'resultados'}`;
  $('lista-fontes').innerHTML = found.length ? `<ul class="lista lista--compacta">${found.map(item => {
    const ids = source === 'baralhos' ? item.ids : [item.id];
    const remaining = ids.filter(id => !selected.has(id)).length;
    const name = source === 'baralhos' ? item.nome : item.frente;
    return `<li class="linha-da-lista"><div class="linha-da-lista__texto"><p class="linha-da-lista__titulo">${esc(name)}</p>${source === 'baralhos' ? `<p class="linha-da-lista__detalhe">${ids.length} Cartões${!ids.length ? ' · Baralho vazio' : ''}</p>` : ''}</div><div class="linha-da-lista__acoes">${button(!ids.length ? 'Sem cartões' : remaining ? 'Adicionar' : 'Adicionado', 'adicionar', `data-id="${item.id}" ${remaining ? '' : 'disabled'} aria-label="Adicionar ${esc(name)}"`)}</div></li>`;
  }).join('')}</ul>` : `<div class="estado-vazio"><p>${emptyDemo ? 'Seu acervo está vazio. Crie cartões para montar um estudo.' : 'Nenhum resultado encontrado. Altere a busca ou os filtros.'}</p>${button(emptyDemo ? 'Criar cartão' : 'Limpar filtros', emptyDemo ? 'fora' : 'limpar-filtros')}</div>`;
}
function renderSelection() {
  $('selecao').innerHTML = `<div class="titulo-contagem"><h2>Seleção do estudo</h2><span>${selected.size} ${selected.size === 1 ? 'Cartão' : 'Cartões'}</span></div>${selected.size ? `<ul class="lista-da-selecao">${[...selected].map(id => `<li><p>${esc(cards.find(c => c.id === id).frente)}</p>${button('Remover', 'remover', `data-id="${id}" aria-label="Remover ${esc(cards.find(c => c.id === id).frente)}"`)}</li>`).join('')}</ul>${button('Limpar seleção', 'limpar-selecao')}` : '<div class="estado-vazio"><h3>Seu estudo começa aqui</h3><p>Adicione baralhos ou cartões individuais. Cartões repetidos entram uma só vez.</p></div>'}<p class="nota-selecao" id="orientacao">${selected.size ? 'Todos os cartões selecionados serão estudados em ordem aleatória.' : 'Adicione pelo menos um cartão para estudar.'}</p><div class="acoes-selecao">${button('Estudar', 'iniciar', `${selected.size ? '' : 'disabled'} aria-describedby="orientacao"`, true)}${button('Cancelar', 'voltar')}</div>`;
}
function startStudy() {
  items = [...selected].map(id => ({ ...cards.find(c => c.id === id), rating: null }));
  if (!items.length) return;
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  position = 0; revealed = false; recorded = false; savedId = null; saveName = ''; saveError = '';
  saveIds = items.map(item => item.id);
  go('sessao');
}
function renderSummary() {
  const counts = levels.map((_, index) => items.filter(item => item.rating === index).length);
  const hits = items.length - counts[0];
  $('tela').innerHTML = `<div class="resumo-demo"><p class="texto-secundario">Estudo com baralho temporário</p><h1 tabindex="-1">Sessão concluída</h1><div class="placar">${Math.round(hits / items.length * 100)}%</div><p>${hits} de ${items.length} Cartões</p><div class="segmentos" aria-hidden="true">${counts.map((n, i) => `<span style="width:${n / items.length * 100}%;background:${colors[i]}"></span>`).join('')}</div><div class="legenda">${levels.map((level, i) => `<span>${level}: ${counts[i]}</span>`).join('')}</div>${[false, true].map(errors => {
    const group = items.filter(item => errors ? item.rating === 0 : item.rating !== 0);
    return group.length ? `<details class="detalhes-resultado"><summary>${errors ? 'Erros' : 'Acertos'} (${group.length})</summary><ul>${group.map(item => `<li><details><summary>${esc(item.frente)}</summary><p>${esc(item.verso)}<br><span class="texto-secundario">${levels[item.rating]}</span></p></details></li>`).join('')}</ul></details>` : `<p class="texto-secundario">Nenhum ${errors ? 'erro' : 'acerto'} nesta Sessão.</p>`;
  }).join('')}${recorded ? '<p role="status" class="texto-secundario">Sessão registrada no histórico.</p>' : `<div class="aviso aviso--erro"><p role="alert" id="registro-falha">Não foi possível registrar a Sessão. Registre para salvar o baralho.</p>${button('Tentar registrar novamente', 'registrar')}</div>`}${savedId ? '<p class="aviso aviso--sucesso">Baralho salvo.</p>' : ''}<div class="acoes">${savedId ? button('Abrir baralho', 'abrir-salvo', '', true) : button('Salvar como baralho', 'salvar', `${recorded ? '' : 'disabled aria-describedby="registro-falha"'}`, true)}${button('Voltar para Baralhos', 'voltar')}</div></div>`;
}
function renderSave() {
  $('tela').innerHTML = `<div class="salvar-demo">${header('Salvar como baralho', 'Guarde esta seleção para estudar novamente.')}<form id="form-salvar" class="cartao" novalidate><div class="campo"><label class="rotulo" for="nome-baralho">Nome do baralho</label><input id="nome-baralho" value="${esc(saveName)}" aria-describedby="limite-nome erro-salvar" autocomplete="off"><p class="ajuda" id="limite-nome">${saveName.length} / 100 caracteres</p></div><p>${saveIds.length} Cartões serão vinculados. Os baralhos de origem serão preservados.</p>${missing ? `<div class="aviso aviso--erro"><p>1 Cartão não está mais disponível. Retire-o e confira a nova contagem antes de salvar.</p>${button('Retirar indisponíveis', 'retirar-indisponiveis', 'type="button"')}</div>` : ''}<p id="erro-salvar" class="erro" role="alert">${esc(saveError)}</p><div class="acoes"><button type="submit" class="botao botao--primario" ${missing || !saveIds.length ? 'disabled' : ''}>Salvar</button>${button('Cancelar', 'cancelar-salvar', 'type="button"')}</div></form></div>`;
  $('nome-baralho').oninput = event => { saveName = event.target.value; $('limite-nome').textContent = `${saveName.length} / 100 caracteres`; };
  $('form-salvar').onsubmit = event => {
    event.preventDefault();
    if (!saveName.trim() || saveName.length > 100) { saveError = 'Informe um nome de 1 a 100 caracteres.'; $('erro-salvar').textContent = saveError; $('nome-baralho').focus(); return; }
    if (failSave) { failSave = false; saveError = 'Não foi possível salvar. Seu nome e a seleção foram preservados. Tente novamente.'; $('erro-salvar').textContent = saveError; return; }
    if (missing || !saveIds.length) return;
    if (!savedId) { savedId = `salvo-${decks.length}`; decks.push({ id: savedId, nome: saveName.trim(), ids: [...saveIds] }); }
    go('resumo');
  };
}
const actions = {
  voltar: requestExit,
  fora: () => dialog('Fora deste protótipo', 'Esta ação segue o fluxo existente da aplicação. Aqui você pode criar, estudar e salvar um baralho temporário.'),
  montar: () => { selected.clear(); query = ''; source = 'baralhos'; deckFilter = 'todos'; statusFilter = 'todos'; emptyDemo = false; loadError = false; go('montagem'); },
  'fonte-baralhos': () => switchSource('baralhos'), 'fonte-cartoes': () => switchSource('cartoes'),
  'limpar-filtros': () => { query = ''; deckFilter = 'todos'; statusFilter = 'todos'; renderFilters(); renderSources(); $('busca-fonte').focus(); },
  adicionar: target => {
    const ids = source === 'baralhos' ? decks.find(d => d.id === target.dataset.id).ids : [Number(target.dataset.id)];
    ids.forEach(id => selected.add(id)); renderSources(); renderSelection();
    $('busca-fonte').focus(); announce(`${selected.size} Cartões na seleção. Cartões repetidos entram uma só vez.`);
  },
  remover: target => { selected.delete(Number(target.dataset.id)); renderSources(); renderSelection(); $('selecao').querySelector('button')?.focus(); announce(`${selected.size} Cartões na seleção.`); },
  'limpar-selecao': () => { selected.clear(); renderSources(); renderSelection(); $('busca-fonte').focus(); announce('Seleção limpa.'); },
  recarregar: () => { loadError = false; renderSources(); $('busca-fonte').focus(); },
  iniciar: startStudy,
  revelar: () => { revealed = true; render(); $('verso-titulo').focus(); },
  avaliar: target => {
    if (!revealed) return;
    items[position].rating = Number(target.dataset.level);
    if (++position === items.length) { recorded = true; go('resumo'); }
    else { revealed = false; go('sessao'); }
  },
  registrar: () => { recorded = true; renderSummary(); $('tela').querySelector('[data-action="salvar"]').focus(); },
  salvar: () => { if (recorded) { go('salvar'); $('nome-baralho').focus(); } },
  'cancelar-salvar': () => go('resumo'),
  'abrir-salvo': () => go('salvo'),
  'estudar-salvo': () => dialog('Estudar baralho salvo', 'O baralho já está no acervo desta demonstração. Na aplicação, esta ação abre o estudo comum por Baralho.'),
  'retirar-indisponiveis': () => { saveIds = saveIds.slice(1); missing = false; saveError = saveIds.length ? '' : 'Não há Cartões disponíveis para salvar.'; renderSave(); $('nome-baralho').focus(); },
};
function switchSource(next) { source = next; query = ''; render(); $('tela').querySelector(`[data-action="fonte-${next}"]`).focus(); }
document.addEventListener('click', event => { const target = event.target.closest('[data-action]'); if (!target) return; event.preventDefault(); actions[target.dataset.action]?.(target); });
document.addEventListener('keydown', event => { if (screen !== 'sessao' || !revealed || $('dialogo').open || event.ctrlKey || event.altKey || event.metaKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return; const index = Number(event.key) - 1; if (index >= 0 && index < 4 && Number.isInteger(index)) { event.preventDefault(); actions.avaliar({ dataset: { level: String(index) } }); } });
window.addEventListener('beforeunload', event => { if (screen === 'sessao' || screen === 'montagem' && selected.size || screen === 'salvar' && saveName || screen === 'resumo' && !recorded) { event.preventDefault(); event.returnValue = ''; } });
$('dialogo-cancelar').onclick = () => $('dialogo').close();
$('dialogo-confirmar').onclick = () => { $('dialogo').close(); confirmAction?.(); };
$('reiniciar').onclick = () => { reset(); $('cenario').value = 'baralhos'; go('baralhos'); };
$('abrir-cenario').onclick = () => {
  const scenario = $('cenario').value;
  reset();
  if (scenario === 'baralhos') return go('baralhos');
  if (['montagem', 'selecao', 'falha-carga', 'vazio'].includes(scenario)) {
    if (scenario === 'selecao') selected = new Set([1, 2, 3, 4, 7]);
    loadError = scenario === 'falha-carga'; emptyDemo = scenario === 'vazio'; return go('montagem');
  }
  selected = new Set([1, 2, 3, 4, 7]); startStudy();
  if (scenario === 'sessao') return;
  items.forEach((item, i) => item.rating = [2, 0, 3, 1, 2][i]); recorded = scenario !== 'falha-registro';
  failSave = scenario === 'falha-salvar'; missing = scenario === 'indisponivel';
  if (['salvar', 'falha-salvar', 'indisponivel'].includes(scenario)) { saveName = 'Inglês para a próxima viagem'; go('salvar'); }
  else go('resumo');
};
reset(); render();
