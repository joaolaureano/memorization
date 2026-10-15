import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

/**
 * Construção por armazenamento (FR-101, FR-102, FR-117, FR-120).
 *
 * Recebe exatamente `--banco=<valor>` e confere o valor contra a **tabela de
 * entradas de Adapter** abaixo: a lista de valores aceitos é derivada dela, de
 * modo que acrescentar um Adapter é acrescentar uma entrada, e a mensagem passa
 * a listá-lo sem que o texto mude. Hoje são três: `sqlite`, o armazenamento
 * local; `postgresql`, o da nuvem, que empacota o servidor **e** o comando de
 * migração; e `lambda`, a Função da nuvem, que empacota a entrada da função e
 * mais o zip que a infraestrutura publica (FR-130).
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
 * comando de migração —; o `lambda` tem uma — a entrada da função —, e nenhuma
 * das entradas de um armazenamento aparece no pacote do outro (FR-117, FR-120,
 * FR-130).
 */
/**
 * Pasta de dados da demonstração (R3, R13): `creditos.json` e a mídia das
 * Bandeiras e dos Pássaros. Copiada para `demonstracao/` ao lado de cada pacote
 * executável, de modo que o runtime a encontre **relativa ao próprio bundle**:
 * o pacote é ESM e o código resolve `new URL("./demonstracao/", import.meta.url)`.
 * Assim a localização não depende do diretório de trabalho — no Lambda o
 * `lambda.mjs` fica na raiz do zip (`/var/task/`), e no local o pacote fica em
 * `dist/<armazenamento>/`. Quem roda o código-fonte (`src/`, via `tsx`) resolve
 * a pasta a partir de `src/`, e não a partir do pacote.
 */
const NOME_DA_DEMONSTRACAO = "demonstracao";

const ENTRADAS = {
  sqlite: {
    pacotes: [{ entrada: "src/entradas/local.ts", arquivo: "servidor.mjs" }],
    demonstracao: true,
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
    demonstracao: true,
  },
  lambda: {
    pacotes: [{ entrada: "src/entradas/lambda.ts", arquivo: "lambda.mjs" }],
    demonstracao: true,
    /**
     * O SDK da AWS v3 vem **no runtime** `nodejs24.x` e é externo: empacotá-lo
     * engordaria o zip e duplicaria o que o runtime já traz (FR-130).
     * Inclui o S3 e as duas bibliotecas de assinatura das Imagens (`026`),
     * conferidas em `/var/runtime/node_modules/@aws-sdk` da imagem oficial.
     */
    externos: ["pg-native", "@aws-sdk/*"],
    /**
     * A função também vira zip, no caminho que a infraestrutura espera. O
     * `handler` publicado é `lambda.handler`, que nomeia o **arquivo**
     * `lambda.mjs`: por isso ele vai na **raiz** do zip.
     */
    zip: "dist-lambda.zip",
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
 * armazenamento — o `pg-native` que nunca é usado e, na função, o SDK da AWS
 * que o runtime fornece. Uma falha do empacotamento não deixa artefato parcial.
 */
async function empacotarPacote(banco, pacote) {
  const destino = join(DIRETORIO_DE_SAIDA, banco);
  const arquivo = join(destino, pacote.arquivo);

  try {
    mkdirSync(destino, { recursive: true });
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
 * Zipa o pacote da função no caminho que a infraestrutura espera, com os
 * arquivos na **raiz** do zip: o `handler` publicado (`lambda.handler`) nomeia
 * o arquivo `lambda.mjs`, e é a ferramenta `zip` da máquina que entrega isso, a
 * partir do diretório do alvo. Uma falha remove o diretório **e** o zip:
 * nenhum artefato parcial fica de pé.
 */
function zipar(diretorioDoAlvo, nomesDosArquivos, caminhoDoZip) {
  /** `-r` leva a pasta `demonstracao/` inteira, com os seus subdiretórios. */
  const resultado = spawnSync(
    "zip",
    ["-q", "-X", "-r", caminhoDoZip, ...nomesDosArquivos],
    { cwd: diretorioDoAlvo },
  );

  if (resultado.error !== undefined || resultado.status !== 0) {
    rmSync(diretorioDoAlvo, { recursive: true, force: true });
    rmSync(caminhoDoZip, { force: true });
    console.error(FALHA_AO_EMPACOTAR);
    process.exitCode = 1;

    return false;
  }

  return true;
}

/**
 * Copia `backend/demonstracao/` para ao lado dos pacotes do armazenamento. Uma
 * falha remove o diretório dele, como qualquer outra falha de empacotamento.
 */
function copiarDemonstracao(banco) {
  const destino = join(DIRETORIO_DE_SAIDA, banco, NOME_DA_DEMONSTRACAO);

  try {
    cpSync(join(RAIZ_DO_BACKEND, NOME_DA_DEMONSTRACAO), destino, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  } catch {
    rmSync(join(DIRETORIO_DE_SAIDA, banco), { recursive: true, force: true });
    console.error(FALHA_AO_EMPACOTAR);
    process.exitCode = 1;

    return false;
  }

  return true;
}

/**
 * Empacota **todos** os pacotes do armazenamento escolhido — e, quando o alvo
 * também vira zip, zipa o resultado. Uma falha em qualquer passo remove o
 * diretório do armazenamento e o zip: nenhum artefato parcial fica de pé.
 */
async function empacotar(banco) {
  const { pacotes, zip, demonstracao } = ENTRADAS[banco];
  const arquivos = [];

  /**
   * O zip de uma construção anterior não sobrevive a esta: o que falhar não
   * deixa rastro.
   */
  if (zip !== undefined) {
    rmSync(join(RAIZ_DO_BACKEND, zip), { force: true });
  }

  for (const pacote of pacotes) {
    if (!(await empacotarPacote(banco, pacote))) {
      return;
    }

    arquivos.push(
      relative(RAIZ_DO_BACKEND, join(DIRETORIO_DE_SAIDA, banco, pacote.arquivo)),
    );
  }

  const nomesDosArquivos = pacotes.map((pacote) => pacote.arquivo);

  if (demonstracao === true) {
    if (!copiarDemonstracao(banco)) {
      return;
    }

    nomesDosArquivos.push(NOME_DA_DEMONSTRACAO);
    arquivos.push(
      relative(
        RAIZ_DO_BACKEND,
        join(DIRETORIO_DE_SAIDA, banco, NOME_DA_DEMONSTRACAO),
      ),
    );
  }

  if (zip !== undefined) {
    const zipado = zipar(
      join(DIRETORIO_DE_SAIDA, banco),
      nomesDosArquivos,
      join(RAIZ_DO_BACKEND, zip),
    );

    if (!zipado) {
      return;
    }

    arquivos.push(zip);
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
