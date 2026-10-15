// Protótipo da 030: Conta de teste.

const TEXTOS = {
  "pt-BR": {
    navInicio: "Início", navPerfil: "Perfil", sair: "Sair", idioma: "Idioma",
    etiquetaConta: "Conta de teste", tituloEstados: "Estados do protótipo", estadosPrototipo: "Estados do protótipo",
    estadoEntrar: "Entrar", estadoPreparando: "Preparando", estadoLimite: "Limite", estadoExpirada: "Expirada",
    estadoInicio: "Início", estadoPerfil: "Perfil", estadoSaida: "Confirmar saída",
    entrar: "Entrar", usuario: "Usuário", senha: "Senha", entrarBotao: "Entrar", ou: "ou",
    entrarComoTeste: "Entrar como Teste", fraseTeste: "Experimente com Baralhos de exemplo. Tudo é apagado ao sair.",
    preparando: "Preparando sua Conta de teste…",
    limite: "Muitas tentativas agora. Tente de novo em alguns minutos.",
    avisoExpirada: "Sua Conta de teste terminou. Entre como Teste para começar de novo.",
    loginNaoSimulado: "Entrar com usuário e senha não é simulado neste protótipo. Use Entrar como Teste.",
    avisoConta: "Esta é uma Conta de teste. Tudo será apagado ao sair.",
    linkCreditos: "Créditos do acervo de demonstração",
    inicio: "Início", inicioTexto: "Baralhos de exemplo prontos para estudar.",
    perfil: "Perfil", perfilConta: "A Conta de teste não pode ser alterada nem excluída.",
    preferencias: "Preferências", preferenciasTexto: "As preferências continuam disponíveis nesta seção.",
    creditosTitulo: "Créditos do acervo de demonstração", creditoAutor: "Autor", creditoLicenca: "Licença",
    creditoFonte: "Fonte", fechar: "Fechar",
    sairTitulo: "Sair", confirmaSair: "Sair apaga a Conta de teste e tudo o que você fez nela.",
    cancelar: "Cancelar", sairEApagar: "Sair e apagar",
  },
  "en-US": {
    navInicio: "Home", navPerfil: "Profile", sair: "Sign out", idioma: "Language",
    etiquetaConta: "Test account", tituloEstados: "Prototype states", estadosPrototipo: "Prototype states",
    estadoEntrar: "Sign in", estadoPreparando: "Preparing", estadoLimite: "Limit", estadoExpirada: "Expired",
    estadoInicio: "Home", estadoPerfil: "Profile", estadoSaida: "Confirm sign-out",
    entrar: "Sign in", usuario: "Username", senha: "Password", entrarBotao: "Sign in", ou: "or",
    entrarComoTeste: "Sign in as Test", fraseTeste: "Try it with sample Decks. Everything is erased when you sign out.",
    preparando: "Preparing your Test account…",
    limite: "Too many attempts right now. Try again in a few minutes.",
    avisoExpirada: "Your Test account has ended. Sign in as Test to start again.",
    loginNaoSimulado: "Signing in with a username and password is not simulated in this prototype. Use Sign in as Test.",
    avisoConta: "This is a Test account. Everything will be erased when you sign out.",
    linkCreditos: "Credits for the demonstration collection",
    inicio: "Home", inicioTexto: "Sample Decks ready to study.",
    perfil: "Profile", perfilConta: "The Test account cannot be changed or deleted.",
    preferencias: "Preferences", preferenciasTexto: "Preferences remain available in this section.",
    creditosTitulo: "Credits for the demonstration collection", creditoAutor: "Author", creditoLicenca: "License",
    creditoFonte: "Source", fechar: "Close",
    sairTitulo: "Sign out", confirmaSair: "Signing out erases the Test account and everything you did in it.",
    cancelar: "Cancel", sairEApagar: "Sign out and erase",
  },
  "es-419": {
    navInicio: "Inicio", navPerfil: "Perfil", sair: "Salir", idioma: "Idioma",
    etiquetaConta: "Cuenta de prueba", tituloEstados: "Estados del prototipo", estadosPrototipo: "Estados del prototipo",
    estadoEntrar: "Entrar", estadoPreparando: "Preparando", estadoLimite: "Límite", estadoExpirada: "Vencida",
    estadoInicio: "Inicio", estadoPerfil: "Perfil", estadoSaida: "Confirmar salida",
    entrar: "Entrar", usuario: "Usuario", senha: "Contraseña", entrarBotao: "Entrar", ou: "o",
    entrarComoTeste: "Entrar como Prueba", fraseTeste: "Pruébalo con Mazos de ejemplo. Todo se borra al salir.",
    preparando: "Preparando tu Cuenta de prueba…",
    limite: "Hay muchos intentos ahora. Vuelve a intentarlo en unos minutos.",
    avisoExpirada: "Tu Cuenta de prueba terminó. Entra como Prueba para empezar de nuevo.",
    loginNaoSimulado: "Entrar con usuario y contraseña no se simula en este prototipo. Usa Entrar como Prueba.",
    avisoConta: "Esta es una Cuenta de prueba. Todo se borrará al salir.",
    linkCreditos: "Créditos del acervo de demostración",
    inicio: "Inicio", inicioTexto: "Mazos de ejemplo listos para estudiar.",
    perfil: "Perfil", perfilConta: "La Cuenta de prueba no puede cambiarse ni eliminarse.",
    preferencias: "Preferencias", preferenciasTexto: "Las preferencias siguen disponibles en esta sección.",
    creditosTitulo: "Créditos del acervo de demostración", creditoAutor: "Autor", creditoLicenca: "Licencia",
    creditoFonte: "Fuente", fechar: "Cerrar",
    sairTitulo: "Salir", confirmaSair: "Salir borra la Cuenta de prueba y todo lo que hiciste en ella.",
    cancelar: "Cancelar", sairEApagar: "Salir y borrar",
  },
};

let idioma = "pt-BR";
let estadoAtual = "entrar";
let mensagemLogin = null;

const LOCALES = { "pt-BR": "pt-BR", "en-US": "en-US", "es-419": "es-419" };
const telaEntrar = document.querySelector("#tela-entrar");
const telaApp = document.querySelector("#tela-app");
const navegacao = document.querySelector("#navegacao");
const etiquetaConta = document.querySelector("#etiqueta-conta");
const sair = document.querySelector("#sair");
const vistaInicio = document.querySelector("#vista-inicio");
const vistaPerfil = document.querySelector("#vista-perfil");
const avisoExpirada = document.querySelector("#aviso-expirada");
const alertaLimite = document.querySelector("#alerta-limite");
const estadoCriacao = document.querySelector("#estado-criacao");
const avisoLogin = document.querySelector("#aviso-login");
const entrarTeste = document.querySelector("#entrar-teste");
const formularioEntrar = document.querySelector("#formulario-entrar");
const creditos = document.querySelector("#creditos");
const abrirCreditos = document.querySelector("#abrir-creditos");
const confirmarSaida = document.querySelector("#confirmar-saida");

function t(chave) {
  return TEXTOS[idioma][chave] ?? TEXTOS["pt-BR"][chave];
}

// Devolve o foco ao gatilho quando um diálogo fecha, salvo se outro diálogo abriu.
function devolverFoco(gatilho) {
  return () => {
    if (document.querySelector("dialog[open]") || gatilho.closest("[hidden]")) return;
    gatilho.focus();
  };
}

function mostrarEntrar() {
  telaApp.hidden = true;
  telaEntrar.hidden = false;
  navegacao.hidden = true;
  etiquetaConta.hidden = true;
  sair.hidden = true;
}

function mostrarApp(vista) {
  telaEntrar.hidden = true;
  telaApp.hidden = false;
  navegacao.hidden = false;
  etiquetaConta.hidden = false;
  sair.hidden = false;
  vistaInicio.hidden = vista !== "inicio";
  vistaPerfil.hidden = vista !== "perfil";
  navegacao.querySelectorAll("a").forEach((link) => {
    if (link.dataset.vista === vista) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function limparEntrar() {
  avisoExpirada.hidden = true;
  alertaLimite.hidden = true;
  estadoCriacao.textContent = "";
  avisoLogin.textContent = "";
  mensagemLogin = null;
  entrarTeste.disabled = false;
}

function fecharDialogos() {
  [creditos, confirmarSaida].forEach((dialogo) => {
    if (dialogo.open) dialogo.close();
  });
}

function mostrarEstado(nome) {
  fecharDialogos();
  estadoAtual = nome;
  limparEntrar();
  switch (nome) {
    case "preparando":
      mostrarEntrar();
      entrarTeste.disabled = true;
      estadoCriacao.textContent = t("preparando");
      estadoCriacao.tabIndex = -1;
      estadoCriacao.focus();
      break;
    case "limite":
      mostrarEntrar();
      alertaLimite.hidden = false;
      alertaLimite.focus();
      break;
    case "expirada":
      mostrarEntrar();
      avisoExpirada.hidden = false;
      break;
    case "inicio":
      mostrarApp("inicio");
      break;
    case "perfil":
      mostrarApp("perfil");
      break;
    case "saida":
      mostrarApp("inicio");
      confirmarSaida.showModal();
      break;
    default:
      mostrarEntrar();
  }
}

// Entrar como Teste: mostra o estado de preparo e depois abre o Início.
entrarTeste.addEventListener("click", () => {
  mostrarEstado("preparando");
  setTimeout(() => {
    if (estadoAtual === "preparando") mostrarEstado("inicio");
  }, 900);
});

formularioEntrar.addEventListener("submit", (evento) => {
  evento.preventDefault();
  mensagemLogin = "loginNaoSimulado";
  avisoLogin.textContent = t(mensagemLogin);
});

navegacao.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", (evento) => {
    evento.preventDefault();
    mostrarApp(link.dataset.vista);
  });
});

abrirCreditos.addEventListener("click", (evento) => {
  evento.preventDefault();
  creditos.showModal();
});
creditos.addEventListener("close", devolverFoco(abrirCreditos));
document.querySelector("#fechar-creditos").addEventListener("click", () => creditos.close());

sair.addEventListener("click", () => confirmarSaida.showModal());
confirmarSaida.addEventListener("close", devolverFoco(sair));
document.querySelector("#cancelar-saida").addEventListener("click", () => confirmarSaida.close());
document.querySelector("#sair-e-apagar").addEventListener("click", () => {
  confirmarSaida.close();
  mostrarEstado("entrar");
  entrarTeste.focus();
});

document.querySelectorAll("[data-estado]").forEach((botao) => {
  botao.addEventListener("click", () => mostrarEstado(botao.dataset.estado));
});

function aplicarIdioma() {
  document.documentElement.lang = LOCALES[idioma];
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll("[data-idioma]").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.idioma === idioma));
  });
  if (estadoAtual === "preparando") estadoCriacao.textContent = t("preparando");
  if (mensagemLogin) avisoLogin.textContent = t(mensagemLogin);
}

document.querySelectorAll("[data-idioma]").forEach((botao) => {
  botao.addEventListener("click", () => {
    idioma = botao.dataset.idioma;
    aplicarIdioma();
  });
});

aplicarIdioma();
mostrarEstado("entrar");
