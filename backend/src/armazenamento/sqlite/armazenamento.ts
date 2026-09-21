import type { DatabaseSync } from "node:sqlite";

import type {
  ArmazenamentoDoAcervo,
  Baralho,
  Cartao,
  ContagemPorBaralho,
  Desfecho,
} from "../porta.ts";
import { abrirBanco } from "./esquema.ts";

/**
 * Adapter da Porta `ArmazenamentoDoAcervo` sobre SQLite em arquivo local.
 *
 * Este é o Adapter da execução local (FR-103), e ele é o **dono do esquema e
 * das migrações** do seu dialeto: `esquema.ts` e `migracoes.ts` vivem ao lado
 * dele, e nenhum SQL atravessa o domínio (FR-100).
 *
 * **Nada do SQLite atravessa a Interface**: o erro do driver vira desfecho
 * tipado — linha ausente é `nao_encontrado`, o par de Vínculo repetido é
 * `vinculo_duplicado` e qualquer outra falha é `indisponivel` (FR-107) —, e é
 * por isso que uma mensagem do driver, com caminho de arquivo ou qualquer
 * outra credencial, nunca chega ao chamador (FR-108).
 *
 * A API do `node:sqlite` é síncrona; cada operação da Porta devolve `Promise`
 * porque a Interface é uma só para todos os Adapters, e o driver da nuvem não
 * tem caminho síncrono.
 */

/**
 * O armazenamento local aberto: a Porta e o encerramento da conexão.
 *
 * O ciclo de vida é da fábrica do Adapter, e não da Porta: a Interface que os
 * Modules conhecem não abre nem fecha armazenamento.
 */
export interface ArmazenamentoSqliteAberto {
  armazenamento: ArmazenamentoDoAcervo;
  /** Encerra a conexão com o arquivo. O conteúdo gravado permanece nele. */
  encerrar(): Promise<void>;
}

/** Desfecho de falha do armazenamento — o único caminho da indisponibilidade. */
const FALHA_INDISPONIVEL: Desfecho<never> = {
  ok: false,
  erro: "indisponivel",
};

/** Desfecho de ausência de linha a ler, a alterar ou a excluir. */
const NAO_ENCONTRADO: Desfecho<never> = {
  ok: false,
  erro: "nao_encontrado",
};

/** Desfecho do par (Cartão, Baralho) repetido. */
const VINCULO_DUPLICADO: Desfecho<never> = {
  ok: false,
  erro: "vinculo_duplicado",
};

/** Desfecho de sucesso sem carga: exclusão, Vínculo e desvínculo. */
const SEM_CARGA: Desfecho<void> = { ok: true, valor: undefined };

/**
 * Executa a operação e traduz a falha do SQLite em `indisponivel`.
 *
 * Nada mais do driver passa: nem o código, nem a mensagem, nem o caminho do
 * arquivo que eventualmente a acompanhe (FR-107, FR-108).
 */
function comDesfecho<T>(operacao: () => Desfecho<T>): Desfecho<T> {
  try {
    return operacao();
  } catch {
    return FALHA_INDISPONIVEL;
  }
}

/**
 * Reconhece a violação de chave primária composta da tabela `vinculo`. O
 * SQLite entrega `errcode` 1555 (SQLITE_CONSTRAINT_PRIMARYKEY) quando o par
 * repetido é inserido; qualquer outro erro é falha do armazenamento.
 */
function ehVinculoDuplicado(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) {
    return false;
  }

  const candidato = erro as { code?: unknown; errcode?: unknown };

  return candidato.code === "ERR_SQLITE_ERROR" && candidato.errcode === 1555;
}

/** Lê a linha como Cartão, sem deixar a forma do driver atravessar a Porta. */
function cartaoDaLinha(linha: Record<string, unknown>): Cartao {
  return {
    id: linha.id as string,
    frente: linha.frente as string,
    verso: linha.verso as string,
  };
}

/** Lê a linha como Baralho, sem deixar a forma do driver atravessar a Porta. */
function baralhoDaLinha(linha: Record<string, unknown>): Baralho {
  return {
    id: linha.id as string,
    nome: linha.nome as string,
  };
}

/**
 * Abre o arquivo SQLite informado — `":memory:"` nos testes —, aplica as
 * migrações pendentes e devolve a Porta mais o encerramento da conexão.
 *
 * Migrar na abertura é o que faz uma base instalada continuar servindo: a
 * versão registrada continua a mesma, as migrações já aplicadas nunca rodam de
 * novo e as pendentes são aplicadas como antes (FR-103, FR-104).
 */
export async function abrirArmazenamentoSqlite(
  caminho: string,
): Promise<ArmazenamentoSqliteAberto> {
  const banco: DatabaseSync = abrirBanco(caminho);

  const inserirCartao = banco.prepare(
    "INSERT INTO cartao (id, frente, verso) VALUES (?, ?, ?)",
  );
  const listarCartoes = banco.prepare("SELECT id, frente, verso FROM cartao");
  const obterCartaoPorId = banco.prepare(
    "SELECT id, frente, verso FROM cartao WHERE id = ?",
  );
  const atualizarCartao = banco.prepare(
    "UPDATE cartao SET frente = ?, verso = ? WHERE id = ?",
  );
  const excluirCartao = banco.prepare("DELETE FROM cartao WHERE id = ?");

  const inserirBaralho = banco.prepare(
    "INSERT INTO baralho (id, nome) VALUES (?, ?)",
  );
  const listarBaralhos = banco.prepare("SELECT id, nome FROM baralho");
  const obterBaralhoPorId = banco.prepare(
    "SELECT id, nome FROM baralho WHERE id = ?",
  );
  const atualizarBaralho = banco.prepare(
    "UPDATE baralho SET nome = ? WHERE id = ?",
  );
  const excluirBaralho = banco.prepare("DELETE FROM baralho WHERE id = ?");

  const inserirVinculo = banco.prepare(
    "INSERT INTO vinculo (cartao_id, baralho_id) VALUES (?, ?)",
  );
  const removerVinculo = banco.prepare(
    "DELETE FROM vinculo WHERE cartao_id = ? AND baralho_id = ?",
  );
  const listarBaralhosDoCartao = banco.prepare(
    `SELECT baralho.id, baralho.nome
       FROM vinculo
       JOIN baralho ON baralho.id = vinculo.baralho_id
      WHERE vinculo.cartao_id = ?`,
  );
  const listarCartoesDoBaralho = banco.prepare(
    `SELECT cartao.id, cartao.frente, cartao.verso
       FROM vinculo
       JOIN cartao ON cartao.id = vinculo.cartao_id
      WHERE vinculo.baralho_id = ?`,
  );
  const contarCartoesPorBaralho = banco.prepare(
    `SELECT baralho.id AS baralhoId,
            COUNT(vinculo.cartao_id) AS quantidadeDeCartoes
       FROM baralho
       LEFT JOIN vinculo ON vinculo.baralho_id = baralho.id
      GROUP BY baralho.id`,
  );

  const armazenamento: ArmazenamentoDoAcervo = {
    async inserirCartao(cartao) {
      return comDesfecho(() => {
        inserirCartao.run(cartao.id, cartao.frente, cartao.verso);

        return { ok: true, valor: cartao };
      });
    },

    async listarCartoes() {
      return listarCartoes.all().map(cartaoDaLinha);
    },

    async obterCartao(id) {
      return comDesfecho(() => {
        const linha = obterCartaoPorId.get(id);

        return linha === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: cartaoDaLinha(linha) };
      });
    },

    async atualizarCartao(cartao) {
      return comDesfecho(() => {
        const alteradas = atualizarCartao.run(
          cartao.frente,
          cartao.verso,
          cartao.id,
        );

        return Number(alteradas.changes) === 0
          ? NAO_ENCONTRADO
          : { ok: true, valor: cartao };
      });
    },

    async excluirCartao(id) {
      return comDesfecho(() =>
        Number(excluirCartao.run(id).changes) === 0 ? NAO_ENCONTRADO : SEM_CARGA,
      );
    },

    async inserirBaralho(baralho) {
      return comDesfecho(() => {
        inserirBaralho.run(baralho.id, baralho.nome);

        return { ok: true, valor: baralho };
      });
    },

    async listarBaralhos() {
      return listarBaralhos.all().map(baralhoDaLinha);
    },

    async obterBaralho(id) {
      return comDesfecho(() => {
        const linha = obterBaralhoPorId.get(id);

        return linha === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: baralhoDaLinha(linha) };
      });
    },

    async atualizarBaralho(baralho) {
      return comDesfecho(() => {
        const alteradas = atualizarBaralho.run(baralho.nome, baralho.id);

        return Number(alteradas.changes) === 0
          ? NAO_ENCONTRADO
          : { ok: true, valor: baralho };
      });
    },

    async excluirBaralho(id) {
      return comDesfecho(() =>
        Number(excluirBaralho.run(id).changes) === 0 ? NAO_ENCONTRADO : SEM_CARGA,
      );
    },

    async vincular(cartaoId, baralhoId) {
      return comDesfecho(() => {
        /**
         * Extremidade inexistente é ausência de linha, e não falha: é a mesma
         * regra de `nao_encontrado` das outras operações. Sem esta conferência,
         * a chave estrangeira do esquema apareceria como erro do driver.
         */
        if (
          obterCartaoPorId.get(cartaoId) === undefined ||
          obterBaralhoPorId.get(baralhoId) === undefined
        ) {
          return NAO_ENCONTRADO;
        }

        try {
          inserirVinculo.run(cartaoId, baralhoId);
        } catch (erro) {
          if (ehVinculoDuplicado(erro)) {
            return VINCULO_DUPLICADO;
          }

          throw erro;
        }

        return SEM_CARGA;
      });
    },

    async desvincular(cartaoId, baralhoId) {
      return comDesfecho(() =>
        Number(removerVinculo.run(cartaoId, baralhoId).changes) === 0
          ? NAO_ENCONTRADO
          : SEM_CARGA,
      );
    },

    async listarBaralhosDoCartao(cartaoId) {
      return listarBaralhosDoCartao.all(cartaoId).map(baralhoDaLinha);
    },

    async listarCartoesDoBaralho(baralhoId) {
      return listarCartoesDoBaralho.all(baralhoId).map(cartaoDaLinha);
    },

    async contarCartoesPorBaralho() {
      const contagens: ContagemPorBaralho[] = contarCartoesPorBaralho.all().map(
        (linha) => ({
          baralhoId: linha.baralhoId as string,
          quantidadeDeCartoes: Number(linha.quantidadeDeCartoes),
        }),
      );

      return contagens;
    },
  };

  return {
    armazenamento,

    async encerrar() {
      banco.close();
    },
  };
}
