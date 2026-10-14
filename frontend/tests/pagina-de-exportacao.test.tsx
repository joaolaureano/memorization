import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProvedorDeIdioma } from "../src/idioma";
import { PaginaDeExportacao } from "../src/ui/PaginaDeExportacao";
import { clienteDeProva } from "./apoio-de-prova";

describe("Página de exportação", () => {
  it("mostra o baralho, formato localizado e prévia antes de gerar", async () => {
    const cliente = clienteDeProva();
    const criado = await cliente.criarBaralho({ nome: "Inglês" });
    if (!criado.ok) throw new Error("baralho recusado");
    await cliente.criarCartao(criado.baralho.id, { frente: "hello", verso: "olá" });

    render(<ProvedorDeIdioma idiomaInicial="pt"><PaginaDeExportacao cliente={cliente} baralhoId={criado.baralho.id} /></ProvedorDeIdioma>);

    expect(await screen.findByRole("heading", { name: "Exportar" })).toBeInTheDocument();
    expect(screen.getByText("Inglês · 1")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Pacote Anki (.apkg)" })).toBeChecked();
    expect(screen.getByText(/Importar progresso de estudo/)).toBeInTheDocument();
    expect(await screen.findByText("1 Baralhos · 1 Cartões")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar arquivo" })).toBeEnabled();
  });

  it("desabilita exportação sem Cartões e explica a seleção necessária", async () => {
    const cliente = clienteDeProva();
    const criado = await cliente.criarBaralho({ nome: "Vazio" });
    if (!criado.ok) throw new Error("baralho recusado");

    render(<ProvedorDeIdioma idiomaInicial="en"><PaginaDeExportacao cliente={cliente} baralhoId={criado.baralho.id} /></ProvedorDeIdioma>);

    expect(await screen.findByText("Select at least one deck with cards.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Anki package (.apkg)" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Export file" })).toBeDisabled();
  });

  it("leva o foco à falha de listagem e permite tentar de novo", async () => {
    const cliente = clienteDeProva();
    const criado = await cliente.criarBaralho({ nome: "Inglês" });
    if (!criado.ok) throw new Error("baralho recusado");
    cliente.simularIndisponibilidade();
    render(<ProvedorDeIdioma idiomaInicial="pt"><PaginaDeExportacao cliente={cliente} /></ProvedorDeIdioma>);

    const falha = await screen.findByRole("alert");
    await waitFor(() => expect(document.activeElement).toBe(falha));
    const tentarDeNovo = screen.getByRole("button", { name: "Tentar novamente" });
    expect(tentarDeNovo).toBeEnabled();
    cliente.restaurarDisponibilidade();
    fireEvent.click(tentarDeNovo);
    expect(await screen.findByRole("checkbox", { name: /Inglês/ })).toBeInTheDocument();
  });
});
