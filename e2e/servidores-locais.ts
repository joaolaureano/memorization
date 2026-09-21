import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

// T014 — suporte de execução para a prova E2E real de persistência
// (FR-040, SC-003; specs/001-criar-cartao/tasks.md).
//
// Inicia a API real (node + SQLite em arquivo) e o frontend real (Vite dev)
// como processos filhos do teste, em portas livres e com arquivo SQLite
// temporário exclusivo, e aguarda a prontidão de cada um antes de liberá-los
// ao teste. O encerramento é sempre explícito: `encerrarProcesso` é chamado
// no `finally` do teste, inclusive quando a prova falha no meio.

const RAIZ_DO_REPOSITORIO = dirname(dirname(fileURLToPath(import.meta.url)));

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
 * Inicia a API real sobre `caminhoDoBanco` — o mesmo `src/index.ts` da
 * aplicação, sem `--watch`: o processo é filho do teste e o teste controla
 * seu ciclo de vida inteiro.
 */
export function iniciarApi(
  caminhoDoBanco: string,
  porta: number,
): ProcessoIniciado {
  return iniciarProcesso({
    rotulo: "API",
    comando: process.execPath,
    argumentos: [join(RAIZ_DO_REPOSITORIO, "backend", "src", "index.ts")],
    diretorio: join(RAIZ_DO_REPOSITORIO, "backend"),
    ambiente: {
      PORTA: String(porta),
      CAMINHO_DO_BANCO: caminhoDoBanco,
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
): Promise<{
  id: string;
  nome: string;
  elegivel: boolean;
  cartoes: { id: string; frente: string; verso: string }[];
}> {
  const resposta = await fetch(
    `${enderecoDaApi}/baralhos/${encodeURIComponent(id)}`,
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
): Promise<{ id: string; frente: string; verso: string }[]> {
  const resposta = await fetch(`${enderecoDaApi}/cartoes`);

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
): Promise<
  {
    id: string;
    nome: string;
    quantidadeDeCartoes: number;
    elegivel: boolean;
  }[]
> {
  const resposta = await fetch(`${enderecoDaApi}/baralhos`);

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

/** Pasta temporária exclusiva para o arquivo SQLite do teste (os.tmpdir). */
export async function criarPastaTemporaria(prefixo: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefixo));
}

/** Remove a pasta temporária e o arquivo SQLite ao fim do teste. */
export async function removerPastaTemporaria(pasta: string): Promise<void> {
  await rm(pasta, { recursive: true, force: true });
}
