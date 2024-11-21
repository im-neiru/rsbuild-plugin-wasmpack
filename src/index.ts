import type { RsbuildPlugin } from "@rsbuild/core";
import { spawnSync } from "child_process";
import path from "path";

export type PluginWasmPackOptions = {
  crate: string;
};

export const pluginWasmPack = (
  options: PluginWasmPackOptions
): RsbuildPlugin => ({
  name: "rsbuild:wasmpack",
  setup: (api) => {
    if (!(options?.crate?.length > 0)) {
      throw new Error("Crate name is missing");
    }

    const cratePath = path.resolve(options.crate);

    api.onBeforeStartDevServer(() => {
      console.log(`Building WASM crate at: ${cratePath}`);

      const result = spawnSync("/home/lien/.cargo/bin/wasm-pack", ["build"], {
        cwd: cratePath,
        stdio: "inherit",
        shell: process.platform === "win32",
      });

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
