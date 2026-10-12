import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [360, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(pathToFileURL(resolve("design/tags/index.html")).href);
    await page.getByRole("button", { name: "Cartões" }).click();
    await page.getByLabel("matemática").check();
    await page.getByLabel("provas").check();
    if (await page.locator(".linha").count() !== 1) throw new Error(`filtro combinado falhou em ${width}px`);
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await page.getByRole("button", { name: "Criar cartão" }).click();
    await page.getByLabel("Frente").fill("Cartão novo");
    await page.getByLabel("Verso").fill("Resposta");
    await page.getByLabel("Tags").fill("  URGENTE  ");
    await page.getByLabel("Tags").press("Enter");
    if (!(await page.getByText("urgente").count())) throw new Error("normalização de tag falhou");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error(`rolagem horizontal em ${width}px`);
    await page.close();
  }
} finally {
  await browser.close();
}
