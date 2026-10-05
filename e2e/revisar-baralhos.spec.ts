import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

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
  FUSO_DE_TESTE,
  INSTANTE_DE_TESTE,
  fixarRelogioDoContexto,
} from "./servidores-locais";
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

// Spec 024 — provas E2E reais do novo início de revisão e da situação do
// Baralho:
//
// (A) o Baralho Pendente abre o modal "Revisar baralho" com "Só pendentes",
//     "Todos os cartões" e "Cancelar" (foco inicial), Escape fecha sem começar
//     Sessão alguma, e o formulário antigo (Quantidade de Cartões + Iniciar
//     Sessão) não existe;
// (B) "Só pendentes" começa o conjunto de pendentes; ao fim, o Resumo traz a
//     ação renomeada "Revisar novamente";
// (C) vencido, de hoje, futuro e novo convivem: com o relógio do navegador em
//     2026-03-11, "Só pendentes" junta vencido + hoje + novo (3 Itens) e
//     "Todos os cartões" inclui o futuro (4 Itens);
// (D) o Baralho Revisado (todos os Cartões em dia) começa direto, sem modal;
// (E) a lista de Baralhos ganhou a etiqueta Pendente/Revisado/Sem cartões à
//     esquerda das ações e o filtro "Situação da revisão";
// (F) a tela de Cartões e a fonte "Cartões" do montador NÃO têm esse filtro —
//     só a busca e o Baralho.
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real
// (node + SQLite em arquivo) e o frontend real (Vite dev) sobem como
// processos filhos, em portas livres e com um arquivo SQLite temporário
// exclusivo. O relógio do navegador parte de INSTANTE_DE_TESTE; no cenário das
// datas a API é reiniciada com o AGORA_DE_TESTE de cada dia (mesmo banco,
// mesma porta e mesmo segredo — o acervo e a Credencial atravessam).

test.setTimeout(240_000);

/** Um Baralho preparado: os Cartões criados e vinculados, na ordem. */
interface BaralhoPreparado {
  id: string;
  nome: string;
  cartoes: { id: string; frente: string; verso: string }[];
}

interface Ambiente {
  pasta: string;
  api: ProcessoIniciado;
  frontend: ProcessoIniciado;
  enderecoDaApi: string;
  enderecoDoFrontend: string;
}

/**
 * Sobe a API real (SQLite em arquivo temporário exclusivo, com o relógio de
 * prova) e o frontend real (Vite dev) em portas livres, aguardando a prontidão
 * de cada um. Se algo falhar no meio, limpa o que já subiu antes de propagar.
 */
async function subirAmbiente(): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria("revisar-024-");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(
      join(pasta, "revisar.sqlite"),
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

/** Cria um Baralho com os Cartões vinculados direto pela API real. */
async function prepararBaralho(
  enderecoDaApi: string,
  credencial: CredencialDeProva,
  nome: string,
  cartoes: { frente: string; verso: string }[],
): Promise<BaralhoPreparado> {
  const baralho = await criarBaralhoPelaApi(
    enderecoDaApi,
    { nome },
    credencial,
  );

  const criados: { id: string; frente: string; verso: string }[] = [];

  for (const cartao of cartoes) {
    const criado = await criarCartaoPelaApi(
      enderecoDaApi,
      cartao,
      credencial,
    );

    await vincularCartaoPelaApi(
      enderecoDaApi,
      criado.id,
      baralho.id,
      credencial,
    );

    criados.push({ id: criado.id, frente: criado.frente, verso: criado.verso });
  }

  return { id: baralho.id, nome: baralho.nome, cartoes: criados };
}

/**
 * Conclui o estudo de um Cartão direto pela API real, com o mesmo corpo do
 * contrato `POST /sessoes`. Com o relógio da API em D, um Cartão novo sai
 * agendado para D+1 — é assim que cada cenário fixa a próxima revisão.
 */
async function concluirEstudoDoCartao(
  enderecoDaApi: string,
  credencial: CredencialDeProva,
  baralho: BaralhoPreparado,
  cartao: { id: string; frente: string; verso: string },
): Promise<void> {
  const resposta = await fetch(`${enderecoDaApi}/sessoes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...cabecalhoDeCredencial(credencial),
    },
    body: JSON.stringify({
      id: randomUUID(),
      origem: "baralho",
      baralhoId: baralho.id,
      nomeDoBaralho: baralho.nome,
      itens: [
        {
          frente: cartao.frente,
          verso: cartao.verso,
          cartaoId: cartao.id,
          avaliacao: "bom",
        },
      ],
    }),
  });

  if (resposta.status !== 201) {
    throw new Error(`POST /sessoes respondeu ${resposta.status}`);
  }
}

/**
 * A próxima revisão de cada Cartão — o dia local (FUSO_DE_TESTE) em que ela
 * cai, ou `null` para o Cartão novo —, lida direto do GET /cartoes real.
 */
async function obterProximasRevisoes(
  enderecoDaApi: string,
  credencial: CredencialDeProva,
): Promise<Map<string, string | null>> {
  const resposta = await fetch(`${enderecoDaApi}/cartoes`, {
    headers: cabecalhoDeCredencial(credencial),
  });

  if (!resposta.ok) {
    throw new Error(`GET /cartoes respondeu ${resposta.status}`);
  }

  const cartoes = (await resposta.json()) as Array<{
    id: string;
    proximaRevisaoEm: string | null;
  }>;
  const formatoDoDia = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DE_TESTE,
  });

  return new Map(
    cartoes.map((cartao) => [
      cartao.id,
      cartao.proximaRevisaoEm === null
        ? null
        : formatoDoDia.format(new Date(cartao.proximaRevisaoEm)),
    ]),
  );
}

/** O link ou o botão com o nome acessível exato (a ação pode mudar de tag). */
function acionavel(page: Page, nome: string): Locator {
  return page
    .getByRole("link", { name: nome, exact: true })
    .or(page.getByRole("button", { name: nome, exact: true }));
}

/** Item da lista de Baralhos cujo nome é exatamente `nome` (spec 024). */
function itemDeBaralho(page: Page, nome: string) {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByText(nome, { exact: true }) });
}

/** O Item da Sessão, por contagem esperada (o conjunto é embaralhado). */
function itemDaSessao(page: Page, total: number): Locator {
  return page.getByRole("article", {
    name: new RegExp(`^Item \\d+ de ${total}$`),
  });
}

test("Pendente abre o modal «Revisar baralho»; a escolha inicia e o Revisado começa direto (spec 024)", async ({ page, context, browserName }) => {
  expect(browserName).toBe("chromium");

  await fixarRelogioDoContexto(context);

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.modal",
    );
    const baralho = await prepararBaralho(
      ambiente.enderecoDaApi,
      credencial,
      "Rotina",
      [
        { frente: "Frente A", verso: "Verso A" },
        { frente: "Frente B", verso: "Verso B" },
      ],
    );

    // (A) O Baralho Pendente (Cartões novos) abre o modal antes de começar.
    await page.goto(
      `${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}/estudo`,
    );
    await entrarSeNecessario(page, credencial);

    const modal = page.getByRole("dialog");

    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByText("Revisar baralho")).toBeVisible();
    await expect(
      modal.getByRole("button", { name: "Só pendentes", exact: true }),
    ).toBeVisible();
    await expect(
      modal.getByRole("button", { name: "Todos os cartões", exact: true }),
    ).toBeVisible();

    const cancelar = modal.getByRole("button", {
      name: "Cancelar",
      exact: true,
    });

    await expect(cancelar).toBeFocused();

    // O formulário antigo não existe, e nada começou atrás do modal.
    await expect(page.getByLabel("Quantidade de Cartões")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Iniciar Sessão" }),
    ).toHaveCount(0);
    await expect(itemDaSessao(page, 2)).toHaveCount(0);

    // Escape fecha o modal sem começar Sessão alguma.
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(itemDaSessao(page, 2)).toHaveCount(0);

    // (B) "Só pendentes" começa os dois Cartões novos.
    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}`);
    await entrarSeNecessario(page, credencial);

    await expect(
      page.getByRole("heading", { level: 1, name: "Rotina" }),
    ).toBeVisible();

    await acionavel(page, "Revisar este Baralho").click();

    await expect(modal).toBeVisible({ timeout: 15_000 });
    await modal
      .getByRole("button", { name: "Só pendentes", exact: true })
      .click();

    await expect(
      page.getByRole("article", { name: "Item 1 de 2" }),
    ).toBeVisible();

    for (let item = 1; item <= 2; item += 1) {
      await page.getByRole("button", { name: "Revelar verso" }).click();
      await page.getByRole("button", { name: /^Bom/ }).click();
    }

    await expect(
      page.getByRole("heading", { level: 1, name: "Sessão concluída" }),
    ).toBeVisible({ timeout: 15_000 });

    // O Registro precisa estar confirmado antes de sair: sair do Resumo antes
    // disso pede confirmação (FR-164) e a próxima navegação não aconteceria.
    await expect(
      page.getByText("Sessão registrada no histórico."),
    ).toBeVisible({ timeout: 15_000 });

    // O encerramento também foi renomeado (spec 024).
    await expect(acionavel(page, "Revisar novamente")).toBeVisible();

    // (D) A Sessão agendou os Cartões novos para o dia seguinte: o Baralho
    // agora está Revisado e começa todos direto, sem modal.
    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/${baralho.id}`);
    await entrarSeNecessario(page, credencial);

    await expect(
      page.getByRole("heading", { level: 1, name: "Rotina" }),
    ).toBeVisible();

    await acionavel(page, "Revisar este Baralho").click();

    await expect(
      page.getByRole("article", { name: "Item 1 de 2" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(modal).toHaveCount(0);
    await expect(page.getByLabel("Quantidade de Cartões")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Iniciar Sessão" }),
    ).toHaveCount(0);
  } finally {
    await derrubarAmbiente(ambiente);
  }
});

test("Vencido, de hoje, futuro e novo: «Só pendentes» junta os pendentes e «Todos os cartões» inclui o futuro (spec 024)", async ({ page, context, browserName }) => {
  expect(browserName).toBe("chromium");

  await fixarRelogioDoContexto(context);

  const pasta = await criarPastaTemporaria("revisar-datas-");
  const caminhoDoBanco = join(pasta, "revisar.sqlite");
  const portaDaApi = await portaLivre();
  const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    // A API sobe três vezes, com o relógio de um dia cada: com o relógio em D,
    // concluir o estudo de um Cartão novo agenda a próxima revisão para D+1.
    // Banco, porta e segredo são os mesmos — o acervo e a Credencial
    // atravessam as reinicializações.
    api = iniciarApi(caminhoDoBanco, portaDaApi, {
      AGORA_DE_TESTE: "2026-03-09T15:00:00.000Z",
    });
    await aguardarApiPronta(api, enderecoDaApi);

    const credencial = await criarUsuarioDeProva(
      enderecoDaApi,
      "usuario.datas",
    );
    const baralho = await prepararBaralho(enderecoDaApi, credencial, "Janela", [
      { frente: "Vencido", verso: "Verso do vencido" },
      { frente: "De hoje", verso: "Verso do de hoje" },
      { frente: "Futuro", verso: "Verso do futuro" },
      { frente: "Novo", verso: "Verso do novo" },
    ]);

    // 03-09 → próxima revisão em 03-10 (vencida para o navegador em 03-11).
    await concluirEstudoDoCartao(
      enderecoDaApi,
      credencial,
      baralho,
      baralho.cartoes[0],
    );

    await encerrarProcesso(api);
    api = iniciarApi(caminhoDoBanco, portaDaApi, {
      AGORA_DE_TESTE: "2026-03-10T15:00:00.000Z",
    });
    await aguardarApiPronta(api, enderecoDaApi);

    // 03-10 → próxima revisão em 03-11 (de hoje).
    await concluirEstudoDoCartao(
      enderecoDaApi,
      credencial,
      baralho,
      baralho.cartoes[1],
    );

    await encerrarProcesso(api);
    api = iniciarApi(caminhoDoBanco, portaDaApi, {
      AGORA_DE_TESTE: INSTANTE_DE_TESTE,
    });
    await aguardarApiPronta(api, enderecoDaApi);

    // 03-11 → próxima revisão em 03-12 (futura). O quarto Cartão fica novo.
    await concluirEstudoDoCartao(
      enderecoDaApi,
      credencial,
      baralho,
      baralho.cartoes[2],
    );

    // A semente é conferida pela própria API: três dias distintos e um novo.
    const proximas = await obterProximasRevisoes(enderecoDaApi, credencial);

    expect(proximas.get(baralho.cartoes[0].id)).toBe("2026-03-10");
    expect(proximas.get(baralho.cartoes[1].id)).toBe("2026-03-11");
    expect(proximas.get(baralho.cartoes[2].id)).toBe("2026-03-12");
    expect(proximas.get(baralho.cartoes[3].id)).toBeNull();

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);
    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    // Com o navegador em 2026-03-11, pendentes são o vencido, o de hoje e o
    // novo; o futuro fica de fora.
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralho.id}/estudo`);
    await entrarSeNecessario(page, credencial);

    const modal = page.getByRole("dialog");

    await expect(modal).toBeVisible({ timeout: 15_000 });

    // "Todos os cartões" inclui o agendado para 03-12: quatro Itens.
    await modal
      .getByRole("button", { name: "Todos os cartões", exact: true })
      .click();

    await expect(
      page.getByRole("article", { name: "Item 1 de 4" }),
    ).toBeVisible();

    // Interromper descarta a Sessão e volta ao Baralho sem agendar nada.
    await page.getByRole("button", { name: "Interromper" }).click();
    await page
      .getByRole("dialog")
      .filter({ hasText: "Interromper a Sessão?" })
      .getByRole("button", { name: "Interromper" })
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Janela" }),
    ).toBeVisible();

    // "Só pendentes" junta vencido + de hoje + novo: três Itens.
    await acionavel(page, "Revisar este Baralho").click();

    await expect(modal).toBeVisible({ timeout: 15_000 });
    await modal
      .getByRole("button", { name: "Só pendentes", exact: true })
      .click();

    await expect(
      page.getByRole("article", { name: "Item 1 de 3" }),
    ).toBeVisible();
  } finally {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});

test("Lista de Baralhos e montador têm etiqueta e filtro de situação; Cartões não têm (spec 024)", async ({ page, context, browserName }) => {
  expect(browserName).toBe("chromium");

  await fixarRelogioDoContexto(context);

  const ambiente = await subirAmbiente();

  try {
    const credencial = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "usuario.situacao",
    );

    // "Alemão" fica Pendente (o Cartão é novo); "Espanhol" fica Revisado, com
    // o único Cartão agendado para o dia seguinte; "Francês" fica Sem cartões.
    await prepararBaralho(ambiente.enderecoDaApi, credencial, "Alemão", [
      { frente: "Guten Morgen", verso: "Bom dia" },
    ]);
    const espanhol = await prepararBaralho(
      ambiente.enderecoDaApi,
      credencial,
      "Espanhol",
      [{ frente: "Hola", verso: "Olá" }],
    );

    await prepararBaralho(ambiente.enderecoDaApi, credencial, "Francês", []);

    await concluirEstudoDoCartao(
      ambiente.enderecoDaApi,
      credencial,
      espanhol,
      espanhol.cartoes[0],
    );

    // (E) Lista de Baralhos: etiqueta à esquerda da ação e filtro.
    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos`);
    await entrarSeNecessario(page, credencial);

    await expect(page.getByRole("listitem")).toHaveCount(3);

    const linhaDoAlemao = itemDeBaralho(page, "Alemão");
    const linhaDoEspanhol = itemDeBaralho(page, "Espanhol");
    const linhaDoFrances = itemDeBaralho(page, "Francês");

    await expect(
      linhaDoAlemao.getByText("Pendente", { exact: true }),
    ).toBeVisible();
    await expect(
      linhaDoEspanhol.getByText("Revisado", { exact: true }),
    ).toBeVisible();
    await expect(
      linhaDoFrances.getByText("Sem cartões", { exact: true }),
    ).toBeVisible();

    // A etiqueta fica à esquerda da ação de revisão da mesma linha.
    const caixaDoSelo = await linhaDoAlemao
      .getByText("Pendente", { exact: true })
      .boundingBox();
    const caixaDaAcao = await linhaDoAlemao
      .getByRole("link", { name: "Revisar Alemão", exact: true })
      .or(
        linhaDoAlemao.getByRole("button", {
          name: "Revisar Alemão",
          exact: true,
        }),
      )
      .boundingBox();

    expect(caixaDoSelo).not.toBeNull();
    expect(caixaDaAcao).not.toBeNull();
    expect(caixaDoSelo!.x + caixaDoSelo!.width).toBeLessThanOrEqual(
      caixaDaAcao!.x + 2,
    );

    const filtroDeSituacao = page.getByLabel("Situação da revisão");

    await filtroDeSituacao.selectOption({ label: "Pendente" });
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(linhaDoAlemao).toBeVisible();

    await filtroDeSituacao.selectOption({ label: "Revisado" });
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(linhaDoEspanhol).toBeVisible();

    await filtroDeSituacao.selectOption({ label: "Todos" });
    await expect(page.getByRole("listitem")).toHaveCount(3);

    // (F) Cartões: sem o filtro de situação — só a busca e o Baralho.
    await page.goto(`${ambiente.enderecoDoFrontend}/#/cartoes`);
    await entrarSeNecessario(page, credencial);

    await expect(page.getByLabel("Situação da revisão")).toHaveCount(0);
    await expect(
      page.getByRole("searchbox", { name: "Buscar cartões" }),
    ).toBeVisible();
    await expect(page.getByLabel("Baralho")).toBeVisible();

    // (F) Montador: a fonte "Baralhos" tem o filtro; o filtro separa os
    // Baralhos por situação. As etiquetas (Pendente/Revisado/Sem cartões) já
    // não aparecem nas linhas da montagem (spec 024), apenas na lista principal.
    await page.goto(`${ambiente.enderecoDoFrontend}/#/baralhos/temporario`);
    await entrarSeNecessario(page, credencial);

    await expect(
      page.getByRole("heading", { name: "Criar baralho temporário" }),
    ).toBeVisible();

    const filtroDoMontador = page.getByLabel("Situação da revisão");

    await expect(filtroDoMontador).toBeVisible();

    // Mostrar todos os Baralhos: o vazio ("Francês") está listado mas sem etiqueta
    await filtroDoMontador.selectOption({ label: "Todos" });
    const botaoAAdicionarFrances = page.getByRole("button", { name: "Adicionar Francês", exact: true });

    await expect(botaoAAdicionarFrances).toBeVisible();

    // A linha do Francês no montador está visível mas sem etiqueta "Sem cartões"
    const linhaFrancesNoMontador = page.locator("li").filter({
      has: botaoAAdicionarFrances,
    });
    await expect(
      linhaFrancesNoMontador.getByText("Sem cartões", { exact: true }),
    ).toHaveCount(0);

    await filtroDoMontador.selectOption({ label: "Pendente" });
    await expect(
      page.getByRole("button", { name: "Adicionar Alemão", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Adicionar Espanhol", exact: true }),
    ).toBeHidden();

    await filtroDoMontador.selectOption({ label: "Revisado" });
    await expect(
      page.getByRole("button", { name: "Adicionar Espanhol", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Adicionar Alemão", exact: true }),
    ).toBeHidden();

    // A fonte "Cartões" não tem o filtro: só busca e Baralho.
    await page
      .getByRole("button", { name: "Adicionar cartões", exact: true })
      .click();

    await expect(page.getByLabel("Situação da revisão")).toBeHidden();
    await expect(page.getByRole("searchbox").first()).toBeVisible();
    await expect(page.getByLabel("Baralho").first()).toBeVisible();
  } finally {
    await derrubarAmbiente(ambiente);
  }
});
