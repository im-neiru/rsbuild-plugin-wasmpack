import fs from "node:fs";
import path from "node:path";
import type { Compiler } from "@rspack/core";
import chokidar from "chokidar";
import { execa } from "execa";
import { load as loadToml } from "js-toml";
import type { CrateTarget, ProfileType } from "./options.js";

export class WasmPackPlugin {
  private crates: NonNullable<ReturnType<typeof readCrateTomls>>;
  private wasmPackPath: string;
  private devMode: boolean;

  constructor(options: {
    crates: CrateTarget[];
    wasmPackPath: string;
    devMode: boolean;
  }) {
    this.crates = readCrateTomls(options.crates)!;
    this.wasmPackPath = options.wasmPackPath;
    this.devMode = options.devMode;
  }

  apply(compiler: Compiler): void {
    if (this.devMode) {
      const watcher = chokidar.watch(
        this.crates.map((crate) => path.join(crate.path, "src")),
        {
          ignoreInitial: true,
          usePolling: false,
        }
      );

      watcher.on("all", async (event, filePath) => {
        const crate = this.crates.find((c) => filePath.startsWith(c.path));
        if (!crate) return;

        console.info(`[rsbuild:wasmpack] ${event} → ${filePath}`);
        try {
          await buildCrate(
            this.wasmPackPath,
            crate.path,
            crate.output,
            crate.target,
            crate.profileOnDev ?? "dev"
          );
        } catch (err) {
          console.error(
            `[rsbuild:wasmpack] Failed to build ${crate.name}:`,
            err
          );
        }
      });
    }

    compiler.hooks.beforeCompile.tapPromise("wasmpack", async () => {
      await Promise.all(
        this.crates.map((crate) =>
          buildCrate(
            this.wasmPackPath,
            crate.path,
            crate.output,
            crate.target,
            this.devMode
              ? crate.profileOnDev ?? "dev"
              : crate.profileOnProd ?? "release"
          )
        )
      );
    });
  }
}

async function buildCrate(
  wasmPackPath: string,
  cratePath: string,
  outputPath: string,
  target: CrateTarget["target"],
  profile: ProfileType
): Promise<void> {
  try {
    await execa(
      wasmPackPath,
      ["build", "--out-dir", outputPath, "--target", target, `--${profile}`],
      {
        cwd: cratePath,
        stdio: "inherit",
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
  } catch (error) {
    throw new Error(
      `wasm-pack failed for ${cratePath}: ${(error as Error).message}`
    );
  }
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
