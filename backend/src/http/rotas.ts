import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import type { Acervo } from "../acervo/acervo.ts";

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
 * Registra as rotas de Cartão do contrato sobre o `Acervo` informado:
 * `POST /cartoes`, `GET /cartoes`, `PUT /cartoes/{id}` e
 * `DELETE /cartoes/{id}`. Chamada na inicialização, com o `Acervo` real, e
 * nos testes de contrato, com o `Acervo` sobre o Adapter do armazenamento
 * local.
 */
export function registrarRotasDeCartoes(
  servidor: FastifyInstance,
  acervo: Acervo,
): void {
  servidor.post("/cartoes", async (requisicao, resposta) => {
    const corpo = corpoDeCartao.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

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

  servidor.get("/cartoes", async () => acervo.listarCartoes());

  servidor.put("/cartoes/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const corpo = corpoDeCartao.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

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
 * Registra as rotas de Baralho e de Vínculo do contrato sobre o `Acervo`
 * informado: `POST /baralhos`, `GET /baralhos`, `GET /baralhos/{id}`,
 * `PUT /baralhos/{id}`, `DELETE /baralhos/{id}`,
 * `POST /baralhos/{baralhoId}/vinculos` e
 * `DELETE /baralhos/{baralhoId}/vinculos/{cartaoId}`. Mesma estrutura fina
 * das rotas de Cartão: forma validada na borda, regra de domínio julgada
 * exclusivamente pelo `Acervo`, e recusa de domínio repassada com o código
 * estável e a mensagem em português devolvidos pela Interface (FR-046).
 */
export function registrarRotasDeBaralhos(
  servidor: FastifyInstance,
  acervo: Acervo,
): void {
  servidor.post("/baralhos", async (requisicao, resposta) => {
    const corpo = corpoDeBaralho.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

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

  servidor.get("/baralhos", async () => acervo.listarBaralhos());

  servidor.get("/baralhos/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
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
