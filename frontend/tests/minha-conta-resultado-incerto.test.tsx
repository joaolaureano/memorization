import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { INDISPONIVEL } from "../src/acervo-cliente/cliente";
import type { ClienteDoAcervo, Credencial } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { SecaoMinhaConta } from "../src/ui/SecaoMinhaConta";
import { ProvedorDeProtecaoDeSaida } from "../src/ui/protecao-de-saida";

/**
 * T1717 — resultado incerto nos três componentes de ação (017; FR-280..FR-284,
 * SC-110): com a resposta perdida, a tela não anuncia sucesso nem falha antes
 * de verificar qual Credencial vale agora; sem como saber, oferece «Tentar
 * novamente» e «Ir para Entrar»; e a nova tentativa nunca aplica a mudança
 * duas vezes.
 */

const ANA: Credencial = { nomeDeUsuario: "ana.silva", senha: "senha-da-ana-1" };
const MUTACOES = ["alterarNomeDeUsuario", "trocarSenha", "excluirConta"];

let base: ClienteEmMemoria;
let aoSubstituirCredencial: Mock<(nova: Credencial) => void>;
let aoExcluirConta: Mock<() => void>;
let aoIrParaEntrar: Mock<() => void>;
let chamadasDeMutacao: string[];

beforeEach(() => {
  base = new ClienteEmMemoria(ANA, [ANA]);
  aoSubstituirCredencial = vi.fn<(nova: Credencial) => void>();
  aoExcluirConta = vi.fn<() => void>();
  aoIrParaEntrar = vi.fn<() => void>();
  chamadasDeMutacao = [];
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
});

/**
 * O cliente cuja resposta de cada ação **se perde**: com `aplicar`, a ação
 * chega ao servidor e é aplicada, mas a resposta é `indisponivel`; sem ele, nem
 * chega. Com `entrarFalha`, a verificação por `entrar` também falha.
 */
function comRespostaPerdida(opcoes: {
  aplicar: boolean;
  entrarFalha?: () => boolean;
}): ClienteDoAcervo {
  return new Proxy(base, {
    get(alvo, propriedade, receptor) {
      const valor = Reflect.get(alvo, propriedade, receptor) as unknown;

      if (typeof valor !== "function") {
        return valor;
      }

      const funcao = valor as (...argumentos: unknown[]) => Promise<unknown>;

      if (typeof propriedade === "string" && MUTACOES.includes(propriedade)) {
        return async (...argumentos: unknown[]) => {
          chamadasDeMutacao.push(propriedade);

          if (opcoes.aplicar) {
            await funcao.apply(alvo, argumentos);
          }

          return { ok: false, erro: INDISPONIVEL, mensagem: "resposta perdida" };
        };
      }

      if (propriedade === "entrar" && opcoes.entrarFalha?.() === true) {
        return async () => ({
          ok: false,
          erro: INDISPONIVEL,
          mensagem: "fora do ar",
        });
      }

      return funcao.bind(alvo);
    },
  }) as ClienteDoAcervo;
}

function renderizar(cliente: ClienteDoAcervo): void {
  render(
    <ProvedorDeProtecaoDeSaida temCredencial>
      <SecaoMinhaConta
        cliente={cliente}
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

async function enviarNome(): Promise<void> {
  await abrir("Alterar Nome de usuário");
  digitar("Novo Nome de usuário", "ana.nova");
  digitar("Senha atual", ANA.senha);
  fireEvent.click(
    screen.getByRole("button", { name: "Alterar Nome de usuário" }),
  );
}

async function enviarSenha(): Promise<void> {
  await abrir("Trocar Senha");
  digitar("Senha atual", ANA.senha);
  digitar("Nova Senha", "outra-senha-9");
  digitar("Confirmação da Senha", "outra-senha-9");
  fireEvent.click(screen.getByRole("button", { name: "Trocar Senha" }));
}

async function enviarExclusao(): Promise<HTMLElement> {
  await abrir("Excluir conta");

  const dialogo = await screen.findByRole("dialog", { name: "Excluir conta?" });

  fireEvent.change(within(dialogo).getByLabelText("Senha atual", { selector: "input" }), {
    target: { value: ANA.senha },
  });
  fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir conta" }));

  return dialogo;
}

describe("resposta perdida com a ação aplicada (FR-281)", () => {
  it("renomear: confirma pela Credencial nova e conclui como aplicada", async () => {
    renderizar(comRespostaPerdida({ aplicar: true }));
    await enviarNome();

    await waitFor(() =>
      expect(aoSubstituirCredencial).toHaveBeenCalledWith({
        nomeDeUsuario: "ana.nova",
        senha: ANA.senha,
      }),
    );
    expect(screen.queryByText(/Nada foi alterado/)).not.toBeInTheDocument();
  });

  it("trocar a Senha: confirma pela Credencial nova", async () => {
    renderizar(comRespostaPerdida({ aplicar: true }));
    await enviarSenha();

    await waitFor(() =>
      expect(aoSubstituirCredencial).toHaveBeenCalledWith({
        nomeDeUsuario: "ana.silva",
        senha: "outra-senha-9",
      }),
    );
  });

  it("excluir: a Credencial antiga recusada conclui como excluída", async () => {
    renderizar(comRespostaPerdida({ aplicar: true }));
    await enviarExclusao();

    await waitFor(() => expect(aoExcluirConta).toHaveBeenCalledTimes(1));
  });
});

describe("resposta perdida com a ação não aplicada (FR-281, FR-283)", () => {
  it("renomear: a Credencial antiga vale, a tela informa que nada mudou e mantém o digitado", async () => {
    renderizar(comRespostaPerdida({ aplicar: false }));
    await enviarNome();

    expect(await screen.findByText(/Nada foi alterado/)).toBeInTheDocument();
    expect(aoSubstituirCredencial).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Novo Nome de usuário", { selector: "input" })).toHaveValue(
      "ana.nova",
    );
    expect(await base.obterConta()).toMatchObject({
      ok: true,
      dados: { nomeDeUsuario: "ana.silva" },
    });
  });

  it("trocar a Senha e excluir informam que nada mudou", async () => {
    renderizar(comRespostaPerdida({ aplicar: false }));
    await enviarSenha();

    expect(await screen.findByText(/Nada foi alterado/)).toBeInTheDocument();

    cleanup();
    renderizar(comRespostaPerdida({ aplicar: false }));
    const dialogo = await enviarExclusao();

    expect(await within(dialogo).findByText(/Nada foi excluído/)).toBeInTheDocument();
    expect(aoExcluirConta).not.toHaveBeenCalled();
  });
});

describe("resultado desconhecido (FR-282)", () => {
  it("oferece Tentar novamente e Ir para Entrar, sem anunciar sucesso nem falha", async () => {
    renderizar(
      comRespostaPerdida({ aplicar: true, entrarFalha: () => true }),
    );
    await enviarNome();

    const alerta = await screen.findByRole("alert", {
      name: "Resultado desconhecido",
    });

    expect(alerta).toHaveTextContent(/Não foi possível confirmar/);
    expect(aoSubstituirCredencial).not.toHaveBeenCalled();
    expect(screen.queryByText(/Nada foi alterado/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ir para Entrar" }));

    expect(aoIrParaEntrar).toHaveBeenCalledTimes(1);
  });

  it("Tentar novamente repete a verificação, nunca a alteração (FR-283)", async () => {
    let falhando = true;

    renderizar(
      comRespostaPerdida({ aplicar: true, entrarFalha: () => falhando }),
    );
    await enviarNome();

    await screen.findByRole("alert", { name: "Resultado desconhecido" });
    expect(chamadasDeMutacao).toEqual(["alterarNomeDeUsuario"]);

    falhando = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() =>
      expect(aoSubstituirCredencial).toHaveBeenCalledWith({
        nomeDeUsuario: "ana.nova",
        senha: ANA.senha,
      }),
    );
    expect(chamadasDeMutacao).toEqual(["alterarNomeDeUsuario"]);
  });

  it("excluir com resultado desconhecido oferece as mesmas duas saídas", async () => {
    renderizar(
      comRespostaPerdida({ aplicar: false, entrarFalha: () => true }),
    );
    const dialogo = await enviarExclusao();

    expect(
      await within(dialogo).findByRole("alert", { name: "Resultado desconhecido" }),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByRole("button", { name: "Tentar novamente" }),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByRole("button", { name: "Ir para Entrar" }),
    ).toBeInTheDocument();
    expect(aoExcluirConta).not.toHaveBeenCalled();
  });
});

describe("duas páginas em paralelo (FR-284)", () => {
  it("a primeira alteração confirmada vence e a outra é recusada na próxima operação", async () => {
    const outraPagina = base.comoUsuario(ANA);

    await base.alterarNomeDeUsuario({
      senhaAtual: ANA.senha,
      novoNomeDeUsuario: "ana.primeira",
    });

    expect(
      await outraPagina.alterarNomeDeUsuario({
        senhaAtual: ANA.senha,
        novoNomeDeUsuario: "ana.segunda",
      }),
    ).toMatchObject({ ok: false, erro: "nao_autenticado" });
  });
});
