import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  {
    files: ["**/*.ts"],
  },
  ...tseslint.configs.recommended,
  {
    /**
     * Scripts em `.mjs` executados pelo Node — `scripts/construir.mjs`. São
     * JavaScript de módulo do runtime, e não código de navegador: os globais
     * do Node usados por eles são declarados aqui, e nenhum global de
     * navegador entra na configuração.
     */
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
);

