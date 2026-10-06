import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

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
  iniciarApi,
  iniciarFrontend,
  lerVersaoDoEsquema,
  obterBaralhoPelaApi,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

test.setTimeout(180_000);

test("transição por usuário preserva a fonte legada e permite recuperar uma tentativa sem alterações parciais", async ({ page }) => {
  const pasta = await criarPastaTemporaria("transicao-cartoes-");
  const banco = join(pasta, "acervo.sqlite");
  const portaDaApi = await portaLivre();
  const portaDoFrontend = await portaLivre();
  const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;
  const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;
  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    api = iniciarApi(banco, portaDaApi);
    await aguardarApiPronta(api, enderecoDaApi);

    const ana = await criarUsuarioDeProva(enderecoDaApi, "ana.transicao");
    const bruno = await criarUsuarioDeProva(enderecoDaApi, "bruno.transicao");
    const ingles = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Inglês" }, ana);
    const viagem = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Viagem" }, ana);
    const espanhol = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Espanhol" }, bruno);
    const compartilhado = await criarCartaoNoBaralhoPelaApi(
      enderecoDaApi, ingles.id, { frente: "To travel", verso: "Viajar" }, ana,
    );
    const avulso = await criarCartaoNoBaralhoPelaApi(
      enderecoDaApi, ingles.id, { frente: "To read", verso: "Ler" }, ana,
    );
    await criarCartaoNoBaralhoPelaApi(
      enderecoDaApi, espanhol.id, { frente: "Hola", verso: "Olá" }, bruno,
    );

    await encerrarProcesso(api);
    api = null;

    // Reproduz uma base v13 com dois Cartões legados pendentes. Bruno já tem
    // Pertencimento; apenas Ana precisará escolher, e a tabela v3 é a fonte.
    const arquivo = new DatabaseSync(banco);
    try {
      arquivo.exec("PRAGMA foreign_keys = ON; BEGIN;");
      arquivo.exec(`CREATE TABLE vinculo (
        cartao_id TEXT NOT NULL REFERENCES cartao(id) ON DELETE CASCADE,
        baralho_id TEXT NOT NULL REFERENCES baralho(id) ON DELETE CASCADE,
        PRIMARY KEY (cartao_id, baralho_id)
      );`);
      arquivo.prepare("DELETE FROM pertencimento WHERE cartao_id IN (?, ?)")
        .run(compartilhado.id, avulso.id);
      const vincular = arquivo.prepare("INSERT INTO vinculo (cartao_id, baralho_id) VALUES (?, ?)");
      vincular.run(compartilhado.id, ingles.id);
      vincular.run(compartilhado.id, viagem.id);
      arquivo.prepare("UPDATE versao_do_esquema SET versao = 13").run();
      arquivo.exec("COMMIT;");
    } finally {
      arquivo.close();
    }

    api = iniciarApi(banco, portaDaApi);
    await aguardarApiPronta(api, enderecoDaApi);
    expect(lerVersaoDoEsquema(banco)).toBe(13);
    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);
    await aguardarProntidao(frontend, enderecoDoFrontend, (resposta) => resposta.ok);

    const transicaoDeBruno = await fetch(`${enderecoDaApi}/acervo/transicao-cartoes`, {
      headers: cabecalhoDeCredencial(bruno),
    });
    expect(transicaoDeBruno.status).toBe(200);
    expect((await transicaoDeBruno.json()).cartoes).toEqual([]);
    expect((await obterBaralhoPelaApi(enderecoDaApi, espanhol.id, bruno)).cartoes).toHaveLength(1);

    await page.goto(`${enderecoDoFrontend}/#/baralhos`);
    await page.getByLabel("Nome de usuário", { exact: true }).fill(ana.nomeDeUsuario);
    await page.getByLabel("Senha", { exact: true }).fill(ana.senha);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Organizar Cartões existentes" })).toBeVisible();
    await expect(page.getByLabel("To travel")).toBeVisible();
    await expect(page.getByLabel("To read")).toBeVisible();
    await expect(page.getByRole("link", { name: "Baralhos" })).toHaveCount(0);
    await page.getByLabel("To travel").selectOption(ingles.id);
    await page.getByLabel("To read").selectOption(viagem.id);

    await page.route(`${enderecoDaApi}/acervo/transicao-cartoes`, async (rota) => {
      if (rota.request().method() === "POST") {
        await rota.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ erro: "indisponivel" }) });
      } else {
        await rota.continue();
      }
    });
    await page.getByRole("button", { name: "Concluir organização" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("To travel")).toHaveValue(ingles.id);
    await expect(page.getByLabel("To read")).toHaveValue(viagem.id);
    await expect(page.getByRole("button", { name: "Concluir organização" })).toBeFocused();
    expect(lerVersaoDoEsquema(banco)).toBe(13);
    const antes = new DatabaseSync(banco);
    try {
      expect((antes.prepare("SELECT COUNT(*) AS total FROM vinculo").get() as { total: number }).total).toBe(2);
      expect((antes.prepare("SELECT COUNT(*) AS total FROM pertencimento WHERE cartao_id IN (?, ?)").get(compartilhado.id, avulso.id) as { total: number }).total).toBe(0);
    } finally {
      antes.close();
    }

    await page.unroute(`${enderecoDaApi}/acervo/transicao-cartoes`);
    await page.getByRole("button", { name: "Concluir organização" }).click();
    await expect(page.getByRole("heading", { name: "Organizar Cartões existentes" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Baralhos" })).toBeVisible();

    const baralhoIngles = await obterBaralhoPelaApi(enderecoDaApi, ingles.id, ana);
    const baralhoViagem = await obterBaralhoPelaApi(enderecoDaApi, viagem.id, ana);
    expect(baralhoIngles.cartoes).toHaveLength(1);
    expect(baralhoIngles.cartoes[0].id).toBe(compartilhado.id);
    expect(baralhoViagem.cartoes).toHaveLength(2);
    expect(baralhoViagem.cartoes.map((cartao) => cartao.frente).sort()).toEqual(["To read", "To travel"]);
    expect(baralhoViagem.cartoes.find((cartao) => cartao.frente === "To travel")?.id).not.toBe(compartilhado.id);
    expect((await obterBaralhoPelaApi(enderecoDaApi, espanhol.id, bruno)).cartoes).toHaveLength(1);

    await encerrarProcesso(api);
    api = null;
    api = iniciarApi(banco, portaDaApi);
    await aguardarApiPronta(api, enderecoDaApi);
    expect(lerVersaoDoEsquema(banco)).toBe(14);
    const final = new DatabaseSync(banco);
    try {
      expect(final.prepare("SELECT name FROM sqlite_master WHERE name = 'vinculo'").get()).toBeUndefined();
    } finally {
      final.close();
    }
  } finally {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});
