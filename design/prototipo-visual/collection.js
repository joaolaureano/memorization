/* Acervo do protótipo: operações apenas em memória. */
(function () {
  'use strict';
  let serial = 0;
  const id = prefix => `${prefix}-${Date.now()}-${++serial}`;
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function render(ctx) {
    const { state, route, esc, link, button, after, go, notify, operation } = ctx;
    const parts = route.split('/');
    if (!['baralhos', 'cartoes'].includes(parts[0])) return null;
    const deck = state.decks.find(item => item.id === parts[1]);
    const card = state.cards.find(item => item.id === parts[1]);
    const related = item => state.decks.filter(d => d.cardIds.includes(item.id));
    const back = (text, target) => `<p>${link(`← ${text}`, target)}</p>`;
    const heading = (title, description, action = '') => `<header class="page-head"><div><p class="eyebrow">SEU ACERVO</p><h1>${esc(title)}</h1><p class="muted">${esc(description)}</p></div>${action}</header>`;
    const empty = (title, description, action) => `<section class="empty"><h2>${esc(title)}</h2><p class="muted">${esc(description)}</p>${action}</section>`;
    const bind = (selector, event, handler) => after(() => {
      document.querySelectorAll(`#view ${selector}`).forEach(el => el.addEventListener(event, e => handler(e, el)));
    });
    const refreshFocus = selector => {
      ctx.render();
      const target = document.querySelector(`#view ${selector}`) || document.querySelector('#view h1');
      if (target) { if (target.tagName === 'H1') target.tabIndex = -1; target.focus(); }
    };
    const associations = item => {
      const decks = related(item);
      return `<p class="helper">${decks.length ? `Baralhos: ${decks.map(d => link(d.name, `baralhos/${d.id}`)).join(', ')}` : 'Ainda sem baralho. Adicione este cartão nos detalhes de um baralho.'}</p>`;
    };
    const cardContent = item => `<p class="eyebrow">FRENTE</p><h2>${esc(item.front)}</h2><p class="eyebrow">VERSO</p><p class="card-answer">${esc(item.back)}</p>`;
    const cardTile = (item, inDeck = false) => `<article class="card" data-card="${esc(item.id)}">${cardContent(item)}${associations(item)}<div class="actions">${link('Editar cartão', `cartoes/${item.id}/editar`, 'secondary')}${inDeck ? `<button class="btn secondary" type="button" data-remove="${esc(item.id)}">Remover deste baralho</button>` : `<button class="btn danger" type="button" data-delete-card="${esc(item.id)}">Excluir cartão</button>`}</div></article>`;
    const bindDeleteCard = () => bind('[data-delete-card]', 'click', (e, trigger) => {
      const item = state.cards.find(c => c.id === trigger.dataset.deleteCard);
      if (!item) return;
      const n = related(item).length;
      ctx.confirm({ title: 'Excluir cartão?', message: `O cartão “${item.front}” será excluído e removido de ${count(n, 'baralho', 'baralhos')}. Os baralhos continuarão existindo. Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir cartão', onConfirm: () => operation(trigger, () => {
        state.cards = state.cards.filter(c => c.id !== item.id);
        state.decks.forEach(d => { d.cardIds = d.cardIds.filter(cid => cid !== item.id); });
        notify('Cartão excluído. Todos os baralhos foram preservados.');
        refreshFocus('[data-delete-card]');
      }) });
    });

    function bindForm(initial, save) {
      after(() => {
        const form = document.querySelector('#view form');
        const controls = [...form.querySelectorAll('input, textarea')];
        const error = form.querySelector('[role="alert"]');
        let pending = false;
        form.addEventListener('input', () => {
          state.dirty = controls.some(input => input.value !== initial[input.name]);
          controls.forEach(input => input.removeAttribute('aria-invalid'));
          error.textContent = '';
          error.hidden = true;
        });
        form.addEventListener('submit', async event => {
          event.preventDefault();
          if (pending) return;
          const invalid = controls.find(input => !input.value.trim() || input.value.length > input.maxLength);
          if (invalid) {
            invalid.setAttribute('aria-invalid', 'true');
            error.textContent = !invalid.value.trim() ? `Preencha ${invalid.name === 'name' ? 'o nome do baralho' : invalid.name === 'front' ? 'a frente do cartão' : 'o verso do cartão'}.` : `Use no máximo ${invalid.maxLength} caracteres.`;
            error.hidden = false;
            invalid.focus();
            return;
          }
          const values = Object.fromEntries(controls.map(input => [input.name, input.value]));
          pending = true;
          controls.forEach(input => { input.readOnly = true; });
          const submit = form.querySelector('[type="submit"]');
          await operation(submit, () => { state.dirty = false; save(values); });
          pending = false;
          controls.forEach(input => { input.readOnly = false; });
        });
      });
    }

    if (route === 'baralhos') {
      const list = state.decks.map(item => `<article class="card"><p class="eyebrow">BARALHO</p><h2>${link(item.name, `baralhos/${item.id}`)}</h2><p class="muted">${count(item.cardIds.length, 'cartão', 'cartões')}</p><p class="helper">${item.cardIds.length ? 'Pronto para uma sessão de estudo.' : 'Adicione cartões para começar a estudar.'}</p><div class="actions">${link('Ver baralho', `baralhos/${item.id}`, 'secondary')}${link('Estudar', `estudo/${item.id}/configurar`)}</div></article>`).join('');
      return heading('Baralhos', 'Escolha o que você quer memorizar hoje.', link('Criar baralho', 'baralhos/novo', 'primary')) + (list ? `<div class="grid">${list}</div>` : empty('Seu primeiro baralho começa aqui', 'Organize cartões por assunto e estude no seu ritmo.', link('Criar baralho', 'baralhos/novo', 'primary')));
    }

    if (route === 'baralhos/novo' || (parts[0] === 'baralhos' && parts[2] === 'editar' && parts.length === 3)) {
      const creating = route === 'baralhos/novo';
      if (!creating && !deck) return ctx.notFound();
      const target = creating ? 'baralhos' : `baralhos/${deck.id}`;
      bindForm({ name: creating ? '' : deck.name }, values => {
        if (creating) {
          const created = { id: id('d'), name: values.name, cardIds: [] };
          state.decks.push(created);
          go(`baralhos/${created.id}`);
          notify('Baralho criado. Adicione cartões existentes para estudar.');
        } else {
          deck.name = values.name;
          go(target);
          notify('Nome do baralho atualizado. Os cartões foram preservados.');
        }
      });
      return back(creating ? 'Voltar aos baralhos' : 'Voltar ao baralho', target) + heading(creating ? 'Criar baralho' : 'Renomear baralho', creating ? 'Dê um nome ao assunto que você quer estudar.' : 'O novo nome aparecerá em todo o acervo.') + `<form class="card stack" novalidate><div class="field"><label for="deck-name">Nome do baralho</label><input id="deck-name" name="name" required maxlength="100" value="${esc(creating ? '' : deck.name)}" aria-describedby="deck-name-help form-error" autocomplete="off"><p id="deck-name-help" class="helper">Até 100 caracteres. Exemplo: Inglês cotidiano.</p></div><p id="form-error" role="alert" class="notice error" hidden></p><div class="actions"><button class="btn primary" type="submit">${creating ? 'Criar baralho' : 'Salvar nome'}</button>${link('Cancelar', target, 'secondary')}</div></form>`;
    }

    if (parts[0] === 'baralhos' && parts[2] === 'adicionar' && parts.length === 3) {
      if (!deck) return ctx.notFound();
      const available = state.cards.filter(item => !deck.cardIds.includes(item.id));
      bind('[data-add]', 'click', (event, trigger) => {
        const cid = trigger.dataset.add;
        operation(trigger, () => {
          if (!deck.cardIds.includes(cid) && state.cards.some(item => item.id === cid)) deck.cardIds.push(cid);
          notify(`Cartão adicionado a “${deck.name}”. O baralho está pronto para estudar.`);
          refreshFocus('[data-add]');
        });
      });
      return back('Voltar ao baralho', `baralhos/${deck.id}`) + heading('Adicionar cartões', `Escolha cartões existentes para “${deck.name}”. Um cartão pode estar em vários baralhos.`, link('Criar cartão', 'cartoes/novo', 'secondary')) + (available.length ? `<div class="grid">${available.map(item => `<article class="card">${cardContent(item)}${associations(item)}<button class="btn primary" type="button" data-add="${esc(item.id)}">Adicionar ao baralho</button></article>`).join('')}</div>` : empty(state.cards.length ? 'Todos os cartões já estão neste baralho' : 'Crie seu primeiro cartão', state.cards.length ? 'Você pode criar mais cartões ou voltar ao baralho para estudar.' : 'Primeiro crie uma frente e um verso. Depois volte aqui para adicionar o cartão.', link(state.cards.length ? 'Voltar ao baralho' : 'Criar cartão', state.cards.length ? `baralhos/${deck.id}` : 'cartoes/novo', 'primary')));
    }

    if (parts[0] === 'baralhos' && parts.length === 2) {
      if (!deck) return ctx.notFound();
      const items = state.cards.filter(item => deck.cardIds.includes(item.id));
      bind('[data-remove]', 'click', (event, trigger) => {
        operation(trigger, () => {
          deck.cardIds = deck.cardIds.filter(cid => cid !== trigger.dataset.remove);
          notify(`Cartão removido deste baralho e preservado em Cartões.${deck.cardIds.length ? '' : ' O baralho está vazio; adicione cartões para estudar.'}`);
          refreshFocus('[data-remove]');
        });
      });
      bind('[data-action="delete-deck"]', 'click', (event, trigger) => {
        ctx.confirm({ title: 'Excluir baralho?', message: `O baralho “${deck.name}” será excluído. ${count(items.length, 'cartão continuará disponível', 'cartões continuarão disponíveis')} em Cartões, com os vínculos aos outros baralhos preservados. Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir baralho', onConfirm: () => operation(trigger, () => {
          state.decks = state.decks.filter(item => item.id !== deck.id);
          go('baralhos');
          notify('Baralho excluído. Todos os cartões foram preservados.');
        }) });
      });
      return back('Voltar aos baralhos', 'baralhos') + heading(deck.name, `${count(items.length, 'cartão', 'cartões')} neste baralho.`, link('Estudar', `estudo/${deck.id}/configurar`, 'primary')) + `<div class="actions">${link('Adicionar cartões existentes', `baralhos/${deck.id}/adicionar`, 'secondary')}${link('Renomear', `baralhos/${deck.id}/editar`, 'secondary')}${button('Excluir baralho', 'delete-deck', 'danger')}</div><section class="stack"><h2>Cartões do baralho</h2><p class="helper">Remover deste baralho preserva o cartão no acervo e nos outros baralhos.</p>${items.length ? `<div class="grid">${items.map(item => cardTile(item, true)).join('')}</div>` : empty('Este baralho está vazio', 'Adicione pelo menos um cartão para começar a estudar.', link('Adicionar cartões existentes', `baralhos/${deck.id}/adicionar`, 'primary'))}</section>`;
    }

    if (route === 'cartoes') {
      bindDeleteCard();
      return heading('Cartões', 'Perguntas e respostas para construir sua memória.', link('Criar cartão', 'cartoes/novo', 'primary')) + (state.cards.length ? `<p class="helper">${count(state.cards.length, 'cartão no acervo', 'cartões no acervo')}. Cada cartão pode fazer parte de vários baralhos.</p><div class="grid">${state.cards.map(item => cardTile(item)).join('')}</div>` : empty('Seu acervo está pronto para começar', 'Crie um cartão com uma pergunta na frente e a resposta no verso.', link('Criar cartão', 'cartoes/novo', 'primary')));
    }

    if (route === 'cartoes/novo' || (parts[0] === 'cartoes' && parts[2] === 'editar' && parts.length === 3)) {
      const creating = route === 'cartoes/novo';
      if (!creating && !card) return ctx.notFound();
      const initial = creating ? { front: '', back: '' } : { front: card.front, back: card.back };
      bindForm(initial, values => {
        if (creating) state.cards.push({ id: id('c'), ...values });
        else Object.assign(card, values);
        go('cartoes');
        notify(creating ? 'Cartão criado. Adicione-o a um baralho para estudar.' : 'Cartão atualizado em todos os baralhos que o utilizam.');
      });
      return back('Voltar aos cartões', 'cartoes') + heading(creating ? 'Criar cartão' : 'Editar cartão', creating ? 'Uma pergunta clara ajuda a lembrar da resposta.' : 'Atualize a frente e o verso do cartão.') + (!creating ? `<aside class="notice">Este cartão está em ${count(related(card).length, 'baralho', 'baralhos')}. Editar afeta todos os baralhos que o utilizam.${associations(card)}</aside>` : '') + `<form class="card stack" novalidate>${[['front', 'Frente', 'Escreva uma pergunta ou algo que você quer lembrar.'], ['back', 'Verso', 'Escreva a resposta que será revelada durante o estudo.']].map(([name, label, help]) => `<div class="field"><label for="card-${name}">${label}</label><textarea id="card-${name}" name="${name}" rows="4" maxlength="1000" required aria-describedby="card-${name}-help form-error">${esc(initial[name])}</textarea><p id="card-${name}-help" class="helper">${help} Até 1.000 caracteres.</p></div>`).join('')}<p id="form-error" role="alert" class="notice error" hidden></p><div class="actions"><button class="btn primary" type="submit">${creating ? 'Criar cartão' : 'Salvar alterações'}</button>${link('Cancelar', 'cartoes', 'secondary')}</div></form>`;
    }
    return ctx.notFound();
  }
  window.Collection = { render };
})();
