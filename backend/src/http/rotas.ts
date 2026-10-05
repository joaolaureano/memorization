import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { ACESSO_EXPIRADO, SEM_ACESSO } from "../acesso/acesso.ts";
import type { Acessos } from "../acesso/acesso.ts";
import type { Acervo } from "../acervo/acervo.ts";
import type { AcaoDeRotina } from "../agenda/tipos.ts";
import { CREDENCIAL_INVALIDA } from "../identidade/identidade.ts";
import type { Identidade } from "../identidade/identidade.ts";
import { credencialDoCabecalho } from "./credencial.ts";

/**
 * O construtor do `Acervo` de **um** Usuário. As rotas o chamam por
 * requisição, com o `usuarioId` do Usuário que Entrou — decorado pelo hook da
 * Credencial —, e nunca guardam o `Acervo` de ninguém entre requisições
 * (FR-090, FR-092). A Interface do `Acervo` não muda: o que muda é o dono com
 * que ele é criado.
 */
export type AcervoDeUsuario = (usuarioId: string) => Acervo;

/**
 * Adapter HTTP do Module `Acervo` (T007, T207, T403, T503 e T805).
 *
 * As rotas são finas por construção: validam a **forma** do corpo na borda
 * com Zod, **aguardam** a Interface do `Acervo` — que passou a ser assíncrona
 * porque a Porta de armazenamento é assíncrona — e traduzem o resultado em
 * código de status. Nenhuma regra de domínio é reproduzida aqui — vazio,
 * conteúdo só de espaços, limite de tamanho, unicidade de Vínculo e cascata de
 * exclusão continuam sendo julgados exclusivamente pelo `Acervo`. Na recusa de
 * domínio, o adapter apenas repassa o código estável e a mensagem em português
 * que o `Acervo` devolveu (FR-046), sem inventar texto próprio.
 *
 * O contrato HTTP não muda: 201, 200, 204, 400, 404 e 409 continuam sendo os
 * mesmos de `001` a `006`. O único acréscimo é o status da falha do
 * armazenamento, que FR-044 e FR-107 exigem reportar em vez de deixar a
 * operação passar por concluída — e que o Adapter do cliente já trata como
 * indisponibilidade.
 */

/**
 * Forma do corpo de `POST /cartoes` e `PUT /cartoes/{id}`: exatamente Frente
 * e Verso, ambos texto (FR-001). O esquema **não é estrito**: propriedade
 * extra é descartada na borda e nunca alcança o `Acervo` nem as leituras — a
 * verificação de FR-009. Forma inválida (corpo ausente, campo ausente, tipo
 * errado, JSON malformado) é recusada aqui, antes de qualquer chamada ao
 * `Acervo`.
 */
const corpoDeCartao = z.object({
  frente: z.string(),
  verso: z.string(),
});

/**
 * FR-371 — forma do corpo de `POST /baralhos/de-selecao`: o `id` é o UUID
 * gerado pelo cliente uma vez por tentativa de salvar, `nome` segue as regras
 * de Baralho e `cartaoIds` é a seleção enviada. A validação semântica (UUID,
 * limites de `cartaoIds`, nome aparado) é do `Acervo`; aqui só a forma.
 */
const corpoDeSelecaoParaBaralho = z.object({
  id: z.string(),
  nome: z.string(),
  cartaoIds: z.array(z.string()),
});

/**
 * FR-374 — resposta de forma inválida ou de dados recusados pelo `Acervo`.
 * Única mensagem em português para os dois casos, sem detalhar o motivo.
 */
const DADOS_DA_SELECAO_INVALIDOS = {
  erro: "dados_invalidos",
  mensagem: "Os dados da seleção são inválidos.",
};

/**
 * FR-374 — mensagem do 409 de Cartões que não existem ou não são do Usuário.
 * A lista de ids acompanha a resposta e nunca revela dados alheios.
 */
const CARTOES_INDISPONIVEIS_MENSAGEM =
  "Alguns cartões não estão mais disponíveis.";

/**
 * FR-374 — resposta do 409 de colisão de `id` com outro Usuário; nada foi
 * gravado e a mesma tentativa pode ser repetida.
 */
const CONFLITO_DE_BARALHO = {
  erro: "conflito",
  mensagem: "Não foi possível salvar o baralho. Tente novamente.",
};

/**
 * Forma do corpo de `POST /baralhos` e `PUT /baralhos/{id}`: exatamente o
 * nome, texto (FR-010). O esquema **não é estrito**: propriedade extra é
 * descartada na borda e nunca alcança o `Acervo` nem as leituras — a
 * verificação de FR-018. Forma inválida é recusada aqui, antes de qualquer
 * chamada ao `Acervo`.
 */
const corpoDeBaralho = z.object({
  nome: z.string(),
});

/**
 * Forma do corpo de `POST /baralhos/{baralhoId}/vinculos`: exatamente o id do
 * Cartão a vincular, texto. Forma inválida é recusada na borda; a existência
 * do Cartão e a unicidade do par são julgadas pelo `Acervo`.
 */
const corpoDeVinculo = z.object({
  cartaoId: z.string(),
});

/**
 * Forma do corpo de `POST /usuarios`: exatamente o Nome de usuário e a Senha,
 * ambos texto (FR-071). O esquema **não é estrito**: propriedade extra — e a
 * Confirmação da Senha, que não faz parte deste contrato — é descartada na
 * borda e nunca alcança o `Identidade` (FR-072). Forma inválida é recusada aqui,
 * antes de qualquer chamada ao Module.
 */
const corpoDeUsuario = z.object({
  nomeDeUsuario: z.string(),
  senha: z.string(),
});

/**
 * Forma do corpo de `POST /sessoes`: o Registro de sessão que o cliente envia
 * ao concluir — o identificador que dá a idempotência, a Origem da Sessão
 * (`"baralho"` ou `"revisao"`), o Baralho e o seu nome no momento da conclusão
 * e a lista de Itens, cada um com Frente, Verso, Cartão de origem e Avaliação
 * (contrato da `015`, §4, FR-196).
 *
 * O esquema confere apenas a **forma**. Os limites de tamanho, a forma canônica
 * do identificador, o intervalo de 1 a 1000 Itens, a Origem conhecida, a
 * validade de Frente e Verso como Cartão, o Cartão de origem não vazio e a
 * Avaliação em um dos quatro níveis continuam sendo julgados exclusivamente
 * pelo `Acervo` (FR-161, FR-193, FR-196). O Resultado **não** vem do cliente:
 * ele é derivado da Avaliação lá (FR-194). Por isso a recusa de forma na borda
 * usa o **mesmo** código da recusa de domínio — `dados_invalidos` —, e o
 * cliente tem um só caminho para corpo inválido.
 */
const corpoDeRegistro = z.object({
  id: z.string(),
  /**
   * Identificador do Início autorizado pela Agenda, quando a Sessão foi iniciada
   * por um Compromisso (FR-254). A correspondência com o snapshot do servidor é
   * julgada pelo `Acervo`.
   */
  inicioAgendaId: z.string().optional(),
  origem: z.string(),
  baralhoId: z.string(),
  nomeDoBaralho: z.string(),
  itens: z.array(
    z.object({
      frente: z.string(),
      verso: z.string(),
      cartaoId: z.string(),
      avaliacao: z.string(),
    }),
  ),
});

/**
 * Forma da consulta de `GET /agenda`: o início da semana e o fuso IANA do
 * navegador (contrato da `016`). Datas e fuso válidos são julgados pelo
 * `Acervo`.
 */
const consultaDaAgenda = z.object({
  inicio: z.string(),
  fuso: z.string(),
});

/**
 * Forma do corpo de `POST /agenda/rotinas`: a intenção completa da operação
 * (contrato da `016`). O esquema confere só a forma; dias, quantidade, versão,
 * ação e fuso são julgados pelo `Acervo`, com o mesmo código `dados_invalidos`.
 */
const corpoDeRotina = z.object({
  operacaoId: z.string(),
  id: z.string().optional(),
  versao: z.number().optional(),
  acao: z.string(),
  baralhoId: z.string().optional(),
  dias: z.array(z.number()).optional(),
  quantidade: z.number().nullable().optional(),
  confirmarSobreposicao: z.boolean().optional(),
  fuso: z.string(),
});

/** Forma do corpo de `POST /agenda/inicios` (contrato da `016`). */
const corpoDeInicio = z.object({
  rotinaId: z.string(),
  data: z.string(),
  fuso: z.string(),
});

/**
 * Forma da consulta de `GET /estatisticas`: o `desde` da janela é um único
 * texto (contrato da `013`, §3). Ausente, repetido ou de outro tipo é recusado
 * na borda como `dados_invalidos`; se ele é um instante ISO-8601 utilizável
 * como limite, quem decide é o `Acervo` (FR-169).
 */
const consultaDaJanela = z.object({
  desde: z.string(),
});

/**
 * Forma do corpo de `POST /previas`: a lista de Cartões cuja prévia o estudo
 * livre quer mostrar (contrato da `015`, §4). O esquema confere apenas a forma;
 * o intervalo de 1 a 200 identificadores não vazios é julgado pelo `Acervo`
 * (FR-221), e por isso a recusa de forma usa o mesmo código da de domínio.
 */
const corpoDePrevias = z.object({
  cartaoIds: z.array(z.string()),
});

/**
 * Forma do corpo de `PUT /preferencias`: o algoritmo (contrato da `015`, §4).
 * O esquema confere apenas a forma; o algoritmo disponível é julgado pelo
 * `Acervo` (FR-212). Campos a mais, como o antigo limite de Cartões novos por
 * dia, são ignorados.
 */
const corpoDePreferencias = z.object({
  algoritmo: z.string(),
});

/**
 * Recusa uniforme de forma inválida na borda. Regra de domínio exige mensagem
 * útil ao usuário; forma inválida não — mas a resposta é estável e em
 * português, como toda a interface (FR-046). O código `corpo_invalido` não é
 * código de regra de Cartão: ele não aparece na tabela do contrato.
 */
export const CORPO_INVALIDO = {
  erro: "corpo_invalido",
  mensagem: "O corpo da requisição não é válido.",
} as const;

/**
 * Status da falha do armazenamento: o serviço não conseguiu ler nem gravar, e
 * a operação **não** foi concluída (FR-044, FR-045).
 */
const INDISPONIVEL = 503;

/**
 * Recusas das rotas de Histórico, cada uma com o código estável e a mensagem
 * em português — a mesma forma `{ erro, mensagem }` de todas as demais rotas
 * (FR-046).
 *
 * Os resultados desta feature carregam apenas o código (contrato da `013`), e
 * quem traduz a falha em frase para a tela é o cliente; ainda assim a resposta
 * carrega a mensagem, porque é ela que o Adapter do cliente exige em toda
 * recusa (FR-044). O isolamento por Usuário faz o registro alheio se comportar
 * como inexistente, e é `nao_encontrado` que a leitura de um registro de outro
 * Usuário recebe (FR-166, FR-179).
 */
const DADOS_DO_REGISTRO_INVALIDOS = {
  erro: "dados_invalidos",
  mensagem: "Os dados da Sessão são inválidos.",
} as const;
const REGISTRO_EM_CONFLITO = {
  erro: "conflito",
  mensagem: "Esta Sessão já foi registrada por outro Usuário.",
} as const;
const REGISTRO_NAO_ENCONTRADO = {
  erro: "nao_encontrado",
  mensagem: "Sessão não encontrada.",
} as const;
const INDISPONIVEL_DO_ARMAZENAMENTO = {
  erro: "indisponivel",
  mensagem: "O armazenamento está indisponível.",
} as const;

/**
 * Recusas das rotas de Revisão e de Preferências (contrato da `015`, §4), na
 * mesma forma `{ erro, mensagem }` das demais. Como nas rotas de Histórico, o
 * corpo carrega só o código estável, e é o Adapter do cliente que o traduz em
 * frase para a tela (FR-044).
 */
const DADOS_DA_REVISAO_INVALIDOS = {
  erro: "dados_invalidos",
  mensagem: "Os dados da Revisão são inválidos.",
} as const;
const DADOS_DAS_PREFERENCIAS_INVALIDOS = {
  erro: "dados_invalidos",
  mensagem: "Os dados das Preferências são inválidos.",
} as const;

/**
 * Responde a falha do armazenamento com o código estável e a mensagem em
 * português que o `Acervo` produziu, e com nada mais: nenhum detalhe do
 * driver, caminho de arquivo, URL, senha ou cadeia de conexão atravessa a
 * resposta (FR-107, FR-108).
 */
function responderIndisponivel(
  resposta: FastifyReply,
  recusa: { erro: string; mensagem: string },
) {
  return resposta.status(INDISPONIVEL).send({
    erro: recusa.erro,
    mensagem: recusa.mensagem,
  });
}

/**
 * Registra as rotas de Cartão do contrato sobre o `Acervo` do Usuário que
 * Entrou: `POST /cartoes`, `GET /cartoes`, `PUT /cartoes/{id}` e
 * `DELETE /cartoes/{id}`. Chamada na inicialização, com o construtor do
 * `Acervo` real, e nos testes de contrato, com o `Acervo` sobre o Adapter do
 * armazenamento local.
 *
 * O `Acervo` de quem Entrou é construído **dentro** de cada handler, a partir do
 * dono decorado na requisição pelo hook da Credencial: nenhum `Acervo` é
 * guardado entre requisições, e toda operação é, por construção, restrita ao
 * acervo de quem Entrou (FR-090, FR-092).
 */
export function registrarRotasDeCartoes(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.post("/cartoes", async (requisicao, resposta) => {
    const corpo = corpoDeCartao.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.criarCartao(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      return resposta.status(400).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(201).send(resultado.cartao);
  });

  servidor.get("/cartoes", async (requisicao) =>
    acervoDe(requisicao.usuarioQueEntrou.id).listarCartoes(),
  );

  servidor.put("/cartoes/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const corpo = corpoDeCartao.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.editarCartao(id, corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      if (resultado.erro === "nao_encontrado") {
        return resposta.status(404).send({
          erro: resultado.erro,
          mensagem: resultado.mensagem,
        });
      }

      return resposta.status(400).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(200).send(resultado.cartao);
  });

  servidor.delete("/cartoes/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.excluirCartao(id);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      return resposta.status(404).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(204).send();
  });
}

/**
 * Registra as rotas de Baralho e de Vínculo do contrato sobre o `Acervo` de
 * quem Entrou: `POST /baralhos`, `GET /baralhos`, `GET /baralhos/{id}`,
 * `PUT /baralhos/{id}`, `DELETE /baralhos/{id}`,
 * `POST /baralhos/{baralhoId}/vinculos` e
 * `DELETE /baralhos/{baralhoId}/vinculos/{cartaoId}`. Mesma estrutura fina
 * das rotas de Cartão: o `Acervo` é construído em cada handler, a partir do
 * dono decorado na requisição pelo hook da Credencial (FR-090, FR-092), a
 * forma é validada na borda, a regra de domínio é julgada exclusivamente pelo
 * `Acervo`, e a recusa de domínio é repassada com o código estável e a
 * mensagem em português devolvidos pela Interface (FR-046).
 */
export function registrarRotasDeBaralhos(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.post("/baralhos", async (requisicao, resposta) => {
    const corpo = corpoDeBaralho.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.criarBaralho(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      return resposta.status(400).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(201).send(resultado.baralho);
  });

  /**
   * FR-371 a FR-374 — `POST /baralhos/de-selecao`: cria, num gesto único, um
   * Baralho com Vínculos para os Cartões informados. O `id` enviado pelo
   * cliente torna o reenvio idempotente: o mesmo `id` devolve `200` com o mesmo
   * Baralho e nada é gravado de novo; um `id` novo devolve `201`. Corpo fora da
   * forma, nome inválido e dados recusados são `400`; Cartões indisponíveis e
   * colisão de `id` são `409`; falha do armazenamento é a indisponibilidade
   * vigente, sem gravação parcial.
   */
  servidor.post("/baralhos/de-selecao", async (requisicao, resposta) => {
    const corpo = corpoDeSelecaoParaBaralho.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_SELECAO_INVALIDOS);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.salvarSelecaoComoBaralho(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      if (resultado.erro === "cartoes_indisponiveis") {
        return resposta.status(409).send({
          erro: resultado.erro,
          mensagem: CARTOES_INDISPONIVEIS_MENSAGEM,
          cartaoIds: resultado.cartaoIds,
        });
      }

      if (resultado.erro === "conflito") {
        return resposta.status(409).send(CONFLITO_DE_BARALHO);
      }

      if (resultado.erro === "dados_invalidos") {
        return resposta.status(400).send(DADOS_DA_SELECAO_INVALIDOS);
      }

      return resposta.status(400).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(resultado.novo ? 201 : 200).send(resultado.baralho);
  });

  servidor.get("/baralhos", async (requisicao) =>
    acervoDe(requisicao.usuarioQueEntrou.id).listarBaralhos(),
  );

  servidor.get("/baralhos/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.obterBaralho(id);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      return resposta.status(404).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(200).send(resultado.baralho);
  });

  servidor.put("/baralhos/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const corpo = corpoDeBaralho.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.renomearBaralho(id, corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      if (resultado.erro === "nao_encontrado") {
        return resposta.status(404).send({
          erro: resultado.erro,
          mensagem: resultado.mensagem,
        });
      }

      return resposta.status(400).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(200).send(resultado.baralho);
  });

  servidor.delete("/baralhos/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.excluirBaralho(id);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      return resposta.status(404).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(204).send();
  });

  servidor.post(
    "/baralhos/:baralhoId/vinculos",
    async (requisicao, resposta) => {
      const { baralhoId } = requisicao.params as { baralhoId: string };
      const corpo = corpoDeVinculo.safeParse(requisicao.body);

      if (!corpo.success) {
        return resposta.status(400).send(CORPO_INVALIDO);
      }

      const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
      const resultado = await acervo.vincular(corpo.data.cartaoId, baralhoId);

      if (!resultado.ok) {
        if (resultado.erro === "indisponivel") {
          return responderIndisponivel(resposta, resultado);
        }

        if (resultado.erro === "vinculo_duplicado") {
          return resposta.status(409).send({
            erro: resultado.erro,
            mensagem: resultado.mensagem,
          });
        }

        return resposta.status(404).send({
          erro: resultado.erro,
          mensagem: resultado.mensagem,
        });
      }

      return resposta.status(201).send();
    },
  );

  servidor.delete(
    "/baralhos/:baralhoId/vinculos/:cartaoId",
    async (requisicao, resposta) => {
      const { baralhoId, cartaoId } = requisicao.params as {
        baralhoId: string;
        cartaoId: string;
      };
      const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
      const resultado = await acervo.desvincular(cartaoId, baralhoId);

      if (!resultado.ok) {
        if (resultado.erro === "indisponivel") {
          return responderIndisponivel(resposta, resultado);
        }

        return resposta.status(404).send({
          erro: resultado.erro,
          mensagem: resultado.mensagem,
        });
      }

      return resposta.status(204).send();
    },
  );
}

/**
 * Registra as rotas de Histórico do contrato sobre o `Acervo` de quem Entrou:
 * `POST /sessoes`, `GET /estatisticas` e `GET /sessoes/{id}`
 * (`specs/013-estatisticas-e-historico/contracts/contratos.md`, §3).
 *
 * Mesma estrutura fina das rotas de Baralho: a Credencial já foi exigida pelo
 * hook `onRequest` (FR-090), o `Acervo` é construído **dentro** de cada handler
 * com o dono decorado na requisição, de modo que nenhum acervo é guardado entre
 * requisições e toda operação é restrita ao Histórico de quem Entrou (FR-092);
 * a forma é validada na borda com Zod e as regras de domínio são julgadas
 * exclusivamente pelo `Acervo` (FR-161). A recusa de domínio atravessa como
 * código, sem texto: é o cliente que a traduz em frase.
 *
 * O `POST /sessoes` é **idempotente** pelo `id` (FR-163): a primeira gravação
 * responde `201`; o reenvio do mesmo `id` devolve o registro guardado e
 * responde `200`. A distinção é feita sem estado — o registro devolvido carrega
 * a data da **primeira** gravação, e uma data anterior ao início desta
 * requisição só pode vir de um registro que já existia.
 */
export function registrarRotasDeSessoes(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.post("/sessoes", async (requisicao, resposta) => {
    const corpo = corpoDeRegistro.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DO_REGISTRO_INVALIDOS);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.registrarSessao(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "dados_invalidos") {
        return resposta.status(400).send(DADOS_DO_REGISTRO_INVALIDOS);
      }

      if (resultado.erro === "conflito") {
        return resposta.status(409).send(REGISTRO_EM_CONFLITO);
      }

      return resposta.status(INDISPONIVEL).send(INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    // O reenvio do mesmo `id` responde 200 com o Registro guardado; a criação,
    // 201 (FR-163). Quem diz qual dos dois foi é o `Acervo`, sem olhar o relógio.
    return resposta
      .status(resultado.criada ? 201 : 200)
      .send(resultado.registro);
  });

  servidor.get("/estatisticas", async (requisicao, resposta) => {
    const consulta = consultaDaJanela.safeParse(requisicao.query);

    if (!consulta.success) {
      return resposta.status(400).send(DADOS_DO_REGISTRO_INVALIDOS);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.obterEstatisticas(consulta.data.desde);

    if (!resultado.ok) {
      if (resultado.erro === "dados_invalidos") {
        return resposta.status(400).send(DADOS_DO_REGISTRO_INVALIDOS);
      }

      return resposta.status(INDISPONIVEL).send(INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta.status(200).send(resultado.estatisticas);
  });

  servidor.get("/sessoes/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.obterRegistroDeSessao(id);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return resposta
          .status(INDISPONIVEL)
          .send(INDISPONIVEL_DO_ARMAZENAMENTO);
      }

      return resposta.status(404).send(REGISTRO_NAO_ENCONTRADO);
    }

    return resposta.status(200).send({
      registro: resultado.registro,
      baralhoExiste: resultado.baralhoExiste,
    });
  });
}

/**
 * Código HTTP de cada recusa da Agenda (contrato da `016`): entrada inválida
 * 400, recurso ausente — ou de outro dono — 404, versão ou estado em conflito
 * 409, sobreposição a confirmar 409 e armazenamento indisponível 503. O corpo é
 * sempre `{ erro, mensagem }`, com a mensagem em português do `Acervo`.
 */
const STATUS_DA_AGENDA = {
  dados_invalidos: 400,
  nao_encontrado: 404,
  conflito: 409,
  sobreposicao: 409,
  indisponivel: INDISPONIVEL,
} as const;

const DADOS_DA_AGENDA_INVALIDOS = {
  erro: "dados_invalidos",
  mensagem: "Os dados da Agenda são inválidos.",
} as const;

/**
 * Registra as rotas da Agenda de estudo sobre o `Acervo` de quem Entrou:
 * `GET /agenda`, `GET /agenda/rotinas`, `POST /agenda/rotinas` e
 * `POST /agenda/inicios` (contrato da `016`).
 *
 * Mesma estrutura fina das demais rotas: a Credencial já foi exigida pelo hook
 * (FR-090), o `Acervo` é construído **dentro** de cada handler com o dono da
 * requisição — o `usuarioId` nunca vem do corpo (FR-248) — e toda regra é
 * julgada pelo `Acervo`. `POST /agenda/rotinas` responde 201 ao **criar** e 200
 * nas demais ações e no reenvio idempotente (FR-249).
 */
export function registrarRotasDeAgenda(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.get("/agenda", async (requisicao, resposta) => {
    const consulta = consultaDaAgenda.safeParse(requisicao.query);

    if (!consulta.success) {
      return resposta.status(400).send(DADOS_DA_AGENDA_INVALIDOS);
    }

    const resultado = await acervoDe(
      requisicao.usuarioQueEntrou.id,
    ).obterAgenda(consulta.data.inicio, consulta.data.fuso);

    if (!resultado.ok) {
      return resposta
        .status(STATUS_DA_AGENDA[resultado.erro])
        .send({ erro: resultado.erro, mensagem: resultado.mensagem });
    }

    return resposta.status(200).send(resultado.agenda);
  });

  servidor.get("/agenda/rotinas", async (requisicao, resposta) => {
    const resultado = await acervoDe(
      requisicao.usuarioQueEntrou.id,
    ).listarRotinas();

    if (!resultado.ok) {
      return resposta
        .status(STATUS_DA_AGENDA[resultado.erro])
        .send({ erro: resultado.erro, mensagem: resultado.mensagem });
    }

    return resposta.status(200).send({ rotinas: resultado.rotinas });
  });

  servidor.post("/agenda/rotinas", async (requisicao, resposta) => {
    const corpo = corpoDeRotina.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_AGENDA_INVALIDOS);
    }

    const { acao, ...resto } = corpo.data;
    const resultado = await acervoDe(
      requisicao.usuarioQueEntrou.id,
    ).salvarRotina({ ...resto, acao: acao as AcaoDeRotina });

    if (!resultado.ok) {
      return resposta
        .status(STATUS_DA_AGENDA[resultado.erro])
        .send({ erro: resultado.erro, mensagem: resultado.mensagem });
    }

    return resposta
      .status(resultado.criada ? 201 : 200)
      .send({ rotina: resultado.rotina });
  });

  servidor.post("/agenda/inicios", async (requisicao, resposta) => {
    const corpo = corpoDeInicio.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_AGENDA_INVALIDOS);
    }

    const resultado = await acervoDe(
      requisicao.usuarioQueEntrou.id,
    ).iniciarCompromisso(corpo.data);

    if (!resultado.ok) {
      return resposta
        .status(STATUS_DA_AGENDA[resultado.erro])
        .send({ erro: resultado.erro, mensagem: resultado.mensagem });
    }

    return resposta.status(201).send({ inicio: resultado.inicio });
  });
}

/**
 * Registra a rota de repetição espaçada do contrato sobre o `Acervo` de quem
 * Entrou: `POST /previas` (contrato da `015`, §4). A Revisão do dia
 * (`GET /revisao` e `GET /revisao/lote`) saiu da aplicação.
 *
 * Mesma estrutura fina das demais rotas: a Credencial já foi exigida pelo hook
 * `onRequest` (FR-090), o `Acervo` é construído **dentro** do handler com o
 * dono decorado na requisição, de modo que a prévia de um Usuário nunca
 * alcança os Cartões de outro (FR-219); a forma é validada na borda com Zod, e
 * o teto de 200 identificadores é julgado exclusivamente pelo `Acervo`
 * (FR-221). A
 * recusa de domínio atravessa com o **mesmo** código da recusa de forma —
 * `dados_invalidos` —, de modo que o cliente tem um só caminho para entrada
 * inválida.
 */
export function registrarRotasDeRevisao(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.post("/previas", async (requisicao, resposta) => {
    const corpo = corpoDePrevias.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_REVISAO_INVALIDOS);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.obterPrevias(corpo.data.cartaoIds);

    if (!resultado.ok) {
      if (resultado.erro === "dados_invalidos") {
        return resposta.status(400).send(DADOS_DA_REVISAO_INVALIDOS);
      }

      return resposta
        .status(INDISPONIVEL)
        .send(INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta.status(200).send({ previas: resultado.previas });
  });
}

/**
 * Registra as rotas de Preferências do contrato sobre o `Acervo` de quem
 * Entrou: `GET /preferencias` e `PUT /preferencias` (contrato da `015`, §4).
 *
 * O `PUT` responde com o **mesmo** corpo do `GET` — o algoritmo e o limite
 * salvos mais a lista de algoritmos disponíveis —, para que a tela de
 * Preferências se redesenhe com uma única leitura (FR-212). O algoritmo
 * desconhecido e o limite fora do inteiro de 0 a 999 são recusados pelo `Acervo`
 * como `dados_invalidos`, e a troca de algoritmo dispara lá a reconstrução dos
 * Agendamentos (FR-200, FR-213).
 */
export function registrarRotasDePreferencias(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.get("/preferencias", async (requisicao, resposta) => {
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.obterPreferencias();

    if (!resultado.ok) {
      return resposta
        .status(INDISPONIVEL)
        .send(INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta.status(200).send(resultado.preferencias);
  });

  servidor.put("/preferencias", async (requisicao, resposta) => {
    const corpo = corpoDePreferencias.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DAS_PREFERENCIAS_INVALIDOS);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.salvarPreferencias(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "dados_invalidos") {
        return resposta.status(400).send(DADOS_DAS_PREFERENCIAS_INVALIDOS);
      }

      return resposta
        .status(INDISPONIVEL)
        .send(INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta.status(200).send(resultado.preferencias);
  });
}

/**
 * Registra a rota de Usuário do contrato sobre o `Identidade` informado:
 * `POST /usuarios`. A rota é uma casca fina sobre a Interface, como as demais:
 * valida a **forma** do corpo na borda com Zod, **aguarda** o `cadastrar` do
 * Module e converte o código de erro em status — 400 para as recusas de regra,
 * 409 para o Nome de usuário já existente, 503 para a falha do armazenamento —,
 * repassando o código estável e a mensagem em português que o Module devolveu
 * (FR-046). Nenhuma regra de domínio é reproduzida aqui: o tamanho, o alfabeto,
 * o intervalo da Senha e a unicidade sem distinção entre maiúsculas e
 * minúsculas continuam sendo julgados exclusivamente pelo `Identidade`
 * (FR-070, SC-026).
 *
 * A resposta de sucesso carrega apenas `id` e `nomeDeUsuario`: **nenhuma
 * resposta contém a Senha, qualquer transformação dela ou credencial
 * reutilizável**, e nenhuma traz `Set-Cookie` (FR-076, FR-078, FR-079).
 */
export function registrarRotasDeUsuarios(
  servidor: FastifyInstance,
  identidade: Identidade,
): void {
  servidor.post("/usuarios", async (requisicao, resposta) => {
    const corpo = corpoDeUsuario.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const resultado = await identidade.cadastrar(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      if (resultado.erro === "nome_de_usuario_existente") {
        return resposta.status(409).send({
          erro: resultado.erro,
          mensagem: resultado.mensagem,
        });
      }

      return resposta.status(400).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(201).send(resultado.usuario);
  });
}

/**
 * Forma dos corpos das rotas de conta (017): textos, e nada mais é exigido na
 * borda. O intervalo e a Senha atual são julgados exclusivamente pelo
 * `Identidade`; forma inválida usa o mesmo código `dados_invalidos` da recusa
 * de regra, para o cliente ter um só caminho.
 */
const corpoDeTrocaDeSenha = z.object({
  senhaAtual: z.string(),
  novaSenha: z.string(),
  confirmacaoDaSenha: z.string(),
});
const corpoDeExclusaoDeConta = z.object({
  senhaAtual: z.string(),
});

const DADOS_DA_CONTA_INVALIDOS = {
  erro: "dados_invalidos",
  mensagem: "Os dados informados são inválidos.",
} as const;

/**
 * Traduz a recusa da gestão da conta em resposta: `400` para regra violada,
 * `403` para a Senha atual incorreta — e não `401`, que é reservado à Credencial
 * recusada e dispararia o descarte da Credencial (FR-091, FR-279) — e `503`
 * para a falha do armazenamento. A resposta carrega apenas código, mensagem e
 * campo: nunca a Senha (FR-078).
 */
function responderRecusaDeConta(
  resposta: FastifyReply,
  recusa: {
    erro: string;
    mensagem: string;
    campo?: string;
  },
) {
  const status =
    recusa.erro === "senha_atual_incorreta"
      ? 403
      : recusa.erro === "indisponivel"
        ? INDISPONIVEL
        : 400;

  return resposta.status(status).send({
    erro: recusa.erro,
    mensagem: recusa.mensagem,
    ...(recusa.campo === undefined ? {} : { campo: recusa.campo }),
  });
}

/**
 * Registra as rotas de gestão da conta do Usuário (017): `GET /conta`,
 * `PUT /conta/senha` e `DELETE /conta`. Operam sempre sobre o Usuário da
 * Credencial apresentada, que o hook decorou na requisição — não há como
 * alcançar a conta de outro Usuário (FR-287).
 *
 * `PUT /conta/nome-de-usuario` não existe mais (020): a rota antiga **não é
 * registrada**, e uma requisição autenticada a ela recebe o `404` padrão do
 * roteador — a alteração do Nome de usuário saiu do contrato.
 */
export function registrarRotasDeConta(
  servidor: FastifyInstance,
  identidade: Identidade,
  acessos: Acessos,
): void {
  /**
   * 018 (FR-296): trocar a Senha **encerra todos os Acessos** do Usuário —
   * outros navegadores incluídos — e, quando a requisição foi autenticada por
   * Acesso, emite um Acesso **novo** para este navegador, que segue operando
   * sem Entrar de novo. Devolve `false` quando o armazenamento falha: a mudança
   * já foi aplicada, mas os Acessos antigos podem continuar valendo, e a
   * resposta não pode ser de sucesso.
   */
  async function renovarOsAcessos(
    requisicao: FastifyRequest,
    resposta: FastifyReply,
  ): Promise<boolean> {
    const usuarioId = requisicao.usuarioQueEntrou.id;
    const encerrados = await acessos.encerrarTodosDoUsuario(usuarioId);

    if (!encerrados.ok) {
      return false;
    }

    if (requisicao.acessoDaRequisicao === null) {
      return true;
    }

    const emitido = await acessos.emitir(usuarioId);

    if (!emitido.ok) {
      return false;
    }

    resposta.header("set-cookie", acessos.cookieDeAcesso(emitido.valor));

    return true;
  }

  servidor.get("/conta", async (requisicao, resposta) => {
    const resultado = await identidade.obterConta(
      requisicao.usuarioQueEntrou.id,
    );

    if (!resultado.ok) {
      return responderIndisponivel(resposta, resultado);
    }

    return resposta.status(200).send({
      nomeDeUsuario: resultado.conta.nomeDeUsuario,
      contagens: resultado.conta.contagens,
    });
  });

  servidor.put("/conta/senha", async (requisicao, resposta) => {
    const corpo = corpoDeTrocaDeSenha.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_CONTA_INVALIDOS);
    }

    const resultado = await identidade.trocarSenha(
      requisicao.usuarioQueEntrou.id,
      corpo.data,
    );

    if (!resultado.ok) {
      return responderRecusaDeConta(resposta, resultado);
    }

    if (!(await renovarOsAcessos(requisicao, resposta))) {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta.status(204).send();
  });

  servidor.delete("/conta", async (requisicao, resposta) => {
    const corpo = corpoDeExclusaoDeConta.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_CONTA_INVALIDOS);
    }

    const resultado = await identidade.excluirConta(
      requisicao.usuarioQueEntrou.id,
      corpo.data,
    );

    if (!resultado.ok) {
      return responderRecusaDeConta(resposta, resultado);
    }

    // Os Acessos caíram por cascata com o Usuário; o cookie deste navegador é
    // limpo, e nenhum Acesso novo é emitido (FR-296).
    return resposta
      .header("set-cookie", acessos.cookieDeLimpeza())
      .status(204)
      .send();
  });
}

/**
 * Forma do corpo **opcional** de `POST /entrar` (018): a Credencial pode vir pelo
 * corpo, além do cabeçalho, e `continuarConectado` — padrão `true` — decide se
 * um Acesso temporário é emitido (FR-292).
 */
const corpoDeEntrada = z.object({
  nomeDeUsuario: z.string().optional(),
  senha: z.string().optional(),
  continuarConectado: z.boolean().optional(),
});

/**
 * Registra a rota de Entrar do contrato: `POST /entrar`
 * (`specs/008-entrar/contracts/api-entrar.md`, estendido pela `018`).
 *
 * A rota é isenta do hook de Credencial: ela mesma verifica a Credencial — pelo
 * cabeçalho `Authorization: Basic` ou pelo corpo `{ nomeDeUsuario, senha }` —
 * com a mesma recusa única de sempre (FR-088), `401 credencial_invalida`, e
 * `503` quando o armazenamento falha (FR-044, FR-045).
 *
 * No sucesso, responde `200` com `id` e `nomeDeUsuario` — nunca a Senha, nunca o
 * Acesso no corpo (FR-078, FR-297). Com `continuarConectado` verdadeiro (o
 * padrão), **revoga** o Acesso do cookie atual, se houver, emite um novo e o
 * entrega em `Set-Cookie` `HttpOnly` (FR-289, FR-292); com `false`, revoga e
 * limpa o do cookie atual e **não** emite outro — a Credencial segue valendo só
 * na memória da página aberta (FR-090 revisado).
 */
export function registrarRotaDeEntrada(
  servidor: FastifyInstance,
  identidade: Identidade,
  acessos: Acessos,
): void {
  servidor.post("/entrar", async (requisicao, resposta) => {
    const corpo = corpoDeEntrada.safeParse(requisicao.body ?? {});

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const credencial =
      credencialDoCabecalho(requisicao.headers.authorization) ??
      (corpo.data.nomeDeUsuario !== undefined &&
      corpo.data.senha !== undefined
        ? {
            nomeDeUsuario: corpo.data.nomeDeUsuario,
            senha: corpo.data.senha,
          }
        : null);

    if (credencial === null) {
      return resposta.status(401).send(CREDENCIAL_INVALIDA);
    }

    const verificada = await identidade.autenticar(credencial);

    if (!verificada.ok) {
      if (verificada.erro === "indisponivel") {
        return responderIndisponivel(resposta, verificada);
      }

      return resposta.status(401).send(CREDENCIAL_INVALIDA);
    }

    const valorAtual = acessos.valorDoCookie(requisicao.headers.cookie);

    // O novo Entrar **substitui** o Acesso deste navegador: o anterior é
    // revogado antes de qualquer outro passo (D4, A2).
    const revogado = await acessos.encerrar(valorAtual);

    if (!revogado.ok) {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    if (corpo.data.continuarConectado ?? true) {
      const emitido = await acessos.emitir(verificada.usuario.id);

      if (!emitido.ok) {
        return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
      }

      resposta.header("set-cookie", acessos.cookieDeAcesso(emitido.valor));
    } else if (valorAtual !== undefined) {
      resposta.header("set-cookie", acessos.cookieDeLimpeza());
    }

    return resposta.status(200).send({
      id: verificada.usuario.id,
      nomeDeUsuario: verificada.usuario.nomeDeUsuario,
    });
  });
}

/**
 * Registra as rotas do Acesso temporário (018): `GET /acesso`,
 * `POST /acesso/renovar` e `POST /sair`.
 *
 * Todas leem o cookie e respondem por conta própria — são isentas do hook —,
 * porque cada recusa tem o seu código e **limpa o cookie**, que é `HttpOnly` e
 * não pode ser apagado por script (A3): `401 sem_acesso` quando não há Acesso,
 * `401 acesso_expirado` quando a linha existe e venceu. A falha do
 * armazenamento é `503` e **nunca** limpa o cookie: não é expiração (FR-301).
 * O Acesso nunca aparece no corpo (FR-297, FR-305).
 */
export function registrarRotasDeAcesso(
  servidor: FastifyInstance,
  identidade: Identidade,
  acessos: Acessos,
): void {
  /** Valida e renova o Acesso do cookie e resolve o Usuário dele. */
  async function autorizarCookie(requisicao: FastifyRequest) {
    const autorizado = await acessos.autorizar(
      acessos.valorDoCookie(requisicao.headers.cookie),
    );

    if (!autorizado.ok) {
      return autorizado;
    }

    const usuario = await identidade.obterUsuario(autorizado.usuarioId);

    if (!usuario.ok) {
      return {
        ok: false as const,
        erro:
          usuario.erro === "indisponivel"
            ? ("indisponivel" as const)
            : ("sem_acesso" as const),
      };
    }

    return { ok: true as const, usuario: usuario.usuario };
  }

  function recusar(
    resposta: FastifyReply,
    erro: "sem_acesso" | "acesso_expirado" | "indisponivel",
  ) {
    if (erro === "indisponivel") {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta
      .header("set-cookie", acessos.cookieDeLimpeza())
      .status(401)
      .send(erro === "acesso_expirado" ? ACESSO_EXPIRADO : SEM_ACESSO);
  }

  servidor.get("/acesso", async (requisicao, resposta) => {
    const autorizado = await autorizarCookie(requisicao);

    if (!autorizado.ok) {
      return recusar(resposta, autorizado.erro);
    }

    return resposta
      .status(200)
      .send({ nomeDeUsuario: autorizado.usuario.nomeDeUsuario });
  });

  servidor.post("/acesso/renovar", async (requisicao, resposta) => {
    const autorizado = await autorizarCookie(requisicao);

    if (!autorizado.ok) {
      return recusar(resposta, autorizado.erro);
    }

    return resposta.status(204).send();
  });

  servidor.post("/sair", async (requisicao, resposta) => {
    const encerrado = await acessos.encerrar(
      acessos.valorDoCookie(requisicao.headers.cookie),
    );

    if (!encerrado.ok) {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta
      .header("set-cookie", acessos.cookieDeLimpeza())
      .status(204)
      .send();
  });
}
