import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ler, SPEC } from "./arquivos-da-infra.ts";

/**
 * FR-134 e SC-061 — o manual de operação documenta a ordem de provisionamento,
 * e a ordem documentada é a ordem a ser seguida.
 *
 * A prova é a leitura do `quickstart.md`: os passos aparecem **nesta ordem** —
 * segredos e valores, migração pelo endpoint direto do Neon, construção do
 * pacote, `apply` com o pacote, publicação do SPA, validação pelo endereço do
 * CloudFront e, por fim, o `destroy`. Que cem por cento das implantações **de
 * fato** sigam a ordem (SC-061) não se prova lendo um arquivo: prova-se
 * operando. O que se prova aqui é que a ordem está escrita, uma vez só, e que o
 * manual não carrega segredo real — só a forma de espaço reservado entre
 * ângulos (Princípio VIII, FR-123).
 */

/** O manual de operação da hospedagem. */
const MANUAL = ler(join(SPEC, "quickstart.md"));

/** Os sete passos da ordem de provisionamento, como o manual os intitula. */
const PASSOS = [
  "### 1. Segredos e valores no `terraform.tfvars`",
  "### 2. Migrar o esquema, pelo endpoint **direto**",
  "### 3. Construir o pacote da função",
  "### 4. Aplicar a infraestrutura com o pacote",
  "### 5. Publicar o SPA",
  "### 6. Validar pelo endereço do CloudFront",
  "### 7. Derrubar",
];

/**
 * A posição de um trecho no manual. Trecho ausente é erro: o teste falha
 * nomeando o que falta, e não comparando `-1` com um número.
 */
function posicao(trecho: string): number {
  const indice = MANUAL.indexOf(trecho);

  if (indice < 0) {
    throw new Error(`trecho ausente no manual: ${trecho}`);
  }

  return indice;
}

/** As posições de uma lista de trechos, na ordem em que o manual os apresenta. */
function posicoes(trechos: readonly string[]): number[] {
  return trechos.map(posicao);
}

/** O trecho do manual entre dois marcadores, na ordem em que aparecem. */
function trechoDe(inicio: string, fim: string): string {
  return MANUAL.slice(posicao(inicio), posicao(fim));
}

/** Do primeiro ao último, cada posição vem depois da anterior. */
function emOrdem(onde: readonly number[]): boolean {
  return onde.every((posicao, indice) => indice === 0 || posicao > onde[indice - 1]!);
}

describe("o manual de operação (FR-134, SC-061)", () => {
  it("documenta os sete passos nesta ordem: segredos, migração, pacote, apply, SPA, validação, destroy (FR-134, SC-061)", () => {
    expect(emOrdem(posicoes(PASSOS))).toBe(true);
  });

  it("traz, em cada passo, o comando que o operador executa, e na ordem dos passos (FR-134, SC-061)", () => {
    const comandos = [
      "cp terraform.tfvars.example terraform.tfvars",
      "npm run migrate:cloud",
      "npm run build:lambda",
      "tofu -chdir=backend/terraform apply \\",
      "-var lambda_package",
      "backend/terraform/scripts/deploy-frontend.sh",
      "tofu -chdir=backend/terraform output -raw app_url",
      "tofu -chdir=backend/terraform destroy",
    ];

    expect(emOrdem(posicoes(comandos))).toBe(true);
  });

  it("manda migrar pelo endpoint direto do Neon, e nunca pela função (FR-134, SC-061)", () => {
    const migracao = trechoDe(
      "### 2. Migrar o esquema, pelo endpoint **direto**",
      "### 3. Construir o pacote da função",
    );

    expect(migracao).toContain("npm run migrate:cloud");
    expect(migracao).toContain("direto");
    expect(migracao).toContain("Neon");
  });

  it("aplica a infraestrutura com o pacote e publica o SPA depois (FR-134, SC-061)", () => {
    const aplicacao = trechoDe(
      "### 4. Aplicar a infraestrutura com o pacote",
      "### 6. Validar pelo endereço do CloudFront",
    );

    expect(aplicacao).toContain("-var lambda_package");
    expect(aplicacao).toContain("tofu -chdir=backend/terraform apply");
    expect(aplicacao).toContain("deploy-frontend.sh");
  });

  it("valida pelo endereço do CloudFront antes de derrubar a pilha (FR-134, SC-061)", () => {
    const validacao = trechoDe(
      "### 6. Validar pelo endereço do CloudFront",
      "### 7. Derrubar",
    );

    expect(validacao).toContain("output -raw app_url");
    expect(validacao).toContain("CloudFront");
    expect(MANUAL).toContain("tofu -chdir=backend/terraform destroy");
  });

  it("não carrega segredo real: a URL de conexão só aparece com espaços reservados (FR-123, FR-134)", () => {
    const urls = MANUAL.match(/postgresql:\/\/[^\s"'`]+/g) ?? [];

    expect(urls.length).toBeGreaterThan(0);

    for (const url of urls) {
      const arroba = url.indexOf("@");

      if (arroba < 0) {
        /** `postgresql://` sem credenciais: o `grep` do próprio manual. */
        continue;
      }

      const credenciais = url.slice("postgresql://".length, arroba);

      expect(credenciais).toMatch(/^<[^<>]+>:<[^<>]+>$/);
    }
  });
});
