import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INDISPONIVEL,
  MENSAGEM_DE_INDISPONIBILIDADE_DE_PREFERENCIAS,
} from "../src/acervo-cliente/cliente";
import type {
  ClienteDoAcervo,
  Preferencias,
  ResultadoDePreferencias,
  ResultadoDeSalvarPreferencias,
} from "../src/acervo-cliente/cliente";
import { PaginaDePreferencias } from "../src/ui/PaginaDePreferencias";
import { ProvedorDeProtecaoDeSaida } from "../src/ui/protecao-de-saida";

const PREFERENCIAS_CARREGADAS: Preferencias = {
  algoritmo: "sm2",
  algoritmos: [
    {
      id: "sm2",
      rotulo: "SM-2",
      opcoesDeAvaliacao: [
        { chave: "errei", rotulo: "Errei", resultado: "errou" },
        { chave: "dificil", rotulo: "Difícil", resultado: "acertou" },
        { chave: "bom", rotulo: "Bom", resultado: "acertou" },
        { chave: "facil", rotulo: "Fácil", resultado: "acertou" },
      ],
    },
    {
      id: "outro",
      rotulo: "Outro",
      opcoesDeAvaliacao: [
        { chave: "errei", rotulo: "Errei", resultado: "errou" },
        { chave: "dificil", rotulo: "Difícil", resultado: "acertou" },
        { chave: "bom", rotulo: "Bom", resultado: "acertou" },
        { chave: "facil", rotulo: "Fácil", resultado: "acertou" },
      ],
    },
  ],
};

function copiarPreferencias(preferencias: Preferencias): Preferencias {
  return {
    ...preferencias,
    algoritmos: preferencias.algoritmos.map((opcao) => ({ ...opcao })),
  };
}

interface ClienteFalso {
  cliente: ClienteDoAcervo;
  obterPreferencias: ReturnType<typeof vi.fn>;
  salvarPreferencias: ReturnType<typeof vi.fn>;
}

function criarClienteFalso(): ClienteFalso {
  const obterPreferencias = vi.fn(
    async (): Promise<ResultadoDePreferencias> => ({
      ok: true,
      preferencias: copiarPreferencias(PREFERENCIAS_CARREGADAS),
    }),
  );

  const salvarPreferencias = vi.fn(
    async (dados: {
      algoritmo: string;
    }): Promise<ResultadoDeSalvarPreferencias> => ({
      ok: true,
      preferencias: { ...copiarPreferencias(PREFERENCIAS_CARREGADAS), ...dados },
    }),
  );

  const obterConta = vi.fn(async () => ({
    ok: true as const,
    dados: {
      nomeDeUsuario: "ana.silva",
      contagens: {
        cartoes: 0,
        baralhos: 0,
        registrosDeSessao: 0,
        agenda: null,
      },
    },
  }));

  const cliente = {
    obterPreferencias,
    salvarPreferencias,
    obterConta,
  } as unknown as ClienteDoAcervo;

  return { cliente, obterPreferencias, salvarPreferencias };
}

function renderizar(cliente: ClienteDoAcervo): void {
  render(
    <ProvedorDeProtecaoDeSaida temCredencial>
      <PaginaDePreferencias cliente={cliente} />
    </ProvedorDeProtecaoDeSaida>,
  );
}

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
});

describe("PaginaDePreferencias", () => {
  it("mostra o Perfil e carrega a Configuração existente (FR-335, FR-212)", async () => {
    const { cliente, obterPreferencias } = criarClienteFalso();

    renderizar(cliente);

    expect(
      screen.getByRole("heading", { level: 1, name: "Perfil" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Carregando Perfil…")).toBeInTheDocument();

    const algoritmo = await screen.findByLabelText(
      "Algoritmo de repetição espaçada",
    );
    expect(algoritmo).toHaveValue("sm2");
    expect(screen.getByRole("option", { name: "SM-2" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Configuração" }),
    ).toBeInTheDocument();
    // O limite de Cartões novos por dia saiu com a Revisão do dia.
    expect(screen.queryByLabelText("Cartões novos por dia")).toBeNull();
    expect(obterPreferencias).toHaveBeenCalledTimes(1);
  });

  it("mostra falha ao carregar e permite nova tentativa (FR-153, FR-156)", async () => {
    const { cliente, obterPreferencias } = criarClienteFalso();
    obterPreferencias.mockResolvedValueOnce({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_PREFERENCIAS,
    });

    renderizar(cliente);

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_PREFERENCIAS),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByLabelText("Algoritmo de repetição espaçada"),
    ).toHaveValue("sm2");
    expect(obterPreferencias).toHaveBeenCalledTimes(2);
  });

  it("salva a Configuração e confirma o sucesso (FR-212, FR-335)", async () => {
    const { cliente, salvarPreferencias } = criarClienteFalso();

    renderizar(cliente);

    const campo = await screen.findByLabelText("Algoritmo de repetição espaçada");
    fireEvent.change(campo, { target: { value: "outro" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Configuração salva.")).toBeInTheDocument();
    expect(salvarPreferencias).toHaveBeenCalledWith({ algoritmo: "outro" });
  });

  it("preserva o preenchimento quando o salvamento falha e permite nova tentativa (FR-155)", async () => {
    const { cliente, salvarPreferencias } = criarClienteFalso();
    salvarPreferencias.mockResolvedValueOnce({
      ok: false,
      erro: INDISPONIVEL,
      mensagem: MENSAGEM_DE_INDISPONIBILIDADE_DE_PREFERENCIAS,
    });

    renderizar(cliente);

    const campo = await screen.findByLabelText("Algoritmo de repetição espaçada");
    fireEvent.change(campo, { target: { value: "outro" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(MENSAGEM_DE_INDISPONIBILIDADE_DE_PREFERENCIAS),
    ).toBeInTheDocument();
    expect(campo).toHaveValue("outro");

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Configuração salva.")).toBeInTheDocument();
  });

  it("pede confirmação ao sair com alterações não salvas (FR-148)", async () => {
    const { cliente } = criarClienteFalso();

    renderizar(cliente);

    const campo = await screen.findByLabelText("Algoritmo de repetição espaçada");
    fireEvent.change(campo, { target: { value: "outro" } });

    window.location.hash = "#/inicio";
    window.dispatchEvent(new Event("hashchange"));

    expect(
      await screen.findByText("Descartar as alterações?"),
    ).toBeInTheDocument();
  });

  it("renderiza o Perfil com dois cartões irmãos, Configuração e Minha conta (FR-335)", async () => {
    const { cliente } = criarClienteFalso();

    render(
      <ProvedorDeProtecaoDeSaida temCredencial>
        <PaginaDePreferencias
          cliente={cliente}
          aoSubstituirCredencial={vi.fn()}
          aoExcluirConta={vi.fn()}
          aoIrParaEntrar={vi.fn()}
        />
      </ProvedorDeProtecaoDeSaida>,
    );

    await screen.findByLabelText("Algoritmo de repetição espaçada");
    await screen.findByText("ana.silva");

    const raiz = document.querySelector(".pagina.perfil");

    expect(raiz).not.toBeNull();

    const cartoes = Array.from(raiz?.children ?? []).filter((filho) =>
      filho.classList.contains("cartao"),
    );

    expect(cartoes).toHaveLength(2);
  });
});
