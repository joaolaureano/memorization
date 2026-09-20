import { afterAll, describe, expect, it } from "vitest";

import { criarServidor } from "../src/http/servidor.ts";

const servidor = criarServidor();

afterAll(async () => {
  await servidor.close();
});

describe("GET /health", () => {
  it("responde 200 com { status: 'ok' }", async () => {
    const resposta = await servidor.inject({ method: "GET", url: "/health" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ status: "ok" });
  });
});
