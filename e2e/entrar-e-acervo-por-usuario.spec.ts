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
  entrarPelaUi,
  iniciarApi,
  iniciarFrontend,
  listarCartoesComBaralhosPelaApi,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { CredencialDeProva, ProcessoIniciado } from "./servidores-locais";

// T716 — prova E2E real de Entrar, do acervo por Usuário e de Sair
// (FR-079, FR-078, FR-089, FR-092, FR-094; SC-030, SC-031, SC-033, SC-034;
// specs/008-entrar/tasks.md).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real (node +
// SQLite em arquivo) e o frontend real (Vite dev) são iniciados como processos
// filhos do próprio teste, em portas livres e com um arquivo SQLite temporário
// exclusivo. No Chromium, dois Usuários entram em abas diferentes: cada um vê
// só o seu acervo, o id do vizinho responde como inexistente, recarregar exige
// Entrar de novo, Sair seguido do voltar do navegador não exibe o acervo, e
// nenhuma Credencial aparece em `localStorage`, `sessionStorage`, cookie ou
// endereço.
//
// As Senhas das duas Credenciais são geradas agora com `randomBytes`, pelo
// auxiliar de Cadastro: nenhum valor literal de Senha é versionado.

const CARTAO_DA_ANA = {
  frente: "To walk",
  verso: "Caminhar",
} as const;

test.setTimeout(120_000);

test("dois Usuários não se enxergam, recarregar exige Entrar, Sair com o voltar não exibe o acervo e a Credencial não fica no navegador (FR-078, FR-079, FR-089, FR-092, FR-094; SC-030, SC-031, SC-033, SC-034)", async ({ page, browserName }) => {
  expect(browserName).toBe("chromium");

  const pasta = await criarPastaTemporaria("entrar-t716-");
  const caminhoDoBanco = join(pasta, "entrar.sqlite");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(caminhoDoBanco, portaDaApi);

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

    // Dois Usuários reais, cada um com a sua Credencial gerada agora (FR-097).
    const credencialDaAna = await criarUsuarioDeProva(
      enderecoDaApi,
      "ana.silva",
    );
    const credencialDoBruno = await criarUsuarioDeProva(
      enderecoDaApi,
      "bruno.souza",
    );

    // A primeira e única tela sem Credencial é "Entrar", com o acesso a
    // "Criar conta" e sem navegação para o acervo (FR-097, SC-027).
    await page.goto(enderecoDoFrontend);

    await expect(
      page.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Criar conta" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cartões" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(
      0,
    );

    // Ana entra; o Cartão dela pertence ao Baralho desde a criação (spec 025).
    //
    // 018: a continuidade é desmarcada — esta prova é a da Credencial que vive
    // só na memória da página (FR-089, SC-031); o Acesso temporário tem a sua
    // prova própria em `acesso-temporario.spec.ts`.
    await entrarPelaUi(page, credencialDaAna, { continuarConectado: false });

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Olá, ${credencialDaAna.nomeDeUsuario}`,
      }),
    ).toBeVisible();

    const baralhoDaAna = await criarBaralhoPelaApi(enderecoDaApi, { nome: "Inglês" }, credencialDaAna);
    const cartaoDaAna = await criarCartaoNoBaralhoPelaApi(
      enderecoDaApi, baralhoDaAna.id, CARTAO_DA_ANA, credencialDaAna,
    );
    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralhoDaAna.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Inglês" })).toBeVisible();
    await expect(page.getByText(CARTAO_DA_ANA.frente)).toBeVisible();

    // O acervo é por Usuário: cada Credencial alcança apenas o seu (SC-030).
    const cartoesDaAna = await listarCartoesComBaralhosPelaApi(
      enderecoDaApi,
      credencialDaAna,
    );
    const cartoesDoBruno = await listarCartoesComBaralhosPelaApi(
      enderecoDaApi,
      credencialDoBruno,
    );

    expect(cartoesDaAna).toHaveLength(1);
    expect(cartoesDaAna[0].frente).toBe(CARTAO_DA_ANA.frente);
    expect(cartoesDaAna[0].id).toBe(cartaoDaAna.id);
    expect(cartoesDoBruno).toEqual([]);

    // O id do vizinho responde como inexistente: mesmo status, mesmo corpo de
    // um id que nunca existiu, e nada muda (FR-092, SC-030).
    const acervoDoVizinho = await fetch(
      `${enderecoDaApi}/cartoes/${encodeURIComponent(cartoesDaAna[0].id)}`,
      {
        method: "DELETE",
        headers: cabecalhoDeCredencial(credencialDoBruno),
      },
    );
    const idInexistente = await fetch(
      `${enderecoDaApi}/cartoes/c-que-nunca-existiu`,
      {
        method: "DELETE",
        headers: cabecalhoDeCredencial(credencialDoBruno),
      },
    );

    expect(acervoDoVizinho.status).toBe(404);
    expect(acervoDoVizinho.status).toBe(idInexistente.status);
    expect(await acervoDoVizinho.json()).toEqual(await idInexistente.json());

    // E o Cartão da Ana continua existindo.
    expect(
      await listarCartoesComBaralhosPelaApi(enderecoDaApi, credencialDaAna),
    ).toEqual(cartoesDaAna);

    // Depois de Entrar, nada da Credencial está no navegador: nem em
    // `localStorage`, nem em `sessionStorage`, nem em cookie, nem no endereço
    // (FR-078, FR-079, SC-033).
    const estadoDoNavegador = await page.evaluate(() => ({
      cookie: document.cookie,
      local: Object.keys(window.localStorage),
      sessao: Object.keys(window.sessionStorage),
      endereco: window.location.href,
    }));

    expect(estadoDoNavegador.cookie).toBe("");
    expect(estadoDoNavegador.local).toEqual([]);
    expect(estadoDoNavegador.sessao).toEqual([]);
    expect(estadoDoNavegador.endereco).not.toContain(
      credencialDaAna.nomeDeUsuario,
    );
    expect(estadoDoNavegador.endereco).not.toContain(credencialDaAna.senha);

    // A resposta de Entrar não publica o diálogo nativo de autenticação, e o
    // único valor que ela entrega — o Acesso temporário, quando a continuidade
    // vale — vai em cookie `HttpOnly` e `SameSite=Strict`, nunca no corpo
    // (FR-079 revisado, FR-297). A rota de acervo sem Credencial é recusada sem
    // convidar o navegador a guardá-la (FR-089).
    const respostaDoEntrar = await fetch(`${enderecoDaApi}/entrar`, {
      method: "POST",
      headers: cabecalhoDeCredencial(credencialDaAna),
    });

    expect(respostaDoEntrar.status).toBe(200);
    expect(respostaDoEntrar.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(respostaDoEntrar.headers.get("set-cookie")).toMatch(
      /SameSite=Strict/,
    );
    expect(respostaDoEntrar.headers.get("www-authenticate")).toBeNull();
    expect(JSON.stringify(await respostaDoEntrar.json())).not.toMatch(
      /acesso=/,
    );

    const semCredencial = await fetch(`${enderecoDaApi}/cartoes`);

    expect(semCredencial.status).toBe(401);
    expect(semCredencial.headers.get("www-authenticate")).toBeNull();
    expect(semCredencial.headers.get("set-cookie")).toBeNull();

    // Recarregar exige Entrar de novo: a Credencial vivia só na memória da
    // página aberta (FR-089, SC-031).
    await page.reload();

    await expect(
      page.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(
      0,
    );
    await expect(page.getByText(CARTAO_DA_ANA.frente)).toHaveCount(0);

    // Entrar de novo devolve o acervo como estava (FR-094): a Credencial volta
    // a valer e a navegação principal reaparece. O destino depois de Entrar é
    // Início (spec 013) — mas a aplicação Entra mostrando a rota que estiver no
    // hash, e o reload conservou o detalhe anterior; voltar à
    // raiz antes de Entrar é o que põe o destino em Início sob teste. Depois,
    // navegar por Baralhos e de volta a Cartões confirma que o acervo continua
    // o mesmo, com o Cartão da Ana.
    await page.goto(enderecoDoFrontend);

    await entrarPelaUi(page, credencialDaAna);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Olá, ${credencialDaAna.nomeDeUsuario}`,
      }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Baralhos", exact: true }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Baralhos" }),
    ).toBeVisible();

    await page.goto(`${enderecoDoFrontend}/#/baralhos/${baralhoDaAna.id}`);
    await expect(page.getByText(CARTAO_DA_ANA.frente)).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(1);

    // Sair descarta a Credencial e volta a "Entrar", e o voltar do navegador
    // não traz nenhum conteúdo do acervo de volta (FR-094, SC-034).
    await page.getByRole("button", { name: "Sair" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
    await expect(page.getByText(CARTAO_DA_ANA.frente)).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(
      0,
    );

    await page.goBack();

    await expect(
      page.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();
    await expect(page.getByText(CARTAO_DA_ANA.frente)).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(
      0,
    );
  } finally {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});

test("duas abas mantêm Credenciais independentes: Sair numa não descarta a da outra (FR-089)", async ({ page, context, browserName }) => {
  expect(browserName).toBe("chromium");

  const pasta = await criarPastaTemporaria("entrar-abas-t716-");
  const caminhoDoBanco = join(pasta, "abas.sqlite");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    const portaDaApi = await portaLivre();

    api = iniciarApi(caminhoDoBanco, portaDaApi);

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

    const credencialDaAna: CredencialDeProva = await criarUsuarioDeProva(
      enderecoDaApi,
      "ana.silva",
    );
    const credencialDoBruno: CredencialDeProva = await criarUsuarioDeProva(
      enderecoDaApi,
      "bruno.souza",
    );

    // A segunda aba é outra página do mesmo contexto — como a segunda aba de
    // um navegador —, e Entra com a sua própria Credencial.
    const segundaAba = await context.newPage();

    // 018: abas do mesmo navegador dividem o cookie do Acesso; para a
    // Credencial ser independente em cada aba (FR-089), a continuidade é
    // desmarcada nas duas.
    await page.goto(enderecoDoFrontend);
    await entrarPelaUi(page, credencialDaAna, { continuarConectado: false });

    await segundaAba.goto(enderecoDoFrontend);
    await entrarPelaUi(segundaAba, credencialDoBruno, {
      continuarConectado: false,
    });

    // Sair numa aba não descarta a Credencial da outra.
    await page.getByRole("button", { name: "Sair" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeVisible();

    await expect(
      segundaAba.getByRole("heading", {
        level: 1,
        name: `Olá, ${credencialDoBruno.nomeDeUsuario}`,
      }),
    ).toBeVisible();
    await expect(
      segundaAba.getByRole("navigation", { name: "Principal" }),
    ).toBeVisible();

    // E a aba que saiu pode Entrar de novo, com a Credencial dela.
    await entrarPelaUi(page, credencialDaAna);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Olá, ${credencialDaAna.nomeDeUsuario}`,
      }),
    ).toBeVisible();

    await segundaAba.close();
  } finally {
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});
