import { NAO_AUTENTICADO } from "../acervo-cliente/cliente";
import type {
  ClienteDoAcervo,
  Credencial,
  DadosDeBaralho,
  DadosDeCartao,
  DadosDeUsuario,
} from "../acervo-cliente/cliente";

/**
 * Guarda de Credencial da interface (T710; FR-091, SC-035).
 *
 * A Interface `ClienteDoAcervo` ganhou o modo de erro `nao_autenticado`, e toda
 * tela do acervo teria de tratar a recusa: descartar a Credencial, voltar a
 * "Entrar" com mensagem explicativa e não apresentar a operação como concluída
 * (FR-091, FR-044). Repetir essa decisão em cada tela seria uma regra
 * reproduzida — e esquecida na próxima tela.
 *
 * Aqui ela vive **uma vez**: a casca da aplicação envolve o cliente com esta
 * guarda e, em qualquer recusa por Credencial, a Credencial é descartada e a
 * tela "Entrar" volta com a explicação. O resultado devolvido às telas é
 * exatamente o que o Adapter devolveu — a operação recusada continua não
 * concluída, e nenhuma confirmação é anunciada.
 *
 * Não é um terceiro Adapter da Seam nem uma Seam nova: nenhum estado, nenhuma
 * regra de domínio e nenhum caminho de dados existem aqui, apenas o repasse de
 * cada verbo da Interface com a leitura do desfecho. `entrar` fica de fora: a
 * recusa de Entrar é assunto da própria tela "Entrar", que já é a tela de
 * destino.
 */

/** O desfecho de uma operação do acervo, seja qual for o verbo. */
type ResultadoDoAcervo =
  | { ok: true }
  | { ok: false; erro: string; mensagem: string };

/**
 * Envolve o cliente com a guarda de Credencial: toda operação do acervo cujo
 * desfecho seja `nao_autenticado` avisa `aoRecusarCredencial`, que descarta a
 * Credencial e devolve a pessoa a "Entrar" (FR-091).
 */
export function comGuardaDeCredencial(
  cliente: ClienteDoAcervo,
  aoRecusarCredencial: (mensagem: string) => void,
): ClienteDoAcervo {
  /**
   * Observa o desfecho antes de entregá-lo à tela: a recusa por Credencial é
   * anunciada à casca, e o resultado segue intacto — a operação continua
   * aparecendo como não concluída (FR-044).
   */
  function vigiar<Resultado extends ResultadoDoAcervo>(
    resultado: Resultado,
  ): Resultado {
    if (!resultado.ok && resultado.erro === NAO_AUTENTICADO) {
      aoRecusarCredencial(resultado.mensagem);
    }

    return resultado;
  }

  return {
    entrar: (credencial: Credencial) => cliente.entrar(credencial),

    criarCartao: async (dados: DadosDeCartao) =>
      vigiar(await cliente.criarCartao(dados)),

    listarCartoes: async () => vigiar(await cliente.listarCartoes()),

    criarBaralho: async (dados: DadosDeBaralho) =>
      vigiar(await cliente.criarBaralho(dados)),

    listarBaralhos: async () => vigiar(await cliente.listarBaralhos()),

    obterBaralho: async (id: string) => vigiar(await cliente.obterBaralho(id)),

    vincular: async (cartaoId: string, baralhoId: string) =>
      vigiar(await cliente.vincular(cartaoId, baralhoId)),

    desvincular: async (cartaoId: string, baralhoId: string) =>
      vigiar(await cliente.desvincular(cartaoId, baralhoId)),

    editarCartao: async (id: string, frente: string, verso: string) =>
      vigiar(await cliente.editarCartao(id, frente, verso)),

    renomearBaralho: async (id: string, nome: string) =>
      vigiar(await cliente.renomearBaralho(id, nome)),

    excluirCartao: async (id: string) => vigiar(await cliente.excluirCartao(id)),

    excluirBaralho: async (id: string) =>
      vigiar(await cliente.excluirBaralho(id)),

    criarUsuario: async (dados: DadosDeUsuario) =>
      vigiar(await cliente.criarUsuario(dados)),
  };
}
