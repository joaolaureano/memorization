import { randomUUID } from "node:crypto";

import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  VALIDADE_DA_LEITURA_EM_SEGUNDOS,
  VALIDADE_DO_ENVIO_EM_SEGUNDOS,
  chaveAtiva,
  chavePendente,
  ehIdentificadorDeEnvio,
  midiaDaChave,
  type ArmazemDeMidia,
} from "./armazem.ts";
import { REGRAS_DA_MIDIA } from "./regras.ts";

/**
 * Adapter S3 do `ArmazemDeMidia` — a nuvem (`026`, research R4–R6; `028`, R5).
 *
 * O bucket é privado. O envio é um presigned POST com chave fixa e limite de
 * tamanho imposto pelo próprio S3, o da Mídia pedida; a leitura é um presigned
 * GET de 15 minutos, que o S3 responde com `Range` sem configuração extra.
 * As assinaturas usam as credenciais temporárias da role da Lambda: não há
 * chave nova a guardar (Princípio VIII).
 */

export interface OpcoesDoArmazemS3 {
  bucket: string;
  /** Configuração do cliente; nos testes, o endereço e as credenciais do MinIO. */
  cliente?: S3ClientConfig;
}

/** Erro de objeto inexistente, nas formas que o SDK devolve. */
function ehAusente(erro: unknown): boolean {
  const nome = (erro as { name?: string }).name;
  const status = (erro as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
  return nome === "NoSuchKey" || nome === "NotFound" || status === 404;
}

export function criarArmazemS3(opcoes: OpcoesDoArmazemS3): ArmazemDeMidia {
  const s3 = new S3Client(opcoes.cliente ?? {});
  const Bucket = opcoes.bucket;

  return {
    async ler(chave) {
      try {
        const objeto = await s3.send(new GetObjectCommand({ Bucket, Key: chave }));
        return await objeto.Body!.transformToByteArray();
      } catch (erro) {
        if (ehAusente(erro)) return null;
        throw erro;
      }
    },

    async medir(chaves) {
      let total = 0;
      for (let inicio = 0; inicio < chaves.length; inicio += 32) {
        const tamanhos = await Promise.all(chaves.slice(inicio, inicio + 32).map(async (Key) => {
          try {
            const resposta = await s3.send(new HeadObjectCommand({ Bucket, Key }));
            return resposta.ContentLength ?? 0;
          } catch (erro) {
            if (ehAusente(erro)) return 0;
            throw erro;
          }
        }));
        total += tamanhos.reduce((soma, tamanho) => soma + tamanho, 0);
      }
      return total;
    },

    async guardarExportacao(usuarioId, bytes, nomeDoArquivo, tipoDeConteudo) {
      const Key = `exportacoes/${usuarioId}`;
      const disposicao = `attachment; filename*=UTF-8''${encodeURIComponent(nomeDoArquivo)}`;
      await s3.send(new PutObjectCommand({
        Bucket, Key, Body: bytes, ContentType: tipoDeConteudo, ContentDisposition: disposicao,
      }));
      const url = await getSignedUrl(s3, new GetObjectCommand({
        Bucket, Key, ResponseContentDisposition: disposicao,
      }), { expiresIn: VALIDADE_DA_LEITURA_EM_SEGUNDOS });
      return { url, expiraEm: new Date(Date.now() + VALIDADE_DA_LEITURA_EM_SEGUNDOS * 1000).toISOString() };
    },

    async prepararEnvio(usuarioId, midia) {
      const envioId = randomUUID();
      const { url, fields } = await createPresignedPost(s3, {
        Bucket,
        Key: chavePendente(usuarioId, envioId),
        Conditions: [["content-length-range", 1, REGRAS_DA_MIDIA[midia].limiteEmBytes]],
        Expires: VALIDADE_DO_ENVIO_EM_SEGUNDOS,
      });

      return {
        envioId,
        envio: { url, campos: fields },
        expiraEm: new Date(
          Date.now() + VALIDADE_DO_ENVIO_EM_SEGUNDOS * 1000,
        ).toISOString(),
      };
    },

    async confirmar(usuarioId, envioId, midia) {
      if (!ehIdentificadorDeEnvio(envioId)) {
        return { ok: false, motivo: "nao_encontrada" };
      }

      const regras = REGRAS_DA_MIDIA[midia];
      const Key = chavePendente(usuarioId, envioId);

      try {
        const cabeca = await s3.send(new HeadObjectCommand({ Bucket, Key }));

        if ((cabeca.ContentLength ?? 0) > regras.limiteEmBytes) {
          await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: [{ Key }] } }));
          return { ok: false, motivo: "tamanho" };
        }
      } catch (erro) {
        if (ehAusente(erro)) {
          return { ok: false, motivo: "nao_encontrada" };
        }
        throw erro;
      }

      const objeto = await s3.send(new GetObjectCommand({ Bucket, Key }));
      const bytes = await objeto.Body!.transformToByteArray();
      const conferida = regras.confirmar(bytes);
      await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: [{ Key }] } }));

      if (!conferida.ok) {
        return { ok: false, motivo: conferida.motivo };
      }

      const chave = chaveAtiva(usuarioId, envioId, midia);
      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key: chave,
          Body: conferida.bytes,
          ContentType: conferida.formato,
          ContentDisposition: "inline",
        }),
      );

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
      await s3.send(
        new CopyObjectCommand({
          Bucket,
          Key: nova,
          CopySource: `${Bucket}/${chave}`,
        }),
      );
      return nova;
    },

    async enderecoDeLeitura(chave) {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket, Key: chave }),
        { expiresIn: VALIDADE_DA_LEITURA_EM_SEGUNDOS },
      );

      return {
        url,
        expiraEm: new Date(
          Date.now() + VALIDADE_DA_LEITURA_EM_SEGUNDOS * 1000,
        ).toISOString(),
      };
    },

    async remover(chaves) {
      if (chaves.length === 0) {
        return [];
      }

      const resposta = await s3.send(
        new DeleteObjectsCommand({
          Bucket,
          Delete: { Objects: chaves.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      const falharam = new Set((resposta.Errors ?? []).map((e) => e.Key));

      return chaves.filter((chave) => !falharam.has(chave));
    },
  };
}
