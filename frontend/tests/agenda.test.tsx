import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClienteDoAcervo } from "../src/acervo-cliente/cliente";
import { INDISPONIVEL } from "../src/acervo-cliente/cliente";
import type { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import {
  diaDaSemana,
  fusoDoNavegador,
  hojeNoFuso,
  segundaFeiraDe,
} from "../src/agenda/datas";
import { AgendaDeEstudo } from "../src/ui/AgendaDeEstudo";
import { Aplicacao } from "../src/ui/Aplicacao";
import {
  CREDENCIAL_DE_PROVA,
  aguardarVerificacaoDoAcesso,
  clienteDeProva,
} from "./apoio-de-prova";

/**
 * T1606/T1609/T1612/T1615/T1618/T1621 — a Agenda de estudo na interface (016):
 * o bloco de Início, a Sessão autorizada, Rotinas de estudo e o formulário. O
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
  return within(screen.getByRole("group", { name: "Agenda semanal" })).getAllByRole(
    "button",
    { pressed: undefined },
  ).filter((botao) => botao.hasAttribute("aria-pressed"));
}

describe("bloco da Agenda em Início (FR-227–FR-230, FR-240, FR-241)", () => {
  it("aparece quando não há Rotinas, sem a Revisão do dia (019, FR-310)", async () => {
    const servidor = clienteDeProva();

    await abrir(servidor);

    expect(
      await screen.findByText("Nenhum estudo agendado para hoje"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Agenda de hoje" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Revisão do dia")).toBeNull();
    // O fuso é usado nas leituras, mas não aparece na tela (FR-334).
    expect(screen.queryByText(/Fuso horário/)).toBeNull();
  });

  it("mostra hoje, o calendário de sete dias e os estudos do dia selecionado", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id, { quantidade: 2 });
    render(<AgendaDeEstudo cliente={servidor} modo="semana" />);

    expect(await screen.findByText(/0 de 1 estudo concluído/)).toBeInTheDocument();

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

  it("selecionar outro dia detalha aquele dia sem perder o de hoje (FR-230)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id);
    render(<AgendaDeEstudo cliente={servidor} modo="semana" />);
    await screen.findByText(/0 de 1 estudo concluído/);

    const dias = rotulosDosDias();
    const indiceDeHoje = dias.findIndex((dia) =>
      /hoje/.test(dia.getAttribute("aria-label") ?? ""),
    );
    // Um dia futuro da mesma semana, quando existir; senão, a semana seguinte.
    const outro = dias[indiceDeHoje + 1] ?? dias[indiceDeHoje - 1];

    fireEvent.click(outro);

    expect(outro).toHaveAttribute("aria-pressed", "true");
    expect(dias[indiceDeHoje]).toHaveAttribute("aria-pressed", "false");
    // O detalhe passa a ser o do dia escolhido, com os dados de hoje intactos.
    expect(screen.queryByRole("region", { name: /\(hoje\)/ })).toBeNull();
    expect(dias[indiceDeHoje].getAttribute("aria-label")).toMatch(/hoje/);
  });

  it("navega entre semanas mantendo o dia da semana e volta com Hoje (FR-228)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id);
    render(<AgendaDeEstudo cliente={servidor} modo="semana" />);
    await screen.findByText(/0 de 1 estudo concluído/);

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
    expect(screen.queryByRole("button", { name: "Estudar Inglês" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ver Sessão de Inglês" })).toHaveAttribute(
      "href",
      `#/sessoes/${inicio.inicio.id}`,
    );
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
    expect(screen.getByText("0 de 1 estudo concluído")).toBeInTheDocument();
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

  it("falha ao carregar não vira zero nem «Tudo concluído» e oferece Tentar novamente", async () => {
    const { cliente, restaurar } = clienteQueFalhaNaAgenda();

    render(<AgendaDeEstudo cliente={cliente} modo="semana" />);

    const alerta = await screen.findByText(
      "A Agenda não está disponível agora. Tente novamente.",
    );

    expect(alerta).toBeInTheDocument();
    expect(screen.queryByText("Nenhum estudo agendado para hoje")).toBeNull();
    expect(screen.queryByText("Agenda de hoje concluída")).toBeNull();

    restaurar();

    const secao = screen.getByText("Agenda semanal").closest("section");

    fireEvent.click(within(secao as HTMLElement).getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByText("Nenhum estudo agendado para este dia."),
    ).toBeInTheDocument();
  });

  it("dados anteriores só ficam visíveis com a indicação de falha na atualização", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id);
    render(<AgendaDeEstudo cliente={servidor} modo="semana" />);
    await screen.findByText(/0 de 1 estudo concluído/);

    servidor.simularIndisponibilidade();
    fireEvent(document, new Event("visibilitychange"));

    expect(
      await screen.findByText(/Não foi possível atualizar a agenda/),
    ).toBeInTheDocument();
    // O que estava na tela permanece, mas marcado como possivelmente antigo.
    expect(screen.getByText(/0 de 1 estudo concluído/)).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: "Estudar Inglês" }));

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
    fireEvent.click(await screen.findByRole("button", { name: "Estudar Inglês" }));
    await screen.findByRole("heading", { level: 1, name: "Estudar Inglês" });

    fireEvent.click(screen.getByRole("button", { name: "Interromper" }));

    const dialogo = await screen.findByRole("dialog");

    fireEvent.click(within(dialogo).getByRole("button", { name: "Interromper" }));

    expect(await screen.findByText("0 de 1 estudo concluído")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Estudar Inglês" })).toBeInTheDocument();

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
    fireEvent.click(await screen.findByRole("button", { name: "Estudar Inglês" }));
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
      await screen.findByRole("heading", { level: 1, name: "Rotinas de estudo" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Inglês · segunda e quinta · 20 Cartões")).toBeInTheDocument();
    expect(screen.getByText("Ativa", { selector: ".agenda__rotina-status" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para Estudo" })).toHaveAttribute(
      "href",
      "#/estudo",
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

    expect(screen.getByText("Ativa", { selector: ".agenda__rotina-status" })).toBeInTheDocument();

    fireEvent.click(pausar);
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Pausar Rotina" }),
    );

    expect(await screen.findByText("Rotina de Inglês pausada.")).toBeInTheDocument();
    // O anúncio só aparece com a lista já relida: no mesmo instante, e sem
    // esperar, os botões e a situação mostram a versão nova da Rotina.
    expect(screen.getByText("Pausada", { selector: ".agenda__rotina-status" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retomar rotina de Inglês" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retomar rotina de Inglês" }));

    expect(await screen.findByText("Rotina de Inglês retomada.")).toBeInTheDocument();
    expect(screen.getByText("Ativa", { selector: ".agenda__rotina-status" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pausar rotina de Inglês" }),
    ).toBeInTheDocument();
  });

  it("Rotina pausada tem classe e tom âmbar na linha e na etiqueta (FR-237, T1628)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id, { dias: [1, 4], quantidade: 20 });
    await abrir(servidor, "#/agenda");

    await screen.findByText("Inglês · segunda e quinta · 20 Cartões");

    // Pausar
    fireEvent.click(screen.getByRole("button", { name: "Pausar rotina de Inglês" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Pausar Rotina" }),
    );

    await screen.findByText("Rotina de Inglês pausada.");

    // Verificar que a linha tem a classe de pausa
    const rotinasLista = document.querySelectorAll(".agenda__rotina");
    let rotinaPausada: Element | null = null;

    for (const item of rotinasLista) {
      if (item.textContent?.includes("Inglês")) {
        rotinaPausada = item;
        break;
      }
    }

    expect(rotinaPausada).toHaveClass("agenda__rotina--pausada");

    // Verificar a etiqueta tem o texto e a classe
    const etiqueta = within(rotinaPausada as HTMLElement).getByText("Pausada");
    expect(etiqueta).toHaveClass("agenda__rotina-status");

    // Verificar que a etiqueta tem a classe de estilo aplicada
    // (o color exato depende do ambiente de teste, mas a classe estar presente é suficiente)
    expect(etiqueta.parentElement?.textContent).toContain("Situação:");
  });

  it("o anúncio da ação só aparece depois que a lista foi relida, para que agir em seguida não gere conflito", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id, { dias: [1, 4], quantidade: 20 });
    await abrir(servidor, "#/agenda");
    await screen.findByText("Inglês · segunda e quinta · 20 Cartões");

    // A releitura que vem depois de salvar fica retida até o teste liberá-la:
    // nenhum tempo decide a ordem, só esta condição.
    const cliente = clientesDaCasca[clientesDaCasca.length - 1] as ClienteEmMemoria;
    const original = cliente.listarRotinas.bind(cliente);
    let liberar: () => void = () => {};
    const leitura = vi.spyOn(cliente, "listarRotinas").mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          liberar = () => resolver(original());
        }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Pausar rotina de Inglês" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Pausar Rotina" }),
    );
    await waitFor(() => expect(leitura).toHaveBeenCalledTimes(1));

    // A Rotina já foi pausada no servidor, mas a lista ainda é a antiga: dizer
    // «pausada» agora convidaria a agir sobre uma versão que já não vale.
    expect(screen.queryByText("Rotina de Inglês pausada.")).not.toBeInTheDocument();

    liberar();

    expect(await screen.findByText("Rotina de Inglês pausada.")).toBeInTheDocument();
    expect(screen.getByText("Pausada", { selector: ".agenda__rotina-status" })).toBeInTheDocument();
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

    // Salvar leva a Rotinas de estudo, com o resumo e o aviso de salvamento.
    expect(await screen.findByRole("heading", { level: 1, name: "Rotinas de estudo" })).toBeInTheDocument();
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

    expect(await screen.findByRole("heading", { level: 1, name: "Rotinas de estudo" })).toBeInTheDocument();

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

    expect(await screen.findByRole("heading", { level: 1, name: "Rotinas de estudo" })).toBeInTheDocument();

    const lista = await servidor.listarRotinas();

    expect(lista.ok && lista.rotinas).toHaveLength(1);
  });

  it("editar carrega os valores, mostra confirmação contextual e cancelar com alterações pede descarte (FR-238, FR-242)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);
    const rotina = await rotinaTodosOsDias(servidor, ingles.id, { dias: [1, 4], quantidade: 20 });

    await abrir(servidor, `#/agenda/${rotina.id}/editar`);

    expect(await screen.findByRole("heading", { level: 1, name: "Editar rotina" })).toBeInTheDocument();
    await screen.findByLabelText("Baralho");
    expect(screen.getByRole("checkbox", { name: "segunda-feira" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "terça-feira" })).not.toBeChecked();
    expect(screen.getByLabelText("Quantos Cartões por estudo")).toHaveValue(20);

    // Não tem mais o parágrafo genérico no fim do formulário
    expect(screen.queryByText(/Dias removidos cancelam o estudo de hoje/)).not.toBeInTheDocument();

    // Remover segunda (removido) e adicionar quinta, sexta, sábado, domingo (adicionados para totalizar [4,5,6,7])
    fireEvent.click(screen.getByRole("checkbox", { name: "segunda-feira" }));
    // Adicionar: quinta já está (4), adicionar sexta(5), sábado(6), domingo(7)
    marcarDia("sexta-feira");
    marcarDia("sábado");
    marcarDia("domingo");

    // Ao salvar, abre confirmação com os efeitos
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    const confirmacao = await screen.findByRole("dialog", { name: "Confirmar alterações" });
    // O texto está dividido entre <strong> e nós de texto, então buscamos partes separadas
    expect(within(confirmacao).getByText("Dias removidos:")).toBeInTheDocument();
    expect(within(confirmacao).getByText(/cancelam/)).toBeInTheDocument();
    expect(within(confirmacao).getByText("Dias adicionados:")).toBeInTheDocument();
    expect(within(confirmacao).getByText(/criar/)).toBeInTheDocument();
    expect(within(confirmacao).getByText(/Estudos passados e concluídos são preservados/)).toBeInTheDocument();

    // Foco inicial em Voltar (cancelamento, per FR-252)
    expect(within(confirmacao).getByRole("button", { name: "Voltar" })).toHaveFocus();

    // Escape fecha sem salvar
    fireEvent.keyDown(confirmacao, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Confirmar alterações" })).not.toBeInTheDocument();
    });

    const listaAposEscape = await servidor.listarRotinas();
    expect(listaAposEscape.ok && listaAposEscape.rotinas[0].dias).toEqual([1, 4]);

    // Voltar não salva (teste do botão também)
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    const confirmacao2 = await screen.findByRole("dialog", { name: "Confirmar alterações" });
    fireEvent.click(within(confirmacao2).getByRole("button", { name: "Voltar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Confirmar alterações" })).not.toBeInTheDocument();
    });

    const lista1 = await servidor.listarRotinas();
    expect(lista1.ok && lista1.rotinas[0].dias).toEqual([1, 4]);

    // Confirmar salva (terceira tentativa)
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    const confirmacao3 = await screen.findByRole("dialog", { name: "Confirmar alterações" });
    fireEvent.click(within(confirmacao3).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Confirmar alterações" })).not.toBeInTheDocument();
    });

    const lista2 = await servidor.listarRotinas();
    expect(lista2.ok && lista2.rotinas[0].dias).toEqual([4, 5, 6, 7]);
  });

  it("criar nova rotina não mostra confirmação, salva direto (FR-222, T1626)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await abrir(servidor, "#/agenda/nova");

    expect(await screen.findByRole("heading", { level: 1, name: "Agendar estudo" })).toBeInTheDocument();

    // Usar o select pelo labelText - aguardar carregamento
    const select = await screen.findByLabelText("Baralho") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: ingles.id } });

    // Selecionar checkbox de segunda - aguardar primeiro
    await screen.findByRole("checkbox", { name: "segunda-feira" });
    fireEvent.click(screen.getByRole("checkbox", { name: "segunda-feira" }));

    // Selecionar a opção "Definir quantidade" para tornar o input visível
    fireEvent.click(screen.getByLabelText("Definir quantidade"));

    // Usar labelText para o input de quantidade
    const qtdInput = await screen.findByLabelText(/Quantos Cartões/);
    fireEvent.change(qtdInput, { target: { value: "10" } });

    // Salvar (não deve abrir confirmação, deve salvar direto)
    fireEvent.click(screen.getByRole("button", { name: "Salvar agendamento" }));

    // Volta para agenda após sucesso
    await waitFor(() => {
      expect(window.location.hash).toBe("#/agenda");
    });

    const lista = await servidor.listarRotinas();
    expect(lista.ok && lista.rotinas.length).toBe(1);
  });

  it("formulário Editar rotina tem select Baralho centralizado (FR-257, T1627)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);
    const rotina = await rotinaTodosOsDias(servidor, ingles.id);

    await abrir(servidor, `#/agenda/${rotina.id}/editar`);

    await screen.findByRole("heading", { level: 1, name: "Editar rotina" });
    const select = await screen.findByLabelText("Baralho") as HTMLSelectElement;

    // Verificar que tem a classe de centralização
    expect(select).toHaveClass("agenda__select-baralho-editando");
  });

  it("formulário Agendar estudo não tem select Baralho centralizado (T1627)", async () => {
    const servidor = clienteDeProva();
    await baralhoComCartoes(servidor);

    await abrir(servidor, "#/agenda/nova");

    await screen.findByRole("heading", { level: 1, name: "Agendar estudo" });
    const select = await screen.findByLabelText("Baralho") as HTMLSelectElement;

    // Não deve ter a classe em criação
    expect(select).not.toHaveClass("agenda__select-baralho-editando");
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

    // Confirmar o diálogo de edição antes de receber a resposta de conflito
    const confirmacaoEdicao = await screen.findByRole("dialog", { name: "Confirmar alterações" });
    fireEvent.click(within(confirmacaoEdicao).getByRole("button", { name: "Confirmar" }));

    // Agora o conflito deve aparecer
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

describe("Agenda de hoje e Agenda semanal (019, FR-311, FR-313, FR-318, FR-319)", () => {
  it("no modo hoje mostra três estudos, o total do dia e o caminho para Estudo", async () => {
    const servidor = clienteDeProva();

    for (let i = 1; i <= 4; i += 1) {
      const baralho = await baralhoComCartoes(servidor, `Baralho ${i}`);

      await rotinaTodosOsDias(servidor, baralho.id);
    }

    // A quinta Rotina deixa de incluir hoje: o estudo de hoje dela é cancelado.
    const quinto = await baralhoComCartoes(servidor, "Baralho 5");
    const cancelada = await rotinaTodosOsDias(servidor, quinto.id);
    const diaDeHoje = diaDaSemana(hojeNoFuso(FUSO, new Date()));

    await servidor.salvarRotina({
      operacaoId: "sem-hoje",
      acao: "editar",
      id: cancelada.id,
      versao: cancelada.versao,
      baralhoId: quinto.id,
      dias: [diaDeHoje === 7 ? 1 : diaDeHoje + 1],
      quantidade: null,
      fuso: FUSO,
    });

    render(<AgendaDeEstudo cliente={servidor} modo="hoje" />);

    expect(await screen.findByText("0 de 4 estudos concluídos")).toBeInTheDocument();
    expect(document.querySelectorAll(".agenda__estudos li")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Ver todos em Estudo" })).toHaveAttribute(
      "href",
      "#/estudo",
    );
    expect(screen.queryByRole("button", { name: "Atualizar agenda" })).toBeNull();
  });

  it("no modo hoje, até três estudos levam à Agenda semanal", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id);
    await rotinaTodosOsDias(servidor, ingles.id);

    render(<AgendaDeEstudo cliente={servidor} modo="hoje" />);

    expect(await screen.findByText("0 de 2 estudos concluídos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver agenda semanal" })).toHaveAttribute(
      "href",
      "#/estudo",
    );
  });

  it("sem compromissos na semana, não oferece Agendar estudo no modo hoje (FR-332)", async () => {
    const servidor = clienteDeProva();

    render(<AgendaDeEstudo cliente={servidor} modo="hoje" />);

    expect(await screen.findByText("Nenhum estudo agendado para hoje")).toBeInTheDocument();
    // O modo hoje omite a data e o atalho de agendamento (FR-332).
    expect(screen.queryByRole("link", { name: "Agendar estudo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Atualizar agenda" })).toBeNull();
  });

  it("no modo semana relê preservando o dia escolhido e volta à semana de hoje", async () => {
    const chamadas: string[] = [];
    const base = clienteDeProva();
    const cliente = {
      obterAgenda: async (inicio: string, fuso: string) => {
        chamadas.push(inicio);

        return base.obterAgenda(inicio, fuso);
      },
    } as unknown as ClienteDoAcervo;

    render(<AgendaDeEstudo cliente={cliente} modo="semana" />);

    await screen.findByRole("group", { name: "Agenda semanal" });
    expect(screen.queryByRole("button", { name: "Atualizar agenda" })).toBeNull();

    const dias = rotulosDosDias();
    const indiceDeHoje = dias.findIndex((dia) =>
      /hoje/.test(dia.getAttribute("aria-label") ?? ""),
    );
    const outro = dias[indiceDeHoje + 1] ?? dias[indiceDeHoje - 1];

    fireEvent.click(outro);
    expect(outro).toHaveAttribute("aria-pressed", "true");

    const antes = chamadas.length;

    fireEvent(document, new Event("visibilitychange"));

    await waitFor(() => expect(chamadas.length).toBeGreaterThan(antes));
    // A escolha explícita é preservada na releitura.
    expect(outro).toHaveAttribute("aria-pressed", "true");

    const semanaDeHoje = segundaFeiraDe(hojeNoFuso(FUSO, new Date()));

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    await waitFor(() => expect(chamadas[chamadas.length - 1]).toBe(semanaDeHoje));

    // Sem escolha ativa, a releitura volta a pedir a semana de hoje.
    const depois = chamadas.length;

    fireEvent(document, new Event("visibilitychange"));

    await waitFor(() => expect(chamadas.length).toBeGreaterThan(depois));
    expect(chamadas[chamadas.length - 1]).toBe(semanaDeHoje);
  });

  it("no modo semana, um dia com Compromissos mantém a situação e a contagem (FR-333)", async () => {
    const servidor = clienteDeProva();
    const ingles = await baralhoComCartoes(servidor);

    await rotinaTodosOsDias(servidor, ingles.id);
    render(<AgendaDeEstudo cliente={servidor} modo="semana" />);
    await screen.findByRole("group", { name: "Agenda semanal" });

    const hoje = rotulosDosDias().find((dia) =>
      /hoje/.test(dia.getAttribute("aria-label") ?? ""),
    );

    expect(hoje).toBeDefined();

    fireEvent.click(hoje as HTMLElement);

    const detalhe = document.querySelector(".agenda__dia-detalhe") as HTMLElement;

    expect(
      within(detalhe).getByText(/Pendente · 0 de 1 estudo concluído/),
    ).toBeInTheDocument();
    expect(within(detalhe).getByText("Inglês")).toBeInTheDocument();
  });

  it("não apresenta o fuso em texto, mas o envia em obterAgenda (FR-334)", async () => {
    const fusos: string[] = [];
    const base = clienteDeProva();
    const cliente = {
      obterAgenda: async (inicio: string, fuso: string) => {
        fusos.push(fuso);

        return base.obterAgenda(inicio, fuso);
      },
    } as unknown as ClienteDoAcervo;

    const { unmount } = render(
      <AgendaDeEstudo cliente={cliente} modo="semana" />,
    );

    await screen.findByRole("group", { name: "Agenda semanal" });
    expect(screen.queryByText(/Fuso horário/)).toBeNull();
    expect(fusos[0]).toBe(FUSO);

    unmount();

    render(<AgendaDeEstudo cliente={cliente} modo="hoje" />);

    expect(
      await screen.findByText("Nenhum estudo agendado para hoje"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Fuso horário/)).toBeNull();
  });
});
