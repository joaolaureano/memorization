import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
    expect(await screen.findByText("1 Baralho · 1 Cartão")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar arquivo" })).toBeEnabled();
  });

  it("desabilita exportação sem Cartões e explica a seleção necessária", async () => {
    const cliente = clienteDeProva();
    const criado = await cliente.criarBaralho({ nome: "Vazio" });
    if (!criado.ok) throw new Error("baralho recusado");

    render(<ProvedorDeIdioma idiomaInicial="en"><PaginaDeExportacao cliente={cliente} baralhoId={criado.baralho.id} /></ProvedorDeIdioma>);

    expect(await screen.findByText("There are no cards to export.")).toBeInTheDocument();
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

  it("anuncia o carregamento inicial, sem o texto de tentar de novo", () => {
    const cliente = clienteDeProva();
    render(<ProvedorDeIdioma idiomaInicial="pt"><PaginaDeExportacao cliente={cliente} /></ProvedorDeIdioma>);

    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });

  it("mostra o estado de geração em role=status, desabilita o botão e ignora o segundo clique", async () => {
    const cliente = clienteDeProva();
    const criado = await cliente.criarBaralho({ nome: "Inglês" });
    if (!criado.ok) throw new Error("baralho recusado");
    await cliente.criarCartao(criado.baralho.id, { frente: "hello", verso: "olá" });
    let concluir!: () => void;
    const exportar = vi.spyOn(cliente, "exportar").mockImplementation(() => new Promise((resolver) => {
      concluir = () => resolver({ ok: true, url: "blob:prova", nomeDoArquivo: "Inglês.apkg", expiraEm: new Date().toISOString(), baralhos: 1, cartoes: 1, cartoesSemMidia: 0 });
    }));
    const navegar = vi.fn();

    render(<ProvedorDeIdioma idiomaInicial="pt"><PaginaDeExportacao cliente={cliente} baralhoId={criado.baralho.id} navegar={navegar} /></ProvedorDeIdioma>);

    const botao = await screen.findByRole("button", { name: "Exportar arquivo" });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    expect(await screen.findByRole("status")).toHaveTextContent("Gerando arquivo…");
    expect(screen.getByRole("button", { name: "Gerando arquivo…" })).toBeDisabled();
    fireEvent.click(botao);
    expect(exportar).toHaveBeenCalledTimes(1);

    concluir();
    expect(await screen.findByText("Arquivo pronto: Inglês.apkg")).toBeInTheDocument();
    expect(navegar).toHaveBeenCalledWith("blob:prova");
  });

  it("mostra o arquivo pronto, o link Baixar de novo e navega para a url pelo navegar injetado", async () => {
    const cliente = clienteDeProva();
    const criado = await cliente.criarBaralho({ nome: "Inglês" });
    if (!criado.ok) throw new Error("baralho recusado");
    await cliente.criarCartao(criado.baralho.id, { frente: "hello", verso: "olá" });
    vi.spyOn(cliente, "exportar").mockResolvedValue({ ok: true, url: "blob:pronto", nomeDoArquivo: "Inglês.apkg", expiraEm: new Date().toISOString(), baralhos: 1, cartoes: 1, cartoesSemMidia: 0 });
    const navegar = vi.fn();

    render(<ProvedorDeIdioma idiomaInicial="pt"><PaginaDeExportacao cliente={cliente} baralhoId={criado.baralho.id} navegar={navegar} /></ProvedorDeIdioma>);

    const botao = await screen.findByRole("button", { name: "Exportar arquivo" });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    expect(await screen.findByText("Arquivo pronto: Inglês.apkg")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar de novo" })).toHaveAttribute("href", "blob:pronto");
    expect(navegar).toHaveBeenCalledWith("blob:pronto");
  });

  it("mostra o aviso de cartões sem mídia quando a exportação traz cartoesSemMidia", async () => {
    const cliente = clienteDeProva();
    const criado = await cliente.criarBaralho({ nome: "Inglês" });
    if (!criado.ok) throw new Error("baralho recusado");
    await cliente.criarCartao(criado.baralho.id, { frente: "hello", verso: "olá" });
    vi.spyOn(cliente, "exportar").mockResolvedValue({ ok: true, url: "blob:parcial", nomeDoArquivo: "Inglês.apkg", expiraEm: new Date().toISOString(), baralhos: 1, cartoes: 3, cartoesSemMidia: 2 });

    render(<ProvedorDeIdioma idiomaInicial="pt"><PaginaDeExportacao cliente={cliente} baralhoId={criado.baralho.id} navegar={vi.fn()} /></ProvedorDeIdioma>);

    const botao = await screen.findByRole("button", { name: "Exportar arquivo" });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    expect(await screen.findByText("2 cartões foram exportados sem a mídia.")).toBeInTheDocument();
  });

  it("leva o foco à mensagem quando a exportação é recusada", async () => {
    const cliente = clienteDeProva();
    const criado = await cliente.criarBaralho({ nome: "Inglês" });
    if (!criado.ok) throw new Error("baralho recusado");
    await cliente.criarCartao(criado.baralho.id, { frente: "hello", verso: "olá" });
    vi.spyOn(cliente, "exportar").mockResolvedValue({ ok: false, erro: "exportacao_grande_demais", mensagem: "Limite de Cartões excedido." });
    const navegar = vi.fn();

    render(<ProvedorDeIdioma idiomaInicial="pt"><PaginaDeExportacao cliente={cliente} baralhoId={criado.baralho.id} navegar={navegar} /></ProvedorDeIdioma>);

    const botao = await screen.findByRole("button", { name: "Exportar arquivo" });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    const recusa = await screen.findByText("Limite de Cartões excedido.");
    await waitFor(() => expect(document.activeElement).toBe(recusa));
    expect(navegar).not.toHaveBeenCalled();
  });

  it("renderiza os textos em espanhol, com o plural correto", async () => {
    const cliente = clienteDeProva();
    const criado = await cliente.criarBaralho({ nome: "Inglés" });
    if (!criado.ok) throw new Error("baralho recusado");
    await cliente.criarCartao(criado.baralho.id, { frente: "hello", verso: "hola" });

    render(<ProvedorDeIdioma idiomaInicial="es"><PaginaDeExportacao cliente={cliente} baralhoId={criado.baralho.id} /></ProvedorDeIdioma>);

    expect(await screen.findByRole("heading", { name: "Exportar" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Paquete de Anki (.apkg)" })).toBeChecked();
    expect(await screen.findByText("1 mazo · 1 tarjeta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar archivo" })).toBeEnabled();
  });

  it("lista um checkbox por Baralho com o número de Cartões e controla todos pelo Todos os Baralhos", async () => {
    const cliente = clienteDeProva();
    const ingles = await cliente.criarBaralho({ nome: "Inglês" });
    const matematica = await cliente.criarBaralho({ nome: "Matemática" });
    if (!ingles.ok || !matematica.ok) throw new Error("baralho recusado");
    await cliente.criarCartao(ingles.baralho.id, { frente: "hello", verso: "olá" });
    await cliente.criarCartao(ingles.baralho.id, { frente: "bye", verso: "tchau" });
    await cliente.criarCartao(matematica.baralho.id, { frente: "2+2", verso: "4" });

    render(<ProvedorDeIdioma idiomaInicial="pt"><PaginaDeExportacao cliente={cliente} /></ProvedorDeIdioma>);

    expect(await screen.findByRole("checkbox", { name: /Inglês/ })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByText("Inglês").closest("label")).toHaveTextContent("2");
    expect(screen.getByText("Matemática").closest("label")).toHaveTextContent("1");
    expect(screen.getByText("Marque ao menos um Baralho")).toBeInTheDocument();

    const todos = screen.getByRole("checkbox", { name: "Todos os Baralhos" });
    fireEvent.click(todos);
    expect(screen.getByRole("checkbox", { name: /Inglês/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Matemática/ })).toBeChecked();
    expect(await screen.findByText("2 Baralhos · 3 Cartões")).toBeInTheDocument();

    fireEvent.click(todos);
    expect(screen.getByRole("checkbox", { name: /Inglês/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Matemática/ })).not.toBeChecked();
    expect(screen.getByText("Marque ao menos um Baralho")).toBeInTheDocument();
  });

  it("atualiza o resumo ao desmarcar um Baralho", async () => {
    const cliente = clienteDeProva();
    const ingles = await cliente.criarBaralho({ nome: "Inglês" });
    const matematica = await cliente.criarBaralho({ nome: "Matemática" });
    if (!ingles.ok || !matematica.ok) throw new Error("baralho recusado");
    await cliente.criarCartao(ingles.baralho.id, { frente: "hello", verso: "olá" });
    await cliente.criarCartao(ingles.baralho.id, { frente: "bye", verso: "tchau" });
    await cliente.criarCartao(matematica.baralho.id, { frente: "2+2", verso: "4" });

    render(<ProvedorDeIdioma idiomaInicial="pt"><PaginaDeExportacao cliente={cliente} todos /></ProvedorDeIdioma>);

    expect(await screen.findByText("2 Baralhos · 3 Cartões")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Inglês/ }));
    expect(await screen.findByText("1 Baralho · 1 Cartão")).toBeInTheDocument();
  });

  it("abre com todos os Baralhos marcados quando a rota traz todos", async () => {
    const cliente = clienteDeProva();
    const ingles = await cliente.criarBaralho({ nome: "Inglês" });
    const matematica = await cliente.criarBaralho({ nome: "Matemática" });
    if (!ingles.ok || !matematica.ok) throw new Error("baralho recusado");
    await cliente.criarCartao(ingles.baralho.id, { frente: "hello", verso: "olá" });
    await cliente.criarCartao(matematica.baralho.id, { frente: "2+2", verso: "4" });

    render(<ProvedorDeIdioma idiomaInicial="pt"><PaginaDeExportacao cliente={cliente} todos /></ProvedorDeIdioma>);

    expect(await screen.findByRole("checkbox", { name: /Inglês/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Matemática/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Todos os Baralhos" })).toBeChecked();
  });

  it("mostra a contagem de mídia e o tamanho formatado com Intl.NumberFormat", async () => {
    const cliente = clienteDeProva();
    const criado = await cliente.criarBaralho({ nome: "Inglês" });
    if (!criado.ok) throw new Error("baralho recusado");
    await cliente.criarCartao(criado.baralho.id, { frente: "hello", verso: "olá" });
    vi.spyOn(cliente, "previaDaExportacao").mockResolvedValue({ ok: true, previa: { formato: "apkg", extensao: "apkg", baralhos: 1, cartoes: 3, cartoesComImagem: 2, cartoesComAudio: 1, bytesEstimados: 1536 } });

    render(<ProvedorDeIdioma idiomaInicial="pt"><PaginaDeExportacao cliente={cliente} baralhoId={criado.baralho.id} /></ProvedorDeIdioma>);

    expect(await screen.findByText("2 com Imagem, 1 com Áudio")).toBeInTheDocument();
    const tamanho = new Intl.NumberFormat("pt-BR", { style: "unit", unit: "kilobyte", unitDisplay: "short", maximumFractionDigits: 0 }).format(1.536);
    expect(screen.getByText(`Tamanho aproximado: ${tamanho}`)).toBeInTheDocument();
  });

  it("formata o tamanho em MB com unidade curta no idioma inglês", async () => {
    const cliente = clienteDeProva();
    const criado = await cliente.criarBaralho({ nome: "Inglês" });
    if (!criado.ok) throw new Error("baralho recusado");
    await cliente.criarCartao(criado.baralho.id, { frente: "hello", verso: "olá" });
    vi.spyOn(cliente, "previaDaExportacao").mockResolvedValue({ ok: true, previa: { formato: "apkg", extensao: "apkg", baralhos: 1, cartoes: 3, cartoesComImagem: 2, cartoesComAudio: 0, bytesEstimados: 1381234 } });

    render(<ProvedorDeIdioma idiomaInicial="en"><PaginaDeExportacao cliente={cliente} baralhoId={criado.baralho.id} /></ProvedorDeIdioma>);

    expect(await screen.findByText("Approximate size: 1.4 MB")).toBeInTheDocument();
    expect(screen.queryByText(/ byte/)).toBeNull();
  });
});
