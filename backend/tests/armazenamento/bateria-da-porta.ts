import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  Agendamento,
  ArmazenamentoDeUsuarios,
  ArmazenamentoDoAcervo,
  Avaliacao,
  Baralho,
  Cartao,
  ContagemPorBaralho,
  ItemRegistrado,
  RegistroDeSessao,
  RegistroResumido,
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
 * Registro de sessão concluída com identificador fixo, para que o cenário possa
 * citá-lo. `concluidaEm` é controlado pelo cenário porque é ele que ordena o
 * Histórico, do mais recente ao mais antigo (FR-169); os instantes são ISO-8601
 * UTC com milissegundos `.000`, a forma que os dois Adapters devolvem sem
 * alteração. `estudados`, `acertos` e `erros` são derivados dos Itens, como o
 * Module os deriva antes de gravar (FR-161).
 */
function registroDe(
  id: string,
  concluidaEm = "2026-01-01T00:00:00.000Z",
  itens: readonly ItemRegistrado[] = [
    /**
     * Item anterior à 015: sem Cartão de origem e sem Avaliação, como o
     * Adapter o devolve ao reler o Registro (FR-196, FR-197).
     */
    {
      posicao: 0,
      frente: "To walk",
      verso: "Caminhar",
      resultado: "acertou",
      cartaoId: null,
      avaliacao: null,
    },
  ],
): RegistroDeSessao {
  const acertos = itens.filter((item) => item.resultado === "acertou").length;

  return {
    id,
    origem: "baralho",
    baralhoId: "b1",
    nomeDoBaralho: "Inglês",
    concluidaEm,
    estudados: itens.length,
    acertos,
    erros: itens.length - acertos,
    itens,
  };
}

/**
 * O Registro como as listagens o devolvem: sem os Itens, porque Início só
 * precisa dos totais e do instante, e o Histórico grande continua respondendo
 * (FR-169, SC-077).
 */
function semItens(registro: RegistroDeSessao): RegistroResumido {
  return {
    id: registro.id,
    baralhoId: registro.baralhoId,
    nomeDoBaralho: registro.nomeDoBaralho,
    origem: registro.origem,
    concluidaEm: registro.concluidaEm,
    estudados: registro.estudados,
    acertos: registro.acertos,
    erros: registro.erros,
  };
}

/**
 * Item registrado com Cartão de origem e Avaliação em quatro níveis (FR-196).
 * O `resultado` exibido é derivado da Avaliação, como o Module o deriva antes
 * de gravar: `errei` é erro, e `dificil`/`bom`/`facil` são acerto (FR-194,
 * FR-195).
 */
function itemAvaliadoDe(
  posicao: number,
  cartaoId: string,
  avaliacao: Avaliacao = "bom",
): ItemRegistrado {
  return {
    posicao,
    frente: "To walk",
    verso: "Caminhar",
    resultado: avaliacao === "errei" ? "errou" : "acertou",
    cartaoId,
    avaliacao,
  };
}

/**
 * Agendamento de um Cartão, com o estado opaco do SM-2. O cenário só compara o
 * `estado` consigo mesmo: a Porta o guarda como JSON e o devolve como objeto,
 * sem o interpretar (FR-188). Os instantes são ISO-8601 UTC com milissegundos
 * `.000`, a forma que os dois Adapters devolvem sem alteração.
 */
function agendamentoDe(
  cartaoId: string,
  proximaRevisaoEm = "2026-02-01T00:00:00.000Z",
  estado: unknown = { repeticoes: 1, facilidade: 2.5, intervaloEmDias: 1 },
): Agendamento {
  return {
    cartaoId,
    algoritmo: "sm2",
    versaoDoAlgoritmo: 1,
    estado,
    proximaRevisaoEm,
    ultimaAvaliacao: "bom",
    revisadoEm: "2026-01-02T00:00:00.000Z",
    criadoEm: "2026-01-01T00:00:00.000Z",
  };
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

    /**
     * Histórico de Sessões concluídas (FR-161..FR-179): os quatro métodos que o
     * Início e o Resumo exercitam, provados na Interface e não em dialeto
     * algum.
     *
     * O que estes cenários fixam: o Registro volta inteiro, com os Itens na
     * ordem apresentada; reenviar o mesmo `id` do mesmo Usuário devolve o
     * registro já guardado, sem duplicar e mantendo a primeira `concluidaEm`
     * (FR-163); o mesmo `id` de outro Usuário é `conflito`, porque Históricos
     * não se misturam (FR-166); as listagens são do dono, do mais recente ao
     * mais antigo e sem os Itens (FR-169, SC-077); e o Baralho e os Cartões de
     * origem podem ser excluídos sem que o Registro se perca (FR-165, FR-178).
     *
     * A cascata da exclusão do Usuário não é exercitada aqui porque a Porta não
     * expõe exclusão de Usuário: ela é do esquema e fica provada pelas
     * migrações.
     */
    describe("Histórico de Sessão", () => {
      it("guarda o Registro com os Itens na ordem apresentada e o devolve inteiro", async () => {
        const registro = registroDe("r1", "2026-01-02T12:00:00.000Z", [
          {
            posicao: 0,
            frente: "To walk",
            verso: "Caminhar",
            resultado: "acertou",
            cartaoId: null,
            avaliacao: null,
          },
          {
            posicao: 1,
            frente: "To read",
            verso: "Ler",
            resultado: "errou",
            cartaoId: null,
            avaliacao: null,
          },
          {
            posicao: 2,
            frente: "To run",
            verso: "Correr",
            resultado: "acertou",
            cartaoId: null,
            avaliacao: null,
          },
        ]);

        expect(
          await armazenamento().inserirRegistroDeSessao(DONO_UM, registro),
        ).toEqual({ ok: true, valor: registro });

        /** `toEqual` compara os Itens na ordem: a posição é a apresentada. */
        expect(await armazenamento().obterRegistroDeSessao(DONO_UM, "r1")).toEqual({
          ok: true,
          valor: registro,
        });
      });

      it("reinserir o mesmo id do mesmo Usuário devolve o registro guardado, sem duplicar e com a primeira concluidaEm", async () => {
        const primeiro = registroDe("r1", "2026-01-02T12:00:00.000Z");

        await armazenamento().inserirRegistroDeSessao(DONO_UM, primeiro);

        const reenvio = registroDe("r1", "2026-03-04T09:30:00.000Z", [
          { posicao: 0, frente: "To read", verso: "Ler", resultado: "errou" },
        ]);

        expect(
          await armazenamento().inserirRegistroDeSessao(DONO_UM, reenvio),
        ).toEqual({ ok: true, valor: primeiro });

        /** O reenvio não duplica: a listagem traz exatamente o registro. */
        expect(await armazenamento().listarRegistrosRecentes(DONO_UM, 10)).toEqual([
          semItens(primeiro),
        ]);
      });

      it("recusa como conflito o mesmo id vindo de outro Usuário", async () => {
        await armazenamento().inserirRegistroDeSessao(DONO_UM, registroDe("r1"));

        expect(
          await armazenamento().inserirRegistroDeSessao(DONO_DOIS, registroDe("r1")),
        ).toEqual({ ok: false, erro: "conflito" });

        /** O Histórico do outro Usuário continua vazio (FR-166). */
        expect(
          await armazenamento().listarRegistrosRecentes(DONO_DOIS, 10),
        ).toEqual([]);
      });

      it("lista o Histórico do dono, do mais recente ao mais antigo e sem os Itens", async () => {
        await armazenamento().inserirRegistroDeSessao(
          DONO_UM,
          registroDe("r1", "2026-01-01T00:00:00.000Z"),
        );
        await armazenamento().inserirRegistroDeSessao(
          DONO_UM,
          registroDe("r2", "2026-01-03T00:00:00.000Z"),
        );
        await armazenamento().inserirRegistroDeSessao(
          DONO_UM,
          registroDe("r3", "2026-01-02T00:00:00.000Z"),
        );
        await armazenamento().inserirRegistroDeSessao(
          DONO_DOIS,
          registroDe("r4", "2026-01-04T00:00:00.000Z"),
        );

        const doDono = await armazenamento().listarRegistrosRecentes(DONO_UM, 10);

        expect(doDono.map((registro) => registro.id)).toEqual(["r2", "r3", "r1"]);

        /** A linha de listagem não carrega os Itens (SC-077). */
        expect(doDono).toEqual([
          semItens(registroDe("r2", "2026-01-03T00:00:00.000Z")),
          semItens(registroDe("r3", "2026-01-02T00:00:00.000Z")),
          semItens(registroDe("r1", "2026-01-01T00:00:00.000Z")),
        ]);

        /** O Histórico de outro dono não aparece. */
        expect(
          (await armazenamento().listarRegistrosRecentes(DONO_DOIS, 10)).map(
            (registro) => registro.id,
          ),
        ).toEqual(["r4"]);
      });

      it("filtra por desde, incluindo o instante de fronteira", async () => {
        await armazenamento().inserirRegistroDeSessao(
          DONO_UM,
          registroDe("r1", "2026-01-01T00:00:00.000Z"),
        );
        await armazenamento().inserirRegistroDeSessao(
          DONO_UM,
          registroDe("r2", "2026-01-02T00:00:00.000Z"),
        );
        await armazenamento().inserirRegistroDeSessao(
          DONO_UM,
          registroDe("r3", "2026-01-03T00:00:00.000Z"),
        );

        const naJanela = await armazenamento().listarRegistrosDesde(
          DONO_UM,
          "2026-01-02T00:00:00.000Z",
        );

        /** `r2` é o limite e entra; `r1` fica de fora. */
        expect(naJanela.map((registro) => registro.id)).toEqual(["r3", "r2"]);

        const vazia = await armazenamento().listarRegistrosDesde(
          DONO_UM,
          "2026-02-01T00:00:00.000Z",
        );

        expect(vazia).toEqual([]);
      });

      it("devolve no máximo o limite de Sessões recentes informado", async () => {
        await armazenamento().inserirRegistroDeSessao(
          DONO_UM,
          registroDe("r1", "2026-01-01T00:00:00.000Z"),
        );
        await armazenamento().inserirRegistroDeSessao(
          DONO_UM,
          registroDe("r2", "2026-01-02T00:00:00.000Z"),
        );
        await armazenamento().inserirRegistroDeSessao(
          DONO_UM,
          registroDe("r3", "2026-01-03T00:00:00.000Z"),
        );

        expect(
          (await armazenamento().listarRegistrosRecentes(DONO_UM, 2)).map(
            (registro) => registro.id,
          ),
        ).toEqual(["r3", "r2"]);
      });

      it("recusa o Registro de outro Usuário e o inexistente como nao_encontrado", async () => {
        await armazenamento().inserirRegistroDeSessao(DONO_DOIS, registroDe("r1"));

        expect(await armazenamento().obterRegistroDeSessao(DONO_UM, "r1")).toEqual({
          ok: false,
          erro: "nao_encontrado",
        });
        expect(
          await armazenamento().obterRegistroDeSessao(DONO_UM, "inexistente"),
        ).toEqual({ ok: false, erro: "nao_encontrado" });
      });

      it("preserva o Registro quando o Baralho e os Cartões de origem são excluídos", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirBaralho(DONO_UM, baralhoDe("b1"));
        await armazenamento().vincular(DONO_UM, "c1", "b1");

        const registro = registroDe("r1", "2026-01-02T00:00:00.000Z");

        await armazenamento().inserirRegistroDeSessao(DONO_UM, registro);
        await armazenamento().excluirCartao(DONO_UM, "c1");
        await armazenamento().excluirBaralho(DONO_UM, "b1");

        expect(await armazenamento().obterRegistroDeSessao(DONO_UM, "r1")).toEqual({
          ok: true,
          valor: registro,
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

    /**
     * Repetição espaçada (FR-207..FR-210, FR-213): a Porta que o Module puro
     * exercita para ler Preferências, gravar Agendamentos na mesma transação do
     * Registro, trocar o conjunto inteiro na troca de algoritmo e reenviar o
     * Histórico para o replay. Nenhum cenário nomeia dialeto, tabela ou driver:
     * a prova é da Interface, e os dois Adapters a exercitam sem edição
     * (FR-207, SC-086).
     */
    describe("Repetição espaçada (015)", () => {
      it("lista os Cartões em ordem de criação, o insumo dos Cartões novos (FR-201)", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c2", "To read", "Ler"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c3", "To run", "Correr"));

        expect(await armazenamento().listarCartoes(DONO_UM)).toEqual([
          { id: "c1", frente: "To walk", verso: "Caminhar" },
          { id: "c2", frente: "To read", verso: "Ler" },
          { id: "c3", frente: "To run", verso: "Correr" },
        ]);
      });

      it("devolve os padrões quando não há linha de Preferências (D5, FR-212)", async () => {
        expect(await armazenamento().obterPreferencias(DONO_UM)).toEqual({
          algoritmo: "sm2",
          limiteDeNovosPorDia: 20,
        });
      });

      it("salva as Preferências e as devolve na releitura (FR-212)", async () => {
        const preferencias = { algoritmo: "sm2", limiteDeNovosPorDia: 30 };

        expect(
          await armazenamento().salvarPreferencias(DONO_UM, preferencias),
        ).toEqual({ ok: true, valor: preferencias });
        expect(await armazenamento().obterPreferencias(DONO_UM)).toEqual(
          preferencias,
        );
      });

      it("as Preferências de um Usuário não alcançam o outro (FR-219)", async () => {
        await armazenamento().salvarPreferencias(DONO_UM, {
          algoritmo: "sm2",
          limiteDeNovosPorDia: 5,
        });

        expect(await armazenamento().obterPreferencias(DONO_DOIS)).toEqual({
          algoritmo: "sm2",
          limiteDeNovosPorDia: 20,
        });
      });

      it("grava o Registro e os Agendamentos na primeira vez, com os Itens de origem (FR-210, SC-085)", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c2", "To read", "Ler"));

        const registro = registroDe("r1", "2026-01-02T00:00:00.000Z", [
          itemAvaliadoDe(0, "c1", "bom"),
          itemAvaliadoDe(1, "c2", "dificil"),
        ]);

        expect(
          await armazenamento().inserirRegistroEAgendamentos(DONO_UM, registro, [
            agendamentoDe("c1"),
          ]),
        ).toEqual({ ok: true, valor: { registro, novo: true } });

        /** O Registro volta inteiro: a origem e cada Item com Cartão e Avaliação. */
        expect(await armazenamento().obterRegistroDeSessao(DONO_UM, "r1")).toEqual({
          ok: true,
          valor: registro,
        });
        expect(await armazenamento().listarAgendamentos(DONO_UM)).toEqual([
          agendamentoDe("c1"),
        ]);
      });

      it("reenviar o mesmo id devolve novo falso, sem reaplicar Agendamentos (FR-163, FR-210, SC-085)", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        const guardado = registroDe("r1", "2026-01-02T00:00:00.000Z", [
          itemAvaliadoDe(0, "c1", "bom"),
        ]);
        const original = agendamentoDe("c1");

        await armazenamento().inserirRegistroEAgendamentos(DONO_UM, guardado, [
          original,
        ]);

        const reenvio = registroDe("r1", "2026-03-04T09:30:00.000Z", [
          itemAvaliadoDe(0, "c1", "errei"),
        ]);

        expect(
          await armazenamento().inserirRegistroEAgendamentos(DONO_UM, reenvio, [
            agendamentoDe("c1", "2026-12-31T00:00:00.000Z", {
              repeticoes: 9,
              facilidade: 1.3,
              intervaloEmDias: 100,
            }),
          ]),
        ).toEqual({ ok: true, valor: { registro: guardado, novo: false } });

        /** A primeira Sessão é a que vale, e o Agendamento do reenvio é ignorado. */
        expect(await armazenamento().obterRegistroDeSessao(DONO_UM, "r1")).toEqual({
          ok: true,
          valor: guardado,
        });
        expect(await armazenamento().listarAgendamentos(DONO_UM)).toEqual([original]);
      });

      it("recusa como conflito o Registro de mesmo id vindo de outro Usuário (FR-166, FR-210)", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        const registro = registroDe("r1", "2026-01-02T00:00:00.000Z", [
          itemAvaliadoDe(0, "c1", "bom"),
        ]);

        await armazenamento().inserirRegistroEAgendamentos(DONO_UM, registro, [
          agendamentoDe("c1"),
        ]);

        expect(
          await armazenamento().inserirRegistroEAgendamentos(DONO_DOIS, registro, []),
        ).toEqual({ ok: false, erro: "conflito" });
        expect(await armazenamento().listarAgendamentos(DONO_DOIS)).toEqual([]);
      });

      it("descarta em silêncio o Agendamento de Cartão inexistente (D5, FR-210)", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        const registro = registroDe("r1", "2026-01-02T00:00:00.000Z", [
          itemAvaliadoDe(0, "c1", "bom"),
        ]);

        expect(
          await armazenamento().inserirRegistroEAgendamentos(DONO_UM, registro, [
            agendamentoDe("c1"),
            agendamentoDe("inexistente", "2026-03-01T00:00:00.000Z"),
          ]),
        ).toEqual({ ok: true, valor: { registro, novo: true } });
        expect(await armazenamento().listarAgendamentos(DONO_UM)).toEqual([
          agendamentoDe("c1"),
        ]);
      });

      it("descarta em silêncio o Agendamento de Cartão de outro Usuário (FR-219)", async () => {
        await armazenamento().inserirCartao(
          DONO_DOIS,
          cartaoDe("c2", "To read", "Ler"),
        );

        const registro = registroDe("r1", "2026-01-02T00:00:00.000Z", [
          itemAvaliadoDe(0, "c2", "bom"),
        ]);

        await armazenamento().inserirRegistroEAgendamentos(DONO_UM, registro, [
          agendamentoDe("c2"),
        ]);

        expect(await armazenamento().listarAgendamentos(DONO_UM)).toEqual([]);
      });

      it("o upsert por Cartão preserva o criadoEm da primeira Avaliação (FR-207, D3)", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        const primeiro = agendamentoDe("c1", "2026-02-01T00:00:00.000Z");

        await armazenamento().inserirRegistroEAgendamentos(
          DONO_UM,
          registroDe("r1", "2026-01-02T00:00:00.000Z", [
            itemAvaliadoDe(0, "c1", "bom"),
          ]),
          [primeiro],
        );

        const segundo = {
          ...agendamentoDe("c1", "2026-03-01T00:00:00.000Z", {
            repeticoes: 2,
            facilidade: 2.6,
            intervaloEmDias: 6,
          }),
          criadoEm: "2026-02-02T00:00:00.000Z",
        };

        await armazenamento().inserirRegistroEAgendamentos(
          DONO_UM,
          registroDe("r2", "2026-02-02T00:00:00.000Z", [
            itemAvaliadoDe(0, "c1", "facil"),
          ]),
          [segundo],
        );

        const agendamentos = await armazenamento().listarAgendamentos(DONO_UM);

        expect(agendamentos).toHaveLength(1);
        expect(agendamentos[0]).toEqual({
          ...segundo,
          criadoEm: primeiro.criadoEm,
        });
      });

      it("a origem revisao tem baralhoId vazio e nome Revisão do dia (D5, FR-196)", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        const registro: RegistroDeSessao = {
          ...registroDe("r1", "2026-01-02T00:00:00.000Z", [
            itemAvaliadoDe(0, "c1", "facil"),
          ]),
          origem: "revisao",
          baralhoId: "",
          nomeDoBaralho: "Revisão do dia",
        };

        await armazenamento().inserirRegistroEAgendamentos(DONO_UM, registro, [
          agendamentoDe("c1"),
        ]);

        expect(await armazenamento().obterRegistroDeSessao(DONO_UM, "r1")).toEqual({
          ok: true,
          valor: registro,
        });
      });

      it("excluir o Cartão remove o Agendamento e preserva o Registro (FR-208, FR-209)", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        const registro = registroDe("r1", "2026-01-02T00:00:00.000Z", [
          itemAvaliadoDe(0, "c1", "bom"),
        ]);

        await armazenamento().inserirRegistroEAgendamentos(DONO_UM, registro, [
          agendamentoDe("c1"),
        ]);
        await armazenamento().excluirCartao(DONO_UM, "c1");

        expect(await armazenamento().listarAgendamentos(DONO_UM)).toEqual([]);
        expect(await armazenamento().obterRegistroDeSessao(DONO_UM, "r1")).toEqual({
          ok: true,
          valor: registro,
        });
      });

      it("substituirAgendamentos troca as Preferências e só os Agendamentos do dono (FR-213, SC-086)", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c2", "To read", "Ler"));
        await armazenamento().inserirCartao(
          DONO_DOIS,
          cartaoDe("c3", "To run", "Correr"),
        );

        await armazenamento().inserirRegistroEAgendamentos(
          DONO_UM,
          registroDe("r1", "2026-01-02T00:00:00.000Z", [
            itemAvaliadoDe(0, "c1", "bom"),
          ]),
          [agendamentoDe("c1")],
        );
        await armazenamento().inserirRegistroEAgendamentos(
          DONO_DOIS,
          registroDe("r2", "2026-01-02T00:00:00.000Z", [
            itemAvaliadoDe(0, "c3", "bom"),
          ]),
          [agendamentoDe("c3")],
        );

        const preferencias = { algoritmo: "sm2", limiteDeNovosPorDia: 7 };
        const reconstruidos = [agendamentoDe("c2", "2026-04-01T00:00:00.000Z")];

        expect(
          await armazenamento().substituirAgendamentos(
            DONO_UM,
            preferencias,
            reconstruidos,
          ),
        ).toEqual({ ok: true, valor: undefined });

        expect(await armazenamento().obterPreferencias(DONO_UM)).toEqual(preferencias);
        expect(await armazenamento().listarAgendamentos(DONO_UM)).toEqual(reconstruidos);

        /** O outro dono guarda as Preferências padrão e o Agendamento original. */
        expect(await armazenamento().obterPreferencias(DONO_DOIS)).toEqual({
          algoritmo: "sm2",
          limiteDeNovosPorDia: 20,
        });
        expect(await armazenamento().listarAgendamentos(DONO_DOIS)).toEqual([
          agendamentoDe("c3"),
        ]);
      });

      it("lista os Itens avaliados em ordem (concluidaEm, posicao), o insumo do replay (FR-213, SC-083)", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c2", "To read", "Ler"));
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c3", "To run", "Correr"));

        await armazenamento().inserirRegistroEAgendamentos(
          DONO_UM,
          registroDe("r1", "2026-01-01T00:00:00.000Z", [
            itemAvaliadoDe(0, "c1", "bom"),
            itemAvaliadoDe(1, "c2", "dificil"),
          ]),
          [],
        );
        await armazenamento().inserirRegistroEAgendamentos(
          DONO_UM,
          registroDe("r2", "2026-01-02T00:00:00.000Z", [
            itemAvaliadoDe(0, "c3", "facil"),
          ]),
          [],
        );

        expect(await armazenamento().listarItensAvaliados(DONO_UM)).toEqual([
          {
            cartaoId: "c1",
            avaliacao: "bom",
            concluidaEm: "2026-01-01T00:00:00.000Z",
            posicao: 0,
          },
          {
            cartaoId: "c2",
            avaliacao: "dificil",
            concluidaEm: "2026-01-01T00:00:00.000Z",
            posicao: 1,
          },
          {
            cartaoId: "c3",
            avaliacao: "facil",
            concluidaEm: "2026-01-02T00:00:00.000Z",
            posicao: 0,
          },
        ]);
      });

      it("não lista Itens gravados sem avaliacao ou sem cartaoId (FR-196, FR-197, FR-213)", async () => {
        await armazenamento().inserirCartao(DONO_UM, cartaoDe("c1"));

        /** Registro anterior à 015: Item sem `avaliacao` e sem `cartaoId`. */
        await armazenamento().inserirRegistroDeSessao(
          DONO_UM,
          registroDe("antigo", "2026-01-01T00:00:00.000Z", [
            { posicao: 0, frente: "To walk", verso: "Caminhar", resultado: "acertou" },
          ]),
        );
        await armazenamento().inserirRegistroEAgendamentos(
          DONO_UM,
          registroDe("r1", "2026-01-02T00:00:00.000Z", [
            itemAvaliadoDe(0, "c1", "bom"),
          ]),
          [],
        );

        expect(await armazenamento().listarItensAvaliados(DONO_UM)).toEqual([
          {
            cartaoId: "c1",
            avaliacao: "bom",
            concluidaEm: "2026-01-02T00:00:00.000Z",
            posicao: 0,
          },
        ]);
      });
    });
  });
}
