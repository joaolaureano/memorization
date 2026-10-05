import { NAO_AUTENTICADO } from "../acervo-cliente/cliente";
import type {
  ClienteDoAcervo,
  DadosDeBaralho,
  DadosDeCartao,
  DadosDeEntrada,
  DadosDeExclusaoDeConta,
  DadosDeInicioDeCompromisso,
  DadosDeTrocaDeSenha,
  DadosDeRegistro,
  DadosDeRotina,
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
    entrar: (dados: DadosDeEntrada) => cliente.entrar(dados),

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

    registrarSessao: async (dados: DadosDeRegistro) =>
      vigiar(await cliente.registrarSessao(dados)),

    obterEstatisticas: async (desde: string) =>
      vigiar(await cliente.obterEstatisticas(desde)),

    obterRegistroDeSessao: async (id: string) =>
      vigiar(await cliente.obterRegistroDeSessao(id)),

    obterPrevias: async (cartaoIds: string[]) =>
      vigiar(await cliente.obterPrevias(cartaoIds)),

    obterPreferencias: async () => vigiar(await cliente.obterPreferencias()),

    salvarPreferencias: async (preferencias: { algoritmo: string }) => vigiar(await cliente.salvarPreferencias(preferencias)),

    obterAgenda: async (inicio: string, fuso: string) =>
      vigiar(await cliente.obterAgenda(inicio, fuso)),

    listarRotinas: async () => vigiar(await cliente.listarRotinas()),

    salvarRotina: async (dados: DadosDeRotina) =>
      vigiar(await cliente.salvarRotina(dados)),

    iniciarCompromisso: async (dados: DadosDeInicioDeCompromisso) =>
      vigiar(await cliente.iniciarCompromisso(dados)),

    obterConta: async () => vigiar(await cliente.obterConta()),

    trocarSenha: async (dados: DadosDeTrocaDeSenha) =>
      vigiar(await cliente.trocarSenha(dados)),

    excluirConta: async (dados: DadosDeExclusaoDeConta) =>
      vigiar(await cliente.excluirConta(dados)),

    // O Acesso temporário (018): a carga e a renovação passam pela guarda, de
    // modo que a recusa por Acesso expirado leva a Entrar (FR-091 revisado,
    // FR-294); `obterAcesso` e `sair` são da casca, que trata os próprios
    // resultados.
    obterAcesso: () => cliente.obterAcesso(),

    renovarAcesso: async () => vigiar(await cliente.renovarAcesso()),

    sair: () => cliente.sair(),
  };
}
