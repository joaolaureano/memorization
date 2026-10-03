import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ClienteDoAcervo } from "../src/acervo-cliente/cliente";
import { INDISPONIVEL } from "../src/acervo-cliente/cliente";
import type { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { fusoDoNavegador } from "../src/agenda/datas";
import { Aplicacao } from "../src/ui/Aplicacao";
import { PaginaDeInicio } from "../src/ui/PaginaDeInicio";
import {
  CREDENCIAL_DE_PROVA,
  aguardarVerificacaoDoAcesso,
  clienteDeProva,
} from "./apoio-de-prova";

/**
 * T1606/T1609/T1612/T1615/T1618/T1621 — a Agenda de estudo na interface (016):
 * o bloco de Início, a Sessão autorizada, Gerenciar agenda e o formulário. O
 * stand-in em memória reproduz as regras observáveis do servidor; a tela só
 * apresenta o que ele devolve.
 */

const FUSO = fusoDoNavegador();

beforeEach(() => {
  window.location.hash = "#/inicio";
});

afterEach(() => {
  cleanup();
});

let numero = 0;

/** Cria um Baralho com Cartões no acervo do Usuário de prova. */
async function baralhoComCartoes(
  servidor: ClienteEmMemoria,
  nome = "Inglês",
  quantidade = 3,
): Promise<{ id: string; cartaoIds: string[] }> {
  const baralho = await servidor.criarBaralho({ nome });

  if (!baralho.ok) {
    throw new Error("Baralho");
  }

  const cartaoIds: string[] = [];

  for (let i = 1; i <= quantidade; i += 1) {
    const cartao = await servidor.criarCartao({
      frente: `${nome} ${i}`,
      verso: `Resposta ${i}`,
    });

    if (!cartao.ok) {
      throw new Error("Cartão");
    }

    await servidor.vincular(cartao.cartao.id, baralho.baralho.id);
    cartaoIds.push(cartao.cartao.id);
  }

  return { id: baralho.baralho.id, cartaoIds };
}

/** Programa uma Rotina para todos os dias (hoje sempre tem Compromisso). */
async function rotinaTodosOsDias(
  servidor: ClienteEmMemoria,
  baralhoId: string,
  extra: { quantidade?: number | null; dias?: number[] } = {},
) {
  numero += 1;

  const resultado = await servidor.salvarRotina({
    operacaoId: `semente-${numero}`,
    acao: "criar",
    baralhoId,
    dias: extra.dias ?? [1, 2, 3, 4, 5, 6, 7],
    quantidade: extra.quantidade ?? null,
    confirmarSobreposicao: true,
    fuso: FUSO,
  });

  if (!resultado.ok) {
    throw new Error(`Rotina: ${resultado.mensagem}`);
  }

  return resultado.rotina;
}

function entrarPelaTela(): void {
  fireEvent.change(screen.getByLabelText("Nome de usuário"), {
    target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: CREDENCIAL_DE_PROVA.senha },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

/**
 * Os clientes que a casca criou: a indisponibilidade simulada é **por cliente**,
 * e a casca troca de cliente ao Entrar — por isso a prova a aplica a todos.
 */
let clientesDaCasca: ClienteEmMemoria[] = [];

function simularIndisponibilidade(): void {
  for (const cliente of clientesDaCasca) {
    cliente.simularIndisponibilidade();
  }
}

function restaurarDisponibilidade(): void {
  for (const cliente of clientesDaCasca) {
    cliente.restaurarDisponibilidade();
  }
}

/** Renderiza a casca e entra, deixando a tela da rota atual pronta. */
async function abrir(servidor: ClienteEmMemoria, hash = "#/inicio") {
  window.location.hash = hash;
  clientesDaCasca = [];
  render(
    <Aplicacao
      criarCliente={(credencial) => {
        const cliente = servidor.comoUsuario(credencial);

        clientesDaCasca.push(cliente);

        return cliente;
      }}
    />,
  );
  await aguardarVerificacaoDoAcesso();
  entrarPelaTela();
}

function rotulosDosDias(): HTMLElement[] {
  return within(screen.getByRole("group", { name: "Sua semana" })).getAllByRole(
    "button",
    { pressed: undefined },
  ).filter((botao) => botao.hasAttribute("aria-pressed"));
}

describe("bloco da Agenda em Início (FR-227–FR-230, FR-240, FR-241)", () => {
  it("aparece antes da Revisão do dia e orienta Agendar estudo quando não há Rotinas", async () => {
    const servidor = clienteDeProva();

    await abrir(servidor);

    expect(
      await screen.findByText("Nenhum estudo agendado para hoje"),
    ).toBeInTheDocument();

    const agenda = screen.getByText("Agenda de estudo");
    const revisao = screen.getByText("Revisão do dia");

    expect(
      agenda.compareDocumentPosition(revisao) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Agendar estudo" })).toHaveAttribute(
      "href",
      "#/agenda/nova",
    );
    expect(screen.getByRole("link", { name: "Gerenciar agenda" })).toHaveAttribute(
      "href",
      "#/agenda",
    );
    expect(screen.getAllByText(`Fuso horário: ${FUSO}`).length).toBeGreaterThan(0);
  });

  it("mostra hoje, o calendário de sete dias e os estudos do dia selecionado", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id, { quantidade: 2 });
    await abrir(servidor);

    expect(await screen.findByText("0 de 1 estudo concluído")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuar estudos" }),
    ).toBeInTheDocument();

    const dias = rotulosDosDias();

    expect(dias).toHaveLength(7);

    const hoje = dias.filter((dia) => /hoje/.test(dia.getAttribute("aria-label") ?? ""));

    // Hoje tem nome acessível e está selecionado.
    expect(hoje).toHaveLength(1);
    expect(hoje[0]).toHaveAttribute("aria-pressed", "true");
    expect(hoje[0].getAttribute("aria-label")).toMatch(/Pendente/);

    const detalhes = screen.getByRole("region", { name: /\(hoje\)/ });

    expect(within(detalhes).getByText("Inglês")).toBeInTheDocument();
    expect(within(detalhes).getByText(/2 Cartões · Pendente/)).toBeInTheDocument();
    expect(
      within(detalhes).getByRole("button", { name: "Estudar Inglês" }),
    ).toBeInTheDocument();
  });

  it("selecionar outro dia não altera o resumo de hoje nem os dados (FR-230)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id);
    await abrir(servidor);
    await screen.findByText("0 de 1 estudo concluído");

    const dias = rotulosDosDias();
    const indiceDeHoje = dias.findIndex((dia) =>
      /hoje/.test(dia.getAttribute("aria-label") ?? ""),
    );
    // Um dia futuro da mesma semana, quando existir; senão, a semana seguinte.
    const outro = dias[indiceDeHoje + 1] ?? dias[indiceDeHoje - 1];

    fireEvent.click(outro);

    expect(outro).toHaveAttribute("aria-pressed", "true");
    expect(dias[indiceDeHoje]).toHaveAttribute("aria-pressed", "false");
    // O resumo de hoje continua sendo o de hoje.
    expect(screen.getByText("0 de 1 estudo concluído", { selector: "h2" })).toBeInTheDocument();
  });

  it("navega entre semanas mantendo o dia da semana e volta com Hoje (FR-228)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id);
    await abrir(servidor);
    await screen.findByText("0 de 1 estudo concluído");

    const intervalo = () =>
      document.querySelector(".agenda__intervalo")?.textContent ?? "";
    const atual = intervalo();

    fireEvent.click(screen.getByRole("button", { name: "Semana seguinte" }));
    await waitFor(() => expect(intervalo()).not.toBe(atual));

    const seguinte = intervalo();
    const selecionado = rotulosDosDias().find(
      (dia) => dia.getAttribute("aria-pressed") === "true",
    );

    expect(selecionado).toBeDefined();
    // Na semana seguinte, nada é «hoje» e todos os Compromissos estão programados.
    expect(
      rotulosDosDias().some((dia) => /hoje/.test(dia.getAttribute("aria-label") ?? "")),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    await waitFor(() => expect(intervalo()).toBe(atual));
    expect(seguinte).not.toBe(atual);
  });

  it("mostra «Agenda de hoje concluída» e Ver Sessão quando tudo foi concluído", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor, "Inglês", 2);
    const rotina = await rotinaTodosOsDias(servidor, ingles.id);
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
    const inicio = await servidor.iniciarCompromisso({
      rotinaId: rotina.id,
      data: hoje,
      fuso: FUSO,
    });

    if (!inicio.ok) {
      throw new Error("iniciar");
    }

    await servidor.registrarSessao({
      id: inicio.inicio.id,
      origem: "baralho",
      baralhoId: ingles.id,
      nomeDoBaralho: "Inglês",
      inicioAgendaId: inicio.inicio.id,
      itens: inicio.inicio.cartoes.map((cartao) => ({
        frente: cartao.frente,
        verso: cartao.verso,
        cartaoId: cartao.id,
        avaliacao: "bom" as const,
      })),
    });
    await abrir(servidor);

    expect(await screen.findByText("Agenda de hoje concluída")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continuar estudos" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ver Sessão de Inglês" })).toHaveAttribute(
      "href",
      `#/sessoes/${inicio.inicio.id}`,
    );
    // A Revisão do dia mantém contagem e mensagem próprias (FR-256).
    expect(screen.getByText("Revisão do dia")).toBeInTheDocument();
  });

  it("Baralho excluído deixa o Compromisso indisponível, sem Estudar, com Ajustar rotina (FR-243)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);
    const rotina = await rotinaTodosOsDias(servidor, ingles.id);

    await servidor.excluirBaralho(ingles.id);
    await abrir(servidor);

    expect(await screen.findByText("Baralho indisponível")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Estudar Inglês" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ajustar rotina de Inglês" })).toHaveAttribute(
      "href",
      `#/agenda/${rotina.id}/editar`,
    );
    // A indisponibilidade não reduz o total nem conclui o Compromisso.
    expect(
      screen.getByText("0 de 1 estudo concluído", { selector: "h2" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ajustar agenda" })).toBeInTheDocument();
  });
});

describe("falha e atualização da Agenda (FR-229, FR-240, FR-251)", () => {
  function clienteQueFalhaNaAgenda(): {
    cliente: ClienteDoAcervo;
    restaurar: () => void;
  } {
    const real = clienteDeProva();
    let falhando = true;
    const cliente = {
      obterEstatisticas: async () => ({
        ok: true as const,
        estatisticas: { cartoes: 0, baralhos: 0, registrosDaJanela: [], recentes: [] },
      }),
      obterResumoDaRevisao: async () => ({
        ok: true as const,
        resumo: { vencidos: 0, novosHoje: 0, total: 0 },
      }),
      obterAgenda: async (inicio: string, fuso: string) =>
        falhando
          ? {
              ok: false as const,
              erro: INDISPONIVEL,
              mensagem: "A Agenda não está disponível agora. Tente novamente.",
            }
          : real.obterAgenda(inicio, fuso),
    } as unknown as ClienteDoAcervo;

    return { cliente, restaurar: () => (falhando = false) };
  }

  it("falha ao carregar não vira zero nem «Tudo concluído», oferece Tentar novamente e mantém o resto", async () => {
    const { cliente, restaurar } = clienteQueFalhaNaAgenda();

    render(<PaginaDeInicio cliente={cliente} nomeDeUsuario="Ana" />);

    const alerta = await screen.findByText(
      "A Agenda não está disponível agora. Tente novamente.",
    );

    expect(alerta).toBeInTheDocument();
    expect(screen.queryByText("Nenhum estudo agendado para hoje")).toBeNull();
    expect(screen.queryByText("Agenda de hoje concluída")).toBeNull();
    // A Revisão do dia e as Estatísticas seguem acessíveis.
    expect(await screen.findByText("Nada para revisar hoje")).toBeInTheDocument();

    restaurar();

    const secao = screen.getByText("Agenda de estudo").closest("section");

    fireEvent.click(within(secao as HTMLElement).getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Nenhum estudo agendado para hoje")).toBeInTheDocument();
  });

  it("dados anteriores só ficam visíveis com a indicação de falha na atualização", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id);
    await abrir(servidor);
    await screen.findByText("0 de 1 estudo concluído");

    simularIndisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar agenda" }));

    expect(
      await screen.findByText(/Não foi possível atualizar a agenda/),
    ).toBeInTheDocument();
    // O que estava na tela permanece, mas marcado como possivelmente antigo.
    expect(screen.getByText("0 de 1 estudo concluído", { selector: "h2" })).toBeInTheDocument();
  });
});

describe("Sessão iniciada pela Agenda (FR-231–FR-236, FR-255)", () => {
  async function avaliarTudo(): Promise<void> {
    for (;;) {
      const revelar = screen.queryByRole("button", { name: "Revelar verso" });

      if (revelar === null) {
        return;
      }

      fireEvent.click(revelar);
      fireEvent.click(await screen.findByRole("button", { name: /^Bom/ }));
      await waitFor(() => undefined);
    }
  }

  it("Estudar abre a Sessão direto, conclui o Compromisso e Início passa a contar uma conclusão", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor, "Inglês", 3);

    await rotinaTodosOsDias(servidor, ingles.id, { quantidade: 2 });
    await abrir(servidor);

    fireEvent.click(await screen.findByRole("button", { name: "Continuar estudos" }));

    // Sessão direta: sem tela de quantidade, com os 2 Cartões escolhidos.
    expect(
      await screen.findByRole("heading", { level: 1, name: "Estudar Inglês" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade de Cartões")).toBeNull();
    expect(screen.getByLabelText("Item 1 de 2")).toBeInTheDocument();

    await avaliarTudo();

    expect(await screen.findByRole("heading", { name: "Sessão concluída" })).toBeInTheDocument();
    expect(
      await screen.findByText(/O estudo programado de hoje foi concluído/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Voltar para Início" }));

    expect(await screen.findByText("Agenda de hoje concluída")).toBeInTheDocument();
  });

  it("interromper pede confirmação, não registra nada e deixa o Compromisso pendente (FR-234)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id);
    await abrir(servidor);
    fireEvent.click(await screen.findByRole("button", { name: "Continuar estudos" }));
    await screen.findByRole("heading", { level: 1, name: "Estudar Inglês" });

    fireEvent.click(screen.getByRole("button", { name: "Interromper" }));

    const dialogo = await screen.findByRole("dialog");

    fireEvent.click(within(dialogo).getByRole("button", { name: "Interromper" }));

    expect(await screen.findByText("0 de 1 estudo concluído", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar estudos" })).toBeInTheDocument();

    const estatisticas = await servidor.obterEstatisticas(
      new Date(Date.now() - 86_400_000).toISOString(),
    );

    expect(estatisticas.ok && estatisticas.estatisticas.recentes).toEqual([]);
  });

  it("recarregar a Sessão da Agenda a abandona e volta a Início", async () => {
    const servidor = clienteDeProva();

    await abrir(servidor, "#/agenda/estudo");

    expect(
      await screen.findByRole("heading", { level: 2, name: "Agenda de estudo" }).catch(() => null),
    ).toBeNull();
    await waitFor(() => expect(window.location.hash).toBe("#/inicio"));
    expect(await screen.findByText(/Olá,/)).toBeInTheDocument();
  });

  it("falha ao registrar mantém o Resumo, oferece nova tentativa e não anuncia sucesso (FR-251)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor, "Inglês", 1);

    await rotinaTodosOsDias(servidor, ingles.id);
    await abrir(servidor);
    fireEvent.click(await screen.findByRole("button", { name: "Continuar estudos" }));
    await screen.findByRole("heading", { level: 1, name: "Estudar Inglês" });

    simularIndisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Revelar verso" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Bom/ }));

    const falha = await screen.findByRole("alert", { name: "Falha ao registrar a Sessão" });

    expect(falha).toBeInTheDocument();
    expect(screen.queryByText(/O estudo programado de hoje foi concluído/)).toBeNull();

    restaurarDisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Tentar registrar novamente" }));

    expect(
      await screen.findByText(/O estudo programado de hoje foi concluído/),
    ).toBeInTheDocument();
  });
});

describe("Gerenciar agenda (FR-237–FR-239, FR-242, FR-249, FR-251)", () => {
  it("lista as Rotinas com resumo e situação; pausar e retomar passam pelas confirmações", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id, { dias: [1, 4], quantidade: 20 });
    await abrir(servidor, "#/agenda");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Gerenciar agenda" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Inglês · segunda e quinta · 20 Cartões")).toBeInTheDocument();
    expect(screen.getByText(/Situação: Ativa/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para Início" })).toHaveAttribute(
      "href",
      "#/inicio",
    );
    expect(screen.getByRole("link", { name: "Agendar estudo" })).toHaveAttribute(
      "href",
      "#/agenda/nova",
    );

    const pausar = screen.getByRole("button", { name: "Pausar rotina de Inglês" });

    fireEvent.click(pausar);

    const dialogo = await screen.findByRole("dialog", { name: /Pausar a Rotina de Inglês\?/ });

    // O foco inicia na ação sem consequência.
    expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toHaveFocus();

    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText(/Situação: Ativa/)).toBeInTheDocument();

    fireEvent.click(pausar);
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Pausar Rotina" }),
    );

    expect(await screen.findByText("Rotina de Inglês pausada.")).toBeInTheDocument();
    expect(await screen.findByText(/Situação: Pausada/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retomar rotina de Inglês" }));

    expect(await screen.findByText("Rotina de Inglês retomada.")).toBeInTheDocument();
    expect(await screen.findByText(/Situação: Ativa/)).toBeInTheDocument();
  });

  it("excluir pede confirmação, tira a Rotina da lista e preserva o acervo", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id);
    await abrir(servidor, "#/agenda");
    await screen.findByText(/Inglês · segunda/);

    fireEvent.click(screen.getByRole("button", { name: "Excluir rotina de Inglês" }));

    const dialogo = await screen.findByRole("dialog", { name: /Excluir a Rotina de Inglês\?/ });

    expect(dialogo).toHaveTextContent(/não pode ser desfeito/);

    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir Rotina" }));

    expect(await screen.findByText("Você ainda não tem Rotinas de estudo.")).toBeInTheDocument();
    expect((await servidor.listarBaralhos()).ok).toBe(true);

    const cartoes = await servidor.listarCartoes();

    expect(cartoes.ok && cartoes.cartoes).toHaveLength(3);
  });

  it("Escape fecha a confirmação e devolve o foco ao acionador (FR-252)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id);
    await abrir(servidor, "#/agenda");
    await screen.findByText(/Inglês · segunda/);

    const excluir = screen.getByRole("button", { name: "Excluir rotina de Inglês" });

    excluir.focus();
    fireEvent.click(excluir);
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(excluir).toHaveFocus());
    expect(screen.getByText(/Inglês · segunda/)).toBeInTheDocument();
  });

  it("falha ao carregar oferece Tentar novamente sem confundir com lista vazia (FR-240)", async () => {
    const servidor = clienteDeProva();

    await abrir(servidor, "#/inicio");
    await screen.findByText(/Olá,/);
    simularIndisponibilidade();
    window.location.hash = "#/agenda";

    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.queryByText("Você ainda não tem Rotinas de estudo.")).toBeNull();

    restaurarDisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Você ainda não tem Rotinas de estudo.")).toBeInTheDocument();
  });
});

describe("formulário Agendar estudo e Editar rotina (FR-222–FR-226, FR-242, FR-249)", () => {
  function marcarDia(nome: string): void {
    fireEvent.click(screen.getByRole("checkbox", { name: nome }));
  }

  it("começa com Todos os Cartões e nenhum dia; valida campo a campo, focando e preservando o resto", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor, "Inglês", 30);

    await abrir(servidor, "#/agenda/nova");
    await screen.findByRole("heading", { level: 1, name: "Agendar estudo" });
    await screen.findByLabelText("Baralho");

    expect(screen.getByRole("radio", { name: "Todos os Cartões" })).toBeChecked();
    expect(screen.getAllByRole("checkbox").every((c) => !(c as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole("option", { name: "Inglês (30 Cartões)" })).toBeInTheDocument();

    const enviar = () => fireEvent.click(screen.getByRole("button", { name: "Salvar agendamento" }));

    enviar();
    expect(await screen.findByText("Escolha um Baralho para a Rotina.")).toBeInTheDocument();
    expect(screen.getByLabelText("Baralho")).toHaveFocus();

    fireEvent.change(screen.getByLabelText("Baralho"), { target: { value: ingles.id } });
    enviar();
    expect(await screen.findByText("Escolha ao menos um dia da semana.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "segunda-feira" })).toHaveFocus();

    marcarDia("segunda-feira");
    marcarDia("quinta-feira");
    fireEvent.click(screen.getByRole("radio", { name: "Definir quantidade" }));
    fireEvent.change(screen.getByLabelText("Quantos Cartões por estudo"), { target: { value: "0" } });
    enviar();

    expect(await screen.findByText(/número inteiro de 1 a 999/)).toBeInTheDocument();
    expect(screen.getByLabelText("Quantos Cartões por estudo")).toHaveFocus();
    // Os demais valores foram preservados.
    expect(screen.getByLabelText("Baralho")).toHaveValue(ingles.id);
    expect(screen.getByRole("checkbox", { name: "quinta-feira" })).toBeChecked();

    fireEvent.change(screen.getByLabelText("Quantos Cartões por estudo"), { target: { value: "20" } });

    expect(document.querySelector("[data-resumo]")).toHaveTextContent(
      "Inglês · segunda e quinta · 20 Cartões",
    );

    enviar();

    // Salvar leva a Gerenciar agenda, com o resumo e o aviso de salvamento.
    expect(await screen.findByRole("heading", { level: 1, name: "Gerenciar agenda" })).toBeInTheDocument();
    expect(await screen.findByText(/Rotina de Inglês criada: Inglês · segunda e quinta · 20 Cartões/)).toBeInTheDocument();
    expect(window.location.hash).toBe("#/agenda");
  });

  it("sem Baralho elegível orienta criar Baralho ou adicionar Cartões, sem oferecer Rotina inválida (FR-241)", async () => {
    const servidor = clienteDeProva();

    await servidor.criarBaralho({ nome: "Vazio" });
    await abrir(servidor, "#/agenda/nova");

    expect(await screen.findByText(/ainda não tem um Baralho com Cartões/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar Baralho" })).toHaveAttribute("href", "#/baralhos/novo");
    expect(screen.getByRole("link", { name: "Ir para Baralhos" })).toHaveAttribute("href", "#/baralhos");
    expect(screen.queryByRole("button", { name: "Salvar agendamento" })).toBeNull();
  });

  it("explica a duplicidade antes de confirmar e só então cria os estudos independentes (FR-226)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id, { dias: [1] });
    await abrir(servidor, "#/agenda/nova");
    await screen.findByRole("heading", { level: 1, name: "Agendar estudo" });
    await screen.findByLabelText("Baralho");

    fireEvent.change(screen.getByLabelText("Baralho"), { target: { value: ingles.id } });
    marcarDia("segunda-feira");
    fireEvent.click(screen.getByRole("button", { name: "Salvar agendamento" }));

    const dialogo = await screen.findByRole("dialog", { name: "Confirmar estudos independentes?" });

    expect(dialogo).toHaveTextContent(/Já existe uma Rotina ativa deste Baralho em segunda/);
    expect((await servidor.listarRotinas()).ok && (await servidor.listarRotinas())).toMatchObject({
      rotinas: [{}],
    });

    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar e salvar" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Gerenciar agenda" })).toBeInTheDocument();

    const lista = await servidor.listarRotinas();

    expect(lista.ok && lista.rotinas).toHaveLength(2);
  });

  it("falha ao salvar preserva o formulário e a nova tentativa não duplica a Rotina (FR-249, FR-251)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await abrir(servidor, "#/agenda/nova");
    await screen.findByRole("heading", { level: 1, name: "Agendar estudo" });
    await screen.findByLabelText("Baralho");

    fireEvent.change(screen.getByLabelText("Baralho"), { target: { value: ingles.id } });
    marcarDia("terça-feira");

    simularIndisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Salvar agendamento" }));

    expect(await screen.findByRole("alert", { name: "Falha ao salvar a Rotina" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "terça-feira" })).toBeChecked();
    expect(screen.getByLabelText("Baralho")).toHaveValue(ingles.id);
    expect(screen.getByRole("heading", { level: 1, name: "Agendar estudo" })).toBeInTheDocument();

    restaurarDisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Salvar agendamento" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Gerenciar agenda" })).toBeInTheDocument();

    const lista = await servidor.listarRotinas();

    expect(lista.ok && lista.rotinas).toHaveLength(1);
  });

  it("editar carrega os valores, avisa dos efeitos e cancelar com alterações pede descarte (FR-238, FR-242)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);
    const rotina = await rotinaTodosOsDias(servidor, ingles.id, { dias: [1, 4], quantidade: 20 });

    await abrir(servidor, `#/agenda/${rotina.id}/editar`);

    expect(await screen.findByRole("heading", { level: 1, name: "Editar rotina" })).toBeInTheDocument();
    await screen.findByLabelText("Baralho");
    expect(screen.getByRole("checkbox", { name: "segunda-feira" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "terça-feira" })).not.toBeChecked();
    expect(screen.getByLabelText("Quantos Cartões por estudo")).toHaveValue(20);
    expect(screen.getByText(/Dias removidos cancelam o estudo de hoje/)).toBeInTheDocument();
    expect(screen.getByText(/Sessões já iniciadas ainda poderão concluir/)).toBeInTheDocument();

    marcarDia("sexta-feira");
    fireEvent.click(screen.getByRole("link", { name: "Cancelar" }));

    const dialogo = await screen.findByRole("dialog", { name: "Descartar as alterações?" });

    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    // Continua no formulário, com o que foi digitado.
    expect(screen.getByRole("checkbox", { name: "sexta-feira" })).toBeChecked();
    // E a programação salva não mudou.
    const lista = await servidor.listarRotinas();

    expect(lista.ok && lista.rotinas[0].dias).toEqual([1, 4]);
  });

  it("alteração concorrente é comunicada, preserva o digitado e mostra os valores atuais (FR-249)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);
    const rotina = await rotinaTodosOsDias(servidor, ingles.id, { dias: [1], quantidade: 5 });

    await abrir(servidor, `#/agenda/${rotina.id}/editar`);
    await screen.findByRole("heading", { level: 1, name: "Editar rotina" });
    await screen.findByLabelText("Baralho");

    // Em outra aba, a Rotina é alterada.
    await servidor.salvarRotina({
      operacaoId: "outra-aba",
      acao: "editar",
      id: rotina.id,
      versao: rotina.versao,
      baralhoId: ingles.id,
      dias: [2],
      quantidade: 9,
      fuso: FUSO,
    });

    marcarDia("quarta-feira");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText(/A Rotina foi alterada em outro lugar/)).toBeInTheDocument();
    expect(screen.getByText(/Valores atuais: Inglês · terça · 9 Cartões/)).toBeInTheDocument();
    // O que foi digitado continua no formulário; nada foi sobrescrito.
    expect(screen.getByRole("checkbox", { name: "quarta-feira" })).toBeChecked();

    const atual = await servidor.listarRotinas();

    expect(atual.ok && atual.rotinas[0]).toMatchObject({ dias: [2], quantidade: 9 });

    fireEvent.click(screen.getByRole("button", { name: "Usar os valores atuais" }));

    expect(screen.getByRole("checkbox", { name: "terça-feira" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "quarta-feira" })).not.toBeChecked();
  });
});
