const LIMITE = 5 * 1024 * 1024;
const tipo = document.querySelector("#tipo");
const formulario = document.querySelector("#formulario");
const arquivo = document.querySelector("#arquivo");
const previa = document.querySelector("#previa");
const previaImagem = document.querySelector("#previa-imagem");
const erroArquivo = document.querySelector("#erro-arquivo");
const anuncio = document.querySelector("#anuncio");
const mensagem = document.querySelector("#mensagem");
let urlPrevia;
let imagemEscolhida;
let ultimoTipo = tipo.value;
const cartoes = document.querySelector("#cartoes");

function mostrarTipo() {
  const imagem = tipo.value === "imagem";
  document.querySelector(".ci-campo-imagem").hidden = !imagem;
  document.querySelector(".ci-campo-texto-frente").hidden = !imagem;
  document.querySelector(".ci-campo-alternativo").hidden = !imagem;
  document.querySelector(".ci-campo-frente").hidden = imagem;
  anuncio.textContent = `Campos do tipo ${imagem ? "Imagem" : "Frente-Verso"}`;
}

function limparPrevia() {
  if (urlPrevia) URL.revokeObjectURL(urlPrevia);
  urlPrevia = undefined;
  imagemEscolhida = undefined;
  previa.hidden = true;
  previaImagem.removeAttribute("src");
  arquivo.value = "";
}

tipo.addEventListener("change", () => {
  if (ultimoTipo === "imagem" && tipo.value !== "imagem" && imagemEscolhida) {
    if (!window.confirm("Trocar para Frente-Verso descarta a imagem escolhida. Continuar?")) {
      tipo.value = ultimoTipo;
      tipo.focus();
      return;
    }
    limparPrevia();
  }
  ultimoTipo = tipo.value;
  mostrarTipo();
});

arquivo.addEventListener("change", () => {
  erroArquivo.hidden = true;
  erroArquivo.textContent = "";
  const file = arquivo.files?.[0];
  if (!file) return;
  const tiposAceitos = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!tiposAceitos.includes(file.type)) {
    erroArquivo.textContent = "Formato não aceito. Escolha JPEG, PNG, WebP ou GIF.";
  } else if (file.size > LIMITE) {
    erroArquivo.textContent = "A imagem deve ter até 5 MB.";
  } else {
    imagemEscolhida = file;
    if (urlPrevia) URL.revokeObjectURL(urlPrevia);
    urlPrevia = URL.createObjectURL(file);
    previaImagem.src = urlPrevia;
    previa.hidden = false;
    return;
  }
  erroArquivo.hidden = false;
  arquivo.setAttribute("aria-invalid", "true");
  arquivo.focus();
});

document.querySelector("#trocar").addEventListener("click", () => arquivo.click());
document.querySelector("#remover").addEventListener("click", limparPrevia);
document.querySelector("#mostrar-lista").addEventListener("click", () => document.querySelector("#titulo-lista").focus());

formulario.addEventListener("submit", (event) => {
  event.preventDefault();
  mensagem.textContent = "";
  if (tipo.value === "imagem" && !imagemEscolhida) {
    erroArquivo.textContent = "Escolha uma imagem.";
    erroArquivo.hidden = false;
    arquivo.setAttribute("aria-invalid", "true");
    arquivo.focus();
    return;
  }
  const frente = tipo.value === "imagem" ? document.querySelector("#frente").value : document.querySelector("#frente-texto").value;
  const verso = document.querySelector("#verso").value;
  if (!verso.trim()) {
    document.querySelector("#verso").focus();
    return;
  }
  const item = document.createElement("li");
  item.className = "ci-cartao";
  item.dataset.verso = verso;
  const conteudo = document.createElement("div");
  const etiqueta = document.createElement("span");
  etiqueta.className = "ci-etiqueta";
  etiqueta.textContent = tipo.value === "imagem" ? "Imagem" : "Frente-Verso";
  conteudo.append(etiqueta);
  if (tipo.value === "imagem") {
    const img = document.createElement("img");
    img.className = "ci-miniatura";
    img.src = urlPrevia;
    img.alt = document.querySelector("#alternativo").value || frente || "Imagem do Cartão";
    img.addEventListener("error", () => {
      img.replaceWith(Object.assign(document.createElement("span"), {
        className: "ci-inativo",
        textContent: `Imagem indisponível${img.alt ? `: ${img.alt}` : ""}`,
      }));
    }, { once: true });
    conteudo.append(img);
  }
  const frenteEl = document.createElement("p");
  frenteEl.textContent = frente || "Imagem sem texto da frente";
  const versoEl = document.createElement("p");
  versoEl.textContent = verso;
  conteudo.append(frenteEl, versoEl);
  item.prepend(conteudo);
  cartoes.prepend(item);
  mensagem.textContent = "Cartão criado no protótipo.";
  if (urlPrevia) {
    // A miniatura mantém a URL local até a aba ser fechada.
    urlPrevia = undefined;
  }
  formulario.reset();
  tipo.value = "frente-verso";
  ultimoTipo = tipo.value;
  limparPrevia();
  mostrarTipo();
});

const painelEstudo = document.querySelector("#painel-estudo");
let versoDoEstudo = "Processo pelo qual plantas convertem luz em energia química.";
document.querySelector("#estudar").addEventListener("click", () => {
  painelEstudo.hidden = false;
  const cartaoAtual = cartoes.querySelector(".ci-cartao");
  const cartaoImagem = cartaoAtual?.querySelector("img");
  versoDoEstudo = cartaoAtual?.dataset.verso || versoDoEstudo;
  const face = document.querySelector("#face");
  face.replaceChildren();
  if (cartaoImagem) {
    const img = cartaoImagem.cloneNode();
    img.className = "";
    img.addEventListener("error", () => {
      img.replaceWith(Object.assign(document.createElement("p"), {
        className: "ci-inativo",
        textContent: `Imagem indisponível${img.alt ? `: ${img.alt}` : ""}`,
      }));
    }, { once: true });
    face.append(img);
  } else {
    face.textContent = cartaoAtual?.querySelector("p")?.textContent || "Fotossíntese";
  }
  document.querySelector("#revelar").textContent = "Revelar verso";
});
document.querySelector("#revelar").addEventListener("click", (event) => {
  document.querySelector("#face").textContent = versoDoEstudo;
  event.currentTarget.textContent = "Verso revelado";
});

mostrarTipo();
