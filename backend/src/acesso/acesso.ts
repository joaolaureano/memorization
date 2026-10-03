import { createHash, randomBytes } from "node:crypto";

import type { ArmazenamentoDeAcessos } from "../armazenamento/porta.ts";

/**
 * O Module `Acessos` — o **Acesso temporário** (018; FR-289..FR-306).
 *
 * O Acesso temporário é o comprovante emitido ao Entrar que permite continuar
 * operando no mesmo navegador sem reapresentar a Credencial, até expirar por
 * inatividade ou ser encerrado. Aqui vive toda a regra: o valor opaco
 * aleatório de 256 bits, o digest SHA-256 que é a **única** coisa guardada, a
 * validade deslizante decidida pelo servidor, a renovação, o encerramento e o
 * formato do cookie `HttpOnly` que o transporta. O hook de Credencial e as
 * rotas conhecem só esta Interface; a persistência chega pela Porta
 * `ArmazenamentoDeAcessos`.
 *
 * Invariantes que a Interface garante:
 *
 * - o valor em claro **não** sai daqui para nada além do `Set-Cookie`: nunca em
 *   URL, em corpo de resposta ou em log (FR-297, FR-305), e nunca à Porta;
 * - a validade é do servidor — `expiraEm` gravado contra o relógio **do
 *   servidor** —, e o relógio do aparelho não altera a decisão (FR-297);
 * - falha do armazenamento é `indisponivel`, **distinta** de Acesso expirado ou
 *   ausente, de modo que nunca descarta um Acesso que talvez ainda valha
 *   (FR-301);
 * - o Acesso não revela Senha nem Nome de usuário e não é adivinhável: são 256
 *   bits de `randomBytes` (FR-297, FR-306).
 */

/**
 * As recusas do Acesso temporário, com o código estável e a mensagem em
 * português que a interface exibe tal qual (FR-046, FR-294). Em `acesso_expirado`
 * a mensagem é a exigida pela spec — «Seu acesso expirou. Entre novamente.».
 */
export const ACESSO_EXPIRADO = {
  erro: "acesso_expirado",
  mensagem: "Seu acesso expirou. Entre novamente.",
} as const;

export const SEM_ACESSO = {
  erro: "sem_acesso",
  mensagem: "Não há acesso neste navegador. Entre para continuar.",
} as const;

/** O nome do cookie do Acesso temporário. */
export const NOME_DO_COOKIE_DE_ACESSO = "acesso";

/** Validade padrão: 5 minutos a partir da última ação (FR-291). */
export const VALIDADE_PADRAO_EM_SEGUNDOS = 300;

/** `Max-Age` longo do cookie: 400 dias, o teto que os navegadores aceitam. A validade real é do servidor. */
const DURACAO_DO_COOKIE_EM_SEGUNDOS = 400 * 24 * 60 * 60;

/** Bytes de aleatoriedade do valor: 32 bytes são 256 bits (FR-297). */
const BYTES_DO_VALOR = 32;

/** O nome da variável de ambiente que só os testes usam para encurtar a validade. */
export const VARIAVEL_DA_VALIDADE = "ACESSO_VALIDADE_SEGUNDOS";

/**
 * Lê a validade do ambiente: `ACESSO_VALIDADE_SEGUNDOS`, inteiro positivo,
 * padrão 300. É **configuração de ambiente para testes** e nunca escolha da
 * pessoa (D3); um valor que não é inteiro positivo é recusado com mensagem que
 * nomeia a variável, e nunca é aceito em silêncio.
 */
export function validadeConfigurada(env: NodeJS.ProcessEnv = process.env): number {
  const bruto = env[VARIAVEL_DA_VALIDADE];

  if (bruto === undefined || bruto.trim() === "") {
    return VALIDADE_PADRAO_EM_SEGUNDOS;
  }

  const numero = Number(bruto.trim());

  if (!/^[0-9]+$/.test(bruto.trim()) || !Number.isInteger(numero) || numero < 1) {
    throw new ValidadeInvalidaError(
      `${VARIAVEL_DA_VALIDADE} inválida: informe um número inteiro de segundos maior que zero.`,
    );
  }

  return numero;
}

export class ValidadeInvalidaError extends Error {}

/** Por que um Acesso não autoriza. */
export type MotivoDeAcessoRecusado =
  | "sem_acesso"
  | "acesso_expirado"
  | "indisponivel";

/** Resultado de validar (e renovar) o Acesso apresentado. */
export type ResultadoDeAcesso =
  | { ok: true; usuarioId: string }
  | { ok: false; erro: MotivoDeAcessoRecusado };

/** Resultado de uma operação que só pode dar certo ou ficar indisponível. */
export type ResultadoDeOperacaoDeAcesso =
  | { ok: true }
  | { ok: false; erro: "indisponivel" };

/** O Acesso emitido: o valor opaco, que só existe para ir ao cookie. */
export type ResultadoDeEmissao =
  | { ok: true; valor: string }
  | { ok: false; erro: "indisponivel" };

export interface OpcoesDosAcessos {
  /** Validade deslizante, em segundos (FR-291). */
  validadeEmSegundos?: number;
  /** O cookie leva `Secure` — na nuvem, onde há HTTPS (D2). */
  cookieSeguro?: boolean;
  /** O relógio **do servidor**; injetável para os testes. */
  agora?: () => Date;
}

export interface Acessos {
  /**
   * Emite um Acesso novo para o Usuário e devolve o valor opaco, que só deve ir
   * ao cookie (FR-289). Remove, de passagem, os Acessos já expirados (D7).
   */
  emitir(usuarioId: string): Promise<ResultadoDeEmissao>;

  /**
   * Valida o Acesso apresentado e, valendo, o **renova**: `expiraEm` passa a
   * agora mais a validade (FR-291). Ausente ou sem valor é `sem_acesso`;
   * existente e vencido é `acesso_expirado`; falha do armazenamento é
   * `indisponivel` (FR-294, FR-301).
   */
  autorizar(valor: string | undefined): Promise<ResultadoDeAcesso>;

  /** Encerra o Acesso apresentado — idempotente (FR-293, FR-295). */
  encerrar(valor: string | undefined): Promise<ResultadoDeOperacaoDeAcesso>;

  /** Encerra **todos** os Acessos do Usuário, de todos os navegadores (FR-296). */
  encerrarTodosDoUsuario(usuarioId: string): Promise<ResultadoDeOperacaoDeAcesso>;

  /** O valor do Acesso no cabeçalho `Cookie`, ou `undefined`. */
  valorDoCookie(cabecalho: string | undefined): string | undefined;

  /** O `Set-Cookie` que entrega o Acesso ao navegador. */
  cookieDeAcesso(valor: string): string;

  /** O `Set-Cookie` que descarta o Acesso do navegador. */
  cookieDeLimpeza(): string;
}

/** O digest SHA-256 do valor: a única forma em que o Acesso é guardado (FR-297). */
function digestDe(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

/**
 * Cria os `Acessos` sobre a Porta informada. A validade, o relógio e a marca
 * `Secure` entram como dependências explícitas: o Module não lê `process.env`.
 */
export function criarAcessos(
  armazenamento: ArmazenamentoDeAcessos,
  opcoes: OpcoesDosAcessos = {},
): Acessos {
  const validadeEmMs =
    (opcoes.validadeEmSegundos ?? VALIDADE_PADRAO_EM_SEGUNDOS) * 1000;
  const agora = opcoes.agora ?? (() => new Date());
  const secure = opcoes.cookieSeguro === true ? "; Secure" : "";

  /** O vencimento de um Acesso tocado agora. */
  function vencimento(): string {
    return new Date(agora().getTime() + validadeEmMs).toISOString();
  }

  return {
    async emitir(usuarioId) {
      const valor = randomBytes(BYTES_DO_VALOR).toString("base64url");

      // D7: a limpeza é preguiçosa, no Entrar; a falha dela não impede emitir.
      await armazenamento.removerExpirados(agora().toISOString());

      const criado = await armazenamento.criar(
        digestDe(valor),
        usuarioId,
        vencimento(),
      );

      return criado.ok
        ? { ok: true, valor }
        : { ok: false, erro: "indisponivel" };
    },

    async autorizar(valor) {
      if (valor === undefined || valor === "") {
        return { ok: false, erro: "sem_acesso" };
      }

      const digest = digestDe(valor);
      const lido = await armazenamento.obterValido(
        digest,
        agora().toISOString(),
      );

      if (!lido.ok) {
        return {
          ok: false,
          erro:
            lido.erro === "expirado"
              ? "acesso_expirado"
              : lido.erro === "indisponivel"
                ? "indisponivel"
                : "sem_acesso",
        };
      }

      const renovado = await armazenamento.renovar(digest, vencimento());

      if (!renovado.ok) {
        return {
          ok: false,
          erro:
            renovado.erro === "indisponivel" ? "indisponivel" : "sem_acesso",
        };
      }

      return { ok: true, usuarioId: lido.valor.usuarioId };
    },

    async encerrar(valor) {
      if (valor === undefined || valor === "") {
        return { ok: true };
      }

      const encerrado = await armazenamento.encerrar(digestDe(valor));

      return encerrado.ok ? { ok: true } : { ok: false, erro: "indisponivel" };
    },

    async encerrarTodosDoUsuario(usuarioId) {
      const encerrado = await armazenamento.encerrarTodosDoUsuario(usuarioId);

      return encerrado.ok ? { ok: true } : { ok: false, erro: "indisponivel" };
    },

    valorDoCookie(cabecalho) {
      if (cabecalho === undefined) {
        return undefined;
      }

      for (const par of cabecalho.split(";")) {
        const separador = par.indexOf("=");

        if (separador < 0) {
          continue;
        }

        if (par.slice(0, separador).trim() === NOME_DO_COOKIE_DE_ACESSO) {
          const valor = par.slice(separador + 1).trim();

          return valor === "" ? undefined : valor;
        }
      }

      return undefined;
    },

    cookieDeAcesso(valor) {
      return (
        `${NOME_DO_COOKIE_DE_ACESSO}=${valor}; HttpOnly; SameSite=Strict; ` +
        `Path=/; Max-Age=${DURACAO_DO_COOKIE_EM_SEGUNDOS}${secure}`
      );
    },

    cookieDeLimpeza() {
      return (
        `${NOME_DO_COOKIE_DE_ACESSO}=; HttpOnly; SameSite=Strict; Path=/; ` +
        `Max-Age=0${secure}`
      );
    },
  };
}
