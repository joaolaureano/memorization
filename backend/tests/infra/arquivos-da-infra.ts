import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * O apoio das conferências estáticas da hospedagem: ler **arquivos
 * versionados** e recortar blocos deles, sem AWS, sem rede e sem `apply`.
 *
 * A hospedagem tem partes que só se provam depois de publicar — o p95 medido na
 * função, o comportamento do Parameter Store em execução. O que estes testes
 * provam é o que **está escrito**: o que o código de infraestrutura e o manual
 * declaram hoje, e que a spec exige.
 */

/** A raiz do repositório, de onde `backend/` e `specs/` pendem. */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** A raiz do backend, de onde pendem `src/` e `terraform/`. */
export const BACKEND = join(RAIZ, "backend");

/** O diretório do código de infraestrutura. */
export const TERRAFORM = join(BACKEND, "terraform");

/** O diretório da especificação desta feature. */
export const SPEC = join(RAIZ, "specs", "011-hospedagem-aws");

/** O conteúdo de um arquivo versionado, como texto. */
export function ler(caminho: string): string {
  return readFileSync(caminho, "utf8");
}

/**
 * O corpo de um bloco, do `{` do cabeçalho até o `}` que o fecha, contando a
 * profundidade: o mapa de segredos e as policies de IAM têm bloco dentro de
 * bloco, e um recorte por expressão regular pararia no primeiro `}`.
 */
export function bloco(fonte: string, cabecalho: RegExp): string {
  const achado = cabecalho.exec(fonte);

  if (achado === null) {
    throw new Error(`bloco não encontrado: ${String(cabecalho)}`);
  }

  const abertura = fonte.indexOf("{", achado.index);
  let profundidade = 0;

  for (let posicao = abertura; posicao < fonte.length; posicao += 1) {
    if (fonte[posicao] === "{") {
      profundidade += 1;
    } else if (fonte[posicao] === "}") {
      profundidade -= 1;

      if (profundidade === 0) {
        return fonte.slice(abertura + 1, posicao);
      }
    }
  }

  throw new Error(`bloco sem fechamento: ${String(cabecalho)}`);
}

/**
 * O valor atribuído a uma chave — `chave = ...` no HCL, `chave: ...` no
 * TypeScript —, sem o separador e sem a vírgula final. A ausência da chave é
 * erro, e não um `undefined` que passaria por acaso numa conferência.
 */
export function valorDe(fonte: string, chave: string): string {
  const achado = new RegExp(`\\b${chave}\\s*[:=]\\s*([^,\\n]+),?`).exec(fonte);

  if (achado === null) {
    throw new Error(`chave ausente: ${chave}`);
  }

  return achado[1]!.trim();
}
