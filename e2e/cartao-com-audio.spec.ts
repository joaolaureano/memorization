import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  aplicarZoomDeProva,
  criarBaralhoPelaApi,
  criarCartaoNoBaralhoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

/**
 * 028 — Cartão com Áudio de ponta a ponta no modo local (T041, T048, T054,
 * T056, T057): criar só por teclado, recusar arquivo disfarçado, estudar com
 * tocador, filtrar e tocar um por vez, o tempo até o primeiro `playing` com
 * um WAV de 1 MB, trocar e excluir o Áudio (com a pasta local conferida),
 * trocar de idioma sem parar a reprodução e os layouts de 360 a 1440 px e de
 * 200% de zoom. API e frontend reais; WAV PCM 8 kHz mono 16 bits montado aqui.
 */

test.setTimeout(300_000);

declare global {
  interface Window {
    __medidas?: { clique?: number; tocando?: number };
  }
}

/** WAV PCM 8 kHz, mono, 16 bits, com um tom de `segundos` de duração. */
function wav(segundos: number): Buffer {
  return montarWav(Math.round(8000 * segundos));
}

/** WAV PCM com `bytes` no total (o cabeçalho de 44 bytes entra na conta). */
function wavDeTamanho(bytes: number): Buffer {
  return montarWav(Math.floor((bytes - 44) / 2));
}

function montarWav(amostras: number): Buffer {
  const taxa = 8000;
  const dados = Buffer.alloc(amostras * 2);
  for (let i = 0; i < amostras; i++) {
    dados.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / taxa) * 8000), i * 2);
  }
  const cabecalho = Buffer.alloc(44);
  cabecalho.write("RIFF", 0, "ascii");
  cabecalho.writeUInt32LE(36 + dados.length, 4);
  cabecalho.write("WAVE", 8, "ascii");
  cabecalho.write("fmt ", 12, "ascii");
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20); // PCM
  cabecalho.writeUInt16LE(1, 22); // mono
  cabecalho.writeUInt32LE(taxa, 24);
  cabecalho.writeUInt32LE(taxa * 2, 28);
  cabecalho.writeUInt16LE(2, 32);
  cabecalho.writeUInt16LE(16, 34);
  cabecalho.write("data", 36, "ascii");
  cabecalho.writeUInt32LE(dados.length, 40);
  return Buffer.concat([cabecalho, dados]);
}

interface Ambiente {
  pasta: string;
  enderecoDaApi: string;
  enderecoDoFrontend: string;
  encerrar: () => Promise<void>;
}

async function subirAmbiente(prefixo: string): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria(prefixo);
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

    const frontendIniciado = frontend;
    const apiIniciada = api;
    return {
      pasta,
      enderecoDaApi,
      enderecoDoFrontend,
      encerrar: async () => {
        await encerrarProcesso(frontendIniciado);
        await encerrarProcesso(apiIniciada);
        await removerPastaTemporaria(pasta);
      },
    };
  } catch (erro) {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
    throw erro;
  }
}

/** Arquivos (recursivo) numa pasta local; pasta inexistente é lista vazia. */
async function arquivosNaPasta(caminho: string): Promise<string[]> {
  try {
    const entradas = await readdir(caminho, { withFileTypes: true, recursive: true });
    return entradas.filter((entrada) => entrada.isFile()).map((entrada) => entrada.name);
  } catch {
    return [];
  }
}

/**
 * Cria um Cartão do tipo Áudio pela tela de criação (seleção do tipo e arquivo
 * pelo próprio campo, o resto pela interface).
 */
async function criarAudioNaUi(
  page: Page,
  enderecoDoFrontend: string,
  baralhoId: string,
  nomeDoBaralho: string,
  cartao: { arquivo: { name: string; buffer: Buffer }; mensagem?: string; verso: string },
): Promise<void> {
  await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralhoId}/cartoes/novo`);
  await page.getByLabel("Tipo de cartão").selectOption("audio");
  await page.getByLabel("Áudio", { exact: true }).setInputFiles(cartao.arquivo);
  await expect(page.getByText(cartao.arquivo.name, { exact: true })).toBeVisible();
  if (cartao.mensagem !== undefined) {
    await page.getByLabel("Mensagem (opcional)").fill(cartao.mensagem);
  }
  await page.getByLabel("Verso").fill(cartao.verso);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: nomeDoBaralho })).toBeVisible();
}

/** Sai da Sessão em andamento pelo caminho da interface, com a confirmação. */
async function interromperSessao(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Interromper" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Interromper" }).click();
}

async function escolherIdioma(page: Page, atual: string, opcao: string): Promise<void> {
  await page.getByRole("button", { name: atual }).click();
  await page.getByRole("menuitemradio", { name: opcao }).click();
}

async function semRolagemHorizontal(page: Page, rotulo: string): Promise<void> {
  const medidas = await page.evaluate(() => ({
    rolagem: document.scrollingElement?.scrollWidth ?? 0,
    largura: document.scrollingElement?.clientWidth ?? 0,
  }));
  expect.soft(medidas.rolagem, rotulo).toBeLessThanOrEqual(medidas.largura);
}

async function alvoDeAoMenos44(page: Page, seletor: string, rotulo: string): Promise<void> {
  await expect(page.locator(seletor).first(), rotulo).toBeVisible();
  const caixa = await page.locator(seletor).first().boundingBox();
  expect(caixa, rotulo).not.toBeNull();
  expect.soft(caixa!.width, rotulo).toBeGreaterThanOrEqual(44);
  expect.soft(caixa!.height, rotulo).toBeGreaterThanOrEqual(44);
}

test("T041: criar Cartão com Áudio só por teclado, ouvir, salvar e recarregar", async ({ page }) => {
  const ambiente = await subirAmbiente("cartao-com-audio-028-criar-");

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    const baralho = await criarBaralhoPelaApi(ambiente.enderecoDaApi, { nome: "Geografia" });

    await page.goto(ambiente.enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}`);

    // Interações contadas do Baralho até o Cartão salvo (SC-175): cada clique,
    // escolha de tipo, arquivo e Enter num controle. A digitação não conta, e
    // ouvir a pré-escuta é opcional e fica de fora.
    let interacoes = 0;

    await page.getByRole("link", { name: "Criar Cartão" }).first().click();
    interacoes += 1;

    const seletor = page.getByLabel("Tipo de cartão");
    await expect(seletor).toHaveValue("frente-verso");
    await seletor.focus();
    // Digitar a inicial escolhe a opção no seletor fechado (como o teste de
    // imagem); uma escolha de tipo, que a seta não faz com o seletor fechado.
    await page.keyboard.press("a");
    await expect(seletor).toHaveValue("audio");
    await expect(page.getByText("Campos do tipo Áudio")).toBeAttached();
    interacoes += 1;

    await page.getByLabel("Áudio", { exact: true }).setInputFiles({
      name: "frase.wav",
      mimeType: "audio/wav",
      buffer: wav(3),
    });
    interacoes += 1;

    // A pré-escuta aparece com o nome do arquivo e o botão Tocar.
    await expect(page.getByText("frase.wav", { exact: true })).toBeVisible();
    const tocar = page.getByRole("button", { name: "Tocar áudio", exact: true });
    await tocar.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Pausar áudio", exact: true })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Tocar áudio", exact: true })).toBeVisible();

    await page.getByLabel("Mensagem (opcional)").fill("Qual a capital?");
    await page.getByLabel("Verso").fill("Recife");
    await page.getByRole("button", { name: "Salvar" }).click();
    interacoes += 1;

    expect(interacoes).toBeLessThanOrEqual(6);

    const lista = page.getByRole("region", { name: "Cartões do Baralho" });
    await expect(lista.getByText("Áudio", { exact: true })).toBeVisible();
    await expect(lista.getByText("0:03", { exact: true })).toBeVisible();
    await expect(lista.getByText("Recife", { exact: true })).toBeVisible();

    // Persiste ao recarregar.
    await page.reload();
    const listaRecarregada = page.getByRole("region", { name: "Cartões do Baralho" });
    await expect(listaRecarregada.getByText("Áudio", { exact: true })).toBeVisible();
    await expect(listaRecarregada.getByText("0:03", { exact: true })).toBeVisible();
    await expect(listaRecarregada.getByText("Recife", { exact: true })).toBeVisible();
  } finally {
    await ambiente.encerrar();
  }
});

test("T041: arquivo .txt renomeado para .mp3 é recusado no Áudio e os demais campos ficam", async ({ page }) => {
  const ambiente = await subirAmbiente("cartao-com-audio-028-falso-");

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    const baralho = await criarBaralhoPelaApi(ambiente.enderecoDaApi, { nome: "Falsos" });

    await page.goto(ambiente.enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}/cartoes/novo`);
    await page.getByLabel("Tipo de cartão").selectOption("audio");
    await page.getByLabel("Áudio", { exact: true }).setInputFiles({
      name: "falso.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("isto e um texto, nao um audio\n"),
    });
    await page.getByLabel("Verso").fill("Verso que sobrevive");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.locator("#erro-do-audio")).toContainText("MP3, M4A, OGG, WebM ou WAV");
    await expect(page.getByLabel("Verso")).toHaveValue("Verso que sobrevive");
    await expect(page.getByRole("heading", { level: 1, name: "Falsos" })).toHaveCount(0);
  } finally {
    await ambiente.encerrar();
  }
});

test("T048: estudar Cartões com Áudio: tocar antes da revelação, seguir tocando, parar ao avançar e registrar o Tipo", async ({ page }) => {
  const ambiente = await subirAmbiente("cartao-com-audio-028-estudo-");

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    const baralho = await criarBaralhoPelaApi(ambiente.enderecoDaApi, { nome: "Estudo de áudio" });

    await page.goto(ambiente.enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await criarAudioNaUi(page, ambiente.enderecoDoFrontend, baralho.id, "Estudo de áudio", {
      arquivo: { name: "a.wav", buffer: wav(6) },
      mensagem: "Mensagem A",
      verso: "Verso A",
    });
    await criarAudioNaUi(page, ambiente.enderecoDoFrontend, baralho.id, "Estudo de áudio", {
      arquivo: { name: "b.wav", buffer: wav(6) },
      mensagem: "Mensagem B",
      verso: "Verso B",
    });

    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}/estudo`);
    await page.getByRole("button", { name: "Todos os cartões", exact: true }).click();

    // Antes da revelação: a Mensagem e o tocador, sem o Verso.
    const item = page.locator("article");
    await expect(item.getByRole("button", { name: "Tocar áudio", exact: true })).toBeVisible();
    await expect(item.getByText(/^Mensagem [AB]$/)).toBeVisible();
    await expect(item.getByText(/^Verso [AB]$/)).toHaveCount(0);

    // Tocar por teclado; revelar não pausa.
    await item.getByRole("button", { name: "Tocar áudio", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(item.getByRole("button", { name: "Pausar áudio", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Revelar verso" }).click();
    await expect(item.getByText(/^Verso [AB]$/)).toBeVisible();
    await expect(item.getByRole("button", { name: "Pausar áudio", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.querySelectorAll("audio").length)).toBeGreaterThan(0);

    // Avaliar: o próximo Cartão começa, e o Áudio anterior já não toca.
    await page.getByRole("button", { name: /^Bom/ }).click();
    await expect(page.getByRole("article", { name: "Item 2 de 2" })).toBeVisible();
    expect(
      await page.evaluate(() => [...document.querySelectorAll("audio")].every((audio) => audio.paused)),
    ).toBe(true);

    await page.getByRole("button", { name: "Revelar verso" }).click();
    await page.getByRole("button", { name: /^Bom/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Sessão concluída" })).toBeVisible();
    expect(
      await page.evaluate(() => [...document.querySelectorAll("audio")].every((audio) => audio.paused)),
    ).toBe(true);
    // Só sai da Sessão depois de o Registro ser confirmado.
    await expect(page.getByRole("status", { name: "Situação do registro da Sessão" })).toContainText("registrada");

    // O Histórico do Registro mostra o Tipo, e nunca o tocador.
    await page.goto(`${ambiente.enderecoDoFrontend}/#/estudo`);
    await page.locator('a[href^="#/sessoes/"]').first().click();
    await page.getByRole("button", { name: "Bom (2)", exact: true }).click();
    // Cada Cartão de áudio do grupo leva o selo do tipo.
    await expect(page.getByText("Cartão do tipo Áudio", { exact: true })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Tocar áudio", exact: true })).toHaveCount(0);
  } finally {
    await ambiente.encerrar();
  }
});

test("T048: filtro por Áudio mostra só os Cartões de áudio, e começar um pausa o anterior", async ({ page }) => {
  const ambiente = await subirAmbiente("cartao-com-audio-028-filtro-");

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    const baralho = await criarBaralhoPelaApi(ambiente.enderecoDaApi, { nome: "Misto" });
    await criarCartaoNoBaralhoPelaApi(
      ambiente.enderecoDaApi,
      baralho.id,
      { frente: "Capital de Pernambuco", verso: "Recife" },
      credencial,
    );

    await page.goto(ambiente.enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await criarAudioNaUi(page, ambiente.enderecoDoFrontend, baralho.id, "Misto", {
      arquivo: { name: "um.wav", buffer: wav(6) },
      mensagem: "Primeiro áudio",
      verso: "Um",
    });
    await criarAudioNaUi(page, ambiente.enderecoDoFrontend, baralho.id, "Misto", {
      arquivo: { name: "dois.wav", buffer: wav(6) },
      mensagem: "Segundo áudio",
      verso: "Dois",
    });

    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}`);
    const lista = page.getByRole("region", { name: "Cartões do Baralho" });
    await expect(lista.locator(".linha-da-lista")).toHaveCount(3);

    await page.getByLabel("Tipo de cartão").selectOption("audio");
    await expect(lista.locator(".linha-da-lista")).toHaveCount(2);
    await expect(lista.getByText("Capital de Pernambuco")).toHaveCount(0);
    await expect(lista.getByText("Áudio", { exact: true })).toHaveCount(2);

    const itens = lista.locator(".linha-da-lista");
    await expect(itens.nth(0).getByRole("button", { name: "Tocar áudio", exact: true })).toBeVisible();
    await itens.nth(0).getByRole("button", { name: "Tocar áudio", exact: true }).click();
    await expect(itens.nth(0).getByRole("button", { name: "Pausar áudio", exact: true })).toBeVisible();

    await expect(itens.nth(1).getByRole("button", { name: "Tocar áudio", exact: true })).toBeVisible();
    await itens.nth(1).getByRole("button", { name: "Tocar áudio", exact: true }).click();
    await expect(itens.nth(1).getByRole("button", { name: "Pausar áudio", exact: true })).toBeVisible();
    await expect(itens.nth(0).getByRole("button", { name: "Tocar áudio", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => [...document.querySelectorAll("audio")].filter((audio) => !audio.paused).length),
    ).toBe(1);
  } finally {
    await ambiente.encerrar();
  }
});

test("T048: um Áudio de 1 MB começa a tocar em até 2 s após o Tocar (SC-180, proxy local)", async ({ page }) => {
  // Proxy local do SC-180: a API e o frontend rodam na própria máquina e a rede
  // é limitada como no teste de imagem (SC-172): 50 Mbps e 20 ms. A medida de
  // produção é o cenário 15 do quickstart.
  const ambiente = await subirAmbiente("cartao-com-audio-028-tempo-");

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    const baralho = await criarBaralhoPelaApi(ambiente.enderecoDaApi, { nome: "Tempo de áudio" });

    await page.goto(ambiente.enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await criarAudioNaUi(page, ambiente.enderecoDoFrontend, baralho.id, "Tempo de áudio", {
      arquivo: { name: "grande.wav", buffer: wavDeTamanho(1_048_576) },
      verso: "Grande",
    });

    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}/estudo`);
    await page.getByRole("button", { name: "Todos os cartões", exact: true }).click();
    const botao = page.locator("article").getByRole("button", { name: "Tocar áudio", exact: true });
    await expect(botao).toBeVisible();

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 20,
      downloadThroughput: (50 * 1_000_000) / 8,
      uploadThroughput: (50 * 1_000_000) / 8,
    });

    await page.evaluate(() => {
      window.__medidas = {};
      document.addEventListener(
        "click",
        (evento) => {
          const alvo = evento.target as Element | null;
          if (alvo?.closest(".tocador__botao")) window.__medidas!.clique = performance.now();
        },
        { capture: true },
      );
      document.addEventListener(
        "playing",
        () => {
          window.__medidas!.tocando ??= performance.now();
        },
        { capture: true },
      );
    });

    await botao.click();
    await expect
      .poll(() => page.evaluate(() => window.__medidas?.tocando ?? null))
      .not.toBeNull();

    const medidas = await page.evaluate(() => window.__medidas ?? {});
    expect(medidas.clique).toBeDefined();
    expect(medidas.tocando! - medidas.clique!).toBeLessThanOrEqual(2000);
  } finally {
    await ambiente.encerrar();
  }
});

test("T054: trocar o Áudio muda a duração; excluir o Cartão remove o arquivo da pasta local", async ({ page }) => {
  const ambiente = await subirAmbiente("cartao-com-audio-028-manutencao-");
  const pastaDeAudios = join(ambiente.pasta, "imagens", "audios");

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    const baralho = await criarBaralhoPelaApi(ambiente.enderecoDaApi, { nome: "Manutenção" });

    await page.goto(ambiente.enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await criarAudioNaUi(page, ambiente.enderecoDoFrontend, baralho.id, "Manutenção", {
      arquivo: { name: "antigo.wav", buffer: wav(3) },
      mensagem: "Áudio a trocar",
      verso: "Verso fixo",
    });

    const lista = page.getByRole("region", { name: "Cartões do Baralho" });
    await expect(lista.getByText("0:03", { exact: true })).toBeVisible();
    await expect.poll(() => arquivosNaPasta(pastaDeAudios)).toHaveLength(1);

    // Trocar o Áudio por outro de 5 s pela edição.
    await page.getByRole("link", { name: "Editar", exact: true }).click();
    await expect(page.getByText("Tipo: Áudio")).toBeVisible();
    await page.getByLabel("Áudio", { exact: true }).setInputFiles({
      name: "novo.wav",
      mimeType: "audio/wav",
      buffer: wav(5),
    });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Manutenção" })).toBeVisible();

    const listaAposTroca = page.getByRole("region", { name: "Cartões do Baralho" });
    await expect(listaAposTroca.getByText("0:05", { exact: true })).toBeVisible();
    await expect(listaAposTroca.getByText("0:03", { exact: true })).toHaveCount(0);

    // Excluir o Cartão: o arquivo deixa a pasta local.
    await page.getByRole("button", { name: "Excluir Áudio a trocar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Excluir Cartão" }).click();
    await expect(page.getByRole("region", { name: "Cartões do Baralho" }).getByText("Verso fixo")).toHaveCount(0);
    await expect.poll(() => arquivosNaPasta(pastaDeAudios)).toHaveLength(0);
  } finally {
    await ambiente.encerrar();
  }
});

test("T056: trocar o idioma relabela o tocador e a duração, mantém a reprodução e o texto do Cartão", async ({ page, browser }) => {
  const ambiente = await subirAmbiente("cartao-com-audio-028-idioma-");

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    const baralho = await criarBaralhoPelaApi(ambiente.enderecoDaApi, { nome: "Idiomas" });

    await page.goto(ambiente.enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await criarAudioNaUi(page, ambiente.enderecoDoFrontend, baralho.id, "Idiomas", {
      arquivo: { name: "idioma.wav", buffer: wav(6) },
      mensagem: "Mensagem fixa",
      verso: "Verso fixo",
    });

    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}`);
    const lista = page.getByRole("region").filter({ has: page.getByRole("listitem") });
    const tocarNaLista = lista.getByRole("button", { name: "Tocar áudio", exact: true });
    await expect(tocarNaLista).toBeVisible();
    await tocarNaLista.click();
    await expect(lista.getByRole("button", { name: "Pausar áudio", exact: true })).toBeVisible();

    await escolherIdioma(page, "Idioma: Português", "EN English");
    await expect(lista.getByRole("button", { name: "Pause audio", exact: true })).toBeVisible();
    await expect(lista.getByText("Audio", { exact: true })).toBeVisible();
    await expect(lista.getByRole("img", { name: /^Duration: / })).toBeVisible();
    expect(await page.evaluate(() => document.querySelector("audio")!.paused)).toBe(false);
    await expect(lista.getByText("Mensagem fixa", { exact: true })).toBeVisible();
    await expect(lista.getByText("Verso fixo", { exact: true })).toBeVisible();

    await escolherIdioma(page, "Language: English", "ES Español");
    await expect(lista.getByRole("button", { name: "Pausar audio", exact: true })).toBeVisible();
    await expect(lista.getByText("Audio", { exact: true })).toBeVisible();
    await expect(lista.getByRole("img", { name: /^Duración: / })).toBeVisible();
    expect(await page.evaluate(() => document.querySelector("audio")!.paused)).toBe(false);
    await expect(lista.getByText("Mensagem fixa", { exact: true })).toBeVisible();
    await expect(lista.getByText("Verso fixo", { exact: true })).toBeVisible();

    // Recusa do servidor em outro contexto (idioma inicial PT): a mensagem
    // muda de idioma sem perder o Verso digitado.
    const contexto = await browser.newContext();
    try {
      const outra = await contexto.newPage();
      await outra.goto(ambiente.enderecoDoFrontend);
      await entrarSeNecessario(outra, credencial);
      await outra.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}/cartoes/novo`);
      await outra.getByLabel("Tipo de cartão").selectOption("audio");
      await outra.getByLabel("Áudio", { exact: true }).setInputFiles({
        name: "falso.mp3",
        mimeType: "audio/mpeg",
        buffer: Buffer.from("texto disfarcado\n"),
      });
      await outra.getByLabel("Verso").fill("Verso digitado");
      await outra.getByRole("button", { name: "Salvar" }).click();
      await expect(outra.locator("#erro-do-audio")).toContainText("MP3, M4A, OGG, WebM ou WAV");

      await escolherIdioma(outra, "Idioma: Português", "EN English");
      await expect(outra.locator("#erro-do-audio")).toContainText("MP3, M4A, OGG, WebM or WAV");
      await expect(outra.getByLabel("Back")).toHaveValue("Verso digitado");
    } finally {
      await contexto.close();
    }
  } finally {
    await ambiente.encerrar();
  }
});

test("T057: formulário, lista e estudo com Áudio sem rolagem horizontal e com alvos de 44 px", async ({ page }) => {
  test.setTimeout(420_000);
  const ambiente = await subirAmbiente("cartao-com-audio-028-layout-");

  try {
    const credencial = await criarUsuarioDeProva(ambiente.enderecoDaApi);
    const baralho = await criarBaralhoPelaApi(ambiente.enderecoDaApi, { nome: "Layout de áudio" });

    await page.goto(ambiente.enderecoDoFrontend);
    await entrarSeNecessario(page, credencial);
    await criarAudioNaUi(page, ambiente.enderecoDoFrontend, baralho.id, "Layout de áudio", {
      arquivo: { name: "layout-de-audio-com-nome-longo-para-quebrar-a-linha.wav", buffer: wav(3) },
      mensagem: "Mensagem de layout com um pouco mais de texto para ocupar a linha",
      verso: "Verso de layout",
    });

    for (const [largura, zoom] of [[360, 1], [390, 1], [768, 1], [1440, 1], [1280, 2]] as const) {
      const rotulo = `${largura}px zoom ${zoom}`;
      await page.setViewportSize({ width: largura, height: 844 });

      // Formulário com o Áudio escolhido.
      await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}/cartoes/novo`);
      await aplicarZoomDeProva(page, zoom);
      await page.getByLabel("Tipo de cartão").selectOption("audio");
      await page.getByLabel("Áudio", { exact: true }).setInputFiles({
        name: "pre-escuta-com-nome-longo-para-quebrar-a-linha.wav",
        mimeType: "audio/wav",
        buffer: wav(3),
      });
      await expect(page.getByRole("button", { name: "Tocar áudio", exact: true })).toBeVisible();
      await semRolagemHorizontal(page, `formulário ${rotulo}`);
      await alvoDeAoMenos44(page, ".previa-do-audio .tocador__botao", `formulário ${rotulo}`);
      // Sair com o arquivo escolhido pede para descartá-lo.
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("button", { name: "Descartar", exact: true })).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Descartar", exact: true }).click();

      // Lista do Baralho.
      await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}`);
      await expect(page.getByRole("region", { name: "Cartões do Baralho" }).getByText("Verso de layout")).toBeVisible();
      await semRolagemHorizontal(page, `lista ${rotulo}`);
      await alvoDeAoMenos44(page, ".linha-da-lista .tocador__botao", `lista ${rotulo}`);

      // Estudo: o tocador da Face.
      await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}/estudo`);
      await page.getByRole("button", { name: "Todos os cartões", exact: true }).click();
      await expect(page.locator("article").getByRole("button", { name: "Tocar áudio", exact: true })).toBeVisible();
      await semRolagemHorizontal(page, `estudo ${rotulo}`);
      await alvoDeAoMenos44(page, "article .tocador__botao", `estudo ${rotulo}`);

      await interromperSessao(page);
      await aplicarZoomDeProva(page, 1);
    }
  } finally {
    await ambiente.encerrar();
  }
});
