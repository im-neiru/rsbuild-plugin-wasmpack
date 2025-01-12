import type { RsbuildPlugin } from "@rsbuild/core";
import { sync as runSync } from "cross-spawn";
import path from "node:path";
import fs from "node:fs";
/**
 * Configuration options for the `pluginWasmPack`.
 */
export type PluginWasmPackOptions = {
  /**
   * A list of Rust crates to be built using `wasm-pack`.
   */
  crates: CrateTarget[];

  /**
   * The path to the `wasm-pack` executable. If not provided, the plugin will attempt to find it in the user's home directory.
   */
  wasmpackPath?: string;
};

export type CrateTarget = {
  /**
   * The file path to the Rust crate directory, which must contain the `Cargo.toml` file.
   */
  path: string;

  /**
   * Specifies the target environment for the generated WebAssembly package.
   *
   * - `"nodejs"`: For use with the Node.js runtime.
   * - `"web"`: For use in web browsers.
   * - `"no-modules"`: Outputs a package without ES6 module support.
   * - `"deno"`: Outputs a package compatible with the Deno runtime.
   * - `"bundler"`: Outputs a package suitable for module bundlers like Webpack or Rollup.
   */
  target: "nodejs" | "web" | "no-modules" | "deno" | "bundler";
};

let watchers = new Map<string, fs.FSWatcher>();

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
    const wasmPackPath =
      (options?.wasmpackPath?.length ?? 0) > 1
        ? path.resolve(options.wasmpackPath as string)
        : path.resolve(process.env.HOME || "", ".cargo/bin/wasm-pack");

    if (!fs.existsSync(wasmPackPath)) {
      throw new Error(
        "wasm-pack not found, please install wasm-pack or provide the path to the wasm-pack executable"
      );
    }

    if (!(options?.crates?.length > 0)) {
      throw new Error("No crates specified in the plugin options");
    }

    const crates = new Array<CrateTarget & { output: string }>();
    const paths = new Set<string>();

    for (const crate of options.crates) {
      if (!(crate?.path?.length > 0)) {
        throw new Error("Crate path is missing or invalid");
      }

      if (!(crate?.target?.length > 0)) {
        throw new Error(`No target directory for ${path.basename(crate.path)}`);
      }

      if (!fs.existsSync(path.resolve(crate.path, "Cargo.toml"))) {
        throw new Error(`${path.resolve(crate.path)} does not exists`);
      }

      const fullPath = path.resolve(crate.path);
      const crateName = path.basename(fullPath);

      crates.push({
        path: fullPath,
        output: path.resolve("node_modules", crateName),
        target: crate.target,
      });

      paths.add(fullPath);
    }

    function initialBuild() {
      for (const crate of options.crates) {
        const fullPath = path.resolve(crate.path);
        const crateName = path.basename(fullPath);
        console.log(`Building ${crateName}`);

        buildCrate(
          wasmPackPath,
          crate.path,
          path.resolve("node_modules", crateName),
          crate.target
        );
      }
    }

    api.onBeforeBuild(initialBuild);
    api.onBeforeStartProdServer(initialBuild);

    api.onBeforeStartDevServer(() => {
      initialBuild();

      for (const [_path, watcher] of watchers) {
        watcher.close();
      }

      watchers.clear();

      watchers = new Map(
        crates.map((crate) => [
          crate.path,
          fs.watch(
            path.resolve(crate.path, "src"),
            { encoding: "buffer", recursive: true },
            () => {
              console.log("Rebuilding ", path.basename(crate.path));

              buildCrate(wasmPackPath, crate.path, crate.output, crate.target);
            }
          ),
        ])
      );
    });

    api.onCloseDevServer(() => {
      for (const [_path, watcher] of watchers) {
        watcher.close();
      }

      watchers.clear();
    });
  },
});

function buildCrate(
  wasmPackPath: string,
  cratePath: string,
  outputPath: string,
  target: CrateTarget["target"]
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
