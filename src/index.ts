import type { RsbuildPlugin } from "@rsbuild/core";
import { sync as runSync } from "cross-spawn";
import path from "path";
import fs from "fs";

export type PluginWasmPackOptions = {
  crate: string;
  output: string;
  target: "nodejs" | "web" | "no-modules" | "deno" | "bundler";
};

let watcher: fs.FSWatcher | null = null;

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
