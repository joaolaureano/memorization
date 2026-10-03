import { describe, expect, it } from "vitest";

import {
  dataPorExtenso,
  descreverDias,
  descreverSemana,
  diaDaSemana,
  diasDaSemana,
  ehDataCivilValida,
  hojeNoFuso,
  milissegundosAteAMeiaNoite,
  segundaFeiraDe,
  somarDias,
} from "../src/agenda/datas";
import {
  descreverQuantidade,
  proximoCompromissoElegivel,
  resumirDia,
  rotuloDoCompromisso,
  rotuloDoEstadoDoDia,
  textoDaContagem,
} from "../src/agenda/estado-do-dia";
import type { CompromissoDeEstudo } from "../src/acervo-cliente/cliente";

/**
 * Datas civis e estados do calendário da Agenda (016, FR-228, FR-229, FR-246):
 * funções puras, sem relógio nem fuso da máquina.
 */

function compromisso(
  data: string,
  estado: CompromissoDeEstudo["estado"],
  extra: Partial<CompromissoDeEstudo> = {},
): CompromissoDeEstudo {
  return {
    rotinaId: `r-${data}-${estado}`,
    data,
    baralhoId: "b1",
    nomeDoBaralho: "Inglês",
    quantidade: null,
    estado,
    indisponivel: false,
    registroId: null,
    ...extra,
  };
}

describe("datas civis (FR-246)", () => {
  it("valida datas existentes e recusa 31/02, ano 0000 e formato frouxo", () => {
    expect(ehDataCivilValida("2026-10-05")).toBe(true);
    expect(ehDataCivilValida("2028-02-29")).toBe(true);
    expect(ehDataCivilValida("2026-02-31")).toBe(false);
    expect(ehDataCivilValida("2027-02-29")).toBe(false);
    expect(ehDataCivilValida("0000-01-01")).toBe(false);
    expect(ehDataCivilValida("2026-1-5")).toBe(false);
  });

  it("soma dias atravessando mês, ano e fevereiro bissexto", () => {
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(somarDias("2027-02-28", 1)).toBe("2027-03-01");
    expect(somarDias("2026-10-05", -7)).toBe("2026-09-28");
  });

  it("numera 1 = segunda e 7 = domingo e acha a segunda da semana", () => {
    expect(diaDaSemana("2026-10-05")).toBe(1);
    expect(diaDaSemana("2026-10-11")).toBe(7);
    expect(segundaFeiraDe("2026-10-11")).toBe("2026-10-05");
    expect(segundaFeiraDe("2026-10-05")).toBe("2026-10-05");
    expect(diasDaSemana("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("deriva hoje no fuso pedido, sem usar o da máquina", () => {
    const instante = new Date("2026-10-06T02:30:00Z");

    expect(hojeNoFuso("America/Sao_Paulo", instante)).toBe("2026-10-05");
    expect(hojeNoFuso("Asia/Tokyo", instante)).toBe("2026-10-06");
  });

  it("calcula quanto falta para a meia-noite do fuso", () => {
    // 23h30 em São Paulo: faltam 30 minutos.
    const falta = milissegundosAteAMeiaNoite(
      "America/Sao_Paulo",
      new Date("2026-10-06T02:30:00Z"),
    );

    expect(Math.abs(falta - 30 * 60 * 1000)).toBeLessThanOrEqual(1000);
  });

  it("descreve dias, data por extenso e o intervalo da semana com mês e ano", () => {
    expect(descreverDias([4, 1])).toBe("segunda e quinta");
    expect(descreverDias([1, 3, 5])).toBe("segunda, quarta e sexta");
    expect(descreverDias([7])).toBe("domingo");
    expect(dataPorExtenso("2026-10-05")).toBe("segunda, 5 de outubro de 2026");
    expect(descreverSemana("2026-10-05")).toBe("5 a 11 de outubro de 2026");
    expect(descreverSemana("2026-09-28")).toBe(
      "28 de setembro a 4 de outubro de 2026",
    );
    expect(descreverSemana("2026-12-28")).toBe(
      "28 de dezembro de 2026 a 3 de janeiro de 2027",
    );
  });
});

describe("estado do dia (FR-229, tabela de estados)", () => {
  const hoje = "2026-10-07";

  it("sem Compromissos é «Sem estudos», sem sinal de sucesso nem de falha", () => {
    const resumo = resumirDia("2026-10-08", hoje, []);

    expect(resumo).toMatchObject({ estado: "sem_estudos", total: 0 });
    expect(textoDaContagem(resumo)).toBe("Nenhum estudo agendado");
  });

  it.each([
    ["todos concluídos", "2026-10-06", ["concluido", "concluido"], "concluido", "2 de 2 estudos concluídos"],
    ["passado incompleto", "2026-10-06", ["concluido", "pendente", "nao_realizado"], "nao_realizado", "1 de 3 estudos concluídos; 2 não realizados"],
    ["futuro", "2026-10-08", ["programado", "programado"], "programado", "0 de 2 estudos concluídos"],
    ["hoje nenhum concluído", hoje, ["pendente", "pendente"], "pendente", "0 de 2 estudos concluídos"],
    ["hoje parcial", hoje, ["concluido", "pendente"], "parcial", "1 de 2 estudos concluídos"],
  ] as const)("%s", (_nome, data, estados, esperado, texto) => {
    const resumo = resumirDia(
      data,
      hoje,
      estados.map((estado, indice) =>
        compromisso(data, estado, { rotinaId: `r${indice}` }),
      ),
    );

    expect(resumo.estado).toBe(esperado);
    expect(textoDaContagem(resumo)).toBe(texto);
  });

  it("cancelados ficam fora do total, mas aparecem nos detalhes", () => {
    const resumo = resumirDia(hoje, hoje, [
      compromisso(hoje, "cancelado", { rotinaId: "a" }),
      compromisso(hoje, "cancelado", { rotinaId: "b" }),
    ]);

    expect(resumo).toMatchObject({ estado: "sem_estudos", total: 0 });
    expect(resumo.compromissos).toHaveLength(2);
  });

  it("indisponibilidade não reduz o total (1 de 3 com um indisponível)", () => {
    const resumo = resumirDia(hoje, hoje, [
      compromisso(hoje, "concluido", { rotinaId: "a" }),
      compromisso(hoje, "pendente", { rotinaId: "b" }),
      compromisso(hoje, "pendente", { rotinaId: "c", indisponivel: true }),
    ]);

    expect(resumo).toMatchObject({ estado: "parcial", total: 3, concluidos: 1 });
  });

  it("um dia futuro com conclusão registrada segue a mesma precedência", () => {
    const resumo = resumirDia("2026-10-08", hoje, [
      compromisso("2026-10-08", "concluido", { rotinaId: "a" }),
      compromisso("2026-10-08", "programado", { rotinaId: "b" }),
    ]);

    expect(resumo).toMatchObject({ estado: "programado", concluidos: 1, total: 2 });
  });

  it("rotula estados e quantidades em texto", () => {
    expect(rotuloDoEstadoDoDia("parcial")).toBe("Parcial");
    expect(rotuloDoCompromisso("nao_realizado")).toBe("Não realizado");
    expect(descreverQuantidade(null)).toBe("Todos os Cartões");
    expect(descreverQuantidade(1)).toBe("1 Cartão");
    expect(descreverQuantidade(20)).toBe("20 Cartões");
  });

  it("o próximo elegível é o primeiro pendente com Baralho disponível, na ordem de criação", () => {
    const lista = [
      compromisso(hoje, "concluido", { rotinaId: "a" }),
      compromisso(hoje, "pendente", { rotinaId: "b", indisponivel: true }),
      compromisso(hoje, "pendente", { rotinaId: "c" }),
      compromisso(hoje, "pendente", { rotinaId: "d" }),
    ];

    expect(proximoCompromissoElegivel(lista)?.rotinaId).toBe("c");
    expect(proximoCompromissoElegivel([lista[0], lista[1]])).toBeNull();
  });
});
