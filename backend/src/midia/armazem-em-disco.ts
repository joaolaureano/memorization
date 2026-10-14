import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  VALIDADE_DA_LEITURA_EM_SEGUNDOS,
  VALIDADE_DO_ENVIO_EM_SEGUNDOS,
  PREFIXO_DA_MIDIA,
  chaveAtiva,
  chavePendente,
  ehIdentificadorDeEnvio,
  midiaDaChave,
  type ArmazemDeMidia,
  type FormatoDeImagem,
  type Midia,
} from "./armazem.ts";
import { reconhecerAudio } from "./audio/reconhecer.ts";
import type { FormatoDeAudio } from "./audio/tipos.ts";
import { detectarFormato } from "./imagem/formato.ts";
import { REGRAS_DA_MIDIA } from "./regras.ts";

/**
 * Adapter Disco do `ArmazemDeMidia` — o modo local e os testes (`026`,
 * research R3).
 *
 * Os arquivos ficam numa pasta, sob as mesmas chaves do S3. O envio e a
 * leitura acontecem por duas rotas do próprio backend, registradas só pela
 * entrada local, e cada uma é autorizada por um token assinado com HMAC e com
 * prazo — o equivalente local das assinaturas do S3. Assim o modo local tem os
 * mesmos limites, recusas e regras de privacidade da nuvem (spec, Assumptions).
 * O token vai na consulta (`?t=`): é maior que o limite de parâmetro de
 * caminho do Fastify.
 */

/** Os caminhos das rotas locais; relativos à API, como o cliente os resolve. */
export const CAMINHO_DO_ENVIO_LOCAL = "/midia-local/envios";
export const CAMINHO_DA_LEITURA_LOCAL = "/midia-local/arquivo";

/** Pendentes mais antigos que isto são descartados (FR-423: até 48 horas). */
const IDADE_MAXIMA_DO_PENDENTE_EM_MS = 24 * 60 * 60 * 1000;

type Finalidade = "envio" | "leitura" | "exportacao";

export interface OpcoesDoArmazemEmDisco {
  /** A pasta onde as Imagens ficam. */
  pasta: string;
  /** Relógio injetável para os testes de expiração. */
  agora?: () => Date;
}

export interface ArmazemEmDisco extends ArmazemDeMidia {
  /** Recebe o arquivo de um envio preparado (rota local de envio). */
  receberEnvio(
    token: string,
    arquivo: Uint8Array,
  ): Promise<"ok" | "invalido" | "tamanho">;
  /** Entrega a Mídia ativa de um endereço de leitura (rota local de leitura). */
  lerParaEntrega(
    token: string,
  ): Promise<{ bytes: Uint8Array; formato: string; disposicao: string } | null>;
}

/**
 * O formato de uma Mídia ativa, pela chave e pelo conteúdo já gravado. O
 * arquivo ativo já passou pela confirmação, então a detecção dá sempre o
 * mesmo resultado que deu no envio.
 */
function formatoDaMidiaAtiva(
  chave: string,
  bytes: Uint8Array,
): FormatoDeImagem | FormatoDeAudio | null {
  if (chave.startsWith(`${PREFIXO_DA_MIDIA.imagem}/`)) {
    return detectarFormato(bytes);
  }
  const reconhecido = reconhecerAudio(bytes);
  return reconhecido.ok ? reconhecido.formato : null;
}

/** Os dados que o token assinado carrega. A Mídia só existe no envio. */
interface DadosDoToken {
  chave: string;
  midia?: Midia;
  nomeDoArquivo?: string;
  tipoDeConteudo?: string;
}

export function criarArmazemEmDisco(
  opcoes: OpcoesDoArmazemEmDisco,
): ArmazemEmDisco {
  const agora = opcoes.agora ?? (() => new Date());
  /** O segredo vive só na memória do processo: nada vai para o disco. */
  const segredo = randomBytes(32);

  const caminhoDa = (chave: string): string => join(opcoes.pasta, chave);

  function assinar(conteudo: string): string {
    return createHmac("sha256", segredo).update(conteudo).digest("base64url");
  }

  /**
   * Emite um token assinado. No envio, a Mídia entra no conteúdo assinado: o
   * limite de tamanho é conferido por ela, e não pelo que o cliente declara.
   */
  function emitirToken(
    chave: string,
    finalidade: Finalidade,
    validadeEmSegundos: number,
      midia?: Midia,
      metadados?: { nomeDoArquivo: string; tipoDeConteudo: string },
  ): { token: string; expiraEm: Date } {
    const expiraEm = new Date(agora().getTime() + validadeEmSegundos * 1000);
    const conteudo = Buffer.from(
      JSON.stringify({
        c: chave,
        f: finalidade,
        e: expiraEm.getTime(),
        ...(midia === undefined ? {} : { m: midia }),
        ...(metadados === undefined ? {} : { n: metadados.nomeDoArquivo, t: metadados.tipoDeConteudo }),
      }),
    ).toString("base64url");
    return { token: `${conteudo}.${assinar(conteudo)}`, expiraEm };
  }

  /**
   * Confere assinatura, finalidade e prazo; devolve os dados do token ou
   * `null`. Um envio sem Mídia conhecida também é recusado.
   */
  function lerToken(token: string, finalidade: Finalidade): DadosDoToken | null {
    const [conteudo, assinatura] = token.split(".");

    if (conteudo === undefined || assinatura === undefined) {
      return null;
    }

    const esperada = Buffer.from(assinar(conteudo));
    const recebida = Buffer.from(assinatura);

    if (
      esperada.length !== recebida.length ||
      !timingSafeEqual(esperada, recebida)
    ) {
      return null;
    }

    try {
      const dados = JSON.parse(Buffer.from(conteudo, "base64url").toString()) as {
        c: string;
        f: Finalidade;
        e: number;
        m?: Midia;
        n?: string;
        t?: string;
      };

      if (dados.f !== finalidade || dados.e <= agora().getTime()) {
        return null;
      }

      if (finalidade === "envio" && dados.m !== "imagem" && dados.m !== "audio") {
        return null;
      }

      return { chave: dados.c, midia: dados.m, nomeDoArquivo: dados.n, tipoDeConteudo: dados.t };
    } catch {
      return null;
    }
  }

  async function gravar(chave: string, bytes: Uint8Array): Promise<void> {
    await mkdir(dirname(caminhoDa(chave)), { recursive: true });
    await writeFile(caminhoDa(chave), bytes);
  }

  async function lerSeExistir(chave: string): Promise<Uint8Array | null> {
    try {
      return await readFile(caminhoDa(chave));
    } catch {
      return null;
    }
  }

  /** Descarta os pendentes antigos do Usuário (FR-423). */
  async function varrerPendentes(usuarioId: string): Promise<void> {
    const pasta = caminhoDa(`pendentes/${usuarioId}`);
    let nomes: string[];

    try {
      nomes = await readdir(pasta);
    } catch {
      return;
    }

    for (const nome of nomes) {
      const caminho = join(pasta, nome);
      const info = await stat(caminho).catch(() => null);

      if (
        info !== null &&
        agora().getTime() - info.mtimeMs > IDADE_MAXIMA_DO_PENDENTE_EM_MS
      ) {
        await rm(caminho, { force: true });
      }
    }
  }

  return {
    async prepararEnvio(usuarioId, midia) {
      await varrerPendentes(usuarioId);

      const envioId = randomUUID();
      const { token, expiraEm } = emitirToken(
        chavePendente(usuarioId, envioId),
        "envio",
        VALIDADE_DO_ENVIO_EM_SEGUNDOS,
        midia,
      );

      return {
        envioId,
        envio: { url: `${CAMINHO_DO_ENVIO_LOCAL}?t=${token}`, campos: {} },
        expiraEm: expiraEm.toISOString(),
      };
    },

    async ler(chave) {
      if (midiaDaChave(chave) === null) return null;
      try { return await readFile(caminhoDa(chave)); } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw erro;
      }
    },

    async medir(chaves) {
      const tamanhos = await Promise.all(chaves.map(async (chave) => {
        try { return (await stat(caminhoDa(chave))).size; } catch (erro) {
          if ((erro as NodeJS.ErrnoException).code === "ENOENT") return 0;
          throw erro;
        }
      }));
      return tamanhos.reduce((soma, tamanho) => soma + tamanho, 0);
    },

    async guardarExportacao(usuarioId, bytes, nomeDoArquivo, tipoDeConteudo) {
      const chave = `exportacoes/${usuarioId}`;
      await gravar(chave, bytes);
      const { token, expiraEm } = emitirToken(chave, "exportacao", VALIDADE_DA_LEITURA_EM_SEGUNDOS, undefined, { nomeDoArquivo, tipoDeConteudo });
      return { url: `${CAMINHO_DA_LEITURA_LOCAL}?t=${token}`, expiraEm: expiraEm.toISOString() };
    },

    async receberEnvio(token, arquivo) {
      const dados = lerToken(token, "envio");

      if (dados === null || dados.midia === undefined) {
        return "invalido";
      }

      if (
        arquivo.length === 0 ||
        arquivo.length > REGRAS_DA_MIDIA[dados.midia].limiteEmBytes
      ) {
        return "tamanho";
      }

      await gravar(dados.chave, arquivo);
      return "ok";
    },

    async confirmar(usuarioId, envioId, midia) {
      if (!ehIdentificadorDeEnvio(envioId)) {
        return { ok: false, motivo: "nao_encontrada" };
      }

      const pendente = chavePendente(usuarioId, envioId);
      const bytes = await lerSeExistir(pendente);

      if (bytes === null) {
        return { ok: false, motivo: "nao_encontrada" };
      }

      const conferida = REGRAS_DA_MIDIA[midia].confirmar(bytes);
      await rm(caminhoDa(pendente), { force: true });

      if (!conferida.ok) {
        return { ok: false, motivo: conferida.motivo };
      }

      const chave = chaveAtiva(usuarioId, envioId, midia);
      await gravar(chave, conferida.bytes);

      return {
        ok: true,
        chave,
        formato: conferida.formato,
        bytes: conferida.bytes.length,
        ...(conferida.duracaoMs === undefined
          ? {}
          : { duracaoMs: conferida.duracaoMs }),
      };
    },

    async copiar(chave, usuarioId) {
      const midia = midiaDaChave(chave);

      if (midia === null) {
        throw new Error("copiar: a chave não é de uma Mídia ativa");
      }

      const nova = chaveAtiva(usuarioId, randomUUID(), midia);
      await mkdir(dirname(caminhoDa(nova)), { recursive: true });
      await copyFile(caminhoDa(chave), caminhoDa(nova));
      return nova;
    },

    async enderecoDeLeitura(chave) {
      const { token, expiraEm } = emitirToken(
        chave,
        "leitura",
        VALIDADE_DA_LEITURA_EM_SEGUNDOS,
      );

      return {
        url: `${CAMINHO_DA_LEITURA_LOCAL}?t=${token}`,
        expiraEm: expiraEm.toISOString(),
      };
    },

    async lerParaEntrega(token) {
      const dados = lerToken(token, "leitura");

      const exportacao = lerToken(token, "exportacao");
      if (dados === null && exportacao === null) return null;
      const autorizado = dados ?? exportacao!;
      if (dados !== null && midiaDaChave(dados.chave) === null) {
        return null;
      }

      const bytes = await lerSeExistir(autorizado.chave);
      const formato = bytes === null ? null : formatoDaMidiaAtiva(autorizado.chave, bytes);

      return bytes === null ? null : exportacao !== null
        ? { bytes, formato: exportacao.tipoDeConteudo ?? "application/octet-stream", disposicao: `attachment; filename*=UTF-8''${encodeURIComponent(exportacao.nomeDoArquivo ?? "exportacao.apkg")}` }
        : formato === null ? null : { bytes, formato, disposicao: "inline" };
    },

    async remover(chaves) {
      for (const chave of chaves) {
        await rm(caminhoDa(chave), { force: true });
      }
      return [...chaves];
    },
  };
}
