import { createHmac, randomBytes, scrypt } from "node:crypto";

/**
 * A transformação irreversível da Senha — o que o `Identidade` guarda no lugar
 * dela (FR-076).
 *
 * A decisão, registrada em `research.md`, é:
 *
 * - `entrada = HMAC-SHA256(segredo, senha em UTF-8)`;
 * - `hash = scrypt(entrada, sal, 64)`, com `N=32768`, `r=8`, `p=1` e `maxmem`
 *   de 64 MiB;
 * - `sal` = 16 bytes aleatórios **por Usuário**.
 *
 * O HMAC entra por dois motivos: produz uma entrada de comprimento fixo, sem
 * ambiguidade de formato, e separa por construção a chave (o segredo do
 * servidor) da mensagem (a Senha). O scrypt é *memory-hard* — é a exigência de
 * memória que encarece o ataque com hardware dedicado —, e vem do `node:crypto`
 * sem dependência nova.
 *
 * Os parâmetros são gravados **junto** do hash, em JSON, para evoluírem sem
 * migração de dados: um hash antigo continua verificável com os parâmetros com
 * que foi produzido.
 */

/** Tamanho do `sal`, em bytes: 16, como a `CHECK` do esquema exige (FR-076). */
export const TAMANHO_DO_SAL = 16;

/** Tamanho do hash derivado, em bytes. */
export const TAMANHO_DO_HASH = 64;

/**
 * Exigência de memória do scrypt: `128 * N * r` bytes, com folga para o
 * `maxmem` — 32 MiB usados contra o limite de 64 MiB. Sem esta declaração, o
 * Node recusaria os parâmetros, porque o padrão dele é menor.
 */
const MEMORIA_MAXIMA = 64 * 1024 * 1024;

/** Os parâmetros versionados da derivação, gravados em JSON com o hash. */
const PARAMETROS = {
  algoritmo: "scrypt",
  entrada: "hmac-sha256",
  N: 32768,
  r: 8,
  p: 1,
  tamanhoDoHash: TAMANHO_DO_HASH,
} as const;

/** O que a derivação produz: o sal, o hash e os parâmetros que os explicam. */
export interface DerivacaoDaSenha {
  sal: Uint8Array;
  hash: Uint8Array;
  parametros: string;
}

/** Deriva a chave com o scrypt do Node, sem bloquear o processo que atende. */
function derivarComScrypt(
  entrada: Uint8Array,
  sal: Uint8Array,
): Promise<Buffer> {
  return new Promise((resolver, recusar) => {
    scrypt(
      entrada,
      sal,
      TAMANHO_DO_HASH,
      { N: PARAMETROS.N, r: PARAMETROS.r, p: PARAMETROS.p, maxmem: MEMORIA_MAXIMA },
      (erro, chave) => {
        if (erro !== null) {
          recusar(erro);
          return;
        }

        resolver(chave);
      },
    );
  });
}

/**
 * Transforma a Senha em `sal` + `hash` + `parametros`. O segredo entra como
 * dependência explícita, e não é lido do ambiente aqui: o Module não conhece
 * `process.env`, o que permite testá-lo com um segredo descartável a cada
 * execução e mantém a leitura do ambiente num único lugar.
 *
 * Duas execuções com a **mesma** Senha produzem `sal` e `hash` diferentes,
 * porque o sal é novo a cada chamada; é isso que impede que os dados
 * armazenados revelem que duas Senhas coincidem (FR-076, SC-022).
 */
export async function derivarDaSenha(
  segredo: string,
  senha: string,
): Promise<DerivacaoDaSenha> {
  const sal = randomBytes(TAMANHO_DO_SAL);
  const entrada = createHmac("sha256", segredo).update(senha, "utf8").digest();
  const hash = await derivarComScrypt(entrada, sal);

  return {
    sal: new Uint8Array(sal),
    hash: new Uint8Array(hash),
    parametros: JSON.stringify(PARAMETROS),
  };
}
