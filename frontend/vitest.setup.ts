import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Início carrega estatísticas após Entrar; sob carga paralela o padrão de 1s causava falhas intermitentes.
configure({ asyncUtilTimeout: 4000 });

afterEach(cleanup);
