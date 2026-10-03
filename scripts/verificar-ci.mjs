import { spawn } from "node:child_process";

const etapas = [
  { comando: "gitleaks", argumentos: ["git", "--redact", "--config", ".gitleaks.toml"], nome: "Segredos" },
  { comando: "npm", argumentos: ["run", "typecheck"], diretorio: "backend", nome: "Backend: typecheck" },
  { comando: "npm", argumentos: ["run", "lint"], diretorio: "backend", nome: "Backend: lint" },
  { comando: "npm", argumentos: ["test"], diretorio: "backend", nome: "Backend: testes" },
  { comando: "npm", argumentos: ["run", "lint"], diretorio: "frontend", nome: "Frontend: lint" },
  { comando: "npm", argumentos: ["test"], diretorio: "frontend", nome: "Frontend: testes" },
  { comando: "npm", argumentos: ["run", "build"], diretorio: "frontend", nome: "Frontend: build" },
  { comando: "npm", argumentos: ["run", "test:e2e"], nome: "E2E: Playwright" },
];

for (const etapa of etapas) {
  process.stdout.write(`\n==> ${etapa.nome}\n`);

  const codigo = await new Promise((resolver, rejeitar) => {
    const processo = spawn(etapa.comando, etapa.argumentos, {
      cwd: etapa.diretorio,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    processo.on("error", rejeitar);
    processo.on("close", resolver);
  });

  if (codigo !== 0) {
    process.exitCode = codigo ?? 1;
    break;
  }
}
