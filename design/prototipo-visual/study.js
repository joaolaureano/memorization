(function () {
  'use strict';

  function shuffled(cards) {
    var result = cards.map(function (card) { return Object.assign({}, card); });
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var previous = result[i];
      result[i] = result[j];
      result[j] = previous;
    }
    return result;
  }

  function stats(total, correct) {
    var percent = total ? Math.round(correct / total * 100) : 0;
    return '<div class="stats"><div class="stat"><strong>' + total + '</strong><span>Cartões respondidos</span></div>' +
      '<div class="stat"><strong>' + correct + '</strong><span>Acertos</span></div>' +
      '<div class="stat"><strong>' + (total - correct) + '</strong><span>Erros</span></div>' +
      '<div class="stat"><strong>' + percent + '%</strong><span>de acertos</span></div></div>';
  }

  function explorations(ctx) {
    var esc = ctx.esc;
    var session = ctx.state.session;
    var completed = session && !session.active && session.answers.length > 0;
    var answers = completed ? session.answers : [
      { front: 'ephemeral', back: 'efêmero, passageiro', correct: true },
      { front: 'to cope with', back: 'lidar com', correct: true },
      { front: 'thoroughly', back: 'minuciosamente', correct: false }
    ];
    var count = answers.filter(function (answer) { return answer.correct; }).length;
    function details(correct) {
      var items = answers.filter(function (answer) { return answer.correct === correct; });
      return '<details class="card"><summary>' + (correct ? 'Acertos' : 'Erros') + ' · ' + items.length + '</summary>' +
        (items.length ? '<ul class="stack">' + items.map(function (answer) {
          return '<li><p><strong>' + esc(answer.front) + '</strong></p><p class="muted">' + esc(answer.back) + '</p></li>';
        }).join('') + '</ul>' : '<p>Nenhum cartão nesta categoria.</p>') + '</details>';
    }
    return '<div class="stack">' + ctx.link('← Galeria de revisão', 'galeria') +
      '<header class="page-head"><div><p class="eyebrow">Propostas para próximas versões</p><h1>Explorações futuras</h1>' +
      '<p class="muted">Estatísticas e resumo detalhado são ideias de produto. Os números semanais abaixo são ilustrativos, sem histórico persistido.</p></div></header>' +
      '<section class="stack" aria-labelledby="future-stats"><h2 id="future-stats">Seu estudo</h2>' +
      '<div class="stats"><div class="stat"><strong>' + ctx.state.cards.length + '</strong><span>Cartões no acervo</span></div>' +
      '<div class="stat"><strong>' + ctx.state.decks.length + '</strong><span>Baralhos no acervo</span></div>' +
      '<div class="stat"><strong>6</strong><span>Sessões na semana · exemplo</span></div>' +
      '<div class="stat"><strong>72%</strong><span>Acertos na semana · exemplo</span></div></div>' +
      '<div class="card"><h3>Itens estudados nos últimos 7 dias</h3><p class="muted">Exemplo de histórico semanal</p>' +
      '<dl class="grid">' + [['Segunda', 8], ['Terça', 13], ['Quarta', 0], ['Quinta', 6], ['Sexta', 17], ['Sábado', 10], ['Domingo', 20]].map(function (day) {
        return '<div><dt>' + day[0] + '</dt><dd>' + day[1] + ' itens</dd></div>';
      }).join('') + '</dl></div><div class="card"><h3>Últimas sessões · exemplo</h3><ul><li>Inglês · hoje · 3 itens · 67% de acertos</li>' +
      '<li>Algoritmos · ontem · 10 itens · 80% de acertos</li></ul></div></section>' +
      '<section class="stack" aria-labelledby="future-summary"><h2 id="future-summary">Resumo detalhado</h2><p class="muted">' +
      (completed ? 'Resultados da última sessão concluída nesta demonstração.' : 'Exemplo ilustrativo. Conclua uma sessão para explorar seus resultados aqui.') + '</p>' +
      stats(answers.length, count) + details(true) + details(false) + '</section></div>';
  }

  function render(ctx) {
    if (ctx.route === 'exploracoes') return explorations(ctx);
    var route = ctx.route.split('/');
    if (route[0] !== 'estudo') return null;
    var state = ctx.state;
    var esc = ctx.esc;
    var deck = state.decks.find(function (item) { return item.id === route[1]; });
    if (!deck || route.length !== 3) return ctx.notFound();
    var base = 'estudo/' + deck.id + '/';
    var back = ctx.link('← Voltar para o baralho', 'baralhos/' + deck.id);
    var cards = state.cards.filter(function (card) { return deck.cardIds.includes(card.id); });
    if (route[2] === 'configurar') {
      if (!cards.length) return '<div class="stack">' + back + '<h1>Estudar ' + esc(deck.name) + '</h1>' +
        '<section class="empty"><h2>Este baralho ainda está vazio</h2><p>Adicione cartões antes de começar uma sessão.</p>' +
        ctx.link('Adicionar cartões existentes', 'baralhos/' + deck.id + '/adicionar', 'primary') + '</section></div>';
      ctx.after(function () {
        var form = document.querySelector('#study-config');
        var input = form.elements.quantity;
        form.addEventListener('input', function () {
          state.dirty = true;
          input.setCustomValidity('');
          document.querySelector('#quantity-notice').textContent = Number(input.value) > cards.length ?
            'Este baralho tem ' + cards.length + ' cartões. A sessão usará todos eles, sem repetição.' : '';
        });
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var quantity = Number(input.value);
          if (!Number.isInteger(quantity) || quantity < 1) {
            input.setCustomValidity('Escolha um número inteiro maior que zero.');
            input.reportValidity();
            return;
          }
          ctx.operation(form.querySelector('button[type="submit"]'), function () {
            state.session = { deckId: deck.id, cards: shuffled(cards).slice(0, Math.min(quantity, cards.length)), index: 0, revealed: false, answers: [], active: true };
            state.dirty = false;
            ctx.go(base + 'sessao');
          });
        });
      });
      return '<div class="stack">' + back + '<header class="page-head"><div><p class="eyebrow">Preparar sessão</p><h1>Estudar ' + esc(deck.name) + '</h1>' +
        '<p class="muted">' + cards.length + ' cartões disponíveis. A seleção e a ordem são aleatórias, sem repetição nesta sessão.</p></div></header>' +
        '<form id="study-config" class="card stack"><div class="field"><label for="study-quantity">Quantos cartões você quer estudar?</label>' +
        '<input id="study-quantity" name="quantity" type="number" inputmode="numeric" required min="1" step="1" value="' + cards.length + '" aria-describedby="quantity-help quantity-notice">' +
        '<p id="quantity-help" class="helper">Escolha um número maior que zero. Se pedir mais de ' + cards.length + ' cartões, você estudará todos os disponíveis.</p>' +
        '<p id="quantity-notice" class="helper" role="status"></p></div><div class="actions"><button class="btn primary" type="submit">Começar estudo</button>' +
        ctx.link('Cancelar', 'baralhos/' + deck.id) + '</div></form></div>';
    }

    var session = state.session;
    if (!session || session.deckId !== deck.id) return '<section class="empty"><h1>Nenhuma sessão disponível</h1>' +
      '<p>Prepare uma sessão para estudar este baralho.</p>' + ctx.link('Configurar estudo', base + 'configurar', 'primary') + '</section>';
    if (route[2] === 'resumo') {
      if (session.active) return '<section class="empty"><h1>Seu estudo está em andamento</h1>' + ctx.link('Continuar estudo', base + 'sessao', 'primary') + '</section>';
      var correct = session.answers.filter(function (answer) { return answer.correct; }).length;
      return '<div class="stack">' + back + '<header class="page-head"><div><p class="eyebrow">' + esc(deck.name) + '</p><h1>Sessão concluída</h1>' +
        '<p class="muted">Você respondeu todos os cartões desta sessão.</p></div></header>' + stats(session.answers.length, correct) +
        '<div class="actions">' + ctx.link('Estudar novamente', base + 'configurar', 'primary') + ctx.link('Voltar para o baralho', 'baralhos/' + deck.id) + '</div></div>';
    }
    if (route[2] !== 'sessao') return ctx.notFound();
    if (!session.active || session.index >= session.cards.length) return '<section class="empty"><h1>Esta sessão já terminou</h1>' + ctx.link('Ver resumo', base + 'resumo', 'primary') + '</section>';
    var current = session.cards[session.index];
    ctx.after(function () {
      var reveal = document.querySelector('#study-reveal');
      if (reveal) reveal.addEventListener('click', function () {
        session.revealed = true;
        ctx.render();
        document.querySelector('#study-correct').focus();
        ctx.notify('Resposta revelada. Compare com o que você lembrou e avalie.', 'success');
      });
      document.querySelectorAll('#view [data-answer]').forEach(function (button) {
        button.addEventListener('click', async function () {
          var buttons = Array.from(document.querySelectorAll('#view [data-answer]'));
          if (buttons.some(function (item) { return item.disabled; })) return;
          buttons.filter(function (item) { return item !== button; }).forEach(function (item) { item.disabled = true; });
          await ctx.operation(button, function () {
            session.answers.push(Object.assign({}, current, { correct: button.dataset.answer === 'correct' }));
            session.index += 1;
            session.revealed = false;
            if (session.index === session.cards.length) {
              session.active = false;
              ctx.go(base + 'resumo');
              var correctCount = session.answers.filter(function (answer) { return answer.correct; }).length;
              ctx.notify('Sessão concluída. ' + session.answers.length + ' cartões respondidos, ' + correctCount + ' acertos e ' + (session.answers.length - correctCount) + ' erros.');
            } else {
              ctx.render();
              document.querySelector('#view .study-card').focus();
              ctx.notify('Cartão ' + (session.index + 1) + ' de ' + session.cards.length + '. Resposta oculta.');
            }
          });
          buttons.forEach(function (item) { item.disabled = false; });
        });
      });
    });
    return '<div class="stack"><div class="actions">' + ctx.link('Interromper estudo', 'baralhos/' + deck.id) + '</div>' +
      '<header class="page-head"><div><p class="eyebrow">Cartão ' + (session.index + 1) + ' de ' + session.cards.length + '</p><h1>Estudar ' + esc(deck.name) + '</h1></div></header>' +
      '<div><label for="study-progress">' + session.index + ' de ' + session.cards.length + ' cartões respondidos</label>' +
      '<progress id="study-progress" class="progress" value="' + session.index + '" max="' + session.cards.length + '"></progress></div>' +
      '<article class="study-card card" tabindex="-1" aria-label="Cartão ' + (session.index + 1) + '"><p class="eyebrow">Frente</p><h2>' + esc(current.front) + '</h2>' +
      (session.revealed ? '<hr><p class="eyebrow">Resposta</p><p>' + esc(current.back) + '</p>' : '<p class="muted">A resposta está oculta. Tente lembrar antes de revelar.</p>') + '</article>' +
      (session.revealed ? '<p class="helper">Compare sua resposta e avalie:</p><div class="actions"><button type="button" id="study-correct" class="btn primary" data-answer="correct">Acertei</button>' +
        '<button type="button" class="btn secondary" data-answer="wrong">Errei</button></div>' : '<div class="actions"><button type="button" id="study-reveal" class="btn primary">Revelar resposta</button></div>') + '</div>';
  }

  window.Study = { render: render };
}());
