import type { RsbuildPlugin } from "@rsbuild/core";

export type PluginWasmPackOptions = {
  crate: string;
};

export const pluginWasmPack = (): RsbuildPlugin => ({
  name: "rsbuild:wasmpack",
  setup: (api) => {},
});
