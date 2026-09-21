import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PaginaInicial } from "../src/ui/PaginaInicial";

describe("PaginaInicial", () => {
  it("apresenta a página de infraestrutura do frontend", () => {
    render(<PaginaInicial />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Memorization" }),
    ).toBeInTheDocument();
  });

  it("declara que nenhuma funcionalidade de domínio está disponível", () => {
    render(<PaginaInicial />);

    expect(
      screen.getByText(/nenhuma funcionalidade de domínio/i, { selector: "p" }),
    ).toBeInTheDocument();
  });
});
