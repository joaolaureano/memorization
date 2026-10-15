import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  aguardarApiPronta,
  aguardarProntidao,
  aplicarZoomDeProva,
  criarBaralhoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

/**
 * T044, T048 — o Cartão com Imagem de ponta a ponta no modo local (026):
 * criar só por teclado, recarregar, estudar, trocar e excluir a Imagem, nas
 * larguras de 360 a 1440 px e com zoom de 200%, e o tempo de exibição da
 * Imagem com a rede limitada (SC-172).
 */

test.setTimeout(240_000);

/** PNG com assinatura válida e `tamanho` bytes (chunk privado de preenchimento). */
function png(tamanho = 2048): Buffer {
  const crc = (bytes: Buffer): number => {
    let c = 0xffffffff;
    for (const byte of bytes) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo: string, dados: Buffer): Buffer => {
    const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
    const tamanhoDoChunk = Buffer.alloc(4);
    tamanhoDoChunk.writeUInt32BE(dados.length);
    const soma = Buffer.alloc(4);
    soma.writeUInt32BE(crc(corpo));
    return Buffer.concat([tamanhoDoChunk, corpo, soma]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const base = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", Buffer.from([0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00])),
  ]);
  const fim = chunk("IEND", Buffer.alloc(0));
  const preenchimento = Math.max(0, tamanho - base.length - fim.length - 12);
  return Buffer.concat([base, chunk("prVt", Buffer.alloc(preenchimento)), fim]);
}

/**
 * PNG RGB de `largura` × `altura` com três faixas horizontais (como uma bandeira),
 * sem compressão: a proporção não é quadrada, para pegar corte ou distorção.
 */
function pngDeFaixas(largura: number, altura: number): Buffer {
  const crc = (bytes: Buffer): number => {
    let c = 0xffffffff;
    for (const byte of bytes) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo: string, dados: Buffer): Buffer => {
    const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(dados.length);
    const soma = Buffer.alloc(4);
    soma.writeUInt32BE(crc(corpo));
    return Buffer.concat([tamanho, corpo, soma]);
  };

  const cores = [
    [0, 0, 0],
    [221, 0, 0],
    [255, 206, 0],
  ];
  const linhaBytes = 1 + largura * 3;
  const pixels = Buffer.alloc(altura * linhaBytes);
  for (let y = 0; y < altura; y++) {
    const inicio = y * linhaBytes;
    const cor = cores[Math.floor((y * cores.length) / altura)];
    for (let x = 0; x < largura; x++) pixels.set(cor, inicio + 1 + x * 3);
  }

  // zlib com blocos "stored" (sem compressão), o único formato que se monta à mão.
  const blocos: Buffer[] = [Buffer.from([0x78, 0x01])];
  for (let i = 0; i < pixels.length; i += 65535) {
    const pedaco = pixels.subarray(i, Math.min(i + 65535, pixels.length));
    const cabecalho = Buffer.alloc(5);
    cabecalho[0] = i + 65535 >= pixels.length ? 1 : 0;
    cabecalho.writeUInt16LE(pedaco.length, 1);
    cabecalho.writeUInt16LE(~pedaco.length & 0xffff, 3);
    blocos.push(cabecalho, pedaco);
  }
  let somaA = 1;
  let somaB = 0;
  for (const byte of pixels) {
    somaA = (somaA + byte) % 65521;
    somaB = (somaB + somaA) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE(((somaB << 16) | somaA) >>> 0);
  blocos.push(adler);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", Buffer.concat(blocos)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * A Imagem renderizada é inteira e não distorcida: a proporção da caixa é a
 * natural (2%), a caixa cabe dentro de todo ancestral com corte (overflow) e
 * dentro da janela. `seletor` aponta a Imagem; `contenedor`, se houver, a área
 * que a contém (o Cartão de estudo).
 */
async function aferirImagem(page: Page, seletor: string, rotulo: string, contenedor?: string): Promise<void> {
  const imagem = page.locator(seletor).first();
  await expect(imagem, rotulo).toBeVisible();
  await expect
    .poll(() => imagem.evaluate((el) => (el as HTMLImageElement).naturalWidth), { message: rotulo })
    .toBeGreaterThan(0);

  const natural = await imagem.evaluate(
    (el) => (el as HTMLImageElement).naturalWidth / (el as HTMLImageElement).naturalHeight,
  );
  const caixa = await imagem.boundingBox();
  expect(caixa, rotulo).not.toBeNull();
  const proporcao = caixa!.width / caixa!.height;
  expect.soft(Math.abs(proporcao / natural - 1), `${rotulo}: proporção da caixa`).toBeLessThanOrEqual(0.02);

  const cortes = await imagem.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cortados: string[] = [];
    for (let ancestral = el.parentElement; ancestral && ancestral !== document.body; ancestral = ancestral.parentElement) {
      const estilo = getComputedStyle(ancestral);
      if (estilo.overflowX === "visible" && estilo.overflowY === "visible") continue;
      const q = ancestral.getBoundingClientRect();
      if (r.left < q.left - 1 || r.right > q.right + 1 || r.top < q.top - 1 || r.bottom > q.bottom + 1) {
        cortados.push(ancestral.className || ancestral.tagName);
      }
    }
    return cortados;
  });
  expect.soft(cortes, `${rotulo}: ancestral corta a Imagem`).toEqual([]);

  const janela = await page.evaluate(() => document.documentElement.clientWidth);
  expect.soft(caixa!.x >= 0 && caixa!.x + caixa!.width <= janela, `${rotulo}: Imagem dentro da janela`).toBe(true);

  if (contenedor !== undefined) {
    const caixaDoContenedor = await page.locator(contenedor).first().boundingBox();
    expect(caixaDoContenedor, rotulo).not.toBeNull();
    const c = caixaDoContenedor!;
    expect.soft(
      caixa!.x >= c.x - 1 &&
        caixa!.x + caixa!.width <= c.x + c.width + 1 &&
        caixa!.y >= c.y - 1 &&
        caixa!.y + caixa!.height <= c.y + c.height + 1,
      `${rotulo}: Imagem dentro do Cartão`,
    ).toBe(true);
  }
}

/** Sai da Sessão em andamento pelo caminho da interface, com a confirmação. */
async function interromperSessao(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Interromper" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Interromper" }).click();
}

async function semRolagemHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
      document.documentElement.clientWidth,
  );
}

/**
 * Verso revelado de um Cartão com Imagem e Frente sem texto: o Verso fica abaixo
 * do rótulo "Verso" e da Imagem, na coluna da Face (não ao lado dela), e os
 * botões de Avaliação têm alvo de 44 px e largura de 60 px.
 */
async function aferirVersoRevelado(page: Page, rotulo: string, textoDoVerso: string): Promise<void> {
  const cartao = page.locator(".cartao-de-estudo");
  const verso = cartao.getByText(textoDoVerso, { exact: true });
  const tituloDoVerso = cartao.getByRole("heading", { level: 2, name: "Verso", exact: true });
  const face = cartao.locator(".conteudo-do-cartao--imagem");
  const imagem = face.locator("img").first();

  await expect(verso, rotulo).toBeVisible();
  const caixaDoVerso = await verso.boundingBox();
  const caixaDoTitulo = await tituloDoVerso.boundingBox();
  const caixaDaFace = await face.boundingBox();
  const caixaDaImagem = await imagem.boundingBox();
  expect(caixaDoVerso, rotulo).not.toBeNull();
  expect(caixaDoTitulo, rotulo).not.toBeNull();
  expect(caixaDaFace, rotulo).not.toBeNull();
  expect(caixaDaImagem, rotulo).not.toBeNull();
  const v = caixaDoVerso!;
  const t = caixaDoTitulo!;
  const f = caixaDaFace!;
  const m = caixaDaImagem!;

  expect.soft(v.y, `${rotulo}: Verso abaixo do rótulo Verso`).toBeGreaterThanOrEqual(t.y + t.height);
  expect.soft(v.y, `${rotulo}: Verso abaixo da Imagem`).toBeGreaterThanOrEqual(m.y + m.height);
  expect.soft(Math.abs(v.x - f.x), `${rotulo}: Verso na coluna da Face`).toBeLessThanOrEqual(1);
  expect.soft(
    v.x < m.x + m.width && m.x < v.x + v.width,
    `${rotulo}: Verso e Imagem com faixas horizontais sobrepostas`,
  ).toBe(true);

  const botoes = cartao.locator(".botoes-de-resultado .botao");
  await expect(botoes, rotulo).toHaveCount(4);
  for (let indice = 0; indice < 4; indice++) {
    const caixa = await botoes.nth(indice).boundingBox();
    expect(caixa, `${rotulo}: botão ${indice + 1}`).not.toBeNull();
    expect.soft(caixa!.height, `${rotulo}: altura do botão ${indice + 1}`).toBeGreaterThanOrEqual(44);
    expect.soft(caixa!.width, `${rotulo}: largura do botão ${indice + 1}`).toBeGreaterThanOrEqual(60);
    const estourado = await botoes.nth(indice).evaluate((el) => el.scrollWidth > el.clientWidth);
    expect.soft(estourado, `${rotulo}: texto do botão ${indice + 1} cabe`).toBe(false);
  }
}

test("028 (layout): Verso revelado de Imagem sem texto na Frente fica abaixo da Face em 390 e 1280 px", async ({ page }) => {
  const pasta = await criarPastaTemporaria("cartao-com-imagem-026-verso-");
  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();
    api = iniciarApi(join(pasta, "acervo.sqlite"), portaDaApi);
    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;
    await aguardarApiPronta(api, enderecoDaApi);
    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;
    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);
    await aguardarProntidao(frontend, enderecoDoFrontend, (resposta) => resposta.ok);

    const credencial = await criarUsuarioDeProva(enderecoDaApi);
    const baralho = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Verso de imagem" });

    await page.goto(enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}/cartoes/novo`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}/cartoes/novo`);
    await page.getByLabel("Tipo de cartão").selectOption("imagem");
    await page.getByLabel("Imagem", { exact: true }).setInputFiles({
      name: "bandeira.png",
      mimeType: "image/png",
      buffer: pngDeFaixas(300, 180),
    });
    await expect(page.getByRole("button", { name: "Remover imagem" })).toBeVisible();
    await aferirImagem(page, ".previa-da-imagem img", "formulário 390px");
    await page.setViewportSize({ width: 1280, height: 844 });
    await aferirImagem(page, ".previa-da-imagem img", "formulário 1280px");
    await page.getByLabel("Descrição da imagem (opcional)").fill("Imagem sem texto na frente");
    await page.getByLabel("Verso").fill("Verso sem texto");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Verso de imagem" })).toBeVisible();

    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: 844 });
      await aferirImagem(page, ".linha-da-lista__texto--imagem img", `lista ${largura}px`);
    }

    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}/estudo`);
    await page.getByRole("button", { name: "Todos os cartões" }).click();
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: 844 });
      await aferirImagem(page, ".cartao-de-estudo .conteudo-do-cartao--imagem img", `face antes ${largura}px`, ".cartao-de-estudo");
    }

    await page.getByRole("button", { name: "Revelar verso" }).click();
    await expect(page.locator(".cartao-de-estudo").getByText("Verso sem texto", { exact: true })).toBeVisible();

    for (const largura of [390, 1280]) {
      const rotulo = `${largura}px`;
      await page.setViewportSize({ width: largura, height: 844 });
      await aferirImagem(page, ".cartao-de-estudo .conteudo-do-cartao--imagem img", `face depois ${rotulo}`, ".cartao-de-estudo");
      await aferirVersoRevelado(page, rotulo, "Verso sem texto");
      const rolagem = await page.evaluate(
        () =>
          Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
          document.documentElement.clientWidth,
      );
      expect.soft(rolagem, `${rotulo}: sem rolagem horizontal`).toBeLessThanOrEqual(0);
    }
  } finally {
    if (frontend !== null) await encerrarProcesso(frontend);
    if (api !== null) await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});

test("Cartão com Imagem: criar por teclado, estudar, trocar e excluir", async ({ page }) => {
  const pasta = await criarPastaTemporaria("cartao-com-imagem-026-");
  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();
    api = iniciarApi(join(pasta, "acervo.sqlite"), portaDaApi);
    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;
    await aguardarApiPronta(api, enderecoDaApi);
    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;
    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);
    await aguardarProntidao(frontend, enderecoDoFrontend, (resposta) => resposta.ok);

    const credencial = await criarUsuarioDeProva(enderecoDaApi);
    const baralho = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Geografia" });

    await page.goto(enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}/cartoes/novo`);

    // Só teclado: o seletor começa em Frente-Verso e muda para Imagem.
    const seletor = page.getByLabel("Tipo de cartão");
    await expect(seletor).toHaveValue("frente-verso");
    await seletor.focus();
    // Digitar a inicial escolhe a opção no seletor fechado em qualquer sistema;
    // a seta, no macOS, abre a lista em vez de escolher.
    await page.keyboard.press("i");
    await expect(seletor).toHaveValue("imagem");
    await expect(page.getByText("Campos do tipo Imagem")).toBeAttached();

    // O seletor de arquivo do sistema não é acessível ao Playwright: o arquivo
    // entra pelo próprio campo, e o resto do percurso segue pelo teclado.
    await page.getByLabel("Imagem", { exact: true }).setInputFiles({
      name: "estado.png",
      mimeType: "image/png",
      buffer: png(),
    });
    await expect(page.getByRole("button", { name: "Remover imagem" })).toBeVisible();
    await page.getByLabel("Descrição da imagem (opcional)").focus();
    await page.keyboard.type("Mapa com um estado destacado");
    await page.getByLabel("Verso").focus();
    await page.keyboard.type("Pernambuco");
    await page.getByRole("button", { name: "Salvar" }).focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { level: 1, name: "Geografia" })).toBeVisible();
    const miniatura = page.getByRole("img", { name: "Mapa com um estado destacado" });
    await expect(miniatura).toBeVisible();
    await expect.poll(() => miniatura.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByRole("region", { name: "Cartões do Baralho" }).getByText("Imagem", { exact: true })).toBeVisible();

    // Persiste ao recarregar.
    await page.reload();
    await expect(page.getByRole("img", { name: "Mapa com um estado destacado" })).toBeVisible();

    // Larguras e zoom de 200% sem rolagem horizontal, no Baralho e na Sessão.
    for (const [largura, zoom] of [[360, 1], [390, 1], [768, 1], [1440, 1], [720, 2]] as const) {
      await page.setViewportSize({ width: largura, height: 900 });
      await aplicarZoomDeProva(page, zoom);
      await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}`);
      await expect(page.getByRole("img", { name: "Mapa com um estado destacado" })).toBeVisible();
      expect(await semRolagemHorizontal(page)).toBeLessThanOrEqual(0);

      await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}/estudo`);
      await page.getByRole("button", { name: "Todos os cartões" }).click();
      const face = page.locator("article").getByRole("img", { name: "Mapa com um estado destacado" });
      await expect(face).toBeVisible();
      expect(await semRolagemHorizontal(page)).toBeLessThanOrEqual(0);
      const caixa = await face.boundingBox();
      expect(caixa!.width).toBeLessThanOrEqual(largura);
      await interromperSessao(page);
      await aplicarZoomDeProva(page, 1);
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    // Estudo: Imagem antes da revelação, Verso depois.
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}`);
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}/estudo`);
    await page.getByRole("button", { name: "Todos os cartões" }).click();
    await expect(page.locator("article").getByText("Pernambuco")).toHaveCount(0);
    await page.getByRole("button", { name: "Revelar verso" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("article").getByText("Pernambuco")).toBeVisible();
    await interromperSessao(page);

    // Trocar a Imagem pela edição: o endereço antigo deixa de servir.
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}`);
    const enderecoAntigo = await page
      .getByRole("img", { name: "Mapa com um estado destacado" })
      .getAttribute("src");
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page.getByText("Tipo: Imagem")).toBeVisible();
    await page.getByLabel("Imagem", { exact: true }).setInputFiles({
      name: "outro.png",
      mimeType: "image/png",
      buffer: png(4096),
    });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Geografia" })).toBeVisible();
    expect((await fetch(enderecoAntigo!)).status).toBe(404);

    // Excluir o Cartão: a Imagem deixa de servir (FR-421).
    const enderecoAtual = await page
      .getByRole("img", { name: "Mapa com um estado destacado" })
      .getAttribute("src");
    await page.getByRole("button", { name: "Excluir Mapa com um estado destacado" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Excluir Cartão" }).click();
    await expect(page.getByRole("img", { name: "Mapa com um estado destacado" })).toHaveCount(0);
    expect((await fetch(enderecoAtual!)).status).toBe(404);
  } finally {
    if (frontend !== null) await encerrarProcesso(frontend);
    if (api !== null) await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});

test("a Imagem de 5 MB aparece em até 2 s com 50 Mbps e 20 ms (SC-172)", async ({ page }) => {
  const pasta = await criarPastaTemporaria("cartao-com-imagem-tempo-026-");
  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();
    api = iniciarApi(join(pasta, "acervo.sqlite"), portaDaApi);
    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;
    await aguardarApiPronta(api, enderecoDaApi);
    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;
    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);
    await aguardarProntidao(frontend, enderecoDoFrontend, (resposta) => resposta.ok);

    const credencial = await criarUsuarioDeProva(enderecoDaApi);
    const baralho = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Tempo" });
    await page.goto(enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}/cartoes/novo`);
    await page.getByLabel("Tipo de cartão").selectOption("imagem");
    await page.getByLabel("Imagem", { exact: true }).setInputFiles({
      name: "grande.png",
      mimeType: "image/png",
      buffer: png(5_242_880),
    });
    await page.getByLabel("Verso").fill("Pernambuco");
    await page.getByRole("button", { name: "Salvar" }).click();
    const endereco = await page.getByRole("img", { name: "Imagem do Cartão" }).getAttribute("src");

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 20,
      downloadThroughput: (50 * 1_000_000) / 8,
      uploadThroughput: (50 * 1_000_000) / 8,
    });

    const tempos = await page.evaluate(async (url) => {
      const medidas: number[] = [];
      for (let i = 0; i < 20; i++) {
        const inicio = performance.now();
        await new Promise<void>((resolver, rejeitar) => {
          const imagem = new Image();
          imagem.onload = () => resolver();
          imagem.onerror = () => rejeitar(new Error("falhou"));
          // Um parâmetro a mais por medida, para não vir do cache.
          imagem.src = `${url}&medida=${i}`;
        });
        medidas.push(performance.now() - inicio);
      }
      return medidas;
    }, endereco!);

    expect(tempos.filter((tempo) => tempo <= 2000).length).toBeGreaterThanOrEqual(19);
  } finally {
    if (frontend !== null) await encerrarProcesso(frontend);
    if (api !== null) await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});
