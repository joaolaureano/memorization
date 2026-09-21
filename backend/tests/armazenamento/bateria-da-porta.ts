import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ArmazenamentoDoAcervo,
  Baralho,
  Cartao,
  ContagemPorBaralho,
} from "../../src/armazenamento/porta.ts";

/**
 * Bateria compartilhada da Porta `ArmazenamentoDoAcervo` (FR-106, SC-039).
 *
 * É a **única** prova exigida da Porta: os cenários são da Interface, e não de
 * um armazenamento. Nenhum deles nomeia dialeto, arquivo, tabela ou driver —
 * se nomeassem, a bateria deixaria de ser da Porta e passaria a ser da
 * Implementation. Todo Adapter pronto a exercita chamando `bateriaDaPorta` com
 * a sua fábrica; acrescentar um Adapter é acrescentar uma chamada, sem editar
 * um cenário e sem editar Module algum (SC-043).
 */

/**
 * O armazenamento aberto que a bateria recebe. O ciclo de vida é da fábrica do
 * Adapter, e não da Porta: a Interface que os Modules conhecem não abre nem
 * fecha armazenamento.
 */
export interface ArmazenamentoAberto {
  armazenamento: ArmazenamentoDoAcervo;
  encerrar(): Promise<void>;
}

/**
 * A fábrica de Adapter. Cada chamada devolve um armazenamento **limpo**, de
 * modo que um cenário nunca enxerga o que o outro gravou — e sem que o cenário
 * saiba onde o armazenamento guarda os dados.
 */
export type FabricaDeArmazenamento = () => Promise<ArmazenamentoAberto>;

/** Cartão com identificador fixo, para que o cenário possa citá-lo. */
function cartaoDe(id: string, frente = "To walk", verso = "Caminhar"): Cartao {
  return { id, frente, verso };
}

/** Baralho com identificador fixo, para que o cenário possa citá-lo. */
function baralhoDe(id: string, nome = "Inglês"): Baralho {
  return { id, nome };
}

/**
 * Quantidade de Cartões do Baralho informado. Um Adapter pode ou não devolver
 * entrada para Baralho sem Cartão — a contagem que importa é a do Baralho, e
 * ela é zero quando não há entrada.
 */
function contagemDe(
  contagens: ContagemPorBaralho[],
  baralhoId: string,
): number {
  return (
    contagens.find((contagem) => contagem.baralhoId === baralhoId)
      ?.quantidadeDeCartoes ?? 0
  );
}

/**
 * Registra na suíte corrente os cenários da Porta contra a fábrica de Adapter
 * recebida, sob o rótulo informado.
 */
export function bateriaDaPorta(
  criarArmazenamento: FabricaDeArmazenamento,
  rotulo: string,
): void {
  describe(`ArmazenamentoDoAcervo — ${rotulo}`, () => {
    let aberto: ArmazenamentoAberto;
    let encerrado: boolean;

    beforeEach(async () => {
      aberto = await criarArmazenamento();
      encerrado = false;
    });

    afterEach(async () => {
      if (!encerrado) {
        await aberto.encerrar();
      }
    });

    function armazenamento(): ArmazenamentoDoAcervo {
      return aberto.armazenamento;
    }

    describe("Cartão", () => {
      it("guarda um Cartão e o devolve no desfecho de sucesso", async () => {
        const cartao = cartaoDe("c1");

        expect(await armazenamento().inserirCartao(cartao)).toEqual({
          ok: true,
          valor: { id: "c1", frente: "To walk", verso: "Caminhar" },
        });
      });

      it("começa vazio e lista todos os Cartões guardados", async () => {
        expect(await armazenamento().listarCartoes()).toEqual([]);

        await armazenamento().inserirCartao(cartaoDe("c1"));
        await armazenamento().inserirCartao(cartaoDe("c2", "To walk", "Andar"));

        expect(await armazenamento().listarCartoes()).toEqual(
          expect.arrayContaining([
            { id: "c1", frente: "To walk", verso: "Caminhar" },
            { id: "c2", frente: "To walk", verso: "Andar" },
          ]),
        );
      });

      it("devolve o Cartão de identificador conhecido e recusa o ausente como nao_encontrado", async () => {
        await armazenamento().inserirCartao(cartaoDe("c1"));

        expect(await armazenamento().obterCartao("c1")).toEqual({
          ok: true,
          valor: { id: "c1", frente: "To walk", verso: "Caminhar" },
        });
        expect(await armazenamento().obterCartao("inexistente")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });

      it("atualiza Frente e Verso e recusa a atualização do Cartão ausente", async () => {
        await armazenamento().inserirCartao(cartaoDe("c1"));

        expect(
          await armazenamento().atualizarCartao(
            cartaoDe("c1", "To stroll", "Passear"),
          ),
        ).toEqual({
          ok: true,
          valor: { id: "c1", frente: "To stroll", verso: "Passear" },
        });
        expect(await armazenamento().obterCartao("c1")).toEqual({
          ok: true,
          valor: { id: "c1", frente: "To stroll", verso: "Passear" },
        });
        expect(
          await armazenamento().atualizarCartao(cartaoDe("inexistente")),
        ).toEqual({ ok: false, erro: "nao_encontrado" });
      });

      it("exclui o Cartão e recusa a exclusão repetida como nao_encontrado", async () => {
        await armazenamento().inserirCartao(cartaoDe("c1"));

        expect(await armazenamento().excluirCartao("c1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarCartoes()).toEqual([]);
        expect(await armazenamento().excluirCartao("c1")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });
    });

    describe("Baralho", () => {
      it("guarda um Baralho e o devolve no desfecho de sucesso", async () => {
        expect(await armazenamento().inserirBaralho(baralhoDe("b1"))).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês" },
        });
      });

      it("começa vazio e lista todos os Baralhos, inclusive os de nome repetido", async () => {
        expect(await armazenamento().listarBaralhos()).toEqual([]);

        await armazenamento().inserirBaralho(baralhoDe("b1", "Inglês"));
        await armazenamento().inserirBaralho(baralhoDe("b2", "Inglês"));

        expect(await armazenamento().listarBaralhos()).toEqual(
          expect.arrayContaining([
            { id: "b1", nome: "Inglês" },
            { id: "b2", nome: "Inglês" },
          ]),
        );
      });

      it("devolve o Baralho de identificador conhecido e recusa o ausente como nao_encontrado", async () => {
        await armazenamento().inserirBaralho(baralhoDe("b1"));

        expect(await armazenamento().obterBaralho("b1")).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês" },
        });
        expect(await armazenamento().obterBaralho("inexistente")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });

      it("atualiza o nome e recusa a atualização do Baralho ausente", async () => {
        await armazenamento().inserirBaralho(baralhoDe("b1"));

        expect(
          await armazenamento().atualizarBaralho(
            baralhoDe("b1", "Inglês britânico"),
          ),
        ).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês britânico" },
        });
        expect(await armazenamento().obterBaralho("b1")).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês britânico" },
        });
        expect(
          await armazenamento().atualizarBaralho(baralhoDe("inexistente")),
        ).toEqual({ ok: false, erro: "nao_encontrado" });
      });

      it("exclui o Baralho e recusa a exclusão repetida como nao_encontrado", async () => {
        await armazenamento().inserirBaralho(baralhoDe("b1"));

        expect(await armazenamento().excluirBaralho("b1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarBaralhos()).toEqual([]);
        expect(await armazenamento().excluirBaralho("b1")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });
    });

    describe("Vínculo", () => {
      it("vincula as duas extremidades existentes e as devolve nas duas listagens", async () => {
        await armazenamento().inserirCartao(cartaoDe("c1"));
        await armazenamento().inserirBaralho(baralhoDe("b1"));

        expect(await armazenamento().vincular("c1", "b1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarBaralhosDoCartao("c1")).toEqual([
          { id: "b1", nome: "Inglês" },
        ]);
        expect(await armazenamento().listarCartoesDoBaralho("b1")).toEqual([
          { id: "c1", frente: "To walk", verso: "Caminhar" },
        ]);
      });

      it("devolve lista vazia para Cartão e Baralho sem nenhum Vínculo", async () => {
        await armazenamento().inserirCartao(cartaoDe("c1"));
        await armazenamento().inserirBaralho(baralhoDe("b1"));

        expect(await armazenamento().listarBaralhosDoCartao("c1")).toEqual([]);
        expect(await armazenamento().listarCartoesDoBaralho("b1")).toEqual([]);
      });

      it("recusa o par repetido como vinculo_duplicado, sem deixar duplicata", async () => {
        await armazenamento().inserirCartao(cartaoDe("c1"));
        await armazenamento().inserirBaralho(baralhoDe("b1"));
        await armazenamento().vincular("c1", "b1");

        expect(await armazenamento().vincular("c1", "b1")).toEqual({
          ok: false,
          erro: "vinculo_duplicado",
        });
        expect(await armazenamento().listarCartoesDoBaralho("b1")).toHaveLength(
          1,
        );
      });

      it("recusa Cartão inexistente como nao_encontrado", async () => {
        await armazenamento().inserirBaralho(baralhoDe("b1"));

        expect(await armazenamento().vincular("inexistente", "b1")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });

      it("recusa Baralho inexistente como nao_encontrado", async () => {
        await armazenamento().inserirCartao(cartaoDe("c1"));

        expect(await armazenamento().vincular("c1", "inexistente")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });

      it("desvincula preservando Cartão e Baralho, e recusa o Vínculo inexistente", async () => {
        await armazenamento().inserirCartao(cartaoDe("c1"));
        await armazenamento().inserirBaralho(baralhoDe("b1"));
        await armazenamento().vincular("c1", "b1");

        expect(await armazenamento().desvincular("c1", "b1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarBaralhosDoCartao("c1")).toEqual([]);
        expect(await armazenamento().listarCartoesDoBaralho("b1")).toEqual([]);
        expect(await armazenamento().obterCartao("c1")).toEqual({
          ok: true,
          valor: { id: "c1", frente: "To walk", verso: "Caminhar" },
        });
        expect(await armazenamento().obterBaralho("b1")).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês" },
        });
        expect(await armazenamento().desvincular("c1", "b1")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });

      it("excluir uma extremidade remove os seus Vínculos e preserva a outra", async () => {
        await armazenamento().inserirCartao(cartaoDe("c1"));
        await armazenamento().inserirCartao(cartaoDe("c2", "To read", "Ler"));
        await armazenamento().inserirBaralho(baralhoDe("b1"));
        await armazenamento().vincular("c1", "b1");
        await armazenamento().vincular("c2", "b1");

        expect(await armazenamento().excluirCartao("c1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarCartoesDoBaralho("b1")).toEqual([
          { id: "c2", frente: "To read", verso: "Ler" },
        ]);
        expect(await armazenamento().obterBaralho("b1")).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês" },
        });

        expect(await armazenamento().excluirBaralho("b1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarBaralhosDoCartao("c2")).toEqual([]);
        expect(await armazenamento().obterCartao("c2")).toEqual({
          ok: true,
          valor: { id: "c2", frente: "To read", verso: "Ler" },
        });
      });
    });

    describe("contagens — elegibilidade derivada", () => {
      it("conta os Cartões de cada Baralho, lidos dos Vínculos", async () => {
        await armazenamento().inserirBaralho(baralhoDe("b1", "Vazio"));
        await armazenamento().inserirBaralho(baralhoDe("b2", "Com dois"));

        await armazenamento().inserirCartao(cartaoDe("c1"));
        await armazenamento().inserirCartao(cartaoDe("c2", "To read", "Ler"));
        await armazenamento().inserirCartao(cartaoDe("c3", "To run", "Correr"));
        await armazenamento().vincular("c1", "b2");
        await armazenamento().vincular("c2", "b2");
        await armazenamento().vincular("c3", "b1");

        const contagens = await armazenamento().contarCartoesPorBaralho();

        expect(contagens).toContainEqual({
          baralhoId: "b2",
          quantidadeDeCartoes: 2,
        });
        expect(contagemDe(contagens, "b1")).toBe(1);
      });

      it("devolve zero para o Baralho sem nenhum Cartão vinculado", async () => {
        await armazenamento().inserirBaralho(baralhoDe("b1", "Vazio"));
        await armazenamento().inserirCartao(cartaoDe("c1"));

        const contagens = await armazenamento().contarCartoesPorBaralho();

        expect(contagemDe(contagens, "b1")).toBe(0);
      });

      it("reduz a contagem quando o Vínculo é desfeito e quando o Cartão é excluído", async () => {
        await armazenamento().inserirBaralho(baralhoDe("b1"));
        await armazenamento().inserirCartao(cartaoDe("c1"));
        await armazenamento().inserirCartao(cartaoDe("c2", "To read", "Ler"));
        await armazenamento().vincular("c1", "b1");
        await armazenamento().vincular("c2", "b1");

        await armazenamento().desvincular("c1", "b1");

        expect(
          contagemDe(await armazenamento().contarCartoesPorBaralho(), "b1"),
        ).toBe(1);

        await armazenamento().excluirCartao("c2");

        expect(
          contagemDe(await armazenamento().contarCartoesPorBaralho(), "b1"),
        ).toBe(0);
      });
    });

    describe("falha do armazenamento — desfecho indisponivel", () => {
      it("reporta indisponivel depois de o armazenamento ser encerrado, sem nada passar por concluído", async () => {
        await armazenamento().inserirCartao(cartaoDe("c1"));
        await armazenamento().inserirBaralho(baralhoDe("b1"));

        await aberto.encerrar();
        encerrado = true;

        expect(await armazenamento().inserirCartao(cartaoDe("c2"))).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().obterCartao("c1")).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(
          await armazenamento().atualizarCartao(cartaoDe("c1", "To run")),
        ).toEqual({ ok: false, erro: "indisponivel" });
        expect(await armazenamento().excluirCartao("c1")).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().inserirBaralho(baralhoDe("b2"))).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().atualizarBaralho(baralhoDe("b1"))).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().excluirBaralho("b1")).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().vincular("c1", "b1")).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().desvincular("c1", "b1")).toEqual({
          ok: false,
          erro: "indisponivel",
        });
      });

      it("carrega apenas o código estável no desfecho de indisponibilidade, sem detalhe algum do driver", async () => {
        await aberto.encerrar();
        encerrado = true;

        const recusa = await armazenamento().obterCartao("c1");

        expect(recusa).toEqual({ ok: false, erro: "indisponivel" });
        expect(Object.keys(recusa).sort()).toEqual(["erro", "ok"]);
      });
    });
  });
}
