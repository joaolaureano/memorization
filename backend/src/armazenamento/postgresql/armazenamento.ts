import type { Pool } from "pg";

import type {
  ArmazenamentoDoAcervo,
  ArmazenamentoDeUsuarios,
  Baralho,
  Cartao,
  ContagemPorBaralho,
  Desfecho,
  DesfechoDeInsercaoDeUsuario,
  DesfechoDeLeituraDeUsuario,
  Usuario,
} from "../porta.ts";
import { criarPiscina, type ConfiguracaoDaConexao } from "./conexao.ts";

/**
 * Adapter da Porta `ArmazenamentoDoAcervo` sobre PostgreSQL na nuvem.
 *
 * Este é o Adapter da execução da nuvem (FR-110), apontado por URL de conexão
 * pela entrada da nuvem, e ele é o **dono do esquema e das migrações** do seu
 * dialeto: `esquema.ts` e `migracoes.ts` vivem ao lado dele, e nenhum SQL
 * atravessa o domínio (FR-100). É a segunda Implementation da Porta, e é ela
 * que torna a Seam de `009` real: a **mesma** bateria compartilhada de cenários
 * roda contra ele sem uma linha de edição (FR-111, SC-044).
 *
 * **Nada do driver atravessa a Interface**: o SQLSTATE do PostgreSQL vira
 * desfecho tipado. `23505` na chave primária composta de `vinculo` é
 * `vinculo_duplicado`; `23503` — Vínculo com extremidade inexistente — e zero
 * linhas afetadas ou devolvidas são `nao_encontrado`; qualquer outra falha —
 * servidor indisponível, credencial recusada, certificado não verificável,
 * transação abortada, `CHECK` violada por erro de programação — é
 * `indisponivel`, que **nunca** significa concluído (FR-044, FR-045). Nenhum
 * campo do erro do driver — `message`, `detail`, `hint`, `where` — chega ao
 * chamador: a frase em português é do Module (FR-118).
 *
 * **Abrir não migra**: quem aplica migração é o comando de migração da nuvem, e
 * o início confere a versão e recusa iniciar quando ela está atrasada (FR-121).
 * Por isso a fábrica só abre o conjunto de conexões, e nenhuma operação dela
 * toca no esquema.
 */

/**
 * O armazenamento da nuvem aberto: a Porta e o encerramento do conjunto de
 * conexões.
 *
 * O ciclo de vida é da fábrica do Adapter, e não da Porta: a Interface que os
 * Modules conhecem não abre nem fecha armazenamento.
 */
export interface ArmazenamentoPostgresqlAberto {
  armazenamento: ArmazenamentoDoAcervo;
  /** A segunda Porta, sobre o mesmo conjunto de conexões: os Usuários. */
  usuarios: ArmazenamentoDeUsuarios;
  /** Fecha o conjunto de conexões. O conteúdo gravado permanece na base. */
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

/** Desfecho do Nome de usuário já existente, imposto pelo índice único. */
const NOME_DE_USUARIO_EXISTENTE = {
  ok: false,
  erro: "nome_de_usuario_existente",
} as const;

/** Desfecho de falha do armazenamento na Porta de Usuários. */
const USUARIO_INDISPONIVEL = { ok: false, erro: "indisponivel" } as const;

/** Desfecho de ausência de Usuário, na leitura pelo Nome de usuário. */
const USUARIO_NAO_ENCONTRADO = { ok: false, erro: "nao_encontrado" } as const;

/** SQLSTATE de unicidade violada — no Vínculo, é o par repetido (FR-020). */
const VIOLACAO_DE_UNICIDADE = "23505";

/** SQLSTATE de chave estrangeira violada — extremidade inexistente (FR-019). */
const VIOLACAO_DE_CHAVE_ESTRANGEIRA = "23503";

/**
 * Nome estável da chave primária composta de `vinculo`. O DDL é nosso, então é
 * por este nome que o Vínculo repetido — resultado de domínio — se distingue de
 * qualquer outra unicidade violada, que é falha do armazenamento.
 */
const CHAVE_PRIMARIA_DE_VINCULO = "vinculo_pkey";

/**
 * Nome estável do índice único de Nome de usuário da migração 4. É por ele que
 * o Nome de usuário repetido — resultado de domínio — se distingue de qualquer
 * outra unicidade violada, que é falha do armazenamento.
 */
const INDICE_DE_NOME_DE_USUARIO = "usuario_nome_de_usuario_unico";

const INSERIR_CARTAO = `
INSERT INTO cartao (id, frente, verso) VALUES ($1, $2, $3);
`;

const LISTAR_CARTOES = `
SELECT id, frente, verso FROM cartao;
`;

const OBTER_CARTAO = `
SELECT id, frente, verso FROM cartao WHERE id = $1;
`;

const ATUALIZAR_CARTAO = `
UPDATE cartao SET frente = $1, verso = $2 WHERE id = $3;
`;

const EXCLUIR_CARTAO = `
DELETE FROM cartao WHERE id = $1;
`;

const INSERIR_BARALHO = `
INSERT INTO baralho (id, nome) VALUES ($1, $2);
`;

const LISTAR_BARALHOS = `
SELECT id, nome FROM baralho;
`;

const OBTER_BARALHO = `
SELECT id, nome FROM baralho WHERE id = $1;
`;

const ATUALIZAR_BARALHO = `
UPDATE baralho SET nome = $1 WHERE id = $2;
`;

const EXCLUIR_BARALHO = `
DELETE FROM baralho WHERE id = $1;
`;

const INSERIR_VINCULO = `
INSERT INTO vinculo (cartao_id, baralho_id) VALUES ($1, $2);
`;

const REMOVER_VINCULO = `
DELETE FROM vinculo WHERE cartao_id = $1 AND baralho_id = $2;
`;

const LISTAR_BARALHOS_DO_CARTAO = `
SELECT baralho.id, baralho.nome
  FROM vinculo
  JOIN baralho ON baralho.id = vinculo.baralho_id
 WHERE vinculo.cartao_id = $1;
`;

const LISTAR_CARTOES_DO_BARALHO = `
SELECT cartao.id, cartao.frente, cartao.verso
  FROM vinculo
  JOIN cartao ON cartao.id = vinculo.cartao_id
 WHERE vinculo.baralho_id = $1;
`;

const CONTAR_CARTOES_POR_BARALHO = `
SELECT baralho.id AS "baralhoId",
       COUNT(vinculo.cartao_id) AS "quantidadeDeCartoes"
  FROM baralho
  LEFT JOIN vinculo ON vinculo.baralho_id = baralho.id
 GROUP BY baralho.id;
`;

const INSERIR_USUARIO = `
INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
VALUES ($1, $2, $3, $4, $5);
`;

/**
 * A leitura não distingue maiúsculas de minúsculas, e é o `lower` de ambos os
 * lados que o garante: o índice único da migração 4 é sobre
 * `lower(nome_de_usuario)`, e a consulta usa a mesma expressão, de modo que a
 * leitura e a unicidade falam da mesma coisa (FR-074).
 */
const OBTER_USUARIO_POR_NOME = `
SELECT id, nome_de_usuario, sal, hash, parametros
  FROM usuario
 WHERE lower(nome_de_usuario) = lower($1);
`;

/** Linha de `cartao` como o Adapter a lê, sem deixar a forma do driver passar. */
type LinhaDeCartao = {
  id: string;
  frente: string;
  verso: string;
};

/** Linha de `baralho` como o Adapter a lê. */
type LinhaDeBaralho = {
  id: string;
  nome: string;
};

/** Linha da contagem por Baralho; o `COUNT` do PostgreSQL chega como texto. */
type LinhaDeContagem = {
  baralhoId: string;
  quantidadeDeCartoes: string;
};

/** Linha de `usuario`; o `BYTEA` do PostgreSQL chega como `Buffer`. */
type LinhaDeUsuario = {
  id: string;
  nome_de_usuario: string;
  sal: Buffer;
  hash: Buffer;
  parametros: string;
};

/**
 * Diz se a falha é a violação informada. O SQLSTATE é a única coisa estável e
 * não sensível de um erro do driver: é um código de cinco caracteres, definido
 * pelo padrão SQL, e não carrega host, usuário, senha nem endereço (FR-118).
 */
function ehViolacao(
  erro: unknown,
  codigo: string,
  restricao?: string,
): boolean {
  if (typeof erro !== "object" || erro === null) {
    return false;
  }

  const falha = erro as { code?: unknown; constraint?: unknown };

  return (
    falha.code === codigo &&
    (restricao === undefined || falha.constraint === restricao)
  );
}

/**
 * Traduz a falha do armazenamento em desfecho tipado.
 *
 * Um `23505` que não seja o do Vínculo — `id` de Cartão ou de Baralho repetido
 * — é falha do armazenamento, exatamente como no Adapter local: lá, a violação
 * da chave primária também chega como `indisponivel`.
 */
function desfechoDaFalha(erro: unknown): Desfecho<never> {
  return ehViolacao(erro, VIOLACAO_DE_CHAVE_ESTRANGEIRA)
    ? NAO_ENCONTRADO
    : FALHA_INDISPONIVEL;
}

/**
 * Executa a operação e traduz a falha do driver em desfecho tipado.
 *
 * Nada mais do driver passa: nem o código, nem a mensagem, nem qualquer campo
 * que acompanhe o erro (FR-107, FR-118).
 */
async function comDesfecho<T>(
  operacao: () => Promise<Desfecho<T>>,
): Promise<Desfecho<T>> {
  try {
    return await operacao();
  } catch (erro) {
    return desfechoDaFalha(erro);
  }
}

/**
 * Mesma tradução da falha do driver, no vocabulário de desfecho da Porta de
 * Usuários: qualquer falha ali é `indisponivel` — não há chave estrangeira na
 * tabela `usuario`, e a unicidade violada que é resultado de domínio já foi
 * reconhecida antes de chegar ao `catch`.
 */
async function comDesfechoDeUsuario<D>(
  operacao: () => Promise<D>,
  indisponivel: D,
): Promise<D> {
  try {
    return await operacao();
  } catch {
    return indisponivel;
  }
}

/** Lê a linha como Cartão, sem deixar a forma do driver atravessar a Porta. */
function cartaoDaLinha(linha: LinhaDeCartao): Cartao {
  return { id: linha.id, frente: linha.frente, verso: linha.verso };
}

/** Lê a linha como Baralho, sem deixar a forma do driver atravessar a Porta. */
function baralhoDaLinha(linha: LinhaDeBaralho): Baralho {
  return { id: linha.id, nome: linha.nome };
}

/** Lê a linha como Usuário: o Nome de usuário e a transformação da Senha. */
function usuarioDaLinha(linha: LinhaDeUsuario): Usuario {
  return {
    id: linha.id,
    nomeDeUsuario: linha.nome_de_usuario,
    sal: linha.sal,
    hash: linha.hash,
    parametros: linha.parametros,
  };
}

/**
 * Abre o conjunto de conexões da nuvem — máximo pequeno e fixo, cifra ligada com
 * o certificado sempre verificado — e devolve a Porta mais o encerramento.
 *
 * Como em `009`, a Interface da Porta **não** ganha operação de ciclo de vida:
 * abrir e fechar são da Implementation, expostas por esta fábrica. O que esta
 * fábrica **não** faz é migrar: migração é do comando da nuvem (FR-121).
 */
export async function abrirArmazenamentoPostgresql(
  configuracao: ConfiguracaoDaConexao,
): Promise<ArmazenamentoPostgresqlAberto> {
  const piscina: Pool = criarPiscina(configuracao);

  let encerrado = false;

  const armazenamento: ArmazenamentoDoAcervo = {
    async inserirCartao(cartao) {
      return comDesfecho(async () => {
        await piscina.query(INSERIR_CARTAO, [
          cartao.id,
          cartao.frente,
          cartao.verso,
        ]);

        return { ok: true, valor: cartao };
      });
    },

    async listarCartoes() {
      const { rows } = await piscina.query<LinhaDeCartao>(LISTAR_CARTOES);

      return rows.map(cartaoDaLinha);
    },

    async obterCartao(id) {
      return comDesfecho(async () => {
        const { rows } = await piscina.query<LinhaDeCartao>(OBTER_CARTAO, [id]);

        return rows[0] === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: cartaoDaLinha(rows[0]) };
      });
    },

    async atualizarCartao(cartao) {
      return comDesfecho(async () => {
        const { rowCount } = await piscina.query(ATUALIZAR_CARTAO, [
          cartao.frente,
          cartao.verso,
          cartao.id,
        ]);

        return (rowCount ?? 0) === 0
          ? NAO_ENCONTRADO
          : { ok: true, valor: cartao };
      });
    },

    async excluirCartao(id) {
      return comDesfecho(async () =>
        (await piscina.query(EXCLUIR_CARTAO, [id])).rowCount === 0
          ? NAO_ENCONTRADO
          : SEM_CARGA,
      );
    },

    async inserirBaralho(baralho) {
      return comDesfecho(async () => {
        await piscina.query(INSERIR_BARALHO, [baralho.id, baralho.nome]);

        return { ok: true, valor: baralho };
      });
    },

    async listarBaralhos() {
      const { rows } = await piscina.query<LinhaDeBaralho>(LISTAR_BARALHOS);

      return rows.map(baralhoDaLinha);
    },

    async obterBaralho(id) {
      return comDesfecho(async () => {
        const { rows } = await piscina.query<LinhaDeBaralho>(OBTER_BARALHO, [
          id,
        ]);

        return rows[0] === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: baralhoDaLinha(rows[0]) };
      });
    },

    async atualizarBaralho(baralho) {
      return comDesfecho(async () => {
        const { rowCount } = await piscina.query(ATUALIZAR_BARALHO, [
          baralho.nome,
          baralho.id,
        ]);

        return (rowCount ?? 0) === 0
          ? NAO_ENCONTRADO
          : { ok: true, valor: baralho };
      });
    },

    async excluirBaralho(id) {
      return comDesfecho(async () =>
        (await piscina.query(EXCLUIR_BARALHO, [id])).rowCount === 0
          ? NAO_ENCONTRADO
          : SEM_CARGA,
      );
    },

    async vincular(cartaoId, baralhoId) {
      return comDesfecho(async () => {
        try {
          await piscina.query(INSERIR_VINCULO, [cartaoId, baralhoId]);
        } catch (erro) {
          if (
            ehViolacao(erro, VIOLACAO_DE_UNICIDADE, CHAVE_PRIMARIA_DE_VINCULO)
          ) {
            return VINCULO_DUPLICADO;
          }

          throw erro;
        }

        return SEM_CARGA;
      });
    },

    async desvincular(cartaoId, baralhoId) {
      return comDesfecho(async () =>
        (await piscina.query(REMOVER_VINCULO, [cartaoId, baralhoId]))
          .rowCount === 0
          ? NAO_ENCONTRADO
          : SEM_CARGA,
      );
    },

    async listarBaralhosDoCartao(cartaoId) {
      const { rows } = await piscina.query<LinhaDeBaralho>(
        LISTAR_BARALHOS_DO_CARTAO,
        [cartaoId],
      );

      return rows.map(baralhoDaLinha);
    },

    async listarCartoesDoBaralho(baralhoId) {
      const { rows } = await piscina.query<LinhaDeCartao>(
        LISTAR_CARTOES_DO_BARALHO,
        [baralhoId],
      );

      return rows.map(cartaoDaLinha);
    },

    async contarCartoesPorBaralho() {
      const { rows } = await piscina.query<LinhaDeContagem>(
        CONTAR_CARTOES_POR_BARALHO,
      );

      const contagens: ContagemPorBaralho[] = rows.map((linha) => ({
        baralhoId: linha.baralhoId,
        quantidadeDeCartoes: Number(linha.quantidadeDeCartoes),
      }));

      return contagens;
    },
  };

  /**
   * A segunda Porta, sobre o mesmo conjunto de conexões. O Adapter é o mesmo, e
   * o índice único de `usuario` é deste Adapter como as demais restrições: o
   * SQLSTATE `23505` do índice nomeado vira desfecho tipado em vez de erro do
   * driver (FR-074, FR-118). O `BYTEA` é enviado e lido como bytes, sem
   * codificação que pudesse alterar o `sal` ou o `hash`.
   */
  const usuarios: ArmazenamentoDeUsuarios = {
    async inserirUsuario(usuario) {
      return comDesfechoDeUsuario<DesfechoDeInsercaoDeUsuario>(
        async () => {
          try {
            await piscina.query(INSERIR_USUARIO, [
              usuario.id,
              usuario.nomeDeUsuario,
              Buffer.from(usuario.sal),
              Buffer.from(usuario.hash),
              usuario.parametros,
            ]);
          } catch (erro) {
            if (
              ehViolacao(erro, VIOLACAO_DE_UNICIDADE, INDICE_DE_NOME_DE_USUARIO)
            ) {
              return NOME_DE_USUARIO_EXISTENTE;
            }

            throw erro;
          }

          return { ok: true, valor: usuario };
        },
        USUARIO_INDISPONIVEL,
      );
    },

    async obterUsuarioPorNomeDeUsuario(nomeDeUsuario) {
      return comDesfechoDeUsuario<DesfechoDeLeituraDeUsuario>(
        async () => {
          const { rows } = await piscina.query<LinhaDeUsuario>(
            OBTER_USUARIO_POR_NOME,
            [nomeDeUsuario],
          );

          return rows[0] === undefined
            ? USUARIO_NAO_ENCONTRADO
            : { ok: true, valor: usuarioDaLinha(rows[0]) };
        },
        USUARIO_INDISPONIVEL,
      );
    },
  };

  return {
    armazenamento,
    usuarios,

    async encerrar() {
      if (encerrado) {
        return;
      }

      encerrado = true;

      await piscina.end();
    },
  };
}
