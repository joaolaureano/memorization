import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import type { Acervo } from "../acervo/acervo.ts";
import type { Identidade } from "../identidade/identidade.ts";

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
 * ao concluir — o identificador que dá a idempotência, o Baralho e o seu nome
 * no momento da conclusão e a lista de Itens, cada um com Frente, Verso e
 * Resultado (contrato da `013`, §3).
 *
 * O esquema confere apenas a **forma**. Os limites de tamanho, a forma canônica
 * do identificador, o intervalo de 1 a 1000 Itens e a validade de Frente e
 * Verso como Cartão continuam sendo julgados exclusivamente pelo `Acervo`
 * (FR-161), e Resultado fora de `acertou`/`errou` também é recusado lá. Por
 * isso a recusa de forma na borda usa o **mesmo** código da recusa de domínio —
 * `dados_invalidos` —, e o cliente tem um só caminho para corpo inválido.
 */
const corpoDeRegistro = z.object({
  id: z.string(),
  baralhoId: z.string(),
  nomeDoBaralho: z.string(),
  itens: z.array(
    z.object({
      frente: z.string(),
      verso: z.string(),
      resultado: z.string(),
    }),
  ),
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
const INDISPONIVEL_DO_HISTORICO = {
  erro: "indisponivel",
  mensagem: "O armazenamento está indisponível.",
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

    /**
     * O relógio marca o início antes da chamada: quem manda na data é a
     * primeira inserção, e o `Acervo` só devolve uma data anterior a este
     * instante quando o registro já existia (FR-163).
     */
    const inicioDaRequisicao = Date.now();
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.registrarSessao(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "dados_invalidos") {
        return resposta.status(400).send(DADOS_DO_REGISTRO_INVALIDOS);
      }

      if (resultado.erro === "conflito") {
        return resposta.status(409).send(REGISTRO_EM_CONFLITO);
      }

      return resposta.status(INDISPONIVEL).send(INDISPONIVEL_DO_HISTORICO);
    }

    const jaExistia =
      Date.parse(resultado.registro.concluidaEm) < inicioDaRequisicao;

    return resposta.status(jaExistia ? 200 : 201).send(resultado.registro);
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

      return resposta.status(INDISPONIVEL).send(INDISPONIVEL_DO_HISTORICO);
    }

    return resposta.status(200).send(resultado.estatisticas);
  });

  servidor.get("/sessoes/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.obterRegistroDeSessao(id);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return resposta.status(INDISPONIVEL).send(INDISPONIVEL_DO_HISTORICO);
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
 * Registra a rota de Entrar do contrato: `POST /entrar`
 * (`specs/008-entrar/contracts/api-entrar.md`).
 *
 * A verificação da Credencial **já aconteceu** no hook `onRequest`, que é o
 * ponto único onde ela é conferida (FR-090): quando este handler roda, a
 * Credencial existe e confere, e a requisição carrega o Usuário que Entrou.
 * Por isso a rota não tem corpo de requisição, não valida forma alguma e não
 * tem caminho de recusa próprio — ela apenas **responde quem entrou**, com
 * exatamente `id` e `nomeDeUsuario` (FR-086, FR-046).
 *
 * O `401` de Credencial que não confere, ausente ou malformada é do hook, com a
 * mensagem única de recusa (FR-088), e nenhuma resposta desta rota carrega
 * `Set-Cookie` ou valor reutilizável (FR-079).
 */
export function registrarRotaDeEntrada(servidor: FastifyInstance): void {
  servidor.post("/entrar", async (requisicao, resposta) =>
    resposta.status(200).send({
      id: requisicao.usuarioQueEntrou.id,
      nomeDeUsuario: requisicao.usuarioQueEntrou.nomeDeUsuario,
    }),
  );
}
