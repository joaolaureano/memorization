import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

import {
  aguardarApiPronta,
  aguardarProntidao,
  cabecalhoDeCredencial,
  criarCartaoPelaApi,
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

// T1718 e T1719 — prova E2E real de «Minha conta» (spec 017; SC-105, SC-106,
// SC-109, SC-111, SC-112, SC-113; FR-257..FR-288).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real (node +
// SQLite em arquivo) e o frontend real (Vite dev) sobem como processos filhos
// do teste, em portas livres. Os Usuários são cadastrados pela API real, com
// Senhas geradas agora; todo o resto — renomear, trocar a Senha, excluir — é
// feito pelas telas reais do Chromium.

test.setTimeout(180_000);

interface Ambiente {
  enderecoDaApi: string;
  enderecoDoFrontend: string;
  encerrar: () => Promise<void>;
}

async function subirAmbiente(prefixo: string): Promise<Ambiente> {
  const pasta = await criarPastaTemporaria(prefixo);
  const portaDaApi = await portaLivre();
  const api: ProcessoIniciado = iniciarApi(
    join(pasta, "conta.sqlite"),
    portaDaApi,
  );
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

/** Abre uma página nova em contexto próprio, já em Preferências e logada. */
async function abrirPreferencias(
  browser: Browser,
  ambiente: Ambiente,
  credencial: CredencialDeProva,
): Promise<Page> {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();

  await pagina.goto(ambiente.enderecoDoFrontend);
  await entrarPelaUi(pagina, credencial);
  await pagina
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Preferências" })
    .click();
  await expect(
    pagina.getByRole("heading", { level: 2, name: "Minha conta" }),
  ).toBeVisible();

  return pagina;
}

/** O status de `GET /conta` com a Credencial, direto na API real. */
async function statusDaConta(
  enderecoDaApi: string,
  credencial: CredencialDeProva,
): Promise<number> {
  const resposta = await fetch(`${enderecoDaApi}/conta`, {
    headers: cabecalhoDeCredencial(credencial),
  });

  return resposta.status;
}

test("renomear mantém a pessoa na tela, recusa a Credencial antiga no segundo contexto e libera o nome (SC-106, SC-112, FR-263, FR-264)", async ({ browser }) => {
  const ambiente = await subirAmbiente("conta-nome-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");

    const primeira = await abrirPreferencias(browser, ambiente, ana);
    const segunda = await abrirPreferencias(browser, ambiente, ana);

    await primeira
      .getByRole("button", { name: "Alterar Nome de usuário" })
      .click();
    await primeira.getByLabel("Novo Nome de usuário").fill("ana.nova");
    await primeira.getByLabel("Senha atual", { exact: true }).fill(ana.senha);
    await primeira
      .getByRole("button", { name: "Alterar Nome de usuário" })
      .click();

    // Sem nova Entrada: a pessoa segue em Preferências, com o nome novo.
    await expect(primeira.getByText("Nome de usuário alterado.")).toBeVisible();
    await expect(primeira.getByText("ana.nova", { exact: true })).toBeVisible();
    await expect(
      primeira.getByRole("heading", { level: 1, name: "Preferências" }),
    ).toBeVisible();

    // A sessão aberta segue operando com a Credencial substituída.
    await primeira
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Cartões" })
      .click();
    await expect(
      primeira.getByRole("heading", { level: 1, name: "Cartões" }),
    ).toBeVisible();

    // A Credencial antiga é recusada na próxima operação do segundo contexto.
    await segunda
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Cartões" })
      .click();
    await expect(
      segunda.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
    await expect(segunda.getByRole("alert", { name: "Credencial recusada" })).toBeVisible();

    expect(await statusDaConta(ambiente.enderecoDaApi, ana)).toBe(401);
    expect(
      await statusDaConta(ambiente.enderecoDaApi, {
        nomeDeUsuario: "ana.nova",
        senha: ana.senha,
      }),
    ).toBe(200);

    // O nome antigo ficou livre para outro Cadastro.
    const outra = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "ana.silva",
    );

    expect(await statusDaConta(ambiente.enderecoDaApi, outra)).toBe(200);
  } finally {
    await ambiente.encerrar();
  }
});

test("trocar a Senha mantém a pessoa na tela e o segundo contexto volta a Entrar (SC-106, FR-270)", async ({ browser }) => {
  const ambiente = await subirAmbiente("conta-senha-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");

    const primeira = await abrirPreferencias(browser, ambiente, ana);
    const segunda = await abrirPreferencias(browser, ambiente, ana);
    const novaSenha = gerarSenhaDeProva();

    await primeira.getByRole("button", { name: "Trocar Senha" }).click();
    await primeira.getByLabel("Senha atual", { exact: true }).fill(ana.senha);
    await primeira.getByLabel("Nova Senha", { exact: true }).fill(novaSenha);
    await primeira
      .getByLabel("Confirmação da Senha", { exact: true })
      .fill(novaSenha);
    await primeira.getByRole("button", { name: "Trocar Senha" }).click();

    await expect(primeira.getByText("Senha trocada.")).toBeVisible();
    await expect(
      primeira.getByRole("heading", { level: 1, name: "Preferências" }),
    ).toBeVisible();

    await segunda
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Baralhos" })
      .click();
    await expect(
      segunda.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();

    expect(await statusDaConta(ambiente.enderecoDaApi, ana)).toBe(401);
    expect(
      await statusDaConta(ambiente.enderecoDaApi, {
        nomeDeUsuario: ana.nomeDeUsuario,
        senha: novaSenha,
      }),
    ).toBe(200);
  } finally {
    await ambiente.encerrar();
  }
});

test("excluir a conta remove tudo do Usuário, preserva o outro e libera o nome (SC-105, SC-111, SC-113, FR-274..FR-277)", async ({ browser }) => {
  const ambiente = await subirAmbiente("conta-excluir-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");
    const bruno = await criarUsuarioDeProva(
      ambiente.enderecoDaApi,
      "bruno.souza",
    );

    await criarCartaoPelaApi(
      ambiente.enderecoDaApi,
      { frente: "To walk", verso: "Caminhar" },
      ana,
    );
    await criarCartaoPelaApi(
      ambiente.enderecoDaApi,
      { frente: "To run", verso: "Correr" },
      ana,
    );
    await criarCartaoPelaApi(
      ambiente.enderecoDaApi,
      { frente: "To eat", verso: "Comer" },
      bruno,
    );

    const pagina = await abrirPreferencias(browser, ambiente, ana);

    await pagina.getByRole("button", { name: "Excluir conta" }).click();

    const dialogo = pagina.getByRole("dialog", { name: "Excluir conta?" });

    await expect(dialogo).toContainText("irreversível");
    // As contagens vêm do servidor e conferem com o que será removido.
    await expect(dialogo.getByText("2 Cartões")).toBeVisible();
    await expect(dialogo.getByText("0 Baralhos")).toBeVisible();
    await expect(dialogo.getByText("0 itens da Agenda")).toBeVisible();

    // Senha errada: mensagem única, nada excluído.
    await dialogo.getByLabel("Senha atual", { exact: true }).fill("errada-123");
    await dialogo.getByRole("button", { name: "Excluir conta" }).click();
    await expect(dialogo).toContainText("A Senha atual está incorreta.");
    expect(await statusDaConta(ambiente.enderecoDaApi, ana)).toBe(200);

    await dialogo.getByLabel("Senha atual", { exact: true }).fill(ana.senha);
    await dialogo.getByRole("button", { name: "Excluir conta" }).click();

    await expect(
      pagina.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
    await expect(
      pagina.getByRole("status", { name: "Conta excluída" }),
    ).toBeVisible();

    // Nada do Usuário excluído permanece; o outro segue idêntico.
    expect(await statusDaConta(ambiente.enderecoDaApi, ana)).toBe(401);

    const doBruno = await fetch(`${ambiente.enderecoDaApi}/conta`, {
      headers: cabecalhoDeCredencial(bruno),
    });

    expect(await doBruno.json()).toMatchObject({
      nomeDeUsuario: "bruno.souza",
      contagens: { cartoes: 1 },
    });

    // O nome excluído é aceito de novo e nenhum dado anterior aparece.
    const nova = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");
    const dadosDaNova = await fetch(`${ambiente.enderecoDaApi}/conta`, {
      headers: cabecalhoDeCredencial(nova),
    });

    expect(await dadosDaNova.json()).toMatchObject({
      nomeDeUsuario: "ana.silva",
      contagens: { cartoes: 0, baralhos: 0, registrosDeSessao: 0 },
    });
  } finally {
    await ambiente.encerrar();
  }
});

test("percorre «Minha conta» só por teclado, com foco visível e sem rolagem horizontal em 360, 390, 768 e 1440 px e com zoom de 200% (SC-109, FR-285)", async ({ browser }) => {
  const ambiente = await subirAmbiente("conta-teclado-");

  try {
    const ana = await criarUsuarioDeProva(ambiente.enderecoDaApi, "ana.silva");

    const pagina = await abrirPreferencias(browser, ambiente, ana);

    // Teclado: do botão «Alterar Nome de usuário» ao envio, sem mouse.
    const alterar = pagina.getByRole("button", {
      name: "Alterar Nome de usuário",
    });

    await alterar.focus();
    await pagina.keyboard.press("Enter");

    const campoDoNome = pagina.getByLabel("Novo Nome de usuário");

    await campoDoNome.focus();
    await pagina.keyboard.type("ana.teclado");
    await pagina.keyboard.press("Tab");
    await pagina.keyboard.type(ana.senha);
    await pagina.keyboard.press("Enter");

    await expect(pagina.getByText("Nome de usuário alterado.")).toBeVisible();
    // O foco volta ao botão que abriu a ação (FR-285).
    await expect(
      pagina.getByRole("button", { name: "Alterar Nome de usuário" }),
    ).toBeFocused();

    // O foco é identificável sem depender de cor: há contorno visível.
    const contorno = await pagina
      .getByRole("button", { name: "Alterar Nome de usuário" })
      .evaluate((elemento) => {
        const estilo = getComputedStyle(elemento);

        return {
          estilo: estilo.outlineStyle,
          largura: Number.parseFloat(estilo.outlineWidth),
        };
      });

    expect(contorno.estilo).not.toBe("none");
    expect(contorno.largura).toBeGreaterThan(0);

    // Larguras exigidas e zoom de 200% (1440 px a 200% ≈ 720 px de viewport).
    for (const largura of [360, 390, 720, 768, 1440]) {
      await pagina.setViewportSize({ width: largura, height: 900 });

      const medidas = await pagina.evaluate(() => ({
        rolagem: document.documentElement.scrollWidth,
        largura: document.documentElement.clientWidth,
        alvos: Array.from(
          document.querySelectorAll<HTMLElement>("main button"),
        ).map((botao) => botao.getBoundingClientRect().height),
      }));

      expect(medidas.rolagem, `rolagem em ${largura}px`).toBeLessThanOrEqual(
        medidas.largura,
      );

      for (const altura of medidas.alvos) {
        expect(altura, `alvo em ${largura}px`).toBeGreaterThanOrEqual(44);
      }
    }
  } finally {
    await ambiente.encerrar();
  }
});
