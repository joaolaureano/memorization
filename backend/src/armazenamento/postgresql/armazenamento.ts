import type { Pool, PoolClient } from "pg";

import type {
  Agendamento,
  ArmazenamentoDeAcessos,
  ArmazenamentoDoAcervo,
  ArmazenamentoDeUsuarios,
  Avaliacao,
  Baralho,
  Cartao,
  CartaoComDono,
  CartaoPendente,
  CompromissoPersistido,
  ContagemPorBaralho,
  ContagensDaConta,
  Desfecho,
  DesfechoDeAcesso,
  DesfechoDeAcessoValido,
  DesfechoDeBaralhoComCopias,
  DesfechoDeOperacaoDeConta,
  DesfechoDeInsercaoDeUsuario,
  DesfechoDeLeituraDeUsuario,
  DesfechoDeRotina,
  EstadoDaRotina,
  EstadoPersistidoDoCompromisso,
  InicioAutorizado,
  ItemAvaliado,
  ItemRegistrado,
  OperacaoDeRotinaGravada,
  Preferencias,
  RegistroDeSessao,
  RegistroResumido,
  ResultadoDoItemRegistrado,
  RotinaArmazenada,
  Usuario,
  VersaoDaRotina,
} from "../porta.ts";
import { normalizarFrente } from "../../acervo/invariantes.ts";
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
  /** A terceira Porta, sobre o mesmo conjunto: os Acessos temporários (018). */
  acessos: ArmazenamentoDeAcessos;
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

/** Desfecho de Frente normalizada repetida no mesmo Baralho. */
const FRENTE_DUPLICADA: Desfecho<never> = {
  ok: false,
  erro: "frente_duplicada",
};

/**
 * Desfecho genérico de conflito de domínio (ex. Cartão já resolvido,
 * Baralho inexistente ou Frente duplicada em aplicarTransicao).
 */
const CONFLITO: Desfecho<never> = {
  ok: false,
  erro: "conflito",
};

/**
 * Desfecho do `id` de Registro de Sessão já usado por **outro** Usuário. O
 * Registro de outro Usuário é indistinguível de um que nunca existiu — o mesmo
 * `nao_encontrado` do acervo (SC-030) —, mas aqui a repetição do `id` é do
 * cliente, e a recusa precisa ser distinta: `conflito`, e não `nao_encontrado`,
 * para que quem chamou saiba que o `id` está tomado (FR-163).
 */
const CONFLITO_DE_REGISTRO: Desfecho<never> = CONFLITO;

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
 * Nome estável da constraint de unicidade de `pertencimento`. O DDL é nosso,
 * então é por este nome que a colisão de Frente normalizada — resultado de
 * domínio — se distingue de qualquer outra unicidade violada, que é falha do
 * armazenamento (FR-398).
 */
const CHAVE_UNICA_DE_PERTENCIMENTO =
  "pertencimento_baralho_id_frente_chave_key";

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
 * Devolve Cartões com Pertencimento, cada um com seu Baralho dono (FR-389).
 * A ordem de criação é a da listagem (FR-201): as linhas anteriores à 015, com
 * `criado_em` nulo, vêm primeiro, e `ordem_de_insercao` desempata os Cartões de
 * mesmo instante.
 */
const LISTAR_CARTOES = `
SELECT cartao.id, cartao.frente, cartao.verso, baralho.id AS baralho_id,
       baralho.nome AS baralho_nome
  FROM cartao
  JOIN pertencimento ON pertencimento.cartao_id = cartao.id
  JOIN baralho ON baralho.id = pertencimento.baralho_id
 WHERE cartao.usuario_id = $1
 ORDER BY cartao.criado_em NULLS FIRST, cartao.ordem_de_insercao;
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

/**
 * A busca do Baralho por `id` **sem escopo de dono** é deliberada (FR-372,
 * FR-373): é ela que distingue o reenvio idempotente — o Baralho já existe e é
 * do próprio Usuário, e a criação o devolve como está, sem gravar de novo — do
 * `id` tomado por **outro** dono, que é `conflito`, e não `nao_encontrado`.
 */
const OBTER_BARALHO_DE_QUALQUER_DONO = `
SELECT id, nome, usuario_id AS "usuarioId" FROM baralho WHERE id = $1;
`;

const ATUALIZAR_BARALHO = `
UPDATE baralho SET nome = $1 WHERE id = $2 AND usuario_id = $3;
`;

/**
 * Exclui os Cartões do dono cujo Pertencimento aponta para o Baralho, e depois
 * o Baralho (FR-402). As cascatas do esquema removem os Pertencimentos e
 * Agendamentos automaticamente.
 */
const EXCLUIR_CARTOES_PERTENCIMENTO_BARALHO = `
DELETE FROM cartao
 WHERE usuario_id = $1
   AND id IN (
     SELECT cartao_id FROM pertencimento WHERE baralho_id = $2
   );
`;

const EXCLUIR_BARALHO = `
DELETE FROM baralho WHERE id = $1 AND usuario_id = $2;
`;

/**
 * Insere Cartão e Pertencimento numa transação (FR-389, FR-390). A violação de
 * UNIQUE(baralho_id, frente_chave) é reconhecida e traduzida em `frente_duplicada`.
 */
const INSERIR_CARTAO_NO_BARALHO = `
INSERT INTO cartao (id, frente, verso, usuario_id, criado_em)
VALUES ($1, $2, $3, $4, $5::timestamptz);
`;

/**
 * Insere o Pertencimento com a Frente normalizada. Violação da UNIQUE será
 * traduzida em `frente_duplicada` (FR-398).
 */
const INSERIR_PERTENCIMENTO = `
INSERT INTO pertencimento (cartao_id, baralho_id, frente_chave)
VALUES ($1, $2, $3);
`;

const LISTAR_CARTOES_DO_BARALHO = `
SELECT cartao.id, cartao.frente, cartao.verso
  FROM pertencimento
  JOIN cartao ON cartao.id = pertencimento.cartao_id
  JOIN baralho ON baralho.id = pertencimento.baralho_id
 WHERE pertencimento.baralho_id = $1
   AND baralho.usuario_id = $2;
`;

const CONTAR_CARTOES_POR_BARALHO = `
SELECT baralho.id AS "baralhoId",
       COUNT(pertencimento.cartao_id) AS "quantidadeDeCartoes"
  FROM baralho
  LEFT JOIN pertencimento ON pertencimento.baralho_id = baralho.id
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
       (registro_id, posicao, frente, verso, resultado, cartao_id, avaliacao, avaliacao_rotulo)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
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
       cartao_id AS "cartaoId", avaliacao, avaliacao_rotulo AS "avaliacaoRotulo"
  FROM item_de_registro
 WHERE registro_id = $1
 ORDER BY posicao;
`;

/**
 * As Preferências do Usuário; ausência de linha é os padrões, que a Porta
 * sintetiza na leitura, sem gravar linha a priori (D5, FR-212).
 */
const OBTER_PREFERENCIAS = `
SELECT algoritmo
  FROM preferencias
 WHERE usuario_id = $1;
`;

/**
 * O upsert das Preferências por Usuário: uma linha por dono, inserida ou
 * atualizada (FR-212).
 */
const SALVAR_PREFERENCIAS = `
INSERT INTO preferencias (usuario_id, algoritmo)
VALUES ($1, $2)
ON CONFLICT (usuario_id) DO UPDATE
   SET algoritmo = EXCLUDED.algoritmo;
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

const OBTER_USUARIO_POR_ID = `
SELECT id, nome_de_usuario, sal, hash, parametros
  FROM usuario
 WHERE id = $1;
`;

const ATUALIZAR_SENHA_DO_USUARIO = `
UPDATE usuario SET sal = $1, hash = $2, parametros = $3 WHERE id = $4;
`;

/**
 * Uma única instrução: as chaves estrangeiras `ON DELETE CASCADE` removem, na
 * mesma transação implícita, tudo o que pertence ao Usuário (FR-274, FR-275).
 */
const EXCLUIR_USUARIO = `
DELETE FROM usuario WHERE id = $1;
`;

const CONTAR_DADOS_DO_USUARIO = `
SELECT
  (SELECT COUNT(*) FROM cartao WHERE usuario_id = $1)::int AS cartoes,
  (SELECT COUNT(*) FROM baralho WHERE usuario_id = $1)::int AS baralhos,
  (SELECT COUNT(*) FROM registro_de_sessao WHERE usuario_id = $1)::int
    AS registros,
  ((SELECT COUNT(*) FROM rotina_de_estudo WHERE usuario_id = $1)
   + (SELECT COUNT(*) FROM compromisso_de_estudo WHERE usuario_id = $1)
   + (SELECT COUNT(*) FROM inicio_de_compromisso WHERE usuario_id = $1))::int
    AS agenda;
`;

/**
 * Cartões pendentes: sem Pertencimento no acervo do Usuário. Se `vinculo` ainda
 * existe, traz os Baralhos a que estava vinculado; senão, traz lista vazia.
 * (FR-397)
 */
const LISTAR_CARTOES_PENDENTES = `
SELECT cartao.id, cartao.frente, cartao.verso, '[]'::json AS baralhos_json
  FROM cartao
 WHERE cartao.usuario_id = $1
   AND NOT EXISTS (
     SELECT 1 FROM pertencimento WHERE pertencimento.cartao_id = cartao.id
   )
 ORDER BY cartao.id;
`;

/**
 * Mesma leitura com os Baralhos do dono ligados pela tabela legada. Só pode ser
 * enviada enquanto `vinculo` existe: o PostgreSQL resolve toda relação citada
 * ao planejar a consulta, mesmo dentro de um `CASE` (FR-397).
 */
const LISTAR_CARTOES_PENDENTES_COM_VINCULO = `
SELECT cartao.id, cartao.frente, cartao.verso,
       (
         SELECT COALESCE(json_agg(
           json_build_object('id', baralho.id, 'nome', baralho.nome)
           ORDER BY baralho.nome, baralho.id
         ), '[]'::json)
           FROM vinculo
           JOIN baralho ON baralho.id = vinculo.baralho_id
          WHERE vinculo.cartao_id = cartao.id
            AND baralho.usuario_id = cartao.usuario_id
       ) AS baralhos_json
  FROM cartao
 WHERE cartao.usuario_id = $1
   AND NOT EXISTS (
     SELECT 1 FROM pertencimento WHERE pertencimento.cartao_id = cartao.id
   )
 ORDER BY cartao.id;
`;

/**
 * Confere que um Cartão de `pertencimentos` ainda é pendente (sem Pertencimento).
 */
const CONFERIR_CARTAO_PENDENTE = `
SELECT 1 FROM cartao
 WHERE id = $1 AND usuario_id = $2
   AND NOT EXISTS (
     SELECT 1 FROM pertencimento WHERE pertencimento.cartao_id = cartao.id
   );
`;

/**
 * Confere que o Baralho existe e é do dono.
 */
const CONFERIR_BARALHO_DO_USUARIO = `
SELECT 1 FROM baralho WHERE id = $1 AND usuario_id = $2;
`;

/**
 * Atualiza apenas a Frente do Cartão na transação de aplicarTransicao (FR-397).
 */
const ATUALIZAR_FRENTE_DO_CARTAO = `
UPDATE cartao SET frente = $1 WHERE id = $2 AND usuario_id = $3;
`;

/**
 * Remove Vínculos legados de um Cartão, se a tabela existir (FR-397).
 */
const REMOVER_VINCULOS_DO_CARTAO = `
DELETE FROM vinculo WHERE cartao_id = $1;
`;

const INSERIR_ACESSO = `
INSERT INTO acesso_temporario (digest, usuario_id, criado_em, expira_em, ultima_acao_em)
VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $3::timestamptz);
`;

const OBTER_ACESSO = `
SELECT usuario_id, expira_em > $2::timestamptz AS valido
  FROM acesso_temporario
 WHERE digest = $1;
`;

const RENOVAR_ACESSO = `
UPDATE acesso_temporario
   SET expira_em = $2::timestamptz, ultima_acao_em = $3::timestamptz
 WHERE digest = $1;
`;

const ENCERRAR_ACESSO = `
DELETE FROM acesso_temporario WHERE digest = $1;
`;

const ENCERRAR_ACESSOS_DO_USUARIO = `
DELETE FROM acesso_temporario WHERE usuario_id = $1;
`;

const REMOVER_ACESSOS_EXPIRADOS = `
DELETE FROM acesso_temporario WHERE expira_em < $1::timestamptz;
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

/**
 * A serialização por Usuário de `gravarRotina` (FR-248): a linha de `usuario` é
 * travada com `FOR UPDATE` no início da transação, de modo que a verificação de
 * `operacaoId`, a existência/CAS e as gravações da Rotina acontecem atômicas —
 * duas chamadas do mesmo Usuário serializam, e a segunda lê o resultado da
 * primeira como reenvio ou reuso.
 */
const TRAVAR_USUARIO_PARA_GRAVACAO = `
SELECT 1 FROM usuario WHERE id = $1 FOR UPDATE;
`;

/**
 * A inserção da Rotina nova (FR-248). `criada_em` é `TIMESTAMPTZ` e `versoes` é
 * `JSONB`, como as demais tabelas do acervo.
 */
const INSERIR_ROTINA = `
INSERT INTO rotina_de_estudo
       (id, usuario_id, baralho_id, estado, versao, criada_em, versoes)
VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::jsonb);
`;

/**
 * O CAS da Rotina (FR-248): grava só se a versão guardada é a esperada, e a
 * ausência de linha alterada distingue a Rotina inexistente ou de outro dono da
 * versão divergente.
 */
const ATUALIZAR_ROTINA_POR_CAS = `
UPDATE rotina_de_estudo
   SET baralho_id = $1, estado = $2, versao = $3, versoes = $4::jsonb
 WHERE id = $5 AND usuario_id = $6 AND versao = $7;
`;

const OBTER_ROTINA_DO_USUARIO = `
SELECT id,
       baralho_id AS "baralhoId",
       estado,
       versao,
       criada_em  AS "criadaEm",
       versoes
  FROM rotina_de_estudo
 WHERE id = $1 AND usuario_id = $2;
`;

/** Confere a posse da Rotina sem carregar a programação (FR-248, FR-250). */
const VERIFICAR_ROTINA_DO_USUARIO = `
SELECT 1 FROM rotina_de_estudo WHERE id = $1 AND usuario_id = $2;
`;

/**
 * A busca por `id` sem escopo de dono é deliberada: é ela que reconhece a
 * criação com `id` repetido — de qualquer dono — como `conflito`, sem que a
 * Rotina alheia atravesse a Porta (FR-248).
 */
const OBTER_ROTINA_POR_ID = `
SELECT id FROM rotina_de_estudo WHERE id = $1;
`;

/** Distingue a Rotina ausente da versão divergente após um UPDATE sem linha. */
const OBTER_VERSAO_DA_ROTINA = `
SELECT versao FROM rotina_de_estudo WHERE id = $1 AND usuario_id = $2;
`;

const LISTAR_ROTINAS = `
SELECT id,
       baralho_id AS "baralhoId",
       estado,
       versao,
       criada_em  AS "criadaEm",
       versoes
  FROM rotina_de_estudo
 WHERE usuario_id = $1;
`;

const OBTER_OPERACAO_DE_ROTINA = `
SELECT intencao, resultado
  FROM operacao_de_rotina
 WHERE usuario_id = $1 AND operacao_id = $2;
`;

/**
 * O registro da operação de Rotina (FR-248). A chave primária `(usuario_id,
 * operacao_id)` é o que faz o reenvio idempotente parar aqui; o `ON CONFLICT
 * ... DO NOTHING` transforma a criação concorrente com o mesmo `operacaoId` em
 * reenvio/conflito, sem que o `23505` do driver vaze (FR-248).
 */
const INSERIR_OPERACAO_DE_ROTINA = `
INSERT INTO operacao_de_rotina
       (usuario_id, operacao_id, rotina_id, intencao, resultado)
VALUES ($1, $2, $3, $4, $5::jsonb)
ON CONFLICT (usuario_id, operacao_id) DO NOTHING;
`;

/**
 * A reativação (FR-239) remove só a exceção `cancelado`: a linha `concluido`
 * nunca é apagada (FR-245).
 */
const REMOVER_COMPROMISSO_CANCELADO = `
DELETE FROM compromisso_de_estudo
 WHERE rotina_id = $1 AND data = $2 AND usuario_id = $3
   AND estado = 'cancelado';
`;

const INSERIR_COMPROMISSO = `
INSERT INTO compromisso_de_estudo
       (rotina_id, data, usuario_id, estado, registro_id, baralho_id,
        nome_do_baralho, quantidade)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
`;

const ATUALIZAR_COMPROMISSO = `
UPDATE compromisso_de_estudo
   SET estado = $1, registro_id = $2, baralho_id = $3,
       nome_do_baralho = $4, quantidade = $5
 WHERE rotina_id = $6 AND data = $7 AND usuario_id = $8;
`;

const OBTER_COMPROMISSO_DO_USUARIO = `
SELECT rotina_id       AS "rotinaId",
       data,
       estado,
       registro_id     AS "registroId",
       baralho_id      AS "baralhoId",
       nome_do_baralho AS "nomeDoBaralho",
       quantidade
  FROM compromisso_de_estudo
 WHERE rotina_id = $1 AND data = $2 AND usuario_id = $3;
`;

const LISTAR_COMPROMISSOS = `
SELECT rotina_id       AS "rotinaId",
       data,
       estado,
       registro_id     AS "registroId",
       baralho_id      AS "baralhoId",
       nome_do_baralho AS "nomeDoBaralho",
       quantidade
  FROM compromisso_de_estudo
 WHERE usuario_id = $1 AND data >= $2 AND data <= $3;
`;

const INSERIR_INICIO = `
INSERT INTO inicio_de_compromisso
       (id, usuario_id, rotina_id, data, iniciado_em, fuso, baralho_id,
        nome_do_baralho, quantidade, cartoes)
VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10::jsonb);
`;

/**
 * A busca por `id` sem escopo de dono é deliberada: é ela que distingue o
 * reenvio do mesmo Usuário do `id` que já pertence a outro (FR-250), como em
 * `registro_de_sessao`.
 */
const OBTER_INICIO_POR_ID = `
SELECT id,
       usuario_id      AS "usuarioId",
       rotina_id       AS "rotinaId",
       data,
       iniciado_em     AS "iniciadoEm",
       fuso,
       baralho_id      AS "baralhoId",
       nome_do_baralho AS "nomeDoBaralho",
       quantidade,
       cartoes
  FROM inicio_de_compromisso
 WHERE id = $1;
`;

const OBTER_INICIO_DO_USUARIO = `
SELECT id,
       rotina_id       AS "rotinaId",
       data,
       iniciado_em     AS "iniciadoEm",
       fuso,
       baralho_id      AS "baralhoId",
       nome_do_baralho AS "nomeDoBaralho",
       quantidade,
       cartoes
  FROM inicio_de_compromisso
 WHERE id = $1 AND usuario_id = $2;
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

/**
 * Linha de `baralho` com o dono: é o que distingue o reenvio idempotente — o
 * Baralho já é do próprio Usuário — do `id` tomado por outro dono, que é
 * `conflito` (FR-372, FR-373).
 */
type LinhaDeBaralhoComDono = LinhaDeBaralho & { usuarioId: string };

/** Linha de CartaoPendente: Cartão sem Pertencimento com Baralhos legados (FR-397). */
type LinhaDeCartaoPendente = LinhaDeCartao & {
  baralhos_json: Baralho[];
};

/**
 * Linha de Cartão com seu Baralho dono: a forma que LISTAR_CARTOES devolve
 * com JOIN a pertencimento e baralho (FR-389).
 */
type LinhaDeCartaoComDono = LinhaDeCartao & {
  baralho_id: string;
  baralho_nome: string;
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
  origem: "baralho" | "revisao" | "temporario";
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
  avaliacaoRotulo: string | null;
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
};

/** Linha de Item com Avaliação, para o replay dos Agendamentos (FR-213). */
type LinhaDeItemAvaliado = {
  cartaoId: string;
  avaliacao: Avaliacao;
  concluidaEm: Instante;
  posicao: number;
};

/** Linha de `rotina_de_estudo`; `versoes` é `JSONB` e chega já como objeto. */
type LinhaDeRotina = {
  id: string;
  baralhoId: string | null;
  estado: EstadoDaRotina;
  versao: number;
  criadaEm: Instante;
  versoes: readonly VersaoDaRotina[];
};

/**
 * Linha de `operacao_de_rotina`; `resultado` é `JSONB` e chega já como objeto —
 * é o retrato da Rotina gravada naquela operação (FR-248).
 */
type LinhaDeOperacaoDeRotina = {
  intencao: string;
  resultado: RotinaArmazenada;
};

/** Linha de `compromisso_de_estudo`; só exceções e conclusões (FR-250). */
type LinhaDeCompromisso = {
  rotinaId: string;
  data: string;
  estado: EstadoPersistidoDoCompromisso;
  registroId: string | null;
  baralhoId: string;
  nomeDoBaralho: string;
  quantidade: number | null;
};

/** Linha de `inicio_de_compromisso`; `cartoes` é `JSONB` e chega como objeto. */
type LinhaDeInicio = {
  id: string;
  rotinaId: string;
  data: string;
  iniciadoEm: Instante;
  fuso: string;
  baralhoId: string;
  nomeDoBaralho: string;
  quantidade: number | null;
  cartoes: readonly Cartao[];
};

/** Linha de `inicio_de_compromisso` com o dono, para a distinção do conflito. */
type LinhaDeInicioComDono = LinhaDeInicio & { usuarioId: string };

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

/** Desfecho de falha do armazenamento na criação de Baralho com Cópias (FR-400). */
const BARALHO_COM_COPIAS_INDISPONIVEL: DesfechoDeBaralhoComCopias = {
  ok: false,
  erro: "indisponivel",
};

/**
 * Desfecho do `id` de Baralho já usado por **outro** dono (FR-400): o reenvio
 * do mesmo Usuário é idempotente, mas o `id` tomado não pode ser sobrescrito.
 */
const BARALHO_COM_COPIAS_EM_CONFLITO: DesfechoDeBaralhoComCopias = {
  ok: false,
  erro: "conflito",
};

/**
 * Executa a operação e traduz a falha do driver em `indisponivel` no
 * vocabulário da criação de Baralho com Cópias (FR-400). Os desfechos de
 * domínio — `conflito` — são devolvidos antes de qualquer exceção e atravessam
 * intactos; nenhum erro do driver chega ao chamador (FR-107, FR-118).
 */
async function comDesfechoDeBaralhoComCopias(
  operacao: () => Promise<DesfechoDeBaralhoComCopias>,
): Promise<DesfechoDeBaralhoComCopias> {
  try {
    return await operacao();
  } catch {
    return BARALHO_COM_COPIAS_INDISPONIVEL;
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

/**
 * Como `emTransacao`, mas para corpos que devolvem um desfecho: a recusa
 * (`ok: false`) também desfaz tudo o que o corpo já gravou, de modo que
 * nenhuma recusa da Porta deixa escrita parcial (FR-397, FR-398, FR-400).
 */
async function emTransacaoComDesfecho<T extends { ok: boolean }>(
  piscina: Pool,
  corpo: (cliente: PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await piscina.connect();

  try {
    await cliente.query("BEGIN;");

    const resultado = await corpo(cliente);

    await cliente.query(resultado.ok ? "COMMIT;" : "ROLLBACK;");

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

/**
 * Confere se a tabela legada `vinculo` ainda existe usando `to_regclass`.
 * Devolve true se existe, false caso contrário.
 */
async function temTabelaVinculo(conexao: Conexao): Promise<boolean> {
  try {
    const { rows } = await conexao.query<{ existe: boolean }>(
      "SELECT to_regclass('vinculo') IS NOT NULL AS existe;",
    );

    return rows[0]?.existe ?? false;
  } catch {
    return false;
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

/** Lê a linha como CartaoPendente: Cartão sem Pertencimento com Baralhos legados (FR-397). */
function cartaoPendenteDaLinha(linha: LinhaDeCartaoPendente): CartaoPendente {
  const cartao = cartaoDaLinha(linha);
  // O driver `pg` já entrega a coluna `json` decodificada.
  return { cartao, baralhos: linha.baralhos_json };
}

/** Lê a linha como CartaoComDono: Cartão com seu Baralho dono (FR-389). */
function cartaoComDonoDaLinha(linha: LinhaDeCartaoComDono): CartaoComDono {
  return {
    id: linha.id,
    frente: linha.frente,
    verso: linha.verso,
    baralho: { id: linha.baralho_id, nome: linha.baralho_nome },
  };
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
    avaliacaoRotulo: linha.avaliacaoRotulo ?? null,
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
 * equivale a `algoritmo = "sm2"`, e a leitura o
 * sintetiza sem gravar linha a priori (FR-212).
 */
const PREFERENCIAS_PADRAO: Preferencias = {
  algoritmo: "sm2",
};

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
 * Sinal interno de que a inserção em `operacao_de_rotina` colidiu com a PK:
 * outra transação do mesmo Usuário já gravou este `operacaoId`. A decisão
 * entre reenvio e conflito acontece num `emTransacao` novo, depois do
 * rollback da transação em curso (FR-248).
 */
class OperacaoDeRotinaConcorrente extends Error {}

/**
 * Executa a operação e traduz a falha do driver em `indisponivel` no
 * vocabulário próprio da Porta de Rotina (FR-248). Como nas demais operações,
 * nenhum erro do driver atravessa a Interface (FR-107).
 */
async function comDesfechoDeRotina<T>(
  operacao: () => Promise<DesfechoDeRotina<T>>,
): Promise<DesfechoDeRotina<T>> {
  try {
    return await operacao();
  } catch {
    return ROTINA_INDISPONIVEL;
  }
}

/**
 * Lê a linha como Rotina de estudo (FR-248); `versoes` chega já como objeto do
 * driver, porque a coluna é `JSONB`, e o `baralho_id` nulo é a Rotina
 * indisponível — o Baralho foi excluído e a programação permanece.
 */
function rotinaDaLinha(linha: LinhaDeRotina): RotinaArmazenada {
  return {
    id: linha.id,
    criadaEm: instanteIso(linha.criadaEm),
    versao: linha.versao,
    estado: linha.estado,
    baralhoId: linha.baralhoId,
    versoes: linha.versoes,
  };
}

/**
 * Lê a linha como Compromisso persistido (FR-250): só exceções e conclusões,
 * com a configuração capturada no momento do compromisso.
 */
function compromissoDaLinha(
  linha: LinhaDeCompromisso,
): CompromissoPersistido {
  return {
    rotinaId: linha.rotinaId,
    data: linha.data,
    estado: linha.estado,
    registroId: linha.registroId,
    baralhoId: linha.baralhoId,
    nomeDoBaralho: linha.nomeDoBaralho,
    quantidade: linha.quantidade,
  };
}

/**
 * Lê a linha como Início autorizado (FR-250); `cartoes` chega já como objeto do
 * driver, porque a coluna é `JSONB`, e a ordem preservada é a que o servidor
 * escolheu.
 */
function inicioDaLinha(linha: LinhaDeInicio): InicioAutorizado {
  return {
    id: linha.id,
    rotinaId: linha.rotinaId,
    data: linha.data,
    iniciadoEm: instanteIso(linha.iniciadoEm),
    fuso: linha.fuso,
    baralhoId: linha.baralhoId,
    nomeDoBaralho: linha.nomeDoBaralho,
    quantidade: linha.quantidade,
    cartoes: linha.cartoes,
  };
}

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
      item.avaliacaoRotulo ?? null,
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
    /**
     * Insere um Cartão já validado e já numerado pelo Module e o seu
     * Pertencimento a `baralhoId`, numa única transação (FR-389, FR-390).
     * Baralho ausente ou de outro Usuário é `nao_encontrado`; Frente
     * normalizada já existente no Baralho é `frente_duplicada`, sem gravar nada
     * (FR-398).
     */
    async inserirCartaoNoBaralho(usuarioId, baralhoId, cartao) {
      return comDesfecho(async () => {
        try {
          return await emTransacaoComDesfecho<Desfecho<Cartao>>(
            piscina,
            async (cliente) => {
              /**
               * Confere que o Baralho existe e é do dono; senão, nada é gravado
               * (FR-092, SC-030).
               */
              const { rows: baralhos } = await cliente.query<LinhaDeBaralho>(
                OBTER_BARALHO,
                [baralhoId, usuarioId],
              );

              if (baralhos[0] === undefined) {
                return NAO_ENCONTRADO;
              }

              /**
               * Insere o Cartão e o Pertencimento numa transação só. Violação de
               * UNIQUE(baralho_id, frente_chave) → frente_duplicada (FR-398).
               */
              await cliente.query(INSERIR_CARTAO_NO_BARALHO, [
                cartao.id,
                cartao.frente,
                cartao.verso,
                usuarioId,
                new Date().toISOString(),
              ]);

              await cliente.query(INSERIR_PERTENCIMENTO, [
                cartao.id,
                baralhoId,
                normalizarFrente(cartao.frente),
              ]);

              return { ok: true, valor: cartao };
            },
          );
        } catch (erro) {
          if (
            ehViolacao(erro, VIOLACAO_DE_UNICIDADE, CHAVE_UNICA_DE_PERTENCIMENTO)
          ) {
            return FRENTE_DUPLICADA;
          }

          throw erro;
        }
      });
    },

    async listarCartoes(usuarioId) {
      const { rows } = await piscina.query<LinhaDeCartaoComDono>(
        LISTAR_CARTOES,
        [usuarioId],
      );

      return rows.map(cartaoComDonoDaLinha);
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

    /**
     * Grava Frente e Verso do Cartão de `cartao.id` no acervo de `usuarioId` e
     * atualiza a chave normalizada do Pertencimento. Ausente é `nao_encontrado`;
     * colisão com outro Cartão do mesmo Baralho é `frente_duplicada`, sem
     * alterar nada (FR-399).
     */
    async atualizarCartao(usuarioId, cartao) {
      return comDesfecho(async () => {
        try {
          return await emTransacaoComDesfecho<Desfecho<Cartao>>(
            piscina,
            async (cliente) => {
              const { rowCount: alteradas } = await cliente.query(
                ATUALIZAR_CARTAO,
                [cartao.frente, cartao.verso, cartao.id, usuarioId],
              );

              if ((alteradas ?? 0) === 0) {
                return NAO_ENCONTRADO;
              }

              /**
               * Se o Cartão tem Pertencimento, atualiza a chave normalizada.
               * Violação de UNIQUE(baralho_id, frente_chave) → ROLLBACK automático
               * (FR-399).
               */
              const { rows: pertencimentos } = await cliente.query<{
                baralho_id: string;
              }>(
                "SELECT baralho_id FROM pertencimento WHERE cartao_id = $1",
                [cartao.id],
              );

              if (pertencimentos[0]) {
                await cliente.query(
                  "UPDATE pertencimento SET frente_chave = $1 WHERE cartao_id = $2",
                  [normalizarFrente(cartao.frente), cartao.id],
                );
              }

              return { ok: true, valor: cartao };
            },
          );
        } catch (erro) {
          if (
            ehViolacao(erro, VIOLACAO_DE_UNICIDADE, CHAVE_UNICA_DE_PERTENCIMENTO)
          ) {
            return FRENTE_DUPLICADA;
          }

          throw erro;
        }
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

    /**
     * Cria o Baralho e as cópias — Cartões novos já numerados pelo Module, cada
     * um com Pertencimento ao Baralho novo — numa única transação (FR-400). O
     * mesmo `id` do mesmo dono devolve o Baralho guardado (`novo: false`), sem
     * gravar de novo; de outro dono é `conflito`. Cópias não recebem Agendamento.
     */
    async inserirBaralhoComCopias(usuarioId, baralho, copias) {
      return comDesfechoDeBaralhoComCopias(() =>
        emTransacaoComDesfecho<DesfechoDeBaralhoComCopias>(piscina, async (cliente) => {
          const { rows } = await cliente.query<LinhaDeBaralhoComDono>(
            OBTER_BARALHO_DE_QUALQUER_DONO,
            [baralho.id],
          );
          const existente = rows[0];

          if (existente !== undefined) {
            /**
             * O mesmo `id` do mesmo Usuário é a retentativa idempotente
             * (FR-400): o Baralho guardado volta intacto, com `novo: false`, e
             * nada é gravado de novo. O `id` de **outro** Usuário é recusa de
             * domínio (FR-400), sem que nada do Baralho alheio atravesse a
             * Porta.
             */
            return existente.usuarioId === usuarioId
              ? {
                  ok: true,
                  valor: {
                    baralho: baralhoDaLinha(existente),
                    novo: false,
                  },
                }
              : BARALHO_COM_COPIAS_EM_CONFLITO;
          }

          /**
           * Insere o Baralho, depois insere cada cópia com seu Pertencimento
           * (FR-400). Violação de UNIQUE(baralho_id, frente_chave) →
           * ROLLBACK automático via emTransacao.
           */
          await cliente.query(INSERIR_BARALHO, [
            baralho.id,
            baralho.nome,
            usuarioId,
          ]);

          for (const copia of copias) {
            /**
             * O `criado_em` é o instante corrente e não faz parte de `Cartao`:
             * existe só para ordenar Cartões novos por criação (FR-201).
             */
            await cliente.query(INSERIR_CARTAO_NO_BARALHO, [
              copia.id,
              copia.frente,
              copia.verso,
              usuarioId,
              new Date().toISOString(),
            ]);

            /**
             * Insere o Pertencimento com a Frente normalizada.
             */
            await cliente.query(INSERIR_PERTENCIMENTO, [
              copia.id,
              baralho.id,
              normalizarFrente(copia.frente),
            ]);
          }

          return { ok: true, valor: { baralho, novo: true } };
        }),
      );
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

    /**
     * Exclui, numa única transação, o Baralho de `id` do acervo de `usuarioId`,
     * os Cartões que lhe pertencem e, pela cascata, os seus Pertencimentos e
     * Agendamentos; os Registros de sessão ficam intactos (FR-402). Ausente é
     * `nao_encontrado`; falha não remove nada.
     */
    async excluirBaralho(usuarioId, id) {
      return comDesfecho(async () =>
        emTransacaoComDesfecho<Desfecho<void>>(piscina, async (cliente) => {
          /**
           * Confere que o Baralho existe e é do dono; senão, nada é alterado
           * (FR-402).
           */
          const { rows: baralhos } = await cliente.query<LinhaDeBaralho>(
            OBTER_BARALHO,
            [id, usuarioId],
          );

          if (baralhos[0] === undefined) {
            return NAO_ENCONTRADO;
          }

          /**
           * Exclui os Cartões do dono cujo Pertencimento aponta para o Baralho;
           * as cascatas do esquema removem os Pertencimentos e Agendamentos
           * (FR-402).
           */
          await cliente.query(EXCLUIR_CARTOES_PERTENCIMENTO_BARALHO, [
            usuarioId,
            id,
          ]);

          /**
           * Exclui o Baralho depois (a ordem não importa aqui, porque os
           * Pertencimentos já foram cascateados).
           */
          await cliente.query(EXCLUIR_BARALHO, [id, usuarioId]);

          return SEM_CARGA;
        }),
      );
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
     * Devolve os Cartões de `usuarioId` ainda sem Pertencimento, com os Baralhos
     * do Usuário a que estavam vinculados na tabela legada `vinculo` (FR-397).
     * Sem a tabela legada — base já na versão 14 —, `baralhos` é vazio. Lista
     * vazia significa transição concluída para esse Usuário.
     */
    async listarCartoesPendentes(usuarioId) {
      return comDesfecho(async () => {
        const { rows } = await piscina.query<LinhaDeCartaoPendente>(
          (await temTabelaVinculo(piscina))
            ? LISTAR_CARTOES_PENDENTES_COM_VINCULO
            : LISTAR_CARTOES_PENDENTES,
          [usuarioId],
        );

        return { ok: true, valor: rows.map(cartaoPendenteDaLinha) };
      });
    },

    /**
     * Aplica o plano de transição de `usuarioId` numa única transação (FR-397):
     * Pertencimentos com a Frente final, cópias com Pertencimento e remoção dos
     * Vínculos legados dos Cartões resolvidos pelo plano. Cartão que já não esteja
     * pendente, Baralho fora do acervo ou Frente colidente é `conflito`; falha é
     * `indisponivel`. Em qualquer recusa nada é aplicado.
     */
    async aplicarTransicao(usuarioId, plano) {
      return comDesfecho(async () => {
        try {
          return await emTransacaoComDesfecho<Desfecho<void>>(
            piscina,
            async (cliente) => {
              /**
               * Confere cada Pertencimento: Cartão do dono ainda pendente
               * e Baralho do dono.
               */
              for (const p of plano.pertencimentos) {
                const { rows: cartaoRows } = await cliente.query(
                  CONFERIR_CARTAO_PENDENTE,
                  [p.cartaoId, usuarioId],
                );

                if (cartaoRows[0] === undefined) {
                  return CONFLITO;
                }

                const { rows: baralhoRows } = await cliente.query(
                  CONFERIR_BARALHO_DO_USUARIO,
                  [p.baralhoId, usuarioId],
                );

                if (baralhoRows[0] === undefined) {
                  return CONFLITO;
                }

                /**
                 * Atualiza a Frente do Cartão e insere o Pertencimento
                 * (FR-397).
                 */
                await cliente.query(ATUALIZAR_FRENTE_DO_CARTAO, [
                  p.frente,
                  p.cartaoId,
                  usuarioId,
                ]);

                await cliente.query(INSERIR_PERTENCIMENTO, [
                  p.cartaoId,
                  p.baralhoId,
                  normalizarFrente(p.frente),
                ]);
              }

              /**
               * Insere as cópias: Cartões novos com Pertencimento (FR-397).
               */
              for (const copia of plano.copias) {
                await cliente.query(INSERIR_CARTAO_NO_BARALHO, [
                  copia.cartao.id,
                  copia.cartao.frente,
                  copia.cartao.verso,
                  usuarioId,
                  new Date().toISOString(),
                ]);

                await cliente.query(INSERIR_PERTENCIMENTO, [
                  copia.cartao.id,
                  copia.baralhoId,
                  normalizarFrente(copia.cartao.frente),
                ]);
              }

              /**
               * Remove os Vínculos legados dos Cartões resolvidos pelo plano,
               * se a tabela ainda existir (FR-397).
               */
              if (await temTabelaVinculo(cliente)) {
                for (const p of plano.pertencimentos) {
                  await cliente.query(REMOVER_VINCULOS_DO_CARTAO, [p.cartaoId]);
                }

                for (const copia of plano.copias) {
                  await cliente.query(REMOVER_VINCULOS_DO_CARTAO, [
                    copia.cartao.id,
                  ]);
                }
              }

              return SEM_CARGA;
            },
          );
        } catch (erro) {
          if (
            ehViolacao(erro, VIOLACAO_DE_UNICIDADE, CHAVE_UNICA_DE_PERTENCIMENTO)
          ) {
            return CONFLITO;
          }

          throw erro;
        }
      });
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
          ]);

          await cliente.query(EXCLUIR_AGENDAMENTOS, [usuarioId]);
          await gravarAgendamentos(cliente, usuarioId, agendamentos);

          return SEM_CARGA;
        }),
      );
    },

    /**
     * Grava uma Rotina de estudo no acervo de `usuarioId` (FR-248), numa única
     * transação idempotente e serializada por Usuário: a linha de `usuario` é
     * travada com `FOR UPDATE`, de modo que a verificação de `operacaoId`, a
     * existência/CAS e as gravações acontecem atômicas. Mesma `intencao`
     * devolve a Rotina guardada com `repetida: true`, sem gravar; outra
     * `intencao` recusa como `conflito`. `versaoEsperada === null` insere; caso
     * contrário, atualiza com CAS pela versão guardada, distinguindo
     * `nao_encontrado` de `conflito_de_versao`. A PK de `operacao_de_rotina` é
     * tratada como reenvio/conflito, sem vazar erro do driver (FR-044, FR-107,
     * FR-248).
     */
    async gravarRotina(usuarioId, gravacao) {
      return comDesfechoDeRotina<{
        rotina: RotinaArmazenada;
        repetida: boolean;
      }>(async () => {
        try {
          return await emTransacao<
            DesfechoDeRotina<{ rotina: RotinaArmazenada; repetida: boolean }>
          >(piscina, async (cliente) => {
            await cliente.query(TRAVAR_USUARIO_PARA_GRAVACAO, [usuarioId]);

            /**
             * A idempotência por `operacaoId`: a mesma `intencao` devolve a
             * Rotina guardada como resultado daquela operação, sem gravar de
             * novo; `intencao` diferente é reuso indevido e recusa como
             * `conflito` (FR-248).
             */
            const { rows: operacoes } =
              await cliente.query<LinhaDeOperacaoDeRotina>(
                OBTER_OPERACAO_DE_ROTINA,
                [usuarioId, gravacao.operacaoId],
              );

            if (operacoes[0] !== undefined) {
              return operacoes[0].intencao === gravacao.intencao
                ? {
                    ok: true,
                    valor: {
                      rotina: operacoes[0].resultado,
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
              const { rows: existentes } = await cliente.query<{ id: string }>(
                OBTER_ROTINA_POR_ID,
                [gravacao.rotina.id],
              );

              if (existentes[0] !== undefined) {
                return CONFLITO_DE_ROTINA;
              }

              await cliente.query(INSERIR_ROTINA, [
                gravacao.rotina.id,
                usuarioId,
                gravacao.rotina.baralhoId,
                gravacao.rotina.estado,
                gravacao.rotina.versao,
                gravacao.rotina.criadaEm,
                JSON.stringify(gravacao.rotina.versoes),
              ]);
            } else {
              /**
               * Atualização com CAS: só grava se a versão guardada é a
               * esperada. Nenhuma linha alterada distingue a Rotina
               * inexistente ou de outro dono (`nao_encontrado`) da versão
               * divergente (`conflito_de_versao`) (FR-248).
               */
              const { rowCount } = await cliente.query(
                ATUALIZAR_ROTINA_POR_CAS,
                [
                  gravacao.rotina.baralhoId,
                  gravacao.rotina.estado,
                  gravacao.rotina.versao,
                  JSON.stringify(gravacao.rotina.versoes),
                  gravacao.rotina.id,
                  usuarioId,
                  gravacao.versaoEsperada,
                ],
              );

              if ((rowCount ?? 0) === 0) {
                const { rows: versoes } = await cliente.query<{
                  versao: number;
                }>(OBTER_VERSAO_DA_ROTINA, [
                  gravacao.rotina.id,
                  usuarioId,
                ]);

                return versoes[0] === undefined
                  ? ROTINA_NAO_ENCONTRADA
                  : CONFLITO_DE_VERSAO;
              }
            }

            /**
             * Cancelamentos e reativações de hoje entram na mesma transação da
             * Rotina (FR-238, FR-239). O cancelamento só cria a linha quando
             * ainda não há nenhuma para `(rotina, data)`: a conclusão
             * existente prevalece (FR-245).
             */
            for (const cancelado of gravacao.cancelamentos ?? []) {
              const { rows: existentes } =
                await cliente.query<LinhaDeCompromisso>(
                  OBTER_COMPROMISSO_DO_USUARIO,
                  [cancelado.rotinaId, cancelado.data, usuarioId],
                );

              if (existentes[0] === undefined) {
                await cliente.query(INSERIR_COMPROMISSO, [
                  cancelado.rotinaId,
                  cancelado.data,
                  usuarioId,
                  "cancelado",
                  null,
                  cancelado.baralhoId,
                  cancelado.nomeDoBaralho,
                  cancelado.quantidade,
                ]);
              }
            }

            for (const data of gravacao.reativacoes ?? []) {
              await cliente.query(REMOVER_COMPROMISSO_CANCELADO, [
                gravacao.rotina.id,
                data,
                usuarioId,
              ]);
            }

            /**
             * A operação guarda o JSON da Rotina gravada: é ele que o reenvio
             * idempotente devolve como resultado (FR-248).
             */
            const { rowCount: inseridas } = await cliente.query(
              INSERIR_OPERACAO_DE_ROTINA,
              [
                usuarioId,
                gravacao.operacaoId,
                gravacao.rotina.id,
                gravacao.intencao,
                JSON.stringify(gravacao.rotina),
              ],
            );

            if ((inseridas ?? 0) === 0) {
              throw new OperacaoDeRotinaConcorrente();
            }

            return {
              ok: true,
              valor: { rotina: gravacao.rotina, repetida: false },
            };
          });
        } catch (erro) {
          if (erro instanceof OperacaoDeRotinaConcorrente) {
            /**
             * A criação concorrente do mesmo `operacaoId` desfaz as gravações
             * desta transação e re-lê a operação já confirmada: reenvio
             * idempotente quando a `intencao` coincide, `conflito` quando
             * diverge (FR-248).
             */
            return emTransacao<
              DesfechoDeRotina<{
                rotina: RotinaArmazenada;
                repetida: boolean;
              }>
            >(piscina, async (cliente) => {
              const { rows } = await cliente.query<LinhaDeOperacaoDeRotina>(
                OBTER_OPERACAO_DE_ROTINA,
                [usuarioId, gravacao.operacaoId],
              );

              if (rows[0] === undefined) {
                return CONFLITO_DE_ROTINA;
              }

              return rows[0].intencao === gravacao.intencao
                ? {
                    ok: true,
                    valor: { rotina: rows[0].resultado, repetida: true },
                  }
                : CONFLITO_DE_ROTINA;
            });
          }

          throw erro;
        }
      });
    },

    /**
     * Devolve a operação de Rotina `operacaoId` do Usuário (FR-249); ausente é
     * `nao_encontrado`.
     */
    async obterOperacaoDeRotina(usuarioId, operacaoId) {
      return comDesfecho<OperacaoDeRotinaGravada>(async () => {
        const { rows } = await piscina.query<LinhaDeOperacaoDeRotina>(
          OBTER_OPERACAO_DE_ROTINA,
          [usuarioId, operacaoId],
        );

        return rows[0] === undefined
          ? NAO_ENCONTRADO
          : {
              ok: true,
              valor: { intencao: rows[0].intencao, rotina: rows[0].resultado },
            };
      });
    },

    /**
     * Devolve a Rotina de `id` no acervo de `usuarioId` (FR-248); ausente —
     * inclusive quando é de outro dono — é `nao_encontrado`.
     */
    async obterRotina(usuarioId, id) {
      return comDesfecho<RotinaArmazenada>(async () => {
        const { rows } = await piscina.query<LinhaDeRotina>(
          OBTER_ROTINA_DO_USUARIO,
          [id, usuarioId],
        );

        return rows[0] === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: rotinaDaLinha(rows[0]) };
      });
    },

    /**
     * As Rotinas do Usuário, incluindo as excluídas (tombstones), sem ordem
     * prometida (FR-248).
     */
    async listarRotinas(usuarioId) {
      const { rows } = await piscina.query<LinhaDeRotina>(LISTAR_ROTINAS, [
        usuarioId,
      ]);

      return rows.map(rotinaDaLinha);
    },

    /**
     * Grava uma exceção ou conclusão de Compromisso no acervo de `usuarioId`
     * (FR-250) numa transação: Rotina inexistente ou de outro dono é
     * `nao_encontrado`. Sem linha para `(rotinaId, data)`, insere com
     * `alterado: true`. Com linha `concluido`, devolve a existente intacta
     * (`alterado: false`; conclusão imutável). Com linha `cancelado`, atualiza
     * estado, registro e configuração, preservando o `registroId` existente.
     */
    async gravarCompromisso(usuarioId, compromisso) {
      return comDesfecho<{
        compromisso: CompromissoPersistido;
        alterado: boolean;
      }>(() =>
        emTransacao<
          Desfecho<{ compromisso: CompromissoPersistido; alterado: boolean }>
        >(piscina, async (cliente) => {
          const { rowCount: rotinas } = await cliente.query(
            VERIFICAR_ROTINA_DO_USUARIO,
            [compromisso.rotinaId, usuarioId],
          );

          if ((rotinas ?? 0) === 0) {
            return NAO_ENCONTRADO;
          }

          const { rows: existentes } =
            await cliente.query<LinhaDeCompromisso>(
              OBTER_COMPROMISSO_DO_USUARIO,
              [compromisso.rotinaId, compromisso.data, usuarioId],
            );

          if (existentes[0] === undefined) {
            await cliente.query(INSERIR_COMPROMISSO, [
              compromisso.rotinaId,
              compromisso.data,
              usuarioId,
              compromisso.estado,
              compromisso.registroId,
              compromisso.baralhoId,
              compromisso.nomeDoBaralho,
              compromisso.quantidade,
            ]);

            return { ok: true, valor: { compromisso, alterado: true } };
          }

          /**
           * A conclusão é imutável: a linha `concluido` volta intacta, com o
           * `registroId` preservado (FR-250).
           */
          if (existentes[0].estado === "concluido") {
            return {
              ok: true,
              valor: {
                compromisso: compromissoDaLinha(existentes[0]),
                alterado: false,
              },
            };
          }

          const registroId =
            compromisso.registroId ?? existentes[0].registroId;

          await cliente.query(ATUALIZAR_COMPROMISSO, [
            compromisso.estado,
            registroId,
            compromisso.baralhoId,
            compromisso.nomeDoBaralho,
            compromisso.quantidade,
            compromisso.rotinaId,
            compromisso.data,
            usuarioId,
          ]);

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

    /**
     * Devolve o Compromisso de `(rotinaId, data)` no acervo de `usuarioId`
     * (FR-250); ausente — inclusive quando é de outro dono — é
     * `nao_encontrado`.
     */
    async obterCompromisso(usuarioId, rotinaId, data) {
      return comDesfecho<CompromissoPersistido>(async () => {
        const { rows } = await piscina.query<LinhaDeCompromisso>(
          OBTER_COMPROMISSO_DO_USUARIO,
          [rotinaId, data, usuarioId],
        );

        return rows[0] === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: compromissoDaLinha(rows[0]) };
      });
    },

    /**
     * Os Compromissos do Usuário na janela inclusiva, sem ordem prometida
     * (FR-250).
     */
    async listarCompromissos(usuarioId, de, ate) {
      const { rows } = await piscina.query<LinhaDeCompromisso>(
        LISTAR_COMPROMISSOS,
        [usuarioId, de, ate],
      );

      return rows.map(compromissoDaLinha);
    },

    /**
     * Guarda um Início autorizado no acervo de `usuarioId` (FR-250). Rotina
     * inexistente ou de outro dono é `nao_encontrado`; mesmo `id` de outro
     * Usuário é `conflito`; mesmo `id` do mesmo Usuário devolve o já guardado
     * sem alterar, como o Registro de Sessão.
     */
    async gravarInicio(usuarioId, inicio) {
      return comDesfecho<InicioAutorizado>(() =>
        emTransacao<Desfecho<InicioAutorizado>>(
          piscina,
          async (cliente) => {
            const { rowCount: rotinas } = await cliente.query(
              VERIFICAR_ROTINA_DO_USUARIO,
              [inicio.rotinaId, usuarioId],
            );

            if ((rotinas ?? 0) === 0) {
              return NAO_ENCONTRADO;
            }

            const { rows: existentes } =
              await cliente.query<LinhaDeInicioComDono>(
                OBTER_INICIO_POR_ID,
                [inicio.id],
              );

            if (existentes[0] !== undefined) {
              return existentes[0].usuarioId === usuarioId
                ? { ok: true, valor: inicioDaLinha(existentes[0]) }
                : CONFLITO_DE_REGISTRO;
            }

            await cliente.query(INSERIR_INICIO, [
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
            ]);

            return { ok: true, valor: inicio };
          },
        ),
      );
    },

    /**
     * Devolve o Início de `id` no acervo de `usuarioId` (FR-250); ausente —
     * inclusive quando é de outro dono — é `nao_encontrado`.
     */
    async obterInicio(usuarioId, id) {
      return comDesfecho<InicioAutorizado>(async () => {
        const { rows } = await piscina.query<LinhaDeInicio>(
          OBTER_INICIO_DO_USUARIO,
          [id, usuarioId],
        );

        return rows[0] === undefined
          ? NAO_ENCONTRADO
          : { ok: true, valor: inicioDaLinha(rows[0]) };
      });
    },

    /**
     * Conclui o Compromisso da Agenda numa **única transação** serializada por
     * Usuário (FR-233, FR-235, FR-256): a linha de `usuario` é travada com
     * `FOR UPDATE`, os Agendamentos e as Preferências são lidos **depois** do
     * bloqueio e o cálculo de domínio parte desse estado — duas conclusões
     * concorrentes do mesmo Usuário produzem Agendamentos coerentes com a ordem
     * serializada. O reenvio do mesmo `id` devolve o Registro guardado sem
     * recalcular.
     */
    async inserirRegistroDaAgenda(usuarioId, registro, compromisso, calcular) {
      return comDesfecho<{ registro: RegistroDeSessao; novo: boolean }>(() =>
        emTransacao<Desfecho<{ registro: RegistroDeSessao; novo: boolean }>>(
          piscina,
          async (cliente) => {
            await cliente.query(TRAVAR_USUARIO_PARA_GRAVACAO, [usuarioId]);

            const jaGuardado = await lerRegistroDoUsuario(
              cliente,
              usuarioId,
              registro.id,
            );

            if (jaGuardado !== undefined) {
              return { ok: true, valor: { registro: jaGuardado, novo: false } };
            }

            const { rows: linhasDePreferencias } =
              await cliente.query<LinhaDePreferencias>(OBTER_PREFERENCIAS, [
                usuarioId,
              ]);
            const preferencias =
              linhasDePreferencias[0] === undefined
                ? PREFERENCIAS_PADRAO
                : preferenciasDaLinha(linhasDePreferencias[0]);
            const { rows: linhasDeAgendamento } =
              await cliente.query<LinhaDeAgendamento>(LISTAR_AGENDAMENTOS, [
                usuarioId,
              ]);
            const agendamentos = linhasDeAgendamento.map(agendamentoDaLinha);

            const { rows } = await cliente.query<{ concluidaEm: Instante }>(
              INSERIR_REGISTRO_DE_SESSAO,
              parametrosDoRegistro(usuarioId, registro),
            );

            /**
             * Nenhuma linha devolvida: o `id` pertence a outro Usuário (o do
             * mesmo Usuário já foi tratado acima, sob o bloqueio).
             */
            if (rows[0] === undefined) {
              return CONFLITO_DE_REGISTRO;
            }

            await gravarItens(cliente, registro);
            await gravarAgendamentos(
              cliente,
              usuarioId,
              calcular({ agendamentos, preferencias }),
            );

            const { rows: atuais } = await cliente.query<LinhaDeCompromisso>(
              OBTER_COMPROMISSO_DO_USUARIO,
              [compromisso.rotinaId, compromisso.data, usuarioId],
            );

            if (atuais[0] === undefined) {
              await cliente.query(INSERIR_COMPROMISSO, [
                compromisso.rotinaId,
                compromisso.data,
                usuarioId,
                "concluido",
                compromisso.registroId,
                compromisso.baralhoId,
                compromisso.nomeDoBaralho,
                compromisso.quantidade,
              ]);
            } else if (atuais[0].estado !== "concluido") {
              await cliente.query(ATUALIZAR_COMPROMISSO, [
                "concluido",
                compromisso.registroId,
                compromisso.baralhoId,
                compromisso.nomeDoBaralho,
                compromisso.quantidade,
                compromisso.rotinaId,
                compromisso.data,
                usuarioId,
              ]);
            }

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

    async obterUsuarioPorId(id) {
      return comDesfechoDeUsuario<DesfechoDeLeituraDeUsuario>(
        async () => {
          const { rows } = await piscina.query<LinhaDeUsuario>(
            OBTER_USUARIO_POR_ID,
            [id],
          );

          return rows[0] === undefined
            ? USUARIO_NAO_ENCONTRADO
            : { ok: true, valor: usuarioDaLinha(rows[0]) };
        },
        USUARIO_INDISPONIVEL,
      );
    },

    async atualizarSenha(id, derivacao) {
      return comDesfechoDeUsuario<DesfechoDeOperacaoDeConta<void>>(
        async () => {
          const resultado = await piscina.query(ATUALIZAR_SENHA_DO_USUARIO, [
            Buffer.from(derivacao.sal),
            Buffer.from(derivacao.hash),
            derivacao.parametros,
            id,
          ]);

          return resultado.rowCount === 0
            ? USUARIO_NAO_ENCONTRADO
            : { ok: true, valor: undefined };
        },
        USUARIO_INDISPONIVEL,
      );
    },

    async excluirUsuario(id) {
      return comDesfechoDeUsuario<DesfechoDeOperacaoDeConta<void>>(
        async () => {
          const resultado = await piscina.query(EXCLUIR_USUARIO, [id]);

          return resultado.rowCount === 0
            ? USUARIO_NAO_ENCONTRADO
            : { ok: true, valor: undefined };
        },
        USUARIO_INDISPONIVEL,
      );
    },

    async contarDadosDoUsuario(id) {
      return comDesfechoDeUsuario<
        DesfechoDeOperacaoDeConta<ContagensDaConta>
      >(async () => {
        const { rows } = await piscina.query<{
          cartoes: number;
          baralhos: number;
          registros: number;
          agenda: number;
        }>(CONTAR_DADOS_DO_USUARIO, [id]);

        const linha = rows[0];

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
   * A terceira Porta, sobre o mesmo conjunto de conexões: o Acesso temporário.
   * Nenhum erro do driver atravessa — a falha é `indisponivel`, e jamais Acesso
   * ausente ou expirado (FR-301). A comparação de validade é feita pelo banco,
   * com o mesmo instante informado, e os instantes entram como ISO-8601 UTC.
   */
  const SEM_CARGA_DE_ACESSO: DesfechoDeAcesso<void> = {
    ok: true,
    valor: undefined,
  };
  const ACESSO_INDISPONIVEL = { ok: false, erro: "indisponivel" } as const;

  async function comDesfechoDeAcesso<D>(
    operacao: () => Promise<D>,
  ): Promise<D | typeof ACESSO_INDISPONIVEL> {
    try {
      return await operacao();
    } catch {
      return ACESSO_INDISPONIVEL;
    }
  }

  const acessos: ArmazenamentoDeAcessos = {
    async criar(digest, usuarioId, expiraEm) {
      return comDesfechoDeAcesso<DesfechoDeAcesso<void>>(async () => {
        await piscina.query(INSERIR_ACESSO, [
          digest,
          usuarioId,
          new Date().toISOString(),
          expiraEm,
        ]);

        return SEM_CARGA_DE_ACESSO;
      });
    },

    async obterValido(digest, agora) {
      return comDesfechoDeAcesso<DesfechoDeAcessoValido>(async () => {
        const { rows } = await piscina.query<{
          usuario_id: string;
          valido: boolean;
        }>(OBTER_ACESSO, [digest, agora]);
        const linha = rows[0];

        if (linha === undefined) {
          return { ok: false, erro: "nao_encontrado" };
        }

        return linha.valido
          ? { ok: true, valor: { usuarioId: linha.usuario_id } }
          : { ok: false, erro: "expirado" };
      });
    },

    async renovar(digest, novoExpiraEm) {
      return comDesfechoDeAcesso<DesfechoDeAcesso<void>>(async () => {
        const resultado = await piscina.query(RENOVAR_ACESSO, [
          digest,
          novoExpiraEm,
          new Date().toISOString(),
        ]);

        return resultado.rowCount === 0
          ? { ok: false, erro: "nao_encontrado" }
          : SEM_CARGA_DE_ACESSO;
      });
    },

    async encerrar(digest) {
      return comDesfechoDeAcesso<DesfechoDeAcesso<void>>(async () => {
        await piscina.query(ENCERRAR_ACESSO, [digest]);

        return SEM_CARGA_DE_ACESSO;
      });
    },

    async encerrarTodosDoUsuario(usuarioId) {
      return comDesfechoDeAcesso<DesfechoDeAcesso<void>>(async () => {
        await piscina.query(ENCERRAR_ACESSOS_DO_USUARIO, [usuarioId]);

        return SEM_CARGA_DE_ACESSO;
      });
    },

    async removerExpirados(agora) {
      return comDesfechoDeAcesso<DesfechoDeAcesso<number>>(async () => {
        const resultado = await piscina.query(REMOVER_ACESSOS_EXPIRADOS, [
          agora,
        ]);

        return { ok: true, valor: resultado.rowCount ?? 0 };
      });
    },
  };

  return {
    armazenamento,
    usuarios,
    acessos,

    async encerrar() {
      if (encerrado) {
        return;
      }

      encerrado = true;

      await piscina.end();
    },
  };
}
