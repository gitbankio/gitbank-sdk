import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(pkgDir, "dist");
const entry = path.resolve(pkgDir, "src/index.ts");

async function buildSDK() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const shared = {
    entryPoints: [entry],
    platform: "node",
    bundle: true,
    external: [],
    sourcemap: false,
    minify: false,
  };

  await esbuild({ ...shared, format: "esm", outfile: path.join(distDir, "index.js"), logLevel: "info" });
  await esbuild({ ...shared, format: "cjs", outfile: path.join(distDir, "index.cjs"), logLevel: "info" });

  console.log("  generating TypeScript declarations...");
  execSync("tsc --build tsconfig.json", { cwd: pkgDir, stdio: "inherit" });

  console.log("\n  @gitbank/sdk build complete");
  console.log("    dist/index.js   (ESM)");
  console.log("    dist/index.cjs  (CJS)");
  console.log("    dist/index.d.ts (declarations)");
}

buildSDK().catch((err) => {
  console.error(err);
  process.exit(1);
});
