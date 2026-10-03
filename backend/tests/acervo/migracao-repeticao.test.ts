import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { criarAcervo } from "../../src/acervo/acervo.ts";
import type { ArmazenamentoDoAcervo } from "../../src/armazenamento/porta.ts";
import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import { aplicarMigracoes } from "../../src/armazenamento/sqlite/esquema.ts";
import { MIGRACOES } from "../../src/armazenamento/sqlite/migracoes.ts";
import type { AlgoritmoDeRepeticao } from "../../src/repeticao/algoritmo.ts";
import {
  gravarBaralho,
  gravarCartao,
  gravarDono,
  gravarVinculo,
} from "./banco-de-teste.ts";

/**
 * T1521 — o acervo da feature `013` aberto pelo `Acervo` depois da migração 7.
 *
 * A migração 7 só cria tabelas e acrescenta colunas: nenhum dado instalado é
 * alterado (FR-220). Estes testes provam o efeito disso **pelo comportamento**
 * da Interface, e não inspecionando o esquema: os Cartões anteriores viram
 * Cartões **novos** (FR-214); o Histórico anterior continua servido igual —
 * Itens sem Avaliação e `origem` `"baralho"` (FR-197) —; e a troca de algoritmo
 * reconstrói os Agendamentos por replay do Histórico, **ignorando** os Itens
 * sem Avaliação (FR-213).
 *
 * A base é montada em arquivo, migrada até a versão 6, povoada como a `013`
 * deixava em disco e só então reaberta pelo Adapter — é a abertura que aplica a
 * migração 7 e entrega a Porta ao `Acervo`.
 */

/**
 * Quantidade de Cartões anteriores à 015; maior que o limite diário padrão para
 * que o teto de `novosHoje` fique visível (FR-199).
 */
const QUANTIDADE_DE_CARTOES = 21;

/** Teto diário padrão de Cartões novos, o que `resumoDaRevisao` respeita (FR-199). */
const LIMITE_PADRAO_DE_NOVOS_POR_DIA = 20;

/** O que cada teste precisa do acervo da `013` já migrado e aberto pela Porta. */
interface ContextoDoAcervoDaVersaoSeis {
  readonly armazenamento: ArmazenamentoDoAcervo;
  readonly dono: string;
  readonly inicioDoDia: string;
  readonly fimDoDia: string;
  readonly desde: string;
  readonly concluidaEm: string;
}

/**
 * Grava um Registro de sessão no formato da `013`: `concluida_em`, contagens e
 * Itens apenas com Frente, Verso e Resultado — sem as colunas `cartao_id` e
 * `avaliacao`, que só a migração 7 acrescenta (FR-197).
 *
 * `estudados`, `acertos` e `erros` são derivados dos Itens gravados, como o
 * esquema da `013` exigia.
 */
function gravarRegistroDaVersaoSeis(
  banco: DatabaseSync,
  dono: string,
  id: string,
  concluidaEm: string,
): void {
  const itens = [
    { posicao: 0, frente: "To walk", verso: "Caminhar", resultado: "acertou" },
    { posicao: 1, frente: "To run", verso: "Correr", resultado: "errou" },
  ] as const;

  const acertos = itens.filter((item) => item.resultado === "acertou").length;

  banco
    .prepare(
      `INSERT INTO registro_de_sessao
         (id, usuario_id, baralho_id, nome_do_baralho, concluida_em,
          estudados, acertos, erros)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      dono,
      "b1",
      "Inglês",
      concluidaEm,
      itens.length,
      acertos,
      itens.length - acertos,
    );

  const inserirItem = banco.prepare(
    `INSERT INTO item_de_registro
       (registro_id, posicao, frente, verso, resultado)
     VALUES (?, ?, ?, ?, ?)`,
  );

  for (const item of itens) {
    inserirItem.run(id, item.posicao, item.frente, item.verso, item.resultado);
  }
}

/**
 * Monta, em `caminho`, o que uma base da `013` tinha em disco: as migrações 1 a
 * 6 aplicadas, Cartões e um Baralho com Vínculo, e um Registro de sessão com
 * Itens só com Resultado (FR-197).
 *
 * Devolve o identificador do dono, para que o `Acervo` seja criado sobre ele.
 */
function prepararAcervoDaVersaoSeis(
  caminho: string,
  concluidaEm: string,
): string {
  const banco = new DatabaseSync(caminho);

  try {
    aplicarMigracoes(
      banco,
      MIGRACOES.filter((migracao) => migracao.versao <= 6),
    );

    const dono = gravarDono(banco);

    for (let indice = 1; indice <= QUANTIDADE_DE_CARTOES; indice += 1) {
      gravarCartao(banco, dono, `c${indice}`);
    }

    gravarBaralho(banco, dono, "b1", "Inglês");
    gravarVinculo(banco, "c1", "b1");
    gravarRegistroDaVersaoSeis(banco, dono, "r1", concluidaEm);

    return dono;
  } finally {
    banco.close();
  }
}

/**
 * Executa o corpo com o acervo da `013` migrado para a 7 e aberto pela Porta —
 * o caminho real de uma execução que atualiza o aplicativo.
 *
 * Os instantes derivam de `agora` de propósito: a janela de `desde` das
 * Estatísticas só cobre 31 dias, e uma data fixa no passado deixaria o Registro
 * fora da lista (FR-169).
 */
async function comAcervoDaVersaoSeis(
  corpo: (contexto: ContextoDoAcervoDaVersaoSeis) => Promise<void>,
): Promise<void> {
  const diretorio = mkdtempSync(join(tmpdir(), "acervo-repeticao-migracao-"));
  const caminho = join(diretorio, "memorizacao.sqlite");

  try {
    const agora = new Date();
    const concluidaEm = new Date(
      agora.getTime() - 60 * 60 * 1000,
    ).toISOString();
    const inicioDoDia = new Date(
      agora.getTime() - 2 * 60 * 60 * 1000,
    ).toISOString();
    const fimDoDia = new Date(
      agora.getTime() + 2 * 60 * 60 * 1000,
    ).toISOString();
    const desde = new Date(
      agora.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString();

    const dono = prepararAcervoDaVersaoSeis(caminho, concluidaEm);
    const aberto = await abrirArmazenamentoSqlite(caminho);

    try {
      await corpo({
        armazenamento: aberto.armazenamento,
        dono,
        inicioDoDia,
        fimDoDia,
        desde,
        concluidaEm,
      });
    } finally {
      await aberto.encerrar();
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
}

/** Algoritmo de teste que conta quantas vezes `avaliar` foi chamado (FR-213). */
interface AlgoritmoEspiao extends AlgoritmoDeRepeticao {
  readonly chamadas: number;
}

/**
 * Algoritmo falso injetado pela opção de teste de `criarAcervo`, para disparar a
 * reconstrução da troca de algoritmo sem depender do SM-2 (FR-191, FR-213).
 *
 * O contador de chamadas é o que torna visível se o replay tocou ou não os
 * Itens do Histórico: como os Itens da `013` não têm Avaliação, `avaliar` não
 * pode ser chamado nenhuma vez.
 */
function criarAlgoritmoFalso(id: string): AlgoritmoEspiao {
  let chamadas = 0;

  return {
    id,
    versao: 1,
    rotulo: "Algoritmo falso",
    get chamadas(): number {
      return chamadas;
    },
    avaliar(_estado, _avaliacao, agora) {
      chamadas += 1;

      return {
        estado: { algoritmo: id, versao: 1, dados: {} },
        proximaRevisaoEm: new Date(agora.getTime() + 24 * 60 * 60 * 1000),
      };
    },
  };
}

describe("migração da 013 para a repetição espaçada — acervo antigo aberto pelo Acervo", () => {
  it("trata todos os Cartões anteriores como novos, sem vencidos, respeitando o teto de 20 por dia (FR-214, FR-199)", async () => {
    await comAcervoDaVersaoSeis(
      async ({ armazenamento, dono, inicioDoDia, fimDoDia }) => {
        const acervo = criarAcervo(armazenamento, dono);

        const disponiveisHoje = Math.min(
          QUANTIDADE_DE_CARTOES,
          LIMITE_PADRAO_DE_NOVOS_POR_DIA,
        );

        expect(
          await acervo.obterResumoDaRevisao(inicioDoDia, fimDoDia),
        ).toEqual({
          ok: true,
          resumo: {
            vencidos: 0,
            novosHoje: disponiveisHoje,
            total: disponiveisHoje,
          },
        });
      },
    );
  });

  it('preserva o Histórico anterior — Estatísticas iguais e Registro com origem "baralho" e Itens sem Avaliação (FR-197)', async () => {
    await comAcervoDaVersaoSeis(
      async ({ armazenamento, dono, desde, concluidaEm }) => {
        const acervo = criarAcervo(armazenamento, dono);

        const registroResumido = {
          id: "r1",
          baralhoId: "b1",
          nomeDoBaralho: "Inglês",
          concluidaEm,
          estudados: 2,
          acertos: 1,
          erros: 1,
          origem: "baralho",
        };

        expect(await acervo.obterEstatisticas(desde)).toEqual({
          ok: true,
          estatisticas: {
            cartoes: QUANTIDADE_DE_CARTOES,
            baralhos: 1,
            registrosDaJanela: [registroResumido],
            recentes: [registroResumido],
          },
        });

        const encontrado = await acervo.obterRegistroDeSessao("r1");

        if (!encontrado.ok) {
          throw new Error("esperava o Registro de sessão da 013");
        }

        /** O Baralho continua existindo: a migração não apagou nada. */
        expect(encontrado.baralhoExiste).toBe(true);

        expect({
          id: encontrado.registro.id,
          baralhoId: encontrado.registro.baralhoId,
          nomeDoBaralho: encontrado.registro.nomeDoBaralho,
          concluidaEm: encontrado.registro.concluidaEm,
          estudados: encontrado.registro.estudados,
          acertos: encontrado.registro.acertos,
          erros: encontrado.registro.erros,
          origem: encontrado.registro.origem,
        }).toEqual(registroResumido);

        expect(
          encontrado.registro.itens.map((item) => ({
            posicao: item.posicao,
            frente: item.frente,
            verso: item.verso,
            resultado: item.resultado,
          })),
        ).toEqual([
          {
            posicao: 0,
            frente: "To walk",
            verso: "Caminhar",
            resultado: "acertou",
          },
          { posicao: 1, frente: "To run", verso: "Correr", resultado: "errou" },
        ]);

        /**
         * Os Itens anteriores à 015 não têm Cartão de origem nem Avaliação: é
         * o que os mantém fora do replay e a marca que a tela usa para exibi-los
         * como antes (FR-197, FR-214).
         */
        expect(
          encontrado.registro.itens.every((item) => item.avaliacao == null),
        ).toBe(true);
        expect(
          encontrado.registro.itens.every((item) => item.cartaoId == null),
        ).toBe(true);
      },
    );
  });

  it("ignora os Itens sem Avaliação ao reconstruir os Agendamentos na troca de algoritmo (FR-213)", async () => {
    await comAcervoDaVersaoSeis(
      async ({ armazenamento, dono, inicioDoDia, fimDoDia }) => {
        const algoritmoFalso = criarAlgoritmoFalso("falso");
        const acervo = criarAcervo(armazenamento, dono, {
          algoritmos: new Map([[algoritmoFalso.id, algoritmoFalso]]),
        });

        const salvo = await acervo.salvarPreferencias({
          algoritmo: algoritmoFalso.id,
          limiteDeNovosPorDia: LIMITE_PADRAO_DE_NOVOS_POR_DIA,
        });

        expect(salvo).toEqual({
          ok: true,
          preferencias: {
            algoritmo: "falso",
            limiteDeNovosPorDia: LIMITE_PADRAO_DE_NOVOS_POR_DIA,
            algoritmos: [{ id: "falso", rotulo: "Algoritmo falso" }],
          },
        });

        /** Nenhum Item antigo tinha Avaliação: o replay não avaliou nada. */
        expect(algoritmoFalso.chamadas).toBe(0);

        /** Sem Agendamento novo, todos os Cartões continuam novos. */
        const disponiveisHoje = Math.min(
          QUANTIDADE_DE_CARTOES,
          LIMITE_PADRAO_DE_NOVOS_POR_DIA,
        );

        expect(
          await acervo.obterResumoDaRevisao(inicioDoDia, fimDoDia),
        ).toEqual({
          ok: true,
          resumo: {
            vencidos: 0,
            novosHoje: disponiveisHoje,
            total: disponiveisHoje,
          },
        });
      },
    );
  });
});
