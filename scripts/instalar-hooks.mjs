import { execFileSync } from "node:child_process";

/** Instala os hooks versionados somente neste clone. */
execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
  stdio: "inherit",
});
