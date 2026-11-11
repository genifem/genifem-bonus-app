// Regenerates src/schema.d.ts from the API's OpenAPI schema.
//   pnpm gen:api
//
// The schema comes from the bonus-backend checkout beside this one (or CREWSTARS_BACKEND),
// which is the only place it is authoritative. Without that checkout the committed
// openapi.json is used instead, so a fresh clone can still install and build - it just
// cannot notice that the API has moved on. CI fails if the generated types differ from what
// is committed.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "..");
// `||`, not `??`: CI passes an empty string when it did not check the API out.
const backend = process.env.CREWSTARS_BACKEND || resolve(pkg, "../../../bonus-backend");
const exporter = resolve(backend, "app/scripts/export_openapi.py");
const specPath = resolve(pkg, "openapi.json");
const outPath = resolve(pkg, "src/schema.d.ts");

// Config values are required to import the app but unused when exporting the schema.
const env = {
  ...process.env,
  CS_MONGODB_URI: process.env.CS_MONGODB_URI ?? "mongodb://unused",
  CS_JWT_SECRET: process.env.CS_JWT_SECRET ?? "x".repeat(32),
};

// No shell: arguments are passed verbatim, so paths with spaces stay intact.
function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, env, stdio: "inherit" });
}

function hasUv() {
  try {
    execFileSync("uv", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (existsSync(exporter)) {
  // uv on PATH when there is one (CI), else the copy installed into Python (`python -m uv`).
  const [py, pyArgs] = hasUv() ? ["uv", []] : ["python", ["-m", "uv"]];
  run(py, [...pyArgs, "run", "python", "-m", "app.scripts.export_openapi", specPath], backend);
} else {
  console.warn(
    `no API checkout at ${backend} - generating from the committed openapi.json.\n` +
      "Check out bonus-backend beside this repository, or set CREWSTARS_BACKEND, to pick up API changes.",
  );
}

const require = createRequire(import.meta.url);
const cli = resolve(dirname(require.resolve("openapi-typescript/package.json")), "bin/cli.js");
run(process.execPath, [cli, specPath, "-o", outPath], pkg);
