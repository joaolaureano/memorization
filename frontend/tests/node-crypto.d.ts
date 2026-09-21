/**
 * Declaração mínima de Node para o apoio das provas de Entrar, que gera a
 * Senha de prova a cada execução. O Vitest executa em Node, mas o projeto não
 * instala `@types/node` — então apenas o que é usado é declarado aqui.
 *
 * Nenhum valor de Senha vem daqui: `randomBytes` produz um valor novo a cada
 * execução, e nada é versionado (Princípio VIII).
 */
declare module "node:crypto" {
  export function randomBytes(tamanho: number): {
    toString(codificacao: "base64url"): string;
  };
}
