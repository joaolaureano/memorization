import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_CREDENCIAL_INVALIDA,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
  MENSAGEM_DE_NAO_AUTENTICADO,
  NAO_AUTENTICADO,
} from "../../src/acervo-cliente/cliente";
import type {
  Baralho,
  Cartao,
  ClienteDoAcervo,
  Credencial,
} from "../../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../../src/acervo-cliente/cliente-em-memoria";
import { ClienteHttp } from "../../src/acervo-cliente/cliente-http";
import {
  NOME_DE_USUARIO_EXISTENTE,
  validarFrente,
  validarNomeDeBaralho,
  validarNomeDeUsuario,
  validarSenha,
  validarVerso,
} from "../../src/acervo-cliente/validacao";

/**
 * T008, T106, T208, T403, T503, T607 e T707 — bateria dos contratos de
 * Cartões, de Baralhos, de Vínculos, de edição, de exclusão, de Usuários e de
 * Entrar contra os dois Adapters da Seam `ClienteDoAcervo`.
 *
 * A **mesma** bateria — criação, listagem, Vínculos, edição, exclusão,
 * Cadastro, Entrar, os modos de recusa de domínio com mensagem exata em
 * português, a recusa por Credencial e a indisponibilidade — roda contra
 * `ClienteHttp` e `ClienteEmMemoria`, e produz resultados idênticos. Nenhuma
 * resposta que não seja de sucesso aparece como operação concluída (FR-044).
 *
 * Depois de `008-entrar`, o acervo é por Usuário: os dois Adapters recebem a
 * Credencial na construção, o servidor simulado confere o cabeçalho
 * `Authorization: Basic` antes de toda rota de acervo (FR-090) e os dados são
 * escopados pelo dono (FR-092). A Senha é gerada a cada execução, e nenhum
 * valor literal de Senha é versionado.
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const NOME_VALIDO = "Inglês";
const NOME_DE_USUARIO_VALIDO = "Ana.Silva";
/** A Senha das provas de Cadastro, gerada agora: nenhuma Senha literal no arquivo. */
const SENHA_VALIDA = randomBytes(12).toString("base64url");
const ENDERECO_DA_API = "http://127.0.0.1:3001";

/**
 * O Usuário e a Credencial de prova (T707; specs/008-entrar/tasks.md): o dono
 * do acervo das baterias de Cartão, de Baralho, de Vínculo, de edição e de
 * exclusão, porque sem Credencial nenhuma delas opera (FR-090). A Senha é
 * gerada a cada execução, e o Nome de usuário não colide com os das provas de
 * Cadastro.
 */
const NOME_DE_USUARIO_DE_PROVA = "usuario.de.prova";
const SENHA_DE_PROVA = randomBytes(12).toString("base64url");
const CREDENCIAL_DE_PROVA: Credencial = {
  nomeDeUsuario: NOME_DE_USUARIO_DE_PROVA,
  senha: SENHA_DE_PROVA,
};

/** O segundo Usuário, das provas de isolamento do acervo (FR-092, SC-030). */
const CREDENCIAL_DO_OUTRO: Credencial = {
  nomeDeUsuario: "outro.usuario",
  senha: randomBytes(12).toString("base64url"),
};

/** Senha errada, gerada agora: não confere com nenhuma Credencial. */
const SENHA_ERRADA = randomBytes(12).toString("base64url");

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Cartão e Baralho como o servidor simulado os guarda: com o dono, que é o
 * escopo de toda consulta (FR-092). A Interface nunca devolve este campo.
 */
type CartaoDoDono = Cartao & { usuarioId: string };
type BaralhoDoDono = Baralho & { usuarioId: string };

type AmbienteDeCliente = {
  cliente: ClienteDoAcervo;
  /**
   * Outro cliente sobre a **mesma** base — o mesmo stand-in, o mesmo servidor
   * simulado —, com a Credencial informada: é o que permite provar, nos dois
   * Adapters, que dois Usuários não enxergam o acervo um do outro (FR-092).
   */
  clienteComo: (credencial: Credencial | null) => ClienteDoAcervo;
  indisponibilizar: () => void;
  restaurar: () => void;
};

type RespostaDeTeste = {
  status: number;
  json: () => Promise<unknown>;
};

function respostaDeTeste(status: number, corpo: unknown): RespostaDeTeste {
  return { status, json: async () => corpo };
}

function criarAmbienteEmMemoria(): AmbienteDeCliente {
  // O Usuário de prova já está cadastrado na base do stand-in, e a Credencial
  // dele acompanha o cliente: é assim que o Adapter de memória atende à mesma
  // bateria que o `ClienteHttp` (FR-090).
  const cliente = new ClienteEmMemoria(CREDENCIAL_DE_PROVA, [
    CREDENCIAL_DE_PROVA,
  ]);

  return {
    cliente,
    clienteComo: (credencial) => cliente.comoUsuario(credencial),
    indisponibilizar: () => cliente.simularIndisponibilidade(),
    restaurar: () => cliente.restaurarDisponibilidade(),
  };
}

/**
 * Servidor de contrato simulado para o `ClienteHttp`: uma `fetch` falsa que
 * implementa as rotas de Cartões, de Baralhos, de Vínculos, de edição, de
 * exclusão, de Usuários e de Entrar exatamente como a API. A indisponibilidade
 * é simulada fazendo a `fetch` lançar, como numa falha de rede real.
 *
 * Como a API, o transporte exigido por `008-entrar` acompanha a Credencial:
 * toda rota de acervo confere o cabeçalho `Authorization: Basic` antes de
 * atender e responde `401` quando ele falta ou não confere (FR-090). O Cadastro
 * é isento (FR-097). Sem esse espelho, a bateria de entrada provaria o
 * contrato em um só Adapter.
 */
function criarAmbienteHttp(): AmbienteDeCliente {
  const cartoesNoServidor: CartaoDoDono[] = [];
  const baralhosNoServidor: BaralhoDoDono[] = [];
  const vinculosNoServidor: {
    usuarioId: string;
    cartaoId: string;
    baralhoId: string;
  }[] = [];
  const usuariosNoServidor: {
    id: string;
    nomeDeUsuario: string;
    senha: string;
  }[] = [{ id: "u-prova", ...CREDENCIAL_DE_PROVA }];
  let sequencia = 0;
  let sequenciaDeBaralhos = 0;
  let sequenciaDeUsuarios = 0;
  let indisponivel = false;

  /** O Cartão como a API o publica: sem o dono, que é Implementation. */
  function cartaoPublicado(cartao: Cartao): Cartao {
    return { id: cartao.id, frente: cartao.frente, verso: cartao.verso };
  }

  /** O Baralho como a API o publica: sem o dono, que é Implementation. */
  function baralhoPublicado(baralho: Baralho): Baralho {
    return { id: baralho.id, nome: baralho.nome };
  }

  function baralhosDoCartao(usuarioId: string, cartaoId: string): Baralho[] {
    return vinculosNoServidor
      .filter(
        (vinculo) =>
          vinculo.usuarioId === usuarioId && vinculo.cartaoId === cartaoId,
      )
      .map((vinculo) =>
        baralhosNoServidor.find(
          (baralho) =>
            baralho.id === vinculo.baralhoId &&
            baralho.usuarioId === usuarioId,
        ),
      )
      .filter((baralho): baralho is BaralhoDoDono => baralho !== undefined)
      .map(baralhoPublicado);
  }

  function cartoesDoBaralho(usuarioId: string, baralhoId: string): Cartao[] {
    return vinculosNoServidor
      .filter(
        (vinculo) =>
          vinculo.usuarioId === usuarioId && vinculo.baralhoId === baralhoId,
      )
      .map((vinculo) =>
        cartoesNoServidor.find(
          (cartao) =>
            cartao.id === vinculo.cartaoId && cartao.usuarioId === usuarioId,
        ),
      )
      .filter((cartao): cartao is CartaoDoDono => cartao !== undefined)
      .map(cartaoPublicado);
  }

  /**
   * O Usuário da Credencial do cabeçalho, ou `null` quando o cabeçalho falta,
   * está malformado ou não confere — os três casos que a API recusa com a
   * mesma resposta (FR-088, FR-090).
   */
  function usuarioDoCabecalho(header?: RequestInit["headers"]): {
    id: string;
    nomeDeUsuario: string;
  } | null {
    const autorizacao = (header as Record<string, string> | undefined)?.[
      "authorization"
    ];

    if (typeof autorizacao !== "string" || !autorizacao.startsWith("Basic ")) {
      return null;
    }

    const bytes = Uint8Array.from(
      atob(autorizacao.slice("Basic ".length)),
      (caractere) => caractere.charCodeAt(0),
    );
    const decodificado = new TextDecoder().decode(bytes);
    const doisPontos = decodificado.indexOf(":");

    if (doisPontos < 0) {
      return null;
    }

    const nomeDeUsuario = decodificado.slice(0, doisPontos);
    const senha = decodificado.slice(doisPontos + 1);
    const chave = nomeDeUsuario.trim().toLowerCase();
    const usuario = usuariosNoServidor.find(
      (candidato) => candidato.nomeDeUsuario.toLowerCase() === chave,
    );

    if (usuario === undefined || usuario.senha !== senha) {
      return null;
    }

    return { id: usuario.id, nomeDeUsuario: usuario.nomeDeUsuario };
  }

  /** A recusa única de Credencial, com a mensagem do contrato (FR-088). */
  const RECUSA_DE_CREDENCIAL = {
    erro: "credencial_invalida",
    mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
  } as const;

  const fetchDeTeste = async (
    entrada: unknown,
    opcoes?: RequestInit,
  ): Promise<RespostaDeTeste> => {
    if (indisponivel) {
      throw new Error("falha de transporte simulada");
    }

    const url = typeof entrada === "string" ? entrada : String(entrada);
    const caminho = new URL(url).pathname;
    const metodo = opcoes?.method ?? "GET";

    // As rotas isentas de Credencial: o pré-voo de CORS, a prova de vida e o
    // Cadastro — quem cria o Usuário ainda não tem Credencial (FR-097).
    if (metodo === "OPTIONS") {
      return respostaDeTeste(204, null);
    }

    if (caminho === "/health" && metodo === "GET") {
      return respostaDeTeste(200, { status: "ok" });
    }

    if (caminho === "/usuarios" && metodo === "POST") {
      const corpo = JSON.parse(String(opcoes?.body)) as Record<string, unknown>;

      // Espaços ao redor são descartados antes da validação (FR-073).
      const nomeDeUsuario = (corpo.nomeDeUsuario as string).trim();
      const falha =
        validarNomeDeUsuario(nomeDeUsuario) ??
        validarSenha(corpo.senha as string);

      if (falha !== null) {
        return respostaDeTeste(400, {
          erro: falha.erro,
          mensagem: falha.mensagem,
        });
      }

      // A unicidade não distingue maiúsculas de minúsculas (FR-074, SC-025).
      const jaExiste = usuariosNoServidor.some(
        (usuario) =>
          usuario.nomeDeUsuario.toLowerCase() === nomeDeUsuario.toLowerCase(),
      );

      if (jaExiste) {
        return respostaDeTeste(409, { ...NOME_DE_USUARIO_EXISTENTE });
      }

      const usuario = {
        id: `u${++sequenciaDeUsuarios}`,
        nomeDeUsuario,
        senha: corpo.senha as string,
      };

      usuariosNoServidor.push(usuario);

      // A resposta traz uma propriedade a mais de propósito: nenhum retorno
      // de Cadastro entrega `sal`, `hash` nem Senha, e o Adapter descarta o
      // que não seja campo canônico (FR-076, FR-078). A Senha fica apenas na
      // base do servidor simulado, como o `hash` fica na base da API.
      return respostaDeTeste(201, {
        id: usuario.id,
        nomeDeUsuario: usuario.nomeDeUsuario,
        hash: "nunca-atravessa",
      });
    }

    // Daqui em diante, toda rota exige Credencial válida: é o mesmo ponto
    // único de verificação da API, antes de qualquer handler (FR-090).
    const dono = usuarioDoCabecalho(opcoes?.headers);

    if (dono === null) {
      return respostaDeTeste(401, RECUSA_DE_CREDENCIAL);
    }

    const donoId = dono.id;

    if (caminho === "/entrar" && metodo === "POST") {
      return respostaDeTeste(200, {
        id: dono.id,
        nomeDeUsuario: dono.nomeDeUsuario,
      });
    }

    const cartaoPorId = caminho.match(/^\/cartoes\/([^/]+)$/);
    const baralhoPorId = caminho.match(/^\/baralhos\/([^/]+)$/);
    const vinculoEmBaralho = caminho.match(/^\/baralhos\/([^/]+)\/vinculos$/);
    const vinculoEspecifico = caminho.match(
      /^\/baralhos\/([^/]+)\/vinculos\/([^/]+)$/,
    );

    if (caminho === "/cartoes" && metodo === "POST") {
      const corpo = JSON.parse(String(opcoes?.body)) as Record<string, unknown>;

      const falha =
        validarFrente(corpo.frente as string) ??
        validarVerso(corpo.verso as string);

      if (falha !== null) {
        return respostaDeTeste(400, {
          erro: falha.erro,
          mensagem: falha.mensagem,
        });
      }

      const cartao: CartaoDoDono = {
        id: `s${++sequencia}`,
        usuarioId: donoId,
        frente: corpo.frente as string,
        verso: corpo.verso as string,
      };

      cartoesNoServidor.push(cartao);

      return respostaDeTeste(201, cartaoPublicado(cartao));
    }

    if (caminho === "/cartoes" && metodo === "GET") {
      return respostaDeTeste(
        200,
        cartoesNoServidor
          .filter((cartao) => cartao.usuarioId === donoId)
          .map((cartao) => ({
            ...cartaoPublicado(cartao),
            baralhos: baralhosDoCartao(donoId, cartao.id),
          })),
      );
    }

    if (caminho === "/baralhos" && metodo === "POST") {
      const corpo = JSON.parse(String(opcoes?.body)) as Record<string, unknown>;

      const falha = validarNomeDeBaralho(corpo.nome as string);

      if (falha !== null) {
        return respostaDeTeste(400, {
          erro: falha.erro,
          mensagem: falha.mensagem,
        });
      }

      const baralho: BaralhoDoDono = {
        id: `s${++sequenciaDeBaralhos}`,
        usuarioId: donoId,
        nome: corpo.nome as string,
      };

      baralhosNoServidor.push(baralho);

      return respostaDeTeste(201, baralhoPublicado(baralho));
    }

    if (caminho === "/baralhos" && metodo === "GET") {
      return respostaDeTeste(
        200,
        baralhosNoServidor
          .filter((baralho) => baralho.usuarioId === donoId)
          .map((baralho) => {
            const quantidadeDeCartoes = vinculosNoServidor.filter(
              (vinculo) =>
                vinculo.usuarioId === donoId &&
                vinculo.baralhoId === baralho.id,
            ).length;

            return {
              ...baralhoPublicado(baralho),
              quantidadeDeCartoes,
              elegivel: quantidadeDeCartoes > 0,
            };
          }),
      );
    }

    if (vinculoEmBaralho !== null && metodo === "POST") {
      const baralhoId = decodeURIComponent(vinculoEmBaralho[1]);
      const corpo = JSON.parse(String(opcoes?.body)) as Record<string, unknown>;
      const cartaoId = corpo.cartaoId as string;

      // Cartão e Baralho precisam existir no escopo de quem pede: o Vínculo
      // entre donos diferentes é o mesmo `nao_encontrado` (FR-092, FR-093).
      if (
        !cartoesNoServidor.some(
          (cartao) => cartao.id === cartaoId && cartao.usuarioId === donoId,
        )
      ) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Cartão não encontrado.",
        });
      }

      if (
        !baralhosNoServidor.some(
          (baralho) =>
            baralho.id === baralhoId && baralho.usuarioId === donoId,
        )
      ) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Baralho não encontrado.",
        });
      }

      if (
        vinculosNoServidor.some(
          (vinculo) =>
            vinculo.usuarioId === donoId &&
            vinculo.cartaoId === cartaoId &&
            vinculo.baralhoId === baralhoId,
        )
      ) {
        return respostaDeTeste(409, {
          erro: "vinculo_duplicado",
          mensagem: "O vínculo já existe.",
        });
      }

      vinculosNoServidor.push({ usuarioId: donoId, cartaoId, baralhoId });

      return respostaDeTeste(201, null);
    }

    if (vinculoEspecifico !== null && metodo === "DELETE") {
      const baralhoId = decodeURIComponent(vinculoEspecifico[1]);
      const cartaoId = decodeURIComponent(vinculoEspecifico[2]);
      const indice = vinculosNoServidor.findIndex(
        (vinculo) =>
          vinculo.usuarioId === donoId &&
          vinculo.cartaoId === cartaoId &&
          vinculo.baralhoId === baralhoId,
      );

      if (indice === -1) {
        return respostaDeTeste(404, {
          erro: "vinculo_nao_encontrado",
          mensagem: "O vínculo não existe.",
        });
      }

      vinculosNoServidor.splice(indice, 1);

      return respostaDeTeste(204, null);
    }

    if (baralhoPorId !== null && metodo === "GET") {
      const id = decodeURIComponent(baralhoPorId[1]);
      const baralho = baralhosNoServidor.find(
        (item) => item.id === id && item.usuarioId === donoId,
      );

      if (baralho === undefined) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Baralho não encontrado.",
        });
      }

      const cartoes = cartoesDoBaralho(donoId, id);

      return respostaDeTeste(200, {
        ...baralhoPublicado(baralho),
        elegivel: cartoes.length > 0,
        cartoes,
      });
    }

    if (cartaoPorId !== null && metodo === "PUT") {
      const id = decodeURIComponent(cartaoPorId[1]);
      const indice = cartoesNoServidor.findIndex(
        (cartao) => cartao.id === id && cartao.usuarioId === donoId,
      );

      if (indice === -1) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Cartão não encontrado.",
        });
      }

      const corpo = JSON.parse(String(opcoes?.body)) as Record<string, unknown>;
      const falha =
        validarFrente(corpo.frente as string) ??
        validarVerso(corpo.verso as string);

      if (falha !== null) {
        return respostaDeTeste(400, {
          erro: falha.erro,
          mensagem: falha.mensagem,
        });
      }

      const cartao: CartaoDoDono = {
        id,
        usuarioId: donoId,
        frente: corpo.frente as string,
        verso: corpo.verso as string,
      };

      cartoesNoServidor[indice] = cartao;

      return respostaDeTeste(200, cartaoPublicado(cartao));
    }

    if (baralhoPorId !== null && metodo === "PUT") {
      const id = decodeURIComponent(baralhoPorId[1]);
      const indice = baralhosNoServidor.findIndex(
        (baralho) => baralho.id === id && baralho.usuarioId === donoId,
      );

      if (indice === -1) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Baralho não encontrado.",
        });
      }

      const corpo = JSON.parse(String(opcoes?.body)) as Record<string, unknown>;
      const falha = validarNomeDeBaralho(corpo.nome as string);

      if (falha !== null) {
        return respostaDeTeste(400, {
          erro: falha.erro,
          mensagem: falha.mensagem,
        });
      }

      const baralho: BaralhoDoDono = {
        id,
        usuarioId: donoId,
        nome: corpo.nome as string,
      };

      baralhosNoServidor[indice] = baralho;

      return respostaDeTeste(200, baralhoPublicado(baralho));
    }

    if (cartaoPorId !== null && metodo === "DELETE") {
      const id = decodeURIComponent(cartaoPorId[1]);
      const indice = cartoesNoServidor.findIndex(
        (cartao) => cartao.id === id && cartao.usuarioId === donoId,
      );

      if (indice === -1) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Cartão não encontrado.",
        });
      }

      cartoesNoServidor.splice(indice, 1);

      for (let i = vinculosNoServidor.length - 1; i >= 0; i -= 1) {
        const vinculo = vinculosNoServidor[i];

        if (vinculo.usuarioId === donoId && vinculo.cartaoId === id) {
          vinculosNoServidor.splice(i, 1);
        }
      }

      return respostaDeTeste(204, null);
    }

    if (baralhoPorId !== null && metodo === "DELETE") {
      const id = decodeURIComponent(baralhoPorId[1]);
      const indice = baralhosNoServidor.findIndex(
        (baralho) => baralho.id === id && baralho.usuarioId === donoId,
      );

      if (indice === -1) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Baralho não encontrado.",
        });
      }

      baralhosNoServidor.splice(indice, 1);

      for (let i = vinculosNoServidor.length - 1; i >= 0; i -= 1) {
        const vinculo = vinculosNoServidor[i];

        if (vinculo.usuarioId === donoId && vinculo.baralhoId === id) {
          vinculosNoServidor.splice(i, 1);
        }
      }

      return respostaDeTeste(204, null);
    }

    return respostaDeTeste(404, {
      erro: "nao_encontrado",
      mensagem: "Rota inexistente.",
    });
  };

  vi.stubGlobal("fetch", fetchDeTeste);

  return {
    cliente: new ClienteHttp(ENDERECO_DA_API, CREDENCIAL_DE_PROVA),
    clienteComo: (credencial) => new ClienteHttp(ENDERECO_DA_API, credencial),
    indisponibilizar: () => {
      indisponivel = true;
    },
    restaurar: () => {
      indisponivel = false;
    },
  };
}

/**
 * A bateria compartilhada de Cartões. Toda asserção atravessa a Interface
 * `ClienteDoAcervo`, nunca o estado interno do Adapter, e usa expectativas
 * exatas — inclusive as mensagens do contrato — para que os dois Adapters
 * sejam comprovados idênticos na superfície observável.
 */
function executarBateriaDoContrato(
  nomeDoAdapter: string,
  criarAmbiente: () => AmbienteDeCliente,
): void {
  describe(`${nomeDoAdapter} — bateria do contrato de Cartões`, () => {
    it("cria um Cartão válido com id, Frente e Verso (FR-001)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });

      expect(resultado).toEqual({
        ok: true,
        cartao: {
          id: expect.any(String),
          frente: FRENTE_VALIDA,
          verso: VERSO_VALIDO,
        },
      });
    });

    it("lista o Cartão criado, agora com baralhos vazio (FR-001, FR-003)", async () => {
      const { cliente } = criarAmbiente();

      const criacao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });

      if (!criacao.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [{ ...criacao.cartao, baralhos: [] }],
      });
    });

    it("lista vazia quando nenhum Cartão existe (FR-003)", async () => {
      const { cliente } = criarAmbiente();

      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("aceita dois Cartões com a mesma Frente, ambos presentes (invariante 2)", async () => {
      const { cliente } = criarAmbiente();

      const primeiro = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const segundo = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: "Andar",
      });

      if (!primeiro.ok || !segundo.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: expect.arrayContaining([
          { ...primeiro.cartao, baralhos: [] },
          { ...segundo.cartao, baralhos: [] },
        ]),
      });
    });

    it("devolve cada Cartão com exatamente id, Frente, Verso e baralhos (FR-004)", async () => {
      const { cliente } = criarAmbiente();

      await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const listagem = await cliente.listarCartoes();

      if (!listagem.ok) {
        throw new Error("a listagem deveria ser aceita");
      }

      expect(listagem.cartoes).toHaveLength(1);

      for (const cartao of listagem.cartoes) {
        expect(Object.keys(cartao).sort()).toEqual([
          "baralhos",
          "frente",
          "id",
          "verso",
        ]);
        expect(cartao.id).toEqual(expect.any(String));
        expect(cartao.frente).toBe(FRENTE_VALIDA);
        expect(cartao.verso).toBe(VERSO_VALIDO);
        expect(cartao.baralhos).toEqual([]);
      }
    });

    it("ignora propriedade extra e ela não retorna nas leituras (FR-009)", async () => {
      const { cliente } = criarAmbiente();

      const dadosComPropriedadeExtra = {
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
        titulo: "propriedade que não existe em Cartão",
      };

      const criacao = await cliente.criarCartao(dadosComPropriedadeExtra);

      if (!criacao.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(Object.keys(criacao.cartao).sort()).toEqual([
        "frente",
        "id",
        "verso",
      ]);
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [{ ...criacao.cartao, baralhos: [] }],
      });
    });

    it("aceita Frente e Verso com exatamente 1000 caracteres: limite inclusivo (FR-052)", async () => {
      const { cliente } = criarAmbiente();

      const criacao = await cliente.criarCartao({
        frente: "a".repeat(1000),
        verso: "b".repeat(1000),
      });

      expect(criacao.ok).toBe(true);
    });

    it("recusa Frente vazia com frente_vazia e mensagem exata, sem criar nada (FR-002)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: "",
        verso: VERSO_VALIDO,
      });

      expect(resultado).toEqual({
        ok: false,
        erro: "frente_vazia",
        mensagem: "A frente do cartão não pode ficar vazia.",
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("trata Frente composta só de espaços como vazia (FR-051)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: "   ",
        verso: VERSO_VALIDO,
      });

      expect(resultado).toEqual({
        ok: false,
        erro: "frente_vazia",
        mensagem: "A frente do cartão não pode ficar vazia.",
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("recusa Verso vazio com verso_vazio e mensagem exata, sem criar nada (FR-002)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: "",
      });

      expect(resultado).toEqual({
        ok: false,
        erro: "verso_vazio",
        mensagem: "O verso do cartão não pode ficar vazio.",
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("recusa Frente acima de 1000 caracteres, informando limite e tamanho (FR-052)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: "a".repeat(1001),
        verso: VERSO_VALIDO,
      });

      expect(resultado).toEqual({
        ok: false,
        erro: "frente_muito_longa",
        mensagem:
          "A frente do cartão deve ter no máximo 1000 caracteres; a informada tem 1001.",
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("recusa Verso acima de 1000 caracteres, informando limite e tamanho (FR-052)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: "a".repeat(1001),
      });

      expect(resultado).toEqual({
        ok: false,
        erro: "verso_muito_longo",
        mensagem:
          "O verso do cartão deve ter no máximo 1000 caracteres; o informado tem 1001.",
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("com o transporte indisponível, criarCartao falha com indisponivel (FR-044)", async () => {
      const { cliente, indisponibilizar } = criarAmbiente();
      indisponibilizar();

      const resultado = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });

      expect(resultado).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      });
    });

    it("criação falha por indisponibilidade não aparece como concluída: nada é criado (FR-044)", async () => {
      const { cliente, indisponibilizar, restaurar } = criarAmbiente();
      indisponibilizar();

      const criacao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });

      expect(criacao.ok).toBe(false);
      restaurar();

      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
    });

    it("com o transporte indisponível, listarCartoes falha com indisponivel", async () => {
      const { cliente, indisponibilizar } = criarAmbiente();
      indisponibilizar();

      expect(await cliente.listarCartoes()).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      });
    });
  });
}

/**
 * A bateria compartilhada de Baralhos. Toda asserção atravessa a Interface
 * `ClienteDoAcervo`, nunca o estado interno do Adapter.
 */
function executarBateriaDeBaralhos(
  nomeDoAdapter: string,
  criarAmbiente: () => AmbienteDeCliente,
): void {
  describe(`${nomeDoAdapter} — bateria do contrato de Baralhos`, () => {
    it("cria um Baralho válido com id e nome (FR-010)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarBaralho({ nome: NOME_VALIDO });

      expect(resultado).toEqual({
        ok: true,
        baralho: {
          id: expect.any(String),
          nome: NOME_VALIDO,
        },
      });
    });

    it("lista o Baralho criado com quantidadeDeCartoes 0 e elegivel false (FR-013)", async () => {
      const { cliente } = criarAmbiente();

      const criacao = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!criacao.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [
          {
            ...criacao.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
        ],
      });
    });

    it("lista vazia quando nenhum Baralho existe (FR-013)", async () => {
      const { cliente } = criarAmbiente();

      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [],
      });
    });

    it("aceita dois Baralhos com o mesmo nome, ambos presentes (FR-012)", async () => {
      const { cliente } = criarAmbiente();

      const primeiro = await cliente.criarBaralho({ nome: NOME_VALIDO });
      const segundo = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!primeiro.ok || !segundo.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      const listagem = await cliente.listarBaralhos();

      if (!listagem.ok) {
        throw new Error("a listagem deveria ser aceita");
      }

      expect(listagem.baralhos).toEqual(
        expect.arrayContaining([
          {
            ...primeiro.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
          {
            ...segundo.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
        ]),
      );
    });

    it("devolve cada Baralho com exatamente id, nome, quantidadeDeCartoes e elegivel (FR-018)", async () => {
      const { cliente } = criarAmbiente();

      await cliente.criarBaralho({ nome: NOME_VALIDO });
      const listagem = await cliente.listarBaralhos();

      if (!listagem.ok) {
        throw new Error("a listagem deveria ser aceita");
      }

      expect(listagem.baralhos).toHaveLength(1);

      for (const baralho of listagem.baralhos) {
        expect(Object.keys(baralho).sort()).toEqual([
          "elegivel",
          "id",
          "nome",
          "quantidadeDeCartoes",
        ]);
        expect(baralho.id).toEqual(expect.any(String));
        expect(baralho.nome).toBe(NOME_VALIDO);
        expect(baralho.quantidadeDeCartoes).toBe(0);
        expect(baralho.elegivel).toBe(false);
      }
    });

    it("ignora propriedade extra e ela não retorna nas leituras (FR-018)", async () => {
      const { cliente } = criarAmbiente();

      const dadosComPropriedadeExtra = {
        nome: NOME_VALIDO,
        descricao: "propriedade que não existe em Baralho",
      };

      const criacao = await cliente.criarBaralho(dadosComPropriedadeExtra);

      if (!criacao.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(Object.keys(criacao.baralho).sort()).toEqual(["id", "nome"]);
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [
          {
            ...criacao.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
        ],
      });
    });

    it("aceita nome com exatamente 100 caracteres: limite inclusivo (FR-061)", async () => {
      const { cliente } = criarAmbiente();

      const criacao = await cliente.criarBaralho({ nome: "a".repeat(100) });

      expect(criacao.ok).toBe(true);
    });

    it("recusa nome vazio com nome_vazio e mensagem exata, sem criar nada (FR-011)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarBaralho({ nome: "" });

      expect(resultado).toEqual({
        ok: false,
        erro: "nome_vazio",
        mensagem: "O nome do baralho não pode ficar vazio.",
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [],
      });
    });

    it("trata nome composto só de espaços como vazio (FR-011)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarBaralho({ nome: "   " });

      expect(resultado).toEqual({
        ok: false,
        erro: "nome_vazio",
        mensagem: "O nome do baralho não pode ficar vazio.",
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [],
      });
    });

    it("recusa nome acima de 100 caracteres, informando limite e tamanho (FR-061)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarBaralho({ nome: "a".repeat(101) });

      expect(resultado).toEqual({
        ok: false,
        erro: "nome_muito_longo",
        mensagem:
          "O nome do baralho deve ter no máximo 100 caracteres; o informado tem 101.",
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [],
      });
    });

    it("com o transporte indisponível, criarBaralho falha com indisponivel (FR-044)", async () => {
      const { cliente, indisponibilizar } = criarAmbiente();
      indisponibilizar();

      const resultado = await cliente.criarBaralho({ nome: NOME_VALIDO });

      expect(resultado).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      });
    });

    it("criação falha por indisponibilidade não aparece como concluída: nada é criado (FR-044)", async () => {
      const { cliente, indisponibilizar, restaurar } = criarAmbiente();
      indisponibilizar();

      const criacao = await cliente.criarBaralho({ nome: NOME_VALIDO });

      expect(criacao.ok).toBe(false);
      restaurar();

      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [],
      });
    });

    it("com o transporte indisponível, listarBaralhos falha com indisponivel", async () => {
      const { cliente, indisponibilizar } = criarAmbiente();
      indisponibilizar();

      expect(await cliente.listarBaralhos()).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      });
    });
  });
}

/**
 * Bateria compartilhada de Vínculos (T208; specs/003-vincular-cartao-baralho/contracts/api-vinculos.md).
 */
function executarBateriaDeVinculos(
  nomeDoAdapter: string,
  criarAmbiente: () => AmbienteDeCliente,
): void {
  describe(`${nomeDoAdapter} — bateria do contrato de Vínculos`, () => {
    it("vincula um Cartão a um Baralho e o Baralho torna-se elegível (FR-019, FR-024)", async () => {
      const { cliente } = criarAmbiente();
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!cartao.ok || !baralho.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      expect(
        await cliente.vincular(cartao.cartao.id, baralho.baralho.id),
      ).toEqual({ ok: true });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [
          {
            ...baralho.baralho,
            quantidadeDeCartoes: 1,
            elegivel: true,
          },
        ],
      });
    });

    it("obterBaralho devolve o Baralho com seus Cartões vinculados (FR-014)", async () => {
      const { cliente } = criarAmbiente();
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!cartao.ok || !baralho.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      await cliente.vincular(cartao.cartao.id, baralho.baralho.id);

      expect(await cliente.obterBaralho(baralho.baralho.id)).toEqual({
        ok: true,
        baralho: {
          id: baralho.baralho.id,
          nome: baralho.baralho.nome,
          elegivel: true,
          cartoes: [cartao.cartao],
        },
      });
    });

    it("listarCartoes devolve os Baralhos de cada Cartão; Cartão sem Baralho traz lista vazia (FR-003)", async () => {
      const { cliente } = criarAmbiente();
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const cartaoSemBaralho = await cliente.criarCartao({
        frente: "To run",
        verso: "Correr",
      });
      const primeiroBaralho = await cliente.criarBaralho({ nome: NOME_VALIDO });
      const segundoBaralho = await cliente.criarBaralho({ nome: "Espanhol" });

      if (
        !cartao.ok ||
        !cartaoSemBaralho.ok ||
        !primeiroBaralho.ok ||
        !segundoBaralho.ok
      ) {
        throw new Error("as criações deveriam ser aceitas");
      }

      await cliente.vincular(cartao.cartao.id, primeiroBaralho.baralho.id);
      await cliente.vincular(cartao.cartao.id, segundoBaralho.baralho.id);

      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [
          {
            ...cartao.cartao,
            baralhos: [primeiroBaralho.baralho, segundoBaralho.baralho],
          },
          { ...cartaoSemBaralho.cartao, baralhos: [] },
        ],
      });
    });

    it("recusa vincular Cartão inexistente como nao_encontrado (FR-022)", async () => {
      const { cliente } = criarAmbiente();
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!baralho.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(
        await cliente.vincular("c-inexistente", baralho.baralho.id),
      ).toEqual({
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Cartão não encontrado.",
      });
    });

    it("recusa vincular Baralho inexistente como nao_encontrado (FR-022)", async () => {
      const { cliente } = criarAmbiente();
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });

      if (!cartao.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(
        await cliente.vincular(cartao.cartao.id, "b-inexistente"),
      ).toEqual({
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      });
    });

    it("recusa Vínculo duplicado com vinculo_duplicado (FR-020)", async () => {
      const { cliente } = criarAmbiente();
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!cartao.ok || !baralho.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      await cliente.vincular(cartao.cartao.id, baralho.baralho.id);

      expect(
        await cliente.vincular(cartao.cartao.id, baralho.baralho.id),
      ).toEqual({
        ok: false,
        erro: "vinculo_duplicado",
        mensagem: "O vínculo já existe.",
      });
    });

    it("desvincular preserva Cartão e Baralho, e o Baralho perde a elegibilidade (FR-021, FR-024)", async () => {
      const { cliente } = criarAmbiente();
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!cartao.ok || !baralho.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      await cliente.vincular(cartao.cartao.id, baralho.baralho.id);
      expect(
        await cliente.desvincular(cartao.cartao.id, baralho.baralho.id),
      ).toEqual({ ok: true });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [
          {
            ...baralho.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
        ],
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [{ ...cartao.cartao, baralhos: [] }],
      });
      expect(await cliente.obterBaralho(baralho.baralho.id)).toEqual({
        ok: true,
        baralho: {
          id: baralho.baralho.id,
          nome: baralho.baralho.nome,
          elegivel: false,
          cartoes: [],
        },
      });
    });

    it("recusa desvincular Vínculo inexistente com vinculo_nao_encontrado (FR-021)", async () => {
      const { cliente } = criarAmbiente();

      expect(
        await cliente.desvincular("c-inexistente", "b-inexistente"),
      ).toEqual({
        ok: false,
        erro: "vinculo_nao_encontrado",
        mensagem: "O vínculo não existe.",
      });
    });

    it("obterBaralho inexistente é recusado como nao_encontrado (FR-014)", async () => {
      const { cliente } = criarAmbiente();

      expect(await cliente.obterBaralho("b-inexistente")).toEqual({
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      });
    });

    it("com o transporte indisponível, Vínculos falham com a mensagem própria", async () => {
      const { cliente, indisponibilizar } = criarAmbiente();
      indisponibilizar();

      expect(await cliente.vincular("c1", "b1")).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
      });
      expect(await cliente.desvincular("c1", "b1")).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
      });
      expect(await cliente.obterBaralho("b1")).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      });
    });
  });
}

/**
 * Bateria compartilhada de edição (T403; specs/005-editar-cartao-e-baralho/contracts/api-edicao.md).
 */
function executarBateriaDeEdicao(
  nomeDoAdapter: string,
  criarAmbiente: () => AmbienteDeCliente,
): void {
  describe(`${nomeDoAdapter} — bateria do contrato de Edição`, () => {
    it("edita Frente e Verso e a alteração aparece nas leituras (FR-005)", async () => {
      const { cliente } = criarAmbiente();
      const criacao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });

      if (!criacao.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(
        await cliente.editarCartao(criacao.cartao.id, "To run", "Correr"),
      ).toEqual({
        ok: true,
        cartao: {
          id: criacao.cartao.id,
          frente: "To run",
          verso: "Correr",
        },
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [
          {
            id: criacao.cartao.id,
            frente: "To run",
            verso: "Correr",
            baralhos: [],
          },
        ],
      });
    });

    it("edita Cartão vinculado sem alterar o Vínculo (FR-005)", async () => {
      const { cliente } = criarAmbiente();
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!cartao.ok || !baralho.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      await cliente.vincular(cartao.cartao.id, baralho.baralho.id);
      await cliente.editarCartao(cartao.cartao.id, "To run", "Correr");

      expect(await cliente.obterBaralho(baralho.baralho.id)).toEqual({
        ok: true,
        baralho: {
          id: baralho.baralho.id,
          nome: baralho.baralho.nome,
          elegivel: true,
          cartoes: [
            {
              id: cartao.cartao.id,
              frente: "To run",
              verso: "Correr",
            },
          ],
        },
      });
    });

    it("recusa edição com Frente vazia, com as mesmas regras da criação (FR-005)", async () => {
      const { cliente } = criarAmbiente();
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });

      if (!cartao.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(
        await cliente.editarCartao(cartao.cartao.id, "", VERSO_VALIDO),
      ).toEqual({
        ok: false,
        erro: "frente_vazia",
        mensagem: "A frente do cartão não pode ficar vazia.",
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [{ ...cartao.cartao, baralhos: [] }],
      });
    });

    it("recusa edição de Cartão inexistente como nao_encontrado", async () => {
      const { cliente } = criarAmbiente();

      expect(
        await cliente.editarCartao("c-inexistente", "To run", "Correr"),
      ).toEqual({
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Cartão não encontrado.",
      });
    });

    it("renomeia Baralho preservando Vínculos e elegibilidade (FR-015)", async () => {
      const { cliente } = criarAmbiente();
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!cartao.ok || !baralho.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      await cliente.vincular(cartao.cartao.id, baralho.baralho.id);

      expect(
        await cliente.renomearBaralho(baralho.baralho.id, "Espanhol"),
      ).toEqual({
        ok: true,
        baralho: {
          id: baralho.baralho.id,
          nome: "Espanhol",
        },
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [
          {
            id: baralho.baralho.id,
            nome: "Espanhol",
            quantidadeDeCartoes: 1,
            elegivel: true,
          },
        ],
      });
      expect(await cliente.obterBaralho(baralho.baralho.id)).toEqual({
        ok: true,
        baralho: {
          id: baralho.baralho.id,
          nome: "Espanhol",
          elegivel: true,
          cartoes: [cartao.cartao],
        },
      });
    });

    it("recusa renomeação com nome vazio, com as mesmas regras da criação (FR-015)", async () => {
      const { cliente } = criarAmbiente();
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!baralho.ok) {
        throw new Error("a criação deveria ser aceita");
      }

      expect(await cliente.renomearBaralho(baralho.baralho.id, "")).toEqual({
        ok: false,
        erro: "nome_vazio",
        mensagem: "O nome do baralho não pode ficar vazio.",
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [
          {
            ...baralho.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
        ],
      });
    });

    it("recusa renomeação de Baralho inexistente como nao_encontrado", async () => {
      const { cliente } = criarAmbiente();

      expect(
        await cliente.renomearBaralho("b-inexistente", "Espanhol"),
      ).toEqual({
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      });
    });

    it("com o transporte indisponível, editar e renomear falham sem gravar", async () => {
      const { cliente, indisponibilizar } = criarAmbiente();
      indisponibilizar();

      expect(
        await cliente.editarCartao("c1", "To run", "Correr"),
      ).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      });
      expect(await cliente.renomearBaralho("b1", "Espanhol")).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      });
    });
  });
}

/**
 * Bateria compartilhada de exclusão (T503; specs/006-excluir-cartao-e-baralho/contracts/api-exclusao.md).
 */
function executarBateriaDeExclusao(
  nomeDoAdapter: string,
  criarAmbiente: () => AmbienteDeCliente,
): void {
  describe(`${nomeDoAdapter} — bateria do contrato de Exclusão`, () => {
    it("excluir Cartão remove seus Vínculos e preserva os Baralhos (FR-007, FR-008)", async () => {
      const { cliente } = criarAmbiente();
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const primeiroBaralho = await cliente.criarBaralho({ nome: NOME_VALIDO });
      const segundoBaralho = await cliente.criarBaralho({ nome: "Espanhol" });

      if (!cartao.ok || !primeiroBaralho.ok || !segundoBaralho.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      await cliente.vincular(cartao.cartao.id, primeiroBaralho.baralho.id);
      await cliente.vincular(cartao.cartao.id, segundoBaralho.baralho.id);

      expect(await cliente.excluirCartao(cartao.cartao.id)).toEqual({
        ok: true,
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [],
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: expect.arrayContaining([
          {
            ...primeiroBaralho.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
          {
            ...segundoBaralho.baralho,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
        ]),
      });
      expect(await cliente.obterBaralho(primeiroBaralho.baralho.id)).toEqual({
        ok: true,
        baralho: {
          id: primeiroBaralho.baralho.id,
          nome: primeiroBaralho.baralho.nome,
          elegivel: false,
          cartoes: [],
        },
      });
    });

    it("excluir Baralho remove seus Vínculos e preserva os Cartões (FR-016, FR-017)", async () => {
      const { cliente } = criarAmbiente();
      const primeiroCartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const segundoCartao = await cliente.criarCartao({
        frente: "To run",
        verso: "Correr",
      });
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!primeiroCartao.ok || !segundoCartao.ok || !baralho.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      await cliente.vincular(primeiroCartao.cartao.id, baralho.baralho.id);
      await cliente.vincular(segundoCartao.cartao.id, baralho.baralho.id);

      expect(await cliente.excluirBaralho(baralho.baralho.id)).toEqual({
        ok: true,
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [],
      });
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: expect.arrayContaining([
          { ...primeiroCartao.cartao, baralhos: [] },
          { ...segundoCartao.cartao, baralhos: [] },
        ]),
      });
    });

    it("Cartão que fica sem Baralho continua acessível pela lista (SC-006)", async () => {
      const { cliente } = criarAmbiente();
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!cartao.ok || !baralho.ok) {
        throw new Error("as criações deveriam ser aceitas");
      }

      await cliente.vincular(cartao.cartao.id, baralho.baralho.id);
      await cliente.excluirBaralho(baralho.baralho.id);

      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [{ ...cartao.cartao, baralhos: [] }],
      });
    });

    it("recusa excluir Cartão inexistente como nao_encontrado", async () => {
      const { cliente } = criarAmbiente();

      expect(await cliente.excluirCartao("c-inexistente")).toEqual({
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Cartão não encontrado.",
      });
    });

    it("recusa excluir Baralho inexistente como nao_encontrado", async () => {
      const { cliente } = criarAmbiente();

      expect(await cliente.excluirBaralho("b-inexistente")).toEqual({
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      });
    });

    it("com o transporte indisponível, exclusões falham sem remover entidades", async () => {
      const { cliente, indisponibilizar } = criarAmbiente();
      indisponibilizar();

      expect(await cliente.excluirCartao("c1")).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      });
      expect(await cliente.excluirBaralho("b1")).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      });
    });
  });
}

/**
 * Bateria compartilhada de Cadastro (T607; specs/007-criar-usuario/contracts/api-usuarios.md).
 *
 * Os quatro modos de erro do contrato — `nome_de_usuario_invalido`,
 * `senha_invalida`, `nome_de_usuario_existente` e `indisponivel` — são
 * distinguidos, e as mensagens do contrato são conferidas exatamente, para que
 * os dois Adapters sejam comprovados idênticos na superfície observável.
 * Nenhum retorno traz a Senha, e propriedade a mais na resposta não atravessa
 * a Interface (FR-076, FR-078).
 */

interface CasoDeNomeDeUsuarioInvalido {
  descricao: string;
  nomeDeUsuario: string;
  trechoDaMensagem: RegExp;
}

/** As recusas de Nome de usuário que o contrato prevê, com a regra violada. */
const CASOS_DE_NOME_DE_USUARIO_INVALIDO: CasoDeNomeDeUsuarioInvalido[] = [
  {
    descricao: "2 caracteres",
    nomeDeUsuario: "ab",
    trechoDaMensagem: /pelo menos 3 caracteres/,
  },
  {
    descricao: "51 caracteres",
    nomeDeUsuario: "a".repeat(51),
    trechoDaMensagem: /no máximo 50 caracteres/,
  },
  {
    descricao: "acento no nome",
    nomeDeUsuario: "josé",
    trechoDaMensagem: /apenas letras de A a Z/,
  },
  {
    descricao: "espaço no meio do nome",
    nomeDeUsuario: "ana silva",
    trechoDaMensagem: /apenas letras de A a Z/,
  },
];

/** As duas recusas de tamanho de Senha, uma abaixo e outra acima do intervalo. */
const CASOS_DE_SENHA_INVALIDA: { descricao: string; senha: string }[] = [
  { descricao: "7 caracteres", senha: "1234567" },
  { descricao: "129 caracteres", senha: "s".repeat(129) },
];

/**
 * As formas do mesmo Nome de usuário já cadastrado: caixa trocada e espaços ao
 * redor, que são descartados antes da comparação (FR-074, SC-025).
 */
const CASOS_DE_NOME_DE_USUARIO_DUPLICADO = [
  "ana.silva",
  "ANA.SILVA",
  "  ana.silva  ",
];

function executarBateriaDeCadastro(
  nomeDoAdapter: string,
  criarAmbiente: () => AmbienteDeCliente,
): void {
  describe(`${nomeDoAdapter} — bateria do contrato de Cadastro`, () => {
    it("cadastra um Usuário válido e devolve apenas id e Nome de usuário (FR-071)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.criarUsuario({
        nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
        senha: SENHA_VALIDA,
      });

      expect(resultado).toEqual({
        ok: true,
        usuario: {
          id: expect.any(String),
          nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
        },
      });

      // Nenhuma propriedade além das canônicas: `sal`, `hash`, `parametros` e
      // Senha não existem no retorno (FR-076, FR-078).
      if (resultado.ok) {
        expect(Object.keys(resultado.usuario).sort()).toEqual([
          "id",
          "nomeDeUsuario",
        ]);
      }
    });

    it("descarta os espaços ao redor do Nome de usuário (FR-073)", async () => {
      const { cliente } = criarAmbiente();

      expect(
        await cliente.criarUsuario({
          nomeDeUsuario: `   ${NOME_DE_USUARIO_VALIDO}   `,
          senha: SENHA_VALIDA,
        }),
      ).toEqual({
        ok: true,
        usuario: {
          id: expect.any(String),
          nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
        },
      });
    });

    it("aceita Nome de usuário com exatamente 3 e 50 caracteres (FR-073)", async () => {
      const { cliente } = criarAmbiente();

      expect(
        await cliente.criarUsuario({ nomeDeUsuario: "ana", senha: SENHA_VALIDA }),
      ).toEqual({
        ok: true,
        usuario: { id: expect.any(String), nomeDeUsuario: "ana" },
      });
      expect(
        await cliente.criarUsuario({
          nomeDeUsuario: "a".repeat(50),
          senha: SENHA_VALIDA,
        }),
      ).toEqual({
        ok: true,
        usuario: { id: expect.any(String), nomeDeUsuario: "a".repeat(50) },
      });
    });

    it.each(CASOS_DE_NOME_DE_USUARIO_INVALIDO)(
      "recusa Nome de usuário inválido — $descricao (FR-073)",
      async (caso) => {
        const { cliente } = criarAmbiente();

        const resultado = await cliente.criarUsuario({
          nomeDeUsuario: caso.nomeDeUsuario,
          senha: SENHA_VALIDA,
        });

        expect(resultado.ok).toBe(false);

        if (!resultado.ok) {
          expect(resultado.erro).toBe("nome_de_usuario_invalido");
          expect(resultado.mensagem).toMatch(caso.trechoDaMensagem);
          expect(Object.keys(resultado).sort()).toEqual([
            "erro",
            "mensagem",
            "ok",
          ]);
        }
      },
    );

    it("aceita Senha de 8 e de 128 caracteres e preserva espaços (FR-075, FR-085)", async () => {
      const { cliente } = criarAmbiente();

      expect(
        await cliente.criarUsuario({
          nomeDeUsuario: "ana",
          senha: "12345678",
        }),
      ).toEqual({
        ok: true,
        usuario: { id: expect.any(String), nomeDeUsuario: "ana" },
      });
      expect(
        await cliente.criarUsuario({
          nomeDeUsuario: "bruno",
          senha: "  senha  ",
        }),
      ).toEqual({
        ok: true,
        usuario: { id: expect.any(String), nomeDeUsuario: "bruno" },
      });
      expect(
        await cliente.criarUsuario({
          nomeDeUsuario: "carla",
          senha: "s".repeat(128),
        }),
      ).toEqual({
        ok: true,
        usuario: { id: expect.any(String), nomeDeUsuario: "carla" },
      });
    });

    it.each(CASOS_DE_SENHA_INVALIDA)(
      "recusa Senha inválida — $descricao (FR-075)",
      async (caso) => {
        const { cliente } = criarAmbiente();

        const resultado = await cliente.criarUsuario({
          nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
          senha: caso.senha,
        });

        expect(resultado.ok).toBe(false);

        if (!resultado.ok) {
          expect(resultado.erro).toBe("senha_invalida");
          expect(resultado.mensagem).toMatch(/entre 8 e 128 caracteres/);
          // A mensagem informa o intervalo e nunca repete a Senha recebida.
          expect(resultado.mensagem).not.toContain(caso.senha);
        }
      },
    );

    it.each(CASOS_DE_NOME_DE_USUARIO_DUPLICADO)(
      "recusa %s depois de Ana.Silva, sem distinguir maiúsculas (FR-074, SC-025)",
      async (nomeDuplicado) => {
        const { cliente } = criarAmbiente();

        await cliente.criarUsuario({
          nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
          senha: SENHA_VALIDA,
        });

        expect(
          await cliente.criarUsuario({
            nomeDeUsuario: nomeDuplicado,
            senha: SENHA_VALIDA,
          }),
        ).toEqual({
          ok: false,
          erro: "nome_de_usuario_existente",
          mensagem: "Este nome de usuário já existe. Escolha outro.",
        });
      },
    );

    it("com o transporte indisponível, o Cadastro não é concluído nem gravado (FR-044, FR-045)", async () => {
      const { cliente, indisponibilizar, restaurar } = criarAmbiente();
      indisponibilizar();

      expect(
        await cliente.criarUsuario({
          nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
          senha: SENHA_VALIDA,
        }),
      ).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
      });

      restaurar();

      // A recusa não deixou rastro: o mesmo Nome de usuário é aceito depois.
      expect(
        await cliente.criarUsuario({
          nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
          senha: SENHA_VALIDA,
        }),
      ).toEqual({
        ok: true,
        usuario: {
          id: expect.any(String),
          nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
        },
      });
    });
  });
}

executarBateriaDoContrato("ClienteHttp", criarAmbienteHttp);
executarBateriaDoContrato("ClienteEmMemoria", criarAmbienteEmMemoria);

executarBateriaDeBaralhos("ClienteHttp", criarAmbienteHttp);
executarBateriaDeBaralhos("ClienteEmMemoria", criarAmbienteEmMemoria);

executarBateriaDeVinculos("ClienteHttp", criarAmbienteHttp);
executarBateriaDeVinculos("ClienteEmMemoria", criarAmbienteEmMemoria);

executarBateriaDeEdicao("ClienteHttp", criarAmbienteHttp);
executarBateriaDeEdicao("ClienteEmMemoria", criarAmbienteEmMemoria);

executarBateriaDeExclusao("ClienteHttp", criarAmbienteHttp);
executarBateriaDeExclusao("ClienteEmMemoria", criarAmbienteEmMemoria);

executarBateriaDeCadastro("ClienteHttp", criarAmbienteHttp);
executarBateriaDeCadastro("ClienteEmMemoria", criarAmbienteEmMemoria);

executarBateriaDeEntrada("ClienteHttp", criarAmbienteHttp);
executarBateriaDeEntrada("ClienteEmMemoria", criarAmbienteEmMemoria);

/**
 * T707 (specs/008-entrar/tasks.md) — bateria de Entrar e do modo
 * `nao_autenticado`, a mesma contra os dois Adapters.
 *
 * Prova FR-086 a FR-092 e FR-044: Entrar com a Credencial válida devolve
 * exatamente quem entrou; a Credencial que não confere é recusada uma só vez,
 * com a mesma mensagem para Nome de usuário inexistente e para Senha errada;
 * sem Credencial válida nenhuma operação do acervo é executada e nada muda; e
 * `nao_autenticado` nunca se confunde com `indisponivel` — os dois modos levam
 * a interface a decisões diferentes (SC-028, SC-029, SC-030, SC-035, SC-036).
 */
function executarBateriaDeEntrada(
  nome: string,
  criarAmbiente: () => AmbienteDeCliente,
): void {
  describe(`${nome} — Entrar e recusa por Credencial`, () => {
    it("entrar com a Credencial válida devolve exatamente o Usuário que entrou (FR-086, FR-078)", async () => {
      const { cliente } = criarAmbiente();

      const resultado = await cliente.entrar(CREDENCIAL_DE_PROVA);

      expect(resultado).toEqual({
        ok: true,
        usuario: {
          id: expect.any(String),
          nomeDeUsuario: NOME_DE_USUARIO_DE_PROVA,
        },
      });

      if (resultado.ok) {
        // Nenhuma leitura devolve a Senha, nem qualquer derivação dela
        // (FR-076, FR-078).
        expect(Object.keys(resultado.usuario).sort()).toEqual([
          "id",
          "nomeDeUsuario",
        ]);
        expect(JSON.stringify(resultado)).not.toContain(SENHA_DE_PROVA);
      }
    });

    it("descarta espaços ao redor do Nome de usuário e ignora maiúsculas; compara a Senha exatamente (FR-087, SC-036)", async () => {
      const { cliente } = criarAmbiente();

      expect(
        await cliente.entrar({
          nomeDeUsuario: `   ${NOME_DE_USUARIO_DE_PROVA.toUpperCase()}   `,
          senha: SENHA_DE_PROVA,
        }),
      ).toEqual({
        ok: true,
        usuario: {
          id: expect.any(String),
          nomeDeUsuario: NOME_DE_USUARIO_DE_PROVA,
        },
      });

      // Os espaços da Senha são preservados na comparação: a Senha com
      // espaços nas pontas não é a Senha cadastrada (FR-087).
      expect(
        await cliente.entrar({
          nomeDeUsuario: NOME_DE_USUARIO_DE_PROVA,
          senha: ` ${SENHA_DE_PROVA} `,
        }),
      ).toEqual({
        ok: false,
        erro: NAO_AUTENTICADO,
        mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
      });
    });

    it("recusa Nome de usuário inexistente e Senha errada com a mesma resposta (FR-088, SC-029)", async () => {
      const { cliente } = criarAmbiente();

      const semUsuario = await cliente.entrar({
        nomeDeUsuario: "ninguem.aqui",
        senha: SENHA_DE_PROVA,
      });
      const comSenhaErrada = await cliente.entrar({
        nomeDeUsuario: NOME_DE_USUARIO_DE_PROVA,
        senha: SENHA_ERRADA,
      });

      expect(semUsuario).toEqual({
        ok: false,
        erro: NAO_AUTENTICADO,
        mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
      });

      // A recusa é uma só: nada distingue os dois casos, nem na mensagem nem
      // nas chaves do resultado.
      expect(comSenhaErrada).toEqual(semUsuario);
      expect(Object.keys(semUsuario).sort()).toEqual(["erro", "mensagem", "ok"]);
      expect(JSON.stringify(semUsuario)).not.toContain(SENHA_DE_PROVA);
      expect(JSON.stringify(comSenhaErrada)).not.toContain(SENHA_ERRADA);
    });

    it("sem Credencial, toda operação do acervo é recusada com nao_autenticado e nada muda (FR-090, SC-028)", async () => {
      const { cliente, clienteComo } = criarAmbiente();

      // O acervo do dono: é ele que precisa permanecer exatamente como está
      // depois de cada recusa.
      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!cartao.ok || !baralho.ok) {
        throw new Error("as criações do cenário deveriam ser aceitas");
      }

      const semCredencial = clienteComo(null);
      const recusa = {
        ok: false,
        erro: NAO_AUTENTICADO,
        mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
      };

      expect(
        await semCredencial.criarCartao({
          frente: FRENTE_VALIDA,
          verso: VERSO_VALIDO,
        }),
      ).toEqual(recusa);
      expect(await semCredencial.listarCartoes()).toEqual(recusa);
      expect(await semCredencial.criarBaralho({ nome: NOME_VALIDO })).toEqual(
        recusa,
      );
      expect(await semCredencial.listarBaralhos()).toEqual(recusa);
      expect(await semCredencial.obterBaralho(baralho.baralho.id)).toEqual(
        recusa,
      );
      expect(
        await semCredencial.vincular(cartao.cartao.id, baralho.baralho.id),
      ).toEqual(recusa);
      expect(
        await semCredencial.desvincular(cartao.cartao.id, baralho.baralho.id),
      ).toEqual(recusa);
      expect(
        await semCredencial.editarCartao(cartao.cartao.id, "To run", "Correr"),
      ).toEqual(recusa);
      expect(
        await semCredencial.renomearBaralho(baralho.baralho.id, "Espanhol"),
      ).toEqual(recusa);
      expect(await semCredencial.excluirCartao(cartao.cartao.id)).toEqual(
        recusa,
      );
      expect(await semCredencial.excluirBaralho(baralho.baralho.id)).toEqual(
        recusa,
      );

      // O acervo do dono está intacto: nenhuma recusa alterou nada.
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [
          {
            id: cartao.cartao.id,
            frente: FRENTE_VALIDA,
            verso: VERSO_VALIDO,
            baralhos: [],
          },
        ],
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [
          {
            id: baralho.baralho.id,
            nome: NOME_VALIDO,
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
        ],
      });
    });

    it("Credencial que não confere e transporte parado são modos distintos: nao_autenticado e indisponivel (FR-091, SC-035)", async () => {
      const { cliente, clienteComo, indisponibilizar } = criarAmbiente();
      const comCredencialInvalida = clienteComo({
        nomeDeUsuario: NOME_DE_USUARIO_DE_PROVA,
        senha: SENHA_ERRADA,
      });

      expect(
        await comCredencialInvalida.criarCartao({
          frente: FRENTE_VALIDA,
          verso: VERSO_VALIDO,
        }),
      ).toEqual({
        ok: false,
        erro: NAO_AUTENTICADO,
        mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
      });
      expect(
        await comCredencialInvalida.entrar({
          nomeDeUsuario: NOME_DE_USUARIO_DE_PROVA,
          senha: SENHA_ERRADA,
        }),
      ).toEqual({
        ok: false,
        erro: NAO_AUTENTICADO,
        mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
      });

      // A recusa não deixou rastro: o acervo do dono continua exatamente como
      // estava — vazio, porque nada foi criado (FR-044, SC-028).
      expect(await cliente.listarCartoes()).toEqual({ ok: true, cartoes: [] });

      indisponibilizar();

      // A mesma Credencial válida, com o transporte parado, é reportada como
      // indisponibilidade — nunca como recusa por Credencial.
      expect(
        await cliente.criarCartao({ frente: FRENTE_VALIDA, verso: VERSO_VALIDO }),
      ).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      });
      expect(await cliente.entrar(CREDENCIAL_DE_PROVA)).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
      });
    });

    it("dois Usuários não enxergam nem alteram o acervo um do outro (FR-092, FR-093, SC-030)", async () => {
      const { cliente, clienteComo } = criarAmbiente();

      // O Cadastro é isento de Credencial (FR-097): é por ele que o segundo
      // Usuário passa a existir.
      const cadastroDoOutro = await cliente.criarUsuario({
        nomeDeUsuario: CREDENCIAL_DO_OUTRO.nomeDeUsuario,
        senha: CREDENCIAL_DO_OUTRO.senha,
      });

      expect(cadastroDoOutro.ok).toBe(true);

      const outro = clienteComo(CREDENCIAL_DO_OUTRO);

      expect(await outro.entrar(CREDENCIAL_DO_OUTRO)).toEqual({
        ok: true,
        usuario: {
          id: expect.any(String),
          nomeDeUsuario: CREDENCIAL_DO_OUTRO.nomeDeUsuario,
        },
      });

      const cartao = await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      });
      const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

      if (!cartao.ok || !baralho.ok) {
        throw new Error("as criações do cenário deveriam ser aceitas");
      }

      await cliente.vincular(cartao.cartao.id, baralho.baralho.id);

      // O acervo do outro Usuário está vazio: nada do primeiro lhe aparece.
      expect(await outro.listarCartoes()).toEqual({ ok: true, cartoes: [] });
      expect(await outro.listarBaralhos()).toEqual({ ok: true, baralhos: [] });

      // O conteúdo do primeiro se comporta como inexistente: mesma recusa de
      // um id que nunca existiu, e nunca um código que revele a existência.
      const inexistente = await outro.obterBaralho("b-que-nunca-existiu");

      expect(inexistente).toEqual({
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Baralho não encontrado.",
      });
      expect(await outro.obterBaralho(baralho.baralho.id)).toEqual(inexistente);
      expect(
        await outro.editarCartao(cartao.cartao.id, "To run", "Correr"),
      ).toEqual({
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Cartão não encontrado.",
      });
      expect(await outro.excluirCartao(cartao.cartao.id)).toEqual({
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Cartão não encontrado.",
      });

      // O Vínculo entre donos diferentes é impossível (FR-093), e o Baralho do
      // outro continua sem Cartão algum.
      const baralhoDoOutro = await outro.criarBaralho({ nome: "Espanhol" });

      if (!baralhoDoOutro.ok) {
        throw new Error("a criação do cenário deveria ser aceita");
      }

      expect(
        await outro.vincular(cartao.cartao.id, baralhoDoOutro.baralho.id),
      ).toEqual({
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Cartão não encontrado.",
      });
      expect(await outro.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [
          {
            id: baralhoDoOutro.baralho.id,
            nome: "Espanhol",
            quantidadeDeCartoes: 0,
            elegivel: false,
          },
        ],
      });

      // E o acervo do primeiro Usuário permanece exatamente como estava.
      expect(await cliente.listarCartoes()).toEqual({
        ok: true,
        cartoes: [
          {
            id: cartao.cartao.id,
            frente: FRENTE_VALIDA,
            verso: VERSO_VALIDO,
            baralhos: [{ id: baralho.baralho.id, nome: NOME_VALIDO }],
          },
        ],
      });
      expect(await cliente.listarBaralhos()).toEqual({
        ok: true,
        baralhos: [
          {
            id: baralho.baralho.id,
            nome: NOME_VALIDO,
            quantidadeDeCartoes: 1,
            elegivel: true,
          },
        ],
      });
    });

    it("não deixa a Credencial em armazenamento, cookie nem endereço (FR-078, FR-079, SC-033)", async () => {
      const { cliente } = criarAmbiente();

      await cliente.entrar(CREDENCIAL_DE_PROVA);
      await cliente.criarCartao({ frente: FRENTE_VALIDA, verso: VERSO_VALIDO });
      await cliente.listarCartoes();

      // Nada é gravado no navegador — nem `localStorage`, nem
      // `sessionStorage`, nem cookie —, e o endereço não carrega a Credencial.
      expect(Object.keys(window.localStorage)).toEqual([]);
      expect(Object.keys(window.sessionStorage)).toEqual([]);
      expect(document.cookie).toBe("");
      expect(window.location.href).not.toContain(NOME_DE_USUARIO_DE_PROVA);
      expect(window.location.href).not.toContain(SENHA_DE_PROVA);
    });
  });
}

describe("resultados idênticos entre os dois Adapters", () => {
  it("a mesma sequência de operações de Cartão produz o mesmo resultado observável", async () => {
    const noHttp = await cenarioCompleto(criarAmbienteHttp());
    const emMemoria = await cenarioCompleto(criarAmbienteEmMemoria());

    expect(comIdsOcultos(emMemoria)).toEqual(comIdsOcultos(noHttp));
  });

  it("a mesma sequência de operações de Baralho produz o mesmo resultado observável", async () => {
    const noHttp = await cenarioDeBaralhos(criarAmbienteHttp());
    const emMemoria = await cenarioDeBaralhos(criarAmbienteEmMemoria());

    expect(comIdsOcultos(emMemoria)).toEqual(comIdsOcultos(noHttp));
  });

  it("a mesma sequência de Vínculos produz o mesmo resultado observável", async () => {
    const noHttp = await cenarioDeVinculos(criarAmbienteHttp());
    const emMemoria = await cenarioDeVinculos(criarAmbienteEmMemoria());

    expect(comIdsOcultos(emMemoria)).toEqual(comIdsOcultos(noHttp));
  });

  it("a mesma sequência de edição produz o mesmo resultado observável", async () => {
    const noHttp = await cenarioDeEdicao(criarAmbienteHttp());
    const emMemoria = await cenarioDeEdicao(criarAmbienteEmMemoria());

    expect(comIdsOcultos(emMemoria)).toEqual(comIdsOcultos(noHttp));
  });

  it("a mesma sequência de exclusão produz o mesmo resultado observável", async () => {
    const noHttp = await cenarioDeExclusao(criarAmbienteHttp());
    const emMemoria = await cenarioDeExclusao(criarAmbienteEmMemoria());

    expect(comIdsOcultos(emMemoria)).toEqual(comIdsOcultos(noHttp));
  });

  it("a mesma sequência de Cadastro produz o mesmo resultado observável", async () => {
    const noHttp = await cenarioDeCadastro(criarAmbienteHttp());
    const emMemoria = await cenarioDeCadastro(criarAmbienteEmMemoria());

    expect(comIdsOcultos(emMemoria)).toEqual(comIdsOcultos(noHttp));
  });
});

/**
 * Sequência que atravessa sucesso, recusas e indisponibilidade nas duas
 * operações. Os ids são opacos, então a igualdade entre Adapters é comparada
 * com ids ocultos — todo o resto precisa ser idêntico, inclusive as mensagens.
 */
async function cenarioCompleto(ambiente: AmbienteDeCliente) {
  const { cliente, indisponibilizar, restaurar } = ambiente;

  const criado = await cliente.criarCartao({
    frente: FRENTE_VALIDA,
    verso: VERSO_VALIDO,
  });
  const repetido = await cliente.criarCartao({
    frente: FRENTE_VALIDA,
    verso: "Andar",
  });
  const frenteVazia = await cliente.criarCartao({
    frente: "",
    verso: VERSO_VALIDO,
  });
  const frenteLonga = await cliente.criarCartao({
    frente: "a".repeat(1001),
    verso: VERSO_VALIDO,
  });
  const lista = await cliente.listarCartoes();

  indisponibilizar();
  const criacaoIndisponivel = await cliente.criarCartao({
    frente: "Never",
    verso: "Nunca",
  });
  const listaIndisponivel = await cliente.listarCartoes();

  restaurar();
  const listaAposRestaurar = await cliente.listarCartoes();

  return {
    criado,
    repetido,
    frenteVazia,
    frenteLonga,
    lista,
    criacaoIndisponivel,
    listaIndisponivel,
    listaAposRestaurar,
  };
}

/**
 * Sequência de Baralhos que atravessa sucesso, recusas e indisponibilidade.
 * Os ids são opacos, então a igualdade entre Adapters é comparada com ids
 * ocultos — todo o resto precisa ser idêntico, inclusive as mensagens.
 */
async function cenarioDeBaralhos(ambiente: AmbienteDeCliente) {
  const { cliente, indisponibilizar, restaurar } = ambiente;

  const criado = await cliente.criarBaralho({ nome: NOME_VALIDO });
  const repetido = await cliente.criarBaralho({ nome: NOME_VALIDO });
  const nomeVazio = await cliente.criarBaralho({ nome: "" });
  const nomeLongo = await cliente.criarBaralho({ nome: "a".repeat(101) });
  const lista = await cliente.listarBaralhos();

  indisponibilizar();
  const criacaoIndisponivel = await cliente.criarBaralho({ nome: "Nunca" });
  const listaIndisponivel = await cliente.listarBaralhos();

  restaurar();
  const listaAposRestaurar = await cliente.listarBaralhos();

  return {
    criado,
    repetido,
    nomeVazio,
    nomeLongo,
    lista,
    criacaoIndisponivel,
    listaIndisponivel,
    listaAposRestaurar,
  };
}

/**
 * Sequência de Vínculos que atravessa sucesso, recusas e indisponibilidade.
 */
async function cenarioDeVinculos(ambiente: AmbienteDeCliente) {
  const { cliente, indisponibilizar, restaurar } = ambiente;

  const cartao = await cliente.criarCartao({
    frente: FRENTE_VALIDA,
    verso: VERSO_VALIDO,
  });
  const outroCartao = await cliente.criarCartao({
    frente: "To run",
    verso: "Correr",
  });
  const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

  if (!cartao.ok || !outroCartao.ok || !baralho.ok) {
    throw new Error("as criações deveriam ser aceitas");
  }

  const vinculado = await cliente.vincular(cartao.cartao.id, baralho.baralho.id);
  const duplicado = await cliente.vincular(cartao.cartao.id, baralho.baralho.id);
  const baralhoObtido = await cliente.obterBaralho(baralho.baralho.id);
  const cartoesComBaralhos = await cliente.listarCartoes();
  const baralhos = await cliente.listarBaralhos();
  const desvinculado = await cliente.desvincular(
    cartao.cartao.id,
    baralho.baralho.id,
  );
  const desvinculadoDeNovo = await cliente.desvincular(
    cartao.cartao.id,
    baralho.baralho.id,
  );

  indisponibilizar();
  const vinculoIndisponivel = await cliente.vincular(
    outroCartao.cartao.id,
    baralho.baralho.id,
  );
  const desvinculoIndisponivel = await cliente.desvincular(
    cartao.cartao.id,
    baralho.baralho.id,
  );
  const obterIndisponivel = await cliente.obterBaralho(baralho.baralho.id);

  restaurar();
  const baralhosAposRestaurar = await cliente.listarBaralhos();

  return {
    cartao,
    outroCartao,
    baralho,
    vinculado,
    duplicado,
    baralhoObtido,
    cartoesComBaralhos,
    baralhos,
    desvinculado,
    desvinculadoDeNovo,
    vinculoIndisponivel,
    desvinculoIndisponivel,
    obterIndisponivel,
    baralhosAposRestaurar,
  };
}

/**
 * Sequência de edição que atravessa sucesso, recusas e indisponibilidade.
 */
async function cenarioDeEdicao(ambiente: AmbienteDeCliente) {
  const { cliente, indisponibilizar, restaurar } = ambiente;

  const cartao = await cliente.criarCartao({
    frente: FRENTE_VALIDA,
    verso: VERSO_VALIDO,
  });
  const baralho = await cliente.criarBaralho({ nome: NOME_VALIDO });

  if (!cartao.ok || !baralho.ok) {
    throw new Error("as criações deveriam ser aceitas");
  }

  await cliente.vincular(cartao.cartao.id, baralho.baralho.id);

  const edicao = await cliente.editarCartao(cartao.cartao.id, "To run", "Correr");
  const edicaoInvalida = await cliente.editarCartao(cartao.cartao.id, "", "Correr");
  const edicaoInexistente = await cliente.editarCartao(
    "c-inexistente",
    "To run",
    "Correr",
  );
  const renomeacao = await cliente.renomearBaralho(baralho.baralho.id, "Espanhol");
  const renomeacaoInvalida = await cliente.renomearBaralho(baralho.baralho.id, "");
  const renomeacaoInexistente = await cliente.renomearBaralho(
    "b-inexistente",
    "Espanhol",
  );
  const cartoes = await cliente.listarCartoes();
  const baralhos = await cliente.listarBaralhos();
  const baralhoObtido = await cliente.obterBaralho(baralho.baralho.id);

  indisponibilizar();
  const edicaoIndisponivel = await cliente.editarCartao(
    cartao.cartao.id,
    "Never",
    "Nunca",
  );
  const renomeacaoIndisponivel = await cliente.renomearBaralho(
    baralho.baralho.id,
    "Nunca",
  );

  restaurar();
  const baralhosAposRestaurar = await cliente.listarBaralhos();

  return {
    cartao,
    baralho,
    edicao,
    edicaoInvalida,
    edicaoInexistente,
    renomeacao,
    renomeacaoInvalida,
    renomeacaoInexistente,
    cartoes,
    baralhos,
    baralhoObtido,
    edicaoIndisponivel,
    renomeacaoIndisponivel,
    baralhosAposRestaurar,
  };
}

/**
 * Sequência de exclusão que atravessa sucesso, recusas e indisponibilidade.
 */
async function cenarioDeExclusao(ambiente: AmbienteDeCliente) {
  const { cliente, indisponibilizar, restaurar } = ambiente;

  const cartao = await cliente.criarCartao({
    frente: FRENTE_VALIDA,
    verso: VERSO_VALIDO,
  });
  const outroCartao = await cliente.criarCartao({
    frente: "To run",
    verso: "Correr",
  });
  const primeiroBaralho = await cliente.criarBaralho({ nome: NOME_VALIDO });
  const segundoBaralho = await cliente.criarBaralho({ nome: "Espanhol" });

  if (
    !cartao.ok ||
    !outroCartao.ok ||
    !primeiroBaralho.ok ||
    !segundoBaralho.ok
  ) {
    throw new Error("as criações deveriam ser aceitas");
  }

  await cliente.vincular(cartao.cartao.id, primeiroBaralho.baralho.id);
  await cliente.vincular(cartao.cartao.id, segundoBaralho.baralho.id);
  await cliente.vincular(outroCartao.cartao.id, primeiroBaralho.baralho.id);

  const exclusaoDeCartao = await cliente.excluirCartao(cartao.cartao.id);
  const exclusaoDeCartaoInexistente = await cliente.excluirCartao(
    "c-inexistente",
  );
  const exclusaoDeBaralho = await cliente.excluirBaralho(
    primeiroBaralho.baralho.id,
  );
  const exclusaoDeBaralhoInexistente = await cliente.excluirBaralho(
    "b-inexistente",
  );
  const cartoes = await cliente.listarCartoes();
  const baralhos = await cliente.listarBaralhos();
  const baralhoRestante = await cliente.obterBaralho(segundoBaralho.baralho.id);

  indisponibilizar();
  const exclusaoIndisponivelDeCartao = await cliente.excluirCartao(
    outroCartao.cartao.id,
  );
  const exclusaoIndisponivelDeBaralho = await cliente.excluirBaralho(
    segundoBaralho.baralho.id,
  );

  restaurar();
  const cartoesAposRestaurar = await cliente.listarCartoes();

  return {
    cartao,
    outroCartao,
    primeiroBaralho,
    segundoBaralho,
    exclusaoDeCartao,
    exclusaoDeCartaoInexistente,
    exclusaoDeBaralho,
    exclusaoDeBaralhoInexistente,
    cartoes,
    baralhos,
    baralhoRestante,
    exclusaoIndisponivelDeCartao,
    exclusaoIndisponivelDeBaralho,
    cartoesAposRestaurar,
  };
}

/**
 * Sequência de Cadastro que atravessa sucesso, os quatro modos de recusa e a
 * indisponibilidade. Os ids são opacos, então a igualdade entre Adapters é
 * comparada com ids ocultos — todo o resto precisa ser idêntico, inclusive as
 * mensagens em português.
 */
async function cenarioDeCadastro(ambiente: AmbienteDeCliente) {
  const { cliente, indisponibilizar, restaurar } = ambiente;

  const criado = await cliente.criarUsuario({
    nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
    senha: SENHA_VALIDA,
  });
  const comEspacos = await cliente.criarUsuario({
    nomeDeUsuario: `  ${NOME_DE_USUARIO_VALIDO}  `,
    senha: SENHA_VALIDA,
  });
  const semDistincaoDeCaixa = await cliente.criarUsuario({
    nomeDeUsuario: "ana.silva",
    senha: SENHA_VALIDA,
  });
  const nomeCurto = await cliente.criarUsuario({
    nomeDeUsuario: "ab",
    senha: SENHA_VALIDA,
  });
  const nomeComAcento = await cliente.criarUsuario({
    nomeDeUsuario: "josé",
    senha: SENHA_VALIDA,
  });
  const nomeLongo = await cliente.criarUsuario({
    nomeDeUsuario: "a".repeat(51),
    senha: SENHA_VALIDA,
  });
  const senhaCurta = await cliente.criarUsuario({
    nomeDeUsuario: "bruno",
    senha: "1234567",
  });
  const senhaLonga = await cliente.criarUsuario({
    nomeDeUsuario: "carla",
    senha: "s".repeat(129),
  });
  const outroUsuario = await cliente.criarUsuario({
    nomeDeUsuario: "bruno",
    senha: "  senha  ",
  });

  indisponibilizar();
  const cadastroIndisponivel = await cliente.criarUsuario({
    nomeDeUsuario: "diego",
    senha: SENHA_VALIDA,
  });

  restaurar();
  const cadastroAposRestaurar = await cliente.criarUsuario({
    nomeDeUsuario: "diego",
    senha: SENHA_VALIDA,
  });

  return {
    criado,
    comEspacos,
    semDistincaoDeCaixa,
    nomeCurto,
    nomeComAcento,
    nomeLongo,
    senhaCurta,
    senhaLonga,
    outroUsuario,
    cadastroIndisponivel,
    cadastroAposRestaurar,
  };
}

/**
 * Substitui todo `id` por "<id>" em profundidade: identificadores são opacos
 * e não fazem parte da igualdade entre os resultados dos dois Adapters.
 */
function comIdsOcultos(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(comIdsOcultos);
  }

  if (typeof valor === "object" && valor !== null) {
    const resultado: Record<string, unknown> = {};

    for (const [chave, item] of Object.entries(valor)) {
      resultado[chave] = chave === "id" ? "<id>" : comIdsOcultos(item);
    }

    return resultado;
  }

  return valor;
}

describe("ClienteHttp — resposta fora do contrato nunca aparece como sucesso (FR-044)", () => {
  it("trata status 500 como indisponivel, na criação e na listagem", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(500, "erro interno"),
    );

    expect(
      await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
    expect(await cliente.listarCartoes()).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
  });

  it("trata 400 com corpo que não é JSON como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => ({
      status: 400,
      json: async () => {
        throw new Error("corpo ilegível");
      },
    }));

    expect(
      await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
  });

  it("trata 400 com código fora do contrato como indisponivel", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(400, {
        erro: "corpo_invalido",
        mensagem: "O corpo da requisição não é válido.",
      }),
    );

    expect(
      await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
  });

  it("trata falha de rede como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => {
      throw new Error("conexão recusada");
    });

    expect(
      await cliente.criarCartao({
        frente: FRENTE_VALIDA,
        verso: VERSO_VALIDO,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
  });
});

describe("ClienteHttp — resposta fora do contrato de Baralhos nunca aparece como sucesso (FR-044)", () => {
  it("trata status 500 como indisponivel, na criação e na listagem", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(500, "erro interno"),
    );

    expect(await cliente.criarBaralho({ nome: NOME_VALIDO })).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    });
    expect(await cliente.listarBaralhos()).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    });
  });

  it("trata 400 com corpo que não é JSON como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => ({
      status: 400,
      json: async () => {
        throw new Error("corpo ilegível");
      },
    }));

    expect(await cliente.criarBaralho({ nome: NOME_VALIDO })).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    });
  });

  it("trata 400 com código fora do contrato como indisponivel", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(400, {
        erro: "corpo_invalido",
        mensagem: "O corpo da requisição não é válido.",
      }),
    );

    expect(await cliente.criarBaralho({ nome: NOME_VALIDO })).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    });
  });

  it("trata falha de rede como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => {
      throw new Error("conexão recusada");
    });

    expect(await cliente.criarBaralho({ nome: NOME_VALIDO })).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    });
  });
});

describe("ClienteHttp — resposta fora do contrato de Vínculos, edição e exclusão (FR-044)", () => {
  it("trata 200 em vincular como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => respostaDeTeste(200, null));

    expect(await cliente.vincular("c1", "b1")).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
    });
  });

  it("trata 409 com código fora do contrato em vincular como indisponivel", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(409, {
        erro: "corpo_invalido",
        mensagem: "O corpo da requisição não é válido.",
      }),
    );

    expect(await cliente.vincular("c1", "b1")).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
    });
  });

  it("trata 200 com corpo inválido em obterBaralho como indisponivel", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(200, {
        id: "b1",
        nome: "Inglês",
        elegivel: true,
      }),
    );

    expect(await cliente.obterBaralho("b1")).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
    });
  });

  it("trata 404 com código de Vínculo em editarCartao como indisponivel", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(404, {
        erro: "vinculo_nao_encontrado",
        mensagem: "O vínculo não existe.",
      }),
    );

    expect(
      await cliente.editarCartao("c1", FRENTE_VALIDA, VERSO_VALIDO),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
  });

  it("trata 200 em excluirCartao como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => respostaDeTeste(200, null));

    expect(await cliente.excluirCartao("c1")).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
    });
  });
});

describe("ClienteHttp — resposta fora do contrato de Usuários nunca aparece como sucesso (FR-044)", () => {
  it("trata status 500 como indisponivel", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(500, "erro interno"),
    );

    expect(
      await cliente.criarUsuario({
        nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
        senha: SENHA_VALIDA,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
    });
  });

  it("trata 400 com corpo que não é JSON como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => ({
      status: 400,
      json: async () => {
        throw new Error("corpo ilegível");
      },
    }));

    expect(
      await cliente.criarUsuario({
        nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
        senha: SENHA_VALIDA,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
    });
  });

  it("trata 400 com o código da duplicata como indisponivel: ele pertence ao 409", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(400, { ...NOME_DE_USUARIO_EXISTENTE }),
    );

    expect(
      await cliente.criarUsuario({
        nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
        senha: SENHA_VALIDA,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
    });
  });

  it("trata 409 com código fora do contrato como indisponivel", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(409, {
        erro: "corpo_invalido",
        mensagem: "O corpo da requisição não é válido.",
      }),
    );

    expect(
      await cliente.criarUsuario({
        nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
        senha: SENHA_VALIDA,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
    });
  });

  it("trata 201 com corpo sem Nome de usuário como indisponivel", async () => {
    const cliente = clienteHttpCom(async () =>
      respostaDeTeste(201, { id: "u1" }),
    );

    expect(
      await cliente.criarUsuario({
        nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
        senha: SENHA_VALIDA,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
    });
  });

  it("trata falha de rede como indisponivel", async () => {
    const cliente = clienteHttpCom(async () => {
      throw new Error("conexão recusada");
    });

    expect(
      await cliente.criarUsuario({
        nomeDeUsuario: NOME_DE_USUARIO_VALIDO,
        senha: SENHA_VALIDA,
      }),
    ).toEqual({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
    });
  });
});

function clienteHttpCom(fetchDeTeste: unknown): ClienteDoAcervo {
  vi.stubGlobal("fetch", fetchDeTeste);
  return new ClienteHttp(ENDERECO_DA_API);
}
