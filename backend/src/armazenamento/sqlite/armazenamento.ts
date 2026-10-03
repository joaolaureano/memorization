import type { DatabaseSync } from "node:sqlite";

import type {
  Agendamento,
  ArmazenamentoDeAcessos,
  ArmazenamentoDoAcervo,
  ArmazenamentoDeUsuarios,
  Baralho,
  Cartao,
  CompromissoPersistido,
  ContagemPorBaralho,
  ContagensDaConta,
  Desfecho,
  DesfechoDeAcesso,
  DesfechoDeAcessoValido,
  DesfechoDeAlteracaoDeNome,
  DesfechoDeOperacaoDeConta,
  DesfechoDeInsercaoDeUsuario,
  DesfechoDeLeituraDeUsuario,
  DesfechoDeRotina,
  InicioAutorizado,
  ItemAvaliado,
  ItemRegistrado,
  Preferencias,
  RegistroDeSessao,
  RegistroResumido,
  RotinaArmazenada,
  Usuario,
  VersaoDaRotina,
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
  /** A segunda Porta, sobre o mesmo arquivo: os Usuários da identidade. */
  usuarios: ArmazenamentoDeUsuarios;
  /** A terceira Porta, sobre o mesmo arquivo: os Acessos temporários (018). */
  acessos: ArmazenamentoDeAcessos;
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

/**
 * Desfecho do `id` de Registro já usado pelo acervo de **outro** Usuário. O
 * `id` é gerado pelo cliente (FR-163), e a colisão entre donos diferentes é
 * recusa de domínio — como o Vínculo duplicado —, nunca falha do
 * armazenamento nem revelação do Registro alheio.
 */
const CONFLITO: Desfecho<never> = {
  ok: false,
  erro: "conflito",
};

/**
 * Padrões das Preferências quando o Usuário nunca as salvou (D5, FR-200). A
 * Porta sintetiza os padrões na leitura e nunca grava linha a priori.
 */
const PREFERENCIAS_PADRAO: Preferencias = {
  algoritmo: "sm2",
  limiteDeNovosPorDia: 20,
};

/** Desfecho de sucesso sem carga: exclusão, Vínculo e desvínculo. */
const SEM_CARGA: Desfecho<void> = { ok: true, valor: undefined };

/** Desfecho do Nome de usuário já existente, imposto pela unicidade sem caixa. */
const NOME_DE_USUARIO_EXISTENTE = {
  ok: false,
  erro: "nome_de_usuario_existente",
} as const;

/** Desfecho do Nome de usuário em uso por outro Usuário, na alteração. */
const NOME_EM_USO = { ok: false, erro: "nome_em_uso" } as const;

/** Desfecho de falha do armazenamento na Porta de Usuários. */
const USUARIO_INDISPONIVEL = { ok: false, erro: "indisponivel" } as const;

/** Desfecho de ausência de Usuário, na leitura pelo Nome de usuário. */
const USUARIO_NAO_ENCONTRADO = { ok: false, erro: "nao_encontrado" } as const;

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
 * Executa `operacao` dentro de uma transação, desfazendo-a por completo em
 * caso de falha.
 *
 * A gravação do Registro de Sessão e dos seus Itens precisa ser atômica: um
 * Registro sem Itens seria uma Sessão corrompida, e a releitura idempotente do
 * `id` (FR-163) devolveria um retrato incompleto. O `ROLLBACK` é a mesma
 * defesa da aplicação de migrações em `esquema.ts`.
 */
function emTransacao<T>(
  banco: DatabaseSync,
  operacao: () => T,
  modo: "BEGIN" | "BEGIN IMMEDIATE" = "BEGIN",
): T {
  banco.exec(modo);

  try {
    const resultado = operacao();
    banco.exec("COMMIT");
    return resultado;
  } catch (erro) {
    try {
      banco.exec("ROLLBACK");
    } catch {
      // Sem transação ativa para desfazer; a falha original é a que importa.
    }
    throw erro;
  }
}

/**
 * Mesma tradução da falha do driver, no vocabulário de desfecho da Porta de
 * Usuários — que tem códigos próprios e não compartilha `vinculo_duplicado` nem
 * `nao_encontrado` com os do acervo. A duplicata de Nome de usuário não passa
 * por aqui: ela é reconhecida antes de chegar ao `catch`.
 */
function comDesfechoDeUsuario<D>(operacao: () => D, indisponivel: D): D {
  try {
    return operacao();
  } catch {
    return indisponivel;
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

/** Lê a linha como Usuário: o Nome de usuário e a transformação da Senha. */
function usuarioDaLinha(linha: Record<string, unknown>): Usuario {
  return {
    id: linha.id as string,
    nomeDeUsuario: linha.nome_de_usuario as string,
    sal: linha.sal as Uint8Array,
    hash: linha.hash as Uint8Array,
    parametros: linha.parametros as string,
  };
}

/**
 * Devolve a marca de conclusão como string ISO-8601 UTC. O SQLite a guarda
 * como texto desde a inserção; normalizar na leitura é o que garante ao Module
 * sempre a mesma forma, e é esse instante que ordena as listagens.
 */
function comoInstanteIso(valor: unknown): string {
  return new Date(valor as string).toISOString();
}

/** Lê a linha como Item do Registro, na ordem que o `ORDER BY` garantiu. */
function itemDaLinha(linha: Record<string, unknown>): ItemRegistrado {
  return {
    posicao: Number(linha.posicao),
    frente: linha.frente as string,
    verso: linha.verso as string,
    resultado: linha.resultado as ItemRegistrado["resultado"],
    /** Nulos nos Itens anteriores à 015, exibidos como antes (FR-197). */
    cartaoId: (linha.cartao_id as string | null) ?? null,
    avaliacao: (linha.avaliacao as ItemRegistrado["avaliacao"]) ?? null,
  };
}

/**
 * Lê a linha como Registro **sem** os Itens — a forma das listagens, em que a
 * Porta troca apenas contagens e a identificação do Baralho.
 */
function registroResumidoDaLinha(
  linha: Record<string, unknown>,
): RegistroResumido {
  return {
    id: linha.id as string,
    baralhoId: linha.baralho_id as string,
    nomeDoBaralho: linha.nome_do_baralho as string,
    /** `'baralho'` nas linhas anteriores à 015, pelo default da coluna (FR-196). */
    origem: linha.origem as RegistroResumido["origem"],
    concluidaEm: comoInstanteIso(linha.concluida_em),
    estudados: Number(linha.estudados),
    acertos: Number(linha.acertos),
    erros: Number(linha.erros),
  };
}

/** Lê a linha como Registro completo, com os Itens na ordem apresentada. */
function registroDaLinha(
  linha: Record<string, unknown>,
  itens: readonly ItemRegistrado[],
): RegistroDeSessao {
  return { ...registroResumidoDaLinha(linha), itens };
}

/**
 * Lê a linha como Agendamento. `estado` volta como **objeto** — o Adapter
 * desfaz o JSON que ele mesmo gravou —, e os instantes voltam em ISO-8601 UTC,
 * como as demais tabelas de instante (FR-188).
 */
function agendamentoDaLinha(linha: Record<string, unknown>): Agendamento {
  return {
    cartaoId: linha.cartao_id as string,
    algoritmo: linha.algoritmo as string,
    versaoDoAlgoritmo: Number(linha.versao_do_algoritmo),
    estado: JSON.parse(linha.estado as string) as unknown,
    proximaRevisaoEm: comoInstanteIso(linha.proxima_revisao_em),
    ultimaAvaliacao: linha.ultima_avaliacao as Agendamento["ultimaAvaliacao"],
    revisadoEm: comoInstanteIso(linha.revisado_em),
    criadoEm: comoInstanteIso(linha.criado_em),
  };
}

/** Lê a linha como ItemAvaliado — o insumo do replay (FR-213). */
function itemAvaliadoDaLinha(linha: Record<string, unknown>): ItemAvaliado {
  return {
    cartaoId: linha.cartao_id as string,
    avaliacao: linha.avaliacao as ItemAvaliado["avaliacao"],
    concluidaEm: comoInstanteIso(linha.concluida_em),
    posicao: Number(linha.posicao),
  };
}

/**
 * Reconhece a violação da unicidade do Nome de usuário. O SQLite entrega
 * `errcode` 2067 (SQLITE_CONSTRAINT_UNIQUE) quando o Nome de usuário já existe,
 * e a mensagem nomeia a coluna única — que é como este Adapter distingue a
 * duplicata, que é resultado de domínio, da violação da chave primária de `id`
 * (errcode 1555), que é falha do armazenamento.
 */
/**
 * Desfecho do `id` de Rotina já usado — de qualquer dono — ou do `operacaoId`
 * reutilizado com outra intenção (FR-248). É recusa de domínio, como o
 * `conflito` do Registro, e nunca revela a Rotina de outro Usuário.
 */
const CONFLITO_DE_ROTINA: DesfechoDeRotina<never> = {
  ok: false,
  erro: "conflito",
};

/** Desfecho de Rotina ausente; a de outro dono é indistinguível (FR-248). */
const ROTINA_NAO_ENCONTRADA: DesfechoDeRotina<never> = {
  ok: false,
  erro: "nao_encontrado",
};

/**
 * Desfecho do CAS recusado: a Rotina existe e é do Usuário, mas a versão
 * guardada divergiu da esperada (FR-248).
 */
const CONFLITO_DE_VERSAO: DesfechoDeRotina<never> = {
  ok: false,
  erro: "conflito_de_versao",
};

/** Desfecho de falha do armazenamento nas operações de Rotina (FR-248). */
const ROTINA_INDISPONIVEL: DesfechoDeRotina<never> = {
  ok: false,
  erro: "indisponivel",
};

/**
 * Executa a operação e traduz a falha do SQLite em `indisponivel` no
 * vocabulário próprio da Porta de Rotina (FR-248). Como nas demais operações,
 * nenhum erro do driver atravessa a Interface (FR-107).
 */
function comDesfechoDeRotina<T>(
  operacao: () => DesfechoDeRotina<T>,
): DesfechoDeRotina<T> {
  try {
    return operacao();
  } catch {
    return ROTINA_INDISPONIVEL;
  }
}

/**
 * Lê a linha como Rotina de estudo, desfazendo o JSON guardado em `versoes`
 * (FR-248). O `baralho_id` nulo é a Rotina indisponível: o Baralho foi
 * excluído e a programação permanece.
 */
function rotinaDaLinha(linha: Record<string, unknown>): RotinaArmazenada {
  return {
    id: linha.id as string,
    criadaEm: comoInstanteIso(linha.criada_em),
    versao: Number(linha.versao),
    estado: linha.estado as RotinaArmazenada["estado"],
    baralhoId: (linha.baralho_id as string | null) ?? null,
    versoes: JSON.parse(linha.versoes as string) as readonly VersaoDaRotina[],
  };
}

/**
 * Lê a linha como Compromisso persistido (FR-250): só exceções e conclusões,
 * com a configuração capturada no momento do compromisso.
 */
function compromissoDaLinha(
  linha: Record<string, unknown>,
): CompromissoPersistido {
  return {
    rotinaId: linha.rotina_id as string,
    data: linha.data as string,
    estado: linha.estado as CompromissoPersistido["estado"],
    registroId: (linha.registro_id as string | null) ?? null,
    baralhoId: linha.baralho_id as string,
    nomeDoBaralho: linha.nome_do_baralho as string,
    quantidade: (linha.quantidade as number | null) ?? null,
  };
}

/**
 * Lê a linha como Início autorizado, desfazendo o JSON dos Cartões
 * selecionados (FR-250); a ordem preservada é a que o servidor escolheu.
 */
function inicioDaLinha(linha: Record<string, unknown>): InicioAutorizado {
  return {
    id: linha.id as string,
    rotinaId: linha.rotina_id as string,
    data: linha.data as string,
    iniciadoEm: comoInstanteIso(linha.iniciado_em),
    fuso: linha.fuso as string,
    baralhoId: linha.baralho_id as string,
    nomeDoBaralho: linha.nome_do_baralho as string,
    quantidade: (linha.quantidade as number | null) ?? null,
    cartoes: JSON.parse(linha.cartoes as string) as readonly Cartao[],
  };
}

function ehNomeDeUsuarioExistente(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) {
    return false;
  }

  const candidato = erro as {
    code?: unknown;
    errcode?: unknown;
    message?: unknown;
  };

  return (
    candidato.code === "ERR_SQLITE_ERROR" &&
    candidato.errcode === 2067 &&
    typeof candidato.message === "string" &&
    candidato.message.includes("usuario.nome_de_usuario")
  );
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

  /**
   * Toda consulta do acervo é restrita a `usuario_id`: o dono é o primeiro
   * parâmetro das operações da Porta, e nenhuma linha de outro Usuário é lida,
   * alterada ou excluída. Um `id` de outro Usuário não devolve linha alguma —
   * ele é indistinguível de um `id` que nunca existiu (FR-092, SC-030).
   */
  const inserirCartao = banco.prepare(
    `INSERT INTO cartao (id, frente, verso, usuario_id, criado_em)
     VALUES (?, ?, ?, ?, ?)`,
  );
  /**
   * A ordem é a de criação, exigida por `loteDeRevisao` para os Cartões novos
   * (FR-201): as linhas anteriores à 015 têm `criado_em` nulo e vêm primeiro
   * (`criado_em IS NOT NULL` vale 0), e o `rowid` — a ordem de inserção —
   * desempata os Cartões de mesmo instante. O `id` não serve para desempatar,
   * porque é um UUID aleatório, sem relação com a criação.
   */
  const listarCartoes = banco.prepare(
    `SELECT id, frente, verso
       FROM cartao
      WHERE usuario_id = ?
      ORDER BY criado_em IS NOT NULL, criado_em, rowid`,
  );
  const obterCartaoPorId = banco.prepare(
    "SELECT id, frente, verso FROM cartao WHERE id = ? AND usuario_id = ?",
  );
  const atualizarCartao = banco.prepare(
    "UPDATE cartao SET frente = ?, verso = ? WHERE id = ? AND usuario_id = ?",
  );
  const excluirCartao = banco.prepare(
    "DELETE FROM cartao WHERE id = ? AND usuario_id = ?",
  );

  const inserirBaralho = banco.prepare(
    "INSERT INTO baralho (id, nome, usuario_id) VALUES (?, ?, ?)",
  );
  const listarBaralhos = banco.prepare(
    "SELECT id, nome FROM baralho WHERE usuario_id = ?",
  );
  const obterBaralhoPorId = banco.prepare(
    "SELECT id, nome FROM baralho WHERE id = ? AND usuario_id = ?",
  );
  const atualizarBaralho = banco.prepare(
    "UPDATE baralho SET nome = ? WHERE id = ? AND usuario_id = ?",
  );
  const excluirBaralho = banco.prepare(
    "DELETE FROM baralho WHERE id = ? AND usuario_id = ?",
  );

  const inserirVinculo = banco.prepare(
    "INSERT INTO vinculo (cartao_id, baralho_id) VALUES (?, ?)",
  );
  /**
   * O Vínculo não tem coluna de dono: ele pertence ao Usuário dos dois
   * extremos, e é por eles que o escopo chega aqui. Sem os dois `EXISTS`, um
   * Cartão de outro Usuário poderia ser desvinculado por quem soubesse os dois
   * `id` (FR-093).
   */
  const removerVinculo = banco.prepare(
    `DELETE FROM vinculo
      WHERE cartao_id = ?
        AND baralho_id = ?
        AND EXISTS (SELECT 1 FROM cartao
                     WHERE cartao.id = vinculo.cartao_id
                       AND cartao.usuario_id = ?)
        AND EXISTS (SELECT 1 FROM baralho
                     WHERE baralho.id = vinculo.baralho_id
                       AND baralho.usuario_id = ?)`,
  );
  const listarBaralhosDoCartao = banco.prepare(
    `SELECT baralho.id, baralho.nome
       FROM vinculo
       JOIN cartao ON cartao.id = vinculo.cartao_id
       JOIN baralho ON baralho.id = vinculo.baralho_id
      WHERE vinculo.cartao_id = ?
        AND cartao.usuario_id = ?`,
  );
  const listarCartoesDoBaralho = banco.prepare(
    `SELECT cartao.id, cartao.frente, cartao.verso
       FROM vinculo
       JOIN cartao ON cartao.id = vinculo.cartao_id
       JOIN baralho ON baralho.id = vinculo.baralho_id
      WHERE vinculo.baralho_id = ?
        AND baralho.usuario_id = ?`,
  );
  const contarCartoesPorBaralho = banco.prepare(
    `SELECT baralho.id AS baralhoId,
            COUNT(vinculo.cartao_id) AS quantidadeDeCartoes
       FROM baralho
       LEFT JOIN vinculo ON vinculo.baralho_id = baralho.id
      WHERE baralho.usuario_id = ?
      GROUP BY baralho.id`,
  );

  /**
   * As consultas do histórico de Sessões. A inserção do Registro e dos Itens
   * é sempre usada dentro de `emTransacao`, de modo que não existe Sessão
   * meio-gravada; as leituras são sempre escopadas por `usuario_id`, com a
   * única exceção deliberada de `obterRegistroPorId`.
   */
  const inserirRegistro = banco.prepare(
    `INSERT INTO registro_de_sessao
       (id, usuario_id, baralho_id, nome_do_baralho, origem, concluida_em,
        estudados, acertos, erros)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const inserirItemDoRegistro = banco.prepare(
    `INSERT INTO item_de_registro
       (registro_id, posicao, frente, verso, resultado, cartao_id, avaliacao)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  /**
   * A busca por `id` **sem** escopo de dono é deliberada: é ela que distingue
   * a reinserção idempotente do mesmo Usuário (FR-163) do `id` que já pertence
   * a outro Usuário, que é `conflito`. Ela nunca alimenta a resposta do
   * caminho de conflito — só o booleano do dono atravessa.
   */
  const obterRegistroPorId = banco.prepare(
    `SELECT id, usuario_id, baralho_id, nome_do_baralho, origem, concluida_em,
            estudados, acertos, erros
       FROM registro_de_sessao
      WHERE id = ?`,
  );
  /**
   * A leitura escopada: o Registro de outro Usuário é indistinguível de um
   * `id` que nunca existiu — ausência de linha, como em todo o acervo
   * (FR-092, SC-030).
   */
  const obterRegistroDoUsuario = banco.prepare(
    `SELECT id, baralho_id, nome_do_baralho, origem, concluida_em,
            estudados, acertos, erros
       FROM registro_de_sessao
      WHERE id = ? AND usuario_id = ?`,
  );
  const listarItensDoRegistro = banco.prepare(
    `SELECT posicao, frente, verso, resultado, cartao_id, avaliacao
       FROM item_de_registro
      WHERE registro_id = ?
      ORDER BY posicao`,
  );
  /**
   * A janela e os recentes ordenam pelo texto ISO-8601, que é ordenável como
   * string por construção; a comparação `>=` faz o corte da janela de 31 dias
   * sem qualquer conversão.
   */
  const listarRegistrosDesde = banco.prepare(
    `SELECT id, baralho_id, nome_do_baralho, origem, concluida_em,
            estudados, acertos, erros
       FROM registro_de_sessao
      WHERE usuario_id = ? AND concluida_em >= ?
      ORDER BY concluida_em DESC`,
  );
  const listarRegistrosRecentes = banco.prepare(
    `SELECT id, baralho_id, nome_do_baralho, origem, concluida_em,
            estudados, acertos, erros
       FROM registro_de_sessao
      WHERE usuario_id = ?
      ORDER BY concluida_em DESC
      LIMIT ?`,
  );

  /**
   * As consultas da repetição espaçada. `estado` trafega como JSON em `TEXT` —
   * o Adapter o guarda e o devolve como objeto, e só o algoritmo o interpreta
   * (FR-188). Os instantes são texto ISO-8601 UTC, como as demais tabelas de
   * instante, e é o que permite ordená-los como string.
   */
  const listarAgendamentos = banco.prepare(
    `SELECT cartao_id, algoritmo, versao_do_algoritmo, estado,
            proxima_revisao_em, ultima_avaliacao, revisado_em, criado_em
       FROM agendamento
      WHERE usuario_id = ?`,
  );
  /**
   * O upsert do Agendamento. O `SELECT ... WHERE EXISTS` impede que uma linha
   * nasça para Cartão de outro Usuário ou já excluído: o Agendamento é
   * descartado em silêncio, sem derrubar a transação (D5). `criado_em` fica de
   * fora do `DO UPDATE` de propósito — é o instante da primeira Avaliação e
   * não muda ao reagendar (D3, FR-199).
   */
  const gravarAgendamento = banco.prepare(
    `INSERT INTO agendamento
       (usuario_id, cartao_id, algoritmo, versao_do_algoritmo, estado,
        proxima_revisao_em, ultima_avaliacao, revisado_em, criado_em)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM cartao
                     WHERE cartao.id = ? AND cartao.usuario_id = ?)
     ON CONFLICT (usuario_id, cartao_id) DO UPDATE SET
       algoritmo           = excluded.algoritmo,
       versao_do_algoritmo = excluded.versao_do_algoritmo,
       estado              = excluded.estado,
       proxima_revisao_em  = excluded.proxima_revisao_em,
       ultima_avaliacao    = excluded.ultima_avaliacao,
       revisado_em         = excluded.revisado_em`,
  );
  const apagarAgendamentos = banco.prepare(
    "DELETE FROM agendamento WHERE usuario_id = ?",
  );
  /** As Preferências: uma linha por Usuário, ausente quando nunca salvas (D5). */
  const obterPreferenciasDoUsuario = banco.prepare(
    `SELECT algoritmo, limite_de_novos_por_dia
       FROM preferencias
      WHERE usuario_id = ?`,
  );
  /** As Preferências do Usuário, com o padrão sintetizado quando não há linha (D5). */
  function preferenciasDoUsuario(usuarioId: string): Preferencias {
    const linha = obterPreferenciasDoUsuario.get(usuarioId);

    return linha === undefined
      ? PREFERENCIAS_PADRAO
      : {
          algoritmo: linha.algoritmo as string,
          limiteDeNovosPorDia: Number(linha.limite_de_novos_por_dia),
        };
  }
  const gravarPreferencias = banco.prepare(
    `INSERT INTO preferencias (usuario_id, algoritmo, limite_de_novos_por_dia)
     VALUES (?, ?, ?)
     ON CONFLICT (usuario_id) DO UPDATE SET
       algoritmo               = excluded.algoritmo,
       limite_de_novos_por_dia = excluded.limite_de_novos_por_dia`,
  );
  /**
   * O insumo do replay: só Itens com Avaliação e Cartão de origem, em ordem
   * `(concluidaEm, posicao)`; os anteriores à 015, com `NULL`, ficam de fora
   * (FR-213).
   */
  const listarItensAvaliados = banco.prepare(
    `SELECT item.cartao_id AS cartao_id,
            item.avaliacao   AS avaliacao,
            registro.concluida_em AS concluida_em,
            item.posicao     AS posicao
       FROM item_de_registro AS item
       JOIN registro_de_sessao AS registro ON registro.id = item.registro_id
      WHERE registro.usuario_id = ?
        AND item.cartao_id IS NOT NULL
        AND item.avaliacao IS NOT NULL
      ORDER BY registro.concluida_em, item.posicao`,
  );

  const inserirUsuario = banco.prepare(
    `INSERT INTO usuario (id, nome_de_usuario, sal, hash, parametros)
     VALUES (?, ?, ?, ?, ?)`,
  );
  /**
   * A comparação é a da coluna: `nome_de_usuario` é `UNIQUE COLLATE NOCASE`, e
   * é essa colação que faz a leitura não distinguir maiúsculas de minúsculas
   * (FR-074). Nenhum `lower` em SQL é necessário, e não há índice extra a
   * manter.
   */
  const obterUsuarioPorNomeDeUsuario = banco.prepare(
    `SELECT id, nome_de_usuario, sal, hash, parametros
       FROM usuario
      WHERE nome_de_usuario = ?`,
  );
  const obterUsuarioPorId = banco.prepare(
    `SELECT id, nome_de_usuario, sal, hash, parametros
       FROM usuario
      WHERE id = ?`,
  );
  const atualizarNomeDoUsuario = banco.prepare(
    "UPDATE usuario SET nome_de_usuario = ? WHERE id = ?",
  );
  const atualizarSenhaDoUsuario = banco.prepare(
    "UPDATE usuario SET sal = ?, hash = ?, parametros = ? WHERE id = ?",
  );
  /**
   * Um único `DELETE`: as chaves estrangeiras `ON DELETE CASCADE` removem, na
   * mesma instrução atômica, tudo o que pertence ao Usuário (FR-274, FR-275).
   */
  const excluirUsuarioPorId = banco.prepare("DELETE FROM usuario WHERE id = ?");
  const contarDadosDoUsuario = banco.prepare(
    `SELECT
       (SELECT COUNT(*) FROM cartao WHERE usuario_id = ?1) AS cartoes,
       (SELECT COUNT(*) FROM baralho WHERE usuario_id = ?1) AS baralhos,
       (SELECT COUNT(*) FROM registro_de_sessao WHERE usuario_id = ?1)
         AS registros,
       (SELECT COUNT(*) FROM rotina_de_estudo WHERE usuario_id = ?1)
       + (SELECT COUNT(*) FROM compromisso_de_estudo WHERE usuario_id = ?1)
       + (SELECT COUNT(*) FROM inicio_de_compromisso WHERE usuario_id = ?1)
         AS agenda`,
  );

  /**
   * As consultas da agenda de estudo (FR-248, FR-250). Toda leitura e gravação
   * de Rotina, de Compromisso e de Início é escopada por `usuario_id`: a linha
   * de outro dono é indistinguível de inexistente — `nao_encontrado`
   * (FR-092, SC-030). As listas em JSON (`versoes`, `cartoes`) trafegam como
   * texto e o Adapter as desfaz na leitura.
   */
  const inserirRotina = banco.prepare(
    `INSERT INTO rotina_de_estudo
       (id, usuario_id, baralho_id, estado, versao, criada_em, versoes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  /**
   * O CAS da Rotina: grava só se a versão guardada é a esperada. `criada_em` e
   * `id` ficam de fora do `SET` de propósito — não mudam na atualização
   * (FR-248).
   */
  const atualizarRotinaPorCas = banco.prepare(
    `UPDATE rotina_de_estudo
        SET baralho_id = ?, estado = ?, versao = ?, versoes = ?
      WHERE id = ? AND usuario_id = ? AND versao = ?`,
  );
  const obterRotinaDoUsuario = banco.prepare(
    `SELECT id, baralho_id, estado, versao, criada_em, versoes
       FROM rotina_de_estudo
      WHERE id = ? AND usuario_id = ?`,
  );
  /**
   * A busca por `id` sem escopo de dono é deliberada: é ela que reconhece a
   * criação com `id` repetido — de qualquer dono — como `conflito`, sem que a
   * Rotina alheia atravesse a Porta (FR-248).
   */
  const obterRotinaPorIdDeQualquerDono = banco.prepare(
    "SELECT id FROM rotina_de_estudo WHERE id = ?",
  );
  /** Distingue a Rotina ausente da versão divergente após um UPDATE sem linha. */
  const obterVersaoDaRotina = banco.prepare(
    "SELECT versao FROM rotina_de_estudo WHERE id = ? AND usuario_id = ?",
  );
  const listarRotinas = banco.prepare(
    `SELECT id, baralho_id, estado, versao, criada_em, versoes
       FROM rotina_de_estudo
      WHERE usuario_id = ?`,
  );
  const obterOperacaoDeRotina = banco.prepare(
    `SELECT intencao, resultado
       FROM operacao_de_rotina
      WHERE usuario_id = ? AND operacao_id = ?`,
  );
  const inserirOperacaoDeRotina = banco.prepare(
    `INSERT INTO operacao_de_rotina
       (usuario_id, operacao_id, rotina_id, intencao, resultado)
     VALUES (?, ?, ?, ?, ?)`,
  );

  /**
   * A reativação (FR-239) remove só a exceção `cancelado`: a linha `concluido`
   * nunca é apagada (FR-245).
   */
  const removerCompromissoCancelado = banco.prepare(
    `DELETE FROM compromisso_de_estudo
      WHERE rotina_id = ? AND data = ? AND usuario_id = ?
        AND estado = 'cancelado'`,
  );

  const inserirCompromisso = banco.prepare(
    `INSERT INTO compromisso_de_estudo
       (rotina_id, data, usuario_id, estado, registro_id, baralho_id,
        nome_do_baralho, quantidade)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const atualizarCompromisso = banco.prepare(
    `UPDATE compromisso_de_estudo
        SET estado = ?, registro_id = ?, baralho_id = ?, nome_do_baralho = ?,
            quantidade = ?
      WHERE rotina_id = ? AND data = ? AND usuario_id = ?`,
  );
  const obterCompromissoDoUsuario = banco.prepare(
    `SELECT rotina_id, data, estado, registro_id, baralho_id,
            nome_do_baralho, quantidade
       FROM compromisso_de_estudo
      WHERE rotina_id = ? AND data = ? AND usuario_id = ?`,
  );
  const listarCompromissos = banco.prepare(
    `SELECT rotina_id, data, estado, registro_id, baralho_id,
            nome_do_baralho, quantidade
       FROM compromisso_de_estudo
      WHERE usuario_id = ? AND data >= ? AND data <= ?`,
  );

  const inserirInicio = banco.prepare(
    `INSERT INTO inicio_de_compromisso
       (id, usuario_id, rotina_id, data, iniciado_em, fuso, baralho_id,
        nome_do_baralho, quantidade, cartoes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  /**
   * Mesma idempotência do Registro: a busca por `id` sem escopo de dono
   * distingue o reenvio do mesmo Usuário do `id` que já pertence a outro
   * (FR-250).
   */
  const obterInicioPorId = banco.prepare(
    `SELECT id, usuario_id, rotina_id, data, iniciado_em, fuso, baralho_id,
            nome_do_baralho, quantidade, cartoes
       FROM inicio_de_compromisso
      WHERE id = ?`,
  );
  const obterInicioDoUsuario = banco.prepare(
    `SELECT id, rotina_id, data, iniciado_em, fuso, baralho_id,
            nome_do_baralho, quantidade, cartoes
       FROM inicio_de_compromisso
      WHERE id = ? AND usuario_id = ?`,
  );

  /**
   * O Acesso temporário (018): só o digest do valor é guardado. As datas são
   * texto ISO-8601 UTC e se comparam como string. `ON DELETE CASCADE` em
   * `usuario_id` remove os Acessos junto com o Usuário (FR-296).
   */
  const inserirAcesso = banco.prepare(
    `INSERT INTO acesso_temporario
       (digest, usuario_id, criado_em, expira_em, ultima_acao_em)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const obterAcesso = banco.prepare(
    "SELECT usuario_id, expira_em FROM acesso_temporario WHERE digest = ?",
  );
  const renovarAcesso = banco.prepare(
    `UPDATE acesso_temporario
        SET expira_em = ?, ultima_acao_em = ?
      WHERE digest = ?`,
  );
  const encerrarAcesso = banco.prepare(
    "DELETE FROM acesso_temporario WHERE digest = ?",
  );
  const encerrarAcessosDoUsuario = banco.prepare(
    "DELETE FROM acesso_temporario WHERE usuario_id = ?",
  );
  const removerAcessosExpirados = banco.prepare(
    "DELETE FROM acesso_temporario WHERE expira_em < ?",
  );

  const armazenamento: ArmazenamentoDoAcervo = {
    async inserirCartao(usuarioId, cartao) {
      return comDesfecho(() => {
        /**
         * `criado_em` é o instante corrente e não faz parte de `Cartao`: ele só
         * existe para ordenar os Cartões novos por criação (FR-201).
         */
        inserirCartao.run(
          cartao.id,
          cartao.frente,
          cartao.verso,
          usuarioId,
          new Date().toISOString(),
        );

        return { ok: true, valor: cartao };
      });
    },

    async listarCartoes(usuarioId) {
      return listarCartoes.all(usuarioId).map(cartaoDaLinha);
    },

    async obterCartao(usuarioId, id) {
      return comDesfecho(() => {
        const linha = obterCartaoPorId.get(id, usuarioId);

        return linha === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: cartaoDaLinha(linha) };
      });
    },

    async atualizarCartao(usuarioId, cartao) {
      return comDesfecho(() => {
        const alteradas = atualizarCartao.run(
          cartao.frente,
          cartao.verso,
          cartao.id,
          usuarioId,
        );

        return Number(alteradas.changes) === 0
          ? NAO_ENCONTRADO
          : { ok: true, valor: cartao };
      });
    },

    async excluirCartao(usuarioId, id) {
      return comDesfecho(() =>
        Number(excluirCartao.run(id, usuarioId).changes) === 0
          ? NAO_ENCONTRADO
          : SEM_CARGA,
      );
    },

    async inserirBaralho(usuarioId, baralho) {
      return comDesfecho(() => {
        inserirBaralho.run(baralho.id, baralho.nome, usuarioId);

        return { ok: true, valor: baralho };
      });
    },

    async listarBaralhos(usuarioId) {
      return listarBaralhos.all(usuarioId).map(baralhoDaLinha);
    },

    async obterBaralho(usuarioId, id) {
      return comDesfecho(() => {
        const linha = obterBaralhoPorId.get(id, usuarioId);

        return linha === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: baralhoDaLinha(linha) };
      });
    },

    async atualizarBaralho(usuarioId, baralho) {
      return comDesfecho(() => {
        const alteradas = atualizarBaralho.run(
          baralho.nome,
          baralho.id,
          usuarioId,
        );

        return Number(alteradas.changes) === 0
          ? NAO_ENCONTRADO
          : { ok: true, valor: baralho };
      });
    },

    async excluirBaralho(usuarioId, id) {
      return comDesfecho(() =>
        Number(excluirBaralho.run(id, usuarioId).changes) === 0
          ? NAO_ENCONTRADO
          : SEM_CARGA,
      );
    },

    async vincular(usuarioId, cartaoId, baralhoId) {
      return comDesfecho(() => {
        /**
         * Extremidade inexistente é ausência de linha, e não falha: é a mesma
         * regra de `nao_encontrado` das outras operações. A conferência é
         * feita **dentro do escopo**, de modo que a extremidade de outro
         * Usuário é ausência — sem revelar que ela existe (FR-093). Sem esta
         * conferência, a chave estrangeira do esquema apareceria como erro do
         * driver.
         */
        if (
          obterCartaoPorId.get(cartaoId, usuarioId) === undefined ||
          obterBaralhoPorId.get(baralhoId, usuarioId) === undefined
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

    async desvincular(usuarioId, cartaoId, baralhoId) {
      return comDesfecho(() => {
        const removidos = removerVinculo.run(
          cartaoId,
          baralhoId,
          usuarioId,
          usuarioId,
        );

        return Number(removidos.changes) === 0 ? NAO_ENCONTRADO : SEM_CARGA;
      });
    },

    async listarBaralhosDoCartao(usuarioId, cartaoId) {
      return listarBaralhosDoCartao
        .all(cartaoId, usuarioId)
        .map(baralhoDaLinha);
    },

    async listarCartoesDoBaralho(usuarioId, baralhoId) {
      return listarCartoesDoBaralho
        .all(baralhoId, usuarioId)
        .map(cartaoDaLinha);
    },

    async contarCartoesPorBaralho(usuarioId) {
      const contagens: ContagemPorBaralho[] = contarCartoesPorBaralho
        .all(usuarioId)
        .map((linha) => ({
          baralhoId: linha.baralhoId as string,
          quantidadeDeCartoes: Number(linha.quantidadeDeCartoes),
        }));

      return contagens;
    },

    async inserirRegistroDeSessao(usuarioId, registro) {
      return comDesfecho(() => {
        const existente = obterRegistroPorId.get(registro.id);

        if (existente !== undefined) {
          /**
           * Reinserção do mesmo `id` pelo mesmo Usuário é a retentativa que a
           * idempotência de FR-163 prevê: o Registro guardado volta intacto,
           * sem alterar contagens nem Itens. O `id` de **outro** Usuário é
           * `conflito`, sem que nada do Registro alheio atravesse a Porta.
           */
          return (existente.usuario_id as string) === usuarioId
            ? {
                ok: true,
                valor: registroDaLinha(
                  existente,
                  listarItensDoRegistro.all(registro.id).map(itemDaLinha),
                ),
              }
            : CONFLITO;
        }

        /**
         * Registro e Itens numa transação só: um Registro sem Itens seria uma
         * Sessão corrompida e inutilizaria a releitura idempotente.
         */
        emTransacao(banco, () => {
          inserirRegistro.run(
            registro.id,
            usuarioId,
            registro.baralhoId,
            registro.nomeDoBaralho,
            registro.origem,
            registro.concluidaEm,
            registro.estudados,
            registro.acertos,
            registro.erros,
          );

          for (const item of registro.itens) {
            inserirItemDoRegistro.run(
              registro.id,
              item.posicao,
              item.frente,
              item.verso,
              item.resultado,
              item.cartaoId ?? null,
              item.avaliacao ?? null,
            );
          }
        });

        return { ok: true, valor: registro };
      });
    },

    async listarRegistrosDesde(usuarioId, desde) {
      return listarRegistrosDesde
        .all(usuarioId, desde)
        .map(registroResumidoDaLinha);
    },

    async listarRegistrosRecentes(usuarioId, limite) {
      return listarRegistrosRecentes
        .all(usuarioId, limite)
        .map(registroResumidoDaLinha);
    },

    async obterRegistroDeSessao(usuarioId, id) {
      return comDesfecho(() => {
        const linha = obterRegistroDoUsuario.get(id, usuarioId);

        return linha === undefined
          ? NAO_ENCONTRADO
          : {
              ok: true,
              valor: registroDaLinha(
                linha,
                listarItensDoRegistro.all(id).map(itemDaLinha),
              ),
            };
      });
    },

    async obterPreferencias(usuarioId) {
      const linha = obterPreferenciasDoUsuario.get(usuarioId);

      return linha === undefined
        ? PREFERENCIAS_PADRAO
        : {
            algoritmo: linha.algoritmo as string,
            limiteDeNovosPorDia: Number(linha.limite_de_novos_por_dia),
          };
    },

    async salvarPreferencias(usuarioId, preferencias) {
      return comDesfecho(() => {
        gravarPreferencias.run(
          usuarioId,
          preferencias.algoritmo,
          preferencias.limiteDeNovosPorDia,
        );

        return { ok: true, valor: preferencias };
      });
    },

    async listarAgendamentos(usuarioId) {
      return listarAgendamentos.all(usuarioId).map(agendamentoDaLinha);
    },

    async inserirRegistroEAgendamentos(usuarioId, registro, agendamentos) {
      /**
       * O genérico explícito é necessário porque os dois caminhos de sucesso
       * devolvem literais distintos (`novo: true` e `novo: false`) e a
       * inferência estreitaria o tipo para um deles, incompatível com a
       * assinatura da Porta, que promete `novo: boolean` (FR-210).
       */
      return comDesfecho<{ registro: RegistroDeSessao; novo: boolean }>(() => {
        const existente = obterRegistroPorId.get(registro.id);

        if (existente !== undefined) {
          /**
           * A idempotência do Histórico estendida aos Agendamentos: reenviar o
           * mesmo `id` pelo mesmo Usuário devolve o Registro guardado com
           * `novo: false` e **não** grava Agendamento algum (FR-210, SC-085). O
           * `id` de **outro** Usuário é `conflito`, como em
           * `inserirRegistroDeSessao` (FR-166).
           */
          return (existente.usuario_id as string) === usuarioId
            ? {
                ok: true,
                valor: {
                  registro: registroDaLinha(
                    existente,
                    listarItensDoRegistro.all(registro.id).map(itemDaLinha),
                  ),
                  novo: false,
                },
              }
            : CONFLITO;
        }

        /**
         * Registro, Itens e Agendamentos numa transação só (FR-167, FR-210): um
         * Registro sem Itens seria uma Sessão corrompida, e um Agendamento
         * gravado fora dela sobreviveria a um Registro que falhou. O upsert de
         * cada Agendamento só cria linha para Cartão que existe e é do Usuário,
         * descartando os demais em silêncio (D5).
         */
        emTransacao(banco, () => {
          inserirRegistro.run(
            registro.id,
            usuarioId,
            registro.baralhoId,
            registro.nomeDoBaralho,
            registro.origem,
            registro.concluidaEm,
            registro.estudados,
            registro.acertos,
            registro.erros,
          );

          for (const item of registro.itens) {
            inserirItemDoRegistro.run(
              registro.id,
              item.posicao,
              item.frente,
              item.verso,
              item.resultado,
              item.cartaoId ?? null,
              item.avaliacao ?? null,
            );
          }

          for (const agendamento of agendamentos) {
            gravarAgendamento.run(
              usuarioId,
              agendamento.cartaoId,
              agendamento.algoritmo,
              agendamento.versaoDoAlgoritmo,
              JSON.stringify(agendamento.estado),
              agendamento.proximaRevisaoEm,
              agendamento.ultimaAvaliacao,
              agendamento.revisadoEm,
              agendamento.criadoEm,
              agendamento.cartaoId,
              usuarioId,
            );
          }
        });

        return { ok: true, valor: { registro, novo: true } };
      });
    },

    async substituirAgendamentos(usuarioId, preferencias, agendamentos) {
      return comDesfecho(() => {
        /**
         * A reconstrução da troca de algoritmo (FR-213): Preferências gravadas,
         * **todos** os Agendamentos do Usuário apagados e os novos gravados,
         * numa transação só — nada de estado parcial entre apagar e gravar.
         */
        emTransacao(banco, () => {
          gravarPreferencias.run(
            usuarioId,
            preferencias.algoritmo,
            preferencias.limiteDeNovosPorDia,
          );

          apagarAgendamentos.run(usuarioId);

          for (const agendamento of agendamentos) {
            gravarAgendamento.run(
              usuarioId,
              agendamento.cartaoId,
              agendamento.algoritmo,
              agendamento.versaoDoAlgoritmo,
              JSON.stringify(agendamento.estado),
              agendamento.proximaRevisaoEm,
              agendamento.ultimaAvaliacao,
              agendamento.revisadoEm,
              agendamento.criadoEm,
              agendamento.cartaoId,
              usuarioId,
            );
          }
        });

        return SEM_CARGA;
      });
    },

    async gravarRotina(usuarioId, gravacao) {
      return comDesfechoDeRotina<{
        rotina: RotinaArmazenada;
        repetida: boolean;
      }>(() =>
        emTransacao(banco, () => {
          /**
           * A idempotência por `operacaoId`: a mesma `intencao` devolve a
           * Rotina guardada como resultado daquela operação, sem gravar de
           * novo; `intencao` diferente é reuso indevido e recusa como
           * `conflito` (FR-248).
           */
          const operacao = obterOperacaoDeRotina.get(
            usuarioId,
            gravacao.operacaoId,
          );

          if (operacao !== undefined) {
            return (operacao.intencao as string) === gravacao.intencao
              ? {
                  ok: true,
                  valor: {
                    rotina: JSON.parse(
                      operacao.resultado as string,
                    ) as RotinaArmazenada,
                    repetida: true,
                  },
                }
              : CONFLITO_DE_ROTINA;
          }

          if (gravacao.versaoEsperada === null) {
            /**
             * Criação: `id` de Rotina repetido — de qualquer dono — é
             * `conflito`, reconhecido dentro da transação antes do INSERT
             * (FR-248).
             */
            if (
              obterRotinaPorIdDeQualquerDono.get(gravacao.rotina.id) !==
              undefined
            ) {
              return CONFLITO_DE_ROTINA;
            }

            inserirRotina.run(
              gravacao.rotina.id,
              usuarioId,
              gravacao.rotina.baralhoId,
              gravacao.rotina.estado,
              gravacao.rotina.versao,
              gravacao.rotina.criadaEm,
              JSON.stringify(gravacao.rotina.versoes),
            );
          } else {
            /**
             * Atualização com CAS: só grava se a versão guardada é a esperada.
             * Nenhuma linha alterada distingue a Rotina inexistente ou de
             * outro dono (`nao_encontrado`) da versão divergente
             * (`conflito_de_versao`) (FR-248).
             */
            const alteradas = atualizarRotinaPorCas.run(
              gravacao.rotina.baralhoId,
              gravacao.rotina.estado,
              gravacao.rotina.versao,
              JSON.stringify(gravacao.rotina.versoes),
              gravacao.rotina.id,
              usuarioId,
              gravacao.versaoEsperada,
            );

            if (Number(alteradas.changes) === 0) {
              return obterVersaoDaRotina.get(gravacao.rotina.id, usuarioId) ===
                undefined
                ? ROTINA_NAO_ENCONTRADA
                : CONFLITO_DE_VERSAO;
            }
          }

          /**
           * Cancelamentos e reativações de hoje entram na mesma transação da
           * Rotina (FR-238, FR-239). O cancelamento só cria a linha quando
           * ainda não há nenhuma para `(rotina, data)`: a conclusão existente
           * prevalece (FR-245).
           */
          for (const cancelado of gravacao.cancelamentos ?? []) {
            if (
              obterCompromissoDoUsuario.get(
                cancelado.rotinaId,
                cancelado.data,
                usuarioId,
              ) === undefined
            ) {
              inserirCompromisso.run(
                cancelado.rotinaId,
                cancelado.data,
                usuarioId,
                "cancelado",
                null,
                cancelado.baralhoId,
                cancelado.nomeDoBaralho,
                cancelado.quantidade,
              );
            }
          }

          for (const data of gravacao.reativacoes ?? []) {
            removerCompromissoCancelado.run(
              gravacao.rotina.id,
              data,
              usuarioId,
            );
          }

          /**
           * A operação guarda o JSON da Rotina gravada: é ele que o reenvio
           * idempotente devolve como resultado (FR-248).
           */
          inserirOperacaoDeRotina.run(
            usuarioId,
            gravacao.operacaoId,
            gravacao.rotina.id,
            gravacao.intencao,
            JSON.stringify(gravacao.rotina),
          );

          return {
            ok: true,
            valor: { rotina: gravacao.rotina, repetida: false },
          };
        }),
      );
    },

    async obterOperacaoDeRotina(usuarioId, operacaoId) {
      return comDesfecho(() => {
        const linha = obterOperacaoDeRotina.get(usuarioId, operacaoId);

        return linha === undefined
          ? NAO_ENCONTRADO
          : {
              ok: true,
              valor: {
                intencao: linha.intencao as string,
                rotina: JSON.parse(linha.resultado as string) as RotinaArmazenada,
              },
            };
      });
    },

    async obterRotina(usuarioId, id) {
      return comDesfecho(() => {
        const linha = obterRotinaDoUsuario.get(id, usuarioId);

        return linha === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: rotinaDaLinha(linha) };
      });
    },

    async listarRotinas(usuarioId) {
      return listarRotinas.all(usuarioId).map(rotinaDaLinha);
    },

    async gravarCompromisso(usuarioId, compromisso) {
      return comDesfecho<{
        compromisso: CompromissoPersistido;
        alterado: boolean;
      }>(() =>
        emTransacao(banco, () => {
          /**
           * A posse da Rotina é conferida no escopo do dono: Rotina
           * inexistente ou de outro Usuário é `nao_encontrado` (FR-250).
           */
          if (
            obterRotinaDoUsuario.get(compromisso.rotinaId, usuarioId) ===
            undefined
          ) {
            return NAO_ENCONTRADO;
          }

          const existente = obterCompromissoDoUsuario.get(
            compromisso.rotinaId,
            compromisso.data,
            usuarioId,
          );

          if (existente === undefined) {
            inserirCompromisso.run(
              compromisso.rotinaId,
              compromisso.data,
              usuarioId,
              compromisso.estado,
              compromisso.registroId,
              compromisso.baralhoId,
              compromisso.nomeDoBaralho,
              compromisso.quantidade,
            );

            return { ok: true, valor: { compromisso, alterado: true } };
          }

          /**
           * A conclusão é imutável: a linha `concluido` volta intacta, com o
           * `registroId` preservado (FR-250).
           */
          if ((existente.estado as string) === "concluido") {
            return {
              ok: true,
              valor: {
                compromisso: compromissoDaLinha(existente),
                alterado: false,
              },
            };
          }

          /**
           * Linha `cancelado`: atualiza estado, registro e configuração,
           * mantendo o `registroId` já existente quando o novo vem nulo
           * (FR-250).
           */
          const registroId =
            compromisso.registroId ??
            ((existente.registro_id as string | null) ?? null);

          atualizarCompromisso.run(
            compromisso.estado,
            registroId,
            compromisso.baralhoId,
            compromisso.nomeDoBaralho,
            compromisso.quantidade,
            compromisso.rotinaId,
            compromisso.data,
            usuarioId,
          );

          return {
            ok: true,
            valor: {
              compromisso: { ...compromisso, registroId },
              alterado: true,
            },
          };
        }),
      );
    },

    async obterCompromisso(usuarioId, rotinaId, data) {
      return comDesfecho(() => {
        const linha = obterCompromissoDoUsuario.get(rotinaId, data, usuarioId);

        return linha === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: compromissoDaLinha(linha) };
      });
    },

    async listarCompromissos(usuarioId, de, ate) {
      return listarCompromissos
        .all(usuarioId, de, ate)
        .map(compromissoDaLinha);
    },

    async gravarInicio(usuarioId, inicio) {
      return comDesfecho<InicioAutorizado>(() =>
        emTransacao(banco, () => {
          /**
           * A posse da Rotina é conferida primeiro: Rotina inexistente ou de
           * outro dono é `nao_encontrado` (FR-250).
           */
          if (
            obterRotinaDoUsuario.get(inicio.rotinaId, usuarioId) === undefined
          ) {
            return NAO_ENCONTRADO;
          }

          const existente = obterInicioPorId.get(inicio.id);

          if (existente !== undefined) {
            /**
             * O mesmo `id` do mesmo Usuário devolve o Início já guardado, sem
             * alterar; o `id` de outro Usuário é `conflito`, como no Registro
             * de Sessão (FR-250).
             */
            return (existente.usuario_id as string) === usuarioId
              ? { ok: true, valor: inicioDaLinha(existente) }
              : CONFLITO;
          }

          inserirInicio.run(
            inicio.id,
            usuarioId,
            inicio.rotinaId,
            inicio.data,
            inicio.iniciadoEm,
            inicio.fuso,
            inicio.baralhoId,
            inicio.nomeDoBaralho,
            inicio.quantidade,
            JSON.stringify(inicio.cartoes),
          );

          return { ok: true, valor: inicio };
        }),
      );
    },

    async obterInicio(usuarioId, id) {
      return comDesfecho(() => {
        const linha = obterInicioDoUsuario.get(id, usuarioId);

        return linha === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: inicioDaLinha(linha) };
      });
    },

    async inserirRegistroDaAgenda(usuarioId, registro, compromisso, calcular) {
      return comDesfecho<{ registro: RegistroDeSessao; novo: boolean }>(() =>
        /**
         * Transação imediata: a leitura dos Agendamentos e a gravação ficam
         * serializadas por Usuário também entre processos que compartilhem o
         * arquivo, e o cálculo parte do estado mais recente (FR-233, FR-256).
         */
        emTransacao(
          banco,
          () => {
            const existente = obterRegistroPorId.get(registro.id);

            if (existente !== undefined) {
              return (existente.usuario_id as string) === usuarioId
                ? {
                    ok: true,
                    valor: {
                      registro: registroDaLinha(
                        existente,
                        listarItensDoRegistro
                          .all(registro.id)
                          .map(itemDaLinha),
                      ),
                      novo: false,
                    },
                  }
                : CONFLITO;
            }

            const agendamentos = calcular({
              agendamentos: listarAgendamentos
                .all(usuarioId)
                .map(agendamentoDaLinha),
              preferencias: preferenciasDoUsuario(usuarioId),
            });

            inserirRegistro.run(
              registro.id,
              usuarioId,
              registro.baralhoId,
              registro.nomeDoBaralho,
              registro.origem,
              registro.concluidaEm,
              registro.estudados,
              registro.acertos,
              registro.erros,
            );

            for (const item of registro.itens) {
              inserirItemDoRegistro.run(
                registro.id,
                item.posicao,
                item.frente,
                item.verso,
                item.resultado,
                item.cartaoId ?? null,
                item.avaliacao ?? null,
              );
            }

            for (const agendamento of agendamentos) {
              gravarAgendamento.run(
                usuarioId,
                agendamento.cartaoId,
                agendamento.algoritmo,
                agendamento.versaoDoAlgoritmo,
                JSON.stringify(agendamento.estado),
                agendamento.proximaRevisaoEm,
                agendamento.ultimaAvaliacao,
                agendamento.revisadoEm,
                agendamento.criadoEm,
                agendamento.cartaoId,
                usuarioId,
              );
            }

            /**
             * A conclusão do Compromisso: a linha `concluido` existente
             * permanece com o primeiro Registro (FR-235); `cancelado` passa a
             * `concluido` (FR-245); ausente é inserida.
             */
            const atual = obterCompromissoDoUsuario.get(
              compromisso.rotinaId,
              compromisso.data,
              usuarioId,
            );

            if (atual === undefined) {
              inserirCompromisso.run(
                compromisso.rotinaId,
                compromisso.data,
                usuarioId,
                "concluido",
                compromisso.registroId,
                compromisso.baralhoId,
                compromisso.nomeDoBaralho,
                compromisso.quantidade,
              );
            } else if ((atual.estado as string) !== "concluido") {
              atualizarCompromisso.run(
                "concluido",
                compromisso.registroId,
                compromisso.baralhoId,
                compromisso.nomeDoBaralho,
                compromisso.quantidade,
                compromisso.rotinaId,
                compromisso.data,
                usuarioId,
              );
            }

            return { ok: true, valor: { registro, novo: true } };
          },
          "BEGIN IMMEDIATE",
        ),
      );
    },

    async listarItensAvaliados(usuarioId) {
      return listarItensAvaliados.all(usuarioId).map(itemAvaliadoDaLinha);
    },
  };

  /**
   * A segunda Porta, sobre a mesma conexão. O Adapter é o mesmo, e a tabela
   * `usuario` é deste Adapter como as demais: nenhum SQL atravessa o domínio,
   * e a violação do `UNIQUE COLLATE NOCASE` vira desfecho tipado em vez de
   * erro do driver (FR-074, FR-107).
   */
  const usuarios: ArmazenamentoDeUsuarios = {
    async inserirUsuario(usuario) {
      return comDesfechoDeUsuario<DesfechoDeInsercaoDeUsuario>(
        () => {
          try {
            inserirUsuario.run(
              usuario.id,
              usuario.nomeDeUsuario,
              usuario.sal,
              usuario.hash,
              usuario.parametros,
            );
          } catch (erro) {
            if (ehNomeDeUsuarioExistente(erro)) {
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
        () => {
          const linha = obterUsuarioPorNomeDeUsuario.get(nomeDeUsuario);

          return linha === undefined
            ? USUARIO_NAO_ENCONTRADO
            : { ok: true, valor: usuarioDaLinha(linha) };
        },
        USUARIO_INDISPONIVEL,
      );
    },

    async obterUsuarioPorId(id) {
      return comDesfechoDeUsuario<DesfechoDeLeituraDeUsuario>(
        () => {
          const linha = obterUsuarioPorId.get(id);

          return linha === undefined
            ? USUARIO_NAO_ENCONTRADO
            : { ok: true, valor: usuarioDaLinha(linha) };
        },
        USUARIO_INDISPONIVEL,
      );
    },

    async atualizarNomeDeUsuario(id, nome) {
      return comDesfechoDeUsuario<DesfechoDeAlteracaoDeNome>(
        () => {
          try {
            if (Number(atualizarNomeDoUsuario.run(nome, id).changes) === 0) {
              return USUARIO_NAO_ENCONTRADO;
            }
          } catch (erro) {
            if (ehNomeDeUsuarioExistente(erro)) {
              return NOME_EM_USO;
            }

            throw erro;
          }

          const linha = obterUsuarioPorId.get(id);

          return linha === undefined
            ? USUARIO_NAO_ENCONTRADO
            : { ok: true, valor: usuarioDaLinha(linha) };
        },
        USUARIO_INDISPONIVEL,
      );
    },

    async atualizarSenha(id, derivacao) {
      return comDesfechoDeUsuario<DesfechoDeOperacaoDeConta<void>>(
        () =>
          Number(
            atualizarSenhaDoUsuario.run(
              derivacao.sal,
              derivacao.hash,
              derivacao.parametros,
              id,
            ).changes,
          ) === 0
            ? USUARIO_NAO_ENCONTRADO
            : { ok: true, valor: undefined },
        USUARIO_INDISPONIVEL,
      );
    },

    async excluirUsuario(id) {
      return comDesfechoDeUsuario<DesfechoDeOperacaoDeConta<void>>(
        () =>
          Number(excluirUsuarioPorId.run(id).changes) === 0
            ? USUARIO_NAO_ENCONTRADO
            : { ok: true, valor: undefined },
        USUARIO_INDISPONIVEL,
      );
    },

    async contarDadosDoUsuario(id) {
      return comDesfechoDeUsuario<
        DesfechoDeOperacaoDeConta<ContagensDaConta>
      >(() => {
        const linha = contarDadosDoUsuario.get(id);

        if (linha === undefined) {
          return USUARIO_NAO_ENCONTRADO;
        }

        return {
          ok: true,
          valor: {
            cartoes: Number(linha.cartoes),
            baralhos: Number(linha.baralhos),
            registrosDeSessao: Number(linha.registros),
            agenda: Number(linha.agenda),
          },
        };
      }, USUARIO_INDISPONIVEL);
    },
  };

  /**
   * A terceira Porta, sobre a mesma conexão: o Acesso temporário. Nenhum erro
   * do driver atravessa — a falha é `indisponivel`, e jamais Acesso ausente ou
   * expirado (FR-301).
   */
  const SEM_CARGA_DE_ACESSO: DesfechoDeAcesso<void> = {
    ok: true,
    valor: undefined,
  };
  const ACESSO_INDISPONIVEL = { ok: false, erro: "indisponivel" } as const;

  function comDesfechoDeAcesso<D>(operacao: () => D): D | typeof ACESSO_INDISPONIVEL {
    try {
      return operacao();
    } catch {
      return ACESSO_INDISPONIVEL;
    }
  }

  const acessos: ArmazenamentoDeAcessos = {
    async criar(digest, usuarioId, expiraEm) {
      return comDesfechoDeAcesso<DesfechoDeAcesso<void>>(() => {
        const agora = new Date().toISOString();

        inserirAcesso.run(digest, usuarioId, agora, expiraEm, agora);

        return SEM_CARGA_DE_ACESSO;
      });
    },

    async obterValido(digest, agora) {
      return comDesfechoDeAcesso<DesfechoDeAcessoValido>(() => {
        const linha = obterAcesso.get(digest);

        if (linha === undefined) {
          return { ok: false, erro: "nao_encontrado" };
        }

        return (linha.expira_em as string) > agora
          ? { ok: true, valor: { usuarioId: linha.usuario_id as string } }
          : { ok: false, erro: "expirado" };
      });
    },

    async renovar(digest, novoExpiraEm) {
      return comDesfechoDeAcesso<DesfechoDeAcesso<void>>(() =>
        Number(
          renovarAcesso.run(novoExpiraEm, new Date().toISOString(), digest)
            .changes,
        ) === 0
          ? { ok: false, erro: "nao_encontrado" }
          : SEM_CARGA_DE_ACESSO,
      );
    },

    async encerrar(digest) {
      return comDesfechoDeAcesso<DesfechoDeAcesso<void>>(() => {
        encerrarAcesso.run(digest);

        return SEM_CARGA_DE_ACESSO;
      });
    },

    async encerrarTodosDoUsuario(usuarioId) {
      return comDesfechoDeAcesso<DesfechoDeAcesso<void>>(() => {
        encerrarAcessosDoUsuario.run(usuarioId);

        return SEM_CARGA_DE_ACESSO;
      });
    },

    async removerExpirados(agora) {
      return comDesfechoDeAcesso<DesfechoDeAcesso<number>>(() => ({
        ok: true,
        valor: Number(removerAcessosExpirados.run(agora).changes),
      }));
    },
  };

  return {
    armazenamento,
    usuarios,
    acessos,

    async encerrar() {
      banco.close();
    },
  };
}
