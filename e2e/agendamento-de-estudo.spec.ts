import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Browser, Locator, Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  cabecalhoDeCredencial,
  criarBaralhoPelaApi,
  criarCartaoPelaApi,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarPelaUi,
  iniciarApi,
  iniciarFrontend,
  portaLivre,
  removerPastaTemporaria,
  vincularCartaoPelaApi,
} from "./servidores-locais";
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

// T1615 e T1623 — prova E2E real da Agenda de estudo (spec 016; FR-222–FR-256,
// SC-095–SC-104).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real (node +
// SQLite em arquivo) e o frontend real (Vite dev) sobem como processos filhos
// do teste, em portas livres. Os Usuários, os Baralhos e os Cartões são
// preparados pela API real; a Rotina, o calendário, a Sessão e a conclusão são
// feitos pelas telas reais do Chromium. Como o relógio é o real, a Rotina de
// prova programa os sete dias, de modo que "hoje" sempre tem um Compromisso.

test.setTimeout(240_000);

interface Ambiente {
  enderecoDaApi: string;
  enderecoDoFrontend: string;
  encerrar: () => Promise<void>;
}

async function subirAmbiente(prefixo: string): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria(prefixo);
  const portaDaApi = await portaLivre();
  const api: ProcessoIniciado = iniciarApi(
    join(pasta, "agenda.sqlite"),
    portaDaApi,
  );
  let frontend: ProcessoIniciado | null = null;

  try {
    const enderecoDaApi = `http://127.0.0.1:${portaDaApi}`;

    await aguardarApiPronta(api, enderecoDaApi);

    const portaDoFrontend = await portaLivre();
    const enderecoDoFrontend = `http://127.0.0.1:${portaDoFrontend}`;

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);
    await aguardarProntidao(frontend, enderecoDoFrontend, (r) => r.ok);

    const iniciado = frontend;

    return {
      enderecoDaApi,
      enderecoDoFrontend,
      encerrar: async () => {
        await encerrarProcesso(iniciado);
        await encerrarProcesso(api);
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

/** Cria um Baralho com `n` Cartões vinculados, direto pela API real. */
async function prepararBaralho(
  ambiente: Ambiente,
  credencial: CredencialDeProva,
  nome: string,
  n: number,
): Promise<string> {
  const baralho = await criarBaralhoPelaApi(
    ambiente.enderecoDaApi,
    { nome },
    credencial,
  );

  for (let i = 1; i <= n; i += 1) {
    const cartao = await criarCartaoPelaApi(
      ambiente.enderecoDaApi,
      { frente: `Frente ${i}`, verso: `Verso ${i}` },
      credencial,
    );

    await vincularCartaoPelaApi(
      ambiente.enderecoDaApi,
      cartao.id,
      baralho.id,
      credencial,
    );
  }

  return baralho.id;
}

/** O fuso do navegador do teste, como a API o recebe. */
const FUSO = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Programa, pela API real, uma Rotina dos sete dias. */
async function programarRotina(
  ambiente: Ambiente,
  credencial: CredencialDeProva,
  baralhoId: string,
  quantidade: number | null = null,
): Promise<void> {
  const resposta = await fetch(`${ambiente.enderecoDaApi}/agenda/rotinas`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...cabecalhoDeCredencial(credencial),
    },
    body: JSON.stringify({
      operacaoId: crypto.randomUUID(),
      acao: "criar",
      baralhoId,
      dias: [1, 2, 3, 4, 5, 6, 7],
      quantidade,
      fuso: FUSO,
    }),
  });

  if (resposta.status !== 201) {
    throw new Error(`POST /agenda/rotinas respondeu ${resposta.status}`);
  }
}

async function abrirComoUsuario(
  browser: Browser,
  ambiente: Ambiente,
  credencial: CredencialDeProva,
  largura = 1440,
): Promise<Page> {
  const contexto = await browser.newContext({
    viewport: { width: largura, height: 900 },
  });
  const pagina = await contexto.newPage();

  await pagina.goto(ambiente.enderecoDoFrontend);
  await entrarPelaUi(pagina, credencial);

  return pagina;
}

/** Sem rolagem horizontal da página (FR-253). */
async function semRolagemHorizontal(pagina: Page): Promise<void> {
  const medidas = await pagina.evaluate(() => ({
    rolagem: document.documentElement.scrollWidth,
    janela: document.documentElement.clientWidth,
  }));

  expect(medidas.rolagem).toBeLessThanOrEqual(medidas.janela);
}

/** Todo controle visível tem alvo de pelo menos 44 x 44 px (FR-253, SC-063). */
async function alvosDe44(pagina: Page, raiz: Locator): Promise<void> {
  const controles = raiz.locator(
    "button:visible, a[href]:visible, input:visible, select:visible",
  );
  const total = await controles.count();

  for (let indice = 0; indice < total; indice += 1) {
    const caixa = await controles.nth(indice).boundingBox();
    const nome = await controles
      .nth(indice)
      .evaluate((elemento) => elemento.outerHTML.slice(0, 120));

    expect(caixa, nome).not.toBeNull();
    expect(caixa?.height ?? 0, `altura de ${nome}`).toBeGreaterThanOrEqual(43.5);
    expect(caixa?.width ?? 0, `largura de ${nome}`).toBeGreaterThanOrEqual(43.5);
  }

  void pagina;
}

test("percurso integrado: agendar, estudar pelo Compromisso, concluir e reencontrar a conclusão (FR-222–FR-256, SC-095, SC-097)", async ({
  browser,
}) => {
  const ambiente = await subirAmbiente("agenda-percurso-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");

    await prepararBaralho(ambiente, ana, "Inglês", 3);

    const pagina = await abrirComoUsuario(browser, ambiente, ana);

    // Início: sem Rotinas, o bloco da Agenda orienta Agendar estudo.
    await expect(
      pagina.getByRole("heading", { level: 2, name: "Nenhum estudo agendado para hoje" }),
    ).toBeVisible();

    await pagina.getByRole("link", { name: "Agendar estudo" }).click();
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Agendar estudo" }),
    ).toBeVisible();

    // Padrão: Todos os Cartões e nenhum dia.
    await expect(pagina.getByRole("radio", { name: "Todos os Cartões" })).toBeChecked();
    await pagina.getByLabel("Baralho").selectOption({ label: "Inglês (3 Cartões)" });

    for (const dia of [
      "segunda-feira",
      "terça-feira",
      "quarta-feira",
      "quinta-feira",
      "sexta-feira",
      "sábado",
      "domingo",
    ]) {
      await pagina.getByRole("checkbox", { name: dia }).check();
    }

    await pagina.getByRole("radio", { name: "Definir quantidade" }).check();
    await pagina.getByLabel("Quantos Cartões por estudo").fill("2");
    await expect(pagina.locator("[data-resumo]")).toHaveText(
      "Inglês · segunda, terça, quarta, quinta, sexta, sábado e domingo · 2 Cartões",
    );
    await pagina.getByRole("button", { name: "Salvar agendamento" }).click();

    await expect(
      pagina.getByRole("heading", { level: 1, name: "Gerenciar agenda" }),
    ).toBeVisible();
    await expect(pagina.getByText(/Rotina de Inglês criada/)).toBeVisible();

    await pagina.getByRole("link", { name: "Voltar para Início" }).click();
    await expect(
      pagina.getByRole("heading", { level: 2, name: "0 de 1 estudo concluído" }),
    ).toBeVisible();

    // Estudar pelo Compromisso: a Sessão começa direto, com 2 dos 3 Cartões.
    await pagina.getByRole("button", { name: "Continuar estudos" }).click();
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Estudar Inglês" }),
    ).toBeVisible();
    await expect(pagina.getByLabel("Item 1 de 2")).toBeVisible();

    for (let item = 1; item <= 2; item += 1) {
      await pagina.getByRole("button", { name: "Revelar verso" }).click();
      await pagina.getByRole("button", { name: /^Bom/ }).click();
    }

    await expect(
      pagina.getByRole("heading", { name: "Sessão concluída" }),
    ).toBeVisible();
    await expect(
      pagina.getByText(/O estudo programado de hoje foi concluído/),
    ).toBeVisible();

    await pagina.getByRole("link", { name: "Voltar para Início" }).click();
    await expect(
      pagina.getByRole("heading", { level: 2, name: "Agenda de hoje concluída" }),
    ).toBeVisible();

    // Reabrir a aplicação: a conclusão persiste e Ver Sessão leva ao Registro.
    await pagina.reload();
    await expect(
      pagina.getByRole("heading", { level: 2, name: "Agenda de hoje concluída" }),
    ).toBeVisible();
    await pagina.getByRole("link", { name: "Ver Sessão de Inglês" }).click();
    await expect(pagina).toHaveURL(/#\/sessoes\//);

    // A API confirma uma única conclusão vinculada ao Registro daquela Sessão.
    const semana = await fetch(
      `${ambiente.enderecoDaApi}/agenda?inicio=${await segundaDeHoje(pagina)}&fuso=${encodeURIComponent(FUSO)}`,
      { headers: cabecalhoDeCredencial(ana) },
    );
    const corpo = (await semana.json()) as {
      compromissosDeHoje: Array<{ estado: string; registroId: string | null }>;
    };

    expect(corpo.compromissosDeHoje).toHaveLength(1);
    expect(corpo.compromissosDeHoje[0].estado).toBe("concluido");
    expect(await pagina.url()).toContain(
      encodeURIComponent(corpo.compromissosDeHoje[0].registroId ?? "?"),
    );
  } finally {
    await ambiente.encerrar();
  }
});

/** A segunda-feira da semana de hoje, calculada no navegador real. */
async function segundaDeHoje(pagina: Page): Promise<string> {
  return await pagina.evaluate((fuso) => {
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(
      new Date(),
    );
    const [ano, mes, dia] = hoje.split("-").map(Number);
    const base = new Date(Date.UTC(ano, mes - 1, dia));

    base.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));

    return base.toISOString().slice(0, 10);
  }, FUSO);
}

test("interromper a Sessão da Agenda e recarregar não registram nada nem concluem o Compromisso (FR-234, SC-097)", async ({
  browser,
}) => {
  const ambiente = await subirAmbiente("agenda-interrupcao-");

  try {
    const bia = await criarUsuarioDeProva(ambiente.enderecoDaApi, "bia.souza");
    const baralhoId = await prepararBaralho(ambiente, bia, "Francês", 2);

    await programarRotina(ambiente, bia, baralhoId);

    const pagina = await abrirComoUsuario(browser, ambiente, bia);

    await pagina.getByRole("button", { name: "Continuar estudos" }).click();
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Estudar Francês" }),
    ).toBeVisible();

    // Recarregar abandona a Sessão e volta a Início, com o Compromisso pendente.
    await pagina.reload();
    await expect(
      pagina.getByRole("heading", { level: 2, name: "0 de 1 estudo concluído" }),
    ).toBeVisible();
    await expect(pagina).toHaveURL(/#\/inicio$/);

    // Interromper pela interface, com a confirmação.
    await pagina.getByRole("button", { name: "Continuar estudos" }).click();
    await pagina.getByRole("button", { name: "Interromper" }).click();
    await pagina
      .getByRole("dialog")
      .getByRole("button", { name: "Interromper" })
      .click();
    await expect(
      pagina.getByRole("heading", { level: 2, name: "0 de 1 estudo concluído" }),
    ).toBeVisible();

    // Nenhum Registro foi gravado.
    const estatisticas = await fetch(
      `${ambiente.enderecoDaApi}/estatisticas?desde=${encodeURIComponent(
        new Date(Date.now() - 86_400_000).toISOString(),
      )}`,
      { headers: cabecalhoDeCredencial(bia) },
    );

    expect(((await estatisticas.json()) as { recentes: unknown[] }).recentes).toEqual(
      [],
    );
  } finally {
    await ambiente.encerrar();
  }
});

test("dois aparelhos do mesmo Usuário veem a mesma Agenda e o outro Usuário não vê nada (FR-248, FR-250, SC-100)", async ({
  browser,
}) => {
  const ambiente = await subirAmbiente("agenda-isolamento-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");
    const bruno = await criarUsuarioDeProva(ambiente.enderecoDaApi, "bruno.lima");
    const baralhoId = await prepararBaralho(ambiente, ana, "Inglês", 2);

    await programarRotina(ambiente, ana, baralhoId, 20);

    const primeiro = await abrirComoUsuario(browser, ambiente, ana);
    const segundo = await abrirComoUsuario(browser, ambiente, ana);

    for (const pagina of [primeiro, segundo]) {
      await pagina.getByRole("link", { name: "Gerenciar agenda" }).click();
      await expect(
        pagina.getByText(
          "Inglês · segunda, terça, quarta, quinta, sexta, sábado e domingo · 20 Cartões",
        ),
      ).toBeVisible();
    }

    const deBruno = await abrirComoUsuario(browser, ambiente, bruno);

    await deBruno.getByRole("link", { name: "Gerenciar agenda" }).click();
    await expect(
      deBruno.getByText("Você ainda não tem Rotinas de estudo."),
    ).toBeVisible();

    // Fora da interface: nem ler nem alterar a Rotina alheia.
    const lista = await fetch(`${ambiente.enderecoDaApi}/agenda/rotinas`, {
      headers: cabecalhoDeCredencial(ana),
    });
    const rotina = ((await lista.json()) as { rotinas: Array<{ id: string; versao: number }> })
      .rotinas[0];
    const alheia = await fetch(`${ambiente.enderecoDaApi}/agenda/rotinas`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...cabecalhoDeCredencial(bruno),
      },
      body: JSON.stringify({
        operacaoId: crypto.randomUUID(),
        acao: "excluir",
        id: rotina.id,
        versao: rotina.versao,
        fuso: FUSO,
      }),
    });

    expect(alheia.status).toBe(404);
  } finally {
    await ambiente.encerrar();
  }
});

test("teclado: criar, pausar, retomar e excluir a Rotina inteiramente por teclado, com foco visível (FR-252, SC-101)", async ({
  browser,
}) => {
  const ambiente = await subirAmbiente("agenda-teclado-");

  try {
    const caio = await criarUsuarioDeProva(ambiente.enderecoDaApi, "caio.melo");

    await prepararBaralho(ambiente, caio, "Inglês", 2);

    const pagina = await abrirComoUsuario(browser, ambiente, caio);

    await pagina.goto(`${ambiente.enderecoDoFrontend}/#/agenda/nova`);
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Agendar estudo" }),
    ).toBeVisible();

    // O seletor de Baralho: foco e escolha pelo teclado.
    const baralho = pagina.getByLabel("Baralho");

    await baralho.focus();
    await expect(baralho).toBeFocused();
    await baralho.selectOption({ label: "Inglês (2 Cartões)" });
    await expect(baralho).toHaveValue(/.+/);

    // Dias: Tab até a caixa e Espaço marca; o foco é visível.
    const segunda = pagina.getByRole("checkbox", { name: "segunda-feira" });

    await pagina.keyboard.press("Tab");
    await expect(segunda).toBeFocused();

    const contorno = await segunda.evaluate((elemento) => {
      const estilo = getComputedStyle(elemento);

      return {
        largura: parseFloat(estilo.outlineWidth),
        estilo: estilo.outlineStyle,
      };
    });

    expect(contorno.estilo).not.toBe("none");
    expect(contorno.largura).toBeGreaterThan(0);

    await pagina.keyboard.press("Space");
    await expect(segunda).toBeChecked();
    await pagina.keyboard.press("Tab");
    await pagina.keyboard.press("Space");
    await expect(pagina.getByRole("checkbox", { name: "terça-feira" })).toBeChecked();

    // Salvar: Enter no botão.
    await pagina.getByRole("button", { name: "Salvar agendamento" }).focus();
    await pagina.keyboard.press("Enter");
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Gerenciar agenda" }),
    ).toBeVisible();
    await expect(
      pagina.getByText("Inglês · segunda e terça · Todos os Cartões", { exact: true }),
    ).toBeVisible();

    // Pausar: Enter no botão, a confirmação inicia em Cancelar, Escape fecha.
    const pausar = pagina.getByRole("button", { name: "Pausar rotina de Inglês" });

    await pausar.focus();
    await pagina.keyboard.press("Enter");
    await expect(
      pagina.getByRole("dialog").getByRole("button", { name: "Cancelar" }),
    ).toBeFocused();
    await pagina.keyboard.press("Escape");
    await expect(pagina.getByRole("dialog")).toBeHidden();
    await expect(pausar).toBeFocused();

    await pagina.keyboard.press("Enter");
    await pagina.keyboard.press("Tab");
    await pagina.keyboard.press("Enter");
    await expect(pagina.getByText("Rotina de Inglês pausada.")).toBeVisible();
    await expect(pagina.getByText(/Situação: Pausada/)).toBeVisible();

    // Retomar e Excluir pelo teclado.
    const retomar = pagina.getByRole("button", { name: "Retomar rotina de Inglês" });

    await retomar.focus();
    await pagina.keyboard.press("Enter");
    await expect(pagina.getByText("Rotina de Inglês retomada.")).toBeVisible();

    const excluir = pagina.getByRole("button", { name: "Excluir rotina de Inglês" });

    await excluir.focus();
    await pagina.keyboard.press("Enter");
    await pagina.keyboard.press("Tab");
    await pagina.keyboard.press("Enter");
    await expect(
      pagina.getByText("Você ainda não tem Rotinas de estudo."),
    ).toBeVisible();
  } finally {
    await ambiente.encerrar();
  }
});

for (const largura of [360, 390, 768, 1440]) {
  test(`geometria ${largura}px: sete dias na mesma linha, alvos de 44px e sem rolagem horizontal, com nome de Baralho longo (FR-253, SC-101)`, async ({
    browser,
  }) => {
    const ambiente = await subirAmbiente(`agenda-${largura}-`);

    try {
      const dora = await criarUsuarioDeProva(ambiente.enderecoDaApi, "dora.reis");
      const nomeLongo = "Vocabulário de ".concat("conversação avançada ".repeat(4)).slice(0, 100);
      const baralhoId = await prepararBaralho(ambiente, dora, nomeLongo, 2);

      await programarRotina(ambiente, dora, baralhoId, 5);

      const pagina = await abrirComoUsuario(browser, ambiente, dora, largura);

      // Início: o calendário.
      await expect(
        pagina.getByRole("heading", { level: 2, name: "0 de 1 estudo concluído" }),
      ).toBeVisible();

      const dias = pagina.locator(".agenda__dia");

      await expect(dias).toHaveCount(7);

      const caixas = [];

      for (let indice = 0; indice < 7; indice += 1) {
        const caixa = await dias.nth(indice).boundingBox();

        expect(caixa).not.toBeNull();
        caixas.push(caixa as { x: number; y: number; width: number; height: number });
      }

      // Mesma linha e sem encolher os alvos abaixo de 44 px.
      expect(new Set(caixas.map((caixa) => Math.round(caixa.y))).size).toBe(1);

      for (const caixa of caixas) {
        expect(caixa.width).toBeGreaterThanOrEqual(43.5);
        expect(caixa.height).toBeGreaterThanOrEqual(43.5);
      }

      await semRolagemHorizontal(pagina);
      await alvosDe44(pagina, pagina.locator(".agenda"));

      // Selecionar outro dia não desloca o calendário na página (FR-230): a
      // posição é medida na página, e não na janela, porque o clique pode rolar.
      const posicaoNaPagina = () =>
        dias.first().evaluate((elemento) => {
          const caixa = elemento.getBoundingClientRect();

          return {
            x: caixa.left + window.scrollX,
            y: caixa.top + window.scrollY,
            largura: caixa.width,
          };
        });
      const antes = await posicaoNaPagina();

      await dias.nth(3).click();
      await expect(dias.nth(3)).toHaveAttribute("aria-pressed", "true");

      expect(await posicaoNaPagina()).toEqual(antes);

      // Gerenciar agenda e formulário.
      await pagina.goto(`${ambiente.enderecoDoFrontend}/#/agenda`);
      await expect(
        pagina.getByRole("heading", { level: 1, name: "Gerenciar agenda" }),
      ).toBeVisible();
      await expect(pagina.getByText(/Todos|5 Cartões/).first()).toBeVisible();
      await semRolagemHorizontal(pagina);
      await alvosDe44(pagina, pagina.locator("main"));

      await pagina.goto(`${ambiente.enderecoDoFrontend}/#/agenda/nova`);
      await expect(pagina.getByLabel("Baralho")).toBeVisible();
      await semRolagemHorizontal(pagina);
      await alvosDe44(pagina, pagina.locator("main"));
    } finally {
      await ambiente.encerrar();
    }
  });
}
