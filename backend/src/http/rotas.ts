import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Acervo } from "../acervo/acervo.ts";

/**
 * Adapter HTTP do Module `Acervo` (T007).
 *
 * As rotas são finas por construção: validam a **forma** do corpo na borda
 * com Zod, chamam a Interface do `Acervo` e traduzem o resultado em código de
 * status. Nenhuma regra de domínio é reproduzida aqui — vazio, conteúdo só de
 * espaços e limite de tamanho continuam sendo julgados exclusivamente pelo
 * `Acervo` (FR-002, FR-051, FR-052). Na recusa de domínio, o adapter apenas
 * repassa o código estável e a mensagem em português que o `Acervo` devolveu
 * (FR-046), sem inventar texto próprio.
 */

/**
 * Forma do corpo de `POST /cartoes`: exatamente Frente e Verso, ambos texto
 * (FR-001). O esquema **não é estrito**: propriedade extra é descartada na
 * borda e nunca alcança o `Acervo` nem as leituras — a verificação de FR-009.
 * Forma inválida (corpo ausente, campo ausente, tipo errado, JSON malformado)
 * é recusada aqui, antes de qualquer chamada ao `Acervo`.
 */
const corpoDeCartao = z.object({
  frente: z.string(),
  verso: z.string(),
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
 * Forma do corpo de `POST /baralhos`: exatamente o nome, texto (FR-010). O
 * esquema **não é estrito**: propriedade extra é descartada na borda e nunca
 * alcança o `Acervo` nem as leituras — a verificação de FR-018. Forma inválida
 * (corpo ausente, campo ausente, tipo errado, JSON malformado) é recusada
 * aqui, antes de qualquer chamada ao `Acervo`.
 */
const corpoDeBaralho = z.object({
  nome: z.string(),
});

/**
 * Registra as duas rotas de Cartão do contrato sobre o `Acervo` informado.
 * Chamada na inicialização, com o `Acervo` real, e nos testes de contrato,
 * com o `Acervo` sobre SQLite em memória.
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

    const resultado = acervo.criarCartao(corpo.data);

    if (!resultado.ok) {
      return resposta.status(400).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(201).send(resultado.cartao);
  });

  servidor.get("/cartoes", async () => acervo.listarCartoes());
}

/**
 * Registra as duas rotas de Baralho do contrato sobre o `Acervo` informado.
 * Mesma estrutura fina das rotas de Cartão: forma validada na borda, regra de
 * domínio julgada exclusivamente pelo `Acervo`, e recusa de domínio repassada
 * com o código estável e a mensagem em português devolvidos pela Interface
 * (FR-046). Nome repetido é criação válida: o contrato não prevê `409` para
 * Baralho (FR-012).
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

    const resultado = acervo.criarBaralho(corpo.data);

    if (!resultado.ok) {
      return resposta.status(400).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(201).send(resultado.baralho);
  });

  servidor.get("/baralhos", async () => acervo.listarBaralhos());
}
