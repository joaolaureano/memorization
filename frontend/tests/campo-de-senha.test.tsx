import { createRef } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CampoDeSenha } from "../src/ui/CampoDeSenha";

/**
 * Campo de senha com Mostrar/Ocultar (FR-142).
 *
 * O rótulo leva ao `<input>` (e não ao botão, cujo nome também contém o rótulo,
 * por isso a busca é exata). A senha começa mascarada, e alternar só troca o
 * `type`, mantendo valor e foco.
 *
 * O texto visível do botão é curto ("Mostrar"/"Ocultar") para não espremer o
 * campo em telas estreitas; o nome acessível segue completo ("Mostrar Senha"),
 * com a palavra visível contida nele (WCAG 2.5.3).
 */

describe("CampoDeSenha", () => {
  it("associa o rótulo ao campo e começa mascarado", () => {
    render(
      <CampoDeSenha
        id="senha"
        rotulo="Senha"
        valor="segredo"
        aoMudar={() => {}}
        autoComplete="current-password"
      />,
    );

    const campo = screen.getByLabelText("Senha", { exact: true });
    expect(campo).toBeInstanceOf(HTMLInputElement);
    expect(campo).toHaveAttribute("type", "password");
    expect(campo).toHaveAttribute("autocomplete", "current-password");
    expect(campo).not.toHaveAttribute("aria-describedby");
    expect(campo).not.toHaveAttribute("aria-invalid");
  });

  it("alterna a visibilidade sem mudar o valor nem o foco", () => {
    render(
      <CampoDeSenha
        id="senha"
        rotulo="Senha"
        valor="segredo"
        aoMudar={() => {}}
        autoComplete="current-password"
      />,
    );

    const campo = screen.getByLabelText("Senha", { exact: true });
    const mostrar = screen.getByRole("button", { name: "Mostrar Senha" });
    expect(mostrar).toHaveAttribute("aria-pressed", "false");
    expect(mostrar).toHaveAttribute("aria-controls", "senha");
    expect(mostrar).toHaveTextContent("Mostrar");
    expect(mostrar).not.toHaveTextContent("Mostrar Senha");
    expect(mostrar).toHaveAccessibleName("Mostrar Senha");

    mostrar.focus();
    fireEvent.click(mostrar);

    expect(campo).toHaveAttribute("type", "text");
    expect(campo).toHaveValue("segredo");

    const ocultar = screen.getByRole("button", { name: "Ocultar Senha" });
    expect(ocultar).toHaveAttribute("aria-pressed", "true");
    expect(ocultar).toHaveFocus();
    expect(ocultar).toHaveTextContent("Ocultar");
    expect(ocultar).toHaveAccessibleName("Ocultar Senha");

    fireEvent.click(ocultar);

    expect(campo).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: "Mostrar Senha" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("mantém o nome acessível completo mesmo com o texto visível curto", () => {
    render(
      <CampoDeSenha
        id="confirmacao"
        rotulo="Confirmação da Senha"
        valor=""
        aoMudar={() => {}}
        autoComplete="new-password"
      />,
    );

    const mostrar = screen.getByRole("button", {
      name: "Mostrar Confirmação da Senha",
    });
    expect(mostrar).toHaveTextContent("Mostrar");
    expect(mostrar).not.toHaveTextContent("Confirmação da Senha");

    fireEvent.click(mostrar);

    const ocultar = screen.getByRole("button", {
      name: "Ocultar Confirmação da Senha",
    });
    expect(ocultar).toHaveTextContent("Ocultar");
  });

  it("entrega o texto digitado a aoMudar", () => {
    const aoMudar = vi.fn();
    render(
      <CampoDeSenha
        id="senha"
        rotulo="Senha"
        valor=""
        aoMudar={aoMudar}
        autoComplete="new-password"
      />,
    );

    fireEvent.change(screen.getByLabelText("Senha", { exact: true }), {
      target: { value: "nova-senha" },
    });

    expect(aoMudar).toHaveBeenCalledWith("nova-senha");
  });

  it("aplica descrição, invalidez e obrigatoriedade quando informados", () => {
    render(
      <CampoDeSenha
        id="confirmacao"
        rotulo="Confirmação"
        valor=""
        aoMudar={() => {}}
        autoComplete="new-password"
        descritoPor="ajuda-confirmacao"
        invalido
        obrigatorio
      />,
    );

    const campo = screen.getByLabelText("Confirmação", { exact: true });
    expect(campo).toHaveAttribute("aria-describedby", "ajuda-confirmacao");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toBeRequired();
  });

  it("encaminha a referência para o input", () => {
    const referencia = createRef<HTMLInputElement>();
    render(
      <CampoDeSenha
        id="senha"
        rotulo="Senha"
        valor=""
        aoMudar={() => {}}
        autoComplete="current-password"
        referencia={referencia}
      />,
    );

    expect(referencia.current).toBe(
      screen.getByLabelText("Senha", { exact: true }),
    );
  });
});
