import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  criarPastaTemporaria,
  criarUsuarioDeProva,
  encerrarProcesso,
  entrarPelaUi,
  gerarSenhaDeProva,
  iniciarApi,
  iniciarFrontend,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

// T1816 — prova E2E real do Acesso temporário (spec 018; SC-114, SC-116,
// SC-118, SC-119, SC-120, SC-123, SC-124; FR-290..FR-299, FR-305).
//
// A API real (node + SQLite em arquivo) e o frontend real (Vite dev) sobem como
// processos filhos do teste. Nenhum teste depende do relógio: a validade é a
// padrão (longa demais para vencer por acaso) e a expiração é provocada
// gravando um vencimento passado na linha do Acesso, no SQLite do teste. Os Usuários são cadastrados pela API real, com Senhas geradas agora; todo o
// resto — Entrar, recarregar, Sair, trocar a Senha — acontece nas telas reais
// do Chromium, e nenhuma rede é interceptada.

test.setTimeout(180_000);

interface Ambiente {
  arquivoDoBanco: string;
  enderecoDaApi: string;
  enderecoDoFrontend: string;
  encerrar: () => Promise<void>;
}

async function subirAmbiente(prefixo: string): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria(prefixo);
  const portaDaApi = await portaLivre();
  const arquivoDoBanco = join(pasta, "acesso.sqlite");
  const api: ProcessoIniciado = iniciarApi(arquivoDoBanco, portaDaApi);
  let frontend: ProcessoIniciado | null = null;

  try {
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

    const frontendIniciado = frontend;

    return {
      arquivoDoBanco,
      enderecoDaApi,
      enderecoDoFrontend,
      encerrar: async () => {
        await encerrarProcesso(frontendIniciado);
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

/**
 * Vence todos os Acessos agora, sem esperar o relógio: o vencimento de cada
 * linha passa a um instante já decorrido. O servidor segue respondendo
 * `acesso_expirado`, porque a linha existe e venceu (FR-294).
 */
function expirarOsAcessos(ambiente: Ambiente): void {
  const banco = new DatabaseSync(ambiente.arquivoDoBanco);

  try {
    banco.exec("PRAGMA busy_timeout = 10000");
    banco.exec(
      "UPDATE acesso_temporario SET expira_em = '1970-01-01T00:00:00.000Z'",
    );
  } finally {
    banco.close();
  }
}

/**
 * Acompanha as requisições da API que estão em voo numa página. Antes de vencer
 * o Acesso, o teste espera que não reste nenhuma: uma leitura ainda pendente
 * receberia o `acesso_expirado` por conta própria, a tela voltaria a Entrar no
 * meio do passo seguinte e o servidor já teria limpado o Cookie. Esperar por
 * essa condição substitui qualquer pausa por tempo.
 */
function acompanharRequisicoes(pagina: Page, enderecoDaApi: string) {
  const emVoo = new Set<unknown>();
  const daApi = (url: string) => url.startsWith(enderecoDaApi);

  pagina.on("request", (requisicao) => {
    if (daApi(requisicao.url())) {
      emVoo.add(requisicao);
    }
  });
  pagina.on("requestfinished", (requisicao) => emVoo.delete(requisicao));
  pagina.on("requestfailed", (requisicao) => emVoo.delete(requisicao));

  return async (): Promise<void> => {
    await expect.poll(() => emVoo.size, { message: "requisições da API em voo" }).toBe(0);
  };
}

/** Um navegador novo (contexto próprio, com o próprio cookie), já Entrado. */
async function entrarEmNovoNavegador(
  browser: Browser,
  ambiente: Ambiente,
  credencial: CredencialDeProva,
): Promise<{
  contexto: BrowserContext;
  pagina: Page;
  aguardarRede: () => Promise<void>;
}> {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();
  const aguardarRede = acompanharRequisicoes(pagina, ambiente.enderecoDaApi);

  await pagina.goto(ambiente.enderecoDoFrontend);
  await expect(
    pagina.getByRole("heading", { level: 1, name: "Entrar" }),
  ).toBeVisible();
  await entrarPelaUi(pagina, credencial);
  await expect(
    pagina.getByRole("heading", { level: 1, name: /^Olá, / }),
  ).toBeVisible();

  // O Início ainda tem leituras em voo (Agenda e Cartões). Cada uma é
  // uma requisição autenticada: se o Acesso vencer antes de elas terminarem, a
  // recusa chega a uma delas e o servidor limpa o Cookie, e o que o teste
  // observa depois deixa de ser a expiração. Os Usuários destes testes não têm
  // acervo, então o estado final de cada bloco é conhecido.
  await expect(pagina.getByText("Nenhum estudo agendado para hoje")).toBeVisible();
  await expect(
    pagina.getByRole("link", { name: "Criar o primeiro Cartão" }),
  ).toBeVisible();

  await aguardarRede();

  return { contexto, pagina, aguardarRede };
}

const TITULO_DO_INICIO = /^Olá, /;

test("recarregar dentro da validade volta ao Início sem Entrar, em até 2 s (SC-114, SC-118, FR-290)", async ({ browser }) => {
  const ambiente = await subirAmbiente("acesso-recarga-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");
    const { pagina } = await entrarEmNovoNavegador(browser, ambiente, ana);

    // SC-118: nenhum lampejo de «Entrar». Em vez de medir o tempo, o teste
    // registra se um título «Entrar» chegou a entrar no DOM durante a carga.
    await pagina.addInitScript(() => {
      const janela = window as unknown as { __entrarApareceu?: boolean };

      janela.__entrarApareceu = false;

      new MutationObserver((registros) => {
        for (const registro of registros) {
          for (const no of Array.from(registro.addedNodes)) {
            if (!(no instanceof Element)) {
              continue;
            }

            const titulos = no.matches("h1")
              ? [no]
              : Array.from(no.querySelectorAll("h1"));

            if (titulos.some((titulo) => titulo.textContent === "Entrar")) {
              janela.__entrarApareceu = true;
            }
          }
        }
      }).observe(document, { childList: true, subtree: true });
    });

    await pagina.reload();
    await expect(
      pagina.getByRole("heading", { level: 1, name: TITULO_DO_INICIO }),
    ).toBeVisible();

    expect(
      await pagina.evaluate(
        () =>
          (window as unknown as { __entrarApareceu?: boolean }).__entrarApareceu,
      ),
    ).toBe(false);
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toHaveCount(0);

    // Fechar e reabrir a aba, no mesmo navegador, dá no mesmo.
    const reaberta = await pagina.context().newPage();

    await reaberta.goto(ambiente.enderecoDoFrontend);
    await expect(
      reaberta.getByRole("heading", { level: 1, name: TITULO_DO_INICIO }),
    ).toBeVisible();
  } finally {
    await ambiente.encerrar();
  }
});

test("a ociosidade além da validade leva a Entrar com a mensagem exata (SC-123, FR-294)", async ({ browser }) => {
  const ambiente = await subirAmbiente("acesso-expira-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");
    const { pagina, aguardarRede } = await entrarEmNovoNavegador(
      browser,
      ambiente,
      ana,
    );

    await aguardarRede();

    // A validade se esgota sem nenhuma ação da pessoa.
    expirarOsAcessos(ambiente);

    await pagina.reload();

    await expect(
      pagina.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
    await expect(
      pagina.getByRole("alert", { name: "Credencial recusada" }),
    ).toHaveText("Seu acesso expirou. Entre novamente.");
  } finally {
    await ambiente.encerrar();
  }
});

test("uma operação depois da expiração é recusada com a mensagem, sem concluir nada (FR-091 revisado, FR-294, SC-115)", async ({ browser }) => {
  const ambiente = await subirAmbiente("acesso-operacao-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");
    const { pagina, aguardarRede } = await entrarEmNovoNavegador(
      browser,
      ambiente,
      ana,
    );

    await pagina
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Cartões" })
      .click();
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeVisible();
    await aguardarRede();

    expirarOsAcessos(ambiente);

    await pagina
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Baralhos" })
      .click();

    await expect(
      pagina.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
    await expect(
      pagina.getByRole("alert", { name: "Credencial recusada" }),
    ).toHaveText("Seu acesso expirou. Entre novamente.");
  } finally {
    await ambiente.encerrar();
  }
});

test("Sair e reabrir exige Entrar; o Acesso encerrado não volta a valer (SC-119, FR-295)", async ({ browser }) => {
  // A expiração é coberta separadamente; aqui ela não pode disputar com Sair.
  const ambiente = await subirAmbiente("acesso-sair-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");
    const { contexto, pagina } = await entrarEmNovoNavegador(
      browser,
      ambiente,
      ana,
    );

    expect(
      (await contexto.cookies()).some((cookie) => cookie.name === "acesso"),
    ).toBe(true);

    await pagina.getByRole("button", { name: "Sair" }).click();
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
    const avisoDeSaida = pagina.getByText(
      "Você saiu com sucesso.",
    );

    await expect(avisoDeSaida).toHaveAttribute("role", "status");

    // O cookie foi limpo pelo servidor (ele é HttpOnly: só ele pode).
    expect(
      (await contexto.cookies()).some((cookie) => cookie.name === "acesso"),
    ).toBe(false);

    await pagina.reload();
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
    await expect(pagina.getByRole("alert")).toHaveCount(0);
  } finally {
    await ambiente.encerrar();
  }
});

test("Entrar com a continuidade desmarcada não emite Acesso: recarregar exige Entrar (FR-292)", async ({ browser }) => {
  const ambiente = await subirAmbiente("acesso-desmarcada-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");
    const contexto = await browser.newContext();
    const pagina = await contexto.newPage();

    await pagina.goto(ambiente.enderecoDoFrontend);

    const caixa = pagina.getByLabel("Continuar conectado neste navegador");

    // A opção vem marcada por padrão e é alternável por teclado (FR-292, FR-302).
    await expect(caixa).toBeChecked();
    await caixa.focus();
    await pagina.keyboard.press("Space");
    await expect(caixa).not.toBeChecked();

    await entrarPelaUi(pagina, ana);
    await expect(
      pagina.getByRole("heading", { level: 1, name: TITULO_DO_INICIO }),
    ).toBeVisible();

    expect(
      (await contexto.cookies()).some((cookie) => cookie.name === "acesso"),
    ).toBe(false);

    await pagina.reload();
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
  } finally {
    await ambiente.encerrar();
  }
});

test("dois navegadores têm Acessos independentes: Sair num não afeta o outro; trocar a Senha encerra ambos, e quem trocou segue (FR-296, FR-299, SC-120)", async ({ browser }) => {
  // Validade longa: o cenário não depende da expiração.
  const ambiente = await subirAmbiente("acesso-dois-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");
    const primeiro = await entrarEmNovoNavegador(browser, ambiente, ana);
    const segundo = await entrarEmNovoNavegador(browser, ambiente, ana);

    // Sair no primeiro não encerra o segundo.
    await primeiro.pagina.getByRole("button", { name: "Sair" }).click();
    await expect(
      primeiro.pagina.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();

    await segundo.pagina.reload();
    await expect(
      segundo.pagina.getByRole("heading", { level: 1, name: TITULO_DO_INICIO }),
    ).toBeVisible();

    // O primeiro volta a entrar, e a Senha é trocada pela tela da 017.
    await entrarPelaUi(primeiro.pagina, ana);
    await primeiro.pagina
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Perfil" })
      .click();
    await primeiro.pagina.getByRole("button", { name: "Trocar Senha" }).click();

    const novaSenha = gerarSenhaDeProva();

    await primeiro.pagina
      .getByLabel("Senha atual", { exact: true })
      .fill(ana.senha);
    await primeiro.pagina
      .getByLabel("Nova Senha", { exact: true })
      .fill(novaSenha);
    await primeiro.pagina
      .getByLabel("Confirmação da Senha", { exact: true })
      .fill(novaSenha);
    await primeiro.pagina.getByRole("button", { name: "Trocar Senha" }).click();
    await expect(primeiro.pagina.getByText("Senha trocada.")).toBeVisible();

    // Quem trocou segue operando, com um Acesso novo, e sobrevive à recarga.
    await primeiro.pagina.reload();
    await expect(
      primeiro.pagina.getByRole("heading", { level: 1, name: "Perfil" }),
    ).toBeVisible();

    // O outro navegador é recusado na próxima operação.
    await segundo.pagina.reload();
    await expect(
      segundo.pagina.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
  } finally {
    await ambiente.encerrar();
  }
});

test("o Acesso não deixa Senha nem valor legível no navegador, e o cookie é HttpOnly e SameSite=Strict (SC-116, FR-078, FR-297, FR-305)", async ({ browser }) => {
  const ambiente = await subirAmbiente("acesso-inspecao-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");
    const { contexto, pagina } = await entrarEmNovoNavegador(
      browser,
      ambiente,
      ana,
    );

    const cookies = await contexto.cookies();
    const acesso = cookies.find((cookie) => cookie.name === "acesso");

    expect(acesso).toBeDefined();
    expect(acesso?.httpOnly).toBe(true);
    expect(acesso?.sameSite).toBe("Strict");
    expect(acesso?.path).toBe("/");
    // No ambiente local não há HTTPS; `Secure` é da nuvem.
    expect(acesso?.secure).toBe(false);

    const doNavegador = await pagina.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify({ ...window.localStorage }),
      sessao: JSON.stringify({ ...window.sessionStorage }),
      endereco: window.location.href,
      texto: document.body.innerText,
    }));
    const valor = acesso?.value ?? "inexistente";

    // O script da página não lê o cookie do Acesso (HttpOnly).
    expect(doNavegador.cookie).not.toContain("acesso=");
    for (const [, conteudo] of Object.entries(doNavegador)) {
      expect(conteudo).not.toContain(ana.senha);
      expect(conteudo).not.toContain(valor);
    }

    // O valor também não aparece em nenhuma URL pedida nem no corpo das respostas.
    const urls: string[] = [];
    const corpos: string[] = [];

    pagina.on("request", (requisicao) => urls.push(requisicao.url()));
    pagina.on("response", async (resposta) => {
      try {
        corpos.push(await resposta.text());
      } catch {
        // Respostas sem corpo legível não importam aqui.
      }
    });

    await pagina.reload();
    await expect(
      pagina.getByRole("heading", { level: 1, name: TITULO_DO_INICIO }),
    ).toBeVisible();

    expect(urls.join("\n")).not.toContain(valor);
    expect(corpos.join("\n")).not.toContain(valor);
    expect(corpos.join("\n")).not.toContain(ana.senha);
  } finally {
    await ambiente.encerrar();
  }
});

test("a atividade da pessoa renova o Acesso no máximo uma vez a cada 60 s; sem atividade, nenhuma renovação (SC-124, FR-291)", async ({ browser }) => {
  const ambiente = await subirAmbiente("acesso-atividade-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");
    const { pagina } = await entrarEmNovoNavegador(browser, ambiente, ana);

    const renovacoes: number[] = [];

    pagina.on("response", (resposta) => {
      if (
        resposta.url().endsWith("/acesso/renovar") &&
        resposta.request().method() === "POST"
      ) {
        renovacoes.push(resposta.status());
      }
    });

    // Conta, dentro da página e de forma síncrona, cada renovação disparada: o
    // contador já está certo quando a tecla ou o clique terminam de ser
    // entregues, sem esperar resposta nem tempo.
    await pagina.evaluate(() => {
      const janela = window as unknown as { __renovacoesPedidas: number };
      const original = window.fetch.bind(window);

      janela.__renovacoesPedidas = 0;
      window.fetch = (entrada, init) => {
        const url = entrada instanceof Request ? entrada.url : String(entrada);

        if (url.endsWith("/acesso/renovar") && init?.method === "POST") {
          janela.__renovacoesPedidas += 1;
        }

        return original(entrada, init);
      };
    });

    const pedidas = () =>
      pagina.evaluate(
        () => (window as unknown as { __renovacoesPedidas: number })
          .__renovacoesPedidas,
      );

    // O relógio da página é controlado: os 60 s passam sem esperar.
    await pagina.clock.install();

    // Dentro dos primeiros 60 s, interagir não renova.
    await pagina.keyboard.press("Shift");
    await pagina.mouse.click(5, 5);
    expect(await pedidas()).toBe(0);

    // 61 s depois, a primeira interação renova — uma vez só, por mais que haja várias.
    await pagina.clock.fastForward(61_000);
    await pagina.keyboard.press("Shift");
    await pagina.keyboard.press("Shift");
    await pagina.mouse.click(5, 5);
    expect(await pedidas()).toBe(1);
    await expect.poll(() => renovacoes).toEqual([204]);

    // Passar o tempo sem interagir não renova.
    await pagina.clock.fastForward(120_000);
    expect(await pedidas()).toBe(1);
    expect(renovacoes).toEqual([204]);
  } finally {
    await ambiente.encerrar();
  }
});
