import { fireEvent, render, screen } from "@testing-library/react";
import { useIdioma, ProvedorDeIdioma } from "../src/idioma";
import { afterEach, describe, expect, it, vi } from "vitest";

function Sonda() {
  const { idioma, textos, escolher } = useIdioma();
  return (
    <>
      <p>{textos.seletor.nomeDoIdioma}</p>
      <button onClick={() => escolher("en")}>Escolher inglês</button>
      <output>{idioma}</output>
    </>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("persistência do idioma", () => {
  it("grava a escolha e a usa na próxima montagem", () => {
    const primeira = render(
      <ProvedorDeIdioma idiomaInicial="pt"><Sonda /></ProvedorDeIdioma>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Escolher inglês" }));

    expect(localStorage.getItem("memorization.idioma")).toBe("en");
    primeira.unmount();
    render(<ProvedorDeIdioma><Sonda /></ProvedorDeIdioma>);

    expect(screen.getByText("English")).toBeInTheDocument();
  });

  it("usa o navegador e continua funcional se localStorage lançar exceções", () => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["en-GB"],
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    render(<ProvedorDeIdioma><Sonda /></ProvedorDeIdioma>);
    expect(screen.getByText("English")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Escolher inglês" }));
    expect(screen.getByText("en")).toBeInTheDocument();
  });
});
