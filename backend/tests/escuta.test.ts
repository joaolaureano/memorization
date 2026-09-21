import type { AddressInfo } from "node:net";

import { afterAll, describe, expect, it } from "vitest";

import {
  HOST_LOCAL,
  PortaInvalidaError,
  criarServidor,
  opcoesDeEscuta,
  portaConfigurada,
} from "../src/http/servidor.ts";

function ehAddressInfo(
  endereco: string | AddressInfo | null,
): endereco is AddressInfo {
  return endereco !== null && typeof endereco !== "string";
}

describe("constantes e configuração de escuta", () => {
  it('HOST_LOCAL é exatamente "127.0.0.1"', () => {
    expect(HOST_LOCAL).toBe("127.0.0.1");
  });

  it('HOST_LOCAL não é "0.0.0.0" nem "::"', () => {
    expect(HOST_LOCAL).not.toBe("0.0.0.0");
    expect(HOST_LOCAL).not.toBe("::");
  });

  it("portaConfigurada({}) devolve 3001", () => {
    expect(portaConfigurada({})).toBe(3001);
  });

  it('portaConfigurada({ PORTA: "4000" }) devolve 4000', () => {
    expect(portaConfigurada({ PORTA: "4000" })).toBe(4000);
  });

  it.each(["", "abc", "0", "65536", "3.5", "-1"])(
    "portaConfigurada({ PORTA: %j }) lança PortaInvalidaError",
    (valor) => {
      expect(() => portaConfigurada({ PORTA: valor })).toThrowError(
        PortaInvalidaError,
      );
      expect(() => portaConfigurada({ PORTA: valor })).toThrow(
        `PORTA inválida: ${JSON.stringify(valor)}. Informe um número inteiro entre 1 e 65535.`,
      );
    },
  );

  it("opcoesDeEscuta({}) devolve loopback na porta 3001", () => {
    expect(opcoesDeEscuta({})).toEqual({ host: "127.0.0.1", port: 3001 });
  });

  it('opcoesDeEscuta({ PORTA: "4000" }) devolve loopback na porta 4000', () => {
    expect(opcoesDeEscuta({ PORTA: "4000" })).toEqual({
      host: "127.0.0.1",
      port: 4000,
    });
  });
});

describe("bind efetivo", () => {
  const servidor = criarServidor();

  afterAll(async () => {
    if (servidor.server.listening) {
      await servidor.close();
    }
  });

  it('escuta em "127.0.0.1", nunca em "0.0.0.0" nem "::"', async () => {
    await servidor.listen({ ...opcoesDeEscuta({}), port: 0 });

    try {
      const endereco = servidor.server.address();

      expect(endereco).not.toBeNull();
      expect(typeof endereco).not.toBe("string");
      expect(ehAddressInfo(endereco)).toBe(true);

      if (!ehAddressInfo(endereco)) {
        throw new Error(`endereço de escuta inesperado: ${String(endereco)}`);
      }

      expect(endereco.address).toBe("127.0.0.1");
      expect(endereco.address).not.toBe("0.0.0.0");
      expect(endereco.address).not.toBe("::");
      expect(endereco.port).toBeGreaterThan(0);
    } finally {
      if (servidor.server.listening) {
        await servidor.close();
      }
    }
  });
});
