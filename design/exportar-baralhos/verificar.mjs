import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch();
const falhas = [];
const erros = [];
let aprovados = 0;

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (error) => erros.push(error.message));
  const url = new URL("./index.html", import.meta.url).href;

  async function verificar(nome, fn) {
    try {
      await fn();
      aprovados += 1;
      console.log(`PASS ${nome}`);
    } catch (error) {
      falhas.push(nome);
      console.log(`FAIL ${nome}: ${error.message.split("\n")[0]}`);
    }
  }

  async function semRolagemHorizontal() {
    const { largura, visivel } = await page.evaluate(() => ({
      largura: document.scrollingElement.scrollWidth,
      visivel: document.scrollingElement.clientWidth,
    }));
    if (largura > visivel) throw new Error(`scrollWidth ${largura} > clientWidth ${visivel}`);
  }

  await page.goto(url);
  await verificar("Entrada de um Baralho e formato Anki pré-selecionado", async () => {
    await expect(page.getByRole("button", { name: "Um Baralho" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("radio", { name: "Pacote Anki (.apkg)" })).toBeChecked();
    await expect(page.locator("#resumo-principal")).toHaveText("1 Baralho · 12 Cartões");
  });

  await verificar("Vários Baralhos, Todos seleciona a lista e o resumo", async () => {
    await page.getByRole("button", { name: "Vários Baralhos" }).click();
    await page.getByRole("checkbox", { name: "Todos os Baralhos" }).check();
    await expect(page.locator(".baralho:checked")).toHaveCount(3);
    await expect(page.locator("#resumo-principal")).toHaveText("3 Baralhos · 14 Cartões");
  });

  await verificar("Desmarcar todos recusa confirmação e explica o motivo", async () => {
    await page.getByRole("checkbox", { name: "Todos os Baralhos" }).uncheck();
    await expect(page.getByRole("button", { name: "Exportar arquivo" })).toBeDisabled();
    await expect(page.locator("#motivo")).toHaveText("Marque ao menos um Baralho.");
  });

  await verificar("Teclado marca e desmarca uma escolha", async () => {
    const checkbox = page.getByRole("checkbox", { name: /Inglês/ });
    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
    await expect(page.locator("#resumo-principal")).toHaveText("1 Baralho · 12 Cartões");
  });

  await verificar("Falha e recusa são anunciadas; falha permite tentar de novo", async () => {
    await page.getByText("Demonstração de falha e recusa").click();
    await page.getByRole("button", { name: "Simular falha" }).click();
    await expect(page.getByRole("status")).toHaveText("Não foi possível gerar o arquivo. Tente de novo.");
    await page.getByRole("button", { name: "Simular limite excedido" }).click();
    await expect(page.getByRole("status")).toHaveText("Exportação acima do limite. Exporte os Baralhos em partes.");
  });

  await verificar("Gerando e arquivo pronto com download repetível", async () => {
    await page.getByRole("button", { name: "Um Baralho" }).click();
    await page.getByRole("button", { name: "Exportar arquivo" }).click();
    await expect(page.getByRole("status")).toHaveText("Gerando arquivo…");
    await expect(page.getByRole("button", { name: "Gerando arquivo…" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "Baixar de novo" })).toBeVisible();
  });

  await verificar("Mudança de idioma preserva a entrada e traduz os controles", async () => {
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("Export");
    await expect(page.getByRole("radio", { name: "Anki package (.apkg)" })).toBeChecked();
    await page.getByRole("button", { name: "ES", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("Exportar");
  });

  for (const largura of [360, 390, 768, 1440]) {
    await verificar(`Sem rolagem horizontal em ${largura} px`, async () => {
      await page.setViewportSize({ width: largura, height: 1000 });
      await page.goto(url);
      await page.getByRole("button", { name: "Vários Baralhos" }).click();
      await page.getByRole("checkbox", { name: "Todos os Baralhos" }).check();
      await semRolagemHorizontal();
    });
  }

  await verificar("Sem rolagem horizontal com zoom equivalente a 200%", async () => {
    await page.setViewportSize({ width: 640, height: 1000 });
    await page.goto(url);
    await page.getByRole("button", { name: "Vários Baralhos" }).click();
    await page.getByRole("checkbox", { name: "Todos os Baralhos" }).check();
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    await semRolagemHorizontal();
  });

  await verificar("Sem erros de script", async () => {
    if (erros.length) throw new Error(erros.join("\n"));
  });
} finally {
  await browser.close();
}

console.log(`\n${aprovados} aprovados, ${falhas.length} falhas`);
if (falhas.length) {
  console.log(`FALHOU: ${falhas.join("; ")}`);
  process.exit(1);
}
console.log("Protótipo Exportar Baralhos validado.");
