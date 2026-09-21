import { rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

/**
 * Construção por armazenamento (FR-101, FR-102, FR-120).
 *
 * Recebe exatamente `--banco=<valor>` e confere o valor contra a **tabela de
 * entradas de Adapter** abaixo: a lista de valores aceitos é derivada dela, de
 * modo que acrescentar um Adapter é acrescentar uma entrada, e a mensagem passa
 * a listá-lo sem que o texto mude. Nesta feature só existe o armazenamento
 * local; `postgresql` é recusado como não aceito até a
 * `010-postgresql-na-nuvem` acrescentar a sua entrada.
 *
 * A validação vem **antes** de qualquer escrita: um valor ausente, em forma
 * diferente de `--banco=<valor>`, desconhecido ou ainda não entregue é
 * recusado com código de saída 1 e **nenhum artefato** produzido (FR-102,
 * SC-040). A recusa nunca repete o valor informado, nem carrega caminho, URL,
 * senha ou cadeia de conexão (FR-108).
 *
 * Com valor aceito, **apenas a entrada escolhida** entra no grafo do
 * empacotamento: o Adapter do outro armazenamento e a sua dependência ficam
 * fora do pacote (FR-120), o que também é a razão de não haver "início sem
 * parâmetro" — o pacote de um armazenamento não entregue simplesmente não
 * existe.
 */

/**
 * Tabela de entradas de Adapter: cada valor aceito aponta para a raiz de
 * composição que monta aquele armazenamento. Nesta feature há uma só entrada.
 */
const ENTRADAS = {
  sqlite: "src/entradas/local.ts",
};

const RAIZ_DO_BACKEND = dirname(dirname(fileURLToPath(import.meta.url)));

/** Pasta dos pacotes construídos, ignorada pelo Git. */
const DIRETORIO_DE_SAIDA = join(RAIZ_DO_BACKEND, "dist");

/** Forma aceita do parâmetro de construção. */
const PARAMETRO = "--banco=";

/** Os valores aceitos, derivados da tabela: acrescentar Adapter é acrescentar entrada. */
const VALORES_ACEITOS = Object.keys(ENTRADAS).join(", ");

const CONSTRUCAO_RECUSADA =
  `Construção recusada. Informe ${PARAMETRO}<valor>, com um dos valores ` +
  `aceitos: ${VALORES_ACEITOS}.`;

const FALHA_AO_EMPACOTAR =
  "Falha ao empacotar o armazenamento escolhido. Nenhum artefato foi produzido.";

/**
 * O armazenamento escolhido na linha de comando, ou `null` quando a forma ou o
 * valor não são aceitos. Nunca devolve nem imprime o valor informado.
 */
function armazenamentoEscolhido(argumentos) {
  if (argumentos.length !== 1) {
    return null;
  }

  const [argumento] = argumentos;

  if (!argumento.startsWith(PARAMETRO)) {
    return null;
  }

  const valor = argumento.slice(PARAMETRO.length);

  return Object.hasOwn(ENTRADAS, valor) ? valor : null;
}

/**
 * Empacota a entrada escolhida num único arquivo ESM: plataforma `node`, alvo
 * `node24` e os módulos embutidos do Node externos ao pacote. Uma falha do
 * empacotamento não deixa artefato parcial.
 */
async function empacotar(banco) {
  const destino = join(DIRETORIO_DE_SAIDA, banco);
  const arquivo = join(destino, "servidor.mjs");

  try {
    await build({
      entryPoints: [join(RAIZ_DO_BACKEND, ENTRADAS[banco])],
      outfile: arquivo,
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node24",
      external: ["node:*"],
      /**
       * As dependências em CJS pedem os módulos embutidos por `require`; num
       * pacote ESM isso precisa de um `require` de verdade. Nenhum caminho,
       * nenhuma URL e nenhum segredo entra aqui: é só o require do runtime.
       */
      banner: {
        js: 'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);',
      },
    });
  } catch {
    rmSync(destino, { recursive: true, force: true });
    console.error(FALHA_AO_EMPACOTAR);
    process.exitCode = 1;

    return;
  }

  console.log(
    `Construção concluída para o armazenamento ${banco}: ` +
      `${relative(RAIZ_DO_BACKEND, arquivo)}.`,
  );
}

const banco = armazenamentoEscolhido(process.argv.slice(2));

if (banco === null) {
  console.error(CONSTRUCAO_RECUSADA);
  process.exitCode = 1;
} else {
  await empacotar(banco);
}
