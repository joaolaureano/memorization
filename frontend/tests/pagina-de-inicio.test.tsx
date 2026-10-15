import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  CartaoListado,
  ClienteDoAcervo,
  CompromissoDeEstudo,
  CreditoDoAcervo,
} from "../src/acervo-cliente/cliente";
import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE,
} from "../src/acervo-cliente/cliente";
import { PaginaDeInicio } from "../src/ui/PaginaDeInicio";

/**
 * Provas da tela de Início da feature 020 (FR-330, FR-331).
 *
 * A tela consome duas operações do `ClienteDoAcervo` — `listarCartoes` e a
 * Agenda —, e é isso que estas provas exercitam:
 * o duplo responde só o que a tela pede. Montar o Adapter de memória inteiro
 * traria para a prova as regras de janela, de idempotência e de agenda, que são
 * de outras features — aqui interessa o que a tela faz com o que recebeu.
 *
 * `listarCartoes` não alimenta número nenhum: serve apenas para a tela saber se
 * o acervo está vazio (FR-330). `obterEstatisticas`, por sua vez, **não deve
 * ser chamada**: o duplo a monta lançando, de modo que qualquer prova desta
 * suíte falha se Início voltar a ler as Estatísticas (FR-330).
 */

afterEach(() => {
  cleanup();
});

/** Um Cartão de prova com seu Baralho dono (FR-003). */
function cartaoDeProva(id: string): CartaoListado {
  return {
    id,
    frente: `Frente ${id}`,
    verso: `Verso ${id}`,
    baralho: { id: "b1", nome: "Inglês" },
    proximaRevisaoEm: null,
  };
}

/**
 * O `ClienteDoAcervo` de prova, restrito às leituras que a tela exercita. As
 * demais operações não são montadas porque a tela não as chama; a asserção é
 * estrutural e não esconde o que a prova cobre. A única exceção é
 * `obterEstatisticas`, que lança se for chamada: é assim que a prova garante
 * que Início não lê Registros nem Estatísticas (FR-330).
 */
function clienteDeProva(
  listarCartoes: ClienteDoAcervo["listarCartoes"] = async () => ({
    ok: true,
    cartoes: [cartaoDeProva("cartao-1")],
  }),
  // A Agenda (016) fica, por padrão, vazia e sem falha, para não interferir no
  // que cada prova exercita.
  obterAgenda: ClienteDoAcervo["obterAgenda"] = async (inicio, fuso) => ({
    ok: true,
    agenda: {
      inicio,
      hoje: inicio,
      fuso,
      compromissos: [],
      compromissosDeHoje: [],
    },
  }),
): ClienteDoAcervo {
  return {
    listarCartoes,
    obterAgenda,
    obterEstatisticas: async () => {
      throw new Error("Início não lê as Estatísticas (FR-330).");
    },
  } as unknown as ClienteDoAcervo;
}

/** A data local de hoje em `YYYY-MM-DD`, como a Agenda a pede (FR-311). */
function dataLocalDeHoje(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * Monta a tela com um acervo de um Cartão, para que as provas que não falam do
 * acervo vazio não vejam o convite. As provas que o exercitam passam o seu
 * próprio `listarCartoes`.
 */
function renderDaPagina(
  listarCartoes: ClienteDoAcervo["listarCartoes"] = async () => ({
    ok: true,
    cartoes: [cartaoDeProva("cartao-1")],
  }),
): void {
  render(
    <PaginaDeInicio
      cliente={clienteDeProva(listarCartoes)}
      nomeDeUsuario="joao"
    />,
  );
}

describe("PaginaDeInicio", () => {
  it("não apresenta a Revisão do dia (FR-330)", async () => {
    renderDaPagina();

    expect(
      await screen.findByRole("heading", { name: "Agenda de hoje" }),
    ).toBeTruthy();
    expect(screen.queryByText("Revisão do dia")).toBeNull();
    expect(screen.queryByRole("link", { name: "Revisar" })).toBeNull();
  });

  it("cumprimenta quem estuda e nada mais, sem sobretítulo, data nem semana (FR-330)", async () => {
    renderDaPagina();

    const cabecalho = document.querySelector(".inicio__cabecalho");
    expect(cabecalho).not.toBeNull();

    expect(
      within(cabecalho as HTMLElement).getByRole("heading", {
        name: "Olá, joao",
        level: 1,
      }),
    ).toBeTruthy();
    expect(
      await screen.findByRole("heading", {
        name: "Olá, joao",
        level: 1,
      }),
    ).toBeTruthy();

    // O sobretítulo, a data e o resumo dos sete dias saíram do Início.
    expect(screen.queryByText("Seu estudo")).toBeNull();
    expect(screen.queryByText(/Últimos 7 dias/)).toBeNull();

    const dataDeHoje = new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    expect(
      within(cabecalho as HTMLElement).queryByText(dataDeHoje),
    ).toBeNull();
  });

  it("leva a Baralhos quando o acervo está vazio (FR-330)", async () => {
    renderDaPagina(async () => ({ ok: true, cartoes: [] }));

    expect(
      (
        await screen.findByRole("link", {
          name: "Ver Baralhos",
        })
      ).getAttribute("href"),
    ).toBe("#/baralhos");
  });

  it("não convida nem inventa mensagem quando a leitura do acervo falha (FR-330)", async () => {
    let lida: () => void = () => {};
    const leitura = new Promise<void>((resolver) => {
      lida = resolver;
    });

    renderDaPagina(async () => {
      lida();

      return {
        ok: false,
        erro: INDISPONIVEL,
        mensagem: MENSAGEM_DE_INDISPONIBILIDADE,
      };
    });

    // A Agenda assentar e a leitura do acervo ter respondido são o sinal de
    // que a falha já chegou à tela.
    await leitura;
    expect(
      await screen.findByRole("heading", { name: "Agenda de hoje" }),
    ).toBeTruthy();

    expect(
      screen.queryByRole("link", { name: "Criar o primeiro Cartão" }),
    ).toBeNull();
    expect(screen.queryByText(MENSAGEM_DE_INDISPONIBILIDADE)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("mostra até três estudos de hoje e leva à Agenda completa em Estudo (FR-311, FR-322)", async () => {
    const hoje = dataLocalDeHoje();
    const compromissos = [1, 2, 3, 4].map(
      (numero): CompromissoDeEstudo => ({
        rotinaId: `rotina-${numero}`,
        baralhoId: `baralho-${numero}`,
        data: hoje,
        nomeDoBaralho: `Baralho ${numero}`,
        quantidade: 10,
        estado: "pendente",
        indisponivel: false,
        registroId: null,
      }),
    );

    const { container } = render(
      <PaginaDeInicio
        cliente={clienteDeProva(
          async () => ({ ok: true, cartoes: [cartaoDeProva("cartao-1")] }),
          async (inicio, fuso) => ({
            ok: true,
            agenda: {
              inicio,
              hoje,
              fuso,
              compromissos,
              compromissosDeHoje: compromissos,
            },
          }),
        )}
        nomeDeUsuario="joao"
      />,
    );

    expect(await screen.findByText("0 de 4 estudos concluídos")).toBeTruthy();

    const estudos = container.querySelector(".agenda__estudos");
    expect(estudos).not.toBeNull();
    expect(
      within(estudos as HTMLElement).getAllByRole("listitem"),
    ).toHaveLength(3);

    expect(
      screen
        .getByRole("link", { name: "Ver todos em Estudo" })
        .getAttribute("href"),
    ).toBe("#/estudo");
  });
});

/** Os créditos de prova, no formato de `GET /demonstracao/creditos` (030). */
const CREDITOS_DE_PROVA: CreditoDoAcervo[] = [
  {
    baralho: "Bandeiras",
    cartao: "Brasil",
    titulo: "Bandeira do Brasil",
    autor: "Autor de exemplo",
    licenca: "CC0 1.0",
    fonte: "https://example.test/bandeira-do-brasil",
  },
  {
    baralho: "Bandeiras",
    cartao: "Alemanha",
    titulo: "Bandeira da Alemanha",
    autor: "Autor de outro exemplo",
    licenca: "CC BY 4.0",
    fonte: "https://example.test/bandeira-da-alemanha",
  },
];

function clienteDaContaDeTeste(): ClienteDoAcervo {
  return {
    ...clienteDeProva(),
    obterCreditos: async () => CREDITOS_DE_PROVA,
  } as unknown as ClienteDoAcervo;
}

describe("PaginaDeInicio — Conta de teste (030, FR-490, FR-494)", () => {
  it("sem Conta de teste, não mostra o aviso nem o link de créditos", async () => {
    render(
      <PaginaDeInicio cliente={clienteDaContaDeTeste()} nomeDeUsuario="joao" />,
    );

    await screen.findByRole("heading", { name: "Agenda de hoje" });

    expect(
      screen.queryByText("Esta é uma Conta de teste. Tudo será apagado ao sair."),
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Créditos do acervo de demonstração" }),
    ).toBeNull();
  });

  it("com Conta de teste, mostra o aviso e o link de créditos", async () => {
    render(
      <PaginaDeInicio
        cliente={clienteDaContaDeTeste()}
        nomeDeUsuario="joao"
        contaDeTeste
      />,
    );

    expect(
      screen.getByText("Esta é uma Conta de teste. Tudo será apagado ao sair."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Créditos do acervo de demonstração" }),
    ).toBeInTheDocument();
  });

  it("o diálogo lista título, autor, licença e fonte de cada mídia (FR-494)", async () => {
    render(
      <PaginaDeInicio
        cliente={clienteDaContaDeTeste()}
        nomeDeUsuario="joao"
        contaDeTeste
      />,
    );

    fireEvent.click(
      screen.getByRole("link", { name: "Créditos do acervo de demonstração" }),
    );

    const dialogo = await screen.findByRole("dialog", {
      name: "Créditos do acervo de demonstração",
    });

    for (const credito of CREDITOS_DE_PROVA) {
      const linha = within(dialogo).getByText(credito.titulo).closest("tr") as HTMLElement;
      expect(within(linha).getByText(credito.autor)).toBeInTheDocument();
      expect(within(linha).getByText(credito.licenca)).toBeInTheDocument();
      expect(within(linha).getByRole("link", { name: credito.fonte })).toHaveAttribute(
        "href",
        credito.fonte,
      );
    }
  });

  it("fecha com Esc e devolve o foco ao link que o abriu", async () => {
    render(
      <PaginaDeInicio
        cliente={clienteDaContaDeTeste()}
        nomeDeUsuario="joao"
        contaDeTeste
      />,
    );

    const link = screen.getByRole("link", {
      name: "Créditos do acervo de demonstração",
    });
    fireEvent.click(link);

    const dialogo = await screen.findByRole("dialog", {
      name: "Créditos do acervo de demonstração",
    });

    fireEvent.keyDown(dialogo, { key: "Escape" });

    await waitFor(() => expect(dialogo).not.toHaveAttribute("open"));
    expect(link).toHaveFocus();
  });
});
