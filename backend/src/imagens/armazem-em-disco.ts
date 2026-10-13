import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  LIMITE_DE_BYTES_DA_IMAGEM,
  VALIDADE_DA_LEITURA_EM_SEGUNDOS,
  VALIDADE_DO_ENVIO_EM_SEGUNDOS,
  chaveAtiva,
  chavePendente,
  detectarFormato,
  ehIdentificadorDeImagem,
  prepararImagemConfirmada,
  type ArmazemDeImagens,
  type FormatoDeImagem,
} from "./armazem.ts";

/**
 * Adapter Disco do `ArmazemDeImagens` — o modo local e os testes (`026`,
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
export const CAMINHO_DO_ENVIO_LOCAL = "/imagens-locais/envios";
export const CAMINHO_DA_LEITURA_LOCAL = "/imagens-locais/arquivo";

/** Pendentes mais antigos que isto são descartados (FR-423: até 48 horas). */
const IDADE_MAXIMA_DO_PENDENTE_EM_MS = 24 * 60 * 60 * 1000;

type Finalidade = "envio" | "leitura";

export interface OpcoesDoArmazemEmDisco {
  /** A pasta onde as Imagens ficam. */
  pasta: string;
  /** Relógio injetável para os testes de expiração. */
  agora?: () => Date;
}

export interface ArmazemEmDisco extends ArmazemDeImagens {
  /** Recebe o arquivo de um envio preparado (rota local de envio). */
  receberEnvio(
    token: string,
    arquivo: Uint8Array,
  ): Promise<"ok" | "invalido" | "tamanho">;
  /** Entrega a Imagem ativa de um endereço de leitura (rota local de leitura). */
  lerParaEntrega(
    token: string,
  ): Promise<{ bytes: Uint8Array; formato: FormatoDeImagem } | null>;
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

  function emitirToken(
    chave: string,
    finalidade: Finalidade,
    validadeEmSegundos: number,
  ): { token: string; expiraEm: Date } {
    const expiraEm = new Date(agora().getTime() + validadeEmSegundos * 1000);
    const conteudo = Buffer.from(
      JSON.stringify({ c: chave, f: finalidade, e: expiraEm.getTime() }),
    ).toString("base64url");
    return { token: `${conteudo}.${assinar(conteudo)}`, expiraEm };
  }

  /** Confere assinatura, finalidade e prazo; devolve a chave ou `null`. */
  function lerToken(token: string, finalidade: Finalidade): string | null {
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
      };

      return dados.f === finalidade && dados.e > agora().getTime()
        ? dados.c
        : null;
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
    async prepararEnvio(usuarioId) {
      await varrerPendentes(usuarioId);

      const imagemId = randomUUID();
      const { token, expiraEm } = emitirToken(
        chavePendente(usuarioId, imagemId),
        "envio",
        VALIDADE_DO_ENVIO_EM_SEGUNDOS,
      );

      return {
        imagemId,
        envio: { url: `${CAMINHO_DO_ENVIO_LOCAL}?t=${token}`, campos: {} },
        expiraEm: expiraEm.toISOString(),
      };
    },

    async receberEnvio(token, arquivo) {
      const chave = lerToken(token, "envio");

      if (chave === null) {
        return "invalido";
      }

      if (arquivo.length === 0 || arquivo.length > LIMITE_DE_BYTES_DA_IMAGEM) {
        return "tamanho";
      }

      await gravar(chave, arquivo);
      return "ok";
    },

    async confirmar(usuarioId, imagemId) {
      if (!ehIdentificadorDeImagem(imagemId)) {
        return { ok: false, motivo: "nao_encontrada" };
      }

      const pendente = chavePendente(usuarioId, imagemId);
      const bytes = await lerSeExistir(pendente);

      if (bytes === null) {
        return { ok: false, motivo: "nao_encontrada" };
      }

      const preparada = prepararImagemConfirmada(bytes);
      await rm(caminhoDa(pendente), { force: true });

      if (!preparada.ok) {
        return { ok: false, motivo: preparada.motivo };
      }

      const chave = chaveAtiva(usuarioId, imagemId);
      await gravar(chave, preparada.bytes);

      return {
        ok: true,
        chave,
        formato: preparada.formato,
        bytes: preparada.bytes.length,
      };
    },

    async copiar(chave, usuarioId) {
      const nova = chaveAtiva(usuarioId, randomUUID());
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
      const chave = lerToken(token, "leitura");

      if (chave === null || !chave.startsWith("imagens/")) {
        return null;
      }

      const bytes = await lerSeExistir(chave);
      const formato = bytes === null ? null : detectarFormato(bytes);

      return bytes === null || formato === null ? null : { bytes, formato };
    },

    async remover(chaves) {
      for (const chave of chaves) {
        await rm(caminhoDa(chave), { force: true });
      }
      return [...chaves];
    },
  };
}
