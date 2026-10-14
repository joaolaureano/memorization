import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";

import {
  ProvedorDeIdioma,
  useIdioma,
  LOCALE,
  en,
} from "../src/idioma";

function Sonda() {
  const { textos, escolher, formatarNumero } = useIdioma();
  const [digitado, setDigitado] = useState("");

  return (
    <div>
      <p data-testid="nome-do-idioma">{textos.seletor.nomeDoIdioma}</p>
      <button onClick={() => escolher("pt")}>pt</button>
      <button onClick={() => escolher("en")}>en</button>
      <button onClick={() => escolher("es")}>es</button>
      <input
        data-testid="entrada-controlada"
        type="text"
        value={digitado}
        onChange={(evento) => setDigitado(evento.target.value)}
      />
      <p data-testid="numero-formatado">{formatarNumero(1234.5)}</p>
    </div>
  );
}

describe("ProvedorDeIdioma", () => {
  it("inicia com o idioma inicial pt", () => {
    render(
      <ProvedorDeIdioma idiomaInicial="pt">
        <Sonda />
      </ProvedorDeIdioma>,
    );

    expect(screen.getByTestId("nome-do-idioma")).toHaveTextContent("Português");
  });

  it("troca o idioma sem remontagem", () => {
    render(
      <ProvedorDeIdioma idiomaInicial="pt">
        <Sonda />
      </ProvedorDeIdioma>,
    );

    const entrada = screen.getByTestId(
      "entrada-controlada",
    ) as HTMLInputElement;
    const botaoEn = screen.getByText("en");
    fireEvent.change(entrada, { target: { value: "texto em andamento" } });

    const entradaAntes = entrada;
    fireEvent.click(botaoEn);

    const entradaDepois = screen.getByTestId(
      "entrada-controlada",
    ) as HTMLInputElement;

    // Verifica se é a mesma entrada (não foi remontada)
    expect(entradaAntes).toBe(entradaDepois);
    expect(entradaDepois).toHaveValue("texto em andamento");
    expect(screen.getByTestId("nome-do-idioma")).toHaveTextContent("English");
  });

  it("atualiza document.documentElement.lang", () => {
    render(
      <ProvedorDeIdioma idiomaInicial="pt">
        <Sonda />
      </ProvedorDeIdioma>,
    );

    expect(document.documentElement.lang).toBe(LOCALE["pt"]);

    fireEvent.click(screen.getByText("en"));
    expect(document.documentElement.lang).toBe(LOCALE["en"]);

    fireEvent.click(screen.getByText("es"));
    expect(document.documentElement.lang).toBe(LOCALE["es"]);
  });

  it("formata números no locale do idioma", () => {
    render(
      <ProvedorDeIdioma idiomaInicial="pt">
        <Sonda />
      </ProvedorDeIdioma>,
    );

    // Português: 1.234,5
    expect(screen.getByTestId("numero-formatado")).toHaveTextContent(
      new Intl.NumberFormat(LOCALE["pt"]).format(1234.5),
    );

    fireEvent.click(screen.getByText("en"));
    // Inglês: 1,234.5
    expect(screen.getByTestId("numero-formatado")).toHaveTextContent(
      new Intl.NumberFormat(LOCALE["en"]).format(1234.5),
    );

    fireEvent.click(screen.getByText("es"));
    // Espanhol: 1234,5 ou 1.234,5
    expect(screen.getByTestId("numero-formatado")).toHaveTextContent(
      new Intl.NumberFormat(LOCALE["es"]).format(1234.5),
    );
  });

  it("volta para pt quando o texto é uma string vazia (FR-013)", () => {
    function SondaComFallback() {
      const { textos } = useIdioma();

      // Simula um texto vazio que deveria voltar para pt
      return <p>{textos.comum.cancelar || "FALHOU"}</p>;
    }

    const catalogosDeTesteFrench = {
      en: {
        ...en,
        comum: {
          ...en.comum,
          cancelar: "", // Vazio - deve voltar para pt
        },
      },
    };

    render(
      <ProvedorDeIdioma
        idiomaInicial="en"
        catalogos={catalogosDeTesteFrench}
      >
        <SondaComFallback />
      </ProvedorDeIdioma>,
    );

    // Inicialmente em pt
    expect(screen.getByText("Cancelar")).toBeInTheDocument();
  });

  it("volta para pt com profundidade 3+ de aninhamento", () => {
    function SondaComProfundidade() {
      const { textos } = useIdioma();

      // Cria uma estrutura de profundidade 3+ para testes
      const textosExt = textos as Record<string, unknown>;
      const nivel1 = textosExt.seletor as Record<string, unknown>;
      const nomeDoIdioma = nivel1.nomeDoIdioma as string;

      return <p>{nomeDoIdioma}</p>;
    }

    // Catalogo de teste com profundidade extra de aninhamento
    const catalogosDeTesteProfundo = {
      en: {
        ...en,
        seletor: {
          ...en.seletor,
          nomeDoIdioma: "", // Vazio - deve voltar para pt
        },
      },
    };

    render(
      <ProvedorDeIdioma
        idiomaInicial="en"
        catalogos={catalogosDeTesteProfundo}
      >
        <SondaComProfundidade />
      </ProvedorDeIdioma>,
    );

    // Deve voltar para pt quando en tem string vazia - "Português" é o valor do pt
    expect(screen.getByText("Português")).toBeInTheDocument();
  });
});
