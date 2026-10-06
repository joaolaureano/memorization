/* Protótipo local da feature 025. Não acessa a API nem persiste dados. */
const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
const tela = $("#tela");
const anuncio = $("#anuncio");
const limite = 1000;

const baralhosIniciais = () => [
  { id: "ingles", nome: "Inglês cotidiano" },
  { id: "viagens", nome: "Viagens" },
  { id: "biologia", nome: "Biologia" },
  { id: "algebra", nome: "Álgebra linear" },
];

const cartoesIniciais = () => [
  { id: "c1", frente: "To walk", verso: "Caminhar", baralhoId: "ingles", temAgendamento: true, historico: 3 },
  { id: "c2", frente: "Good morning", verso: "Bom dia", baralhoId: "ingles", temAgendamento: false, historico: 0 },
  { id: "c3", frente: "To walk", verso: "Andar", baralhoId: "viagens", temAgendamento: true, historico: 1 },
  { id: "c4", frente: "Where is the station?", verso: "Onde fica a estação?", baralhoId: "viagens", temAgendamento: false, historico: 0 },
  { id: "c5", frente: "O que é osmose?", verso: "Movimento de água através de uma membrana semipermeável.", baralhoId: "biologia", temAgendamento: true, historico: 2 },
];

let baralhos = baralhosIniciais();
let cartoes = cartoesIniciais();
let pagina = { nome: "baralhos" };
let falhaDeProximaGravacao = false;
let operacaoPendente = null;
let elementoComFoco = null;
let sequenciaId = 10;

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[caractere]);
}

function chaveDaFrente(frente) {
  return frente
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function cartoesDoBaralho(baralhoId) {
  return cartoes.filter((cartao) => cartao.baralhoId === baralhoId);
}

function frenteDisponivel(frente, baralhoId, ignorarId = null, reservas = []) {
  const existentes = [
    ...cartoesDoBaralho(baralhoId),
    ...reservas.filter((cartao) => cartao.baralhoId === baralhoId),
  ];
  const repetida = (valor) => existentes.some((cartao) =>
    cartao.id !== ignorarId && chaveDaFrente(cartao.frente) === chaveDaFrente(valor));

  if (!repetida(frente)) return { frente, ajustada: false };

  for (let contador = 2; contador < 10000; contador += 1) {
    const candidata = `${frente} (${contador})`;
    if (candidata.length > limite) {
      return { erro: `Não foi possível numerar a Frente sem ultrapassar ${limite} caracteres. Encurte o texto e tente novamente.` };
    }
    if (!repetida(candidata)) return { frente: candidata, ajustada: true };
  }

  return { erro: "Não foi possível encontrar um sufixo livre para esta Frente." };
}

function anunciar(texto) {
  anuncio.textContent = "";
  requestAnimationFrame(() => { anuncio.textContent = texto; });
}

function focarTitulo() {
  $("#titulo-da-tela")?.focus();
}

function cabecalho(titulo, descricao, acoes = "") {
  return `<header class="pt-cabecalho">
    <div><h1 id="titulo-da-tela" tabindex="-1">${escapar(titulo)}</h1><p class="texto-secundario">${escapar(descricao)}</p></div>
    ${acoes ? `<div class="pt-cabecalho__acoes">${acoes}</div>` : ""}
  </header>`;
}

function renderListaDeBaralhos() {
  const linhas = baralhos.map((baralho) => {
    const quantidade = cartoesDoBaralho(baralho.id).length;
    return `<li class="pt-lista__linha">
      <div class="pt-lista__texto"><p class="pt-lista__titulo">${escapar(baralho.nome)}</p><p class="pt-lista__detalhe">${quantidade} ${quantidade === 1 ? "Cartão" : "Cartões"}</p></div>
      <div class="pt-lista__acoes"><button class="botao botao--secundario" type="button" data-abrir-baralho="${escapar(baralho.id)}" aria-label="Abrir ${escapar(baralho.nome)}">Abrir</button></div>
    </li>`;
  }).join("");

  tela.innerHTML = `<div class="pagina">
    ${cabecalho("Baralhos", "Escolha um Baralho para consultar e criar Cartões.", '<button class="botao botao--primario" type="button" data-aviso="Criar Baralho">Criar Baralho</button>')}
    ${baralhos.length ? `<ul class="lista lista--compacta pt-lista">${linhas}</ul>` : '<div class="pt-vazio"><p>Não há Baralhos neste acervo.</p></div>'}
  </div>`;
  document.title = "Baralhos · Memorization";
}

function renderDetalheDoBaralho(baralhoId) {
  const baralho = baralhos.find((item) => item.id === baralhoId);
  if (!baralho) {
    pagina = { nome: "baralhos" };
    render();
    return;
  }

  const cartoesDoDeck = cartoesDoBaralho(baralhoId);
  const linhas = cartoesDoDeck.map((cartao) => `<li class="pt-lista__linha" data-cartao="${escapar(cartao.id)}">
    <div class="pt-lista__texto">
      <p class="pt-lista__titulo">${escapar(cartao.frente)}</p>
      <p class="pt-lista__verso">${escapar(cartao.verso)}</p>
    </div>
    <div class="pt-lista__acoes">
      <button class="botao botao--secundario" type="button" data-editar-cartao="${escapar(cartao.id)}" aria-label="Editar ${escapar(cartao.frente)}">Editar</button>
      <button class="botao botao--perigo" type="button" data-excluir-cartao="${escapar(cartao.id)}" aria-label="Excluir ${escapar(cartao.frente)}">Excluir</button>
    </div>
  </li>`).join("");

  const acoes = `<button class="botao botao--primario" type="button" data-criar-cartao="${escapar(baralho.id)}">Criar Cartão</button>
    <button class="botao botao--secundario" type="button" data-aviso="Revisar ${escapar(baralho.nome)}">Revisar</button>
    <button class="botao botao--perigo" type="button" data-excluir-baralho="${escapar(baralho.id)}">Excluir Baralho</button>`;
  const conteudo = cartoesDoDeck.length
    ? `<ul class="lista lista--compacta pt-lista">${linhas}</ul>`
    : `<div class="pt-vazio"><p>Este Baralho ainda não tem Cartões.</p><button class="botao botao--primario" type="button" data-criar-cartao="${escapar(baralho.id)}">Criar Cartão</button></div>`;

  tela.innerHTML = `<div class="pagina">
    ${cabecalho(baralho.nome, `${cartoesDoDeck.length} ${cartoesDoDeck.length === 1 ? "Cartão" : "Cartões"}`, acoes)}
    <section aria-label="Cartões de ${escapar(baralho.nome)}"><h2>Cartões</h2>${conteudo}</section>
  </div>`;
  document.title = `${baralho.nome} · Baralhos · Memorization`;
}

function renderFormularioDeCartao(baralhoId, cartaoId = null) {
  const baralho = baralhos.find((item) => item.id === baralhoId);
  const cartao = cartaoId === null ? null : cartoes.find((item) => item.id === cartaoId);
  if (!baralho || (cartaoId !== null && !cartao)) {
    pagina = { nome: "baralhos" };
    render();
    return;
  }

  const titulo = cartao ? "Editar Cartão" : "Criar Cartão";
  tela.innerHTML = `<div class="pagina">
    ${cabecalho(titulo, baralho.nome)}
    <form class="pt-formulario" id="formulario-cartao" data-baralho="${escapar(baralhoId)}" data-cartao="${escapar(cartaoId ?? "")}">
      <div class="campo">
        <label class="rotulo" for="frente">Frente</label>
        <textarea id="frente" name="frente" aria-describedby="contagem-frente" required>${escapar(cartao?.frente ?? "")}</textarea>
        <p class="pt-contagem" id="contagem-frente">${(cartao?.frente ?? "").length} / ${limite} caracteres</p>
      </div>
      <div class="campo">
        <label class="rotulo" for="verso">Verso</label>
        <textarea id="verso" name="verso" aria-describedby="contagem-verso" required>${escapar(cartao?.verso ?? "")}</textarea>
        <p class="pt-contagem" id="contagem-verso">${(cartao?.verso ?? "").length} / ${limite} caracteres</p>
      </div>
      <p class="pt-mensagem" id="erro-formulario" role="alert" hidden></p>
      <div class="pt-acoes">
        <button class="botao botao--primario" type="submit">${cartao ? "Salvar alterações" : "Criar Cartão"}</button>
        <button class="botao botao--secundario" type="button" data-voltar-baralho="${escapar(baralhoId)}">Cancelar</button>
      </div>
    </form>
  </div>`;
  document.title = `${titulo} · ${baralho.nome} · Memorization`;
  $("#frente")?.focus();
}

function renderTransicao() {
  const pendentes = cartoes.filter((cartao) => cartao.baralhoId === null);
  if (!pendentes.length) {
    pagina = { nome: "baralhos" };
    render();
    return;
  }

  const linhas = pendentes.map((cartao) => {
    const compartilhado = (cartao.legados ?? []).length > 1;
    const rotulo = compartilhado ? "Baralho que manterá o Cartão original" : "Baralho de destino";
    const destinos = compartilhado ? cartao.legados : baralhos.map((baralho) => baralho.id);
    const opcoes = destinos.map((id) => {
      const baralho = baralhos.find((item) => item.id === id);
      return baralho ? `<option value="${escapar(id)}">${escapar(baralho.nome)}</option>` : "";
    }).join("");
    const origem = compartilhado
      ? `<p class="pt-migracao__nota">Também pertence a: ${cartao.legados.map((id) => escapar(baralhos.find((baralho) => baralho.id === id)?.nome ?? "Baralho")).join(", ")}</p>`
      : '<p class="pt-migracao__nota">Este Cartão ainda não pertence a um Baralho.</p>';
    const efeito = compartilhado
      ? '<p class="pt-migracao__nota">Cópias serão criadas nos outros Baralhos anteriores, sem agendamento ou histórico.</p>'
      : "";
    return `<li class="pt-migracao__linha" data-migrar="${escapar(cartao.id)}">
      <div class="pt-lista__texto"><p class="pt-lista__titulo">${escapar(cartao.frente)}</p><p class="pt-lista__verso">${escapar(cartao.verso)}</p>${origem}${efeito}</div>
      <div><label class="pt-migracao__destino" for="destino-${escapar(cartao.id)}">${rotulo}</label><select id="destino-${escapar(cartao.id)}" name="${escapar(cartao.id)}" required>${opcoes}</select></div>
    </li>`;
  }).join("");

  tela.innerHTML = `<div class="pagina">
    ${cabecalho("Organizar Cartões", "Há Cartões antigos que precisam de um destino.")}
    <form id="formulario-transicao">
      <ul class="pt-lista">${linhas}</ul>
      <p class="pt-mensagem" id="erro-transicao" role="alert" hidden></p>
      <p class="pt-mensagem pt-mensagem--sucesso" id="sucesso-transicao" role="status" hidden></p>
      <div class="pt-acoes"><button class="botao botao--primario" type="submit">Concluir transição</button></div>
    </form>
  </div>`;
  document.title = "Organizar Cartões · Memorization";
  focarTitulo();
}

function render() {
  if (pagina.nome === "baralhos") renderListaDeBaralhos();
  else if (pagina.nome === "baralho") renderDetalheDoBaralho(pagina.id);
  else if (pagina.nome === "criar" || pagina.nome === "editar") renderFormularioDeCartao(pagina.baralhoId, pagina.cartaoId ?? null);
  else if (pagina.nome === "transicao") renderTransicao();
}

function mudarParaDetalhe(baralhoId) {
  pagina = { nome: "baralho", id: baralhoId };
  render();
  focarTitulo();
}

function mostrarErroFormulario(texto) {
  const erro = $("#erro-formulario");
  if (!erro) return;
  erro.textContent = texto;
  erro.hidden = false;
  $("#frente")?.focus();
}

function salvarCartao(formulario) {
  const baralhoId = formulario.dataset.baralho;
  const cartaoId = formulario.dataset.cartao || null;
  const frente = formulario.elements.frente.value;
  const verso = formulario.elements.verso.value;

  if (falhaDeProximaGravacao) {
    falhaDeProximaGravacao = false;
    mostrarErroFormulario("Não foi possível salvar o Cartão. O conteúdo continua disponível para nova tentativa.");
    return;
  }
  if (!frente.trim()) return mostrarErroFormulario("Informe a Frente do Cartão.");
  if (!verso.trim()) return mostrarErroFormulario("Informe o Verso do Cartão.");
  if (frente.length > limite || verso.length > limite) return mostrarErroFormulario(`Frente e Verso devem ter até ${limite} caracteres.`);

  if (cartaoId !== null) {
    const atual = cartoes.find((cartao) => cartao.id === cartaoId);
    if (!atual) return mostrarErroFormulario("O Cartão não está mais disponível.");
    const colisao = cartoesDoBaralho(baralhoId).some((cartao) =>
      cartao.id !== cartaoId && chaveDaFrente(cartao.frente) === chaveDaFrente(frente));
    if (colisao) return mostrarErroFormulario("Essa Frente já existe neste Baralho. Escolha outra.");
    atual.frente = frente;
    atual.verso = verso;
    anunciar(`Cartão ${atual.frente} atualizado.`);
    mudarParaDetalhe(baralhoId);
    return;
  }

  const resultado = frenteDisponivel(frente, baralhoId);
  if (resultado.erro) return mostrarErroFormulario(resultado.erro);
  const cartao = {
    id: `c${sequenciaId++}`,
    frente: resultado.frente,
    verso,
    baralhoId,
    temAgendamento: false,
    historico: 0,
  };
  cartoes.push(cartao);
  mudarParaDetalhe(baralhoId);
  anunciar(resultado.ajustada
    ? `Cartão criado como ${cartao.frente}; a Frente já existia neste Baralho.`
    : `Cartão ${cartao.frente} criado em ${baralhos.find((item) => item.id === baralhoId)?.nome}.`);
}

function abrirConfirmacao(tipo, id, acionador) {
  operacaoPendente = { tipo, id };
  elementoComFoco = acionador;
  const dialogo = $("#confirmacao");
  if (tipo === "cartao") {
    const cartao = cartoes.find((item) => item.id === id);
    $("#confirmacao-titulo").textContent = `Excluir “${cartao?.frente ?? "Cartão"}”?`;
    $("#confirmacao-texto").textContent = "O Cartão e seu Agendamento serão removidos. Registros históricos já concluídos permanecerão.";
    $("#confirmar").textContent = "Excluir Cartão";
  } else {
    const baralho = baralhos.find((item) => item.id === id);
    const quantidade = cartoesDoBaralho(id).length;
    $("#confirmacao-titulo").textContent = `Excluir “${baralho?.nome ?? "Baralho"}”?`;
    $("#confirmacao-texto").textContent = `Serão removidos o Baralho, ${quantidade} ${quantidade === 1 ? "Cartão" : "Cartões"} e seus Agendamentos. Registros históricos já concluídos permanecerão.`;
    $("#confirmar").textContent = "Excluir Baralho";
  }
  dialogo.showModal();
  $("#cancelar").focus();
}

function excluirPendente() {
  if (!operacaoPendente) return;
  const { tipo, id } = operacaoPendente;
  operacaoPendente = null;
  $("#confirmacao").close();
  if (tipo === "cartao") {
    const cartao = cartoes.find((item) => item.id === id);
    cartoes = cartoes.filter((item) => item.id !== id);
    mudarParaDetalhe(cartao?.baralhoId ?? pagina.id);
    anunciar(`Cartão ${cartao?.frente ?? ""} e seu Agendamento foram excluídos. O Histórico permanece.`);
    return;
  }
  const nome = baralhos.find((item) => item.id === id)?.nome ?? "Baralho";
  cartoes = cartoes.filter((item) => item.baralhoId !== id);
  baralhos = baralhos.filter((item) => item.id !== id);
  pagina = { nome: "baralhos" };
  render();
  focarTitulo();
  anunciar(`${nome}, seus Cartões e Agendamentos foram excluídos. O Histórico permanece.`);
}

function iniciarTransicaoDemo() {
  baralhos = baralhosIniciais();
  cartoes = [
    { id: "legado-unico", frente: "To walk", verso: "Caminhar", baralhoId: "ingles", legados: ["ingles"], temAgendamento: true, historico: 2 },
    { id: "legado-compartilhado", frente: "To walk", verso: "Andar", baralhoId: null, legados: ["ingles", "viagens"], temAgendamento: true, historico: 1 },
    { id: "legado-avulso", frente: "O que é osmose?", verso: "Movimento de água através de membrana semipermeável.", baralhoId: null, legados: [], temAgendamento: false, historico: 0 },
  ];
  falhaDeProximaGravacao = false;
  pagina = { nome: "transicao" };
  render();
}

function aplicarTransicao(formulario) {
  const pendentes = cartoes.filter((cartao) => cartao.baralhoId === null);
  const escolhas = new Map(pendentes.map((cartao) => [cartao.id, formulario.elements[cartao.id]?.value]));
  const erro = $("#erro-transicao");
  const sucesso = $("#sucesso-transicao");
  erro.hidden = true;
  sucesso.hidden = true;

  if (falhaDeProximaGravacao) {
    falhaDeProximaGravacao = false;
    erro.textContent = "A transição não foi concluída. As escolhas foram preservadas para nova tentativa.";
    erro.hidden = false;
    return;
  }
  if (pendentes.some((cartao) => !escolhas.get(cartao.id))) {
    erro.textContent = "Escolha um Baralho para cada Cartão antes de concluir.";
    erro.hidden = false;
    return;
  }

  const originais = [];
  const copias = [];
  const reservas = [];
  for (const cartao of pendentes) {
    const destino = escolhas.get(cartao.id);
    const resultadoOriginal = frenteDisponivel(cartao.frente, destino, cartao.id, reservas);
    if (resultadoOriginal.erro) {
      erro.textContent = resultadoOriginal.erro;
      erro.hidden = false;
      return;
    }
    const original = { ...cartao, frente: resultadoOriginal.frente, baralhoId: destino };
    originais.push(original);
    reservas.push(original);
    for (const baralhoAnterior of cartao.legados ?? []) {
      if (baralhoAnterior === destino) continue;
      const resultadoCopia = frenteDisponivel(original.frente, baralhoAnterior, null, reservas);
      if (resultadoCopia.erro) {
        erro.textContent = resultadoCopia.erro;
        erro.hidden = false;
        return;
      }
      copias.push({
        id: `c${sequenciaId++}`,
        frente: resultadoCopia.frente,
        verso: cartao.verso,
        baralhoId: baralhoAnterior,
        temAgendamento: false,
        historico: 0,
      });
      reservas.push(copias.at(-1));
    }
  }
  for (const original of originais) {
    const cartao = cartoes.find((item) => item.id === original.id);
    Object.assign(cartao, original, { legados: [] });
  }
  cartoes.push(...copias);
  sucesso.textContent = `Transição concluída. ${copias.length} ${copias.length === 1 ? "cópia foi criada" : "cópias foram criadas"}; o Histórico dos originais foi preservado.`;
  sucesso.hidden = false;
  setTimeout(() => {
    pagina = { nome: "baralhos" };
    render();
    anunciar(sucesso.textContent);
  }, 250);
}

function salvarSelecaoDemonstrativa() {
  const origem = cartoes.filter((cartao) => ["c1", "c3"].includes(cartao.id));
  const novoBaralho = { id: `demo-${sequenciaId++}`, nome: "Minha seleção" };
  baralhos.push(novoBaralho);
  const copias = [];
  const reservas = [];
  for (const cartao of origem) {
    const resultado = frenteDisponivel(cartao.frente, novoBaralho.id, null, reservas);
    if (resultado.erro) {
      baralhos = baralhos.filter((item) => item.id !== novoBaralho.id);
      anunciar(resultado.erro);
      return;
    }
    copias.push({
      id: `c${sequenciaId++}`,
      frente: resultado.frente,
      verso: cartao.verso,
      baralhoId: novoBaralho.id,
      temAgendamento: false,
      historico: 0,
    });
    reservas.push(copias.at(-1));
  }
  cartoes.push(...copias);
  mudarParaDetalhe(novoBaralho.id);
  anunciar("Minha seleção foi salva com cópias. Os Cartões e Agendamentos de origem não foram alterados.");
}

tela.addEventListener("click", (evento) => {
  const alvo = evento.target.closest("button");
  if (!alvo) return;
  if (alvo.dataset.abrirBaralho) mudarParaDetalhe(alvo.dataset.abrirBaralho);
  else if (alvo.dataset.criarCartao) {
    pagina = { nome: "criar", baralhoId: alvo.dataset.criarCartao };
    render();
  } else if (alvo.dataset.editarCartao) {
    const cartao = cartoes.find((item) => item.id === alvo.dataset.editarCartao);
    pagina = { nome: "editar", baralhoId: cartao?.baralhoId, cartaoId: cartao?.id };
    render();
  } else if (alvo.dataset.excluirCartao) abrirConfirmacao("cartao", alvo.dataset.excluirCartao, alvo);
  else if (alvo.dataset.excluirBaralho) abrirConfirmacao("baralho", alvo.dataset.excluirBaralho, alvo);
  else if (alvo.dataset.voltarBaralho) mudarParaDetalhe(alvo.dataset.voltarBaralho);
  else if (alvo.dataset.aviso) {
    anunciar(`${alvo.dataset.aviso}: fluxo existente fora do escopo demonstrativo.`);
  }
});

tela.addEventListener("submit", (evento) => {
  evento.preventDefault();
  if (evento.target.id === "formulario-cartao") salvarCartao(evento.target);
  else if (evento.target.id === "formulario-transicao") aplicarTransicao(evento.target);
});

tela.addEventListener("input", (evento) => {
  const campo = evento.target;
  if (campo.id === "frente") $("#contagem-frente").textContent = `${campo.value.length} / ${limite} caracteres`;
  if (campo.id === "verso") $("#contagem-verso").textContent = `${campo.value.length} / ${limite} caracteres`;
});

$("#cancelar").addEventListener("click", () => $("#confirmacao").close());
$("#confirmar").addEventListener("click", excluirPendente);
$("#confirmacao").addEventListener("close", () => {
  const foco = elementoComFoco;
  elementoComFoco = null;
  if (foco?.isConnected) foco.focus();
  else focarTitulo();
});

$("#abrir-cenario").addEventListener("click", () => {
  const cenario = $("#cenario").value;
  if (cenario === "migracao" || cenario === "falha") {
    iniciarTransicaoDemo();
    falhaDeProximaGravacao = cenario === "falha";
  } else if (cenario === "vazio") {
    baralhos = [{ id: "vazio", nome: "Novo Baralho" }];
    cartoes = [];
    pagina = { nome: "baralho", id: "vazio" };
    render();
  } else {
    baralhos = baralhosIniciais();
    cartoes = cartoesIniciais();
    pagina = { nome: "baralhos" };
    falhaDeProximaGravacao = false;
    render();
  }
});

$("#salvar-selecao").addEventListener("click", () => {
  if (!cartoes.some((cartao) => cartao.id === "c1") || !cartoes.some((cartao) => cartao.id === "c3")) {
    baralhos = baralhosIniciais();
    cartoes = cartoesIniciais();
  }
  salvarSelecaoDemonstrativa();
});

document.querySelectorAll("[data-navegar]").forEach((link) => {
  link.addEventListener("click", (evento) => {
    if (link.dataset.navegar !== "baralhos") {
      evento.preventDefault();
      anunciar(`${link.textContent.trim()}: fluxo existente fora do escopo demonstrativo.`);
      return;
    }
    evento.preventDefault();
    pagina = { nome: "baralhos" };
    render();
    focarTitulo();
  });
});

render();