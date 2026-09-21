import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { versaoCorrenteConhecida } from "../../src/armazenamento/postgresql/esquema.ts";
import {
  criarFuncao,
  type FuncaoDaNuvem,
  type RespostaDaFuncao,
} from "../../src/funcao/funcao.ts";
import {
  ParametroAusenteError,
  type LeitorDeSegredos,
  type SegredosDaFuncao,
} from "../../src/funcao/segredos.ts";
import {
  criarBaseMigrada,
  descartarBasesDeTeste,
  gravarCertificadoDaAutoridade,
  type CertificadoDaAutoridade,
} from "../armazenamento/postgresql/base-de-teste.ts";
import {
  servidorDeTeste,
  type ServidorAutonomo,
} from "../armazenamento/postgresql/servidor-de-teste.ts";
import {
  leitorDeSegredosEmMemoria,
  PREFIXO_DE_TESTE,
} from "./segredos-em-memoria.ts";

/**
 * T1005 — o `handler` da função exercitado **localmente**, com eventos
 * sintéticos de Function URL (payload v2), contra o PostgreSQL **real** com TLS
 * do apoio de teste da `010` e com o leitor de segredos **em memória** (FR-133,
 * SC-060).
 *
 * É a prova central da feature, e ela acontece sem publicar na AWS: a
 * composição real — guarda de origem, Credencial, rotas, Adapter de PostgreSQL,
 * esquema conferido — é exercitada por eventos, e os desfechos são medidos, e
 * não afirmados:
 *
 * - `403` sem o segredo de origem e com o segredo errado, com o mesmo corpo;
 * - `200` em `/health` com o segredo e **sem** Credencial;
 * - `401` sem Credencial, com o segredo — a guarda de origem não substitui a
 *   Credencial (FR-131, SC-058);
 * - a ida e volta autenticada de Cartão, Baralho e Vínculo, gravando no
 *   PostgreSQL (SC-051);
 * - a inicialização que falha e é **retentada** na requisição seguinte, sem
 *   falha memorizada (FR-126, SC-054);
 * - a recusa por esquema atrasado, **sem** migração alguma (FR-127, SC-055);
 * - a ausência de cabeçalho permissivo de outra origem e de cookie em toda
 *   resposta (FR-079, FR-128, SC-056);
 * - a ausência de qualquer valor de segredo na saída, no registro e nas
 *   respostas (FR-123, FR-078, SC-052).
 *
 * Todo valor sensível — a senha do banco de teste, os segredos, as senhas dos
 * cenários — é **gerado por execução**, e nenhum aparece em arquivo versionado
 * (Princípio VIII).
 */

const RAIZ_DO_BACKEND = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** O segredo de origem desta execução: o que o CloudFront injetaria. */
const SEGREDO_DE_ORIGEM = randomBytes(48).toString("base64url");

/** O segredo do servidor das Senhas desta execução (FR-077). */
const SEGREDO_DAS_SENHAS = randomBytes(48).toString("base64url");

/** Um segredo de origem que não confere, do mesmo tamanho do verdadeiro. */
const OUTRO_SEGREDO = randomBytes(48).toString("base64url");

/** A credencial de um Nome de usuário que não existe: nunca confere (FR-088). */
const CREDENCIAL_QUE_NAO_CONFERE = `Basic ${Buffer.from(
  "ninguem.silva:senha-que-nao-existe",
  "utf8",
).toString("base64")}`;

/** Corpo da recusa da guarda de origem, o mesmo da stub da infraestrutura. */
const PROIBIDO = { sucesso: false, mensagem: "Proibido" };

let servidor: ServidorAutonomo;
let certificado: CertificadoDaAutoridade;
let nomeDaBase: string;
let funcao: FuncaoDaNuvem;

/** Toda resposta observada, na forma em que as garantias negativas a varrem. */
const respostasObservadas: string[] = [];

/** Tudo o que o processo escreveu, para a varredura que exige ausência de segredo. */
const registroDeProcesso: string[] = [];

/** Os espiões da saída e do registro: capturam em vez de imprimir. */
let espioes: ReturnType<typeof vi.spyOn>[] = [];

/** Guarda o que o processo escreveria — é o que a varredura final examina. */
function guardarEscrita(...escrito: unknown[]): void {
  registroDeProcesso.push(escrito.map(String).join(" "));
}

/** Sobe o PostgreSQL real de teste e monta a função sobre uma base migrada. */
beforeAll(async () => {
  espioes = [
    vi.spyOn(console, "error").mockImplementation(guardarEscrita),
    vi.spyOn(console, "warn").mockImplementation(guardarEscrita),
    vi.spyOn(console, "log").mockImplementation(guardarEscrita),
  ];

  servidor = await servidorDeTeste();
  certificado = gravarCertificadoDaAutoridade(servidor);
  nomeDaBase = await criarBaseMigrada("funcao-da-nuvem");
  funcao = criarFuncao(leitorDaBase(nomeDaBase), {
    prefixo: PREFIXO_DE_TESTE,
    caminhoDoCertificado: certificado.caminho,
  });
}, 120_000);

afterAll(async () => {
  for (const espiao of espioes) {
    espiao.mockRestore();
  }

  certificado.remover();
  await descartarBasesDeTeste();
  await servidor.encerrar();
});

/** O leitor em memória com os três segredos do cenário e a URL da base informada. */
function leitorDaBase(base: string): LeitorDeSegredos {
  return leitorDeSegredosEmMemoria({
    urlDeConexao: servidor.urlDaBase(base),
    segredoDeOrigem: SEGREDO_DE_ORIGEM,
    segredoDasSenhas: SEGREDO_DAS_SENHAS,
  });
}

/** Os três segredos do cenário, para o leitor com portão e o instável. */
function segredosDoCenario(base: string): SegredosDaFuncao {
  return {
    urlDeConexao: servidor.urlDaBase(base),
    segredoDeOrigem: SEGREDO_DE_ORIGEM,
    segredoDasSenhas: SEGREDO_DAS_SENHAS,
  };
}

interface OpcoesDoEvento {
  segredoDeOrigem?: string;
  credencial?: string;
  corpo?: unknown;
}

/**
 * O evento sintético da Function URL, no payload v2: `rawPath` já **sem** o
 * prefixo `/api`, que o CloudFront remove na borda, os cabeçalhos em minúsculas
 * — é de onde vêm `x-origin-secret` e `authorization` — e
 * `requestContext.http.method` com o método.
 */
function eventoV2(metodo: string, caminho: string, opcoes: OpcoesDoEvento) {
  const headers: Record<string, string> = {};

  if (opcoes.segredoDeOrigem !== undefined) {
    headers["x-origin-secret"] = opcoes.segredoDeOrigem;
  }

  if (opcoes.credencial !== undefined) {
    headers.authorization = opcoes.credencial;
  }

  const corpo = opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo);

  if (corpo !== undefined) {
    headers["content-type"] = "application/json";
  }

  return {
    version: "2.0",
    rawPath: caminho,
    rawQueryString: "",
    headers,
    requestContext: {
      http: { method: metodo, path: caminho, protocol: "HTTP/1.1" },
    },
    ...(corpo === undefined ? {} : { body: corpo, isBase64Encoded: false }),
  };
}

/** A resposta do handler, já lida como um cliente HTTP a leria. */
interface RespostaMedida {
  readonly status: number;
  readonly corpo: unknown;
  readonly cabecalhos: Record<string, string>;
  readonly bruto: string;
}

/** Lê o corpo da resposta; corpo vazio — o `204` — não é JSON. */
function corpoLido(bruto: string): unknown {
  if (bruto === "") {
    return undefined;
  }

  try {
    return JSON.parse(bruto) as unknown;
  } catch {
    return bruto;
  }
}

/** A resposta do handler, com a Credencial e o segredo de origem informados. */
async function pedir(
  alvo: FuncaoDaNuvem,
  metodo: string,
  caminho: string,
  opcoes: OpcoesDoEvento = {},
): Promise<RespostaMedida> {
  const resposta: RespostaDaFuncao = await alvo.handler(
    eventoV2(metodo, caminho, opcoes),
    {},
  );

  respostasObservadas.push(
    JSON.stringify({
      status: resposta.statusCode,
      headers: resposta.headers,
      body: resposta.body,
    }),
  );

  return {
    status: resposta.statusCode,
    corpo: corpoLido(resposta.body),
    cabecalhos: resposta.headers,
    bruto: resposta.body,
  };
}

/** O cabeçalho `Authorization: Basic ...` de uma Credencial do cenário. */
function credencialDe(nomeDeUsuario: string, senha: string): string {
  return `Basic ${Buffer.from(`${nomeDeUsuario}:${senha}`, "utf8").toString("base64")}`;
}

/** Nenhum cabeçalho permissivo de outra origem, em resposta alguma (FR-128). */
function semCabecalhoPermissivo(resposta: RespostaMedida): void {
  const permissivos = Object.keys(resposta.cabecalhos).filter((cabecalho) =>
    cabecalho.toLowerCase().startsWith("access-control-"),
  );

  expect(permissivos).toEqual([]);
}

/** Nenhum cookie e nenhum valor reutilizável entre requisições (FR-079). */
function semCookie(resposta: RespostaMedida): void {
  expect(resposta.cabecalhos["set-cookie"]).toBeUndefined();
}

describe("as guardas da função, por eventos sintéticos (T1005)", () => {
  it("recusa com 403 a requisição sem o segredo de origem, sem revelar o motivo", async () => {
    const resposta = await pedir(funcao, "GET", "/health");

    expect(resposta.status).toBe(403);
    expect(resposta.corpo).toEqual(PROIBIDO);

    /** A recusa não publica credencial, cookie nem o segredo esperado. */
    expect(resposta.cabecalhos["www-authenticate"]).toBeUndefined();
    semCookie(resposta);
    semCabecalhoPermissivo(resposta);
    expect(resposta.bruto).not.toContain(SEGREDO_DE_ORIGEM);
  });

  it.each([
    ["o segredo errado", OUTRO_SEGREDO],
    ["o segredo curto", SEGREDO_DE_ORIGEM.slice(0, -1)],
    ["o segredo longo", `${SEGREDO_DE_ORIGEM}x`],
    ["o cabeçalho vazio", ""],
  ])("responde igual com %s: mesmo status e mesmo corpo", async (_rotulo, enviado) => {
    const semSegredo = await pedir(funcao, "GET", "/health");
    const comErro = await pedir(funcao, "GET", "/health", {
      segredoDeOrigem: enviado,
    });

    expect(comErro.status).toBe(semSegredo.status);
    expect(comErro.bruto).toBe(semSegredo.bruto);
    semCabecalhoPermissivo(comErro);
  });

  it("recusa antes do hook da Credencial: sem o segredo, não há 401", async () => {
    const resposta = await pedir(funcao, "GET", "/cartoes", {
      credencial: CREDENCIAL_QUE_NAO_CONFERE,
    });

    expect(resposta.status).toBe(403);
    expect(resposta.corpo).toEqual(PROIBIDO);
  });

  it("responde 200 em /health com o segredo e sem Credencial", async () => {
    const resposta = await pedir(funcao, "GET", "/health", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
    });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({ status: "ok" });
    semCookie(resposta);
    semCabecalhoPermissivo(resposta);
  });

  it("responde 401 sem Credencial: a guarda de origem não substitui a Credencial", async () => {
    const resposta = await pedir(funcao, "GET", "/cartoes", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
    });

    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toMatchObject({ erro: "credencial_invalida" });
    expect(resposta.cabecalhos["www-authenticate"]).toBeUndefined();
    semCookie(resposta);
    semCabecalhoPermissivo(resposta);
  });

  it("não envia cabeçalho permissivo de outra origem em nenhuma resposta", async () => {
    const respostas = [
      await pedir(funcao, "GET", "/health"),
      await pedir(funcao, "GET", "/health", { segredoDeOrigem: SEGREDO_DE_ORIGEM }),
      await pedir(funcao, "GET", "/cartoes", { segredoDeOrigem: SEGREDO_DE_ORIGEM }),
      await pedir(funcao, "POST", "/cartoes", {
        segredoDeOrigem: SEGREDO_DE_ORIGEM,
      }),
    ];

    for (const resposta of respostas) {
      semCabecalhoPermissivo(resposta);
      semCookie(resposta);
    }
  });
});

describe("a ida e volta do acervo contra o PostgreSQL (SC-051)", () => {
  it("cadastra, entra e opera Cartão, Baralho e Vínculo, gravando na base", async () => {
    const nomeDeUsuario = `ana.${randomBytes(3).toString("hex")}`;
    const senha = randomBytes(12).toString("base64url");
    const credencial = credencialDe(nomeDeUsuario, senha);

    /** O Cadastro é isento de Credencial, e exige o segredo de origem. */
    const cadastro = await pedir(funcao, "POST", "/usuarios", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
      corpo: { nomeDeUsuario, senha },
    });

    expect(cadastro.status).toBe(201);
    expect(cadastro.corpo).toMatchObject({ nomeDeUsuario });
    expect(cadastro.bruto).not.toContain(senha);

    /** Entrar devolve quem entrou, e nada da Senha (FR-078). */
    const entrou = await pedir(funcao, "POST", "/entrar", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
      credencial,
    });

    expect(entrou.status).toBe(200);
    expect(entrou.corpo).toMatchObject({ nomeDeUsuario });
    expect(entrou.bruto).not.toContain(senha);
    semCookie(entrou);

    const cartao = await pedir(funcao, "POST", "/cartoes", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
      credencial,
      corpo: { frente: "To walk", verso: "Caminhar" },
    });

    expect(cartao.status).toBe(201);
    const cartaoId = (cartao.corpo as { id: string }).id;

    const baralho = await pedir(funcao, "POST", "/baralhos", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
      credencial,
      corpo: { nome: "Inglês" },
    });

    expect(baralho.status).toBe(201);
    const baralhoId = (baralho.corpo as { id: string }).id;

    const vinculo = await pedir(funcao, "POST", `/baralhos/${baralhoId}/vinculos`, {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
      credencial,
      corpo: { cartaoId },
    });

    expect(vinculo.status).toBe(201);

    /** A leitura devolve o que foi criado. */
    const listagem = await pedir(funcao, "GET", "/cartoes", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
      credencial,
    });

    expect(listagem.status).toBe(200);
    expect(listagem.corpo).toMatchObject([
      {
        id: cartaoId,
        frente: "To walk",
        verso: "Caminhar",
        baralhos: [{ id: baralhoId, nome: "Inglês" }],
      },
    ]);

    const doBaralho = await pedir(funcao, "GET", `/baralhos/${baralhoId}`, {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
      credencial,
    });

    expect(doBaralho.status).toBe(200);
    expect(doBaralho.corpo).toMatchObject({ id: baralhoId, nome: "Inglês" });

    /** A edição vale para a leitura seguinte. */
    const editado = await pedir(funcao, "PUT", `/cartoes/${cartaoId}`, {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
      credencial,
      corpo: { frente: "To run", verso: "Correr" },
    });

    expect(editado.status).toBe(200);

    const relido = await pedir(funcao, "GET", "/cartoes", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
      credencial,
    });

    expect(relido.corpo).toMatchObject([
      { id: cartaoId, frente: "To run", verso: "Correr" },
    ]);

    /**
     * E o que foi gravado está **na base**: a leitura direta, por outra conexão,
     * confirma o Cartão e o Vínculo (SC-051).
     */
    const cartoesNaBase = await servidor.consultar<{ frente: string }>(
      nomeDaBase,
      "SELECT frente FROM cartao WHERE id = $1;",
      [cartaoId],
    );

    expect(cartoesNaBase).toEqual([{ frente: "To run" }]);

    const vinculosNaBase = await servidor.consultar<{ quantidade: string }>(
      nomeDaBase,
      "SELECT COUNT(*) AS quantidade FROM vinculo WHERE cartao_id = $1;",
      [cartaoId],
    );

    expect(vinculosNaBase.map((linha) => Number(linha.quantidade))).toEqual([1]);
  }, 60_000);

  it("recusa a Credencial que não confere sem revelar qual parte falhou", async () => {
    const resposta = await pedir(funcao, "POST", "/entrar", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
      credencial: CREDENCIAL_QUE_NAO_CONFERE,
    });

    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toMatchObject({ erro: "credencial_invalida" });
    expect(resposta.bruto).not.toContain("ninguem.silva");
  }, 60_000);
});

describe("a inicialização é memorizada e descartável (SC-054)", () => {
  it("compartilha a mesma promise entre invocações concorrentes", async () => {
    let liberar: () => void = () => {};
    const portao = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    const segredos = segredosDoCenario(nomeDaBase);
    let chamadas = 0;

    const comPortao: LeitorDeSegredos = {
      async ler() {
        chamadas += 1;
        await portao;

        return segredos;
      },
    };

    const alvo = criarFuncao(comPortao, {
      prefixo: PREFIXO_DE_TESTE,
      caminhoDoCertificado: certificado.caminho,
    });

    const simultaneas = [
      pedir(alvo, "GET", "/health", { segredoDeOrigem: SEGREDO_DE_ORIGEM }),
      pedir(alvo, "GET", "/health", { segredoDeOrigem: SEGREDO_DE_ORIGEM }),
    ];

    liberar();

    const respostas = await Promise.all(simultaneas);

    for (const resposta of respostas) {
      expect(resposta.status).toBe(200);
      expect(resposta.corpo).toEqual({ status: "ok" });
    }

    /** Nada foi inicializado duas vezes: o cofre foi lido uma vez só. */
    expect(chamadas).toBe(1);
  }, 60_000);

  it("descarta a inicialização que falhou: a requisição seguinte tenta de novo", async () => {
    const segredos = segredosDoCenario(nomeDaBase);
    let chamadas = 0;

    const instavel: LeitorDeSegredos = {
      async ler() {
        chamadas += 1;

        if (chamadas === 1) {
          throw new ParametroAusenteError(
            `Parâmetro ausente no cofre: ${PREFIXO_DE_TESTE}/DB_URL. ` +
              "Provisione o parâmetro sob o prefixo configurado e tente de novo.",
          );
        }

        return segredos;
      },
    };

    const alvo = criarFuncao(instavel, {
      prefixo: PREFIXO_DE_TESTE,
      caminhoDoCertificado: certificado.caminho,
    });

    const primeira = await pedir(alvo, "GET", "/health", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
    });

    expect(primeira.status).toBe(503);
    expect(primeira.bruto).not.toContain(PREFIXO_DE_TESTE);

    const segunda = await pedir(alvo, "GET", "/health", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
    });

    expect(segunda.status).toBe(200);
    expect(segunda.corpo).toEqual({ status: "ok" });
    expect(chamadas).toBe(2);
  }, 60_000);

  it("mantém o 503 enquanto a falha persistir, sem passar por pronta", async () => {
    const sempreFalho: LeitorDeSegredos = {
      async ler(): Promise<SegredosDaFuncao> {
        throw new ParametroAusenteError(
          `Parâmetro ausente no cofre: ${PREFIXO_DE_TESTE}/SEGREDO_DAS_SENHAS. ` +
            "Provisione o parâmetro sob o prefixo configurado e tente de novo.",
        );
      },
    };

    const alvo = criarFuncao(sempreFalho, {
      prefixo: PREFIXO_DE_TESTE,
      caminhoDoCertificado: certificado.caminho,
    });

    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const resposta = await pedir(alvo, "GET", "/health", {
        segredoDeOrigem: SEGREDO_DE_ORIGEM,
      });

      expect(resposta.status).toBe(503);
      semCookie(resposta);
      semCabecalhoPermissivo(resposta);
    }
  }, 60_000);

  it("recusa uma base com o esquema atrasado, e não migra nada", async () => {
    const baseAtrasada = await servidor.criarBase("funcao-sem-migracao");
    const alvo = criarFuncao(leitorDaBase(baseAtrasada), {
      prefixo: PREFIXO_DE_TESTE,
      caminhoDoCertificado: certificado.caminho,
    });

    const resposta = await pedir(alvo, "GET", "/health", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
    });

    expect(resposta.status).toBe(503);
    expect(resposta.bruto).not.toMatch(/versão|migra/i);

    /** O registro nomeia as duas versões e manda executar a migração da nuvem. */
    const registrado = registroDeProcesso.join("\n");

    expect(registrado).toContain("o esquema da base está na versão 0");
    expect(registrado).toContain(`a versão corrente é ${versaoCorrenteConhecida()}`);
    expect(registrado).toContain("comando de migração");
    expect(registrado).not.toContain(servidor.configuracao.senha);

    /** Nenhuma migração foi aplicada: a base continua sem tabela alguma. */
    const tabelas = await servidor.consultar<{ nome: string }>(
      baseAtrasada,
      `SELECT tablename AS nome FROM pg_tables
        WHERE schemaname = 'public' ORDER BY tablename;`,
    );

    expect(tabelas).toEqual([]);
  }, 60_000);

  it("responde 503 quando a base não pode ser alcançada, sem revelar valor algum", async () => {
    const baseInexistente = `base_inexistente_${randomBytes(3).toString("hex")}`;
    const alvo = criarFuncao(leitorDaBase(baseInexistente), {
      prefixo: PREFIXO_DE_TESTE,
      caminhoDoCertificado: certificado.caminho,
    });

    const resposta = await pedir(alvo, "GET", "/health", {
      segredoDeOrigem: SEGREDO_DE_ORIGEM,
    });

    expect(resposta.status).toBe(503);
    expect(resposta.bruto).not.toContain(baseInexistente);
    expect(resposta.bruto).not.toContain(servidor.configuracao.senha);

    const registrado = registroDeProcesso.join("\n");

    expect(registrado).toContain("Falha no armazenamento da nuvem");
    expect(registrado).toMatch(/SQLSTATE [0-9A-Z]{5}/);
    expect(registrado).not.toContain(servidor.configuracao.senha);
    expect(registrado).not.toContain("postgresql://");
  }, 60_000);
});

describe("as garantias da função", () => {
  it("não escuta em porto algum e publica o handler da entrada", async () => {
    const fontes = [
      ...fontesTypeScript(join(RAIZ_DO_BACKEND, "src", "funcao")),
      join(RAIZ_DO_BACKEND, "src", "entradas", "lambda.ts"),
    ];

    expect(fontes.map((caminho) => caminhoRelativo(caminho))).toEqual(
      expect.arrayContaining([
        "src/entradas/lambda.ts",
        "src/funcao/funcao.ts",
        "src/funcao/segredos.ts",
        "src/funcao/ssm.ts",
      ]),
    );

    for (const caminho of fontes) {
      const fonte = readFileSync(caminho, "utf8");

      /** Nem `listen`, nem a porta, nem a garantia de escuta local. */
      expect(fonte, caminhoRelativo(caminho)).not.toMatch(
        /\.listen\s*\(|assegurarEscutaLocal|opcoesDeEscuta|HOST_LOCAL/,
      );
    }

    /** A fábrica devolve o `handler`, e nada além dele. */
    expect(Object.keys(funcao)).toEqual(["handler"]);
    expect(typeof funcao.handler).toBe("function");

    /** A entrada publica `handler` — o que a infraestrutura invoca. */
    const entrada = (await import("../../src/entradas/lambda.ts")) as {
      handler?: unknown;
    };

    expect(typeof entrada.handler).toBe("function");
  });

  it("não deixa nenhum valor de segredo na saída, no registro nem nas respostas", () => {
    const saidas = [...respostasObservadas, ...registroDeProcesso].join("\n");

    expect(saidas.length).toBeGreaterThan(0);

    /** A varredura não é vácuo: as respostas observadas estão lá dentro. */
    expect(saidas).toContain('"status":200');

    for (const valor of [
      SEGREDO_DE_ORIGEM,
      SEGREDO_DAS_SENHAS,
      servidor.configuracao.senha,
      certificado.caminho,
      "postgresql://",
    ]) {
      expect(saidas).not.toContain(valor);
    }

    /** Nenhuma resposta trouxe cookie nem valor reutilizável (FR-079). */
    for (const resposta of respostasObservadas) {
      expect(resposta).not.toMatch(/set-cookie/i);
      expect(resposta).not.toMatch(/access-control-/i);
    }
  });
});

/** Todos os fontes TypeScript de um diretório, recursivamente. */
function fontesTypeScript(diretorio: string): string[] {
  return readdirSync(diretorio, { withFileTypes: true })
    .flatMap((entrada) => {
      const caminho = join(diretorio, entrada.name);

      return entrada.isDirectory() ? fontesTypeScript(caminho) : [caminho];
    })
    .filter((caminho) => caminho.endsWith(".ts"));
}

/** O caminho do fonte, relativo à raiz do backend, sempre com barras normais. */
function caminhoRelativo(caminho: string): string {
  return relative(RAIZ_DO_BACKEND, caminho).split("\\").join("/");
}
