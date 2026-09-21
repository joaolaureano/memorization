import { criarAcervo } from "./acervo/acervo.ts";
import { abrirArmazenamentoSqlite } from "./armazenamento/sqlite/armazenamento.ts";
import { iniciarServidor } from "./http/servidor.ts";

/**
 * Ponto de entrada da API. É a raiz de composição da execução local: abre o
 * Adapter do armazenamento local, monta o `Acervo` sobre a Porta e sobe o
 * servidor HTTP. Nenhuma regra de domínio vive aqui: o `Acervo` as garante
 * pela sua Interface, e o Adapter HTTP as expõe conforme o contrato.
 *
 * Só a raiz de composição importa um Adapter — nenhum Module conhece, nomeia
 * ou importa armazenamento concreto (FR-100). O caminho do arquivo SQLite é
 * configurável por `CAMINHO_DO_BANCO`, com padrão utilizável sem configurar
 * nada; a porta, por `PORTA` (padrão 3001).
 */
const { armazenamento } = await abrirArmazenamentoSqlite(
  process.env.CAMINHO_DO_BANCO ?? "memorizacao.sqlite",
);
const acervo = criarAcervo(armazenamento);

await iniciarServidor(process.env, acervo);
