/**
 * Declarações mínimas de Node para o teste de T1008, que **executa** a
 * construção de produção do SPA. O Vitest executa em Node, mas o projeto não
 * instala `@types/node` — então apenas o que é usado é declarado aqui.
 */
declare module "node:child_process" {
  export function spawnSync(
    comando: string,
    argumentos: string[],
    opcoes: {
      cwd: string;
      env: Record<string, string | undefined>;
      encoding: "utf8";
      timeout: number;
    },
  ): { status: number | null; stdout: string; stderr: string };
}
