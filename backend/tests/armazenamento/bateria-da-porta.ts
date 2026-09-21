import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ArmazenamentoDeUsuarios,
  ArmazenamentoDoAcervo,
  Baralho,
  Cartao,
  ContagemPorBaralho,
} from "../../src/armazenamento/porta.ts";
import { criarDonoDeTeste } from "./usuarios-de-teste.ts";

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
  /**
   * A segunda Porta, sobre o **mesmo** armazenamento. Os cenários precisam
   * dela porque todo Cartão e todo Baralho têm dono: criar o Usuário é criar a
   * linha de `usuario` que a chave estrangeira exige (FR-092).
   */
  usuarios: ArmazenamentoDeUsuarios;
  encerrar(): Promise<void>;
}

/**
 * A fábrica de Adapter. Cada chamada devolve um armazenamento **limpo**, de
 * modo que um cenário nunca enxerga o que o outro gravou — e sem que o cenário
 * saiba onde o armazenamento guarda os dados.
 */
export type FabricaDeArmazenamento = () => Promise<ArmazenamentoAberto>;

/**
 * Os dois donos dos cenários. Todo Cartão e todo Baralho pertencem a um deles,
 * e o segundo existe para que o isolamento entre Usuários seja exercitado pela
 * mesma Interface: o acervo de `DONO_DOIS` não aparece para `DONO_UM`.
 */
const DONO_UM = "dono-um";
const DONO_DOIS = "dono-dois";

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

    /**
     * Cada cenário recebe um armazenamento limpo com os **dois** Usuários já
     * criados: nenhum Cartão ou Baralho existe sem dono, e o cenário nunca
     * precisa saber como o Usuário foi criado.
     */
    beforeEach(async () => {
      aberto = await criarArmazenamento();
      encerrado = false;

      await criarDonoDeTeste(aberto.usuarios, DONO_UM, "ana.silva");
      await criarDonoDeTeste(aberto.usuarios, DONO_DOIS, "bruno.souza");
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

        expect(await armazenamento().inserirCartao(DONO_UM, cartao)).toEqual({
          ok: true,
          valor: { id: "c1", frente: "To walk", verso: "Caminhar" },
        });
      });

      it("começa vazio e lista todos os Cartões guardados", async () => {
        expect(await armazenamento().listarCartoes(DONO_UM)).toEqual([]);

        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c2", "To walk", "Andar"));

        expect(await armazenamento().listarCartoes(DONO_UM)).toEqual(
          expect.arrayContaining([
            { id: "c1", frente: "To walk", verso: "Caminhar" },
            { id: "c2", frente: "To walk", verso: "Andar" },
          ]),
        );
      });

      it("devolve o Cartão de identificador conhecido e recusa o ausente como nao_encontrado", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        expect(await armazenamento().obterCartao(DONO_UM, "c1")).toEqual({
          ok: true,
          valor: { id: "c1", frente: "To walk", verso: "Caminhar" },
        });
        expect(await armazenamento().obterCartao(DONO_UM, "inexistente")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });

      it("atualiza Frente e Verso e recusa a atualização do Cartão ausente", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        expect(
          await armazenamento().atualizarCartao(
            DONO_UM,
            cartaoDe("c1", "To stroll", "Passear"),
          ),
        ).toEqual({
          ok: true,
          valor: { id: "c1", frente: "To stroll", verso: "Passear" },
        });
        expect(await armazenamento().obterCartao(DONO_UM, "c1")).toEqual({
          ok: true,
          valor: { id: "c1", frente: "To stroll", verso: "Passear" },
        });
        expect(
          await armazenamento().atualizarCartao(DONO_UM, cartaoDe("inexistente")),
        ).toEqual({ ok: false, erro: "nao_encontrado" });
      });

      it("exclui o Cartão e recusa a exclusão repetida como nao_encontrado", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        expect(await armazenamento().excluirCartao(DONO_UM, "c1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarCartoes(DONO_UM)).toEqual([]);
        expect(await armazenamento().excluirCartao(DONO_UM, "c1")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });
    });

    describe("Baralho", () => {
      it("guarda um Baralho e o devolve no desfecho de sucesso", async () => {
        expect(await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"))).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês" },
        });
      });

      it("começa vazio e lista todos os Baralhos, inclusive os de nome repetido", async () => {
        expect(await armazenamento().listarBaralhos(DONO_UM)).toEqual([]);

        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1", "Inglês"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b2", "Inglês"));

        expect(await armazenamento().listarBaralhos(DONO_UM)).toEqual(
          expect.arrayContaining([
            { id: "b1", nome: "Inglês" },
            { id: "b2", nome: "Inglês" },
          ]),
        );
      });

      it("devolve o Baralho de identificador conhecido e recusa o ausente como nao_encontrado", async () => {
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));

        expect(await armazenamento().obterBaralho(DONO_UM, "b1")).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês" },
        });
        expect(await armazenamento().obterBaralho(DONO_UM, "inexistente")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });

      it("atualiza o nome e recusa a atualização do Baralho ausente", async () => {
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));

        expect(
          await armazenamento().atualizarBaralho(
            DONO_UM,
            baralhoDe("b1", "Inglês britânico"),
          ),
        ).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês britânico" },
        });
        expect(await armazenamento().obterBaralho(DONO_UM, "b1")).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês britânico" },
        });
        expect(
          await armazenamento().atualizarBaralho(DONO_UM, baralhoDe("inexistente")),
        ).toEqual({ ok: false, erro: "nao_encontrado" });
      });

      it("exclui o Baralho e recusa a exclusão repetida como nao_encontrado", async () => {
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));

        expect(await armazenamento().excluirBaralho(DONO_UM, "b1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarBaralhos(DONO_UM)).toEqual([]);
        expect(await armazenamento().excluirBaralho(DONO_UM, "b1")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });
    });

    describe("Vínculo", () => {
      it("vincula as duas extremidades existentes e as devolve nas duas listagens", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));

        expect(await armazenamento().vincular(DONO_UM, "c1", "b1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarBaralhosDoCartao(DONO_UM, "c1")).toEqual([
          { id: "b1", nome: "Inglês" },
        ]);
        expect(await armazenamento().listarCartoesDoBaralho(DONO_UM, "b1")).toEqual([
          { id: "c1", frente: "To walk", verso: "Caminhar" },
        ]);
      });

      it("devolve lista vazia para Cartão e Baralho sem nenhum Vínculo", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));

        expect(await armazenamento().listarBaralhosDoCartao(DONO_UM, "c1")).toEqual([]);
        expect(await armazenamento().listarCartoesDoBaralho(DONO_UM, "b1")).toEqual([]);
      });

      it("recusa o par repetido como vinculo_duplicado, sem deixar duplicata", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));
        await armazenamento().vincular(DONO_UM, "c1", "b1");

        expect(await armazenamento().vincular(DONO_UM, "c1", "b1")).toEqual({
          ok: false,
          erro: "vinculo_duplicado",
        });
        expect(await armazenamento().listarCartoesDoBaralho(DONO_UM, "b1")).toHaveLength(
          1,
        );
      });

      it("recusa Cartão inexistente como nao_encontrado", async () => {
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));

        expect(await armazenamento().vincular(DONO_UM, "inexistente", "b1")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });

      it("recusa Baralho inexistente como nao_encontrado", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        expect(await armazenamento().vincular(DONO_UM, "c1", "inexistente")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });

      it("desvincula preservando Cartão e Baralho, e recusa o Vínculo inexistente", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));
        await armazenamento().vincular(DONO_UM, "c1", "b1");

        expect(await armazenamento().desvincular(DONO_UM, "c1", "b1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarBaralhosDoCartao(DONO_UM, "c1")).toEqual([]);
        expect(await armazenamento().listarCartoesDoBaralho(DONO_UM, "b1")).toEqual([]);
        expect(await armazenamento().obterCartao(DONO_UM, "c1")).toEqual({
          ok: true,
          valor: { id: "c1", frente: "To walk", verso: "Caminhar" },
        });
        expect(await armazenamento().obterBaralho(DONO_UM, "b1")).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês" },
        });
        expect(await armazenamento().desvincular(DONO_UM, "c1", "b1")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
      });

      it("excluir uma extremidade remove os seus Vínculos e preserva a outra", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c2", "To read", "Ler"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));
        await armazenamento().vincular(DONO_UM, "c1", "b1");
        await armazenamento().vincular(DONO_UM, "c2", "b1");

        expect(await armazenamento().excluirCartao(DONO_UM, "c1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarCartoesDoBaralho(DONO_UM, "b1")).toEqual([
          { id: "c2", frente: "To read", verso: "Ler" },
        ]);
        expect(await armazenamento().obterBaralho(DONO_UM, "b1")).toEqual({
          ok: true,
          valor: { id: "b1", nome: "Inglês" },
        });

        expect(await armazenamento().excluirBaralho(DONO_UM, "b1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().listarBaralhosDoCartao(DONO_UM, "c2")).toEqual([]);
        expect(await armazenamento().obterCartao(DONO_UM, "c2")).toEqual({
          ok: true,
          valor: { id: "c2", frente: "To read", verso: "Ler" },
        });
      });
    });

    describe("contagens — elegibilidade derivada", () => {
      it("conta os Cartões de cada Baralho, lidos dos Vínculos", async () => {
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1", "Vazio"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b2", "Com dois"));

        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c2", "To read", "Ler"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c3", "To run", "Correr"));
        await armazenamento().vincular(DONO_UM, "c1", "b2");
        await armazenamento().vincular(DONO_UM, "c2", "b2");
        await armazenamento().vincular(DONO_UM, "c3", "b1");

        const contagens = await armazenamento().contarCartoesPorBaralho(DONO_UM);

        expect(contagens).toContainEqual({
          baralhoId: "b2",
          quantidadeDeCartoes: 2,
        });
        expect(contagemDe(contagens, "b1")).toBe(1);
      });

      it("devolve zero para o Baralho sem nenhum Cartão vinculado", async () => {
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1", "Vazio"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        const contagens = await armazenamento().contarCartoesPorBaralho(DONO_UM);

        expect(contagemDe(contagens, "b1")).toBe(0);
      });

      it("reduz a contagem quando o Vínculo é desfeito e quando o Cartão é excluído", async () => {
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c2", "To read", "Ler"));
        await armazenamento().vincular(DONO_UM, "c1", "b1");
        await armazenamento().vincular(DONO_UM, "c2", "b1");

        await armazenamento().desvincular(DONO_UM, "c1", "b1");

        expect(
          contagemDe(await armazenamento().contarCartoesPorBaralho(DONO_UM), "b1"),
        ).toBe(1);

        await armazenamento().excluirCartao(DONO_UM, "c2");

        expect(
          contagemDe(await armazenamento().contarCartoesPorBaralho(DONO_UM), "b1"),
        ).toBe(0);
      });
    });

    describe("isolamento entre Usuários — o dono é o escopo", () => {
      it("cada dono lista e lê somente o próprio acervo", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirCartao(
          DONO_DOIS,
          cartaoDe("c2", "To read", "Ler"),
        );
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));
        await armazenamento().inserirBaralho(
          DONO_DOIS,
          baralhoDe("b2", "Espanhol"),
        );

        expect(await armazenamento().listarCartoes(DONO_UM)).toEqual([
          { id: "c1", frente: "To walk", verso: "Caminhar" },
        ]);
        expect(await armazenamento().listarCartoes(DONO_DOIS)).toEqual([
          { id: "c2", frente: "To read", verso: "Ler" },
        ]);
        expect(await armazenamento().listarBaralhos(DONO_UM)).toEqual([
          { id: "b1", nome: "Inglês" },
        ]);
        expect(await armazenamento().listarBaralhos(DONO_DOIS)).toEqual([
          { id: "b2", nome: "Espanhol" },
        ]);
      });

      it("o conteúdo do outro Usuário é indistinguível de inexistente, também nas escritas", async () => {
        await armazenamento().inserirCartao(
          DONO_DOIS,
          cartaoDe("c2", "To read", "Ler"),
        );
        await armazenamento().inserirBaralho(
          DONO_DOIS,
          baralhoDe("b2", "Espanhol"),
        );

        expect(await armazenamento().obterCartao(DONO_UM, "c2")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
        expect(await armazenamento().obterBaralho(DONO_UM, "b2")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
        expect(
          await armazenamento().atualizarCartao(
            DONO_UM,
            cartaoDe("c2", "To drink", "Beber"),
          ),
        ).toEqual({ ok: false, erro: "nao_encontrado" });
        expect(
          await armazenamento().atualizarBaralho(
            DONO_UM,
            baralhoDe("b2", "Francês"),
          ),
        ).toEqual({ ok: false, erro: "nao_encontrado" });
        expect(await armazenamento().excluirCartao(DONO_UM, "c2")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
        expect(await armazenamento().excluirBaralho(DONO_UM, "b2")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });

        /** Nada do outro Usuário mudou com as tentativas. */
        expect(await armazenamento().obterCartao(DONO_DOIS, "c2")).toEqual({
          ok: true,
          valor: { id: "c2", frente: "To read", verso: "Ler" },
        });
        expect(await armazenamento().obterBaralho(DONO_DOIS, "b2")).toEqual({
          ok: true,
          valor: { id: "b2", nome: "Espanhol" },
        });
      });

      it("vincular exige as duas extremidades no mesmo dono, e recusa como nao_encontrado", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));
        await armazenamento().inserirCartao(
          DONO_DOIS,
          cartaoDe("c2", "To read", "Ler"),
        );
        await armazenamento().inserirBaralho(
          DONO_DOIS,
          baralhoDe("b2", "Espanhol"),
        );

        /** Cartão de um Usuário com Baralho de outro: recusa, e nada muda. */
        expect(await armazenamento().vincular(DONO_UM, "c1", "b2")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
        expect(await armazenamento().vincular(DONO_DOIS, "c1", "b2")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
        expect(await armazenamento().listarBaralhosDoCartao(DONO_UM, "c1")).toEqual(
          [],
        );
        expect(await armazenamento().listarCartoesDoBaralho(DONO_UM, "b1")).toEqual(
          [],
        );

        /** O mesmo dono continua podendo vincular as suas duas extremidades. */
        expect(await armazenamento().vincular(DONO_UM, "c1", "b1")).toEqual({
          ok: true,
          valor: undefined,
        });
        expect(await armazenamento().vincular(DONO_DOIS, "c2", "b2")).toEqual({
          ok: true,
          valor: undefined,
        });
      });

      it("as listagens de Vínculo e as contagens são as do dono, nunca as do outro", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));
        await armazenamento().inserirCartao(
          DONO_DOIS,
          cartaoDe("c2", "To read", "Ler"),
        );
        await armazenamento().inserirBaralho(
          DONO_DOIS,
          baralhoDe("b2", "Espanhol"),
        );
        await armazenamento().vincular(DONO_UM, "c1", "b1");
        await armazenamento().vincular(DONO_DOIS, "c2", "b2");

        expect(await armazenamento().listarBaralhosDoCartao(DONO_UM, "c1")).toEqual(
          [{ id: "b1", nome: "Inglês" }],
        );
        expect(await armazenamento().listarCartoesDoBaralho(DONO_UM, "b1")).toEqual(
          [{ id: "c1", frente: "To walk", verso: "Caminhar" }],
        );

        /** O `id` do outro Usuário não devolve Vínculo algum. */
        expect(await armazenamento().listarBaralhosDoCartao(DONO_UM, "c2")).toEqual(
          [],
        );
        expect(await armazenamento().listarCartoesDoBaralho(DONO_UM, "b2")).toEqual(
          [],
        );

        const contagens = await armazenamento().contarCartoesPorBaralho(DONO_UM);

        expect(contagens).toContainEqual({
          baralhoId: "b1",
          quantidadeDeCartoes: 1,
        });
        expect(contagemDe(contagens, "b2")).toBe(0);
        expect(
          contagemDe(await armazenamento().contarCartoesPorBaralho(DONO_DOIS), "b2"),
        ).toBe(1);
      });

      it("desvincular não alcança o Vínculo de outro Usuário", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));
        await armazenamento().inserirCartao(
          DONO_DOIS,
          cartaoDe("c2", "To read", "Ler"),
        );
        await armazenamento().inserirBaralho(
          DONO_DOIS,
          baralhoDe("b2", "Espanhol"),
        );
        await armazenamento().vincular(DONO_DOIS, "c2", "b2");

        expect(await armazenamento().desvincular(DONO_UM, "c2", "b2")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
        expect(await armazenamento().listarBaralhosDoCartao(DONO_DOIS, "c2")).toEqual(
          [{ id: "b2", nome: "Espanhol" }],
        );
      });

      it("excluir uma extremidade de outro Usuário não a alcança", async () => {
        await armazenamento().inserirCartao(
          DONO_DOIS,
          cartaoDe("c2", "To read", "Ler"),
        );

        expect(await armazenamento().excluirCartao(DONO_UM, "c2")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
        expect(await armazenamento().obterCartao(DONO_DOIS, "c2")).toEqual({
          ok: true,
          valor: { id: "c2", frente: "To read", verso: "Ler" },
        });
      });
    });

    describe("falha do armazenamento — desfecho indisponivel", () => {
      it("reporta indisponivel depois de o armazenamento ser encerrado, sem nada passar por concluído", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));

        await aberto.encerrar();
        encerrado = true;

        expect(await armazenamento().inserirCartao(DONO_UM, cartaoDe("c2"))).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().obterCartao(DONO_UM, "c1")).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(
          await armazenamento().atualizarCartao(DONO_UM, cartaoDe("c1", "To run")),
        ).toEqual({ ok: false, erro: "indisponivel" });
        expect(await armazenamento().excluirCartao(DONO_UM, "c1")).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b2"))).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().atualizarBaralho(DONO_UM, baralhoDe("b1"))).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().excluirBaralho(DONO_UM, "b1")).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().vincular(DONO_UM, "c1", "b1")).toEqual({
          ok: false,
          erro: "indisponivel",
        });
        expect(await armazenamento().desvincular(DONO_UM, "c1", "b1")).toEqual({
          ok: false,
          erro: "indisponivel",
        });
      });

      it("carrega apenas o código estável no desfecho de indisponibilidade, sem detalhe algum do driver", async () => {
        await aberto.encerrar();
        encerrado = true;

        const recusa = await armazenamento().obterCartao(DONO_UM, "c1");

        expect(recusa).toEqual({ ok: false, erro: "indisponivel" });
        expect(Object.keys(recusa).sort()).toEqual(["erro", "ok"]);
      });
    });
  });
}
