import { act } from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ProvedorDeProtecaoDeSaida,
  useAcaoProtegida,
  useDescartarProtecao,
  useProtecaoDeSaida,
  useRotaExibida,
} from "../src/ui/protecao-de-saida";
import type { Protecao } from "../src/ui/protecao-de-saida";

/**
 * Proteção de saída (specs/012-interface-visual-navegavel/research.md §R4).
 *
 * A prova monta o `ProvedorDeProtecaoDeSaida` com uma "página" de teste que
 * declara a proteção e um observador que lê a rota de fato exibida. A navegação
 * é feita mudando `window.location.hash` e entregando o `hashchange`, como
 * faria o navegador — inclusive no Voltar.
 */

const PROTECAO_DE_DESCARTE: Protecao = {
  tipo: "descarte",
  titulo: "Descartar alterações?",
  descricao: "O que você digitou será perdido.",
  rotuloDeConfirmacao: "Descartar",
};

/** Outra proteção de descarte, com título distinto, para a troca de páginas. */
const PROTECAO_DE_DESCARTE_ALTERNATIVA: Protecao = {
  tipo: "descarte",
  titulo: "Descartar rascunho?",
  descricao: "O que você digitou será perdido.",
  rotuloDeConfirmacao: "Descartar",
};

const PROTECAO_DE_PENDENCIA: Protecao = {
  tipo: "pendencia",
  motivo: "Salvando… aguarde o fim da operação.",
};

beforeEach(() => {
  window.location.hash = "#/cartoes";
});

/** Muda o hash e entrega o `hashchange` que o navegador dispararia. */
function navegarPara(hash: string): void {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new Event("hashchange"));
  });
}

/** Lê a rota exibida, esteja a página protegida ou não. */
function Observador() {
  const rota = useRotaExibida();
  return <p data-testid="rota">{rota.nome}</p>;
}

interface PropsDaPaginaDeProva {
  protecao: Protecao | null;
  aoExecutar: () => void;
}

/** "Página" que declara a proteção e oferece os gatilhos de navegação. */
function PaginaDeProva({ protecao, aoExecutar }: PropsDaPaginaDeProva) {
  useProtecaoDeSaida(protecao);
  const proteger = useAcaoProtegida();
  const descartar = useDescartarProtecao();

  return (
    <>
      <button type="button" onClick={() => proteger(aoExecutar)}>
        Executar
      </button>
      <button type="button" onClick={descartar}>
        Limpar proteção
      </button>
    </>
  );
}

interface PropsDaProva {
  temCredencial?: boolean;
  protecao?: Protecao | null;
  aoExecutar?: () => void;
  comPagina?: boolean;
}

function Prova({
  temCredencial = true,
  protecao = null,
  aoExecutar = () => {},
  comPagina = true,
}: PropsDaProva) {
  return (
    <ProvedorDeProtecaoDeSaida temCredencial={temCredencial}>
      <Observador />
      {comPagina ? (
        <PaginaDeProva protecao={protecao} aoExecutar={aoExecutar} />
      ) : null}
    </ProvedorDeProtecaoDeSaida>
  );
}

describe("ProvedorDeProtecaoDeSaida", () => {
  it("sem proteção, aceita a navegação e atualiza a rota exibida", () => {
    render(<Prova />);

    expect(screen.getByTestId("rota")).toHaveTextContent("cartoes");

    navegarPara("#/baralhos");

    expect(screen.getByTestId("rota")).toHaveTextContent("baralhos");
    expect(window.location.hash).toBe("#/baralhos");
  });

  it("com descarte, abre o diálogo com título e descrição e foca Cancelar", () => {
    render(<Prova protecao={PROTECAO_DE_DESCARTE} />);

    navegarPara("#/baralhos");

    const dialogo = screen.getByRole("dialog");
    expect(
      within(dialogo).getByRole("heading", {
        name: "Descartar alterações?",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByText("O que você digitou será perdido."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("cancelar mantém a rota exibida e restaura o hash anterior", () => {
    render(<Prova protecao={PROTECAO_DE_DESCARTE} />);

    navegarPara("#/baralhos");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("rota")).toHaveTextContent("cartoes");
    expect(window.location.hash).toBe("#/cartoes");
  });

  it("confirmar descarta a proteção e navega", () => {
    render(<Prova protecao={PROTECAO_DE_DESCARTE} />);

    navegarPara("#/baralhos");
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("rota")).toHaveTextContent("baralhos");
    expect(window.location.hash).toBe("#/baralhos");
  });

  it("o Voltar do navegador é protegido do mesmo jeito", () => {
    render(<Prova protecao={PROTECAO_DE_DESCARTE} />);

    // O Voltar só muda o hash e entrega o `hashchange`: mesmo caminho do link.
    navegarPara("#/baralhos");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("rota")).toHaveTextContent("cartoes");
    expect(window.location.hash).toBe("#/cartoes");
  });

  it("com pendência, bloqueia sem diálogo e anuncia o motivo", () => {
    render(<Prova protecao={PROTECAO_DE_PENDENCIA} />);

    navegarPara("#/baralhos");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Salvando… aguarde o fim da operação.",
    );
    expect(screen.getByTestId("rota")).toHaveTextContent("cartoes");
    expect(window.location.hash).toBe("#/cartoes");
  });

  it("anuncia o mesmo motivo de pendência de novo, com um nó novo", () => {
    render(<Prova protecao={PROTECAO_DE_PENDENCIA} />);

    navegarPara("#/baralhos");
    const primeiroAviso = within(screen.getByRole("status")).getByText(
      "Salvando… aguarde o fim da operação.",
    );

    // Segunda saída bloqueada: mesmo motivo, mas precisa ser reanunciado.
    navegarPara("#/estudo");
    const segundoAviso = within(screen.getByRole("status")).getByText(
      "Salvando… aguarde o fim da operação.",
    );

    expect(segundoAviso).not.toBe(primeiroAviso);
  });

  it("mudar temCredencial recalcula a rota sem consultar a proteção", () => {
    const { rerender } = render(
      <Prova temCredencial={false} protecao={PROTECAO_DE_DESCARTE} />,
    );

    // Sem Credencial, toda rota resolve em "Entrar" (FR-097).
    expect(screen.getByTestId("rota")).toHaveTextContent("entrar");

    rerender(<Prova temCredencial={true} protecao={PROTECAO_DE_DESCARTE} />);

    expect(screen.getByTestId("rota")).toHaveTextContent("cartoes");
  });

  it("limpa a proteção ao desmontar a página", () => {
    const { rerender } = render(<Prova protecao={PROTECAO_DE_DESCARTE} />);

    rerender(<Prova protecao={PROTECAO_DE_DESCARTE} comPagina={false} />);
    navegarPara("#/baralhos");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("rota")).toHaveTextContent("baralhos");
  });

  it("trocar de página protegida mantém a proteção da nova página", () => {
    const { rerender } = render(
      <ProvedorDeProtecaoDeSaida temCredencial>
        <Observador />
        <PaginaDeProva
          key="primeira"
          protecao={PROTECAO_DE_DESCARTE}
          aoExecutar={() => {}}
        />
      </ProvedorDeProtecaoDeSaida>,
    );

    // A primeira página sai de cena e a segunda registra a proteção dela no
    // mesmo commit. A limpeza da primeira não pode apagar a da segunda.
    rerender(
      <ProvedorDeProtecaoDeSaida temCredencial>
        <Observador />
        <PaginaDeProva
          key="segunda"
          protecao={PROTECAO_DE_DESCARTE_ALTERNATIVA}
          aoExecutar={() => {}}
        />
      </ProvedorDeProtecaoDeSaida>,
    );

    navegarPara("#/baralhos");

    const dialogo = screen.getByRole("dialog");
    expect(
      within(dialogo).getByRole("heading", {
        name: "Descartar rascunho?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("rota")).toHaveTextContent("cartoes");
  });
});

describe("useAcaoProtegida", () => {
  it("sem proteção, roda a ação na hora", () => {
    const aoExecutar = vi.fn();
    render(<Prova aoExecutar={aoExecutar} />);

    fireEvent.click(screen.getByRole("button", { name: "Executar" }));

    expect(aoExecutar).toHaveBeenCalledTimes(1);
  });

  it("com descarte, só roda depois de confirmar", () => {
    const aoExecutar = vi.fn();
    render(<Prova protecao={PROTECAO_DE_DESCARTE} aoExecutar={aoExecutar} />);

    fireEvent.click(screen.getByRole("button", { name: "Executar" }));

    expect(aoExecutar).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(aoExecutar).toHaveBeenCalledTimes(1);
  });

  it("com pendência, anuncia o motivo e não roda", () => {
    const aoExecutar = vi.fn();
    render(<Prova protecao={PROTECAO_DE_PENDENCIA} aoExecutar={aoExecutar} />);

    fireEvent.click(screen.getByRole("button", { name: "Executar" }));

    expect(aoExecutar).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Salvando… aguarde o fim da operação.",
    );
  });
});

describe("useDescartarProtecao", () => {
  it("libera a próxima navegação", () => {
    render(<Prova protecao={PROTECAO_DE_DESCARTE} />);

    fireEvent.click(screen.getByRole("button", { name: "Limpar proteção" }));
    navegarPara("#/baralhos");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("rota")).toHaveTextContent("baralhos");
  });
});

describe("fora do provedor", () => {
  it("os hooks lançam um erro claro", () => {
    const silenciar = vi.spyOn(console, "error").mockImplementation(() => {});

    function ForaDoProvedor() {
      useRotaExibida();
      return null;
    }

    expect(() => render(<ForaDoProvedor />)).toThrow(
      /ProvedorDeProtecaoDeSaida/,
    );

    silenciar.mockRestore();
  });
});
