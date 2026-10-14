import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { criarArmazemEmDisco } from "../../src/midia/armazem-em-disco.ts";
import { lerArquivoDoMultipart, registrarRotasDeMidiaLocal } from "../../src/http/midia-local.ts";
import { bateriaDoArmazem } from "./bateria-do-armazem.ts";
import { amostraWav } from "./amostras-de-audio/wav.ts";

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
      return imagem === null ? null : { bytes: imagem.bytes, tipo: imagem.formato, disposicao: imagem.disposicao };
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
  it("guarda pacote de exportação e devolve anexo de curta duração", async () => {
    const pasta = mkdtempSync(join(tmpdir(), "armazem-exportacao-"));
    const armazem = criarArmazemEmDisco({ pasta });
    const bytes = Buffer.from("package bytes");
    const endereco = await armazem.guardarExportacao("usuario-1", bytes, "Inglês.apkg", "application/octet-stream");
    const arquivo = await armazem.lerParaEntrega(tokenDa(endereco.url));
    expect(arquivo?.bytes).toEqual(bytes);
    expect(arquivo?.disposicao).toContain("attachment;");
    expect(arquivo?.disposicao).toContain("filename*=UTF-8''Ingl%C3%AAs.apkg");
    expect(Date.parse(endereco.expiraEm) - Date.now()).toBeLessThanOrEqual(900_000);
    expect(await readFile(join(pasta, "exportacoes/usuario-1"))).toEqual(bytes);
  });

  it("recusa token adulterado ou de outra finalidade", async () => {
    const pasta = mkdtempSync(join(tmpdir(), "armazem-de-imagens-"));
    const armazem = criarArmazemEmDisco({ pasta });
    const envio = await armazem.prepararEnvio("dono-um", "imagem");
    const token = tokenDa(envio.envio.url);

    expect(await armazem.receberEnvio(`${token}x`, new Uint8Array([1]))).toBe("invalido");
    expect(await armazem.lerParaEntrega(token)).toBeNull();
  });

  it("guarda os arquivos sob as chaves do S3", async () => {
    const pasta = mkdtempSync(join(tmpdir(), "armazem-de-imagens-"));
    const armazem = criarArmazemEmDisco({ pasta });
    const envio = await armazem.prepararEnvio("dono-um", "imagem");
    await armazem.receberEnvio(tokenDa(envio.envio.url), new Uint8Array([0x47, 0x49, 0x46]));

    expect(
      await readFile(join(pasta, "pendentes", "dono-um", envio.envioId)),
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

describe("Adapter Disco — leitura por rota local com Range (028, FR-453)", () => {
  /** Um WAV de 1 s confirmado como Áudio; devolve o servidor da rota local e o endereço. */
  async function montar() {
    const pasta = mkdtempSync(join(tmpdir(), "armazem-de-midia-"));
    const armazem = criarArmazemEmDisco({ pasta });
    const envio = await armazem.prepararEnvio("dono-um", "audio");
    await armazem.receberEnvio(tokenDa(envio.envio.url), amostraWav({ segundos: 1 }));
    const confirmada = await armazem.confirmar("dono-um", envio.envioId, "audio");
    if (!confirmada.ok) throw new Error("recusada");
    const endereco = await armazem.enderecoDeLeitura(confirmada.chave);
    const servidor = Fastify();
    registrarRotasDeMidiaLocal(servidor, armazem);
    return { servidor, url: endereco.url, total: confirmada.bytes };
  }

  it("responde Range com 206, Content-Range e o trecho pedido", async () => {
    const { servidor, url, total } = await montar();
    const resposta = await servidor.inject({ method: "GET", url, headers: { range: "bytes=0-99" } });

    expect(resposta.statusCode).toBe(206);
    expect(resposta.headers["content-range"]).toBe(`bytes 0-99/${total}`);
    expect(resposta.headers["accept-ranges"]).toBe("bytes");
    expect(resposta.headers["content-type"]).toBe("audio/wav");
    expect(resposta.rawPayload.length).toBe(100);
    await servidor.close();
  });

  it("sem Range responde 200 inteiro e anuncia Accept-Ranges", async () => {
    const { servidor, url, total } = await montar();
    const resposta = await servidor.inject({ method: "GET", url });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers["accept-ranges"]).toBe("bytes");
    expect(resposta.rawPayload.length).toBe(total);
    await servidor.close();
  });

  it("aceita intervalo com sufixo e recusa intervalo fora do arquivo com 416", async () => {
    const { servidor, url, total } = await montar();

    const sufixo = await servidor.inject({ method: "GET", url, headers: { range: "bytes=-10" } });
    expect(sufixo.statusCode).toBe(206);
    expect(sufixo.headers["content-range"]).toBe(`bytes ${total - 10}-${total - 1}/${total}`);

    const fora = await servidor.inject({ method: "GET", url, headers: { range: `bytes=${total}-` } });
    expect(fora.statusCode).toBe(416);
    expect(fora.headers["content-range"]).toBe(`bytes */${total}`);
    await servidor.close();
  });
});
