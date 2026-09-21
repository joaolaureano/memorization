import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Apresentação local em um comando (README: "Apresentação local (um comando)").
 *
 * É o único ponto de entrada pensado para quem vai **apresentar** o produto, e
 * não para quem o desenvolve: `npm run demo`, na raiz, faz o trabalho que o
 * roteiro de execução local reparte em vários passos. Nada de novo entra no
 * grafo da aplicação — o mesmo `build:local`, a mesma entrada `local.ts`
 * empacotada, o mesmo `npm run dev` do frontend —, e nenhuma dependência nova
 * é acrescentada por este arquivo.
 *
 * A regra de ouro é o ciclo de vida: a API e o frontend nascem cada um no seu
 * **grupo de processos** (`detached: true`) e são encerrados pelo grupo inteiro
 * (`process.kill(-pid)`), de modo que nem o Vite, nem o `npm` intermediário,
 * nem a API sobrevivam ao processo de demonstração. Ao menor sinal de
 * encerramento — `Ctrl+C`, término de um dos filhos, falha de prontidão —, os
 * dois caem juntos e nenhum processo órfão fica escutando porta.
 *
 * O **segredo das Senhas** é criado uma única vez em `backend/.env.local` (modo
 * `0600`) e reusado nas execuções seguintes, porque a mesma base precisa do
 * mesmo segredo para reconhecer as Senhas já cadastradas. Ele nunca é impresso,
 * em nenhuma mensagem: a existência do arquivo é que é noticiada. O arquivo é
 * `.env.*` e já está no `.gitignore`.
 *
 * Todos os caminhos são resolvidos a partir da raiz do repositório, um nível
 * acima desta pasta, de modo que o comando funcione de qualquer diretório.
 */

const RAIZ_DO_REPOSITORIO = dirname(dirname(fileURLToPath(import.meta.url)));
const DIRETORIO_DO_BACKEND = join(RAIZ_DO_REPOSITORIO, "backend");
const DIRETORIO_DO_FRONTEND = join(RAIZ_DO_REPOSITORIO, "frontend");

/** Onde vive o segredo do servidor desta apresentação; nunca versionado. */
const ARQUIVO_DO_SEGREDO = join(DIRETORIO_DO_BACKEND, ".env.local");

/**
 * O banco da apresentação: `backend/memorizacao.sqlite`, o mesmo arquivo padrão
 * da execução local. É de propósito que ele **não** seja um arquivo temporário:
 * os dados de uma apresentação precisam reaparecer na seguinte.
 */
const CAMINHO_PADRAO_DO_BANCO = join(DIRETORIO_DO_BACKEND, "memorizacao.sqlite");

const PORTA_PADRAO_DA_API = 3001;
const PORTA_PADRAO_DA_WEB = 5173;

/** Teto da espera por API e frontend, em milissegundos. */
const TEMPO_MAXIMO_DE_ESPERA = 60_000;

/** Intervalo entre duas sondagens de prontidão, em milissegundos. */
const INTERVALO_DE_SONDAGEM = 250;

/** Prazo do `SIGTERM` para `SIGKILL` ao encerrar um filho, em milissegundos. */
const PRAZO_PARA_ENCERRAR = 5_000;

/**
 * Lê uma porta da variável de ambiente `nome`, com o padrão informado. Um valor
 * presente e inválido aborta antes de qualquer processo nascer, com a mesma
 * frase e a mesma faixa da `PortaInvalidaError` do servidor — e nunca repete o
 * valor como se fosse útil.
 */
function lerPorta(nome, padrao) {
  const bruto = process.env[nome];

  if (bruto === undefined || bruto.trim() === "") {
    return padrao;
  }

  const numero = Number(bruto.trim());

  if (!Number.isInteger(numero) || numero < 1 || numero > 65535) {
    abortarCom(
      `Porta inválida em ${nome}: informe um número inteiro entre 1 e 65535.`,
    );
  }

  return numero;
}

const PORTA_DA_API = lerPorta("DEMO_PORTA_API", PORTA_PADRAO_DA_API);
const PORTA_DA_WEB = lerPorta("DEMO_PORTA_WEB", PORTA_PADRAO_DA_WEB);

const ENDERECO_DA_API = `http://127.0.0.1:${PORTA_DA_API}`;
const ENDERECO_DA_WEB = `http://127.0.0.1:${PORTA_DA_WEB}`;

/** O processo da API e o do frontend; o estado que o encerramento controla. */
let processoDaApi = null;
let processoDaWeb = null;

/**
 * Verdadeiro a partir do instante em que a apresentação começou a encerrar.
 * É a trava que impede que os eventos de saída dos filhos, disparados pelo
 * próprio encerramento, reentrem no encerramento.
 */
let encerrando = false;

function esperar(milissegundos) {
  return new Promise((resolver) => setTimeout(resolver, milissegundos));
}

/** Reporta a falha em português e interrompe com código 1. */
function abortarCom(mensagem) {
  console.error(`[demo] ${mensagem}`);
  process.exit(1);
}

/** Instala as dependências de um pacote apenas quando `node_modules` falta. */
function instalarDependenciasSeNecessario(diretorio, nome) {
  if (existsSync(join(diretorio, "node_modules"))) {
    return;
  }

  console.log(`[demo] Instalando as dependências do ${nome}...`);

  const resultado = spawnSync("npm", ["install"], {
    cwd: diretorio,
    stdio: "inherit",
  });

  if (resultado.status !== 0) {
    abortarCom(
      `Falha ao instalar as dependências do ${nome}. A apresentação não foi iniciada.`,
    );
  }
}

/**
 * Devolve o segredo das Senhas: reusa o de `backend/.env.local` quando ele já
 * existe, e o cria com 64 dígitos hexadecimais (32 bytes) e modo `0600` quando
 * não existe. O valor nunca é impresso — nem aqui, nem em erro.
 */
function segredoDasSenhas() {
  if (existsSync(ARQUIVO_DO_SEGREDO)) {
    const conteudo = readFileSync(ARQUIVO_DO_SEGREDO, "utf8");

    for (const linha of conteudo.split("\n")) {
      const casamento = /^SEGREDO_DAS_SENHAS=(.+)$/.exec(linha.trim());

      if (casamento !== null) {
        return casamento[1].trim();
      }
    }

    abortarCom(
      "backend/.env.local existe, mas não declara SEGREDO_DAS_SENHAS. " +
        "Remova o arquivo para que a apresentação o crie de novo.",
    );
  }

  const segredo = randomBytes(32).toString("hex");

  writeFileSync(
    ARQUIVO_DO_SEGREDO,
    `SEGREDO_DAS_SENHAS=${segredo}\n`,
    { mode: 0o600 },
  );

  console.log(
    "[demo] Segredo das Senhas criado em backend/.env.local (reusado nas próximas execuções).",
  );

  return segredo;
}

/**
 * Sobe um processo filho no seu próprio grupo (`detached`), com a saída
 * capturada para ser prefixada. O grupo é o que permite encerrar o comando
 * inteiro — o `npm`, o shell e o servidor de verdade — com um único sinal.
 */
function iniciarProcesso(prefixo, comando, argumentos, diretorio, ambiente) {
  const processo = spawn(comando, argumentos, {
    cwd: diretorio,
    env: { ...process.env, ...ambiente },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  prefixarSaida(processo, prefixo);

  return processo;
}

/**
 * Prefixa cada linha da saída do filho com `[api]` ou `[web]`, para que as
 * duas vozes do terminal não se misturem. Linhas parciais são acumuladas até o
 * fim da linha.
 */
function prefixarSaida(processo, prefixo) {
  for (const [fluxo, escrever] of [
    [processo.stdout, console.log],
    [processo.stderr, console.error],
  ]) {
    if (fluxo === null) {
      continue;
    }

    fluxo.setEncoding("utf8");

    let resto = "";

    fluxo.on("data", (pedaco) => {
      resto += pedaco;

      const linhas = resto.split("\n");
      resto = linhas.pop() ?? "";

      for (const linha of linhas) {
        escrever(`${prefixo} ${linha}`);
      }
    });

    fluxo.on("end", () => {
      if (resto.length > 0) {
        escrever(`${prefixo} ${resto}`);
      }
    });
  }
}

/** Um processo que ainda pode ser encerrado. */
function emExecucao(processo) {
  return (
    processo !== null &&
    processo.exitCode === null &&
    processo.signalCode === null
  );
}

/**
 * Encerra o filho **e o seu grupo**: primeiro com `SIGTERM` no grupo inteiro,
 * depois, se ele não terminar no prazo, com `SIGKILL`. O `pid` do processo
 * destacado é o id do grupo, e é por isso que o sinal negativo os alcança
 * todos. Um processo já encerrado é ignorado em silêncio.
 */
async function encerrarProcesso(processo) {
  if (!emExecucao(processo)) {
    return;
  }

  const saiu = new Promise((resolver) => processo.once("exit", resolver));

  const sinalizar = (sinal) => {
    try {
      process.kill(-processo.pid, sinal);
    } catch {
      try {
        processo.kill(sinal);
      } catch {
        // O processo já se foi entre a verificação e o sinal.
      }
    }
  };

  sinalizar("SIGTERM");

  const prazo = setTimeout(() => {
    if (emExecucao(processo)) {
      sinalizar("SIGKILL");
    }
  }, PRAZO_PARA_ENCERRAR);

  await Promise.race([saiu, esperar(PRAZO_PARA_ENCERRAR + 5_000)]);

  clearTimeout(prazo);
}

/**
 * O encerramento único: derruba os dois filhos, marca o código de saída e
 * deixa o processo terminar sozinho assim que a espera em curso o notar. Uma
 * trava de segurança força a saída se algo ainda segurar o laço de eventos.
 */
async function encerrarTudo(codigo) {
  if (encerrando) {
    return;
  }

  encerrando = true;
  process.exitCode = codigo;

  await Promise.all([encerrarProcesso(processoDaApi), encerrarProcesso(processoDaWeb)]);

  setTimeout(() => process.exit(codigo), 2_000).unref();
}

/**
 * Uma sondagem de prontidão: o endereço responde com sucesso? Falha de rede e
 * demora contam como "ainda não", e nunca interrompem a apresentação.
 */
async function respondeComSucesso(endereco) {
  try {
    const resposta = await fetch(endereco, {
      signal: AbortSignal.timeout(2_000),
    });

    return resposta.ok;
  } catch {
    return false;
  }
}

/**
 * Espera API (`/health`) e frontend (`/`) responderem com sucesso, dentro do
 * mesmo teto de tempo. No estouro, nomeia o que não respondeu e lembra que a
 * porta pode estar em uso — a causa mais comum de um endereço que nunca fica
 * pronto.
 */
async function aguardarProntidao() {
  const inicio = Date.now();

  let apiPronta = false;
  let webPronta = false;

  while (!encerrando && Date.now() - inicio < TEMPO_MAXIMO_DE_ESPERA) {
    if (!apiPronta) {
      apiPronta = await respondeComSucesso(`${ENDERECO_DA_API}/health`);
    }

    if (!webPronta) {
      webPronta = await respondeComSucesso(`${ENDERECO_DA_WEB}/`);
    }

    if (apiPronta && webPronta) {
      return true;
    }

    await esperar(INTERVALO_DE_SONDAGEM);
  }

  if (encerrando) {
    return false;
  }

  const pendentes = [];

  if (!apiPronta) {
    pendentes.push(`a API em ${ENDERECO_DA_API}/health`);
  }

  if (!webPronta) {
    pendentes.push(`o frontend em ${ENDERECO_DA_WEB}`);
  }

  console.error(
    `[demo] ${pendentes.join(" e ")} não respondeu em ${TEMPO_MAXIMO_DE_ESPERA / 1000} s. ` +
      "A porta pode estar em uso.",
  );

  await encerrarTudo(1);

  return false;
}

/**
 * Registra o ciclo de vida de um filho: se ele encerrar por conta própria, a
 * apresentação inteira encerra junto, para não deixar a outra metade de pé.
 */
function vigiarProcesso(processo, rotulo) {
  processo.on("exit", (codigo, sinal) => {
    if (encerrando) {
      return;
    }

    const causa = sinal === null ? `código ${codigo ?? 0}` : `sinal ${sinal}`;

    console.error(
      `[demo] O ${rotulo} encerrou inesperadamente (${causa}). Encerrando a apresentação.`,
    );

    void encerrarTudo(typeof codigo === "number" ? codigo : 1);
  });
}

for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    if (encerrando) {
      return;
    }

    console.log("\n[demo] Encerrando a apresentação...");

    void encerrarTudo(0);
  });
}

instalarDependenciasSeNecessario(DIRETORIO_DO_BACKEND, "backend");
instalarDependenciasSeNecessario(DIRETORIO_DO_FRONTEND, "frontend");

const SEGREDO_DAS_SENHAS = segredoDasSenhas();

console.log("[demo] Construindo a API local (npm run build:local)...");

const construcao = spawnSync("npm", ["run", "build:local"], {
  cwd: DIRETORIO_DO_BACKEND,
  stdio: "inherit",
});

if (construcao.status !== 0) {
  abortarCom("Falha ao construir a API local. A apresentação não foi iniciada.");
}

processoDaApi = iniciarProcesso(
  "[api]",
  process.execPath,
  ["dist/sqlite/servidor.mjs"],
  DIRETORIO_DO_BACKEND,
  {
    PORTA: String(PORTA_DA_API),
    CAMINHO_DO_BANCO:
      process.env.CAMINHO_DO_BANCO ?? CAMINHO_PADRAO_DO_BANCO,
    SEGREDO_DAS_SENHAS,
  },
);

processoDaWeb = iniciarProcesso(
  "[web]",
  "npm",
  [
    "run",
    "dev",
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    String(PORTA_DA_WEB),
    "--strictPort",
  ],
  DIRETORIO_DO_FRONTEND,
  { VITE_ENDERECO_DA_API: ENDERECO_DA_API },
);

vigiarProcesso(processoDaApi, "API");
vigiarProcesso(processoDaWeb, "frontend");

const pronto = await aguardarProntidao();

if (pronto) {
  console.log("");
  console.log(
    `Memorization pronto para apresentar: http://127.0.0.1:${PORTA_DA_WEB}`,
  );
  console.log("Ctrl+C para encerrar.");
}
