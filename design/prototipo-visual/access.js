/* Acesso simulado: dados apenas em memória, sem chamadas ao aplicativo. */
(function () {
  'use strict';

  function render(ctx) {
    const { state, route, esc, after, go, notify, operation, link } = ctx;
    if (!['entrar', 'cadastro', 'cadastro/sucesso'].includes(route)) return null;
    if (route === 'cadastro/sucesso') {
      return `<section class="auth card stack"><p class="eyebrow">Tudo pronto</p>
        <h1>Conta criada</h1><p role="status">Seu cadastro foi concluído. Agora você pode entrar com o nome de usuário e a senha que escolheu.</p>
        <div class="actions">${link('Ir para entrar', 'entrar', 'primary')}</div></section>`;
    }

    const signup = route === 'cadastro';
    const demo = state.accounts[0];
    const initialScenario = state.scenario;
    const initialError = initialScenario === 'invalid'
      ? (signup ? 'Revise os campos para criar sua conta.' : 'Nome de usuário ou Senha incorretos.')
      : initialScenario === 'login-error' ? 'Não foi possível entrar agora. Seus dados foram mantidos. Tente novamente.' : '';
    if (['invalid', 'login-error'].includes(initialScenario)) state.scenario = null;

    after(() => {
      const form = document.querySelector('#view #access-form');
      const name = form.elements.username;
      const password = form.elements.password;
      const confirmation = form.elements.confirmation;
      const message = form.querySelector('#access-message');
      const submit = form.querySelector('[type="submit"]');
      let busy = false;

      function error(text, input) {
        message.hidden = false;
        message.textContent = text;
        if (input) {
          input.setAttribute('aria-invalid', 'true');
          input.focus();
        }
      }
      form.addEventListener('input', event => {
        state.dirty = true;
        if (event.target.matches('input')) event.target.removeAttribute('aria-invalid');
        if (signup) {
          form.querySelector('#username-count').textContent = `${name.value.trim().length} de 50 caracteres`;
          form.querySelector('#password-count').textContent = `${password.value.length} de 128 caracteres`;
        }
      });
      form.querySelectorAll('[data-toggle-password]').forEach(toggle => {
        toggle.addEventListener('click', () => {
          const input = form.querySelector(`#${toggle.dataset.togglePassword}`);
          const visible = input.type === 'password';
          input.type = visible ? 'text' : 'password';
          toggle.textContent = visible ? 'Ocultar senha' : 'Mostrar senha';
          toggle.setAttribute('aria-pressed', String(visible));
          if (toggle.hasAttribute('aria-label')) toggle.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Mostrar'} senha de confirmação`);
        });
      });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy) return;
        form.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
        const username = name.value.trim();
        const secret = password.value;
        if (!username) return error('Informe seu nome de usuário.', name);
        if (signup && !/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
          return error('Use de 3 a 50 caracteres no nome de usuário: letras sem acento, números, ponto, sublinhado ou hífen.', name);
        }
        if (!secret) return error('Informe sua senha.', password);
        if (signup && (secret.length < 8 || secret.length > 128)) {
          return error('A senha precisa ter de 8 a 128 caracteres. Espaços são permitidos e preservados.', password);
        }
        if (signup && secret !== confirmation.value) return error('As senhas precisam ser iguais. Confira a confirmação.', confirmation);
        message.hidden = true;
        busy = true;
        form.setAttribute('aria-busy', 'true');
        const controls = [...form.querySelectorAll('input, button')];
        controls.forEach(control => { control.disabled = true; });
        // O botão fica a cargo do controlador comum da operação.
        submit.disabled = false;
        const label = submit.textContent;
        submit.textContent = signup ? 'Criando conta…' : 'Entrando…';
        try {
          const completed = await operation(submit, () => {
            const account = state.accounts.find(item => item.name.toLowerCase() === username.toLowerCase());
            if (signup) {
              if (account) {
                controls.forEach(control => { control.disabled = false; });
                error('Este nome de usuário já existe. Escolha outro.', name);
                return;
              }
              state.accounts.push({ name: username, password: secret });
              state.dirty = false;
              notify('Conta criada com sucesso.');
              go('cadastro/sucesso');
            } else {
              if (!account || account.password !== secret) {
                controls.forEach(control => { control.disabled = false; });
                error('Nome de usuário ou Senha incorretos.', name);
                return;
              }
              // Acervos ficam isolados por usuário durante esta demonstração.
              // O usuário inicial recebe os exemplos do integrador.
              state.acervos = state.acervos || Object.create(null);
              const previousUser = state.user.toLowerCase();
              state.acervos[previousUser] = { cards: state.cards, decks: state.decks };
              const userKey = account.name.toLowerCase();
              const inventory = Object.prototype.hasOwnProperty.call(state.acervos, userKey)
                ? state.acervos[userKey] : { cards: [], decks: [] };
              state.cards = inventory.cards;
              state.decks = inventory.decks;
              state.session = null;
              state.authenticated = true;
              state.user = account.name;
              state.dirty = false;
              notify('Você entrou. Seus baralhos estão prontos.');
              go('baralhos');
            }
          });
          if (completed === false && form.isConnected) {
            error(signup
              ? 'Não foi possível criar a conta agora. Seus dados foram mantidos. Tente novamente.'
              : 'Não foi possível entrar agora. Seus dados foram mantidos. Tente novamente.');
          }
        } finally {
          busy = false;
          controls.forEach(control => { control.disabled = false; });
          form.removeAttribute('aria-busy');
          submit.textContent = label;
        }
      });
    });

    return `<section class="auth stack">
      ${signup ? link('← Voltar para entrar', 'entrar') : '<p class="eyebrow">Um pouco a cada dia</p>'}
      <div class="page-head"><h1>${signup ? 'Criar conta' : 'Entre para continuar'}</h1>
        <p class="muted">${signup ? 'Crie seu acesso e comece a organizar o que quer aprender.' : 'Seus cartões, seus baralhos e um novo momento para aprender.'}</p></div>
      <form id="access-form" class="card stack" novalidate>
        <div id="access-message" class="notice error" role="alert"${initialError ? '' : ' hidden'}>${esc(initialError)}</div>
        <div class="field"><label for="access-username">Nome de usuário</label>
          <input id="access-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required aria-describedby="username-help${signup ? ' username-count' : ''}" value="${!signup && demo ? esc(demo.name) : ''}">
          <p id="username-help" class="helper">${signup ? 'De 3 a 50 caracteres. Use letras sem acento, números, ponto, sublinhado ou hífen.' : 'Use o nome escolhido ao criar sua conta.'}</p>
          ${signup ? '<p id="username-count" class="helper" aria-live="polite">0 de 50 caracteres</p>' : ''}</div>
        <div class="field"><label for="access-password">Senha</label>
          <input id="access-password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required aria-describedby="password-help${signup ? ' password-count' : ''}" value="${!signup && demo ? esc(demo.password) : ''}">
          <button type="button" class="btn secondary" data-toggle-password="access-password" aria-controls="access-password" aria-pressed="false">Mostrar senha</button>
          <p id="password-help" class="helper">${signup ? 'De 8 a 128 caracteres. Qualquer caractere é permitido, inclusive espaços.' : 'A senha diferencia maiúsculas e minúsculas.'}</p>
          ${signup ? '<p id="password-count" class="helper" aria-live="polite">0 de 128 caracteres</p>' : ''}</div>
        ${signup ? `<div class="field"><label for="access-confirmation">Confirmação da senha</label>
          <input id="access-confirmation" name="confirmation" type="password" autocomplete="new-password" required aria-describedby="confirmation-help">
          <button type="button" class="btn secondary" data-toggle-password="access-confirmation" aria-controls="access-confirmation" aria-pressed="false" aria-label="Mostrar senha de confirmação">Mostrar senha</button>
          <p id="confirmation-help" class="helper">Repita a senha exatamente como foi digitada.</p></div>` : ''}
        <div class="actions"><button type="submit" class="btn primary">${signup ? 'Criar conta' : 'Entrar'}</button>
          ${signup ? link('Cancelar', 'entrar') : link('Criar conta', 'cadastro')}</div>
      </form>
      ${!signup && demo ? `<aside class="notice"><strong>Acesso da demonstração</strong><p>Os campos já estão preenchidos. Usuário: <strong>${esc(demo.name)}</strong> · Senha: <strong>${esc(demo.password)}</strong>.</p><p class="helper">Use apenas dados fictícios. Recarregar restaura os exemplos.</p></aside>` : '<p class="helper">Demonstração em memória. Use apenas dados fictícios.</p>'}
    </section>`;
  }
  window.Access = { render };
})();
