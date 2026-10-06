import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const capturas = new URL("./capturas/", import.meta.url);
await mkdir(capturas, { recursive: true });
const navegador = await chromium.launch();

try {
  const pagina = await navegador.newPage();
  const erros = [];
  pagina.on("pageerror", (erro) => erros.push(erro.message));
  await pagina.goto(new URL("./index.html", import.meta.url).href);

  for (const largura of [360, 390, 768, 1440]) {
    await pagina.setViewportSize({ width: largura, height: 960 });
    await expect(pagina.getByRole("heading", { name: "Baralhos", exact: true })).toBeVisible();
    if (await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Rolagem horizontal na lista: ${largura}`);
    await pagina.screenshot({ path: new URL(`baralhos-${largura}.png`, capturas).pathname, fullPage: true });

    await pagina.getByRole("button", { name: "Abrir Inglês cotidiano", exact: true }).click();
    await expect(pagina.getByRole("heading", { name: "Inglês cotidiano", exact: true })).toBeVisible();
    await expect(pagina.getByRole("link", { name: "Cartões", exact: true })).toHaveCount(0);
    await expect(pagina.locator("[data-cartao]")).toHaveCount(2);
    if (await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Rolagem horizontal no detalhe: ${largura}`);
    await pagina.screenshot({ path: new URL(`detalhe-${largura}.png`, capturas).pathname, fullPage: true });
    await pagina.getByRole("button", { name: "Criar Cartão", exact: true }).first().click();
    await expect(pagina.getByRole("heading", { name: "Criar Cartão", exact: true })).toBeVisible();
    if (await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Rolagem horizontal no formulário: ${largura}`);
    await pagina.screenshot({ path: new URL(`criar-${largura}.png`, capturas).pathname, fullPage: true });
    await pagina.getByRole("button", { name: "Cancelar", exact: true }).click();
    await pagina.getByRole("link", { name: "Baralhos", exact: true }).click();
    if (largura <= 600) {
      await pagina.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const sobrepoeNavegacao = await pagina.evaluate(() => {
        const navegacao = document.querySelector(".navegacao-principal").getBoundingClientRect();
        return ["#cenario", "#abrir-cenario", "#salvar-selecao"].some((seletor) => {
          const controle = document.querySelector(seletor).getBoundingClientRect();
          return controle.bottom > navegacao.top && controle.top < navegacao.bottom;
        });
      });
      if (sobrepoeNavegacao) throw new Error(`Controles do protótipo cobertos pela navegação: ${largura}`);
      if (largura === 390) {
        await pagina.screenshot({ path: new URL("rodape-390.png", capturas).pathname });
      }
    }
  }

  // Criação contextual e contador de Frente.
  await pagina.getByRole("button", { name: "Abrir Inglês cotidiano", exact: true }).click();
  await pagina.getByRole("button", { name: "Criar Cartão", exact: true }).first().click();
  await pagina.getByLabel("Frente", { exact: true }).fill("TO WALK");
  await pagina.getByLabel("Verso", { exact: true }).fill("Andar a pé");
  await pagina.getByRole("button", { name: "Criar Cartão", exact: true }).last().click();
  await expect(pagina.locator("[data-cartao]").filter({ hasText: "TO WALK (2)" })).toHaveCount(1);
  await expect(pagina.getByRole("status")).toContainText("TO WALK (2)");
  await expect(pagina.locator("[data-cartao]")).toHaveCount(3);

  // Edição com colisão é recusada e preserva o conteúdo digitado.
  await pagina.getByRole("button", { name: "Editar TO WALK (2)", exact: true }).click();
  await pagina.getByLabel("Frente", { exact: true }).fill("To walk");
  await pagina.getByLabel("Verso", { exact: true }).fill("Andar a pé");
  await pagina.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(pagina.getByRole("alert")).toContainText("já existe neste Baralho");
  await expect(pagina.getByLabel("Frente", { exact: true })).toHaveValue("To walk");

  // Exclusão de Cartão confirma a consequência e retorna foco ao detalhe.
  await pagina.getByRole("link", { name: "Baralhos", exact: true }).click();
  await pagina.getByRole("button", { name: "Abrir Inglês cotidiano", exact: true }).click();
  await pagina.getByRole("button", { name: "Excluir To walk", exact: true }).click();
  const dialogoCartao = pagina.getByRole("dialog", { name: "Excluir “To walk”?" });
  await expect(dialogoCartao).toBeVisible();
  await expect(dialogoCartao).toContainText("Agendamento");
  await expect(dialogoCartao.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await dialogoCartao.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialogoCartao).toBeHidden();

  // Estado vazio e exclusão do Baralho com contagem.
  await pagina.locator("#cenario").selectOption("vazio");
  await pagina.locator("#abrir-cenario").click();
  await expect(pagina.getByText("Este Baralho ainda não tem Cartões.")).toBeVisible();
  await pagina.getByRole("button", { name: "Excluir Baralho", exact: true }).click();
  await expect(pagina.getByRole("dialog")).toContainText("0 Cartões");
  await pagina.getByRole("button", { name: "Cancelar", exact: true }).click();

  // Transição: destino para Cartão avulso e escolha de dono para compartilhado.
  await pagina.locator("#cenario").selectOption("migracao");
  await pagina.locator("#abrir-cenario").click();
  await expect(pagina.getByRole("heading", { name: "Organizar Cartões", exact: true })).toBeVisible();
  await pagina.getByLabel("Baralho que manterá o Cartão original").selectOption("ingles");
  await pagina.getByLabel("Baralho de destino").selectOption("biologia");
  await pagina.screenshot({ path: new URL("transicao-1440.png", capturas).pathname, fullPage: true });
  await pagina.setViewportSize({ width: 390, height: 844 });
  if (await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Rolagem horizontal na transição 390");
  await pagina.screenshot({ path: new URL("transicao-390.png", capturas).pathname, fullPage: true });
  await pagina.setViewportSize({ width: 1440, height: 960 });
  await pagina.getByRole("button", { name: "Concluir transição", exact: true }).click();
  await expect(pagina.getByRole("heading", { name: "Baralhos", exact: true })).toBeVisible();
  await pagina.getByRole("button", { name: "Abrir Inglês cotidiano", exact: true }).click();
  await expect(pagina.locator("[data-cartao]").filter({ hasText: "To walk (2)" })).toHaveCount(1);
  await pagina.getByRole("link", { name: "Baralhos", exact: true }).click();
  await pagina.getByRole("button", { name: "Abrir Viagens", exact: true }).click();
  await expect(pagina.locator("[data-cartao]").filter({ hasText: "To walk" })).toHaveCount(1);

  // Salvar seleção cria cópias com Frentes únicas e preserva originais.
  await pagina.locator("#salvar-selecao").click();
  await expect(pagina.getByRole("heading", { name: "Minha seleção", exact: true })).toBeVisible();
  await expect(pagina.locator("[data-cartao]").filter({ hasText: "To walk (2)" })).toHaveCount(1);
  await pagina.getByRole("link", { name: "Baralhos", exact: true }).click();
  await pagina.getByRole("button", { name: "Abrir Inglês cotidiano", exact: true }).click();
  await expect(pagina.locator("[data-cartao]").filter({ hasText: "To walk" })).toHaveCount(1);

  // Falha transitória na transição preserva o formulário e permite nova tentativa.
  await pagina.locator("#cenario").selectOption("falha");
  await pagina.locator("#abrir-cenario").click();
  await pagina.getByLabel("Baralho que manterá o Cartão original").selectOption("ingles");
  await pagina.getByLabel("Baralho de destino").selectOption("biologia");
  await pagina.getByRole("button", { name: "Concluir transição", exact: true }).click();
  await expect(pagina.getByRole("alert")).toContainText("escolhas foram preservadas");
  await pagina.getByRole("button", { name: "Concluir transição", exact: true }).click();
  await expect(pagina.getByRole("heading", { name: "Baralhos", exact: true })).toBeVisible();

  if (erros.length) throw new Error(`Erros no protótipo: ${erros.join("; ")}`);
  console.log("Protótipo 025 verificado: criação, Frentes únicas, cópias, transição, exclusão e responsividade.");
} finally {
  await navegador.close();
}