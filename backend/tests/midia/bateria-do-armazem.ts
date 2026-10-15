import { describe, expect, it } from "vitest";

import {
  LIMITE_DE_BYTES_DA_IMAGEM,
  VALIDADE_DA_LEITURA_EM_SEGUNDOS,
  VALIDADE_DO_ENVIO_EM_SEGUNDOS,
  type ArmazemDeMidia,
  type EnvioPreparado,
  type Midia,
} from "../../src/midia/armazem.ts";
import {
  contem,
  gifComMetadados,
  jpegComMetadados,
  orientacaoDoJpeg,
  pngComMetadados,
  textoDisfarcado,
  webpComMetadados,
} from "./amostras.ts";
import { amostraWav } from "./amostras-de-audio/wav.ts";

/**
 * T007 — bateria de contrato do `ArmazemDeMidia` (`026`, FR-410, FR-411,
 * FR-424, FR-427), comum aos Adapters Disco e S3.
 *
 * Cada Adapter fornece, além do armazém, as duas ações que o navegador faz
 * fora da API: enviar o arquivo ao envio preparado e ler um endereço.
 */
export interface CenarioDoArmazem {
  armazem: ArmazemDeMidia;
  /** Faz o envio como o navegador; devolve o status HTTP da resposta. */
  enviar(envio: EnvioPreparado, bytes: Uint8Array): Promise<number>;
  /** Lê um endereço; `null` quando a leitura é negada. */
  ler(url: string): Promise<{ bytes: Uint8Array; tipo: string; disposicao?: string } | null>;
  /** Lê diretamente uma chave do armazém, sem assinatura; `null` se negado. */
  lerSemAssinatura(chave: string): Promise<Uint8Array | null>;
  /** Leva o relógio adiante, quando o Adapter permite; senão, omitido. */
  avancar?(segundos: number): void;
  /** Diz se o Adapter recusa envios acima do limite (o MinIO pode não recusar). */
  recusaEnvioGrande?: boolean;
}

const DONO = "dono-um";
const OUTRO = "dono-dois";

export function bateriaDoArmazem(
  nome: string,
  criar: () => Promise<CenarioDoArmazem>,
): void {
  describe(`ArmazemDeMidia — ${nome}`, () => {
    async function enviarEConfirmar(
      cenario: CenarioDoArmazem,
      midia: Midia,
      bytes: Uint8Array,
    ) {
      const envio = await cenario.armazem.prepararEnvio(DONO, midia);
      expect(await cenario.enviar(envio, bytes)).toBeLessThan(300);
      return cenario.armazem.confirmar(DONO, envio.envioId, midia);
    }

    it("prepara envio válido por até 5 minutos", async () => {
      const cenario = await criar();
      const antes = Date.now();
      const envio = await cenario.armazem.prepararEnvio(DONO, "imagem");

      expect(envio.envioId).toMatch(/^[0-9a-f-]{36}$/);
      expect(typeof envio.envio.url).toBe("string");
      expect(typeof envio.envio.campos).toBe("object");
      expect(Date.parse(envio.expiraEm) - antes).toBeLessThanOrEqual(
        VALIDADE_DO_ENVIO_EM_SEGUNDOS * 1000 + 2000,
      );
    });

    it.each([
      ["JPEG", jpegComMetadados(), "image/jpeg"],
      ["PNG", pngComMetadados(), "image/png"],
      ["GIF87a", gifComMetadados("GIF87a"), "image/gif"],
      ["GIF89a", gifComMetadados("GIF89a"), "image/gif"],
      ["WebP", webpComMetadados(), "image/webp"],
    ] as const)("aceita %s pelo conteúdo e o serve com o tipo detectado", async (_, bytes, tipo) => {
      const cenario = await criar();
      const confirmada = await enviarEConfirmar(cenario, "imagem", bytes);

      expect(confirmada).toMatchObject({ ok: true, formato: tipo });
      if (!confirmada.ok) return;
      expect(confirmada.chave.startsWith(`imagens/${DONO}/`)).toBe(true);

      const endereco = await cenario.armazem.enderecoDeLeitura(confirmada.chave);
      const lida = await cenario.ler(endereco.url);
      expect(lida?.tipo).toBe(tipo);
    });

    it("lê e mede as chaves ativas; chaves ausentes contam zero", async () => {
      const cenario = await criar();
      const png = pngComMetadados();
      const wav = amostraWav({ segundos: 1 });
      const imagem = await enviarEConfirmar(cenario, "imagem", png);
      const audio = await enviarEConfirmar(cenario, "audio", wav);
      if (!imagem.ok || !audio.ok) throw new Error("mídia recusada");

      // The upload path sanitizes image metadata; use the active stored bytes as
      // the exact baseline for the direct-read contract.
      const enderecoImagem = await cenario.armazem.enderecoDeLeitura(imagem.chave);
      const imagemArmazenada = await cenario.ler(enderecoImagem.url);
      expect(imagemArmazenada).not.toBeNull();
      expect(Buffer.from((await cenario.armazem.ler(imagem.chave)) ?? [])).toEqual(Buffer.from(imagemArmazenada!.bytes));
      expect(Buffer.from((await cenario.armazem.ler(audio.chave)) ?? [])).toEqual(Buffer.from(wav));
      expect(await cenario.armazem.medir([imagem.chave, audio.chave])).toBe(imagemArmazenada!.bytes.length + wav.length);
      expect(await cenario.armazem.medir([])).toBe(0);
      await cenario.armazem.remover([imagem.chave]);
      expect(await cenario.armazem.ler(imagem.chave)).toBeNull();
      expect(await cenario.armazem.medir([imagem.chave, audio.chave])).toBe(wav.length);
    });

    it("guarda e sobrescreve Exportação com nome UTF-8 e endereço de até 15 minutos", async () => {
      const cenario = await criar();
      const primeiro = new TextEncoder().encode("primeiro pacote");
      const endereco = await cenario.armazem.guardarExportacao(DONO, primeiro, "Inglês.apkg", "application/octet-stream");
      const prazoMs = Date.parse(endereco.expiraEm) - Date.now();
      expect(prazoMs).toBeGreaterThan(0);
      expect(prazoMs).toBeLessThanOrEqual(VALIDADE_DA_LEITURA_EM_SEGUNDOS * 1000 + 2000);
      const recebido = await cenario.ler(endereco.url);
      expect(recebido).not.toBeNull();
      expect(Buffer.from(recebido!.bytes)).toEqual(Buffer.from(primeiro));
      expect(recebido).toMatchObject({
        tipo: "application/octet-stream",
        disposicao: expect.stringContaining("attachment;"),
      });
      expect((await cenario.ler(endereco.url))?.disposicao).toContain("filename*=UTF-8''Ingl%C3%AAs.apkg");

      const segundo = new TextEncoder().encode("segundo pacote");
      await cenario.armazem.guardarExportacao(DONO, segundo, "Inglês.apkg", "application/octet-stream");
      expect(Buffer.from((await cenario.ler(endereco.url))?.bytes ?? [])).toEqual(Buffer.from(segundo));
    });

    it("remove os metadados e preserva a orientação do JPEG (FR-427)", async () => {
      const cenario = await criar();

      for (const bytes of [jpegComMetadados(6), pngComMetadados(), gifComMetadados(), webpComMetadados()]) {
        const confirmada = await enviarEConfirmar(cenario, "imagem", bytes);
        if (!confirmada.ok) throw new Error("recusada");
        const endereco = await cenario.armazem.enderecoDeLeitura(confirmada.chave);
        const lida = await cenario.ler(endereco.url);

        expect(lida).not.toBeNull();
        expect(contem(lida!.bytes, "SEGREDO-GPS")).toBe(false);
        expect(contem(lida!.bytes, "SEGREDO-COMENTARIO")).toBe(false);
        if (lida!.tipo === "image/jpeg") {
          expect(orientacaoDoJpeg(lida!.bytes)).toBe(6);
        }
        if (lida!.tipo === "image/gif") {
          expect(contem(lida!.bytes, "NETSCAPE2.0")).toBe(true);
        }
      }
    });

    it("recusa texto com nome de imagem e apaga o pendente (FR-411)", async () => {
      const cenario = await criar();
      const envio = await cenario.armazem.prepararEnvio(DONO, "imagem");
      await cenario.enviar(envio, textoDisfarcado());

      expect(await cenario.armazem.confirmar(DONO, envio.envioId, "imagem")).toEqual({
        ok: false,
        motivo: "formato",
      });
      expect(await cenario.armazem.confirmar(DONO, envio.envioId, "imagem")).toEqual({
        ok: false,
        motivo: "nao_encontrada",
      });
    });

    it("aceita 1 B a 5.242.880 B e recusa acima do limite (FR-410)", async () => {
      const cenario = await criar();
      const noLimite = pngComMetadados(LIMITE_DE_BYTES_DA_IMAGEM);
      expect(noLimite.length).toBe(LIMITE_DE_BYTES_DA_IMAGEM);
      expect(await enviarEConfirmar(cenario, "imagem", noLimite)).toMatchObject({ ok: true });

      const umByte = await cenario.armazem.prepararEnvio(DONO, "imagem");
      expect(await cenario.enviar(umByte, new Uint8Array([0x47]))).toBeLessThan(300);
      expect(await cenario.armazem.confirmar(DONO, umByte.envioId, "imagem")).toEqual({
        ok: false,
        motivo: "formato",
      });

      if (cenario.recusaEnvioGrande !== false) {
        const grande = await cenario.armazem.prepararEnvio(DONO, "imagem");
        expect(
          await cenario.enviar(grande, pngComMetadados(LIMITE_DE_BYTES_DA_IMAGEM + 1)),
        ).toBeGreaterThanOrEqual(400);
        expect(await cenario.armazem.confirmar(DONO, grande.envioId, "imagem")).toEqual({
          ok: false,
          motivo: "nao_encontrada",
        });
      }
    });

    it("não confirma envio ausente, de outro Usuário ou com identificador forjado", async () => {
      const cenario = await criar();
      const envio = await cenario.armazem.prepararEnvio(DONO, "imagem");
      await cenario.enviar(envio, pngComMetadados());

      expect(await cenario.armazem.confirmar(OUTRO, envio.envioId, "imagem")).toEqual({
        ok: false,
        motivo: "nao_encontrada",
      });
      expect(
        await cenario.armazem.confirmar(DONO, "00000000-0000-4000-8000-000000000000", "imagem"),
      ).toEqual({ ok: false, motivo: "nao_encontrada" });
      expect(await cenario.armazem.confirmar(DONO, "../dono-dois/x", "imagem")).toEqual({
        ok: false,
        motivo: "nao_encontrada",
      });
    });

    it("nunca deixa ler pendente nem Imagem sem assinatura (FR-424)", async () => {
      const cenario = await criar();
      const envio = await cenario.armazem.prepararEnvio(DONO, "imagem");
      await cenario.enviar(envio, pngComMetadados());

      expect(await cenario.lerSemAssinatura(`pendentes/${DONO}/${envio.envioId}`)).toBeNull();

      const confirmada = await cenario.armazem.confirmar(DONO, envio.envioId, "imagem");
      if (!confirmada.ok) throw new Error("recusada");
      expect(await cenario.lerSemAssinatura(confirmada.chave)).toBeNull();
    });

    it("emite endereço de leitura que expira em até 15 minutos", async () => {
      const cenario = await criar();
      const confirmada = await enviarEConfirmar(cenario, "imagem", pngComMetadados());
      if (!confirmada.ok) throw new Error("recusada");

      const antes = Date.now();
      const endereco = await cenario.armazem.enderecoDeLeitura(confirmada.chave);
      expect(Date.parse(endereco.expiraEm) - antes).toBeLessThanOrEqual(
        VALIDADE_DA_LEITURA_EM_SEGUNDOS * 1000 + 2000,
      );

      if (cenario.avancar !== undefined) {
        cenario.avancar(VALIDADE_DA_LEITURA_EM_SEGUNDOS + 1);
        expect(await cenario.ler(endereco.url)).toBeNull();
      }
    });

    it("copia para uma chave independente e remove de forma idempotente (FR-422)", async () => {
      const cenario = await criar();
      const confirmada = await enviarEConfirmar(cenario, "imagem", pngComMetadados());
      if (!confirmada.ok) throw new Error("recusada");

      const copia = await cenario.armazem.copiar(confirmada.chave, OUTRO);
      expect(copia).not.toBe(confirmada.chave);
      expect(copia.startsWith(`imagens/${OUTRO}/`)).toBe(true);

      expect(await cenario.armazem.remover([confirmada.chave])).toEqual([confirmada.chave]);
      expect(await cenario.armazem.remover([confirmada.chave])).toEqual([confirmada.chave]);

      const original = await cenario.armazem.enderecoDeLeitura(confirmada.chave);
      expect(await cenario.ler(original.url)).toBeNull();
      const daCopia = await cenario.armazem.enderecoDeLeitura(copia);
      expect((await cenario.ler(daCopia.url))?.tipo).toBe("image/png");
    });

    it("grava arquivo fixo de demonstração que ler e o endereço de leitura entregam (R13)", async () => {
      const cenario = await criar();
      const bytes = pngComMetadados();
      await cenario.armazem.gravarArquivoFixo("demonstracao/x.png", bytes, "image/png");

      expect(Buffer.from((await cenario.armazem.ler("demonstracao/x.png")) ?? [])).toEqual(Buffer.from(bytes));
      const endereco = await cenario.armazem.enderecoDeLeitura("demonstracao/x.png");
      const lida = await cenario.ler(endereco.url);
      expect(lida?.tipo).toBe("image/png");
      expect(Buffer.from(lida!.bytes)).toEqual(Buffer.from(bytes));
    });

    it("recusa gravar fixo fora de demonstracao/, inclusive com salto de pasta (R13)", async () => {
      const cenario = await criar();
      const bytes = new Uint8Array([1, 2, 3]);

      await expect(cenario.armazem.gravarArquivoFixo("imagens/u/x", bytes, "image/png")).rejects.toThrow();
      await expect(
        cenario.armazem.gravarArquivoFixo("demonstracao/../imagens/u/x", bytes, "image/png"),
      ).rejects.toThrow();
      expect(await cenario.armazem.ler("imagens/u/x")).toBeNull();
    });

    describe("Mídia Áudio (028, FR-436, FR-437)", () => {
      it("confere o WAV pelo conteúdo, o guarda sob audios/ e o serve como audio/wav", async () => {
        const cenario = await criar();
        const confirmada = await enviarEConfirmar(cenario, "audio", amostraWav({ segundos: 1 }));

        expect(confirmada).toMatchObject({ ok: true, formato: "audio/wav", duracaoMs: 1000 });
        if (!confirmada.ok) return;
        expect(confirmada.chave.startsWith(`audios/${DONO}/`)).toBe(true);

        const endereco = await cenario.armazem.enderecoDeLeitura(confirmada.chave);
        expect((await cenario.ler(endereco.url))?.tipo).toBe("audio/wav");
      });

      it("aceita envio de exatamente 10.485.760 B e recusa 10.485.761 B (FR-436)", async () => {
        const cenario = await criar();

        const noLimite = await cenario.armazem.prepararEnvio(DONO, "audio");
        expect(await cenario.enviar(noLimite, new Uint8Array(10_485_760))).toBeLessThan(300);

        if (cenario.recusaEnvioGrande !== false) {
          const grande = await cenario.armazem.prepararEnvio(DONO, "audio");
          expect(await cenario.enviar(grande, new Uint8Array(10_485_761))).toBeGreaterThanOrEqual(400);
          expect(await cenario.armazem.confirmar(DONO, grande.envioId, "audio")).toEqual({
            ok: false,
            motivo: "nao_encontrada",
          });
        }
      });

      it("recusa WAV como Imagem e PNG como Áudio, pelo conteúdo real", async () => {
        const cenario = await criar();

        expect(await enviarEConfirmar(cenario, "imagem", amostraWav({ segundos: 1 }))).toEqual({
          ok: false,
          motivo: "formato",
        });
        expect(await enviarEConfirmar(cenario, "audio", pngComMetadados())).toEqual({
          ok: false,
          motivo: "formato",
        });
      });

      it("recusa Áudio com mais de 300 s por duração (FR-437)", async () => {
        const cenario = await criar();

        expect(await enviarEConfirmar(cenario, "audio", amostraWav({ segundos: 300.001 }))).toEqual({
          ok: false,
          motivo: "duracao",
        });
      });
    });
  });
}
