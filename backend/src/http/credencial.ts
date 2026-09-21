import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type {
  Identidade,
  UsuarioCadastrado,
} from "../identidade/identidade.ts";
import { CREDENCIAL_INVALIDA } from "../identidade/identidade.ts";

/**
 * O ponto único onde a Credencial é verificada — o hook `onRequest` (FR-090).
 *
 * A Credencial viaja em **toda** requisição, no cabeçalho
 * `Authorization: Basic base64(nomeDeUsuario:senha)`, e não há sessão, cookie,
 * token nem valor reutilizável em lugar algum (FR-079, FR-089): o servidor não
 * guarda nada entre requisições, e cada operação é verificada de novo. É por
 * isso que este hook é a única Implementation da verificação: nenhuma rota
 * reproduz a regra, e a rota **não roda** quando a Credencial falta ou não
 * confere (SC-028).
 *
 * A recusa é a mesma para todo motivo — cabeçalho ausente, cabeçalho
 * malformado, Nome de usuário inexistente ou Senha errada —, com o código
 * estável `credencial_invalida` e a mensagem única em português que o Module
 * `Identidade` é dono (FR-046, FR-088). A resposta **não** publica
 * `WWW-Authenticate`: esse cabeçalho faria o navegador abrir o diálogo nativo
 * de autenticação e memorizar a Credencial, contra FR-089 e FR-078.
 *
 * A falha do armazenamento **não** é recusa de Credencial: ela responde como
 * indisponibilidade, porque a operação não foi concluída e o conteúdo informado
 * continua disponível para nova tentativa (FR-044, FR-045).
 */

/**
 * As rotas isentas de Credencial, nomeadas por método e caminho, e nada mais: o
 * Cadastro, porque quem cria o Usuário ainda não tem Credencial (FR-097); a
 * prova de vida, que é infraestrutura usada para subir os servidores; e o
 * pré-voo de CORS. **Qualquer outra rota exige Credencial**, inclusive uma rota
 * nova: é a lista de exceções que é curta, e não a regra (FR-090).
 */
const ROTAS_ISENTAS: ReadonlySet<string> = new Set([
  "POST /usuarios",
  "GET /health",
]);

/** Status da recusa por Credencial (FR-090). */
const NAO_AUTENTICADO = 401;

/** Status da falha do armazenamento na verificação (FR-044, FR-045). */
const INDISPONIVEL = 503;

/**
 * A requisição passa a carregar o Usuário que Entrou, decorado pelo hook no
 * sucesso da verificação. É dele que a rota tira o `usuarioId` com que constrói
 * o `Acervo` **daquela** requisição (FR-092); a Credencial em si — e a Senha em
 * particular — **não** entra no `Acervo` nem em nenhuma outra parte.
 */
declare module "fastify" {
  interface FastifyRequest {
    usuarioQueEntrou: UsuarioCadastrado;
  }
}

/** O caminho da requisição, sem a consulta. */
function caminhoDa(requisicao: FastifyRequest): string {
  return requisicao.url.split("?")[0] ?? "";
}

/** Diz se a requisição é uma das isentas: as três exceções, e só elas. */
function isenta(requisicao: FastifyRequest): boolean {
  return (
    requisicao.method === "OPTIONS" ||
    ROTAS_ISENTAS.has(`${requisicao.method} ${caminhoDa(requisicao)}`)
  );
}

/**
 * Decodifica `Authorization: Basic base64(nomeDeUsuario:senha)`.
 *
 * Devolve `null` para o cabeçalho ausente, de outro esquema ou sem o separador
 * entre Nome de usuário e Senha — todos os casos de forma inválida, que são
 * recusados com a mesma resposta de uma Credencial que não confere. O valor
 * decodificado é usado como veio: o descarte dos espaços ao redor do Nome de
 * usuário e a comparação sem distinguir maiúsculas de minúsculas são regras do
 * `Identidade` (FR-087).
 */
function credencialDoCabecalho(
  cabecalho: string | undefined,
): { nomeDeUsuario: string; senha: string } | null {
  if (cabecalho === undefined) {
    return null;
  }

  const separador = cabecalho.indexOf(" ");

  if (separador < 0) {
    return null;
  }

  const esquema = cabecalho.slice(0, separador).toLowerCase();
  const valor = cabecalho.slice(separador + 1).trim();

  if (esquema !== "basic" || valor.length === 0) {
    return null;
  }

  const decodificado = Buffer.from(valor, "base64").toString("utf8");
  const doisPontos = decodificado.indexOf(":");

  if (doisPontos < 0) {
    return null;
  }

  return {
    nomeDeUsuario: decodificado.slice(0, doisPontos),
    senha: decodificado.slice(doisPontos + 1),
  };
}

/** Responde a recusa de Credencial, sem `WWW-Authenticate` e sem `Set-Cookie`. */
function recusarCredencial(resposta: FastifyReply) {
  return resposta.status(NAO_AUTENTICADO).send(CREDENCIAL_INVALIDA);
}

/**
 * Registra, no servidor informado, o hook que exige a Credencial antes de toda
 * rota, exceto as isentas.
 *
 * A verificação é da Interface do `Identidade` — a Senha em texto claro nunca
 * sai daqui, e é por isso que nenhum log a alcança (FR-078). Chamada na
 * criação do servidor, antes das rotas, de modo que nenhuma rota precise
 * lembrar da regra.
 */
export function exigirCredencial(
  servidor: FastifyInstance,
  identidade: Identidade,
): void {
  /**
   * O valor decorado nasce vazio e recebe o Usuário no sucesso da verificação.
   * O tipo declarado na requisição é o do valor **já preenchido**: as rotas só
   * o leem depois de o hook ter passado, e nenhum caminho do ciclo de vida
   * executa uma rota sem ter decorado o dono.
   */
  servidor.decorateRequest(
    "usuarioQueEntrou",
    null as unknown as UsuarioCadastrado,
  );

  servidor.addHook("onRequest", async (requisicao, resposta) => {
    if (isenta(requisicao)) {
      return;
    }

    const credencial = credencialDoCabecalho(requisicao.headers.authorization);

    if (credencial === null) {
      return recusarCredencial(resposta);
    }

    const resultado = await identidade.autenticar(credencial);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return resposta.status(INDISPONIVEL).send({
          erro: resultado.erro,
          mensagem: resultado.mensagem,
        });
      }

      return recusarCredencial(resposta);
    }

    requisicao.usuarioQueEntrou = resultado.usuario;
  });
}
