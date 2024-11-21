import type { RsbuildPlugin } from "@rsbuild/core";
import { sync as runSync } from "cross-spawn";
import path from "path";
import fs from "fs";

export type PluginWasmPackOptions = {
  crate: string;
  output: string;
  target: "nodejs" | "web" | "no-modules" | "deno" | "bundler";
};

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

    api.onBeforeBuild(() => {
      if (!fs.existsSync(wasmPackPath)) {
        throw new Error(`wasm-pack not found please install it`);
      }

      if (!fs.existsSync(cratePath)) {
        throw new Error(`${options.crate} does not exists`);
      }

      console.log(`Building WASM crate at: ${cratePath}`);

      const result = runSync(
        wasmPackPath,
        ["build", "--out-dir", outputPath, "--target", options.target],
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

      console.log("WASM build completed successfully!");
    });
  },
});
