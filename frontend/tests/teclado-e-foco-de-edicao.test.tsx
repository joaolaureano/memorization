import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { clienteDeProva, comProtecaoDeSaida } from "./apoio-de-prova";
import { PaginaDoFormularioDeCartao } from "../src/ui/PaginaDoFormularioDeCartao";
import { PaginaDoFormularioDeBaralho } from "../src/ui/PaginaDoFormularioDeBaralho";

/**
 * T408 — edição, salvamento e descarte de Cartão e de Baralho apenas por
 * teclado (specs/005-editar-cartao-e-baralho/tasks.md, FR-067).
 *
 * O jsdom não executa o comportamento padrão de Tab nem de Enter; os
 * auxiliares reproduzem esses comportamentos, sempre disparando antes o evento
 * de teclado real. A prova cobre os três verbos de FR-067 em cada entidade:
 * editar, salvar e confirmar descarte — com o foco indo ao campo recusado
 * quando a Interface recusa o conteúdo. Depois da spec 012, a edição de cada
 * entidade acontece na página de formulário própria, e o descarte vem da
 * proteção de saída que envolve a tela (`comProtecaoDeSaida`).
 */

const SELETOR_DE_CONTROLES_INTERATIVOS = [
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function controlesInterativos(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(SELETOR_DE_CONTROLES_INTERATIVOS),
  );
}

/**
 * Aperta Tab como um navegador: dispara o evento de teclado no elemento focado
 * e avança o foco ao próximo controle na ordem de tabulação.
 */
function apertarTab(): void {
  const controles = controlesInterativos();
  const indice = controles.findIndex(
    (controle) => controle === document.activeElement,
  );
  const proximo = controles[(indice + 1) % controles.length];

  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" });
  proximo.focus();
}

/** Digita pelo teclado: um `keydown` por caractere e a atualização do valor. */
function digitarPeloTeclado(campo: HTMLElement, texto: string): void {
  for (const caractere of texto) {
    fireEvent.keyDown(campo, { key: caractere });
  }

  fireEvent.change(campo, { target: { value: texto } });
}

/**
 * Aperta Enter como um navegador: dispara o evento de teclado e executa o
 * comportamento padrão — a ativação do botão focado.
 */
function apertarEnter(elemento: HTMLElement): void {
  fireEvent.keyDown(elemento, { key: "Enter" });

  if (
    elemento instanceof HTMLButtonElement ||
    elemento instanceof HTMLAnchorElement
  ) {
    fireEvent.click(elemento);
  }
}

async function criarCartao(): Promise<ClienteEmMemoria> {
  const cliente = clienteDeProva();
  const cartao = await cliente.criarCartao({
    frente: "To walk",
    verso: "Caminhar",
  });

  if (!cartao.ok) {
    throw new Error("a criação do Cartão deveria ser aceita");
  }

  return cliente;
}

async function criarBaralho(): Promise<{
  cliente: ClienteEmMemoria;
  idDoBaralho: string;
}> {
  const cliente = clienteDeProva();
  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!baralho.ok) {
    throw new Error("a criação do Baralho deveria ser aceita");
  }

  return { cliente, idDoBaralho: baralho.baralho.id };
}

describe("edição por teclado", () => {
  it("edita um Cartão, salva e foca o campo recusado só por teclado (FR-067)", async () => {
    const cliente = await criarCartao();
    const cartao = await cliente.listarCartoes();

    if (!cartao.ok) {
      throw new Error("a listagem deveria ser aceita");
    }

    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeCartao
          cliente={cliente}
          id={cartao.cartoes[0].id}
        />,
        true,
      ),
    );

    // O foco inicial vai ao campo Frente, já com o valor atual preenchido.
    const campoDeFrente = (await screen.findByLabelText(
      "Frente",
    )) as HTMLTextAreaElement;

    await waitFor(() => {
      expect(campoDeFrente).toHaveFocus();
    });

    // Recusa de domínio: o foco vai ao campo recusado e o conteúdo permanece.
    digitarPeloTeclado(campoDeFrente, "   ");
    apertarTab(); // Verso
    apertarTab(); // Salvar

    const botaoSalvar = screen.getByRole("button", { name: "Salvar" });
    expect(document.activeElement).toBe(botaoSalvar);
    apertarEnter(botaoSalvar);

    expect(
      await screen.findByText(/a frente do cartão não pode ficar vazia/i),
    ).toBeInTheDocument();
    expect(campoDeFrente).toHaveFocus();
    expect(campoDeFrente).toHaveValue("   ");

    // Salva um conteúdo válido pelo teclado e volta para a lista.
    digitarPeloTeclado(campoDeFrente, "To run");
    apertarTab(); // Verso
    apertarTab(); // Salvar

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Salvar" }),
    );
    apertarEnter(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(window.location.hash).toBe("#/cartoes");
    });
  });

  it("renomeia um Baralho, salva, confirma descarte e foca o campo recusado só por teclado (FR-067, FR-159)", async () => {
    const { cliente, idDoBaralho } = await criarBaralho();

    // A renomeação acontece na página de formulário própria da spec 012; a
    // confirmação de descarte vem da proteção de saída que a envolve.
    render(
      comProtecaoDeSaida(
        <PaginaDoFormularioDeBaralho cliente={cliente} id={idDoBaralho} />,
        true,
      ),
    );

    await screen.findByRole("heading", { level: 1, name: "Renomear Baralho" });

    const campoDeNome = (await screen.findByLabelText(
      "Nome",
    )) as HTMLInputElement;

    // Sem foco automático, a ordem de tabulação sai do link Voltar e chega ao
    // campo Nome.
    apertarTab();
    apertarTab();

    expect(document.activeElement).toBe(campoDeNome);

    // Recusa de domínio: o foco vai ao campo recusado e o conteúdo permanece.
    digitarPeloTeclado(campoDeNome, "   ");
    apertarTab(); // Salvar

    const botaoSalvar = screen.getByRole("button", { name: "Salvar" });
    expect(document.activeElement).toBe(botaoSalvar);
    apertarEnter(botaoSalvar);

    expect(
      await screen.findByText(/o nome do baralho não pode ficar vazio/i),
    ).toBeInTheDocument();
    expect(campoDeNome).toHaveFocus();
    expect(campoDeNome).toHaveValue("   ");

    // Sai de uma renomeação suja: a navegação pela proteção de saída pede a
    // confirmação de descarte, operada só por teclado.
    digitarPeloTeclado(campoDeNome, "Idiomas alterado");
    apertarTab(); // Salvar
    apertarTab(); // Cancelar

    const linkCancelar = screen.getByRole("link", { name: "Cancelar" });
    expect(document.activeElement).toBe(linkCancelar);
    apertarEnter(linkCancelar);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent(/o nome digitado será perdido/i);

    // FR-159: o diálogo abre com o foco na ação sem consequência (Cancelar);
    // o descarte exige um Tab deliberado até "Descartar".
    const botaoCancelarDoDialogo = screen.getByRole("button", {
      name: "Cancelar",
    });
    expect(document.activeElement).toBe(botaoCancelarDoDialogo);

    apertarTab();

    const botaoDescartar = screen.getByRole("button", { name: "Descartar" });
    expect(document.activeElement).toBe(botaoDescartar);
    apertarEnter(botaoDescartar);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Salva um nome válido pelo teclado.
    digitarPeloTeclado(campoDeNome, "Idiomas");
    campoDeNome.focus();
    apertarTab(); // Salvar

    const botaoSalvarFinal = screen.getByRole("button", { name: "Salvar" });
    expect(document.activeElement).toBe(botaoSalvarFinal);
    apertarEnter(botaoSalvarFinal);

    await waitFor(async () => {
      const atual = await cliente.obterBaralho(idDoBaralho);

      expect(atual.ok).toBe(true);

      if (!atual.ok) {
        return;
      }

      expect(atual.baralho.nome).toBe("Idiomas");
    });
  });
});
