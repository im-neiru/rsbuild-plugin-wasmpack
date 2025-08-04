import fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import type { RsbuildPlugin, RsbuildPluginAPI } from "@rsbuild/core";
import { sync as runSync } from "cross-spawn";
import { aliasTsconfig } from "./alias-tsconfig.js";
import { buildCrates, watchCrates } from "./builder.js";
import type { PluginWasmPackOptions } from "./options.js";
import { detectCargoBin, RustInstaller } from "./rust-installer.js";

let watcher: ReturnType<typeof watchCrates> | null = null;

export const pluginWasmPack = (
  options: PluginWasmPackOptions
): RsbuildPlugin => ({
  name: "rsbuild:wasmpack",
  setup: async (api: RsbuildPluginAPI) => {
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
        runSync(
          path.join(cargoBinPath, `cargo${exeExt}`),
          ["install", "wasm-pack"],
          {
            stdio: "inherit",
          }
        );
        wasmPackPath = path.resolve(cargoBinPath, `wasm-pack${exeExt}`);
        if (!fs.existsSync(wasmPackPath))
          throw new Error("wasm-pack install failed.");
      } else {
        throw new Error(
          "wasm-pack not found and autoInstallWasmPack is disabled."
        );
      }
    }

    api.onBeforeBuild(async () => {
      await buildCrates(options, wasmPackPath, false);
    });

    api.onBeforeStartDevServer(async () => {
      await buildCrates(options, wasmPackPath, true);
    });

    api.onAfterStartDevServer(() => {
      watcher = watchCrates(options, wasmPackPath, api.logger);
    });

    api.onCloseDevServer(() => {
      if (watcher) {
        watcher.close();
      }
    });

    if (options.aliasPkgDir != false) {
      api.modifyBundlerChain((chain) => {
        const aliasName = options.pkgsDir
          ? `@${path.basename(options.pkgsDir)}`
          : "@pkgs";

        const pkgsDir = options.pkgsDir ?? "pkgs";

        chain.resolve.alias.set(aliasName, pkgsDir);

        aliasTsconfig(aliasName, pkgsDir);
      });
    }
  },
});
