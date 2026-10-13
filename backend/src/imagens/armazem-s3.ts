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
  LIMITE_DE_BYTES_DA_IMAGEM,
  VALIDADE_DA_LEITURA_EM_SEGUNDOS,
  VALIDADE_DO_ENVIO_EM_SEGUNDOS,
  chaveAtiva,
  chavePendente,
  ehIdentificadorDeImagem,
  prepararImagemConfirmada,
  type ArmazemDeImagens,
} from "./armazem.ts";

/**
 * Adapter S3 do `ArmazemDeImagens` — a nuvem (`026`, research R4–R6).
 *
 * O bucket é privado. O envio é um presigned POST com chave fixa e limite de
 * tamanho imposto pelo próprio S3; a leitura é um presigned GET de 15 minutos.
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

export function criarArmazemS3(opcoes: OpcoesDoArmazemS3): ArmazemDeImagens {
  const s3 = new S3Client(opcoes.cliente ?? {});
  const Bucket = opcoes.bucket;

  return {
    async prepararEnvio(usuarioId) {
      const imagemId = randomUUID();
      const { url, fields } = await createPresignedPost(s3, {
        Bucket,
        Key: chavePendente(usuarioId, imagemId),
        Conditions: [["content-length-range", 1, LIMITE_DE_BYTES_DA_IMAGEM]],
        Expires: VALIDADE_DO_ENVIO_EM_SEGUNDOS,
      });

      return {
        imagemId,
        envio: { url, campos: fields },
        expiraEm: new Date(
          Date.now() + VALIDADE_DO_ENVIO_EM_SEGUNDOS * 1000,
        ).toISOString(),
      };
    },

    async confirmar(usuarioId, imagemId) {
      if (!ehIdentificadorDeImagem(imagemId)) {
        return { ok: false, motivo: "nao_encontrada" };
      }

      const Key = chavePendente(usuarioId, imagemId);

      try {
        const cabeca = await s3.send(new HeadObjectCommand({ Bucket, Key }));

        if ((cabeca.ContentLength ?? 0) > LIMITE_DE_BYTES_DA_IMAGEM) {
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
      const preparada = prepararImagemConfirmada(bytes);
      await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: [{ Key }] } }));

      if (!preparada.ok) {
        return { ok: false, motivo: preparada.motivo };
      }

      const chave = chaveAtiva(usuarioId, imagemId);
      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key: chave,
          Body: preparada.bytes,
          ContentType: preparada.formato,
          ContentDisposition: "inline",
        }),
      );

      return {
        ok: true,
        chave,
        formato: preparada.formato,
        bytes: preparada.bytes.length,
      };
    },

    async copiar(chave, usuarioId) {
      const nova = chaveAtiva(usuarioId, randomUUID());
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
