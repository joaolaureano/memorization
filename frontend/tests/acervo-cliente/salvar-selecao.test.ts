import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
  type ClienteDoAcervo,
} from "../../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../../src/acervo-cliente/cliente-em-memoria";
import { ClienteHttp } from "../../src/acervo-cliente/cliente-http";
import { CREDENCIAL_DE_PROVA } from "../apoio-de-prova";

const ENDERECO = "http://api.teste";

function respostaDeTeste(status: number, corpo: unknown) {
  return { status, json: async () => corpo };
}

function clienteHttpCom(resposta: { status: number; json: () => Promise<unknown> }): ClienteDoAcervo {
  vi.stubGlobal("fetch", async () => resposta);
  return new ClienteHttp(ENDERECO);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Estreita para a variante de sucesso do resultado; falha com o corpo recebido caso contrário. */
function exigirSucesso<T extends { ok: boolean }>(
  resultado: T,
): asserts resultado is Extract<T, { ok: true }> {
  if (!resultado.ok) {
    throw new Error(`Esperava sucesso, recebi ${JSON.stringify(resultado)}`);
  }
}

function clienteDeProva(): ClienteEmMemoria {
  return new ClienteEmMemoria(CREDENCIAL_DE_PROVA, [CREDENCIAL_DE_PROVA]);
}

const OUTRA_CREDENCIAL = { nomeDeUsuario: "bruno.souza", senha: CREDENCIAL_DE_PROVA.senha };

describe("ClienteEmMemoria — salvarSelecaoComoBaralho", () => {
  it("cria o Baralho com cópias dos Cartões escolhidos e preserva os Cartões de origem (FR-371, FR-372, 025)", async () => {
    const cliente = clienteDeProva();

    const origem = await cliente.criarBaralho({ nome: "Baralho de origem" });
    exigirSucesso(origem);

    const primeiro = await cliente.criarCartao(origem.baralho.id, { frente: "Frente 1", verso: "Verso 1" });
    exigirSucesso(primeiro);
    const segundo = await cliente.criarCartao(origem.baralho.id, { frente: "Frente 2", verso: "Verso 2" });
    exigirSucesso(segundo);

    const id = crypto.randomUUID();
    const resultado = await cliente.salvarSelecaoComoBaralho({
      id,
      nome: "Seleção",
      cartaoIds: [primeiro.cartao.id, segundo.cartao.id],
    });
    exigirSucesso(resultado);
    expect(resultado.baralho).toMatchObject({ id, nome: "Seleção" });

    const baralhos = await cliente.listarBaralhos();
    exigirSucesso(baralhos);

    const novo = baralhos.baralhos.find((baralho) => baralho.id === id);
    expect(novo?.quantidadeDeCartoes).toBe(2);

    const deOrigem = baralhos.baralhos.find((baralho) => baralho.id === origem.baralho.id);
    expect(deOrigem?.quantidadeDeCartoes).toBe(2);

    const cartoes = await cliente.listarCartoes();
    exigirSucesso(cartoes);

    // Os cartões originais ainda estão no baralho de origem
    const primeiroListado = cartoes.cartoes.find((cartao) => cartao.id === primeiro.cartao.id);
    expect(primeiroListado?.baralho.id).toBe(origem.baralho.id);

    // Devem haver cópias no novo baralho
    const copiasNoNovo = cartoes.cartoes.filter((cartao) => cartao.baralho.id === id);
    expect(copiasNoNovo).toHaveLength(2);
  });

  it("reenviar o mesmo id devolve o mesmo Baralho sem duplicar (FR-373)", async () => {
    const cliente = clienteDeProva();

    const origem = await cliente.criarBaralho({ nome: "Origem" });
    exigirSucesso(origem);

    const cartao = await cliente.criarCartao(origem.baralho.id, { frente: "Frente", verso: "Verso" });
    exigirSucesso(cartao);

    const id = crypto.randomUUID();

    const primeira = await cliente.salvarSelecaoComoBaralho({
      id,
      nome: "Seleção",
      cartaoIds: [cartao.cartao.id],
    });
    exigirSucesso(primeira);

    const antes = await cliente.listarBaralhos();
    exigirSucesso(antes);

    const segunda = await cliente.salvarSelecaoComoBaralho({
      id,
      nome: "Seleção",
      cartaoIds: [cartao.cartao.id],
    });
    exigirSucesso(segunda);

    expect(segunda.baralho).toEqual(primeira.baralho);

    const depois = await cliente.listarBaralhos();
    exigirSucesso(depois);

    expect(depois.baralhos).toHaveLength(antes.baralhos.length);
    expect(depois.baralhos.filter((baralho) => baralho.id === id)).toHaveLength(1);
  });

  it("recusa nome vazio com erro nome_vazio", async () => {
    const cliente = clienteDeProva();

    const origem = await cliente.criarBaralho({ nome: "Origem" });
    exigirSucesso(origem);

    const cartao = await cliente.criarCartao(origem.baralho.id, { frente: "Frente", verso: "Verso" });
    exigirSucesso(cartao);

    const resultado = await cliente.salvarSelecaoComoBaralho({
      id: crypto.randomUUID(),
      nome: "",
      cartaoIds: [cartao.cartao.id],
    });

    expect(resultado).toMatchObject({ ok: false, erro: "nome_vazio" });
  });

  it("recusa Cartão de outro Usuário com cartoes_indisponiveis e não cria Baralho (FR-361, FR-374)", async () => {
    const cliente = new ClienteEmMemoria(CREDENCIAL_DE_PROVA, [
      CREDENCIAL_DE_PROVA,
      OUTRA_CREDENCIAL,
    ]);

    const baralhoDoOutro = await cliente
      .comoUsuario(OUTRA_CREDENCIAL)
      .criarBaralho({ nome: "Baralho do outro" });
    exigirSucesso(baralhoDoOutro);

    const doOutro = await cliente
      .comoUsuario(OUTRA_CREDENCIAL)
      .criarCartao(baralhoDoOutro.baralho.id, { frente: "Frente", verso: "Verso" });
    exigirSucesso(doOutro);

    const antes = await cliente.listarBaralhos();
    exigirSucesso(antes);

    const id = crypto.randomUUID();
    const resultado = await cliente.salvarSelecaoComoBaralho({
      id,
      nome: "Seleção",
      cartaoIds: [doOutro.cartao.id],
    });

    expect(resultado).toMatchObject({
      ok: false,
      erro: "cartoes_indisponiveis",
      cartaoIds: [doOutro.cartao.id],
    });

    const depois = await cliente.listarBaralhos();
    exigirSucesso(depois);

    expect(depois.baralhos).toHaveLength(antes.baralhos.length);
    expect(depois.baralhos.find((baralho) => baralho.id === id)).toBeUndefined();
  });

  it("recusa id de Baralho de outro Usuário com erro conflito", async () => {
    const cliente = new ClienteEmMemoria(CREDENCIAL_DE_PROVA, [
      CREDENCIAL_DE_PROVA,
      OUTRA_CREDENCIAL,
    ]);

    const doOutro = await cliente
      .comoUsuario(OUTRA_CREDENCIAL)
      .criarBaralho({ nome: "Baralho do outro" });
    exigirSucesso(doOutro);

    const meuBaralho = await cliente.criarBaralho({ nome: "Meu baralho" });
    exigirSucesso(meuBaralho);

    const meuCartao = await cliente.criarCartao(meuBaralho.baralho.id, { frente: "Frente", verso: "Verso" });
    exigirSucesso(meuCartao);

    const resultado = await cliente.salvarSelecaoComoBaralho({
      id: doOutro.baralho.id,
      nome: "Seleção",
      cartaoIds: [meuCartao.cartao.id],
    });

    expect(resultado).toMatchObject({ ok: false, erro: "conflito" });
  });

  it("responde indisponivel quando o Adapter está fora do ar", async () => {
    const cliente = clienteDeProva();
    cliente.simularIndisponibilidade();

    const resultado = await cliente.salvarSelecaoComoBaralho({
      id: crypto.randomUUID(),
      nome: "Seleção",
      cartaoIds: [crypto.randomUUID()],
    });

    expect(resultado).toMatchObject({ ok: false, erro: INDISPONIVEL });
  });

  it("registrarSessao temporária devolve baralhoId vazio e o nome Baralho temporário (FR-369)", async () => {
    const cliente = clienteDeProva();

    const baralho = await cliente.criarBaralho({ nome: "Baralho" });
    exigirSucesso(baralho);

    const cartao = await cliente.criarCartao(baralho.baralho.id, { frente: "Frente", verso: "Verso" });
    exigirSucesso(cartao);

    const resultado = await cliente.registrarSessao({
      id: crypto.randomUUID(),
      origem: "temporario",
      baralhoId: "",
      nomeDoBaralho: "",
      itens: [
        {
          frente: "Frente",
          verso: "Verso",
          cartaoId: cartao.cartao.id,
          avaliacao: "bom",
        },
      ],
    });
    exigirSucesso(resultado);

    expect(resultado.registro).toMatchObject({
      origem: "temporario",
      baralhoId: "",
      nomeDoBaralho: "Baralho temporário",
    });
  });
});

describe("ClienteHttp — salvarSelecaoComoBaralho", () => {
  it("mapeia 201 e 200 para o Baralho salvo", async () => {
    const id = crypto.randomUUID();

    for (const status of [201, 200]) {
      const cliente = clienteHttpCom(respostaDeTeste(status, { id, nome: "Seleção" }));

      const resultado = await cliente.salvarSelecaoComoBaralho({
        id,
        nome: "Seleção",
        cartaoIds: [crypto.randomUUID()],
      });

      expect(resultado).toEqual({ ok: true, baralho: { id, nome: "Seleção" } });
    }
  });

  it("repassa o erro nome_vazio devolvido pelo servidor", async () => {
    const cliente = clienteHttpCom(
      respostaDeTeste(400, {
        erro: "nome_vazio",
        mensagem: "O nome do baralho não pode ficar vazio.",
      }),
    );

    const resultado = await cliente.salvarSelecaoComoBaralho({
      id: crypto.randomUUID(),
      nome: "Seleção",
      cartaoIds: [crypto.randomUUID()],
    });

    expect(resultado).toEqual({
      ok: false,
      erro: "nome_vazio",
      mensagem: "O nome do baralho não pode ficar vazio.",
    });
  });

  it("repassa cartoes_indisponiveis com os ids devolvidos pelo servidor", async () => {
    const cliente = clienteHttpCom(
      respostaDeTeste(409, {
        erro: "cartoes_indisponiveis",
        mensagem: "Alguns cartões não estão mais disponíveis.",
        cartaoIds: ["c9"],
      }),
    );

    const resultado = await cliente.salvarSelecaoComoBaralho({
      id: crypto.randomUUID(),
      nome: "Seleção",
      cartaoIds: ["c9"],
    });

    expect(resultado).toEqual({
      ok: false,
      erro: "cartoes_indisponiveis",
      mensagem: "Alguns cartões não estão mais disponíveis.",
      cartaoIds: ["c9"],
    });
  });

  it("repassa o erro conflito devolvido pelo servidor", async () => {
    const cliente = clienteHttpCom(
      respostaDeTeste(409, {
        erro: "conflito",
        mensagem: "Não foi possível salvar o baralho. Tente novamente.",
      }),
    );

    const resultado = await cliente.salvarSelecaoComoBaralho({
      id: crypto.randomUUID(),
      nome: "Seleção",
      cartaoIds: [crypto.randomUUID()],
    });

    expect(resultado).toEqual({
      ok: false,
      erro: "conflito",
      mensagem: "Não foi possível salvar o baralho. Tente novamente.",
    });
  });

  it("traduz respostas fora da forma esperada para indisponivel", async () => {
    const casos = [
      respostaDeTeste(409, { erro: "cartoes_indisponiveis", cartaoIds: "c9" }),
      respostaDeTeste(500, {}),
      respostaDeTeste(201, { id: crypto.randomUUID() }),
    ];

    for (const resposta of casos) {
      const cliente = clienteHttpCom(resposta);

      const resultado = await cliente.salvarSelecaoComoBaralho({
        id: crypto.randomUUID(),
        nome: "Seleção",
        cartaoIds: [crypto.randomUUID()],
      });

      expect(resultado).toEqual({
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_BARALHOS,
      });
    }
  });
});
