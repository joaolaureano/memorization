import { randomUUID } from "node:crypto";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { beforeEach, describe, vi } from "vitest";

import { criarArmazemS3 } from "../../src/midia/armazem-s3.ts";
import { bateriaDoArmazem } from "./bateria-do-armazem.ts";

/**
 * T007 — a mesma bateria contra o Adapter S3, num S3 compatível de teste
 * (MinIO, SeaweedFS ou similar). Só roda com `S3_DE_TESTE_ENDERECO` definido; as credenciais vêm de
 * `S3_DE_TESTE_USUARIO` e `S3_DE_TESTE_SENHA`, nunca de arquivo versionado.
 *
 * O MinIO não garante a recusa de `content-length-range` como o S3; essa prova
 * fica marcada por `recusaEnvioGrande` e é refeita na verificação pós-deploy
 * (T045, research R10).
 */
const endereco = process.env.S3_DE_TESTE_ENDERECO;

const configuracao = endereco
  ? {
      endpoint: endereco,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_DE_TESTE_USUARIO ?? "",
        secretAccessKey: process.env.S3_DE_TESTE_SENHA ?? "",
      },
    }
  : undefined;

/**
 * O S3 confere as assinaturas contra o relógio real; o «hoje» falseado da
 * suíte (`vitest.setup.ts`) as faria nascer expiradas.
 */
beforeEach(() => {
  vi.useRealTimers();
});

if (configuracao === undefined) {
  describe.skip("ArmazemDeMidia — Adapter S3 (sem S3_DE_TESTE_ENDERECO)", () => {});
} else {
  /** Um bucket por arquivo: as chaves já são únicas por Imagem. */
  const bucket = `imagens-${randomUUID()}`;
  let criado: Promise<unknown> | undefined;

  bateriaDoArmazem("Adapter S3 (S3 compatível de teste)", async () => {
    criado ??= new S3Client(configuracao).send(
      new CreateBucketCommand({ Bucket: bucket }),
    );
    await criado;
    const armazem = criarArmazemS3({ bucket, cliente: configuracao });

    return {
      armazem,
      async enviar(envio, bytes) {
        const formulario = new FormData();
        for (const [campo, valor] of Object.entries(envio.envio.campos)) {
          formulario.append(campo, valor);
        }
        formulario.append("file", new Blob([bytes]));
        return (await fetch(envio.envio.url, { method: "POST", body: formulario })).status;
      },
      async ler(url) {
        const resposta = await fetch(url);
        return resposta.ok
          ? {
              bytes: new Uint8Array(await resposta.arrayBuffer()),
              tipo: resposta.headers.get("content-type") ?? "",
            }
          : null;
      },
      async lerSemAssinatura(chave) {
        const resposta = await fetch(`${endereco}/${bucket}/${chave}`);
        return resposta.ok ? new Uint8Array(await resposta.arrayBuffer()) : null;
      },
      recusaEnvioGrande: process.env.S3_DE_TESTE_RECUSA_ENVIO_GRANDE === "sim",
    };
  });
}
