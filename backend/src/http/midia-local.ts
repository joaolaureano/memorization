import type { FastifyInstance } from "fastify";

import {
  CAMINHO_DA_LEITURA_LOCAL,
  CAMINHO_DO_ENVIO_LOCAL,
  type ArmazemEmDisco,
} from "../midia/armazem-em-disco.ts";
import { MAIOR_LIMITE_DE_BYTES } from "../midia/regras.ts";

/**
 * As rotas do Adapter Disco (`026`, research R3): o equivalente local do envio
 * direto ao S3 e da leitura por endereço assinado. Só a entrada local as
 * registra. Não exigem Credencial — quem autoriza é o token assinado e com
 * prazo, como as assinaturas do S3 (FR-424) —, e por isso o prefixo
 * `/midia-local/` é isento no hook de Credencial.
 */

/** Folga para os cabeçalhos do `multipart/form-data` além do arquivo. */
const FOLGA_DO_MULTIPART = 64 * 1024;

/** Um trecho do arquivo, com os índices inclusivos de início e fim. */
export interface Intervalo {
  inicio: number;
  fim: number;
}

/**
 * Interpreta o cabeçalho `Range` de um arquivo de `total` bytes (FR-453). Só
 * um intervalo é aceito: `bytes=a-b`, `bytes=a-` ou `bytes=-n`. Devolve o
 * trecho, `"insatisfativel"` (416) ou `null` quando o cabeçalho deve ser
 * ignorado e o arquivo inteiro servido (ausente, com vários intervalos ou mal
 * formado, como manda a RFC 9110).
 */
export function lerIntervalo(
  cabecalho: string | undefined,
  total: number,
): Intervalo | "insatisfativel" | null {
  const casado = /^bytes=(\d*)-(\d*)$/.exec(cabecalho?.trim() ?? "");

  if (casado === null || (casado[1] === "" && casado[2] === "")) {
    return null;
  }

  const [, inicioTexto = "", fimTexto = ""] = casado;

  if (inicioTexto === "") {
    const sufixo = Number(fimTexto);
    return sufixo === 0
      ? "insatisfativel"
      : { inicio: Math.max(0, total - sufixo), fim: total - 1 };
  }

  const inicio = Number(inicioTexto);

  if (inicio >= total) {
    return "insatisfativel";
  }

  const fim =
    fimTexto === "" ? total - 1 : Math.min(Number(fimTexto), total - 1);

  return fim < inicio ? null : { inicio, fim };
}

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

export function registrarRotasDeMidiaLocal(
  servidor: FastifyInstance,
  armazem: ArmazemEmDisco,
): void {
  void servidor.register(async (escopo) => {
    escopo.addContentTypeParser(
      "multipart/form-data",
      {
        parseAs: "buffer",
        bodyLimit: MAIOR_LIMITE_DE_BYTES + FOLGA_DO_MULTIPART,
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
      const midia = await armazem.lerParaEntrega(token);

      if (midia === null) {
        return resposta.status(404).send();
      }

      const total = midia.bytes.length;
      resposta
        .header("content-type", midia.formato)
        .header("content-disposition", "inline")
        .header("x-content-type-options", "nosniff")
        .header("cache-control", "private, max-age=900")
        .header("accept-ranges", "bytes");

      const intervalo = lerIntervalo(requisicao.headers.range, total);

      if (intervalo === "insatisfativel") {
        return resposta
          .status(416)
          .header("content-range", `bytes */${total}`)
          .send();
      }

      if (intervalo === null) {
        return resposta.send(Buffer.from(midia.bytes));
      }

      return resposta
        .status(206)
        .header("content-range", `bytes ${intervalo.inicio}-${intervalo.fim}/${total}`)
        .send(Buffer.from(midia.bytes.subarray(intervalo.inicio, intervalo.fim + 1)));
    });
  });
}
