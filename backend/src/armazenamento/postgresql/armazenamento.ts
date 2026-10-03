import type { Pool, PoolClient } from "pg";

import type {
  Agendamento,
  ArmazenamentoDoAcervo,
  ArmazenamentoDeUsuarios,
  Avaliacao,
  Baralho,
  Cartao,
  ContagemPorBaralho,
  Desfecho,
  DesfechoDeInsercaoDeUsuario,
  DesfechoDeLeituraDeUsuario,
  ItemAvaliado,
  ItemRegistrado,
  Preferencias,
  RegistroDeSessao,
  RegistroResumido,
  ResultadoDoItemRegistrado,
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

/**
 * Desfecho do `id` de Registro de Sessão já usado por **outro** Usuário. O
 * Registro de outro Usuário é indistinguível de um que nunca existiu — o mesmo
 * `nao_encontrado` do acervo (SC-030) —, mas aqui a repetição do `id` é do
 * cliente, e a recusa precisa ser distinta: `conflito`, e não `nao_encontrado`,
 * para que quem chamou saiba que o `id` está tomado (FR-163).
 */
const CONFLITO_DE_REGISTRO: Desfecho<never> = {
  ok: false,
  erro: "conflito",
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

/**
 * Toda consulta do acervo é restrita a `usuario_id`, o primeiro parâmetro de
 * cada operação da Porta: nenhuma linha de outro Usuário é lida, alterada ou
 * excluída, e o `id` de outro Usuário é indistinguível de um `id` que nunca
 * existiu (FR-092, SC-030).
 */
/**
 * `criado_em` é gravado pelo Adapter com o instante corrente: é a ordem de
 * criação que `loteDeRevisao` usa para os Cartões novos (FR-201). O tipo
 * `Cartao` não muda — o instante é do armazenamento, e não do domínio.
 */
const INSERIR_CARTAO = `
INSERT INTO cartao (id, frente, verso, usuario_id, criado_em)
VALUES ($1, $2, $3, $4, $5::timestamptz);
`;

/**
 * A ordem de criação é a da listagem (FR-201): as linhas anteriores à 015, com
 * `criado_em` nulo, vêm primeiro, e `ordem_de_insercao` desempata os Cartões de
 * mesmo instante — o `id` não serve, por ser um UUID aleatório. A coluna é do
 * armazenamento, e não do domínio: ela nunca aparece no tipo `Cartao`.
 */
const LISTAR_CARTOES = `
SELECT id, frente, verso FROM cartao WHERE usuario_id = $1
 ORDER BY criado_em NULLS FIRST, ordem_de_insercao;
`;

const OBTER_CARTAO = `
SELECT id, frente, verso FROM cartao WHERE id = $1 AND usuario_id = $2;
`;

const ATUALIZAR_CARTAO = `
UPDATE cartao SET frente = $1, verso = $2 WHERE id = $3 AND usuario_id = $4;
`;

const EXCLUIR_CARTAO = `
DELETE FROM cartao WHERE id = $1 AND usuario_id = $2;
`;

const INSERIR_BARALHO = `
INSERT INTO baralho (id, nome, usuario_id) VALUES ($1, $2, $3);
`;

const LISTAR_BARALHOS = `
SELECT id, nome FROM baralho WHERE usuario_id = $1;
`;

const OBTER_BARALHO = `
SELECT id, nome FROM baralho WHERE id = $1 AND usuario_id = $2;
`;

const ATUALIZAR_BARALHO = `
UPDATE baralho SET nome = $1 WHERE id = $2 AND usuario_id = $3;
`;

const EXCLUIR_BARALHO = `
DELETE FROM baralho WHERE id = $1 AND usuario_id = $2;
`;

/**
 * A inserção só acontece quando **as duas extremidades estão no acervo do
 * Usuário**: a extremidade de outro Usuário — ou inexistente — deixa a inserção
 * sem linha alguma, e o Adapter a traduz em `nao_encontrado`, sem nunca
 * revelar que ela existe (FR-093).
 */
const INSERIR_VINCULO = `
INSERT INTO vinculo (cartao_id, baralho_id)
SELECT $1, $2
 WHERE EXISTS (SELECT 1 FROM cartao  WHERE id = $1 AND usuario_id = $3)
   AND EXISTS (SELECT 1 FROM baralho WHERE id = $2 AND usuario_id = $3);
`;

/**
 * O Vínculo não tem coluna de dono: ele pertence ao Usuário dos dois extremos,
 * e é por eles que o escopo chega aqui. Sem os dois `EXISTS`, um Cartão de
 * outro Usuário poderia ser desvinculado por quem soubesse os dois `id`
 * (FR-093).
 */
const REMOVER_VINCULO = `
DELETE FROM vinculo
 WHERE cartao_id = $1
   AND baralho_id = $2
   AND EXISTS (SELECT 1 FROM cartao
                WHERE cartao.id = vinculo.cartao_id
                  AND cartao.usuario_id = $3)
   AND EXISTS (SELECT 1 FROM baralho
                WHERE baralho.id = vinculo.baralho_id
                  AND baralho.usuario_id = $3);
`;

const LISTAR_BARALHOS_DO_CARTAO = `
SELECT baralho.id, baralho.nome
  FROM vinculo
  JOIN cartao ON cartao.id = vinculo.cartao_id
  JOIN baralho ON baralho.id = vinculo.baralho_id
 WHERE vinculo.cartao_id = $1
   AND cartao.usuario_id = $2;
`;

const LISTAR_CARTOES_DO_BARALHO = `
SELECT cartao.id, cartao.frente, cartao.verso
  FROM vinculo
  JOIN cartao ON cartao.id = vinculo.cartao_id
  JOIN baralho ON baralho.id = vinculo.baralho_id
 WHERE vinculo.baralho_id = $1
   AND baralho.usuario_id = $2;
`;

const CONTAR_CARTOES_POR_BARALHO = `
SELECT baralho.id AS "baralhoId",
       COUNT(vinculo.cartao_id) AS "quantidadeDeCartoes"
  FROM baralho
  LEFT JOIN vinculo ON vinculo.baralho_id = baralho.id
 WHERE baralho.usuario_id = $1
 GROUP BY baralho.id;
`;

/**
 * A inserção idempotente do Registro de Sessão (FR-163): o
 * `ON CONFLICT (id) DO NOTHING` deixa a linha existente intacta e **não**
 * devolve linha alguma, de modo que o Adapter sabe que o `id` já estava lá. Ele
 * então procura o Registro **no acervo do Usuário** para separar a repetição
 * legítima — que devolve o Registro guardado, sem alterá-lo — do `id` tomado por
 * outro Usuário, que é `conflito`.
 *
 * `concluida_em` recebe o instante informado pelo Module, já como
 * `TIMESTAMPTZ`, e o `RETURNING` devolve o que o servidor efetivamente gravou:
 * a resposta é o Registro **guardado**, e não o que o cliente mandou (FR-164).
 */
const INSERIR_REGISTRO_DE_SESSAO = `
INSERT INTO registro_de_sessao
       (id, usuario_id, baralho_id, nome_do_baralho, origem, concluida_em, estudados, acertos, erros)
VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9)
ON CONFLICT (id) DO NOTHING
RETURNING concluida_em AS "concluidaEm";
`;

/**
 * Os Itens entram na mesma transação do Registro: o histórico de uma Sessão ou
 * está inteiro, ou não está (FR-161). A ordem é a `posicao` informada, e não a
 * ordem de inserção.
 */
const INSERIR_ITEM_DE_REGISTRO = `
INSERT INTO item_de_registro
       (registro_id, posicao, frente, verso, resultado, cartao_id, avaliacao)
VALUES ($1, $2, $3, $4, $5, $6, $7);
`;

/**
 * As listagens leem só o resumo — sem os Itens (FR-163, FR-165) —, do mais
 * recente ao mais antigo, e ambas restritas a `usuario_id`: o histórico de outro
 * Usuário não é alcançável por nenhuma delas (FR-092, SC-030).
 */
const COLUNAS_DE_RESUMO = `
       id,
       baralho_id      AS "baralhoId",
       nome_do_baralho AS "nomeDoBaralho",
       origem,
       concluida_em    AS "concluidaEm",
       estudados,
       acertos,
       erros
  FROM registro_de_sessao
`;

/** Os Registros concluídos a partir de `desde`, do mais recente ao mais antigo. */
const LISTAR_REGISTROS_DESDE = `
SELECT ${COLUNAS_DE_RESUMO}
 WHERE usuario_id = $1
   AND concluida_em >= $2::timestamptz
 ORDER BY concluida_em DESC;
`;

/** Os `limite` Registros mais recentes do Usuário. */
const LISTAR_REGISTROS_RECENTES = `
SELECT ${COLUNAS_DE_RESUMO}
 WHERE usuario_id = $1
 ORDER BY concluida_em DESC
 LIMIT $2;
`;

/**
 * O Registro completo é escopado pelo Usuário como todo o resto: o `id` de outro
 * Usuário não devolve linha, e é por isso que o Module o apresenta como
 * inexistente (FR-092, SC-030).
 */
const OBTER_REGISTRO_DE_SESSAO = `
SELECT ${COLUNAS_DE_RESUMO}
 WHERE id = $1
   AND usuario_id = $2;
`;

/**
 * Os Itens do Registro, na ordem apresentada. A consulta não repete o escopo do
 * Usuário porque só é alcançada depois de `OBTER_REGISTRO_DE_SESSAO` ter
 * confirmado que o Registro é dele.
 */
const LISTAR_ITENS_DO_REGISTRO = `
SELECT posicao, frente, verso, resultado,
       cartao_id AS "cartaoId", avaliacao
  FROM item_de_registro
 WHERE registro_id = $1
 ORDER BY posicao;
`;

/**
 * As Preferências do Usuário; ausência de linha é os padrões, que a Porta
 * sintetiza na leitura, sem gravar linha a priori (D5, FR-212).
 */
const OBTER_PREFERENCIAS = `
SELECT algoritmo, limite_de_novos_por_dia AS "limiteDeNovosPorDia"
  FROM preferencias
 WHERE usuario_id = $1;
`;

/**
 * O upsert das Preferências por Usuário: uma linha por dono, inserida ou
 * atualizada (FR-212).
 */
const SALVAR_PREFERENCIAS = `
INSERT INTO preferencias (usuario_id, algoritmo, limite_de_novos_por_dia)
VALUES ($1, $2, $3)
ON CONFLICT (usuario_id) DO UPDATE
   SET algoritmo               = EXCLUDED.algoritmo,
       limite_de_novos_por_dia = EXCLUDED.limite_de_novos_por_dia;
`;

/** Todos os Agendamentos do Usuário, sem ordem prometida (FR-187). */
const LISTAR_AGENDAMENTOS = `
SELECT cartao_id           AS "cartaoId",
       algoritmo,
       versao_do_algoritmo AS "versaoDoAlgoritmo",
       estado,
       proxima_revisao_em  AS "proximaRevisaoEm",
       ultima_avaliacao    AS "ultimaAvaliacao",
       revisado_em         AS "revisadoEm",
       criado_em           AS "criadoEm"
  FROM agendamento
 WHERE usuario_id = $1;
`;

/**
 * O upsert de um Agendamento, **só para Cartão que existe e é do Usuário**: o
 * `EXISTS` descarta em silêncio o Cartão excluído entre a leitura e a gravação,
 * sem derrubar a transação (D5). O `ON CONFLICT` atualiza o estado e as datas,
 * mas **preserva `criado_em`** — é o instante da primeira Avaliação, e é ele
 * que faz o Cartão contar no limite de novos do dia (FR-210, D3).
 */
const GRAVAR_AGENDAMENTO = `
INSERT INTO agendamento
       (usuario_id, cartao_id, algoritmo, versao_do_algoritmo, estado,
        proxima_revisao_em, ultima_avaliacao, revisado_em, criado_em)
SELECT $1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7, $8::timestamptz, $9::timestamptz
 WHERE EXISTS (SELECT 1 FROM cartao WHERE id = $2 AND usuario_id = $1)
ON CONFLICT (usuario_id, cartao_id) DO UPDATE
   SET algoritmo           = EXCLUDED.algoritmo,
       versao_do_algoritmo = EXCLUDED.versao_do_algoritmo,
       estado              = EXCLUDED.estado,
       proxima_revisao_em  = EXCLUDED.proxima_revisao_em,
       ultima_avaliacao    = EXCLUDED.ultima_avaliacao,
       revisado_em         = EXCLUDED.revisado_em;
`;

/** Apaga todos os Agendamentos do Usuário, para a reconstrução (FR-213). */
const EXCLUIR_AGENDAMENTOS = `
DELETE FROM agendamento WHERE usuario_id = $1;
`;

/**
 * Os Itens com Avaliação e Cartão de origem do Usuário, em ordem
 * `(concluida_em, posicao)` — o insumo do replay (FR-213). Os Itens anteriores
 * à 015, com `avaliacao` ou `cartao_id` nulos, ficam de fora.
 */
const LISTAR_ITENS_AVALIADOS = `
SELECT item.cartao_id        AS "cartaoId",
       item.avaliacao,
       registro.concluida_em AS "concluidaEm",
       item.posicao
  FROM item_de_registro item
  JOIN registro_de_sessao registro ON registro.id = item.registro_id
 WHERE registro.usuario_id = $1
   AND item.avaliacao IS NOT NULL
   AND item.cartao_id IS NOT NULL
 ORDER BY registro.concluida_em, item.posicao;
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
 * Instante como o driver o entrega: `TIMESTAMPTZ` é lido como `Date`, e o texto
 * ISO só aparece se a coluna for lida como texto. O Adapter aceita os dois e
 * normaliza na saída (FR-164).
 */
type Instante = Date | string;

/** Linha de `registro_de_sessao` como o Adapter a lê, sem os Itens. */
type LinhaDeRegistro = {
  id: string;
  baralhoId: string;
  nomeDoBaralho: string;
  origem: "baralho" | "revisao";
  concluidaEm: Instante;
  estudados: number;
  acertos: number;
  erros: number;
};

/**
 * Linha de `item_de_registro`; `resultado` é o vocabulário do `CHECK`, e
 * `cartaoId`/`avaliacao` são nulos nos Itens anteriores à 015 (FR-197).
 */
type LinhaDeItem = {
  posicao: number;
  frente: string;
  verso: string;
  resultado: ResultadoDoItemRegistrado;
  cartaoId: string | null;
  avaliacao: Avaliacao | null;
};

/** Linha de `agendamento`; `estado` é `JSONB` e chega já como objeto. */
type LinhaDeAgendamento = {
  cartaoId: string;
  algoritmo: string;
  versaoDoAlgoritmo: number;
  estado: unknown;
  proximaRevisaoEm: Instante;
  ultimaAvaliacao: Avaliacao;
  revisadoEm: Instante;
  criadoEm: Instante;
};

/** Linha de `preferencias`; ausência de linha significa os padrões (D5). */
type LinhaDePreferencias = {
  algoritmo: string;
  limiteDeNovosPorDia: number;
};

/** Linha de Item com Avaliação, para o replay dos Agendamentos (FR-213). */
type LinhaDeItemAvaliado = {
  cartaoId: string;
  avaliacao: Avaliacao;
  concluidaEm: Instante;
  posicao: number;
};

/** Uma conexão que sabe executar consultas: a piscina ou uma conexão dela. */
type Conexao = Pool | PoolClient;

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

/**
 * Executa o corpo numa conexão exclusiva, dentro de uma transação. É o que faz
 * o Registro e os seus Itens entrarem juntos ou não entrarem: o `ROLLBACK`
 * desfaz por completo uma inserção interrompida no meio, sem Registro órfão de
 * Itens (FR-161). A conexão volta para o conjunto em qualquer desfecho, e a
 * falha original continua subindo para o `comDesfecho` traduzir.
 */
async function emTransacao<T>(
  piscina: Pool,
  corpo: (cliente: PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await piscina.connect();

  try {
    await cliente.query("BEGIN;");

    const resultado = await corpo(cliente);

    await cliente.query("COMMIT;");

    return resultado;
  } catch (erro) {
    try {
      await cliente.query("ROLLBACK;");
    } catch {
      // Sem transação ativa para desfazer; a falha original é a que importa.
    }

    throw erro;
  } finally {
    cliente.release();
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
 * O instante em ISO-8601 UTC, que é a forma que a Porta promete. O fuso é o da
 * coluna `TIMESTAMPTZ`, e o `toISOString` escreve em UTC: a conversão é de
 * representação, não de horário (FR-164).
 */
function instanteIso(valor: Instante): string {
  return (typeof valor === "string" ? new Date(valor) : valor).toISOString();
}

/** Lê a linha como resumo: o Registro sem os Itens (FR-163). */
function registroResumidoDaLinha(linha: LinhaDeRegistro): RegistroResumido {
  return {
    id: linha.id,
    baralhoId: linha.baralhoId,
    nomeDoBaralho: linha.nomeDoBaralho,
    origem: linha.origem,
    concluidaEm: instanteIso(linha.concluidaEm),
    estudados: linha.estudados,
    acertos: linha.acertos,
    erros: linha.erros,
  };
}

/** Lê a linha como Item registrado, na `posicao` em que foi apresentado. */
function itemDaLinha(linha: LinhaDeItem): ItemRegistrado {
  return {
    posicao: linha.posicao,
    frente: linha.frente,
    verso: linha.verso,
    resultado: linha.resultado,
    cartaoId: linha.cartaoId,
    avaliacao: linha.avaliacao,
  };
}

/** Lê a linha como Agendamento, com os instantes em ISO-8601 UTC (FR-187). */
function agendamentoDaLinha(linha: LinhaDeAgendamento): Agendamento {
  return {
    cartaoId: linha.cartaoId,
    algoritmo: linha.algoritmo,
    versaoDoAlgoritmo: linha.versaoDoAlgoritmo,
    estado: linha.estado,
    proximaRevisaoEm: instanteIso(linha.proximaRevisaoEm),
    ultimaAvaliacao: linha.ultimaAvaliacao,
    revisadoEm: instanteIso(linha.revisadoEm),
    criadoEm: instanteIso(linha.criadoEm),
  };
}

/** Lê a linha como Preferências, sem deixar a forma do driver atravessar. */
function preferenciasDaLinha(linha: LinhaDePreferencias): Preferencias {
  return {
    algoritmo: linha.algoritmo,
    limiteDeNovosPorDia: linha.limiteDeNovosPorDia,
  };
}

/** Lê a linha como Item com Avaliação, insumo do replay (FR-213). */
function itemAvaliadoDaLinha(linha: LinhaDeItemAvaliado): ItemAvaliado {
  return {
    cartaoId: linha.cartaoId,
    avaliacao: linha.avaliacao,
    concluidaEm: instanteIso(linha.concluidaEm),
    posicao: linha.posicao,
  };
}

/**
 * As Preferências padrão da Porta (D5): a ausência de linha em `preferencias`
 * equivale a `algoritmo = "sm2"` e `limiteDeNovosPorDia = 20`, e a leitura as
 * sintetiza sem gravar linha a priori (FR-212).
 */
const PREFERENCIAS_PADRAO: Preferencias = {
  algoritmo: "sm2",
  limiteDeNovosPorDia: 20,
};

/** Os parâmetros da inserção do Registro, na ordem da consulta. */
function parametrosDoRegistro(
  usuarioId: string,
  registro: RegistroDeSessao,
): unknown[] {
  return [
    registro.id,
    usuarioId,
    registro.baralhoId,
    registro.nomeDoBaralho,
    registro.origem,
    registro.concluidaEm,
    registro.estudados,
    registro.acertos,
    registro.erros,
  ];
}

/**
 * Grava os Itens do Registro na conexão informada, na ordem apresentada. Os
 * Itens anteriores à 015, sem `cartaoId`/`avaliacao`, gravam `NULL` — é o que
 * mantém o Histórico antigo gravável e exibível (FR-197).
 */
async function gravarItens(
  conexao: Conexao,
  registro: RegistroDeSessao,
): Promise<void> {
  for (const item of registro.itens) {
    await conexao.query(INSERIR_ITEM_DE_REGISTRO, [
      registro.id,
      item.posicao,
      item.frente,
      item.verso,
      item.resultado,
      item.cartaoId ?? null,
      item.avaliacao ?? null,
    ]);
  }
}

/** Os parâmetros do upsert do Agendamento, na ordem da consulta. */
function parametrosDoAgendamento(
  usuarioId: string,
  agendamento: Agendamento,
): unknown[] {
  return [
    usuarioId,
    agendamento.cartaoId,
    agendamento.algoritmo,
    agendamento.versaoDoAlgoritmo,
    JSON.stringify(agendamento.estado),
    agendamento.proximaRevisaoEm,
    agendamento.ultimaAvaliacao,
    agendamento.revisadoEm,
    agendamento.criadoEm,
  ];
}

/**
 * Grava os Agendamentos na conexão informada. O `GRAVAR_AGENDAMENTO` descarta
 * em silêncio o Agendamento de Cartão inexistente ou de outro Usuário, sem
 * derrubar a transação (D5), e atualiza sem tocar em `criado_em` (FR-210).
 */
async function gravarAgendamentos(
  conexao: Conexao,
  usuarioId: string,
  agendamentos: readonly Agendamento[],
): Promise<void> {
  for (const agendamento of agendamentos) {
    await conexao.query(
      GRAVAR_AGENDAMENTO,
      parametrosDoAgendamento(usuarioId, agendamento),
    );
  }
}

/**
 * Lê o Registro completo do Usuário, com os Itens na ordem apresentada; ausente
 * — inclusive quando o Registro é de outro Usuário — é `undefined`, e quem
 * chamou decide o desfecho (FR-092, SC-030).
 */
async function lerRegistroDoUsuario(
  conexao: Conexao,
  usuarioId: string,
  id: string,
): Promise<RegistroDeSessao | undefined> {
  const { rows } = await conexao.query<LinhaDeRegistro>(
    OBTER_REGISTRO_DE_SESSAO,
    [id, usuarioId],
  );

  if (rows[0] === undefined) {
    return undefined;
  }

  const { rows: linhasDeItens } = await conexao.query<LinhaDeItem>(
    LISTAR_ITENS_DO_REGISTRO,
    [id],
  );

  return {
    ...registroResumidoDaLinha(rows[0]),
    itens: linhasDeItens.map(itemDaLinha),
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
    async inserirCartao(usuarioId, cartao) {
      return comDesfecho(async () => {
        await piscina.query(INSERIR_CARTAO, [
          cartao.id,
          cartao.frente,
          cartao.verso,
          usuarioId,
          new Date().toISOString(),
        ]);

        return { ok: true, valor: cartao };
      });
    },

    async listarCartoes(usuarioId) {
      const { rows } = await piscina.query<LinhaDeCartao>(LISTAR_CARTOES, [
        usuarioId,
      ]);

      return rows.map(cartaoDaLinha);
    },

    async obterCartao(usuarioId, id) {
      return comDesfecho(async () => {
        const { rows } = await piscina.query<LinhaDeCartao>(OBTER_CARTAO, [
          id,
          usuarioId,
        ]);

        return rows[0] === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: cartaoDaLinha(rows[0]) };
      });
    },

    async atualizarCartao(usuarioId, cartao) {
      return comDesfecho(async () => {
        const { rowCount } = await piscina.query(ATUALIZAR_CARTAO, [
          cartao.frente,
          cartao.verso,
          cartao.id,
          usuarioId,
        ]);

        return (rowCount ?? 0) === 0
          ? NAO_ENCONTRADO
          : { ok: true, valor: cartao };
      });
    },

    async excluirCartao(usuarioId, id) {
      return comDesfecho(async () =>
        (await piscina.query(EXCLUIR_CARTAO, [id, usuarioId])).rowCount === 0
          ? NAO_ENCONTRADO
          : SEM_CARGA,
      );
    },

    async inserirBaralho(usuarioId, baralho) {
      return comDesfecho(async () => {
        await piscina.query(INSERIR_BARALHO, [
          baralho.id,
          baralho.nome,
          usuarioId,
        ]);

        return { ok: true, valor: baralho };
      });
    },

    async listarBaralhos(usuarioId) {
      const { rows } = await piscina.query<LinhaDeBaralho>(LISTAR_BARALHOS, [
        usuarioId,
      ]);

      return rows.map(baralhoDaLinha);
    },

    async obterBaralho(usuarioId, id) {
      return comDesfecho(async () => {
        const { rows } = await piscina.query<LinhaDeBaralho>(OBTER_BARALHO, [
          id,
          usuarioId,
        ]);

        return rows[0] === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: baralhoDaLinha(rows[0]) };
      });
    },

    async atualizarBaralho(usuarioId, baralho) {
      return comDesfecho(async () => {
        const { rowCount } = await piscina.query(ATUALIZAR_BARALHO, [
          baralho.nome,
          baralho.id,
          usuarioId,
        ]);

        return (rowCount ?? 0) === 0
          ? NAO_ENCONTRADO
          : { ok: true, valor: baralho };
      });
    },

    async excluirBaralho(usuarioId, id) {
      return comDesfecho(async () =>
        (await piscina.query(EXCLUIR_BARALHO, [id, usuarioId])).rowCount === 0
          ? NAO_ENCONTRADO
          : SEM_CARGA,
      );
    },

    async vincular(usuarioId, cartaoId, baralhoId) {
      return comDesfecho(async () => {
        try {
          const { rowCount } = await piscina.query(INSERIR_VINCULO, [
            cartaoId,
            baralhoId,
            usuarioId,
          ]);

          /**
           * Nenhuma linha inserida é extremidade ausente **no escopo do
           * Usuário**, e não falha do armazenamento.
           */
          return (rowCount ?? 0) === 0 ? NAO_ENCONTRADO : SEM_CARGA;
        } catch (erro) {
          if (
            ehViolacao(erro, VIOLACAO_DE_UNICIDADE, CHAVE_PRIMARIA_DE_VINCULO)
          ) {
            return VINCULO_DUPLICADO;
          }

          throw erro;
        }
      });
    },

    async desvincular(usuarioId, cartaoId, baralhoId) {
      return comDesfecho(async () =>
        (
          await piscina.query(REMOVER_VINCULO, [
            cartaoId,
            baralhoId,
            usuarioId,
          ])
        ).rowCount === 0
          ? NAO_ENCONTRADO
          : SEM_CARGA,
      );
    },

    async listarBaralhosDoCartao(usuarioId, cartaoId) {
      const { rows } = await piscina.query<LinhaDeBaralho>(
        LISTAR_BARALHOS_DO_CARTAO,
        [cartaoId, usuarioId],
      );

      return rows.map(baralhoDaLinha);
    },

    async listarCartoesDoBaralho(usuarioId, baralhoId) {
      const { rows } = await piscina.query<LinhaDeCartao>(
        LISTAR_CARTOES_DO_BARALHO,
        [baralhoId, usuarioId],
      );

      return rows.map(cartaoDaLinha);
    },

    async contarCartoesPorBaralho(usuarioId) {
      const { rows } = await piscina.query<LinhaDeContagem>(
        CONTAR_CARTOES_POR_BARALHO,
        [usuarioId],
      );

      const contagens: ContagemPorBaralho[] = rows.map((linha) => ({
        baralhoId: linha.baralhoId,
        quantidadeDeCartoes: Number(linha.quantidadeDeCartoes),
      }));

      return contagens;
    },

    /**
     * Guarda o Registro e os Itens numa transação (FR-161) e é idempotente pelo
     * `id` (FR-163): a segunda inserção do mesmo `id` **deste** Usuário devolve
     * o Registro guardado, sem alterá-lo; o mesmo `id` de outro Usuário é
     * `conflito`. A distinção sai do próprio escopo — a leitura do Registro
     * existente também é restrita a `usuario_id`, e por isso o `id` alheio não
     * devolve linha (FR-092).
     */
    async inserirRegistroDeSessao(usuarioId, registro) {
      return comDesfecho<RegistroDeSessao>(() =>
        emTransacao<Desfecho<RegistroDeSessao>>(piscina, async (cliente) => {
          const { rows } = await cliente.query<{ concluidaEm: Instante }>(
            INSERIR_REGISTRO_DE_SESSAO,
            parametrosDoRegistro(usuarioId, registro),
          );

          /**
           * Nenhuma linha devolvida é o `id` já existente: o Registro do
           * Usuário é o resultado, e o de outro Usuário é conflito. Nada é
           * gravado — nem os Itens.
           */
          if (rows[0] === undefined) {
            const existente = await lerRegistroDoUsuario(
              cliente,
              usuarioId,
              registro.id,
            );

            return existente === undefined
              ? CONFLITO_DE_REGISTRO
              : { ok: true, valor: existente };
          }

          await gravarItens(cliente, registro);

          return {
            ok: true,
            valor: {
              ...registro,
              concluidaEm: instanteIso(rows[0].concluidaEm),
            },
          };
        }),
      );
    },

    async listarRegistrosDesde(usuarioId, desde) {
      const { rows } = await piscina.query<LinhaDeRegistro>(
        LISTAR_REGISTROS_DESDE,
        [usuarioId, desde],
      );

      return rows.map(registroResumidoDaLinha);
    },

    async listarRegistrosRecentes(usuarioId, limite) {
      const { rows } = await piscina.query<LinhaDeRegistro>(
        LISTAR_REGISTROS_RECENTES,
        [usuarioId, limite],
      );

      return rows.map(registroResumidoDaLinha);
    },

    /**
     * O Registro completo com os Itens na ordem apresentada; de outro Usuário
     * ou inexistente é `nao_encontrado`, o mesmo desfecho e sem revelar qual dos
     * dois (FR-092, SC-030).
     */
    async obterRegistroDeSessao(usuarioId, id) {
      return comDesfecho<RegistroDeSessao>(async () => {
        const registro = await lerRegistroDoUsuario(piscina, usuarioId, id);

        return registro === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: registro };
      });
    },

    /**
     * As Preferências do Usuário; **ausência de linha não é `nao_encontrado`**:
     * a Porta sintetiza os padrões (`"sm2"`, 20), sem gravar linha a priori
     * (D5, FR-212).
     */
    async obterPreferencias(usuarioId) {
      const { rows } = await piscina.query<LinhaDePreferencias>(
        OBTER_PREFERENCIAS,
        [usuarioId],
      );

      return rows[0] === undefined
        ? PREFERENCIAS_PADRAO
        : preferenciasDaLinha(rows[0]);
    },

    /** Grava as Preferências já validadas pelo Module, com upsert por dono (FR-212). */
    async salvarPreferencias(usuarioId, preferencias) {
      return comDesfecho(async () => {
        await piscina.query(SALVAR_PREFERENCIAS, [
          usuarioId,
          preferencias.algoritmo,
          preferencias.limiteDeNovosPorDia,
        ]);

        return { ok: true, valor: preferencias };
      });
    },

    /** Os Agendamentos do Usuário, com o `estado` opaco devolvido como objeto (FR-188). */
    async listarAgendamentos(usuarioId) {
      const { rows } = await piscina.query<LinhaDeAgendamento>(
        LISTAR_AGENDAMENTOS,
        [usuarioId],
      );

      return rows.map(agendamentoDaLinha);
    },

    /**
     * Guarda o Registro e os Agendamentos numa **única transação** (FR-210),
     * com a mesma idempotência/conflito de `inserirRegistroDeSessao`: o `id` já
     * existente **deste** Usuário devolve o Registro guardado com `novo: false`,
     * sem gravar Agendamento algum; o `id` de outro Usuário é `conflito`.
     * Quando o Registro é novo, os Agendamentos entram logo depois, e o de
     * Cartão inexistente ou alheio é descartado em silêncio (D5).
     */
    async inserirRegistroEAgendamentos(usuarioId, registro, agendamentos) {
      return comDesfecho<{ registro: RegistroDeSessao; novo: boolean }>(() =>
        emTransacao<Desfecho<{ registro: RegistroDeSessao; novo: boolean }>>(
          piscina,
          async (cliente) => {
            const { rows } = await cliente.query<{ concluidaEm: Instante }>(
              INSERIR_REGISTRO_DE_SESSAO,
              parametrosDoRegistro(usuarioId, registro),
            );

            /**
             * Nenhuma linha devolvida é o `id` já existente: o Registro do
             * Usuário é devolvido com `novo: false`, e o de outro Usuário é
             * `conflito`. Nada é gravado — nem os Itens, nem os Agendamentos.
             */
            if (rows[0] === undefined) {
              const existente = await lerRegistroDoUsuario(
                cliente,
                usuarioId,
                registro.id,
              );

              return existente === undefined
                ? CONFLITO_DE_REGISTRO
                : { ok: true, valor: { registro: existente, novo: false } };
            }

            await gravarItens(cliente, registro);
            await gravarAgendamentos(cliente, usuarioId, agendamentos);

            return {
              ok: true,
              valor: {
                registro: {
                  ...registro,
                  concluidaEm: instanteIso(rows[0].concluidaEm),
                },
                novo: true,
              },
            };
          },
        ),
      );
    },

    /**
     * Numa única transação, salva as Preferências, apaga **todos** os
     * Agendamentos do Usuário e grava os novos — a reconstrução que a troca de
     * algoritmo dispara (FR-212, FR-213).
     */
    async substituirAgendamentos(usuarioId, preferencias, agendamentos) {
      return comDesfecho<void>(() =>
        emTransacao<Desfecho<void>>(piscina, async (cliente) => {
          await cliente.query(SALVAR_PREFERENCIAS, [
            usuarioId,
            preferencias.algoritmo,
            preferencias.limiteDeNovosPorDia,
          ]);

          await cliente.query(EXCLUIR_AGENDAMENTOS, [usuarioId]);
          await gravarAgendamentos(cliente, usuarioId, agendamentos);

          return SEM_CARGA;
        }),
      );
    },

    /** Os Itens com Avaliação e Cartão de origem, em `(concluida_em, posicao)` (FR-213). */
    async listarItensAvaliados(usuarioId) {
      const { rows } = await piscina.query<LinhaDeItemAvaliado>(
        LISTAR_ITENS_AVALIADOS,
        [usuarioId],
      );

      return rows.map(itemAvaliadoDaLinha);
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
