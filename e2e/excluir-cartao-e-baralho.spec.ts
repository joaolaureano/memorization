import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  aguardarApiPronta,
  aguardarProntidao,
  cabecalhoDeCredencial,
  criarBaralhoPelaApi,
  criarCartaoNoBaralhoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  listarCartoesPelaApi,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

test.setTimeout(120_000);

test("exclusões contextuais removem Cartões em cascata e preservam Histórico", async ({ page }) => {
  const pasta = await criarPastaTemporaria("exclusao-025-");
  const arquivo = join(pasta, "acervo.sqlite");
  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();
    api = iniciarApi(arquivo, portaDaApi);
    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;
    await aguardarApiPronta(api, enderecoDaApi);
    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;
    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);
    await aguardarProntidao(frontend, enderecoDoFrontend, (resposta) => resposta.ok);

    const credencial = await criarUsuarioDeProva(enderecoDaApi);
    const origem = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Inglês" });
    const outro = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Espanhol" });
    const primeiro = await criarCartaoNoBaralhoPelaApi(enderecoDaApi, origem.id, {
      frente: "To walk", verso: "Caminhar",
    });
    const segundo = await criarCartaoNoBaralhoPelaApi(enderecoDaApi, origem.id, {
      frente: "To run", verso: "Correr",
    });
    const independente = await criarCartaoNoBaralhoPelaApi(enderecoDaApi, outro.id, {
      frente: "Hola", verso: "Olá",
    });

    const sessaoId = randomUUID();
    const registro = await fetch(`${enderecoDaApi}/sessoes`, {
      method: "POST",
      headers: { "content-type": "application/json", ...cabecalhoDeCredencial(credencial) },
      body: JSON.stringify({
        id: sessaoId, origem: "baralho", baralhoId: origem.id,
        nomeDoBaralho: "Inglês",
        itens: [{ frente: primeiro.frente, verso: primeiro.verso,
          cartaoId: primeiro.id, avaliacao: "bom" }],
      }),
    });
    expect(registro.status).toBe(201);

    await page.goto(enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${origem.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Inglês" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Cartões" })).toHaveCount(0);
    await page.goto(`${enderecoDoFrontend}/#/cartoes`);
    await expect(page.getByRole("heading", { level: 1, name: "Cartões" })).toHaveCount(0);
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${origem.id}`);

    await page.getByRole("button", { name: "Excluir To run" }).click();
    const dialogoDoCartao = page.getByRole("dialog");
    await expect(dialogoDoCartao).toContainText("To run");
    await dialogoDoCartao.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("To run", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Excluir To run" }).click();
    await dialogoDoCartao.getByRole("button", { name: "Excluir Cartão" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("To run", { exact: true })).toHaveCount(0);
    expect((await listarCartoesPelaApi(enderecoDaApi)).map((cartao) => cartao.id))
      .not.toContain(segundo.id);

    await page.getByRole("button", { name: "Excluir Baralho" }).click();
    const dialogoDoBaralho = page.getByRole("dialog");
    await expect(dialogoDoBaralho).toContainText("1 Cartão");
    await dialogoDoBaralho.getByRole("button", { name: "Excluir Baralho" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Baralhos" })).toBeVisible();

    const restantes = await listarCartoesPelaApi(enderecoDaApi);
    expect(restantes.map((cartao) => cartao.id)).toEqual([independente.id]);
    const historico = await fetch(`${enderecoDaApi}/sessoes/${sessaoId}`, {
      headers: cabecalhoDeCredencial(credencial),
    });
    expect(historico.status).toBe(200);
    const corpo = await historico.json() as { baralhoExiste: boolean; registro: { itens: { frente: string }[] } };
    expect(corpo.baralhoExiste).toBe(false);
    expect(corpo.registro.itens[0].frente).toBe("To walk");
  } finally {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});
