import { rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

/**
 * Construção por armazenamento (FR-101, FR-102, FR-117, FR-120).
 *
 * Recebe exatamente `--banco=<valor>` e confere o valor contra a **tabela de
 * entradas de Adapter** abaixo: a lista de valores aceitos é derivada dela, de
 * modo que acrescentar um Adapter é acrescentar uma entrada, e a mensagem passa
 * a listá-lo sem que o texto mude. Hoje são duas: `sqlite`, o armazenamento
 * local, e `postgresql`, o da nuvem, que empacota o servidor **e** o comando de
 * migração.
 *
 * A construção **não** exige `DB_URL`: ela lê código e empacota, e o segredo só
 * é necessário para executar (FR-114).
 *
 * A validação vem **antes** de qualquer escrita: um valor ausente, em forma
 * diferente de `--banco=<valor>` ou desconhecido é recusado com código de saída
 * 1 e **nenhum artefato** produzido (FR-102, SC-040). A recusa nunca repete o
 * valor informado, nem carrega caminho, URL, senha ou cadeia de conexão
 * (FR-108).
 *
 * Com valor aceito, **apenas a entrada escolhida** entra no grafo do
 * empacotamento: o Adapter do outro armazenamento e a sua dependência ficam
 * fora do pacote (FR-120), o que também é a razão de não haver "início sem
 * parâmetro" — o pacote de um armazenamento não entregue simplesmente não
 * existe.
 */

/**
 * Tabela de entradas de Adapter: cada valor aceito aponta para os pacotes que
 * monta, e cada pacote para a raiz de composição empacotada. O `sqlite` tem uma
 * entrada — o início local —; o `postgresql` tem duas — o início da nuvem e o
 * comando de migração —, e nenhuma das entradas de um armazenamento aparece no
 * pacote do outro (FR-117, FR-120).
 */
const ENTRADAS = {
  sqlite: {
    pacotes: [{ entrada: "src/entradas/local.ts", arquivo: "servidor.mjs" }],
  },
  postgresql: {
    pacotes: [
      { entrada: "src/entradas/nuvem.ts", arquivo: "servidor.mjs" },
      { entrada: "src/entradas/migrar-nuvem.ts", arquivo: "migrar.mjs" },
    ],
    /**
     * `pg-native` é a dependência **opcional** do `pg` que nunca é usada: o
     * empacotamento não tenta resolvê-la, e ela não entra no pacote.
     */
    externos: ["pg-native"],
  },
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
 * Empacota uma entrada num único arquivo ESM: plataforma `node`, alvo `node24` e
 * os módulos embutidos do Node externos ao pacote, mais os externos do
 * armazenamento — só o `pg-native` que nunca é usado. Uma falha do
 * empacotamento não deixa artefato parcial.
 */
async function empacotarPacote(banco, pacote) {
  const destino = join(DIRETORIO_DE_SAIDA, banco);
  const arquivo = join(destino, pacote.arquivo);

  try {
    await build({
      entryPoints: [join(RAIZ_DO_BACKEND, pacote.entrada)],
      outfile: arquivo,
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node24",
      external: ["node:*", ...(ENTRADAS[banco].externos ?? [])],
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

    return false;
  }

  return true;
}

/**
 * Empacota **todos** os pacotes do armazenamento escolhido. Uma falha em
 * qualquer um deles remove o diretório do armazenamento inteiro: nenhum
 * artefato parcial fica de pé.
 */
async function empacotar(banco) {
  const arquivos = [];

  for (const pacote of ENTRADAS[banco].pacotes) {
    if (!(await empacotarPacote(banco, pacote))) {
      return;
    }

    arquivos.push(
      relative(RAIZ_DO_BACKEND, join(DIRETORIO_DE_SAIDA, banco, pacote.arquivo)),
    );
  }

  console.log(
    `Construção concluída para o armazenamento ${banco}: ${arquivos.join(", ")}.`,
  );
}

const banco = armazenamentoEscolhido(process.argv.slice(2));

if (banco === null) {
  console.error(CONSTRUCAO_RECUSADA);
  process.exitCode = 1;
} else {
  await empacotar(banco);
}
