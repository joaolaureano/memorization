import {
  INDISPONIVEL,
  MENSAGEM_DE_AGENDA_INDISPONIVEL,
  MENSAGEM_DE_CREDENCIAL_INVALIDA,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_PREFERENCIAS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
  MENSAGEM_DE_ACESSO_EXPIRADO,
  MENSAGEM_DE_INDISPONIBILIDADE_DA_CONTA,
  MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
  MENSAGEM_DE_NAO_AUTENTICADO,
  NAO_AUTENTICADO,
} from "./cliente";
import type {
  Avaliacao,
  CampoDeConta,
  CodigoDeErroDeConta,
  ContagensDaConta,
  DadosDaConta,
  DadosDeEntrada,
  DadosDeExclusaoDeConta,
  DadosDeTrocaDeSenha,
  RecusaDeConta,
  ResultadoDeAcaoDeConta,
  ResultadoDeObterAcesso,
  ResultadoDeObterConta,
  ResultadoDeRenovarAcesso,
  ResultadoDeSair,
  Baralho,
  BaralhoComCartoes,
  BaralhoListado,
  Cartao,
  CodigoDeErroDeAgenda,
  CompromissoDeEstudo,
  InicioDeCompromisso,
  RotinaDeEstudo,
  SemanaDaAgenda,
  CartaoListado,
  ClienteDoAcervo,
  Credencial,
  DadosDeBaralho,
  DadosDeCartao,
  DadosDeInicioDeCompromisso,
  DadosDeRegistro,
  DadosDeRotina,
  DadosDeUsuario,
  Estatisticas,
  ItemDoLoteDeRevisao,
  ItemRegistrado,
  OpcaoDeAlgoritmo,
  Preferencias,
  Previa,
  RegistroDeSessao,
  RegistroResumido,
  ResumoDaRevisao,
  ResultadoDasPrevias,
  ResultadoDeCriacaoDeBaralho,
  ResultadoDeCriacaoDeCartao,
  ResultadoDeCriacaoDeUsuario,
  ResultadoDeDesvinculacao,
  ResultadoDeEdicaoDeCartao,
  ResultadoDeEntrar,
  ResultadoDeEstatisticas,
  ResultadoDeExclusaoDeBaralho,
  ResultadoDeExclusaoDeCartao,
  ResultadoDeIniciarCompromisso,
  ResultadoDeListagemDeBaralhos,
  ResultadoDeListagemDeCartoes,
  ResultadoDeListarRotinas,
  ResultadoDeObterAgenda,
  ResultadoDeObterBaralho,
  ResultadoDeObterRegistro,
  ResultadoDePreferencias,
  ResultadoDeRegistroDeSessao,
  ResultadoDeRenomeacaoDeBaralho,
  ResultadoDeSalvarPreferencias,
  ResultadoDeSalvarRotina,
  ResultadoDeVinculacao,
  ResultadoDoLoteDeRevisao,
  ResultadoDoResumoDaRevisao,
  Usuario,
} from "./cliente";
import { ehCodigoDeErroDeBaralho, ehCodigoDeErroDeCartao } from "./validacao";
import type {
  CodigoDeErroDeBaralho,
  CodigoDeErroDeCadastro,
  CodigoDeErroDeCartao,
} from "./validacao";

/**
 * Adapter HTTP do `ClienteDoAcervo` (T008, T106, T208, T403, T503, T607).
 *
 * Transporta as operações até a API conforme os contratos de Cartões, de
 * Baralhos, de Vínculos, de edição, de exclusão e de Usuários. O endereço da
 * API é recebido na construção — em tempo de build na aplicação (plan.md).
 *
 * Invariante do Adapter: nenhuma resposta que não seja de sucesso aparece
 * como operação concluída (FR-044). Sucesso é, exatamente, o status e o corpo
 * previstos no contrato de cada rota. Qualquer outra resposta — outro status,
 * corpo ilegível, código de erro fora do contrato, falha de rede — vira
 * `indisponivel`; o `401` do contrato, e só ele, vira `nao_autenticado`
 * (FR-090, FR-091).
 *
 * A Credencial chega pela **construção** e acompanha toda chamada, no
 * cabeçalho `Authorization: Basic base64(nomeDeUsuario:senha)`
 * (contracts/api-entrar.md). Ela não é guardada em lugar nenhum além deste
 * campo — que vive apenas enquanto a página estiver aberta (FR-089) —, nunca
 * aparece em URL, cookie ou armazenamento do navegador (SC-033), e é
 * apresentada de novo em cada operação, porque o servidor não mantém sessão
 * alguma (FR-079).
 */
export class ClienteHttp implements ClienteDoAcervo {
  private readonly endereco: string;

  /**
   * A Credencial apresentada em toda chamada, ou `null` enquanto a pessoa não
   * tiver entrado: sem ela, as rotas de acervo respondem `401` e o Adapter
   * traduz a recusa em `nao_autenticado`.
   */
  private readonly credencial: Credencial | null;

  /**
   * Verdadeiro quando a página opera pelo **Acesso temporário** (018): a
   * Credencial já não está na memória, e o navegador apresenta o cookie. É o
   * valor de `continuarConectado` quando uma chamada a `entrar` não o informa —
   * a verificação de um resultado incerto (017) repete o modo da página.
   */
  private readonly usaAcesso: boolean;

  constructor(
    enderecoDaApi: string,
    credencial: Credencial | null = null,
    usaAcesso = false,
  ) {
    this.endereco = enderecoDaApi.replace(/\/+$/, "");
    this.credencial = credencial;
    this.usaAcesso = usaAcesso;
  }

  /**
   * O único ponto por onde o cliente fala com a rede: **toda** chamada leva
   * `credentials: "include"`, para o navegador enviar e receber o cookie do
   * Acesso temporário (018, FR-297). O cookie é `HttpOnly`: nenhum script — este
   * inclusive — consegue lê-lo.
   */
  private pedir(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...init, credentials: "include" });
  }

  /**
   * Apresenta a Credencial informada para Entrar (FR-086) e devolve quem
   * entrou. A Credencial vem por parâmetro, e não da construção, porque é
   * exatamente ela que ainda está sendo verificada: `POST /entrar` é o único
   * verbo que roda sem Credencial verificada.
   *
   * A recusa é a do contrato — `401`, uma só mensagem, sem revelar se o Nome
   * de usuário existe (FR-088) —, e nenhuma resposta carrega a Senha
   * (FR-078).
   */
  async entrar(dados: DadosDeEntrada): Promise<ResultadoDeEntrar> {
    const credencial: Credencial = {
      nomeDeUsuario: dados.nomeDeUsuario,
      senha: dados.senha,
    };

    try {
      const resposta = await this.pedir(`${this.endereco}/entrar`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: cabecalhoDeCredencial(credencial),
        },
        // A Credencial vai no cabeçalho; o corpo só diz se um Acesso temporário
        // deve ser emitido (FR-292), e nunca carrega a Senha.
        body: JSON.stringify({
          continuarConectado: dados.continuarConectado ?? this.usaAcesso,
        }),
      });

      if (resposta.status === 200) {
        const usuario = lerUsuario(await resposta.json());

        if (usuario !== null) {
          return { ok: true, usuario };
        }

        return this.falhaDeIndisponibilidadeDeUsuarios();
      }

      if (resposta.status === 401) {
        return {
          ok: false,
          erro: NAO_AUTENTICADO,
          mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
        };
      }

      return this.falhaDeIndisponibilidadeDeUsuarios();
    } catch {
      return this.falhaDeIndisponibilidadeDeUsuarios();
    }
  }

  /**
   * Pergunta se este navegador tem Acesso temporário válido (FR-290):
   * `200 { nomeDeUsuario }`, ou `401` com `sem_acesso` ou `acesso_expirado`.
   * Qualquer outra resposta — inclusive o `503` — é `indisponivel`, que **não**
   * é expiração e não descarta o Acesso (FR-301).
   */
  async obterAcesso(): Promise<ResultadoDeObterAcesso> {
    try {
      const resposta = await this.pedir(`${this.endereco}/acesso`);

      if (resposta.status === 200) {
        const corpo: unknown = await resposta.json();

        if (
          typeof corpo === "object" &&
          corpo !== null &&
          typeof (corpo as Record<string, unknown>).nomeDeUsuario === "string"
        ) {
          return {
            ok: true,
            nomeDeUsuario: (corpo as { nomeDeUsuario: string }).nomeDeUsuario,
          };
        }
      }

      if (resposta.status === 401) {
        const motivo = await this.motivoDoAcesso(resposta);

        if (motivo === "acesso_expirado") {
          return {
            ok: false,
            erro: "acesso_expirado",
            mensagem: MENSAGEM_DE_ACESSO_EXPIRADO,
          };
        }

        if (motivo === "sem_acesso") {
          return {
            ok: false,
            erro: "sem_acesso",
            mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
          };
        }
      }

      return this.falhaDeIndisponibilidadeDoAcesso();
    } catch {
      return this.falhaDeIndisponibilidadeDoAcesso();
    }
  }

  /** Renova o Acesso por uma interação (FR-291): `204`, ou `401`/`503`. */
  async renovarAcesso(): Promise<ResultadoDeRenovarAcesso> {
    try {
      const resposta = await this.pedir(`${this.endereco}/acesso/renovar`, {
        method: "POST",
      });

      if (resposta.status === 204) {
        return { ok: true };
      }

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      return this.falhaDeIndisponibilidadeDoAcesso();
    } catch {
      return this.falhaDeIndisponibilidadeDoAcesso();
    }
  }

  /** Sair: encerra o Acesso deste navegador (FR-293); só `204` conclui. */
  async sair(): Promise<ResultadoDeSair> {
    try {
      const resposta = await this.pedir(`${this.endereco}/sair`, {
        method: "POST",
      });

      return resposta.status === 204
        ? { ok: true }
        : this.falhaDeIndisponibilidadeDoAcesso();
    } catch {
      return this.falhaDeIndisponibilidadeDoAcesso();
    }
  }

  async criarCartao(
    dados: DadosDeCartao,
  ): Promise<ResultadoDeCriacaoDeCartao> {
    try {
      const resposta = await this.pedir(`${this.endereco}/cartoes`, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.cabecalho() },
        body: JSON.stringify({ frente: dados.frente, verso: dados.verso }),
      });

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 201) {
        const cartao = lerCartao(await resposta.json());

        if (cartao !== null) {
          return { ok: true, cartao };
        }

        return this.falhaDeIndisponibilidade();
      }

      if (resposta.status === 400) {
        return this.traduzirRecusaDeCartao(await resposta.json());
      }

      return this.falhaDeIndisponibilidade();
    } catch {
      return this.falhaDeIndisponibilidade();
    }
  }

  async listarCartoes(): Promise<ResultadoDeListagemDeCartoes> {
    try {
      const resposta = await this.pedir(`${this.endereco}/cartoes`, {
        headers: this.cabecalho(),
      });

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const cartoes = lerListaDeCartoesListados(await resposta.json());

        if (cartoes !== null) {
          return { ok: true, cartoes };
        }

        return this.falhaDeIndisponibilidade();
      }

      return this.falhaDeIndisponibilidade();
    } catch {
      return this.falhaDeIndisponibilidade();
    }
  }

  async criarBaralho(
    dados: DadosDeBaralho,
  ): Promise<ResultadoDeCriacaoDeBaralho> {
    try {
      const resposta = await this.pedir(`${this.endereco}/baralhos`, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.cabecalho() },
        body: JSON.stringify({ nome: dados.nome }),
      });

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 201) {
        const baralho = lerBaralho(await resposta.json());

        if (baralho !== null) {
          return { ok: true, baralho };
        }

        return this.falhaDeIndisponibilidadeDeBaralhos();
      }

      if (resposta.status === 400) {
        return this.traduzirRecusaDeBaralho(await resposta.json());
      }

      return this.falhaDeIndisponibilidadeDeBaralhos();
    } catch {
      return this.falhaDeIndisponibilidadeDeBaralhos();
    }
  }

  async listarBaralhos(): Promise<ResultadoDeListagemDeBaralhos> {
    try {
      const resposta = await this.pedir(`${this.endereco}/baralhos`, {
        headers: this.cabecalho(),
      });

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const baralhos = lerListaDeBaralhosListados(await resposta.json());

        if (baralhos !== null) {
          return { ok: true, baralhos };
        }

        return this.falhaDeIndisponibilidadeDeBaralhos();
      }

      return this.falhaDeIndisponibilidadeDeBaralhos();
    } catch {
      return this.falhaDeIndisponibilidadeDeBaralhos();
    }
  }

  async obterBaralho(id: string): Promise<ResultadoDeObterBaralho> {
    try {
      const resposta = await this.pedir(
        `${this.endereco}/baralhos/${encodeURIComponent(id)}`,
        { headers: this.cabecalho() },
      );

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const baralho = lerBaralhoComCartoes(await resposta.json());

        if (baralho !== null) {
          return { ok: true, baralho };
        }

        return this.falhaDeIndisponibilidadeDeBaralhos();
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeBaralhos();
    } catch {
      return this.falhaDeIndisponibilidadeDeBaralhos();
    }
  }

  async vincular(
    cartaoId: string,
    baralhoId: string,
  ): Promise<ResultadoDeVinculacao> {
    try {
      const resposta = await this.pedir(
        `${this.endereco}/baralhos/${encodeURIComponent(baralhoId)}/vinculos`,
        {
          method: "POST",
          headers: { "content-type": "application/json", ...this.cabecalho() },
          body: JSON.stringify({ cartaoId }),
        },
      );

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 201) {
        return { ok: true };
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      if (resposta.status === 409) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "vinculo_duplicado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeVinculos();
    } catch {
      return this.falhaDeIndisponibilidadeDeVinculos();
    }
  }

  async desvincular(
    cartaoId: string,
    baralhoId: string,
  ): Promise<ResultadoDeDesvinculacao> {
    try {
      const resposta = await this.pedir(
        `${this.endereco}/baralhos/${encodeURIComponent(baralhoId)}/vinculos/${encodeURIComponent(cartaoId)}`,
        { method: "DELETE", headers: this.cabecalho() },
      );

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 204) {
        return { ok: true };
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "vinculo_nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeVinculos();
    } catch {
      return this.falhaDeIndisponibilidadeDeVinculos();
    }
  }

  async editarCartao(
    id: string,
    frente: string,
    verso: string,
  ): Promise<ResultadoDeEdicaoDeCartao> {
    try {
      const resposta = await this.pedir(
        `${this.endereco}/cartoes/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json", ...this.cabecalho() },
          body: JSON.stringify({ frente, verso }),
        },
      );

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const cartao = lerCartao(await resposta.json());

        if (cartao !== null) {
          return { ok: true, cartao };
        }

        return this.falhaDeIndisponibilidade();
      }

      if (resposta.status === 400) {
        return this.traduzirRecusaDeCartao(await resposta.json());
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidade();
    } catch {
      return this.falhaDeIndisponibilidade();
    }
  }

  async renomearBaralho(
    id: string,
    nome: string,
  ): Promise<ResultadoDeRenomeacaoDeBaralho> {
    try {
      const resposta = await this.pedir(
        `${this.endereco}/baralhos/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json", ...this.cabecalho() },
          body: JSON.stringify({ nome }),
        },
      );

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const baralho = lerBaralho(await resposta.json());

        if (baralho !== null) {
          return { ok: true, baralho };
        }

        return this.falhaDeIndisponibilidadeDeBaralhos();
      }

      if (resposta.status === 400) {
        return this.traduzirRecusaDeBaralho(await resposta.json());
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeBaralhos();
    } catch {
      return this.falhaDeIndisponibilidadeDeBaralhos();
    }
  }

  async excluirCartao(id: string): Promise<ResultadoDeExclusaoDeCartao> {
    try {
      const resposta = await this.pedir(
        `${this.endereco}/cartoes/${encodeURIComponent(id)}`,
        { method: "DELETE", headers: this.cabecalho() },
      );

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 204) {
        return { ok: true };
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidade();
    } catch {
      return this.falhaDeIndisponibilidade();
    }
  }

  async excluirBaralho(id: string): Promise<ResultadoDeExclusaoDeBaralho> {
    try {
      const resposta = await this.pedir(
        `${this.endereco}/baralhos/${encodeURIComponent(id)}`,
        { method: "DELETE", headers: this.cabecalho() },
      );

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 204) {
        return { ok: true };
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeBaralhos();
    } catch {
      return this.falhaDeIndisponibilidadeDeBaralhos();
    }
  }

  async criarUsuario(
    dados: DadosDeUsuario,
  ): Promise<ResultadoDeCriacaoDeUsuario> {
    try {
      const resposta = await this.pedir(`${this.endereco}/usuarios`, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.cabecalho() },
        body: JSON.stringify({
          nomeDeUsuario: dados.nomeDeUsuario,
          senha: dados.senha,
        }),
      });

      if (resposta.status === 201) {
        const usuario = lerUsuario(await resposta.json());

        if (usuario !== null) {
          return { ok: true, usuario };
        }

        return this.falhaDeIndisponibilidadeDeUsuarios();
      }

      if (resposta.status === 400) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaDeRegraDeCadastro(corpo)) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      if (resposta.status === 409) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nome_de_usuario_existente")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeUsuarios();
    } catch {
      return this.falhaDeIndisponibilidadeDeUsuarios();
    }
  }

  async obterAgenda(
    inicio: string,
    fuso: string,
  ): Promise<ResultadoDeObterAgenda> {
    const resultado = await this.pedirAgenda(
      `/agenda?inicio=${encodeURIComponent(inicio)}&fuso=${encodeURIComponent(fuso)}`,
      { method: "GET" },
      [200],
      lerSemanaDaAgenda,
    );

    return resultado.ok
      ? { ok: true, agenda: resultado.valor }
      : resultado;
  }

  async listarRotinas(): Promise<ResultadoDeListarRotinas> {
    const resultado = await this.pedirAgenda(
      "/agenda/rotinas",
      { method: "GET" },
      [200],
      (corpo) => {
        const lista =
          typeof corpo === "object" && corpo !== null
            ? (corpo as Record<string, unknown>).rotinas
            : null;

        if (!Array.isArray(lista)) {
          return null;
        }

        const rotinas = lista.map(lerRotinaDeEstudo);

        return rotinas.every((rotina) => rotina !== null)
          ? (rotinas as RotinaDeEstudo[])
          : null;
      },
    );

    return resultado.ok
      ? { ok: true, rotinas: resultado.valor }
      : resultado;
  }

  async salvarRotina(dados: DadosDeRotina): Promise<ResultadoDeSalvarRotina> {
    const resultado = await this.pedirAgenda(
      "/agenda/rotinas",
      { method: "POST", body: JSON.stringify(dados) },
      [200, 201],
      (corpo) =>
        typeof corpo === "object" && corpo !== null
          ? lerRotinaDeEstudo((corpo as Record<string, unknown>).rotina)
          : null,
    );

    return resultado.ok
      ? { ok: true, rotina: resultado.valor }
      : resultado;
  }

  async iniciarCompromisso(
    dados: DadosDeInicioDeCompromisso,
  ): Promise<ResultadoDeIniciarCompromisso> {
    const resultado = await this.pedirAgenda(
      "/agenda/inicios",
      { method: "POST", body: JSON.stringify(dados) },
      [201],
      (corpo) =>
        typeof corpo === "object" && corpo !== null
          ? lerInicioDeCompromisso((corpo as Record<string, unknown>).inicio)
          : null,
    );

    return resultado.ok
      ? { ok: true, inicio: resultado.valor }
      : resultado;
  }

  /**
   * O transporte comum das quatro operações da Agenda: Credencial no cabeçalho,
   * `401` vira `nao_autenticado`, os status de sucesso do contrato devolvem o
   * corpo validado por `ler`, e `400`, `404` e `409` carregam o código estável
   * do contrato com a mensagem em português. Qualquer outra resposta — corpo
   * fora do contrato, `503`, falha de rede — vira `indisponivel`, e a operação
   * **nunca** é apresentada como concluída (FR-251).
   */
  private async pedirAgenda<T>(
    caminho: string,
    init: { method: "GET" | "POST"; body?: string },
    sucessos: readonly number[],
    ler: (corpo: unknown) => T | null,
  ): Promise<
    | { ok: true; valor: T }
    | { ok: false; erro: CodigoDeErroDeAgenda; mensagem: string }
  > {
    try {
      const resposta = await this.pedir(`${this.endereco}${caminho}`, {
        ...init,
        headers: {
          ...(init.body === undefined
            ? {}
            : { "content-type": "application/json" }),
          ...this.cabecalho(),
        },
      });

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (sucessos.includes(resposta.status)) {
        const valor = ler(await resposta.json());

        return valor === null
          ? this.falhaDaAgenda()
          : { ok: true, valor };
      }

      const codigoDoStatus: Record<number, readonly CodigoDeErroDeAgenda[]> = {
        400: ["dados_invalidos"],
        404: ["nao_encontrado"],
        409: ["conflito", "sobreposicao"],
      };
      const permitidos = codigoDoStatus[resposta.status];

      if (permitidos !== undefined) {
        const corpo: unknown = await resposta.json();

        if (
          typeof corpo === "object" &&
          corpo !== null &&
          typeof (corpo as Record<string, unknown>).mensagem === "string" &&
          permitidos.includes(
            (corpo as Record<string, unknown>).erro as CodigoDeErroDeAgenda,
          )
        ) {
          return {
            ok: false,
            erro: (corpo as { erro: CodigoDeErroDeAgenda }).erro,
            mensagem: (corpo as { mensagem: string }).mensagem,
          };
        }
      }

      return this.falhaDaAgenda();
    } catch {
      return this.falhaDaAgenda();
    }
  }

  private falhaDaAgenda(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_AGENDA_INDISPONIVEL,
    };
  }

  async registrarSessao(
    dados: DadosDeRegistro,
  ): Promise<ResultadoDeRegistroDeSessao> {
    try {
      const resposta = await this.pedir(`${this.endereco}/sessoes`, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.cabecalho() },
        body: JSON.stringify({
          id: dados.id,
          origem: dados.origem,
          baralhoId: dados.baralhoId,
          nomeDoBaralho: dados.nomeDoBaralho,
          ...(dados.inicioAgendaId !== undefined
            ? { inicioAgendaId: dados.inicioAgendaId }
            : {}),
          itens: dados.itens.map((item) => ({
            frente: item.frente,
            verso: item.verso,
            cartaoId: item.cartaoId,
            avaliacao: item.avaliacao,
          })),
        }),
      });

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      // 201 é o registro novo e 200 é o mesmo registro reenviado com o mesmo
      // `id`: os dois entregam o mesmo corpo, e o Adapter não distingue os
      // desfechos para o caller (FR-163).
      if (resposta.status === 201 || resposta.status === 200) {
        const registro = lerRegistroDeSessao(await resposta.json());

        if (registro !== null) {
          return { ok: true, registro };
        }

        return this.falhaDeIndisponibilidadeDeHistorico();
      }

      if (resposta.status === 400) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "dados_invalidos")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      if (resposta.status === 409) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "conflito")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeHistorico();
    } catch {
      return this.falhaDeIndisponibilidadeDeHistorico();
    }
  }

  async obterEstatisticas(desde: string): Promise<ResultadoDeEstatisticas> {
    try {
      const resposta = await this.pedir(
        `${this.endereco}/estatisticas?desde=${encodeURIComponent(desde)}`,
        { headers: this.cabecalho() },
      );

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const estatisticas = lerEstatisticas(await resposta.json());

        if (estatisticas !== null) {
          return { ok: true, estatisticas };
        }

        return this.falhaDeIndisponibilidadeDeHistorico();
      }

      return this.falhaDeIndisponibilidadeDeHistorico();
    } catch {
      return this.falhaDeIndisponibilidadeDeHistorico();
    }
  }

  async obterRegistroDeSessao(id: string): Promise<ResultadoDeObterRegistro> {
    try {
      const resposta = await this.pedir(
        `${this.endereco}/sessoes/${encodeURIComponent(id)}`,
        { headers: this.cabecalho() },
      );

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const lido = lerRegistroComBaralho(await resposta.json());

        if (lido !== null) {
          return {
            ok: true,
            registro: lido.registro,
            baralhoExiste: lido.baralhoExiste,
          };
        }

        return this.falhaDeIndisponibilidadeDeHistorico();
      }

      if (resposta.status === 404) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "nao_encontrado")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDeHistorico();
    } catch {
      return this.falhaDeIndisponibilidadeDeHistorico();
    }
  }

  /**
   * O resumo da Revisão do dia (FR-198, FR-199). Os limites do dia vão na
   * query, codificados, e nenhuma resposta fora do contrato atravessa: vira
   * `indisponivel` (FR-044).
   */
  async obterResumoDaRevisao(
    inicioDoDia: string,
    fimDoDia: string,
  ): Promise<ResultadoDoResumoDaRevisao> {
    try {
      const resposta = await this.pedir(
        `${this.endereco}/revisao?inicioDoDia=${encodeURIComponent(inicioDoDia)}&fimDoDia=${encodeURIComponent(fimDoDia)}`,
        { headers: this.cabecalho() },
      );

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const resumo = lerResumoDaRevisao(await resposta.json());

        if (resumo !== null) {
          return { ok: true, resumo };
        }

        return this.falhaDeIndisponibilidadeDeRevisao();
      }

      return this.falhaDeIndisponibilidadeDeRevisao();
    } catch {
      return this.falhaDeIndisponibilidadeDeRevisao();
    }
  }

  /**
   * O lote da Revisão do dia, já ordenado pelo servidor (FR-201, FR-203). Cada
   * Item traz a prévia de cada Avaliação (FR-221).
   */
  async obterLoteDeRevisao(
    inicioDoDia: string,
    fimDoDia: string,
  ): Promise<ResultadoDoLoteDeRevisao> {
    try {
      const resposta = await this.pedir(
        `${this.endereco}/revisao/lote?inicioDoDia=${encodeURIComponent(inicioDoDia)}&fimDoDia=${encodeURIComponent(fimDoDia)}`,
        { headers: this.cabecalho() },
      );

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const itens = lerLoteDeRevisao(await resposta.json());

        if (itens !== null) {
          return { ok: true, itens };
        }

        return this.falhaDeIndisponibilidadeDeRevisao();
      }

      return this.falhaDeIndisponibilidadeDeRevisao();
    } catch {
      return this.falhaDeIndisponibilidadeDeRevisao();
    }
  }

  /**
   * A prévia dos Cartões informados, para o estudo livre (FR-221). Os
   * `cartaoIds` vão no corpo, como no contrato.
   */
  async obterPrevias(cartaoIds: string[]): Promise<ResultadoDasPrevias> {
    try {
      const resposta = await this.pedir(`${this.endereco}/previas`, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.cabecalho() },
        body: JSON.stringify({ cartaoIds }),
      });

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const previas = lerPrevias(await resposta.json());

        if (previas !== null) {
          return { ok: true, previas };
        }

        return this.falhaDeIndisponibilidadeDeRevisao();
      }

      return this.falhaDeIndisponibilidadeDeRevisao();
    } catch {
      return this.falhaDeIndisponibilidadeDeRevisao();
    }
  }

  /** As Preferências do Usuário mais a lista de algoritmos (FR-212). */
  async obterPreferencias(): Promise<ResultadoDePreferencias> {
    try {
      const resposta = await this.pedir(`${this.endereco}/preferencias`, {
        headers: this.cabecalho(),
      });

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const preferencias = lerPreferencias(await resposta.json());

        if (preferencias !== null) {
          return { ok: true, preferencias };
        }

        return this.falhaDeIndisponibilidadeDePreferencias();
      }

      return this.falhaDeIndisponibilidadeDePreferencias();
    } catch {
      return this.falhaDeIndisponibilidadeDePreferencias();
    }
  }

  /**
   * Salva as Preferências (FR-200, FR-212). O `400 dados_invalidos` é a única
   * recusa de domínio; qualquer outro código de 400 é resposta fora do
   * contrato e vira `indisponivel`.
   */
  async salvarPreferencias(preferencias: {
    algoritmo: string;
    limiteDeNovosPorDia: number;
  }): Promise<ResultadoDeSalvarPreferencias> {
    try {
      const resposta = await this.pedir(`${this.endereco}/preferencias`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...this.cabecalho() },
        body: JSON.stringify({
          algoritmo: preferencias.algoritmo,
          limiteDeNovosPorDia: preferencias.limiteDeNovosPorDia,
        }),
      });

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const salvas = lerPreferencias(await resposta.json());

        if (salvas !== null) {
          return { ok: true, preferencias: salvas };
        }

        return this.falhaDeIndisponibilidadeDePreferencias();
      }

      if (resposta.status === 400) {
        const corpo = await resposta.json();

        if (ehCorpoDeRecusaComCodigo(corpo, "dados_invalidos")) {
          return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
        }
      }

      return this.falhaDeIndisponibilidadeDePreferencias();
    } catch {
      return this.falhaDeIndisponibilidadeDePreferencias();
    }
  }

  /** Nome de usuário atual e contagens (FR-257, FR-258). */
  async obterConta(): Promise<ResultadoDeObterConta> {
    try {
      const resposta = await this.pedir(`${this.endereco}/conta`, {
        headers: this.cabecalho(),
      });

      if (resposta.status === 401) {
        return await this.falhaDeNaoAutenticadoDe(resposta);
      }

      if (resposta.status === 200) {
        const dados = lerDadosDaConta(await resposta.json());

        if (dados !== null) {
          return { ok: true, dados };
        }
      }

      return this.falhaDeIndisponibilidadeDaConta();
    } catch {
      return this.falhaDeIndisponibilidadeDaConta();
    }
  }

  /** Troca a Senha (FR-266..FR-271): `204`, ou `400`/`403` do contrato. */
  async trocarSenha(
    dados: DadosDeTrocaDeSenha,
  ): Promise<ResultadoDeAcaoDeConta> {
    try {
      const resposta = await this.pedir(`${this.endereco}/conta/senha`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...this.cabecalho() },
        body: JSON.stringify({
          senhaAtual: dados.senhaAtual,
          novaSenha: dados.novaSenha,
          confirmacaoDaSenha: dados.confirmacaoDaSenha,
        }),
      });

      if (resposta.status === 204) {
        return { ok: true };
      }

      return await this.traduzirRecusaDeConta(resposta, {
        400: ["dados_invalidos", "mesma_senha"],
        403: ["senha_atual_incorreta"],
      });
    } catch {
      return this.falhaDeIndisponibilidadeDaConta();
    }
  }

  /** Exclui a conta (FR-272..FR-278): `204`, ou `403` do contrato. */
  async excluirConta(
    dados: DadosDeExclusaoDeConta,
  ): Promise<ResultadoDeAcaoDeConta> {
    try {
      const resposta = await this.pedir(`${this.endereco}/conta`, {
        method: "DELETE",
        headers: { "content-type": "application/json", ...this.cabecalho() },
        body: JSON.stringify({ senhaAtual: dados.senhaAtual }),
      });

      if (resposta.status === 204) {
        return { ok: true };
      }

      return await this.traduzirRecusaDeConta(resposta, {
        403: ["senha_atual_incorreta"],
      });
    } catch {
      return this.falhaDeIndisponibilidadeDaConta();
    }
  }

  /**
   * Traduz a recusa de uma ação da conta: `401` é a Credencial recusada
   * (`nao_autenticado`); os códigos permitidos por status são os do contrato,
   * e qualquer outra resposta — outro status, outro código, corpo ilegível —
   * é `indisponivel`, e a ação continua não concluída (FR-044).
   */
  private async traduzirRecusaDeConta(
    resposta: Response,
    permitidos: Readonly<Record<number, readonly CodigoDeErroDeConta[]>>,
  ): Promise<RecusaDeConta> {
    if (resposta.status === 401) {
      return await this.falhaDeNaoAutenticadoDe(resposta);
    }

    const codigos = permitidos[resposta.status];

    if (codigos !== undefined) {
      const corpo: unknown = await resposta.json();

      if (typeof corpo === "object" && corpo !== null) {
        const campos = corpo as Record<string, unknown>;
        const codigo = codigos.find((candidato) => candidato === campos.erro);

        if (codigo !== undefined && typeof campos.mensagem === "string") {
          return {
            ok: false,
            erro: codigo,
            mensagem: campos.mensagem,
            ...(ehCampoDeConta(campos.campo) ? { campo: campos.campo } : {}),
          };
        }
      }
    }

    return this.falhaDeIndisponibilidadeDaConta();
  }

  private falhaDeIndisponibilidadeDaConta(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DA_CONTA,
    };
  }

  /**
   * Traduz a recusa uniforme do contrato de Cartões (`{ erro, mensagem }`) no
   * modo de erro correspondente. Um código que não seja regra de Cartão — por
   * exemplo `corpo_invalido` — não atravessa a Interface: vira
   * `indisponivel`, e a operação continua não concluída.
   */
  private traduzirRecusaDeCartao(corpo: unknown): {
    ok: false;
    erro: CodigoDeErroDeCartao | typeof INDISPONIVEL;
    mensagem: string;
  } {
    if (ehCorpoDeRecusaDeCartao(corpo)) {
      return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
    }

    return this.falhaDeIndisponibilidade();
  }

  /**
   * Traduz a recusa uniforme do contrato de Baralhos no modo de erro
   * correspondente. Um código que não seja regra de Baralho vira
   * `indisponivel`, e a operação continua não concluída.
   */
  private traduzirRecusaDeBaralho(corpo: unknown): {
    ok: false;
    erro: CodigoDeErroDeBaralho | typeof INDISPONIVEL;
    mensagem: string;
  } {
    if (ehCorpoDeRecusaDeBaralho(corpo)) {
      return { ok: false, erro: corpo.erro, mensagem: corpo.mensagem };
    }

    return this.falhaDeIndisponibilidadeDeBaralhos();
  }

  /**
   * O cabeçalho da Credencial, em toda chamada do acervo. Enquanto não houver
   * Credencial — a pessoa ainda não Entrou —, o cabeçalho não é enviado e a
   * API recusa: é o servidor, e nunca a interface, quem decide o que a
   * Credencial alcança.
   */
  private cabecalho(): Record<string, string> {
    if (this.credencial === null) {
      return {};
    }

    return { authorization: cabecalhoDeCredencial(this.credencial) };
  }

  /**
   * A recusa por Credencial (`401`), com a mensagem certa: `acesso_expirado`
   * leva a mensagem de expiração (FR-294), e qualquer outro `401` a mensagem
   * geral. O corpo ilegível não impede a recusa — ela é `nao_autenticado` de
   * todo modo.
   */
  private async falhaDeNaoAutenticadoDe(resposta: Response): Promise<{
    ok: false;
    erro: typeof NAO_AUTENTICADO;
    mensagem: string;
  }> {
    return (await this.motivoDoAcesso(resposta)) === "acesso_expirado"
      ? {
          ok: false,
          erro: NAO_AUTENTICADO,
          mensagem: MENSAGEM_DE_ACESSO_EXPIRADO,
        }
      : this.falhaDeNaoAutenticado();
  }

  /** O código do Acesso numa recusa `401`: `acesso_expirado`, `sem_acesso` ou nenhum. */
  private async motivoDoAcesso(
    resposta: Response,
  ): Promise<"acesso_expirado" | "sem_acesso" | null> {
    try {
      const corpo: unknown = await resposta.json();

      if (typeof corpo === "object" && corpo !== null) {
        const erro = (corpo as Record<string, unknown>).erro;

        if (erro === "acesso_expirado" || erro === "sem_acesso") {
          return erro;
        }
      }
    } catch {
      // Corpo ilegível: sem código de Acesso.
    }

    return null;
  }

  private falhaDeIndisponibilidadeDoAcesso(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DO_ACESSO,
    };
  }

  private falhaDeNaoAutenticado(): {
    ok: false;
    erro: typeof NAO_AUTENTICADO;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: NAO_AUTENTICADO,
      mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
    };
  }

  private falhaDeIndisponibilidade(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    };
  }

  private falhaDeIndisponibilidadeDeBaralhos(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    };
  }

  private falhaDeIndisponibilidadeDeVinculos(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
    };
  }

  private falhaDeIndisponibilidadeDeUsuarios(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
    };
  }

  private falhaDeIndisponibilidadeDeHistorico(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_HISTORICO,
    };
  }

  private falhaDeIndisponibilidadeDeRevisao(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_REVISAO,
    };
  }

  private falhaDeIndisponibilidadeDePreferencias(): {
    ok: false;
    erro: typeof INDISPONIVEL;
    mensagem: string;
  } {
    return {
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_PREFERENCIAS,
    };
  }
}

/**
 * Reconhece o corpo de recusa de **regra** de Cadastro: os dois códigos que o
 * status 400 do contrato publica. O código da duplicata pertence ao status 409
 * e, aqui, é resposta fora do contrato e vira `indisponivel`, como
 * `corpo_invalido`.
 */
function ehCorpoDeRecusaDeRegraDeCadastro(
  corpo: unknown,
): corpo is { erro: CodigoDeErroDeCadastro; mensagem: string } {
  if (typeof corpo !== "object" || corpo === null) {
    return false;
  }

  const campos = corpo as Record<string, unknown>;

  const ehCodigoDeRegra =
    campos.erro === "nome_de_usuario_invalido" ||
    campos.erro === "senha_invalida";

  return ehCodigoDeRegra && typeof campos.mensagem === "string";
}

/**
 * Reconhece o corpo de recusa do contrato de Cartões: código estável de regra
 * de Cartão e mensagem em texto. Qualquer outra forma é tratada como
 * indisponibilidade.
 */
function ehCorpoDeRecusaDeCartao(
  corpo: unknown,
): corpo is { erro: CodigoDeErroDeCartao; mensagem: string } {
  if (typeof corpo !== "object" || corpo === null) {
    return false;
  }

  const campos = corpo as Record<string, unknown>;

  return (
    ehCodigoDeErroDeCartao(campos.erro) &&
    typeof campos.mensagem === "string"
  );
}

/**
 * Reconhece o corpo de recusa do contrato de Baralhos: código estável de
 * regra de Baralho e mensagem em texto. Qualquer outra forma é tratada como
 * indisponibilidade.
 */
function ehCorpoDeRecusaDeBaralho(
  corpo: unknown,
): corpo is { erro: CodigoDeErroDeBaralho; mensagem: string } {
  if (typeof corpo !== "object" || corpo === null) {
    return false;
  }

  const campos = corpo as Record<string, unknown>;

  return (
    ehCodigoDeErroDeBaralho(campos.erro) &&
    typeof campos.mensagem === "string"
  );
}

/**
 * Reconhece um corpo de recusa com exatamente o código informado. Usado nas
 * operações em que o contrato prevê um único código para o status — qualquer
 * outro código, ainda que exista em outra rota, é resposta fora do contrato e
 * vira `indisponivel`.
 */
function ehCorpoDeRecusaComCodigo<Codigo extends string>(
  corpo: unknown,
  codigo: Codigo,
): corpo is { erro: Codigo; mensagem: string } {
  if (typeof corpo !== "object" || corpo === null) {
    return false;
  }

  const campos = corpo as Record<string, unknown>;

  return campos.erro === codigo && typeof campos.mensagem === "string";
}

/**
 * O valor do cabeçalho `Authorization`, no formato do contrato
 * (`contracts/api-entrar.md`): `Basic base64(nomeDeUsuario:senha)`.
 *
 * A codificação é em UTF-8, como a do servidor — uma Senha com qualquer
 * caractere chega intacta —, e o valor existe apenas na memória, no instante
 * da requisição: ele não é guardado, nem nunca entra numa URL, onde ficaria
 * registrado no histórico e no registro do servidor (FR-078, SC-033).
 */
function cabecalhoDeCredencial(credencial: Credencial): string {
  return `Basic ${base64DeTexto(`${credencial.nomeDeUsuario}:${credencial.senha}`)}`;
}

/** Codifica texto em base64 preservando os caracteres fora do ASCII. */
function base64DeTexto(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";

  for (const byte of bytes) {
    binario += String.fromCharCode(byte);
  }

  return btoa(binario);
}

/** Reconhece o campo de formulário que a API nomeia numa recusa de validação. */
function ehCampoDeConta(valor: unknown): valor is CampoDeConta {
  return (
    valor === "nomeDeUsuario" ||
    valor === "senhaAtual" ||
    valor === "novaSenha" ||
    valor === "confirmacaoDaSenha"
  );
}

function lerContagensDaConta(corpo: unknown): ContagensDaConta | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.cartoes !== "number" ||
    typeof campos.baralhos !== "number" ||
    typeof campos.registrosDeSessao !== "number" ||
    (campos.agenda !== null && typeof campos.agenda !== "number")
  ) {
    return null;
  }

  return {
    cartoes: campos.cartoes,
    baralhos: campos.baralhos,
    registrosDeSessao: campos.registrosDeSessao,
    agenda: campos.agenda,
  };
}

function lerDadosDaConta(corpo: unknown): DadosDaConta | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;
  const contagens = lerContagensDaConta(campos.contagens);

  if (typeof campos.nomeDeUsuario !== "string" || contagens === null) {
    return null;
  }

  return { nomeDeUsuario: campos.nomeDeUsuario, contagens };
}

function lerCartao(corpo: unknown): Cartao | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.id !== "string" ||
    typeof campos.frente !== "string" ||
    typeof campos.verso !== "string"
  ) {
    return null;
  }

  return {
    id: campos.id,
    frente: campos.frente,
    verso: campos.verso,
  };
}

function lerUsuario(corpo: unknown): Usuario | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.id !== "string" ||
    typeof campos.nomeDeUsuario !== "string"
  ) {
    return null;
  }

  // Só os campos canônicos atravessam a Interface: qualquer propriedade a mais
  // que a resposta traga — `sal`, `hash`, `parametros` ou a própria Senha — é
  // descartada aqui e não alcança o caller (FR-076, FR-078).
  return {
    id: campos.id,
    nomeDeUsuario: campos.nomeDeUsuario,
  };
}

function lerBaralho(corpo: unknown): Baralho | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (typeof campos.id !== "string" || typeof campos.nome !== "string") {
    return null;
  }

  return {
    id: campos.id,
    nome: campos.nome,
  };
}

function lerCartaoListado(corpo: unknown): CartaoListado | null {
  const cartao = lerCartao(corpo);

  if (cartao === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (!Array.isArray(campos.baralhos)) {
    return null;
  }

  const baralhos: Baralho[] = [];

  for (const item of campos.baralhos) {
    const baralho = lerBaralho(item);

    if (baralho === null) {
      return null;
    }

    baralhos.push(baralho);
  }

  return { ...cartao, baralhos };
}

function lerListaDeCartoesListados(corpo: unknown): CartaoListado[] | null {
  if (!Array.isArray(corpo)) {
    return null;
  }

  const cartoes: CartaoListado[] = [];

  for (const item of corpo) {
    const cartao = lerCartaoListado(item);

    if (cartao === null) {
      return null;
    }

    cartoes.push(cartao);
  }

  return cartoes;
}

function lerBaralhoListado(corpo: unknown): BaralhoListado | null {
  const baralho = lerBaralho(corpo);

  if (baralho === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;
  const quantidadeDeCartoes = campos.quantidadeDeCartoes;
  const elegivel = campos.elegivel;

  if (typeof quantidadeDeCartoes !== "number" || typeof elegivel !== "boolean") {
    return null;
  }

  return {
    ...baralho,
    quantidadeDeCartoes,
    elegivel,
  };
}

function lerListaDeBaralhosListados(corpo: unknown): BaralhoListado[] | null {
  if (!Array.isArray(corpo)) {
    return null;
  }

  const baralhos: BaralhoListado[] = [];

  for (const item of corpo) {
    const baralho = lerBaralhoListado(item);

    if (baralho === null) {
      return null;
    }

    baralhos.push(baralho);
  }

  return baralhos;
}

function lerBaralhoComCartoes(corpo: unknown): BaralhoComCartoes | null {
  const baralho = lerBaralho(corpo);

  if (baralho === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;
  const elegivel = campos.elegivel;
  const cartoesVinculados = campos.cartoes;

  if (typeof elegivel !== "boolean" || !Array.isArray(cartoesVinculados)) {
    return null;
  }

  const cartoes: Cartao[] = [];

  for (const item of cartoesVinculados) {
    const cartao = lerCartao(item);

    if (cartao === null) {
      return null;
    }

    cartoes.push(cartao);
  }

  return {
    ...baralho,
    elegivel,
    cartoes,
  };
}

function lerItemRegistrado(corpo: unknown): ItemRegistrado | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.posicao !== "number" ||
    typeof campos.frente !== "string" ||
    typeof campos.verso !== "string" ||
    (campos.resultado !== "acertou" && campos.resultado !== "errou")
  ) {
    return null;
  }

  const item: ItemRegistrado = {
    posicao: campos.posicao,
    frente: campos.frente,
    verso: campos.verso,
    resultado: campos.resultado,
  };

  // Cartão e Avaliação são opcionais: um Registro anterior à 015 não os tem, e
  // o Item atravessa a Interface exatamente como veio (FR-196, FR-197).
  if (campos.cartaoId !== undefined) {
    if (campos.cartaoId !== null && typeof campos.cartaoId !== "string") {
      return null;
    }

    item.cartaoId = campos.cartaoId;
  }

  if (campos.avaliacao !== undefined) {
    if (campos.avaliacao !== null && !ehAvaliacao(campos.avaliacao)) {
      return null;
    }

    item.avaliacao = campos.avaliacao;
  }

  return item;
}

/** Reconhece uma das 4 Avaliações (FR-193). */
function ehAvaliacao(valor: unknown): valor is Avaliacao {
  return (
    valor === "errei" ||
    valor === "dificil" ||
    valor === "bom" ||
    valor === "facil"
  );
}

function lerRegistroResumido(corpo: unknown): RegistroResumido | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.id !== "string" ||
    (campos.origem !== "baralho" && campos.origem !== "revisao") ||
    typeof campos.baralhoId !== "string" ||
    typeof campos.nomeDoBaralho !== "string" ||
    typeof campos.concluidaEm !== "string" ||
    typeof campos.estudados !== "number" ||
    typeof campos.acertos !== "number" ||
    typeof campos.erros !== "number"
  ) {
    return null;
  }

  return {
    id: campos.id,
    origem: campos.origem,
    baralhoId: campos.baralhoId,
    nomeDoBaralho: campos.nomeDoBaralho,
    concluidaEm: campos.concluidaEm,
    estudados: campos.estudados,
    acertos: campos.acertos,
    erros: campos.erros,
  };
}

function lerRegistroDeSessao(corpo: unknown): RegistroDeSessao | null {
  const resumo = lerRegistroResumido(corpo);

  if (resumo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (!Array.isArray(campos.itens)) {
    return null;
  }

  const itens: ItemRegistrado[] = [];

  for (const item of campos.itens) {
    const lido = lerItemRegistrado(item);

    if (lido === null) {
      return null;
    }

    itens.push(lido);
  }

  return { ...resumo, itens };
}

function lerListaDeRegistrosResumidos(
  corpo: unknown,
): RegistroResumido[] | null {
  if (!Array.isArray(corpo)) {
    return null;
  }

  const registros: RegistroResumido[] = [];

  for (const item of corpo) {
    const lido = lerRegistroResumido(item);

    if (lido === null) {
      return null;
    }

    registros.push(lido);
  }

  return registros;
}

function lerEstatisticas(corpo: unknown): Estatisticas | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.cartoes !== "number" ||
    typeof campos.baralhos !== "number"
  ) {
    return null;
  }

  const registrosDaJanela = lerListaDeRegistrosResumidos(
    campos.registrosDaJanela,
  );
  const recentes = lerListaDeRegistrosResumidos(campos.recentes);

  if (registrosDaJanela === null || recentes === null) {
    return null;
  }

  return {
    cartoes: campos.cartoes,
    baralhos: campos.baralhos,
    registrosDaJanela,
    recentes,
  };
}

function lerRegistroComBaralho(
  corpo: unknown,
): { registro: RegistroDeSessao; baralhoExiste: boolean } | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;
  const registro = lerRegistroDeSessao(campos.registro);

  if (registro === null || typeof campos.baralhoExiste !== "boolean") {
    return null;
  }

  return { registro, baralhoExiste: campos.baralhoExiste };
}

function lerResumoDaRevisao(corpo: unknown): ResumoDaRevisao | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.vencidos !== "number" ||
    typeof campos.novosHoje !== "number" ||
    typeof campos.total !== "number"
  ) {
    return null;
  }

  return {
    vencidos: campos.vencidos,
    novosHoje: campos.novosHoje,
    total: campos.total,
  };
}

/** Reconhece a prévia: o instante ISO de cada uma das 4 Avaliações (FR-221). */
function lerPrevia(corpo: unknown): Previa | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.errei !== "string" ||
    typeof campos.dificil !== "string" ||
    typeof campos.bom !== "string" ||
    typeof campos.facil !== "string"
  ) {
    return null;
  }

  return {
    errei: campos.errei,
    dificil: campos.dificil,
    bom: campos.bom,
    facil: campos.facil,
  };
}

function lerItemDoLote(corpo: unknown): ItemDoLoteDeRevisao | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;
  const cartao = lerCartao(campos.cartao);
  const previa = lerPrevia(campos.previa);

  if (cartao === null || previa === null) {
    return null;
  }

  return { cartao, previa };
}

function lerLoteDeRevisao(corpo: unknown): ItemDoLoteDeRevisao[] | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (!Array.isArray(campos.itens)) {
    return null;
  }

  const itens: ItemDoLoteDeRevisao[] = [];

  for (const item of campos.itens) {
    const lido = lerItemDoLote(item);

    if (lido === null) {
      return null;
    }

    itens.push(lido);
  }

  return itens;
}

function lerPrevias(corpo: unknown): Record<string, Previa> | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (typeof campos.previas !== "object" || campos.previas === null) {
    return null;
  }

  const previas: Record<string, Previa> = {};

  for (const [cartaoId, valor] of Object.entries(
    campos.previas as Record<string, unknown>,
  )) {
    const previa = lerPrevia(valor);

    if (previa === null) {
      return null;
    }

    previas[cartaoId] = previa;
  }

  return previas;
}

function lerOpcaoDeAlgoritmo(corpo: unknown): OpcaoDeAlgoritmo | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (typeof campos.id !== "string" || typeof campos.rotulo !== "string") {
    return null;
  }

  return { id: campos.id, rotulo: campos.rotulo };
}

function lerPreferencias(corpo: unknown): Preferencias | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.algoritmo !== "string" ||
    typeof campos.limiteDeNovosPorDia !== "number" ||
    !Array.isArray(campos.algoritmos)
  ) {
    return null;
  }

  const algoritmos: OpcaoDeAlgoritmo[] = [];

  for (const item of campos.algoritmos) {
    const opcao = lerOpcaoDeAlgoritmo(item);

    if (opcao === null) {
      return null;
    }

    algoritmos.push(opcao);
  }

  return {
    algoritmo: campos.algoritmo,
    limiteDeNovosPorDia: campos.limiteDeNovosPorDia,
    algoritmos,
  };
}

const ESTADOS_DA_ROTINA = ["ativa", "pausada", "excluida"] as const;
const ESTADOS_DO_COMPROMISSO = [
  "pendente",
  "programado",
  "nao_realizado",
  "concluido",
  "cancelado",
] as const;

function ehData(valor: unknown): valor is string {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function lerRotinaDeEstudo(corpo: unknown): RotinaDeEstudo | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.id !== "string" ||
    typeof campos.baralhoId !== "string" ||
    typeof campos.nomeDoBaralho !== "string" ||
    !Array.isArray(campos.dias) ||
    !campos.dias.every(
      (dia) => typeof dia === "number" && Number.isInteger(dia),
    ) ||
    (campos.quantidade !== null && typeof campos.quantidade !== "number") ||
    !ESTADOS_DA_ROTINA.includes(campos.estado as never) ||
    typeof campos.versao !== "number" ||
    typeof campos.criadaEm !== "string" ||
    typeof campos.indisponivel !== "boolean"
  ) {
    return null;
  }

  return {
    id: campos.id,
    baralhoId: campos.baralhoId,
    nomeDoBaralho: campos.nomeDoBaralho,
    dias: campos.dias as number[],
    quantidade: campos.quantidade as number | null,
    estado: campos.estado as RotinaDeEstudo["estado"],
    versao: campos.versao,
    criadaEm: campos.criadaEm,
    indisponivel: campos.indisponivel,
  };
}

function lerCompromissoDeEstudo(corpo: unknown): CompromissoDeEstudo | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.rotinaId !== "string" ||
    !ehData(campos.data) ||
    typeof campos.baralhoId !== "string" ||
    typeof campos.nomeDoBaralho !== "string" ||
    (campos.quantidade !== null && typeof campos.quantidade !== "number") ||
    !ESTADOS_DO_COMPROMISSO.includes(campos.estado as never) ||
    typeof campos.indisponivel !== "boolean" ||
    (campos.registroId !== null && typeof campos.registroId !== "string")
  ) {
    return null;
  }

  return {
    rotinaId: campos.rotinaId,
    data: campos.data,
    baralhoId: campos.baralhoId,
    nomeDoBaralho: campos.nomeDoBaralho,
    quantidade: campos.quantidade as number | null,
    estado: campos.estado as CompromissoDeEstudo["estado"],
    indisponivel: campos.indisponivel,
    registroId: campos.registroId as string | null,
  };
}

function lerListaDeCompromissos(corpo: unknown): CompromissoDeEstudo[] | null {
  if (!Array.isArray(corpo)) {
    return null;
  }

  const lidos = corpo.map(lerCompromissoDeEstudo);

  return lidos.every((compromisso) => compromisso !== null)
    ? (lidos as CompromissoDeEstudo[])
    : null;
}

function lerSemanaDaAgenda(corpo: unknown): SemanaDaAgenda | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;
  const compromissos = lerListaDeCompromissos(campos.compromissos);
  const deHoje = lerListaDeCompromissos(campos.compromissosDeHoje);

  if (
    !ehData(campos.inicio) ||
    !ehData(campos.hoje) ||
    typeof campos.fuso !== "string" ||
    compromissos === null ||
    deHoje === null
  ) {
    return null;
  }

  return {
    inicio: campos.inicio,
    hoje: campos.hoje,
    fuso: campos.fuso,
    compromissos,
    compromissosDeHoje: deHoje,
  };
}

function lerInicioDeCompromisso(corpo: unknown): InicioDeCompromisso | null {
  if (typeof corpo !== "object" || corpo === null) {
    return null;
  }

  const campos = corpo as Record<string, unknown>;

  if (
    typeof campos.id !== "string" ||
    typeof campos.rotinaId !== "string" ||
    !ehData(campos.data) ||
    typeof campos.baralhoId !== "string" ||
    typeof campos.nomeDoBaralho !== "string" ||
    !Array.isArray(campos.cartoes) ||
    (campos.quantidadeSolicitada !== null &&
      typeof campos.quantidadeSolicitada !== "number")
  ) {
    return null;
  }

  const cartoes = campos.cartoes.map(lerCartao);

  if (!cartoes.every((cartao) => cartao !== null)) {
    return null;
  }

  return {
    id: campos.id,
    rotinaId: campos.rotinaId,
    data: campos.data,
    baralhoId: campos.baralhoId,
    nomeDoBaralho: campos.nomeDoBaralho,
    cartoes: cartoes as Cartao[],
    quantidadeSolicitada: campos.quantidadeSolicitada as number | null,
  };
}
