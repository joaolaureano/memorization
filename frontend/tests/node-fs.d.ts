/**
 * Declarações mínimas de Node para o teste de T011, que lê `estilos.css`
 * como texto, e para o de T1008, que lê o pacote construído. O T1008 também
 * constrói em um diretório temporário próprio, para não disputar o `dist/`
 * compartilhado. O Vitest executa em Node, mas o projeto não instala
 * `@types/node` — então apenas o que é usado é declarado aqui.
 */
declare module "node:fs" {
  export function readFileSync(caminho: string, opcoes: "utf8"): string;
  export function readdirSync(caminho: string): string[];
  export function existsSync(caminho: string): boolean;
  export function mkdtempSync(prefixo: string): string;
  export function rmSync(caminho: string, opcoes: { recursive: boolean; force: boolean }): void;
}

declare module "node:path" {
  export function join(...partes: string[]): string;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare const process: {
  cwd(): string;
  execPath: string;
  env: Record<string, string | undefined>;
};
