import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ler, SPEC } from "./arquivos-da-infra.ts";

/**
 * SC-059 — o p95 da verificação da Senha abaixo de 1 segundo, medido na função
 * publicada.
 *
 * Um teste **não** mede o p95 de uma função publicada: isso é ação de quem
 * publica, sobre a AWS, com tráfego de verdade. O que este teste prova é o elo
 * honesto da cadeia de evidência — o **registro** daquela medição existe em
 * `research.md` (Decisão 10, nota de pós-publicação), com os números medidos, a
 * origem (CloudFront, a partir do Brasil) e o remédio aplicado. A medição em si
 * é o EVT-099 do `SESSION.md`.
 */

/** O registro da decisão da memória e da medição de pós-publicação. */
const RESEARCH = ler(join(SPEC, "research.md"));

describe("o registro da medição de p95 (SC-059)", () => {
  it("documenta a medição pós-publicação, com os números medidos (SC-059)", () => {
    expect(RESEARCH).toMatch(/Atualização pós-publicação/);
    expect(RESEARCH).toMatch(/CloudFront/);
    expect(RESEARCH).toMatch(/p95/);
    expect(RESEARCH).toMatch(/0,99\s?s/);
    expect(RESEARCH).toMatch(/0,81\s?s/);
  });

  it("registra que a medição foi feita na função e não na execução local (SC-059)", () => {
    expect(RESEARCH).toMatch(/medid[ao]\s+na função/);
    expect(RESEARCH).toMatch(/SC-059/);
  });

  it("registra o remédio aplicado, e não o enfraquecimento da derivação (SC-059)", () => {
    expect(RESEARCH).toMatch(/padrão de `lambda_memory_mb` passou a ser 1769/);
    expect(RESEARCH).toMatch(/hash não foi enfraquecido/);
  });
});
