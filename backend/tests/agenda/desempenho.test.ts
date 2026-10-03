import { afterEach, describe, expect, it } from "vitest";

import { criarAgenda } from "../../src/agenda/agenda.ts";
import type {
  ArmazenamentoDoAcervo,
  CompromissoPersistido,
  RotinaArmazenada,
} from "../../src/armazenamento/porta.ts";
import { FUSO, prepararMundo } from "./apoio-de-agenda.ts";
import type { MundoDeAgenda } from "./apoio-de-agenda.ts";

/**
 * T1622 (SC-102) — 100 Rotinas e 2 anos de Compromissos anteriores: a semana e
 * o resumo de hoje respondem em até 1 segundo, **sem** ler o Histórico de
 * Sessões nem os Compromissos fora da janela pedida.
 */

let mundo: MundoDeAgenda | undefined;

afterEach(async () => {
  await mundo?.encerrar();
  mundo = undefined;
});

const HOJE = "2026-10-05"; // segunda-feira
const LIMITE_EM_MILISSEGUNDOS = 1000;

describe("desempenho da Agenda (SC-102)", () => {
  it("responde a semana e o resumo de hoje em até 1 s com 100 Rotinas e 2 anos de Compromissos", async () => {
    mundo = await prepararMundo("2026-10-05T15:00:00Z");

    const ingles = await mundo.baralhoComCartoes("Inglês", 3);
    const rotinas: RotinaArmazenada[] = [];

    for (let indice = 0; indice < 100; indice += 1) {
      const rotina: RotinaArmazenada = {
        id: `rotina-${String(indice).padStart(3, "0")}`,
        criadaEm: `2024-10-01T00:${String(indice % 60).padStart(2, "0")}:00.000Z`,
        versao: 1,
        estado: "ativa",
        baralhoId: ingles.id,
        versoes: [
          {
            ordem: 1,
            iniciaEm: "2024-10-07",
            baralhoId: ingles.id,
            nomeDoBaralho: "Inglês",
            dias: [1 + (indice % 7)],
            quantidade: 10,
            estado: "ativa",
          },
        ],
      };

      await mundo.armazenamento.gravarRotina(mundo.dono, {
        operacaoId: `op-${indice}`,
        intencao: "criar",
        versaoEsperada: null,
        rotina,
      });
      rotinas.push(rotina);
    }

    // Duas anos de Compromissos concluídos, uma ocorrência semanal por Rotina.
    let total = 0;

    for (const rotina of rotinas) {
      const dia = rotina.versoes[0].dias[0];
      let data = new Date(Date.UTC(2024, 9, 7 + (dia - 1)));

      while (data.toISOString().slice(0, 10) < HOJE) {
        const compromisso: CompromissoPersistido = {
          rotinaId: rotina.id,
          data: data.toISOString().slice(0, 10),
          estado: "concluido",
          registroId: `registro-${total}`,
          baralhoId: ingles.id,
          nomeDoBaralho: "Inglês",
          quantidade: 10,
        };

        await mundo.armazenamento.gravarCompromisso(mundo.dono, compromisso);
        total += 1;
        data = new Date(data.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    }

    expect(total).toBeGreaterThan(10_000);

    // Espião: registra o que a Agenda lê do armazenamento.
    const leituras: string[] = [];
    const intervalos: Array<[string, string]> = [];
    const espiao = new Proxy(mundo.armazenamento, {
      get(alvo, propriedade, receptor) {
        const valor = Reflect.get(alvo, propriedade, receptor);

        if (typeof valor !== "function") {
          return valor;
        }

        return (...argumentos: unknown[]) => {
          leituras.push(String(propriedade));

          if (propriedade === "listarCompromissos") {
            intervalos.push([argumentos[1] as string, argumentos[2] as string]);
          }

          return (valor as (...a: unknown[]) => unknown).apply(alvo, argumentos);
        };
      },
    }) as ArmazenamentoDoAcervo;

    const agenda = criarAgenda(espiao, mundo.dono, {
      agora: () => new Date("2026-10-05T15:00:00Z"),
    });

    const inicio = performance.now();
    const resultado = await agenda.obterAgenda(HOJE, FUSO);
    const duracao = performance.now() - inicio;

    expect(resultado.ok).toBe(true);

    if (resultado.ok) {
      // Uma Rotina por dia da semana tem ocorrência em cada dia: 100 em 7 dias.
      expect(resultado.agenda.compromissos).toHaveLength(100);
      expect(resultado.agenda.compromissosDeHoje.length).toBeGreaterThan(0);
    }

    expect(duracao).toBeLessThan(LIMITE_EM_MILISSEGUNDOS);
    // Nada do Histórico de Sessões foi lido, e os Compromissos só da janela.
    expect(leituras).not.toContain("listarRegistrosDesde");
    expect(leituras).not.toContain("listarRegistrosRecentes");
    expect(leituras).not.toContain("obterRegistroDeSessao");
    expect(intervalos).toEqual([["2026-10-05", "2026-10-11"]]);
  }, 120_000);
});
