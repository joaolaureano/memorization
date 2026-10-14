const LIMITE_BYTES = 10 * 1024 * 1024;
const LIMITE_SEGUNDOS = 300;
const EXTENSOES = [".mp3", ".m4a", ".ogg", ".opus", ".webm", ".wav"];
const TIPO_CHAVE = { "frente-verso": "tipoFrenteVerso", imagem: "tipoImagem", audio: "tipoAudio" };
const ESTADO_CHAVE = { tocando: "estadoTocando", pausado: "estadoPausado", fim: "estadoFim" };
const LOCALES = { "pt-BR": "pt-BR", "en-US": "en-US", "es-419": "es-419" };

const TEXTOS = {
  "pt-BR": {
    navInicio: "Início", navEstudo: "Estudo", navBaralhos: "Baralhos", navPerfil: "Perfil", sair: "Sair",
    idioma: "Idioma", baralho: "Baralho", criarCartao: "Criar cartão", tipoCartao: "Tipo de cartão",
    tipoFrenteVerso: "Frente-Verso", tipoImagem: "Imagem", tipoAudio: "Áudio", frente: "Frente",
    anuncioCampos: "Campos do tipo {tipo}",
    ajudaAudio: "MP3, M4A, OGG, WebM ou WAV, até 10 MB e 5 minutos. MP3 e M4A tocam em todos os aparelhos.",
    trocarAudio: "Trocar áudio", removerAudio: "Remover áudio", mensagem: "Mensagem (opcional)",
    ajudaMensagem: "Contexto ou pergunta para o áudio, sem revelar a resposta.", mensagemRotulo: "Mensagem:",
    verso: "Verso", versoRotulo: "Verso:", tags: "Tags", ajudaImagem: "Os campos de Imagem seguem a spec 026.",
    salvar: "Salvar cartão", enviandoAudio: "Enviando áudio…", cartaoCriado: "Cartão criado no protótipo.",
    escolhaAudio: "Escolha um áudio.",
    formatoAudio: "Formato não aceito. Escolha MP3, M4A, OGG, WebM ou WAV.",
    tamanhoAudio: "O áudio deve ter até 10 MB.", duracaoAudio: "O áudio deve ter até 5 minutos.",
    confirmaDescartarAudio: "O áudio escolhido será descartado.",
    tocar: "Tocar", pausar: "Pausar", tocarAudio: "Tocar áudio", pausarAudio: "Pausar áudio",
    posicaoAudio: "Posição do áudio", estadoTocando: "Tocando", estadoPausado: "Pausado", estadoFim: "Fim do áudio",
    indisponivel: "Áudio indisponível", duracao: "Duração", tituloDemo: "Tocador",
    cartoesDoBaralho: "Cartões do baralho", miniatura: "Miniatura do Cartão", estudo: "Estudo",
    revelar: "Revelar", revelado: "Verso revelado", proximo: "Próximo",
  },
  "en-US": {
    navInicio: "Home", navEstudo: "Study", navBaralhos: "Decks", navPerfil: "Profile", sair: "Sign out",
    idioma: "Language", baralho: "Deck", criarCartao: "Create card", tipoCartao: "Card type",
    tipoFrenteVerso: "Front-Back", tipoImagem: "Image", tipoAudio: "Audio", frente: "Front",
    anuncioCampos: "{tipo} type fields",
    ajudaAudio: "MP3, M4A, OGG, WebM or WAV, up to 10 MB and 5 minutes. MP3 and M4A play on all devices.",
    trocarAudio: "Change audio", removerAudio: "Remove audio", mensagem: "Message (optional)",
    ajudaMensagem: "Context or a question for the audio, without revealing the answer.", mensagemRotulo: "Message:",
    verso: "Back", versoRotulo: "Back:", tags: "Tags", ajudaImagem: "Image fields follow spec 026.",
    salvar: "Save card", enviandoAudio: "Uploading audio…", cartaoCriado: "Card created in the prototype.",
    escolhaAudio: "Choose an audio file.",
    formatoAudio: "Format not accepted. Choose MP3, M4A, OGG, WebM or WAV.",
    tamanhoAudio: "The audio must be up to 10 MB.", duracaoAudio: "The audio must be up to 5 minutes long.",
    confirmaDescartarAudio: "The chosen audio will be discarded.",
    tocar: "Play", pausar: "Pause", tocarAudio: "Play audio", pausarAudio: "Pause audio",
    posicaoAudio: "Audio position", estadoTocando: "Playing", estadoPausado: "Paused", estadoFim: "End of audio",
    indisponivel: "Audio unavailable", duracao: "Duration", tituloDemo: "Player",
    cartoesDoBaralho: "Deck cards", miniatura: "Card thumbnail", estudo: "Study",
    revelar: "Reveal", revelado: "Back revealed", proximo: "Next",
  },
  "es-419": {
    navInicio: "Inicio", navEstudo: "Estudio", navBaralhos: "Mazos", navPerfil: "Perfil", sair: "Salir",
    idioma: "Idioma", baralho: "Mazo", criarCartao: "Crear tarjeta", tipoCartao: "Tipo de tarjeta",
    tipoFrenteVerso: "Anverso-Reverso", tipoImagem: "Imagen", tipoAudio: "Audio", frente: "Anverso",
    anuncioCampos: "Campos del tipo {tipo}",
    ajudaAudio: "MP3, M4A, OGG, WebM o WAV, de hasta 10 MB y 5 minutos. MP3 y M4A se reproducen en todos los dispositivos.",
    trocarAudio: "Cambiar audio", removerAudio: "Quitar audio", mensagem: "Mensaje (opcional)",
    ajudaMensagem: "Contexto o pregunta para el audio, sin revelar la respuesta.", mensagemRotulo: "Mensaje:",
    verso: "Reverso", versoRotulo: "Reverso:", tags: "Etiquetas", ajudaImagem: "Los campos de Imagen siguen la spec 026.",
    salvar: "Guardar tarjeta", enviandoAudio: "Subiendo audio…", cartaoCriado: "Tarjeta creada en el prototipo.",
    escolhaAudio: "Elige un audio.",
    formatoAudio: "Formato no aceptado. Elige MP3, M4A, OGG, WebM o WAV.",
    tamanhoAudio: "El audio debe tener hasta 10 MB.", duracaoAudio: "El audio debe durar hasta 5 minutos.",
    confirmaDescartarAudio: "El audio elegido se descartará.",
    tocar: "Reproducir", pausar: "Pausar", tocarAudio: "Reproducir audio", pausarAudio: "Pausar audio",
    posicaoAudio: "Posición del audio", estadoTocando: "Reproduciendo", estadoPausado: "En pausa", estadoFim: "Fin del audio",
    indisponivel: "Audio no disponible", duracao: "Duración", tituloDemo: "Reproductor",
    cartoesDoBaralho: "Tarjetas del mazo", miniatura: "Miniatura de la tarjeta", estudo: "Estudio",
    revelar: "Revelar", revelado: "Reverso revelado", proximo: "Siguiente",
  },
};

let idioma = "pt-BR";
const tocadores = new Set();
let tocadorAtivo = null;

const tipo = document.querySelector("#tipo");
const anuncio = document.querySelector("#anuncio");
const formulario = document.querySelector("#formulario");
const campoFrente = document.querySelector("#campo-frente");
const frente = document.querySelector("#frente");
const camposAudio = document.querySelector("#campos-audio");
const camposImagem = document.querySelector("#campos-imagem");
const arquivo = document.querySelector("#arquivo");
const erroAudio = document.querySelector("#erro-audio");
const previa = document.querySelector("#previa");
const previaTocador = document.querySelector("#previa-tocador");
const nomeArquivo = document.querySelector("#nome-arquivo");
const mensagem = document.querySelector("#mensagem");
const verso = document.querySelector("#verso");
const contadorMensagem = document.querySelector("#contador-mensagem");
const contadorVerso = document.querySelector("#contador-verso");
const contadorFrente = document.querySelector("#contador-frente");
const salvar = document.querySelector("#salvar");
const mensagemFormulario = document.querySelector("#mensagem-formulario");
const listaCartoes = document.querySelector("#cartoes");
const face = document.querySelector("#face");
const revelar = document.querySelector("#revelar");
const proximo = document.querySelector("#proximo");

let ultimoTipo = tipo.value;
let audioEscolhido = null;
let escolhaAtual = 0;
let indiceEstudo = 0;
let versoRevelado = false;
let tocadorEstudo = null;

function t(chave, variaveis = {}) {
  const texto = TEXTOS[idioma][chave] ?? TEXTOS["pt-BR"][chave];
  return texto.replace(/\{(\w+)\}/g, (_, nome) => variaveis[nome] ?? "");
}

function nf(opcoes) {
  return new Intl.NumberFormat(LOCALES[idioma], opcoes);
}

// Tempo visível, como 0:05 ou 1:04.
function formatarTempo(segundos) {
  const total = Math.floor(segundos);
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return `${nf().format(minutos)}:${nf({ minimumIntegerDigits: 2 }).format(resto)}`;
}

// Duração falada, como "1 minuto e 4 segundos", no idioma da interface.
function falarDuracao(segundos) {
  const total = Math.floor(segundos);
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  const partes = [];
  if (minutos) partes.push(nf({ style: "unit", unit: "minute", unitDisplay: "long" }).format(minutos));
  if (resto || !minutos) partes.push(nf({ style: "unit", unit: "second", unitDisplay: "long" }).format(resto));
  return new Intl.ListFormat(LOCALES[idioma], { style: "long", type: "conjunction" }).format(partes);
}

// WAV de silêncio gerado em memória, para tocar offline.
function criarWavDeSilencio(segundos) {
  const taxa = 8000;
  const amostras = Math.round(segundos * taxa);
  const buffer = new ArrayBuffer(44 + amostras);
  const v = new DataView(buffer);
  const escreve = (pos, texto) => {
    for (let i = 0; i < texto.length; i++) v.setUint8(pos + i, texto.charCodeAt(i));
  };
  escreve(0, "RIFF");
  v.setUint32(4, 36 + amostras, true);
  escreve(8, "WAVE");
  escreve(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  escreve(36, "data");
  v.setUint32(40, amostras, true);
  new Uint8Array(buffer, 44).fill(128);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function medirDuracao(url) {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => resolve(null);
    audio.src = url;
  });
}

// Tocador do AudioDoCartao: um elemento para lista, sessão, edição e pré-escuta.
class Tocador {
  constructor({ src, duracao, compacto = false }) {
    this.duracaoPadrao = duracao;
    this.estado = "pausado";
    this.raiz = document.createElement("div");
    this.raiz.className = `ca-tocador${compacto ? " ca-tocador--compacto" : ""}`;
    this.botao = document.createElement("button");
    this.botao.type = "button";
    this.botao.className = "ca-botao";
    const corpo = document.createElement("div");
    corpo.className = "ca-corpo";
    this.posicao = document.createElement("input");
    this.posicao.type = "range";
    this.posicao.className = "ca-posicao";
    this.posicao.min = "0";
    this.posicao.step = "any";
    this.tempo = document.createElement("p");
    this.tempo.className = "ca-tempo";
    this.tempo.hidden = compacto;
    this.estadoEl = document.createElement("p");
    this.estadoEl.className = "ca-estado";
    this.estadoEl.setAttribute("aria-live", "polite");
    this.audio = document.createElement("audio");
    this.audio.preload = "auto";
    this.audio.src = src;
    corpo.append(this.posicao, this.tempo, this.estadoEl);
    this.raiz.append(this.botao, corpo, this.audio);

    this.botao.addEventListener("click", () => (this.audio.paused ? this.tocar() : this.pausar()));
    this.posicao.addEventListener("input", () => this.irPara(Number(this.posicao.value)));
    this.posicao.addEventListener("keydown", (evento) => this.teclar(evento));
    this.audio.addEventListener("play", () => this.definirEstado("tocando"));
    this.audio.addEventListener("pause", () => this.definirEstado(this.audio.ended ? "fim" : "pausado"));
    this.audio.addEventListener("ended", () => this.definirEstado("fim"));
    this.audio.addEventListener("timeupdate", () => this.atualizarPosicao());
    this.audio.addEventListener("loadedmetadata", () => this.atualizarPosicao());
    this.audio.addEventListener("error", () => this.mostrarIndisponivel());

    tocadores.add(this);
    this.atualizarTextos();
  }

  get duracao() {
    const real = this.audio.duration;
    return Number.isFinite(real) && real > 0 ? real : this.duracaoPadrao;
  }

  tocar() {
    if (tocadorAtivo && tocadorAtivo !== this) tocadorAtivo.pausar();
    tocadorAtivo = this;
    this.audio.play().catch(() => {
      if (this.audio.paused) this.definirEstado("pausado");
    });
  }

  pausar() {
    this.audio.pause();
  }

  irPara(segundos) {
    this.audio.currentTime = Math.min(Math.max(segundos, 0), this.duracao);
    this.atualizarPosicao();
  }

  teclar(evento) {
    const atual = this.audio.currentTime;
    const alvos = {
      ArrowRight: atual + 5,
      ArrowUp: atual + 5,
      ArrowLeft: atual - 5,
      ArrowDown: atual - 5,
      Home: 0,
      End: this.duracao,
    };
    if (!(evento.key in alvos)) return;
    evento.preventDefault();
    this.irPara(alvos[evento.key]);
  }

  definirEstado(estado) {
    this.estado = estado;
    this.atualizarTextos();
  }

  atualizarPosicao() {
    const duracao = this.duracao;
    const posicao = this.audio.currentTime || 0;
    this.posicao.max = String(duracao);
    this.posicao.value = String(posicao);
    this.posicao.setAttribute("aria-valuetext", `${falarDuracao(posicao)} de ${falarDuracao(duracao)}`);
    this.tempo.textContent = `${formatarTempo(posicao)} / ${formatarTempo(duracao)}`;
  }

  atualizarTextos() {
    const tocando = !this.audio.paused;
    this.botao.textContent = tocando ? t("pausar") : t("tocar");
    this.botao.setAttribute("aria-label", tocando ? t("pausarAudio") : t("tocarAudio"));
    this.posicao.setAttribute("aria-label", t("posicaoAudio"));
    this.estadoEl.textContent = t(ESTADO_CHAVE[this.estado]);
    this.atualizarPosicao();
  }

  mostrarIndisponivel() {
    this.audio.pause();
    const caixa = document.createElement("div");
    caixa.className = "ca-indisponivel";
    const titulo = document.createElement("p");
    titulo.dataset.i18n = "indisponivel";
    titulo.textContent = t("indisponivel");
    caixa.append(titulo);
    this.raiz.replaceChildren(caixa);
  }

  destruir() {
    this.audio.pause();
    tocadores.delete(this);
    if (tocadorAtivo === this) tocadorAtivo = null;
    this.raiz.remove();
  }
}

function atualizarDuracao(el) {
  const segundos = Number(el.dataset.duracao);
  el.textContent = formatarTempo(segundos);
  el.setAttribute("aria-label", `${t("duracao")}: ${falarDuracao(segundos)}`);
}

function criarDuracao(segundos) {
  const el = document.createElement("span");
  el.className = "ca-duracao";
  el.setAttribute("role", "img");
  el.dataset.duracao = String(segundos);
  atualizarDuracao(el);
  return el;
}

function paragrafo(...nos) {
  const p = document.createElement("p");
  p.append(...nos);
  return p;
}

function negrito(texto) {
  const s = document.createElement("strong");
  s.textContent = texto;
  return s;
}

function rotulado(chave, texto) {
  const s = document.createElement("strong");
  s.dataset.i18n = chave;
  s.textContent = t(chave);
  return paragrafo(s, " ", texto);
}

function criarItem(cartao) {
  const li = document.createElement("li");
  li.className = "ca-cartao";
  const etiqueta = document.createElement("span");
  etiqueta.className = "ca-etiqueta";
  etiqueta.dataset.i18n = TIPO_CHAVE[cartao.tipo];
  etiqueta.textContent = t(TIPO_CHAVE[cartao.tipo]);
  li.append(etiqueta);

  if (cartao.tipo === "imagem") {
    const miniatura = document.createElement("div");
    miniatura.className = "ca-miniatura";
    miniatura.dataset.i18n = "miniatura";
    miniatura.textContent = t("miniatura");
    li.append(miniatura, paragrafo(negrito(cartao.frente)));
  } else if (cartao.tipo === "audio") {
    li.append(rotulado("mensagemRotulo", cartao.mensagem));
    const linha = document.createElement("div");
    linha.className = "ca-linha";
    const tocador = new Tocador({ src: cartao.src, duracao: cartao.duracao, compacto: true });
    linha.append(tocador.raiz, criarDuracao(cartao.duracao));
    li.append(linha);
  } else {
    li.append(paragrafo(negrito(cartao.frente)));
  }
  li.append(rotulado("versoRotulo", cartao.verso));
  return li;
}

function atualizarContadores() {
  const limite = nf().format(1000);
  contadorMensagem.textContent = `${nf().format(mensagem.value.length)} / ${limite}`;
  contadorVerso.textContent = `${nf().format(verso.value.length)} / ${limite}`;
  contadorFrente.textContent = `${nf().format(frente.value.length)} / ${limite}`;
}

function aplicarCampos() {
  const valor = tipo.value;
  campoFrente.hidden = valor === "audio";
  camposAudio.hidden = valor !== "audio";
  camposImagem.hidden = valor !== "imagem";
}

function limparErro() {
  erroAudio.hidden = true;
  erroAudio.textContent = "";
  arquivo.removeAttribute("aria-invalid");
}

function recusarAudio(texto) {
  erroAudio.textContent = texto;
  erroAudio.hidden = false;
  arquivo.setAttribute("aria-invalid", "true");
  arquivo.value = "";
  arquivo.focus();
}

function definirPrevia(info) {
  const anterior = audioEscolhido;
  audioEscolhido = info;
  info.tocador = new Tocador({ src: info.url, duracao: info.duracao });
  previaTocador.replaceChildren(info.tocador.raiz);
  nomeArquivo.textContent = info.nome;
  previa.hidden = false;
  limparErro();
  if (anterior) {
    anterior.tocador?.destruir();
    URL.revokeObjectURL(anterior.url);
  }
}

// Solta o Áudio escolhido sem revogar a URL, porque o Cartão salvo passa a usá-la.
function soltarAudio() {
  audioEscolhido?.tocador?.destruir();
  audioEscolhido = null;
  previa.hidden = true;
  nomeArquivo.textContent = "";
  arquivo.value = "";
  limparErro();
}

function limparAudio() {
  const url = audioEscolhido?.url;
  soltarAudio();
  if (url) URL.revokeObjectURL(url);
}

tipo.addEventListener("change", () => {
  const novo = tipo.value;
  if (ultimoTipo === "audio" && novo !== "audio" && audioEscolhido) {
    if (!window.confirm(t("confirmaDescartarAudio"))) {
      tipo.value = ultimoTipo;
      tipo.focus();
      return;
    }
    limparAudio();
  }
  if (novo === "audio" && ultimoTipo !== "audio") mensagem.value = frente.value;
  else if (novo !== "audio" && ultimoTipo === "audio") frente.value = mensagem.value;
  ultimoTipo = novo;
  aplicarCampos();
  atualizarContadores();
  anuncio.textContent = t("anuncioCampos", { tipo: t(TIPO_CHAVE[novo]) });
});

arquivo.addEventListener("change", async () => {
  const escolha = ++escolhaAtual;
  limparErro();
  const file = arquivo.files?.[0];
  if (!file) return;
  const nome = file.name.toLowerCase();
  if (!EXTENSOES.some((extensao) => nome.endsWith(extensao))) return recusarAudio(t("formatoAudio"));
  if (file.size > LIMITE_BYTES) return recusarAudio(t("tamanhoAudio"));
  const url = URL.createObjectURL(file);
  const duracao = await medirDuracao(url);
  if (escolha !== escolhaAtual) {
    URL.revokeObjectURL(url);
    return;
  }
  if (duracao === null) {
    URL.revokeObjectURL(url);
    return recusarAudio(t("formatoAudio"));
  }
  if (duracao > LIMITE_SEGUNDOS) {
    URL.revokeObjectURL(url);
    return recusarAudio(t("duracaoAudio"));
  }
  definirPrevia({ url, nome: file.name, duracao });
});

document.querySelector("#trocar-audio").addEventListener("click", () => arquivo.click());
document.querySelector("#remover-audio").addEventListener("click", () => {
  limparAudio();
  arquivo.focus();
});

mensagem.addEventListener("input", atualizarContadores);
verso.addEventListener("input", atualizarContadores);
frente.addEventListener("input", atualizarContadores);

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensagemFormulario.textContent = "";
  const valorTipo = tipo.value;
  if (valorTipo === "audio" && !audioEscolhido) {
    recusarAudio(t("escolhaAudio"));
    return;
  }
  if (!verso.value.trim()) {
    verso.focus();
    return;
  }
  const cartao = {
    tipo: valorTipo,
    verso: verso.value.trim(),
    frente: valorTipo === "audio" ? "" : frente.value.trim(),
    mensagem: valorTipo === "audio" ? mensagem.value.trim() : "",
  };
  if (valorTipo === "audio") {
    cartao.src = audioEscolhido.url;
    cartao.duracao = audioEscolhido.duracao;
    mensagemFormulario.textContent = t("enviandoAudio");
    salvar.disabled = true;
    await new Promise((resolve) => setTimeout(resolve, 300));
    salvar.disabled = false;
    soltarAudio();
  }
  cartoes.push(cartao);
  listaCartoes.append(criarItem(cartao));
  formulario.reset();
  tipo.value = "frente-verso";
  ultimoTipo = "frente-verso";
  aplicarCampos();
  atualizarContadores();
  mensagemFormulario.textContent = t("cartaoCriado");
});

function atualizarBotaoRevelar() {
  revelar.dataset.i18n = versoRevelado ? "revelado" : "revelar";
  revelar.textContent = t(revelar.dataset.i18n);
}

function montarFace() {
  const cartao = cartoes[indiceEstudo];
  tocadorEstudo?.destruir();
  tocadorEstudo = null;
  versoRevelado = false;
  face.replaceChildren();
  if (cartao.tipo === "audio") {
    tocadorEstudo = new Tocador({ src: cartao.src, duracao: cartao.duracao });
    face.append(rotulado("mensagemRotulo", cartao.mensagem), tocadorEstudo.raiz);
  } else {
    face.append(paragrafo(negrito(cartao.frente)));
  }
  atualizarBotaoRevelar();
}

revelar.addEventListener("click", () => {
  if (versoRevelado) return;
  versoRevelado = true;
  face.append(rotulado("versoRotulo", cartoes[indiceEstudo].verso));
  atualizarBotaoRevelar();
});

proximo.addEventListener("click", () => {
  indiceEstudo = (indiceEstudo + 1) % cartoes.length;
  montarFace();
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
  tocadores.forEach((item) => item.atualizarTextos());
  document.querySelectorAll("[data-duracao]").forEach(atualizarDuracao);
  atualizarContadores();
}

document.querySelectorAll("[data-idioma]").forEach((botao) => {
  botao.addEventListener("click", () => {
    idioma = botao.dataset.idioma;
    aplicarIdioma();
  });
});

// Dados fictícios em memória; o áudio de exemplo dura 1 minuto e 4 segundos.
const audioDeExemplo = criarWavDeSilencio(64);
const cartoes = [
  { tipo: "frente-verso", frente: "Fotossíntese", verso: "Processo pelo qual plantas convertem luz em energia química." },
  { tipo: "imagem", frente: "Mapa do bioma", verso: "O bioma ocupa a região central." },
  { tipo: "audio", mensagem: "Qual instrumento você ouve?", verso: "Violoncelo.", src: audioDeExemplo, duracao: 64 },
];

cartoes.forEach((cartao) => listaCartoes.append(criarItem(cartao)));
document.querySelector("#tocador-demo .ca-slot").append(new Tocador({ src: audioDeExemplo, duracao: 64 }).raiz);
montarFace();
aplicarCampos();
aplicarIdioma();
