// Conteúdo do Acervo de demonstração (030, T008).

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ACERVO_DE_DEMONSTRACAO } from "../../src/demonstracao/acervo.ts";
import { CREDITOS } from "../../src/demonstracao/creditos.ts";
import {
  ARQUIVOS_DE_DEMONSTRACAO,
  garantirMidiaDeDemonstracao,
  pastaDaDemonstracao,
} from "../../src/demonstracao/midia.ts";
import {
  LIMITE_DE_BYTES_DA_IMAGEM,
  type ArmazemDeMidia,
} from "../../src/midia/armazem.ts";
import {
  LIMITE_DE_BYTES_DO_AUDIO,
  LIMITE_DE_DURACAO_DO_AUDIO_EM_MS,
  reconhecerAudio,
} from "../../src/midia/audio/reconhecer.ts";
import { detectarFormato } from "../../src/midia/imagem/formato.ts";
import { removerMetadados } from "../../src/midia/imagem/metadados.ts";

const LIMITE_DE_LARGURA_DA_BANDEIRA_EM_PX = 640;
const LIMITE_DE_DURACAO_DO_CANTO_EM_MS = 20_000;
const TEXTOS_ALTERNATIVOS_DAS_BANDEIRAS = [
  "Bandeira do Brasil",
  "Bandeira do Japão",
  "Bandeira do Canadá",
  "Bandeira da Alemanha",
  "Bandeira da Itália",
  "Bandeira da Argentina",
  "Bandeira da Índia",
  "Bandeira do Quênia",
  "Bandeira da Suécia",
  "Bandeira do México",
];
const LICENCAS_PERMITIDAS = /^(LicenseRef-Public-Domain|CC0-1\.0|CC-BY-(SA-)?\d\.\d)$/;

const baralhos = ACERVO_DE_DEMONSTRACAO.baralhos;
const [ingles] = baralhos;

function baralhoDe(nome: string) {
  const achado = baralhos.find((baralho) => baralho.nome === nome);
  if (achado === undefined) throw new Error(`Baralho ausente: ${nome}`);
  return achado;
}

function creditoDe(chave: string) {
  const achado = CREDITOS.find((credito) => credito.chave === chave);
  if (achado === undefined) throw new Error(`Crédito ausente: ${chave}`);
  return achado;
}

function bytesDoArquivo(caminho: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(caminho, pastaDaDemonstracao())));
}

describe("Acervo de demonstração: conteúdo (FR-492, FR-493)", () => {
  it("o Baralho Inglês tem 12 Cartões Frente-Verso com as Tags do contrato", () => {
    expect(baralhos.map((baralho) => baralho.nome)).toEqual([
      "Inglês",
      "Bandeiras",
      "Cantos de pássaros",
    ]);
    expect(ingles?.cartoes.map((cartao) => cartao.frente)).toEqual([
      "apple",
      "book",
      "house",
      "water",
      "friend",
      "kitchen",
      "window",
      "to learn",
      "to remember",
      "to forget",
      "beautiful",
      "tomorrow",
    ]);
    expect(ingles?.cartoes.map((cartao) => cartao.verso)).toEqual([
      "maçã",
      "livro",
      "casa",
      "água",
      "amigo",
      "cozinha",
      "janela",
      "aprender",
      "lembrar",
      "esquecer",
      "bonito",
      "amanhã",
    ]);
    expect(ingles?.cartoes.every((cartao) => cartao.tipo === "frente-verso")).toBe(true);
    expect(ingles?.cartoes.map((cartao) => cartao.tags?.join(","))).toEqual([
      "substantivo",
      "substantivo",
      "substantivo",
      "substantivo",
      "substantivo",
      "substantivo",
      "substantivo",
      "verbo",
      "verbo",
      "verbo",
      "adjetivo",
      "advérbio",
    ]);
  });

  it("o Baralho Bandeiras tem 10 Cartões de Imagem, sem texto na frente e com a descrição alternativa do contrato", () => {
    const cartoes = baralhoDe("Bandeiras").cartoes;
    expect(cartoes.map((cartao) => cartao.verso)).toEqual([
      "Brasil",
      "Japão",
      "Canadá",
      "Alemanha",
      "Itália",
      "Argentina",
      "Índia",
      "Quênia",
      "Suécia",
      "México",
    ]);
    expect(cartoes.every((cartao) => cartao.tipo === "imagem")).toBe(true);
    expect(cartoes.every((cartao) => cartao.frente === "")).toBe(true);
    expect(cartoes.map((cartao) => cartao.textoAlternativo)).toEqual(TEXTOS_ALTERNATIVOS_DAS_BANDEIRAS);
    for (const cartao of cartoes) {
      expect(cartao.midiaChave).toMatch(/^demonstracao\/bandeiras\/[a-z]+\.png$/);
    }
  });

  it("o Baralho Cantos de pássaros tem 10 Cartões de Áudio, sem Mensagem na frente e com o verso do contrato", () => {
    const cartoes = baralhoDe("Cantos de pássaros").cartoes;
    expect(cartoes).toHaveLength(10);
    expect(cartoes.every((cartao) => cartao.tipo === "audio")).toBe(true);
    expect(cartoes.every((cartao) => cartao.frente === "")).toBe(true);
    expect(cartoes.map((cartao) => cartao.verso)).toEqual([
      "Sabiá-laranjeira (Turdus rufiventris)",
      "Bem-te-vi (Pitangus sulphuratus)",
      "João-de-barro (Furnarius rufus)",
      "Cambacica (Coereba flaveola)",
      "Tico-tico (Zonotrichia capensis)",
      "Tiziu (Volatinia jacarina)",
      "Anu-branco (Guira guira)",
      "Corruíra (Troglodytes musculus)",
      "Pomba-asa-branca (Patagioenas picazuro)",
      "Seriema (Cariama cristata)",
    ]);
    for (const cartao of cartoes) {
      const credito = creditoDe(cartao.midiaChave ?? "");
      expect(cartao.verso).toBe(`${credito.cartao} (${credito.cientifico})`);
      expect(cartao.duracaoMs).toBe(credito.duracaoMs);
    }
  });

  it("cada Baralho tem de 8 a 15 Cartões (FR-493)", () => {
    for (const baralho of baralhos) {
      expect(baralho.cartoes.length).toBeGreaterThanOrEqual(8);
      expect(baralho.cartoes.length).toBeLessThanOrEqual(15);
    }
  });

  it("cada arquivo de mídia é usado por exatamente um Cartão, e cada Cartão aponta para um arquivo existente", () => {
    const chaves = ARQUIVOS_DE_DEMONSTRACAO.map((arquivo) => arquivo.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    const usadas = baralhos
      .flatMap((baralho) => baralho.cartoes)
      .map((cartao) => cartao.midiaChave)
      .filter((chave): chave is string => chave !== undefined);
    expect([...usadas].sort()).toEqual([...chaves].sort());
  });
});

describe("Acervo de demonstração: arquivos de mídia (FR-492)", () => {
  it("cada arquivo existe, é reconhecido pelo formato e tem a mesma forma do Cartão", () => {
    for (const arquivo of ARQUIVOS_DE_DEMONSTRACAO) {
      const bytes = bytesDoArquivo(arquivo.caminho);
      if (arquivo.tipoDeConteudo.startsWith("image/")) {
        expect(detectarFormato(bytes), arquivo.chave).toBe(arquivo.tipoDeConteudo);
      } else {
        const reconhecido = reconhecerAudio(bytes);
        expect(reconhecido.ok, arquivo.chave).toBe(true);
        if (reconhecido.ok) expect(reconhecido.formato).toBe(arquivo.tipoDeConteudo);
      }
    }
  });

  it("cada arquivo sai idêntico da remoção de metadados (026) ou do reconhecimento de Áudio (028)", () => {
    for (const arquivo of ARQUIVOS_DE_DEMONSTRACAO) {
      const bytes = bytesDoArquivo(arquivo.caminho);
      if (arquivo.tipoDeConteudo.startsWith("image/")) {
        const formato = detectarFormato(bytes);
        expect(formato).not.toBeNull();
        const limpo = removerMetadados(bytes, formato!);
        expect(limpo, arquivo.chave).not.toBeNull();
        expect(Buffer.from(limpo!).equals(Buffer.from(bytes)), arquivo.chave).toBe(true);
      } else {
        const reconhecido = reconhecerAudio(bytes);
        expect(reconhecido.ok).toBe(true);
        if (reconhecido.ok) {
          expect(Buffer.from(reconhecido.bytes).equals(Buffer.from(bytes)), arquivo.chave).toBe(true);
        }
      }
    }
  });

  it("cada arquivo respeita os limites da 026 e da 028 (tamanho, largura e duração)", () => {
    for (const arquivo of ARQUIVOS_DE_DEMONSTRACAO) {
      const bytes = bytesDoArquivo(arquivo.caminho);
      if (arquivo.tipoDeConteudo === "image/png") {
        expect(bytes.length, arquivo.chave).toBeLessThanOrEqual(LIMITE_DE_BYTES_DA_IMAGEM);
        const largura = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16);
        expect(largura, arquivo.chave).toBeLessThanOrEqual(LIMITE_DE_LARGURA_DA_BANDEIRA_EM_PX);
      } else {
        expect(bytes.length, arquivo.chave).toBeLessThanOrEqual(LIMITE_DE_BYTES_DO_AUDIO);
        const reconhecido = reconhecerAudio(bytes);
        expect(reconhecido.ok).toBe(true);
        if (reconhecido.ok) {
          expect(reconhecido.duracaoMs, arquivo.chave).toBeLessThanOrEqual(LIMITE_DE_DURACAO_DO_AUDIO_EM_MS);
          expect(reconhecido.duracaoMs, arquivo.chave).toBeLessThanOrEqual(LIMITE_DE_DURACAO_DO_CANTO_EM_MS);
        }
      }
    }
  });
});

describe("Acervo de demonstração: créditos (FR-494, SC-197)", () => {
  it("há exatamente um crédito por arquivo de mídia, e nenhum sobrando", () => {
    expect(CREDITOS).toHaveLength(ARQUIVOS_DE_DEMONSTRACAO.length);
    expect(CREDITOS.map((credito) => credito.chave).sort()).toEqual(
      ARQUIVOS_DE_DEMONSTRACAO.map((arquivo) => arquivo.chave).sort(),
    );
  });

  it("cada arquivo tem título, autor, fonte e licença completos", () => {
    for (const arquivo of ARQUIVOS_DE_DEMONSTRACAO) {
      const credito = creditoDe(arquivo.chave);
      expect(credito.titulo.trim(), arquivo.chave).not.toBe("");
      expect(credito.autor.trim(), arquivo.chave).not.toBe("");
      expect(credito.fonte, arquivo.chave).toMatch(/^https:\/\//);
      expect(credito.licenca, arquivo.chave).not.toBe("");
    }
  });

  it("cada licença é de domínio público, CC0, CC BY ou CC BY-SA, sem NC nem ND", () => {
    for (const credito of CREDITOS) {
      expect(credito.licenca, credito.chave).toMatch(LICENCAS_PERMITIDAS);
      expect(credito.licenca, credito.chave).not.toMatch(/NC|ND/);
    }
  });
});

describe("garantirMidiaDeDemonstracao (R13)", () => {
  /** Armazém falso: guarda bytes por chave e conta as gravações. */
  function armazemFalso(jaExistentes: readonly string[]) {
    const guardados = new Map<string, Uint8Array>(
      jaExistentes.map((chave) => [chave, new Uint8Array([1, 2, 3, 4, 5])]),
    );
    const gravacoes: string[] = [];
    const armazem = {
      async medir(chaves: readonly string[]) {
        return chaves.reduce((soma, chave) => soma + (guardados.get(chave)?.length ?? 0), 0);
      },
      async gravarArquivoFixo(chave: string, bytes: Uint8Array) {
        gravacoes.push(chave);
        guardados.set(chave, bytes);
      },
    };
    return { armazem: armazem as unknown as ArmazemDeMidia, gravacoes, guardados };
  }

  it("grava só as chaves que faltam, com os bytes dos arquivos, e não grava de novo", async () => {
    const existentes = ARQUIVOS_DE_DEMONSTRACAO.slice(0, 3).map((arquivo) => arquivo.chave);
    const { armazem, gravacoes, guardados } = armazemFalso(existentes);

    await garantirMidiaDeDemonstracao(armazem);

    const faltantes = ARQUIVOS_DE_DEMONSTRACAO.slice(3);
    expect(gravacoes).toEqual(faltantes.map((arquivo) => arquivo.chave));
    for (const arquivo of faltantes) {
      expect(Buffer.from(guardados.get(arquivo.chave)!).equals(Buffer.from(bytesDoArquivo(arquivo.caminho)))).toBe(true);
    }
    for (const arquivo of ARQUIVOS_DE_DEMONSTRACAO.slice(0, 3)) {
      expect(guardados.get(arquivo.chave)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    }

    await garantirMidiaDeDemonstracao(armazem);
    expect(gravacoes).toHaveLength(faltantes.length);
  });

  it("grava as vinte chaves num armazém vazio e memoriza por armazém", async () => {
    const primeiro = armazemFalso([]);
    await Promise.all([
      garantirMidiaDeDemonstracao(primeiro.armazem),
      garantirMidiaDeDemonstracao(primeiro.armazem),
    ]);
    expect(primeiro.gravacoes).toHaveLength(ARQUIVOS_DE_DEMONSTRACAO.length);

    const segundo = armazemFalso([]);
    await garantirMidiaDeDemonstracao(segundo.armazem);
    expect(segundo.gravacoes).toHaveLength(ARQUIVOS_DE_DEMONSTRACAO.length);
  });
});
