import fs from "node:fs";
import path from "node:path";
import type { Logger } from "@rsbuild/core";
import chokidar from "chokidar";
import { execa } from "execa";
import { load as loadToml } from "js-toml";
import type {
  CrateTarget,
  PluginWasmPackOptions,
  ProfileType,
} from "./options.js";

export function watchCrates(
  options: PluginWasmPackOptions,
  wasmPackPath: string,
  logger: Logger
) {
  const watcher = chokidar.watch(
    options.crates.map((crate) => path.join(crate.path, "src")),
    {
      ignoreInitial: true,
      usePolling: false,
    }
  );

  const crates = readCrateTomls(options.pkgsDir ?? "pkgs", options.crates)!;

  watcher.on("all", async (event, filePath) => {
    const crate = crates.find((crate) =>
      path.resolve(filePath).startsWith(crate.path)
    );

    if (!crate) return;
    logger.info(`[rsbuild:wasmpack] ${event} → ${filePath}`);
    try {
      await buildCrate(
        wasmPackPath,
        crate.path,
        crate.output,
        crate.target,
        crate.profileOnDev ?? "dev"
      );
    } catch (err) {
      logger.error(`[rsbuild:wasmpack] Failed to build ${crate.name}:`, err);
    }
  });

  return watcher;
}

export async function buildCrates(
  options: PluginWasmPackOptions,
  wasmPackPath: string,
  devMode: boolean
) {
  const crates = readCrateTomls(options.pkgsDir ?? "pkgs", options.crates)!;

  await Promise.all(
    crates.map((crate) =>
      buildCrate(
        wasmPackPath,
        crate.path,
        crate.output,
        crate.target,
        devMode ? crate.profileOnDev ?? "dev" : crate.profileOnProd ?? "release"
      )
    )
  );
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

function readCrateTomls(pkgsDir: string, crates: CrateTarget[]) {
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
      output: path.resolve(pkgsDir, cargoToml.package.name),
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
