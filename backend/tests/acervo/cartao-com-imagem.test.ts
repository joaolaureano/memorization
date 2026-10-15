import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  criarAcervo,
  processarFilaDeMidia,
  type Acervo,
  type CartaoApresentado,
} from "../../src/acervo/acervo.ts";
import type { ArmazenamentoDoAcervo } from "../../src/armazenamento/porta.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import {
  criarArmazemEmDisco,
  type ArmazemEmDisco,
} from "../../src/midia/armazem-em-disco.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";
import { pngComMetadados, textoDisfarcado } from "../midia/amostras.ts";

/**
 * T019, T030, T037 — Cartão do tipo Imagem pela Interface do `Acervo`
 * (`026`), com o Adapter local e o armazém em Disco.
 *
 * O que se observa é o que um caller observa: os resultados do `Acervo` e o
 * endereço de exibição da Imagem — que deixa de servir quando a Imagem é
 * removida (FR-421).
 */

let aberto: ArmazenamentoSqliteAberto;
let imagens: ArmazemEmDisco;
let dono: string;
let acervo: Acervo;
let baralhoId: string;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  dono = await criarDonoDeTeste(aberto.usuarios);
  imagens = criarArmazemEmDisco({
    pasta: mkdtempSync(join(tmpdir(), "acervo-imagens-")),
  });
  acervo = criarAcervo(aberto.armazenamento, dono, { imagens });
  const baralho = await acervo.criarBaralho({ nome: "Geografia" });
  if (!baralho.ok) throw new Error("baralho recusado");
  baralhoId = baralho.baralho.id;
});

afterEach(async () => {
  await aberto.encerrar();
});

/** Faz o envio de uma Imagem como o navegador; devolve o `imagemId`. */
async function enviar(bytes = pngComMetadados(), usuarioId = dono): Promise<string> {
  const envio = await imagens.prepararEnvio(usuarioId, "imagem");
  const token = new URL(envio.envio.url, "http://local").searchParams.get("t")!;
  expect(await imagens.receberEnvio(token, bytes)).toBe("ok");
  return envio.envioId;
}

/** Diz se o endereço de exibição ainda entrega a Imagem. */
async function serve(cartao: { imagem?: { url: string } | null }): Promise<boolean> {
  const token = new URL(cartao.imagem!.url, "http://local").searchParams.get("t")!;
  return (await imagens.lerParaEntrega(token)) !== null;
}

async function criarImagem(
  dados: Partial<{ frente: string; verso: string; textoAlternativo: string }> = {},
  alvo: Acervo = acervo,
): Promise<CartaoApresentado> {
  const criado = await alvo.criarCartao(baralhoId, {
    tipo: "imagem",
    imagemId: await enviar(),
    frente: dados.frente ?? "",
    verso: dados.verso ?? "Pernambuco",
    ...(dados.textoAlternativo !== undefined
      ? { textoAlternativo: dados.textoAlternativo }
      : {}),
  });
  if (!criado.ok) throw new Error(JSON.stringify(criado));
  return criado.cartao;
}

describe("criar Cartão do tipo Imagem (FR-408, FR-409, FR-412, FR-414)", () => {
  it("sem tipo continua criando Frente-Verso, sem campos de Imagem (FR-405)", async () => {
    const criado = await acervo.criarCartao(baralhoId, { frente: "To walk", verso: "Caminhar" });

    expect(criado).toEqual({
      ok: true,
      cartao: { id: expect.any(String), frente: "To walk", verso: "Caminhar" },
    });
  });

  it("cria com Imagem, Texto da frente vazio e Descrição; entrega o endereço e não a chave", async () => {
    const cartao = await criarImagem({ textoAlternativo: "Mapa com um estado destacado" });

    expect(cartao).toEqual({
      id: expect.any(String),
      tipo: "imagem",
      frente: "",
      verso: "Pernambuco",
      textoAlternativo: "Mapa com um estado destacado",
      imagem: { url: expect.any(String), expiraEm: expect.any(String) },
    });
    expect(await serve(cartao)).toBe(true);

    const baralho = await acervo.obterBaralho(baralhoId);
    expect(baralho.ok && baralho.baralho.cartoes).toEqual([
      expect.objectContaining({ id: cartao.id, tipo: "imagem", imagem: expect.any(Object) }),
    ]);
    expect(JSON.stringify(baralho)).not.toContain("imagemChave");
  });

  it("recusa o tipo Imagem sem Imagem (imagem_ausente)", async () => {
    expect(
      await acervo.criarCartao(baralhoId, { tipo: "imagem", frente: "", verso: "Pernambuco" }),
    ).toEqual({ ok: false, erro: "imagem_ausente", mensagem: "Choose an image." });
  });

  it("aplica as regras de texto vigentes ao Verso e o limite de 250 à Descrição", async () => {
    const imagemId = await enviar();

    expect(
      await acervo.criarCartao(baralhoId, { tipo: "imagem", imagemId, frente: "", verso: "  " }),
    ).toMatchObject({ ok: false, erro: "verso_vazio" });
    expect(
      await acervo.criarCartao(baralhoId, {
        tipo: "imagem",
        imagemId,
        frente: "",
        verso: "Pernambuco",
        textoAlternativo: "a".repeat(251),
      }),
    ).toMatchObject({ ok: false, erro: "descricao_muito_longa" });

    // A recusa de texto não consome o envio: a nova tentativa usa o mesmo.
    expect(
      await acervo.criarCartao(baralhoId, {
        tipo: "imagem",
        imagemId,
        frente: "",
        verso: "Pernambuco",
        textoAlternativo: "a".repeat(250),
      }),
    ).toMatchObject({ ok: true });
  });

  it("deixa Imagens sem Texto da frente fora da unicidade e numera o Texto repetido", async () => {
    await criarImagem();
    await criarImagem();
    await criarImagem({ frente: "Qual estado?" });
    const repetido = await criarImagem({ frente: "qual estado?" });

    expect(repetido.frente).toBe("qual estado? (2)");
  });

  it("recusa conteúdo que não é imagem e envio de outro Usuário (imagem_invalida)", async () => {
    expect(
      await acervo.criarCartao(baralhoId, {
        tipo: "imagem",
        imagemId: await enviar(textoDisfarcado()),
        frente: "",
        verso: "Pernambuco",
      }),
    ).toEqual({
      ok: false,
      erro: "imagem_invalida",
      motivo: "formato",
      mensagem: "File is not a JPEG, PNG, WebP, or GIF image.",
    });

    const outro = await criarDonoDeTeste(aberto.usuarios, "dono-dois", "bruno.costa");
    expect(
      await acervo.criarCartao(baralhoId, {
        tipo: "imagem",
        imagemId: await enviar(pngComMetadados(), outro),
        frente: "",
        verso: "Pernambuco",
      }),
    ).toMatchObject({ ok: false, erro: "imagem_invalida", motivo: "nao_encontrada" });
  });

  it("não deixa Cartão nem Imagem órfã quando a gravação falha (FR-423)", async () => {
    const quebrado: ArmazenamentoDoAcervo = {
      ...aberto.armazenamento,
      inserirCartaoNoBaralho: async () => ({ ok: false, erro: "indisponivel" }),
    };
    const fragil = criarAcervo(quebrado, dono, { imagens });
    const imagemId = await enviar();

    expect(
      await fragil.criarCartao(baralhoId, { tipo: "imagem", imagemId, frente: "", verso: "Pernambuco" }),
    ).toMatchObject({ ok: false, erro: "indisponivel" });
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
    expect((await acervo.obterBaralho(baralhoId)).ok && (await acervo.listarCartoes())).toEqual([]);
  });

  it("recusa o tipo Imagem como indisponível quando não há armazém", async () => {
    const semArmazem = criarAcervo(aberto.armazenamento, dono);

    expect(
      await semArmazem.criarCartao(baralhoId, {
        tipo: "imagem",
        imagemId: await enviar(),
        frente: "",
        verso: "Pernambuco",
      }),
    ).toMatchObject({ ok: false, erro: "indisponivel" });
  });
});

describe("estudar Cartão do tipo Imagem (FR-416, FR-419a)", () => {
  it("lista com endereço e registra o snapshot com o tipo e sem a Imagem", async () => {
    const cartao = await criarImagem({ frente: "" });

    const listados = await acervo.listarCartoes();
    expect(listados).toEqual([
      expect.objectContaining({ id: cartao.id, tipo: "imagem", imagem: expect.any(Object) }),
    ]);

    const registrado = await acervo.registrarSessao({
      id: "6f0b7d34-1f4e-4c55-9b0b-0f2f9e3f5a11",
      origem: "baralho",
      baralhoId,
      nomeDoBaralho: "Geografia",
      itens: [{ tipo: "imagem", frente: "", verso: "Pernambuco", cartaoId: cartao.id, avaliacao: "bom" }],
    });
    expect(registrado.ok).toBe(true);

    const lido = await acervo.obterRegistroDeSessao("6f0b7d34-1f4e-4c55-9b0b-0f2f9e3f5a11");
    expect(lido.ok && lido.registro.itens).toEqual([
      expect.objectContaining({ tipo: "imagem", frente: "", verso: "Pernambuco" }),
    ]);
    expect(JSON.stringify(lido)).not.toMatch(/imagens\/|"imagem":|"url"/);

    const depois = await acervo.listarCartoes();
    expect(depois[0]?.proximaRevisaoEm).not.toBeNull();
  });
});

describe("editar e excluir Cartão do tipo Imagem (FR-420, FR-421, FR-422)", () => {
  it("não muda o tipo depois da criação (tipo_imutavel)", async () => {
    const cartao = await criarImagem();

    expect(
      await acervo.editarCartao(cartao.id, { frente: "F", verso: "Pernambuco" }),
    ).toMatchObject({ ok: false, erro: "tipo_imutavel" });
    const frenteVerso = await acervo.criarCartao(baralhoId, { frente: "To walk", verso: "Caminhar" });
    if (!frenteVerso.ok) throw new Error("recusado");
    expect(
      await acervo.editarCartao(frenteVerso.cartao.id, {
        tipo: "imagem",
        imagemId: await enviar(),
        frente: "",
        verso: "Caminhar",
      }),
    ).toMatchObject({ ok: false, erro: "tipo_imutavel" });
  });

  it("edita os textos mantendo a Imagem e troca a Imagem removendo a anterior", async () => {
    const cartao = await criarImagem();

    const textos = await acervo.editarCartao(cartao.id, {
      tipo: "imagem",
      frente: "Qual estado?",
      verso: "Pernambuco",
      textoAlternativo: "Mapa",
    });
    expect(textos).toMatchObject({ ok: true, cartao: { frente: "Qual estado?", textoAlternativo: "Mapa" } });
    expect(await serve(cartao)).toBe(true);

    const trocado = await acervo.editarCartao(cartao.id, {
      tipo: "imagem",
      imagemId: await enviar(),
      frente: "Qual estado?",
      verso: "Pernambuco",
    });
    if (!trocado.ok) throw new Error(JSON.stringify(trocado));
    expect(await serve(trocado.cartao)).toBe(true);
    expect(await serve(cartao)).toBe(false);
  });

  it("mantém o Cartão e descarta a Imagem nova quando a gravação da edição falha (FR-423)", async () => {
    const cartao = await criarImagem();
    const quebrado: ArmazenamentoDoAcervo = {
      ...aberto.armazenamento,
      atualizarCartao: async () => ({ ok: false, erro: "indisponivel" }),
    };
    const fragil = criarAcervo(quebrado, dono, { imagens });

    expect(
      await fragil.editarCartao(cartao.id, {
        tipo: "imagem",
        imagemId: await enviar(),
        frente: "",
        verso: "Outro",
      }),
    ).toMatchObject({ ok: false, erro: "indisponivel" });
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
    expect(await serve(cartao)).toBe(true);
    expect((await acervo.listarCartoes())[0]).toMatchObject({ verso: "Pernambuco" });
  });

  it("remove a Imagem ao excluir o Cartão e ao excluir o Baralho", async () => {
    const primeiro = await criarImagem();
    const segundo = await criarImagem();

    expect(await acervo.excluirCartao(primeiro.id)).toEqual({ ok: true });
    expect(await serve(primeiro)).toBe(false);
    expect(await serve(segundo)).toBe(true);

    expect(await acervo.excluirBaralho(baralhoId)).toEqual({ ok: true });
    expect(await serve(segundo)).toBe(false);
  });

  it("remove as Imagens do Usuário excluído pela fila", async () => {
    const cartao = await criarImagem();

    expect((await aberto.usuarios.excluirUsuario(dono)).ok).toBe(true);
    await processarFilaDeMidia(aberto.armazenamento, imagens);

    expect(await serve(cartao)).toBe(false);
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
  });

  it("nunca remove Mídia de demonstração que esteja na fila, e a tira da fila (FR-500)", async () => {
    const envioId = await enviar();
    const confirmada = await imagens.confirmar(dono, envioId, "imagem");
    if (!confirmada.ok) throw new Error("recusada");
    const demo = "demonstracao/bandeiras/x.png";
    await imagens.gravarArquivoFixo(demo, pngComMetadados(), "image/png");
    await aberto.armazenamento.enfileirarMidiaARemover([demo, confirmada.chave]);

    await processarFilaDeMidia(aberto.armazenamento, imagens);

    expect(await imagens.ler(confirmada.chave)).toBeNull();
    expect(await imagens.ler(demo)).not.toBeNull();
    const endereco = await imagens.enderecoDeLeitura(demo);
    const token = new URL(endereco.url, "http://local").searchParams.get("t")!;
    expect(await imagens.lerParaEntrega(token)).not.toBeNull();
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
  });

  it("guarda na fila o que o armazém não conseguiu remover e tenta de novo", async () => {
    const cartao = await criarImagem();
    const armazemQueFalha: ArmazemEmDisco = {
      ...imagens,
      remover: async () => {
        throw new Error("armazém fora do ar");
      },
    };
    const comFalha = criarAcervo(aberto.armazenamento, dono, { imagens: armazemQueFalha });

    expect(await comFalha.excluirCartao(cartao.id)).toEqual({ ok: true });
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toHaveLength(1);
    expect(await serve(cartao)).toBe(true);

    await processarFilaDeMidia(aberto.armazenamento, imagens);
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
    expect(await serve(cartao)).toBe(false);
  });

  it("dá à Cópia uma Imagem própria: excluir o original não a afeta (FR-422)", async () => {
    const original = await criarImagem({ frente: "Qual estado?" });

    const salvo = await acervo.salvarSelecaoComoBaralho({
      id: "0d6c2f7e-8a3b-4c1d-9e2f-3a4b5c6d7e8f",
      nome: "Revisão",
      cartaoIds: [original.id],
    });
    if (!salvo.ok) throw new Error(JSON.stringify(salvo));

    const copiado = await acervo.obterBaralho(salvo.baralho.id);
    if (!copiado.ok) throw new Error("baralho ausente");
    const copia = copiado.baralho.cartoes[0]!;
    expect(copia).toMatchObject({ tipo: "imagem", frente: "Qual estado?", verso: "Pernambuco" });

    await acervo.excluirCartao(original.id);
    expect(await serve(original)).toBe(false);
    expect(await serve(copia)).toBe(true);
  });
});
