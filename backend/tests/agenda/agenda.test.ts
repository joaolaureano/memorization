import { describe, expect, it } from "vitest";

import { criarAcervo } from "../../src/acervo/acervo.ts";
import type { Agenda } from "../../src/agenda/agenda.ts";
import { criarAgenda } from "../../src/agenda/agenda.ts";
import type { ArmazenamentoDoAcervo } from "../../src/armazenamento/porta.ts";
import { abrirArmazenamentoSqlite } from "../../src/armazenamento/sqlite/armazenamento.ts";
import { criarDonoDeTeste } from "../armazenamento/usuarios-de-teste.ts";

/**
 * A Porta falsa mínima do esqueleto (FR-248, FR-250): `criarAgenda` ainda não
 * a consome, porque toda operação valida as entradas antes de qualquer acesso
 * ao armazenamento.
 */
const portaFalsa = {} as unknown as ArmazenamentoDoAcervo;

/** O relógio congelado dos cenários do esqueleto (FR-250). */
const agoraFixo = () => new Date("2026-10-03T12:00:00Z");

/** O esqueleto da Agenda, com a Porta falsa e o relógio injetado. */
function agendaDeTeste(): Agenda {
  return criarAgenda(portaFalsa, "dono-um", { agora: agoraFixo });
}

/** Os dados que `salvarRotina` recebe, sem conhecer o resto da Rotina. */
type DadosDeRotina = Parameters<Agenda["salvarRotina"]>[0];

/** Os dados que `iniciarCompromisso` recebe. */
type DadosDeInicio = Parameters<Agenda["iniciarCompromisso"]>[0];

describe("criarAgenda: obterAgenda (FR-248, FR-250)", () => {
  it("recusa data civil inexistente com dados_invalidos", async () => {
    const resultado = await agendaDeTeste().obterAgenda(
      "2026-02-31",
      "America/Sao_Paulo",
    );

    expect(resultado).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });

  it("recusa data que não é segunda-feira com dados_invalidos", async () => {
    const resultado = await agendaDeTeste().obterAgenda(
      "2026-10-03",
      "America/Sao_Paulo",
    );

    expect(resultado).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });

  it("recusa fuso inválido com dados_invalidos", async () => {
    const resultado = await agendaDeTeste().obterAgenda(
      "2026-09-28",
      "Marte/Fobos",
    );

    expect(resultado).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });

  it("devolve indisponivel quando a entrada é válida", async () => {
    const resultado = await agendaDeTeste().obterAgenda(
      "2026-09-28",
      "America/Sao_Paulo",
    );

    expect(resultado).toMatchObject({ ok: false, erro: "indisponivel" });
  });
});

describe("criarAgenda: salvarRotina (FR-248, FR-250)", () => {
  it("recusa fuso inválido com dados_invalidos", async () => {
    const dados = {
      operacaoId: "operacao-um",
      fuso: "Marte/Fobos",
    } as unknown as DadosDeRotina;

    const resultado = await agendaDeTeste().salvarRotina(dados);

    expect(resultado).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });

  it("recusa operacaoId vazio com dados_invalidos", async () => {
    const dados = {
      operacaoId: "",
      fuso: "America/Sao_Paulo",
    } as unknown as DadosDeRotina;

    const resultado = await agendaDeTeste().salvarRotina(dados);

    expect(resultado).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });

  it("recusa operacaoId só com espaços com dados_invalidos", async () => {
    const dados = {
      operacaoId: "   ",
      fuso: "America/Sao_Paulo",
    } as unknown as DadosDeRotina;

    const resultado = await agendaDeTeste().salvarRotina(dados);

    expect(resultado).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });

  it("devolve indisponivel quando a entrada é válida", async () => {
    const dados = {
      operacaoId: "operacao-um",
      fuso: "America/Sao_Paulo",
    } as unknown as DadosDeRotina;

    const resultado = await agendaDeTeste().salvarRotina(dados);

    expect(resultado).toMatchObject({ ok: false, erro: "indisponivel" });
  });
});

describe("criarAgenda: iniciarCompromisso (FR-248, FR-250)", () => {
  it("recusa data civil inexistente com dados_invalidos", async () => {
    const dados = {
      data: "2026-02-31",
      fuso: "America/Sao_Paulo",
    } as unknown as DadosDeInicio;

    const resultado = await agendaDeTeste().iniciarCompromisso(dados);

    expect(resultado).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });

  it("recusa fuso inválido com dados_invalidos", async () => {
    const dados = {
      data: "2026-10-03",
      fuso: "Marte/Fobos",
    } as unknown as DadosDeInicio;

    const resultado = await agendaDeTeste().iniciarCompromisso(dados);

    expect(resultado).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });

  it("devolve indisponivel quando a entrada é válida", async () => {
    const dados = {
      data: "2026-10-03",
      fuso: "America/Sao_Paulo",
    } as unknown as DadosDeInicio;

    const resultado = await agendaDeTeste().iniciarCompromisso(dados);

    expect(resultado).toMatchObject({ ok: false, erro: "indisponivel" });
  });
});

describe("criarAgenda: listarRotinas (FR-248)", () => {
  it("devolve indisponivel no esqueleto", async () => {
    const resultado = await agendaDeTeste().listarRotinas();

    expect(resultado).toMatchObject({ ok: false, erro: "indisponivel" });
  });
});

describe("composição: criarAcervo expõe a Agenda (FR-248, FR-250)", () => {
  it("delega as operações de Agenda ao Module", async () => {
    const { armazenamento, usuarios, encerrar } =
      await abrirArmazenamentoSqlite(":memory:");

    try {
      const dono = await criarDonoDeTeste(usuarios, "dono-um", "ana.silva");
      const acervo = criarAcervo(armazenamento, dono);

      expect(typeof acervo.obterAgenda).toBe("function");
      expect(typeof acervo.listarRotinas).toBe("function");
      expect(typeof acervo.salvarRotina).toBe("function");
      expect(typeof acervo.iniciarCompromisso).toBe("function");

      const recusado = await acervo.obterAgenda(
        "2026-02-31",
        "America/Sao_Paulo",
      );

      expect(recusado).toMatchObject({
        ok: false,
        erro: "dados_invalidos",
      });

      const pendente = await acervo.listarRotinas();

      expect(pendente).toMatchObject({ ok: false, erro: "indisponivel" });
    } finally {
      await encerrar();
    }
  });
});
