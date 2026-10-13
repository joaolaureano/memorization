import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { criarArmazemEmDisco } from "../../src/imagens/armazem-em-disco.ts";
import { lerArquivoDoMultipart } from "../../src/http/imagens-locais.ts";
import { bateriaDoArmazem } from "./bateria-do-armazem.ts";

/** O token é a consulta `t` do endereço relativo emitido pelo Adapter. */
const tokenDa = (url: string): string =>
  new URL(url, "http://local").searchParams.get("t") ?? "";

bateriaDoArmazem("Adapter Disco", async () => {
  const pasta = mkdtempSync(join(tmpdir(), "armazem-de-imagens-"));
  let deslocamento = 0;
  const armazem = criarArmazemEmDisco({
    pasta,
    agora: () => new Date(Date.now() + deslocamento),
  });

  return {
    armazem,
    async enviar(envio, bytes) {
      const recebido = await armazem.receberEnvio(tokenDa(envio.envio.url), bytes);
      return recebido === "ok" ? 204 : recebido === "tamanho" ? 413 : 403;
    },
    async ler(url) {
      const imagem = await armazem.lerParaEntrega(tokenDa(url));
      return imagem === null ? null : { bytes: imagem.bytes, tipo: imagem.formato };
    },
    async lerSemAssinatura(chave) {
      // No Disco, a única entrada de leitura é o token: uma chave crua não é token.
      const imagem = await armazem.lerParaEntrega(chave);
      return imagem === null ? null : imagem.bytes;
    },
    avancar(segundos) {
      deslocamento += segundos * 1000;
    },
  };
});

describe("Adapter Disco — detalhes locais", () => {
  it("recusa token adulterado ou de outra finalidade", async () => {
    const pasta = mkdtempSync(join(tmpdir(), "armazem-de-imagens-"));
    const armazem = criarArmazemEmDisco({ pasta });
    const envio = await armazem.prepararEnvio("dono-um");
    const token = tokenDa(envio.envio.url);

    expect(await armazem.receberEnvio(`${token}x`, new Uint8Array([1]))).toBe("invalido");
    expect(await armazem.lerParaEntrega(token)).toBeNull();
  });

  it("guarda os arquivos sob as chaves do S3", async () => {
    const pasta = mkdtempSync(join(tmpdir(), "armazem-de-imagens-"));
    const armazem = criarArmazemEmDisco({ pasta });
    const envio = await armazem.prepararEnvio("dono-um");
    await armazem.receberEnvio(tokenDa(envio.envio.url), new Uint8Array([0x47, 0x49, 0x46]));

    expect(
      await readFile(join(pasta, "pendentes", "dono-um", envio.imagemId)),
    ).toHaveLength(3);
  });

  it("extrai o campo `file` de um corpo multipart", () => {
    const corpo = Buffer.from(
      "--X\r\nContent-Disposition: form-data; name=\"key\"\r\n\r\nk\r\n" +
        "--X\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.png\"\r\n" +
        "Content-Type: image/png\r\n\r\nABC\r\n--X--\r\n",
    );

    expect(lerArquivoDoMultipart(corpo, "multipart/form-data; boundary=X")?.toString()).toBe("ABC");
    expect(lerArquivoDoMultipart(corpo, "multipart/form-data")).toBeNull();
  });
});
