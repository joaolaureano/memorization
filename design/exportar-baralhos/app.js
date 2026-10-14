const IDIOMAS = { pt: "pt-BR", en: "en-US", es: "es-419" };
const TEXTOS = {
  pt: {
    navInicio: "Início", navEstudo: "Estudo", navBaralhos: "Baralhos", navPerfil: "Perfil", idioma: "Idioma", origem: "Origem da exportação",
    baralhos: "Baralhos", titulo: "Exportar", umBaralho: "Um Baralho", variosBaralhos: "Vários Baralhos", conteudo: "Conteúdo",
    contagemIngles: "12 Cartões", marqueBaralhos: "Marque os Baralhos", todosBaralhos: "Todos os Baralhos", contagem12: "12 Cartões", contagem2: "2 Cartões", contagem0: "0 Cartões", nomeMidia: "Mídia", nomeVazio: "Vazio",
    formato: "Formato de exportação", escolhaFormato: "Escolha o formato", apkg: "Pacote Anki (.apkg)", ajudaAnki: "Abre no Anki, no AnkiDroid e no AnkiMobile. Ao importar no Anki, marque «Importar progresso de estudo».",
    resumo: "Resumo", resumoMidia: "1 com Imagem, 1 com Áudio", tamanho: "Tamanho aproximado: 3,2 MB", exportarArquivo: "Exportar arquivo", gerando: "Gerando arquivo…", pronto: "Arquivo pronto: Inglês.apkg", baixar: "Baixar de novo",
    semCartoes: "Não há Cartões para exportar.", marqueAoMenosUm: "Marque ao menos um Baralho.", semCartoesEscolhidos: "Os Baralhos escolhidos não têm Cartões.", falha: "Não foi possível gerar o arquivo. Tente de novo.", limite: "Exportação acima do limite. Exporte os Baralhos em partes.", ferramentas: "Demonstração de falha e recusa", ferramentasAjuda: "Controles de protótipo para revisar os estados.", simularFalha: "Simular falha", simularRecusa: "Simular limite excedido",
  },
  en: {
    navInicio: "Home", navEstudo: "Study", navBaralhos: "Decks", navPerfil: "Profile", idioma: "Language", origem: "Export source",
    baralhos: "Decks", titulo: "Export", umBaralho: "One deck", variosBaralhos: "Multiple decks", conteudo: "Content",
    contagemIngles: "12 Cards", marqueBaralhos: "Select decks", todosBaralhos: "All decks", contagem12: "12 Cards", contagem2: "2 Cards", contagem0: "0 Cards", nomeMidia: "Media", nomeVazio: "Empty", 
    formato: "Export format", escolhaFormato: "Choose a format", apkg: "Anki package (.apkg)", ajudaAnki: "Opens in Anki, AnkiDroid and AnkiMobile. When importing in Anki, select “Import learning progress”.",
    resumo: "Summary", resumoMidia: "1 with Image, 1 with Audio", tamanho: "Approximate size: 3.2 MB", exportarArquivo: "Export file", gerando: "Generating file…", pronto: "File ready: Inglês.apkg", baixar: "Download again",
    semCartoes: "There are no cards to export.", marqueAoMenosUm: "Select at least one deck.", semCartoesEscolhidos: "The selected decks have no cards.", falha: "The file could not be generated. Try again.", limite: "Export exceeds the limit. Export decks in smaller groups.", ferramentas: "Failure and refusal preview", ferramentasAjuda: "Prototype controls for reviewing the states.", simularFalha: "Simulate failure", simularRecusa: "Simulate size limit",
  },
  es: {
    navInicio: "Inicio", navEstudo: "Estudio", navBaralhos: "Mazos", navPerfil: "Perfil", idioma: "Idioma", origem: "Origen de exportación",
    baralhos: "Mazos", titulo: "Exportar", umBaralho: "Un mazo", variosBaralhos: "Varios mazos", conteudo: "Contenido",
    contagemIngles: "12 tarjetas", marqueBaralhos: "Elige los mazos", todosBaralhos: "Todos los mazos", contagem12: "12 tarjetas", contagem2: "2 tarjetas", contagem0: "0 tarjetas", nomeMidia: "Multimedia", nomeVazio: "Vacío",
    formato: "Formato de exportación", escolhaFormato: "Elige el formato", apkg: "Paquete Anki (.apkg)", ajudaAnki: "Se abre en Anki, AnkiDroid y AnkiMobile. Al importar en Anki, marca «Importar progreso de estudio».",
    resumo: "Resumen", resumoMidia: "1 con Imagen, 1 con Audio", tamanho: "Tamaño aproximado: 3,2 MB", exportarArquivo: "Exportar archivo", gerando: "Generando archivo…", pronto: "Archivo listo: Inglês.apkg", baixar: "Descargar de nuevo",
    semCartoes: "No hay tarjetas para exportar.", marqueAoMenosUm: "Elige al menos un mazo.", semCartoesEscolhidos: "Los mazos elegidos no tienen tarjetas.", falha: "No se pudo generar el archivo. Inténtalo de nuevo.", limite: "La exportación supera el límite. Exporta los mazos en partes.", ferramentas: "Vista de fallos y rechazos", ferramentasAjuda: "Controles del prototipo para revisar los estados.", simularFalha: "Simular fallo", simularRecusa: "Simular límite excedido",
  },
};

let idioma = "pt";
const botaoExportar = document.querySelector("#exportar");
const estado = document.querySelector("#estado");
const motivo = document.querySelector("#motivo");
const selecaoUnica = document.querySelector("#selecao-unica");
const selecaoVarios = document.querySelector("#selecao-varios");
const checks = [...document.querySelectorAll(".baralho")];
const todos = document.querySelector("#todos");
let vista = "um";
let temporizador;

function t(chave) {
  return TEXTOS[idioma][chave] ?? TEXTOS.pt[chave];
}

function definirEstado(chave) {
  window.clearTimeout(temporizador);
  botaoExportar.disabled = false;
  botaoExportar.textContent = t("exportarArquivo");
  estado.replaceChildren();
  if (chave === "falha" || chave === "limite") {
    estado.textContent = t(chave);
    return;
  }
  if (chave === "pronto") {
    estado.append(document.createTextNode(t("pronto") + " "));
    const link = document.createElement("a");
    link.href = "data:application/octet-stream;base64,UEsDBA==";
    link.download = "Inglês.apkg";
    link.textContent = t("baixar");
    estado.append(link);
  }
}

function atualizarResumo() {
  const marcados = vista === "um" ? ["ingles"] : checks.filter((check) => check.checked).map((check) => check.value);
  const cartoes = marcados.reduce((soma, nome) => soma + ({ ingles: 12, midia: 2, vazio: 0 }[nome] ?? 0), 0);
  const contagem = new Intl.NumberFormat(IDIOMAS[idioma]).format(cartoes);
  const quantidade = new Intl.NumberFormat(IDIOMAS[idioma]).format(marcados.length);
  document.querySelector("#resumo-principal").textContent = idioma === "en"
    ? `${quantidade} ${marcados.length === 1 ? "deck" : "decks"} · ${contagem} ${cartoes === 1 ? "Card" : "Cards"}`
    : idioma === "es"
      ? `${quantidade} ${marcados.length === 1 ? "mazo" : "mazos"} · ${contagem} ${cartoes === 1 ? "tarjeta" : "tarjetas"}`
      : `${quantidade} ${marcados.length === 1 ? "Baralho" : "Baralhos"} · ${contagem} ${cartoes === 1 ? "Cartão" : "Cartões"}`;

  const temMidia = marcados.includes("midia");
  document.querySelector("#resumo-midia").hidden = !temMidia;
  document.querySelector("#resumo-tamanho").hidden = !temMidia;
  todos.checked = checks.length > 0 && checks.every((check) => check.checked);
  todos.indeterminate = checks.some((check) => check.checked) && !todos.checked;

  let motivoChave = "";
  if (vista === "varios" && marcados.length === 0) motivoChave = "marqueAoMenosUm";
  else if (marcados.length > 0 && cartoes === 0) motivoChave = "semCartoesEscolhidos";
  else if (vista === "um" && cartoes === 0) motivoChave = "semCartoes";
  motivo.hidden = !motivoChave;
  motivo.textContent = motivoChave ? t(motivoChave) : "";
  botaoExportar.disabled = Boolean(motivoChave);
}

function aplicarIdioma() {
  document.documentElement.lang = IDIOMAS[idioma];
  document.querySelectorAll("[data-i18n]").forEach((elemento) => {
    elemento.textContent = t(elemento.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((elemento) => {
    elemento.setAttribute("aria-label", t(elemento.dataset.i18nAria));
  });
  document.querySelectorAll("[data-idioma]").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.idioma === idioma));
  });
  atualizarResumo();
}

document.querySelectorAll("[data-idioma]").forEach((botao) => {
  botao.addEventListener("click", () => {
    idioma = botao.dataset.idioma;
    aplicarIdioma();
    if (estado.textContent) definirEstado(estado.dataset.estado || "");
  });
});

document.querySelectorAll("[data-entrada]").forEach((botao) => {
  botao.addEventListener("click", () => {
    vista = botao.dataset.entrada;
    selecaoUnica.hidden = vista !== "um";
    selecaoVarios.hidden = vista !== "varios";
    document.querySelectorAll("[data-entrada]").forEach((item) => item.setAttribute("aria-pressed", String(item === botao)));
    definirEstado("");
    atualizarResumo();
  });
});

todos.addEventListener("change", () => {
  checks.forEach((check) => { check.checked = todos.checked; });
  atualizarResumo();
});
checks.forEach((check) => check.addEventListener("change", atualizarResumo));

botaoExportar.addEventListener("click", () => {
  botaoExportar.disabled = true;
  botaoExportar.textContent = t("gerando");
  estado.dataset.estado = "gerando";
  estado.textContent = t("gerando");
  temporizador = window.setTimeout(() => {
    botaoExportar.disabled = false;
    botaoExportar.textContent = t("exportarArquivo");
    estado.dataset.estado = "pronto";
    definirEstado("pronto");
  }, 350);
});

document.querySelectorAll("[data-estado]").forEach((botao) => {
  botao.addEventListener("click", () => {
    estado.dataset.estado = botao.dataset.estado;
    definirEstado(botao.dataset.estado);
  });
});

aplicarIdioma();
