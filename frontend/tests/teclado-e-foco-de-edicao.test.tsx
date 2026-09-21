import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClienteEmMemoria } from "../src/acervo-cliente/cliente-em-memoria";
import { PaginaDeCartoes } from "../src/ui/PaginaDeCartoes";
import { PaginaDoBaralho } from "../src/ui/PaginaDoBaralho";

/**
 * T408 — edição, salvamento e descarte de Cartão e de Baralho apenas por
 * teclado (specs/005-editar-cartao-e-baralho/tasks.md, FR-067).
 *
 * O jsdom não executa o comportamento padrão de Tab nem de Enter; os
 * auxiliares reproduzem esses comportamentos, sempre disparando antes o evento
 * de teclado real. A prova cobre os três verbos de FR-067 em cada entidade:
 * editar, salvar e confirmar descarte — com o foco indo ao campo recusado
 * quando a Interface recusa o conteúdo e voltando ao botão da entidade depois
 * de fechar a edição.
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

  if (elemento instanceof HTMLButtonElement) {
    fireEvent.click(elemento);
  }
}

async function criarCartao(): Promise<ClienteEmMemoria> {
  const cliente = new ClienteEmMemoria();
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
  const cliente = new ClienteEmMemoria();
  const baralho = await cliente.criarBaralho({ nome: "Inglês" });

  if (!baralho.ok) {
    throw new Error("a criação do Baralho deveria ser aceita");
  }

  return { cliente, idDoBaralho: baralho.baralho.id };
}

describe("edição por teclado", () => {
  it("edita um Cartão, salva, confirma descarte e foca o campo recusado só por teclado (FR-067)", async () => {
    const cliente = await criarCartao();

    render(<PaginaDeCartoes cliente={cliente} />);

    await screen.findByText("To walk");

    // Abre a edição percorrendo a ordem de tabulação: Frente, Verso, Criar
    // Cartão e, então, Editar.
    const botaoEditar = screen.getByRole("button", { name: "Editar" });

    apertarTab();
    apertarTab();
    apertarTab();
    apertarTab();

    expect(document.activeElement).toBe(botaoEditar);
    apertarEnter(botaoEditar);

    const campoDeFrente = (await screen.findByLabelText(
      "Frente do Cartão",
    )) as HTMLTextAreaElement;

    expect(campoDeFrente).toHaveFocus();

    // Recusa de domínio: o foco vai ao campo recusado e o conteúdo permanece.
    digitarPeloTeclado(campoDeFrente, "   ");
    apertarTab(); // Verso do Cartão
    apertarTab(); // Salvar alterações

    const botaoSalvar = screen.getByRole("button", {
      name: "Salvar alterações",
    });
    expect(document.activeElement).toBe(botaoSalvar);
    apertarEnter(botaoSalvar);

    expect(
      await screen.findByText(/a frente do cartão não pode ficar vazia/i),
    ).toBeInTheDocument();
    expect(campoDeFrente).toHaveFocus();
    expect(campoDeFrente).toHaveValue("   ");

    // Salva um conteúdo válido pelo teclado e volta ao botão Editar.
    digitarPeloTeclado(campoDeFrente, "To run");
    apertarTab(); // Verso do Cartão
    apertarTab(); // Salvar alterações

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );
    apertarEnter(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    expect(await screen.findByText("Cartão editado.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Editar" })).toHaveFocus();
    });
    expect(screen.getByText("To run")).toBeInTheDocument();

    // Sai de uma edição suja e confirma o descarte no diálogo por teclado.
    const botaoEditarAposSalvar = screen.getByRole("button", {
      name: "Editar",
    });
    apertarEnter(botaoEditarAposSalvar);

    const campoDeFrenteSujo = (await screen.findByLabelText(
      "Frente do Cartão",
    )) as HTMLTextAreaElement;

    expect(campoDeFrenteSujo).toHaveFocus();
    digitarPeloTeclado(campoDeFrenteSujo, "To sprint");
    apertarTab(); // Verso do Cartão
    apertarTab(); // Salvar alterações
    apertarTab(); // Cancelar

    const botaoCancelar = screen.getByRole("button", { name: "Cancelar" });
    expect(document.activeElement).toBe(botaoCancelar);
    apertarEnter(botaoCancelar);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent(/alterações não salvas neste Cartão/i);

    const botaoContinuar = screen.getByRole("button", {
      name: "Continuar editando",
    });
    expect(document.activeElement).toBe(botaoContinuar);

    apertarTab();
    const botaoDescartar = screen.getByRole("button", {
      name: "Descartar alterações",
    });
    expect(document.activeElement).toBe(botaoDescartar);
    apertarEnter(botaoDescartar);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Frente do Cartão")).not.toBeInTheDocument();
    expect(screen.getByText("To run")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toHaveFocus();
  });

  it("renomeia um Baralho, salva, confirma descarte e foca o campo recusado só por teclado (FR-067)", async () => {
    const { cliente, idDoBaralho } = await criarBaralho();

    render(<PaginaDoBaralho cliente={cliente} id={idDoBaralho} />);

    await screen.findByRole("heading", { level: 1, name: "Inglês" });

    // Abre a renomeação na ordem de tabulação: Voltar, Estudar, Renomear.
    const botaoRenomear = screen.getByRole("button", { name: "Renomear" });

    apertarTab();
    apertarTab();
    apertarTab();

    expect(document.activeElement).toBe(botaoRenomear);
    apertarEnter(botaoRenomear);

    const campoDeNome = (await screen.findByLabelText(
      "Nome",
    )) as HTMLInputElement;

    expect(campoDeNome).toHaveFocus();

    // Recusa de domínio: o foco vai ao campo recusado e o conteúdo permanece.
    digitarPeloTeclado(campoDeNome, "   ");
    apertarTab(); // Salvar alterações

    const botaoSalvar = screen.getByRole("button", {
      name: "Salvar alterações",
    });
    expect(document.activeElement).toBe(botaoSalvar);
    apertarEnter(botaoSalvar);

    expect(
      await screen.findByText(/o nome do baralho não pode ficar vazio/i),
    ).toBeInTheDocument();
    expect(campoDeNome).toHaveFocus();
    expect(campoDeNome).toHaveValue("   ");

    // Salva um nome válido pelo teclado e volta ao botão Renomear.
    digitarPeloTeclado(campoDeNome, "Idiomas");
    apertarTab(); // Salvar alterações

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );
    apertarEnter(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Idiomas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Baralho renomeado.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Renomear" })).toHaveFocus();
    });

    // Sai de uma renomeação suja e confirma o descarte no diálogo por teclado.
    const botaoRenomearAposSalvar = screen.getByRole("button", {
      name: "Renomear",
    });
    apertarEnter(botaoRenomearAposSalvar);

    const campoDeNomeSujo = (await screen.findByLabelText(
      "Nome",
    )) as HTMLInputElement;

    expect(campoDeNomeSujo).toHaveFocus();
    digitarPeloTeclado(campoDeNomeSujo, "Idiomas alterado");
    apertarTab(); // Salvar alterações
    apertarTab(); // Cancelar

    const botaoCancelar = screen.getByRole("button", { name: "Cancelar" });
    expect(document.activeElement).toBe(botaoCancelar);
    apertarEnter(botaoCancelar);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent(/alterações não salvas neste Baralho/i);

    const botaoContinuar = screen.getByRole("button", {
      name: "Continuar editando",
    });
    expect(document.activeElement).toBe(botaoContinuar);

    apertarTab();
    const botaoDescartar = screen.getByRole("button", {
      name: "Descartar alterações",
    });
    expect(document.activeElement).toBe(botaoDescartar);
    apertarEnter(botaoDescartar);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Idiomas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Renomear" })).toHaveFocus();
  });
});
