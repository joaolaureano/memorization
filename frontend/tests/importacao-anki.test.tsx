import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  ClienteDoAcervo,
  PreviaDeImportacao,
} from "../src/acervo-cliente/cliente";
import { PaginaDeImportacaoAnki } from "../src/ui/PaginaDeImportacaoAnki";
import { clienteDeProva } from "./apoio-de-prova";

const previa: PreviaDeImportacao = {
  baralhos: [
    {
      nome: "Inglês",
      cartoes: [
        { frente: "savvy", verso: "Astuto", tags: [], estado: "adicionado" },
        { frente: "savvy (2)", verso: "Esperto", tags: [], estado: "modificado" },
      ],
    },
  ],
  avisos: { notasIgnoradas: 0, conteudoIgnorado: 0 },
};

/** Cliente em memória com a prévia do Anki e confirmação espiável. */
function clienteComPrevia() {
  const preverImportacaoAnki: ClienteDoAcervo["preverImportacaoAnki"] = async () => ({ ok: true, previa });
  const confirmarImportacaoAnki = vi.fn<ClienteDoAcervo["confirmarImportacaoAnki"]>(async () => ({ ok: true }));
  const cliente = Object.assign(clienteDeProva(), { preverImportacaoAnki, confirmarImportacaoAnki });
  return { cliente, confirmarImportacaoAnki };
}

/** Envia o arquivo e espera a prévia aparecer. */
async function carregarPrevia(cliente: ClienteDoAcervo) {
  render(<PaginaDeImportacaoAnki cliente={cliente} />);
  const input = screen.getByLabelText("Arquivo .apkg");
  fireEvent.change(input, {
    target: { files: [new File(["conteudo"], "x.apkg")] },
  });
  await waitFor(() => expect(screen.getByText("savvy")).toBeInTheDocument());
}

/** Linhas de cartão da prévia (itens de lista que têm o botão Editar ou Concluir). */
function linhasDeCartao(): HTMLElement[] {
  return screen
    .getAllByRole("listitem")
    .filter((item) => within(item).queryByRole("button", { name: /^(Editar|Concluir)$/ }) !== null);
}

describe("importação Anki — edição de cartões", () => {
  it("adiciona várias tags ao cartão", async () => {
    const { cliente, confirmarImportacaoAnki } = clienteComPrevia();
    await carregarPrevia(cliente);

    const primeiro = linhasDeCartao()[0];
    fireEvent.click(within(primeiro).getByRole("button", { name: "Editar" }));

    const campoDeTags = within(primeiro).getByLabelText("Tags");
    fireEvent.change(campoDeTags, { target: { value: "verbos" } });
    fireEvent.keyDown(campoDeTags, { key: "Enter" });
    fireEvent.change(campoDeTags, { target: { value: "ingles" } });
    fireEvent.keyDown(campoDeTags, { key: "Enter" });

    expect(within(primeiro).getByRole("button", { name: "Remover tag verbos" })).toBeInTheDocument();
    expect(within(primeiro).getByRole("button", { name: "Remover tag ingles" })).toBeInTheDocument();

    fireEvent.click(within(primeiro).getByRole("button", { name: "Concluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));

    await waitFor(() => expect(confirmarImportacaoAnki).toHaveBeenCalledTimes(1));
    const [baralhos] = confirmarImportacaoAnki.mock.calls[0];
    expect(baralhos[0].cartoes[0].tags).toEqual(["verbos", "ingles"]);
  });

  it("volta ao estado original ao desfazer a edição", async () => {
    const { cliente } = clienteComPrevia();
    await carregarPrevia(cliente);

    const primeiro = linhasDeCartao()[0];
    fireEvent.click(within(primeiro).getByRole("button", { name: "Editar" }));
    const frente = within(primeiro).getByLabelText("Frente");

    fireEvent.change(frente, { target: { value: "savvy!" } });
    expect(within(primeiro).getByText("Modificado")).toBeInTheDocument();

    fireEvent.change(frente, { target: { value: "savvy" } });
    expect(within(primeiro).getByText("Adicionado")).toBeInTheDocument();
    expect(within(primeiro).queryByText("Modificado")).toBeNull();
  });

  it("mantém Modificado no cartão originalmente modificado ao desfazer a edição", async () => {
    const { cliente } = clienteComPrevia();
    await carregarPrevia(cliente);

    const segundo = linhasDeCartao()[1];
    fireEvent.click(within(segundo).getByRole("button", { name: "Editar" }));
    const frente = within(segundo).getByLabelText("Frente");

    fireEvent.change(frente, { target: { value: "savvy (2)!" } });
    expect(within(segundo).getByText("Modificado")).toBeInTheDocument();

    fireEvent.change(frente, { target: { value: "savvy (2)" } });
    expect(within(segundo).getByText("Modificado")).toBeInTheDocument();
  });
});
