import { createHmac, timingSafeEqual } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    /**
     * A subchave da origem de Conta de teste (030, R5), derivada do
     * SEGREDO_DAS_SENHAS na construção do servidor. `null` quando o servidor foi
     * montado sem o segredo: a criação de Conta de teste então responde
     * `indisponivel`, e nunca cria conta sem poder contar a origem.
     */
    subchaveDeOrigemDeContaDeTeste: Buffer | null;
  }
}

/**
 * `subchave = HMAC-SHA256(SEGREDO_DAS_SENHAS, "origem-de-conta-de-teste")`
 * (030, R5). Assim a chave das Senhas não é reaproveitada diretamente para
 * outro fim, e não há segredo novo para cuidar.
 */
export function derivarSubchaveDeOrigem(segredoDasSenhas: string): Buffer {
  return createHmac("sha256", segredoDasSenhas)
    .update("origem-de-conta-de-teste")
    .digest();
}

/**
 * A origem guardada de um visitante: `HMAC-SHA256(subchave, ip)`, em hexadecimal.
 * O IP nunca sai daqui em claro — nem em log, nem em tabela (030, R5).
 */
export function origemDeContaDeTeste(subchave: Buffer, ip: string): string {
  return createHmac("sha256", subchave).update(ip).digest("hex");
}

/** Tira a porta de `IP:porta` e os colchetes de `[IPv6]:porta`. */
function semPorta(endereco: string): string {
  if (endereco.startsWith("[")) {
    const fim = endereco.indexOf("]");

    return fim > 0 ? endereco.slice(1, fim) : endereco;
  }

  const partes = endereco.split(":");

  return partes.length === 2 ? (partes[0] ?? endereco) : endereco;
}

/**
 * O IP do visitante (030, R5): `CloudFront-Viewer-Address` quando presente; senão
 * o último elemento de `X-Forwarded-For`, que o CloudFront completa com o IP de
 * quem chamou; senão o endereço do socket. Não é Credencial nem identidade: é
 * só a origem, para o limite de criação.
 */
export function ipDoVisitante(requisicao: FastifyRequest): string {
  const visto = requisicao.headers["cloudfront-viewer-address"];

  if (typeof visto === "string" && visto.trim() !== "") {
    return semPorta(visto.trim());
  }

  const encaminhado = requisicao.headers["x-forwarded-for"];

  if (typeof encaminhado === "string") {
    const ultimo = encaminhado
      .split(",")
      .map((trecho) => trecho.trim())
      .filter((trecho) => trecho !== "")
      .at(-1);

    if (ultimo !== undefined) {
      return semPorta(ultimo);
    }
  }

  return requisicao.socket.remoteAddress ?? "";
}

/**
 * A guarda do segredo de origem — a porta fechada da Função da nuvem (FR-125).
 *
 * A URL pública da função é alcançável por quem a descobrir, e é o CloudFront
 * que injeta o cabeçalho `x-origin-secret` nas requisições que ele encaminha. A
 * guarda é registrada como o **primeiro** `onRequest` da aplicação: a
 * requisição que não veio do CloudFront é recusada **antes** de qualquer
 * trabalho de Credencial, e `/health` não é exceção.
 *
 * A recusa é **indistinguível** entre cabeçalho ausente, curto, longo ou
 * errado: o mesmo status, o mesmo corpo — o que a stub da infraestrutura já
 * devolvia, e que o comportamento validado em campo não muda —, sem
 * `WWW-Authenticate` e sem `Set-Cookie`. A comparação é feita em tempo
 * constante, e o comprimento é conferido **antes** dela, porque
 * `timingSafeEqual` lança com buffers de tamanhos diferentes.
 *
 * A guarda não é Credencial e não a substitui: ela responde "de onde veio", e
 * não "quem é" (FR-131).
 */

/** O cabeçalho que só o CloudFront injeta. */
export const CABECALHO_DE_ORIGEM = "x-origin-secret";

/**
 * A recusa única da origem: em todos os casos o mesmo corpo, sem motivo. É o
 * corpo que a stub da infraestrutura já devolvia, mantido palavra por palavra.
 */
export const PROIBIDO = { sucesso: false, mensagem: "Forbidden" } as const;

/** Status da recusa por origem (FR-125). */
const NAO_PERMITIDO = 403;

/**
 * Diz se o cabeçalho recebido traz o segredo esperado.
 *
 * O comprimento é conferido primeiro — `timingSafeEqual` lança com buffers
 * desiguais —, e só depois o conteúdo, em tempo constante. Cabeçalho ausente é
 * tratado como valor vazio, de modo que a recusa por ausência percorre o mesmo
 * caminho da recusa por valor errado.
 */
export function veioDoCloudFront(
  recebido: string | undefined,
  esperado: string,
): boolean {
  const candidato = Buffer.from(recebido ?? "", "utf8");
  const referencia = Buffer.from(esperado, "utf8");

  return (
    candidato.length === referencia.length &&
    timingSafeEqual(candidato, referencia)
  );
}

/**
 * Registra, no servidor informado, a guarda do segredo de origem. Chamada pela
 * criação do servidor **antes** do hook da Credencial, de modo que a ordem das
 * guardas seja do contrato e não da sorte de quem monta a aplicação.
 *
 * O valor esperado chega pronto — lido do cofre no início a frio pela Seam
 * `LeitorDeSegredos` —, e nada dele aparece em resposta alguma.
 */
export function exigirSegredoDeOrigem(
  servidor: FastifyInstance,
  esperado: string,
): void {
  servidor.addHook("onRequest", async (requisicao, resposta) => {
    const cabecalho = requisicao.headers[CABECALHO_DE_ORIGEM];
    /** Cabeçalho repetido chega como lista, e não é o que o CloudFront injeta. */
    const recebido = typeof cabecalho === "string" ? cabecalho : undefined;

    if (!veioDoCloudFront(recebido, esperado)) {
      return resposta.status(NAO_PERMITIDO).send(PROIBIDO);
    }
  });
}
