// Module demonstracao — midia (030, research R2/R3/R7/R8).

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import type { ArmazemDeMidia } from "../midia/armazem.ts";

export {
  ehMidiaDeDemonstracao,
  PREFIXO_DE_DEMONSTRACAO,
} from "../midia/armazem.ts";

/** Uma Mídia fixa do Acervo de demonstração: chave, arquivo e tipo. */
export interface ArquivoDeDemonstracao {
  /** Chave no `ArmazemDeMidia`, sempre sob `demonstracao/`. */
  chave: string;
  /** Caminho do arquivo, relativo à pasta `demonstracao/`. */
  caminho: string;
  tipoDeConteudo: string;
}

/**
 * Os arquivos das duas Mídias de demonstração. Os bytes ficam em
 * `backend/demonstracao/midia/` e são versionados já limpos (R13); os créditos
 * de cada um estão em `creditos.json`, testado contra esta lista.
 */
export const ARQUIVOS_DE_DEMONSTRACAO: ReadonlyArray<ArquivoDeDemonstracao> = [
  { chave: "demonstracao/bandeiras/brasil.png", caminho: "midia/bandeiras/brasil.png", tipoDeConteudo: "image/png" },
  { chave: "demonstracao/bandeiras/japao.png", caminho: "midia/bandeiras/japao.png", tipoDeConteudo: "image/png" },
  { chave: "demonstracao/bandeiras/canada.png", caminho: "midia/bandeiras/canada.png", tipoDeConteudo: "image/png" },
  { chave: "demonstracao/bandeiras/alemanha.png", caminho: "midia/bandeiras/alemanha.png", tipoDeConteudo: "image/png" },
  { chave: "demonstracao/bandeiras/italia.png", caminho: "midia/bandeiras/italia.png", tipoDeConteudo: "image/png" },
  { chave: "demonstracao/bandeiras/argentina.png", caminho: "midia/bandeiras/argentina.png", tipoDeConteudo: "image/png" },
  { chave: "demonstracao/bandeiras/india.png", caminho: "midia/bandeiras/india.png", tipoDeConteudo: "image/png" },
  { chave: "demonstracao/bandeiras/quenia.png", caminho: "midia/bandeiras/quenia.png", tipoDeConteudo: "image/png" },
  { chave: "demonstracao/bandeiras/suecia.png", caminho: "midia/bandeiras/suecia.png", tipoDeConteudo: "image/png" },
  { chave: "demonstracao/bandeiras/mexico.png", caminho: "midia/bandeiras/mexico.png", tipoDeConteudo: "image/png" },
  { chave: "demonstracao/passaros/sabia-laranjeira.mp3", caminho: "midia/passaros/sabia-laranjeira.mp3", tipoDeConteudo: "audio/mpeg" },
  { chave: "demonstracao/passaros/bem-te-vi.mp3", caminho: "midia/passaros/bem-te-vi.mp3", tipoDeConteudo: "audio/mpeg" },
  { chave: "demonstracao/passaros/joao-de-barro.mp3", caminho: "midia/passaros/joao-de-barro.mp3", tipoDeConteudo: "audio/mpeg" },
  { chave: "demonstracao/passaros/tico-tico.mp3", caminho: "midia/passaros/tico-tico.mp3", tipoDeConteudo: "audio/mpeg" },
  { chave: "demonstracao/passaros/corruira.mp3", caminho: "midia/passaros/corruira.mp3", tipoDeConteudo: "audio/mpeg" },
  { chave: "demonstracao/passaros/pomba-asa-branca.mp3", caminho: "midia/passaros/pomba-asa-branca.mp3", tipoDeConteudo: "audio/mpeg" },
  { chave: "demonstracao/passaros/seriema.mp3", caminho: "midia/passaros/seriema.mp3", tipoDeConteudo: "audio/mpeg" },
  { chave: "demonstracao/passaros/cambacica.mp3", caminho: "midia/passaros/cambacica.mp3", tipoDeConteudo: "audio/mpeg" },
  { chave: "demonstracao/passaros/tiziu.mp3", caminho: "midia/passaros/tiziu.mp3", tipoDeConteudo: "audio/mpeg" },
  { chave: "demonstracao/passaros/anu-branco.mp3", caminho: "midia/passaros/anu-branco.mp3", tipoDeConteudo: "audio/mpeg" },
];

/** Os lugares possíveis da pasta `demonstracao/`: ao lado do bundle, ou em `backend/` quando roda de `src/`. */
const LUGARES_DA_PASTA: readonly URL[] = [
  new URL("./demonstracao/", import.meta.url),
  new URL("../../demonstracao/", import.meta.url),
];

/** A pasta `demonstracao/` que existe nesta execução (o build copia a pasta ao lado do pacote). */
export function pastaDaDemonstracao(): URL {
  const achada = LUGARES_DA_PASTA.find((lugar) => existsSync(lugar));
  if (achada === undefined) {
    throw new Error("Pasta demonstracao/ não encontrada.");
  }
  return achada;
}

/**
 * Garante que as Mídias fixas estão no armazém: mede cada chave, e grava as
 * que medem zero bytes, lendo os bytes da pasta. Memoizada por instância de
 * armazém, para que um processo não releia nem regrave a cada Conta de teste.
 * Se a gravação falhar, a memória é descartada e a próxima chamada tenta de novo.
 */
const memoria = new WeakMap<ArmazemDeMidia, Promise<void>>();

export function garantirMidiaDeDemonstracao(armazem: ArmazemDeMidia): Promise<void> {
  let pronta = memoria.get(armazem);
  if (pronta === undefined) {
    pronta = gravarQueFalta(armazem);
    memoria.set(armazem, pronta);
    pronta.catch(() => memoria.delete(armazem));
  }
  return pronta;
}

async function gravarQueFalta(armazem: ArmazemDeMidia): Promise<void> {
  const pasta = pastaDaDemonstracao();
  for (const arquivo of ARQUIVOS_DE_DEMONSTRACAO) {
    const tamanho = await armazem.medir([arquivo.chave]);
    if (tamanho > 0) continue;
    const bytes = new Uint8Array(await readFile(new URL(arquivo.caminho, pasta)));
    await armazem.gravarArquivoFixo(arquivo.chave, bytes, arquivo.tipoDeConteudo);
  }
}
