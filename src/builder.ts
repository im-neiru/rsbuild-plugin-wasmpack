import fs from "node:fs";
import path from "node:path";
import type { Logger } from "@rsbuild/core";
import chokidar from "chokidar";
import { execa } from "execa";
import fsPromises from "fs/promises";
import { load as loadToml } from "js-toml";
import wabtFactory from "wabt";
import type {
  CrateTarget,
  PluginWasmPackOptions,
  ProfileType,
} from "./options.js";

export function watchCrates(
  logger: Logger,
  options: PluginWasmPackOptions,
  wasmPackPath: string,
  reload: () => void
) {
  const crates = readCrateTomls(options.pkgsDir ?? "pkgs", options.crates)!;

  const watcher = chokidar.watch(
    crates.map((crate) => path.join(crate.path, "src")),
    {
      ignoreInitial: true,
      usePolling: false,
      ignored: (filePath) => {
        const normalized = path.resolve(filePath);
        return normalized.includes(`${path.sep}target${path.sep}`);
      },
    }
  );

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

      stripWasmIn(logger, crate.output);
      reload();
    } catch (err) {
      logger.error(`[rsbuild:wasmpack] Failed to build ${crate.name}:`, err);
    }
  });

  return watcher;
}

export async function buildCrates(
  logger: Logger,
  options: PluginWasmPackOptions,
  wasmPackPath: string,
  devMode: boolean
) {
  const crates = readCrateTomls(options.pkgsDir ?? "pkgs", options.crates)!;

  const results = await Promise.allSettled(
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

  for (const [i, result] of results.entries()) {
    const crate = crates[i];
    const name = path.basename(crate.path);

    if (result.status === "rejected") {
      logger.error(
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `❌ Build failed: ${name}\n` +
          `${result.reason.message}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      );
    } else {
      logger.info(`✅ Successfully built: ${name}`);
    }
  }

  await Promise.all(
    crates
      .filter((_, i) => results[i].status === "fulfilled")
      .map((crate) => stripWasmIn(logger, crate.output))
  );
}

async function buildCrate(
  wasmPackPath: string,
  cratePath: string,
  outputPath: string,
  target: CrateTarget["target"],
  profile: ProfileType
): Promise<void> {
  {
    const cargoTomlPath = path.join(cratePath, "Cargo.toml");

    if (!fs.existsSync(cargoTomlPath) || !fs.statSync(cargoTomlPath).isFile()) {
      const crateName = path.basename(cratePath);
      throw new Error(
        `No Cargo.toml found in "${cratePath}". ` +
          `Run "wasm-pack new ${crateName}" to create a new crate.`
      );
    }
  }

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
  }

  return result;
}

type CargoToml = {
  package?: {
    name?: string;
  };
};

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

async function stripFile(
  wabt: UnwrapPromise<ReturnType<typeof wabtFactory>>,
  filePath: string
) {
  const bin = await fsPromises.readFile(filePath);
  const mod = wabt.readWasm(bin, { readDebugNames: false });

  const { buffer } = mod.toBinary({
    write_debug_names: false,
    canonicalize_lebs: true,
    relocatable: false,
  });

  await fsPromises.writeFile(filePath, Buffer.from(buffer));

  mod.destroy();
}

export async function stripWasmIn(logger: Logger, directory: string) {
  const wabt = await wabtFactory();
  const stat = await fsPromises.stat(directory);

  if (stat.isDirectory()) {
    const entries = await fsPromises.readdir(directory, {
      withFileTypes: true,
    });

    const wasms = entries
      .filter((e) => e.isFile() && e.name.endsWith(".wasm"))
      .map((e) => path.join(directory, e.name));

    if (wasms.length === 0) {
      logger.warn(`⚠️  No .wasm files found in directory: ${directory}`);
      return;
    }

    for (const wasmPath of wasms) {
      logger.info(`🗜️  Stripping wasm: ${wasmPath}`);
      await stripFile(wabt, wasmPath);
    }
  }
}
