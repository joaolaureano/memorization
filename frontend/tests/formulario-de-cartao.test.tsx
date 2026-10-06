import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MENSAGEM_DE_INDISPONIBILIDADE } from "../src/acervo-cliente/cliente";
import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { LIMITE_DE_CARACTERES_DE_CARTAO } from "../src/acervo-cliente/validacao";
import {
  MOTIVO_DE_PENDENCIA,
  PaginaDoFormularioDeCartao,
} from "../src/ui/PaginaDoFormularioDeCartao";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";

let clienteDeTeste: ClienteEmMemoria;
let baralhoId: string;

beforeEach(async () => {
  clienteDeTeste = clienteDeProva();
  const baralho = await clienteDeTeste.criarBaralho({ nome: "Inglês" });
  if (!baralho.ok) throw new Error("Baralho de prova não criado");
  baralhoId = baralho.baralho.id;
  window.location.hash = `#/baralhos/${baralhoId}/cartoes/novo`;
});

/**
 * T1113 — criação e edição de Cartão na página do formulário
 * (specs/012-interface-visual-navegavel/tasks.md; FR-140, FR-141, FR-144,
 * FR-146, FR-147, FR-148, FR-153, FR-154, FR-155, FR-156).
 *
 * Reúne, sem perder cobertura, os casos que antes viviam na tela de lista: o
 * estado vazio (FR-043) agora vive em `pagina-de-cartoes.test.tsx` e os de
 * criação vêm de `pagina-de-cartoes.test.tsx`/`teclado-e-foco.test.tsx`/
 * `leitor-de-tela.test.tsx`; os de edição vêm de `editar-cartao.test.tsx` e
 * `teclado-e-foco-de-edicao.test.tsx`.
 *
 * A página é exercitada com o `ClienteEmMemoria`, sem servidor, e envolvida
 * pelo `ProvedorDeProtecaoDeSaida` (`comProtecaoDeSaida`), de que dependem a
 * confirmação de descarte e o bloqueio durante o salvamento.
 */

function campoDeFrente(): HTMLTextAreaElement {
  return screen.getByLabelText("Frente") as HTMLTextAreaElement;
}

function campoDeVerso(): HTMLTextAreaElement {
  return screen.getByLabelText("Verso") as HTMLTextAreaElement;
}

function formulario(): HTMLFormElement {
  // Ancora no campo Frente, e não no botão "Salvar": durante um salvamento o
  // botão passa a "Salvando…", mas o formulário continua sendo o mesmo.
  const elemento = campoDeFrente().closest("form");

  if (elemento === null) {
    throw new Error("Formulário não encontrado.");
  }

  return elemento;
}

describe("PaginaDoFormularioDeCartao — criação", () => {
  it("numera a Frente repetida e anuncia o texto final no detalhe do Baralho", async () => {
    const cliente = clienteDeTeste;
    const primeiro = await cliente.criarCartao(baralhoId, { frente: "To walk", verso: "Caminhar" });
    if (!primeiro.ok) throw new Error("não criou o primeiro Cartão");
    const { unmount } = render(comProtecaoDeSaida(
      <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={cliente} />, true,
    ));

    fireEvent.change(campoDeFrente(), { target: { value: "to walk" } });
    fireEvent.change(campoDeVerso(), { target: { value: "Andar" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`));
    unmount();

    render(comProtecaoDeSaida(<PaginaDoBaralho cliente={cliente} id={baralhoId} />, true));
    expect(await screen.findByText("to walk (2)")).toBeInTheDocument();
    expect(screen.getByText("Cartão criado: to walk (2).")).toHaveAttribute("role", "status");
  });

  it("cria o Cartão, anuncia e volta para a lista (FR-001, FR-140, FR-141)", async () => {
    const cliente = clienteDeTeste;

    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={cliente} />,
        true,
      ),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Criar cartão" }),
    ).toBeInTheDocument();

    fireEvent.change(campoDeFrente(), { target: { value: "To walk" } });
    fireEvent.change(campoDeVerso(), { target: { value: "Caminhar" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const cartoes = await cliente.listarCartoes();

    expect(cartoes.ok).toBe(true);

    if (cartoes.ok) {
      expect(cartoes.cartoes).toHaveLength(1);
      expect(cartoes.cartoes[0].frente).toBe("To walk");
      expect(cartoes.cartoes[0].verso).toBe("Caminhar");
    }

    expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`);
  });

  it("comunica a contagem e o limite durante a digitação (FR-053)", () => {
    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={clienteDeTeste} />,
        true,
      ),
    );

    expect(
      screen.queryByText(/faltam \d+ caracteres para o limite/i),
    ).not.toBeInTheDocument();

    fireEvent.change(campoDeFrente(), {
      target: { value: "x".repeat(950) },
    });

    expect(
      screen.getByText(`950 / ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Atenção: faltam 50 caracteres para o limite de ${LIMITE_DE_CARACTERES_DE_CARTAO}.`,
      ),
    ).toBeInTheDocument();
  });

  it("recusa de domínio exibe a mensagem do cliente, preserva o texto e foca o campo (FR-046, FR-055)", async () => {
    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={clienteDeTeste} />,
        true,
      ),
    );

    fireEvent.change(campoDeFrente(), { target: { value: "   " } });
    fireEvent.change(campoDeVerso(), { target: { value: "Caminhar" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await within(formulario()).findByRole("alert"),
    ).toHaveTextContent(/a frente do cartão não pode ficar vazia/i);
    expect(campoDeFrente()).toHaveValue("   ");
    expect(campoDeFrente()).toHaveFocus();
  });

  it("submete conteúdo acima do limite e exibe a recusa do cliente (FR-053)", async () => {
    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={clienteDeTeste} />,
        true,
      ),
    );

    const textoLongo = "x".repeat(1001);
    fireEvent.change(campoDeFrente(), { target: { value: textoLongo } });
    fireEvent.change(campoDeVerso(), { target: { value: "Caminhar" } });

    expect(
      screen.getByText(
        `Atenção: o texto excede o limite de ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres.`,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(
        `A frente do cartão deve ter no máximo ${LIMITE_DE_CARACTERES_DE_CARTAO} caracteres; a informada tem 1001.`,
      ),
    ).toBeInTheDocument();
    expect(campoDeFrente()).toHaveValue(textoLongo);
  });

  it("com o cliente indisponível, a falha é anunciada e o conteúdo permanece (FR-044, FR-045, SC-012)", async () => {
    const cliente = clienteDeTeste;

    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={cliente} />,
        true,
      ),
    );

    fireEvent.change(campoDeFrente(), { target: { value: "To walk" } });
    fireEvent.change(campoDeVerso(), { target: { value: "Caminhar" } });

    cliente.simularIndisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await within(formulario()).findByRole("alert"),
    ).toHaveTextContent(MENSAGEM_DE_INDISPONIBILIDADE);
    expect(campoDeFrente()).toHaveValue("To walk");
    expect(campoDeVerso()).toHaveValue("Caminhar");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
  });

  it("a nova tentativa reaproveita o conteúdo preservado (FR-045, SC-012)", async () => {
    const cliente = clienteDeTeste;

    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={cliente} />,
        true,
      ),
    );

    fireEvent.change(campoDeFrente(), { target: { value: "To walk" } });
    fireEvent.change(campoDeVerso(), { target: { value: "Caminhar" } });

    cliente.simularIndisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await within(formulario()).findByRole("alert");

    cliente.restaurarDisponibilidade();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const cartoes = await cliente.listarCartoes();

    expect(cartoes.ok).toBe(true);

    if (cartoes.ok) {
      expect(cartoes.cartoes).toHaveLength(1);
    }
  });

  it("formulário sujo pede confirmação de descarte ao sair (FR-148)", async () => {
    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={clienteDeTeste} />,
        true,
      ),
    );

    fireEvent.change(campoDeFrente(), { target: { value: "To walk" } });

    window.location.hash = "#/baralhos";

    const dialogo = await screen.findByRole("dialog");

    expect(dialogo).toHaveTextContent(/o texto digitado será perdido/i);
  });

  it("durante o salvamento, a navegação é bloqueada e o motivo é anunciado (FR-154)", async () => {
    const cliente = clienteDeTeste;
    const criarCartaoOriginal = cliente.criarCartao.bind(cliente);

    // O salvamento fica pendente até a prova liberar: é justamente enquanto
    // ele corre que a navegação precisa ficar parada.
    let liberarSalvamento: () => void = () => {};
    const salvamentoEmAndamento = new Promise<void>((resolver) => {
      liberarSalvamento = resolver;
    });

    cliente.criarCartao = async (donoId, dados) => {
      await salvamentoEmAndamento;
      return criarCartaoOriginal(donoId, dados);
    };

    // Hash conhecido antes da montagem: a URL restaurada pela proteção é
    // previsível.
    window.location.hash = `#/baralhos/${baralhoId}/cartoes/novo`;

    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={cliente} />,
        true,
      ),
    );

    fireEvent.change(campoDeFrente(), { target: { value: "To walk" } });
    fireEvent.change(campoDeVerso(), { target: { value: "Caminhar" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    // O salvamento está em andamento — o botão o anuncia e fica desabilitado.
    expect(screen.getByRole("button", { name: /salvando/i })).toBeDisabled();

    // Navegar agora é bloqueado, e o motivo é anunciado (FR-154).
    window.location.hash = "#/baralhos";

    expect(await screen.findByText(MOTIVO_DE_PENDENCIA)).toBeInTheDocument();
    expect(window.location.hash).toBe(`#/baralhos/${baralhoId}/cartoes/novo`);

    // Liberado o salvamento, a operação conclui e o Cartão é criado (FR-001).
    liberarSalvamento();

    await waitFor(() => {
      expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`);
    });

    const cartoes = await cliente.listarCartoes();

    expect(cartoes.ok).toBe(true);

    if (cartoes.ok) {
      expect(cartoes.cartoes).toHaveLength(1);
    }
  });
});

describe("PaginaDoFormularioDeCartao — edição", () => {
  it("recusa Frente conflitante, preserva os campos e não altera o Cartão", async () => {
    const cliente = clienteDeTeste;
    const original = await cliente.criarCartao(baralhoId, { frente: "To walk", verso: "Caminhar" });
    const outro = await cliente.criarCartao(baralhoId, { frente: "To run", verso: "Correr" });
    if (!original.ok || !outro.ok) throw new Error("não criou os Cartões");
    render(comProtecaoDeSaida(
      <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={cliente} id={outro.cartao.id} />, true,
    ));
    await screen.findByDisplayValue("To run");
    fireEvent.change(campoDeFrente(), { target: { value: "to walk" } });
    fireEvent.change(campoDeVerso(), { target: { value: "Andar" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/frente/i);
    expect(campoDeFrente()).toHaveValue("to walk");
    expect(campoDeFrente()).toHaveFocus();
    expect(campoDeVerso()).toHaveValue("Andar");
    const listado = await cliente.listarCartoes();
    if (!listado.ok) throw new Error("não listou os Cartões");
    expect(listado.cartoes.find((cartao) => cartao.id === outro.cartao.id)).toMatchObject({ frente: "To run", verso: "Correr" });
  });

  async function clienteComCartao(): Promise<{
    cliente: ClienteEmMemoria;
    id: string;
  }> {
    const cliente = clienteDeTeste;
    const cartao = await cliente.criarCartao(baralhoId, {
      frente: "To walk",
      verso: "Caminhar",
    });

    if (!cartao.ok) {
      throw new Error("a criação do Cartão deveria ser aceita");
    }

    return { cliente, id: cartao.cartao.id };
  }

  it("exibe os valores atuais, sem aviso de alcance (FR-005)", async () => {
    const cliente = clienteDeTeste;
    const cartao = await cliente.criarCartao(baralhoId, {
      frente: "To walk",
      verso: "Caminhar",
    });

    if (!cartao.ok) {
      throw new Error("a criação do Cartão deveria ser aceita");
    }

    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={cliente} id={cartao.cartao.id} />,
        true,
      ),
    );

    // Aguarda a carga terminar antes de fixar o título: o `<h1>` do
    // carregamento é substituído pelo da página já preenchida.
    await screen.findByDisplayValue("To walk");

    expect(
      screen.getByRole("heading", { level: 1, name: "Editar Cartão" }),
    ).toBeInTheDocument();
    expect(campoDeFrente()).toHaveValue("To walk");
    expect(campoDeVerso()).toHaveValue("Caminhar");
    // O alcance da alteração não é mais anunciado na edição.
    expect(screen.queryByText(/vinculado a/i)).toBeNull();
  });

  it("edita o Cartão e volta para a lista (FR-005, FR-006)", async () => {
    const { cliente, id } = await clienteComCartao();

    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={cliente} id={id} />,
        true,
      ),
    );

    await screen.findByDisplayValue("To walk");

    fireEvent.change(campoDeFrente(), { target: { value: "To run" } });
    fireEvent.change(campoDeVerso(), { target: { value: "Correr" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const cartoes = await cliente.listarCartoes();

    expect(cartoes.ok).toBe(true);

    if (cartoes.ok) {
      expect(cartoes.cartoes[0].frente).toBe("To run");
      expect(cartoes.cartoes[0].verso).toBe("Correr");
    }

    expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`);
  });

  it("Cancelar volta para a página anterior", async () => {
    const { cliente, id } = await clienteComCartao();
    const voltar = vi.spyOn(window.history, "back").mockImplementation(() => {});
    vi.spyOn(window.history, "length", "get").mockReturnValue(2);

    try {
      render(
        comProtecaoDeSaida(
          <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={cliente} id={id} />,
          true,
        ),
      );

      await screen.findByDisplayValue("To walk");

      expect(screen.queryByRole("link", { name: "Cancelar" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(voltar).toHaveBeenCalledTimes(1);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("Cancelar sem página anterior leva a Cartões", async () => {
    window.location.hash = `#/baralhos/${baralhoId}/cartoes/novo`;
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);

    try {
      render(
        comProtecaoDeSaida(
          <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={clienteDeTeste} />,
          true,
        ),
      );

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(window.location.hash).toBe(`#/baralhos/${baralhoId}`);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("Cartão inexistente apresenta não encontrado (FR-156)", async () => {
    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao baralhoId={baralhoId} cliente={clienteDeTeste} id="inexistente" />,
        true,
      ),
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Cartão não encontrado",
      }),
    ).toBeInTheDocument();
  });
});
