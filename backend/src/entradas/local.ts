import { criarAcervo } from "../acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../armazenamento/sqlite/armazenamento.ts";
import { iniciarServidor } from "../http/servidor.ts";

/**
 * Raiz de composição da execução local (FR-109).
 *
 * É o único lugar do programa que importa um Adapter da Porta: a escolha do
 * armazenamento acontece **uma vez**, no início do processo, e todo o resto
 * conhece apenas `ArmazenamentoDoAcervo` (FR-100, SC-043). A
 * `010-postgresql-na-nuvem` acrescenta a entrada da nuvem ao lado desta, e
 * nenhum Module muda.
 *
 * Nada de regra de domínio vive aqui: o `Acervo` as garante pela sua Interface,
 * e o Adapter HTTP as expõe conforme o contrato. O caminho do arquivo local é
 * configurável por `CAMINHO_DO_BANCO`, com o padrão `memorizacao.sqlite`
 * preservado (FR-103); a porta, por `PORTA` (padrão 3001). Nenhuma variável de
 * ambiente escolhe armazenamento: quem escolhe é a construção.
 */

/**
 * A única linha de início: nomeia o **tipo** do armazenamento em uso, e nada
 * além dele — nunca o caminho do arquivo, uma URL ou um segredo (FR-108,
 * SC-042). Na nuvem, a mesma linha dirá `Armazenamento: PostgreSQL (nuvem)`.
 */
const LINHA_DE_INICIO = "Armazenamento: SQLite (arquivo local)";

/**
 * Falha do armazenamento no início. A frase é do processo, em português, e não
 * repete o caminho informado nem nada do driver (FR-108): o arquivo
 * indisponível aparece como falha reportada, e a aplicação **não** segue como
 * se o armazenamento existisse (FR-044, FR-045).
 */
const FALHA_NO_INICIO =
  "Falha no armazenamento local: não foi possível abrir o arquivo configurado. " +
  "A aplicação não foi iniciada.";

/** Abre o Adapter local; a falha do arquivo é reportada e interrompe o início. */
async function abrirArmazenamentoLocal(): Promise<ArmazenamentoSqliteAberto | null> {
  try {
    return await abrirArmazenamentoSqlite(
      process.env.CAMINHO_DO_BANCO ?? "memorizacao.sqlite",
    );
  } catch {
    /**
     * Nem o caminho informado nem o texto do driver saem na mensagem: a
     * operação não passa por concluída e a aplicação não escuta.
     */
    console.error(FALHA_NO_INICIO);
    process.exitCode = 1;

    return null;
  }
}

const aberto = await abrirArmazenamentoLocal();

if (aberto !== null) {
  const acervo = criarAcervo(aberto.armazenamento);

  console.log(LINHA_DE_INICIO);

  await iniciarServidor(process.env, acervo);
}
