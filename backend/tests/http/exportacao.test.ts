import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance, InjectOptions } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarAcervo } from "../../src/acervo/acervo.ts";
import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import type { ArmazenamentoDoAcervo, ConteudoArmazenado } from "../../src/armazenamento/porta.ts";
import { criarArmazemEmDisco } from "../../src/midia/armazem-em-disco.ts";
import type { ArmazemDeMidia } from "../../src/midia/armazem.ts";
import { criarServidor } from "../../src/http/servidor.ts";
import {
  registrarRotasDeBaralhos,
  registrarRotasDeCartoes,
  registrarRotasDeExportacao,
} from "../../src/http/rotas.ts";
import { criarIdentidade } from "../../src/identidade/identidade.ts";
import { cadastrarUsuarioDeTeste, segredoGerado } from "../armazenamento/usuarios-de-teste.ts";
import { montarServidorDeContrato, pedirComCredencial, type ServidorDeContrato } from "./apoio-de-contrato.ts";

let contrato: ServidorDeContrato;
let servidor: FastifyInstance;
let pasta: string;

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), "http-exportacao-"));
  const imagens = criarArmazemEmDisco({ pasta });
  contrato = await montarServidorDeContrato(({ servidor, acervoDe }) => {
    registrarRotasDeBaralhos(servidor, acervoDe);
    registrarRotasDeCartoes(servidor, acervoDe);
    registrarRotasDeExportacao(servidor, acervoDe);
  }, {}, {}, { imagens });
  servidor = contrato.servidor;
});

afterEach(async () => {
  await contrato.encerrar();
  await rm(pasta, { recursive: true, force: true });
});

function pedir(requisicao: InjectOptions) {
  return pedirComCredencial(servidor, contrato.credencial, requisicao);
}

describe("POST /exportacoes", () => {
  it("exige autenticação e valida os corpos nos dois endpoints", async () => {
    const semCredencial = await servidor.inject({ method: "POST", url: "/exportacoes/previa", payload: { formato: "apkg", baralhos: "todos" } });
    expect(semCredencial.statusCode).toBe(401);

    for (const [url, payload] of [
      ["/exportacoes/previa", { formato: "apkg", baralhos: [] }],
      ["/exportacoes", { formato: "apkg", baralhos: "todos", fuso: "not-a-zone", idioma: "pt" }],
      ["/exportacoes", { formato: "apkg", baralhos: "todos", fuso: "UTC", idioma: "fr" }],
    ] as const) {
      const resposta = await pedir({ method: "POST", url, payload });
      expect(resposta.statusCode).toBe(400);
    }
  });

  it("retorna recusa estável para um acervo sem cartões", async () => {
    const baralho = await pedir({ method: "POST", url: "/baralhos", payload: { nome: "Vazio" } });
    expect(baralho.statusCode).toBe(201);
    const resultado = await pedir({
      method: "POST", url: "/exportacoes/previa",
      payload: { formato: "apkg", baralhos: [(baralho.json() as { id: string }).id] },
    });
    expect(resultado.statusCode).toBe(422);
    expect(resultado.json()).toMatchObject({ erro: "exportacao_vazia", mensagem: "Nothing to export." });
  });

  it("responde 404 nao_encontrado para um Baralho de outro Usuário, na prévia e na geração", async () => {
    const outro = await contrato.cadastrar("outra.pessoa");
    const alheio = await pedirComCredencial(servidor, outro, { method: "POST", url: "/baralhos", payload: { nome: "Alheio" } });
    expect(alheio.statusCode).toBe(201);
    const id = (alheio.json() as { id: string }).id;

    for (const url of ["/exportacoes/previa", "/exportacoes"]) {
      const resposta = await pedir({
        method: "POST", url,
        payload: { formato: "apkg", baralhos: [id], fuso: "UTC", idioma: "pt" },
      });
      expect(resposta.statusCode).toBe(404);
      expect(resposta.json()).toMatchObject({ erro: "nao_encontrado", mensagem: "Not found." });
    }
  });

  it("responde 400 quando o formato falta ou os ids se repetem, com código estável e mensagem ASCII", async () => {
    const baralho = await pedir({ method: "POST", url: "/baralhos", payload: { nome: "Repetido" } });
    const id = (baralho.json() as { id: string }).id;

    const semFormato = await pedir({ method: "POST", url: "/exportacoes/previa", payload: { baralhos: "todos" } });
    expect(semFormato.statusCode).toBe(400);
    expect(["corpo_invalido", "dados_invalidos"]).toContain((semFormato.json() as { erro: string }).erro);
    expect((semFormato.json() as { mensagem: string }).mensagem).toMatch(/^[\x20-\x7E]+$/);

    const repetidos = await pedir({ method: "POST", url: "/exportacoes/previa", payload: { formato: "apkg", baralhos: [id, id] } });
    expect(repetidos.statusCode).toBe(400);
    expect(["corpo_invalido", "dados_invalidos"]).toContain((repetidos.json() as { erro: string }).erro);
    expect((repetidos.json() as { mensagem: string }).mensagem).toMatch(/^[\x20-\x7E]+$/);
  });
});

/**
 * Servidor com o Acervo sobre um snapshot fabricado e um armazém de Mídia
 * controlado. Serve para os limites (10 000 Cartões, 100 MiB de Mídia) e para a
 * falha do armazém, que seriam caros ou impossíveis de provocar pelo fluxo real.
 * A Credencial e as rotas são as da aplicação.
 */
async function servidorComSnapshot(conteudo: ConteudoArmazenado, imagens: ArmazemDeMidia) {
  const aberto = await abrirArmazenamentoSqlite(":memory:");
  const identidade = criarIdentidade(aberto.usuarios, segredoGerado());
  const armazenamento: ArmazenamentoDoAcervo = {
    ...aberto.armazenamento,
    async lerAcervoParaExportacao() {
      return { ok: true, valor: conteudo };
    },
  };
  const servidorDeSnapshot = criarServidor(identidade);
  registrarRotasDeExportacao(servidorDeSnapshot, (usuarioId) => criarAcervo(armazenamento, usuarioId, { imagens }));
  const credencialDeSnapshot = await cadastrarUsuarioDeTeste(identidade);
  return {
    servidor: servidorDeSnapshot,
    credencial: credencialDeSnapshot,
    async encerrar() {
      await servidorDeSnapshot.close();
      await aberto.encerrar();
    },
  };
}

function conteudoCom(cartoes: ConteudoArmazenado["baralhos"][number]["cartoes"]): ConteudoArmazenado {
  return { baralhos: [{ id: "00000000-0000-4000-8000-000000000001", nome: "Grande", criadoEm: null, cartoes }] };
}

function cartaoFalso(id: string, extra: { imagemChave?: string; tipo?: "frente-verso" | "imagem" } = {}) {
  return { id, frente: "Frente", verso: "Verso", tipo: extra.tipo ?? "frente-verso", tags: [], progresso: null, ...extra };
}

describe("POST /exportacoes — recusas de limite e de armazém", () => {
  it("responde 422 exportacao_grande_demais com motivo cartoes e limite 10000 acima do limite", async () => {
    const cartoes = Array.from({ length: 10_001 }, (_, i) => cartaoFalso(`cartao-${i}`));
    const alvo = await servidorComSnapshot(conteudoCom(cartoes), criarArmazemEmDisco({ pasta }));
    try {
      for (const url of ["/exportacoes/previa", "/exportacoes"]) {
        const resposta = await pedirComCredencial(alvo.servidor, alvo.credencial, {
          method: "POST", url,
          payload: { formato: "apkg", baralhos: "todos", fuso: "UTC", idioma: "pt" },
        });
        expect(resposta.statusCode).toBe(422);
        expect(resposta.json()).toMatchObject({
          erro: "exportacao_grande_demais",
          mensagem: "Export exceeds the size limit.",
          motivo: "cartoes",
          limite: 10_000,
        });
      }
    } finally {
      await alvo.encerrar();
    }
  });

  it("responde 422 exportacao_grande_demais com motivo midia e limite 104857600 acima do limite", async () => {
    const imagens: ArmazemDeMidia = {
      ...criarArmazemEmDisco({ pasta }),
      medir: async () => 104_857_601,
    };
    const alvo = await servidorComSnapshot(conteudoCom([cartaoFalso("c1", { imagemChave: "imagens/u/a.png", tipo: "imagem" })]), imagens);
    try {
      const resposta = await pedirComCredencial(alvo.servidor, alvo.credencial, {
        method: "POST", url: "/exportacoes/previa",
        payload: { formato: "apkg", baralhos: "todos" },
      });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json()).toMatchObject({
        erro: "exportacao_grande_demais",
        motivo: "midia",
        limite: 104_857_600,
      });
    } finally {
      await alvo.encerrar();
    }
  });

  it("responde 503 exportacao_indisponivel quando a leitura da Mídia falha, sem entregar arquivo", async () => {
    const imagens: ArmazemDeMidia = {
      ...criarArmazemEmDisco({ pasta }),
      medir: async () => {
        throw new Error("armazém fora do ar");
      },
    };
    const alvo = await servidorComSnapshot(conteudoCom([cartaoFalso("c1", { imagemChave: "imagens/u/a.png", tipo: "imagem" })]), imagens);
    try {
      const resposta = await pedirComCredencial(alvo.servidor, alvo.credencial, {
        method: "POST", url: "/exportacoes",
        payload: { formato: "apkg", baralhos: "todos", fuso: "UTC", idioma: "pt" },
      });
      expect(resposta.statusCode).toBe(503);
      expect(resposta.json()).toMatchObject({ erro: "exportacao_indisponivel", mensagem: "Export is unavailable." });
      expect(resposta.json()).not.toHaveProperty("url");
    } finally {
      await alvo.encerrar();
    }
  });

  it("responde 503 exportacao_indisponivel quando o armazém não guarda o pacote", async () => {
    const imagens: ArmazemDeMidia = {
      ...criarArmazemEmDisco({ pasta }),
      guardarExportacao: async () => {
        throw new Error("gravação recusada");
      },
    };
    const alvo = await servidorComSnapshot(conteudoCom([cartaoFalso("c1")]), imagens);
    try {
      const resposta = await pedirComCredencial(alvo.servidor, alvo.credencial, {
        method: "POST", url: "/exportacoes",
        payload: { formato: "apkg", baralhos: "todos", fuso: "UTC", idioma: "pt" },
      });
      expect(resposta.statusCode).toBe(503);
      expect(resposta.json()).toMatchObject({ erro: "exportacao_indisponivel", mensagem: "Export is unavailable." });
    } finally {
      await alvo.encerrar();
    }
  });
});

describe("POST /exportacoes — logs não contêm nome, texto de Cartão nem url (FR-482)", () => {
  /** Captura tudo o que o processo escreve em console e nos fluxos padrão durante `fazer`. */
  async function capturandoSaida<T>(fazer: () => Promise<T>): Promise<{ resultado: T; saida: string }> {
    const linhas: string[] = [];
    const gravar = (...partes: unknown[]) => {
      linhas.push(partes.map((parte) => (typeof parte === "string" ? parte : JSON.stringify(parte) ?? String(parte))).join(" "));
      return true;
    };
    const espioes = [
      vi.spyOn(console, "log").mockImplementation(gravar),
      vi.spyOn(console, "info").mockImplementation(gravar),
      vi.spyOn(console, "warn").mockImplementation(gravar),
      vi.spyOn(console, "error").mockImplementation(gravar),
      vi.spyOn(console, "debug").mockImplementation(gravar),
      vi.spyOn(process.stdout, "write").mockImplementation(gravar as never),
      vi.spyOn(process.stderr, "write").mockImplementation(gravar as never),
    ];
    try {
      const resultado = await fazer();
      return { resultado, saida: linhas.join("\n") };
    } finally {
      espioes.forEach((espiao) => espiao.mockRestore());
    }
  }

  it("não expõe o nome do Baralho, a Frente do Cartão nem a url na exportação com sucesso", async () => {
    const baralho = await pedir({ method: "POST", url: "/baralhos", payload: { nome: "Inglês secreto" } });
    const id = (baralho.json() as { id: string }).id;
    const cartao = await pedir({ method: "POST", url: `/baralhos/${id}/cartoes`, payload: { frente: "Pergunta secreta", verso: "Resposta" } });
    expect(cartao.statusCode).toBe(201);

    const { resultado, saida } = await capturandoSaida(() => pedir({
      method: "POST", url: "/exportacoes",
      payload: { formato: "apkg", baralhos: [id], fuso: "America/Sao_Paulo", idioma: "pt" },
    }));

    expect(resultado.statusCode).toBe(201);
    const url = (resultado.json() as { url: string }).url;
    expect(url).toBeTruthy();
    expect(saida).not.toContain("Inglês secreto");
    expect(saida).not.toContain("Pergunta secreta");
    expect(saida).not.toContain(url);
  });

  it("não expõe o nome do Baralho na recusa, que é a outra saída que um log pode ter", async () => {
    const baralho = await pedir({ method: "POST", url: "/baralhos", payload: { nome: "Vazio secreto" } });
    const id = (baralho.json() as { id: string }).id;

    const { resultado, saida } = await capturandoSaida(() => pedir({
      method: "POST", url: "/exportacoes",
      payload: { formato: "apkg", baralhos: [id], fuso: "UTC", idioma: "pt" },
    }));

    expect(resultado.statusCode).toBe(422);
    expect(saida).not.toContain("Vazio secreto");
  });
});
