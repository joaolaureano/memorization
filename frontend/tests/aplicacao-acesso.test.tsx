import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_ACESSO_EXPIRADO,
} from "../src/acervo-cliente/cliente";
import type { ClienteDoAcervo } from "../src/acervo-cliente/cliente";
import type { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { Aplicacao } from "../src/ui/Aplicacao";
import {
  CREDENCIAL_DE_PROVA,
  aguardarVerificacaoDoAcesso,
  clienteDeProva,
} from "./apoio-de-prova";

/**
 * T1812 — a carga da aplicação com `GET /acesso` (018; FR-290, FR-294, FR-301,
 * FR-305; SC-114, SC-118, SC-123): Acesso válido volta ao Início sem Entrar;
 * `acesso_expirado` leva a Entrar com a mensagem exata; `sem_acesso` leva a
 * Entrar; a falha do armazenamento não é expiração.
 */

beforeEach(() => {
  window.location.hash = "#/inicio";
});

afterEach(() => {
  cleanup();
});

function fabrica(servidor: ClienteEmMemoria) {
  return (credencial: Parameters<ClienteEmMemoria["comoUsuario"]>[0]) =>
    servidor.comoUsuario(credencial);
}

describe("carga da aplicação com Acesso temporário", () => {
  it("mostra «Verificando o acesso…» e nenhuma tela de Entrar antes de saber (FR-290)", () => {
    render(<Aplicacao criarCliente={fabrica(clienteDeProva())} />);

    expect(screen.getByText("Verificando o acesso…")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeNull();
  });

  it("com Acesso válido, abre o Início sem Entrar (FR-290, SC-114, SC-118)", async () => {
    const servidor = clienteDeProva();

    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });

    render(<Aplicacao criarCliente={fabrica(servidor)} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: `Olá, ${CREDENCIAL_DE_PROVA.nomeDeUsuario}`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Principal" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeNull();
  });

  it("sem Acesso, abre Entrar sem aviso algum (FR-290)", async () => {
    render(<Aplicacao criarCliente={fabrica(clienteDeProva())} />);
    await aguardarVerificacaoDoAcesso();

    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status", { name: "Saída concluída" })).toBeNull();
  });

  it("com Acesso expirado, abre Entrar com a mensagem exata (FR-294, SC-123)", async () => {
    const servidor = clienteDeProva();

    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });
    servidor.avancarRelogio(301_000);

    render(<Aplicacao criarCliente={fabrica(servidor)} />);

    const alerta = await screen.findByRole("alert", {
      name: "Credencial recusada",
    });

    expect(alerta).toHaveTextContent("Seu acesso expirou. Entre novamente.");
    expect(alerta).toHaveTextContent(MENSAGEM_DE_ACESSO_EXPIRADO);
    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("a falha do armazenamento não é expiração: oferece nova tentativa e preserva o Acesso (FR-301)", async () => {
    const servidor = clienteDeProva();

    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });

    let indisponivel = true;

    render(
      <Aplicacao
        criarCliente={(credencial) => {
          const cliente = servidor.comoUsuario(credencial);

          if (indisponivel) {
            cliente.simularIndisponibilidade();
          }

          return cliente;
        }}
      />,
    );

    expect(
      await screen.findByRole("alert", { name: "Falha ao verificar o acesso" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeNull();
    expect(servidor.temAcessoNoNavegador()).toBe(true);

    indisponivel = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: `Olá, ${CREDENCIAL_DE_PROVA.nomeDeUsuario}`,
      }),
    ).toBeInTheDocument();
  });

  it("o Acesso nunca aparece no endereço nem em campo visível da interface (FR-305)", async () => {
    const servidor = clienteDeProva();

    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });

    render(<Aplicacao criarCliente={fabrica(servidor)} />);
    await screen.findByRole("navigation", { name: "Principal" });

    // O valor simulado do Acesso é `acesso-<n>`: nada parecido está no endereço
    // nem no texto da tela.
    expect(window.location.href).not.toMatch(/acesso-\d/);
    expect(document.body.textContent).not.toMatch(/acesso-\d/);
    expect(
      Array.from(document.querySelectorAll("input")).every(
        (campo) => !/acesso-\d/.test(campo.value),
      ),
    ).toBe(true);
  });

  it("depois de Entrar com a continuidade marcada, a Senha não fica no cliente da página (FR-078, FR-089)", async () => {
    const criados: { credencial: unknown; usaAcesso: boolean | undefined }[] = [];
    const servidor = clienteDeProva();

    render(
      <Aplicacao
        criarCliente={(credencial, opcoes) => {
          criados.push({ credencial, usaAcesso: opcoes?.usaAcesso });

          return servidor.comoUsuario(credencial);
        }}
      />,
    );
    await aguardarVerificacaoDoAcesso();

    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByRole("navigation", { name: "Principal" });

    const ultimo = criados[criados.length - 1];

    expect(ultimo?.usaAcesso).toBe(true);
    expect(ultimo?.credencial).toBeNull();
    expect(JSON.stringify(criados)).not.toContain(CREDENCIAL_DE_PROVA.senha);
  });

  it("com a continuidade desmarcada, a Credencial fica só na memória da página (FR-089 revisado)", async () => {
    const criados: { credencial: unknown; usaAcesso: boolean | undefined }[] = [];
    const servidor = clienteDeProva();

    render(
      <Aplicacao
        criarCliente={(credencial, opcoes) => {
          criados.push({ credencial, usaAcesso: opcoes?.usaAcesso });

          return servidor.comoUsuario(credencial);
        }}
      />,
    );
    await aguardarVerificacaoDoAcesso();

    fireEvent.click(screen.getByLabelText("Continuar conectado neste navegador"));
    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByRole("navigation", { name: "Principal" });

    const ultimo = criados[criados.length - 1];

    expect(ultimo?.usaAcesso).toBe(false);
    expect(ultimo?.credencial).toEqual(CREDENCIAL_DE_PROVA);
    expect(servidor.temAcessoNoNavegador()).toBe(false);
  });
});

describe("expiração durante o uso e renovação por atividade", () => {
  /** Um cliente que conta as renovações pedidas pela casca. */
  function contandoRenovacoes(servidor: ClienteEmMemoria) {
    const renovacoes = { total: 0 };

    return {
      renovacoes,
      criarCliente: (
        credencial: Parameters<ClienteEmMemoria["comoUsuario"]>[0],
      ): ClienteDoAcervo => {
        const cliente = servidor.comoUsuario(credencial);
        const original = cliente.renovarAcesso.bind(cliente);

        cliente.renovarAcesso = async () => {
          renovacoes.total += 1;

          return await original();
        };

        return cliente;
      },
    };
  }

  /**
   * Para o relógio num instante conhecido, no lugar do que anda sozinho (o
   * padrão de toda prova, em `vitest.setup.ts`). A restauração é do próprio
   * `afterEach` global, e não de um `try/finally` em cada teste.
   */
  function congelarRelogio(): void {
    vi.useFakeTimers({ toFake: ["Date"], now: 1_700_000_000_000 });
  }

  /** Faz passar o tempo do relógio congelado. */
  function passar(milissegundos: number): void {
    vi.setSystemTime(Date.now() + milissegundos);
  }

  async function abrirComAcesso(servidor: ClienteEmMemoria) {
    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });
    const contagem = contandoRenovacoes(servidor);

    render(<Aplicacao criarCliente={contagem.criarCliente} />);
    await screen.findByRole("navigation", { name: "Principal" });

    // Esvazia efeitos passivos pendentes (instalação dos listeners e do
    // instante-base) antes de qualquer teste avançar o tempo congelado.
    await act(async () => {});

    return contagem.renovacoes;
  }

  it("teclado, clique e toque renovam o Acesso, no máximo uma vez a cada 60 s (FR-291, SC-124)", async () => {
    congelarRelogio();

    const servidor = clienteDeProva();
    const renovacoes = await abrirComAcesso(servidor);

    // Dentro dos primeiros 60 s, nenhuma interação renova.
    passar(30_000);
    fireEvent.keyDown(document.body, { key: "a" });
    fireEvent.click(document.body);
    expect(renovacoes.total).toBe(0);

    // A partir de 60 s, a primeira interação renova — e as seguintes, não.
    passar(31_000);
    fireEvent.keyDown(document.body, { key: "a" });
    fireEvent.click(document.body);
    fireEvent.touchStart(document.body);
    expect(renovacoes.total).toBe(1);

    // Outros 60 s depois, o toque renova de novo.
    passar(60_000);
    fireEvent.touchStart(document.body);
    expect(renovacoes.total).toBe(2);

    // Deixa as renovações pendentes assentarem.
    await act(async () => {});
  });

  it("sem nenhuma interação, nunca renova (FR-294)", async () => {
    const servidor = clienteDeProva();
    const renovacoes = await abrirComAcesso(servidor);

    // Sem interação não há o que esperar: só deixa assentar o que já estava em
    // curso na montagem, sem medir tempo.
    await act(async () => {});

    expect(renovacoes.total).toBe(0);
  });

  it("com a Credencial em memória, nenhuma renovação é pedida (018)", async () => {
    const servidor = clienteDeProva();
    const contagem = contandoRenovacoes(servidor);

    render(<Aplicacao criarCliente={contagem.criarCliente} />);
    await aguardarVerificacaoDoAcesso();

    fireEvent.click(screen.getByLabelText("Continuar conectado neste navegador"));
    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: CREDENCIAL_DE_PROVA.nomeDeUsuario },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: CREDENCIAL_DE_PROVA.senha },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("navigation", { name: "Principal" });

    fireEvent.click(document.body);

    expect(contagem.renovacoes.total).toBe(0);
  });

  it("a recusa por Acesso expirado numa operação leva a Entrar com a mensagem, sem concluir nada (FR-091 revisado, FR-294, SC-115)", async () => {
    const servidor = clienteDeProva();

    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });
    const baralho = await servidor.comoUsuario(null).criarBaralho({ nome: "Inglês" });
    if (!baralho.ok) throw new Error("Baralho não criado");
    await servidor.comoUsuario(null).criarCartao(baralho.baralho.id, {
      frente: "To walk",
      verso: "Caminhar",
    });

    render(<Aplicacao criarCliente={fabrica(servidor)} />);
    await screen.findByRole("navigation", { name: "Principal" });

    // O Acesso vence enquanto a pessoa está parada.
    servidor.avancarRelogio(301_000);

    fireEvent.click(screen.getByRole("link", { name: "Baralhos" }));

    const alerta = await screen.findByRole("alert", {
      name: "Credencial recusada",
    });

    expect(alerta).toHaveTextContent("Seu acesso expirou. Entre novamente.");
    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("To walk")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("a renovação recusada por expiração também leva a Entrar com a mensagem (FR-294)", async () => {
    congelarRelogio();

    const servidor = clienteDeProva();

    await abrirComAcesso(servidor);
    servidor.avancarRelogio(301_000);

    passar(301_000);
    fireEvent.keyDown(document.body, { key: "a" });

    expect(
      await screen.findByRole("alert", { name: "Credencial recusada" }),
    ).toHaveTextContent("Seu acesso expirou. Entre novamente.");
  });

  it("a falha do armazenamento na renovação não derruba o Acesso (FR-301)", async () => {
    congelarRelogio();

    const servidor = clienteDeProva();
    const renovacoes = await abrirComAcesso(servidor);

    servidor.simularIndisponibilidade();

    passar(61_000);
    fireEvent.click(document.body);
    // A renovação é pedida de forma síncrona; `act` deixa a falha dela
    // assentar antes de conferir que o Acesso segue valendo.
    await waitFor(() => expect(renovacoes.total).toBe(1));
    await act(async () => {});

    expect(
      screen.getByRole("navigation", { name: "Principal" }),
    ).toBeInTheDocument();
    expect(servidor.temAcessoNoNavegador()).toBe(true);
  });

  it("INDISPONIVEL é distinto de expiração no cliente simulado", async () => {
    const servidor = clienteDeProva();

    await servidor.entrar({ ...CREDENCIAL_DE_PROVA, continuarConectado: true });
    servidor.simularIndisponibilidade();

    expect(await servidor.obterAcesso()).toMatchObject({
      ok: false,
      erro: INDISPONIVEL,
    });
  });
});
