// T2312 — prova E2E real do Baralho temporário (spec 023; SC-143–SC-146, SC-149; FR-367, FR-376)

import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  cabecalhoDeCredencial,
  criarBaralhoPelaApi,
  criarCartaoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarSeNecessario,
  iniciarApi,
  iniciarFrontend,
  portaLivre,
  removerPastaTemporaria,
  vincularCartaoPelaApi,
  AMBIENTE_COM_RELOGIO_FIXO,
  fixarRelogioDoContexto,
} from "./servidores-locais";
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

test.setTimeout(240_000);

// O dia de «hoje» é o mesmo na API e no navegador, e não o da máquina que roda.
test.beforeEach(async ({ context }) => {
  await fixarRelogioDoContexto(context);
});

/** As quatro frentes semeadas em toda a suíte. */
const FRENTES = ["How are you?", "Good morning", "Thank you", "See you"] as const;

interface Ambiente {
  pasta: string;
  api: ProcessoIniciado;
  frontend: ProcessoIniciado;
  enderecoDaApi: string;
  enderecoDoFrontend: string;
}

async function subirAmbiente(): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria("baralho-temporario-");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(
      join(pasta, "baralho-temporario.sqlite"),
      portaDaApi,
      AMBIENTE_COM_RELOGIO_FIXO,
    );

    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

    await aguardarApiPronta(api, enderecoDaApi);

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    return { pasta, api, frontend, enderecoDaApi, enderecoDoFrontend };
  } catch (erro) {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
    throw erro;
  }
}

/** Encerra os dois processos e remove o arquivo e a pasta temporários. */
async function derrubarAmbiente(ambiente: Ambiente): Promise<void> {
  await encerrarProcesso(ambiente.frontend);
  await encerrarProcesso(ambiente.api);
  await removerPastaTemporaria(ambiente.pasta);
}

interface CartaoSemeado {
  id: string;
  frente: string;
  verso: string;
}

/** Cria um Cartão avulso pela API real. */
async function prepararCartao(
  ambiente: Ambiente,
  credencial: CredencialDeProva,
  frente: string,
  verso: string,
): Promise<CartaoSemeado> {
  const criado = await criarCartaoPelaApi(
    ambiente.enderecoDaApi,
    { frente, verso },
    credencial,
  );

  return { id: criado.id, frente: criado.frente, verso: criado.verso };
}

/** Cria um Baralho e vincula Cartões já semeados, pela API real. */
async function prepararBaralho(
  ambiente: Ambiente,
  credencial: CredencialDeProva,
  nome: string,
  cartoes: CartaoSemeado[],
): Promise<{ id: string; nome: string }> {
  const baralho = await criarBaralhoPelaApi(
    ambiente.enderecoDaApi,
    { nome },
    credencial,
  );

  for (const cartao of cartoes) {
    await vincularCartaoPelaApi(
      ambiente.enderecoDaApi,
      cartao.id,
      baralho.id,
      credencial,
    );
  }

  return { id: baralho.id, nome: baralho.nome };
}

/** Exclui um Cartão pela API real (FR-367). */
async function excluirCartaoPelaApi(
  enderecoDaApi: string,
  id: string,
  credencial: CredencialDeProva,
): Promise<number> {
  const resposta = await fetch(`${enderecoDaApi}/cartoes/${id}`, {
    method: "DELETE",
    headers: cabecalhoDeCredencial(credencial),
  });

  return resposta.status;
}

/** Abre uma rota do frontend e Entra se necessário. */
async function abrirTela(
  page: Page,
  ambiente: Ambiente,
  rota: string,
  credencial: CredencialDeProva,
): Promise<void> {
  await page.goto(`${ambiente.enderecoDoFrontend}/#/${rota}`);
  await entrarSeNecessario(page, credencial);
}

/** Item da lista de Baralhos cujo nome é exatamente `nome`. */
function itemDeBaralho(page: Page, nome: string) {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByText(nome, { exact: true }) });
}

/** A região com a contagem da Seleção do estudo. */
function selecaoDoEstudo(page: Page) {
  return page.getByRole("region", { name: "Seleção do estudo" });
}

test("Temporário: A + B + C4 rendem «4 Cartões», o estudo vira Baralho salvo (SC-143–SC-146)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.temporario",
    );

    const c1 = await prepararCartao(ambiente, credencial, FRENTES[0], "Como você está?");
    const c2 = await prepararCartao(ambiente, credencial, FRENTES[1], "Bom dia");
    const c3 = await prepararCartao(ambiente, credencial, FRENTES[2], "Obrigado");
    await prepararCartao(ambiente, credencial, FRENTES[3], "Até logo");

    await prepararBaralho(ambiente, credencial, "Inglês", [c1, c2]);
    await prepararBaralho(ambiente, credencial, "Viagem", [c2, c3]);

    await abrirTela(page, ambiente, "baralhos", credencial);

    await page
      .getByRole("link", { name: "Criar baralho temporário", exact: true })
      .click();

    await expect(page).toHaveURL(/#\/baralhos\/temporario$/);
    await expect(
      page.getByRole("heading", { name: "Criar baralho temporário" }),
    ).toBeVisible();

    // C1 + C2 (A) e C2 + C3 (B): C2 não duplica.
    await page.getByRole("button", { name: "Adicionar Inglês", exact: true }).click();
    await page.getByRole("button", { name: "Adicionar Viagem", exact: true }).click();

    // C4 é um Cartão avulso, adicionado pela fonte «Cartões».
    await page.getByRole("button", { name: "Adicionar cartões", exact: true }).click();
    await page.getByRole("button", { name: "Adicionar See you", exact: true }).click();

    await expect(selecaoDoEstudo(page)).toContainText("4 Cartões");

    await page.getByRole("button", { name: "Revisar", exact: true }).click();

    await expect(page).toHaveURL(/#\/baralhos\/temporario\/estudo$/);
    await expect(
      page.getByRole("heading", { name: "Revisar baralho temporário" }),
    ).toBeVisible();

    const vistas: string[] = [];

    for (let indice = 1; indice <= 4; indice++) {
      const item = page.getByRole("article", { name: `Item ${indice} de 4` });

      await expect(item).toBeVisible();

      const texto = (await item.textContent()) ?? "";
      const frente = FRENTES.find((candidata) => texto.includes(candidata));

      expect(frente, `Item ${indice} deveria mostrar uma frente semeada`).toBeDefined();
      expect(vistas, `A frente «${frente}» apareceu duas vezes`).not.toContain(frente);

      vistas.push(frente as string);

      await page.getByRole("button", { name: "Revelar verso", exact: true }).click();
      await page.getByRole("button", { name: /^Bom/ }).click();
    }

    expect([...vistas].sort()).toEqual([...FRENTES].sort());

    await expect(
      page.getByRole("heading", { name: "Sessão concluída" }),
    ).toBeVisible();
    // O nome padrão "Baralho temporário" aparece quando nenhum nome é fornecido (T2321)
    await expect(
      page.getByText("Baralho temporário").first(),
    ).toBeVisible();

    // O botão só habilita depois que o Registro sobe.
    const salvarComoBaralho = page.getByRole("button", {
      name: "Salvar como baralho",
      exact: true,
    });

    await expect(salvarComoBaralho).toBeEnabled();
    await salvarComoBaralho.click();

    await page.getByLabel("Nome do baralho").fill("Inglês para viagem");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await expect(page.getByText("Baralho salvo.").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Abrir baralho", exact: true }),
    ).toBeVisible();

    // O Baralho salvo entra no acervo sem tocar nos originais.
    await abrirTela(page, ambiente, "baralhos", credencial);

    await expect(page.getByRole("listitem")).toHaveCount(3);

    await expect(
      itemDeBaralho(page, "Inglês para viagem").getByText("4 Cartões"),
    ).toBeVisible();
    await expect(itemDeBaralho(page, "Inglês").getByText("2 Cartões")).toBeVisible();
    await expect(itemDeBaralho(page, "Viagem").getByText("2 Cartões")).toBeVisible();
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

test("Temporário sem salvar: nenhum Baralho novo e o Histórico registra (SC-145, FR-376)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.sem-salvar",
    );

    const c1 = await prepararCartao(ambiente, credencial, FRENTES[0], "Como você está?");
    const c2 = await prepararCartao(ambiente, credencial, FRENTES[1], "Bom dia");
    const c3 = await prepararCartao(ambiente, credencial, FRENTES[2], "Obrigado");

    await prepararBaralho(ambiente, credencial, "Inglês", [c1, c2]);
    await prepararBaralho(ambiente, credencial, "Viagem", [c2, c3]);

    await abrirTela(page, ambiente, "baralhos/temporario", credencial);

    await expect(
      page.getByRole("heading", { name: "Criar baralho temporário" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Adicionar Inglês", exact: true }).click();
    await expect(selecaoDoEstudo(page)).toContainText("2 Cartões");

    await page.getByRole("button", { name: "Revisar", exact: true }).click();
    await expect(page).toHaveURL(/#\/baralhos\/temporario\/estudo$/);

    for (let indice = 1; indice <= 2; indice++) {
      await expect(
        page.getByRole("article", { name: `Item ${indice} de 2` }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Revelar verso", exact: true }).click();
      await page.getByRole("button", { name: /^Bom/ }).click();
    }

    await expect(
      page.getByRole("heading", { name: "Sessão concluída" }),
    ).toBeVisible();

    // Com o Registro já feito, sair não pede confirmação.
    await page
      .getByRole("link", { name: "Voltar para Baralhos", exact: true })
      .click();

    await expect(page).toHaveURL(/#\/baralhos$/);

    await expect(page.getByRole("listitem")).toHaveCount(2);
    await expect(itemDeBaralho(page, "Inglês")).toBeVisible();
    await expect(itemDeBaralho(page, "Viagem")).toBeVisible();

    await abrirTela(page, ambiente, "estudo", credencial);

    // O nome padrão "Baralho temporário" aparece no histórico quando nenhum nome é fornecido (T2321)
    await expect(
      page.getByText("Baralho temporário").first(),
    ).toBeVisible();
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

test("Temporário: Cartão excluído avisa e sai com «Retirar indisponíveis» (FR-367)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.indisponivel",
    );

    const c1 = await prepararCartao(ambiente, credencial, FRENTES[0], "Como você está?");
    const c2 = await prepararCartao(ambiente, credencial, FRENTES[1], "Bom dia");

    await prepararBaralho(ambiente, credencial, "Inglês", [c1, c2]);

    await abrirTela(page, ambiente, "baralhos/temporario", credencial);

    await page.getByRole("button", { name: "Adicionar Inglês", exact: true }).click();
    await expect(selecaoDoEstudo(page)).toContainText("2 Cartões");

    const status = await excluirCartaoPelaApi(
      ambiente.enderecoDaApi,
      c1.id,
      credencial,
    );

    expect([200, 204]).toContain(status);

    await page.getByRole("button", { name: "Revisar", exact: true }).click();
    await expect(
      page.getByText("1 Cartão não está mais disponível.").first(),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Retirar indisponíveis", exact: true })
      .click();
    await page.getByRole("button", { name: "Revisar", exact: true }).click();

    await expect(page).toHaveURL(/#\/baralhos\/temporario\/estudo$/);
    await expect(page.getByRole("article", { name: "Item 1 de 1" })).toBeVisible();
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

test("Isolamento: a montagem só oferece Baralhos e Cartões do próprio Usuário (SC-149)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencialA = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.a.temporario",
    );
    const credencialB = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.b.temporario",
    );

    const c1 = await prepararCartao(ambiente, credencialA, FRENTES[0], "Como você está?");
    const c2 = await prepararCartao(ambiente, credencialA, FRENTES[1], "Bom dia");
    const c3 = await prepararCartao(ambiente, credencialA, FRENTES[2], "Obrigado");

    await prepararBaralho(ambiente, credencialA, "Inglês", [c1, c2]);
    await prepararBaralho(ambiente, credencialA, "Viagem", [c2, c3]);

    const proprio = await prepararCartao(ambiente, credencialB, "Bonjour", "Olá");
    await prepararBaralho(ambiente, credencialB, "Francês", [proprio]);

    await abrirTela(page, ambiente, "baralhos/temporario", credencialB);

    await expect(
      page.getByRole("heading", { name: "Criar baralho temporário" }),
    ).toBeVisible();

    // Só o Baralho de B aparece como origem.
    await expect(
      page.getByRole("button", { name: "Adicionar Francês", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Adicionar Inglês", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Adicionar Viagem", exact: true }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Adicionar cartões", exact: true }).click();

    await expect(
      page.getByRole("button", { name: "Adicionar Bonjour", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Adicionar How are you?", exact: true }),
    ).toHaveCount(0);
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

test("Temporário: nome do baralho aparece no Resumo e no Histórico (FR-363, T2321)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.nomeado",
    );

    const c1 = await prepararCartao(ambiente, credencial, FRENTES[0], "Como você está?");
    const c2 = await prepararCartao(ambiente, credencial, FRENTES[1], "Bom dia");

    await prepararBaralho(ambiente, credencial, "Inglês", [c1, c2]);

    await abrirTela(page, ambiente, "baralhos", credencial);

    await page
      .getByRole("link", { name: "Criar baralho temporário", exact: true })
      .click();

    await expect(page).toHaveURL(/#\/baralhos\/temporario$/);
    await expect(
      page.getByRole("heading", { name: "Criar baralho temporário" }),
    ).toBeVisible();

    // Preencher o nome do baralho temporário
    const nomeDoBaralho = "Aula de Inglês";
    await page.getByLabel("Nome do baralho temporário (opcional)").fill(nomeDoBaralho);

    // Adicionar cartões
    await page.getByRole("button", { name: "Adicionar Inglês", exact: true }).click();
    await expect(selecaoDoEstudo(page)).toContainText("2 Cartões");

    await page.getByRole("button", { name: "Revisar", exact: true }).click();

    await expect(page).toHaveURL(/#\/baralhos\/temporario\/estudo$/);
    await expect(
      page.getByRole("heading", { name: "Revisar baralho temporário" }),
    ).toBeVisible();

    // Estudar os cartões
    for (let indice = 1; indice <= 2; indice++) {
      await expect(
        page.getByRole("article", { name: `Item ${indice} de 2` }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Revelar verso", exact: true }).click();
      await page.getByRole("button", { name: /^Bom/ }).click();
    }

    await expect(
      page.getByRole("heading", { name: "Sessão concluída" }),
    ).toBeVisible();

    // O nome aparece no Resumo em vez de "Estudo com baralho temporário"
    await expect(
      page.getByText(nomeDoBaralho).first(),
    ).toBeVisible();

    // Salvar como baralho: o nome vem preenchido no formulário
    const salvarComoBaralho = page.getByRole("button", {
      name: "Salvar como baralho",
      exact: true,
    });

    await expect(salvarComoBaralho).toBeEnabled();
    await salvarComoBaralho.click();

    // O formulário vem preenchido com o nome escolhido
    const nomeDoBaralhoInput = page.getByLabel("Nome do baralho");
    await expect(nomeDoBaralhoInput).toHaveValue(nomeDoBaralho);

    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await expect(page.getByText("Baralho salvo.").first()).toBeVisible();

    // Verificar que o baralho salvo mantém o nome e aparece na lista
    await abrirTela(page, ambiente, "baralhos", credencial);

    await expect(
      itemDeBaralho(page, nomeDoBaralho).getByText("2 Cartões"),
    ).toBeVisible();

    // Verificar que o nome aparece também no histórico
    await abrirTela(page, ambiente, "estudo", credencial);

    await expect(
      page.getByText(nomeDoBaralho).first(),
    ).toBeVisible();
  } finally {
    await derrubarAmbiente(ambiente);
  }
});
