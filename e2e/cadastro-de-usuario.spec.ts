import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page, Response as RespostaDaPagina } from "@playwright/test";

import {
  aguardarProntidao,
  cadastrarUsuarioPelaApi,
  criarPastaTemporaria,
  encerrarProcesso,
  iniciarApi,
  iniciarFrontend,
  portaLivre,
  removerPastaTemporaria,
} from "./servidores-locais";
import type { ProcessoIniciado } from "./servidores-locais";

// T614 — prova E2E real de Cadastro, persistência e ausência de estado no
// navegador (FR-040, FR-078, FR-079, SC-023; specs/007-criar-usuario/tasks.md).
//
// Nenhuma rede é interceptada e nenhum dado é fabricado: a API real (node +
// SQLite em arquivo) e o frontend real (Vite dev) são iniciados como processos
// filhos do próprio teste, em portas livres e com um arquivo SQLite temporário
// exclusivo. No Chromium, dois Usuários são criados pela tela real "Criar
// conta"; API e frontend são então encerrados e reiniciados apontando para o
// mesmo arquivo, e os dois Nomes de usuário precisam continuar existindo — a
// recusa de duplicata prova a persistência pela superfície da aplicação. Depois
// do Cadastro não existe cookie, `localStorage` nem `sessionStorage`, e a
// resposta do Cadastro não traz credencial reutilizável.
//
// A Senha usada nas provas é gerada agora com `randomBytes`: nenhum valor
// literal de Senha é versionado (Princípio VIII).

const PRIMEIRO_USUARIO = "Ana.Silva";
const SEGUNDO_USUARIO = "bruno.souza";

/** Senha das duas provas, gerada por execução, sem valor literal no arquivo. */
const SENHA_DOS_USUARIOS = randomBytes(12).toString("base64url");

test.setTimeout(120_000);

test("Cadastro pela UI persiste após reiniciar API e frontend, sem cookie nem dado do navegador (FR-040, FR-078, FR-079, SC-023)", async ({ page, context, browserName }) => {
  // Navegador real: Chromium, sem DOM simulado.
  expect(browserName).toBe("chromium");

  const pasta = await criarPastaTemporaria("cadastro-t614-");
  const caminhoDoBanco = join(pasta, "cadastro.sqlite");

  let api: ProcessoIniciado | null = null;
  let frontend: ProcessoIniciado | null = null;

  try {
    // Primeira execução: API com arquivo SQLite temporário exclusivo e
    // frontend real, cada um em porta livre e aguardando prontidão.
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

    // A tela "Criar conta" é alcançada pela navegação principal da aplicação.
    await page.goto(`${enderecoDoFrontend}/#/cartoes`);

    await expect(page.getByRole("link", { name: "Criar conta" })).toBeVisible();
    await page.getByRole("link", { name: "Criar conta" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Criar conta" }),
    ).toBeVisible();

    // Primeiro Cadastro, com a resposta do próprio navegador capturada: é
    // essa resposta que precisa não trazer credencial reutilizável (FR-079).
    const respostaDoCadastro = await cadastrarPelaUi(
      page,
      PRIMEIRO_USUARIO,
      SENHA_DOS_USUARIOS,
    );

    expect(respostaDoCadastro.status()).toBe(201);
    expect(respostaDoCadastro.headers()["set-cookie"]).toBeUndefined();
    expect(await respostaDoCadastro.text()).not.toContain(SENHA_DOS_USUARIOS);

    const corpoDoCadastro = (await respostaDoCadastro.json()) as Record<
      string,
      unknown
    >;

    // A resposta carrega apenas o Usuário: nenhum campo derivado da Senha.
    expect(Object.keys(corpoDoCadastro).sort()).toEqual([
      "id",
      "nomeDeUsuario",
    ]);
    expect(corpoDoCadastro.nomeDeUsuario).toBe(PRIMEIRO_USUARIO);

    await expect(
      page.getByRole("status", { name: "Cadastro concluído" }),
    ).toContainText(`O Usuário ${PRIMEIRO_USUARIO} foi criado.`);

    // Os valores de Senha saem da tela depois do sucesso (FR-078).
    await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("");

    await expect(
      page.getByLabel("Confirmação da Senha", { exact: true }),
    ).toHaveValue("");

    // Segundo Cadastro, pela mesma tela.
    await cadastrarPelaUi(page, SEGUNDO_USUARIO, SENHA_DOS_USUARIOS);

    await expect(
      page.getByRole("status", { name: "Cadastro concluído" }),
    ).toContainText(`O Usuário ${SEGUNDO_USUARIO} foi criado.`);

    // FR-078 e FR-079: depois do Cadastro não existe cookie, `localStorage`
    // nem `sessionStorage` — nada foi gravado no navegador.
    const armazenamentoDoNavegador = await page.evaluate(() => ({
      cookie: document.cookie,
      local: Object.keys(window.localStorage),
      sessao: Object.keys(window.sessionStorage),
    }));

    expect(armazenamentoDoNavegador.cookie).toBe("");
    expect(armazenamentoDoNavegador.local).toEqual([]);
    expect(armazenamentoDoNavegador.sessao).toEqual([]);
    expect(await context.cookies()).toEqual([]);

    // Encerrar os dois processos...
    await encerrarProcesso(frontend);
    frontend = null;

    await encerrarProcesso(api);
    api = null;

    // ...e reiniciar ambos apontando para o mesmo arquivo SQLite, nas
    // mesmas portas.
    api = iniciarApi(caminhoDoBanco, portaDaApi);

    await aguardarApiPronta(api, enderecoDaApi);

    frontend = iniciarFrontend(portaDoFrontend, enderecoDaApi);

    await aguardarProntidao(
      frontend,
      enderecoDoFrontend,
      (resposta) => resposta.ok,
    );

    // Reabrir a UI: a recarga explícita descarta o documento anterior — e, com
    // ele, a reconexão pendente do cliente do Vite com o servidor que acabou
    // de voltar. Sem ela, a recarga automática do cliente do Vite poderia
    // acontecer no meio de um Cadastro e apagar o que foi digitado.
    await page.reload();

    await expect(
      page.getByRole("heading", { level: 1, name: "Criar conta" }),
    ).toBeVisible();

    // Os dois Nomes de usuário continuam existindo — cada tentativa de
    // cadastrá-los de novo é recusada como duplicata, inclusive quando só a
    // caixa difere (FR-074, SC-023, SC-025).
    await tentarCadastroDuplicadoPelaUi(page, "ana.silva", SENHA_DOS_USUARIOS);
    await tentarCadastroDuplicadoPelaUi(
      page,
      SEGUNDO_USUARIO,
      SENHA_DOS_USUARIOS,
    );

    // Persistência exata conferida também direto na API: o mesmo Nome de
    // usuário já existe, e a recusa não devolve credencial alguma.
    for (const nomeDeUsuario of [PRIMEIRO_USUARIO, SEGUNDO_USUARIO]) {
      const resposta = await cadastrarUsuarioPelaApi(enderecoDaApi, {
        nomeDeUsuario,
        senha: SENHA_DOS_USUARIOS,
      });

      expect(resposta.status).toBe(409);
      expect(resposta.cabecalhos.get("set-cookie")).toBeNull();
      expect(JSON.stringify(resposta.corpo)).not.toContain(SENHA_DOS_USUARIOS);
      expect(resposta.corpo).toEqual({
        erro: "nome_de_usuario_existente",
        mensagem: "Este nome de usuário já existe. Escolha outro.",
      });
    }

    // E o Cadastro que nunca existiu continua sendo aceito: a persistência é
    // dos Usuários criados, não de uma recusa genérica.
    const novo = await cadastrarUsuarioPelaApi(enderecoDaApi, {
      nomeDeUsuario: "carla.souza",
      senha: SENHA_DOS_USUARIOS,
    });

    expect(novo.status).toBe(201);
    expect(novo.corpo).toEqual({
      id: expect.any(String),
      nomeDeUsuario: "carla.souza",
    });
  } finally {
    // Encerrar sempre, mesmo quando a prova falha no meio, e remover o
    // arquivo e a pasta temporários.
    await encerrarProcesso(frontend);
    await encerrarProcesso(api);
    await removerPastaTemporaria(pasta);
  }
});

/**
 * Cadastra um Usuário pela tela real: preenche os três campos e submete com o
 * botão, devolvendo a resposta do `POST /usuarios` que a interface disparou.
 */
async function cadastrarPelaUi(
  page: Page,
  nomeDeUsuario: string,
  senha: string,
): Promise<RespostaDaPagina> {
  await page
    .getByLabel("Nome de usuário", { exact: true })
    .fill(nomeDeUsuario);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByLabel("Confirmação da Senha", { exact: true }).fill(senha);

  const [resposta] = await Promise.all([
    page.waitForResponse(
      (candidata) =>
        candidata.url().endsWith("/usuarios") &&
        candidata.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Criar conta" }).click(),
  ]);

  return resposta;
}

/**
 * Tenta cadastrar um Nome de usuário já existente pela tela real: **nada é
 * enviado** quando a Confirmação diverge, mas aqui as duas Senhas coincidem, e
 * o que se espera é a recusa vinda da API.
 */
async function tentarCadastroDuplicadoPelaUi(
  page: Page,
  nomeDeUsuario: string,
  senha: string,
): Promise<void> {
  await page
    .getByLabel("Nome de usuário", { exact: true })
    .fill(nomeDeUsuario);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByLabel("Confirmação da Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(
    page.getByRole("alert", { name: "Falha no Cadastro" }),
  ).toContainText("Este nome de usuário já existe. Escolha outro.");
  await expect(
    page.getByRole("status", { name: "Cadastro concluído" }),
  ).toHaveCount(0);

  // O conteúdo digitado permanece, e nenhuma conclusão é anunciada (FR-045).
  await expect(
    page.getByLabel("Nome de usuário", { exact: true }),
  ).toHaveValue(nomeDeUsuario);
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue(senha);
}

/** Aguarda a API responder `{ status: "ok" }` no `/health`. */
async function aguardarApiPronta(
  api: ProcessoIniciado,
  enderecoDaApi: string,
): Promise<void> {
  await aguardarProntidao(api, `${enderecoDaApi}/health`, async (resposta) => {
    if (!resposta.ok) {
      return false;
    }

    const corpo = (await resposta.json()) as { status?: unknown };

    return corpo.status === "ok";
  });
}
