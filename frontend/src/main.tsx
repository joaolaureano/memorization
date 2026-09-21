import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import type { Credencial } from "./acervo-cliente/cliente";
import { ClienteHttp } from "./acervo-cliente/cliente-http";
import { Aplicacao } from "./ui/Aplicacao";
import "./estilos.css";

/**
 * Endereço da API em tempo de build (plan.md): lido de `VITE_ENDERECO_DA_API`,
 * com padrão utilizável sem configurar nada — a API local desta feature.
 */
const ENDERECO_PADRAO_DA_API = "http://127.0.0.1:3001";

const enderecoDaApi: string =
  import.meta.env.VITE_ENDERECO_DA_API ?? ENDERECO_PADRAO_DA_API;

/**
 * A fábrica do cliente: cada Credencial tem o seu `ClienteHttp`, porque é a
 * Credencial que acompanha toda chamada (FR-089). Enquanto ninguém tiver
 * entrado, o cliente existe sem Credencial e só serve à tela "Entrar" — as
 * rotas de acervo recusariam qualquer operação sua (FR-090).
 */
function criarCliente(credencial: Credencial | null): ClienteHttp {
  return new ClienteHttp(enderecoDaApi, credencial);
}

const raiz = document.getElementById("raiz");

if (raiz === null) {
  throw new Error("Elemento raiz não encontrado.");
}

createRoot(raiz).render(
  <StrictMode>
    <Aplicacao criarCliente={criarCliente} />
  </StrictMode>,
);
