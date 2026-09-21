import { criarAcervo } from "./acervo/acervo.ts";
import { abrirBanco } from "./acervo/esquema.ts";
import { iniciarServidor } from "./http/servidor.ts";

/**
 * Ponto de entrada da API. Compõe o banco SQLite local, o Module `Acervo` e
 * o servidor HTTP. Nenhuma regra de domínio vive aqui: o `Acervo` as garante
 * pela sua Interface, e o Adapter HTTP as expõe conforme o contrato.
 *
 * O caminho do arquivo SQLite é configurável por `CAMINHO_DO_BANCO`, com
 * padrão utilizável sem configurar nada; a porta, por `PORTA` (padrão 3001).
 */
const banco = abrirBanco(
  process.env.CAMINHO_DO_BANCO ?? "memorizacao.sqlite",
);
const acervo = criarAcervo(banco);

await iniciarServidor(process.env, acervo);
