import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_USUARIOS,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_VINCULOS,
} from "../../src/acervo-cliente/cliente";
import type {
  Baralho,
  Cartao,
  ClienteDoAcervo,
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
 * T008, T106, T208, T403, T503 e T607 — bateria dos contratos de Cartões, de
 * Baralhos, de Vínculos, de edição, de exclusão e de Usuários contra os dois
 * Adapters da Seam `ClienteDoAcervo`.
 *
 * A **mesma** bateria — criação, listagem, Vínculos, edição, exclusão,
 * Cadastro, os modos de recusa de domínio com mensagem exata em português e a
 * indisponibilidade — roda contra `ClienteHttp` e `ClienteEmMemoria`, e
 * produz resultados idênticos. Nenhuma resposta que não seja de sucesso
 * aparece como operação concluída (FR-044).
 */

const FRENTE_VALIDA = "To walk";
const VERSO_VALIDO = "Caminhar";
const NOME_VALIDO = "Inglês";
const NOME_DE_USUARIO_VALIDO = "Ana.Silva";
const SENHA_VALIDA = "senha-de-prova";
const ENDERECO_DA_API = "http://127.0.0.1:3001";

afterEach(() => {
  vi.unstubAllGlobals();
});

type AmbienteDeCliente = {
  cliente: ClienteDoAcervo;
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
  const cliente = new ClienteEmMemoria();

  return {
    cliente,
    indisponibilizar: () => cliente.simularIndisponibilidade(),
    restaurar: () => cliente.restaurarDisponibilidade(),
  };
}

/**
 * Servidor de contrato simulado para o `ClienteHttp`: uma `fetch` falsa que
 * implementa as rotas de Cartões, de Baralhos, de Vínculos, de edição, de
 * exclusão e de Usuários exatamente como a API. A indisponibilidade é
 * simulada fazendo a `fetch` lançar, como numa falha de rede real.
 */
function criarAmbienteHttp(): AmbienteDeCliente {
  const cartoesNoServidor: Cartao[] = [];
  const baralhosNoServidor: Baralho[] = [];
  const vinculosNoServidor: { cartaoId: string; baralhoId: string }[] = [];
  const usuariosNoServidor: { id: string; nomeDeUsuario: string }[] = [];
  let sequencia = 0;
  let sequenciaDeBaralhos = 0;
  let sequenciaDeUsuarios = 0;
  let indisponivel = false;

  function baralhosDoCartao(cartaoId: string): Baralho[] {
    return vinculosNoServidor
      .filter((vinculo) => vinculo.cartaoId === cartaoId)
      .map((vinculo) =>
        baralhosNoServidor.find((baralho) => baralho.id === vinculo.baralhoId),
      )
      .filter((baralho): baralho is Baralho => baralho !== undefined)
      .map((baralho) => ({ id: baralho.id, nome: baralho.nome }));
  }

  function cartoesDoBaralho(baralhoId: string): Cartao[] {
    return vinculosNoServidor
      .filter((vinculo) => vinculo.baralhoId === baralhoId)
      .map((vinculo) =>
        cartoesNoServidor.find((cartao) => cartao.id === vinculo.cartaoId),
      )
      .filter((cartao): cartao is Cartao => cartao !== undefined)
      .map((cartao) => ({
        id: cartao.id,
        frente: cartao.frente,
        verso: cartao.verso,
      }));
  }

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

      const cartao: Cartao = {
        id: `s${++sequencia}`,
        frente: corpo.frente as string,
        verso: corpo.verso as string,
      };

      cartoesNoServidor.push(cartao);

      return respostaDeTeste(201, cartao);
    }

    if (caminho === "/cartoes" && metodo === "GET") {
      return respostaDeTeste(
        200,
        cartoesNoServidor.map((cartao) => ({
          ...cartao,
          baralhos: baralhosDoCartao(cartao.id),
        })),
      );
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
      };

      usuariosNoServidor.push(usuario);

      // A resposta traz uma propriedade a mais de propósito: nenhum retorno
      // de Cadastro entrega `sal`, `hash` nem Senha, e o Adapter descarta o
      // que não seja campo canônico (FR-076, FR-078).
      return respostaDeTeste(201, { ...usuario, hash: "nunca-atravessa" });
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

      const baralho: Baralho = {
        id: `s${++sequenciaDeBaralhos}`,
        nome: corpo.nome as string,
      };

      baralhosNoServidor.push(baralho);

      return respostaDeTeste(201, baralho);
    }

    if (caminho === "/baralhos" && metodo === "GET") {
      return respostaDeTeste(
        200,
        baralhosNoServidor.map((baralho) => {
          const quantidadeDeCartoes = vinculosNoServidor.filter(
            (vinculo) => vinculo.baralhoId === baralho.id,
          ).length;

          return {
            ...baralho,
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

      if (!cartoesNoServidor.some((cartao) => cartao.id === cartaoId)) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Cartão não encontrado.",
        });
      }

      if (!baralhosNoServidor.some((baralho) => baralho.id === baralhoId)) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Baralho não encontrado.",
        });
      }

      if (
        vinculosNoServidor.some(
          (vinculo) =>
            vinculo.cartaoId === cartaoId && vinculo.baralhoId === baralhoId,
        )
      ) {
        return respostaDeTeste(409, {
          erro: "vinculo_duplicado",
          mensagem: "O vínculo já existe.",
        });
      }

      vinculosNoServidor.push({ cartaoId, baralhoId });

      return respostaDeTeste(201, null);
    }

    if (vinculoEspecifico !== null && metodo === "DELETE") {
      const baralhoId = decodeURIComponent(vinculoEspecifico[1]);
      const cartaoId = decodeURIComponent(vinculoEspecifico[2]);
      const indice = vinculosNoServidor.findIndex(
        (vinculo) =>
          vinculo.cartaoId === cartaoId && vinculo.baralhoId === baralhoId,
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
      const baralho = baralhosNoServidor.find((item) => item.id === id);

      if (baralho === undefined) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Baralho não encontrado.",
        });
      }

      const cartoes = cartoesDoBaralho(id);

      return respostaDeTeste(200, {
        id: baralho.id,
        nome: baralho.nome,
        elegivel: cartoes.length > 0,
        cartoes,
      });
    }

    if (cartaoPorId !== null && metodo === "PUT") {
      const id = decodeURIComponent(cartaoPorId[1]);
      const indice = cartoesNoServidor.findIndex((cartao) => cartao.id === id);

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

      const cartao: Cartao = {
        id,
        frente: corpo.frente as string,
        verso: corpo.verso as string,
      };

      cartoesNoServidor[indice] = cartao;

      return respostaDeTeste(200, cartao);
    }

    if (baralhoPorId !== null && metodo === "PUT") {
      const id = decodeURIComponent(baralhoPorId[1]);
      const indice = baralhosNoServidor.findIndex(
        (baralho) => baralho.id === id,
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

      const baralho: Baralho = {
        id,
        nome: corpo.nome as string,
      };

      baralhosNoServidor[indice] = baralho;

      return respostaDeTeste(200, baralho);
    }

    if (cartaoPorId !== null && metodo === "DELETE") {
      const id = decodeURIComponent(cartaoPorId[1]);
      const indice = cartoesNoServidor.findIndex((cartao) => cartao.id === id);

      if (indice === -1) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Cartão não encontrado.",
        });
      }

      cartoesNoServidor.splice(indice, 1);

      for (let i = vinculosNoServidor.length - 1; i >= 0; i -= 1) {
        if (vinculosNoServidor[i].cartaoId === id) {
          vinculosNoServidor.splice(i, 1);
        }
      }

      return respostaDeTeste(204, null);
    }

    if (baralhoPorId !== null && metodo === "DELETE") {
      const id = decodeURIComponent(baralhoPorId[1]);
      const indice = baralhosNoServidor.findIndex(
        (baralho) => baralho.id === id,
      );

      if (indice === -1) {
        return respostaDeTeste(404, {
          erro: "nao_encontrado",
          mensagem: "Baralho não encontrado.",
        });
      }

      baralhosNoServidor.splice(indice, 1);

      for (let i = vinculosNoServidor.length - 1; i >= 0; i -= 1) {
        if (vinculosNoServidor[i].baralhoId === id) {
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
    cliente: new ClienteHttp(ENDERECO_DA_API),
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
