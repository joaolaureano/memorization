import { describe, expect, it } from "vitest";

import { armazemDaNuvem } from "../../src/midia/configuracao.ts";

/**
 * T016 — a nuvem só tem armazém de Imagens com `NOME_DO_BUCKET_DE_IMAGENS`;
 * sem ele, o tipo Imagem fica indisponível e o resto da aplicação segue igual.
 */
describe("armazemDaNuvem", () => {
  it("não monta armazém sem o nome do bucket, nem com ele em branco", () => {
    expect(armazemDaNuvem({})).toBeUndefined();
    expect(armazemDaNuvem({ NOME_DO_BUCKET_DE_IMAGENS: "  " })).toBeUndefined();
  });

  it("monta o Adapter S3 com o nome do bucket", () => {
    const armazem = armazemDaNuvem({ NOME_DO_BUCKET_DE_IMAGENS: "memorization-imagens-1" });

    expect(Object.keys(armazem ?? {}).sort()).toEqual([
      "confirmar",
      "copiar",
      "enderecoDeLeitura",
      "guardarExportacao",
      "ler",
      "medir",
      "prepararEnvio",
      "remover",
    ]);
  });
});
