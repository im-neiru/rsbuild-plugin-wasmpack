import fs from "node:fs";
import path from "node:path";
import type { Compiler } from "@rspack/core";
import { sync as runSync } from "cross-spawn";
import { load as loadToml } from "js-toml";
import type { CrateTarget, ProfileType } from "./options.js";

export class WasmPackPlugin {
  private crates: NonNullable<ReturnType<typeof readCrateTomls>>;
  private wasmPackPath: string;

  constructor(options: { crates: CrateTarget[]; wasmPackPath: string }) {
    this.crates = readCrateTomls(options.crates)!;
    this.wasmPackPath = options.wasmPackPath;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.beforeCompile.tapPromise("wasmpack", async () => {
      Promise.all(
        this.crates.map((crate) =>
          buildCrate(
            this.wasmPackPath,
            crate.path,
            crate.output,
            crate.target,
            crate.profileOnDev ?? "dev"
          )
        )
      );
    });

    compiler.hooks.watchRun.tapPromise("wasmpack", async (comp) => {
      const changedFiles = comp.modifiedFiles ?? new Set<string>();

      for (const crate of this.crates) {
        const crateSrcPath = path.join(crate.path, "src");
        const affected = [...changedFiles].some((f) =>
          f.startsWith(crateSrcPath)
        );
        if (affected) {
          console.info(`[rsbuild:wasmpack] Rebuilding ${crate.name}`);
          buildCrate(
            this.wasmPackPath,
            crate.path,
            crate.output,
            crate.target,
            crate.profileOnDev ?? "dev"
          );
        }
      }
    });
  }
}

function buildCrate(
  wasmPackPath: string,
  cratePath: string,
  outputPath: string,
  target: CrateTarget["target"],
  profile: ProfileType
): void {
  const result = runSync(
    wasmPackPath,
    ["build", "--out-dir", outputPath, "--target", target, `--${profile}`],
    {
      stdio: "inherit",
      cwd: cratePath,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([key]) => key !== "RUST_LOG")
        ),
        PATH: `${process.env.PATH}:${path.resolve(
          process.env.HOME || "",
          ".cargo/bin"
        )}`,
      },
    }
  );

  if (result.error)
    throw new Error(`wasm-pack failed: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`wasm-pack exited with status ${result.status}`);
}

function readCrateTomls(crates: CrateTarget[]) {
  const result: (CrateTarget & { output: string; name: string })[] = [];

  for (const crate of crates) {
    const fullPath = path.resolve(crate.path);
    const cargoToml = loadToml(
      fs.readFileSync(path.join(fullPath, "Cargo.toml"), "utf-8")
    ) as CargoToml;

    if (!cargoToml?.package?.name) {
      throw new Error(`Missing package name in Cargo.toml at ${crate.path}`);
    }

    result.push({
      ...crate,
      path: fullPath,
      output: path.resolve("node_modules", cargoToml.package.name),
      name: cargoToml.package.name,
    });

    return result!;
  }
}

type CargoToml = {
  package?: {
    name?: string;
  };
};
