import type { RsbuildPlugin } from "@rsbuild/core";
import { sync as runSync } from "cross-spawn";
import path from "path";
import fs from "fs";

/**
 * Options for configuring the `pluginWasmPack`.
 */
export type PluginWasmPackOptions = {
  /**
   * The path to the Rust crate to be built using `wasm-pack`.
   * This should point to the directory containing the `Cargo.toml` file.
   */
  crate: string;

  /**
   * The output directory where the compiled WebAssembly
   * will be placed after running `wasm-pack`.
   */
  output: string;

  /**
   * The target environment for the compiled WebAssembly package.
   *
   * - `"nodejs"`: Optimized for Node.js runtime.
   * - `"web"`: Optimized for usage in web browsers.
   * - `"no-modules"`: Generates a package without ES6 modules.
   * - `"deno"`: Generates a package compatible with Deno.
   * - `"bundler"`: Generates a package for module bundlers like Webpack or Rollup.
   */
  target: "nodejs" | "web" | "no-modules" | "deno" | "bundler";
};

let watcher: fs.FSWatcher | null = null;

/**
 * Creates an `RsbuildPlugin` that uses `wasm-pack` to build a Rust crate
 * into a WebAssembly package.
 *
 * @param options - Configuration options for the plugin.
 * @returns An `RsbuildPlugin` instance that can be used in the build process.
 */
export const pluginWasmPack = (
  options: PluginWasmPackOptions
): RsbuildPlugin => ({
  name: "rsbuild:wasmpack",
  setup: (api) => {
    if (!(options?.crate?.length > 0)) {
      throw new Error("Crate path is missing");
    }

    if (!(options?.target?.length > 0)) {
      throw new Error("Target is missing");
    }

    if (!(options?.crate?.length > 0)) {
      throw new Error("Output path is missing");
    }

    const cratePath = path.resolve(options.crate);
    const outputPath = path.resolve(options.output);
    const wasmPackPath = path.resolve(
      process.env.HOME || "",
      ".cargo/bin/wasm-pack"
    );

    if (!fs.existsSync(wasmPackPath)) {
      throw new Error(`wasm-pack not found please install it`);
    }

    if (!fs.existsSync(cratePath)) {
      throw new Error(`${cratePath} does not exists`);
    }

    function initialBuild() {
      console.log(`Building WASM crate at: ${cratePath}`);

      buildCrate(wasmPackPath, cratePath, outputPath, options.target);
    }

    api.onBeforeBuild(initialBuild);

    api.onBeforeStartProdServer(initialBuild);

    api.onBeforeStartDevServer(() => {
      initialBuild();

      const crateSrc = path.join(cratePath, "src");

      if (!fs.existsSync(crateSrc)) {
        throw new Error(`${crateSrc} does not exists`);
      }

      if (watcher) {
        watcher.close();
      }

      watcher = fs.watch(crateSrc, { encoding: "buffer" }, (eventType) => {
        if (eventType !== "change") return;

        console.log(`Rebuilding WASM crate`);

        buildCrate(wasmPackPath, cratePath, outputPath, options.target);
      });
    });

    api.onCloseDevServer(() => {
      watcher?.close();
      watcher = null;
    });
  },
});

function buildCrate(
  wasmPackPath: string,
  cratePath: string,
  outputPath: string,
  target: PluginWasmPackOptions["target"]
) {
  const result = runSync(
    wasmPackPath,
    ["build", "--out-dir", outputPath, "--target", target],
    {
      stdio: "inherit",
      cwd: cratePath,
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:${path.resolve(
          process.env.HOME || "",
          ".cargo/bin"
        )}`,
      },
    }
  );

  if (result.error) {
    throw new Error(`Failed to run wasm-pack: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`wasm-pack exited with status code ${result.status}`);
  }
}
