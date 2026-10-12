const decks = [
  { id: 1, name: "Álgebra linear", tags: ["matemática", "provas"] },
  { id: 2, name: "Biologia celular", tags: ["biologia", "revisão"] },
  { id: 3, name: "Inglês cotidiano", tags: ["idiomas", "revisão"] },
];
const cards = [
  { id: 1, deck: 1, front: "O que é um vetor?", back: "Um elemento de um espaço vetorial.", tags: ["matemática", "definições"] },
  { id: 2, deck: 1, front: "O que é uma base?", back: "Um conjunto linearmente independente que gera o espaço.", tags: ["matemática", "provas"] },
  { id: 3, deck: 2, front: "Onde ocorre a glicólise?", back: "No citosol.", tags: ["biologia", "definições"] },
];
let page = "baralhos";
let deckTags = [];
let cardTags = [];
let query = "";
const app = document.querySelector("#app");
const allTags = (items) => [...new Set(items.flatMap((item) => item.tags))].sort();
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const badgeList = (tags, removable = false) => `<ul class="tags" aria-label="Tags">${tags.map((tag) => `<li class="tag"><span>${escapeHtml(tag)}</span>${removable ? `<button type="button" data-remove="${escapeHtml(tag)}" aria-label="Remover tag ${escapeHtml(tag)}">×</button>` : ""}</li>`).join("")}</ul>`;
function tagFilter(id, items, selected) {
  const opts = allTags(items);
  return `<fieldset><legend>Filtrar por tags</legend><div class="opcoes">${opts.map((tag) => `<label><input type="checkbox" data-filter-tag="${tag}" ${selected.includes(tag) ? "checked" : ""}>${tag}</label>`).join("")}</div></fieldset>`;
}
function header(title, subtitle, action = "") { return `<header class="cabecalho"><div><h1>${title}</h1><p class="sub">${subtitle}</p></div>${action}</header>`; }
function render() {
  document.querySelectorAll("nav button").forEach((button) => button.setAttribute("aria-current", button.dataset.page === page ? "page" : "false"));
  if (page === "baralhos" || page === "cartoes") return renderList();
  if (page === "detalhe") return renderDetail();
  if (page === "novo-baralho" || page === "novo-cartao") return renderForm();
}
function renderList() {
  const isDeck = page === "baralhos";
  const items = isDeck ? decks : cards;
  const selected = isDeck ? deckTags : cardTags;
  const filtered = items.filter((item) => (item.name?.toLowerCase().includes(query.toLowerCase()) || item.front?.toLowerCase().includes(query.toLowerCase())) && selected.every((tag) => item.tags.includes(tag)));
  app.innerHTML = `${header(isDeck ? "Baralhos" : "Cartões", isDeck ? "Organize seus estudos com tags." : "Combine busca e tags para encontrar cartões.", `<div class="acoes"><button class="botao primario" data-page="${isDeck ? "novo-baralho" : "novo-cartao"}">Criar ${isDeck ? "baralho" : "cartão"}</button></div>`)}<section class="painel filtros"><div class="campo"><label for="busca">Buscar ${isDeck ? "baralhos" : "cartões"}</label><input id="busca" type="search" value="${escapeHtml(query)}" placeholder="Digite para buscar"></div>${tagFilter("tags", items, selected)}</section><div class="resumo"><span>${filtered.length} ${isDeck ? "baralhos" : "cartões"}</span><button class="botao" data-clear>Limpar filtros</button></div>${filtered.length ? `<ul class="lista">${filtered.map((item) => `<li class="linha"><div><p class="titulo">${escapeHtml(item.name ?? item.front)}</p>${!isDeck ? `<p class="secundario">${escapeHtml(decks.find((d) => d.id === item.deck)?.name ?? "")}</p>` : ""}${badgeList(item.tags)}</div><button class="botao" data-detail="${isDeck ? item.id : 1}">Ver detalhe</button></li>`).join("")}</ul>` : `<div class="vazio">Nenhum item corresponde aos filtros.</div>`}`;
  app.querySelector("#busca").addEventListener("input", (e) => { query = e.target.value; render(); document.querySelector("#busca").focus(); });
  app.querySelector("[data-clear]").addEventListener("click", () => { query = ""; if (isDeck) deckTags = []; else cardTags = []; render(); });
  app.querySelectorAll("[data-filter-tag]").forEach((input) => input.addEventListener("change", () => { const next = input.checked ? [...selected, input.dataset.filterTag] : selected.filter((tag) => tag !== input.dataset.filterTag); if (isDeck) deckTags = next; else cardTags = next; render(); }));
  app.querySelectorAll("[data-detail]").forEach((button) => button.addEventListener("click", () => { page = "detalhe"; render(); }));
}
function renderDetail() {
  const deck = decks[0];
  const related = cards.filter((card) => card.deck === deck.id);
  app.innerHTML = `${header(deck.name, "3 cartões · detalhe do baralho", `<div class="acoes"><button class="botao" data-page="editar-baralho">Editar baralho</button><button class="botao" data-page="baralhos">Voltar</button></div>`)}<section class="painel"><h2>Tags do baralho</h2>${badgeList(deck.tags)}<h2>Cartões</h2><ul class="lista">${related.map((card) => `<li class="linha"><div><p class="titulo">${escapeHtml(card.front)}</p><p class="secundario">${escapeHtml(card.back)}</p>${badgeList(card.tags)}</div><button class="botao" data-page="editar-cartao">Editar cartão</button></li>`).join("")}</ul></section>`;
}
function renderForm() {
  const isDeck = page.endsWith("baralho");
  const editing = page.startsWith("editar");
  const entity = isDeck ? decks[0] : cards[0];
  const current = editing ? [...entity.tags] : [];
  const title = `${editing ? "Editar" : "Criar"} ${isDeck ? "baralho" : "cartão"}`;
  app.innerHTML = `${header(title, "Adicione ou remova tags antes de salvar.", `<button class="botao" data-page="${editing ? "detalhe" : (isDeck ? "baralhos" : "cartoes")}">Cancelar</button>`)}<form class="cartao form"><div class="campo"><label for="nome">${isDeck ? "Nome do baralho" : "Frente"}</label><input id="nome" type="text" required></div>${!isDeck ? `<div class="campo"><label for="verso">Verso</label><textarea id="verso" required></textarea></div>` : ""}<div class="campo"><label for="nova-tag">Tags</label><input id="nova-tag" type="text" placeholder="Digite uma tag e pressione Enter"><p class="ajuda">As tags são convertidas para minúsculas e duplicatas são ignoradas.</p><div id="tags-adicionadas"></div></div><div class="acoes"><button class="botao primario">Salvar ${isDeck ? "baralho" : "cartão"}</button></div></form>`;
  if (editing) {
    app.querySelector("#nome").value = entity.name ?? entity.front;
    if (!isDeck) app.querySelector("#verso").value = entity.back;
  }
  const input = app.querySelector("#nova-tag");
  const drawTags = () => { app.querySelector("#tags-adicionadas").innerHTML = badgeList(current, true); app.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => { current.splice(current.indexOf(button.dataset.remove), 1); drawTags(); })); };
  drawTags();
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const tag = input.value.trim().toLowerCase(); if (tag && !current.includes(tag)) current.push(tag); input.value = ""; drawTags(); } });
  app.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); const tags = [...current]; if (isDeck) { if (editing) { entity.name = app.querySelector("#nome").value; entity.tags = tags; } else decks.push({ id: Date.now(), name: app.querySelector("#nome").value, tags }); } else if (editing) { entity.front = app.querySelector("#nome").value; entity.back = app.querySelector("#verso").value; entity.tags = tags; } else cards.push({ id: Date.now(), deck: 1, front: app.querySelector("#nome").value, back: app.querySelector("#verso").value, tags }); page = editing ? "detalhe" : (isDeck ? "baralhos" : "cartoes"); query = ""; render(); });
}
document.querySelectorAll("nav [data-page]").forEach((button) => button.addEventListener("click", () => { page = button.dataset.page; query = ""; render(); }));
document.addEventListener("click", (event) => { const button = event.target.closest("[data-page]"); if (button && !button.closest("nav")) { page = button.dataset.page; query = ""; render(); } });
render();
