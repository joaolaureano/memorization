import type { FastifyInstance } from "fastify";

import { LIMITE_DE_BYTES_DA_IMAGEM } from "../imagens/armazem.ts";
import {
  CAMINHO_DA_LEITURA_LOCAL,
  CAMINHO_DO_ENVIO_LOCAL,
  type ArmazemEmDisco,
} from "../imagens/armazem-em-disco.ts";

/**
 * As rotas do Adapter Disco (`026`, research R3): o equivalente local do envio
 * direto ao S3 e da leitura por endereço assinado. Só a entrada local as
 * registra. Não exigem Credencial — quem autoriza é o token assinado e com
 * prazo, como as assinaturas do S3 (FR-424) —, e por isso o prefixo
 * `/imagens-locais/` é isento no hook de Credencial.
 */

/** Folga para os cabeçalhos do `multipart/form-data` além do arquivo. */
const FOLGA_DO_MULTIPART = 64 * 1024;

/**
 * Extrai o campo `file` de um corpo `multipart/form-data`. O envio tem a
 * mesma forma do presigned POST do S3: os campos, depois o arquivo.
 */
export function lerArquivoDoMultipart(
  corpo: Buffer,
  tipoDeConteudo: string,
): Buffer | null {
  const fronteira = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(tipoDeConteudo);
  const marca = fronteira?.[1] ?? fronteira?.[2];

  if (marca === undefined) {
    return null;
  }

  const separador = Buffer.from(`--${marca}`);
  let inicio = corpo.indexOf(separador);

  while (inicio !== -1) {
    const proximo = corpo.indexOf(separador, inicio + separador.length);

    if (proximo === -1) {
      return null;
    }

    const parte = corpo.subarray(inicio + separador.length, proximo);
    const fimDosCabecalhos = parte.indexOf("\r\n\r\n");

    if (fimDosCabecalhos !== -1) {
      const cabecalhos = parte.subarray(0, fimDosCabecalhos).toString("utf8");

      if (/name="file"/i.test(cabecalhos)) {
        // O conteúdo termina antes do "\r\n" que precede o separador.
        return parte.subarray(fimDosCabecalhos + 4, parte.length - 2);
      }
    }

    inicio = proximo;
  }

  return null;
}

export function registrarRotasDeImagensLocais(
  servidor: FastifyInstance,
  armazem: ArmazemEmDisco,
): void {
  void servidor.register(async (escopo) => {
    escopo.addContentTypeParser(
      "multipart/form-data",
      {
        parseAs: "buffer",
        bodyLimit: LIMITE_DE_BYTES_DA_IMAGEM + FOLGA_DO_MULTIPART,
      },
      (_requisicao, corpo, concluir) => concluir(null, corpo),
    );

    escopo.post(CAMINHO_DO_ENVIO_LOCAL, async (requisicao, resposta) => {
      const token = String((requisicao.query as { t?: unknown }).t ?? "");
      const arquivo = Buffer.isBuffer(requisicao.body)
        ? lerArquivoDoMultipart(
            requisicao.body,
            requisicao.headers["content-type"] ?? "",
          )
        : null;

      if (arquivo === null) {
        return resposta.status(400).send({ erro: "corpo_invalido" });
      }

      const recebido = await armazem.receberEnvio(token, arquivo);

      if (recebido === "invalido") {
        return resposta.status(403).send({ erro: "envio_invalido" });
      }

      if (recebido === "tamanho") {
        return resposta.status(413).send({ erro: "EntityTooLarge" });
      }

      return resposta.status(204).send();
    });

    escopo.get(CAMINHO_DA_LEITURA_LOCAL, async (requisicao, resposta) => {
      const token = String((requisicao.query as { t?: unknown }).t ?? "");
      const imagem = await armazem.lerParaEntrega(token);

      if (imagem === null) {
        return resposta.status(404).send();
      }

      return resposta
        .header("content-type", imagem.formato)
        .header("content-disposition", "inline")
        .header("x-content-type-options", "nosniff")
        .header("cache-control", "private, max-age=900")
        .send(Buffer.from(imagem.bytes));
    });
  });
}
