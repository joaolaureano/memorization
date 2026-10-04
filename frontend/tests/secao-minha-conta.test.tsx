import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { MENSAGEM_DE_SENHA_ATUAL_INCORRETA } from "../src/acervo-cliente/cliente";
import type { ClienteDoAcervo, Credencial } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { PaginaDePreferencias } from "../src/ui/PaginaDePreferencias";
import { SecaoMinhaConta } from "../src/ui/SecaoMinhaConta";
import { ProvedorDeProtecaoDeSaida } from "../src/ui/protecao-de-saida";

/**
 * T1712, T1713, T1715, T1716, T2006 — a seção «Minha conta» e os seus
 * componentes de Trocar Senha e Excluir conta (017; FR-257..FR-279, FR-285),
 * sobre o stand-in em memória, que aplica as regras da API com as mesmas
 * mensagens. O Nome de usuário é somente leitura (FR-336).
 */

const ANA: Credencial = { nomeDeUsuario: "ana.silva", senha: "senha-da-ana-1" };
const BRUNO: Credencial = {
  nomeDeUsuario: "bruno.souza",
  senha: "senha-do-bruno-1",
};

let cliente: ClienteEmMemoria;
let aoSubstituirCredencial: Mock<(nova: Credencial) => void>;
let aoExcluirConta: Mock<() => void>;
let aoIrParaEntrar: Mock<() => void>;

beforeEach(() => {
  cliente = new ClienteEmMemoria(ANA, [ANA, BRUNO]);
  aoSubstituirCredencial = vi.fn<(nova: Credencial) => void>();
  aoExcluirConta = vi.fn<() => void>();
  aoIrParaEntrar = vi.fn<() => void>();
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
});

function renderizar(clienteDaTela: ClienteDoAcervo = cliente): void {
  render(
    <ProvedorDeProtecaoDeSaida temCredencial>
      <SecaoMinhaConta
        cliente={clienteDaTela}
        aoSubstituirCredencial={aoSubstituirCredencial}
        aoExcluirConta={aoExcluirConta}
        aoIrParaEntrar={aoIrParaEntrar}
      />
    </ProvedorDeProtecaoDeSaida>,
  );
}

function digitar(rotulo: string, valor: string): void {
  fireEvent.change(screen.getByLabelText(rotulo, { selector: "input" }), {
    target: { value: valor },
  });
}

async function abrir(acao: string): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: acao }));
}

describe("SecaoMinhaConta (FR-257, FR-258)", () => {
  it("mostra o Nome de usuário somente leitura e as ações restantes (FR-336)", async () => {
    renderizar();

    expect(await screen.findByText("ana.silva")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Minha conta" }),
    ).toBeInTheDocument();
    for (const nome of ["Trocar Senha", "Excluir conta"]) {
      expect(screen.getByRole("button", { name: nome })).toBeInTheDocument();
    }

    // FR-336: nenhum botão, link ou formulário permite alterar o Nome de
    // usuário — ele é só exibido.
    expect(screen.queryByRole("button", { name: /Alterar Nome/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Alterar Nome/ })).toBeNull();
    expect(
      screen.queryByRole("form", { name: /Alterar Nome/ }),
    ).toBeNull();
    expect(screen.queryByLabelText("Novo Nome de usuário")).toBeNull();
    expect(document.body.textContent).not.toContain(ANA.senha);
    expect(document.querySelectorAll("input")).toHaveLength(0);
  });

  it("falha de carregamento oferece nova tentativa sem esconder a seção", async () => {
    cliente.simularIndisponibilidade();
    renderizar();

    expect(
      await screen.findByRole("alert", { name: "Falha ao carregar a conta" }),
    ).toBeInTheDocument();

    cliente.restaurarDisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("ana.silva")).toBeInTheDocument();
  });

  it("integra-se às Preferências sem criar destino de navegação", async () => {
    render(
      <ProvedorDeProtecaoDeSaida temCredencial>
        <PaginaDePreferencias
          cliente={cliente}
          aoSubstituirCredencial={aoSubstituirCredencial}
          aoExcluirConta={aoExcluirConta}
          aoIrParaEntrar={aoIrParaEntrar}
        />
      </ProvedorDeProtecaoDeSaida>,
    );

    expect(await screen.findByText("Minha conta")).toBeInTheDocument();
    expect(await screen.findByLabelText("Cartões novos por dia")).toBeInTheDocument();
  });

  it("Preferências sem os callbacks não mostram a seção", async () => {
    render(
      <ProvedorDeProtecaoDeSaida temCredencial>
        <PaginaDePreferencias cliente={cliente} />
      </ProvedorDeProtecaoDeSaida>,
    );

    expect(await screen.findByLabelText("Cartões novos por dia")).toBeInTheDocument();
    expect(screen.queryByText("Minha conta")).not.toBeInTheDocument();
  });
});

describe("Trocar Senha (FR-266..FR-271)", () => {
  async function preencher(atual: string, nova: string, confirmacao: string) {
    await abrir("Trocar Senha");
    digitar("Senha atual", atual);
    digitar("Nova Senha", nova);
    digitar("Confirmação da Senha", confirmacao);
    fireEvent.click(screen.getByRole("button", { name: "Trocar Senha" }));
  }

  it("troca a Senha e entrega a nova Credencial", async () => {
    renderizar();
    await preencher(ANA.senha, "outra-senha-9", "outra-senha-9");

    await waitFor(() =>
      expect(aoSubstituirCredencial).toHaveBeenCalledWith({
        nomeDeUsuario: "ana.silva",
        senha: "outra-senha-9",
      }),
    );
    expect(await screen.findByText("Senha trocada.")).toBeInTheDocument();
  });

  it("Confirmação divergente leva o foco à Confirmação", async () => {
    renderizar();
    await preencher(ANA.senha, "outra-senha-9", "diferente-99");

    expect(await screen.findByRole("alert", { name: "Falha ao trocar a Senha" })).toHaveTextContent(
      /confirmação/i,
    );
    expect(
      screen.getByLabelText("Confirmação da Senha", { selector: "input" }),
    ).toHaveFocus();
  });

  it("recusa a mesma Senha e a Senha curta", async () => {
    renderizar();
    await preencher(ANA.senha, ANA.senha, ANA.senha);

    expect(await screen.findByText(/igual à atual/)).toBeInTheDocument();

    digitar("Nova Senha", "1234567");
    digitar("Confirmação da Senha", "1234567");
    fireEvent.click(screen.getByRole("button", { name: "Trocar Senha" }));

    expect(await screen.findByText(/entre 8 e 128/)).toBeInTheDocument();
  });

  it("Senha atual incorreta apaga os três campos de Senha", async () => {
    renderizar();
    await preencher("errada-123", "outra-senha-9", "outra-senha-9");

    expect(
      await screen.findByText(MENSAGEM_DE_SENHA_ATUAL_INCORRETA),
    ).toBeInTheDocument();
    for (const rotulo of ["Senha atual", "Nova Senha", "Confirmação da Senha"]) {
      expect(screen.getByLabelText(rotulo, { selector: "input" })).toHaveValue("");
    }
    expect(aoSubstituirCredencial).not.toHaveBeenCalled();
  });

  it("cada campo tem o seu Mostrar/Ocultar, mascarado por padrão (FR-271)", async () => {
    renderizar();
    await abrir("Trocar Senha");

    const campo = screen.getByLabelText("Nova Senha", { selector: "input" });

    expect(campo).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Mostrar Nova Senha" }));

    expect(campo).toHaveAttribute("type", "text");
    expect(screen.getAllByRole("button", { name: /^Mostrar / })).toHaveLength(2);
  });
});

describe("Excluir conta (FR-272..FR-279)", () => {
  async function abrirDialogo(): Promise<HTMLElement> {
    await abrir("Excluir conta");

    return await screen.findByRole("dialog", { name: "Excluir conta?" });
  }

  it("anuncia a irreversibilidade e as contagens do servidor", async () => {
    await cliente.criarCartao({ frente: "To walk", verso: "Caminhar" });
    await cliente.criarCartao({ frente: "To run", verso: "Correr" });
    await cliente.criarBaralho({ nome: "Inglês" });
    renderizar();

    const dialogo = await abrirDialogo();

    expect(dialogo).toHaveTextContent(/irreversível/);
    expect(within(dialogo).getByText("2 Cartões")).toBeInTheDocument();
    expect(within(dialogo).getByText("1 Baralho")).toBeInTheDocument();
    expect(within(dialogo).getByText("0 Registros de sessão")).toBeInTheDocument();
    expect(within(dialogo).getByText("0 itens da Agenda")).toBeInTheDocument();
  });

  it("só habilita Excluir conta com a Senha digitada", async () => {
    renderizar();
    const dialogo = await abrirDialogo();
    const confirmar = within(dialogo).getByRole("button", { name: "Excluir conta" });

    expect(confirmar).toBeDisabled();

    fireEvent.change(within(dialogo).getByLabelText("Senha atual", { selector: "input" }), {
      target: { value: "x" },
    });

    expect(confirmar).toBeEnabled();
  });

  it("Senha atual incorreta mantém o diálogo aberto, com a mensagem única", async () => {
    renderizar();
    const dialogo = await abrirDialogo();

    fireEvent.change(within(dialogo).getByLabelText("Senha atual", { selector: "input" }), {
      target: { value: "errada-123" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir conta" }));

    expect(
      await within(dialogo).findByText(MENSAGEM_DE_SENHA_ATUAL_INCORRETA),
    ).toBeInTheDocument();
    expect(aoExcluirConta).not.toHaveBeenCalled();
    expect(
      within(dialogo).getByLabelText("Senha atual", { selector: "input" }),
    ).toHaveValue("");
  });

  it("exclui com a Senha certa, avisa a casca e remove o Usuário sem tocar no outro", async () => {
    const bruno = cliente.comoUsuario(BRUNO);
    await bruno.criarCartao({ frente: "To run", verso: "Correr" });
    renderizar();
    const dialogo = await abrirDialogo();

    fireEvent.change(within(dialogo).getByLabelText("Senha atual", { selector: "input" }), {
      target: { value: ANA.senha },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir conta" }));

    await waitFor(() => expect(aoExcluirConta).toHaveBeenCalledTimes(1));
    expect(await bruno.obterConta()).toMatchObject({
      ok: true,
      dados: { contagens: { cartoes: 1 } },
    });
    expect(await cliente.obterConta()).toMatchObject({ ok: false });
  });

  it("Cancelar não exclui nada e devolve o foco ao botão", async () => {
    renderizar();
    const dialogo = await abrirDialogo();

    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Excluir conta" })).toHaveFocus(),
    );
    expect(aoExcluirConta).not.toHaveBeenCalled();
    expect(await cliente.obterConta()).toMatchObject({ ok: true });
  });

  it("não mostra a Agenda quando o servidor não a informa", async () => {
    const semAgenda: ClienteDoAcervo = Object.assign(
      Object.create(cliente) as ClienteDoAcervo,
      {
        obterConta: async () => ({
          ok: true as const,
          dados: {
            nomeDeUsuario: "ana.silva",
            contagens: {
              cartoes: 1,
              baralhos: 0,
              registrosDeSessao: 0,
              agenda: null,
            },
          },
        }),
      },
    );
    renderizar(semAgenda);

    const dialogo = await abrirDialogo();

    expect(dialogo).not.toHaveTextContent(/Agenda/);
  });
});
