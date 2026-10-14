import { existsSync, mkdtempSync, readdirSync } from "node:fs";
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
import { criarIdentidade } from "../../src/identidade/identidade.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import {
  criarArmazemEmDisco,
  type ArmazemEmDisco,
} from "../../src/midia/armazem-em-disco.ts";
import {
  cadastrarUsuarioDeTeste,
  criarDonoDeTeste,
  segredoGerado,
} from "../armazenamento/usuarios-de-teste.ts";
import { amostraWav } from "../midia/amostras-de-audio/wav.ts";
import { prepararMundo, criarRotina, FUSO, SEGUNDA } from "../agenda/apoio-de-agenda.ts";

/**
 * T028, T042 — Cartão do tipo Áudio pela Interface do `Acervo` (`028`), com o
 * Adapter local e o armazém em Disco (mesmo setup do Cartão com Imagem).
 *
 * O que se observa é o que um caller observa: os resultados do `Acervo`, o
 * endereço de exibição do Áudio — que deixa de servir quando o Áudio é
 * removido (FR-449) — e o que fica guardado no Armazenamento.
 */

let aberto: ArmazenamentoSqliteAberto;
let pasta: string;
let audios: ArmazemEmDisco;
let dono: string;
let acervo: Acervo;
let baralhoId: string;

beforeEach(async () => {
  aberto = await abrirArmazenamentoSqlite(":memory:");
  dono = await criarDonoDeTeste(aberto.usuarios);
  pasta = mkdtempSync(join(tmpdir(), "acervo-audios-"));
  audios = criarArmazemEmDisco({ pasta });
  acervo = criarAcervo(aberto.armazenamento, dono, { imagens: audios });
  const baralho = await acervo.criarBaralho({ nome: "Japonês" });
  if (!baralho.ok) throw new Error("baralho recusado");
  baralhoId = baralho.baralho.id;
});

afterEach(async () => {
  await aberto.encerrar();
});

/** Faz o envio de um Áudio como o navegador; devolve o `audioId`. */
async function enviar(bytes = amostraWav({ segundos: 1 }), usuarioId = dono): Promise<string> {
  const envio = await audios.prepararEnvio(usuarioId, "audio");
  const token = new URL(envio.envio.url, "http://local").searchParams.get("t")!;
  expect(await audios.receberEnvio(token, bytes)).toBe("ok");
  return envio.envioId;
}

/** Diz se o endereço de exibição ainda entrega o Áudio. */
async function serve(cartao: { audio?: { url: string } | null }): Promise<boolean> {
  const token = new URL(cartao.audio!.url, "http://local").searchParams.get("t")!;
  return (await audios.lerParaEntrega(token)) !== null;
}

async function criarAudio(
  dados: Partial<{ frente: string; verso: string }> = {},
  alvo: Acervo = acervo,
): Promise<CartaoApresentado> {
  const criado = await alvo.criarCartao(baralhoId, {
    tipo: "audio",
    audioId: await enviar(),
    frente: dados.frente ?? "",
    verso: dados.verso ?? "Obrigado",
  });
  if (!criado.ok) throw new Error(JSON.stringify(criado));
  return criado.cartao;
}

describe("criar Cartão do tipo Áudio (FR-434, FR-435, FR-436, FR-439)", () => {
  it("cria com Áudio, Mensagem vazia e Verso; guarda a chave em audios/ e a duração, e entrega o endereço", async () => {
    const criado = await acervo.criarCartao(baralhoId, {
      tipo: "audio",
      audioId: await enviar(amostraWav({ segundos: 1 })),
      frente: "",
      verso: "Obrigado",
    });

    expect(criado).toEqual({
      ok: true,
      cartao: {
        id: expect.any(String),
        tipo: "audio",
        frente: "",
        verso: "Obrigado",
        duracaoMs: 1000,
        audio: { url: expect.any(String), expiraEm: expect.any(String) },
      },
    });
    if (!criado.ok) throw new Error("recusado");
    expect(await serve(criado.cartao)).toBe(true);

    const guardado = await aberto.armazenamento.obterCartao(dono, criado.cartao.id);
    expect(guardado).toMatchObject({
      ok: true,
      valor: {
        audioChave: expect.stringMatching(new RegExp(`^audios/${dono}/`)),
        audioDuracaoMs: 1000,
      },
    });

    const baralho = await acervo.obterBaralho(baralhoId);
    expect(JSON.stringify(baralho)).not.toContain("audioChave");
    expect(JSON.stringify(baralho)).not.toContain("audios/");
  });

  it("recusa o tipo Áudio sem audioId (audio_ausente)", async () => {
    expect(
      await acervo.criarCartao(baralhoId, { tipo: "audio", frente: "", verso: "Obrigado" }),
    ).toEqual({ ok: false, erro: "audio_ausente", mensagem: "Choose an audio file." });
  });

  it("aplica as regras de texto vigentes ao Verso e à Mensagem, sem consumir o envio", async () => {
    const audioId = await enviar();

    expect(
      await acervo.criarCartao(baralhoId, { tipo: "audio", audioId, frente: "", verso: "  " }),
    ).toMatchObject({ ok: false, erro: "verso_vazio" });
    expect(
      await acervo.criarCartao(baralhoId, { tipo: "audio", audioId, frente: "", verso: "a".repeat(1001) }),
    ).toMatchObject({ ok: false, erro: "verso_muito_longo" });
    expect(
      await acervo.criarCartao(baralhoId, { tipo: "audio", audioId, frente: "m".repeat(1001), verso: "V" }),
    ).toMatchObject({ ok: false, erro: "frente_muito_longa" });

    expect(
      await acervo.criarCartao(baralhoId, {
        tipo: "audio",
        audioId,
        frente: "m".repeat(1000),
        verso: "a".repeat(1000),
      }),
    ).toMatchObject({ ok: true });
  });

  it("aceita dois Cartões de Áudio sem Mensagem no mesmo Baralho (FR-439)", async () => {
    await criarAudio();
    await criarAudio();

    const listados = await acervo.listarCartoes();
    expect(listados.filter((cartao) => cartao.tipo === "audio")).toHaveLength(2);
  });

  it("numera a Mensagem repetida com ' (2)' (FR-439)", async () => {
    await criarAudio({ frente: "Qual é a resposta?" });
    const repetido = await criarAudio({ frente: "qual é a resposta?" });

    expect(repetido.frente).toBe("qual é a resposta? (2)");
  });

  it("recusa conteúdo que não é áudio como audio_invalido/formato e apaga o envio pendente (FR-437)", async () => {
    const audioId = await enviar(Buffer.from("isto nao e um audio, e so texto"));

    expect(
      await acervo.criarCartao(baralhoId, { tipo: "audio", audioId, frente: "", verso: "Obrigado" }),
    ).toEqual({
      ok: false,
      erro: "audio_invalido",
      motivo: "formato",
      mensagem: "File is not a supported audio format.",
    });
    expect(existsSync(join(pasta, "pendentes", dono, audioId))).toBe(false);
  });

  it("recusa Áudio com mais de 300 s como duracao, com o limite (FR-436)", async () => {
    const audioId = await enviar(amostraWav({ segundos: 300.001, bits: 8 }));

    expect(
      await acervo.criarCartao(baralhoId, { tipo: "audio", audioId, frente: "", verso: "Obrigado" }),
    ).toEqual({
      ok: false,
      erro: "audio_invalido",
      motivo: "duracao",
      mensagem: "Audio exceeds the duration limit.",
      limite: 300,
    });
  });

  it("recusa o Áudio de outro Usuário como nao_encontrado (FR-453)", async () => {
    const outro = await criarDonoDeTeste(aberto.usuarios, "dono-dois", "bruno.costa");
    const audioId = await enviar(amostraWav({ segundos: 1 }), outro);

    expect(
      await acervo.criarCartao(baralhoId, { tipo: "audio", audioId, frente: "", verso: "Obrigado" }),
    ).toMatchObject({ ok: false, erro: "audio_invalido", motivo: "nao_encontrado" });
  });

  it("não deixa Cartão nem Áudio órfão quando a gravação falha (FR-451)", async () => {
    const quebrado: ArmazenamentoDoAcervo = {
      ...aberto.armazenamento,
      inserirCartaoNoBaralho: async () => ({ ok: false, erro: "indisponivel" }),
    };
    const fragil = criarAcervo(quebrado, dono, { imagens: audios });
    const audioId = await enviar();

    expect(
      await fragil.criarCartao(baralhoId, { tipo: "audio", audioId, frente: "", verso: "Obrigado" }),
    ).toMatchObject({ ok: false, erro: "indisponivel" });
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
    expect(await acervo.listarCartoes()).toEqual([]);
  });

  it("guarda o Áudio na fila quando a remoção falha e o remove depois (FR-451)", async () => {
    const quebrado: ArmazenamentoDoAcervo = {
      ...aberto.armazenamento,
      inserirCartaoNoBaralho: async () => ({ ok: false, erro: "indisponivel" }),
    };
    const armazemQueFalha: ArmazemEmDisco = {
      ...audios,
      remover: async () => {
        throw new Error("armazém fora do ar");
      },
    };
    const fragil = criarAcervo(quebrado, dono, { imagens: armazemQueFalha });
    const audioId = await enviar();

    await fragil.criarCartao(baralhoId, { tipo: "audio", audioId, frente: "", verso: "Obrigado" });

    const naFila = await aberto.armazenamento.listarMidiaARemover(10);
    expect(naFila).toHaveLength(1);
    expect(naFila[0]).toMatch(new RegExp(`^audios/${dono}/`));
    expect(existsSync(join(pasta, naFila[0]!))).toBe(true);

    await processarFilaDeMidia(aberto.armazenamento, audios);
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
    expect(existsSync(join(pasta, naFila[0]!))).toBe(false);
  });
});

describe("estudar Cartão do tipo Áudio (FR-447, FR-450, FR-453)", () => {
  it("lista e lê o Baralho com tipo, duração e endereço só para o dono", async () => {
    const cartao = await criarAudio({ frente: "Sumimasen" });

    const listados = await acervo.listarCartoes();
    expect(listados).toEqual([
      expect.objectContaining({
        id: cartao.id,
        tipo: "audio",
        duracaoMs: 1000,
        audio: { url: expect.any(String), expiraEm: expect.any(String) },
      }),
    ]);

    const lido = await acervo.obterBaralho(baralhoId);
    expect(lido.ok && lido.baralho.cartoes).toEqual([
      expect.objectContaining({ tipo: "audio", duracaoMs: 1000, audio: expect.any(Object) }),
    ]);

    const outro = await criarDonoDeTeste(aberto.usuarios, "dono-dois", "bruno.costa");
    const alheio = criarAcervo(aberto.armazenamento, outro, { imagens: audios });
    expect(await alheio.listarCartoes()).toEqual([]);
  });

  it("entrega audio null quando a assinatura falha, sem derrubar a leitura", async () => {
    await criarAudio();
    const semAssinatura: ArmazemEmDisco = {
      ...audios,
      enderecoDeLeitura: async () => {
        throw new Error("sem chave de assinatura");
      },
    };
    const sem = criarAcervo(aberto.armazenamento, dono, { imagens: semAssinatura });

    const listados = await sem.listarCartoes();
    expect(listados[0]).toMatchObject({ tipo: "audio", duracaoMs: 1000, audio: null });
  });

  it("registra a Sessão com tipo, Mensagem e Verso, sem a chave do Áudio (FR-447)", async () => {
    const cartao = await criarAudio({ frente: "Sumimasen" });
    const id = "6f0b7d34-1f4e-4c55-9b0b-0f2f9e3f5a11";

    const registrado = await acervo.registrarSessao({
      id,
      origem: "baralho",
      baralhoId,
      nomeDoBaralho: "Japonês",
      itens: [{ tipo: "audio", frente: "Sumimasen", verso: "Obrigado", cartaoId: cartao.id, avaliacao: "bom" }],
    });
    expect(registrado.ok).toBe(true);

    const lido = await acervo.obterRegistroDeSessao(id);
    expect(lido.ok && lido.registro.itens).toEqual([
      expect.objectContaining({ tipo: "audio", frente: "Sumimasen", verso: "Obrigado" }),
    ]);
    const texto = JSON.stringify(lido);
    expect(texto).not.toMatch(/audios\/|audioChave|"audio":|"url"/);

    const depois = await acervo.listarCartoes();
    expect(depois[0]?.proximaRevisaoEm).not.toBeNull();
  });

  it("inicia o Compromisso com o Áudio e registra a conclusão como Áudio", async () => {
    // O mundo da Agenda tem o seu Usuário e o seu armazém: o envio é feito neles.
    const audiosDoMundo = criarArmazemEmDisco({
      pasta: mkdtempSync(join(tmpdir(), "agenda-audios-")),
    });
    const mundo = await prepararMundo(SEGUNDA, { imagens: audiosDoMundo });
    try {
      const envio = await audiosDoMundo.prepararEnvio(mundo.dono, "audio");
      const token = new URL(envio.envio.url, "http://local").searchParams.get("t")!;
      expect(await audiosDoMundo.receberEnvio(token, amostraWav({ segundos: 1 }))).toBe("ok");

      const baralho = await mundo.acervo.criarBaralho({ nome: "Japonês" });
      if (!baralho.ok) throw new Error("baralho recusado");
      const criado = await mundo.acervo.criarCartao(baralho.baralho.id, {
        tipo: "audio",
        audioId: envio.envioId,
        frente: "Sumimasen",
        verso: "Obrigado",
      });
      if (!criado.ok) throw new Error(JSON.stringify(criado));
      const rotina = await criarRotina(mundo.acervo, { baralhoId: baralho.baralho.id, dias: [1] });

      const iniciado = await mundo.acervo.iniciarCompromisso({
        rotinaId: rotina.id,
        data: "2026-10-05",
        fuso: FUSO,
      });
      if (!iniciado.ok) throw new Error(JSON.stringify(iniciado));

      const iniciadoCartao = iniciado.inicio.cartoes[0]!;
      expect(iniciadoCartao).toMatchObject({
        tipo: "audio",
        duracaoMs: 1000,
        audio: { url: expect.any(String) },
      });

      const registrado = await mundo.acervo.registrarSessao({
        id: iniciado.inicio.id,
        origem: "baralho",
        baralhoId: baralho.baralho.id,
        nomeDoBaralho: "Japonês",
        inicioAgendaId: iniciado.inicio.id,
        itens: iniciado.inicio.cartoes.map((cartao) => ({
          cartaoId: cartao.id,
          frente: cartao.frente,
          verso: cartao.verso,
          avaliacao: "bom",
        })),
      });
      expect(registrado.ok).toBe(true);

      const lido = await mundo.acervo.obterRegistroDeSessao(iniciado.inicio.id);
      expect(lido.ok && lido.registro.itens).toEqual([
        expect.objectContaining({ tipo: "audio", frente: "Sumimasen", verso: "Obrigado" }),
      ]);
      expect(JSON.stringify(lido)).not.toMatch(/audios\/|"url"/);
    } finally {
      await mundo.encerrar();
    }
  });
});

describe("editar, excluir e copiar Cartão do tipo Áudio (FR-448, FR-449, FR-450)", () => {
  it("não muda o tipo depois da criação (tipo_imutavel)", async () => {
    const cartao = await criarAudio();

    expect(
      await acervo.editarCartao(cartao.id, { tipo: "imagem", frente: "", verso: "Obrigado" }),
    ).toMatchObject({ ok: false, erro: "tipo_imutavel" });
  });

  it("edita os textos mantendo o Áudio e troca o Áudio removendo o anterior", async () => {
    const cartao = await criarAudio();

    const textos = await acervo.editarCartao(cartao.id, {
      tipo: "audio",
      frente: "Sumimasen",
      verso: "Obrigado",
    });
    expect(textos).toMatchObject({ ok: true, cartao: { frente: "Sumimasen", duracaoMs: 1000 } });
    expect(await serve(cartao)).toBe(true);

    const trocado = await acervo.editarCartao(cartao.id, {
      tipo: "audio",
      audioId: await enviar(amostraWav({ segundos: 2 })),
      frente: "Sumimasen",
      verso: "Obrigado",
    });
    if (!trocado.ok) throw new Error(JSON.stringify(trocado));
    expect(trocado.cartao).toMatchObject({ duracaoMs: 2000 });
    expect(await serve(trocado.cartao)).toBe(true);
    expect(await serve(cartao)).toBe(false);
  });

  it("mantém o Cartão e descarta o Áudio novo quando a gravação da edição falha (FR-451)", async () => {
    const cartao = await criarAudio();
    const quebrado: ArmazenamentoDoAcervo = {
      ...aberto.armazenamento,
      atualizarCartao: async () => ({ ok: false, erro: "indisponivel" }),
    };
    const fragil = criarAcervo(quebrado, dono, { imagens: audios });

    expect(
      await fragil.editarCartao(cartao.id, {
        tipo: "audio",
        audioId: await enviar(),
        frente: "",
        verso: "Outro",
      }),
    ).toMatchObject({ ok: false, erro: "indisponivel" });
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
    expect(await serve(cartao)).toBe(true);
    expect((await acervo.listarCartoes())[0]).toMatchObject({ verso: "Obrigado" });
  });

  it("remove o Áudio ao excluir o Cartão e ao excluir o Baralho", async () => {
    const primeiro = await criarAudio();
    const segundo = await criarAudio();

    expect(await acervo.excluirCartao(primeiro.id)).toEqual({ ok: true });
    expect(await serve(primeiro)).toBe(false);
    expect(await serve(segundo)).toBe(true);

    expect(await acervo.excluirBaralho(baralhoId)).toEqual({ ok: true });
    expect(await serve(segundo)).toBe(false);
  });

  it("dá à Cópia um Áudio próprio: excluir o original não o afeta (FR-450)", async () => {
    const original = await criarAudio({ frente: "Sumimasen" });

    const salvo = await acervo.salvarSelecaoComoBaralho({
      id: "0d6c2f7e-8a3b-4c1d-9e2f-3a4b5c6d7e8f",
      nome: "Revisão",
      cartaoIds: [original.id],
    });
    if (!salvo.ok) throw new Error(JSON.stringify(salvo));

    const copiado = await acervo.obterBaralho(salvo.baralho.id);
    if (!copiado.ok) throw new Error("baralho ausente");
    const copia = copiado.baralho.cartoes[0]!;
    expect(copia).toMatchObject({ tipo: "audio", frente: "Sumimasen", verso: "Obrigado", duracaoMs: 1000 });

    await acervo.excluirCartao(original.id);
    expect(await serve(original)).toBe(false);
    expect(await serve(copia)).toBe(true);
  });
});

describe("excluir a conta com Áudio (FR-449, FR-274)", () => {
  it("tira da pasta os Áudios do Usuário excluído pela fila, sem tocar nos de outro", async () => {
    const identidade = criarIdentidade(aberto.usuarios, segredoGerado(), {
      aposExcluirConta: () => processarFilaDeMidia(aberto.armazenamento, audios),
    });
    const carla = await cadastrarUsuarioDeTeste(identidade, "carla.lima");
    const acervoDaCarla = criarAcervo(aberto.armazenamento, carla.id, { imagens: audios });
    const baralho = await acervoDaCarla.criarBaralho({ nome: "Japonês" });
    if (!baralho.ok) throw new Error("baralho recusado");
    const criado = await acervoDaCarla.criarCartao(baralho.baralho.id, {
      tipo: "audio",
      audioId: await enviar(amostraWav({ segundos: 1 }), carla.id),
      frente: "",
      verso: "Obrigado",
    });
    if (!criado.ok) throw new Error(JSON.stringify(criado));
    const outro = await criarAudio();

    const guardado = await aberto.armazenamento.obterCartao(carla.id, criado.cartao.id);
    if (!guardado.ok) throw new Error("cartão ausente");
    const chave = guardado.valor.audioChave!;
    expect(existsSync(join(pasta, chave))).toBe(true);

    expect(
      await identidade.excluirConta(carla.id, { senhaAtual: carla.senha }),
    ).toEqual({ ok: true });

    expect(existsSync(join(pasta, chave))).toBe(false);
    const restos = existsSync(join(pasta, "audios", carla.id))
      ? readdirSync(join(pasta, "audios", carla.id))
      : [];
    expect(restos).toEqual([]);
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
    expect(await serve(outro)).toBe(true);
  });

  it("mantém a chave em midia_a_remover quando a remoção falha na exclusão e a remove no próximo processamento (FR-449)", async () => {
    const armazemQueFalha: ArmazemEmDisco = {
      ...audios,
      remover: async () => {
        throw new Error("armazém fora do ar");
      },
    };
    const identidade = criarIdentidade(aberto.usuarios, segredoGerado(), {
      aposExcluirConta: () => processarFilaDeMidia(aberto.armazenamento, armazemQueFalha),
    });
    const diego = await cadastrarUsuarioDeTeste(identidade, "diego.rocha");
    const acervoDoDiego = criarAcervo(aberto.armazenamento, diego.id, { imagens: audios });
    const baralho = await acervoDoDiego.criarBaralho({ nome: "Japonês" });
    if (!baralho.ok) throw new Error("baralho recusado");
    const criado = await acervoDoDiego.criarCartao(baralho.baralho.id, {
      tipo: "audio",
      audioId: await enviar(amostraWav({ segundos: 1 }), diego.id),
      frente: "",
      verso: "Obrigado",
    });
    if (!criado.ok) throw new Error(JSON.stringify(criado));
    const guardado = await aberto.armazenamento.obterCartao(diego.id, criado.cartao.id);
    if (!guardado.ok) throw new Error("cartão ausente");
    const chave = guardado.valor.audioChave!;

    expect(
      await identidade.excluirConta(diego.id, { senhaAtual: diego.senha }),
    ).toEqual({ ok: true });

    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([chave]);
    expect(existsSync(join(pasta, chave))).toBe(true);

    await processarFilaDeMidia(aberto.armazenamento, audios);
    expect(await aberto.armazenamento.listarMidiaARemover(10)).toEqual([]);
    expect(existsSync(join(pasta, chave))).toBe(false);
  });
});
