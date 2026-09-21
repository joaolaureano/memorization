import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { bloco, ler, TERRAFORM, valorDe } from "./arquivos-da-infra.ts";

/**
 * FR-124 — o cofre provisionado tem os **três** segredos que a função lê no
 * início a frio (FR-123), sob o mesmo prefixo.
 *
 * A prova é a leitura do código de infraestrutura, e não um `apply`: nada aqui
 * fala com a AWS. O que FR-124 exige é o que dá para conferir antes de publicar
 * — `SEGREDO_DAS_SENHAS` está no mesmo mapa de `DB_URL` e `ORIGIN_SECRET`; o
 * valor dele é um `random_password` de pelo menos 64 caracteres, e não um
 * literal versionado; todo parâmetro do mapa é nomeado sob o mesmo prefixo, por
 * `for_each`, de modo que acrescentar um segredo ao mapa basta para
 * provisioná-lo; e a policy de leitura alcança a ARN de **todos** os
 * parâmetros, sem uma linha de IAM nova por segredo.
 */

/** O fonte do cofre: os `SecureString`, o mapa de segredos e a policy de leitura. */
const SSM = ler(join(TERRAFORM, "ssm.tf"));

/** O fonte da função, onde a policy de leitura é anexada à role. */
const LAMBDA = ler(join(TERRAFORM, "lambda.tf"));

/** O mapa `local.secrets` — a única fonte dos parâmetros do cofre. */
const MAPA = bloco(bloco(SSM, /locals\s*\{/), /secrets\s*=\s*\{/);

describe("o cofre da infraestrutura (FR-124)", () => {
  it("reúne os três segredos lidos pela função no mesmo mapa (FR-124)", () => {
    const chaves = [...MAPA.matchAll(/^\s*([A-Z_]+)\s*=/gm)]
      .map((casamento) => casamento[1]!)
      .sort();

    expect(chaves).toEqual(["DB_URL", "ORIGIN_SECRET", "SEGREDO_DAS_SENHAS"]);
  });

  it("tira o segredo das Senhas de um random_password de 64 caracteres (FR-124)", () => {
    expect(valorDe(MAPA, "SEGREDO_DAS_SENHAS")).toBe(
      "random_password.segredo_das_senhas.result",
    );

    const recurso = bloco(
      SSM,
      /resource\s+"random_password"\s+"segredo_das_senhas"/,
    );

    expect(Number(valorDe(recurso, "length"))).toBeGreaterThanOrEqual(64);
  });

  it("provisiona os outros dois segredos pelo mesmo caminho (FR-124)", () => {
    expect(valorDe(MAPA, "DB_URL")).toBe("var.db_conn_string");
    expect(valorDe(MAPA, "ORIGIN_SECRET")).toBe(
      "random_password.origin_secret.result",
    );
  });

  it("nomeia todo parâmetro do mapa sob o mesmo prefixo, por for_each (FR-124)", () => {
    const prefixo = valorDe(bloco(SSM, /locals\s*\{/), "ssm_prefix");

    expect(prefixo).toBe('"/${var.project_name}"');

    const parametro = bloco(SSM, /resource\s+"aws_ssm_parameter"\s+"secret"/);

    expect(valorDe(parametro, "for_each")).toBe("local.secrets");
    expect(valorDe(parametro, "name")).toBe(
      '"${local.ssm_prefix}/${each.key}"',
    );
  });

  it("libera a leitura dos três segredos pela ARN de todos os parâmetros (FR-124)", () => {
    const policy = bloco(
      SSM,
      /data\s+"aws_iam_policy_document"\s+"read_secrets"/,
    );
    const recursos = valorDe(policy, "resources");

    expect(recursos).toBe("[for p in aws_ssm_parameter.secret : p.arn]");
    expect(policy).toMatch(
      /actions\s*=\s*\[[^\]]*"ssm:GetParameter"[^\]]*"ssm:GetParameters"[^\]]*\]/,
    );
  });

  it("anexa a policy de leitura à role da função (FR-124)", () => {
    const vinculo = bloco(
      LAMBDA,
      /resource\s+"aws_iam_role_policy"\s+"lambda_read_secrets"/,
    );

    expect(valorDe(vinculo, "role")).toBe("aws_iam_role.lambda.id");
    expect(valorDe(vinculo, "policy")).toBe(
      "data.aws_iam_policy_document.read_secrets.json",
    );
  });
});
