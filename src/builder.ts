import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import type { Logger } from "@rsbuild/core";
import chokidar, { type ChokidarOptions } from "chokidar";
import { execa } from "execa";
import { load as loadToml } from "js-toml";
import wabtFactory from "wabt";
import type {
  CrateTarget,
  PluginWasmPackOptions,
  ProfileType,
} from "./options.js";

export type Mutex = { ready: Promise<void> };

export function watchCrates(
  logger: Logger,
  options: PluginWasmPackOptions,
  rootPath: string,
  wasmPackPath: string,
  mutex: Mutex,
) {
  const crates = readCrateTomls(
    rootPath,
    options.pkgsDir ?? "pkgs",
    options.crates,
    logger,
  );

  const watchPaths = crates
    .filter(({ liveReload = true }) => liveReload)
    .map((crate) => path.join(crate.path, "src"));

  const watchOptions: ChokidarOptions = {
    ignoreInitial: true,
    usePolling: true,
    interval: 300,
    binaryInterval: 1000,
    ignored: (filePath: string) => {
      const normalized = path.resolve(filePath);
      return normalized.includes(`${path.sep}target${path.sep}`);
    },
  };

  let building = false;
  let pendingCrate: (typeof crates)[number] | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const DEBOUNCE_MS = 200;

  function createWatcher() {
    const w = chokidar.watch(watchPaths, watchOptions);

    w.on("error", (error) => {
      logger.warn(
        `[rsbuild:wasmpack] Watcher error: ${(error as Error).message}. Recreating watcher...`,
      );
      w.close().then(() => {
        watcher = createWatcher();
      });
    });

    w.on("all", (event, filePath) => {
      const crate = crates.find((crate) =>
        path.resolve(filePath).startsWith(crate.path),
      );

      if (!crate) return;

      logger.info(`[rsbuild:wasmpack] ${event} → ${filePath}`);

      pendingCrate = crate;

      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const crateToRebuild = pendingCrate;
        pendingCrate = null;

        if (!crateToRebuild || building) return;

        triggerRebuild(crateToRebuild);
      }, DEBOUNCE_MS);
    });

    return w;
  }

  async function triggerRebuild(crate: (typeof crates)[number]) {
    building = true;
    const profile = crate.profileOnDev ?? "dev";

    let resolveReady!: () => void;
    const promise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    mutex.ready = promise;

    try {
      await buildCrate(
        wasmPackPath,
        crate.path,
        crate.output,
        crate.target,
        profile,
        crate.features,
        crate.defaultFeatures,
      );

      const stripWasm = crate.stripWasm?.includes(profile) ?? false;

      if (stripWasm) {
        stripWasmIn(logger, crate.output);
      }
    } catch (err) {
      logger.error(`[rsbuild:wasmpack] Failed to build ${crate.name}:`, err);
    } finally {
      building = false;
      resolveReady();

      if (pendingCrate) {
        const nextCrate = pendingCrate;
        pendingCrate = null;
        triggerRebuild(nextCrate);
      }
    }
  }

  let watcher = createWatcher();

  return {
    close: () => watcher.close(),
  };
}

export async function buildCrates(
  logger: Logger,
  options: PluginWasmPackOptions,
  rootPath: string,
  wasmPackPath: string,
  devMode: boolean,
) {
  const crates = readCrateTomls(
    rootPath,
    options.pkgsDir ?? "pkgs",
    options.crates,
    logger,
  );

  const results = await Promise.allSettled(
    crates.map((crate) =>
      buildCrate(
        wasmPackPath,
        crate.path,
        crate.output,
        crate.target,
        devMode
          ? (crate.profileOnDev ?? "dev")
          : (crate.profileOnProd ?? "release"),
        crate.features,
        crate.defaultFeatures,
      ),
    ),
  );

  for (const [i, result] of results.entries()) {
    const crate = crates[i];
    const name = path.basename(crate.path);

    if (result.status === "rejected") {
      logger.error(
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `❌ Build failed: ${name}\n` +
          `${result.reason.message}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
      );
    } else {
      logger.info(`✅ Successfully built: ${name}`);
    }
  }

  await Promise.all(
    crates
      .filter((_, i) => results[i].status === "fulfilled")
      .map((crate) => {
        const profile = devMode
          ? (crate.profileOnDev ?? "dev")
          : (crate.profileOnProd ?? "release");

        const stripWasm = crate.stripWasm?.includes(profile) ?? false;

        return stripWasm ? stripWasmIn(logger, crate.output) : undefined;
      }),
  );
}

async function buildCrate(
  wasmPackPath: string,
  cratePath: string,
  outputPath: string,
  target: CrateTarget["target"],
  profile: ProfileType,
  features?: string[],
  defaultFeatures?: boolean,
): Promise<void> {
  const args = [
    "build",
    "--out-dir",
    outputPath,
    "--target",
    target,
    `--${profile}`,
  ];

  if (features)
    features.forEach((feature) => {
      args.push("--features");
      args.push(feature);
    });
  if (defaultFeatures === false) args.push("--no-default-features");

  try {
    await execa(wasmPackPath, args, {
      cwd: cratePath,
      stdio: "inherit",
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([key]) => key !== "RUST_LOG"),
        ),
        PATH: `${process.env.PATH}:${path.resolve(
          process.env.HOME || "",
          ".cargo/bin",
        )}`,
      },
    });
  } catch (error) {
    throw new Error(
      `wasm-pack failed for ${cratePath}: ${(error as Error).message}`,
    );
  }
}

function readCrateTomls(
  rootPath: string,
  pkgsDir: string,
  crates: CrateTarget[],
  logger: Logger,
) {
  const result: (CrateTarget & { output: string; name: string })[] = [];

  for (const crate of crates) {
    const fullPath = path.resolve(rootPath, crate.path);
    const cargoTomlPath = path.join(fullPath, "Cargo.toml");

    if (
      !fs.existsSync(fullPath) ||
      !fs.statSync(fullPath).isDirectory() ||
      !fs.existsSync(cargoTomlPath) ||
      !fs.statSync(cargoTomlPath).isFile()
    ) {
      const crateName = path.basename(fullPath);

      logger.error(
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `❌ Invalid Rust crate at "${fullPath}". ` +
          `Make sure the directory exists and contains a Cargo.toml file.\n` +
          `You can create one with: wasm-pack new ${crateName}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
      );

      throw new Error();
    }

    const cargoToml = loadToml(
      fs.readFileSync(cargoTomlPath, "utf-8"),
    ) as CargoToml;

    if (!cargoToml?.package?.name) {
      throw new Error(`Missing package name in Cargo.toml at ${crate.path}`);
    }

    result.push({
      ...crate,
      path: fullPath,
      output: path.resolve(rootPath, pkgsDir, cargoToml.package.name),
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
  filePath: string,
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
