import fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import type { RsbuildPlugin, RsbuildPluginAPI } from "@rsbuild/core";
import { execaSync } from "execa";
import {
  aliasTsconfig,
  isValidUnscopedModuleName,
  loadOldAlias,
  saveOldAlias,
} from "./aliasing.js";
import { buildCrates, type Mutex, watchCrates } from "./builder.js";
import type { PluginWasmPackOptions } from "./options.js";
import { detectCargoBin, RustInstaller } from "./rust-installer.js";

export const pluginWasmPack = (
  options: PluginWasmPackOptions,
): RsbuildPlugin => ({
  name: "rsbuild:wasmpack",
  setup: async (api: RsbuildPluginAPI) => {
    const rootPath = api.context.rootPath;
    const pkgsDir = path.resolve(rootPath, options.pkgsDir ?? "pkgs");
    let watcher: ReturnType<typeof watchCrates> | null = null;

    if (options.pkgsDir) {
      if (!isValidUnscopedModuleName(path.basename(options.pkgsDir))) {
        throw new Error(
          "Invalid `pkgsDir`. Make sure it is a valid package name for NodeJS.",
        );
      }

      if (fs.existsSync(pkgsDir)) {
        const pkgsDirStat = fs.statSync(pkgsDir);

        if (pkgsDirStat.isFile()) {
          throw new Error(
            "Invalid `pkgsDir`. Make sure it is an empty directory and not a file.",
          );
        }
      } else {
        fs.mkdirSync(pkgsDir, { recursive: true });
      }
    }

    const exeExt = os.type().includes("Windows") ? ".exe" : "";
    let cargoBinPath = detectCargoBin();

    if (!cargoBinPath) {
      if (options.autoInstallRust === true) {
        const rustInstaller = new RustInstaller(options.rustToolchainOptions);
        cargoBinPath = await rustInstaller.install();
        if (!cargoBinPath) throw new Error("Rust toolchain install failed.");
      } else {
        throw new Error("Rust not found and autoInstallRust is disabled.");
      }
    }

    let wasmPackPath = options.wasmpackPath
      ? path.resolve(options.wasmpackPath)
      : path.resolve(os.homedir(), `.cargo/bin/wasm-pack${exeExt}`);

    if (!fs.existsSync(wasmPackPath)) {
      wasmPackPath = path.resolve(cargoBinPath, `wasm-pack${exeExt}`);
    }

    if (!fs.existsSync(wasmPackPath)) {
      if (options.autoInstallWasmPack) {
        execaSync(
          path.join(cargoBinPath, `cargo${exeExt}`),
          ["install", "wasm-pack"],
          {
            stdio: "inherit",
          },
        );
        wasmPackPath = path.resolve(cargoBinPath, `wasm-pack${exeExt}`);
        if (!fs.existsSync(wasmPackPath))
          throw new Error("wasm-pack install failed.");
      } else {
        throw new Error(
          "wasm-pack not found and autoInstallWasmPack is disabled.",
        );
      }
    }

    const wasmPackMutex: Mutex = { ready: Promise.resolve() };

    api.onBeforeBuild(async () => {
      await buildCrates(api.logger, options, rootPath, wasmPackPath, false);
    });

    api.onBeforeDevCompile(async () => {
      await wasmPackMutex.ready;
    });

    api.onBeforeStartDevServer(async () => {
      await buildCrates(api.logger, options, rootPath, wasmPackPath, true);

      watcher = watchCrates(
        api.logger,
        options,
        rootPath,
        wasmPackPath,
        wasmPackMutex,
      );
    });

    api.onCloseDevServer(() => {
      if (watcher) {
        watcher.close();
      }
    });

    if (options.aliasPkgDir !== false) {
      const aliasName = options.pkgsDir
        ? `@${path.basename(options.pkgsDir)}`
        : "@pkgs";

      api.modifyEnvironmentConfig((config, { mergeEnvironmentConfig }) => {
        return mergeEnvironmentConfig(config, {
          resolve: {
            alias: {
              [aliasName]: pkgsDir,
            },
          },
        });
      });

      const oldAlias = loadOldAlias(rootPath);

      if (oldAlias !== undefined && oldAlias !== aliasName) {
        aliasTsconfig(aliasName, oldAlias, pkgsDir, rootPath);
        saveOldAlias(aliasName, rootPath);
      } else {
        aliasTsconfig(aliasName, undefined, pkgsDir, rootPath);
        saveOldAlias(aliasName, rootPath);
      }
    }
  },
});
