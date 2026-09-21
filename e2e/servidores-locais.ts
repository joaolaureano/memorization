import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

// T014 — suporte de execução para a prova E2E real de persistência
// (FR-040, SC-003; specs/001-criar-cartao/tasks.md).
//
// Inicia a API real (node + SQLite em arquivo) e o frontend real (Vite dev)
// como processos filhos do teste, em portas livres e com arquivo SQLite
// temporário exclusivo, e aguarda a prontidão de cada um antes de liberá-los
// ao teste. O encerramento é sempre explícito: `encerrarProcesso` é chamado
// no `finally` do teste, inclusive quando a prova falha no meio.

const RAIZ_DO_REPOSITORIO = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * O segredo do servidor das Senhas desta execução da suíte (T606, FR-077):
 * **gerado agora** com `randomBytes` e nunca versionado. Ele é criado uma única
 * vez, aqui, e reusado em todos os reinícios da API — o segredo precisa ser o
 * mesmo para uma mesma base, e os cenários de persistência reiniciam a API sobre
 * o mesmo arquivo. Nenhum valor literal de segredo existe neste arquivo.
 */
const SEGREDO_DAS_SENHAS = randomBytes(48).toString("base64url");

/**
 * Nome de usuário do Usuário de prova padrão (T715;
 * specs/008-entrar/tasks.md). Depois de `008-entrar`, toda prova de acervo
 * precisa de uma Credencial: este é o Usuário que os auxiliares cadastram
 * quando a prova não pede um nome próprio. A Senha é gerada a cada execução.
 */
export const NOME_DE_USUARIO_DE_PROVA = "usuario.de.prova";

/**
 * A Credencial de prova: o par Nome de usuário e Senha que acompanha cada
 * requisição, no cabeçalho `Authorization: Basic` (FR-090). Ela vive apenas no
 * processo do teste — a aplicação não guarda Credencial em lugar nenhum
 * (FR-079, SC-033).
 */
export interface CredencialDeProva {
  nomeDeUsuario: string;
  senha: string;
}

/** Uma Senha gerada agora: nenhum valor literal de Senha é versionado. */
export function gerarSenhaDeProva(): string {
  return randomBytes(12).toString("base64url");
}

/**
 * O cabeçalho da Credencial, no formato do contrato
 * (`specs/008-entrar/contracts/api-entrar.md`):
 * `Basic base64(nomeDeUsuario:senha)`, codificado em UTF-8.
 */
export function cabecalhoDeCredencial(
  credencial: CredencialDeProva,
): Record<string, string> {
  const valor = Buffer.from(
    `${credencial.nomeDeUsuario}:${credencial.senha}`,
    "utf8",
  ).toString("base64");

  return { authorization: `Basic ${valor}` };
}

/**
 * A Credencial que os auxiliares apresentam quando a prova não informa outra: a
 * do último Usuário de prova cadastrado por `criarUsuarioDeProva`.
 */
let credencialDeProvaAtual: CredencialDeProva | null = null;

/** A Credencial de prova corrente do arquivo de prova. */
export function credencialDeProva(): CredencialDeProva {
  if (credencialDeProvaAtual === null) {
    throw new Error(
      "nenhum Usuário de prova foi cadastrado nesta prova: chame criarUsuarioDeProva antes",
    );
  }

  return credencialDeProvaAtual;
}

/** Mantém apenas as últimas linhas da saída, para relatar falhas sem crescer sem limite. */
const LIMITE_DE_LINHAS_DE_SAIDA = 200;

export interface ProcessoIniciado {
  processo: ChildProcess;
  rotulo: string;
  saida: string[];
}

interface OpcoesDeProcesso {
  rotulo: string;
  comando: string;
  argumentos: string[];
  diretorio: string;
  ambiente: NodeJS.ProcessEnv;
}

function iniciarProcesso(opcoes: OpcoesDeProcesso): ProcessoIniciado {
  const processo = spawn(opcoes.comando, opcoes.argumentos, {
    cwd: opcoes.diretorio,
    env: { ...process.env, ...opcoes.ambiente },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const registrado: ProcessoIniciado = {
    processo,
    rotulo: opcoes.rotulo,
    saida: [],
  };

  processo.stdout?.setEncoding("utf8");
  processo.stderr?.setEncoding("utf8");
  processo.stdout?.on("data", (pedaco: string) => registrar(pedaco, registrado));
  processo.stderr?.on("data", (pedaco: string) => registrar(pedaco, registrado));

  return registrado;
}

function registrar(pedaco: string, registrado: ProcessoIniciado): void {
  for (const linha of pedaco.split("\n")) {
    if (linha.trim().length > 0) {
      registrado.saida.push(linha);

      if (registrado.saida.length > LIMITE_DE_LINHAS_DE_SAIDA) {
        registrado.saida.shift();
      }
    }
  }
}

function relatar(registrado: ProcessoIniciado): string {
  const linhas = registrado.saida.slice(-30);

  return linhas.length === 0 ? "(sem saída capturada)" : linhas.join("\n");
}

function encerrado(processo: ChildProcess): boolean {
  return processo.exitCode !== null || processo.signalCode !== null;
}

/**
 * Devolve uma porta livre do loopback, escolhida pelo sistema operacional.
 * A sondagem fecha o socket antes de devolver, então existe uma janela
 * mínima de corrida; o teste a reduz iniciando a API antes de sondar a porta
 * do frontend — a porta já ocupada nunca é devolvida de novo.
 */
export async function portaLivre(): Promise<number> {
  return await new Promise((resolver, recusar) => {
    const sondagem = createServer();

    sondagem.once("error", recusar);
    sondagem.listen(0, "127.0.0.1", () => {
      const endereco = sondagem.address();

      if (endereco === null || typeof endereco === "string") {
        recusar(new Error("não foi possível determinar a porta livre"));
        return;
      }

      sondagem.close(() => resolver((endereco as AddressInfo).port));
    });
  });
}

/**
 * Aguarda o processo responder com sucesso, sondando até `tempoMaximo`. Se o
 * processo encerrar antes de responder, falha com a saída capturada — o
 * `finally` do teste ainda encerra o outro processo.
 */
export async function aguardarProntidao(
  registrado: ProcessoIniciado,
  endereco: string,
  pronto: (resposta: Response) => Promise<boolean> | boolean,
  tempoMaximo = 30_000,
): Promise<void> {
  const inicio = Date.now();
  let ultimaFalha = "";

  while (Date.now() - inicio < tempoMaximo) {
    if (encerrado(registrado.processo)) {
      throw new Error(
        `${registrado.rotulo} encerrou antes de ficar pronto.\n${relatar(registrado)}`,
      );
    }

    try {
      const resposta = await fetch(endereco);

      if (await pronto(resposta)) {
        return;
      }

      ultimaFalha = `status ${resposta.status}`;
    } catch (erro) {
      ultimaFalha = erro instanceof Error ? erro.message : String(erro);
    }

    await new Promise((resolver) => setTimeout(resolver, 200));
  }

  throw new Error(
    `${registrado.rotulo} não respondeu em ${tempoMaximo}ms (${endereco}; última falha: ${ultimaFalha}).\n${relatar(registrado)}`,
  );
}

/**
 * Aguarda a API responder `{ status: "ok" }` no `/health`. É a mesma
 * prontidão usada pelas provas reais de persistência e, agora, também pelas
 * provas de edição e exclusão: a API é real e precisa estar de pé antes de o
 * navegador começar a conversar com ela.
 */
export async function aguardarApiPronta(
  api: ProcessoIniciado,
  enderecoDaApi: string,
): Promise<void> {
  await aguardarProntidao(
    api,
    `${enderecoDaApi}/health`,
    async (resposta) => {
      if (!resposta.ok) {
        return false;
      }

      const corpo = (await resposta.json()) as { status?: unknown };

      return corpo.status === "ok";
    },
  );
}

/**
 * Inicia a API real sobre `caminhoDoBanco` — a mesma raiz de composição local
 * da aplicação (`backend/src/entradas/local.ts`, a entrada da execução local),
 * sem `--watch`: o processo é filho do teste e o teste controla seu ciclo de
 * vida inteiro. É o único lugar que importa o Adapter do armazenamento local;
 * a linha de início que ela imprime informa o armazenamento em uso.
 */
export function iniciarApi(
  caminhoDoBanco: string,
  porta: number,
): ProcessoIniciado {
  return iniciarProcesso({
    rotulo: "API",
    comando: process.execPath,
    argumentos: [
      join(RAIZ_DO_REPOSITORIO, "backend", "src", "entradas", "local.ts"),
    ],
    diretorio: join(RAIZ_DO_REPOSITORIO, "backend"),
    ambiente: {
      PORTA: String(porta),
      CAMINHO_DO_BANCO: caminhoDoBanco,
      /** Sem o segredo a API recusa iniciar (FR-077): ele vai em toda subida. */
      SEGREDO_DAS_SENHAS,
    },
  });
}

/**
 * Inicia o frontend real — o Vite dev da aplicação — apontando
 * `VITE_ENDERECO_DA_API` para a API do teste. O binário do Vite é invocado
 * diretamente (sem `npm run`) para que encerrar o processo filho encerre o
 * servidor de verdade, sem intermediários órfãos.
 */
export function iniciarFrontend(
  porta: number,
  enderecoDaApi: string,
): ProcessoIniciado {
  return iniciarProcesso({
    rotulo: "frontend",
    comando: process.execPath,
    argumentos: [
      join(
        RAIZ_DO_REPOSITORIO,
        "frontend",
        "node_modules",
        "vite",
        "bin",
        "vite.js",
      ),
      "--host",
      "127.0.0.1",
      "--port",
      String(porta),
      "--strictPort",
    ],
    diretorio: join(RAIZ_DO_REPOSITORIO, "frontend"),
    ambiente: { VITE_ENDERECO_DA_API: enderecoDaApi },
  });
}

/**
 * Encerra o processo com SIGTERM e, se ele não terminar em 5s, com SIGKILL.
 * Aguarda a saída efetiva para que a porta fique livre antes de um possível
 * reinício. Processo já encerrado é ignorado: o teste pode chamar no
 * `finally` sem rastrear o estado.
 */
export async function encerrarProcesso(
  registrado: ProcessoIniciado | null,
): Promise<void> {
  if (registrado === null) {
    return;
  }

  const processo = registrado.processo;

  if (encerrado(processo)) {
    return;
  }

  const saiu = once(processo, "exit").then(() => undefined);

  processo.kill("SIGTERM");

  await Promise.race([
    saiu,
    new Promise<void>((resolver) => {
      setTimeout(() => {
        if (!encerrado(processo)) {
          processo.kill("SIGKILL");
        }

        resolver();
      }, 5_000);
    }),
  ]);

  await Promise.race([
    saiu,
    new Promise<void>((resolver) => setTimeout(resolver, 10_000)),
  ]);
}

/**
 * Lê um Baralho direto da API com os Cartões vinculados — a conferência de
 * persistência exata de Vínculos (os mesmos ids, a mesma elegibilidade e os
 * mesmos Cartões), além da conferência pela UI.
 */
export async function obterBaralhoPelaApi(
  enderecoDaApi: string,
  id: string,
  credencial: CredencialDeProva = credencialDeProva(),
): Promise<{
  id: string;
  nome: string;
  elegivel: boolean;
  cartoes: { id: string; frente: string; verso: string }[];
}> {
  const resposta = await fetch(
    `${enderecoDaApi}/baralhos/${encodeURIComponent(id)}`,
    { headers: cabecalhoDeCredencial(credencial) },
  );

  if (!resposta.ok) {
    throw new Error(`GET /baralhos/${id} respondeu ${resposta.status}`);
  }

  return (await resposta.json()) as {
    id: string;
    nome: string;
    elegivel: boolean;
    cartoes: { id: string; frente: string; verso: string }[];
  };
}

/**
 * Lê os Cartões direto da API — a conferência de persistência exata (os
 * mesmos ids, Frentes e Versos), além da conferência pela UI.
 */
export async function listarCartoesPelaApi(
  enderecoDaApi: string,
  credencial: CredencialDeProva = credencialDeProva(),
): Promise<{ id: string; frente: string; verso: string }[]> {
  const resposta = await fetch(`${enderecoDaApi}/cartoes`, {
    headers: cabecalhoDeCredencial(credencial),
  });

  if (!resposta.ok) {
    throw new Error(`GET /cartoes respondeu ${resposta.status}`);
  }

  return (await resposta.json()) as {
    id: string;
    frente: string;
    verso: string;
  }[];
}

/**
 * Lê os Baralhos direto da API — a conferência de persistência exata (os
 * mesmos ids, nomes e elegibilidade derivada), além da conferência pela UI.
 */
export async function listarBaralhosPelaApi(
  enderecoDaApi: string,
  credencial: CredencialDeProva = credencialDeProva(),
): Promise<
  {
    id: string;
    nome: string;
    quantidadeDeCartoes: number;
    elegivel: boolean;
  }[]
> {
  const resposta = await fetch(`${enderecoDaApi}/baralhos`, {
    headers: cabecalhoDeCredencial(credencial),
  });

  if (!resposta.ok) {
    throw new Error(`GET /baralhos respondeu ${resposta.status}`);
  }

  return (await resposta.json()) as {
    id: string;
    nome: string;
    quantidadeDeCartoes: number;
    elegivel: boolean;
  }[];
}

/**
 * Cria um Cartão direto pela API — usado quando a prova não quer depender da
 * UI para preparar o acervo. Mantém o mesmo corpo do contrato `POST /cartoes`
 * e confere o status de sucesso esperado.
 */
export async function criarCartaoPelaApi(
  enderecoDaApi: string,
  cartao: { frente: string; verso: string },
  credencial: CredencialDeProva = credencialDeProva(),
): Promise<{ id: string; frente: string; verso: string }> {
  const resposta = await fetch(`${enderecoDaApi}/cartoes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...cabecalhoDeCredencial(credencial),
    },
    body: JSON.stringify(cartao),
  });

  if (resposta.status !== 201) {
    throw new Error(`POST /cartoes respondeu ${resposta.status}`);
  }

  return (await resposta.json()) as {
    id: string;
    frente: string;
    verso: string;
  };
}

/**
 * Cria um Baralho direto pela API — usado quando a prova não quer depender da
 * UI para preparar o acervo. Recebe o mesmo corpo do contrato `POST /baralhos`
 * e confere o status de sucesso esperado.
 */
export async function criarBaralhoPelaApi(
  enderecoDaApi: string,
  baralho: { nome: string },
  credencial: CredencialDeProva = credencialDeProva(),
): Promise<{ id: string; nome: string }> {
  const resposta = await fetch(`${enderecoDaApi}/baralhos`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...cabecalhoDeCredencial(credencial),
    },
    body: JSON.stringify(baralho),
  });

  if (resposta.status !== 201) {
    throw new Error(`POST /baralhos respondeu ${resposta.status}`);
  }

  return (await resposta.json()) as { id: string; nome: string };
}

/**
 * Vincula um Cartão existente a um Baralho existente direto na API real.
 * Recebe `cartaoId` e `baralhoId`, nessa ordem, e mantém o corpo do contrato
 * `POST /baralhos/{baralhoId}/vinculos`.
 */
export async function vincularCartaoPelaApi(
  enderecoDaApi: string,
  cartaoId: string,
  baralhoId: string,
  credencial: CredencialDeProva = credencialDeProva(),
): Promise<void> {
  const resposta = await fetch(
    `${enderecoDaApi}/baralhos/${encodeURIComponent(baralhoId)}/vinculos`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...cabecalhoDeCredencial(credencial),
      },
      body: JSON.stringify({ cartaoId }),
    },
  );

  if (resposta.status !== 201) {
    throw new Error(
      `POST /baralhos/${baralhoId}/vinculos respondeu ${resposta.status}`,
    );
  }
}

/**
 * Lê os Cartões direto da API na forma completa publicada pela feature 003:
 * cada Cartão com os Baralhos a que está vinculado. É a conferência exata de
 * propagação de nome e de preservação de Cartões após excluir Baralho.
 */
export async function listarCartoesComBaralhosPelaApi(
  enderecoDaApi: string,
  credencial: CredencialDeProva = credencialDeProva(),
): Promise<
  {
    id: string;
    frente: string;
    verso: string;
    baralhos: { id: string; nome: string }[];
  }[]
> {
  const resposta = await fetch(`${enderecoDaApi}/cartoes`, {
    headers: cabecalhoDeCredencial(credencial),
  });

  if (!resposta.ok) {
    throw new Error(`GET /cartoes respondeu ${resposta.status}`);
  }

  return (await resposta.json()) as {
    id: string;
    frente: string;
    verso: string;
    baralhos: { id: string; nome: string }[];
  }[];
}

/**
 * Lê a versão do esquema diretamente do arquivo SQLite — a prova de que a
 * migração de Baralhos rodou uma única vez. A API não expõe essa informação;
 * abrir o arquivo aqui é a forma observável de conferir a versão sem depender
 * de rota. Síncrona como o próprio driver `node:sqlite`.
 */
export function lerVersaoDoEsquema(caminhoDoBanco: string): number {
  const banco = new DatabaseSync(caminhoDoBanco);

  try {
    const linha = banco
      .prepare("SELECT versao FROM versao_do_esquema")
      .get() as { versao: number } | undefined;

    return linha === undefined ? 0 : Number(linha.versao);
  } finally {
    banco.close();
  }
}

/**
 * Cadastra um Usuário de prova pela API real e devolve a Credencial dele.
 *
 * A Credencial devolvida passa a ser a que os auxiliares de acervo apresentam
 * por padrão, de modo que cada prova existente precise apenas Entrar com ela
 * (FR-090). O Cadastro é a única rota que dispensa Credencial (FR-097), e é por
 * ele que a prova começa.
 */
export async function criarUsuarioDeProva(
  enderecoDaApi: string,
  nomeDeUsuario: string = NOME_DE_USUARIO_DE_PROVA,
): Promise<CredencialDeProva> {
  const credencial: CredencialDeProva = {
    nomeDeUsuario,
    senha: gerarSenhaDeProva(),
  };

  const resposta = await cadastrarUsuarioPelaApi(enderecoDaApi, credencial);

  if (resposta.status !== 201) {
    throw new Error(
      `POST /usuarios de ${nomeDeUsuario} respondeu ${resposta.status}`,
    );
  }

  credencialDeProvaAtual = credencial;

  return credencial;
}

/**
 * Entra pela tela "Entrar" do frontend real, com a Credencial informada.
 *
 * A tela é a primeira e única sem Credencial (FR-097); o `POST /entrar` que o
 * botão dispara é o que a aplicação verifica antes de mostrar o acervo
 * (FR-086). A espera é pela resposta do próprio Entrar, e não por um tempo
 * fixo: sem Credencial válida, a navegação principal não aparece.
 */
export async function entrarPelaUi(
  page: Page,
  credencial: CredencialDeProva = credencialDeProva(),
): Promise<void> {
  await page
    .getByLabel("Nome de usuário", { exact: true })
    .fill(credencial.nomeDeUsuario);
  await page.getByLabel("Senha", { exact: true }).fill(credencial.senha);

  await Promise.all([
    page.waitForResponse(
      (candidata) =>
        candidata.url().endsWith("/entrar") &&
        candidata.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);

  await page.getByRole("navigation", { name: "Principal" }).waitFor();
}

/**
 * Entra pela tela "Entrar" quando ela estiver apresentada.
 *
 * Um `goto` que só muda o fragmento não recarrega o documento, e a Credencial
 * mantida na memória da página continua valendo; quando o documento é
 * recarregado — uma prova que reinicia os servidores —, a Credencial se foi e
 * Entrar é exigido de novo (FR-089, SC-031). É esta a decisão que os arquivos
 * de prova não precisam repetir.
 */
export async function entrarSeNecessario(
  page: Page,
  credencial: CredencialDeProva = credencialDeProva(),
): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector("main h1") !== null,
  );

  const telaDeEntrada = page.getByRole("heading", {
    level: 1,
    name: "Entrar",
  });

  if ((await telaDeEntrada.count()) === 0) {
    return;
  }

  await entrarPelaUi(page, credencial);
}

/**
 * Intercepta `POST /entrar` respondendo o Usuário de prova: é o caminho das
 * provas que interceptam o transporte em vez de subir a API (FR-042). Devolve a
 * Credencial que a tela "Entrar" deve receber.
 */
export async function prepararEntradaInterceptada(
  page: Page,
  nomeDeUsuario: string = NOME_DE_USUARIO_DE_PROVA,
): Promise<CredencialDeProva> {
  const credencial: CredencialDeProva = {
    nomeDeUsuario,
    senha: gerarSenhaDeProva(),
  };

  await page.route(/\/entrar$/, async (rota) => {
    if (rota.request().method() === "POST") {
      await rota.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "u-prova", nomeDeUsuario }),
      });
      return;
    }

    await rota.fallback();
  });

  return credencial;
}

/**
 * Cadastra um Usuário direto na API real e devolve o status, o corpo e os
 * cabeçalhos da resposta.
 *
 * Diferente dos demais auxiliares, este **não** exige sucesso: a prova de
 * persistência precisa do `409` para conferir que o Nome de usuário já
 * existia antes, e a prova de FR-078 e FR-079 precisa inspecionar a resposta —
 * nenhuma credencial reutilizável, nenhum `Set-Cookie` e nenhuma Senha no
 * corpo.
 */
export async function cadastrarUsuarioPelaApi(
  enderecoDaApi: string,
  usuario: { nomeDeUsuario: string; senha: string },
): Promise<{ status: number; corpo: unknown; cabecalhos: Headers }> {
  const resposta = await fetch(`${enderecoDaApi}/usuarios`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(usuario),
  });

  return {
    status: resposta.status,
    corpo: await resposta.json(),
    cabecalhos: resposta.headers,
  };
}

/** Pasta temporária exclusiva para o arquivo SQLite do teste (os.tmpdir). */
export async function criarPastaTemporaria(prefixo: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefixo));
}
/** Remove a pasta temporária e o arquivo SQLite ao fim do teste. */
export async function removerPastaTemporaria(pasta: string): Promise<void> {
  await rm(pasta, { recursive: true, force: true });
}
