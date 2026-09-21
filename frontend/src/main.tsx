import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ClienteHttp } from "./acervo-cliente/cliente-http";
import { PaginaDeCartoes } from "./ui/PaginaDeCartoes";
import "./estilos.css";

/**
 * Endereço da API em tempo de build (plan.md): lido de `VITE_ENDERECO_DA_API`,
 * com padrão utilizável sem configurar nada — a API local desta feature.
 */
const ENDERECO_PADRAO_DA_API = "http://127.0.0.1:3001";

const enderecoDaApi: string =
  import.meta.env.VITE_ENDERECO_DA_API ?? ENDERECO_PADRAO_DA_API;

const raiz = document.getElementById("raiz");

if (raiz === null) {
  throw new Error("Elemento raiz não encontrado.");
}

createRoot(raiz).render(
  <StrictMode>
    <PaginaDeCartoes cliente={new ClienteHttp(enderecoDaApi)} />
  </StrictMode>,
);
